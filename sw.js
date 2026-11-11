// Memorándum: funcionamiento sin conexión.
// Cambia VERSION cada vez que subas un index.html nuevo para que los teléfonos se actualicen.
const VERSION='memorandum-v84';
const CORE=['./','index.html','manifest.webmanifest','manifest-ca.webmanifest','manifest-en.webmanifest','icons/icon-192.png','icons/icon-512.png','icons/apple-touch-icon.png','icons/favicon-32.png'];
self.addEventListener('install',e=>{e.waitUntil(caches.open(VERSION).then(c=>c.addAll(CORE)).then(()=>self.skipWaiting()))});
// Al activarse una versión nueva: las pantallas de la app que estén abiertas en segundo plano se recargan solas,
// para que al volver a la app ya esté la versión nueva (las que estás viendo no se tocan, para no interrumpirte).
self.addEventListener('activate',e=>{e.waitUntil(caches.keys().then(ks=>Promise.all(ks.filter(k=>k!==VERSION).map(k=>caches.delete(k)))).then(()=>self.clients.claim()).then(()=>self.clients.matchAll({type:'window'})).then(cs=>Promise.all(cs.map(c=>c.visibilityState==='hidden'&&c.navigate?c.navigate(c.url).catch(()=>{}):null))).catch(()=>{}))});
function offlinePage(){return new Response('<!doctype html><meta charset=utf-8><meta name=viewport content="width=device-width"><title>Memorándum</title><body style="font-family:system-ui;background:#16151E;color:#ECE9F5;display:grid;place-items:center;min-height:90vh;text-align:center"><div><h1 style="font-weight:400">Memorándum</h1><p>Sin conexión. Vuelve a intentarlo en un momento.</p><p><button onclick="location.reload()" style="font:inherit;padding:10px 18px;border-radius:999px;border:0">Reintentar</button></p></div>',{status:503,headers:{'Content-Type':'text/html; charset=utf-8'}})}
self.addEventListener('fetch',e=>{
  const req=e.request;
  // Android: recibir un archivo desde el menú «Compartir» (por ejemplo, un cajón enviado por WhatsApp).
  if(req.method==='POST'&&new URL(req.url).pathname.endsWith('/share-target')){
    e.respondWith((async()=>{
      try{const fd=await req.formData();const f=fd.get('file');
        if(f&&typeof f!=='string'){const c=await caches.open('memorandum-inbox');await c.put('inbox.json',new Response(f,{headers:{'Content-Type':'application/json'}}))}
      }catch(err){}
      return Response.redirect('./?shared=1',303);
    })());
    return;
  }
  if(req.method!=='GET')return;
  const url=new URL(req.url);
  // La página: primero la red (para recibir actualizaciones), si no hay conexión, la copia guardada.
  if(req.mode==='navigate'){
    // La página: primero la red (para recibir actualizaciones); si la red falla, no responde en 3 s
    // o está bloqueada (p. ej. bloqueos de operadoras en días de partido), se abre la copia guardada.
    const isApp=/\/(index\.html)?$/.test(url.pathname);
    const net=(async()=>{try{return await fetch(req.url,{cache:'no-cache',credentials:'same-origin'})}catch(_){try{return await fetch(req)}catch(__){return null}}})();
    // Solo la propia app se guarda como copia (nunca otras páginas como legal.html), y se termina de guardar aunque se abra la copia.
    e.waitUntil(net.then(r=>{if(isApp&&r&&r.ok&&!r.redirected&&(r.headers.get('content-type')||'').includes('text/html')){const cp=r.clone();return caches.open(VERSION).then(c=>c.put('index.html',cp))}}).catch(()=>{}));
    e.respondWith((async()=>{
      let saved=null;
      if(isApp){try{saved=(await caches.match('index.html'))||(await caches.match('./'))||(await caches.match(req,{ignoreSearch:true}))}catch(_){}
        // Una copia que vino de una redirección no se puede usar para abrir la página: se reconstruye limpia.
        if(saved&&saved.redirected){try{saved=new Response(await saved.blob(),{status:200,headers:{'Content-Type':'text/html; charset=utf-8'}})}catch(_){saved=null}}}
      if(!saved){const r=await net;return r||offlinePage()}
      const r=await Promise.race([net,new Promise(res=>setTimeout(()=>res(null),3000))]);
      return r&&r.ok&&!r.redirected?r:saved;
    })().catch(()=>offlinePage()));
    return;
  }
  // Iconos, manifiesto y tipografías: primero la copia guardada.
  if(url.origin===location.origin||url.hostname.endsWith('fonts.googleapis.com')||url.hostname.endsWith('fonts.gstatic.com')){
    e.respondWith(caches.match(req).then(hit=>hit||fetch(req).then(r=>{if(r.ok||r.type==='opaque'){const cp=r.clone();caches.open(VERSION).then(c=>c.put(req,cp))}return r})));
  }
});
