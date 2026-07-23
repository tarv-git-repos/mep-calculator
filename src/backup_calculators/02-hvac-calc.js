// ── PSYCHROMETRIC CALC ──
function setPP(el,p){
  document.querySelectorAll('#page-psychrometric .chip').forEach(c=>c.classList.remove('sel'));
  el.classList.add('sel');
  psychParam=p;
  const ip=currentUnit==='ip';
  const labels={
    rh:['Relative Humidity','%'],
    wb:['Wet Bulb Temperature',ip?'°F':'°C'],
    dp:['Dew Point Temperature',ip?'°F':'°C'],
    w:['Humidity Ratio',ip?'gr/lb':'g/kg']
  };
  document.getElementById('p-param-label').textContent=labels[p][0];
  document.getElementById('p-param-unit').textContent=labels[p][1];
  document.getElementById('p-param').value='';
}
function calcPsych(){
  _rvNaN=false;
  const ip=currentUnit==='ip';
  const pAtm=(rv('p-atm'))*1000;
  let dbt=rv('p-dbt');
  let pv=rv('p-param');
  const tC=ip?fToC(dbt):dbt;
  let w;
  if(psychParam==='rh') w=wFromRH(tC,pv,pAtm);
  else if(psychParam==='wb') w=wFromWB(tC,ip?fToC(pv):pv,pAtm);
  else if(psychParam==='dp') w=wFromDP(ip?fToC(pv):pv,pAtm);
  else w=ip?pv/7000:pv/1000;
  if(w<0)w=0;
  const pws=satP(tC+273.15),pw=w*pAtm/(0.621945+w);
  const rh=Math.min(100,(pw/pws)*100);
  const dp=dewPt(w,pAtm),wb=wetBulb(tC,w,pAtm);
  const h=1.006*tC+w*(2501+1.805*tC);
  const v=0.287042*(tC+273.15)*(1+1.607858*w)/(pAtm/1000);
  const tu=ip?'°F':'°C';
  const fc=x=>ip?cToF(x).toFixed(1)+' '+tu:x.toFixed(1)+' '+tu;
  if(_rvNaN) return;
  document.getElementById('pr-dbt').textContent=fc(tC);
  document.getElementById('pr-wbt').textContent=fc(wb);
  document.getElementById('pr-dp').textContent=fc(dp);
  document.getElementById('pr-rh').textContent=rh.toFixed(1)+' %';
  document.getElementById('pr-w').textContent=ip?(w*7000).toFixed(2)+' gr/lb':(w*1000).toFixed(2)+' g/kg';
  document.getElementById('pr-h').textContent=ip?(h/2.326).toFixed(2)+' BTU/lb':h.toFixed(2)+' kJ/kg';
  document.getElementById('pr-v').textContent=ip?(v*0.062428).toFixed(4)+' ft³/lb':v.toFixed(4)+' m³/kg';
  document.getElementById('pr-pv').textContent=ip?(pw/6894.76).toFixed(4)+' psi':(pw/1000).toFixed(3)+' kPa';
  const wc=document.getElementById('psych-warn-card');
  const wb2=document.getElementById('psych-warns');
  const warns=[];
  if(rh>90) warns.push('RH '+rh.toFixed(1)+'% - Near saturation. Condensation risk on cold surfaces.');
  if(rh<20) warns.push('RH '+rh.toFixed(1)+'% - Very dry air. Check comfort and static electricity concerns.');
  if(tC>40) warns.push('DBT '+tC.toFixed(1)+'°C - High temperature. Verify application.');
  if(warns.length){wc.style.display='block';wb2.innerHTML=warns.map(w=>`<div class="warn-item"><span>⚠</span><span>${w}</span></div>`).join('');}
  else wc.style.display='none';
  try{renderPsychChart(tdb,rh,w,h,dp,ip);}catch(_e){}
}

// ── DUCT SIZER ──
function setDS(el,s){
  document.querySelectorAll('#page-duct-sizer .chip').forEach(c=>c.classList.remove('sel'));
  el.classList.add('sel'); ductShape=s;
  // Show/hide aspect ratio input for rectangular mode
  const arRow=document.getElementById('d-ar-row');
  if(arRow) arRow.style.display=s==='rect'?'block':'none';
  calcDuct();
}
function calcDuct(){
  _rvNaN=false;
  const ip=currentUnit==='ip';
  const Q=ip?(rv('d-flow'))*4.71947e-4:(rv('d-flow'))*1e-3;
  const frRaw=rv('d-fr');
  const frPaM=ip?frRaw*8.16828:frRaw;
  const rho=1.204,mu=1.81e-5,eps=0.00009;

  // ── Step 1: Solve for circular equivalent diameter using Darcy-Weisbach ──
  let lo=0.05,hi=2.0;
  for(let i=0;i<100;i++){
    const D=(lo+hi)/2,A=Math.PI*D*D/4,v=Q/A,Re=rho*v*D/mu;
    const f=colebrook(Re,eps/D),dP=f*rho*v*v/(2*D);
    dP>frPaM?lo=D:hi=D;
    if(hi-lo<0.0001)break;
  }
  const calcD=(lo+hi)/2; // calculated ideal diameter in m

  const wa=document.getElementById('duct-warn-area');wa.innerHTML='';
  if(!_checkInputs('duct-warn-area')) return;

  if(ductShape==='round'){
    // ── ROUND DUCT ──
    const stdMm=[100,125,150,175,200,225,250,275,300,325,350,375,400,450,500,550,600,650,700,750,800,900,1000,1100,1200];
    const stdMmVal=stdMm.find(d=>d/1000>=calcD)||1200;
    const D=stdMmVal/1000,A=Math.PI*D*D/4,v=Q/A,Re=rho*v*D/mu;
    const f=colebrook(Re,eps/D),dPM=f*rho*v*v/(2*D);
    const vFpm=v/0.00508;

    document.getElementById('duct-res-title').textContent='Round Duct Result';
    document.getElementById('dr-size-label').textContent='Standard Diameter';
    document.getElementById('ds-r-diam').textContent=ip?(stdMmVal/25.4).toFixed(0)+' in':stdMmVal+' mm';
    document.getElementById('dr-vel').textContent=ip?vFpm.toFixed(0)+' FPM':v.toFixed(2)+' m/s';
    document.getElementById('dr-fr').textContent=ip?(dPM/8.16828).toFixed(4)+' in/100ft':dPM.toFixed(3)+' Pa/m';
    document.getElementById('dr-re').textContent=Math.round(Re).toLocaleString();
    document.getElementById('dr-f').textContent=f.toFixed(5);
    document.getElementById('dr-regime').textContent=Re<2300?'Laminar':Re<4000?'Transitional':'Turbulent';
    document.getElementById('dfs1').textContent='D_calc = '+(calcD*1000).toFixed(1)+' mm → std = '+stdMmVal+' mm';
    document.getElementById('dfs2').textContent='Re = '+Math.round(Re).toLocaleString();
    document.getElementById('dfs3').textContent='f = '+f.toFixed(5);
    document.getElementById('dfs4').textContent=ip?(dPM/8.16828).toFixed(4)+' in/100ft':dPM.toFixed(3)+' Pa/m';
    // Hide rect-only rows
    document.getElementById('dr-rect-row').style.display='none';
    document.getElementById('dr-deq-row').style.display='none';

    if(vFpm>2500) wa.innerHTML='<div class="warn-card amber"><div class="warn-head amber">⚠ High Velocity</div><div class="warn-item"><span>⚠</span><span>'+vFpm.toFixed(0)+' FPM - High for main duct. Review pressure class (SMACNA).</span></div></div>';
    else if(vFpm<300) wa.innerHTML='<div class="warn-card amber"><div class="warn-head amber">⚠ Low Velocity</div><div class="warn-item"><span>⚠</span><span>'+vFpm.toFixed(0)+' FPM - Low. Settling risk in VAV at minimum flow.</span></div></div>';

  } else {
    // ── RECTANGULAR DUCT ──
    // Huebscher equivalent diameter: Deq = 1.30 × (a×b)^0.625 / (a+b)^0.25
    // From Deq (= calcD), solve for a and b given aspect ratio AR = a/b
    // Deq = 1.30 × (AR×b²)^0.625 / ((AR+1)×b)^0.25
    // Deq = 1.30 × AR^0.625 × b^1.25 / (AR+1)^0.25 / b^0.25
    // Deq = 1.30 × AR^0.625 × b^1.0 / (AR+1)^0.25
    // b = Deq × (AR+1)^0.25 / (1.30 × AR^0.625)
    const AR=parseFloat(document.getElementById('d-ar')?.value)||2.0;
    const Deq=calcD; // m
    const b=Deq*Math.pow(AR+1,0.25)/(1.30*Math.pow(AR,0.625));
    const a=AR*b;

    // Round to standard duct dimensions (multiples of 25mm / 1 inch)
    const roundDuct=v=>ip?Math.ceil(v/25.4*1)*1:Math.ceil(v*1000/25)*25; // 1" or 25mm increments
    const aRound=ip?Math.ceil(a/0.0254)*0.0254:Math.ceil(a*1000/25)*0.025;
    const bRound=ip?Math.ceil(b/0.0254)*0.0254:Math.ceil(b*1000/25)*0.025;

    // Recalculate Deq and friction for standard dimensions
    const DeqStd=1.30*Math.pow(aRound*bRound,0.625)/Math.pow(aRound+bRound,0.25);
    const Aduct=aRound*bRound;
    const v=Q/Aduct;
    const Re=rho*v*DeqStd/mu;
    const f=colebrook(Re,eps/DeqStd);
    const dPM=f*rho*v*v/(2*DeqStd);
    const vFpm=v/0.00508;

    const toMM=v=>ip?(v/0.0254).toFixed(0)+'"':(v*1000).toFixed(0)+' mm';
    const aStr=toMM(aRound),bStr=toMM(bRound);
    const deqStr=ip?(DeqStd/0.0254).toFixed(1)+' in':(DeqStd*1000).toFixed(0)+' mm';

    document.getElementById('duct-res-title').textContent='Rectangular Duct Result';
    document.getElementById('dr-size-label').textContent='Recommended Size';
    document.getElementById('ds-r-diam').textContent=aStr+' × '+bStr;
    document.getElementById('dr-wh').textContent=aStr+' (W) × '+bStr+' (H) - Aspect ratio '+AR.toFixed(1)+':1';
    document.getElementById('dr-deq').textContent=deqStr;
    document.getElementById('dr-vel').textContent=ip?vFpm.toFixed(0)+' FPM':v.toFixed(2)+' m/s';
    document.getElementById('dr-fr').textContent=ip?(dPM/8.16828).toFixed(4)+' in/100ft':dPM.toFixed(3)+' Pa/m';
    document.getElementById('dr-re').textContent=Math.round(Re).toLocaleString();
    document.getElementById('dr-f').textContent=f.toFixed(5);
    document.getElementById('dr-regime').textContent=Re<2300?'Laminar':Re<4000?'Transitional':'Turbulent';
    // Show rect-specific rows
    document.getElementById('dr-rect-row').style.display='';
    document.getElementById('dr-deq-row').style.display='';
    // Update calc steps
    document.getElementById('dfs1').textContent='Deq_calc = '+(Deq*1000).toFixed(1)+' mm → b = '+(b*1000).toFixed(0)+'mm, a = '+(a*1000).toFixed(0)+'mm';
    document.getElementById('dfs2').textContent='Rounded: '+aStr+' × '+bStr+' → Deq_std = '+deqStr;
    document.getElementById('dfs3').textContent='Re = '+Math.round(Re).toLocaleString()+', f = '+f.toFixed(5);
    document.getElementById('dfs4').textContent=ip?(dPM/8.16828).toFixed(4)+' in/100ft':dPM.toFixed(3)+' Pa/m';

    if(vFpm>2000) wa.innerHTML='<div class="warn-card amber"><div class="warn-head amber">⚠ High Velocity</div><div class="warn-item"><span>⚠</span><span>'+vFpm.toFixed(0)+' FPM - High for rectangular duct. Max 1500–2000 FPM recommended for occupied spaces (SMACNA).</span></div></div>';
    else if(vFpm<300) wa.innerHTML='<div class="warn-card amber"><div class="warn-head amber">⚠ Low Velocity</div><div class="warn-item"><span>⚠</span><span>'+vFpm.toFixed(0)+' FPM - Low. Settling risk in VAV at minimum flow.</span></div></div>';
    if(AR>4) wa.innerHTML+='<div class="warn-card amber"><div class="warn-head amber">⚠ High Aspect Ratio</div><div class="warn-item"><span>⚠</span><span>Aspect ratio '+AR.toFixed(1)+':1 - SMACNA recommends ≤ 4:1 to minimise friction losses and material cost.</span></div></div>';
  }
  setTimeout(()=>{try{const _velEl=document.getElementById('dr-vel');const _vFpm=_velEl?parseFloat(_velEl.textContent)||0:0;const _vmax=ip?2500:12.7;const _vmin=ip?600:3;if(_vFpm>0)renderDuctChart(_vFpm,_vmax,_vmin,ductShape,0,0,0,ip);}catch(_e){}},80);
}

// ── PUMP HEAD ──
const fittingsDef=[{name:'90° Elbows',ld:30,id:'pf-el90',val:4},{name:'45° Elbows',ld:16,id:'pf-el45',val:2},{name:'Gate Valves',ld:8,id:'pf-gv',val:6},{name:'Globe Valves',ld:340,id:'pf-glv',val:2},{name:'Check Valves (swing)',ld:100,id:'pf-cv',val:1},{name:'Balancing Valves',ld:60,id:'pf-bv',val:1}];
function buildFittings(){
  const el=document.getElementById('ph-fittings');
  if(!el) return;
  el.innerHTML=fittingsDef.map(f=>`<div class="fitting-row"><span class="fitting-name">${f.name}</span><div class="counter"><button class="cnt-btn" onclick="adjF('${f.id}',-1)">−</button><span class="cnt-val" id="${f.id}">${f.val}</span><button class="cnt-btn" onclick="adjF('${f.id}',1)">+</button></div></div>`).join('');
}
function adjF(id,d){const f=fittingsDef.find(x=>x.id==id);f.val=Math.max(0,f.val+d);document.getElementById(id).textContent=f.val;calcPump();}
function setPM(el,eps){document.querySelectorAll('#page-pump-head .chip').forEach(c=>c.classList.remove('sel'));el.classList.add('sel');pipeMaterialEps=parseFloat(eps);}
function calcPump(){
  _rvNaN=false;
  const ip=currentUnit==='ip';
  const Q=ip?(rv('ph-flow'))*6.30902e-5:(rv('ph-flow'))*1e-3;
  const D_mm=rv('ph-pipe');
  const D=D_mm/1000,A=Math.PI*D*D/4,eps=pipeMaterialEps;
  const L=ip?(rv('ph-len'))*0.3048:(rv('ph-len'));
  const tRaw=rv('ph-temp');
  const tC=ip?fToC(tRaw):tRaw;
  const stat=ip?(rv('ph-static'))*0.3048:(rv('ph-static'));
  const eq_raw=rv('ph-equip');
  const eq=ip?eq_raw*0.3048:eq_raw;
  const sf=rv('ph-sf');
  const rho=waterDens(tC),mu=waterVisc(tC),g=9.80665;
  const v=Q/A,Re=rho*v*D/mu,f=colebrook(Re,eps/D);
  const hPipe=f*(L/D)*v*v/(2*g);
  let leq=0;
  fittingsDef.forEach(ft=>leq+=ft.val*ft.ld*D);
  const hFit=f*(leq/D)*v*v/(2*g);
  const sub=hPipe+hFit+stat+eq,tot=sub*(1+sf/100);
  const toH=m=>ip?(m/0.3048).toFixed(2)+' ft w.g.':(m).toFixed(3)+' m w.g.';
  if(_rvNaN) return;
  document.getElementById('pump-pipe').textContent=toH(hPipe);
  document.getElementById('pump-fit').textContent=toH(hFit);
  document.getElementById('pump-stat').textContent=toH(stat);
  document.getElementById('pump-eq').textContent=toH(eq);
  document.getElementById('pump-sub').textContent=toH(sub);
  document.getElementById('pump-tot').textContent=toH(tot);
  const qDisp=ip?((Q/6.30902e-5).toFixed(0)):(Q*1000).toFixed(2);
  document.getElementById('duty-flow').textContent=qDisp;
  document.getElementById('duty-head').textContent=ip?(tot/0.3048).toFixed(1):(tot).toFixed(2);
  const vDisp=ip?(v/0.3048).toFixed(2)+' fps':v.toFixed(3)+' m/s';
  document.getElementById('pump-vel').textContent=vDisp;
  document.getElementById('pump-re').textContent=Math.round(Re).toLocaleString();
  document.getElementById('pump-f').textContent=f.toFixed(5);
  document.getElementById('pump-leq').textContent=ip?(leq/0.3048).toFixed(1)+' ft':leq.toFixed(1)+' m';
  document.getElementById('pfs1').textContent='v = '+vDisp;
  document.getElementById('pfs2').textContent='Re = '+Math.round(Re).toLocaleString();
  document.getElementById('pfs3').textContent='f = '+f.toFixed(5);
  document.getElementById('pfs4').textContent=toH(hPipe);
  document.getElementById('pfs5').textContent=toH(tot);
  const paf=document.getElementById('pump-assump-fluid');if(paf) paf.innerHTML='<span>•</span><span>Water at '+tC.toFixed(1)+'°C: ρ = '+rho.toFixed(1)+' kg/m³, μ = '+(mu*1e3).toFixed(3)+' mPa·s</span>';
  const vFps=v/0.3048,wa=document.getElementById('pump-warn-area');wa.innerHTML='';
  if(vFps<2) wa.innerHTML='<div class="warn-card amber"><div class="warn-head amber">⚠ Alert</div><div class="warn-item"><span>⚠</span><span>Velocity '+vFps.toFixed(2)+' fps - Below 2 fps. Sedimentation/air pocket risk.</span></div></div>';
  else if(vFps>8) wa.innerHTML='<div class="warn-card amber"><div class="warn-head amber">⚠ Alert</div><div class="warn-item"><span>⚠</span><span>Velocity '+vFps.toFixed(2)+' fps - Above 8 fps. Pipe erosion risk. Consider larger pipe.</span></div></div>';
  if(sf>20) wa.innerHTML+='<div class="warn-card amber"><div class="warn-head amber">⚠ Safety Factor</div><div class="warn-item"><span>⚠</span><span>Safety factor '+sf+'% is high. Oversized pump = poor control. Recommended: 10–15%.</span></div></div>';
  // Chart (deferred so it appends after addCalcDetails)
  setTimeout(()=>{try{renderPumpChart(hPipe,hFit,stat,eq,tot,ip);}catch(_e){}}, 50);
}

// ── HVAC PIPE SIZER ──
const pipeTable={0.5:15.80,0.75:20.93,1.0:26.64,1.25:35.05,1.5:40.89,2.0:52.50,2.5:62.71,3.0:77.93,3.5:90.12,4.0:102.26,5.0:128.19,6.0:154.05,8.0:202.72,10.0:254.46,12.0:303.23};
const glycolVisc={chw:1,cw:1,g25:1.8,g40:2.6},glycolDens={chw:1,cw:1,g25:1.03,g40:1.05},fluidTemp={chw:7,cw:29,g25:7,g40:7};
function calcHvacPipe(){
  _rvNaN=false;
  const ip=currentUnit==='ip';
  const Q=ip?(rv('hp-flow'))*6.30902e-5:(rv('hp-flow'))*1e-3;
  const fluid=document.getElementById('hp-fluid').value;
  const tRaw=rv('hp-temp')||( ip?44:7);
  const tC=ip?fToC(tRaw):tRaw;
  const eps=parseFloat(document.getElementById('hp-mat').value)||0.046;
  const dpRaw=rv('hp-dp');
  const targetDp=ip?dpRaw*22.62:dpRaw;
  const rho=waterDens(tC)*glycolDens[fluid],mu=waterVisc(tC)*glycolVisc[fluid],g=9.80665;
  let chosen=null;
  for(const [nps,idMm] of Object.entries(pipeTable)){
    const D=idMm/1000,A=Math.PI*D*D/4,v=Q/A,Re=rho*v*D/mu;
    const f=colebrook(Re,eps/D),dp=f*rho*v*v/(2*D);
    if(dp<=targetDp*1.05){chosen={nps,D,v,Re,f,dp,rho,mu};break;}
  }
  if(!chosen){const last=Object.entries(pipeTable).pop();const D=last[1]/1000,A=Math.PI*D*D/4,v=Q/A,Re=rho*v*D/mu,f=colebrook(Re,eps/D),dp=f*rho*v*v/(2*D);chosen={nps:last[0],D,v,Re,f,dp};}
  const regime=chosen.Re<2300?'Laminar':chosen.Re<4000?'Transitional':'Turbulent';
  const vFps=chosen.v/0.3048;
  document.getElementById('hp-size').textContent='NPS '+chosen.nps+'" / DN '+(chosen.D*1000).toFixed(0)+' mm';
  document.getElementById('hp-id').textContent=ip?(chosen.D*1000/25.4).toFixed(3)+' in':(chosen.D*1000).toFixed(1)+' mm';
  document.getElementById('hp-vel').textContent=ip?vFps.toFixed(2)+' fps':chosen.v.toFixed(3)+' m/s';
  document.getElementById('hp-dp-res').textContent=ip?(chosen.dp/22.62).toFixed(2)+' ft/100ft':chosen.dp.toFixed(1)+' Pa/m';
  document.getElementById('hp-re').textContent=Math.round(chosen.Re).toLocaleString();
  document.getElementById('hp-regime').textContent=regime;
  const wa=document.getElementById('hp-warn-area');wa.innerHTML='';
  if(!_checkInputs('hp-warn-area')) return;
  if(vFps<2) wa.innerHTML='<div class="warn-card amber"><div class="warn-head amber">⚠ Alert</div><div class="warn-item"><span>⚠</span><span>Velocity '+vFps.toFixed(2)+' fps - Below 2 fps. Air pocket/sedimentation risk.</span></div></div>';
  if(vFps>8) wa.innerHTML+='<div class="warn-card amber"><div class="warn-head amber">⚠ Alert</div><div class="warn-item"><span>⚠</span><span>Velocity '+vFps.toFixed(2)+' fps - Exceeds 8 fps. Erosion risk at fittings.</span></div></div>';
  setTimeout(()=>{try{const _vFps=chosen?chosen.v/0.3048:0;const _vmax=ip?8:2.4;const _qFlow=ip?Q/6.30902e-5:Q*1000;renderHvacPipeChart(_vFps,_vmax,_qFlow,chosen?chosen.D*1000:0,ip);}catch(_e){}},55);
}

// ── VENTILATION (redesigned) ──

// Populate PCL spaces dropdown when navigating to ventilation page
function ventPopulatePCL(){
  var sel=document.getElementById('v-pcl-select');
  var link=document.getElementById('v-pcl-link');
  if(!sel||!link) return;
  // Access PCL rows via the pclModule IIFE closure - check if pclRender exists
  // We'll try to read the table directly
  var tbody=document.getElementById('pcl-tbody');
  if(!tbody||!tbody.children.length){link.style.display='none';return;}
  // Parse PCL table rows (skip floor headers)
  sel.innerHTML='<option value="">— Select PCL space —</option>';
  var rows=tbody.querySelectorAll('tr');
  var idx=0;
  for(var i=0;i<rows.length;i++){
    var tds=rows[i].querySelectorAll('td');
    if(tds.length<3) continue; // floor header row
    var name=tds[1]?tds[1].textContent.trim():'';
    var area=tds[2]?parseFloat(tds[2].textContent):0;
    if(name&&area>0){
      idx++;
      var opt=document.createElement('option');
      opt.value=JSON.stringify({name:name,area:area});
      opt.textContent=name+' ('+area.toFixed(1)+' m²)';
      sel.appendChild(opt);
    }
  }
  link.style.display=idx>0?'block':'none';
}

// Apply selected PCL space
function ventApplyPCL(){
  var sel=document.getElementById('v-pcl-select');
  if(!sel||!sel.value) return;
  try{
    var d=JSON.parse(sel.value);
    document.getElementById('v-space-name').value=d.name||'';
    document.getElementById('v-area').value=d.area||'';
    calcVent();
  }catch(e){}
}

// When occupancy category changes, fill OA rates and show cards
function ventCategoryChanged(){
  var catEl=document.getElementById('v-occ-category');
  var opt=catEl.options[catEl.selectedIndex];
  var oaCard=document.getElementById('v-oa-rate-card');
  var occCard=document.getElementById('v-occ-card');
  var exCard=document.getElementById('v-ex-card');
  if(!opt||!opt.value){
    if(oaCard) oaCard.style.display='none';
    if(occCard) occCard.style.display='none';
    if(exCard) exCard.style.display='none';
    return;
  }
  var rp=parseFloat(opt.getAttribute('data-rp'))||0;
  var ra=parseFloat(opt.getAttribute('data-ra'))||0;
  var density=parseFloat(opt.getAttribute('data-density'))||0;
  var exUnit=opt.getAttribute('data-ex-unit')||'N/A';
  var exArea=opt.getAttribute('data-ex-area')||'N/A';

  // Fill OA rates
  document.getElementById('v-rp-rate').value=rp;
  document.getElementById('v-ra-rate').value=ra;
  if(oaCard) oaCard.style.display='block';
  // Show density info
  document.getElementById('v-default-density-val').textContent=density;
  if(occCard) occCard.style.display='block';
  if(exCard) exCard.style.display='block';

  // Fill default Extract strategy
  var stratEl = document.getElementById('v-ex-strategy');
  if(stratEl) {
    if (exUnit !== 'N/A') {
      stratEl.value = 'L/s/unit';
      document.getElementById('v-ex-unit-rate').value = parseFloat(exUnit) || 0;
      document.getElementById('v-ex-fixtures').value = 1;
    } else if (exArea !== 'N/A') {
      if (exArea === '<-Use ACH') {
        stratEl.value = 'ACH';
        document.getElementById('v-ex-ach').value = 4;
      } else {
        stratEl.value = 'L/s/m2';
        document.getElementById('v-ex-area-rate').value = parseFloat(exArea) || 0;
      }
    } else {
      stratEl.value = '%';
      document.getElementById('v-ex-pct').value = 90;
    }
    ventExStrategyChanged();
  }

  // Calculate default occupancy if toggle is on
  ventDefaultOccChanged();
}

// Handle default occupancy toggle
function ventDefaultOccChanged(){
  var useDefault=document.getElementById('v-use-default-occ').checked;
  var occInput=document.getElementById('v-occ');
  var occSource=document.getElementById('v-occ-source');
  var infoDiv=document.getElementById('v-default-occ-info');
  if(useDefault){
    occInput.readOnly=true;
    occInput.style.background='#FFFBEB';
    occInput.style.color='#92400E';
    if(occSource) occSource.textContent='[Default]';
    if(infoDiv) infoDiv.style.display='flex';
    // Calculate default occupancy: density (#/100 m²) * area / 100
    var catEl=document.getElementById('v-occ-category');
    var opt=catEl.options[catEl.selectedIndex];
    var density=opt?parseFloat(opt.getAttribute('data-density'))||0:0;
    var area=parseFloat(document.getElementById('v-area').value)||0;
    if(density>0&&area>0){
      var defaultOcc=Math.ceil(density*area/100);
      occInput.value=defaultOcc;
    } else {
      occInput.value='';
    }
  } else {
    occInput.readOnly=false;
    occInput.style.background='';
    occInput.style.color='';
    if(occSource) occSource.textContent='[Manual]';
    if(infoDiv) infoDiv.style.display='none';
  }
}

// Keep old setVM for backward compat (no longer used in new UI but calc-details references it)
function setVM(){}

// Handle Extract Air Strategy toggling of conditional input fields
function ventExStrategyChanged() {
  var strategy = document.getElementById('v-ex-strategy') ? document.getElementById('v-ex-strategy').value : '%';
  var pctGroup = document.getElementById('v-ex-pct-group');
  var areaGroup = document.getElementById('v-ex-area-group');
  var unitGroup = document.getElementById('v-ex-unit-group');
  var qtyGroup = document.getElementById('v-ex-qty-group');
  var achGroup = document.getElementById('v-ex-ach-group');
  var qtyRow = document.getElementById('v-ex-qty-row');

  // Hide all groups first
  if(pctGroup) pctGroup.style.display = 'none';
  if(areaGroup) areaGroup.style.display = 'none';
  if(unitGroup) unitGroup.style.display = 'none';
  if(qtyGroup) qtyGroup.style.display = 'none';
  if(achGroup) achGroup.style.display = 'none';
  if(qtyRow) qtyRow.style.display = 'none';

  if (strategy === '%') {
    if(pctGroup) pctGroup.style.display = 'block';
  } else if (strategy === 'L/s/m2') {
    if(areaGroup) areaGroup.style.display = 'block';
  } else if (strategy === 'L/s/unit') {
    if(unitGroup) unitGroup.style.display = 'block';
    if(qtyGroup) qtyGroup.style.display = 'block';
    if(qtyRow) qtyRow.style.display = 'flex';
  } else if (strategy === 'ACH') {
    if(achGroup) achGroup.style.display = 'block';
    if(qtyRow) qtyRow.style.display = 'flex';
  }
}

const ventRows = [];
let ventNextId = 1;

function ventPreview() {
  _rvNaN=false;
  var catEl=document.getElementById('v-occ-category');
  var opt=catEl?catEl.options[catEl.selectedIndex]:null;
  var area=parseFloat(document.getElementById('v-area').value)||0;
  var htM=parseFloat(document.getElementById('v-ht').value)||0;

  // If default occupancy is on, recalculate when area changes
  var useDefault=document.getElementById('v-use-default-occ');
  if(useDefault&&useDefault.checked){
    var density=opt&&opt.value?parseFloat(opt.getAttribute('data-density'))||0:0;
    if(density>0&&area>0){
      document.getElementById('v-occ').value=Math.ceil(density*area/100);
    }
  }

  var occ=parseFloat(document.getElementById('v-occ').value)||0;
  var Rp=parseFloat(document.getElementById('v-rp-rate').value)||0;
  var Ra=parseFloat(document.getElementById('v-ra-rate').value)||0;

  ventPopulatePCL();

  var msg = document.getElementById('vent-form-msg');
  if(opt && opt.value && area > 0) {
    var freshAir = (occ * Rp) + (Ra * area);
    
    // Calculate total extract in preview
    var exStrategy = document.getElementById('v-ex-strategy') ? document.getElementById('v-ex-strategy').value : '%';
    var totalExtract = 0;
    var rateDesc = '';
    
    if (exStrategy === '%') {
      var pct = parseFloat(document.getElementById('v-ex-pct').value) || 0;
      totalExtract = Math.ceil(freshAir * pct / 100);
      rateDesc = `${pct}% of Fresh Air`;
    } else if (exStrategy === 'L/s/m2') {
      var exAreaRate = parseFloat(document.getElementById('v-ex-area-rate').value) || 0;
      totalExtract = Math.ceil(exAreaRate * area);
      rateDesc = `${exAreaRate} L/s/m²`;
    } else if (exStrategy === 'L/s/unit') {
      var exUnitRate = parseFloat(document.getElementById('v-ex-unit-rate').value) || 0;
      var fixtures = parseFloat(document.getElementById('v-ex-fixtures').value) || 1;
      totalExtract = Math.ceil(exUnitRate * fixtures);
      rateDesc = `${exUnitRate} L/s/unit × ${fixtures}`;
    } else if (exStrategy === 'ACH') {
      var exAch = parseFloat(document.getElementById('v-ex-ach').value) || 0;
      if (htM > 0 && area > 0) {
        totalExtract = Math.ceil((exAch * area * htM) / 3.6);
      }
      rateDesc = `${exAch} ACH`;
    }
    
    msg.innerHTML = `<div style="display:flex;flex-direction:column;gap:6px;background:rgba(59,130,246,0.05);padding:8px 12px;border-radius:var(--r-sm);border:1px solid rgba(59,130,246,0.1)">
      <span style="color:var(--blue);font-size:12.5px;font-weight:600">🌬️ Required Fresh Air: ${occ} × ${Rp.toFixed(1)} + ${Ra.toFixed(2)} × ${area.toFixed(1)} = <strong>${freshAir.toFixed(2)} L/s</strong></span>
      <span style="color:#db2777;font-size:12.5px;font-weight:600">🌀 Estimated Extract: <strong>${totalExtract} L/s</strong> (using ${rateDesc})</span>
    </div>`;
  } else {
    if(msg) msg.innerHTML = '';
  }
}

function ventAddFromForm() {
  var name = (document.getElementById('v-space-name').value || '').trim();
  var area = parseFloat(document.getElementById('v-area').value) || 0;
  var ht = parseFloat(document.getElementById('v-ht').value) || 0;
  var catEl = document.getElementById('v-occ-category');
  var opt = catEl ? catEl.options[catEl.selectedIndex] : null;
  var occ = parseFloat(document.getElementById('v-occ').value) || 0;
  var rp = parseFloat(document.getElementById('v-rp-rate').value) || 0;
  var ra = parseFloat(document.getElementById('v-ra-rate').value) || 0;
  
  var wa = document.getElementById('vent-warn-area');
  var msg = document.getElementById('vent-form-msg');
  if(wa) wa.innerHTML='';

  if (!name) { 
    if(msg) msg.innerHTML = '<span style="color:#c0392b">Please enter Space Name.</span>'; 
    return; 
  }
  if (!opt || !opt.value) { 
    if(msg) msg.innerHTML = '<span style="color:#c0392b">Please select an Occupancy Category.</span>'; 
    if(wa) wa.innerHTML='<div class="warn-card amber"><div class="warn-head amber">⚠ Missing Input</div><div class="warn-item"><span>•</span><span>Please select an Occupancy Category.</span></div></div>';
    return; 
  }
  if (area <= 0) { 
    if(msg) msg.innerHTML = '<span style="color:#c0392b">Please enter Floor Area (m²).</span>'; 
    if(wa) wa.innerHTML='<div class="warn-card amber"><div class="warn-head amber">⚠ Missing Input</div><div class="warn-item"><span>•</span><span>Please enter the floor Area (m²).</span></div></div>';
    return; 
  }

  var freshAir = (occ * rp) + (ra * area);
  var ach = 0;
  if (ht > 0) {
    var vol = area * ht;
    if (vol > 0) ach = (freshAir * 3.6) / vol;
  }

  // Calculate extract based on strategy
  var exStrategy = document.getElementById('v-ex-strategy') ? document.getElementById('v-ex-strategy').value : '%';
  var totalExtract = 0;
  var exRateStr = '';
  if (exStrategy === '%') {
    var pct = parseFloat(document.getElementById('v-ex-pct').value) || 0;
    totalExtract = Math.ceil(freshAir * pct / 100);
    exRateStr = pct + '% FA';
  } else if (exStrategy === 'L/s/m2') {
    var exAreaRate = parseFloat(document.getElementById('v-ex-area-rate').value) || 0;
    totalExtract = Math.ceil(exAreaRate * area);
    exRateStr = exAreaRate + ' L/s/m²';
  } else if (exStrategy === 'L/s/unit') {
    var exUnitRate = parseFloat(document.getElementById('v-ex-unit-rate').value) || 0;
    var fixtures = parseFloat(document.getElementById('v-ex-fixtures').value) || 1;
    totalExtract = Math.ceil(exUnitRate * fixtures);
    exRateStr = `${exUnitRate} L/s/u × ${fixtures}`;
  } else if (exStrategy === 'ACH') {
    var exAch = parseFloat(document.getElementById('v-ex-ach').value) || 0;
    if (ht > 0 && area > 0) {
      totalExtract = Math.ceil((exAch * area * ht) / 3.6);
    }
    exRateStr = exAch + ' ACH';
  }

  var extAch = 0;
  if (ht > 0 && area > 0) {
    extAch = (totalExtract * 3.6) / (area * ht);
  }

  ventRows.push({
    id: ventNextId++,
    name: name,
    area: area,
    ht: ht,
    catId: opt.value,
    catName: opt.textContent,
    occ: occ,
    rp: rp,
    ra: ra,
    freshAir: freshAir,
    ach: ach,
    exStrategy: exStrategy,
    exRateStr: exRateStr,
    totalExtract: totalExtract,
    extAch: extAch
  });

  document.getElementById('v-space-name').value = '';
  document.getElementById('v-area').value = '';
  document.getElementById('v-occ').value = ''; 
  ventPreview(); // update preview and handle default occupancy clear
  
  if(msg) {
    msg.innerHTML = '<span style="color:green;font-weight:600">✓ Added!</span>';
    setTimeout(() => { msg.innerHTML = ''; }, 1800);
  }
  ventRender();
}

function ventDelete(id) {
  var i = ventRows.findIndex(r => r.id === id);
  if (i >= 0) ventRows.splice(i, 1);
  ventRender();
}

function ventClearAll() {
  appConfirm('Clear All', 'Are you sure you want to clear all entries in the Ventilation schedule?', function(){
    ventRows.length = 0;
    ventRender();
  });
}

function ventRender() {
  var tbody = document.getElementById('vent-tbody');
  var empty = document.getElementById('vent-empty');
  var summary = document.getElementById('vent-summary');
  var tfoot = document.getElementById('vent-tfoot');
  
  if (!ventRows.length) {
    tbody.innerHTML = '';
    tfoot.innerHTML = '';
    empty.style.display = 'flex';
    summary.style.display = 'none';
    document.getElementById('vent-table-pill').textContent = 'Live Schedule';
    return;
  }

  empty.style.display = 'none';
  summary.style.display = 'block';

  var stripe = ['#ffffff', '#f9f9f9'];
  var totalArea = 0, totalFA = 0, totalOcc = 0, totalEx = 0;

  tbody.innerHTML = ventRows.map((r, idx) => {
    totalArea += r.area;
    totalFA += r.freshAir;
    totalOcc += r.occ;
    totalEx += (r.totalExtract || 0);
    
    var bg = stripe[idx % 2];
    var htStr = r.ht > 0 ? r.ht.toFixed(1) : '-';
    var achStr = r.ach > 0 ? r.ach.toFixed(2) : '-';
    var extAchStr = (r.extAch && r.extAch > 0) ? r.extAch.toFixed(2) : '-';
    var exRateStr = r.exRateStr || '-';
    var totalExVal = (r.totalExtract && r.totalExtract > 0) ? r.totalExtract : 0;
    
    return `<tr style="background:${bg};transition:background .1s" onmouseover="this.style.background='#fef3e2'" onmouseout="this.style.background='${bg}'">
      <td style="padding:8px 4px;text-align:center;color:#999;font-size:11px;font-weight:700;border-right:1px solid #e8e8e8;border-bottom:1px solid #f0f0f0">${idx+1}</td>
      <td style="padding:8px 8px;border-right:1px solid #e8e8e8;border-bottom:1px solid #f0f0f0">
        <input value="${r.name.replace(/"/g,'&quot;')}" style="border:none;background:transparent;width:100%;font-size:12.5px;font-family:inherit;color:var(--text);outline:none;font-weight:500" readonly>
      </td>
      <td style="padding:8px 4px;text-align:center;border-right:1px solid #e8e8e8;border-bottom:1px solid #f0f0f0;font-size:12.5px;font-weight:600">${r.area.toFixed(1)}</td>
      <td style="padding:8px 4px;text-align:center;border-right:1px solid #e8e8e8;border-bottom:1px solid #f0f0f0;font-size:12px;color:var(--muted)">${htStr}</td>
      <td style="padding:8px 8px;border-right:1px solid #e8e8e8;border-bottom:1px solid #f0f0f0;font-size:11.5px;color:var(--muted)">${r.catName}</td>
      <td style="padding:8px 4px;text-align:center;border-right:1px solid #e8e8e8;border-bottom:1px solid #f0f0f0;font-size:12.5px;font-weight:600">${r.occ}</td>
      <td style="padding:8px 4px;text-align:right;font-size:13px;font-weight:700;color:var(--blue);border-right:1px solid #e8e8e8;border-bottom:1px solid #f0f0f0">${r.freshAir.toFixed(2)}</td>
      <td style="padding:8px 4px;text-align:right;font-size:12px;font-weight:600;color:var(--blue);border-right:1px solid #e8e8e8;border-bottom:1px solid #f0f0f0">${achStr}</td>
      <td style="padding:8px 4px;text-align:center;font-size:11.5px;font-weight:500;color:#db2777;border-right:1px solid #e8e8e8;border-bottom:1px solid #f0f0f0">${exRateStr}</td>
      <td style="padding:8px 4px;text-align:right;font-size:13px;font-weight:700;color:#db2777;border-right:1px solid #e8e8e8;border-bottom:1px solid #f0f0f0">${totalExVal}</td>
      <td style="padding:8px 4px;text-align:right;font-size:12px;font-weight:600;color:#db2777;border-right:1px solid #e8e8e8;border-bottom:1px solid #f0f0f0">${extAchStr}</td>
      <td style="padding:8px 4px;text-align:center;border-bottom:1px solid #f0f0f0">
        <button onclick="ventDelete(${r.id})" style="border:none;background:#fee2e2;color:#d17914;border-radius:4px;width:24px;height:24px;cursor:pointer;font-size:13px;font-weight:700;display:flex;align-items:center;justify-content:center;margin:0 auto;transition:background .12s" onmouseover="this.style.background='#fca5a5'" onmouseout="this.style.background='#fee2e2'">×</button>
      </td>
    </tr>`;
  }).join('');

  tfoot.innerHTML = `<tr style="background:var(--blue);color:#fff">
    <td colspan="2" style="padding:10px 10px;font-weight:700;font-size:12px;border-right:1px solid rgba(255,255,255,0.18)">TOTAL</td>
    <td style="padding:10px 6px;text-align:center;font-weight:800;font-size:13px;border-right:1px solid rgba(255,255,255,0.18)">${totalArea.toLocaleString(undefined, {minimumFractionDigits:1, maximumFractionDigits:1})}</td>
    <td style="border-right:1px solid rgba(255,255,255,0.18)"></td>
    <td style="border-right:1px solid rgba(255,255,255,0.18)"></td>
    <td style="padding:10px 6px;text-align:center;font-weight:800;font-size:13px;border-right:1px solid rgba(255,255,255,0.18)">${totalOcc}</td>
    <td style="padding:10px 6px;text-align:right;font-weight:800;font-size:14px;border-right:1px solid rgba(255,255,255,0.18)">${totalFA.toLocaleString(undefined, {minimumFractionDigits:2, maximumFractionDigits:2})}</td>
    <td style="border-right:1px solid rgba(255,255,255,0.18)"></td>
    <td style="border-right:1px solid rgba(255,255,255,0.18)"></td>
    <td style="padding:10px 6px;text-align:right;font-weight:800;font-size:14px;border-right:1px solid rgba(255,255,255,0.18)">${totalEx.toLocaleString(undefined, {minimumFractionDigits:0, maximumFractionDigits:0})}</td>
    <td style="border-right:1px solid rgba(255,255,255,0.18)"></td>
    <td></td>
  </tr>`;

  document.getElementById('vent-stat-entries').textContent = ventRows.length;
  document.getElementById('vent-stat-area').textContent = totalArea.toLocaleString(undefined, {minimumFractionDigits:1, maximumFractionDigits:1}) + ' m²';
  document.getElementById('vent-stat-fa').textContent = totalFA.toLocaleString(undefined, {minimumFractionDigits:2, maximumFractionDigits:2}) + ' L/s';
  var totalCFM = totalFA * 2.11888;
  document.getElementById('vent-stat-cfm').textContent = totalCFM.toLocaleString(undefined, {minimumFractionDigits:1, maximumFractionDigits:1}) + ' CFM';
  document.getElementById('vent-table-pill').textContent = ventRows.length + ' Entr' + (ventRows.length === 1 ? 'y' : 'ies');

  setTimeout(function(){
    try {
      renderVentChart(totalFA * 2.11888, totalEx * 2.11888, 0.15, false); // Pass actual extract CFM to the outside air fraction chart!
      if (typeof injectSaveBar === 'function') {
        injectSaveBar('vent-res');
      }
    } catch(e) {}
  }, 50);
}

// ── SMOKE EXTRACT FAN CALCULATION ──
function calcSmokeExtract() {
  // --- Section 1: Corridor Parameters ---
  _rvNaN = false;
  const A = rv('se-corridor-area');
  const h = rv('se-corridor-height');
  const volEl = document.getElementById('se-corridor-volume');
  const flowEl = document.getElementById('se-fan-flow-rate');
  
  let V = 0;
  let QfanRound = 0;
  let QfanM3s = 0;
  let qtyFans = 1;
  
  if (!_rvNaN) {
    V = A * h;
    if (volEl) volEl.value = V.toFixed(2);
    
    // Attempt to calculate flow rate through each fan
    const ACPH = rv('se-acph');
    qtyFans = rv('se-fan-qty');
    
    if (!_rvNaN && qtyFans > 0) {
      const Qsmoke = (V * ACPH) / 3600; // m³/s
      QfanM3s = Qsmoke / qtyFans;
      const QfanLs = QfanM3s * 1000;
      QfanRound = Math.ceil(QfanLs / 5) * 5;
      
      if (flowEl) flowEl.value = QfanRound.toFixed(0);
    } else {
      if (flowEl) flowEl.value = '';
    }
  } else {
    if (volEl) volEl.value = '';
    if (flowEl) flowEl.value = '';
  }
  
  // --- Section 2: Fan Head Requirement ---
  _rvNaN = false; // Reset NaN tracker for the second card
  const ductLen = rv('se-smoke-duct-length');
  const fittingsEl = document.getElementById('se-smoke-duct-fittings');
  const eqLenEl = document.getElementById('se-smoke-duct-eq-length');
  const frictionFactor = rv('se-smoke-duct-friction-factor');
  const frictionLossesEl = document.getElementById('se-smoke-duct-friction-losses');
  const lossesLouvers = rv('se-smoke-losses-louvers');
  const lossesFan = rv('se-smoke-losses-fan');
  const fanHeadEl = document.getElementById('se-smoke-fan-head');
  
  let roundedHead = 0;
  let headCalculated = false;
  
  if (!_rvNaN) {
    const fittings = ductLen * 0.6;
    const eqLen = fittings + ductLen;
    if (fittingsEl) fittingsEl.value = fittings.toFixed(2);
    if (eqLenEl) eqLenEl.value = eqLen.toFixed(2);
    
    const frictionLosses = frictionFactor * eqLen;
    if (frictionLossesEl) frictionLossesEl.value = frictionLosses.toFixed(2);
    
    // Safety of 10% stored in background: (Frictional Losses + Louvers/Grille + Internal Fan Losses) * 0.1
    const baseLosses = frictionLosses + lossesLouvers + lossesFan;
    const safety = baseLosses * 0.1;
    const totalHead = baseLosses + safety;
    
    // ROUND(..., -1) -> nearest multiple of 10
    roundedHead = Math.round(totalHead / 10) * 10;
    if (fanHeadEl) fanHeadEl.value = roundedHead.toFixed(0);
    headCalculated = true;
  } else {
    // If input is incomplete, try to calculate fittings and equivalent length if length of ducting is filled
    _rvNaN = false;
    const partialDuctLen = parseFloat(document.getElementById('se-smoke-duct-length').value);
    if (!isNaN(partialDuctLen)) {
      const fittings = partialDuctLen * 0.6;
      const eqLen = fittings + partialDuctLen;
      if (fittingsEl) fittingsEl.value = fittings.toFixed(2);
      if (eqLenEl) eqLenEl.value = eqLen.toFixed(2);
      
      const partialFrictionFactor = parseFloat(document.getElementById('se-smoke-duct-friction-factor').value);
      if (!isNaN(partialFrictionFactor)) {
        const frictionLosses = partialFrictionFactor * eqLen;
        if (frictionLossesEl) frictionLossesEl.value = frictionLosses.toFixed(2);
      } else {
        if (frictionLossesEl) frictionLossesEl.value = '';
      }
    } else {
      if (fittingsEl) fittingsEl.value = '';
      if (eqLenEl) eqLenEl.value = '';
      if (frictionLossesEl) frictionLossesEl.value = '';
    }
    if (fanHeadEl) fanHeadEl.value = '';
  }
  
  // --- Section 3: Calculations For Motor Selection ---
  const motorFlowEl = document.getElementById('se-motor-flow');
  const motorStaticEl = document.getElementById('se-motor-static');
  const motorPowerEachEl = document.getElementById('se-motor-power-each');
  const motorTotalPowerEl = document.getElementById('se-motor-total-power');
  const motorQtyEl = document.getElementById('se-motor-fan-qty');
  
  if (QfanM3s > 0 && headCalculated) {
    if (motorFlowEl) motorFlowEl.value = QfanM3s.toFixed(3);
    if (motorStaticEl) motorStaticEl.value = roundedHead.toFixed(0);
    
    // Sync fan qty to motor section qty unless user edited it manually
    if (motorQtyEl && !motorQtyEl.dataset.userEdited) {
      motorQtyEl.value = qtyFans;
    }
    
    const effMotorInput = parseFloat(document.getElementById('se-motor-eff-motor').value);
    const effFanInput = parseFloat(document.getElementById('se-motor-eff-fan').value);
    const numFans = parseFloat(motorQtyEl ? motorQtyEl.value : 1) || 1;
    
    if (!isNaN(effMotorInput) && effMotorInput > 0 && !isNaN(effFanInput) && effFanInput > 0) {
      // Support both percentage (e.g. 80) and decimal (e.g. 0.8) inputs
      const effM = effMotorInput > 1 ? effMotorInput / 100 : effMotorInput;
      const effF = effFanInput > 1 ? effFanInput / 100 : effFanInput;
      
      // Power = (Flow * Head) / (Eff_Motor * Eff_Fan) -> then divide by 1000
      const powerEach = (QfanM3s * roundedHead) / (effM * effF * 1000);
      
      // Round off by its nearest ceiling value to 2 decimal places (nearest 0.01 kW)
      const powerEachRound = Math.ceil(powerEach * 100) / 100;
      if (motorPowerEachEl) motorPowerEachEl.value = powerEachRound.toFixed(2);
      
      // Total Motor Power = Power each * 1.1 * number of fans
      const totalPower = powerEachRound * 1.1 * numFans;
      if (motorTotalPowerEl) motorTotalPowerEl.value = totalPower.toFixed(2);
    } else {
      if (motorPowerEachEl) motorPowerEachEl.value = '';
      if (motorTotalPowerEl) motorTotalPowerEl.value = '';
    }
  } else {
    if (motorFlowEl) motorFlowEl.value = '';
    if (motorStaticEl) motorStaticEl.value = '';
    if (motorPowerEachEl) motorPowerEachEl.value = '';
    if (motorTotalPowerEl) motorTotalPowerEl.value = '';
  }
}

// -- LOBBY PRESSURISATION CALCULATION --
function calcLobbyPress() {
  let Q_m3s = 0;
  let headRound = 0;
  let q_calculated = false;
  let head_calculated = false;
  
  // --- Section 1: Parameters & Calculations ---
  const A = parseFloat(document.getElementById('lp-area').value);
  const h = parseFloat(document.getElementById('lp-height').value);
  const ACPH = parseFloat(document.getElementById('lp-acph').value);
  const qtyFans = parseFloat(document.getElementById('lp-fan-qty').value);
  
  if (!isNaN(A) && !isNaN(h) && A > 0 && h > 0) {
    const V = A * h;
    document.getElementById('lp-volume').value = V.toFixed(2);
    
    if (!isNaN(ACPH) && ACPH > 0) {
      const q = (V * ACPH) / 3600;
      document.getElementById('lp-fresh-air').value = q.toFixed(3);
      
      if (!isNaN(qtyFans) && qtyFans > 0) {
        Q_m3s = q / qtyFans;
        q_calculated = true;
        const Q_ls = Q_m3s * 1000;
        const Q_round = Math.ceil(Q_ls / 5) * 5;
        document.getElementById('lp-flow-round').value = Q_round.toFixed(0);
      } else {
        document.getElementById('lp-flow-round').value = '';
      }
    } else {
      document.getElementById('lp-fresh-air').value = '';
      document.getElementById('lp-flow-round').value = '';
    }
  } else {
    document.getElementById('lp-volume').value = '';
    document.getElementById('lp-fresh-air').value = '';
    document.getElementById('lp-flow-round').value = '';
  }

  // --- Section 2: Fan Head Requirement ---
  const ductLen = parseFloat(document.getElementById('lp-head-duct-len').value);
  const fittingsEl = document.getElementById('lp-head-fittings');
  const eqLenEl = document.getElementById('lp-head-eq-len');
  const frictionFactor = parseFloat(document.getElementById('lp-head-friction-factor').value);
  const frictionLossesEl = document.getElementById('lp-head-friction-losses');
  const louversLosses = parseFloat(document.getElementById('lp-head-louvers').value);
  const fanLosses = parseFloat(document.getElementById('lp-head-fan-losses').value);
  const fanHeadEl = document.getElementById('lp-head-total');
  
  if (!isNaN(ductLen)) {
    const fittings = ductLen * 0.6;
    const eqLen = fittings + ductLen;
    if (fittingsEl) fittingsEl.value = fittings.toFixed(2);
    if (eqLenEl) eqLenEl.value = eqLen.toFixed(2);
    
    if (!isNaN(frictionFactor)) {
      const frictionLosses = frictionFactor * eqLen;
      if (frictionLossesEl) frictionLossesEl.value = frictionLosses.toFixed(2);
      
      if (!isNaN(louversLosses) && !isNaN(fanLosses)) {
        const baseLosses = frictionLosses + louversLosses + fanLosses;
        const safety = baseLosses * 0.1;
        const totalHead = baseLosses + safety;
        
        headRound = Math.round(totalHead / 10) * 10;
        head_calculated = true;
        if (fanHeadEl) fanHeadEl.value = headRound.toFixed(0);
      } else {
        if (fanHeadEl) fanHeadEl.value = '';
      }
    } else {
      if (frictionLossesEl) frictionLossesEl.value = '';
      if (fanHeadEl) fanHeadEl.value = '';
    }
  } else {
    if (fittingsEl) fittingsEl.value = '';
    if (eqLenEl) eqLenEl.value = '';
    if (frictionLossesEl) frictionLossesEl.value = '';
    if (fanHeadEl) fanHeadEl.value = '';
  }
  
  // --- Section 3: Calculations For Motor Selection ---
  const motorFlowEl = document.getElementById('lp-motor-flow');
  const motorStaticEl = document.getElementById('lp-motor-head');
  const motorPowerEachEl = document.getElementById('lp-motor-power');
  const motorTotalPowerEl = document.getElementById('lp-motor-final-power');
  const motorQtyEl = document.getElementById('lp-motor-fan-qty');
  
  if (q_calculated && head_calculated) {
    if (motorFlowEl) motorFlowEl.value = Q_m3s.toFixed(3);
    if (motorStaticEl) motorStaticEl.value = headRound.toFixed(0);
    
    // Sync fan qty to motor section qty unless user edited it manually
    if (motorQtyEl && !motorQtyEl.dataset.userEdited) {
      motorQtyEl.value = qtyFans;
    }
    
    const effMotorInput = parseFloat(document.getElementById('lp-motor-eff-motor').value);
    const effFanInput = parseFloat(document.getElementById('lp-motor-eff-fan').value);
    const numFans = parseFloat(motorQtyEl ? motorQtyEl.value : 1) || 1;
    
    if (!isNaN(effMotorInput) && effMotorInput > 0 && !isNaN(effFanInput) && effFanInput > 0) {
      const effM = effMotorInput > 1 ? effMotorInput / 100 : effMotorInput;
      const effF = effFanInput > 1 ? effFanInput / 100 : effFanInput;
      
      const powerEach = (Q_m3s * headRound) / (effM * effF * 1000);
      
      // Round off by its nearest ceiling value to 2 decimal places (nearest 0.01 kW)
      const powerEachRound = Math.ceil(powerEach * 100) / 100;
      if (motorPowerEachEl) motorPowerEachEl.value = powerEachRound.toFixed(2);
      
      // Total Motor Power = Power each * 1.1 * number of fans
      const totalPower = powerEachRound * 1.1 * numFans;
      if (motorTotalPowerEl) motorTotalPowerEl.value = totalPower.toFixed(2);
    } else {
      if (motorPowerEachEl) motorPowerEachEl.value = '';
      if (motorTotalPowerEl) motorTotalPowerEl.value = '';
    }
  } else {
    if (motorFlowEl) motorFlowEl.value = '';
    if (motorStaticEl) motorStaticEl.value = '';
    if (motorPowerEachEl) motorPowerEachEl.value = '';
    if (motorTotalPowerEl) motorTotalPowerEl.value = '';
  }
}

window.importFromSmokeExtract = function(event) {
  if (event) {
    event.stopPropagation();
  }
  
  const dropdown = document.getElementById('lp-import-dropdown');
  if (!dropdown) return;
  
  if (dropdown.style.display === 'block') {
    dropdown.style.display = 'none';
    return;
  }
  
  const allSaves = localSavesGet();
  const smokeSaves = allSaves.filter(s => s.type === 'smoke-extract');
  
  let html = '';
  html += `
    <div style="font-size: 10px; font-weight: 700; color: var(--muted); padding: 8px 12px 6px; border-bottom: 1px solid var(--border); letter-spacing: 0.5px; text-transform: uppercase;">
      Select Smoke Extract Zone
    </div>
  `;
  
  if (smokeSaves.length === 0) {
    html += `
      <div style="padding: 16px 12px; text-align: center; color: var(--muted); font-size: 12px; line-height: 1.5;">
        No saved smoke extract zones.<br>
        <span style="font-size: 10.5px; color: var(--hint); font-style: italic;">Save a calculation in Smoke Extract Fan first.</span>
      </div>
    `;
  } else {
    html += `
      <div style="max-height: 250px; overflow-y: auto;">
    `;
    html += smokeSaves.map(save => {
      const area = save.values['se-corridor-area'] || '-';
      const height = save.values['se-corridor-height'] || '-';
      const acph = save.values['se-acph'] || '-';
      
      return `
        <div class="import-dropdown-item" 
             onclick="executeImportFromSave('${save.id}')" 
             style="padding: 10px 12px; cursor: pointer; border-bottom: 1px solid var(--border); transition: background 0.15s; display: flex; flex-direction: column; gap: 4px; text-align: left;"
             onmouseover="this.style.background='rgba(59, 130, 246, 0.08)'" 
             onmouseout="this.style.background='transparent'">
          <div style="font-weight: 600; font-size: 12px; color: var(--text); white-space: nowrap; overflow: hidden; text-overflow: ellipsis;" title="${escapeHtml(save.name)}">
            ${escapeHtml(save.name)}
          </div>
          <div style="font-size: 11px; color: var(--muted); display: flex; justify-content: space-between; align-items: center;">
            <span>A: ${area}m² · H: ${height}m · ACPH: ${acph}</span>
            <span style="font-size: 9.5px; opacity: 0.75; font-family: monospace;">85% ACPH: ${(parseFloat(acph)*0.85).toFixed(1)}</span>
          </div>
        </div>
      `;
    }).join('');
    html += `</div>`;
  }
  
  dropdown.innerHTML = html;
  dropdown.style.display = 'block';
};

window.executeImportFromSave = function(saveId) {
  const allSaves = localSavesGet();
  const save = allSaves.find(s => s.id === saveId);
  if (!save) {
    showToast('Error: Saved calculation not found');
    return;
  }
  
  const seArea = parseFloat(save.values['se-corridor-area']);
  const seHeight = parseFloat(save.values['se-corridor-height']);
  const seAcph = parseFloat(save.values['se-acph']);
  
  if (isNaN(seArea) || isNaN(seHeight) || isNaN(seAcph) || seArea <= 0 || seHeight <= 0 || seAcph <= 0) {
    showToast('Error: Saved calculation contains invalid values');
    return;
  }
  
  document.getElementById('lp-area').value = seArea;
  document.getElementById('lp-height').value = seHeight;
  document.getElementById('lp-acph').value = (seAcph * 0.85).toFixed(2);
  
  ['lp-area', 'lp-height', 'lp-acph'].forEach(fieldId => {
    const el = document.getElementById(fieldId);
    if (el) {
      el.dispatchEvent(new Event('input', { bubbles: true }));
      el.dispatchEvent(new Event('change', { bubbles: true }));
    }
  });
  
  calcLobbyPress();
  
  const dropdown = document.getElementById('lp-import-dropdown');
  if (dropdown) dropdown.style.display = 'none';
  
  showToast('✓ Successfully imported values from saved Smoke Extract Fan: ' + save.name);
};

// Close import dropdown when clicking outside
window.addEventListener('click', function(e) {
  const dropdown = document.getElementById('lp-import-dropdown');
  const container = document.getElementById('lp-import-container');
  if (dropdown && container && !container.contains(e.target)) {
    dropdown.style.display = 'none';
  }
});

// ════════════════════════════════════════════════════════════════
// CUSTOM CALCULATION STORAGE (SAVE & LOAD)
// ════════════════════════════════════════════════════════════════
let activeCustomCalcType = ''; // 'lobby-press' or 'smoke-extract'

const LOBBY_PRESS_FIELDS = [
  'lp-area', 'lp-height', 'lp-acph', 'lp-fan-qty',
  'lp-head-duct-len', 'lp-head-friction-factor', 'lp-head-louvers', 'lp-head-fan-losses',
  'lp-motor-eff-motor', 'lp-motor-eff-fan', 'lp-motor-fan-qty'
];

const SMOKE_EXTRACT_FIELDS = [
  'se-corridor-area', 'se-corridor-height', 'se-acph', 'se-fan-qty',
  'se-smoke-duct-length', 'se-smoke-duct-friction-factor', 'se-smoke-losses-louvers', 'se-smoke-losses-fan',
  'se-motor-eff-motor', 'se-motor-eff-fan', 'se-motor-fan-qty'
];

function localSavesGet() {
  try {
    return JSON.parse(localStorage.getItem('mep_custom_calculator_saves')) || [];
  } catch (e) {
    return [];
  }
}

function localSavesSet(v) {
  try {
    localStorage.setItem('mep_custom_calculator_saves', JSON.stringify(v));
  } catch (e) {}
}

function showToast(msg) {
  if (typeof toast === 'function') {
    toast(msg);
  } else {
    const t = document.getElementById('toast');
    if (t) {
      t.textContent = msg;
      t.style.opacity = '1';
      clearTimeout(t._timer);
      t._timer = setTimeout(() => t.style.opacity = '0', 2400);
    }
  }
}

window.openCustomSaveModal = function(calcType) {
  activeCustomCalcType = calcType;
  const nameInput = document.getElementById('custom-save-name');
  if (nameInput) nameInput.value = '';
  
  const titleEl = document.getElementById('custom-save-title');
  if (titleEl) {
    titleEl.textContent = calcType === 'lobby-press' 
      ? 'Save Lobby Pressurisation' 
      : 'Save Smoke Extract Fan';
  }
  
  const modal = document.getElementById('custom-calc-save-modal');
  if (modal) {
    modal.style.display = 'flex';
    if (nameInput) nameInput.focus();
  }
};

window.closeCustomSaveModal = function() {
  const modal = document.getElementById('custom-calc-save-modal');
  if (modal) modal.style.display = 'none';
};

window.confirmCustomSave = function() {
  const nameInput = document.getElementById('custom-save-name');
  const name = nameInput ? nameInput.value.trim() : '';
  if (!name) {
    showToast('Please enter a calculation name');
    return;
  }
  
  const fields = activeCustomCalcType === 'lobby-press' ? LOBBY_PRESS_FIELDS : SMOKE_EXTRACT_FIELDS;
  const values = {};
  
  fields.forEach(fieldId => {
    const el = document.getElementById(fieldId);
    if (el) {
      values[fieldId] = el.value;
    }
  });
  
  const saveItem = {
    id: 'custom_calc_' + Date.now(),
    type: activeCustomCalcType,
    name: name,
    savedAt: new Date().toISOString(),
    values: values
  };
  
  const allSaves = localSavesGet();
  allSaves.unshift(saveItem);
  localSavesSet(allSaves);
  
  closeCustomSaveModal();
  showToast('✓ Calculation saved successfully!');
};

window.openCustomLoadModal = function(calcType) {
  activeCustomCalcType = calcType;
  
  const titleEl = document.getElementById('custom-load-title');
  if (titleEl) {
    titleEl.textContent = calcType === 'lobby-press' 
      ? 'Load Lobby Pressurisation' 
      : 'Load Smoke Extract Fan';
  }
  
  renderCustomLoadList();
  const modal = document.getElementById('custom-calc-load-modal');
  if (modal) modal.style.display = 'flex';
};

window.closeCustomLoadModal = function() {
  const modal = document.getElementById('custom-calc-load-modal');
  if (modal) modal.style.display = 'none';
};

window.renderCustomLoadList = function() {
  const container = document.getElementById('custom-load-list');
  if (!container) return;
  
  const allSaves = localSavesGet();
  const filtered = allSaves.filter(s => s.type === activeCustomCalcType);
  
  if (filtered.length === 0) {
    container.innerHTML = `
      <div style="text-align:center; padding:30px 10px; color:var(--hint); font-size:13px; line-height:1.5;">
        📭 No saved calculations found.<br>
        Fill in inputs and click <strong>Save Current</strong> to create one.
      </div>
    `;
    return;
  }
  
  container.innerHTML = filtered.map(save => {
    const dateStr = new Date(save.savedAt).toLocaleDateString(undefined, {
      year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit'
    });
    
    let summaryText = '';
    if (save.type === 'lobby-press') {
      const area = save.values['lp-area'] || '-';
      const height = save.values['lp-height'] || '-';
      const acph = save.values['lp-acph'] || '-';
      summaryText = `Area: ${area} m² · Ht: ${height} m · ACPH: ${acph}`;
    } else {
      const area = save.values['se-corridor-area'] || '-';
      const height = save.values['se-corridor-height'] || '-';
      const acph = save.values['se-acph'] || '-';
      summaryText = `Area: ${area} m² · Ht: ${height} m · ACPH: ${acph}`;
    }
    
    return `
      <div class="saved-calc-item" style="background:var(--card); border:1px solid var(--border); border-radius:10px; padding:12px 14px; display:flex; flex-direction:column; gap:8px; transition:border-color 0.2s;">
        <div style="display:flex; justify-content:space-between; align-items:flex-start; gap:10px;">
          <div style="min-width: 0; flex: 1;">
            <div style="font-weight:700; font-size:13.5px; color:var(--text); white-space:nowrap; overflow:hidden; text-overflow:ellipsis;" title="${escapeHtml(save.name)}">${escapeHtml(save.name)}</div>
            <div style="font-size:11px; color:var(--muted); margin-top:2px;">Saved on ${dateStr}</div>
          </div>
          <button onclick="deleteCustomSave('${save.id}')" style="background:none; border:none; color:var(--muted); cursor:pointer; font-size:16px; padding:2px; display:flex; align-items:center; justify-content:center; transition:color 0.15s;" onmouseover="this.style.color='var(--red)'" onmouseout="this.style.color='var(--muted)'" title="Delete Saved Calculation">🗑</button>
        </div>
        <div style="font-size:11.5px; color:var(--text-sec); background:var(--bg); padding:6px 10px; border-radius:6px; font-family:monospace; display:flex; align-items:center;">
          ${summaryText}
        </div>
        <div style="display:flex; justify-content:flex-end; margin-top:4px;">
          <button onclick="loadCustomSave('${save.id}')" class="calc-btn" style="margin:0; width:auto; padding:6px 12px; font-size:11.5px; font-weight:700; border-radius:6px; background:var(--blue); color:#fff; border:none; cursor:pointer;">
            📥 Load Values
          </button>
        </div>
      </div>
    `;
  }).join('');
};

window.deleteCustomSave = function(id) {
  if (typeof appConfirm === 'function') {
    appConfirm('Delete Saved Calculation', 'Are you sure you want to delete this saved calculation?', function() {
      let allSaves = localSavesGet();
      allSaves = allSaves.filter(s => s.id !== id);
      localSavesSet(allSaves);
      renderCustomLoadList();
      showToast('✓ Calculation deleted');
    });
  } else if (confirm('Are you sure you want to delete this saved calculation?')) {
    let allSaves = localSavesGet();
    allSaves = allSaves.filter(s => s.id !== id);
    localSavesSet(allSaves);
    renderCustomLoadList();
    showToast('✓ Calculation deleted');
  }
};

window.loadCustomSave = function(id) {
  const allSaves = localSavesGet();
  const save = allSaves.find(s => s.id === id);
  if (!save) {
    showToast('Error: Calculation not found');
    return;
  }
  
  Object.entries(save.values).forEach(([fieldId, value]) => {
    const el = document.getElementById(fieldId);
    if (el) {
      el.value = value;
      if (fieldId === 'lp-motor-fan-qty' || fieldId === 'se-motor-fan-qty') {
        el.dataset.userEdited = 'true';
      }
      el.dispatchEvent(new Event('input', { bubbles: true }));
      el.dispatchEvent(new Event('change', { bubbles: true }));
    }
  });
  
  if (save.type === 'lobby-press') {
    calcLobbyPress();
  } else {
    calcSmokeExtract();
  }
  
  closeCustomLoadModal();
  showToast('✓ Calculation loaded successfully!');
};

function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}

// ── FRESH AIR COOLING LOAD ──
function updateLiveRatios() {
  const ip = currentUnit === 'ip';
  const pAtm = 101000;
  
  // Entering
  const dbtIn = parseFloat(document.getElementById('fal-dbt-in')?.value);
  const wbtIn = parseFloat(document.getElementById('fal-wbt-in')?.value);
  if (!isNaN(dbtIn) && !isNaN(wbtIn) && wbtIn <= dbtIn && wbtIn > -50 && dbtIn > -50) {
    const dbtInC = ip ? fToC(dbtIn) : dbtIn;
    const wbtInC = ip ? fToC(wbtIn) : wbtIn;
    try {
      const wIn = wFromWB(dbtInC, wbtInC, pAtm);
      if (wIn >= 0) {
        const wInDisplay = ip ? wIn * 7000 : wIn;
        const uW = ip ? ' gr/lb' : ' kg/kg';
        setText('fal-w-in-val', wInDisplay.toFixed(ip ? 3 : 5) + uW);
      } else {
        setText('fal-w-in-val', '-');
      }
    } catch(e) {
      setText('fal-w-in-val', '-');
    }
  } else {
    setText('fal-w-in-val', '-');
  }

  // Leaving
  const dbtOut = parseFloat(document.getElementById('fal-dbt-out')?.value);
  const wbtOut = parseFloat(document.getElementById('fal-wbt-out')?.value);
  if (!isNaN(dbtOut) && !isNaN(wbtOut) && wbtOut <= dbtOut && wbtOut > -50 && dbtOut > -50) {
    const dbtOutC = ip ? fToC(dbtOut) : dbtOut;
    const wbtOutC = ip ? fToC(wbtOut) : wbtOut;
    try {
      const wOut = wFromWB(dbtOutC, wbtOutC, pAtm);
      if (wOut >= 0) {
        const wOutDisplay = ip ? wOut * 7000 : wOut;
        const uW = ip ? ' gr/lb' : ' kg/kg';
        setText('fal-w-out-val', wOutDisplay.toFixed(ip ? 3 : 5) + uW);
      } else {
        setText('fal-w-out-val', '-');
      }
    } catch(e) {
      setText('fal-w-out-val', '-');
    }
  } else {
    setText('fal-w-out-val', '-');
  }
}

function calcFreshAirLoad() {
  _rvNaN = false;
  const ip = currentUnit === 'ip';
  
  const dbtIn = rv('fal-dbt-in');
  const wbtIn = rv('fal-wbt-in');
  const dbtOut = rv('fal-dbt-out');
  const wbtOut = rv('fal-wbt-out');
  const flow = rv('fal-flow');
  
  if (_rvNaN) return;
  
  const wa = document.getElementById('fal-warn-area');
  if (wa) wa.innerHTML = '';
  const warns = [];
  
  if (wbtIn > dbtIn) {
    warns.push('Entering Wet Bulb cannot be higher than Entering Dry Bulb temperature.');
  }
  if (wbtOut > dbtOut) {
    warns.push('Leaving Wet Bulb cannot be higher than Leaving Dry Bulb temperature.');
  }
  if (dbtOut > dbtIn) {
    warns.push('Leaving Dry Bulb temperature is greater than Entering Dry Bulb temperature (Coil is heating instead of cooling).');
  }
  if (wbtOut > wbtIn) {
    warns.push('Leaving Wet Bulb temperature is greater than Entering Wet Bulb temperature.');
  }
  
  const pAtm = 101000;
  const dbtInC = ip ? fToC(dbtIn) : dbtIn;
  const wbtInC = ip ? fToC(wbtIn) : wbtIn;
  const dbtOutC = ip ? fToC(dbtOut) : dbtOut;
  const wbtOutC = ip ? fToC(wbtOut) : wbtOut;
  
  let wIn = 0;
  let wOut = 0;
  try {
    wIn = wFromWB(dbtInC, wbtInC, pAtm);
    wOut = wFromWB(dbtOutC, wbtOutC, pAtm);
  } catch (e) {
    warns.push('Error calculating psychrometric conditions.');
  }
  
  if (wIn < 0) wIn = 0;
  if (wOut < 0) wOut = 0;
  
  if (wOut > wIn) {
    warns.push('Leaving Humidity Ratio is higher than Entering (Moisture is added, suggesting humidification instead of dehumidification).');
  }
  
  // Render alerts beautifully
  if (warns.length && wa) {
    wa.innerHTML = warns.map(w => `<div class="warn-item" style="display:flex; align-items:center; gap:8px; margin-top:8px; background:rgba(239,68,68,0.06); border:1px solid rgba(239,68,68,0.2); border-radius:6px; padding:8px 12px; color:var(--red); font-size:11.5px; font-weight:500;"><span>⚠️</span><span>${w}</span></div>`).join('');
  }
  
  const wInDisplay = ip ? wIn * 7000 : wIn;
  const wOutDisplay = ip ? wOut * 7000 : wOut;
  const wDiffDisplay = Math.max(0, wInDisplay - wOutDisplay);
  
  let sensLoad = 0;
  let latLoad = 0;
  let totLoad = 0;
  let capacityTons = 0;
  
  if (!ip) {
    // SI mode:
    // Sensible = 1.23 * Q * (dT) [kW]
    sensLoad = 1.23 * flow * (dbtIn - dbtOut);
    // Latent = 3010 * Q * (dW kg/kg) [kW]
    latLoad = 3010 * flow * (wIn - wOut);
    totLoad = sensLoad + latLoad;
    capacityTons = totLoad / 3.517;
  } else {
    // IP mode:
    // Sensible = 1.08 * Q * (dT) [BTU/h]
    sensLoad = 1.08 * flow * (dbtIn - dbtOut);
    // Latent = 0.68 * Q * (dW gr/lb) [BTU/h]
    latLoad = 0.68 * flow * (wInDisplay - wOutDisplay);
    totLoad = sensLoad + latLoad;
    capacityTons = totLoad / 12000;
  }
  
  if (sensLoad < 0) sensLoad = 0;
  if (latLoad < 0) latLoad = 0;
  totLoad = sensLoad + latLoad;
  if (capacityTons < 0) capacityTons = 0;
  
  const uLoad = ip ? ' BTU/h' : ' kW';
  const uW = ip ? ' gr/lb' : ' kg/kg';
  
  setText('fal-r-sens', sensLoad.toFixed(2) + uLoad);
  setText('fal-r-lat', latLoad.toFixed(2) + uLoad);
  setText('fal-r-tot', totLoad.toFixed(2) + uLoad);
  setText('fal-r-tons', capacityTons.toFixed(2) + ' TR');
  setText('fal-r-win', wInDisplay.toFixed(ip ? 3 : 5) + uW);
  setText('fal-r-wout', wOutDisplay.toFixed(ip ? 3 : 5) + uW);
  setText('fal-r-wdiff', wDiffDisplay.toFixed(ip ? 3 : 5) + uW);
  
  // Make sure entering/leaving live labels are also set
  setText('fal-w-in-val', wInDisplay.toFixed(ip ? 3 : 5) + uW);
  setText('fal-w-out-val', wOutDisplay.toFixed(ip ? 3 : 5) + uW);
  
  try {
    if (typeof renderFreshAirLoadChart === 'function') {
      renderFreshAirLoadChart(sensLoad, latLoad, totLoad, ip);
    }
  } catch (e) {
    console.error('Error rendering fresh air load chart:', e);
  }
}

window.updateLiveRatios = updateLiveRatios;
window.calcFreshAirLoad = calcFreshAirLoad;


// --- Merged from 06-more-calcs.js ---

function calcHeatLoad() {
  _rvNaN = false;
  const ip = currentUnit === 'ip';
  const areaRaw = rv('hl-area');
  const htRaw = rv('hl-ht');
  const glazRaw = rv('hl-glaz');
  const orientMult = rv('hl-orient');
  const shgc = rv('hl-shgc');
  const uVal = rv('hl-uval');
  const occ = rvi('hl-occ');
  const actParts = (document.getElementById('hl-activity').value || '250,200').split(',');
  const sensPerPerson = parseFloat(actParts[0]) || 250;
  const latPerPerson = parseFloat(actParts[1]) || 200;
  const ltgWFt2 = rv('hl-ltg');
  const equipWFt2 = rv('hl-equip');
  const oatRaw = rv('hl-oat');
  const iatRaw = rv('hl-iat');
  const owbGrLb = rv('hl-owb');
  const iwbGrLb = rv('hl-iwb');

  // Convert to SI if needed for internal calc - keep IP throughout (calc is IP-native)
  const areaFt2 = ip ? areaRaw : areaRaw * 10.7639;
  const glazFt2 = ip ? glazRaw : glazRaw * 10.7639;
  const oat = ip ? oatRaw : (oatRaw * 9 / 5 + 32);
  const iat = ip ? iatRaw : (iatRaw * 9 / 5 + 32);
  const deltaT = oat - iat;

  // Peak solar irradiance typical: 200 BTU/hr/ft² for south-facing at peak
  const solarBase = 200; // BTU/hr/ft² design solar intensity
  const solarGain = glazFt2 * solarBase * shgc * orientMult;

  // Envelope conduction: walls + roof (approximate U × A × deltaT)
  // Envelope area = 4 × perimeter wall area + roof
  const sqrtArea = Math.sqrt(areaFt2);
  const wallAreaFt2 = (sqrtArea * 4) * (htRaw || 10) - glazFt2;
  const roofAreaFt2 = areaFt2;
  const envelopeArea = wallAreaFt2 + roofAreaFt2;
  const condLoad = envelopeArea * uVal * Math.max(0, deltaT);

  // Internal sensible
  const peopleSens = occ * sensPerPerson;
  const ltgLoad = areaFt2 * ltgWFt2 * 3.412; // W/ft² × area × 3.412 = BTU/hr
  const equipLoad = areaFt2 * equipWFt2 * 3.412;

  const totalSens = solarGain + condLoad + peopleSens + ltgLoad + equipLoad;

  // Latent
  const peopleLat = occ * latPerPerson;
  // Infiltration latent: 0.5 ACH × volume × 0.075 lb/ft³ × 0.68 × ΔW (gr/lb)
  const volFt3 = areaFt2 * (htRaw || 10);
  const deltaW = Math.max(0, owbGrLb - iwbGrLb);
  const infLat = 0.5 * volFt3 * 0.075 * 0.68 * deltaW; // BTU/hr
  const totalLat = peopleLat + infLat;

  const grandTotal = totalSens + totalLat;
  const tons = grandTotal / 12000;
  const shr = grandTotal > 0 ? totalSens / grandTotal : 0;
  const perFt2 = grandTotal / areaFt2;

  const toBtu = v => ip ? v.toFixed(0) + ' BTU/hr' : (v * 0.293071 / 1000).toFixed(2) + ' kW';
  if (_rvNaN) return;
  document.getElementById('hl-solar').textContent = toBtu(solarGain);
  document.getElementById('hl-cond').textContent = toBtu(condLoad);
  document.getElementById('hl-ppl-s').textContent = toBtu(peopleSens);
  document.getElementById('hl-ltg-res').textContent = toBtu(ltgLoad);
  document.getElementById('hl-equip-res').textContent = toBtu(equipLoad);
  document.getElementById('hl-sens-tot').textContent = toBtu(totalSens);
  document.getElementById('hl-ppl-l').textContent = toBtu(peopleLat);
  document.getElementById('hl-inf-l').textContent = toBtu(infLat);
  document.getElementById('hl-lat-tot').textContent = toBtu(totalLat);
  document.getElementById('hl-grand-tot').textContent = toBtu(grandTotal);
  document.getElementById('hl-per-ft').textContent = ip ? perFt2.toFixed(1) + ' BTU/hr/ft²' : (perFt2 * 0.293071 / 10.7639).toFixed(1) + ' W/m²';
  document.getElementById('hl-tons').textContent = ip ? tons.toFixed(1) + ' TR (tons)' : (tons * 3.51685).toFixed(1) + ' kW';
  document.getElementById('hl-shr').textContent = shr.toFixed(3);
  // Chart (deferred so it appends after addCalcDetails)
  setTimeout(() => { try { renderHLChart(solarGain, condLoad, peopleSens, ltgLoad, equipLoad, totalLat, ip); } catch (_e) { } }, 50);
}

// ── EXTERNAL STATIC PRESSURE ──


function calcESP() {
  _rvNaN = false;
  const ip = currentUnit === 'ip';
  const toUnit = v => ip ? v.toFixed(3) + ' in w.g.' : (v * 249.089).toFixed(1) + ' Pa';
  const sup = rv('esp-sup');
  const diff = rv('esp-diff');
  const ret = rv('esp-ret');
  const rg = rv('esp-rg');
  const coil = rv('esp-coil');
  const fltC = rv('esp-flt-c');
  const fltD = rv('esp-flt-d');
  const mix = rv('esp-mix');
  const acc = rv('esp-acc');

  const supTot = sup + diff;
  const retTot = ret + rg;
  const intClean = coil + fltC + mix + acc;
  const intDirty = coil + fltD + mix + acc;
  const totClean = supTot + retTot + intClean;
  const totDirty = supTot + retTot + intDirty;

  document.getElementById('esp-sup-tot').textContent = toUnit(supTot);
  document.getElementById('esp-ret-tot').textContent = toUnit(retTot);
  document.getElementById('esp-int-clean').textContent = toUnit(intClean);
  document.getElementById('esp-int-dirty').textContent = toUnit(intDirty);
  document.getElementById('esp-tot-clean').textContent = toUnit(totClean);
  document.getElementById('esp-tot-dirty').textContent = toUnit(totDirty);

  const wa = document.getElementById('esp-warn-area'); wa.innerHTML = '';
  if (!_checkInputs('esp-warn-area')) return;
  if (totDirty > 3.0) wa.innerHTML = '<div class="warn-card amber"><div class="warn-head amber">⚠ High ESP</div><div class="warn-item"><span>⚠</span><span>Total ESP ' + totDirty.toFixed(2) + ' in w.g. - High. Verify fan motor size and duct construction class (SMACNA).</span></div></div>';
  if (totDirty < 0.8) wa.innerHTML = '<div class="warn-card amber"><div class="warn-head amber">⚠ Low ESP</div><div class="warn-item"><span>⚠</span><span>Total ESP ' + totDirty.toFixed(2) + ' in w.g. - Very low. Verify all system losses are accounted for.</span></div></div>';
  // Chart (deferred so it appends after addCalcDetails)
  setTimeout(() => { try { renderESPChart(supTot, retTot, intClean, intDirty, totClean, totDirty, ip); } catch (_e) { } }, 50);
}

// ── DIFFUSER SELECTOR ──


function calcDiffuser() {

  // ==========================================================
  // RESET ERROR FLAG
  // ==========================================================
  _rvNaN = false;

  // ==========================================================
  // UNIT SYSTEM
  // ==========================================================
  const ip = currentUnit === 'ip';   // true = CFM, false = L/s

  // ==========================================================
  // INPUT VALUES
  // ==========================================================
  let totalFlow = rv('df-flow');
  const count = rvi('df-count');

  const velocityEl = document.getElementById('df-vel');
  const typeEl = document.getElementById('df-type');

  if (!velocityEl || !typeEl) return;

  const velocity = parseFloat(velocityEl.value);
  const diffuserType = typeEl.value;

  if (!totalFlow || !count || count <= 0) return;

  // ==========================================================
  // FLOW PER DIFFUSER (KEEP IN USER UNIT)
  // ==========================================================
  const perDiffDisplay = totalFlow / count;

  // Convert to CFM only for internal lookup


  const perDiff = totalFlow / count;

  // ==========================================================
  // CHOOSE TABLE COLUMN
  // ==========================================================
  const flowKey = velocity === 2.5 ? 'maxFlow_25' : 'maxFlow_20';

  // ==========================================================
  // DATA TABLE
  // ==========================================================
  const diffuserData = {

    square: [
      { size: '150x150', maxFlow_20: 95, maxFlow_25: 116, throw: 8, nc: 20 },
      { size: '225x225', maxFlow_20: 212, maxFlow_25: 275, throw: 12, nc: 25 },
      { size: '300x300', maxFlow_20: 392, maxFlow_25: 487, throw: 16, nc: 30 },
      { size: '375x375', maxFlow_20: 614, maxFlow_25: 667, throw: 20, nc: 35 },
      { size: '450x450', maxFlow_20: 826, maxFlow_25: 826, throw: 24, nc: 40 },
      { size: '525x525', maxFlow_20: 1038, maxFlow_25: 1038, throw: 28, nc: 45 },
      { size: '600x600', maxFlow_20: 1239, maxFlow_25: 1239, throw: 32, nc: 50 }
    ],

    round: [
      { size: 'Ø250', maxFlow_20: 38, maxFlow_25: 47, throw: 8, nc: 20 },
      { size: 'Ø307', maxFlow_20: 66, maxFlow_25: 83, throw: 10, nc: 22 },
      { size: 'Ø363', maxFlow_20: 104, maxFlow_25: 130, throw: 12, nc: 24 },
      { size: 'Ø419', maxFlow_20: 149, maxFlow_25: 186, throw: 14, nc: 26 },
      { size: 'Ø478', maxFlow_20: 203, maxFlow_25: 252, throw: 16, nc: 28 },
      { size: 'Ø534', maxFlow_20: 264, maxFlow_25: 330, throw: 18, nc: 30 },
      { size: 'Ø598', maxFlow_20: 335, maxFlow_25: 418, throw: 20, nc: 32 },
      { size: 'Ø653', maxFlow_20: 401, maxFlow_25: 519, throw: 22, nc: 34 },
      { size: 'Ø704', maxFlow_20: 479, maxFlow_25: 625, throw: 24, nc: 36 },
      { size: 'Ø756', maxFlow_20: 590, maxFlow_25: 741, throw: 26, nc: 38 }
    ],

    slot16: [
      { size: '1 Slot', maxFlow: 45, throw: 6, nc: 20 },
      { size: '2 Slot', maxFlow: 65, throw: 8, nc: 22 },
      { size: '3 Slot', maxFlow: 100, throw: 10, nc: 24 },
      { size: '4 Slot', maxFlow: 125, throw: 12, nc: 26 }
    ],

    slot20: [
      { size: '1 Slot', maxFlow: 50, throw: 6, nc: 20 },
      { size: '2 Slot', maxFlow: 75, throw: 8, nc: 22 },
      { size: '3 Slot', maxFlow: 110, throw: 10, nc: 24 },
      { size: '4 Slot', maxFlow: 130, throw: 12, nc: 26 }
    ],

    slot25: [
      { size: '1 Slot', maxFlow: 55, throw: 6, nc: 20 },
      { size: '2 Slot', maxFlow: 85, throw: 8, nc: 22 },
      { size: '3 Slot', maxFlow: 125, throw: 10, nc: 24 },
      { size: '4 Slot', maxFlow: 150, throw: 12, nc: 26 }
    ],

    flowbar: [

      // 1 SLOT FIRST
      { size: '1 Slot x 25', maxFlow_20: 40, maxFlow_25: 57 },
      { size: '1 Slot x 38', maxFlow_20: 51, maxFlow_25: 73 },
      { size: '1 Slot x 51', maxFlow_20: 57, maxFlow_25: 82 },
      { size: '1 Slot x 64', maxFlow_20: 112, maxFlow_25: 160 },
      { size: '1 Slot x 76', maxFlow_20: 154, maxFlow_25: 221 },

      // 2 SLOT SECOND
      { size: '2 Slot x 25', maxFlow_20: 62, maxFlow_25: 88 },
      { size: '2 Slot x 38', maxFlow_20: 102, maxFlow_25: 146 },
      { size: '2 Slot x 51', maxFlow_20: 129, maxFlow_25: 185 },
      { size: '2 Slot x 64', maxFlow_20: 211, maxFlow_25: 301 },
      { size: '2 Slot x 76', maxFlow_20: 279, maxFlow_25: 398 }

    ]
  };

  const options = diffuserData[diffuserType];
  if (!options) return;

  // ==========================================================
  // SELECT SMALLEST SUITABLE DIFFUSER
  // ==========================================================
  let selected = null;

  for (let i = 0; i < options.length; i++) {

    let maxFlow;

    // square + round use velocity columns
    if (
      diffuserType === 'square' ||
      diffuserType === 'round' ||
      diffuserType === 'flowbar'
    ) {
      maxFlow = options[i][flowKey];
    } else {
      maxFlow = options[i].maxFlow;
    }

    if (perDiff <= maxFlow) {
      selected = options[i];
      break;
    }
  }

  if (!selected) {

    if (
      diffuserType === 'slot16' ||
      diffuserType === 'slot20' ||
      diffuserType === 'slot25'
    ) {

      document.getElementById('df-neck').textContent = '-';
      document.getElementById('df-throw').textContent = '-';
      document.getElementById('df-nc').textContent = '-';
      document.getElementById('df-adpi').textContent = 'Flow exceeds slot capacity';

      return;
    }

    // for square / round / flowbar use largest size
    selected = options[options.length - 1];
  }

  // ==========================================================
  // CALCULATIONS
  // ==========================================================
  const velocityFPM = velocity * 196.85;

  const toFlow = v =>
    ip ? v.toFixed(0) + ' CFM'
      : v.toFixed(0) + ' L/s';

  const toDist = v =>
    ip ? v.toFixed(1) + ' ft'
      : (v * 0.3048).toFixed(1) + ' m';

  // ==========================================================
  // OUTPUT
  // ==========================================================
  document.getElementById('df-per').textContent =
    toFlow(perDiffDisplay);

  document.getElementById('df-neck').textContent =
    selected.size;

  document.getElementById('df-fv').textContent =
    velocityFPM.toFixed(0) + ' FPM (' +
    velocity.toFixed(2) + ' m/s)';

  document.getElementById('df-throw').textContent =
    toDist(selected.throw);

  document.getElementById('df-nc').textContent =
    'NC-' + selected.nc;

  // ==========================================================
  // ADPI
  // ==========================================================
  let adpi = 'Good Selection';

  if (velocityFPM > 600) adpi = 'High velocity - draft risk';
  if (velocityFPM < 300) adpi = 'Low velocity - poor air spread';

  document.getElementById('df-adpi').textContent = adpi;

  // ==========================================================
  // WARNINGS
  // ==========================================================
  const wa = document.getElementById('df-warn-area');
  wa.innerHTML = '';

  wa.innerHTML += `
    <div class="warn-card amber">
      <div class="warn-head amber">ℹ Note</div>
      <div class="warn-item">
        Selection based on lookup table. Verify with manufacturer software.
      </div>
    </div>`;
}

// ── WATER SUPPLY PIPE SIZER ──
