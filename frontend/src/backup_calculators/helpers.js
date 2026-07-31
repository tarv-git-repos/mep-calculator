// Shared Helper Functions
let stdFilter='All';

function buildStandards(){
  const filterEl=document.getElementById('std-filter-bar');
  filterEl.innerHTML='';
  const q=(document.getElementById('std-search')?.value||'').trim().toLowerCase();

  ['All','HVAC','Plumbing','Fire','Electrical'].forEach(f=>{
    const count=f==='All'?standardsData.length:standardsData.filter(s=>s.cat===f).length;
    const isActive=f===stdFilter;
    const colors={All:'var(--navy)',HVAC:'var(--blue)',Plumbing:'var(--green)',Fire:'var(--red)',Electrical:'var(--amber)'};
    const btn=document.createElement('button');
    btn.style.cssText=`padding:6px 14px;border-radius:20px;border:1px solid ${isActive?colors[f]:'var(--border)'};background:${isActive?colors[f]:'var(--card)'};color:${isActive?'#fff':'var(--muted)'};font-size:11.5px;font-weight:600;cursor:pointer;font-family:var(--font);transition:all .15s`;
    btn.textContent=f+' ('+count+')';
    btn.onclick=()=>{stdFilter=f;buildStandards();};
    filterEl.appendChild(btn);
  });

  let filtered=standardsData.filter(s=>stdFilter==='All'||s.cat===stdFilter);

  if(q){
    filtered=filtered.filter(s=>
      s.std.toLowerCase().includes(q)||
      s.title.toLowerCase().includes(q)||
      s.content.toLowerCase().includes(q)||
      s.cat.toLowerCase().includes(q)
    );
  }

  const countEl=document.getElementById('std-count');
  const clearEl=document.getElementById('std-search-clear');
  if(countEl) countEl.textContent=q||stdFilter!=='All'?`${filtered.length} of ${standardsData.length} standards`:'';
  if(clearEl) clearEl.style.display=q?'block':'none';

  const el=document.getElementById('std-cards-list');
  if(filtered.length===0){
    el.innerHTML=`<div class="ref-no-results">No standards match "<strong>${q||stdFilter}</strong>".<br>Try a different keyword.</div>`;
    return;
  }

  function hl(txt){
    if(!q) return txt;
    return String(txt).replace(new RegExp(`(${q.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')})`, 'gi'),'<span class="ref-search-highlight">$1</span>');
  }

  const colors={HVAC:'var(--blue)',Plumbing:'var(--green)',Fire:'var(--red)',Electrical:'var(--amber)'};
  const bgColors={HVAC:'var(--blue-lt)',Plumbing:'var(--green-lt)',Fire:'var(--red-lt)',Electrical:'rgba(217,119,6,0.08)'};

  el.innerHTML=filtered.map((s,i)=>`
    <div style="animation:fadeUp .12s ease ${i*18}ms both;background:${bgColors[s.cat]||'var(--card)'};border:1px solid var(--border);border-radius:12px;padding:14px 16px;margin-bottom:10px">
      <div style="display:flex;align-items:center;gap:8px;margin-bottom:8px;flex-wrap:wrap">
        <span style="font-size:11px;font-weight:700;padding:3px 10px;border-radius:12px;background:${colors[s.cat]||'var(--blue)'};color:#fff">${hl(s.std)}</span>
        <span style="font-size:11px;color:var(--muted)">${s.cat}</span>
      </div>
      <div style="font-size:13.5px;font-weight:700;color:var(--text);margin-bottom:6px">${hl(s.title)}</div>
      <div style="font-size:12px;color:var(--text-sec);line-height:1.65">${hl(s.content)}</div>
    </div>`).join('');
}

﻿// ── MEP Design Checker ──
const dcChecks = [
  {id:'dc-duct-vel',label:'Supply duct velocity',unit:'FPM',lo:500,loW:800,okHi:2000,hiW:2500,hi:3200,good:'800–2000 FPM',cat:'HVAC'},
  {id:'dc-pipe-vel-hw',label:'HW/CHW pipe velocity',unit:'fps',lo:1,loW:1.5,okHi:5,hiW:8,hi:12,good:'1.5–5 fps',cat:'HVAC'},
  {id:'dc-esp',label:'AHU external static pressure',unit:'in w.g.',lo:0.3,loW:0.5,okHi:2.5,hiW:3.5,hi:5,good:'0.5–2.5 in w.g.',cat:'HVAC'},
  {id:'dc-cfm-tr',label:'Airflow per TR',unit:'CFM/TR',lo:200,loW:320,okHi:450,hiW:500,hi:600,good:'320–450 CFM/TR',cat:'HVAC'},
  {id:'dc-dom-vel',label:'Domestic water velocity',unit:'fps',lo:0.5,loW:1,okHi:8,hiW:9,hi:12,good:'1–8 fps (cold), ≤5 fps (hot)',cat:'Plumbing'},
  {id:'dc-resid-press',label:'Residual pressure at fixture',unit:'psi',lo:5,loW:8,okHi:60,hiW:80,hi:120,good:'10–60 psi',cat:'Plumbing'},
  {id:'dc-drain-slope',label:'Horizontal drain slope',unit:'in/ft',lo:0.04,loW:0.125,okHi:0.5,hiW:1,hi:3,good:'⅛"–½" per foot',cat:'Plumbing'},
  {id:'dc-fire-vel',label:'Fire pipe velocity',unit:'fps',lo:1,loW:4,okHi:20,hiW:25,hi:32,good:'4–20 fps (NFPA 13)',cat:'Fire'},
  {id:'dc-fire-resid',label:'Sprinkler residual pressure',unit:'psi',lo:7,loW:10,okHi:175,hiW:175,hi:200,good:'≥7 psi (NFPA 13 min)',cat:'Fire'},
  {id:'dc-vd-pct',label:'Cable voltage drop',unit:'%',lo:0,loW:0,okHi:3,hiW:5,hi:10,good:'≤3% (IEC final circuit)',cat:'Electrical'},
  {id:'dc-cable-load',label:'Cable loading (Ib/Iz)',unit:'%',lo:0,loW:0,okHi:80,hiW:100,hi:110,good:'≤80% preferred',cat:'Electrical'},
  {id:'dc-pf',label:'Power factor',unit:'',lo:0.5,loW:0.75,okHi:1.0,hiW:1.0,hi:1.01,good:'≥0.85 (utility req)',cat:'Electrical'},
  {id:'dc-lux',label:'Office illuminance',unit:'lux',lo:100,loW:300,okHi:750,hiW:1000,hi:2000,good:'300–750 lux (EN 12464)',cat:'Electrical'},
];

function buildDCChecks() {
  const container = document.getElementById('dc-checks-container');
  if (!container) return;
  container.innerHTML = dcChecks.map(c => `
    <div class="scard" style="margin-bottom:10px">
      <div class="scard-body" style="padding:12px">
        <div style="display:flex;align-items:center;gap:8px;margin-bottom:6px">
          <span style="font-size:10px;padding:2px 6px;border-radius:4px;font-weight:700;background:var(--blue-lt);color:var(--blue)">${c.cat}</span>
          <span style="font-size:12px;font-weight:600">${c.label}</span>
        </div>
        <div style="display:flex;gap:8px;align-items:center">
          <input class="inp" id="${c.id}" type="number" placeholder="Enter value…" oninput="runDCCheck()" style="flex:1;padding:8px">
          <span style="font-size:11px;color:var(--muted);min-width:50px">${c.unit}</span>
          <div id="${c.id}-badge" style="width:20px;height:20px;border-radius:50%;background:var(--border);flex-shrink:0"></div>
        </div>
        <div id="${c.id}-msg" style="font-size:11px;color:var(--muted);margin-top:4px">Good range: ${c.good}</div>
      </div>
    </div>`).join('');
}

function runDCCheck() {
  let anyFilled = false;
  dcChecks.forEach(c => {
    const val = parseFloat(document.getElementById(c.id)?.value);
    const badge = document.getElementById(c.id+'-badge');
    const msg = document.getElementById(c.id+'-msg');
    if (!badge || !msg) return;
    if (isNaN(val)) { badge.style.background='var(--border)'; msg.textContent='Good range: '+c.good; return; }
    anyFilled = true;
    let color,icon,text;
    if (val < c.lo || val > c.hi) { color='var(--red)';icon='✗';text='Not acceptable'; }
    else if (val < c.loW || val > c.hiW) { color='var(--amber)';icon='⚠';text='Warning - check design'; }
    else { color='var(--green)';icon='✓';text='OK - within range'; }
    badge.style.background=color;badge.innerHTML=`<span style="color:#fff;font-size:10px;font-weight:700">${icon}</span>`;
    msg.innerHTML=`<span style="color:${color};font-weight:600">${text}</span> - good: ${c.good}`;
  });
  document.getElementById('dc-results-card').style.display = anyFilled ? 'none' : 'none';
}

// ── kW / HP / kVA Converter ──
function calcEQ(from) {
  const kw = parseFloat(document.getElementById('eq-kw').value);
  const hp = parseFloat(document.getElementById('eq-hp').value);
  const kva = parseFloat(document.getElementById('eq-kva').value);
  if (from==='kw' && !isNaN(kw)) {
    document.getElementById('eq-hp').value = (kw*1.34102).toFixed(2);
    document.getElementById('eq-kva').value = (kw/0.85).toFixed(2);
  } else if (from==='hp' && !isNaN(hp)) {
    document.getElementById('eq-kw').value = (hp/1.34102).toFixed(2);
    document.getElementById('eq-kva').value = (hp/1.34102/0.85).toFixed(2);
  } else if (from==='kva' && !isNaN(kva)) {
    document.getElementById('eq-kw').value = (kva*0.85).toFixed(2);
    document.getElementById('eq-hp').value = (kva*0.85*1.34102).toFixed(2);
  }
}

// ── Cable type guide ──
const cableTypes = [
  {name:'XLPE (Cu)',app:'Power distribution, MV/LV',temp:'90°C',volt:'0.6/1kV–33kV',pros:'High temp rating, low dielectric loss'},
  {name:'PVC (Cu)',app:'General LV wiring',temp:'70°C',volt:'0.6/1kV',pros:'Low cost, flexible, widely available'},
  {name:'Armoured (SWA)',app:'Underground, outdoor',temp:'90°C (XLPE)',volt:'0.6/1kV',pros:'Mechanical protection'},
  {name:'MICC (Mineral)',app:'Fire-resistant circuits',temp:'250°C',volt:'500V/1kV',pros:'Fire survival, 2hr/4hr rating'},
  {name:'EPR (rubber)',app:'Flexible, high temp',temp:'90°C',volt:'0.6/1kV',pros:'Flexible, oil resistant'},
  {name:'Aluminium (Al)',app:'Large cables ≥16mm²',temp:'90°C (XLPE)',volt:'0.6/1kV',pros:'Lighter, lower cost for large sizes'},
];
function buildCableTypeGuide() {
  const el = document.getElementById('cable-type-cards');
  if (!el) return;
  el.innerHTML = cableTypes.map(c => `<div style="background:var(--bg);border-radius:8px;padding:10px;border:1px solid var(--border)">
    <div style="font-size:12px;font-weight:700;color:var(--amber);margin-bottom:4px">${c.name}</div>
    <div style="font-size:11px;color:var(--text);margin-bottom:2px">${c.app}</div>
    <div style="font-size:10px;color:var(--muted)">${c.temp} · ${c.volt}</div>
    <div style="font-size:10px;color:var(--muted);margin-top:3px;font-style:italic">${c.pros}</div>
  </div>`).join('');
}

// ── Power Triangle ──
function calcPowerTriangle() {
  const pRaw=document.getElementById('pt-p').value;
  const qRaw=document.getElementById('pt-q').value;
  const sRaw=document.getElementById('pt-s').value;
  const pfRaw=document.getElementById('pt-pf').value;
  const vals=[pRaw,qRaw,sRaw,pfRaw].filter(x=>x!=='');
  if(vals.length<2){document.getElementById('pt-results').style.display='none';return;}
  let P,Q,S,PF;
  const p=parseFloat(pRaw),q=parseFloat(qRaw),sv=parseFloat(sRaw),pf=parseFloat(pfRaw);
  if(!isNaN(p)&&!isNaN(q)){S=Math.sqrt(p*p+q*q);P=p;Q=q;PF=p/S;}
  else if(!isNaN(p)&&!isNaN(sv)&&sv>0){S=sv;P=p;Q=Math.sqrt(sv*sv-p*p);PF=p/sv;}
  else if(!isNaN(p)&&!isNaN(pf)&&pf>0){S=p/pf;P=p;Q=Math.sqrt(S*S-P*P);PF=pf;}
  else if(!isNaN(sv)&&!isNaN(pf)){P=sv*pf;S=sv;Q=Math.sqrt(sv*sv-P*P);PF=pf;}
  else if(!isNaN(q)&&!isNaN(pf)&&pf>0){const phi=Math.acos(pf);P=q/Math.tan(phi);S=P/pf;Q=q;PF=pf;}
  else{return;}
  const phi=Math.acos(Math.min(1,PF))*180/Math.PI;
  let cls='';if(PF>=0.95)cls='Excellent';else if(PF>=0.85)cls='Good';else if(PF>=0.75)cls='Poor - correction needed';else cls='Very poor - urgent correction';
  document.getElementById('pt-results').style.display='block';
  s('pt-r-p',P.toFixed(2)+' kW');s('pt-r-q',Q.toFixed(2)+' kVAR');s('pt-r-s',S.toFixed(2)+' kVA');
  s('pt-r-pf',PF.toFixed(4));s('pt-r-phi',phi.toFixed(1)+'°');s('pt-r-class',cls);
  // Draw SVG triangle
  const svg=document.getElementById('pt-svg');
  const w=280,h=150;const ox=20,oy=140;
  const bx=ox+w-20,by=oy;const tx=ox,ty=oy-h+20;
  const scS=Math.max(P,Q,S)||100;
  const px=ox+(P/scS)*(w-40),py=oy;
  const qx=px,qy=oy-(Q/scS)*(h-20);
  svg.innerHTML=`
    <line x1="${ox}" y1="${oy}" x2="${px}" y2="${oy}" stroke="var(--green)" stroke-width="3"/>
    <line x1="${px}" y1="${oy}" x2="${px}" y2="${qy}" stroke="var(--amber)" stroke-width="3"/>
    <line x1="${ox}" y1="${oy}" x2="${px}" y2="${qy}" stroke="var(--blue)" stroke-width="3" stroke-dasharray="none"/>
    <text x="${(ox+px)/2}" y="${oy+16}" text-anchor="middle" font-size="11" fill="var(--green)" font-weight="700">P=${P.toFixed(1)} kW</text>
    <text x="${px+4}" y="${(oy+qy)/2}" font-size="11" fill="var(--amber)" font-weight="700">Q=${Q.toFixed(1)}</text>
    <text x="${(ox+px)/2-10}" y="${qy-6}" font-size="11" fill="var(--blue)" font-weight="700">S=${S.toFixed(1)} kVA</text>
    <text x="${ox+10}" y="${oy-8}" font-size="10" fill="var(--muted)">φ=${phi.toFixed(0)}°</text>
    <circle cx="${ox}" cy="${oy}" r="3" fill="var(--blue)"/>
    <circle cx="${px}" cy="${oy}" r="3" fill="var(--green)"/>
    <circle cx="${px}" cy="${qy}" r="3" fill="var(--amber)"/>`;
  try{renderPowerTriangleChart(p,q,s,pf);}catch(_e){}
}

// ── Electrical Selector Guides ──
const elecSelectors = [
  {title:'🔌 Protection Device Selection',items:[
    {q:'Load current',opts:['≤125A → MCB (IEC 60898)','100–2500A → MCCB (IEC 60947)','> 800A → ACB','Motor protection → MPCB / MMS']},
    {q:'Short circuit withstand',opts:['Residential: 6–10 kA','Commercial: 10–25 kA','Industrial: 25–50 kA','MV: 25–100 kA (kA sym)']},
  ]},
  {title:'🌍 Earthing System (IEC 60364)',items:[
    {q:'TN-C-S (PME)',opts:['Most common in UK/Gulf','Combined PEN to distribution board','Separate PE/N at consumer']},
    {q:'TN-S',opts:['Separate PE throughout','Preferred for sensitive equipment','Less noise on PE conductor']},
    {q:'TT',opts:['Independent earth electrode','Required when supply earth unreliable','RCD mandatory for fault protection']},
    {q:'IT',opts:['No direct earth connection','Used in hospitals (uninterrupted supply)','First fault: system continues operating']},
  ]},
  {title:'🔋 Transformer Configuration',items:[
    {q:'Standard distribution',opts:['Dyn11 (Delta primary, Star secondary) - most common LV distribution']},
    {q:'No third harmonic on HV',opts:['Dy - Delta primary prevents 3rd harmonic circulating on HV system']},
    {q:'Generator step-up',opts:['Yd - Star generator, Delta HV grid connection']},
    {q:'Auto-transformer',opts:['33/11kV or 11kV/6.6kV subtransmission - compact, efficient, same earth']},
  ]},
];
function buildElecSelectors() {
  const el = document.getElementById('elec-selector-content');
  if(!el) return;
  const q=(document.getElementById('elec-sel-search')?.value||'').trim().toLowerCase();
  const clearEl=document.getElementById('elec-sel-search')?.nextElementSibling?.nextElementSibling;
  if(clearEl) clearEl.style.display=q?'block':'none';

  function hl(txt){
    if(!q) return txt;
    return String(txt).replace(new RegExp(`(${q.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')})`, 'gi'),'<span class="ref-search-highlight">$1</span>');
  }

  let totalMatches = 0;
  const sections = elecSelectors.map(sec => {
    const filteredItems = q ? sec.items.filter(item =>
      item.q.toLowerCase().includes(q) ||
      item.opts.some(o=>o.toLowerCase().includes(q)) ||
      sec.title.toLowerCase().includes(q)
    ) : sec.items;
    return {...sec, filteredItems};
  }).filter(sec => sec.filteredItems.length > 0);

  sections.forEach(sec => totalMatches += sec.filteredItems.length);

  const countEl = document.getElementById('elec-sel-count');
  if(countEl) countEl.textContent = q ? `${totalMatches} result${totalMatches!==1?'s':''} for "${q}"` : '';

  if(sections.length === 0){
    el.innerHTML = `<div class="ref-no-results">No matches for "<strong>${q}</strong>".<br>Try MCB, earthing, TN-S, motor, transformer…</div>`;
    return;
  }

  el.innerHTML = sections.map((sec,si) => `
    <div class="scard" style="animation:fadeUp .12s ease ${si*40}ms both">
      <div class="scard-head"><div class="scard-accent" style="background:var(--amber)"></div><div class="scard-title">${sec.title}</div></div>
      <div class="scard-body">
        ${sec.filteredItems.map(item=>`
          <div style="margin-bottom:12px">
            <div style="font-size:12px;font-weight:700;margin-bottom:6px;color:var(--muted)">${hl(item.q)}</div>
            ${item.opts.map(o=>`<div style="font-size:12px;padding:7px 12px;background:var(--bg);border-radius:6px;margin-bottom:4px;border-left:3px solid var(--amber);line-height:1.5">${hl(o)}</div>`).join('')}
          </div>`).join('')}
      </div>
    </div>`).join('');
}

// ── MEP System Selector ──
const mepSelectors = [
  {title:'🌡 AHU Type Selector',accent:'var(--blue)',items:[
    {q:'Floor area < 500 m²',ans:'FCU system (fan coil units) - simpler, lower cost, zone control'},
    {q:'Floor area 500–5000 m²',ans:'Central AHU with VAV boxes - better air quality, energy efficient'},
    {q:'Hospital / lab / clean room',ans:'Dedicated OA unit + FCU or fan coils - infection control, high ACH'},
    {q:'High ventilation load',ans:'DOAS (Dedicated Outdoor Air System) + sensible cooling'},
    {q:'No ductwork space',ans:'VRF/VRV indoor units - flexible, no ductwork required'},
  ]},
  {title:'💧 Pump Type Selector',accent:'var(--green)',items:[
    {q:'Chilled water / hot water circulation',ans:'End-suction centrifugal - most common for HVAC hydronic'},
    {q:'High head, low flow',ans:'Vertical multistage - booster, high-rise buildings'},
    {q:'Fire water (NFPA 20)',ans:'Horizontal split-case centrifugal - listed to UL 448'},
    {q:'Sewage / drainage',ans:'Submersible sewage pump - solid-handling vortex impeller'},
    {q:'Domestic water boosting',ans:'Inline or close-coupled centrifugal with pressure sensor control'},
  ]},
  {title:'🔥 Fire System Selector',accent:'var(--red)',items:[
    {q:'Office / hotel / retail',ans:'Wet pipe sprinkler (NFPA 13) - most reliable, lowest maintenance'},
    {q:'Cold climate (freezing risk)',ans:'Dry pipe or pre-action sprinkler - air/nitrogen pressurised'},
    {q:'Server room / data centre',ans:'Pre-action or clean agent (FM-200, Novec 1230) - no water damage'},
    {q:'Car park (open)',ans:'Deluge or ESFR - fast response, high flow density'},
    {q:'High-rise / large building',ans:'Wet pipe sprinkler + Class I standpipe for hose operations'},
  ]},
  {title:'💡 Lighting Type Selector',accent:'var(--amber)',items:[
    {q:'General office / retail',ans:'LED panel 600×600 or linear LED - 4000K, Ra≥80, 500 lux target'},
    {q:'Warehouse / high-bay',ans:'LED highbay - 5000–20000 lm, 4000-5000K, 200 lux target'},
    {q:'Car park / outdoor',ans:'LED floodlight or area light - IP65, 4000K, 50-75 lux'},
    {q:'Hospital / clinical',ans:'LED cleanroom panel - Ra≥90, 5000K, easy to clean'},
    {q:'Emergency / exit',ans:'LED emergency fitting with 3hr battery backup - EN 1838'},
  ]},
];
function buildMEPSelectors() {
  const el = document.getElementById('mep-selector-content');
  if(!el) return;
  const q=(document.getElementById('mep-sel-search')?.value||'').trim().toLowerCase();
  const clearEl=document.getElementById('mep-sel-search')?.nextElementSibling?.nextElementSibling;
  if(clearEl) clearEl.style.display=q?'block':'none';

  function hl(txt){
    if(!q) return txt;
    return String(txt).replace(new RegExp(`(${q.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')})`, 'gi'),'<span class="ref-search-highlight">$1</span>');
  }

  let totalMatches = 0;
  const sections = mepSelectors.map(sec => {
    const filteredItems = q ? sec.items.filter(item =>
      item.q.toLowerCase().includes(q) ||
      item.ans.toLowerCase().includes(q) ||
      sec.title.toLowerCase().includes(q)
    ) : sec.items;
    return {...sec, filteredItems};
  }).filter(sec => sec.filteredItems.length > 0);

  sections.forEach(sec => totalMatches += sec.filteredItems.length);

  const countEl = document.getElementById('mep-sel-count');
  if(countEl) countEl.textContent = q ? `${totalMatches} result${totalMatches!==1?'s':''} for "${q}"` : '';

  if(sections.length === 0){
    el.innerHTML = `<div class="ref-no-results">No matches for "<strong>${q}</strong>".<br>Try AHU, hospital, pump, sprinkler, LED…</div>`;
    return;
  }

  el.innerHTML = sections.map((sec,si) => `
    <div class="scard" style="animation:fadeUp .12s ease ${si*40}ms both">
      <div class="scard-head"><div class="scard-accent" style="background:${sec.accent}"></div><div class="scard-title">${sec.title}</div></div>
      <div class="scard-body">
        ${sec.filteredItems.map(item=>`
          <div style="margin-bottom:10px;padding:10px 12px;background:var(--bg);border-radius:8px;border-left:3px solid ${sec.accent}">
            <div style="font-size:11px;font-weight:700;color:var(--muted);margin-bottom:4px;text-transform:uppercase;letter-spacing:0.3px">WHEN: ${hl(item.q)}</div>
            <div style="font-size:12.5px;color:var(--text);line-height:1.5">${hl(item.ans)}</div>
          </div>`).join('')}
      </div>
    </div>`).join('');
}

// ── Pipe Material Guide ──
const pipeMaterials = [
  {service:'Domestic cold water',mat:'Copper Type L / CPVC / PEX',avoid:'Galvanised steel (corrosion)',note:'Max 80°C for CPVC. PEX flexible for concealed runs.'},
  {service:'Domestic hot water',mat:'Copper / CPVC / PP-R',avoid:'PVC (max 60°C)',note:'Insulate all HW lines. Use TMV at outlets.'},
  {service:'Chilled water (CHW)',mat:'Steel (black) / HDPE for buried',avoid:'Galvanised (deposits)',note:'Insulate all CHW pipes. Use inhibitors in closed loops.'},
  {service:'Condenser water (CW)',mat:'Steel (black) / HDPE',avoid:'Copper (dezincification risk with brass)',note:'Chemical treatment required. Test monthly.'},
  {service:'Heating hot water (HHW)',mat:'Steel (black) / PP-R',avoid:'PVC / CPVC (temp limitation)',note:'Check max temp rating of material chosen.'},
  {service:'Compressed air',mat:'Stainless steel / aluminium / copper',avoid:'Black steel (rust particles)',note:'Use dedicated airline quality compressor + filter.'},
  {service:'Sewage / waste',mat:'UPVC / cast iron / ductile iron',avoid:'Copper (cost, corrosion)',note:'Slope min ¼"/ft. Use rodding access at bends.'},
  {service:'Fire water (wet pipe)',mat:'Schedule 40 black steel (NFPA 13)',avoid:'PVC (not listed for fire)',note:'Grooved or threaded joints. Flush before commissioning.'},
  {service:'Gas (low pressure)',mat:'Black steel / HDPE (buried)',avoid:'Galvanised / copper (sulfur corrosion)',note:'All joints must be leak-tested before commissioning.'},
  {service:'Refrigerant',mat:'Copper (ACR grade)',avoid:'Standard plumbing copper',note:'Dehydrate and pressure-test before charging.'},
];
function buildPipeMaterialGuide() {
  const el = document.getElementById('pipe-material-content');
  if(!el) return;
  const q=(document.getElementById('pipe-search')?.value||'').trim().toLowerCase();
  const clearEl=document.getElementById('pipe-search')?.nextElementSibling?.nextElementSibling;
  if(clearEl) clearEl.style.display=q?'block':'none';

  function hl(txt){
    if(!q) return txt;
    return String(txt).replace(new RegExp(`(${q.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')})`, 'gi'),'<span class="ref-search-highlight">$1</span>');
  }

  const filtered = q ? pipeMaterials.filter(m=>
    m.service.toLowerCase().includes(q)||
    m.mat.toLowerCase().includes(q)||
    m.avoid.toLowerCase().includes(q)||
    (m.note||'').toLowerCase().includes(q)
  ) : pipeMaterials;

  const countEl = document.getElementById('pipe-count');
  if(countEl) countEl.textContent = q ? `${filtered.length} of ${pipeMaterials.length} services matched` : '';

  if(filtered.length === 0){
    el.innerHTML = `<div class="ref-no-results">No pipe services match "<strong>${q}</strong>".<br>Try: fire, chilled water, gas, copper, HDPE…</div>`;
    return;
  }

  el.innerHTML = `<div class="calc-desc" style="margin-bottom:12px">Select the right pipe material for any MEP service. ✓ = Recommended · ✗ = Avoid.</div>` +
    filtered.map((m,i)=>`
    <div style="animation:fadeUp .12s ease ${i*25}ms both;background:var(--card);border:1px solid var(--border);border-radius:12px;padding:14px 16px;margin-bottom:10px">
      <div style="font-size:13.5px;font-weight:700;color:var(--text);margin-bottom:10px;padding-bottom:8px;border-bottom:1px solid var(--border)">${hl(m.service)}</div>
      <div style="display:grid;gap:6px">
        <div style="display:flex;gap:8px;align-items:flex-start">
          <span style="font-size:11px;font-weight:700;color:var(--green);background:var(--green-lt);padding:2px 8px;border-radius:10px;flex-shrink:0;margin-top:1px">✓ USE</span>
          <span style="font-size:12.5px;color:var(--text);line-height:1.5">${hl(m.mat)}</span>
        </div>
        <div style="display:flex;gap:8px;align-items:flex-start">
          <span style="font-size:11px;font-weight:700;color:var(--red);background:var(--red-lt);padding:2px 8px;border-radius:10px;flex-shrink:0;margin-top:1px">✗ AVOID</span>
          <span style="font-size:12.5px;color:var(--muted);line-height:1.5">${hl(m.avoid)}</span>
        </div>
        ${m.note?`<div style="display:flex;gap:8px;align-items:flex-start">
          <span style="font-size:11px;font-weight:700;color:var(--blue);background:var(--blue-lt);padding:2px 8px;border-radius:10px;flex-shrink:0;margin-top:1px">ℹ NOTE</span>
          <span style="font-size:12px;color:var(--muted);line-height:1.5">${hl(m.note)}</span>
        </div>`:''}
      </div>
    </div>`).join('');
}

// ── Flow ↔ Velocity ──
function calcFVPipe() {
  const d=(+document.getElementById('fv-dia')?.value||100)/1000;
  const vel=+document.getElementById('fv-vel')?.value||2.5;
  const A=Math.PI*d*d/4;
  const q=A*vel; // m³/s
  s('fv-r-flow',(q*1000).toFixed(2)+' L/s');
  s('fv-r-flow2',(q*35.3147).toFixed(3)+' ft³/s | '+(q/6.309e-5).toFixed(0)+' GPM | '+(q*3600).toFixed(1)+' m³/h');
}
function calcFVDuct() {
  const W=(+document.getElementById('fv-dw')?.value||600)/1000;
  const H=(+document.getElementById('fv-dh')?.value||300)/1000;
  const vel=+document.getElementById('fv-dv')?.value||5;
  const q=W*H*vel;
  s('fv-r-duct',(q*1000).toFixed(1)+' L/s');
  s('fv-r-duct2',(q/4.719e-4).toFixed(0)+' CFM | '+(q*3600).toFixed(0)+' m³/h');
}
function calcFVReverse() {
  const unit=document.getElementById('fv-flow-unit')?.value||'ls';
  const flowRaw=+document.getElementById('fv-flow-in')?.value||10;
  const dia=(+document.getElementById('fv-dia-rev')?.value||100)/1000;
  const toM3s={ls:flowRaw/1000,cfm:flowRaw*4.719e-4,m3h:flowRaw/3600}[unit]||flowRaw/1000;
  const A=Math.PI*dia*dia/4;
  const vel=toM3s/A;
  const ok=vel<=3?'✓ OK (≤3 m/s)':vel<=5?'⚠ High (domestic limit 3 m/s)':'✗ Excessive';
  const c=vel<=3?'var(--green)':vel<=5?'var(--amber)':'var(--red)';
  s('fv-r-vel',vel.toFixed(2)+' m/s ('+(vel/0.3048).toFixed(2)+' fps)');
  const el=document.getElementById('fv-r-vel-chk');if(el){el.textContent=ok;el.style.color=c;}
}

// ── Pipe Weight ──
function calcPipeWeight() {
  const rho=+document.getElementById('pw-mat')?.value||7850;
  const od=((rv('pw-od')))/1000;
  const wt=((rv('pw-wt')))/1000;
  const L=(rv('pw-len'));
  const id=od-2*wt;
  const A_pipe=Math.PI*(od*od-id*id)/4;
  const pipeKgPerM=A_pipe*rho;
  const waterKgPerM=Math.PI*id*id/4*998;
  const totalKgPerM=pipeKgPerM+waterKgPerM;
  s('pw-r-id',(id*1000).toFixed(1)+' mm');
  s('pw-r-empty',(pipeKgPerM*L).toFixed(1)+' kg ('+pipeKgPerM.toFixed(2)+' kg/m)');
  s('pw-r-water',(waterKgPerM*L).toFixed(1)+' kg ('+waterKgPerM.toFixed(2)+' kg/m)');
  s('pw-r-total',(totalKgPerM*L).toFixed(1)+' kg ('+totalKgPerM.toFixed(2)+' kg/m)');
  s('pw-r-per-m',totalKgPerM.toFixed(2)+' kg/m | '+(totalKgPerM*9.81).toFixed(1)+' N/m');
}

// ── Pump Power Quick ──
const STD_MOTORS=[0.18,0.25,0.37,0.55,0.75,1.1,1.5,2.2,3,4,5.5,7.5,11,15,18.5,22,30,37,45,55,75,90,110,132,160,200,250,315,400,500];
function calcPumpPowerQuick() {
  const unit=document.getElementById('pp-flow-unit')?.value||'gpm';
  const flowRaw=(rv('pp-flow'));
  const toM3s={gpm:flowRaw*6.309e-5,ls:flowRaw/1000,m3h:flowRaw/3600}[unit]||flowRaw*6.309e-5;
  const H=(rv('pp-head'));
  const eff=((rv('pp-eff')))/100;
  const rho=+document.getElementById('pp-fluid')?.value||998;
  const hydroW=rho*9.81*toM3s*H;
  const shaftKW=hydroW/eff/1000;
  const stdMotor=STD_MOTORS.find(m=>m>=shaftKW)||STD_MOTORS[STD_MOTORS.length-1];
  s('pp-r-hydro',(hydroW/1000).toFixed(2)+' kW');
  s('pp-r-shaft',shaftKW.toFixed(2)+' kW');
  s('pp-r-motor',stdMotor+' kW (standard motor size)');
  s('pp-r-hp',(stdMotor*1.341).toFixed(1)+' HP');
  try{renderPumpPowerQuickChart(hydroW,shaftKW,motorKW,eff);}catch(_e){}
}

// ── Site Tools ──
function calcSiteTools() {
  // Pump head from height
  const h=+document.getElementById('st-height')?.value||20;
  const fric=1+(+document.getElementById('st-fric')?.value||20)/100;
  s('st-r-head',(h*fric).toFixed(1)+' m w.g. ('+(h*fric*3.281).toFixed(0)+' ft)');
  // Tank fill time
  const vol=+document.getElementById('st-tank-vol')?.value||10000;
  const rate=+document.getElementById('st-fill-rate')?.value||200;
  const fillMin=rate>0?vol/rate:0;
  s('st-r-fill',fillMin.toFixed(0)+' min ('+(fillMin/60).toFixed(1)+' hrs)');
  // Generator fuel
  const kva=+document.getElementById('st-gen-kva')?.value||200;
  const loadPct=(+document.getElementById('st-gen-load')?.value||75)/100;
  const hrs=+document.getElementById('st-gen-hrs')?.value||8;
  const fuelLph=kva*loadPct*0.2; // approx 0.2 L/kVA/hr at full load
  s('st-r-fuel',(fuelLph*hrs).toFixed(0)+' L diesel ('+(fuelLph).toFixed(1)+' L/hr)');
  // Quick lighting count
  const area=+document.getElementById('st-ltg-area')?.value||100;
  const lux=+document.getElementById('st-ltg-lux')?.value||500;
  const lm=+document.getElementById('st-ltg-lm')?.value||4000;
  const n=Math.ceil((lux*area)/(lm*0.6*0.75));
  s('st-r-ltg',n+' fittings (UF=0.6, MF=0.75)');
  // Cable/pipe length with waste
  const net=+document.getElementById('st-len-net')?.value||80;
  const waste=1+(+document.getElementById('st-len-waste')?.value||15)/100;
  s('st-r-len',(net*waste).toFixed(0)+' m (order '+Math.ceil(net*waste)+' m)');
}

// Patch pageToSection and routes for new tools
Object.assign(pageToSection,{
  'tool-design-check':'tools','tool-elec-quick':'tools','tool-power-triangle':'tools',
  'tool-selector-elec':'tools','tool-flow-velocity':'tools','tool-pipe-weight':'tools',
  'tool-pump-power':'tools','tool-selector-mep':'tools','tool-pipe-material':'tools',
  'tool-site':'tools',
});

// ══════════════════════════════════════════════════════
// DETAILED CALCULATIONS - UTILITY & HVAC MODULE
// ══════════════════════════════════════════════════════



// ── Core utility: inject Detailed Calcs + Assumptions into any result div ──
function addCalcDetails(resId, steps, assumptions){
  // Defer DOM reads to next tick so calc function has already written results
  if(typeof steps === 'function'){
    const stepsFactory=steps;
    const _assumptions=assumptions;
    setTimeout(()=>_addCalcDetailsImpl(resId, stepsFactory(), _assumptions), 0);
    return;
  }
  _addCalcDetailsImpl(resId, steps, assumptions);
}
function _addCalcDetailsImpl(resId, steps, assumptions){
  const container=document.getElementById(resId);
  if(!container)return;
  // Remove previous detail sections to avoid duplication on recalc
  container.querySelectorAll('.detail-inject').forEach(e=>e.remove());

  // ─ Detailed Calculations ─
  if(steps&&steps.length){
    const sid=resId+'-steps';
    const stepsEl=document.createElement('div');
    stepsEl.className='detail-inject scard';
    stepsEl.style.cssText='margin-top:4px';
    stepsEl.innerHTML=`
      <div class="assump-toggle" onclick="toggleExpand('${sid}')">
        <div class="expand-title"><span style="font-size:12px">Σ</span> DETAILED CALCULATIONS</div>
        <span id="${sid}-arrow" style="font-size:11px">▼</span>
      </div>
      <div id="${sid}" style="display:none">
        <div class="expand-body" style="padding-top:4px">
          ${steps.map((st,i)=>`
          <div class="formula-step" style="display:grid;grid-template-columns:22px 1fr;gap:10px;align-items:start;margin-bottom:8px">
            <div class="fs-num">${i+1}</div>
            <div>
              <div class="fs-label">${st.label}</div>
              ${st.formula?`<div class="fs-expr" style="margin:3px 0">${st.formula}</div>`:''}
              ${st.sub?`<div class="fs-expr fs-sub" style="font-size:10.5px;margin-bottom:3px">${st.sub}</div>`:''}
              ${st.result?`<div class="fs-result">${st.result}</div>`:''}
            </div>
          </div>`).join('')}
        </div>
      </div>`;
    container.appendChild(stepsEl);
  }

  // ─ Assumptions & Basis ─
  if(assumptions&&assumptions.length){
    const aid=resId+'-assump';

    // Auto-extract standard references from all assumption strings
    const stdPattern=/\b(ASHRAE\s+[\w\.\-]+|IEC\s+[\w\-:]+|NFPA\s+[\w\.\-]+|BS\s+[\w\s\-:]+?(?=[\s,;]|$)|ISO\s+[\w\-:]+|NEC\s+(?:Art(?:icle)?\.?\s*)?\w+|IPC\s+[\w\.\-]+|SMACNA|CIBSE\s*[\w\s\.]*|IEEE\s+[\w\-]+|HTM\s+[\w\-]+|EN\s+[\w\-:]+|IES\s+[\w\-]*|AWWA\s+[\w\-]+|ASTM\s+[\w\-]+|HI\s+[\w\.\-]+|CTI\s+[\w\-]+|UL\s+[\w\-]+|FM\s+[\w\-]+|ATCC?|WHO|USGBC|LEED|IEEE\s+\d+)/gi;
    const found=new Set();
    assumptions.forEach(a=>{
      const m=a.match(stdPattern);
      if(m) m.forEach(s=>found.add(s.trim().replace(/\s+/g,' ')));
    });
    const refs=[...found];

    // Colour map for standard families
    function refColor(r){
      if(/^ASHRAE/i.test(r)) return{bg:'#E8F4FD',border:'#2980B9',text:'#1A5276'};
      if(/^IEC/i.test(r))    return{bg:'#EAF4FB',border:'#1A8CE8',text:'#154F8A'};
      if(/^NFPA/i.test(r))   return{bg:'#FDEDEC',border:'#ce6637',text:'#7B241C'};
      if(/^BS |^BS\d/i.test(r)||/^EN /i.test(r)) return{bg:'#F5EEF8',border:'#8E44AD',text:'#5B2C6F'};
      if(/^ISO/i.test(r))    return{bg:'#E8F6F3',border:'#1ABC9C',text:'#0E6655'};
      if(/^NEC/i.test(r))    return{bg:'#FEF9E7',border:'#D4AC0D',text:'#7D6608'};
      if(/^IPC/i.test(r))    return{bg:'#E8F8F5',border:'#17A589',text:'#0E6655'};
      if(/^IEEE/i.test(r))   return{bg:'#EBF5FB',border:'#2E86C1',text:'#1B4F72'};
      if(/^SMACNA/i.test(r)) return{bg:'#F0F3F4',border:'#626567',text:'#2C3E50'};
      if(/^CIBSE/i.test(r))  return{bg:'#F9EBEA',border:'#B03A2E',text:'#78281F'};
      if(/^IES/i.test(r))    return{bg:'#FEF5E7',border:'#CA6F1E',text:'#784212'};
      if(/^HTM/i.test(r))    return{bg:'#F4ECF7',border:'#7D3C98',text:'#4A235A'};
      if(/^ASTM/i.test(r))   return{bg:'#E9F7EF',border:'#27AE60',text:'#1D6A38'};
      if(/^HI /i.test(r))    return{bg:'#EAF2FF',border:'#3498DB',text:'#1A5276'};
      return{bg:'#F2F3F4',border:'#7F8C8D',text:'#2C3E50'};
    }

    const badgesHTML = refs.length ? `
      <div style="display:flex;flex-wrap:wrap;gap:5px;padding:10px 16px 2px">
        ${refs.map(r=>{const c=refColor(r);return`<span style="font-size:10px;font-weight:700;padding:3px 8px;border-radius:4px;background:${c.bg};border:1px solid ${c.border};color:${c.text};letter-spacing:0.3px;white-space:nowrap">${r}</span>`;}).join('')}
      </div>` : '';

    const assumpEl=document.createElement('div');
    assumpEl.className='detail-inject scard';
    assumpEl.style.cssText='margin-top:4px';
    assumpEl.innerHTML=`
      <div class="assump-toggle" onclick="toggleExpand('${aid}')">
        <div class="expand-title"><span style="font-size:12px">ℹ</span> ASSUMPTIONS & BASIS</div>
        <span id="${aid}-arrow" style="font-size:11px">▼</span>
      </div>
      <div id="${aid}" style="display:none">
        ${badgesHTML}
        <div class="assump-body" style="padding-top:${refs.length?'8':'0'}px">
          ${assumptions.map(a=>{
            // Highlight standard references inline within text
            const highlighted=a.replace(stdPattern,m=>`<strong style="color:var(--brand)">${m}</strong>`);
            return`<div class="assump-item"><span class="assump-bullet">•</span><span>${highlighted}</span></div>`;
          }).join('')}
        </div>
      </div>`;
    container.appendChild(assumpEl);
  }
}


// ── Additional chart renderers ──

function renderDuctChart(vFpm, vMax, vMin, shape, dia, ww, hh, ip){
  const W=540, H=72, PL=10, PR=10, PT=32;
  const CW=W-PL-PR, barH=22;
  const scaleMax=Math.max(vMax*1.2,vFpm*1.15)||1;
  const pV=Math.min(vFpm/scaleMax,1)*CW;
  const pMin=vMin/scaleMax*CW, pMax=vMax/scaleMax*CW;
  const fc=vFpm>vMax?'#f78f22':vFpm<vMin?'#F59E0B':'#d17914';
  const u=ip?'FPM':'m/s';
  const svg=`<svg viewBox="0 0 ${W} ${H}" xmlns="http://www.w3.org/2000/svg" style="width:100%;height:auto;display:block">
  <text x="${PL}" y="20" font-size="10" font-weight="700" fill="var(--muted)" font-family="var(--font)" letter-spacing="0.5">DUCT VELOCITY vs SMACNA LIMITS (${u})</text>
  <rect x="${PL}" y="${PT}" width="${CW}" height="${barH}" fill="var(--border)" rx="4" opacity="0.3"/>
  <rect x="${(PL+pMin).toFixed(1)}" y="${PT}" width="${(pMax-pMin).toFixed(1)}" height="${barH}" fill="#d17914" opacity="0.15" rx="2"/>
  <rect x="${PL}" y="${PT}" width="${Math.max(4,pV).toFixed(1)}" height="${barH}" fill="${fc}" rx="4" opacity="0.88"/>
  <line x1="${(PL+pMin).toFixed(1)}" y1="${PT-3}" x2="${(PL+pMin).toFixed(1)}" y2="${PT+barH+8}" stroke="#d17914" stroke-width="1.5" stroke-dasharray="3,2"/>
  <line x1="${(PL+pMax).toFixed(1)}" y1="${PT-3}" x2="${(PL+pMax).toFixed(1)}" y2="${PT+barH+8}" stroke="#f78f22" stroke-width="1.5" stroke-dasharray="3,2"/>
  <text x="${(PL+pMin).toFixed(1)}" y="${PT+barH+16}" text-anchor="middle" font-size="9" fill="#d17914" font-family="var(--font)" font-weight="600">Min ${vMin.toFixed(0)}</text>
  <text x="${(PL+pMax).toFixed(1)}" y="${PT+barH+16}" text-anchor="middle" font-size="9" fill="#f78f22" font-family="var(--font)" font-weight="600">Max ${vMax.toFixed(0)}</text>
  <text x="${Math.min(Math.max(PL+30,PL+pV-20),W-80)}" y="${(PT+barH/2+4).toFixed(1)}" font-size="11" font-weight="800" fill="#fff" font-family="var(--font)">${vFpm.toFixed(0)} ${u}</text>
  </svg>`;
  showChart('duct-chart',`<div class="chart-wrap" style="padding:10px 14px 14px">${svg}</div>`);
}

function renderHvacPipeChart(vel, vMax, flow, dia, ip){
  const u=ip?'fps':'m/s', flowU=ip?'GPM':'L/s';
  showChart('hvac-pipe-chart',`<p class="chart-title">Pipe Velocity & Sizing</p><div class="chart-wrap">${
    barSVG([
      {label:'Velocity', value:vel, color:vel>vMax?'#f78f22':'#d17914', unit:' '+u},
      {label:'Max Allow', value:vMax, color:'#64748B', unit:' '+u},
      {label:'Flow Rate', value:flow, color:'#cf6610', unit:' '+flowU},
    ],{height:160})
  }</div>`);
}

function renderVentChart(cfm, ach, oaFrac, ip){
  const u=ip?'CFM':'L/s';
  const W=540, H=72, PL=10, PR=10, PT=32, barH=22;
  const CW=W-PL-PR;
  const targets=[{v:0.1,label:'Min 10%',color:'#F59E0B'},{v:0.25,label:'Typical 25%',color:'#d17914'},{v:0.5,label:'High 50%',color:'#cf6610'}];
  const pV=Math.min(oaFrac,1)*CW;
  const fc=oaFrac<0.1?'#f78f22':oaFrac<0.15?'#F59E0B':'#d17914';
  const targetLines=targets.map(t=>{
    const x=(PL+t.v*CW).toFixed(1);
    return `<line x1="${x}" y1="${PT-3}" x2="${x}" y2="${PT+barH+8}" stroke="${t.color}" stroke-width="1.5" stroke-dasharray="3,2"/>
<text x="${x}" y="${PT+barH+16}" text-anchor="middle" font-size="8.5" fill="${t.color}" font-family="var(--font)">${t.label}</text>`;
  }).join('');
  const svg=`<svg viewBox="0 0 ${W} ${H}" xmlns="http://www.w3.org/2000/svg" style="width:100%;height:auto;display:block">
  <text x="${PL}" y="20" font-size="10" font-weight="700" fill="var(--muted)" font-family="var(--font)" letter-spacing="0.5">OUTSIDE AIR FRACTION (ASHRAE 62.1)</text>
  <rect x="${PL}" y="${PT}" width="${CW}" height="${barH}" fill="var(--border)" rx="4" opacity="0.3"/>
  <rect x="${PL}" y="${PT}" width="${Math.max(4,pV).toFixed(1)}" height="${barH}" fill="${fc}" rx="4" opacity="0.88"/>
  ${targetLines}
  <text x="${Math.min(PL+40,PL+pV-10)}" y="${(PT+barH/2+4).toFixed(1)}" font-size="11" font-weight="800" fill="#fff" font-family="var(--font)">${(oaFrac*100).toFixed(0)}%</text>
  </svg>`;
  showChart('vent-chart',`<div class="chart-wrap" style="padding:10px 14px 14px">${svg}</div>`);
}

function renderHazenChart(flow, vel, hlPer100, dia, ip){
  const u=ip?'fps':'m/s', pU=ip?'psi/100ft':'m/100m';
  showChart('hazen-chart',`<p class="chart-title">Flow & Hydraulics Summary</p><div class="chart-wrap">${
    barSVG([
      {label:'Velocity', value:vel, color:vel>8?'#f78f22':vel>6?'#F59E0B':'#d17914', unit:' '+u},
      {label:'Max 8 '+u, value:8, color:'#94A3B8', unit:''},
      {label:'Head Loss', value:hlPer100, color:'#7C3AED', unit:' '+pU},
    ],{height:155})
  }</div>`);
}

function renderElecLoadChart(total, lighting, power, hvac, other){
  const items=[
    {label:'Lighting', value:lighting, color:'#F59E0B', display:lighting.toFixed(0)+'kW'},
    {label:'Power', value:power, color:'#cf6610', display:power.toFixed(0)+'kW'},
    {label:'HVAC', value:hvac, color:'#7C3AED', display:hvac.toFixed(0)+'kW'},
    {label:'Other', value:other, color:'#64748B', display:other.toFixed(0)+'kW'},
  ].filter(i=>i.value>0);
  showChart('load-chart',`<p class="chart-title">Load Distribution · Total ${total.toFixed(0)} kW</p><div class="chart-wrap">${hBarSVG(items)}</div>`);
}

function renderPFCChart(pfBefore, pfAfter, kvar){
  showChart('pfc-chart',`<p class="chart-title">Power Factor Improvement</p><div class="chart-wrap">${
    barSVG([
      {label:'PF Before', value:pfBefore*100, color:'#f78f22', unit:'%'},
      {label:'PF After', value:pfAfter*100, color:'#d17914', unit:'%'},
      {label:'Target', value:95, color:'#94A3B8', unit:'%'},
    ],{height:155,maxVal:100})
  }<div style="margin-top:6px;font-size:11.5px;font-family:var(--font);color:var(--text)">Capacitor bank required: <strong style="color:#d17914">${kvar.toFixed(1)} kVAR</strong></div></div>`);
}

function renderLightingChart(lux, target, n, watts){
  const devPct=Math.abs(lux-target)/target*100;
  const fc=devPct<5?'#d17914':devPct<15?'#F59E0B':'#f78f22';
  showChart('lighting-chart',`<p class="chart-title">Lighting Design Summary</p><div class="chart-wrap">${
    barSVG([
      {label:'Achieved lux', value:lux, color:fc, unit:' lux'},
      {label:'Target lux', value:target, color:'#94A3B8', unit:' lux'},
    ],{height:145,maxVal:Math.max(lux,target)*1.3})
  }<div style="margin-top:6px;font-size:11.5px;font-family:var(--font);color:var(--text)">${n} luminaires · <strong>${watts.toFixed(0)} W</strong> total · Deviation: <strong style="color:${fc}">${devPct.toFixed(1)}%</strong></div></div>`);
}

function renderBoosterChart(flow, headPump, headReq, kw, ip){
  const u=ip?'ft':'m', flowU=ip?'GPM':'L/s';
  showChart('booster-chart',`<p class="chart-title">Booster Pump Performance</p><div class="chart-wrap">${
    barSVG([
      {label:'Flow', value:flow, color:'#cf6610', unit:' '+flowU},
      {label:'Pump Head', value:headPump, color:'#d17914', unit:' '+u},
      {label:'Sub-total', value:headReq, color:'#d17914', unit:' '+u},
    ],{height:155})
  }<div style="margin-top:6px;font-size:11.5px;font-family:var(--font);color:var(--text)">Motor power: <strong style="color:#D97706">${kw.toFixed(2)} kW</strong></div></div>`);
}

function renderCableSizingChart(iz, ib, loadPct){
  showChart('cable-chart',`<p class="chart-title">Cable Ampacity vs Design Current</p><div class="chart-wrap">${
    barSVG([
      {label:'Cable Iz', value:iz, color:'#d17914', unit:'A'},
      {label:'Design Ib', value:ib, color:loadPct>100?'#f78f22':loadPct>80?'#F59E0B':'#cf6610', unit:'A'},
    ],{height:145,maxVal:Math.max(iz,ib)*1.3})
  }<div style="margin-top:6px;font-size:11.5px;font-family:var(--font);color:var(--text)">Cable utilisation: <strong style="color:${loadPct>100?'#f78f22':loadPct>80?'#F59E0B':'#d17914'}">${loadPct.toFixed(0)}%</strong></div></div>`);
}

function renderTankChart(vol, reqVol, supplyHrs){
  const pct=reqVol>0?Math.min(vol/reqVol*100,150):100;
  showChart('tank-chart',`<p class="chart-title">Tank Capacity vs Requirement</p><div class="chart-wrap">${
    gaugeSVG(Math.min(pct,100),{label:'Capacity Met',color:'#d17914',warning:100,danger:130,size:180,title:'Tank'})
  }<div style="margin-top:8px;text-align:center;font-size:11.5px;font-family:var(--font);color:var(--muted)">Provided: <strong style="color:var(--text)">${vol.toFixed(0)} L</strong> · Required: <strong style="color:var(--text)">${reqVol.toFixed(0)} L</strong> · Autonomy: <strong style="color:#d17914">${supplyHrs.toFixed(1)} hr</strong></div></div>`);
}


// ── Helper: safe read from element
// rv() = required value - returns NaN if field is empty, parsed number if filled
_rvNaN=false; // tracks if any required input was empty during current calc
function rv(id){
  const el=document.getElementById(id);
  if(!el){_rvNaN=true;return NaN;}
  const v=el.value.trim();
  if(v===''||v===null||v===undefined){_rvNaN=true;return NaN;}
  const n=parseFloat(v);
  if(isNaN(n)) _rvNaN=true;
  return n;
}
function rvi(id){
  const el=document.getElementById(id);
  if(!el){_rvNaN=true;return NaN;}
  const v=el.value.trim();
  if(v===''||v===null||v===undefined){_rvNaN=true;return NaN;}
  const n=parseInt(v);
  if(isNaN(n)) _rvNaN=true;
  return n;
}
// Call at top of each calc: returns true if OK, shows error and returns false if missing inputs
function _checkInputs(warnAreaId){
  if(!_rvNaN) return true;
  const wa=warnAreaId?document.getElementById(warnAreaId):null;
  if(wa) wa.innerHTML='<div class="warn-card amber"><div class="warn-head amber">⚠ Missing Inputs</div><div class="warn-item"><span>•</span><span>Please fill in all required fields before calculating.</span></div></div>';
  return false;
}
function gv2(id){const el=document.getElementById(id);return el?el.value:'-';}
function gv(id){const e=document.getElementById(id);return e?e.value||e.textContent:'-';}
function gt(id){const e=document.getElementById(id);return e?e.textContent:'-';}

// ══════════════════════════════════════════════════════
// HVAC - DETAILED CALCS WRAPPERS (all 26 calculators)
// ══════════════════════════════════════════════════════

window.initCalcDetails = function() {

// 1. PSYCHROMETRIC
const _origCalcPsych=calcPsych;
calcPsych=function(){
  _origCalcPsych.apply(this,arguments);
  const ip=currentUnit==='ip';
  const tdb=gv2('p-dbt'), rh=gv2('p-param'), p=ip?'14.696 psi':'101.325 kPa';
  addCalcDetails('psych-res',()=>[
    {label:'Saturation pressure (Magnus approximation)',formula:'Pws = 0.61078 × exp(17.27×T / (T+237.3)) [kPa]',sub:`At T = ${tdb}°${ip?'F':'C'}`,result:gt('pr-pv')},
    {label:'Humidity ratio W',formula:'W = 0.621945 × Pws×φ / (P − Pws×φ)',sub:`φ = ${rh}% RH, P = ${p}`,result:gt('pr-w')},
    {label:'Enthalpy h',formula:'h = 1.006×T + W×(2501 + 1.86×T) [kJ/kg] → BTU/lb',result:gt('pr-h')},
    {label:'Dew point temperature',formula:'Tdp from inverse of Magnus formula at W',result:gt('pr-dp')},
  ],[
    'Standard atmospheric pressure assumed at site elevation - ASHRAE Fundamentals 2021 Ch.1',
    'Magnus equation - ASHRAE Fundamentals 2021 Ch.1 Eq. 6 (Hyland-Wexler)',
    'Valid for T = −60°C to 200°C',
    'Wet bulb approximated from enthalpy/W relationship - iterative Sprung equation not used',
  ]);
};

// 2. DUCT SIZER
const _origCalcDuct=calcDuct;
calcDuct=function(){
  _origCalcDuct.apply(this,arguments);
  const ip=currentUnit==='ip';
  addCalcDetails('duct-res',()=>[
    {label:'Convert flow to m³/s',formula:'Q [m³/s] = CFM × 4.719×10⁻⁴  (or L/s ÷ 1000)',sub:`Input: ${gv2('d-flow')} ${ip?'CFM':'L/s'}`},
    {label:'Duct cross-section area from target velocity',formula:'A = Q / V',sub:`V = target velocity → A [m²]`,result:gt('ds-r-diam')},
    {label:'Round duct diameter',formula:'D = √(4A/π)',result:gt('ds-r-diam')},
    {label:'Equivalent rectangular dimensions',formula:'Width × Height from aspect ratio; Deq = 1.30×(a×b)⁰·⁶²⁵/(a+b)⁰·²⁵',result:gt('ds-r-diam')},
    {label:'Friction rate (Darcy-Weisbach)',formula:'ΔP/L = f×(ρV²/2D) - smooth duct Cf ≈ 0.9',result:gt('ds-r-diam')},
  ],[
    'Standard air: ρ = 1.2 kg/m³ at 20°C, 101.3 kPa',
    'SMACNA HVAC Duct Design Manual 4th Ed. - equal friction method, 0.08 in w.g./100 ft starting rate',
    'Duct assumed internally insulated with C = 0.9 (smooth)',
    'Rectangular equivalent diameter per Huebscher (1948) - ASHRAE Fundamentals 2021 Ch.21 Eq. 57',
  ]);
};

// 3. PUMP HEAD
const _origCalcPump=calcPump;
calcPump=function(){
  _origCalcPump.apply(this,arguments);
  const ip=currentUnit==='ip';
  addCalcDetails('pump-res',()=>[
    {label:'Static head (elevation)',formula:'H_static = height difference between source and highest point',sub:`= ${gv2('ph-static')} ${ip?'ft':'m'}`,result:gv2('ph-static')+' '+(ip?'ft':'m')},
    {label:'Pipe friction loss (Darcy-Weisbach)',formula:'H_f = f × L/D × V²/2g',result:gt('pump-fit')},
    {label:'Fitting losses (% of pipe friction)',formula:'H_fit = H_f × fitting_factor / 100',result:gt('pump-sub')},
    {label:'Equipment pressure drops',formula:'H_eq = Σ(coil + valve + hx + meter ΔP) in ft w.g.',result:gt('pump-eq')},
    {label:'Total system head & pump duty',formula:'H_total = H_static + H_f + H_fit + H_eq',result:gt('pump-tot')},
  ],[
    'Water properties at operating temperature from ASHRAE Fundamentals 2021 Ch.33',
    'Fitting loss factor 20–40% of pipe friction (depends on selection)',
    'Safety margin applied per user input (typically 10% on head)',
    'Friction factor f from Colebrook-White equation - ASHRAE Fundamentals 2021 Ch.22',
    'Does not include pump inertia or surge pressure - steady state only',
  ]);
};

// 4. HVAC PIPE SIZER
const _origCalcHvacPipe=calcHvacPipe;
calcHvacPipe=function(){
  _origCalcHvacPipe.apply(this,arguments);
  const ip=currentUnit==='ip';
  addCalcDetails('hvac-pipe-res',()=>[
    {label:'Flow rate from load and temperature difference',formula:'Q [L/s] = kW / (cp × ρ × ΔT)  →  for water: Q ≈ Load / (4.18 × ΔT)',sub:`Load = ${gv2('hp-dp')} kW, ΔT = ${gv2('hp-temp')} ${ip?'°F':'°C'}`},
    {label:'Select pipe size - check velocity',formula:'V = Q / A  where A = π×D²/4',sub:'Target: 1.5–3 m/s (CHW), 2–4 m/s (CW)',result:gt('hp-vel')},
    {label:'Friction loss (Darcy-Weisbach)',formula:'ΔP/m = f/D × ρ×V²/2',sub:'f from Moody chart; smooth black steel assumed',result:gt('hp-dp-res')},
  ],[
    'Specific heat cp = 4.18 kJ/kg·K for water',
    'Density ρ = 998 kg/m³ at 20°C',
    'Black steel pipe, Schedule 40 assumed',
    'ASHRAE Handbook HVAC Systems & Equipment 2020 - CHW velocity limits',
    'Glycol mix will reduce flow and increase friction - add 15–20% correction',
  ]);
};

// 5. VENTILATION + ACH (redesigned)
// Removed because calcVent is now ventPreview/ventAddFromForm and does not have a single result panel.

// 6. HEAT LOAD (COOLING)
const _origCalcHeatLoad=calcHeatLoad;
calcHeatLoad=function(){
  _origCalcHeatLoad.apply(this,arguments);
  const ip=currentUnit==='ip';
  addCalcDetails('hl-res',()=>[
    {label:'Envelope sensible gain: walls, roof, glazing',formula:'Q_env = U × A × CLTD  (simplified: U × A × ΔT)',sub:`U-wall = ${gv2('hl-uval')}, Area from ${gv2('hl-area')} ${ip?'ft²':'m²`'}`,result:gt('hl-cond')},
    {label:'Infiltration sensible gain',formula:'Q_inf = 1.1 × CFM_inf × ΔT  (IP)  or  1.2 × m³/s × ΔT × 1000 (SI)',result:gt('hl-sens-tot')},
    {label:'Occupant sensible + latent heat gain',formula:'Q_occ = N × (sensible/person) + N × (latent/person)',sub:`N = ${gv2('hl-occ')} people`,result:gt('hl-ppl-s')},
    {label:'Lighting and equipment gain',formula:'Q_ltg = W × CLF  (CLF = 1.0 for 24hr operation)',result:gt('hl-ltg-res')},
    {label:'Total cooling load → TR',formula:'TR = Q_total / 12,000  (BTU/hr)  or  kW / 3.517',result:gt('hl-tons')},
  ],[
    'ASHRAE CLTD/CLF method - ASHRAE Fundamentals 2021 Ch.18 (simplified)',
    'CLTD simplified as design ΔT (outdoor - indoor); peak conditions assumed',
    'Occupant heat gain: ASHRAE Fundamentals 2021 Ch.18 Table 1 (office sedentary: 250/200 BTU/hr)',
    'Solar gain through glazing not separately modelled; use SHGC factor if significant',
    'Safety factor applied: multiply total by 1.1–1.2 for preliminary sizing',
  ]);
};

// 7. EXTERNAL STATIC PRESSURE
const _origCalcESP=calcESP;
calcESP=function(){
  _origCalcESP.apply(this,arguments);
  addCalcDetails('esp-res',()=>[
    {label:'Supply duct friction losses',formula:'ΔP_supply = FR × L_supply  (FR = friction rate, L = equiv length)',result:gt('esp-sup-tot')},
    {label:'Return duct friction losses',formula:'ΔP_return = FR × L_return',result:gt('esp-ret-tot')},
    {label:'Coil + filter + terminal pressure drops',formula:'ΔP_eq = Σ(coil ΔP + filter ΔP + VAV/terminal ΔP)',result:gt('esp-int-dirty')},
    {label:'Total ESP (static pressure rise required at fan)',formula:'ESP = ΔP_supply + ΔP_return + ΔP_eq',result:gt('esp-tot-dirty')},
    {label:'Fan selection duty',formula:'At design CFM and ESP → select fan from manufacturer curve',result:gt('esp-tot-clean')},
  ],[
    'Equal friction method assumed for duct loss calculation',
    'Cooling coil ΔP typically 0.5–1.5 in w.g. (125–375 Pa)',
    'MERV-8 filter ΔP typically 0.25–0.5 in w.g. clean; design for dirty condition (0.5 in w.g.)',
    'VAV terminal box ΔP typically 0.1–0.3 in w.g.',
    'Safety factor 10–15% applied on total ESP for fan curve margin',
  ]);
};

// 8. DIFFUSER SELECTOR
// 8. DIFFUSER SELECTOR (UPDATED FOR LOOKUP-BASED LOGIC)

const _origCalcDiffuser = calcDiffuser;

calcDiffuser = function () {
  // ▶ Run main calculation first
  _origCalcDiffuser.apply(this, arguments);

  // ▶ Add explanation details below results
  addCalcDetails(
    'df-res',
    () => [
      {
        label: 'Flow per diffuser',
        // Simple formula kids can understand
        formula: 'q_d = Q_total ÷ N_diffusers',
        sub: `Q = ${gv2('df-flow')} , N = ${gv2('df-count')}`,
        result: gt('df-per')
      },

      {
        label: 'Diffuser selection logic',
        // THIS IS THE IMPORTANT CHANGE ✅
        formula: 'Select smallest diffuser where q_d ≤ Max Rated Flow (from table)',
        sub: 'Selection based on lookup table (Excel data)',
        result: gt('df-neck')
      },

      {
        label: 'Face velocity',
        // Now comes from USER selection, not calculation
        formula: 'V_face = Selected design velocity',
        sub: `Chosen from dropdown (${document.getElementById('df-vt-unit').textContent})`,
        result: gt('df-fv')
      },

      {
        label: 'Throw distance (T50)',
        // Now from table, not formula
        formula: 'Throw = Value from manufacturer data table',
        sub: 'Based on selected diffuser size and airflow',
        result: gt('df-throw')
      },

      {
        label: 'Noise Criteria (NC)',
        formula: 'NC = Value from manufacturer data table',
        sub: 'Depends on airflow and diffuser size',
        result: gt('df-nc')
      },

      {
        label: 'ADPI suitability',
        formula: 'Comfort check based on velocity range (300–600 FPM typical)',
        sub: 'Ensures proper air distribution and comfort',
        result: gt('df-adpi')
      }
    ],

    // 📚 ENGINEERING NOTES (UPDATED)
    [
      'Selection is based on lookup table derived from manufacturer catalogues',
      'Smallest diffuser satisfying airflow is selected (efficient design practice)',
      'Face velocity typically maintained between 300–600 FPM for comfort',
      'Throw values correspond to T50 (terminal velocity = 50 FPM)',
      'Final selection should always be verified using manufacturer software (Titus, Price, Krueger)',
      'Noise levels (NC) are indicative and depend on installation conditions'
    ]
  );
};


// 9. AIRFLOW CALCULATOR
const _origCalcAirflow=calcAirflow;
calcAirflow=function(){
  _origCalcAirflow.apply(this,arguments);
  addCalcDetails('af-res',()=>[
    {label:'Convert area and velocity to flow',formula:'Q = A × V  where A = W × H (rectangular) or π×D²/4 (round)',sub:`Input: ${gv2('af-q')} × ${gv2('af-dt')} mm, V = ${gv2('af-tsup')} m/s`},
    {label:'Unit conversion CFM ↔ L/s ↔ m³/h',formula:'1 CFM = 0.4719 L/s = 1.699 m³/h',result:gt('af-q')+' CFM'+' / '+gt('af-dt')},
  ],[
    'Assumes uniform velocity across the duct cross-section',
    'For actual duct measurement: traverse using Pitot tube (ASHRAE 111-2008)',
    'Grille/diffuser face velocity ≠ duct velocity - account for neck-to-face area ratio',
  ]);
};

// 10. COOLING COIL
const _origCalcCoil=calcCoil;
calcCoil=function(){
  _origCalcCoil.apply(this,arguments);
  const ip=currentUnit==='ip';
  addCalcDetails('cc-res',()=>[
    {label:'Mass flow rate of air',formula:'ṁ_air = Q × ρ_air  (ρ = 1.2 kg/m³ standard)',sub:`Q = ${gv2('cc-cfm')} ${ip?'CFM':'L/s'}`},
    {label:'Sensible heat removal',formula:'Q_s = ṁ_air × cp_air × (T_in − T_out)',sub:`ΔT = ${gv2('cc-edb')} − ${gv2('cc-ldb')} = ${(parseFloat(gv2('cc-edb'))-parseFloat(gv2('cc-ldb'))).toFixed(1)}°`,result:gt('cc-r-sens')},
    {label:'Latent heat removal',formula:'Q_l = ṁ_air × h_fg × (W_in − W_out)  (h_fg ≈ 2501 kJ/kg)',result:gt('cc-r-lat')},
    {label:'Chilled water duty (total coil load)',formula:'Q_total = Q_s + Q_l',result:gt('cc-r-total')},
    {label:'CHW flow required',formula:'Q_water = Q_total / (cp × ρ × ΔT_chw)  = Q_total / (4.18 × ΔT)',result:gt('cc-r-tr')},
  ],[
    'Standard air cp = 1.006 kJ/kg·K; ρ = 1.2 kg/m³',
    'Latent heat of vapourisation h_fg = 2501 kJ/kg at 0°C (2430 kJ/kg at 45°C)',
    'CHW supply/return temperature difference assumed 6°C (10°F) unless specified',
    'Coil bypass factor not modelled - use 5–8% bypass for typical coils',
    'Sensible heat ratio SHR = Q_s / Q_total',
  ]);
};

// 11. FAN POWER
const _origCalcFanPower=calcFanPower;
calcFanPower=function(){
  _origCalcFanPower.apply(this,arguments);
  const ip=currentUnit==='ip';
  addCalcDetails('fp2-res',()=>[
    {label:'Air power (theoretical minimum)',formula:'P_air = Q × ΔP_total  [m³/s × Pa = W]',sub:`Q = ${gv2('fp2-q')} ${ip?'CFM':'L/s'}, ΔP = ${gv2('fp2-esp')} ${ip?'in w.g.':'Pa'}`,result:gt('fp2-r-air')},
    {label:'Shaft power (actual to impeller)',formula:'P_shaft = P_air / η_fan',sub:`η_fan = ${gv2('fp2-fan-eff')}%`,result:gt('fp2-r-shaft')},
    {label:'Motor input power',formula:'P_motor = P_shaft / η_motor',sub:`η_motor = ${gv2('fp2-mot-eff')}%`,result:gt('fp2-r-motor')},
    {label:'Specific fan power (SFP)',formula:'SFP = P_motor / Q  [W per L/s]  target < 2 W/L/s',result:gt('fp2-r-overall')},
  ],[
    'AMCA 210-16 - Laboratory Methods of Testing Fans for Certified Aerodynamic Performance Rating',
    'Motor efficiency η_motor: IE2 ≈ 91%, IE3 ≈ 93% at full load',
    'ASHRAE 90.1-2022 Section 6.5.3 - fan system power limitations (SFP metric)',
    'Does not account for belt drive losses (add 5–8% if belt drive)',
  ]);
};

// 12. FAN LAWS
const _origCalcFanLaws=calcFanLaws;
calcFanLaws=function(){
  _origCalcFanLaws.apply(this,arguments);
  addCalcDetails('fl-res',()=>[
    {label:'New flow rate (Fan Law 1)',formula:'Q₂ = Q₁ × (N₂/N₁)',sub:`N₁ = ${gv2('fl-q1')} rpm → N₂ = ${(parseFloat(gv2('fl-q1'))*(parseFloat(gv2('fl-speed'))/100)).toFixed(0)} rpm`,result:gt('fl-r-q2')},
    {label:'New static pressure (Fan Law 2)',formula:'ΔP₂ = ΔP₁ × (N₂/N₁)²',result:gt('fl-r-p2')},
    {label:'New shaft power (Fan Law 3)',formula:'kW₂ = kW₁ × (N₂/N₁)³  ← cubic relationship',result:gt('fl-r-w2')},
    {label:'VFD energy savings at reduced speed',formula:'% saving = 1 − (N₂/N₁)³  (e.g. 80% speed = 51% power)',result:gt('fl-r-savepct')},
  ],[
    'Fan Laws per AMCA 210-16 and ASHRAE Fundamentals 2021 Ch.21',
    'Valid for speed changes ≤ ±30% of design speed for accurate results',
    'Belt drive losses increase at low speeds - minimum ~40% design speed recommended',
    'Density correction: scale pressure and power by (ρ₂/ρ₁) for altitude changes',
  ]);
};

// 13. FRESH AIR
const _origCalcFreshAir=calcFreshAir;
calcFreshAir=function(){
  _origCalcFreshAir.apply(this,arguments);
  const ip=currentUnit==='ip';
  addCalcDetails('fa-res',()=>[
    {label:'Breathing zone OA per ASHRAE 62.1',formula:'Vbz = Rp × Pz + Ra × Az',sub:`People: ${gv2('fa-occ')} × ${gv2('fa-occ')} CFM/p; Area: ${gv2('fa-area')} ${ip?'ft²':'m²'} × ${gv2('fa-area')} CFM/ft²`},
    {label:'Zone supply air OA fraction',formula:'Vpz_oa_frac = Vbz / Vdz  (Vdz = zone design supply air)',result:gt('fa-r-vbz')},
    {label:'CO₂ concentration estimate',formula:'CO₂_ss ≈ 450 + (N × G) / (Vbz × C)  [ppm]',sub:'G = 0.3 L/s per person (sedentary metabolic rate)',result:gt('fa-r-perperson')},
  ],[
    'ASHRAE 62.1-2022 - Ventilation and Acceptable Indoor Air Quality',
    'People component Rp and area component Ra from ASHRAE Table 6.2.2.1',
    'Ez = 1.0 assumed (ceiling diffuser supply, ceiling return)',
    'CO₂ generation: ASHRAE 62.1-2022 Appendix C; outdoor CO₂ reference 450 ppm',
  ]);
};



// 15. CHILLER COP
const _origCalcChillerCOP=calcChillerCOP;
calcChillerCOP=function(){
  _origCalcChillerCOP.apply(this,arguments);
  addCalcDetails('cop-res',()=>[
    {label:'Coefficient of Performance',formula:'COP = Q_cooling [kW] / P_input [kW]',sub:`Q = ${gv2('cop-load')} TR × 3.517 = ${(parseFloat(gv2('cop-load'))*3.517).toFixed(1)} kW`,result:gt('cop-r-cop')},
    {label:'Energy Efficiency Ratio (EER)',formula:'EER = COP × 3.412  [BTU/W·h]',result:gt('cop-r-eer')},
    {label:'kW per ton (IP efficiency)',formula:'kW/TR = 3.517 / COP',result:gt('cop-r-kwtr')},
    {label:'IPLV (part-load weighted average)',formula:'IPLV = 0.01×A + 0.42×B + 0.45×C + 0.12×D  (AHRI 550/590-2023 - Performance Rating of Water-Chilling and Heat Pump Water-Heating Packages)',sub:'A=100%, B=75%, C=50%, D=25% load points',result:gt('cop-r-kwtr')},
  ],[
    'COP from compressor kW input only (does not include condenser pump or cooling tower)',
    'Full-load COP typically 3.5–6.0 for water-cooled centrifugal chillers',
    'Air-cooled chiller COP: 2.5–3.5 (lower due to ambient condensing)',
    'IPLV is a better energy indicator than full-load COP for variable-load buildings',
    'ASHRAE 90.1-2022 Section 6.4 - chiller efficiency requirements at full and part-load',
  ]);
};

// 16. COOLING TOWER
const _origCalcCoolingTower=calcCoolingTower;
calcCoolingTower=function(){
  _origCalcCoolingTower.apply(this,arguments);
  const ip=currentUnit==='ip';
  addCalcDetails('ct-res',()=>[
    {label:'Cooling tower heat duty',formula:'Q = ṁ_water × cp × Range  where Range = EWT − LWT',sub:`EWT = ${gv2('ct-hot')}, LWT = ${gv2('ct-cold')}`,result:gt('ct-r-range')},
    {label:'Approach temperature',formula:'Approach = LWT − WBT_ambient',sub:`WBT = ${gv2('ct-wb')}`,result:gt('ct-r-approach')},
    {label:'Cooling tower effectiveness',formula:'ε = Range / (Range + Approach) = (EWT−LWT)/(EWT−WBT)',result:gt('ct-r-approach')},
    {label:'Evaporation loss',formula:'Evap ≈ 0.85% of circulating flow per 5°C Range (rule of thumb)',result:gt('ct-r-evap')},
    {label:'Make-up water requirement',formula:'M = Evap + Drift + Blowdown  (blowdown = Evap/(CoC−1))',result:gt('ct-r-makeup')},
  ],[
    'Psychrometric WBT design from ASHRAE 0.4% cooling design condition for site',
    'CoC (cycles of concentration) typically 3–5 for treated water systems',
    'Drift loss: 0.001–0.005% of circulating flow with drift eliminators (ASHRAE 188-2021 Legionellosis: Risk Management for Building Water Systems)',
    'Tower sizing based on CTI ATC-105 - Acceptance Test Code for Water-Cooling Towers',
    'Approach < 4°F (2.2°C) is physically difficult - verify with supplier',
  ]);
};

// 17. REFRIGERANT PIPE
const _origCalcRefPipe=calcRefPipe;
calcRefPipe=function(){
  _origCalcRefPipe.apply(this,arguments);
  addCalcDetails('rp-res',()=>[
    {label:'Refrigerant mass flow rate',formula:'ṁ = Q_cooling [kW] / (h₁ − h₄)  - enthalpy difference across evaporator',sub:`Cooling = ${gv2('rp-cap')} TR`,result:gt('rp-r-od')},
    {label:'Suction line: select for velocity 4–10 m/s',formula:'A = ṁ_vapour / (ρ_vapour × V_target)',result:gt('rp-r-od')},
    {label:'Liquid line: select for velocity 0.5–1.5 m/s',formula:'A = ṁ_liquid / (ρ_liquid × V_target)',result:gt('rp-r-vel')},
    {label:'Pressure drop check',formula:'ΔP_suction must not exceed 1°C saturation temperature equivalent',result:gt('rp-r-basis')},
  ],[
    'Refrigerant properties at design conditions from ASHRAE refrigerant tables',
    'Suction line velocity 4–10 m/s to entrain oil back to compressor',
    'Liquid line must be sub-cooled by ≥ 3°C to prevent flashing',
    'Vertical risers: minimum 4 m/s for oil return (higher velocity required)',
    'ASHRAE 15-2022 Safety Standard for Refrigeration Systems - pipe material compatibility',
  ]);
};

// 18. CONDENSATE DRAIN
const _origCalcCondensate=calcCondensate;
calcCondensate=function(){
  _origCalcCondensate.apply(this,arguments);
  addCalcDetails('cond-res',()=>[
    {label:'Condensate generation from latent load',formula:'Q_cond [L/hr] = Latent_load [kW] × 3600 / 2430',sub:`(h_fg = 2430 kJ/kg at typical coil temp ≈ 12°C)`,result:gt('cond-r-flow')},
    {label:'Condensate pipe sizing',formula:'Q = A × V  - gravity flow; V ≈ 0.5–1.0 m/s',result:gt('cond-r-size')},
    {label:'P-trap seal height',formula:'H_trap ≥ 1.5 × AHU static pressure [in w.g.] in inches',result:gt('cond-r-drop')},
  ],[
    'IPC 2021 Section 314.1 - condensate drain sizing',
    'IPC 2021 Section 314.2 - minimum condensate drain slope',
    'P-trap water seal prevents air ingestion into AHU',
    'IPC 2021 Section 314.2.1 - secondary drain requirement for suspended AHUs',
    'Condensate disposal: to sanitary drain or grey water recovery system',
  ]);
};

// 19. HVAC SANITY CHECK (renamed from sc-res)
const _origRunSanityCheck=runSanityCheck;
runSanityCheck=function(){
  _origRunSanityCheck.apply(this,arguments);
  addCalcDetails('hvac-sc-res',()=>[],[ // No steps - just checklist. Assumptions only.
    'Velocity limits per SMACNA: supply duct 1000–2500 FPM, CHW pipe 2–8 fps',
    'Friction rate: equal friction target 0.08 in w.g./100 ft duct (0.82 Pa/m)',
    'Cooling load density: 350–450 ft²/TR for typical offices (schematic estimate only)',
    'Chiller efficiency: ≥ 0.6 kW/TR (WC) or ≥ 1.0 kW/TR (AC) - ASHRAE 90.1',
    'All warnings are engineering guidelines - verify with detailed calculation',
  ]);
};

// 20. AIR MIXING
const _origCalcAirMix=calcAirMix;
calcAirMix=function(){
  _origCalcAirMix.apply(this,arguments);
  addCalcDetails('am-res',()=>[
    {label:'Mixed airflow (mass balance)',formula:'Q_mix = Q₁ + Q₂',sub:`Stream 1: ${gv2('am-cfm1')} CFM, Stream 2: ${gv2('am-cfm2')} CFM`},
    {label:'Mixed dry bulb temperature',formula:'T_mix = (Q₁×T₁ + Q₂×T₂) / (Q₁+Q₂)',result:gt('am-r-mdb')},
    {label:'Mixed humidity ratio',formula:'W_mix = (Q₁×W₁ + Q₂×W₂) / (Q₁+Q₂)',result:gt('am-r-mw')},
    {label:'Mixed enthalpy',formula:'h_mix = (Q₁×h₁ + Q₂×h₂) / (Q₁+Q₂)',result:gt('am-r-mh')},
  ],[
    'Linear mass balance used - valid for steady-state mixing only',
    'Humidity ratio W derived from input RH using Magnus equation',
    'Wet bulb temperature approximated from h_mix and W_mix (not psychrometric chart iterate)',
    'Use result as mixed air condition for cooling coil sizing',
    'Mixing of more than 2 streams: sum sequentially',
  ]);
};

// 21. ROOM PRESSURIZATION
const _origCalcRoomPress=calcRoomPress;
calcRoomPress=function(){
  _origCalcRoomPress.apply(this,arguments);
  addCalcDetails('roompress-res',()=>[
    {label:'Total leakage area',formula:'A_leak = A_door_gap + A_wall_cracks',sub:`Door gap: ${gv2('rp-gap')} cm², Wall: ${gv2('rp-wall')} cm²`},
    {label:'Leakage flow at target ΔP',formula:'Q_leak = Cd × A_leak × √(2ΔP/ρ)',sub:`Cd = 0.65, ρ = 1.2 kg/m³, ΔP = ${gv2('rp-pa')} Pa`,result:gt('rp-r-leak')},
    {label:'Required exhaust to maintain ΔP',formula:'For +ve pressure: Q_exhaust = Q_supply − Q_leak',result:gt('rp-r-exhaust')},
    {label:'Supply/exhaust imbalance needed',formula:'ΔQ = Q_supply − Q_exhaust  (this leaks out through gaps)',result:gt('rp-r-imbal')},
  ],[
    'Sharp-edged orifice discharge coefficient Cd = 0.65 assumed',
    'Air density ρ = 1.2 kg/m³ at 20°C, 101.325 kPa',
    'For negative pressure rooms: exhaust exceeds supply by leakage flow',
    'Target ΔP: +ve pressure = clean spaces (OR, pharmacy); −ve = isolation, toilets',
    'Door gap area: 40 cm² typical (2mm gap × 2m height × 2 sides)',
    'Actual leakage varies significantly - pressurize and measure during commissioning',
  ]);
};





// 24. INSULATION THICKNESS
const _origCalcInsulation=calcInsulation;
calcInsulation=function(){
  _origCalcInsulation.apply(this,arguments);
  addCalcDetails('ins-res',()=>[
    {label:'Dew point temperature at ambient conditions',formula:'Tdp = 243.04 × [ln(RH/100) + 17.625×Ta/(243.04+Ta)] / [17.625 − ln(RH/100) − 17.625×Ta/(243.04+Ta)]',sub:`Ta = ${gv2('ins-ta')}, RH = ${gv2('ins-rh')}%`,result:gt('ins-r-dp')},
    {label:'Required insulation thickness (flat wall anti-condensation)',formula:'t_min = k × (Tdp − Tf) / [hi × (Ta − Tdp)]',sub:`k = ${document.getElementById('ins-k')?.value||'0.038'} W/m·K, hi = 10 W/m²K (natural convection)`,result:gt('ins-r-thick')},
    {label:'Select next standard size',formula:'Round up to: 13, 19, 25, 32, 38, 50, 63, 76, 100 mm standard thicknesses',result:gt('ins-r-std')},
    {label:'Heat gain per m² at selected thickness',formula:'q = k × ΔT / t  [W/m²]  (flat wall approximation)',result:gt('ins-r-heat')},
  ],[
    'ASHRAE Fundamentals 2021 Ch.4 - heat transfer through cylindrical surfaces',
    'ASHRAE Fundamentals 2021 Ch.4 - natural convection surface coefficient',
    'Vapour barrier critical for cold pipes: permeance < 0.01 perm at pipe surface',
    'Insulation k values at 0°C mean temperature - increases at higher temperatures',
    'Add mechanical protection jacket for outdoor or mechanical room installations',
    'For pipes < 50mm OD: cylindrical geometry correction reduces required thickness',
  ]);
};

// ── Wire missing HVAC result IDs into _calcCache ──
Object.assign(_calcCache,{
  'cond-res':{id:'condensate',name:'Condensate Drain Sizing',
    getIn:()=>({'Latent load':gt('cond-r-flow'),'Coil CFM':gv2('cond-units'),'Mode':condMode}),
    getOut:()=>({'Cond flow':gt('cond-r-flow'),'Pipe size':gt('cond-r-size'),'P-trap':gt('cond-r-drop')})},
  'hvac-sc-res':{id:'hvac_sanity',name:'HVAC Sanity Check',
    getIn:()=>({'Duct vel':gv2('sc-duct-vel'),'Pipe vel':gv2('sc-pipe-vel'),'CFM/TR':gv2('sc-cfmtr')}),
    getOut:()=>({'Results':document.getElementById('sc-results-body')?document.getElementById('sc-results-body').textContent.replace(/\s+/g,' ').trim().slice(0,300):'-'})},
  'am-res':{id:'air_mixing',name:'Air Mixing Calculator',
    getIn:()=>({'CFM1':gv2('am-cfm1'),'T1':gv2('am-t1'),'RH1':gv2('am-rh1'),'CFM2':gv2('am-cfm2'),'T2':gv2('am-t2'),'RH2':gv2('am-rh2')}),
    getOut:()=>({'Mixed CFM':gt('am-r-cfm'),'Mixed DBT':gt('am-r-mdb'),'Mixed W':gt('am-r-mw'),'Mixed h':gt('am-r-mh')})},
  'roompress-res':{id:'room_press',name:'Room Pressurization',
    getIn:()=>({'ΔP target':gv2('rp-pa')+' Pa','Supply':gv2('rp-supply'),'Gap':gv2('rp-gap'),'Wall':gv2('rp-wall')}),
    getOut:()=>({'Leakage':gt('rp-r-leak'),'Exhaust':gt('rp-r-exhaust'),'Imbalance':gt('rp-r-imbal')})},
  'eg-res':{id:'equip_gain',name:'Equipment Heat Gain',
    getIn:()=>({'PCs':gv2('eg-pc-n')+'×'+gv2('eg-pc-w')+'W','Diversity':gv2('eg-div'),'Rad frac':gv2('eg-rad')}),
    getOut:()=>({'Design gain':gt('eg-r-design'),'TR':gt('eg-r-tr'),'Radiant':gt('eg-r-rad'),'Convective':gt('eg-r-conv')})},
  'hl2-res':{id:'heating_load',name:'Heating Load Calculator',
    getIn:()=>({'Area':gv2('hl2-area'),'U-wall':gv2('hl2-uwall'),'OAT':gv2('hl2-oat'),'IAT':gv2('hl2-iat'),'ACH':gv2('hl2-ach')}),
    getOut:()=>({'Conduction':gt('hl2-r-cond'),'Infiltration':gt('hl2-r-inf'),'Total':gt('hl2-r-total'),'kW':gt('hl2-r-kw')})},
  'ins-res':{id:'insulation',name:'Insulation Thickness',
    getIn:()=>({'Fluid temp':gv2('ins-tf'),'Ambient':gv2('ins-ta'),'RH':gv2('ins-rh'),'k':document.getElementById('ins-k')?.value||''}),
    getOut:()=>({'Dew point':gt('ins-r-dp'),'Min thickness':gt('ins-r-thick'),'Std size':gt('ins-r-std'),'Heat gain':gt('ins-r-heat')})},
  'fresh-air-load-res':{
    id:'fresh_air_load',
    name:'Fresh Air Cooling Load',
    getIn:()=>({
      'Entering DBT':gv2('fal-dbt-in') + (currentUnit==='ip'?'°F':'°C'),
      'Entering WBT':gv2('fal-wbt-in') + (currentUnit==='ip'?'°F':'°C'),
      'Leaving DBT':gv2('fal-dbt-out') + (currentUnit==='ip'?'°F':'°C'),
      'Leaving WBT':gv2('fal-wbt-out') + (currentUnit==='ip'?'°F':'°C'),
      'Total Fresh Air':gv2('fal-flow') + (currentUnit==='ip'?' CFM':' m³/s')
    }),
    getOut:()=>({
      'Sensible Load':gt('fal-r-sens'),
      'Latent Load':gt('fal-r-lat'),
      'Total Load':gt('fal-r-tot'),
      'Cooling Capacity':gt('fal-r-tons'),
      'Entering Hum. Ratio':gt('fal-r-win'),
      'Leaving Hum. Ratio':gt('fal-r-wout'),
      'Hum. Ratio Difference':gt('fal-r-wdiff')
    })
  }
});

// ── Wire injectSaveBar for all newly added HVAC result IDs ──
const _prevInjectSaveBarHVAC=injectSaveBar;
injectSaveBar=function(resId){
  const hvacNewIds=['cond-res','hvac-sc-res','am-res','roompress-res','eg-res','hl2-res','ins-res','fresh-air-load-res'];
  if(hvacNewIds.includes(resId)&&_calcCache[resId]){
    const container=document.getElementById(resId);if(!container)return;
    _buildActionBar(document.getElementById(resId), resId);
  }else{_prevInjectSaveBarHVAC(resId);}
};

// ══════════════════════════════════════════════════════
// PLUMBING MODULE - DETAILED CALCS (15 calculators)
// ══════════════════════════════════════════════════════

// 1. WATER DEMAND (Hunter's method)
const _origCalcHunters=calcHunters;
calcHunters=function(){
  _origCalcHunters.apply(this,arguments);
  addCalcDetails('hunters-res',()=>[
    {label:"Total fixture units (WSFUs)",formula:"WSFU = Σ(N_fixture × fixture_unit_value)",sub:"WC = 6, Lavatory = 1, Kitchen sink = 2, Shower = 2, Urinal = 5 (IPC Annex E)",result:gt('h-fu')},
    {label:"Peak demand from Hunter's curve",formula:"Q_peak = Hunter's Table (WSFU → GPM); IPC Table E103.3",result:gt('h-gpm')},
    {label:"Daily demand",formula:"Q_daily = N_occupants × daily_use [gal/person/day]",result:gt('h-breakdown')},
    {label:"Storage tank volume",formula:"V_tank = Q_daily × storage_days",result:gt('h-breakdown')},
  ],[
    "Hunter's curve - IPC 2021 Annex E Table E103.3 (probabilistic coincidence model, 1940)",
    "WSFU values from IPC 2021 Annex E - private vs public fixture distinctions",
    "Daily demand: offices 50–75 gal/person/day; hotels 80–120; hospitals 150–250",
    "Hunter's method conservatively assumes peak hour = 10× average hourly flow",
    "For systems > 3000 WSFU: use IPC Table E103.3 directly; curve flattens significantly",
  ]);
};

// 2. DRAINAGE SIZING
const _origCalcDrainage=calcDrainage;
calcDrainage=function(){
  _origCalcDrainage.apply(this,arguments);
  addCalcDetails('drain-res',()=>[
    {label:"Total drainage fixture units (DFUs)",formula:"DFU = Σ(N_fixture × DFU_value)",sub:"WC = 4, Lavatory = 1, Kitchen sink = 2, Bathtub/shower = 2, Clothes washer = 3",result:gt('dr2-dfu')},
    {label:"Horizontal branch / stack size",formula:"Size from IPC Table 710.1 - DFU vs pipe size vs slope",sub:"Slope ¼\"/ft → larger pipe; slope ⅛\"/ft → next size up",result:gt('dr2-size')},
    {label:"Velocity check (Manning's equation)",formula:"V = (1/n) × R^(2/3) × S^(1/2)  [n=0.013 PVC, n=0.015 CI]",result:gt('dr2-slope')},
    {label:"Self-cleansing velocity",formula:"V_min = 0.6 m/s (2 fps) at ½-full flow depth for solid transport",result:gt('dr2-slope')},
  ],[
    "IPC 2021 Table 710.1(1) - Maximum Fixture Units for Horizontal Fixture Branches",
    "Manning's n values: IPC / ASCE - PVC n=0.013, cast iron n=0.015",
    "Minimum slope ¼\"/ft (20.8 mm/m) for pipes ≤ 3\"; ⅛\"/ft for 4\"+ (IPC 704.1)",
    "Horizontal drains should not exceed ½-full depth at design flow for ventilation",
    "Vertical stacks sized separately - accumulated DFU along stack height",
  ]);
};

// 3. TANK SIZING
const _origCalcTank=calcTank;
calcTank=function(){
  _origCalcTank.apply(this,arguments);
  addCalcDetails('tank-res',()=>[
    {label:"Break tank / storage volume",formula:"V_storage = Q_daily × T_storage_days",sub:`Q_daily = ${gv2('ts-daily')} gal/day, Storage = ${gv2('ts-days')} day(s)`,result:gt('t-storage')},
    {label:"Effective vs gross tank volume",formula:"V_gross = V_effective / 0.85  (15% unusable - inlet pipe, sludge zone)",result:gt('t-break')},
    {label:"Pump-out time (if pressurised)",formula:"T_fill = V_gross / Q_fill_rate",result:gt('t-fill')},
    {label:"Overflow and warning levels",formula:"High alarm: 95% full; Overflow: 100%; Low alarm: 10% (pump protection)",result:"See notes below"},
  ],[
    "BS 6700:2006+A1:2009 - Design and installation of water supply systems; effective volume factor",
    "Break tanks must have air gap ≥ 25mm above high water level (RPZ/backflow)",
    "Cold water storage: minimum 1-day demand for domestic buildings (IPC / BS 6700)",
    "ASHRAE 188-2021 and HTM 04-01 - water storage tank requirements for Legionella control",
    "Fibre glass (GRP) tanks: check structural sizing for water weight (1 kg/L)",
    "IPC 2021 Section 904 and BS 6700:2006 - cold water storage requirements",
  ]);
};

// 4. WATER SUPPLY PIPE SIZER
const _origCalcWaterPipe=calcWaterPipe;
calcWaterPipe=function(){
  _origCalcWaterPipe.apply(this,arguments);
  addCalcDetails('wp-res',()=>[
    {label:"Design flow rate",formula:"Q = WSFUs converted to GPM via Hunter's curve  or  direct GPM input",sub:`Q = ${gv2('wp-flow')} ${currentUnit==='ip'?'GPM':'L/s'}`,result:gt('wp-rec-vel')},
    {label:"Pipe cross-section for target velocity",formula:"A = Q / V_target  →  D = √(4A/π)",sub:"CW target: 4–8 fps; HW target: 2–5 fps",result:gt('wp-rec-size')},
    {label:"Friction loss (Darcy-Weisbach)",formula:"ΔP/m = f/D × ρV²/2  (f from Colebrook-White)",result:gt('wp-rec-fric')},
    {label:"Residual pressure check",formula:"P_residual = P_supply − H_static − ΔP_friction − ΔP_fittings",result:gt('wp-rec-resid')},
  ],[
    "IPC 2021 Section 604.1 - maximum water velocity in supply piping",
    "Min velocity 1 fps (0.3 m/s) to prevent stagnation (Legionella risk)",
    "ASTM B88 - Seamless Copper Water Tube (Types K, L, M)",
    "ASTM F441 (CPVC), ASTM F876 (PEX) - temperature and pressure ratings",
    "Add 20–30% to calculated pipe length for fittings equivalent length",
    "Pressure at furthest/highest fixture must be ≥ 8 psi (55 kPa) at flow",
  ]);
};

// 5. BOOSTER PUMP
const _origCalcBooster=calcBooster;
calcBooster=function(){
  _origCalcBooster.apply(this,arguments);
  addCalcDetails('bp-res',()=>[
    {label:"Required pressure at highest fixture",formula:"P_req = P_fixture_min + H_static + ΔP_pipe",sub:`Min fixture pressure = ${gv2('bp-presid')} psi; Height = ${gv2('bp-delv')} ${currentUnit==='ip'?'ft':'m'}`,result:gt('bp-h-delv')},
    {label:"Total pump head",formula:"H = (P_req − P_mains) [psi] × 2.31  [ft/psi]  or  × 0.0981 [bar/m]",result:gt('bp-h-tot')},
    {label:"Pump motor power",formula:"P = ρ × g × Q × H / η  [W]  →  kW",sub:`η_pump ≈ 55–70% for small domestic pumps`,result:gt('bp-power')},
    {label:"Pressure vessel sizing (if pressurised system)",formula:"V_vessel = Q_peak × (P_max + 14.7) / [(P_max − P_min) × η_pump]",result:gt('bp-vel')},
  ],[
    "Booster pump adds pressure deficit between mains and required fixture pressure",
    "Minimum 10–15 psi margin above calculated duty for PRV losses and future demand",
    "Pressure vessel (expansion tank) prevents short-cycling; min 10–15 cycle/hr",
    "Variable speed pump (VSD) recommended for buildings >5 floors - saves 30–50% energy",
    "IPC 2021 Section 604.8 - maximum pressure; pressure-reducing valves",
    "Duty/standby pump arrangement required for critical systems (hospitals, high-rise)",
  ]);
};

// 6. HOT WATER SYSTEM
const _origCalcHotWater=calcHotWater;
calcHotWater=function(){
  _origCalcHotWater.apply(this,arguments);
  addCalcDetails('hotwater-res',()=>[
    {label:"Peak hot water demand",formula:"Q_peak = N_fixtures × flow_rate × simultaneous_factor",sub:`${gv2('hw-occ')} occupants, ${gv2('hw-peak')} L/person/day`,result:gt('hw-r-peak')},
    {label:"Heater power (kW)",formula:"P = ṁ × cp × ΔT  =  Q_peak [L/hr] × 1.163 × (T_hot − T_cold) [kW]",sub:`ΔT = ${gv2('hw-th')}°C − ${gv2('hw-tc')}°C`,result:gt('hw-r-kw')},
    {label:"Storage vessel volume",formula:"V_store = Q_peak_hr × storage_factor  (storage factor 0.5–1.5 hr)",result:gt('hw-r-tank')},
    {label:"Heat-up time from cold",formula:"t = V × ρ × cp × ΔT / P_heater",result:gt('hw-r-recovery')},
  ],[
    "Storage at ≥ 60°C to kill Legionella (ASHRAE 188-2021 Legionellosis: Risk Management for Building Water Systems / HTM 04-01)",
    "Delivery temperature ≤ 49°C (120°F) at fixtures - TMV (thermostatic mixing valve) required",
    "Electric heater efficiency ≈ 98%; gas: 85–92%; heat pump COP: 2.5–4.0",
    "ASHRAE 188-2021 - dead leg elimination; BS 8558:2015 - hot water recirculation design",
    "cp water = 4.18 kJ/kg·K; 1.163 W·hr/kg·K = conversion factor for L/hr",
    "Insulate all storage vessels and circulation pipes (EN 12897 / ASHRAE 90.1)",
  ]);
};

// 7. PRESSURE AT FIXTURE
const _origCalcPressureFix=calcPressureFix;
calcPressureFix=function(){
  _origCalcPressureFix.apply(this,arguments);
  addCalcDetails('pf-res',()=>[
    {label:"Static head loss (elevation)",formula:"ΔP_static = ρ × g × H  →  in psi: H[ft] / 2.31",sub:`Height from source = ${gv2('pf-elev')} ${currentUnit==='ip'?'ft':'m'}`,result:gt('pf-r-elev')},
    {label:"Pipe friction loss",formula:"ΔP_f = f × L/D × ρV²/2  (Darcy-Weisbach)",sub:`Pipe ${gv2('pf-fixture')}" × ${gv2('pf-fric')} ${currentUnit==='ip'?'ft':'m'}, Q = ${gv2('pf-dev')} GPM`,result:gt('pf-r-fric')},
    {label:"Residual pressure at fixture",formula:"P_residual = P_supply − ΔP_static − ΔP_friction",result:gt('pf-r-resid')},
    {label:"Adequacy check",formula:"P_residual ≥ 8 psi min (IPC); 15–25 psi recommended for good flow",result:gt('pf-r-status')},
  ],[
    "IPC 2021 Section 604.6 - minimum pressure at fixtures",
    "Recommended operating pressure 15–60 psi for fixture comfort and longevity",
    "Exceeding 80 psi requires PRV per IPC 604.8",
    "Fittings losses: add 20–30% of straight pipe equivalent length",
    "Velocity pressure component (V²/2g) typically < 1% of friction loss - neglected here",
  ]);
};

// 8. PIPE DESIGN CHECK
const _origRunPipeCheck=runPipeCheck;
runPipeCheck=function(){
  _origRunPipeCheck.apply(this,arguments);
  addCalcDetails('pc-res',()=>[],[ // Checklist - assumptions only
    "IPC 604.1: CW max 8 fps (2.4 m/s); HW max 5 fps (1.5 m/s); min 1 fps",
    "Drainage slope: ¼\"/ft minimum for ≤ 3\" pipes (IPC 704.1)",
    "Residual pressure: ≥ 8 psi (55 kPa) at any fixture under peak flow",
    "Drain velocity: ≥ 0.6 m/s (2 fps) for self-cleansing of solid waste",
    "All flags are guidelines - confirm with detailed friction and pressure calculations",
  ]);
};

// 9. FIXTURE UNIT CALCULATOR (Handled in 10-extra-hvac.js)
/*
const _origCalcFixtureUnit=calcFixtureUnit;
calcFixtureUnit=function(){
  _origCalcFixtureUnit.apply(this,arguments);
  addCalcDetails('fu-res',()=>[
    {label:"Water supply fixture units (WSFUs)",formula:"WSFU = Σ(count × WSFU_per_fixture)",sub:"WC = 6, Lav = 1, Kitchen sink = 2, Shower = 2, Urinal = 5",result:gt('fu-r-total')},
    {label:"Drainage fixture units (DFUs)",formula:"DFU = Σ(count × DFU_per_fixture)",sub:"WC = 4, Lav = 1, Kitchen sink = 2, Shower/tub = 2, Washer = 3",result:gt('fu-r-total')},
    {label:"Peak flow from WSFUs (Hunter's curve)",formula:"Q_peak = f(WSFU) from IPC Table E103.3",result:gt('fu-r-gpm')},
    {label:"Required drain stack size from DFUs",formula:"Stack size from IPC Table 710.1 - accumulated DFU at base",result:gt('fu-r-breakdown')},
  ],[
    "IPC 2021 Annex E Table E102.3 - Water Supply Fixture Unit values",
    "IPC 2021 Table 709.1 - Drainage Fixture Unit Values",
    "Combination fixtures (WC+shower in one unit): use highest individual value",
    "Interceptors and special waste systems have separate DFU requirements",
    "For buildings > 3000 WSFU: consult IPC Table E103.3 directly (Hunter's curve flattens)",
  ]);
};
*/

// 10. GRAVITY FLOW CHECK
const _origCalcGravityFlow=calcGravityFlow;
calcGravityFlow=function(){
  _origCalcGravityFlow.apply(this,arguments);
  addCalcDetails('gf-res',()=>[
    {label:"Manning's equation - full-bore flow capacity",formula:"Q_full = (1/n) × A × R^(2/3) × S^(1/2)",sub:`D = ${gv2('gf-dia')}mm, n = ${gv2('gf-n')}, S = ${gv2('gf-slope')}`,result:gt('gf-r-full')},
    {label:"Design flow vs full-bore flow ratio",formula:"q/Q_full = design_flow / Q_full  (target: 0.5–0.8 for vented drain)",result:gt('gf-r-fill')},
    {label:"Flow velocity (Manning)",formula:"V = Q / A  →  check ≥ 0.6 m/s (self-cleansing)",result:gt('gf-r-vel')},
    {label:"Partial depth (from hydraulic tables)",formula:"y/D ≈ f(q/Q_full) - lookup from circular section tables",result:gt('gf-r-vfull')},
  ],[
    "Manning's roughness coefficients - ASCE and IPC standard values",
    "Hydraulic radius R = A/P (cross-section area / wetted perimeter)",
    "Self-cleansing: V ≥ 0.6 m/s (2 fps) at design flow depth",
    "IPC 2021 / BS EN 752 - maximum fill depth for gravity drainage pipes",
    "ASTM D3034 (PVC sewer pipe) / EN 1401-1:2009 (PVC-U pipes for gravity sewerage)",
  ]);
};

// 11. SEWAGE PUMP
const _origCalcSewagePump=calcSewagePump;
calcSewagePump=function(){
  _origCalcSewagePump.apply(this,arguments);
  addCalcDetails('sewage-pump-res',()=>[
    {label:"Peak inflow to wet well",formula:"Q_peak = DFU-based peak + infiltration allowance",sub:`DFU total = ${gv2('sp-inflow')}, peak demand = ${gv2('sp-flow')} GPM`,result:gt('sp-r-tothead')},
    {label:"Pump duty flow (≥ 2× average inflow)",formula:"Q_pump ≥ 2 × Q_avg  to ensure wet well drawdown",result:gt('sp-r-pump-gpm')},
    {label:"Pump total dynamic head",formula:"TDH = H_static + H_friction + H_fittings + H_discharge",sub:`Static = ${gv2('sp-lift')} ${currentUnit==='ip'?'ft':'m'}`,result:gt('sp-r-tothead')},
    {label:"Wet well active volume",formula:"V_wet_well = Q_avg × t_cycle / 4  (min 10 min cycle time)",result:gt('sp-r-sump')},
    {label:"Motor power",formula:"P = ρ × g × Q × TDH / η_pump",result:gt('sp-r-power')},
  ],[
    "EN 12050-1:2015 - Wastewater lifting plants; pump duty sizing",
    "EN 12050-1:2015 Section 5 - minimum wet well retention time",
    "EN 12050-1:2015 - duty/standby requirements for critical installations",
    "Solids-handling pump: 50mm (2\") free passage minimum for sewage",
    "Rising main velocity: 0.7–3.0 m/s (2.5–10 fps) for scouring and transport",
    "High-level alarm and overflow required at 80% wet well capacity",
  ]);
};

// 12. STORM WATER CALCULATION
const _origCalcRainwater=calcRainwater;
calcRainwater=function(){
  _origCalcRainwater.apply(this,arguments);
  addCalcDetails('rw-res',()=>[
    {label:"Runoff Coefficient (C)",formula:"Selected maximum runoff coefficient for surface type",result:gt('sw-r-c')},
    {label:"Roof Flow Rate",formula:"Q_roof = (C × i × A_roof) / 3600",sub:`Roof area = ${gv2('sw-roof-area')} ${currentUnit==='ip'?'ft²':'m²'}, Rainfall = ${gv2('sw-intensity')} ${currentUnit==='ip'?'in/hr':'mm/hr'}, C = ${gt('sw-r-c')}`,result:gt('sw-r-roof-flow')},
    {label:"Pool Deck Flow Rate",formula:"Q_pool = (C × i × A_pool) / 3600",sub:`Pool area = ${gv2('sw-pool-area')} ${currentUnit==='ip'?'ft²':'m²'}, Rainfall = ${gv2('sw-intensity')} ${currentUnit==='ip'?'in/hr':'mm/hr'}, C = ${gt('sw-r-c')}`,result:gt('sw-r-pool-flow')},
    {label:"Total Storm Water Flow",formula:"Q_total = Q_roof + Q_pool",result:gt('sw-r-total-flow')},
  ],[
    "Rational Method (Q = C × i × A / 3600) for storm water runoff estimation",
    "Surface runoff coefficients based on Table 4.2.1 maximum values",
    "Rainfall intensity: design parameter, default value of 75 mm/hr",
    "Discharge unit conversions: 1 L/s = 15.85 GPM; 1 m² = 10.7639 ft²"
  ]);
};

// 13. GREY WATER
const _origCalcGreywater=calcGreywater;
calcGreywater=function(){
  _origCalcGreywater.apply(this,arguments);
  addCalcDetails('gw-res',()=>[
    {label:"Grey water generation per day",formula:"GW_gen = N_occ × (shower_use + washbasin_use + laundry_use) [L/day]",sub:`${gv2('gw-occ')} occupants`,result:gt('gw-r-gen')},
    {label:"Treated grey water available (after treatment losses)",formula:"GW_avail = GW_gen × treatment_efficiency  (typ. 85–90%)",result:gt('gw-r-treated')},
    {label:"Grey water reuse demand (WC flushing + irrigation)",formula:"GW_demand = N_occ × (WC_flushes × flush_vol + irrigation) [L/day]",result:gt('gw-r-demand')},
    {label:"Reuse coverage and potable water saving",formula:"Coverage = min(GW_avail, GW_demand) / GW_demand × 100%",result:gt('gw-r-coverage')},
    {label:"Surplus or deficit",formula:"Balance = GW_avail − GW_demand  (+ = surplus; − = shortfall)",result:gt('gw-r-balance')},
  ],[
    "Grey water excludes toilet, kitchen waste and nappy water (black water)",
    "Treatment efficiency 85–90% for biological/filter systems; 95%+ for MBR",
    "BS 8525-1:2010 / BS 8525-2:2011 - Greywater systems; IAPMO Z130-2016",
    "Storage tank: max 24hr retention before treatment (odour/bacteria risk)",
    "BS 8558:2015 and IPC 2021 - non-potable water distribution identification",
    "ASHRAE 188-2021 / HTM 04-01 - risk assessment for stored reclaimed water",
  ]);
};

// 14. PIPE THERMAL EXPANSION
const _origCalcPipeExpansion=calcPipeExpansion;
calcPipeExpansion=function(){
  _origCalcPipeExpansion.apply(this,arguments);
  addCalcDetails('pe-res',()=>[
    {label:"Thermal expansion (linear)",formula:"ΔL = α × L × ΔT",sub:`α = ${document.getElementById('pe-mat')?.value||'12e-6'} /°C, L = ${gv2('pe-l')} m, ΔT = ${gv2('pe-to')}−${gv2('pe-ti')}°C`,result:gt('pe-r-dl')},
    {label:"U-loop leg length (rule of thumb for steel)",formula:"L_leg ≈ 50 × √(ΔL [mm])  in mm",sub:"Based on ASTM standard expansion loop design charts",result:gt('pe-r-loop')},
    {label:"Expansion rate per 100°C temperature rise",formula:"ΔL/L per 100°C = α × 100  (mm/m per 100°C)",result:gt('pe-r-rate')},
  ],[
    "ASTM E228 - thermal expansion measurement; engineering calculation basis",
    "Installation temperature typically 20°C; verify actual pipe installation conditions",
    "Anchor points must be designed to resist expansion force: F = E × A × α × ΔT",
    "Expansion loops preferred over bellows for long-term reliability",
    "HDPE/PEX pipes have 10× higher expansion than steel - loops or offsets required every 10–15m",
    "ASME B31.1 / ASME B31.9 - pipe stress and expansion for buried piping",
  ]);
};

// 15. WATER HAMMER
const _origCalcWaterHammer=calcWaterHammer;
calcWaterHammer=function(){
  _origCalcWaterHammer.apply(this,arguments);
  const E=+(document.getElementById('wh-mat')?.value||1400)*1e6;
  addCalcDetails('wh-res',()=>[
    {label:"Wave speed (Joukowski / Allievi)",formula:"a = √[(K/ρ) / (1 + K×D/(E×e))]",sub:`K_water = 2.2 GPa, ρ = 998 kg/m³, E_pipe = ${(E/1e9).toFixed(1)} GPa, D = ${gv2('wh-od')}mm, e = ${gv2('wh-t')}mm`,result:gt('wh-r-wave')},
    {label:"Joukowski surge pressure",formula:"ΔP = ρ × a × ΔV  (ΔV = instantaneous velocity change)",sub:`V = ${gv2('wh-v')} ${currentUnit==='ip'?'fps':'m/s'}`,result:gt('wh-r-surge')},
    {label:"Total pressure (operating + surge)",formula:"P_total = P_operating + ΔP",result:gt('wh-r-total')},
    {label:"Surge vs operating ratio",formula:"Surge ratio = ΔP / P_operating × 100%",result:gt('wh-r-ratio')},
  ],[
    "Joukowski-Allievi equation - AWWA M11, ASCE Manuals of Engineering Practice",
    "Gradual closure over t > 2L/a reduces surge (L = pipe length, a = wave speed)",
    "Plastic pipe (PVC/HDPE) has lower wave speed → lower surge than steel",
    "Mitigation: slow-closing valves (≥ 2L/a close time), surge arrestors, air vessels",
    "Positive surge on valve closure; negative surge (sub-atmospheric) on opening - column separation risk",
    "AWWA M11 - Steel Pipe: A Guide for Design and Installation; transient analysis",
  ]);
};

// ── Update _calcCache for renamed/missing plumbing IDs ──
Object.assign(_calcCache,{
  'hotwater-res':{id:'hot_water',name:'Hot Water System',
    getIn:()=>({'Occupants':gv2('hw-occ'),'Usage':gv2('hw-peak')+' L/p/day','T_hot':gv2('hw-th')+'°C','T_cold':gv2('hw-tc')+'°C'}),
    getOut:()=>({'Peak demand':gt('hw-r-peak'),'Heater kW':gt('hw-r-kw'),'Storage':gt('hw-r-tank'),'Heat-up':gt('hw-r-recovery')})},
  'sewage-pump-res':{id:'sewage_pump',name:'Sewage Pump Sizing',
    getIn:()=>({'DFU':gv2('sp-inflow'),'Flow':gv2('sp-flow'),'Head':gv2('sp-lift')}),
    getOut:()=>({'Pump duty':gt('sp-r-pump-gpm'),'TDH':gt('sp-r-tothead'),'Wet well vol':gt('sp-r-sump'),'Motor':gt('sp-r-power')})},
  'wh-res':{id:'water_hammer',name:'Water Hammer',
    getIn:()=>({'Velocity':gv2('wh-v'),'OD':gv2('wh-od')+'mm','Wall':gv2('wh-t')+'mm','Operating P':gv2('wh-p')}),
    getOut:()=>({'Wave speed':gt('wh-r-wave'),'Surge ΔP':gt('wh-r-surge'),'Total P':gt('wh-r-total'),'Ratio':gt('wh-r-ratio')})},
  'hw-res':{id:'hot_water_legacy',name:'Hot Water System', // legacy alias fix
    getIn:()=>({'See':'hotwater-res'}),getOut:()=>({})},
});

// ── Wire save bars for newly registered plumbing IDs ──
const _prevInjectSaveBarPlumbing=injectSaveBar;
injectSaveBar=function(resId){
  const plumbNew=['hotwater-res','sewage-pump-res','pe-res','wh-res'];
  if(plumbNew.includes(resId)&&_calcCache[resId]){
    const container=document.getElementById(resId);if(!container)return;
    _buildActionBar(document.getElementById(resId), resId);
  }else{_prevInjectSaveBarPlumbing(resId);}
};

// ══════════════════════════════════════════════════════
// FIRE FIGHTING MODULE - DETAILED CALCS (15 calculators)
// ══════════════════════════════════════════════════════

// 1. K-FACTOR
const _origCalcKFactor=calcKFactor;
calcKFactor=function(){
  _origCalcKFactor.apply(this,arguments);
  const solveFor=kSolveFor||'Q';
  addCalcDetails('kf-res',()=>[
    {label:'K-Factor formula',formula:'Q = K × √P  ↔  P = (Q/K)²  ↔  K = Q / √P',sub:`Solving for: ${solveFor}`},
    {label:`Solve for ${solveFor}`,formula:solveFor==='Q'?`Q = K × √P = ${gv2('kf-known')} GPM`:
      solveFor==='P'?`P = (Q/K)² = (${gv2('kf-known')} / K)² psi`:
      `K = Q / √P = ${gv2('kf-known')} / √P`,
      result:gt('kf-res-val')},
    {label:'Operating pressure check',formula:'NFPA 13 minimum: 7 psi at any sprinkler',result:gt('kf-res-val')||'see result'},
  ],[
    'NFPA 13-2022 Section 6.3.3.2 - sprinkler K-factor definition Q = K√P',
    'NFPA 13-2022 Table 6.2.3 - K-factor listing; K-5.6 standard response pendent',
    'Flow Q in GPM, Pressure P in psi - do not mix SI and IP',
    'NFPA 13-2022 Section 7.1.1 - minimum sprinkler operating pressure',
    'K-factors are stamped on each sprinkler head - verify before calculation',
  ]);
};

// 2. HAZEN-WILLIAMS
const _origCalcHazen=calcHazen;
calcHazen=function(){
  _origCalcHazen.apply(this,arguments);
  addCalcDetails('hw-res',()=>[
    {label:'Hazen-Williams velocity formula',formula:'V = 0.8492 × C × R^0.63 × S^0.54  [m/s]',sub:`C = ${gv2('hw-c')}, D = ${gv2('hw-pipe')} inches, Q = ${gv2('hw-flow')} GPM`},
    {label:'Hydraulic slope S (friction head per unit length)',formula:'S = (V / (0.8492 × C × R^0.63))^(1/0.54)',result:gt('hw-per100')},
    {label:'Pressure loss over pipe length',formula:'ΔP = S × L  →  convert to psi: ÷ 2.31 (ft w.g. → psi)',result:gt('hw-total')},
    {label:'Velocity check',formula:'V = Q / A  →  NFPA 13 limit: 20 fps in fire mains',result:gt('hw-vel')},
  ],[
    'Hazen-Williams equation - NFPA 13-2022 Appendix A, Section A.23.4.2',
    'NFPA 13-2022 Table A.23.4.2 - Hazen-Williams C-factors for fire pipe',
    'C = 100 for 10-year-old unlined steel; C = 140 for copper or new smooth pipe',
    'Not valid for viscous fluids - use Darcy-Weisbach for non-water applications',
    'For C < 100 (corroded pipe): friction losses increase significantly - add 25%+',
  ]);
};

// 3. STANDPIPE LOSS
const _origCalcStandpipe=calcStandpipe;
calcStandpipe=function(){
  _origCalcStandpipe.apply(this,arguments);
  addCalcDetails('sp-res',()=>[
    {label:'Flow and pressure at each level',formula:'Q_riser = Q_connections × N_simultaneous',sub:`Class I: 500 GPM; Class II: 100 GPM; Class III: 500 GPM (NFPA 14)`},
    {label:'Friction loss (Hazen-Williams)',formula:'ΔP_friction = 4.52 × Q^1.85 / (C^1.85 × D^4.87)  [psi/ft]',sub:`C = ${gv2('sp-c')}, D = ${gv2('sp-pipe')}"`,result:gt('sp-fric-v')},
    {label:'Static head loss / gain',formula:'ΔP_static = H [ft] / 2.31  [psi]  (10 ft = 4.33 psi)',sub:`Height = ${gv2('sp-ht')} ft`,result:gt('sp-elev')},
    {label:'Residual pressure at topmost outlet',formula:'P_residual = P_pump − ΔP_friction − ΔP_static',result:gt('sp-residual')},
  ],[
    'NFPA 14-2019 - Standard for the Installation of Standpipe and Hose Systems',
    'NFPA 14-2019 Section 7.3, 7.4, 7.5 - standpipe class definitions',
    'NFPA 14-2019 Section 7.8 - minimum residual pressure requirements',
    'NFPA 14-2019 Section 7.3.3 - maximum outlet pressure and PRV requirement',
    'Hydraulic design: most remote outlet is the critical point; design from there',
  ]);
};

// 4. FIRE PUMP DUTY
const _origCalcFirePump=calcFirePump;
calcFirePump=function(){
  _origCalcFirePump.apply(this,arguments);
  addCalcDetails('fp-res',()=>[
    {label:'Rated duty point',formula:'Q_rated = system demand at 100% rated head',sub:`Q = ${gv2('fp-flow')} GPM, H = ${gv2('fp-press')} psi`,result:gt('fp-rated-flow')},
    {label:'Churn / shutoff pressure',formula:'P_churn ≤ 140% × P_rated  (NFPA 20 requirement)',result:gt('fp-churn')},
    {label:'Peak flow point',formula:'At 150% rated flow: head ≥ 65% rated head',result:gt('fp-peak-pt')},
    {label:'Motor power',formula:'P_motor = Q × H / (1714 × η_pump)  [HP]  (IP units)',sub:'η_pump typically 65–75% for fire pumps',result:gt('fp-power')},
    {label:'Net positive suction head (NPSH)',formula:'NPSHa must exceed NPSHr by ≥ 2 ft margin',result:gt('fp-rated-head')},
  ],[
    'NFPA 20-2022 - Standard for the Installation of Stationary Pumps for Fire Protection',
    'NFPA 20-2022 Section 4.1.4 - equipment listing requirements; UL 448',
    'NFPA 20-2022 Section 4.27.1 - shutoff (churn) pressure limitation',
    'NFPA 20-2022 Chapter 9 - diesel engine drivers for fire pumps',
    'NFPA 25-2023 - Standard for the Inspection, Testing, and Maintenance of Water-Based Fire Protection Systems',
    'Jockey (pressure maintenance) pump required to prevent fire pump cycling',
  ]);
};

// 5. FIRE TANK CAPACITY
const _origCalcFireTank=calcFireTank;
calcFireTank=function(){
  _origCalcFireTank.apply(this,arguments);
  addCalcDetails('ft-res',()=>[
    {label:'Sprinkler demand volume',formula:'V_sprinkler = Q_sprinkler [GPM] × T_duration [min]',sub:`T = ${gv2('ft-sp-dur')} minutes, Q = ${gv2('ft-sp-gpm')} GPM`},
    {label:'Hose stream demand (NFPA 13)',formula:'V_hose = Q_hose [GPM] × 60 min  (always 60 min per NFPA 13)',result:gt('ft-hs-vol')},
    {label:'Total tank capacity required',formula:'V_tank = V_sprinkler + V_hose + reserve',result:gt('ft-total-gal')},
    {label:'Gravity tank: minimum height',formula:'H_min = (P_required + friction losses) × 2.31  [ft above highest sprinkler]',result:gt('ft-total-l')},
  ],[
    'NFPA 22-2023 - Standard for Water Tanks for Private Fire Protection',
    'Hose stream allowance: 250 GPM for OH, 500 GPM for EH (NFPA 13 §19.3)',
    'NFPA 22-2023 Section 6.1 - gravity tank elevation requirement',
    'Suction tanks: fully enclosed, frost-protected, with fill line and overflow',
    'NFPA 25-2023 Chapter 9 - water storage tank inspection and testing',
    'Tank construction: steel (AWWA D100), FRP, or concrete per NFPA 22',
  ]);
};

// 6. SPRINKLER DENSITY & FLOW
const _origCalcSprinklerDensity=calcSprinklerDensity;
calcSprinklerDensity=function(){
  _origCalcSprinklerDensity.apply(this,arguments);
  addCalcDetails('sd-res',()=>[
    {label:'Minimum flow per sprinkler from density',formula:'q = d × A_coverage  [GPM]',sub:`d = design density [GPM/ft²], A = ${gv2('sd-coverage')} ft² coverage per head`,result:gt('sd-r-per-sprink')},
    {label:'Min operating pressure at sprinkler',formula:'P = (q / K)²  from K-factor formula',sub:`K = ${gv2('sd-k')} GPM/√psi`,result:gt('sd-r-press')},
    {label:'Number of sprinklers in design area',formula:'N = A_design / A_coverage  (round up)',result:gt('sd-r-count')},
    {label:'Total sprinkler system demand',formula:'Q_sprinkler = d × A_design',result:gt('sd-r-total')},
    {label:'System demand with hose allowance',formula:'Q_system = Q_sprinkler + Q_hose  (NFPA 13 §19.3)',result:gt('sd-r-system')},
  ],[
    'NFPA 13-2022 Section 19.2 - Density/Area Design Method',
    'NFPA 13-2022 Section 19.3 - Hose Stream Demand requirements',
    'NFPA 13-2022 Section 19.2 - design area methodology',
    'Min pressure 7 psi at any sprinkler head - verify hydraulically from remote point',
    'This is a preliminary estimate - full hydraulic calculation required for design approval',
    'ESFR and large-drop sprinklers: different density tables - verify with manufacturer',
  ]);
};

// 7. SPRINKLER SPACING
const _origCalcSprinklerSpacing=calcSprinklerSpacing;
calcSprinklerSpacing=function(){
  _origCalcSprinklerSpacing.apply(this,arguments);
  addCalcDetails('ss-res',()=>[
    {label:'Max coverage per sprinkler from NFPA 13',formula:'A_max = table value based on hazard class × construction type',sub:`Hazard: ${document.getElementById('ss-hazard')?.value}, Type: ${document.getElementById('ss-construction')?.value}`,result:gt('ss-r-maxcov')},
    {label:'Max centre-to-centre spacing',formula:'S_max = from NFPA 13 Table 8.6.2 (standard pendent)',result:gt('ss-r-maxspacing')},
    {label:'Min spacing (anti-skipping rule)',formula:'S_min = 6 ft (1.8 m) - prevents adjacent sprinklers wetting each other and delaying activation',result:gt('ss-r-min')},
    {label:'Minimum sprinkler count for room',formula:'N = ceil(Room_area / A_eff)  where A_eff = min(A_max, S²)',result:gt('ss-r-count')},
  ],[
    'NFPA 13-2022 Table 8.6.2.1 - Protection Area Limitations for standard sprinklers',
    'Obstructed construction: beams, joists reduce effective throw - reduce coverage by 10%',
    'Extended coverage (EC) sprinklers: larger A_max but require listing for the specific hazard',
    'ESFR (Early Suppression Fast Response): storage occupancies only; specific K-factor required',
    'NFPA 13-2022 Section 8.6.3 - wall clearance requirements',
    'Final layout must avoid obstructions (beams, light fittings, HVAC equipment)',
  ]);
};

// 8. EQUIVALENT LENGTH
const _origCalcEquivLength=calcEquivLength;
calcEquivLength=function(){
  _origCalcEquivLength.apply(this,arguments);
  addCalcDetails('el-res',()=>[
    {label:'Equivalent length concept',formula:'Each fitting = straight pipe of equivalent friction resistance: L_eq = K_fitting × D',sub:'K values from NFPA 13 Table A.23.4.2'},
    {label:'Total fitting equivalent length',formula:'L_fittings = Σ(N_i × L_eq_i)  for all fitting types',result:gt('el-r-fittings')},
    {label:'Total equivalent pipe length',formula:'L_total = L_pipe + L_fittings',result:gt('el-r-total')},
    {label:'Fitting allowance as percentage',formula:'%_fittings = L_fittings / L_pipe × 100%',result:gt('el-r-pct')},
  ],[
    'NFPA 13-2022 Table A.23.4.2 - Equivalent Pipe Lengths of Fittings and Devices',
    'Equivalent lengths increase with pipe size (larger pipes have proportionally larger fittings)',
    'NFPA 13-2022 Table A.23.4.2 - alarm check valve equivalent lengths',
    'This method underestimates loss for partially-open valves - keep all valves fully open',
    'For Schedule 10 pipe: use same C but check wall thickness for mechanical integrity',
  ]);
};

// 9. FIRE WATER DEMAND
const _origCalcFireWaterDemand=calcFireWaterDemand;
calcFireWaterDemand=function(){
  _origCalcFireWaterDemand.apply(this,arguments);
  addCalcDetails('fwd-res',()=>[
    {label:'Sprinkler system demand',formula:'Q_sp = system hydraulic demand (from density/area or hydraulic calc)',sub:`Q = ${gv2('fwd-sp-flow')} GPM at ${gv2('fwd-sp-press')} psi`},
    {label:'Hydrant demand',formula:'Q_hydrant = N_simultaneous × q_per_hydrant',sub:`${gv2('fwd-hy-count')} hydrants × ${gv2('fwd-hy-flow')} GPM each`,result:gt('fwd-r-hy')},
    {label:'Hose reel demand',formula:'Q_hose_reel = N_simultaneous × q_per_reel',sub:`${gv2('fwd-hr-count')} reels × ${gv2('fwd-hr-flow')} GPM each`,result:gt('fwd-r-hr')},
    {label:'Total simultaneous demand',formula:'Q_total = Q_sp + Q_hydrant + Q_hose  (all operate simultaneously)',result:gt('fwd-r-total')},
    {label:'Tank volume for 60 and 90 minutes',formula:'V = Q_total × T_duration',result:gt('fwd-r-tank60')+' / '+gt('fwd-r-tank90')},
  ],[
    'Simultaneous operation assumption is conservative - some codes allow partial combinations',
    'NFPA 13-2022 Section 19.3.2 - inside hose stream allowances',
    'External hydrant flow: typically provided from mains, not the fire tank',
    'NFPA 1-2021 Chapter 1 - AHJ authority; local code adoption may modify requirements',
    'Fire pump must deliver total Q_total at minimum required residual pressure',
  ]);
};

// 10. FIRE PIPE DESIGN CHECK
const _origRunFirePipeCheck=runFirePipeCheck;
runFirePipeCheck=function(){
  _origRunFirePipeCheck.apply(this,arguments);
  addCalcDetails('fpc-res',()=>[],[ // Design check - assumptions only
    'Velocity limit: 4–20 fps (NFPA 13); suction pipe ≤ 10 fps (NFPA 20)',
    'Friction rate target: ≤ 0.010 psi/ft - higher rates acceptable but increase TDH',
    'Residual pressure minimum: 7 psi at any sprinkler (NFPA 13 Section 6.3)',
    'Pump discharge: 80–175 psi typical; over 175 psi requires pressure limiting devices',
    'Churn pressure: ≤ 140% of rated pressure at any outlet (NFPA 20)',
    'Schedule 40 black steel required for fire sprinkler branch lines (NFPA 13)',
  ]);
};

// 11. PUMP SUCTION / NPSH
const _origCalcNPSH=calcNPSH;
calcNPSH=function(){
  _origCalcNPSH.apply(this,arguments);
  addCalcDetails('ns-res',()=>[
    {label:'Atmospheric pressure head at site elevation',formula:'H_atm = 33.9 − elevation[ft] / 1000 × 1.13  [ft]',sub:`Elevation = ${gv2('ns-elev')} ft above sea level`,result:gt('ns-r-atm')},
    {label:'Vapour pressure head (Antoine equation)',formula:'Pv = 0.61078 × exp(17.27×T/(T+237.3)) kPa → convert to ft',sub:`T = ${gv2('ns-temp')}${currentUnit==='ip'?'°F':'°C'}`,result:gt('ns-r-vp')},
    {label:'NPSH available',formula:'NPSHa = H_atm ± H_s − H_f − H_v',sub:`H_s = ${gv2('ns-hs')} ft (+ flooded, − lift), H_f = ${gv2('ns-hf')} ft friction`,result:gt('ns-r-npsha')},
    {label:'NPSH margin check',formula:'Margin = NPSHa − NPSHr  (must be ≥ 2 ft)',sub:`NPSHr = ${gv2('ns-npshr')} ft (manufacturer data)`,result:gt('ns-r-margin')},
  ],[
    'HI 9.6.1-2017 - Rotodynamic Pumps: Guideline for NPSH Margin',
    'Higher water temperature → higher vapour pressure → lower NPSHa',
    'NFPA 20-2022 Section 4.11 - suction conditions and flooded suction preference',
    'Suction pipe velocity ≤ 10 fps (3 m/s) to minimise friction in suction line',
    'NPSHr from manufacturer pump curve - not available in this calculator; must be obtained',
    'Altitude: every 1000 ft elevation reduces atmospheric head by ~1.13 ft',
  ]);
};

// 12. TANK DURATION
const _origCalcTankDuration=calcTankDuration;
calcTankDuration=function(){
  _origCalcTankDuration.apply(this,arguments);
  addCalcDetails('td-res',()=>[
    {label:'Required tank volume for duration',formula:'V_required = Q_demand × T_required',sub:`Q = ${gv2('td-demand')} GPM × ${document.getElementById('td-dur')?.value||60} min`,result:gt('td-r-req')},
    {label:'Actual duration at design demand',formula:'T_actual = V_tank / Q_demand',result:gt('td-r-actual')},
    {label:'Tank capacity check',formula:'V_tank ≥ V_required  →  pass/fail',result:gt('td-r-status')},
    {label:'Refill time from mains',formula:'T_refill = V_tank / Q_refill',sub:`Q_refill = ${gv2('td-refill')} GPM`,result:gt('td-r-refill')},
  ],[
    'NFPA 22-2023 Section 5.2 - storage capacity and duration requirements',
    'Light hazard: 30 min; Ordinary hazard: 60 min; Extra hazard: 90 min (typical)',
    'NFPA 13-2022 / IBC Section 905 - high-rise fire water storage requirements',
    'NFPA 22-2023 Section 5.2.3 - tank refill time requirement',
    'Dedicated fire water storage must not be shared with domestic supply',
    '10% reserve volume above calculated requirement is good engineering practice',
  ]);
};

// 13. HOSE / HYDRANT COVERAGE
const _origCalcHoseCoverage=calcHoseCoverage;
calcHoseCoverage=function(){
  _origCalcHoseCoverage.apply(this,arguments);
  addCalcDetails('hc-res',()=>[
    {label:'Effective radius of coverage',formula:'R_eff = L_hose + R_jet  (hose fully extended + water jet reach)',sub:`L = ${gv2('hc-len')} ft, jet reach = ${gv2('hc-reach')} ft`,result:gt('hc-r-radius')},
    {label:'Theoretical coverage area per outlet',formula:'A_theoretical = π × R_eff²',result:gt('hc-r-cov-th')},
    {label:'Effective coverage with obstruction factor',formula:'A_effective = A_theoretical × F_obstruction',sub:`F = ${gv2('hc-obs')} (1.0 = open plan, 0.5 = heavily divided)`,result:gt('hc-r-cov-eff')},
    {label:'Number of outlets required',formula:'N = ceil(A_protect / A_effective)',result:gt('hc-r-count')},
    {label:'Maximum spacing between outlets',formula:'S_max = 2 × L_hose  (adjacent coverage circles must overlap)',result:gt('hc-r-spacing')},
  ],[
    'BS EN 671-1:2012 (fixed hose reels) and BS EN 671-2:2012 (first-aid hose reels)',
    'BS EN 671-1:2012 - hose reel specification and minimum flow rate',
    'Effective jet reach: 3–6m (10–20 ft) in still air at normal pressure',
    'Coverage circles should overlap by ≥ 10% to ensure no gaps',
    'Hose reels supplement sprinklers - not a substitute in sprinklered buildings',
    'BS 5306-1:2006 - Fire extinguishing installations: hose reels and foam inlets',
  ]);
};

// 14. HYDRANT FLOW TEST
const _origCalcHydrantFlow=calcHydrantFlow;
calcHydrantFlow=function(){
  _origCalcHydrantFlow.apply(this,arguments);
  addCalcDetails('hft-res',()=>[
    {label:'Flow from pitot gauge reading (orifice equation)',formula:'Q = 29.84 × Cd × d² × √P_pitot  [GPM]',sub:`Cd = ${gv2('hft-cd')||0.80}, d = ${gv2('hft-dia')||2.5}", P_pitot = ${gv2('hft-pitot')||20} psi`,result:gt('hft-r-flow')},
    {label:'Project flow to 20 psi residual',formula:'Q_20 = Q_test × √[(P_static − 20) / (P_static − P_residual)]^0.54',sub:`P_static = ${gv2('hft-static')} psi, P_resid = ${gv2('hft-resid')} psi`,result:gt('hft-r-20psi')},
    {label:'Pressure drop during test',formula:'ΔP = P_static − P_residual  (indicates system reserve capacity)',result:gt('hft-r-drop')},
  ],[
    'NFPA 291-2022 - Recommended Practice for Fire Flow Testing and Marking of Hydrants',
    'NFPA 291-2022 and AWWA Manual M17 - hydrant flow measurement method',
    'Cd = 0.90 for smooth rounded outlets; 0.80 for square-edged; 0.70 for projecting',
    'NFPA 291-2022 Section 4.5 - flow projection formula to residual pressure',
    'Test should be witnessed and documented - results valid for ~1 year (local main changes)',
    'Compare results with fire protection system demand - must exceed with margin',
  ]);
};

// 15. DRY PIPE VOLUME
const _origCalcDryPipeVol=calcDryPipeVol;
calcDryPipeVol=function(){
  _origCalcDryPipeVol.apply(this,arguments);
  addCalcDetails('dpv-res',()=>[
    {label:'System air volume from pipe size and length',formula:'V_air = L_pipe × Vol_per_foot  (Schedule 40 internal area × length × 1.15 fitting factor)',sub:`Pipe size: ${document.getElementById('dpv-size')?.value||1.5}", L = ${gv2('dpv-len')} ft`,result:gt('dpv-r-vol')},
    {label:'Air-to-water ratio',formula:'R = (P_air + 14.7) / 14.7  (absolute pressure ratio)',sub:`P_supervisory = ${gv2('dpv-press')} psi`,result:gt('dpv-r-ratio')},
    {label:'NFPA 13 volume limit check',formula:'V_system ≤ 750 gal without accelerator / exhaustor (NFPA 13 §7.2)',result:gt('dpv-r-status')},
    {label:'Estimated time-to-water',formula:'T ≈ V_system [gal] / 100 × 1 min  (approximate; varies by pipe layout)',result:gt('dpv-r-time')},
    {label:'Compressor fill capacity required',formula:'Q_comp = V_system / 30 min  (NFPA 13: fill in ≤ 30 min)',result:gt('dpv-r-comp')},
  ],[
    'NFPA 13-2022 Section 7.2 - Dry Pipe Systems; volume limitations',
    'NFPA 13-2022 Section 7.2.3.4 - 750-gallon dry pipe system volume limit',
    'Quick-opening device allows > 750 gal systems - verify with AHJ',
    'Pre-action systems: similar volume limits; require double interlock for IT rooms',
    'NFPA 13-2022 Section 7.2.3.5 - maximum time to water for dry pipe systems',
    'NFPA 25-2023 Section 13.3 - dry pipe valve and system testing',
  ]);
};

// 16. FM-200 CALCULATION
const _origCalcFM200=calcFM200;
calcFM200=function(){
  _origCalcFM200.apply(this,arguments);
  addCalcDetails('fm200-res',()=>[
    {label:'Enclosure volume calculation',formula:'Volume = Area × Height',sub:`Area = ${gv2('fm-area')} Sq.Mtr, Height = ${gv2('fm-height')} Mtr`,result:gt('fm-r-volume')},
    {label:'Clean agent weight required',formula:'Weight = (Volume / S) × (C / (100 - C))',sub:`S = 0.1473, C = 6.857%`,result:gt('fm-r-weight')},
  ],[
    'NFPA 2001 Section 5.5 - Agent design concentration requirements',
    'NFPA 2001 Section 5.5.1.1 - Minimum design concentration of 6.857% for HFC-227ea (Class A hazards)',
    'Specific volume (S) is calculated as S = k1 + k2 × T, where k1 = 0.1269, k2 = 0.000513, T = 20°C',
    'Calculation assumes zero leakage and uniform distribution within the enclosure',
  ]);
};



// ── Wire save bars for hft and dpv (new fire IDs) ──
const _prevInjectSaveBarFire=injectSaveBar;
injectSaveBar=function(resId){
  const fireNew=['hft-res','dpv-res'];
  if(fireNew.includes(resId)&&_calcCache[resId]){
    const container=document.getElementById(resId);if(!container)return;
    _buildActionBar(document.getElementById(resId), resId);
  }else{_prevInjectSaveBarFire(resId);}
};

// ══════════════════════════════════════════════════════
// ELECTRICAL MODULE - DETAILED CALCS (20 calculators)
// ══════════════════════════════════════════════════════

// 1. LOAD CALCULATION
const _origCalcElecLoad=calcElecLoad;
calcElecLoad=function(){
  _origCalcElecLoad.apply(this,arguments);
  addCalcDetails('el-load-res',()=>[
    {label:'Total connected load',formula:'P_connected = Σ(lighting + receptacles + HVAC + motors + special loads)  [kW]',
     sub:`${gv2('el-ltg')} + ${gv2('el-rec')} + ${gv2('el-hvac')} + ${gv2('el-mot')} + ${gv2('el-spl')} kW`,result:gt('el-r-connected')},
    {label:'Demand load (with diversity factor)',formula:'P_demand = P_connected × D_f',sub:`D_f = ${gv2('el-div')}`,result:gt('el-r-demand')},
    {label:'Apparent power (kVA)',formula:'S = P_demand / PF',sub:`PF = ${gv2('el-pf')}`,result:gt('el-r-kva')},
    {label:'Design current (3-phase)',formula:'I = S × 1000 / (√3 × V)',result:gt('el-r-current')},
  ],[
    'IEC 60364-5-55:2011 (wiring accessories) and NEC 2023 Article 220 (load calculations)',
    'Diversity factor: lighting 0.85, HVAC 0.65, receptacles 0.75 (typical)',
    'This is a preliminary demand load estimate - not a full NEC Art.220 calculation',
    'NEC 2023 Section 430.24 - several motors or motor(s) and other loads',
    'Future growth allowance: add 20–25% spare capacity on transformer/MDB',
    'Verified by a qualified electrical engineer before procurement',
  ]);
};

// 2. CURRENT CALCULATOR
const _origCalcElecCurrent=calcElecCurrent;
calcElecCurrent=function(){
  _origCalcElecCurrent.apply(this,arguments);
  const phase=elecPhase||'three';
  addCalcDetails('ec-res',()=>[
    {label:'Full-load current',formula:phase==='three'?'I = S × 1000 / (√3 × V × PF)  [3-phase]':'I = S × 1000 / (V × PF)  [1-phase]',
     sub:`V = ${gv2('ec-volt')} V, PF = ${gv2('ec-pf')}`,result:gt('ec-r-current')},
    {label:'Apparent power (kVA)',formula:phase==='three'?'S = √3 × V × I / 1000':'S = V × I / 1000',result:gt('ec-r-kva')},
    {label:'Reactive power (kVAR)',formula:'Q = S × sin(φ)  where φ = arccos(PF)',result:gt('ec-r-kvar')},
  ],[
    'IEC 60034-1:2022 - Rotating electrical machines: rating and performance',
    'Single-phase: I = kW / (V × PF × η)',
    'For motors: use nameplate FLA; for transformers: rated kVA / voltage',
    'IEC 61000-3-2:2018 - harmonic current limits and power factor for equipment',
    'Current values are at rated voltage - actual current varies with voltage deviation',
  ]);
};

// 3. CABLE SIZING
const _origCalcCableSizing=calcCableSizing;
calcCableSizing=function(){
  _origCalcCableSizing.apply(this,arguments);
  addCalcDetails('cs-res',()=>[
    {label:'Design current (Ib)',formula:'Ib = input design current  [A]',sub:`Ib = ${gv2('cs-current')} A`},
    {label:'Apply combined derating factor',formula:'Iz_required = Ib / (Ctemp × Cgroup × Csoil)',sub:'Factors from IEC 60364-5-52 Table B.52',result:gt('cs-r-derated-cap')},
    {label:'Select cable from IEC table',formula:'Smallest standard size where Iz_table × derating ≥ Ib',result:gt('cs-r-selected')},
    {label:'Verify cable loading',formula:'Loading = Ib / Iz × 100%  (target ≤ 80%)',result:gt('cs-r-loading')},
    {label:'Voltage drop check',formula:'VD% = (√3 × ρ × L × Ib) / (A × V) × 100%  [3-phase]',result:gt('cs-r-vdpct')},
  ],[
    'IEC 60364-5-52:2009 Table B.52 - current-carrying capacities for cables',
    'Base rating at 30°C ambient; apply temperature correction for higher ambients',
    'IEC 60364-4-43:2008 - protection against overcurrent; Ib ≤ In ≤ Iz requirement',
    'IEC 60502-1:2004 - Power cables with XLPE insulation; temperature rating',
    'Minimum cable size for mechanical protection: 2.5 mm² for fixed wiring',
    'IEC 60364-5-54:2011 Table 54.7 - protective conductor cross-section',
  ]);
};

// 4. VOLTAGE DROP
const _origCalcVDrop=calcVDrop;
calcVDrop=function(){
  _origCalcVDrop.apply(this,arguments);
  const phase=vdPhase||'three';
  addCalcDetails('vd-res',()=>[
    {label:'Resistivity of conductor',formula:'ρ_Cu = 0.01724 Ω·mm²/m at 20°C; ρ_Al = 0.02830 Ω·mm²/m',sub:`Material: ${vdMat||'cu'}, Size: ${document.getElementById('vd-size')?.value||'-'} mm²`},
    {label:'Voltage drop (V)',formula:phase==='three'?'VD = √3 × ρ/A × L × I  [three-phase]':'VD = 2 × ρ/A × L × I  [single-phase]',
     sub:`L = ${gv2('vd-len')} m, I = ${gv2('vd-current')} A`,result:gt('vd-r-vdv')},
    {label:'Voltage drop (%)',formula:'VD% = VD / V_system × 100%',sub:`V = ${document.getElementById('vd-volt')?.value||415} V`,result:gt('vd-r-pct')},
    {label:'Receiving end voltage',formula:'V_receive = V_supply − VD',result:gt('vd-r-recv')},
  ],[
    'IEC 60364-5-52:2009 Section 525 - voltage drop limits in low voltage installations',
    'Resistivity increases with temperature: ρ_T = ρ_20 × [1 + α(T−20)]; α_Cu = 0.00393',
    'Reactive component (inductance) neglected - acceptable for cables < 95 mm²',
    'For long LV feeders: calculate VD under both full load and motor starting (peak)',
    'IEC 60364-5-52:2009 - voltage drop calculation method for cables',
  ]);
};

// 5. TRANSFORMER SIZING
const _origCalcTransformer=calcTransformer;
calcTransformer=function(){
  _origCalcTransformer.apply(this,arguments);
  addCalcDetails('tx-res',()=>[
    {label:'Demand load in kVA',formula:'S_demand = P_demand / PF',sub:`P = ${gv2('tx-kw')} kW × diversity ${gv2('tx-div')}, PF = ${gv2('tx-pf')}`,result:gt('tx-r-req')},
    {label:'Apply future growth factor',formula:'S_design = S_demand × future_factor',sub:`Future factor = ${gv2('tx-fut')}`,result:gt('tx-r-fut-pct')},
    {label:'Select standard transformer kVA',formula:'Round up to: 50, 100, 160, 200, 250, 315, 400, 500, 630, 800, 1000, 1250, 1600, 2000 kVA',result:gt('tx-r-std')},
    {label:'Transformer loading check',formula:'Loading% = S_demand / S_rated × 100%  (target 70–80%)',result:gt('tx-r-load-pct')},
  ],[
    'IEC 60076-1:2011 - Power transformers: general requirements',
    'Optimum loading: 70–80% of rated kVA for energy efficiency and life expectancy',
    'Overloading 100%+ reduces insulation life exponentially (Arrhenius equation)',
    'IEC 60076-1:2011 - impedance voltage for distribution transformers',
    'IEC 60076-1:2011 Table II - transformer vector groups and applications',
    'Include harmonic loading for VFD-heavy installations - derate transformer by 15–20%',
  ]);
};

// 6. GENERATOR SIZING
const _origCalcGenerator=calcGenerator;
calcGenerator=function(){
  _origCalcGenerator.apply(this,arguments);
  addCalcDetails('gen-res',()=>[
    {label:'Running load (kVA)',formula:'S_run = P_run / PF',sub:`P_run = ${gv2('gen-run')} kW, PF = ${gv2('gen-pf')}`},
    {label:'Motor starting demand (peak kVA)',formula:'S_start = I_start / I_FLC × kVA_motor_FLC',sub:`Starting factor: ${document.getElementById('gen-start')?.value||1.5}× for ${document.getElementById('gen-method')?.value||'star-delta'}`,result:gt('gen-r-start')},
    {label:'Generator rating required',formula:'S_gen = max(S_run + S_start_increment, S_total_running)',result:gt('gen-r-design')},
    {label:'Select standard rating',formula:'IEC standard sizes: 20, 30, 50, 75, 100, 125, 150, 200, 250, 300, 400, 500, 750, 1000 kVA',result:gt('gen-r-std')},
  ],[
    'BS 7671:2018+A2:2022 (IET Wiring Regulations), IEC 60034-1:2022, ISO 8528-1:2018',
    'ISO 8528-1:2018 - Reciprocating internal combustion engine driven alternating current generating sets',
    'DOL starting: 6× FLC inrush; Star-delta: 2× FLC; Soft starter: 2.5×; VFD: 1.1×',
    'Always start largest motor first - then step-load remaining loads',
    'Diesel generator: 0.25–0.35 L/kWh fuel consumption at 75% load',
    'IEC 60947-6-1:2005 - Low-voltage switchgear: automatic transfer switching equipment',
  ]);
};

// 7. POWER FACTOR CORRECTION
const _origCalcPFC=calcPFC;
calcPFC=function(){
  _origCalcPFC.apply(this,arguments);
  addCalcDetails('pfc-res',()=>[
    {label:'Existing reactive power (kVAR)',formula:'Q₁ = P × tan(φ₁)  where φ₁ = arccos(PF₁)',sub:`PF₁ = ${gv2('pfc-pf1')}, P = ${gv2('pfc-kw')} kW`,result:gt('pfc-r-kva1')},
    {label:'Target reactive power (kVAR)',formula:'Q₂ = P × tan(φ₂)  where φ₂ = arccos(PF₂)',sub:`Target PF₂ = ${gv2('pfc-pf2')}`,result:gt('pfc-r-kva2')},
    {label:'Required capacitor bank (kVAR)',formula:'Q_c = Q₁ − Q₂ = P × (tan φ₁ − tan φ₂)',result:gt('pfc-r-kvar')},
    {label:'kVA reduction and current saving',formula:'ΔKVA = P/PF₁ − P/PF₂;  ΔI = ΔKVA × 1000 / (√3 × V)',result:gt('pfc-r-kvared')},
  ],[
    'IEC 60831-1:2014 - Shunt power capacitors for AC power systems',
    'Over-correction (PF > 1.0) causes leading PF - can damage generators and cause voltage rise',
    'Automatic PF correction panel (APFC): install when facility load > 100 kVA',
    'IEC 61000-3-2:2018 and IEC 61000-3-12:2011 - harmonic current limits',
    'Target PF ≥ 0.95 to avoid utility penalty charges in most regions',
    'Capacitor kVAR reduces apparent power, current, and transformer loading',
  ]);
};

// 8. LIGHTING (LUMEN METHOD)
const _origCalcLighting=calcLighting;
calcLighting=function(){
  _origCalcLighting.apply(this,arguments);
  addCalcDetails('lg-res',()=>[
    {label:'Required total luminous flux',formula:'Φ_total = E × A / (UF × MF)',sub:`E = ${document.getElementById('lg-lux')?.value||500} lux, A = ${gv2('lg-area')} m², UF = ${gv2('lg-uf')}, MF = ${gv2('lg-mf')}`},
    {label:'Number of luminaires required',formula:'N = Φ_total / Φ_per_fitting',sub:`Φ_fitting = ${document.getElementById('lg-type')?.value||4000} lm per luminaire`,result:gt('lg-r-n')},
    {label:'Achieved average illuminance',formula:'E_achieved = N × Φ_fitting × UF × MF / A',result:gt('lg-r-achieved')},
    {label:'Total connected lighting load',formula:'P_total = N × W_per_fitting  [W]',result:gt('lg-r-load')},
    {label:'Lighting power density (LPD)',formula:'LPD = P_total / A  [W/m²]',result:gt('lg-r-density')},
  ],[
    'CIBSE Lighting Guide LG7:2015 and EN 12464-1:2021 - Lighting of Indoor Work Places',
    'Utilisation Factor (UF) accounts for room geometry and reflectance (from photometric data)',
    'Maintenance Factor (MF) = LLMF × LSF × RSMF × LMF (typically 0.7–0.85)',
    'LLMF: lumen output at 50% rated life; LSF: lamp survival factor',
    'EN 12464-1:2021 Table 5.3 - office general: Em=500 lux, UGR≤19, Ra≥80',
    'ASHRAE 90.1-2022 Table 9.5.1 - Interior Lighting Power Allowances',
  ]);
};

// 9. EARTHING RESISTANCE
const _origCalcEarthing=calcEarthing;
calcEarthing=function(){
  _origCalcEarthing.apply(this,arguments);
  addCalcDetails('er-res',()=>[
    {label:'Single earth rod resistance (Dwight formula)',formula:'R = ρ/(2πL) × [ln(4L/d) − 1]',sub:`ρ = ${gv2('er-rho')} Ω·m, L = ${gv2('er-len')} m, d = ${gv2('er-dia')} mm`,result:gt('er-r-single')},
    {label:'Multiple rods in parallel',formula:'R_system = R_single / N × F_reduction  (mutual coupling reduces efficiency)',sub:`N = ${gv2('er-n')} rods; F_reduction ≈ 0.7–0.9 for rods at 2× spacing`,result:gt('er-r-system')},
    {label:'Touch voltage safety check',formula:'V_touch ≤ 50V (IEC 60479) - requires fault clearing within protection curve',result:gt('er-r-system')},
  ],[
    'IEEE 142-2007 (Green Book) - Grounding of Industrial and Commercial Power Systems; BS 7430:2011+A1:2015',
    'Soil resistivity ρ: 10–100 Ω·m (clay/wet), 100–1000 Ω·m (dry soil), 1000+ Ω·m (rock)',
    'BS 7430:2011+A1:2015 Section 9 - recommended earth electrode resistance values',
    'IEEE 142-2007 Section 4.2 - multiple electrode spacing requirements',
    'IEEE 81-2012 - Guide for Measuring Earth Resistivity, Ground Impedance; BS 7430:2011',
    'Copper-clad steel rods: 17 mm dia × 2.4 m typical; stainless for corrosive soils',
  ]);
};

// 10. SHORT CIRCUIT (BASIC)
const _origCalcSC=calcSC;
calcSC=function(){
  _origCalcSC.apply(this,arguments);
  addCalcDetails('sc-res',()=>[
    {label:'Transformer full-load current',formula:'I_FL = kVA × 1000 / (√3 × V)',sub:`kVA = ${document.getElementById('sc-kva')?.value||1000}, V = ${document.getElementById('sc-volt')?.value||415} V`},
    {label:'3-phase fault current (infinite bus method)',formula:'I_sc = I_FL / (Z% / 100)',sub:`Z% = ${document.getElementById('sc-z')?.value||5}%`,result:gt('sc-r-ika')},
    {label:'Peak fault current',formula:'I_peak = I_sc × √2 × κ  (κ ≈ 1.7–2.0 for LV, use 1.8)',result:gt('sc-r-peak')},
    {label:'Fault MVA',formula:'MVA_fault = √3 × V × I_sc / 1000',result:gt('sc-r-mva')},
  ],[
    'IEC 60909-0:2016 - Short-circuit currents in AC electrical power systems (simplified method)',
    'Actual fault current lower due to system impedance (cables, busbars)',
    'IEC 60909-0:2016 - comprehensive method for short-circuit calculations',
    'Z% = 4–6% for typical distribution transformers (IEC 60076)',
    'IEC 62271-100:2021 - High-voltage AC circuit-breakers; switchgear ratings',
    'IEC 60909-0:2016 Section 4.3 - peak short-circuit current factor κ',
  ]);
};

// 11. BATTERY / UPS
const _origCalcUPS=calcUPS;
calcUPS=function(){
  _origCalcUPS.apply(this,arguments);
  addCalcDetails('ups-res',()=>[
    {label:'Load current (DC side)',formula:'I_DC = P_load / (V_battery × η_inverter)',sub:`P = ${gv2('ups-load')} W, V = ${document.getElementById('ups-volt')?.value||48} V DC, η = ${gv2('ups-eff')}%`},
    {label:'Net Ah capacity required',formula:'Ah_net = I_DC × T_backup  [A·hr]',sub:`T = ${gv2('ups-time')} hours`},
    {label:'Gross Ah with depth of discharge',formula:'Ah_gross = Ah_net / DoD',sub:`DoD = ${document.getElementById('ups-tech')?.value||0.90}`,result:gt('ups-r-net')},
    {label:'Final capacity with ageing factor',formula:'Ah_design = Ah_gross × ageing_factor',sub:`Ageing = ${gv2('ups-age')} (account for capacity loss over battery life)`,result:gt('ups-r-ah')},
  ],[
    'IEC 62040-1:2017 (UPS systems) and IEEE 485-2010 (battery sizing for stationary applications)',
    'Depth of discharge: LiFePO4 = 90%, NMC = 85%, VRLA lead-acid = 80%',
    'IEEE 485-2010 - Recommended Practice for Sizing Lead-Acid Batteries',
    'Battery life doubles for every 10°C reduction in operating temperature (Arrhenius)',
    'IEC 62040-1:2017 - UPS battery system voltage requirements',
    'IEC 62040-3:2021 Section 5.2 - UPS battery recharge requirements',
  ]);
};

// 12. BREAKER SIZING
const _origCalcBreaker=calcBreaker;
calcBreaker=function(){
  _origCalcBreaker.apply(this,arguments);
  addCalcDetails('cb-res',()=>[
    {label:'Minimum breaker rating',formula:'In_min = Ib × SF  (safety factor)',sub:`Ib = ${gv2('cb-ib')} A, SF = ${gv2('cb-sf')}`,result:gt('cb-r-min')},
    {label:'Select standard rating',formula:'Select next standard rating ≥ In_min from IEC 60898 list',result:gt('cb-r-std')},
    {label:'IEC rule: Ib ≤ In ≤ Iz',formula:'Verify: design current ≤ breaker ≤ cable derated capacity',sub:`In = ${gv2('cb-ib')} ≤ ? ≤ Iz = ${gv2('cb-iz')} A`,result:gt('cb-r-rule')},
    {label:'Cable protection check',formula:'In ≤ Iz  (breaker must not exceed cable ampacity)',result:gt('cb-r-cable')},
  ],[
    'IEC 60898-1:2015 (MCBs for household use) / IEC 60947-2:2016 (circuit-breakers for industrial use)',
    'IEC 60898-1:2015 Section 8.6 - tripping characteristics (Types B, C, D)',
    'Breaking capacity must exceed available fault current at installation point',
    'Coordination: upstream breaker must trip before downstream (selectivity)',
    'RCBO: adds residual current protection (30mA for personal protection)',
    'IEC 60898-1:2015 Table 8 - preferred values of rated current for MCBs',
  ]);
};

// 13. CABLE DERATING
const _origCalcDerating=calcDerating;
calcDerating=function(){
  _origCalcDerating.apply(this,arguments);
  addCalcDetails('dr-res',()=>[
    {label:'Base current capacity (from IEC table)',formula:'Iz_base = table value at 30°C for selected installation method',sub:`Size: ${document.getElementById('dr-size')?.value||25} mm², Method: ${document.getElementById('dr-install')?.value||'tray'}`,result:gt('dr-r-base')},
    {label:'Combined derating factor',formula:'F_total = Ctemp × Cgroup × Csoil',sub:`Temp: ${document.getElementById('dr-temp')?.value||1.0} × Group: ${document.getElementById('dr-group')?.value||0.65} × Soil: ${document.getElementById('dr-soil')?.value||1.0}`,result:gt('dr-r-total-f')},
    {label:'Derated current capacity (Iz)',formula:'Iz = Iz_base × F_total',result:gt('dr-r-iz')},
    {label:'Cable adequacy check',formula:'Ib ≤ Iz  →  if not, select next larger cable size',sub:`Ib = ${gv2('dr-ib')} A required`,result:gt('dr-r-adj')},
  ],[
    'IEC 60364-5-52:2009 Table B.52 - correction factors for ambient temperature and grouping',
    'IEC 60364-5-52:2009 Table B.52.14 - temperature correction factors (XLPE 90°C)',
    'IEC 60364-5-52:2009 Table B.52.17 - grouping correction factors',
    'Factors are multiplicative - heavily grouped cables at high ambient lose significant capacity',
    'XLPE (90°C) tolerates derating better than PVC (70°C) - prefer XLPE for hot environments',
    'Thermal insulation surrounding: apply additional 0.5 factor for cables in insulation',
  ]);
};

// 14. VOLTAGE DROP OPTIMIZATION
const _origCalcVDOpt=calcVDOpt;
calcVDOpt=function(){
  _origCalcVDOpt.apply(this,arguments);
  addCalcDetails('vo-res',()=>[
    {label:'Voltage drop for each cable size',formula:'VD% = (√3 × ρ/A × L × I) / V × 100%',sub:`For each size A: ρ = ${voMat==='cu'?'0.01724':'0.02830'} Ω·mm²/m, L = ${gv2('vo-len')} m, I = ${gv2('vo-ib')} A`},
    {label:'Current capacity check',formula:'Iz ≥ Ib  for each size  (from IEC 60364-5-52 conduit installation)',result:'See comparison table'},
    {label:'Optimal selection',formula:'Smallest A where both VD% ≤ limit AND Iz ≥ Ib',result:gt('vo-r-size')},
  ],[
    'IEC 60228:2004 - Conductors of insulated cables; resistivity values',
    'Ampacity from IEC 60364-5-52 conduit/enclosed installation (conservative)',
    'IEC 60364-5-52:2009 Section 525 - voltage drop recommendation',
    'For long feeders: voltage drop often governs cable size over current capacity',
    'Consider reactive component for cables > 95 mm² (significant inductance)',
    'Aluminium: lower cost for large sizes (≥ 16 mm²); larger cross-section for same current',
  ]);
};

// 15. PANEL LOAD SCHEDULE
const _origCalcPanel=calcPanel;
calcPanel=function(){
  _origCalcPanel.apply(this,arguments);
  addCalcDetails('pl-res',()=>[
    {label:'Total connected load',formula:'P_connected = Σ(kW_i)  for all circuits',result:gt('pl-r-connected')},
    {label:'Demand load (with circuit diversity)',formula:'P_demand = Σ(kW_i × DF_i) × panel_diversity',sub:`Panel diversity = ${gv2('pl-div')}`,result:gt('pl-r-demand')},
    {label:'Panel kVA and incomer current',formula:'S = P_demand / PF;  I = S × 1000 / (√3 × V)',sub:`PF = ${gv2('pl-pf')}, V = ${document.getElementById('pl-volt')?.value||415} V`,result:gt('pl-r-current')},
    {label:'Recommended incomer breaker',formula:'In_breaker ≥ 1.25 × I_incomer → round up to standard MCCB rating',result:gt('pl-r-breaker')},
  ],[
    'IEC 61439-1:2011 (general rules) and IEC 61439-3:2012 (DBs for household use)',
    'Diversity factor per circuit: 0.75–1.0 depending on load type and usage pattern',
    'Spare ways: minimum 20% spare circuit breaker spaces for future additions',
    'Incomer rating ≥ 1.25× design current; verify against transformer/cable capacity',
    'IEC 61439-1:2011 Section 8.6.2 - documentation requirements for assemblies',
    'Preliminary design only - full load schedule required for permit/approval',
  ]);
};

// 16. MOTOR STARTING CURRENT
const _origCalcMotor=calcMotor;
calcMotor=function(){
  _origCalcMotor.apply(this,arguments);
  const powSel=document.getElementById('mot-pow')?.value||'22';
  const kw=powSel==='custom'?parseFloat(gv2('mot-custom'))||22:parseFloat(powSel)||22;
  addCalcDetails('mot-res',()=>[
    {label:'Full-load current (FLC)',formula:'I_FLC = P × 1000 / (√3 × V × PF × η)',sub:`P = ${kw} kW, V = ${document.getElementById('mot-volt')?.value||415} V, PF = ${gv2('mot-pf')}, η = ${gv2('mot-eff')}%`,result:gt('mot-r-flc')},
    {label:'DOL starting current',formula:'I_start_DOL = 6 × I_FLC  (typical; range 5–8× depending on motor design)',result:gt('mot-r-dol')},
    {label:'Star-delta starting current',formula:'I_start_SD = I_FLC × (1/3) × 6 = 2 × I_FLC  (starts in star, transitions to delta)',result:gt('mot-r-sd')},
    {label:'VFD starting current',formula:'I_start_VFD ≈ 1.0–1.1 × I_FLC  (ramp-up; no inrush)',result:gt('mot-r-vfd')},
    {label:'Generator kVA demand during starting',formula:'kVA_gen = I_start × √3 × V / 1000',result:gt('mot-r-kva-gen')},
  ],[
    'IEC 60034-1:2022 (rotating electrical machines) and NEMA MG1-2021 (motors and generators)',
    'IEC 60947-4-1:2018 - Contactors and motor-starters for DOL starting',
    'Star-delta: reduces inrush to 2× FLC but causes torque dip during transition',
    'IEC 60947-4-2:2011 - AC semiconductor motor controllers (soft starters)',
    'IEC 61800-2:2021 - Adjustable speed electrical power drive systems (VFDs)',
    'Generator sizing: largest motor starting kVA must not exceed 25% of generator rating (typical)',
  ]);
};

// 17. CONDUIT SIZING
const _origCalcConduit=calcConduit;
calcConduit=function(){
  _origCalcConduit.apply(this,arguments);
  addCalcDetails('conduit-res',()=>[
    {label:'Total cable cross-sectional area',formula:'A_total = Σ(N_i × π × (OD_i/2)²)',sub:'OD from approximate outer diameter table per cable size',result:gt('conduit-r-area')},
    {label:'Required conduit internal area',formula:'A_conduit = A_total / fill_ratio',sub:`Fill ratio: 1 cable = 31%, 2 cables = 53%, 3+ cables = 40% (NEC Chapter 9)`,result:gt('conduit-r-maxfill')},
    {label:'Select standard conduit',formula:'D_conduit from: 20, 25, 32, 40, 50, 63, 75, 100 mm nominal sizes',result:gt('conduit-r-size')},
    {label:'Actual fill ratio check',formula:'Fill% = A_total / A_conduit_internal × 100%',result:gt('conduit-r-fill')},
  ],[
    'NEC 2023 Chapter 9 Table 1 (conduit fill) and IEC 61386-1:2008 (conduit systems)',
    'Fill limits: 1 conductor = 53% (NEC) or 31% (IEC); 2 = 31%; 3+ = 40%',
    'Keep fill ≤ 40% for ease of cable pulling and heat dissipation',
    'OD values are approximate - verify with actual cable manufacturer data',
    'IEC 61386-21:2002 - rigid conduit systems (PVC and steel classifications)',
    'Minimum conduit size for grouped cables: add pull rope space ≥ 25% spare area',
  ]);
};

// 18. ELECTRICAL DESIGN CHECK
const _origRunElecCheck=runElecCheck;
runElecCheck=function(){
  _origRunElecCheck.apply(this,arguments);
  addCalcDetails('edc-res',()=>[],[ // Design check - assumptions only
    'IEC rule: Ib ≤ In ≤ Iz (design current ≤ breaker ≤ derated cable capacity)',
    'Voltage drop: ≤ 3% final circuits, ≤ 5% total from origin (IEC 60364)',
    'Cable loading: ≤ 80% of derated ampacity recommended; ≤ 100% maximum',
    'Power factor: ≥ 0.85 preferred; ≥ 0.95 to avoid utility penalty in most regions',
    'Operating temperature: IEC 60364 base at 30°C; derate above 30°C',
    'All checks are guidelines - coordinate with full protection study for switchgear',
  ]);
};

// 19. ENERGY CONSUMPTION
const _origCalcEnergy=calcEnergy;
calcEnergy=function(){
  _origCalcEnergy.apply(this,arguments);
  addCalcDetails('energy-res',()=>[
    {label:'Daily energy consumption',formula:'E_daily = Σ(P_i × hr_i)  [kWh/day]',sub:`Σ of ${energyLoads.length} equipment entries`,result:gt('energy-r-daily')},
    {label:'Annual energy consumption',formula:'E_annual = E_daily × operating_days',sub:`${gv2('energy-days')} operating days/year`,result:gt('energy-r-annual')},
    {label:'Annual running cost',formula:'Cost = E_annual × tariff',sub:`Tariff = $${gv2('energy-tariff')}/kWh`,result:gt('energy-r-cost')},
    {label:'Peak demand (maximum simultaneous load)',formula:'P_peak = Σ(P_i)  [kW] - all loads operating simultaneously',result:gt('energy-r-peak')},
  ],[
    'Simple energy audit method - actual consumption may differ due to part-load operation',
    'For accurate energy modelling: use hourly load profiles or building energy simulation',
    'Demand charge: utilities may charge separately for kW peak demand (power component)',
    'Energy intensity benchmarks: offices 100–200 kWh/m²/yr; hospitals 300–600 kWh/m²/yr',
    'GHG Protocol Scope 2 Guidance - grid emission factors; ISO 14064-1:2018',
    'ASHRAE 90.1 / ISO 50001: energy management framework for commercial buildings',
  ]);
};

// 20. LUX RECOMMENDATION (no result div - inline update; add assumptions to page)
// No wrapper needed - page renders instantly on selection change

// ── Add energy-res to _calcCache ──
Object.assign(_calcCache,{
  'energy-res':{id:'elec_energy',name:'Energy Consumption',
    getIn:()=>({'Loads':energyLoads.length+' items','Days/yr':gv2('energy-days'),'Tariff':'$'+gv2('energy-tariff')+'/kWh'}),
    getOut:()=>({'Daily':gt('energy-r-daily'),'Monthly':gt('energy-r-monthly'),'Annual':gt('energy-r-annual'),'Cost':gt('energy-r-cost'),'Peak':gt('energy-r-peak')})},
});

// ── Wire save bar for energy-res ──
const _prevInjectSaveBarElec=injectSaveBar;
injectSaveBar=function(resId){
  if(resId==='energy-res'&&_calcCache[resId]){
    const container=document.getElementById(resId);if(!container)return;
    _buildActionBar(document.getElementById(resId), resId);
  }else{_prevInjectSaveBarElec(resId);}
};

}; // window.initCalcDetails end

// Also remove the hardcoded lg-assump block in lighting (now handled by addCalcDetails)

// ══════════════════════════════════════════════════════
// SEARCH ENGINE
// ══════════════════════════════════════════════════════

const searchIndex = [
  // HVAC
  {name:'Psychrometric Calculator',route:'psychrometric',module:'HVAC',color:'var(--blue)',icon:'🌡',tags:['psychrometric','air','humidity','enthalpy','dew point','wet bulb','dry bulb','RH','ASHRAE','hvac','moist air','specific volume']},
  {name:'Duct Sizer',route:'duct-sizer',module:'HVAC',color:'var(--blue)',icon:'📏',tags:['duct','airflow','CFM','friction','SMACNA','round','rectangular','velocity','FPM','equal friction','colebrook']},
  {name:'Pump Head',route:'pump-head',module:'HVAC',color:'var(--blue)',icon:'💧',tags:['pump head','fire pump','fire pump sizing','motor power','flow rate','static head','friction loss','piping','USGPM','bar','sprinkler','hydrant','NFPA']},
  {name:'Pipe Sizer (CHW/CW)',route:'hvac-pipe',module:'HVAC',color:'var(--blue)',icon:'⭕',tags:['pipe','chilled water','condenser water','CHW','CW','glycol','velocity','pressure drop','NPS','sizing']},
  {name:'VENTILATION',route:'ventilation',module:'HVAC',color:'var(--blue)',icon:'🌬',tags:['ventilation','ACH','ASHRAE 62.1','fresh air','outdoor air','CFM','OA','breathing zone','occupancy']},
  {name:'Heat Load Quick Calc',route:'heat-load',module:'HVAC',color:'var(--blue)',icon:'🌡',tags:['heat load','cooling load','BTU','tons','solar gain','sensible','latent','SHR','envelope','glazing','lighting']},
  {name:'External Static Pressure',route:'esp',module:'HVAC',color:'var(--blue)',icon:'🔧',tags:['ESP','external static pressure','AHU','fan','filter','coil','duct','in w.g.','FCU','static']},
  {name:'Diffuser Selector',route:'diffuser',module:'HVAC',color:'var(--blue)',icon:'💨',tags:['diffuser','throw','NC','ADPI','supply','grille','neck','face velocity','ceiling','airflow']},
  {name:'Airflow Calculator',route:'airflow-calc',module:'HVAC',color:'var(--blue)',icon:'💨',tags:['airflow','CFM','TR','sensible heat','delta T','supply air','cooling','airflow per ton','400 CFM']},
  {name:'Cooling Coil Calculator',route:'cooling-coil',module:'HVAC',color:'var(--blue)',icon:'❄',tags:['cooling coil','coil load','SHR','ADP','bypass factor','entering air','leaving air','sensible','latent','coil performance']},
  {name:'Fan Power Calculator',route:'fan-power',module:'HVAC',color:'var(--blue)',icon:'🌀',tags:['fan power','kW','HP','motor','shaft power','efficiency','static pressure','CFM','fan energy']},
  {name:'Fan Laws (Affinity)',route:'fan-laws',module:'HVAC',color:'var(--blue)',icon:'🔄',tags:['fan laws','affinity laws','VFD','speed change','variable frequency drive','airflow','pressure','power','energy saving']},
  {name:'Fresh Air Requirement',route:'fresh-air',module:'HVAC',color:'var(--blue)',icon:'🌬',tags:['fresh air','outdoor air','OA','ASHRAE 62.1','occupancy','CFM per person','ventilation rate','IAQ']},
  
  {name:'Chiller COP / Efficiency',route:'chiller-cop',module:'HVAC',color:'var(--blue)',icon:'🧊',tags:['chiller','COP','kW/TR','EER','efficiency','cooling','compressor','IPLV','energy']},
  {name:'Cooling Tower Calculator',route:'cooling-tower',module:'HVAC',color:'var(--blue)',icon:'🏭',tags:['cooling tower','heat rejection','range','approach','wet bulb','water flow','makeup water','condenser']},
  {name:'Refrigerant Pipe Sizing',route:'ref-pipe',module:'HVAC',color:'var(--blue)',icon:'🔧',tags:['refrigerant','pipe sizing','suction','liquid','discharge','velocity','R410A','R22','DX system']},
  {name:'Condensate Drain Sizing',route:'condensate',module:'HVAC',color:'var(--blue)',icon:'💧',tags:['condensate','drain','pipe size','slope','latent load','gal/hr','AHU','FCU','dehumidification']},
  {name:'HVAC Sanity Check',route:'sanity-check',module:'HVAC',color:'var(--blue)',icon:'🔍',tags:['sanity check','design check','velocity','friction rate','ESP','pipe velocity','CFM/TR','kW/TR','design assistant','review']},
  {name:'Preliminary Cooling Load',route:'prelim-cooling',module:'HVAC',color:'var(--brand)',icon:'❄️',tags:['preliminary cooling load','heat density','heat dissipation','cooling load','W/m2','space load','room load','prelim']},
  {name:'Condensate Drain Calc',route:'condensate-calc',module:'HVAC',color:'var(--blue)',icon:'💧',tags:['condensate','condensate drain calc','drain sizing','air conditioning','wet bulb','dry bulb','entering air','leaving air','dehumidification','moisture removed']},
  {name:'Basement Smoke Calc',route:'basement-smoke',module:'HVAC',color:'var(--blue)',icon:'💨',tags:['basement','smoke','ventilation','parking','carbon monoxide','CO','air changes','ACH','extract fan','fire mode']},
  {name:'Staircase Pressurization',route:'stair-press',module:'HVAC',color:'var(--blue)',icon:'💨',tags:['staircase pressurization','smoke management','escape route','NFPA 92','BS EN 12101','egress velocity','door leakage','air flow']},
  {name:'Air Mixing Calculator',route:'air-mixing',module:'HVAC',color:'var(--blue)',icon:'🌬',tags:['air mixing','multi-stream','return air','outdoor air','mixed air','enthalpy','humidity ratio','OA fraction']},
  {name:'Room Pressurization',route:'room-press',module:'HVAC',color:'var(--blue)',icon:'💨',tags:['room pressurization','pressure differential','Pa','clean room','isolation','operating theatre','supply exhaust imbalance']},
  
  {name:'Insulation Thickness',route:'insulation',module:'HVAC',color:'var(--blue)',icon:'🧱',tags:['insulation','thickness','pipe insulation','duct insulation','anti-condensation','heat loss','dew point','Armaflex','mineral wool']},
  {name:'ACH Recommendation',route:'ach-rec',module:'HVAC',color:'var(--blue)',icon:'🌀',tags:['ACH','air changes','ASHRAE','ventilation rate','hospital','clean room','office','recommendation','reference']},
  {name:'Domestic Water Demand',route:'water-demand',module:'Plumbing',color:'var(--green)',icon:'🚿',tags:["hunter's","water demand","fixture units","FU","IPC","GPM","domestic","residential","commercial","peak flow"]},
  {name:'Water Supply Pipe Sizer',route:'water-pipe',module:'Plumbing',color:'var(--green)',icon:'🔧',tags:['water pipe','supply','hazen williams','pressure','residual','velocity','domestic','IPC','ASPE','sizing']},
  {name:'Drainage Sizing',route:'drainage',module:'Plumbing',color:'var(--green)',icon:'⬇',tags:['drainage','DFU','drain','sewer','stack','branch','IPC','slope','horizontal','fixture']},
  {name:'Tank Sizing',route:'tank-sizing',module:'Plumbing',color:'var(--green)',icon:'🪣',tags:['tank','storage','break tank','daily demand','pump','fill','liters','gallons','capacity']},
  {name:'Booster / Transfer Pump',route:'booster-pump',module:'Plumbing',color:'var(--green)',icon:'⚡',tags:['booster pump','transfer pump','domestic pump','head','delivery','suction','kW','HP','motor','pressure']},
  {name:'Hot Water System',route:'hot-water',module:'Plumbing',color:'var(--green)',icon:'🔥',tags:['hot water','HWS','heater','storage','recovery','LPD','kW','legionella','TMV','hotel','hospital','ASHRAE 188-2021 Legionellosis: Risk Management for Building Water Systems']},
  {name:'Pipe Design Check',route:'pipe-check',module:'Plumbing',color:'var(--green)',icon:'🔍',tags:['pipe check','velocity','pressure','slope','fill ratio','design check','plumbing design','sanity check']},
  {name:'Fixture Unit Calculator',route:'fixture-unit',module:'Plumbing',color:'var(--green)',icon:'🚿',tags:['fixture unit','FU','Loading Units','IOP','Institute of Plumbing','Hunter','WC','basin','shower','probable flow','demand','fixture count']},
  {name:'Discharge Unit Calculator',route:'discharge-unit',module:'Plumbing',color:'var(--green)',icon:'⬇',tags:['discharge unit','DU','drainage','sizing','probable flow','Hunter','WC','basin','shower','fixture count','IOP','IPC']},
  {name:'Gravity Flow Check',route:'gravity-flow',module:'Plumbing',color:'var(--green)',icon:'⬇',tags:['gravity','manning','drainage','slope','self-cleansing','fill ratio','partial flow','velocity','sewer','horizontal drain']},
  {name:'Sewage Pump Sizing',route:'sewage-pump',module:'Plumbing',color:'var(--green)',icon:'⚙',tags:['sewage pump','ejector','submersible','sump','cycle time','starts','basement drainage','lift station','GPM']},
  {name:'Storm Water Calculation',route:'rainwater',module:'Plumbing',color:'var(--brand)',icon:'🌧',tags:['stormwater','storm water','rainwater','roof drainage','rational method','runoff coefficient','pool deck','rainfall intensity']},
  {name:'Water Hammer (Surge)',route:'water-hammer',module:'Plumbing',color:'var(--green)',icon:'💥',tags:['water hammer','surge pressure','Joukowski','valve closure','wave speed','transient','surge arrestor','pipeline']},
  {name:'Sprinkler K-Factor',route:'k-factor',module:'Fire',color:'var(--red)',icon:'💦',tags:['k-factor','sprinkler','NFPA 13','flow','pressure','GPM','psi','Q=K√P','discharge']},
  {name:'Hazen-Williams',route:'hazen-williams',module:'Fire',color:'var(--red)',icon:'🚿',tags:['hazen williams','friction loss','fire pipe','C-factor','NFPA','psi','flow','velocity']},
  {name:'Standpipe Friction Loss',route:'standpipe',module:'Fire',color:'var(--red)',icon:'🪜',tags:['standpipe','NFPA 14','hose','riser','class I','class II','residual','pressure','friction']},
  {name:'Fire Pump Duty',route:'fire-pump',module:'Fire',color:'var(--red)',icon:'⚙',tags:['fire pump','NFPA 20','duty point','churn','rated head','GPM','psi','motor','shutoff']},
  {name:'Fire Tank Capacity',route:'fire-tank',module:'Fire',color:'var(--red)',icon:'🏊',tags:['fire tank','NFPA 22','volume','sprinkler','standpipe','hose stream','gallons','liters','capacity']},
  {name:'Sprinkler Density & Flow',route:'sprinkler-density',module:'Fire',color:'var(--red)',icon:'💦',tags:['sprinkler density','design density','NFPA 13','GPM/ft²','light hazard','ordinary hazard','extra hazard','design area','sprinkler flow']},
  {name:'Equivalent Length',route:'equiv-length',module:'Fire',color:'var(--red)',icon:'📏',tags:['equivalent length','fittings','elbows','tees','valves','NFPA 13','Hazen-Williams','friction loss','pipe fittings']},
  {name:'Fire Water Demand',route:'fire-water-demand',module:'Fire',color:'var(--red)',icon:'🚒',tags:['fire water demand','total demand','sprinkler','hydrant','hose reel','simultaneous','pump sizing','tank sizing']},
  {name:'Fire Pipe Design Check',route:'fire-pipe-check',module:'Fire',color:'var(--red)',icon:'🔍',tags:['fire pipe','velocity','pressure','friction loss','design check','NFPA 13','NFPA 14','churn pressure','residual']},
  {name:'Pump Suction / NPSH',route:'pump-suction',module:'Fire',color:'var(--red)',icon:'⚙',tags:['NPSH','suction','cavitation','fire pump','NFPA 20','atmospheric head','vapour pressure','NPSHa','NPSHr']},
  {name:'Tank Duration',route:'tank-duration',module:'Fire',color:'var(--red)',icon:'⏱',tags:['tank duration','fire water','NFPA 22','refill','capacity check','minutes','fire reserve','autonomy']},
  {name:'Dry Pipe System Volume',route:'dry-pipe-vol',module:'Fire',color:'var(--red)',icon:'💨',tags:['dry pipe','pre-action','system volume','NFPA 13','accelerator','time to water','compressor','750 gallon']},
  {name:'Load Calculation',route:'elec-load',module:'Electrical',color:'var(--amber)',icon:'⚡',tags:['load','demand','kW','kVA','connected load','demand factor','diversity','current','electrical load schedule']},
  {name:'Current Calculator',route:'elec-current',module:'Electrical',color:'var(--amber)',icon:'⚡',tags:['current','amps','kW','kVA','single phase','three phase','power factor','voltage','I=P/V']},
  {name:'Cable Sizing',route:'elec-cable',module:'Electrical',color:'var(--amber)',icon:'🔌',tags:['cable','sizing','current capacity','voltage drop','IEC 60364','derating','conductor','mm2','XLPE','conduit']},
  {name:'Voltage Drop',route:'elec-vdrop',module:'Electrical',color:'var(--amber)',icon:'📉',tags:['voltage drop','VD','IEC','3%','5%','conductor','resistance','cable length','receiving voltage']},
  {name:'Transformer Sizing',route:'elec-transformer',module:'Electrical',color:'var(--amber)',icon:'🔋',tags:['transformer','kVA','sizing','diversity','loading','IEC 60076','future factor','demand']},
  {name:'Generator Sizing',route:'elec-generator',module:'Electrical',color:'var(--amber)',icon:'⚙',tags:['generator','DG','genset','starting load','motor starting','kVA','running load','diversity','standby']},
  {name:'Power Factor Correction',route:'elec-pfc',module:'Electrical',color:'var(--amber)',icon:'📊',tags:['power factor','PF','correction','capacitor','kVAR','reactive power','improvement','billing']},
  {name:'Lighting Calculator',route:'elec-lighting',module:'Electrical',color:'var(--amber)',icon:'💡',tags:['lighting','lumen method','lux','luminaire','UF','MF','EN 12464','AS 1680','fixtures','illuminance']},
  {name:'Earthing Resistance',route:'elec-earth',module:'Electrical',color:'var(--amber)',icon:'🌍',tags:['earthing','grounding','resistance','soil resistivity','electrode','Dwight','BS 7430','IEEE 142']},
  {name:'Short Circuit (Basic)',route:'elec-sc',module:'Electrical',color:'var(--amber)',icon:'⚡',tags:['short circuit','fault current','kA','MVA','transformer impedance','infinite bus','switchgear']},
  {name:'Battery / UPS Sizing',route:'elec-ups',module:'Electrical',color:'var(--amber)',icon:'🔋',tags:['battery','UPS','backup','Ah','lithium','lead acid','depth of discharge','inverter','autonomy']},
  {name:'Breaker / Protection Sizing',route:'elec-breaker',module:'Electrical',color:'var(--amber)',icon:'⚡',tags:['breaker','MCB','MCCB','ACB','protection','IEC 60898','circuit breaker','In','Ib','Iz','rule']},
  {name:'Cable Derating',route:'elec-derating',module:'Electrical',color:'var(--amber)',icon:'🌡',tags:['derating','ampacity','temperature factor','grouping factor','IEC 60364','cable capacity','ambient','installation method']},
  {name:'Voltage Drop Optimization',route:'elec-vdopt',module:'Electrical',color:'var(--amber)',icon:'📉',tags:['voltage drop','optimization','cable selection','optimal','comparison','all sizes','current','length']},
  {name:'Panel Load Schedule',route:'elec-panel',module:'Electrical',color:'var(--amber)',icon:'📋',tags:['panel','load schedule','distribution board','DB','circuits','connected load','demand','incomer','diversity']},
  {name:'Motor Starting Current',route:'elec-motor',module:'Electrical',color:'var(--amber)',icon:'⚙',tags:['motor','starting current','DOL','star-delta','soft starter','VFD','FLC','kVA','generator sizing','inrush']},
  {name:'Conduit Sizing',route:'elec-conduit',module:'Electrical',color:'var(--amber)',icon:'🔧',tags:['conduit','sizing','cable fill','NEC','IEC 61386','40%','conduit size','cable count','fill ratio']},
  {name:'Cable Tray Containment Sizing',route:'elec-tray',module:'Electrical',color:'var(--amber)',icon:'📦',tags:['cable tray','containment','tray sizing','tray width','cable diameter','parallel cables','electrical containment','spare capacity','cable routing','tray adequacy']},
  {name:'CBS Battery Sizing Calculator',route:'elec-cbs',module:'Electrical',color:'var(--amber)',icon:'🔋',tags:['cbs','central battery','battery sizing','emergency lighting','db','backup','ups','sizing','capacity']},
  {name:'Lux Level Recommendation',route:'elec-lux',module:'Electrical',color:'var(--amber)',icon:'💡',tags:['lux','illuminance','EN 12464','IES','office','hospital','warehouse','recommended','lighting standard','UGR','CRI','Ra']},
  {name:'Electrical Design Check',route:'elec-design-check',module:'Electrical',color:'var(--amber)',icon:'🔍',tags:['electrical design check','cable loading','voltage drop','breaker','IEC rule','Ib In Iz','power factor','design assistant']},
  {name:'Energy Consumption',route:'elec-energy',module:'Electrical',color:'var(--amber)',icon:'📊',tags:['energy consumption','kWh','running cost','energy audit','tariff','LEED','annual energy','electricity cost','load']},
  {name:'Density (W/Sq.Ft) Calculator',route:'elec-density-wsf',module:'Electrical',color:'var(--amber)',icon:'⚡',tags:['density','watts per square foot','w/sq.ft','electrical load density','power density','lighting density','plug load','space planning','preliminary sizing']},
  {name:'Thumb Rules',route:'thumb-rules',module:'Tools',color:'var(--purple)',icon:'📐',tags:['thumb rules','quick estimate','rule of thumb','HVAC','plumbing','fire','preliminary']},
  {name:'Standards Notes',route:'standards',module:'Tools',color:'var(--purple)',icon:'📋',tags:['standards','ASHRAE','NFPA','IPC','SMACNA','reference','notes','code']},
];

const moduleColors={HVAC:'var(--blue)',Plumbing:'var(--green)',Fire:'var(--red)',Electrical:'var(--amber)',Tools:'var(--purple)'};

function timeAgo(isoStr){
  const now=new Date(), then=new Date(isoStr);
  const diffMs=now-then, diffMin=Math.floor(diffMs/60000);
  if(diffMin<1) return 'Just now';
  if(diffMin<60) return diffMin+'m ago';
  const diffH=Math.floor(diffMin/60);
  if(diffH<24) return diffH+'h ago';
  const diffD=Math.floor(diffH/24);
  if(diffD===1) return 'Yesterday';
  if(diffD<7) return diffD+' days ago';
  return then.toLocaleDateString('en-US',{month:'short',day:'numeric'});
}

function renderHome(){
  if (typeof getCalculations !== 'function') return;
  const pageHome = document.getElementById('page-home');
  if (!pageHome) return;

  const activeProj = window.ProjectService ? window.ProjectService.getActiveProject() : null;

  if (!activeProj) {
    // ── RENDER DEFAULT HOME (GENERIC DASHBOARD) ──
    const temp = document.createElement('div');
    temp.innerHTML = window.CalculatorTemplates['home'].trim();
    pageHome.innerHTML = temp.firstElementChild.innerHTML;

    const calcs = getCalculations();
    const projects = getProjects();

    // Update hero stat
    const countEl = document.getElementById('home-calc-count');
    if (countEl) countEl.textContent = calcs.length;

    // Update module calc counts
    const hvacSaved = calcs.filter(c => c.module === 'HVAC').length;
    const plumbSaved = calcs.filter(c => c.module === 'Plumbing').length;
    const fireSaved = calcs.filter(c => c.module === 'Fire').length;
    const elecSaved = calcs.filter(c => c.module === 'Electrical').length;

    const hvacEl = document.getElementById('home-hvac-count');
    const plumbEl = document.getElementById('home-plumbing-count');
    const fireEl = document.getElementById('home-fire-count');
    const elecEl = document.getElementById('home-elec-count');

    if (hvacEl) hvacEl.textContent = '26 calculators' + (hvacSaved ? ' · ' + hvacSaved + ' saved' : '');
    if (plumbEl) plumbEl.textContent = '15 calculators' + (plumbSaved ? ' · ' + plumbSaved + ' saved' : '');
    if (fireEl) fireEl.textContent = '15 calculators' + (fireSaved ? ' · ' + fireSaved + ' saved' : '');
    if (elecEl) elecEl.textContent = '23 calculators' + (elecSaved ? ' · ' + elecSaved + ' saved' : '');

    // Recent calculations list
    const listEl = document.getElementById('home-recent-list');
    if (listEl) {
      if (!calcs.length) {
        listEl.innerHTML = `<div class="recent-empty">
          No calculations saved yet.<br>
          Run any calculator and hit <strong>💾 Save</strong> to see it here.
        </div>`;
      } else {
        const recent = calcs.slice(0, 5);
        listEl.innerHTML = recent.map(c => {
          const color = moduleColors[c.module] || 'var(--blue)';
          const route = calcRouteMap[c.calcId] || 'home';
          const proj = projects.find(p => p.id === c.projectId);
          return `<div class="recent-card" onclick="nav('${route}')">
            <div class="recent-strip" style="background:${color}"></div>
            <div style="flex:1;min-width:0">
              <div class="recent-name" style="white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${c.calcName}</div>
              <div class="recent-meta">
                ${c.module} · ${c.unit}
                ${proj ? '· <span style="color:var(--blue)">' + proj.name + '</span>' : ''}
                · ${timeAgo(c.savedAt)}
              </div>
              ${c.notes ? `<div style="font-size:11px;color:var(--muted);margin-top:2px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;font-style:italic">${c.notes}</div>` : ''}
            </div>
            <div style="flex-shrink:0;font-size:11px;color:var(--hint)">›</div>
          </div>`;
        }).join('');
      }
    }
  } else {
    // ── RENDER ACTIVE PROJECT OVERVIEW ──
    pageHome.innerHTML = `
      <div class="project-overview-dashboard" style="font-family:var(--font, sans-serif); margin-bottom: 30px">
        <!-- Title row -->
        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:20px; gap:16px">
          <div>
            <h2 style="margin:0; font-size:24px; font-weight:800; color:var(--text)">Project Dashboard</h2>
            <p style="margin:4px 0 0 0; font-size:13px; color:var(--muted)">Manage and track calculators for your active project</p>
          </div>
          <div style="display:flex; gap:10px">
            <button onclick="window.ProjectService.setActiveProject(null)" class="calc-btn" style="background:var(--card); border:1px solid var(--border); color:var(--text); font-weight:700; margin:0; padding:8px 16px; font-size:13px; cursor:pointer; border-radius:8px">
              Close Project
            </button>
            <button onclick="nav('projects')" class="calc-btn blue" style="font-weight:700; margin:0; padding:8px 16px; font-size:13px">
              Manage Projects
            </button>
          </div>
        </div>

        <div style="display:grid; grid-template-columns: 1fr 340px; gap:22px; align-items:start">
          <!-- Left Column: Search, Filters, and Checklist of Calculators -->
          <div>
            <div style="background:var(--card); border:1px solid var(--border); border-radius:12px; padding:20px; box-shadow:0 4px 6px -1px rgba(0,0,0,0.05); margin-bottom:20px">
              <div style="display:flex; gap:12px; margin-bottom:16px; align-items:center">
                <div style="position:relative; flex:1">
                  <span style="position:absolute; left:12px; top:50%; transform:translateY(-50%); color:var(--hint)">🔍</span>
                  <input type="text" id="project-calc-search" oninput="window.filterProjectCalculators()" placeholder="Search calculators by name or tag..." 
                    style="width:100%; padding:10px 12px 10px 38px; border:1px solid var(--border); border-radius:8px; font-size:13px; background:var(--bg); color:var(--text); outline:none; box-sizing:border-box">
                </div>
              </div>

              <!-- Module Filters -->
              <div style="display:flex; flex-wrap:wrap; gap:8px; margin-bottom:16px">
                <button class="filter-pill active" data-module="all" onclick="window.setProjectModuleFilter('all')" style="padding:6px 12px; border-radius:20px; border:1px solid var(--blue); background:var(--blue); color:#fff; font-size:12px; font-weight:600; cursor:pointer; transition:all 0.15s">All Modules</button>
                <button class="filter-pill" data-module="HVAC" onclick="window.setProjectModuleFilter('HVAC')" style="padding:6px 12px; border-radius:20px; border:1px solid var(--border); background:var(--bg); color:var(--muted); font-size:12px; font-weight:600; cursor:pointer; transition:all 0.15s">HVAC</button>
                <button class="filter-pill" data-module="Plumbing" onclick="window.setProjectModuleFilter('Plumbing')" style="padding:6px 12px; border-radius:20px; border:1px solid var(--border); background:var(--bg); color:var(--muted); font-size:12px; font-weight:600; cursor:pointer; transition:all 0.15s">Plumbing</button>
                <button class="filter-pill" data-module="Fire" onclick="window.setProjectModuleFilter('Fire')" style="padding:6px 12px; border-radius:20px; border:1px solid var(--border); background:var(--bg); color:var(--muted); font-size:12px; font-weight:600; cursor:pointer; transition:all 0.15s">Fire Fighting</button>
                <button class="filter-pill" data-module="Electrical" onclick="window.setProjectModuleFilter('Electrical')" style="padding:6px 12px; border-radius:20px; border:1px solid var(--border); background:var(--bg); color:var(--muted); font-size:12px; font-weight:600; cursor:pointer; transition:all 0.15s">Electrical</button>
              </div>

              <!-- Status Filters -->
              <div style="display:flex; flex-wrap:wrap; gap:8px; border-top:1px solid var(--border); padding-top:12px; margin-bottom:16px">
                <button class="status-pill active" data-status="all" onclick="window.setProjectStatusFilter('all')" style="padding:4px 10px; border-radius:15px; border:none; background:var(--blue); color:#fff; font-size:11px; font-weight:600; cursor:pointer; transition:all 0.15s">All Statuses</button>
                <button class="status-pill" data-status="Not Started" onclick="window.setProjectStatusFilter('Not Started')" style="padding:4px 10px; border-radius:15px; border:none; background:var(--bg); color:var(--muted); font-size:11px; font-weight:600; cursor:pointer; transition:all 0.15s">⚪ Not Started</button>
                <button class="status-pill" data-status="Started" onclick="window.setProjectStatusFilter('Started')" style="padding:4px 10px; border-radius:15px; border:none; background:var(--bg); color:var(--muted); font-size:11px; font-weight:600; cursor:pointer; transition:all 0.15s">🟡 Started</button>
                <button class="status-pill" data-status="Completed" onclick="window.setProjectStatusFilter('Completed')" style="padding:4px 10px; border-radius:15px; border:none; background:var(--bg); color:var(--muted); font-size:11px; font-weight:600; cursor:pointer; transition:all 0.15s">🟢 Completed</button>
              </div>

              <!-- Calculators Checklist Container -->
              <div id="project-calculators-list" style="display:flex; flex-direction:column; gap:8px; max-height: 600px; overflow-y: auto; padding-right:4px">
                <!-- Dynamically populated rows -->
              </div>
            </div>
          </div>

          <!-- Right Column: Project Details and Metrics -->
          <div style="display:flex; flex-direction:column; gap:16px; position:sticky; top:20px">
            <!-- Project Card -->
            <div style="background:var(--card); border:1px solid var(--border); border-radius:12px; padding:20px; box-shadow:0 4px 6px -1px rgba(0,0,0,0.05)">
              <div style="display:flex; align-items:center; gap:8px; margin-bottom:16px">
                <span style="font-size:24px">📁</span>
                <div style="min-width:0; flex:1">
                  <h3 style="margin:0; font-size:18px; font-weight:700; color:var(--text); white-space:nowrap; overflow:hidden; text-overflow:ellipsis" id="project-card-name"></h3>
                  <span style="font-size:11px; color:var(--hint)" id="project-card-number"></span>
                </div>
              </div>

              <div style="display:flex; flex-direction:column; gap:12px; font-size:12.5px; border-top: 1px solid var(--border); padding-top:14px">
                <div style="display:flex; justify-content:space-between"><span style="color:var(--muted)">Client:</span><span style="font-weight:600; color:var(--text)" id="project-card-client"></span></div>
                <div style="display:flex; justify-content:space-between"><span style="color:var(--muted)">Location:</span><span style="font-weight:600; color:var(--text)" id="project-card-location"></span></div>
                <div style="display:flex; justify-content:space-between"><span style="color:var(--muted)">Created:</span><span style="color:var(--text-sec)" id="project-card-created"></span></div>
                <div style="display:flex; justify-content:space-between"><span style="color:var(--muted)">Last Modified:</span><span style="color:var(--text-sec)" id="project-card-modified"></span></div>
                <div style="display:flex; justify-content:space-between"><span style="color:var(--muted)">Created By:</span><span style="font-weight:600; color:var(--text-sec)" id="project-card-creator"></span></div>
                <div style="display:flex; flex-direction:column; gap:4px; border-top: 1px dashed var(--border); padding-top:10px">
                  <span style="color:var(--muted)">Description:</span>
                  <span style="font-style:italic; color:var(--text-sec); font-size:12px; line-height:1.4" id="project-card-description"></span>
                </div>
                <div style="display:flex; flex-direction:column; gap:4px; border-top: 1px dashed var(--border); padding-top:10px" id="project-card-notes-container">
                  <span style="color:var(--muted)">Notes:</span>
                  <span style="font-style:italic; color:var(--text-sec); font-size:12px; line-height:1.4" id="project-card-notes"></span>
                </div>
              </div>
            </div>

            <!-- Progress Card -->
            <div style="background:var(--card); border:1px solid var(--border); border-radius:12px; padding:20px; box-shadow:0 4px 6px -1px rgba(0,0,0,0.05)">
              <h4 style="margin:0 0 12px 0; font-size:14px; font-weight:700; color:var(--text)">Project Completion</h4>
              
              <div style="display:flex; align-items:center; justify-content:space-between; margin-bottom:8px">
                <span style="font-size:24px; font-weight:800; color:var(--brand)" id="project-progress-percent">0%</span>
                <span style="font-size:12px; color:var(--muted)" id="project-progress-ratio">0 of 0 Completed</span>
              </div>

              <div style="width:100%; height:8px; background:var(--bg); border-radius:4px; overflow:hidden; margin-bottom:20px; border:1px solid var(--border)">
                <div id="project-progress-bar" style="width:0%; height:100%; background:#22c55e; transition:width 0.4s ease-out"></div>
              </div>

              <div style="display:grid; grid-template-columns:repeat(3,1fr); gap:8px; text-align:center">
                <div style="background:var(--bg); padding:8px; border-radius:8px; border:1px solid var(--border)">
                  <div style="font-size:9px; font-weight:700; color:var(--muted); text-transform:uppercase">Completed</div>
                  <div style="font-size:15px; font-weight:800; color:#22c55e" id="project-count-completed">0</div>
                </div>
                <div style="background:var(--bg); padding:8px; border-radius:8px; border:1px solid var(--border)">
                  <div style="font-size:9px; font-weight:700; color:var(--muted); text-transform:uppercase">Started</div>
                  <div style="font-size:15px; font-weight:800; color:#f59e0b" id="project-count-started">0</div>
                </div>
                <div style="background:var(--bg); padding:8px; border-radius:8px; border:1px solid var(--border)">
                  <div style="font-size:9px; font-weight:700; color:var(--muted); text-transform:uppercase">Not Started</div>
                  <div style="font-size:15px; font-weight:800; color:#94a3b8" id="project-count-notstarted">0</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    `;

    // Bind Project Details data to Project Details Card
    document.getElementById('project-card-name').textContent = activeProj.projectName;
    document.getElementById('project-card-number').textContent = activeProj.projectNumber ? '#' + activeProj.projectNumber : '';
    document.getElementById('project-card-client').textContent = activeProj.client || '—';
    document.getElementById('project-card-location').textContent = activeProj.location || '—';
    document.getElementById('project-card-created').textContent = new Date(activeProj.createdDate).toLocaleDateString();
    document.getElementById('project-card-modified').textContent = new Date(activeProj.lastModified).toLocaleDateString() + ' ' + new Date(activeProj.lastModified).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'});
    document.getElementById('project-card-creator').textContent = activeProj.createdBy || 'Admin';
    document.getElementById('project-card-description').textContent = activeProj.description || 'No description provided.';
    if (activeProj.notes) {
      document.getElementById('project-card-notes').textContent = activeProj.notes;
      document.getElementById('project-card-notes-container').style.display = 'flex';
    } else {
      document.getElementById('project-card-notes-container').style.display = 'none';
    }

    // Set filter states
    window.projectCalcSearchQuery = '';
    window.projectCalcModuleFilter = 'all';
    window.projectCalcStatusFilter = 'all';

    // Update list & metrics
    window.updateProjectCalculatorsList();
  }
}

function updateProjectCalculatorsList() {
  const activeProj = window.ProjectService ? window.ProjectService.getActiveProject() : null;
  if (!activeProj) return;

  const container = document.getElementById('project-calculators-list');
  if (!container) return;

  const query = (window.projectCalcSearchQuery || '').toLowerCase().trim();
  const moduleFilter = window.projectCalcModuleFilter || 'all';
  const statusFilter = window.projectCalcStatusFilter || 'all';

  // 1. Compute stats across ALL searchIndex calculators
  let completed = 0;
  let started = 0;
  let notStarted = 0;

  searchIndex.forEach(c => {
    const state = activeProj.calculations[c.route];
    const status = state ? state.status : 'Not Started';
    if (status === 'Completed') completed++;
    else if (status === 'Started') started++;
    else notStarted++;
  });

  const total = searchIndex.length;
  const progressPercent = total > 0 ? Math.round((completed / total) * 100) : 0;

  // Update DOM metrics
  const progressPercentEl = document.getElementById('project-progress-percent');
  const progressRatioEl = document.getElementById('project-progress-ratio');
  const progressBarEl = document.getElementById('project-progress-bar');
  const countCompletedEl = document.getElementById('project-count-completed');
  const countStartedEl = document.getElementById('project-count-started');
  const countNotStartedEl = document.getElementById('project-count-notstarted');

  if (progressPercentEl) progressPercentEl.textContent = progressPercent + '%';
  if (progressRatioEl) progressRatioEl.textContent = `${completed} of ${total} Completed`;
  if (progressBarEl) progressBarEl.style.width = progressPercent + '%';
  if (countCompletedEl) countCompletedEl.textContent = completed;
  if (countStartedEl) countStartedEl.textContent = started;
  if (countNotStartedEl) countNotStartedEl.textContent = notStarted;

  // 2. Filter calculators for display
  const filtered = searchIndex.filter(c => {
    const state = activeProj.calculations[c.route];
    const status = state ? state.status : 'Not Started';

    // Search query filter
    const nameMatch = c.name.toLowerCase().includes(query);
    const tagMatch = c.tags && c.tags.some(t => t.toLowerCase().includes(query));
    const queryMatch = nameMatch || tagMatch;

    // Module filter
    const category = c.module;
    const moduleMatch = (moduleFilter === 'all' || category === moduleFilter);

    // Status filter
    const statusMatch = (statusFilter === 'all' || status === statusFilter);

    return queryMatch && moduleMatch && statusMatch;
  });

  if (filtered.length === 0) {
    container.innerHTML = `
      <div style="text-align:center; padding:30px 10px; color:var(--hint); font-size:12.5px; font-style:italic">
        No calculators match the active search/filters.
      </div>
    `;
    return;
  }

  container.innerHTML = filtered.map(c => {
    const state = activeProj.calculations[c.route];
    const status = state ? state.status : 'Not Started';
    const modified = state && state.lastModified 
      ? new Date(state.lastModified).toLocaleDateString()
      : 'Never';

    // Stylings for badges
    let statusColor = '#94a3b8';
    let statusBg = 'rgba(148,163,184,0.1)';
    if (status === 'Completed') {
      statusColor = '#22c55e';
      statusBg = 'rgba(34,197,94,0.1)';
    } else if (status === 'Started') {
      statusColor = '#f59e0b';
      statusBg = 'rgba(245,158,11,0.1)';
    }

    const moduleColor = moduleColors[c.module] || 'var(--blue)';

    return `
      <div style="display:flex; align-items:center; justify-content:space-between; padding:10px 14px; border:1px solid var(--border); border-radius:8px; background:var(--bg); transition:transform 0.15s, box-shadow 0.15s"
        onmouseover="this.style.transform='translateY(-1px)'; this.style.boxShadow='0 2px 4px rgba(0,0,0,0.05)'"
        onmouseout="this.style.transform='none'; this.style.boxShadow='none'">
        <div style="display:flex; align-items:center; gap:12px; min-width:0; flex:1">
          <span style="font-size:18px">${c.icon || '📐'}</span>
          <div style="min-width:0; flex:1">
            <div style="font-weight:600; font-size:13px; color:var(--text); white-space:nowrap; overflow:hidden; text-overflow:ellipsis" title="${c.name}">${c.name}</div>
            <div style="display:flex; align-items:center; gap:8px; margin-top:3px; font-size:11px">
              <span style="background:${moduleColor}15; color:${moduleColor}; padding:1px 6px; border-radius:4px; font-weight:700">${c.module}</span>
              <span style="color:var(--hint)">Modified: ${modified}</span>
            </div>
          </div>
        </div>

        <div style="display:flex; align-items:center; gap:12px">
          <!-- Status Badge -->
          <span style="font-size:10px; font-weight:700; background:${statusBg}; color:${statusColor}; padding:3px 8px; border-radius:12px; text-transform:uppercase; letter-spacing:0.3px">${status}</span>
          <button onclick="nav('${c.route}')" class="calc-btn blue" style="margin:0; padding:6px 12px; font-size:12px; font-weight:700">Open</button>
        </div>
      </div>
    `;
  }).join('');
}

function filterProjectCalculators() {
  const input = document.getElementById('project-calc-search');
  if (input) {
    window.projectCalcSearchQuery = input.value;
    window.updateProjectCalculatorsList();
  }
}

function setProjectModuleFilter(moduleName) {
  window.projectCalcModuleFilter = moduleName;
  
  // Toggle active class on pills
  const pills = document.querySelectorAll('.filter-pill');
  pills.forEach(pill => {
    if (pill.getAttribute('data-module') === moduleName) {
      pill.classList.add('active');
      pill.style.background = 'var(--blue)';
      pill.style.color = '#fff';
      pill.style.borderColor = 'var(--blue)';
    } else {
      pill.classList.remove('active');
      pill.style.background = 'var(--bg)';
      pill.style.color = 'var(--muted)';
      pill.style.borderColor = 'var(--border)';
    }
  });

  window.updateProjectCalculatorsList();
}

function setProjectStatusFilter(statusName) {
  window.projectCalcStatusFilter = statusName;

  // Toggle active class on pills
  const pills = document.querySelectorAll('.status-pill');
  pills.forEach(pill => {
    if (pill.getAttribute('data-status') === statusName) {
      pill.classList.add('active');
      pill.style.background = 'var(--blue)';
      pill.style.color = '#fff';
    } else {
      pill.classList.remove('active');
      pill.style.background = 'var(--bg)';
      pill.style.color = 'var(--muted)';
    }
  });

  window.updateProjectCalculatorsList();
}

// Bind helper methods globally
window.updateProjectCalculatorsList = updateProjectCalculatorsList;
window.filterProjectCalculators = filterProjectCalculators;
window.setProjectModuleFilter = setProjectModuleFilter;
window.setProjectStatusFilter = setProjectStatusFilter;

// Refresh home whenever we navigate to it
const _origNav=nav;
nav=function(page){
  _origNav(page);
  if(page==='home') renderHome();
};

// Also refresh home after every save
setTimeout(() => {
  if (typeof confirmSave === 'function') {
    const _origConfirmSave=confirmSave;
    confirmSave=function(){
      _origConfirmSave();
      renderHome();
    };
  }
}, 100);

let searchActive = false;

function handleSearch(query) {
  const q = query.trim();

  const clearBtn = document.getElementById('search-clear-btn');
  clearBtn.style.display = q ? 'block' : 'none';

  if (!q) {
    showSidebarNav();
    if (searchActive) { searchActive = false; nav('home'); }
    return;
  }

  searchActive = true;
  const lower = q.toLowerCase();

  const results = searchIndex.filter(item => {
    const nameMatch = item.name.toLowerCase().includes(lower);
    const tagMatch = item.tags.some(t => t.toLowerCase().includes(lower));
    const moduleMatch = item.module.toLowerCase().includes(lower);
    return nameMatch || tagMatch || moduleMatch;
  }).map(item => {
    // Score: name match ranks higher
    const nameMatch = item.name.toLowerCase().includes(lower);
    return { ...item, score: nameMatch ? 2 : 1 };
  }).sort((a, b) => b.score - a.score);

  // Show results in sidebar panel
  document.getElementById('sidebar-nav').style.display = 'none';
  const panel = document.getElementById('sidebar-search-results');
  panel.style.display = 'block';

  if (!results.length) {
    panel.innerHTML = `<div style="text-align:center;padding:24px 12px;color:var(--hint);font-size:12px;line-height:1.7">
      No calculators found for<br><strong style="color:var(--text)">"${q}"</strong>
    </div>`;
    return;
  }

  panel.innerHTML = results.map(r => {
    const highlighted = r.name.replace(
      new RegExp(`(${q.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')})`, 'gi'),
      '<span class="search-highlight">$1</span>'
    );
    return `<div onclick="searchNavTo('${r.route}')" style="display:flex;align-items:center;gap:10px;padding:9px 10px;border-radius:8px;cursor:pointer;transition:background .1s;margin-bottom:2px" 
      onmouseover="this.style.background='var(--bg)'" onmouseout="this.style.background='transparent'">
      <div style="width:32px;height:32px;border-radius:8px;background:${r.color}18;display:flex;align-items:center;justify-content:center;font-size:15px;flex-shrink:0">${r.icon}</div>
      <div style="min-width:0">
        <div style="font-size:12px;font-weight:700;color:var(--text)">${highlighted}</div>
        <div style="font-size:10px;color:var(--muted);margin-top:1px">${r.module}</div>
      </div>
    </div>`;
  }).join('');

  // Also update the main content search page
  showSearchPage(q, results);
}

function showSearchPage(q, results) {
  // Activate search page in main content
  document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
  document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
  document.getElementById('page-search').classList.add('active');

  document.getElementById('search-results-heading').textContent =
    results.length ? `${results.length} result${results.length !== 1 ? 's' : ''} for "${q}"` : `No results for "${q}"`;
  document.getElementById('search-results-sub').textContent =
    results.length ? 'Tap any calculator to open it' : 'Try a different search term';

  const list = document.getElementById('search-results-list');

  if (!results.length) {
    list.innerHTML = `<div class="search-no-results">
      Try searching for: <br>
      <span style="color:var(--blue);cursor:pointer;font-weight:600" onclick="document.getElementById('sidebar-search').value='pump';handleSearch('pump')">pump</span> · 
      <span style="color:var(--blue);cursor:pointer;font-weight:600" onclick="document.getElementById('sidebar-search').value='duct';handleSearch('duct')">duct</span> · 
      <span style="color:var(--blue);cursor:pointer;font-weight:600" onclick="document.getElementById('sidebar-search').value='sprinkler';handleSearch('sprinkler')">sprinkler</span> · 
      <span style="color:var(--blue);cursor:pointer;font-weight:600" onclick="document.getElementById('sidebar-search').value='pipe';handleSearch('pipe')">pipe</span>
    </div>`;
    return;
  }

  // Group by module
  const grouped = {};
  results.forEach(r => {
    if (!grouped[r.module]) grouped[r.module] = [];
    grouped[r.module].push(r);
  });

  list.innerHTML = Object.entries(grouped).map(([module, items]) => `
    <div style="margin-bottom:20px">
      <div style="font-size:10px;font-weight:800;letter-spacing:1.2px;color:var(--hint);text-transform:uppercase;margin-bottom:10px">${module}</div>
      ${items.map(r => {
        const highlighted = r.name.replace(
          new RegExp(`(${q.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')})`, 'gi'),
          '<span class="search-highlight">$1</span>'
        );
        // Find matching tags for context
        const lower = q.toLowerCase();
        const matchedTag = r.tags.find(t => t.toLowerCase().includes(lower) && !r.name.toLowerCase().includes(lower));
        return `<div class="search-result-item" onclick="searchNavTo('${r.route}')">
          <div class="search-result-icon" style="background:${r.color}18">${r.icon}</div>
          <div style="flex:1;min-width:0">
            <div class="search-result-name">${highlighted}</div>
            <div class="search-result-meta">${r.module}${matchedTag ? ' · matches: ' + matchedTag : ''}</div>
          </div>
          <div style="color:var(--hint);font-size:14px">›</div>
        </div>`;
      }).join('')}
    </div>`).join('');
}

function searchNavTo(route) {
  clearSearch();
  nav(route);
}

function showSidebarNav() {
  document.getElementById('sidebar-nav').style.display = 'block';
  document.getElementById('sidebar-search-results').style.display = 'none';
}

function clearSearch() {
  const inp = document.getElementById('sidebar-search');
  inp.value = '';
  document.getElementById('search-clear-btn').style.display = 'none';
  showSidebarNav();
  searchActive = false;
}

// ══════════════════════════════════════════════════════
// POLISH - BREADCRUMB IN CALC HEADERS
// ══════════════════════════════════════════════════════

// Map page ids to their parent module nav id
const pageModuleMap = {
  'augmintech':'augmintech','bimmep':'bimmep',
  'psychrometric':'hvac','duct-sizer':'hvac','pump-head':'hvac','hvac-pipe':'hvac',
  'ventilation':'hvac','heat-load':'hvac','esp':'hvac','diffuser':'hvac',
  'water-demand':'plumbing','water-pipe':'plumbing','drainage':'plumbing',
  'tank-sizing':'plumbing','booster-pump':'plumbing',
  'k-factor':'fire','hazen-williams':'fire','standpipe':'fire',
  'fire-pump':'fire','fire-tank':'fire',
};
const moduleFirstPage = {hvac:'psychrometric',plumbing:'water-demand',fire:'k-factor'};
const moduleLabel = {hvac:'HVAC',plumbing:'Plumbing',fire:'Fire Fighting'};

// ══════════════════════════════════════════════════════
// INIT
// ══════════════════════════════════════════════════════
window.initApplicationBootstrap = function() {
buildFittings();
buildFixtures();
buildDrainFixtures();
buildFUFixtures();
buildDUFixtures();
buildFireFittings();
buildConduitRows();
buildPanelRows();
buildLuxSpaceDropdown('office');
buildACHSpaces('office');
buildEnergyRows();
buildDCChecks();
buildCableTypeGuide();
buildElecSelectors();
buildMEPSelectors();
buildPipeMaterialGuide();
buildConvTabs();
// Auto-fire tools that show live results
setTimeout(()=>{calcSiteTools();calcFVPipe();calcFVDuct();calcFVReverse();calcPipeWeight();calcPumpPowerQuick();calcEQ('kw');},100);
buildRules();
buildStandards();
renderProjects();
renderHome();
initSections();
calcPump();
const pumpResEl = document.getElementById('pump-res');
if (pumpResEl) {
  pumpResEl.style.display='block';
  injectSaveBar('pump-res');
}
calcKFactor();
const kfResEl = document.getElementById('kf-res');
if (kfResEl) {
  kfResEl.style.display='block';
  injectSaveBar('kf-res');
}
// Restore persisted preferences
const savedUnit=lsGet('mep_unit');
if(savedUnit) setUnit(savedUnit);
const savedTheme=lsGet('mep_theme')||'light';
setTheme(savedTheme);
// Navigate to last page or home to ensure proper page initialization
const lastPage = localStorage.getItem('mep_last_page');
if (lastPage) {
  nav(lastPage);
} else {
  nav('home');
}
// Onboarding - runs last so everything is ready
checkOnboarding();
};

// ══════════════════════════════════════════════════════
// CHARTS & DIAGRAMS - MEP Design Calculation (v2 - fixed overlaps)
// ══════════════════════════════════════════════════════

const _chartResMap={
  'fresh-air-load-chart':'fresh-air-load-res',
  'pump-chart':'pump-res','vd-chart':'vd-res','hl-chart':'hl-res',
  'tx-chart':'tx-res','kf-chart':'kf-res','fl-chart':'fl-res',
  'cop-chart':'cop-res','dr-chart':'dr-res','gen-chart':'gen-res',
  'esp-chart':'esp-res','fp-chart':'fp-res','fp2-chart':'fp2-res',
  'duct-chart':'duct-res',
  'psych-chart':'psych-res',
  'hunters-chart':'hunters-res',
  'drainage-chart':'drain-res',
  'firetank-chart':'ft-res',
  'diffuser-chart':'df-res',
  'waterpipe-chart':'wp-res',
  'standpipe-chart':'sp-res',
  'current-chart':'el-load-res',
  'earthing-chart':'earth-res',
  'sc-chart':'sc-res',
  'ups-chart':'ups-res',
  'airflow-chart':'af-res',
  'coil-chart':'cc-res',
  'sat-chart':'sat-res',
  'ct-chart':'ct-res',
  'condensate-chart':'cond-res',
  'hotwater-chart':'hw-res',
  'pressfix-chart':'pf-res',
  'fu-chart':'fu-res',
  'du-chart':'du-res',
  'gravflow-chart':'gf-res',
  'sewagepump-chart':'sewage-pump-res',
  'rainwater-chart':'rw-res',
  'sprinkdensity-chart':'sd-res',
  'sprinkspacing-chart':'ss-res',
  'firewaterdemand-chart':'fwd-res',
  'npsh-chart':'ns-res',
  'breaker-chart':'cb-res',
  'vdopt-chart':'vo-res',
  'panel-chart':'pl-res',
  'motor-chart':'mot-res',
  'conduit-chart':'conduit-res',
  'roompress-chart':'rp-res',
  'equipheat-chart':'eh-res',
  'heatload-chart':'heat-res',
  'insulation-chart':'ins-res',
  'waterhammer-chart':'wh-res',
  'energy-chart':'energy-res',
  'powertriangle-chart':'pt-results',
  'pumppowerquick-chart':'ppq-res','hvac-pipe-chart':'hvac-pipe-res','vent-chart':'vent-res',
  'hazen-chart':'hazen-res','load-chart':'load-res','pfc-chart':'pfc-res',
  'lighting-chart':'lg-res','booster-chart':'bp-res','cable-chart':'cable-res',
  'tank-chart':'tank-res',
  'elec-tray-chart':'elec-tray-res',
  'elec-cbs-chart':'elec-cbs-res',
  'elec-density-chart':'elec-density-res'
};
const _chartMoveTimers={};
function showChart(id, html){
  let el=document.getElementById(id);
  if(!el){
    // Try mapped result container first, then fall back to active page
    const resId=_chartResMap[id]||'';
    const resEl=resId?document.getElementById(resId):null;
    const fallback=resEl||document.querySelector('.page.active');
    if(!fallback) return;
    el=document.createElement('div');
    el.id=id; el.className='calc-chart';
    el.style.cssText='margin-top:0';
    fallback.appendChild(el);
  }
  el.innerHTML=html;
  el.style.display='block';
  // Move chart into left column (below inputs/calculate btn) on two-col pages
  clearTimeout(_chartMoveTimers[id]);
  _chartMoveTimers[id]=setTimeout(()=>{
    if(el&&el.parentElement){
      const page=el.closest('.two-col-page');
      if(page){
        const leftCol=page.querySelector('.calc-col-left');
        if(leftCol){
          leftCol.appendChild(el);
          leftCol.classList.add('has-chart');
        } else page.appendChild(el);
      } else {
        el.parentElement.appendChild(el);
      }
    }
  },30);
}


