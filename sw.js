// Memorándum: funcionamiento sin conexión.
// Cambia VERSION cada vez que subas un index.html nuevo para que los teléfonos se actualicen.
const VERSION='memorandum-v29';
const CORE=['./','index.html','manifest.webmanifest','manifest-ca.webmanifest','manifest-en.webmanifest','icons/icon-192.png','icons/icon-512.png','icons/apple-touch-icon.png','icons/favicon-32.png'];
self.addEventListener('install',e=>{e.waitUntil(caches.open(VERSION).then(c=>c.addAll(CORE)).then(()=>self.skipWaiting()))});
self.addEventListener('activate',e=>{e.waitUntil(caches.keys().then(ks=>Promise.all(ks.filter(k=>k!==VERSION).map(k=>caches.delete(k)))).then(()=>self.clients.claim()))});
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
    // Si el servidor responde con un error (por ejemplo un 404 durante un cambio de dominio), se abre la copia guardada.
    e.respondWith(fetch(req).then(r=>{if(!r.ok)return caches.match('index.html').then(h=>h||r);const cp=r.clone();caches.open(VERSION).then(c=>c.put('index.html',cp));return r}).catch(()=>caches.match('index.html')));
    return;
  }
  // Iconos, manifiesto y tipografías: primero la copia guardada.
  if(url.origin===location.origin||url.hostname.endsWith('fonts.googleapis.com')||url.hostname.endsWith('fonts.gstatic.com')){
    e.respondWith(caches.match(req).then(hit=>hit||fetch(req).then(r=>{if(r.ok||r.type==='opaque'){const cp=r.clone();caches.open(VERSION).then(c=>c.put(req,cp))}return r})));
  }
});
