const VERSION="v1-2026-10-30";
const SHELL=["./","index.html","styles.css","app.js","firebase.js","config.js","manifest.webmanifest","icon-192.png","icon-512.png","apple-touch-icon.png"];
self.addEventListener("install",e=>{e.waitUntil(caches.open(VERSION).then(c=>c.addAll(SHELL)).then(()=>self.skipWaiting()))});
self.addEventListener("activate",e=>{e.waitUntil(caches.keys().then(ks=>Promise.all(ks.filter(k=>k!==VERSION&&k!=="fonts").map(k=>caches.delete(k)))).then(()=>self.clients.claim()))});
self.addEventListener("fetch",e=>{
 const r=e.request;if(r.method!=="GET")return;
 const u=new URL(r.url);
 if(u.origin===location.origin){
  if(r.mode==="navigate"){e.respondWith(fetch(r).then(res=>{const cp=res.clone();caches.open(VERSION).then(c=>c.put("index.html",cp));return res}).catch(()=>caches.match("index.html")));return}
  e.respondWith(caches.match(r).then(hit=>hit||fetch(r).then(res=>{if(res.ok){const cp=res.clone();caches.open(VERSION).then(c=>c.put(r,cp))}return res})));
  return;
 }
 if(u.hostname==="fonts.googleapis.com"||u.hostname==="fonts.gstatic.com"){
  e.respondWith(caches.open("fonts").then(c=>c.match(r).then(hit=>{const net=fetch(r).then(res=>{c.put(r,res.clone());return res}).catch(()=>hit);return hit||net})));
 }
});
