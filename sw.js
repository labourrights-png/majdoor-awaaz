const CACHE='mazdoor-awaaz-v6';
const APP_SHELL=['./','./platform-v2.html','./classic-ui.css','./manifest.json','./icon.svg'];

self.addEventListener('install',e=>{
  e.waitUntil(
    caches.open(CACHE)
      .then(c=>c.addAll(APP_SHELL))
      .then(()=>self.skipWaiting())
  );
});

self.addEventListener('activate',e=>{
  e.waitUntil(
    caches.keys()
      .then(keys=>Promise.all(keys.filter(k=>k!==CACHE).map(k=>caches.delete(k))))
      .then(()=>self.clients.claim())
  );
});

self.addEventListener('fetch',e=>{
  if(e.request.method!=='GET')return;
  const u=new URL(e.request.url);
  if(u.origin!==location.origin)return;

  // Always prefer the latest GitHub Pages version for the HTML/CSS shell.
  // This prevents an older service-worker cache from hiding new deployments.
  const isShell =
    e.request.mode==='navigate' ||
    u.pathname.endsWith('/platform-v2.html') ||
    u.pathname.endsWith('/classic-ui.css');

  if(isShell){
    e.respondWith(
      fetch(e.request,{cache:'no-store'})
        .then(r=>{
          if(r.ok){
            const copy=r.clone();
            caches.open(CACHE).then(c=>c.put(e.request,copy));
          }
          return r;
        })
        .catch(()=>caches.match(e.request).then(c=>c||caches.match('./platform-v2.html')))
    );
    return;
  }

  e.respondWith(
    caches.match(e.request).then(cached=>
      cached ||
      fetch(e.request).then(r=>{
        if(r.ok){
          const copy=r.clone();
          caches.open(CACHE).then(c=>c.put(e.request,copy));
        }
        return r;
      }).catch(()=>cached)
    )
  );
});