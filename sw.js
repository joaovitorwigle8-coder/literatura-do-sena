const CACHE='sena-v5';
const ASSETS=['./','./index.html','./alexandria.css?v=5','./alexandria.js?v=5','./manifest.webmanifest','./icons/sena-icon.svg','./icons/sena-icon-180.svg','./data/c1.txt','./data/c2.txt','./data/c3.txt','./data/c4.txt','./data/c5.txt'];
self.addEventListener('install',e=>{e.waitUntil(caches.open(CACHE).then(c=>c.addAll(ASSETS)));self.skipWaiting();});
self.addEventListener('activate',e=>{e.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(k=>k!==CACHE).map(k=>caches.delete(k)))));self.clients.claim();});
self.addEventListener('fetch',e=>{
 if(e.request.method!=='GET') return;
 e.respondWith(fetch(e.request).then(r=>{const clone=r.clone();caches.open(CACHE).then(c=>c.put(e.request,clone));return r;}).catch(()=>caches.match(e.request).then(r=>r||caches.match('./'))));
});