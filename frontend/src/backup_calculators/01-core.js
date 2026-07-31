let currentUnit='ip';
let psychParam='rh';
let kSolveFor='Q';
let ductShape='round';
let buildingType='priv';
let drainType='branch';
let ventMethod='ashrae';
let fireTankType='combined';
let pipeMaterialEps=0.000046;

var _rvNaN = false;
var pageToSection = {
  home: null,
  psychrometric:'hvac','duct-sizer':'hvac','pump-head':'hvac','hvac-pipe':'hvac',
  ventilation:'hvac','heat-load':'hvac',esp:'hvac',diffuser:'hvac','smoke-extract':'hvac',
  'water-demand':'plumbing','water-pipe':'plumbing','drainage':'plumbing',
  'tank-sizing':'plumbing','booster-pump':'plumbing',
  'k-factor':'fire','hazen-williams':'fire','standpipe':'fire',
  'fire-pump':'fire','fire-tank':'fire',
  'elec-load':'elec','elec-current':'elec','elec-cable':'elec',
  'elec-vdrop':'elec','elec-transformer':'elec','elec-generator':'elec',
  'elec-pfc':'elec','elec-lighting':'elec','elec-earth':'elec',
  'elec-sc':'elec','elec-ups':'elec',
};

var calcRouteMap = {
  psychrometric:'psychrometric',duct_sizer:'duct-sizer',pump_head:'pump-head',
  hvac_pipe:'hvac-pipe',ventilation:'ventilation',heat_load:'heat-load',
  esp:'esp',diffuser:'diffuser',
  water_demand:'water-demand',water_pipe:'water-pipe',drainage:'drainage',
  tank_sizing:'tank-sizing',booster_pump:'booster-pump',
  k_factor:'k-factor',hazen_williams:'hazen-williams',standpipe:'standpipe',
  fire_pump:'fire-pump',fire_tank:'fire-tank',
  elec_load:'elec-load',elec_current:'elec-current',elec_cable:'elec-cable',
  elec_vdrop:'elec-vdrop',elec_transformer:'elec-transformer',elec_generator:'elec-generator',
  elec_pfc:'elec-pfc',elec_lighting:'elec-lighting',elec_earth:'elec-earth',
  elec_sc:'elec-sc',elec_ups:'elec-ups',
};


// ── NAVIGATION ──
function nav(page){
  if (typeof window.loadCalculator === 'function') {
    window.loadCalculator(page);
  }
  document.querySelectorAll('.page').forEach(p=>p.classList.remove('active'));
  document.querySelectorAll('.nav-item').forEach(n=>n.classList.remove('active'));
  const pg=document.getElementById('page-'+page);
  if(pg){
    pg.classList.add('active');
    applyCalcLayout(pg); // ← universal two-col transformer
  }
  const ni=document.getElementById('nav-'+page);
  if(ni) ni.classList.add('active');
  
  // Highlight the active section in the sidebar
  updateActiveSectionHighlight();

  // Always scroll content area back to top when navigating
  const contentEl=document.querySelector('.content');
  if(contentEl){contentEl.scrollTop=0;}
  // Show/hide training strip
  const strip=document.getElementById('training-strip');
  if(strip){
    const hideOn=['home','settings','projects','augmintech','bimmep','search'];
    strip.style.display=hideOn.includes(page)?'none':'block';
  }
  // Initialize specific modules
  if(page === 'ventilation' && typeof initVentilation === 'function') {
    initVentilation();
  }
}

function updateActiveSectionHighlight() {
  document.querySelectorAll('.sidebar-section').forEach(sec => sec.classList.remove('active'));
  const activeNavItem = document.querySelector('.nav-item.active');
  if (activeNavItem) {
    const group = activeNavItem.closest('.sidebar-group');
    if (group && group.id) {
      const secId = group.id.replace('group-', 'sec-');
      const secEl = document.getElementById(secId);
      if (secEl) {
        secEl.classList.add('active');
      }
    }
  }
}


function showRes(id){
  const el=document.getElementById(id);
  if(!el) return;
  // Use flex so gap spacing works in two-col right column
  el.style.display='flex';
  el.style.flexDirection='column';
  el.style.gap='10px';
  // Hide companion placeholder if present
  const ph=document.getElementById(id+'-placeholder');
  if(ph) ph.style.display='none';
}

// ════════════════════════════════════════════════════════════════
// UNIVERSAL TWO-COLUMN LAYOUT TRANSFORMER
// Auto-applies 50/50 grid to all calculator pages on nav
// ════════════════════════════════════════════════════════════════
const _SKIP_LAYOUT=new Set([
  'page-home','page-search','page-settings','page-projects',
  'page-augmintech','page-bimmep','page-standards','page-thumb-rules',
  'page-unit-converter','page-tool-site','page-tool-selector-elec',
  'page-tool-selector-mep','page-tool-pipe-material','page-elec-energy',
  'page-tool-design-check', 'page-elec-design-check',
  'page-fixture-unit', 'page-discharge-unit', 'page-rainwater',
  'page-elec-density-wsf', 'page-elec-tray',
]);

function _calcIcon(id){
  if(/elec|cable|power|transformer|generator|pfc|lighting|earth|breaker|derating|motor|conduit|lux|sc-|ups-|vdopt|panel/.test(id)) return '⚡';
  if(/fire|sprinkl|standpipe|hose|hydrant|dry-pipe|fm200/.test(id)) return '🔥';
  if(/pump|pipe|water|drain|tank|rainwater|greywater|sewage|gravity|hammer|hazen|booster|hunters|fixture/.test(id)) return '💧';
  if(/duct|airflow|vent|diffuser|fresh|air-mix|mixing/.test(id)) return '🌬️';
  if(/heat|cool|chiller|coil|ahu|insulation|condensate|cooling-tower|ref-pipe|refriger/.test(id)) return '❄️';
  if(/sanity|check/.test(id)) return '🔍';
  if(/room-press|pressur/.test(id)) return '🏠';
  return '📐';
}
function _calcBadge(id){
  if(/elec|cable|power|transformer|generator|pfc|lighting|earth|breaker|derating|motor|conduit|lux|sc-|ups-|vdopt|panel/.test(id)) return '⚡ Electrical';
  if(/fire|sprinkl|standpipe|hose|hydrant|dry-pipe|fm200/.test(id)) return '🔥 Fire Fighting';
  if(/pump|water|drain|rainwater|greywater|sewage|gravity|hammer|hazen|booster|hunters|fixture/.test(id)) return '💧 Plumbing';
  if(/hvac-pipe|pipe-check|pipe-weight|pipe-expan|ref-pipe/.test(id)) return '🔧 Piping';
  if(/duct|airflow|vent|diffuser|fresh|air-mix|mixing|esp|fan/.test(id)) return '🌬️ HVAC · Air';
  if(/heat|cool|chiller|coil|ahu|insulation|condensate|cooling-tower|refriger|psychro|sat/.test(id)) return '❄️ HVAC · Thermal';
  if(/sanity|check/.test(id)) return '🔍 Design Check';
  if(/room-press|pressur/.test(id)) return '🏠 Room Comfort';
  if(/tank|storage/.test(id)) return '💧 Plumbing';
  return '📐 MEP';
}

function applyCalcLayout(pageEl){
  if(!pageEl||pageEl.dataset.layoutDone) return;
  if(_SKIP_LAYOUT.has(pageEl.id)){pageEl.dataset.layoutDone='1';return;}

  // Already structured manually (duct-sizer)
  if(pageEl.classList.contains('two-col-page')){
    pageEl.dataset.layoutDone='1';
    return;
  }

  // Must be a calculator page (has direct .calc-header child)
  const header=pageEl.querySelector(':scope>.calc-header');
  if(!header){pageEl.dataset.layoutDone='1';return;}

  // Find first result div (direct child, id ends with -res or is pl-res)
  const children=Array.from(pageEl.children);
  const resIdx=children.findIndex(el=>el.id&&(el.id==='pl-res'||/\-res$/.test(el.id)));
  if(resIdx===-1){pageEl.dataset.layoutDone='1';return;}

  pageEl.dataset.layoutDone='1';
  pageEl.classList.add('two-col-page');

  // Add category badge to the calc-header
  if(header && !header.querySelector('.two-col-header-badge')){
    const titleEl=header.querySelector('.calc-title');
    const stdEl=header.querySelector('.calc-std');
    // Wrap existing title/std in left div
    const leftDiv=document.createElement('div');
    leftDiv.className='two-col-header-left';
    if(titleEl) leftDiv.appendChild(titleEl);
    if(stdEl) leftDiv.appendChild(stdEl);
    header.insertBefore(leftDiv, header.firstChild);
    // Add badge
    const badge=document.createElement('div');
    badge.className='two-col-header-badge';
    badge.textContent=_calcBadge(pageEl.id);
    header.appendChild(badge);
  }

  // Find where description ends to know where left inputs start
  const descEl=pageEl.querySelector(':scope>.calc-desc');
  const descIdx=descEl?children.indexOf(descEl):children.indexOf(header);
  const leftStart=descIdx+1;

  const leftItems=children.slice(leftStart,resIdx);
  const rightItems=children.slice(resIdx);
  const resId=children[resIdx].id;

  // Build grid structure
  const grid=document.createElement('div');
  grid.className='calc-two-col';

  const leftCol=document.createElement('div');
  leftCol.className='calc-col-left';

  const rightCol=document.createElement('div');
  rightCol.className='calc-col-right';

  // Placeholder shown before first calculation
  const ph=document.createElement('div');
  ph.className='result-placeholder';
  ph.id=resId+'-placeholder';
  ph.innerHTML=`<div class="result-placeholder-icon">${_calcIcon(pageEl.id)}</div>
<div class="result-placeholder-text">Fill in the inputs on the left<br>and click <strong>Calculate</strong> to see results.</div>`;
  rightCol.appendChild(ph);

  leftItems.forEach(el=>leftCol.appendChild(el));
  rightItems.forEach(el=>rightCol.appendChild(el));

  const actualResEl = document.getElementById(resId);
  if (actualResEl && actualResEl.style.display !== 'none') {
    ph.style.display = 'none';
  }

  grid.appendChild(leftCol);
  grid.appendChild(rightCol);
  pageEl.appendChild(grid);
}

function toggleExpand(id){
  const el=document.getElementById(id);
  const arrow=document.getElementById(id+'-arrow');
  const vis=el.style.display!=='none';
  el.style.display=vis?'none':'block';
  if(arrow) arrow.textContent=vis?'▼':'▲';
}

// ── UNIT SYSTEM ──
function setUnit(u){
  currentUnit=u;
  document.getElementById('btnIP').classList.toggle('active',u==='ip');
  document.getElementById('btnSI').classList.toggle('active',u==='si');
  // Toggle body class so electrical unit notes show when IP is selected
  document.body.classList.toggle('unit-ip', u==='ip');
  updateUnitLabels(u);
}

function updateUnitLabels(u){
  const ip=u==='ip';
  setText('p-dbt-unit',ip?'°F':'°C');
  // Update psychrometric parameter unit when system changes
  if(psychParam==='wb') setText('p-param-unit',ip?'°F':'°C');
  else if(psychParam==='dp') setText('p-param-unit',ip?'°F':'°C');
  else if(psychParam==='w') setText('p-param-unit',ip?'gr/lb':'g/kg');
  setText('d-flow-unit',ip?'CFM':'L/s');
  setText('d-fr-unit',ip?'in w.g./100 ft':'Pa/m');
  setText('ph-flow-unit',ip?'GPM':'L/s');
  setText('ph-len-unit',ip?'ft':'m');
  setText('ph-temp-unit',ip?'°F':'°C');
  setText('ph-head-unit',ip?'ft':'m');
  setText('ph-eq-unit',ip?'ft w.g.':'m w.g.');
  setText('duty-flow-unit',ip?'GPM':'L/s');
  setText('duty-head-unit',ip?'ft w.g.':'m w.g.');
  setText('hp-flow-unit',ip?'GPM':'L/s');
  setText('hp-temp-unit',ip?'°F':'°C');
  setText('hp-dp-unit',ip?'ft w.g./100ft':'Pa/m');
  setText('v-area-unit',ip?'ft²':'m²');
  setText('v-ht-unit',ip?'ft':'ft'); // keep ft for both as it's just for room volume
  setText('ts-dem-unit',ip?'gal':'L');
  setText('ts-flow-unit',ip?'GPM':'L/s');
  setText('ts-pump-unit',ip?'GPM':'L/s');
  setText('kf-k-unit',ip?'GPM/√psi':'L/min/√bar');
  setText('hw-flow-unit',ip?'GPM':'L/min');
  setText('hw-len-unit',ip?'ft':'m');
  setText('fp-flow-unit',ip?'GPM':'L/min');
  setText('fp-press-unit',ip?'psi':'bar');
  setText('fp-suct-unit',ip?'ft':'m');
  setText('fp-disch-unit',ip?'psi':'bar');
  setText('fp-flow-disp-unit',ip?'GPM':'L/min');
  setText('fp-press-disp-unit',ip?'psi':'bar');
  setText('ft-sp-unit',ip?'GPM':'L/min');
  setText('ft-std-unit',ip?'GPM':'L/min');
  setText('ft-hs-unit',ip?'GPM':'L/min');
  setText('ft-mu-unit',ip?'GPM':'L/min');
  
  // Fresh Air Cooling Load
  setText('fal-dbt-in-unit', ip?'°F':'°C');
  setText('fal-wbt-in-unit', ip?'°F':'°C');
  setText('fal-dbt-out-unit', ip?'°F':'°C');
  setText('fal-wbt-out-unit', ip?'°F':'°C');
  setText('fal-flow-unit', ip?'CFM':'m³/s');
  if(typeof updateLiveRatios === 'function') updateLiveRatios();
  if(typeof calcFreshAirLoad === 'function') {
    // Only recalculate if result is currently visible (to avoid forcing calculations on empty panels)
    const resEl = document.getElementById('fresh-air-load-res');
    if (resEl && resEl.style.display !== 'none') {
      calcFreshAirLoad();
    }
  }

  // Condensate Drain Calculator
  const cdcFlowUnitEl = document.querySelector('.cdc-flow-unit-label');
  if (cdcFlowUnitEl) {
    cdcFlowUnitEl.textContent = ip ? '(CFM)' : '(L/s)';
  }
  const cdcTempUnits = document.querySelectorAll('.cdc-temp-unit');
  cdcTempUnits.forEach(el => el.textContent = ip ? '°F' : '°C');
  const cdcTempUnits2 = document.querySelectorAll('.cdc-temp-unit2');
  cdcTempUnits2.forEach(el => el.textContent = ip ? '°F' : '°C');
  
  if (typeof cdcRender === 'function') cdcRender();
  if (typeof cdcPreviewCalc === 'function') cdcPreviewCalc();

  // Basement Smoke Calculator
  const bsAreaUnitEls = document.querySelectorAll('.bs-area-unit-label, .bs-area-unit-label2');
  bsAreaUnitEls.forEach(el => el.textContent = ip ? '(ft²)' : '(m²)');
  
  const bsHeightUnitEls = document.querySelectorAll('.bs-height-unit-label');
  bsHeightUnitEls.forEach(el => el.textContent = ip ? '(ft)' : '(m)');

  const bsFlowUnitEls = document.querySelectorAll('.bs-flow-unit-label, .bs-flow-unit-label2, .bs-flow-unit-label3');
  bsFlowUnitEls.forEach(el => el.textContent = ip ? '(CFM)' : '(L/s)');

  // Storm Water Calculator
  const swAreaUnitEls = document.querySelectorAll('.sw-area-unit');
  swAreaUnitEls.forEach(el => el.textContent = ip ? '(ft²)' : '(m²)');
  const swIntensityUnitEls = document.querySelectorAll('.sw-intensity-unit');
  swIntensityUnitEls.forEach(el => el.textContent = ip ? '(in/hr)' : '(mm/hr)');
  const swFlowUnitEls = document.querySelectorAll('.sw-flow-unit');
  swFlowUnitEls.forEach(el => el.textContent = ip ? '(GPM)' : '(L/s)');

  if (typeof window.swLastUnit === 'undefined') {
    window.swLastUnit = 'si';
  }
  const currentUnitSys = ip ? 'ip' : 'si';
  if (window.swLastUnit !== currentUnitSys) {
    const swInputAreaEl = document.getElementById('sw-input-area');
    if (swInputAreaEl && swInputAreaEl.value !== '') {
      const val = parseFloat(swInputAreaEl.value);
      if (!isNaN(val)) {
        swInputAreaEl.value = ip ? (val * 10.7639).toFixed(0) : (val / 10.7639).toFixed(0);
      }
    }
    const swInputIntensityEl = document.getElementById('sw-input-intensity');
    if (swInputIntensityEl && swInputIntensityEl.value !== '') {
      const val = parseFloat(swInputIntensityEl.value);
      if (!isNaN(val)) {
        swInputIntensityEl.value = ip ? (val / 25.4).toFixed(1) : (val * 25.4).toFixed(0);
      }
    }
    if (window.swCatchments && window.swCatchments.length > 0) {
      window.swCatchments.forEach(item => {
        if (ip) {
          item.area = item.area * 10.7639;
          item.intensity = item.intensity / 25.4;
        } else {
          item.area = item.area / 10.7639;
          item.intensity = item.intensity * 25.4;
        }
      });
      if (typeof swSave === 'function') swSave();
    }
    window.swLastUnit = currentUnitSys;
    if (typeof swRenderTable === 'function') swRenderTable();
  }

  if (typeof bsRender === 'function') bsRender();
  if (typeof bsCalculate === 'function') bsCalculate();
  if (typeof calcRainwater === 'function') {
    const resEl = document.getElementById('rw-res');
    if (resEl && resEl.style.display !== 'none') {
      calcRainwater();
    }
  }
  if (typeof calcFM200 === 'function') {
    const resEl = document.getElementById('fm200-res');
    if (resEl && resEl.style.display !== 'none') {
      calcFM200();
    }
  }

  if(ip){document.getElementById('d-fr').value='0.08';}
  else{document.getElementById('d-fr').value='0.82';}
}
function setText(id,v){const el=document.getElementById(id);if(el)el.textContent=v;}

// ── MATH HELPERS ──
function colebrook(Re,relR){
  if(Re<=0) return 0.1;
  if(Re<2300) return 64/Re;
  let f=0.25/Math.pow(Math.log(relR/3.7+5.74/Math.pow(Re,0.9))/Math.LN10,2);
  for(let i=0;i<80;i++){
    const r=-2*Math.log((relR/3.7)+(2.51/(Re*Math.sqrt(f))))/Math.LN10;
    const fn=1/(r*r);
    if(Math.abs(fn-f)<1e-10){f=fn;break;}
    f=fn;
  }
  return f;
}
function waterDens(tC){return 999.842594+6.793952e-2*tC-9.09529e-3*tC**2+1.001685e-4*tC**3-1.120083e-6*tC**4+6.536332e-9*tC**5;}
function waterVisc(tC){return 2.414e-5*Math.pow(10,247.8/(tC+406.15));}
function satP(tK){
  if(tK>=273.15){const c8=-5.8002206e3,c9=1.3914993,c10=-4.864e-2,c11=4.1764768e-5,c12=-1.4452093e-8,c13=6.5459673;return Math.exp(c8/tK+c9+c10*tK+c11*tK**2+c12*tK**3+c13*Math.log(tK));}
  const c1=-5.6745359e3,c2=6.3925247,c3=-9.677843e-3,c4=6.2215701e-7,c5=2.0747825e-9,c6=-9.484024e-13,c7=4.1635019;
  return Math.exp(c1/tK+c2+c3*tK+c4*tK**2+c5*tK**3+c6*tK**4+c7*Math.log(tK));
}
function wFromRH(tC,rh,p){const pws=satP(tC+273.15);return 0.621945*(rh/100)*pws/(p-(rh/100)*pws);}
function wFromWB(td,tw,p){const ws=0.621945*satP(tw+273.15)/(p-satP(tw+273.15));return((2501-2.381*tw)*ws-1.006*(td-tw))/(2501+1.805*td-4.186*tw);}
function wFromDP(dp,p){const pws=satP(dp+273.15);return 0.621945*pws/(p-pws);}
function dewPt(w,p){const pw=w*p/(0.621945+w);let lo=-60,hi=80;for(let i=0;i<100;i++){const m=(lo+hi)/2;satP(m+273.15)<pw?lo=m:hi=m;if(hi-lo<0.001)break;}return(lo+hi)/2;}
function wetBulb(td,w,p){let lo=-60,hi=td;for(let i=0;i<100;i++){const m=(lo+hi)/2;wFromWB(td,m,p)<w?lo=m:hi=m;if(hi-lo<0.001)break;}return(lo+hi)/2;}
const fC=x=>(x*9/5+32);
const cToF=x=>(x*9/5+32);
const fToC=x=>((x-32)*5/9);

// ── GLOBAL UI DIALOGS ──
window.appAlert = function(title, msg, onOk){
  const modal = document.getElementById('app-modal');
  const titleEl = document.getElementById('app-modal-title');
  const msgEl = document.getElementById('app-modal-msg');
  const confirmBtn = document.getElementById('app-modal-confirm');
  const cancelBtn = document.getElementById('app-modal-cancel');
  if(!modal) return;
  titleEl.textContent = title;
  if (msg && msg.includes('<') && msg.includes('>')) {
    msgEl.innerHTML = msg;
  } else {
    msgEl.textContent = msg;
  }
  cancelBtn.style.display = 'none'; // Hide cancel for alerts
  confirmBtn.textContent = 'OK';
  modal.style.display = 'flex';
  const close = () => { modal.style.display = 'none'; };
  confirmBtn.onclick = () => { if(onOk) onOk(); close(); };
};

window.appConfirm = function(title, msg, onConfirm, onCancel){
  const modal = document.getElementById('app-modal');
  const titleEl = document.getElementById('app-modal-title');
  const msgEl = document.getElementById('app-modal-msg');
  const confirmBtn = document.getElementById('app-modal-confirm');
  const cancelBtn = document.getElementById('app-modal-cancel');
  if(!modal) return;
  titleEl.textContent = title;
  if (msg && msg.includes('<') && msg.includes('>')) {
    msgEl.innerHTML = msg;
  } else {
    msgEl.textContent = msg;
  }
  cancelBtn.style.display = 'block';
  confirmBtn.textContent = 'Confirm';
  modal.style.display = 'flex';
  const close = () => { modal.style.display = 'none'; };
  confirmBtn.onclick = () => { if(onConfirm) onConfirm(); close(); };
  cancelBtn.onclick = () => { if(onCancel) onCancel(); close(); };
};

window.appPrompt = function(title, msg, defaultValue, onOk){
  const modal = document.getElementById('app-modal');
  const titleEl = document.getElementById('app-modal-title');
  const msgEl = document.getElementById('app-modal-msg');
  const confirmBtn = document.getElementById('app-modal-confirm');
  const cancelBtn = document.getElementById('app-modal-cancel');
  if(!modal) return;
  titleEl.textContent = title;
  
  const oldInput = document.getElementById('app-modal-prompt-input');
  if (oldInput) oldInput.remove();
  
  if (msg && msg.includes('<') && msg.includes('>')) {
    msgEl.innerHTML = msg;
  } else {
    msgEl.textContent = msg;
  }
  
  const input = document.createElement('input');
  input.id = 'app-modal-prompt-input';
  input.type = 'text';
  input.value = defaultValue || '';
  input.className = 'inp';
  input.style.width = '100%';
  input.style.marginTop = '12px';
  input.style.boxSizing = 'border-box';
  msgEl.appendChild(input);
  
  cancelBtn.style.display = 'block';
  confirmBtn.textContent = 'Confirm';
  modal.style.display = 'flex';
  
  setTimeout(() => input.focus(), 50);
  
  const close = () => { 
    modal.style.display = 'none'; 
    const inp = document.getElementById('app-modal-prompt-input');
    if (inp) inp.remove();
  };
  
  confirmBtn.onclick = () => { 
    const val = input.value;
    if(onOk) onOk(val); 
    close(); 
  };
  cancelBtn.onclick = () => { 
    close(); 
  };
};

// Global keyboard shortcuts delegation (Ctrl+Z, Ctrl+Y, Ctrl+A, Ctrl+C, Ctrl+X, Ctrl+V)
document.addEventListener('keydown', function(e) {
  // Identify if target is an editable input, select, textarea, or contenteditable
  const target = e.target;
  const isEditable = target && (
    target.tagName === 'INPUT' || 
    target.tagName === 'SELECT' || 
    target.tagName === 'TEXTAREA' || 
    target.isContentEditable
  );

  // If focused on an editable input, we let the browser handle standard editing shortcuts natively
  if (isEditable) {
    return;
  }

  // Ctrl or Meta (Command key on Mac) must be pressed
  const isCtrl = e.ctrlKey || e.metaKey;
  if (!isCtrl) {
    return;
  }

  const key = e.key.toLowerCase();
  
  // Resolve active page ID
  const activePageEl = document.querySelector('.page.active');
  const activePageId = activePageEl ? activePageEl.id.replace('page-', '') : null;
  if (!activePageId) return;

  if (key === 'z') {
    const undoFn = window['appUndo_' + activePageId];
    if (typeof undoFn === 'function') {
      e.preventDefault();
      undoFn();
    }
  } else if (key === 'y') {
    const redoFn = window['appRedo_' + activePageId];
    if (typeof redoFn === 'function') {
      e.preventDefault();
      redoFn();
    }
  } else if (key === 'a') {
    const selectAllFn = window['appSelectAll_' + activePageId];
    if (typeof selectAllFn === 'function') {
      e.preventDefault();
      selectAllFn();
    }
  } else if (key === 'c') {
    const copyFn = window['appCopy_' + activePageId];
    if (typeof copyFn === 'function') {
      e.preventDefault();
      copyFn();
    }
  } else if (key === 'x') {
    const cutFn = window['appCut_' + activePageId];
    if (typeof cutFn === 'function') {
      e.preventDefault();
      cutFn();
    }
  } else if (key === 'v') {
    const pasteFn = window['appPaste_' + activePageId];
    if (typeof pasteFn === 'function') {
      e.preventDefault();
      pasteFn();
    }
  }
});

