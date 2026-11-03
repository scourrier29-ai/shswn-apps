/* Creator Hub — fully client-side. No backend. Keys in localStorage only. */
'use strict';
const $ = id => document.getElementById(id);
const store = {
  get(k, d){ try{ const v = localStorage.getItem('ch_'+k); return v===null?d:JSON.parse(v); }catch(e){ return d; } },
  set(k, v){ try{ localStorage.setItem('ch_'+k, JSON.stringify(v)); }catch(e){} },
  del(k){ try{ localStorage.removeItem('ch_'+k); }catch(e){} }
};

/* ---------- tabs ---------- */
function goTab(name){
  document.querySelectorAll('.ttab').forEach(b=>b.classList.toggle('active', b.dataset.tab===name));
  document.querySelectorAll('.tab-panel').forEach(p=>p.classList.toggle('active', p.id==='panel-'+name));
  window.scrollTo({top:0, behavior:'smooth'});
}
document.querySelectorAll('.ttab').forEach(b=>b.addEventListener('click',()=>goTab(b.dataset.tab)));
document.querySelectorAll('.oct').forEach(b=>b.addEventListener('click',()=>goTab(b.dataset.tab)));

/* ---------- Ottawa time ---------- */
const TORONTO = 'America/Toronto';
function tickOttawa(){
  try{
    const t = new Date().toLocaleTimeString('en-US',{timeZone:TORONTO,hour12:true,hour:'numeric',minute:'2-digit',second:'2-digit'});
    $('ottawaTime').textContent = t;
  }catch(e){ $('ottawaTime').textContent = new Date().toLocaleTimeString(); }
}
setInterval(tickOttawa, 1000); tickOttawa();

/* ---------- analog clock (red glow, live) ---------- */
function drawClock(){
  const c = $('analogClock'); if(!c) return;
  const x = c.getContext('2d'), W = c.width, R = W/2;
  x.clearRect(0,0,W,W);
  const now = new Date();
  // red glowing ring
  x.save();
  x.shadowColor = 'rgba(255,46,46,.9)'; x.shadowBlur = 26;
  x.strokeStyle = '#ff2e2e'; x.lineWidth = 10;
  x.beginPath(); x.arc(R,R,R-12,0,Math.PI*2); x.stroke();
  x.restore();
  // face
  const g = x.createRadialGradient(R,R,10,R,R,R-16);
  g.addColorStop(0,'#3a2415'); g.addColorStop(1,'#1c1208');
  x.fillStyle = g; x.beginPath(); x.arc(R,R,R-16,0,Math.PI*2); x.fill();
  // ticks + numbers
  x.fillStyle = '#f5ead2'; x.textAlign='center'; x.textBaseline='middle';
  for(let i=0;i<12;i++){
    const a = i*Math.PI/6, big = i%3===0;
    const r1 = R-26, r2 = big? R-44 : R-36;
    x.strokeStyle = big? '#f5b301' : '#f5ead2'; x.lineWidth = big?5:3;
    x.beginPath();
    x.moveTo(R+Math.sin(a)*r1, R-Math.cos(a)*r1);
    x.lineTo(R+Math.sin(a)*r2, R-Math.cos(a)*r2);
    x.stroke();
    const n = i===0?12:i;
    x.font = 'bold 26px -apple-system,sans-serif';
    x.fillText(n, R+Math.sin(a)*(R-62), R-Math.cos(a)*(R-62));
  }
  const h = now.getHours()%12 + now.getMinutes()/60;
  const m = now.getMinutes() + now.getSeconds()/60;
  const s = now.getSeconds() + now.getMilliseconds()/1000;
  const hand = (ang,len,w,col)=>{
    x.strokeStyle=col; x.lineWidth=w; x.lineCap='round';
    x.beginPath(); x.moveTo(R,R);
    x.lineTo(R+Math.sin(ang)*len, R-Math.cos(ang)*len); x.stroke();
  };
  hand(h*Math.PI/6, R-84, 11, '#f5ead2');
  hand(m*Math.PI/30, R-60, 8, '#f5ead2');
  hand(s*Math.PI/30, R-52, 3.5, '#ff2e2e');
  x.fillStyle='#ff2e2e'; x.beginPath(); x.arc(R,R,9,0,Math.PI*2); x.fill();
}
setInterval(drawClock, 250); drawClock();

/* ---------- weather (open-meteo, keyless) ---------- */
const WMO = {0:'Clear sky',1:'Mainly clear',2:'Partly cloudy',3:'Overcast',45:'Fog',48:'Icy fog',
  51:'Light drizzle',53:'Drizzle',55:'Dense drizzle',56:'Freezing drizzle',57:'Freezing drizzle',
  61:'Light rain',63:'Rain',65:'Heavy rain',66:'Freezing rain',67:'Freezing rain',
  71:'Light snow',73:'Snow',75:'Heavy snow',77:'Snow grains',
  80:'Light showers',81:'Showers',82:'Violent showers',85:'Snow showers',86:'Snow showers',
  95:'Thunderstorm',96:'Storm + hail',99:'Storm + hail'};
async function loadWeather(){
  try{
    const r = await fetch('https://api.open-meteo.com/v1/forecast?latitude=45.42&longitude=-75.7&current=temperature_2m,weathercode&daily=temperature_2m_max,temperature_2m_min&timezone=America%2FToronto&forecast_days=1');
    const j = await r.json();
    const t = Math.round(j.current.temperature_2m);
    const d = WMO[j.current.weathercode] || '—';
    const hi = Math.round(j.daily.temperature_2m_max[0]), lo = Math.round(j.daily.temperature_2m_min[0]);
    $('wxTemp').innerHTML = t + '&deg;C';
    $('wxDesc').textContent = d + ' · H ' + hi + '° / L ' + lo + '° · Ottawa';
  }catch(e){ $('wxDesc').textContent = 'Weather unavailable · Ottawa'; }
}

/* ---------- 20s live refresh ---------- */
let lastRefresh = Date.now();
async function refreshAll(){
  lastRefresh = Date.now();
  await Promise.allSettled([loadWeather(), loadNews(false)]);
  $('updAgo').textContent = 'just now';
}
setInterval(()=>{ const s = Math.round((Date.now()-lastRefresh)/1000);
  $('updAgo').textContent = s<5 ? 'just now' : s + 's ago'; }, 1000);
setInterval(refreshAll, 20000);
$('refreshNow').addEventListener('click', refreshAll);

/* ---------- home radio (3 Ottawa stations, direct streams) ---------- */
const homeAudio = $('homeAudio');
let homeCurrent = null;
document.querySelectorAll('.station-pill').forEach(btn=>{
  btn.addEventListener('click', ()=>{
    const url = btn.dataset.stream, name = btn.dataset.name;
    if(homeCurrent === btn){ stopHome(); return; }
    stopHome();
    homeAudio.src = url; homeAudio.play().catch(()=>{});
    btn.classList.add('playing');
    btn.querySelector('.play-ico').innerHTML = '&#10074;&#10074;';
    homeCurrent = btn;
    $('homeNowPlaying').hidden = false; $('homeNpName').textContent = name;
  });
});
function stopHome(){
  homeAudio.pause(); homeAudio.removeAttribute('src'); homeAudio.load();
  document.querySelectorAll('.station-pill').forEach(b=>{
    b.classList.remove('playing'); b.querySelector('.play-ico').innerHTML='&#9654;';
  });
  homeCurrent = null; $('homeNowPlaying').hidden = true;
}
$('homeStop').addEventListener('click', stopHome);

/* ---------- streaming / spotify ---------- */
$('spotifyGo').addEventListener('click', ()=>{
  const q = $('spotifySearch').value.trim();
  $('spotifyFrame').src = q
    ? 'https://open.spotify.com/embed/search/' + encodeURIComponent(q)
    : 'https://open.spotify.com/embed/playlist/37i9dQZEVXbMDoHDwVN2tF';
});
$('spotifySearch').addEventListener('keydown', e=>{ if(e.key==='Enter') $('spotifyGo').click(); });

/* ---------- news (newsdata.io, key in Settings) + audio briefing ---------- */
let newsCat = '', newsItems = [];
document.querySelectorAll('#newsCats .cat').forEach(b=>b.addEventListener('click', ()=>{
  document.querySelectorAll('#newsCats .cat').forEach(x=>x.classList.remove('active'));
  b.classList.add('active'); newsCat = b.dataset.q; loadNews(true);
}));
async function loadNews(showLoading){
  const key = store.get('newskey','');
  const list = $('newsList');
  if(!key){
    list.innerHTML = '<p class="empty">Add your free NewsData.io key in Settings to load headlines. The audio briefing works without a key once headlines are loaded.</p>';
    return;
  }
  if(showLoading) list.innerHTML = '<p class="empty">Loading headlines&hellip;</p>';
  try{
    let url = 'https://newsdata.io/api/1/news?apikey=' + encodeURIComponent(key) + '&language=en&size=10';
    if(newsCat) url += '&q=' + encodeURIComponent(newsCat);
    const r = await fetch(url); const j = await r.json();
    if(j.status !== 'success' || !j.results || !j.results.length) throw new Error('empty');
    newsItems = j.results.slice(0,10);
    list.innerHTML = newsItems.map(n=>
      '<div class="news-item"><a href="'+n.link+'" target="_blank" rel="noopener">'+escapeHtml(n.title)+'</a>'+
      '<span class="src">'+escapeHtml(n.source_id||'')+' &middot; '+escapeHtml((n.pubDate||'').slice(0,10))+'</span></div>'
    ).join('');
  }catch(e){ list.innerHTML = '<p class="empty">Could not load headlines. Check your key in Settings.</p>'; }
}
function escapeHtml(s){ return String(s||'').replace(/[&<>"']/g, c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c])); }

let briefingOn = false;
$('briefBtn').addEventListener('click', ()=>{
  if(briefingOn){ speechSynthesis.cancel(); briefingOn=false;
    $('briefBtn').innerHTML='&#128266; Play audio briefing'; $('briefStatus').textContent='Reads the top headlines aloud on your phone. No key needed.'; return; }
  if(!newsItems.length){ $('briefStatus').textContent='Load headlines first (needs your NewsData.io key in Settings).'; return; }
  const text = 'Top headlines. ' + newsItems.slice(0,5).map((n,i)=>(i+1)+'. '+n.title).join(' ');
  const u = new SpeechSynthesisUtterance(text); u.rate = 1.02;
  u.onend = ()=>{ briefingOn=false; $('briefBtn').innerHTML='&#128266; Play audio briefing'; };
  speechSynthesis.cancel(); speechSynthesis.speak(u); briefingOn=true;
  $('briefBtn').innerHTML='&#9632; Stop briefing'; $('briefStatus').textContent='Playing briefing on this phone…';
});

/* ---------- podcast (iTunes, keyless) ---------- */
const podAudio = $('podAudio');
async function podSearch(q){
  const list = $('podList'); list.innerHTML = '<p class="empty">Searching&hellip;</p>';
  try{
    const r = await fetch('https://itunes.apple.com/search?term='+encodeURIComponent(q)+'&media=podcast&limit=12');
    const j = await r.json();
    if(!j.results.length){ list.innerHTML='<p class="empty">No podcasts found.</p>'; return; }
    list.innerHTML = j.results.map(p=>
      '<div class="pod-item" data-id="'+p.collectionId+'"><img src="'+p.artworkUrl100+'" alt=""><div><div class="t">'+escapeHtml(p.collectionName)+'</div><div class="a">'+escapeHtml(p.artistName||'')+'</div></div></div>'
    ).join('');
    list.querySelectorAll('.pod-item').forEach(el=>el.addEventListener('click',()=>podEpisodes(el.dataset.id)));
  }catch(e){ list.innerHTML='<p class="empty">Search failed. Check connection.</p>'; }
}
async function podEpisodes(id){
  const card=$('podEpsCard'), box=$('podEps'); card.hidden=false; box.innerHTML='<p class="empty">Loading episodes…</p>';
  try{
    const r = await fetch('https://itunes.apple.com/lookup?id='+id+'&entity=podcastEpisode&limit=20');
    const j = await r.json();
    const eps = j.results.filter(e=>e.wrapperType==='podcastEpisode' && e.episodeUrl);
    $('podEpsTitle').textContent = (j.results[0]&&j.results[0].collectionName)||'Episodes';
    box.innerHTML = eps.length ? eps.map(e=>
      '<div class="ep"><div>'+escapeHtml(e.trackName)+'</div><button class="btn outline" data-url="'+e.episodeUrl+'" data-t="'+escapeHtml(e.trackName)+'">&#9654; Play</button></div>'
    ).join('') : '<p class="empty">No playable episodes.</p>';
    box.querySelectorAll('button').forEach(b=>b.addEventListener('click',()=>{
      podAudio.src=b.dataset.url; podAudio.play().catch(()=>{});
      $('podNowbar').hidden=false; $('podNowTitle').textContent=b.dataset.t;
    }));
  }catch(e){ box.innerHTML='<p class="empty">Could not load episodes.</p>'; }
}
$('podGo').addEventListener('click',()=>{ const q=$('podSearch').value.trim(); if(q) podSearch(q); });
$('podSearch').addEventListener('keydown',e=>{ if(e.key==='Enter') $('podGo').click(); });

/* ---------- radio tab: search (radio-browser, keyless) ---------- */
const radioAudio = $('radioAudio');
let radioCurrentBtn = null;
async function radioSearch(q){
  const list=$('radioList'); list.innerHTML='<p class="empty">Searching…</p>';
  try{
    const r = await fetch('https://de1.api.radio-browser.info/json/stations/search?name='+encodeURIComponent(q)+'&limit=15&hidebroken=true');
    const j = await r.json();
    const ok = j.filter(s=>s.url_resolved);
    list.innerHTML = ok.length ? ok.map((s,i)=>
      '<div class="radio-item news-item"><a href="#" data-i="'+i+'">&#9654; '+escapeHtml(s.name)+'</a><span class="src">'+escapeHtml(s.country||'')+' &middot; '+escapeHtml(s.codec||'')+' '+escapeHtml(String(s.bitrate||''))+'k</span></div>'
    ).join('') : '<p class="empty">No stations found.</p>';
    list.querySelectorAll('a').forEach(a=>a.addEventListener('click',e=>{
      e.preventDefault();
      const s = ok[+a.dataset.i];
      radioAudio.src = s.url_resolved; radioAudio.play().catch(()=>{});
      $('radioNowPlaying').hidden=false; $('radioNpName').textContent=s.name;
    }));
  }catch(e){ list.innerHTML='<p class="empty">Search failed. Check connection.</p>'; }
}
$('radioGo').addEventListener('click',()=>{ const q=$('radioSearch').value.trim(); if(q) radioSearch(q); });
$('radioSearch').addEventListener('keydown',e=>{ if(e.key==='Enter') $('radioGo').click(); });
$('radioStop').addEventListener('click',()=>{ radioAudio.pause(); radioAudio.removeAttribute('src'); radioAudio.load(); $('radioNowPlaying').hidden=true; });

/* ---------- recorder: capture what's playing, store on-device (IndexedDB) ---------- */
let recStream=null, recorder=null, recChunks=[], recStart=0, recTick=null;
function idb(){
  return new Promise((res,rej)=>{
    const q = indexedDB.open('creatorhub',1);
    q.onupgradeneeded = ()=>q.result.createObjectStore('recs',{keyPath:'id',autoIncrement:true});
    q.onsuccess = ()=>res(q.result); q.onerror = ()=>rej(q.error);
  });
}
async function idbAll(){
  const db = await idb();
  return new Promise((res,rej)=>{
    const tx = db.transaction('recs','readonly'), out=[];
    tx.objectStore('recs').openCursor().onsuccess = e=>{
      const c=e.target.result; if(c){ out.push(c.value); c.continue(); } else res(out.reverse());
    };
    tx.onerror = ()=>rej(tx.error);
  });
}
async function renderRecs(){
  const box=$('myRecordings');
  try{
    const recs = await idbAll();
    box.innerHTML = recs.length ? '' : '<p class="empty">No recordings yet.</p>';
    recs.forEach(r=>{
      const d=document.createElement('div'); d.className='rec-item';
      const url=URL.createObjectURL(r.blob);
      d.innerHTML='<div class="t" style="font-weight:700;font-size:14px">'+escapeHtml(r.name)+'</div>'+
        '<div class="pill-dim" style="font-size:12px">'+escapeHtml(r.date)+'</div>'+
        '<audio controls src="'+url+'" style="width:100%;margin-top:6px"></audio> '+
        '<button class="del" title="Delete">&times;</button>';
      d.querySelector('.del').addEventListener('click', async()=>{
        const db=await idb(); db.transaction('recs','readwrite').objectStore('recs').delete(r.id);
        renderRecs();
      });
      box.appendChild(d);
    });
  }catch(e){ box.innerHTML='<p class="empty">Recordings unavailable on this browser.</p>'; }
}
$('recBtn').addEventListener('click', async()=>{
  const src = !radioAudio.paused && radioAudio.src ? radioAudio : (!homeAudio.paused && homeAudio.src ? homeAudio : null);
  if(!src){ alert('Play a station first, then hit Record.'); return; }
  try{
    recStream = src.captureStream ? src.captureStream() : src.mozCaptureStream();
    if(!recStream) throw new Error('no capture');
    recChunks=[]; recorder=new MediaRecorder(recStream);
    recorder.ondataavailable=e=>{ if(e.data.size) recChunks.push(e.data); };
    recorder.onstop=async()=>{
      const blob=new Blob(recChunks,{type:recorder.mimeType||'audio/webm'});
      const db=await idb();
      db.transaction('recs','readwrite').objectStore('recs').add({
        name:'Recording '+new Date().toLocaleString('en-US',{timeZone:TORONTO}),
        date:new Date().toLocaleString(), blob});
      renderRecs();
    };
    recorder.start(); recStart=Date.now();
    $('recBtn').disabled=true; $('recStopBtn').disabled=false;
    recTick=setInterval(()=>{ $('recTimer').textContent='● '+Math.round((Date.now()-recStart)/1000)+'s'; },500);
  }catch(e){ alert('Recording is not supported for this stream on this phone.'); }
});
$('recStopBtn').addEventListener('click',()=>{
  if(recorder&&recorder.state!=='inactive') recorder.stop();
  clearInterval(recTick); $('recTimer').textContent='';
  $('recBtn').disabled=false; $('recStopBtn').disabled=true;
});
renderRecs();

/* ---------- tools ---------- */
document.querySelectorAll('.tool-tile[data-tool]').forEach(t=>t.addEventListener('click',()=>openTool(t.dataset.tool)));
$('toolBack').addEventListener('click',()=>{ $('toolView').hidden=true; $('toolsMenu').hidden=false; });
const TOOL_NAMES={tracker:'Music Project Tracker',story:'Storyboard Tool',lyric:'Lyric Video Generator'};
function openTool(k){
  $('toolsMenu').hidden=true; $('toolView').hidden=false;
  $('toolTitle').textContent="🛠️ "+TOOL_NAMES[k];
  document.querySelectorAll('.tool-pane').forEach(p=>p.hidden=true);
  $('tool-'+k).hidden=false;
  if(k==='tracker') renderTracker();
  if(k==='story') renderStory();
}

/* tracker */
function renderTracker(){
  const items=store.get('tracker',[]);
  $('trkList').innerHTML = items.length ? items.map((t,i)=>
    '<div class="trk-item"><div class="grow"><div class="t">'+escapeHtml(t.title)+'</div>'+
    (t.note?'<div class="n">'+escapeHtml(t.note)+'</div>':'')+'</div>'+
    '<span class="badge">'+escapeHtml(t.status)+'</span>'+
    '<button class="del" data-i="'+i+'">&times;</button></div>'
  ).join('') : '<p class="empty">No projects yet. Add your first one above.</p>';
  $('trkList').querySelectorAll('.del').forEach(b=>b.addEventListener('click',()=>{
    const a=store.get('tracker',[]); a.splice(+b.dataset.i,1); store.set('tracker',a); renderTracker();
  }));
}
$('trkAdd').addEventListener('click',()=>{
  const title=$('trkTitle').value.trim(); if(!title) return;
  const a=store.get('tracker',[]);
  a.unshift({title, status:$('trkStatus').value, note:$('trkNote').value.trim()});
  store.set('tracker',a); $('trkTitle').value=''; $('trkNote').value=''; renderTracker();
});

/* storyboard */
function renderStory(){
  const items=store.get('story',[]);
  $('sbList').innerHTML = items.length ? items.map((s,i)=>
    '<div class="sb-item"><div class="t">SHOT '+escapeHtml(s.shot)+(s.cam?' · '+escapeHtml(s.cam):'')+'</div>'+
    '<div style="font-size:14px;margin-top:4px">'+escapeHtml(s.desc)+'</div>'+
    '<button class="del" data-i="'+i+'">&times;</button></div>'
  ).join('') : '<p class="empty">No shots yet. Add your first shot above.</p>';
  $('sbList').querySelectorAll('.del').forEach(b=>b.addEventListener('click',()=>{
    const a=store.get('story',[]); a.splice(+b.dataset.i,1); store.set('story',a); renderStory();
  }));
}
$('sbAdd').addEventListener('click',()=>{
  const shot=$('sbShot').value.trim(); if(!shot) return;
  const a=store.get('story',[]);
  a.push({shot, cam:$('sbCam').value.trim(), desc:$('sbDesc').value.trim()});
  store.set('story',a); $('sbShot').value=''; $('sbCam').value=''; $('sbDesc').value=''; renderStory();
});

/* ---------- lyric video generator: canvas + your audio -> webm download ---------- */
let lyrAudioUrl=null, lyrAudioEl=null, lyrPlaying=false, lyrRaf=null;
$('lyrAudio').addEventListener('change', e=>{
  const f=e.target.files[0]; if(!f) return;
  if(lyrAudioUrl) URL.revokeObjectURL(lyrAudioUrl);
  lyrAudioUrl=URL.createObjectURL(f);
  lyrAudioEl=new Audio(lyrAudioUrl); lyrAudioEl.preload='auto';
  $('lyrAudioName').textContent=f.name;
});
function lyrLines(){ return $('lyrText').value.split('\n').map(s=>s.trim()).filter(Boolean); }
function lyrDraw(line, sub){
  const c=$('lyrCanvas'), x=c.getContext('2d'), W=c.width, H=c.height;
  const g=x.createLinearGradient(0,0,0,H); g.addColorStop(0,'#120a24'); g.addColorStop(1,'#050508');
  x.fillStyle=g; x.fillRect(0,0,W,H);
  x.strokeStyle='rgba(245,179,1,.25)'; x.lineWidth=6; x.strokeRect(14,14,W-28,H-28);
  x.fillStyle='#f5b301'; x.font='900 44px -apple-system,sans-serif'; x.textAlign='center';
  x.fillText('MCSYN.', W/2, 90);
  x.fillStyle='#f5ead2'; x.font='800 52px -apple-system,sans-serif';
  const words=(line||'').split(' ');
  let l2='', l1=words.join(' ');
  if(x.measureText(l1).width > W-120 && words.length>1){
    const half=Math.ceil(words.length/2); l1=words.slice(0,half).join(' '); l2=words.slice(half).join(' ');
  }
  x.fillText(l1, W/2, H/2-20);
  if(l2) x.fillText(l2, W/2, H/2+48);
  if(sub){ x.fillStyle='rgba(245,234,210,.55)'; x.font='600 30px -apple-system,sans-serif'; x.fillText(sub, W/2, H-120); }
}
function lyrTick(){
  if(!lyrPlaying) return;
  const lines=lyrLines(), dur=lyrAudioEl.duration||1, t=lyrAudioEl.currentTime||0;
  const idx=Math.min(lines.length-1, Math.floor(t/dur*lines.length));
  lyrDraw(lines[idx]||'', 'Line '+(idx+1)+' of '+lines.length);
  lyrRaf=requestAnimationFrame(lyrTick);
}
$('lyrPreview').addEventListener('click',()=>{
  const lines=lyrLines();
  if(!lines.length){ $('lyrStatus').textContent='Paste your lyrics first.'; return; }
  if(!lyrAudioEl){ $('lyrStatus').textContent='Pick your audio file first.'; return; }
  lyrPlaying=true; lyrAudioEl.currentTime=0; lyrAudioEl.play().catch(()=>{});
  lyrAudioEl.onended=()=>{ lyrPlaying=false; cancelAnimationFrame(lyrRaf); };
  lyrTick(); $('lyrStatus').textContent='Previewing…';
});
$('lyrExport').addEventListener('click',()=>{
  const lines=lyrLines();
  if(!lines.length){ $('lyrStatus').textContent='Paste your lyrics first.'; return; }
  if(!lyrAudioEl){ $('lyrStatus').textContent='Pick your audio file first.'; return; }
  try{
    const c=$('lyrCanvas'), vStream=c.captureStream(30);
    const actx=new (window.AudioContext||window.webkitAudioContext)();
    const src=actx.createMediaElementSource(lyrAudioEl);
    const dest=actx.createMediaStreamDestination(); src.connect(dest); src.connect(actx.destination);
    const mixed=new MediaStream([...vStream.getVideoTracks(), ...dest.stream.getAudioTracks()]);
    const mr=new MediaRecorder(mixed,{mimeType:'video/webm'});
    const chunks=[]; mr.ondataavailable=e=>{ if(e.data.size) chunks.push(e.data); };
    mr.onstop=()=>{
      const url=URL.createObjectURL(new Blob(chunks,{type:'video/webm'}));
      const a=document.createElement('a'); a.href=url; a.download='lyric-video.webm'; a.click();
      $('lyrStatus').textContent='Exported! Check your downloads.';
      lyrAudioEl.pause(); lyrPlaying=false; cancelAnimationFrame(lyrRaf);
    };
    $('lyrStatus').textContent='Recording video… plays in real time.';
    lyrPlaying=true; lyrAudioEl.currentTime=0; mr.start(); lyrAudioEl.play().catch(()=>{});
    lyrAudioEl.onended=()=>{ if(mr.state!=='inactive') mr.stop(); };
    lyrTick();
  }catch(e){ $('lyrStatus').textContent='Export not supported in this browser.'; }
});
lyrDraw('Your lyrics appear here','paste lines above');

/* ---------- settings ---------- */
$('newsKey').value = store.get('newskey','');
$('newsKeySave').addEventListener('click',()=>{
  store.set('newskey', $('newsKey').value.trim());
  alert('Key saved on this phone.');
  loadNews(true);
});
$('wipeRec').addEventListener('click', async()=>{
  if(!confirm('Delete all recordings on this phone?')) return;
  const db=await idb(); db.transaction('recs','readwrite').objectStore('recs').clear();
  renderRecs(); alert('Recordings deleted.');
});
$('wipeTools').addEventListener('click',()=>{
  if(!confirm('Delete tracker + storyboard data on this phone?')) return;
  store.del('tracker'); store.del('story'); alert('Tool data deleted.');
});

/* ---------- init ---------- */
loadWeather();
loadNews(false);
