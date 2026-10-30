import * as F from "./firebase.js";
import CONFIG from "./config.js";

let D=null,CITIES=[],CN={},STAY={},BOOK=[],PAY=[],EMB=[],MSG=[],PTS=[],LEGS=[],STN=[],RATES_DEF={},PHR=[],RATES={};
function setContent(c){D=c;CITIES=c.cities;CN=Object.fromEntries(CITIES.map(x=>[x.k,x]));CN.gen={k:"gen",n:"General",f:"📋"};STAY=c.stay;BOOK=c.book;PAY=c.pay;EMB=c.emb;MSG=c.msg;PTS=c.pts;LEGS=c.legs;STN=c.stn;RATES_DEF=c.rates;PHR=c.phr;RATES={...RATES_DEF};try{Object.assign(RATES,JSON.parse(localStorage.getItem("rates")||"{}"))}catch(e){}}
const $=s=>document.querySelector(s);
const esc=s=>String(s??"").replace(/[&<>"]/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"}[c]));
const maps=q=>"https://www.google.com/maps/search/?api=1&query="+encodeURIComponent(q);
const MES=["ene","feb","mar","abr","may","jun","jul","ago","sep","oct","nov","dic"];
const fmtD=iso=>{const [y,m,d]=iso.split("-");return +d+" "+MES[+m-1]};
const todayISO=()=>{const t=new Date();return t.getFullYear()+"-"+String(t.getMonth()+1).padStart(2,"0")+"-"+String(t.getDate()).padStart(2,"0")};
const mxn=(a,c)=>a*(RATES[c]||1);
const money=n=>"$"+n.toLocaleString("es-MX",{minimumFractionDigits:2,maximumFractionDigits:2});

const S={view:"hoy",city:"par",sub:"plan",checks:{},gastos:[],tickets:{},tix:{},db:null,assets:null,me:null,email:null,canEdit:true,owner:false};
try{const s=JSON.parse(localStorage.getItem("ui")||"{}");Object.assign(S,{view:s.view||"hoy",city:s.city||"par",sub:s.sub||"plan"})}catch(e){}
const h=location.hash.slice(1);if(["hoy","ciudades","boletos","gastos","util"].includes(h))S.view=h;
function save(){try{localStorage.setItem("ui",JSON.stringify({view:S.view,city:S.city,sub:S.sub}))}catch(e){}}

function stripPay(text){const out=[];let skip=false;for(const l of String(text||"").split("\n")){if(/NÓMINA/.test(l)){skip=true;continue}if(skip&&/^\s*→/.test(l))continue;skip=false;out.push(l)}return out.join("\n")}
function planHTML(text,c){
 return '<div class="plan" style="--c:var(--'+c+')">'+stripPay(text).split("\n").filter(l=>l.trim()).map(l=>{
  const m=l.match(/^\s*(~?\d{1,2}:\d{2}(?:\s*[–-]\s*\d{1,2}:\d{2})?)\s*(.*)$/);const pay=/NÓMINA/.test(l);
  if(m)return '<div class="pl'+(pay?" pay":"")+'"><span class="t">'+m[1]+'</span><span class="x">'+esc(m[2])+'</span></div>';
  return '<div class="pl note'+(pay?" pay":"")+'"><span class="t"></span><span class="x">'+esc(l.trim())+'</span></div>';}).join("")+'</div>';
}
function dayCard(d,open){
 const [,m,dd]=d.date.split("-");const c=d.city;
 return `<details class="day" style="--c:var(--${c})" ${open?"open":""}><summary>
  <div class="date"><b>${+dd}</b><span>${d.dow} ${MES[+m-1]}</span></div>
  <div style="min-width:0"><h3>${esc(d.title)}</h3><div class="sub">${esc(CN[c].f+" "+CN[c].n)}${d.cost?" · "+esc(d.cost):""}</div>${PAY.some(x=>x.date===d.date)?'<div style="margin-top:4px"><span class="tag" style="background:var(--gold-bg);color:var(--gold);border-color:transparent">💰 Nómina HR Clean</span></div>':""}</div>
  <span class="muted">▾</span></summary>
  <div class="body">${(p=>p?payBanner(p):"")(PAY.find(x=>x.date===d.date))}${d.hours?`<div class="sub mono">${esc(d.hours)}</div>`:""}${planHTML(d.plan,c)}${d.status?`<div><span class="tag">${esc(d.status)}</span></div>`:""}</div></details>`;
}
function ticketBtns(b){
 const t=S.tix[b.id];
 return t?`<button class="btn sm primary" data-tix="${b.id}">📄 Ver boleto${t.n>1?" ("+t.n+" págs.)":""}</button><span class="sub">disponible sin internet</span>`:`<span class="sub">Boleto aún no cargado</span>`;
}
function bookCard(b){
 return `<div class="card cityband" style="--c:var(--${b.city})">
  <div class="row" style="justify-content:space-between"><h3>${esc(b.what)}</h3><span class="mono sub">${fmtD(b.date)}${b.time?" · "+b.time:""}</span></div>
  <div class="mono">${esc(b.ref)}</div>${b.det?`<div class="sub">${esc(b.det)}</div>`:""}
  <div class="row">${ticketBtns(b)}</div></div>`;
}
function stayCard(k){
 const s=STAY[k];
 return `<div class="card cityband" style="--c:var(--${k})"><div class="label">Hospedaje · ${esc(s.nights)}</div><h3>${esc(s.name)}</h3>
 <dl class="kv"><dt>Dirección</dt><dd>${esc(s.addr)}</dd><dt>Reserva</dt><dd class="mono">${esc(s.ref)}</dd><dt>Check-in</dt><dd>${esc(s.checkin)}</dd></dl>
 ${s.note?`<div class="sub">⚠︎ ${esc(s.note)}</div>`:""}
 <div class="row"><a class="btn sm" href="${maps(s.q)}" target="_blank" rel="noopener">🗺 Abrir en Maps</a></div></div>${MSG.filter(m=>m.k===k).map(msgCard).join("")}`;
}
function msgCard(m){
 return `<div class="card"><div class="label">Mensaje para ${esc(m.to)}</div><div class="small">${esc(m.why)}</div>
 <div class="small" style="background:var(--bg);border:1px solid var(--line);border-radius:10px;padding:10px;user-select:all" id="msg-${m.k}">${esc(m.txt)}</div>
 <div class="row"><button class="btn sm" data-copy="msg-${m.k}">Copiar mensaje</button><span class="sub">Envíalo desde la app de Airbnb</span></div></div>`;
}
function mapSVG(){
 const P=Object.fromEntries(PTS.map(p=>[p.k,p]));
 const lines=LEGS.map(([a,b],i)=>{const A=P[a],B=P[b];const mx=(A.x+B.x)/2,my=(A.y+B.y)/2;
  return `<line x1="${A.x}" y1="${A.y}" x2="${B.x}" y2="${B.y}" stroke="var(--muted)" stroke-width="4" stroke-dasharray="${a==="zak"?"14 10":"0"}"/><circle cx="${mx}" cy="${my}" r="22" fill="var(--surface)" stroke="var(--muted)" stroke-width="3"/><text x="${mx}" y="${my+11}" text-anchor="middle" font-size="32" font-weight="700" fill="var(--ink)">${i+1}</text>`}).join("");
 const L={par:[0,55,"middle"],bru:[28,-24,"start"],pra:[0,-32,"middle"],cra:[40,-32,"end"],zak:[-30,15,"end"],vie:[28,15,"start"]};
 const dots=PTS.map(p=>{const [dx,dy,an]=L[p.k];return `<circle cx="${p.x}" cy="${p.y}" r="18" fill="var(--${p.k})" stroke="var(--surface)" stroke-width="5"/><text x="${p.x+dx}" y="${p.y+dy}" text-anchor="${an}" font-size="46" font-weight="700" fill="var(--ink)">${esc(CN[p.k].n)}</text>`}).join("");
 return `<svg viewBox="0 30 1300 300" role="img" aria-label="Ruta del viaje: París, Brujas, Praga, Cracovia, Zakopane y Viena" style="width:100%;height:auto;font-family:'Atkinson Hyperlegible',sans-serif">${lines}${dots}</svg>
 <ol class="small" style="margin:0;padding-left:1.4em;display:grid;gap:2px">${LEGS.map(([a,b,l])=>`<li>${esc(CN[a].n)} → ${esc(CN[b].n)} · ${esc(l)}</li>`).join("")}</ol>`;
}
function payBanner(p){
 return `<div class="banner"><span class="label" style="color:inherit">Primera actividad · Sáb ${fmtD(p.date)} · ${p.city==="par"?"Mérida":CN[p.city].n} · Nómina HR Clean</span>
 <b>${p.eu==="—"?"Depositar en México "+p.mx:"Depositar a las "+p.eu+" hora local ("+p.mx+" en Mérida)"}</b>
 <span class="small">${esc(p.where)}. Límite: 10:00 Mérida = 17:00 en Europa.</span></div>`;
}
function checkRow(c,i){
 const done=S.checks["k"+i]!==undefined?S.checks["k"+i]:c.mark==="✅";
 return `<label class="card chk ${done?"done":""}"><input type="checkbox" data-ck="${i}" ${done?"checked":""} ${S.db?"":"disabled"}>
 <div style="min-width:0"><div class="w"><b>${esc(c.what)}</b></div><div class="sub">${esc(c.where)}</div>
 <div class="row" style="margin-top:4px">${c.red&&!done?'<span class="tag red">Pendiente importante</span>':""}${c.urg?`<span class="tag">${esc(c.urg)}</span>`:""}${c.due?`<span class="tag">${esc(c.due)}</span>`:""}${c.cost&&c.cost!=="—"?`<span class="tag">${esc(c.cost)}</span>`:""}</div></div></label>`;
}

function vHoy(){
 const t=todayISO();const first="2026-12-19",last="2027-01-07";let o="";
 if(t<first){
  const days=Math.ceil((new Date(first+"T12:00")-new Date(t+"T12:00"))/864e5);
  o+=`<h2>Faltan</h2><div class="card"><div class="big">${days} días</div><div class="sub">Salida sábado 19 dic · CUN 20:15 → CDG</div></div>`;
  const pend=D.check.map((c,i)=>[c,i]).filter(([c,i])=>!(S.checks["k"+i]!==undefined?S.checks["k"+i]:c.mark==="✅"));
  const red=pend.filter(([c])=>c.red);
  o+=`<h2>Pendientes antes de salir <span class="sub">(${pend.length})</span></h2><div class="stack">${(red.length?red:pend).slice(0,6).map(([c,i])=>checkRow(c,i)).join("")}</div>`;
  if(red.length)o+=`<p class="sub">Se muestran primero los marcados como importantes. Todos están en Útil → Checklist.</p>`;
  o+=`<h2>Nómina durante el viaje</h2><div class="stack">${PAY.map(payBanner).join("")}</div>`;
  o+=`<h2>Primer día</h2><div class="stack">${D.days.filter(d=>d.date===first).map(d=>dayCard(d,false)).join("")}</div>`;
 }else if(t>last){o+=`<h2>¡Bienvenidos a casa!</h2><div class="card">El viaje terminó el 7 de enero. Todo el plan sigue en Ciudades.</div>`;}
 else{
  const ds=D.days.filter(d=>d.date===t);const city=ds.length?ds[ds.length-1].city:"par";
  o+=`<h2>${ds[0]?ds[0].dow+" "+fmtD(t):fmtD(t)} · ${CN[city].f} ${CN[city].n}</h2>`;
  const bs=BOOK.filter(b=>b.date===t);if(bs.length)o+=`<div class="stack" style="margin-top:10px">${bs.map(bookCard).join("")}</div>`;
  o+=`<div class="stack" style="margin-top:10px">${ds.map(d=>dayCard(d,true)).join("")}</div>`;
  o+=`<h2>Dormimos en</h2>${stayCard(city)}`;
  const tm=D.days.find(d=>d.date>t);if(tm)o+=`<h2>Mañana</h2>${dayCard(tm,false)}`;
 }
 return o;
}
const SUBS=[["plan","Plan"],["boletos","Boletos"],["hosp","Hospedaje"],["gordos","Gordos"],["compras","Compras"],["pend","Pendientes"]];
function vCiudad(){
 const k=S.city,c=CN[k];
 let o=`<div class="cityband" style="--c:var(--${k});margin-top:16px"><h2 style="margin:0">${c.f} ${c.n}</h2><div class="sub">${c.dates} · moneda ${c.cur}</div></div>
 <div class="tabs" role="tablist" style="--c:var(--${k})">${SUBS.map(([s,n])=>`<button class="tab" role="tab" data-sub="${s}" aria-selected="${S.sub===s}">${n}</button>`).join("")}</div><div class="stack" style="margin-top:12px">`;
 if(S.sub==="plan"){o+=D.days.filter(d=>d.city===k).map(d=>dayCard(d,false)).join("");}
 if(S.sub==="boletos"){const b=BOOK.filter(b=>b.city===k);o+=b.length?b.map(bookCard).join(""):`<div class="card sub">Sin boletos comprados para esta ciudad.</div>`;}
 if(S.sub==="hosp")o+=stayCard(k);
 if(S.sub==="gordos")o+=D.gordos.filter(g=>g.city===k).map(g=>`<div class="card"><h3>${esc(g.name)}</h3><div class="small">${esc(g.desc)}</div>
  ${g.o1?`<div class="g-o"><b>${esc(g.o1)}</b><span class="mono sub">${esc(g.p1)} · ${esc(g.m1)}</span><a class="small" href="${maps(g.o1)}" target="_blank" rel="noopener">Maps ↗</a></div>`:""}
  ${g.o2?`<div class="g-o"><b>${esc(g.o2)}</b><span class="mono sub">${esc(g.p2)} · ${esc(g.m2)}</span><a class="small" href="${maps(g.o2)}" target="_blank" rel="noopener">Maps ↗</a></div>`:""}
  ${g.tip?`<div class="sub">💡 ${esc(g.tip)}</div>`:""}</div>`).join("")||`<div class="card sub">Sin registros.</div>`;
 if(S.sub==="compras")o+=D.compras.filter(x=>x.city===k).map(x=>`<div class="card"><h3>${esc(x.name)}</h3><div class="small">${esc(x.why)}</div>
  <dl class="kv"><dt>Dónde</dt><dd>${esc(x.where)}</dd><dt>Precio</dt><dd class="mono">${esc(x.price)}</dd><dt>¿Reservar?</dt><dd>${esc(x.adv)}</dd></dl>
  <a class="small" href="${maps(String(x.where).split("·")[0])}" target="_blank" rel="noopener">Maps ↗</a></div>`).join("")||`<div class="card sub">Sin registros.</div>`;
 if(S.sub==="pend"){const r=D.check.map((c,i)=>[c,i]).filter(([c])=>c.city===k);o+=r.length?r.map(([c,i])=>checkRow(c,i)).join(""):`<div class="card sub">Sin pendientes para esta ciudad.</div>`;}
 return o+"</div>";
}
function vBoletos(){
 return `<h2>Boletos y reservas</h2><p class="sub">En orden cronológico. Cualquier editor del viaje puede subir el PDF o la captura de cada boleto; se ve desde cualquier teléfono.</p><div class="stack">${BOOK.map(bookCard).join("")}</div>
 <h2>Hospedajes</h2><div class="stack">${CITIES.map(c=>stayCard(c.k)).join("")}</div>`;
}
function vGastos(){
 const tot={};let all=0;S.gastos.forEach(g=>{const v=mxn(g.amount,g.cur);tot[g.city]=(tot[g.city]||0)+v;all+=v});
 const lc=CN[curCity()].cur;
 let o=`<h2>Gastos del viaje</h2><div class="card"><div class="label">Calculadora · moneda local → pesos</div>
  <div class="grid2"><input type="number" id="gcA" placeholder="Monto" step="0.01" min="0" inputmode="decimal"><select id="gcC">${["EUR","CZK","PLN","USD"].map(c=>`<option ${c===lc?"selected":""}>${c}</option>`).join("")}</select></div>
  <div class="big" id="gcR">$0.00 MXN</div><div class="sub" id="gcN"></div>
  ${S.db?'<div><button class="btn sm" type="button" id="gcUse">Registrar este monto como gasto ↓</button></div>':""}</div>`;
 if(!S.db)o+=`<div class="alert">Los gastos compartidos se guardan en línea; esta vista no tiene conexión ahora mismo.</div>`;
 else o+=`<form class="card" id="gForm"><div class="label">Registrar gasto</div>
  <input type="text" name="desc" placeholder="Concepto (ej. cena, metro, souvenir)" required maxlength="80">
  <div class="grid2"><input type="number" name="amount" placeholder="Monto" step="0.01" min="0" required inputmode="decimal">
  <select name="cur">${Object.keys(RATES).map(c=>`<option ${c===CN[S.city].cur?"selected":""}>${c}</option>`).join("")}</select></div>
  <select name="city">${CITIES.map(c=>`<option value="${c.k}" ${c.k===curCity()?"selected":""}>${c.f} ${c.n}</option>`).join("")}</select>
  <button class="btn primary" type="submit">Guardar</button></form>`;
 o+=`<div class="card"><div class="label">Total en pesos (tipo de cambio de referencia)</div><div class="big">${money(all)}</div>
  ${CITIES.filter(c=>tot[c.k]).map(c=>`<div class="money"><span>${c.f} ${c.n}</span><span class="mono">${money(tot[c.k])}</span></div>`).join("")}</div>
  <div class="stack">${S.gastos.slice().sort((a,b)=>(b.ts||0)-(a.ts||0)).map(g=>`<div class="card"><div class="money"><b>${esc(g.desc)}</b><span class="mono">${g.amount.toLocaleString("es-MX")} ${esc(g.cur)}</span></div>
  <div class="money sub"><span>${CN[g.city]?CN[g.city].f+" "+CN[g.city].n:""} · ${esc(g.who||"")}</span><span class="mono">≈ ${money(mxn(g.amount,g.cur))}</span></div>
  ${S.canEdit?`<div><button class="btn sm" data-del="${g.id}">Borrar</button></div>`:""}</div>`).join("")}</div>`;
 return o;
}
function vUtil(){
 let o=`<h2>Mapa del viaje</h2><div class="card">${mapSVG()}
  <div class="row"><a class="btn sm primary" href="https://www.google.com/maps/dir/?api=1&origin=${encodeURIComponent(PTS[0].q)}&destination=${encodeURIComponent(PTS[5].q)}&waypoints=${PTS.slice(1,5).map(p=>encodeURIComponent(p.q)).join("%7C")}" target="_blank" rel="noopener">🗺 Ver la ruta completa en Google Maps</a></div>
  <div class="label" style="margin-top:6px">Hospedajes</div>${PTS.map(p=>`<div class="money"><span><span class="tag" style="background:var(--${p.k});color:#fff;border-color:transparent">${CN[p.k].f}</span> ${esc(p.n)}</span><a class="small" href="${maps(p.q)}" target="_blank" rel="noopener">Maps ↗</a></div>`).join("")}
  <div class="label" style="margin-top:6px">Estaciones y aeropuertos</div>${STN.map(([n,q])=>`<div class="money"><span>${esc(n)}</span><a class="small" href="${maps(q)}" target="_blank" rel="noopener">Maps ↗</a></div>`).join("")}
  <p class="sub">El mapa es esquemático (posiciones aproximadas). La ruta de Google Maps es solo de referencia; los traslados reales son en tren, autobús y avión.</p></div>
 <h2>Nómina HR Clean</h2><p class="sub">Se deposita los sábados antes de las 10:00 de Mérida. México (Zona Centro, UTC−6) va 7 horas detrás de Europa central en invierno, así que el límite es 17:00 hora local en todo el viaje. Plan: depositar temprano, antes de salir.</p><div class="stack">${PAY.map(p=>`<div class="card cityband" style="--c:var(--${p.city})"><div class="row" style="justify-content:space-between"><h3>Sáb ${fmtD(p.date)} · ${CN[p.city].n}</h3><span class="mono">${p.eu==="—"?"México "+p.mx:p.eu+" local · "+p.mx+" Mérida"}</span></div><div class="sub">${esc(p.where)}</div></div>`).join("")}</div>`;
 o+=`<h2>Convertidor</h2><div class="card"><div class="grid2"><input type="number" id="cvA" value="10" step="0.01" inputmode="decimal"><select id="cvC">${["EUR","CZK","PLN","USD"].map(c=>`<option>${c}</option>`).join("")}</select></div><div class="big" id="cvR"></div>
 <details><summary class="sub">Tipos de cambio de referencia (editables en este teléfono)</summary><div class="grid2" style="margin-top:8px">${["EUR","CZK","PLN","USD"].map(c=>`<label class="small">${c} → MXN<input type="number" step="0.01" data-rate="${c}" value="${RATES[c]}"></label>`).join("")}</div>
 <p class="sub">Valores iniciales tomados del Excel del viaje; actualízalos con el tipo de cambio del día.</p></details></div>`;
 o+=`<h2>Emergencias</h2><div class="card"><div class="big mono">112</div><div class="sub">Número único de emergencias en la Unión Europea (Francia, Bélgica, Chequia, Polonia y Austria).</div></div>`;
 o+=`<h2>Embajadas de México</h2><p class="sub">El número de emergencias es para casos graves: hospitalización, detención, robo de pasaporte o fallecimiento. Datos de la SRE, consultados el 28 oct 2026.</p><div class="stack">${EMB.map(e=>`<div class="card cityband" style="--c:var(--${e.k})"><h3>${esc(e.pais)}</h3>
  <dl class="kv"><dt>Emergencias</dt><dd class="mono"><b id="emg-${e.k}">${esc(e.emg)}</b><br><span class="sub">desde un celular local: ${esc(e.emgL)}</span></dd><dt>Atención</dt><dd class="mono">${esc(e.tel)}</dd><dt>Dirección</dt><dd>${esc(e.addr)}</dd></dl>
  <div class="row"><button class="btn sm" data-copy="emg-${e.k}">Copiar número</button><a class="btn sm" href="${maps(e.addr)}" target="_blank" rel="noopener">🗺 Maps</a><a class="small" href="${e.src}" target="_blank" rel="noopener">Fuente SRE ↗</a></div></div>`).join("")}</div>`;
 o+=`<h2>Mensajes para anfitriones</h2><p class="sub">Redactados en inglés y listos para copiar. Tú decides si los envías.</p><div class="stack">${MSG.map(msgCard).join("")}</div>`;
 o+=`<h2>Regreso y escalas</h2><div class="stack">${D.escalas.map(([a,b])=>`<div class="card"><div class="label">${esc(a)}</div><div>${esc(b)}</div></div>`).join("")}</div>`;
 o+=`<h2>Frases básicas</h2><div class="stack">${PHR.map(([a,b])=>`<div class="card"><b>${a}</b><div>${esc(b)}</div></div>`).join("")}</div>`;
 o+=adminHTML();o+=`<h2>Checklist completo</h2><div class="stack">${D.check.map((c,i)=>checkRow(c,i)).join("")}</div>`;
 return o;
}
function curCity(){const t=todayISO();const ds=D.days.filter(d=>d.date<=t);return ds.length&&t<="2027-01-07"?ds[ds.length-1].city:S.city}

function render(){
 if(!D)return;
 document.querySelectorAll("nav.bottom button").forEach(b=>b.setAttribute("aria-current",b.dataset.v===S.view?"page":"false"));
 const pills=$("#cityPills");pills.hidden=S.view!=="ciudades";
 pills.innerHTML=CITIES.map(c=>`<button class="pill" data-city="${c.k}" aria-pressed="${S.city===c.k}"><span class="dot" style="background:var(--${c.k})"></span>${c.n}</button>`).join("");
 const keep=[...document.querySelectorAll("details.day")].map(d=>d.open);
 $("#app").innerHTML={hoy:vHoy,ciudades:vCiudad,boletos:vBoletos,gastos:vGastos,util:vUtil}[S.view]();
 if(S.view==="util"||S.view==="gastos")conv();
}
function conv(){for(const p of ["cv","gc"]){const A=$("#"+p+"A");if(!A)continue;const a=+A.value||0,c=$("#"+p+"C").value;$("#"+p+"R").textContent=money(mxn(a,c))+" MXN";const n=$("#"+p+"N");if(n)n.textContent="1 "+c+" = "+money(RATES[c])+" MXN (referencia; edítalo en Útil → Convertidor)"}}

document.addEventListener("click",e=>{
 const n=e.target.closest("[data-v]");if(n){S.view=n.dataset.v;history.replaceState(null,"","#"+S.view);save();render();scrollTo(0,0);return}
 const c=e.target.closest("[data-city]");if(c){S.city=c.dataset.city;save();render();return}
 const s=e.target.closest("[data-sub]");if(s){S.sub=s.dataset.sub;save();render();return}
 const cp=e.target.closest("[data-copy]");if(cp){const el=document.getElementById(cp.dataset.copy);const txt=el?el.textContent:"";
  const sel=()=>{const rg=document.createRange();rg.selectNodeContents(el);const s=getSelection();s.removeAllRanges();s.addRange(rg)};
  try{navigator.clipboard.writeText(txt).then(()=>flash("Copiado"),()=>{sel();flash("Texto seleccionado: cópialo")})}catch(x){sel();flash("Texto seleccionado: cópialo")}return}
 if(e.target.id==="gcUse"){const f=$("#gForm");if(f){f.amount.value=$("#gcA").value;f.cur.value=$("#gcC").value;f.desc.focus()}return}
 const d=e.target.closest("[data-del]");if(d&&S.db){S.db.collection("gastos").doc(d.dataset.del).delete().catch(err=>flash("No se pudo borrar"));}
});
document.addEventListener("input",e=>{
 if(/^(cv|gc)[AC]$/.test(e.target.id))conv();
 if(e.target.dataset.rate){RATES[e.target.dataset.rate]=+e.target.value||RATES_DEF[e.target.dataset.rate];try{localStorage.setItem("rates",JSON.stringify(RATES))}catch(x){};conv()}
});
document.addEventListener("change",async e=>{
 const ck=e.target.dataset.ck;
 if(ck!==undefined&&S.db){S.db.collection("checks").doc("k"+ck).set({done:e.target.checked,by:S.me||"",ts:Date.now()}).catch(()=>flash("No se pudo guardar"));}
 const up=e.target.dataset.up;
 if(up&&S.assets&&e.target.files[0]){
  const f=e.target.files[0];flash("Subiendo…");
  try{const r=await S.assets.upload(f,f.type?undefined:{type:"application/pdf"});
   await S.db.collection("tickets").doc(up).set({assetId:r.id,name:f.name,by:S.me||"",ts:Date.now()});flash("Boleto guardado");}
  catch(err){flash(err&&err.code==="too_large"?"Archivo mayor a 20 MB":"No se pudo subir el archivo")}
 }
});
document.addEventListener("submit",e=>{
 if(e.target.id!=="gForm")return;e.preventDefault();const f=new FormData(e.target);
 const amount=parseFloat(f.get("amount"));if(!(amount>0))return;
 S.db.collection("gastos").add({desc:String(f.get("desc")).slice(0,80),amount,cur:f.get("cur"),city:f.get("city"),who:S.me||"",ts:Date.now()}).catch(()=>flash("No se pudo guardar"));
});
function flash(t){$("#sync").textContent=t;clearTimeout(flash.t);flash.t=setTimeout(()=>$("#sync").textContent=netLabel(),3000)}
addEventListener("hashchange",()=>{const h=location.hash.slice(1);if(["hoy","ciudades","boletos","gastos","util"].includes(h)){S.view=h;render()}});

// ================= PWA: almacenamiento local, Firebase y arranque =================
const TRIP=CONFIG.tripId;
const IDB={
 _db:null,
 open(){if(this._db)return Promise.resolve(this._db);return new Promise((res,rej)=>{const r=indexedDB.open("viaje-rodea",1);r.onupgradeneeded=()=>r.result.createObjectStore("kv");r.onsuccess=()=>{this._db=r.result;res(r.result)};r.onerror=()=>rej(r.error)})},
 async get(k){const db=await this.open();return new Promise((res,rej)=>{const t=db.transaction("kv").objectStore("kv").get(k);t.onsuccess=()=>res(t.result);t.onerror=()=>rej(t.error)})},
 async set(k,v){const db=await this.open();return new Promise((res,rej)=>{const t=db.transaction("kv","readwrite");t.objectStore("kv").put(v,k);t.oncomplete=()=>res();t.onerror=()=>rej(t.error)})},
 async clear(){const db=await this.open();return new Promise((res,rej)=>{const t=db.transaction("kv","readwrite");t.objectStore("kv").clear();t.oncomplete=()=>res();t.onerror=()=>rej(t.error)})}
};
function netLabel(){return navigator.onLine?"en línea":"sin internet · datos guardados"}
addEventListener("online",()=>{$("#sync").textContent=netLabel();if(S.email)refresh()});
addEventListener("offline",()=>{$("#sync").textContent=netLabel()});

let app,auth,db;
try{
 app=F.initializeApp(CONFIG.firebase);
 auth=F.getAuth(app);
 try{db=F.initializeFirestore(app,{localCache:F.persistentLocalCache({tabManager:F.persistentMultipleTabManager()})})}
 catch(e){db=F.initializeFirestore(app,{})}
}catch(e){console.error(e)}

const tref=(...p)=>F.doc(db,"trips",TRIP,...p);
const tcol=(...p)=>F.collection(db,"trips",TRIP,...p);
// Adaptador con la misma forma que usaba la versión anterior (collection().doc().set / add / delete)
const dbAdapter={collection:(name)=>({
 doc:(id)=>({set:(data)=>F.setDoc(tref(name,id),data),delete:()=>F.deleteDoc(tref(name,id))}),
 add:(data)=>F.addDoc(tcol(name),data)
})};

function shell(html){$("#app").innerHTML=html;$("#cityPills").hidden=true}
function isIOS(){return /iphone|ipad|ipod/i.test(navigator.userAgent)}
function isStandalone(){return matchMedia("(display-mode: standalone)").matches||navigator.standalone===true}
let deferredInstall=null;
addEventListener("beforeinstallprompt",e=>{e.preventDefault();deferredInstall=e;const b=$("#installBtn");if(b)b.hidden=false});

function installHelp(){
 if(isStandalone())return "";
 return `<div class="card"><div class="label">Instálala en tu teléfono</div>
 ${isIOS()?`<div class="small">En Safari toca <b>Compartir</b> (cuadro con flecha) → <b>Agregar a inicio</b>. Ábrela desde el ícono y entra ahí: el iPhone guarda los datos solo dentro de la app instalada.</div>`
 :`<div class="small">En Chrome toca el menú <b>⋮</b> → <b>Instalar app</b> (o "Agregar a pantalla principal").</div>`}
 <button class="btn primary" id="installBtn" ${deferredInstall?"":"hidden"}>Instalar ahora</button></div>`;
}
function loginView(msg){
 setLocked(false);{const n=document.querySelector("nav.bottom");if(n)n.hidden=true}
 shell(`<div class="login"><div class="card">
  <h1 style="font-size:1.6rem">Viaje Rodea · Europa</h1>
  <div class="sub">19 dic 2026 – 7 ene 2027 · París, Brujas, Praga, Cracovia, Zakopane y Viena</div>
  ${msg?`<div class="alert">${esc(msg)}</div>`:""}
  <button class="btn primary" id="gLogin">Entrar con Google</button>
  <details><summary class="sub">Entrar con correo y contraseña</summary>
   <form id="pwForm" class="stack" style="margin-top:8px"><input type="text" name="email" placeholder="Correo" autocomplete="username" inputmode="email"><input type="password" name="pw" placeholder="Contraseña" autocomplete="current-password" style="font:inherit;color:var(--ink);background:var(--bg);border:1px solid var(--line);border-radius:10px;padding:8px 10px"><button class="btn" type="submit">Entrar</button></form>
  </details>
  <div class="sub">Solo pueden entrar los correos autorizados de la familia.</div>
 </div>${installHelp()}</div>`);
}

async function loadCached(){
 try{
  const c=await IDB.get("content");if(!c)return false;
  setContent(c);S.tix=(await IDB.get("tixIndex"))||{};
  return true;
 }catch(e){return false}
}
async function refresh(){
 if(!navigator.onLine||!db)return;
 try{
  const snap=await F.getDoc(tref("content","main"));
  if(snap.exists()){const c=snap.data().data?JSON.parse(snap.data().data):snap.data();await IDB.set("content",c);setContent(c)}
  const ts=await F.getDocs(tcol("tickets"));
  const idx=(await IDB.get("tixIndex"))||{};
  for(const d of ts.docs){
   const m=d.data();
   if(idx[d.id]&&idx[d.id].ver===m.ver)continue;
   const pages=[];
   for(let i=0;i<m.n;i++){const p=await F.getDoc(tref("tickets",d.id,"pages",String(i)));if(p.exists())pages.push(p.data().img)}
   if(pages.length===m.n){await IDB.set("tix:"+d.id,pages);idx[d.id]={n:m.n,ver:m.ver,name:m.name}}
  }
  for(const k of Object.keys(idx))if(!ts.docs.some(d=>d.id===k))delete idx[k];
  await IDB.set("tixIndex",idx);S.tix=idx;
  await IDB.set("lastSync",Date.now());S.synced=true;
  if(D)render();else if(!S.locked)emptyView();
 }catch(e){
  console.error(e);
  if(e&&e.code==="permission-denied"){await IDB.clear();loginView("Este correo no está autorizado para ver el viaje.");try{await F.signOut(auth)}catch(x){}}
  else flash("No se pudo actualizar; uso lo guardado");
 }
}
let unsub=[];
function listen(){
 unsub.forEach(u=>u());unsub=[];
 const rr=()=>{const a=document.activeElement;if(a&&/^(INPUT|SELECT|TEXTAREA)$/.test(a.tagName)&&!["checkbox","file"].includes(a.type))return;render()};
 unsub.push(F.onSnapshot(tcol("checks"),s=>{S.checks={};s.docs.forEach(d=>S.checks[d.id]=!!d.data().done);rr()},()=>{}));
 unsub.push(F.onSnapshot(tcol("gastos"),s=>{S.gastos=s.docs.map(d=>({id:d.id,...d.data()})).filter(g=>typeof g.amount==="number");rr()},()=>{}));
}
async function start(user){
 S.me=user.displayName||user.email;S.email=(user.email||"").toLowerCase();S.owner=S.email===String(CONFIG.owner||"").toLowerCase();
 S.db=dbAdapter;
 await loadCached();
 if(!localStorage.getItem(PINKEY))pinView("set");
 else if(!unlocked)pinView("unlock");
 else afterUnlock();
 listen();
 await refresh();
 if(!D&&!S.locked)emptyView();
}

// --------- PIN de 4 dígitos (por teléfono) ---------
const PINKEY="pinHash";let unlocked=false,hiddenAt=0,pinFirst=null;
async function hashPin(p){let salt=localStorage.getItem("pinSalt");if(!salt){salt=Array.from(crypto.getRandomValues(new Uint8Array(16))).join(".");localStorage.setItem("pinSalt",salt)}
 const b=await crypto.subtle.digest("SHA-256",new TextEncoder().encode(salt+":"+p));return Array.from(new Uint8Array(b)).map(x=>x.toString(16).padStart(2,"0")).join("")}
function setLocked(v){S.locked=v;const n=document.querySelector("nav.bottom");if(n)n.hidden=v;document.querySelectorAll(".viewer").forEach(x=>x.remove())}
function pinView(mode,msg){
 setLocked(true);
 const title=mode==="set"?(pinFirst?"Confirma tu PIN":"Crea un PIN de 4 dígitos"):mode==="wipe"?"¿Borrar el viaje de este teléfono?":"Escribe tu PIN";
 shell(`<div class="login"><div class="card"><h3>${title}</h3>
 ${mode==="set"&&!pinFirst?`<div class="sub">Se pedirá al abrir la app en este teléfono. Es distinto para cada teléfono.</div>`:""}
 ${msg?`<div class="alert">${esc(msg)}</div>`:""}
 ${mode==="wipe"?`<div class="sub">Se borrarán el plan y los boletos guardados en este teléfono y se cerrará la sesión. Después puedes volver a entrar con tu cuenta de Google y crear un PIN nuevo.</div><div class="row"><button class="btn primary" id="pinWipe">Sí, borrar y salir</button><button class="btn" id="pinBack">Cancelar</button></div>`
 :`<form id="pinForm" class="stack" data-mode="${mode}"><input type="password" name="pin" inputmode="numeric" pattern="[0-9]{4}" maxlength="4" autocomplete="off" placeholder="••••" style="font:inherit;font-size:1.6rem;letter-spacing:.5em;text-align:center;color:var(--ink);background:var(--bg);border:1px solid var(--line);border-radius:10px;padding:10px" autofocus><button class="btn primary" type="submit">${mode==="set"?"Guardar":"Entrar"}</button></form>
 ${mode==="unlock"?`<button class="btn sm" id="pinForgot">Olvidé mi PIN</button>`:""}`}
 </div></div>`);
 setTimeout(()=>{const i=document.querySelector("#pinForm input");if(i)i.focus()},50);
}
function emptyView(){
 if(S.owner)shell(`<div class="login"><div class="stack" style="width:100%;max-width:520px"><div class="card"><h3>Todavía no hay viaje cargado</h3><div class="sub">Como administrador, importa el paquete del viaje (.json).</div></div>${adminHTML()}</div></div>`);
 else shell(`<div class="login"><div class="card"><h3>Todavía no hay viaje cargado</h3><div class="sub">Cuando Gerardo lo cargue, aparecerá aquí. ${navigator.onLine?"":"Necesitas internet la primera vez."}</div><button class="btn sm" id="resync">Revisar de nuevo</button></div></div>`);
}
function afterUnlock(){unlocked=true;setLocked(false);if(D)render();else if(S.synced)emptyView();else shell(`<div class="login"><div class="card"><h3>Descargando tu viaje…</h3><div class="sub">La primera vez necesita internet. Después funciona sin señal.</div></div></div>`)}
document.addEventListener("submit",async e=>{
 if(e.target.id!=="pinForm")return;e.preventDefault();
 const pin=String(new FormData(e.target).get("pin")||"");const mode=e.target.dataset.mode;
 if(!/^\d{4}$/.test(pin)){pinView(mode,"El PIN debe tener 4 números.");return}
 if(mode==="set"){
  if(!pinFirst){pinFirst=pin;pinView("set");return}
  if(pin!==pinFirst){pinFirst=null;pinView("set","No coincidieron. Intenta de nuevo.");return}
  localStorage.setItem(PINKEY,await hashPin(pin));pinFirst=null;afterUnlock();return}
 const tries=+(sessionStorage.getItem("pinTries")||0);
 if(await hashPin(pin)===localStorage.getItem(PINKEY)){sessionStorage.removeItem("pinTries");afterUnlock()}
 else{sessionStorage.setItem("pinTries",tries+1);if(tries+1>=5)pinView("wipe","5 intentos fallidos.");else pinView("unlock","PIN incorrecto.")}
});
document.addEventListener("visibilitychange",()=>{
 if(document.hidden){hiddenAt=Date.now();return}
 if(S.email&&localStorage.getItem(PINKEY)&&!S.locked&&Date.now()-hiddenAt>5*60*1000){unlocked=false;pinView("unlock")}
});
{const _render=render;render=function(){if(S.locked)return;return _render()};}

// --------- Visor de boletos (imágenes guardadas en el teléfono) ---------
async function openTicket(id){
 const pages=await IDB.get("tix:"+id);const b=BOOK.find(x=>x.id===id);
 if(!pages){flash("Boleto no disponible en este teléfono");return}
 const v=document.createElement("div");v.className="viewer";v.setAttribute("role","dialog");
 v.innerHTML=`<div class="bar"><span>${esc(b?b.what:"Boleto")} · sube el brillo para escanear</span><button class="btn sm" id="vClose">Cerrar</button></div>`+pages.map((p,i)=>`<img src="${p}" alt="Página ${i+1} del boleto">`).join("");
 document.body.appendChild(v);
 try{if("wakeLock" in navigator)v._wl=await navigator.wakeLock.request("screen")}catch(e){}
}
document.addEventListener("click",async e=>{
 const t=e.target.closest("[data-tix]");if(t){openTicket(t.dataset.tix);return}
 if(e.target.id==="vClose"){const v=e.target.closest(".viewer");try{v._wl&&v._wl.release()}catch(x){};v.remove();return}
 if(e.target.id==="gLogin"){
  try{await F.signInWithPopup(auth,new F.GoogleAuthProvider())}
  catch(err){loginView(err&&err.code==="auth/popup-blocked"?"El navegador bloqueó la ventana de Google; permítela e intenta de nuevo.":"No se pudo entrar con Google ("+(err&&err.code||"error")+").")}
  return}
 if(e.target.id==="installBtn"&&deferredInstall){deferredInstall.prompt();deferredInstall=null;e.target.hidden=true;return}
 if(e.target.id==="pinForgot"){pinView("wipe");return}
 if(e.target.id==="pinBack"){pinView("unlock");return}
 if(e.target.id==="logout"||e.target.id==="pinWipe"){await IDB.clear();try{["ui","pinHash","pinSalt","rates"].forEach(k=>localStorage.removeItem(k));sessionStorage.clear()}catch(x){};try{await F.signOut(auth)}catch(x){};location.reload();return}
 if(e.target.id==="resync"){flash("Actualizando…");await refresh();flash(navigator.onLine?"Actualizado":"Sin internet");return}
});
document.addEventListener("submit",async e=>{
 if(e.target.id!=="pwForm")return;e.preventDefault();const f=new FormData(e.target);
 try{await F.signInWithEmailAndPassword(auth,String(f.get("email")).trim(),String(f.get("pw")))}catch(err){loginView("Correo o contraseña incorrectos.")}
});

// --------- Administración (solo el dueño): importar el paquete del viaje ---------
function adminHTML(){
 const ls=S.lastSync?new Date(S.lastSync).toLocaleString("es-MX"):"—";
 let o=`<h2>Cuenta</h2><div class="card"><div class="small">Sesión: <b>${esc(S.me||"")}</b></div>
 <div class="row"><button class="btn sm" id="resync">Actualizar datos</button><button class="btn sm" id="logout">Cerrar sesión</button></div>
 <div class="sub">Al cerrar sesión se borran del teléfono el plan, los boletos guardados y el PIN.</div></div>`;
 if(S.owner)o+=`<h2>Administración</h2><div class="card"><div class="label">Importar paquete del viaje (.json)</div>
 <input type="file" id="pkg" accept="application/json,.json"><div class="progress"><i id="pkgBar"></i></div><div class="sub" id="pkgMsg">Reemplaza el plan y los boletos. No toca gastos ni pendientes palomeados.</div></div>`;
 return o;
}
document.addEventListener("change",async e=>{
 if(e.target.id!=="pkg"||!e.target.files[0])return;
 const msg=$("#pkgMsg"),bar=$("#pkgBar");
 try{
  const pkg=JSON.parse(await e.target.files[0].text());
  const tickets=Object.entries(pkg.tickets||{});const total=1+tickets.reduce((a,[,t])=>a+1+t.pages.length,0);let done=0;
  const step=()=>{done++;bar.style.width=Math.round(done/total*100)+"%";msg.textContent=`Subiendo ${done}/${total}…`};
  await F.setDoc(tref("content","main"),{data:JSON.stringify(pkg.content),ver:pkg.version||Date.now()});step();
  for(const [id,t] of tickets){
   for(let i=0;i<t.pages.length;i++){await F.setDoc(tref("tickets",id,"pages",String(i)),{img:t.pages[i]});step()}
   await F.setDoc(tref("tickets",id),{name:t.name,n:t.pages.length,ver:pkg.version||Date.now()});step();
  }
  msg.textContent="Listo. Descargando la versión nueva…";await refresh();msg.textContent="Paquete importado ✔";
 }catch(err){console.error(err);msg.textContent="Error al importar: "+(err&&err.message||err)}
});

// --------- Arranque ---------
(async()=>{
 $("#sync").textContent=netLabel();
 try{S.lastSync=await IDB.get("lastSync")}catch(e){}
 if(!auth){loginView("Falta configurar Firebase.");return}
 F.onAuthStateChanged(auth,u=>{if(u)start(u);else{S.email=null;loginView()}});
 if("serviceWorker" in navigator){
  navigator.serviceWorker.register("./sw.js").catch(()=>{});
  let reloaded=false;navigator.serviceWorker.addEventListener("controllerchange",()=>{if(!reloaded){reloaded=true;location.reload()}});
 }
})();
