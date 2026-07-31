// Calculator Page Templates
window.CalculatorTemplates = window.CalculatorTemplates || {};

window.CalculatorTemplates['search'] = `
<div class="page" id="page-search">
<div style="display:flex;align-items:center;gap:10px;margin-bottom:20px">
<button data-action-click="clearSearch()" style="padding:8px 12px;border-radius:8px;border:1px solid var(--border);background:var(--card);font-size:12px;font-weight:600;color:var(--muted);cursor:pointer;font-family:var(--font)">←
              Back</button>
<div style="flex:1">
<div id="search-results-heading" style="font-size:15px;font-weight:700"></div>
<div id="search-results-sub" style="font-size:12px;color:var(--muted);margin-top:1px"></div>
</div>
</div>
<div id="search-results-list"></div>
</div>
`;

window.CalculatorTemplates['home'] = `
<div class="page active" id="page-home" style="max-width:none!important">
<!-- WhatsApp Share FAB -->
<a href="#" id="wa-share-btn" data-action-click="shareOnWhatsApp(event)" data-action-mouseout="this.style.transform='scale(1)';this.style.boxShadow='0 4px 16px rgba(37,211,102,0.45)'" data-action-mouseover="this.style.transform='scale(1.1)';this.style.boxShadow='0 6px 22px rgba(37,211,102,0.55)'" style="position:fixed;bottom:80px;right:20px;z-index:150;width:52px;height:52px;
          background:#25D366;border-radius:50%;display:flex;align-items:center;justify-content:center;
          box-shadow:0 4px 16px rgba(37,211,102,0.45);text-decoration:none;
          transition:transform .18s,box-shadow .18s;cursor:pointer" title="Share this tool on WhatsApp">
<svg fill="none" height="28" viewbox="0 0 28 28" width="28" xmlns="http://www.w3.org/2000/svg">
<path d="M14 2C7.373 2 2 7.373 2 14c0 2.136.56 4.14 1.537 5.876L2 26l4.313-1.505A11.933 11.933 0 0014 26c6.627 0 12-5.373 12-12S20.627 2 14 2z" fill="white"></path>
<path d="M14 3.8A10.2 10.2 0 013.8 14c0 1.874.506 3.63 1.39 5.142l.18.307-.762 2.748 2.82-.74.294.167A10.157 10.157 0 0014 24.2 10.2 10.2 0 0024.2 14 10.2 10.2 0 0014 3.8z" fill="#25D366"></path>
<path d="M10.5 9.5c-.2-.45-.41-.46-.6-.47-.155-.007-.333-.007-.51-.007-.178 0-.467.067-.712.333-.244.267-.933.912-.933 2.222 0 1.311.956 2.578 1.089 2.755.133.178 1.845 2.934 4.533 3.99 2.244.884 2.69.708 3.177.663.489-.044 1.578-.645 1.8-1.267.223-.622.223-1.155.156-1.267-.067-.11-.245-.177-.512-.31-.267-.133-1.578-.778-1.822-.867-.245-.088-.422-.133-.6.133-.178.267-.688.867-.844 1.045-.156.178-.311.2-.578.067-.267-.134-1.128-.416-2.15-1.328-.795-.71-1.332-1.587-1.488-1.854-.156-.267-.017-.41.117-.543.12-.12.267-.31.4-.467.133-.155.178-.266.267-.444.088-.178.044-.334-.022-.467-.067-.133-.583-1.447-.8-1.978z" fill="white"></path>
</svg>
</a>
<div style="display:grid;grid-template-columns:1fr 340px;gap:22px;align-items:start">
<!-- LEFT COLUMN -->
<div>
<!-- Hero -->
<div class="hero" style="margin-bottom:20px">
<div style="display:flex;justify-content:space-between;align-items:flex-start;gap:10px">
<div>
<div class="hero-title">MEP Design Calculation</div>
<div class="hero-sub">Smart, Fast MEP Design Calculations &amp; Engineering Tools<br/><span style="font-size:11px;font-weight:600;color:var(--brand-lt);letter-spacing:0.3px"></span></div>
</div>
<div style="background:rgba(255,255,255,0.12);border:1px solid rgba(255,255,255,0.2);border-radius:10px;padding:8px 12px;text-align:center;flex-shrink:0">
<div style="color:rgba(255,255,255,0.6);font-size:10px;font-weight:600;letter-spacing:0.8px;text-transform:uppercase">
                      Saved</div>
<div id="home-calc-count" style="color:#fff;font-size:18px;font-weight:800;line-height:1">0</div>
<div style="color:rgba(255,255,255,0.55);font-size:10px">calculations</div>
</div>
</div>
<div class="hero-pills" style="margin-top:14px">
<span class="hero-pill">Standards-Based</span>
<span class="hero-pill">IP + SI</span>
<span class="hero-pill">ASHRAE · SMACNA · IPC · NFPA</span>
</div>
</div>
<!-- Modules -->
<div class="section-header">Modules</div>
<div class="module-grid" style="grid-template-columns:repeat(3,1fr)">
<div class="module-card" data-action-click="nav('psychrometric')">
<div class="module-card-icon" style="background:rgba(0,102,204,0.1)">🌡</div>
<div class="module-card-name">HVAC</div>
<div class="module-card-count" id="home-hvac-count">26 calculators</div>
</div>
<div class="module-card" data-action-click="nav('water-demand')">
<div class="module-card-icon" style="background:rgba(5,150,105,0.1)">💧</div>
<div class="module-card-name">Plumbing</div>
<div class="module-card-count" id="home-plumbing-count">15 calculators</div>
</div>
<div class="module-card" data-action-click="nav('k-factor')">
<div class="module-card-icon" style="background:rgba(220,38,38,0.1)">🔥</div>
<div class="module-card-name">Fire Fighting</div>
<div class="module-card-count" id="home-fire-count">15 calculators</div>
</div>
<div class="module-card" data-action-click="nav('elec-load')" style="border-color:rgba(217,119,6,0.25)">
<div class="module-card-icon" style="background:rgba(217,119,6,0.1)">⚡</div>
<div class="module-card-name" style="color:var(--amber)">Electrical</div>
<div class="module-card-count" id="home-elec-count">23 calculators</div>
</div>
<div class="module-card" data-action-click="nav('unit-converter')">
<div class="module-card-icon" style="background:rgba(124,58,237,0.1)">🔧</div>
<div class="module-card-name">Tools</div>
<div class="module-card-count">Converter · Rules · Standards</div>
</div>
</div>
<!-- Recent Calculations -->
<div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:12px">
<div class="section-header" style="margin:0">Recent Calculations</div>
<button data-action-click="nav('projects')" style="font-size:12px;font-weight:600;color:var(--blue);background:none;border:none;cursor:pointer;font-family:var(--font);padding:0">View
                  all</button>
</div>
<div class="recent-list" id="home-recent-list"></div>
</div>
<!-- RIGHT COLUMN: Course CTAs + Share -->
<div style="display:flex;flex-direction:column;gap:14px;position:sticky;top:20px">
<!-- Section Label -->
<div style="font-size:10px;font-weight:700;letter-spacing:1.3px;text-transform:uppercase;color:var(--hint)">
</div>
<div data-action-click="nav('augmintech')" data-action-mouseout="this.style.transform='translateY(0)';this.style.boxShadow='0 6px 24px rgba(247,143,34,0.35)'" data-action-mouseover="this.style.transform='translateY(-3px)';this.style.boxShadow='0 10px 32px rgba(247,143,34,0.45)'" style="
      background:linear-gradient(145deg,#d17914 0%,#f78f22 55%,#f9a94e 100%);
      border-radius:16px;overflow:hidden;cursor:pointer;
      box-shadow:0 6px 24px rgba(247,143,34,0.35);
      border:1px solid rgba(64,145,108,0.25);
      transition:transform .2s,box-shadow .2s;position:relative">
<!-- Decorative circle -->
</div>
<!-- WhatsApp Share Card -->
<div data-action-click="shareOnWhatsApp()" data-action-mouseout="this.style.borderColor='var(--border)';this.style.boxShadow='none'" data-action-mouseover="this.style.borderColor='#25D366';this.style.boxShadow='0 4px 16px rgba(37,211,102,0.15)'" style="
      background:var(--card);border:1.5px solid var(--border);border-radius:14px;
      padding:16px 18px;cursor:pointer;transition:all .18s;
      display:flex;align-items:center;gap:14px">
<div style="width:44px;height:44px;border-radius:12px;background:#25D366;display:flex;align-items:center;justify-content:center;flex-shrink:0;box-shadow:0 3px 10px rgba(37,211,102,0.4)">
<svg fill="none" height="24" viewbox="0 0 28 28" width="24">
<path d="M14 2C7.373 2 2 7.373 2 14c0 2.136.56 4.14 1.537 5.876L2 26l4.313-1.505A11.933 11.933 0 0014 26c6.627 0 12-5.373 12-12S20.627 2 14 2z" fill="white"></path>
<path d="M14 3.8A10.2 10.2 0 003.8 14c0 1.874.506 3.63 1.39 5.142l.18.307-.762 2.748 2.82-.74.294.167A10.157 10.157 0 0014 24.2 10.2 10.2 0 0024.2 14 10.2 10.2 0 0014 3.8z" fill="#25D366"></path>
<path d="M10.5 9.5c-.2-.45-.41-.46-.6-.47-.155-.007-.333-.007-.51-.007-.178 0-.467.067-.712.333-.244.267-.933.912-.933 2.222 0 1.311.956 2.578 1.089 2.755.133.178 1.845 2.934 4.533 3.99 2.244.884 2.69.708 3.177.663.489-.044 1.578-.645 1.8-1.267.223-.622.223-1.155.156-1.267-.067-.11-.245-.177-.512-.31-.267-.133-1.578-.778-1.822-.867-.245-.088-.422-.133-.6.133-.178.267-.688.867-.844 1.045-.156.178-.311.2-.578.067-.267-.134-1.128-.416-2.15-1.328-.795-.71-1.332-1.587-1.488-1.854-.156-.267-.017-.41.117-.543.12-.12.267-.31.4-.467.133-.155.178-.266.267-.444.088-.178.044-.334-.022-.467-.067-.133-.583-1.447-.8-1.978z" fill="white"></path>
</svg>
</div>
<div style="flex:1;min-width:0">
<div style="font-size:13.5px;font-weight:700;color:var(--text);margin-bottom:2px"></div>
<div style="font-size:11.5px;color:var(--muted);line-height:1.4">Send MEP Design Calculation to your
                    team via WhatsApp</div>
</div>
<div style="font-size:11px;font-weight:600;color:#25D366;white-space:nowrap">Share →</div>
</div>
</div><!-- /right col -->
</div><!-- /grid -->
</div>
`;

window.CalculatorTemplates['psychrometric'] = `
<div class="page" id="page-psychrometric">
<div class="calc-header">
<div class="calc-title">Psychrometric Calculator</div>
<div class="calc-std">ASHRAE Fundamentals 2021 - Hyland-Wexler Equations</div>
</div>
<div class="calc-desc">Calculate complete psychrometric state of moist air from two known properties. Uses
            full ASHRAE Hyland-Wexler saturation pressure equations - not approximations.</div>
<div class="scard">
<div class="scard-head">
<div class="scard-accent" style="background:var(--blue)"></div>
<div class="scard-title">Inputs</div>
</div>
<div class="scard-body">
<div class="input-group">
<div class="input-label">Dry Bulb Temperature <span class="input-unit" id="p-dbt-unit">°F</span></div>
<input class="inp" id="p-dbt" data-action-input="calcPsych()" placeholder="e.g. 95" type="number"/>
</div>
<div class="input-group">
<div class="input-label">Known Second Parameter</div>
<div class="chip-row">
<div class="chip sel" data-action-click="setPP(this,'rh')">Rel. Humidity</div>
<div class="chip" data-action-click="setPP(this,'wb')">Wet Bulb</div>
<div class="chip" data-action-click="setPP(this,'dp')">Dew Point</div>
<div class="chip" data-action-click="setPP(this,'w')">Hum. Ratio</div>
</div>
</div>
<div class="input-group" style="margin-top:12px">
<div class="input-label"><span id="p-param-label">Relative Humidity</span> <span class="input-unit" id="p-param-unit">%</span></div>
<input class="inp" id="p-param" data-action-input="calcPsych()" placeholder="e.g. 60" type="number"/>
</div>
<div class="input-group">
<div class="input-label">Atmospheric Pressure <span class="input-unit">kPa</span></div>
<input class="inp" id="p-atm" data-action-input="calcPsych()" placeholder="e.g. 101.325" type="number"/>
</div>
</div>
</div>
<button class="calc-btn blue" data-action-click="calcPsych();showRes('psych-res')">⚡ Calculate Psychrometric
            State</button>
<div id="psych-res" style="display:none">
<div class="scard">
<div class="scard-head">
<div class="scard-accent" style="background:var(--blue)"></div>
<div class="scard-title">Psychrometric State</div>
</div>
<div class="scard-body">
<div class="res-row">
<div class="res-label">Dry Bulb Temperature</div>
<div class="res-val primary" id="pr-dbt">-</div>
</div>
<div class="res-row">
<div class="res-label">Wet Bulb Temperature</div>
<div class="res-val primary" id="pr-wbt">-</div>
</div>
<div class="res-row">
<div class="res-label">Dew Point Temperature</div>
<div class="res-val primary" id="pr-dp">-</div>
</div>
<div class="res-row">
<div class="res-label">Relative Humidity</div>
<div class="res-val primary" id="pr-rh">-</div>
</div>
<div class="res-row">
<div class="res-label">Humidity Ratio (W)</div>
<div class="res-val" id="pr-w">-</div>
</div>
<div class="res-row">
<div class="res-label">Specific Enthalpy (h)</div>
<div class="res-val" id="pr-h">-</div>
</div>
<div class="res-row">
<div class="res-label">Specific Volume (v)</div>
<div class="res-val" id="pr-v">-</div>
</div>
<div class="res-row">
<div class="res-label">Vapor Pressure</div>
<div class="res-val" id="pr-pv">-</div>
</div>
</div>
</div>
<div class="scard" id="psych-warn-card" style="display:none">
<div class="scard-head">
<div class="scard-accent" style="background:var(--amber)"></div>
<div class="scard-title">Engineering Alerts</div>
</div>
<div class="scard-body" id="psych-warns"></div>
</div>
</div>
</div>
`;

window.CalculatorTemplates['duct-sizer'] = `
<div class="page two-col-page" id="page-duct-sizer">
<!-- Full-width header -->
<div class="calc-header">
<div class="two-col-header-left">
<div class="calc-title">Duct Sizer + Friction Loss</div>
<div class="calc-std">SMACNA HVAC Duct Design Manual · Equal Friction Method</div>
</div>
<div class="two-col-header-badge">🌬️ HVAC · Air Distribution</div>
</div>
<!-- Full-width description -->
<div class="calc-desc">Size round or rectangular ducts for a target friction rate using the Equal Friction
            Method with Colebrook-White friction factor iteration (SMACNA).</div>
<!-- 50 / 50 grid -->
<div class="calc-two-col">
<!-- ══ LEFT: Inputs (sticky) ══ -->
<div class="calc-col-left">
<div class="calc-col-panel">
<div class="calc-col-panel-head">
<div class="calc-col-panel-accent"></div>
<div class="calc-col-panel-title">Inputs</div>
</div>
<div class="calc-col-panel-body">
<div class="input-group">
<div class="input-label">Airflow (Q) <span class="input-unit" id="d-flow-unit">CFM</span></div>
<input class="inp" id="d-flow" data-action-input="calcDuct()" placeholder="e.g. 2500" type="number"/>
</div>
<div class="input-group">
<div class="input-label">Target Friction Rate <span class="input-unit" id="d-fr-unit">in w.g./100
                        ft</span></div>
<input class="inp" id="d-fr" data-action-input="calcDuct()" placeholder="e.g. 0.08" step="0.01" type="number"/>
</div>
<div class="input-group">
<div class="input-label">Duct Shape</div>
<div class="chip-row">
<div class="chip sel" data-action-click="setDS(this,'round')">Round</div>
<div class="chip" data-action-click="setDS(this,'rect')">Rectangular</div>
</div>
</div>
<div class="input-group" id="d-ar-row" style="display:none">
<div class="input-label">Aspect Ratio (W:H) <span class="input-unit">W ÷ H</span></div>
<select class="inp inp-select" id="d-ar" data-action-change="calcDuct()">
<option value="1.0">1:1 - Square</option>
<option selected="" value="1.5">1.5:1 - Low profile</option>
<option value="2.0">2:1 - Standard</option>
<option value="3.0">3:1 - Wide</option>
<option value="4.0">4:1 - Very wide</option>
</select>
</div>
</div>
</div>
<button class="calc-btn blue" data-action-click="calcDuct();showRes('duct-res')">⚡ Calculate</button>
</div>
<!-- ══ RIGHT: Results ══ -->
<div class="calc-col-right">
<!-- Placeholder (hidden after first calc) -->
<div class="result-placeholder" id="duct-res-placeholder">
<div class="result-placeholder-icon">📏</div>
<div class="result-placeholder-text">
                  Enter airflow &amp; friction rate,<br/>then click <strong>Calculate</strong> to see results.
                </div>
</div>
<!-- Results panel -->
<div id="duct-res" style="display:none">
<div class="calc-col-panel">
<!-- Action bar: Save / Export -->
<div class="res-action-bar">
<button class="res-action-btn" id="duct-save-btn" data-action-click="saveFromCache('duct-res')">💾 Save
                      Calculation</button>
<button class="res-action-btn" id="duct-pdf-btn" data-action-click="pdfFromCache('duct-res')">📄 Export
                      PDF</button>
</div>
<!-- Column header -->
<div class="calc-col-panel-head">
<div class="calc-col-panel-accent" style="background:var(--blue)"></div>
<div class="calc-col-panel-title" id="duct-res-title">Round Duct Result</div>
</div>
<!-- Result rows -->
<div class="calc-col-panel-body" style="padding-bottom:4px">
<div class="res-row">
<div class="res-label" id="dr-size-label">Standard Diameter</div>
<div class="res-val primary" id="ds-r-diam">-</div>
</div>
<div class="res-row" id="dr-rect-row" style="display:none">
<div class="res-label">Width × Height</div>
<div class="res-val primary" id="dr-wh">-</div>
</div>
<div class="res-row" id="dr-deq-row" style="display:none">
<div class="res-label">Hydraulic Equiv. Diameter (D<sub>eq</sub>)</div>
<div class="res-val" id="dr-deq">-</div>
</div>
<div class="res-row">
<div class="res-label">Air Velocity</div>
<div class="res-val primary" id="dr-vel">-</div>
</div>
<div class="res-row">
<div class="res-label">Actual Friction Rate</div>
<div class="res-val" id="dr-fr">-</div>
</div>
<div class="res-row">
<div class="res-label">Reynolds Number</div>
<div class="res-val" id="dr-re">-</div>
</div>
<div class="res-row">
<div class="res-label">Friction Factor (f)</div>
<div class="res-val" id="dr-f">-</div>
</div>
<div class="res-row" style="border-bottom:none">
<div class="res-label">Flow Regime</div>
<div class="res-val" id="dr-regime">-</div>
</div>
</div>
</div><!-- /calc-col-panel -->
<div id="duct-warn-area" style="margin-top:10px"></div>
<!-- Calculation steps card -->
<div class="scard" style="margin-top:10px">
<div class="expand-toggle" data-action-click="toggleExpand('duct-steps')">
<div class="expand-title">∑ Calculation Steps</div>
<span id="duct-steps-arrow">▼</span>
</div>
<div class="expand-body" id="duct-steps" style="display:none">
<div class="formula-step">
<div style="display:flex;align-items:center;gap:8px;margin-bottom:4px">
<div class="fs-num">1</div>
<div class="fs-label">Iterative diameter solve (Darcy-Weisbach)</div>
</div>
<div class="fs-expr">ΔP/L = f·ρ·v²/(2D), v = 4Q/(π·D²)</div>
<div class="fs-result" id="dfs1">-</div>
</div>
<div class="formula-step">
<div style="display:flex;align-items:center;gap:8px;margin-bottom:4px">
<div class="fs-num">2</div>
<div class="fs-label">Reynolds number</div>
</div>
<div class="fs-expr">Re = ρ·v·D / μ</div>
<div class="fs-result" id="dfs2">-</div>
</div>
<div class="formula-step">
<div style="display:flex;align-items:center;gap:8px;margin-bottom:4px">
<div class="fs-num">3</div>
<div class="fs-label">Colebrook-White friction factor</div>
</div>
<div class="fs-expr">1/√f = −2·log(ε/3.7D + 2.51/(Re·√f))</div>
<div class="fs-result" id="dfs3">-</div>
</div>
<div class="formula-step">
<div style="display:flex;align-items:center;gap:8px;margin-bottom:4px">
<div class="fs-num">4</div>
<div class="fs-label">Actual friction rate</div>
</div>
<div class="fs-expr">ΔP/L = f·ρ·v²/(2·D)</div>
<div class="fs-result" id="dfs4">-</div>
</div>
</div>
</div>
</div><!-- /duct-res -->
</div><!-- /calc-col-right -->
</div><!-- /calc-two-col -->
</div>
`;

window.CalculatorTemplates['pump-head'] = `
<div class="page" id="page-pump-head">
<div class="calc-header" style="background:linear-gradient(135deg,#f78f22,#d17914)">
<div class="calc-title">Pump Head</div>
<div class="calc-std">Discharge volume, piping friction losses, static lift &amp; motor power</div>
</div>
<div class="calc-desc">
            Determine volumetric water requirements, dynamic piping losses, safety margin, and total dynamic head to size the primary electric motor for fire hydrant or sprinkler pump sets.
          </div>
<div class="scard">
<div class="scard-head">
<div class="scard-accent" style="background:#f78f22"></div>
<div class="scard-title">FIRE PROTECTION SIZING PARAMETERS</div>
</div>
<div class="scard-body" style="display:flex; flex-direction:column; gap:12px">
<div class="input-group" style="margin:0">
<div class="input-label">Fire Water Flow Rate <span class="input-unit">USGPM</span></div>
<input class="inp" id="fpump-usgpm" data-action-input="calcFpump()" placeholder="e.g. 500, 750, 1000, 1500" type="number"/>
</div>
<div class="input-group" style="margin-top:12px">
<div class="input-label">Design Flow Rate <span class="input-unit">L/s</span></div>
<input class="inp" id="fpump-flow" readonly="" style="background:#f3f4f6; color:#4b5563; cursor:not-allowed" type="number"/>
</div>
</div>
</div>
<div class="scard">
<div class="scard-head" style="display:flex; justify-content:space-between; align-items:center; width:100%">
<div style="display:flex; align-items:center; gap:8px">
<div class="scard-accent" style="background:#f78f22"></div>
<div class="scard-title">Major &amp; Minor Head Loss (Piping Run)</div>
</div>
<div style="font-family:var(--font); color:var(--text); font-size:12px; font-weight:500; display:flex; align-items:center; gap:4px; text-transform:none">
<span>Friction Factor:</span>
<input id="fpump-fric-factor" data-action-input="calcFpump()" data-action-mouseout="this.style.background='transparent'" data-action-mouseover="this.style.background='rgba(239,68,68,0.12)'; this.style.borderRadius='3px'" style="display:inline-block; width:32px; border:none; background:transparent; font-weight:700; color:#f78f22; text-align:center; padding:2px 0; outline:none; font-family:var(--font); cursor:pointer; font-size:12px; transition:all 0.15s ease" type="text" value="0.4"/>
<span>bar/100m length</span>
</div>
</div>
<div class="scard-body" style="display:flex; flex-direction:column; gap:12px">
<div class="input-group" style="margin:0">
<div class="input-label">Vertical Pipe Length <span class="input-unit">m</span></div>
<input class="inp" id="fpump-pipe-vert" data-action-input="calcFpump()" type="number" value="30"/>
</div>
<div class="input-group" style="margin:0">
<div class="input-label">Horizontal Pipe Length <span class="input-unit">m</span></div>
<input class="inp" id="fpump-pipe-horiz" data-action-input="calcFpump()" type="number" value="100"/>
</div>
<div class="input-group" style="margin:0">
<div class="input-label">Elbows &amp; Reducers Equiv. <span class="input-unit">m</span></div>
<input class="inp" id="fpump-pipe-elbows" readonly="" style="background:#f3f4f6; color:#4b5563; cursor:not-allowed" type="number"/>
</div>
<div class="input-group" style="margin:0">
<div class="input-label">Isolation Valves Equiv. <span class="input-unit">m</span></div>
<input class="inp" id="fpump-pipe-valves" readonly="" style="background:#f3f4f6; color:#4b5563; cursor:not-allowed" type="number"/>
</div>
<div class="input-group" style="margin:0">
<div class="input-label">Equivalent Length <span class="input-unit">m</span></div>
<input class="inp" id="fpump-pipe-equiv-input" readonly="" style="background:#f3f4f6; color:#4b5563; cursor:not-allowed" type="number"/>
</div>
<div class="input-group" style="margin:0">
<div class="input-label">Major + Minor Losses <span class="input-unit">bar</span></div>
<input class="inp" id="fpump-pipe-loss-input" readonly="" style="background:#f3f4f6; color:#4b5563; cursor:not-allowed" type="number"/>
</div>
</div>
</div>
<div class="scard">
<div class="scard-head">
<div class="scard-accent" style="background:#f78f22"></div>
<div class="scard-title">Pump Head Requirement</div>
</div>
<div class="scard-body" style="display:flex; flex-direction:column; gap:12px">
<div class="input-group" style="margin:0">
<div class="input-label">Pressure Drop in the Piping <span class="input-unit">bar</span></div>
<input class="inp" id="fpump-pipe-loss-input-head" readonly="" style="background:#f3f4f6; color:#4b5563; cursor:not-allowed" type="number"/>
</div>
<div class="input-group" style="margin:0">
<div class="input-label">Static Head <span class="input-unit">bar</span></div>
<input class="inp" id="fpump-static-head" data-action-input="calcFpump()" step="0.1" type="number" value="3.0"/>
</div>
<div class="input-group" style="margin:0">
<div class="input-label">Residual Pressure at Outlet <span class="input-unit">bar</span></div>
<input class="inp" id="fpump-presid" data-action-input="calcFpump()" step="0.1" type="number" value="2.0"/>
</div>
<div class="input-group" style="margin:0">
<div class="input-label">Suction Pressure (Available) <span class="input-unit">bar</span></div>
<input class="inp" id="fpump-suction-p" data-action-input="calcFpump()" step="0.1" style="background:#fff5e6; color:#d17914" type="number" value="0.0"/>
</div>
<div class="input-group" style="margin:0">
<div class="input-label">Considering safety margin <span class="input-unit">%</span></div>
<input class="inp" id="fpump-sf-head" data-action-input="calcFpump()" type="number" value="5"/>
</div>
<div class="input-group" style="margin:0">
<div class="input-label">Head for the Pump <span class="input-unit">bar</span></div>
<input class="inp" id="fpump-pump-head-calc-input" readonly="" style="background:#f3f4f6; color:#4b5563; cursor:not-allowed" type="number"/>
</div>
</div>
</div>
<div class="scard">
<div class="scard-head">
<div class="scard-accent" style="background:#f78f22"></div>
<div class="scard-title">Selected Head &amp; Efficiency for Motor Sizing</div>
</div>
<div class="scard-body">
<div class="input-group">
<div class="input-label">Selected Head for the Pump <span class="input-unit">bar</span></div>
<input class="inp" id="fpump-selected-head" data-action-input="calcFpump()" placeholder="Same as calculated head if blank" type="number"/>
</div>
<div style="display:grid; grid-template-columns:1fr 1fr; gap:12px; margin-top:12px">
<div class="input-group" style="margin:0">
<div class="input-label">Motor Efficiency <span class="input-unit">%</span></div>
<input class="inp" id="fpump-eff-motor" data-action-input="calcFpump()" type="number" value="85"/>
</div>
<div class="input-group" style="margin:0">
<div class="input-label">Pump Efficiency <span class="input-unit">%</span></div>
<input class="inp" id="fpump-eff-pump" data-action-input="calcFpump()" type="number" value="70"/>
</div>
</div>
</div>
</div>
<!-- ACTIONS -->
<div style="display:flex; gap:12px; margin-top:8px">
<button class="calc-btn red" data-action-click="calcFpump(); showRes('fpump-res')" style="margin:0; flex:1.2; background:#f78f22; color:#fff">⚡ Calculate Pump Head</button>
<button class="calc-btn blue" data-action-click="fpumpExportToExcel()" style="margin:0; flex:1; display:flex; align-items:center; justify-content:center; gap:8px; background:var(--blue)">
<span>📊</span> Export Excel
            </button>
</div>
<!-- RESULTS CARD -->
<div id="fpump-res" style="display:none">
<div class="duty-card" style="background:linear-gradient(135deg,#f78f22,#d17914)">
<div class="duty-label">Pump Head Duty</div>
<div class="duty-grid">
<div>
<div class="duty-col-label">Flow Rate</div>
<div class="duty-val" id="fpump-duty-flow">-</div>
<div class="duty-unit">L/s</div>
</div>
<div class="duty-divider"></div>
<div>
<div class="duty-col-label">Required Head</div>
<div class="duty-val" id="fpump-duty-head">-</div>
<div class="duty-unit">bar</div>
</div>
</div>
</div>
<!-- DETAIL BREAKDOWN -->
<div class="scard">
<div class="scard-head">
<div class="scard-accent" style="background:#f78f22"></div>
<div class="scard-title">1. Friction and Equivalent Length Breakdown</div>
</div>
<div class="scard-body">
<div class="res-row">
<div class="res-label">Sum of Component Lengths</div>
<div class="res-val" id="fpump-res-total-len">-</div>
</div>
<div class="res-row">
<div class="res-label">Total Equivalent Length (with Safety)</div>
<div class="res-val" id="fpump-res-equiv-len">-</div>
</div>
<div class="res-row">
<div class="res-label">Major + Minor Friction Losses</div>
<div class="res-val" id="fpump-res-friction-loss">-</div>
</div>
</div>
</div>
<div class="scard">
<div class="scard-head">
<div class="scard-accent" style="background:#f78f22"></div>
<div class="scard-title">2. Sizing Head Requirements</div>
</div>
<div class="scard-body">
<div class="res-row">
<div class="res-label">Piping Friction Losses</div>
<div class="res-val" id="fpump-res-loss-val">-</div>
</div>
<div class="res-row">
<div class="res-label">Static Elevation Lift</div>
<div class="res-val" id="fpump-res-static-val">-</div>
</div>
<div class="res-row">
<div class="res-label">Residual Head at Outlet</div>
<div class="res-val" id="fpump-res-outlet-val">-</div>
</div>
<div class="res-row">
<div class="res-label">Suction Pressure (Deducted)</div>
<div class="res-val" id="fpump-res-suction-val" style="color:#d17914">-</div>
</div>
<div class="res-row">
<div class="res-label">Total Calculated Pump Head</div>
<div class="res-val primary" id="fpump-res-total-pump-head" style="color:#f78f22; font-weight:700">-</div>
</div>
</div>
</div>
<div class="scard">
<div class="scard-head">
<div class="scard-accent" style="background:#f78f22"></div>
<div class="scard-title">3. Calculations for Motor Selection</div>
</div>
<div class="scard-body">
<div class="res-row">
<div class="res-label">Selected Head for the Pump</div>
<div class="res-val" id="fpump-res-sel-head">-</div>
</div>
<div class="res-row">
<div class="res-label">Pump Flow Rate</div>
<div class="res-val" id="fpump-res-flow-kg">-</div>
</div>
<div class="res-row">
<div class="res-label">Pressure Lift Requirement</div>
<div class="res-val" id="fpump-res-lift-kpa">-</div>
</div>
<div class="res-row">
<div class="res-label">Shaft Power Requirement</div>
<div class="res-val" id="fpump-res-shaft-kw">-</div>
</div>
<div class="res-row" style="background:rgba(239,68,68,0.08); padding:8px; border-radius:6px">
<div class="res-label" style="font-weight:700; color:#f78f22">Estimated Motor Power</div>
<div class="res-val primary" id="fpump-res-motor-power" style="color:#f78f22; font-weight:800; font-size:15px">-</div>
</div>
</div>
</div>
</div>
</div>
`;

window.CalculatorTemplates['hvac-pipe'] = `
<div class="page" id="page-hvac-pipe">
<div class="calc-header">
<div class="calc-title">Pipe Sizer - CHW / CW</div>
<div class="calc-std">ASHRAE / SMACNA - Velocity &amp; Pressure Drop Method</div>
</div>
<div class="calc-desc">Size chilled water or condenser water pipes. Iterates through Sch 40 sizes to find the
            smallest meeting target ΔP. Glycol viscosity correction included.</div>
<div class="scard">
<div class="scard-head">
<div class="scard-accent" style="background:var(--blue)"></div>
<div class="scard-title">Inputs</div>
</div>
<div class="scard-body">
<div class="input-group">
<div class="input-label">Flow Rate <span class="input-unit" id="hp-flow-unit">GPM</span></div>
<input class="inp" id="hp-flow" data-action-input="calcHvacPipe()" placeholder="e.g. 80" type="number"/>
</div>
<div class="input-group">
<div class="input-label">Fluid Type</div>
<select class="inp inp-select" id="hp-fluid" data-action-change="calcHvacPipe()">
<option value="chw">Chilled Water</option>
<option value="cw">Condenser Water</option>
<option value="g25">25% Glycol</option>
<option value="g40">40% Glycol</option>
</select>
</div>
<div class="input-group">
<div class="input-label">Fluid Temperature <span class="input-unit" id="hp-temp-unit">°F</span></div>
<input class="inp" id="hp-temp" data-action-input="calcHvacPipe()" placeholder="e.g. 44" type="number"/>
</div>
<div class="input-group">
<div class="input-label">Pipe Material</div>
<select class="inp inp-select" id="hp-mat" data-action-change="calcHvacPipe()">
<option value="0.000046">Carbon Steel</option>
<option value="0.0000015">Copper</option>
<option value="0.000150">Galvanized Steel</option>
</select>
</div>
<div class="input-group">
<div class="input-label">Target ΔP <span class="input-unit" id="hp-dp-unit">ft w.g./100ft</span></div>
<input class="inp" id="hp-dp" data-action-input="calcHvacPipe()" placeholder="e.g. 4.0" type="number"/>
</div>
</div>
</div>
<button class="calc-btn blue" data-action-click="calcHvacPipe();showRes('hvac-pipe-res')">⚡ Size Pipe</button>
<div id="hvac-pipe-res" style="display:none">
<div id="hp-warn-area"></div>
<div class="scard">
<div class="scard-head">
<div class="scard-accent" style="background:var(--blue)"></div>
<div class="scard-title">Pipe Selection</div>
</div>
<div class="scard-body">
<div class="res-row">
<div class="res-label">Selected Pipe Size</div>
<div class="res-val primary" id="hp-size">-</div>
</div>
<div class="res-row">
<div class="res-label">Internal Diameter</div>
<div class="res-val" id="hp-id">-</div>
</div>
<div class="res-row">
<div class="res-label">Velocity</div>
<div class="res-val primary" id="hp-vel">-</div>
</div>
<div class="res-row">
<div class="res-label">Pressure Drop</div>
<div class="res-val" id="hp-dp-res">-</div>
</div>
<div class="res-row">
<div class="res-label">Reynolds Number</div>
<div class="res-val" id="hp-re">-</div>
</div>
<div class="res-row">
<div class="res-label">Flow Regime</div>
<div class="res-val" id="hp-regime">-</div>
</div>
</div>
</div>
</div>
</div>
`;

window.CalculatorTemplates['ventilation'] = `
<div class="page two-col-page pcl-shell" id="page-ventilation">
<div class="calc-header" style="background:linear-gradient(135deg,#f78f22,#d17914)">
<div class="calc-title">VENTILATION</div>
<div class="calc-std">ASHRAE 62.1-2019 Ventilation Rate Procedure / ACH method</div>
</div>
<div class="calc-desc" style="background:#EEF4FF;border-color:rgba(0,102,204,0.2)">
            Professional engineering schedule for building ventilation and extract air balancing.
            All rates are calculated based on ASHRAE 62.1 standards.
          </div>
<!-- Engineering Schedule Single Card Component (Space Schedule) -->
<div class="vent-schedule-container scard" style="margin-top:16px; padding:0; overflow:visible !important; border-radius:var(--r-md); box-shadow:var(--shadow-md); position:relative; z-index:20">
  
  <!-- Header Section -->
  <div style="padding:12px 20px; border-bottom:1px solid var(--border); display:flex; align-items:center; justify-content:space-between; gap:16px; min-height:56px">
    <!-- Left: Title -->
    <div style="display:flex; align-items:center; gap:8px">
      <div style="width:3px; height:18px; background:var(--blue); border-radius:2px"></div>
      <div style="font-weight:800; font-size:13px; color:var(--text); text-transform:uppercase; letter-spacing:0.5px">Space Schedule</div>
      <div id="vent-selected-spaces-counter-container" style="display:none; align-items:center; gap:6px; margin-left:12px; padding:2px 8px; background:#e0f2fe; border:1px solid #bae6fd; border-radius:12px; line-height: 1">
        <span id="vent-selected-spaces-count" style="font-size:11px; font-weight:600; color:#0369a1; white-space:nowrap">0 selected</span>
        <button onclick="ventCancelSpaceSelection()" style="background:none; border:none; color:#ef4444; font-size:10px; font-weight:bold; cursor:pointer; padding:0 2px; line-height: 1; display: flex; align-items: center" title="Cancel Selection">✕</button>
      </div>
    </div>
    
    <!-- Right: Search Bar & Actions Dropdown -->
    <div style="display:flex; align-items:center; gap:12px; flex:1; max-width:400px; justify-content:flex-end">
      <!-- Search Input -->
      <div class="search-box" style="width:100%; padding:6px 12px; border-radius:8px; background:var(--bg)">
        <span class="search-icon">🔍</span>
        <input class="search-inp" id="vent-search" data-action-input="renderVentTable()" placeholder="Search spaces, floors..." type="text"/>
      </div>
      
      <!-- Actions Dropdown -->
      <div style="position:relative">
        <button id="vent-dots-btn" data-action-click="ventToggleDropdown(event)" 
                data-action-mouseover="this.style.background='#f1f5f9'; this.style.color='#1e293b'"
                data-action-mouseout="this.style.background='transparent'; this.style.color='#64748b'"
                style="width:32px; height:32px; border:none; background:transparent; color:#64748b; cursor:pointer; display:flex; align-items:center; justify-content:center; font-size:20px; font-weight:bold; border-radius:6px; outline:none; transition:all 0.2s" 
                title="Actions">
          ⋮
        </button>
        <!-- Floating Dropdown Menu -->
        <div id="vent-dots-dropdown" style="display:none; position:absolute; right:0; top:36px; background:#ffffff; border:1px solid #e2e8f0; border-radius:8px; box-shadow:0 4px 6px -1px rgba(0,0,0,0.1), 0 2px 4px -1px rgba(0,0,0,0.06), 0 10px 15px -3px rgba(0,0,0,0.1); width:180px; z-index:100; padding:4px 0">
          <div class="vent-dropdown-item" data-action-click="ventTriggerCreateZone(); ventToggleDropdown(event)" 
               data-action-mouseover="this.style.background='#f1f5f9'" 
               data-action-mouseout="this.style.background='transparent'"
               style="display:flex; align-items:center; gap:8px; padding:8px 12px; font-size:12px; font-weight:500; color:#334155; cursor:pointer; transition:background 0.15s">
            <span style="font-size:14px">📁</span> Create Zone
          </div>
          <div class="vent-dropdown-item" data-action-click="ventTriggerAutoZoning(); ventToggleDropdown(event)" 
               data-action-mouseover="this.style.background='#f1f5f9'" 
               data-action-mouseout="this.style.background='transparent'"
               style="display:flex; align-items:center; gap:8px; padding:8px 12px; font-size:12px; font-weight:500; color:#334155; cursor:pointer; transition:background 0.15s">
            <span style="font-size:14px">⚡</span> Auto-Zone
          </div>
          <div id="vent-menu-bulk" class="vent-dropdown-item disabled" data-action-click="if(!this.classList.contains('disabled')) { ventTriggerBulkEdit(); ventToggleDropdown(event); }" 
               data-action-mouseover="if(!this.classList.contains('disabled')) this.style.background='#f1f5f9'" 
               data-action-mouseout="this.style.background='transparent'"
               style="display:flex; align-items:center; gap:8px; padding:8px 12px; font-size:12px; font-weight:500; color:#cbd5e1; cursor:not-allowed; transition:background 0.15s">
            <span style="font-size:14px">✏️</span> Bulk Edit
          </div>
          <div id="vent-menu-merge" class="vent-dropdown-item disabled" data-action-click="if(!this.classList.contains('disabled')) { ventTriggerMergeSpaces(); ventToggleDropdown(event); }" 
               data-action-mouseover="if(!this.classList.contains('disabled')) this.style.background='#f1f5f9'" 
               data-action-mouseout="this.style.background='transparent'"
               style="display:flex; align-items:center; gap:8px; padding:8px 12px; font-size:12px; font-weight:500; color:#cbd5e1; cursor:not-allowed; transition:background 0.15s">
            <span style="font-size:14px">🔗</span> Merge Spaces
          </div>
          
          <div style="height:1px; background:#f1f5f9; margin:4px 0"></div>
          
          <div class="vent-dropdown-item" data-action-click="ventOpenImportModal(event); ventToggleDropdown(event)" 
               data-action-mouseover="this.style.background='#f1f5f9'" 
               data-action-mouseout="this.style.background='transparent'"
               style="display:flex; align-items:center; gap:8px; padding:8px 12px; font-size:12px; font-weight:500; color:#334155; cursor:pointer; transition:background 0.15s">
            <span style="font-size:14px">📥</span> Import
          </div>
          <div class="vent-dropdown-item" data-action-click="ventExportExcel(); ventToggleDropdown(event)" 
               data-action-mouseover="this.style.background='#f1f5f9'" 
               data-action-mouseout="this.style.background='transparent'"
               style="display:flex; align-items:center; gap:8px; padding:8px 12px; font-size:12px; font-weight:500; color:#334155; cursor:pointer; transition:background 0.15s">
            <span style="font-size:14px">📊</span> Export
          </div>
          <div class="vent-dropdown-item" data-action-click="ventOpenReportModal(event); ventToggleDropdown(event)" 
               data-action-mouseover="this.style.background='#f1f5f9'" 
               data-action-mouseout="this.style.background='transparent'"
               style="display:flex; align-items:center; gap:8px; padding:8px 12px; font-size:12px; font-weight:500; color:#334155; cursor:pointer; transition:background 0.15s">
            <span style="font-size:14px">📋</span> Export Report
          </div>
          
          <div style="height:1px; background:#f1f5f9; margin:4px 0"></div>
          
          <div id="vent-menu-delete" class="vent-dropdown-item disabled" data-action-click="if(!this.classList.contains('disabled')) { ventDeleteSelected(); ventToggleDropdown(event); }" 
               data-action-mouseover="if(!this.classList.contains('disabled')) this.style.background='#f1f5f9'" 
               data-action-mouseout="this.style.background='transparent'"
               style="display:flex; align-items:center; gap:8px; padding:8px 12px; font-size:12px; font-weight:500; color:#cbd5e1; cursor:not-allowed; transition:background 0.15s">
            <span style="font-size:14px">🗑️</span> Delete Selected
          </div>
          <div class="vent-dropdown-item" data-action-click="ventClearAll(); ventToggleDropdown(event)" 
               data-action-mouseover="this.style.background='#fee2e2'" 
               data-action-mouseout="this.style.background='transparent'"
               style="display:flex; align-items:center; gap:8px; padding:8px 12px; font-size:12px; font-weight:600; color:#ef4444; cursor:pointer; transition:background 0.15s">
            <span style="font-size:14px">🧹</span> Clear All
          </div>
        </div>
      </div>
    </div>
  </div>

  <div class="vent-table-scroll" style="overflow:auto; max-height:calc(100vh - 380px); position:relative; border-bottom-left-radius:var(--r-md); border-bottom-right-radius:var(--r-md)">
<table class="vent-eng-table" style="width:100%; border-collapse:collapse; font-size:11.5px; table-layout:fixed; min-width:1120px">
<colgroup>
<col style="width:36px"/>
<col style="width:220px"/>
<col style="width:280px"/>
<col style="width:90px"/>
<col style="width:65px"/>
<col style="width:60px"/>
<col style="width:55px"/>
<col style="width:70px"/>
<col style="width:75px"/>
<col style="width:75px"/>
<col style="width:40px"/>
<col style="width:55px"/>
</colgroup>
<thead>
<tr style="background:var(--blue); color:#fff; position:sticky; top:0; z-index:10; box-shadow:0 2px 4px rgba(0,0,0,0.1)">
<th style="padding:9px 6px; text-align:center"><input id="vent-select-all" data-action-click="ventToggleSelectAll(this.checked)" data-action-change="ventCheckboxChanged()" style="cursor:pointer" type="checkbox"/></th>
<th style="padding:9px 10px; text-align:left; font-weight:700; font-size:11px">Space Name</th>
<th style="padding:9px 10px; text-align:left; font-weight:700; font-size:11px">Occupancy Category</th>
<th style="padding:9px 6px; text-align:center; font-weight:700; font-size:11px">Pressure</th>
<th style="padding:9px 6px; text-align:center; font-weight:700; font-size:11px">Area<br/><span style="font-weight:400;font-size:9.5px;opacity:.85">(m²)</span></th>
<th style="padding:9px 6px; text-align:center; font-weight:700; font-size:11px">Height<br/><span style="font-weight:400;font-size:9.5px;opacity:.85">(m)</span></th>
<th style="padding:9px 6px; text-align:center; font-weight:700; font-size:11px">Default<br/><span style="font-weight:400;font-size:9.5px;opacity:.85">Occ.</span></th>
<th style="padding:9px 6px; text-align:center; font-weight:700; font-size:11px">Fixtures/<br/><span style="font-weight:400;font-size:9.5px;opacity:.85">Occupancy</span></th>
<th style="padding:9px 6px; text-align:center; font-weight:700; font-size:11px">Min Fresh<br/><span style="font-weight:400;font-size:9.5px;opacity:.85">Air (L/s)</span></th>
<th style="padding:9px 6px; text-align:center; font-weight:700; font-size:11px">Min Extract<br/><span style="font-weight:400;font-size:9.5px;opacity:.85">Air (L/s)</span></th>
<th style="padding:9px 4px; text-align:center; font-weight:700; font-size:11px">Mult</th>
<th style="padding:9px 4px; text-align:center; font-weight:700; font-size:11px">Actions</th>
</tr>
</thead>
<!-- Entry Row -->
<tbody id="vent-entry-tbody">
<tr id="vent-entry-row" style="background:#f0f6ff; border-bottom:1px dashed #93c5fd">
<td style="padding:5px 6px; text-align:center; border-right:1px solid #bfdbfe; font-weight:700; color:var(--blue)">
                      +
                    </td>
<td style="padding:5px 6px; border-right:1px solid #bfdbfe">
<div style="position:relative; display:flex; align-items:center;">
<input class="pcl-inline-inp" id="vent-form-name" data-action-change="ventFormNameInput(this.value)" data-action-keydown="window.ventFormNameKeydown(event)" placeholder="e.g. 1F - Office 101" style="width:100%" type="text"/>
</div>
</td>
<td style="padding:5px 6px; border-right:1px solid #bfdbfe">
<div style="position:relative; display:flex; flex-direction:column; gap:4px;">
<select class="pcl-inline-select" id="vent-form-cat" data-action-change="ventFormCategoryChanged(this.value)" style="width:100%; font-size:11.5px">
<option value="">— Select Category —</option>
</select>
<span id="vent-form-ai-low-confidence" style="display:none; font-size:9.5px; color:#b45309; font-weight:700; text-align:left; line-height:1.2; word-break:break-word; cursor:pointer" title="Click to apply the suggestion">Review Suggested Category</span>
</div>
</td>
<td style="padding:5px 6px; border-right:1px solid #bfdbfe">
<select class="pcl-inline-select" id="vent-form-pressure" style="width:100%; font-size:11.5px">
<option value="Neutral" selected>Neutral (0)</option>
<option value="Positive">Positive (+1)</option>
<option value="Negative">Negative (-1)</option>
<option value="Critical">Critical (-2)</option>
</select>
</td>
<td style="padding:5px 6px; border-right:1px solid #bfdbfe">
<input class="pcl-inline-inp" id="vent-form-area" min="0" data-action-keydown="if(event.key==='Enter') ventAddFromForm()" placeholder="m²" step="any" style="width:100%; text-align:center" type="number"/>
</td>
<td style="padding:5px 6px; border-right:1px solid #bfdbfe">
<input class="pcl-inline-inp" id="vent-form-height" min="0" data-action-keydown="if(event.key==='Enter') ventAddFromForm()" placeholder="m" step="any" style="width:100%; text-align:center" type="number"/>
</td>
<td id="vent-form-default-occ" style="padding:8px 6px; text-align:center; font-size:12px; color:var(--hint); border-right:1px solid #bfdbfe; font-style:italic">
                      -</td>
<td style="padding:5px 6px; border-right:1px solid #bfdbfe">
<input class="pcl-inline-inp" id="vent-form-fixtures" min="0" data-action-keydown="if(event.key==='Enter') ventAddFromForm()" placeholder="—" style="width:100%; text-align:center" type="number"/>
</td>
<td colspan="2" style="padding:8px 10px; text-align:center; color:#94a3b8; font-size:11px; font-style:italic; border-right:1px solid #bfdbfe; background:rgba(241,245,249,0.6)">
                      Auto-calculated after adding
                    </td>
<td colspan="2" style="padding:5px 4px; text-align:center">
<button class="pcl-inline-btn" data-action-click="ventAddFromForm()" style="width:100%; padding:5px 12px; font-size:11px; font-weight:700; background:var(--blue); color:#fff; border:none; border-radius:6px; cursor:pointer; white-space:nowrap">Done</button>
</td>
</tr>
</tbody>
<tbody id="vent-tbody">
<tr class="vent-row-mock">
<td colspan="12" style="padding:60px; text-align:center; color:var(--hint); background:rgba(0,0,0,0.01)">
<div style="font-size:32px; margin-bottom:8px">🌬️</div>
<div style="font-weight:700">Engineering Schedule Empty</div>
<div style="font-size:12px; margin-top:4px">Fill in the entry row above and click "Done" to add spaces.</div>
</td>
</tr>
</tbody>
<tbody id="vent-empty" style="display:none">
<tr class="vent-row-mock">
<td colspan="12" style="padding:60px; text-align:center; color:var(--hint); background:rgba(0,0,0,0.01)">
<div style="font-size:32px; margin-bottom:8px">🌬️</div>
<div style="font-weight:700">Engineering Schedule Empty</div>
<div style="font-size:12px; margin-top:4px">Fill in the entry row above and click "Done" to add spaces.</div>
</td>
</tr>
</tbody>
<tfoot id="vent-tfoot" style="position:sticky; bottom:0; z-index:10; background:var(--bg); border-top:2px solid var(--blue)">
<tr style="font-weight:800; color:var(--text); height:40px">
<td colspan="8" style="text-align:right; padding:0 16px; border-right:1px solid var(--border)">
                      SCHEDULE TOTALS</td>
<td id="total-min-oa" style="text-align:center; background:rgba(0,0,0,0.03); border-right:1px solid var(--border)">0.0
                    </td>
<td id="total-min-ext" style="text-align:center; background:rgba(0,0,0,0.03); border-right:1px solid var(--border)">0.0
                    </td>
<td colspan="2" style="background:rgba(0,0,0,0.03)"></td>
</tr>
</tfoot>
</table>
</div>
</div>

<!-- ZONE SCHEDULE Section -->
<div class="vent-zone-schedule-container scard" style="margin-top:24px; padding:0; overflow:hidden; border-radius:var(--r-md); box-shadow:var(--shadow-md)">
  
  <!-- Header Section -->
  <div style="padding:12px 20px; border-bottom:1px solid var(--border); display:flex; align-items:center; justify-content:space-between; gap:16px; min-height:56px">
    <!-- Left: Title -->
    <div style="display:flex; align-items:center; gap:8px">
      <div style="width:3px; height:18px; background:#f78f22; border-radius:2px"></div>
      <div style="font-weight:800; font-size:13px; color:var(--text); text-transform:uppercase; letter-spacing:0.5px">Zone Schedule</div>
    </div>
    
    <!-- Right: Search Bar -->
    <div style="display:flex; align-items:center; gap:12px; flex:1; max-width:400px; justify-content:flex-end">
      <!-- Search Input -->
      <div class="search-box" style="width:100%; padding:6px 12px; border-radius:8px; background:var(--bg)">
        <span class="search-icon">🔍</span>
        <input class="search-inp" id="vent-zone-search" data-action-input="renderVentTable()" placeholder="Search zones..." type="text"/>
      </div>
    </div>
  </div>

  <div class="vent-zone-table-scroll" style="overflow:auto; max-height:calc(100vh - 380px); position:relative">
    <table class="vent-zone-eng-table" style="width:100%; border-collapse:collapse; font-size:11.5px; table-layout:fixed; min-width:800px">
      <colgroup>
        <col style="width:36px"/>
        <col/>
        <col style="width:90px"/>
        <col style="width:100px"/>
        <col style="width:100px"/>
        <col style="width:110px"/>
        <col style="width:110px"/>
        <col style="width:120px"/>
        <col style="width:120px"/>
      </colgroup>
      <thead>
        <tr style="background:#f78f22; color:#fff; position:sticky; top:0; z-index:10; box-shadow:0 2px 4px rgba(0,0,0,0.1)">
          <th style="padding:9px 6px; text-align:center">
            <input id="vent-zone-select-all" onclick="ventToggleAllZonesCheckbox(this.checked)" style="cursor:pointer" type="checkbox"/>
          </th>
          <th style="padding:9px 10px; text-align:left; font-weight:700; font-size:11px">Zone Name</th>
          <th style="padding:9px 6px; text-align:center; font-weight:700; font-size:11px">Floor</th>
          <th style="padding:9px 6px; text-align:center; font-weight:700; font-size:11px">No. of Spaces</th>
          <th style="padding:9px 6px; text-align:center; font-weight:700; font-size:11px">Total Area<br/><span style="font-weight:400;font-size:9.5px;opacity:.85">(m²)</span></th>
          <th style="padding:9px 6px; text-align:center; font-weight:700; font-size:11px">Total FA Min<br/><span style="font-weight:400;font-size:9.5px;opacity:.85">(L/s)</span></th>
          <th style="padding:9px 6px; text-align:center; font-weight:700; font-size:11px">Total EA Min<br/><span style="font-weight:400;font-size:9.5px;opacity:.85">(L/s)</span></th>
          <th style="padding:9px 6px; text-align:center; font-weight:700; font-size:11px">Total FA Given<br/><span style="font-weight:400;font-size:9.5px;opacity:.85">(L/s)</span></th>
          <th style="padding:9px 6px; text-align:center; font-weight:700; font-size:11px">Total EA Taken<br/><span style="font-weight:400;font-size:9.5px;opacity:.85">(L/s)</span></th>
        </tr>
      </thead>
      <tbody id="vent-zone-tbody">
        <!-- populated dynamically -->
      </tbody>
      <tfoot id="vent-zone-tfoot" style="position:sticky; bottom:0; z-index:10; background:var(--bg); border-top:2px solid #f78f22; display:none">
        <tr style="font-weight:800; color:var(--text); height:40px">
          <td colspan="3" style="padding:0 16px; border-right:1px solid var(--border)">
            <div style="display:flex; justify-content:space-between; align-items:center; width:100%">
              <span>ZONE TOTALS</span>
              <button id="vent-toggle-summary-btn" data-action-click="ventToggleSummary()" class="pcl-inline-btn" style="width:auto; padding:4px 12px; font-size:11px; background:var(--brand); border-radius:4px; font-weight:700; cursor:pointer; color:#fff; border:none; transition:all 0.15s ease" data-action-mouseover="this.style.background='var(--brand-md)'" data-action-mouseout="this.style.background='var(--brand)'">View More</button>
            </div>
          </td>
          <td id="zone-total-spaces" style="text-align:center; background:rgba(0,0,0,0.03); border-right:1px solid var(--border)">0</td>
          <td id="zone-total-area" style="text-align:center; background:rgba(0,0,0,0.03); border-right:1px solid var(--border)">0.0</td>
          <td id="zone-total-min-oa" style="text-align:center; background:rgba(0,0,0,0.03); border-right:1px solid var(--border)">0.0</td>
          <td id="zone-total-min-ext" style="text-align:center; background:rgba(0,0,0,0.03); border-right:1px solid var(--border)">0.0</td>
          <td id="zone-total-given-fa" style="text-align:center; background:rgba(59,130,246,0.05); color:var(--blue); border-right:1px solid var(--border)">0.0</td>
          <td id="zone-total-taken-ext" style="text-align:center; background:rgba(236,72,153,0.05); color:#ec4899;">0.0</td>
        </tr>
      </tfoot>
    </table>
  </div>
</div>

<!-- Collapsible Summary Panel -->
<div id="vent-summary-panel" style="max-height:0px; overflow:hidden; opacity:0; margin-top:0px; transition:max-height 0.35s cubic-bezier(0.4, 0, 0.2, 1), opacity 0.35s ease, margin-top 0.35s ease">
  <!-- Summary Cards Section -->
  <div class="vent-summary-grid" style="display:grid; grid-template-columns:repeat(auto-fit, minmax(220px, 1fr)); gap:16px">
  <div class="scard" style="padding:16px; border-left:4px solid var(--blue); display:flex; flex-direction:column; justify-content:space-between; min-height:140px; box-sizing:border-box">
    <div style="font-size:10px; font-weight:700; color:var(--hint); text-transform:uppercase; letter-spacing:1px">Total Fresh Air</div>
    <div style="font-size:11px; color:var(--text); display:flex; flex-direction:column; gap:4px; margin:12px 0 8px; line-height:1.4">
      <div style="display:flex; justify-content:space-between">
        <span>Unzoned Spaces:</span>
        <span id="sum-unzoned-fa" style="font-weight:600">0 L/s</span>
      </div>
      <div style="display:flex; justify-content:space-between">
        <span>Zones:</span>
        <span id="sum-zones-fa" style="font-weight:600">0 L/s</span>
      </div>
    </div>
    <div style="border-top:1px dashed var(--border); padding-top:6px; display:flex; justify-content:space-between; align-items:baseline">
      <span style="font-size:10px; font-weight:700; color:var(--muted); text-transform:uppercase">TOTAL:</span>
      <span id="sum-total-fa" style="font-size:22px; font-weight:800; color:var(--blue)">0 <span style="font-size:12px; font-weight:400; color:var(--hint)">L/s</span></span>
    </div>
  </div>
  <div class="scard" style="padding:16px; border-left:4px solid #ec4899; display:flex; flex-direction:column; justify-content:space-between; min-height:140px; box-sizing:border-box">
    <div style="font-size:10px; font-weight:700; color:var(--hint); text-transform:uppercase; letter-spacing:1px">Total Extract Air</div>
    <div style="font-size:11px; color:var(--text); display:flex; flex-direction:column; gap:4px; margin:12px 0 8px; line-height:1.4">
      <div style="display:flex; justify-content:space-between">
        <span>Unzoned Spaces:</span>
        <span id="sum-unzoned-ext" style="font-weight:600">0 L/s</span>
      </div>
      <div style="display:flex; justify-content:space-between">
        <span>Zones:</span>
        <span id="sum-zones-ext" style="font-weight:600">0 L/s</span>
      </div>
    </div>
    <div style="border-top:1px dashed var(--border); padding-top:6px; display:flex; justify-content:space-between; align-items:baseline">
      <span style="font-size:10px; font-weight:700; color:var(--muted); text-transform:uppercase">TOTAL:</span>
      <span id="sum-total-ext" style="font-size:22px; font-weight:800; color:#ec4899">0 <span style="font-size:12px; font-weight:400; color:var(--hint)">L/s</span></span>
    </div>
  </div>
  <div class="scard" id="sum-fa-bal-card" style="padding:16px; border-left:4px solid var(--green); display:flex; flex-direction:column; justify-content:space-between; min-height:140px; box-sizing:border-box">
    <div style="font-size:10px; font-weight:700; color:var(--hint); text-transform:uppercase; letter-spacing:1px">Air Balance</div>
    <div id="sum-fa-bal" style="font-size:28px; font-weight:800; color:var(--green); margin:12px 0 4px">0.0%</div>
    <div style="border-top:1px dashed var(--border); padding-top:8px; display:flex; justify-content:space-between; align-items:center">
      <span style="font-size:10px; font-weight:700; color:var(--muted); text-transform:uppercase">STATUS:</span>
      <span id="sum-balance-status" style="font-size:13px; font-weight:800; color:var(--green)">Balanced</span>
    </div>
  </div>
  <div class="scard" id="sum-zoning-card" style="padding:16px; border-left:4px solid #f97316; display:flex; flex-direction:column; justify-content:space-between; min-height:140px; box-sizing:border-box">
    <div style="font-size:10px; font-weight:700; color:var(--hint); text-transform:uppercase; letter-spacing:1px">Project Zoning %</div>
    <div id="sum-zoning-pct" style="font-size:28px; font-weight:800; color:#f97316; margin:12px 0 4px">0%</div>
    <div style="border-top:1px dashed var(--border); padding-top:8px; display:flex; justify-content:space-between; align-items:center">
      <span style="font-size:10px; font-weight:700; color:var(--muted); text-transform:uppercase">DETAILS:</span>
      <span id="sum-zoning-subtext" style="font-size:12px; font-weight:700; color:#f97316">No Zones Created</span>
    </div>
  </div>
  </div>
</div>

<!-- EQUIPMENT SCHEDULE Section -->
<div class="vent-equip-schedule-container scard" style="margin-top:24px; padding:0; overflow:hidden; border-radius:var(--r-md); box-shadow:var(--shadow-md)">
  
  <!-- Header Section -->
  <div style="padding:12px 20px; border-bottom:1px solid var(--border); display:flex; align-items:center; justify-content:space-between; gap:16px; min-height:56px">
    <!-- Left: Title -->
    <div style="display:flex; align-items:center; gap:8px">
      <div style="width:3px; height:18px; background:#f78f22; border-radius:2px"></div>
      <div style="font-weight:800; font-size:13px; color:var(--text); text-transform:uppercase; letter-spacing:0.5px">Equipment Schedule</div>
    </div>
    
    <!-- Right: Search Bar -->
    <div style="display:flex; align-items:center; gap:12px; flex:1; max-width:480px; justify-content:flex-end">
      <!-- Delete Selected Button -->
      <button id="vent-equip-delete-selected" onclick="window.ventDeleteSelectedEquipment()" style="display:none; align-items:center; gap:6px; padding:6px 12px; font-size:11.5px; font-weight:700; background:#fee2e2; border:1px solid #fca5a5; border-radius:8px; color:#ef4444; cursor:pointer; transition:all 0.15s ease; white-space:nowrap" onmouseover="this.style.background='#fecaca'" onmouseout="this.style.background='#fee2e2'">
        <svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" style="display:inline-block;vertical-align:middle">
          <polyline points="3 6 5 6 21 6"></polyline>
          <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
          <line x1="10" y1="11" x2="10" y2="17"></line>
          <line x1="14" y1="11" x2="14" y2="17"></line>
        </svg>
        Delete Selected
      </button>
      <!-- Search Input -->
      <div class="search-box" style="width:100%; padding:6px 12px; border-radius:8px; background:var(--bg)">
        <span class="search-icon">🔍</span>
        <input class="search-inp" id="vent-equip-search" oninput="window.renderVentEquipTable()" placeholder="Search equipment..." type="text"/>
      </div>
    </div>
  </div>

  <div class="vent-equip-table-scroll" style="overflow:auto; max-height:calc(100vh - 380px); position:relative">
    <table class="vent-equip-eng-table" style="width:100%; border-collapse:collapse; font-size:11.5px; table-layout:fixed; min-width:800px">
      <colgroup>
        <col style="width:34px"/>
        <col style="width:180px"/>
        <col style="width:160px"/>
        <col/>
        <col style="width:120px"/>
        <col style="width:120px"/>
        <col style="width:50px"/>
      </colgroup>
      <thead>
        <tr style="background:#f78f22; color:#fff; position:sticky; top:0; z-index:10; box-shadow:0 2px 4px rgba(0,0,0,0.1)">
          <th style="padding:9px 6px; text-align:center"><input type="checkbox" id="vent-equip-select-all" onclick="window.ventToggleAllEquipCheckbox(this.checked)" style="cursor:pointer"/></th>
          <th style="padding:9px 10px; text-align:left; font-weight:700; font-size:11px">Equipment Name</th>
          <th style="padding:9px 6px; text-align:center; font-weight:700; font-size:11px">Type</th>
          <th style="padding:9px 6px; text-align:left; font-weight:700; font-size:11px">Assigned Zones</th>
          <th style="padding:9px 6px; text-align:center; font-weight:700; font-size:11px">Total FA<br/><span style="font-weight:400;font-size:9.5px;opacity:.85">(L/s)</span></th>
          <th style="padding:9px 6px; text-align:center; font-weight:700; font-size:11px">Total EA<br/><span style="font-weight:400;font-size:9.5px;opacity:.85">(L/s)</span></th>
          <th style="padding:9px 6px; text-align:center"></th>
        </tr>
      </thead>
      <tbody id="vent-equip-tbody">
        <!-- populated dynamically -->
      </tbody>
      <tfoot id="vent-equip-tfoot" style="position:sticky; bottom:0; z-index:10; background:var(--bg); border-top:2px solid #f78f22">
        <tr style="font-weight:800; color:var(--text); height:40px">
          <td colspan="4" style="padding:0 16px; border-right:1px solid var(--border)">
            <span>EQUIPMENT TOTALS</span>
          </td>
          <td id="equip-total-fa" style="text-align:center; background:rgba(59,130,246,0.05); color:var(--blue); border-right:1px solid var(--border)">0.0</td>
          <td id="equip-total-ea" style="text-align:center; background:rgba(236,72,153,0.05); color:#ec4899; border-right:1px solid var(--border)">0.0</td>
          <td style="text-align:center; background:rgba(0,0,0,0.03)"></td>
        </tr>
      </tfoot>
    </table>
  </div>
</div>

</div>
`;

window.CalculatorTemplates['water-demand'] = `
<div class="page two-col-page pcl-shell" id="page-water-demand">
<div class="calc-header" style="background:linear-gradient(135deg,#f78f22,#d17914)">
<div class="calc-title">💧 Water Demand Calculator</div>
<div class="calc-std">Per-Capita Daily Water Consumption Method · ASHRAE / Local Standards</div>
</div>
<div class="calc-desc" style="background:#EEF4FF;border-color:rgba(0,102,204,0.2)">
            Select the <strong>User Category</strong> for each space — Water Consumption per Person/Day is auto-filled.
            Total = <strong>No. of People × Consumption/Person/Day</strong>. Add multiple entries to build a complete
            site water demand schedule.
          </div>
<div style="display:flex; flex-direction:column; gap:16px;">
<!-- Input Form Panel -->
<div class="scard" style="margin-bottom:0">
<div class="scard-head">
<div class="scard-accent" style="background:var(--brand)"></div>
<div class="scard-title">Add Entry (e.g. Office Floor 1)</div>
</div>
<div class="scard-body" style="background:#f9f9f9; padding:20px;">
<div style="display:grid; grid-template-columns: minmax(180px,2fr) minmax(100px,1fr) minmax(220px,2fr) auto; gap:16px; align-items:end;">
<div class="input-group pcl-field" style="margin-bottom:0">
<div class="input-label">Description</div>
<input class="inp" id="wd-in-name" data-action-input="wdPreview()" placeholder="e.g. Office Floor 1, Apartments Block A" type="text"/>
</div>
<div class="input-group pcl-field" style="margin-bottom:0">
<div class="input-label">No. of People</div>
<input class="inp" id="wd-in-people" min="0" data-action-input="wdPreview()" placeholder="e.g. 50" step="1" type="number"/>
</div>
<div class="input-group pcl-field" style="margin-bottom:0">
<div class="input-label">Space / User Category</div>
<select class="inp inp-select" id="wd-in-type" data-action-change="wdPreview();wdCommitIfReady()">
<option value="">— Select Category —</option>
<optgroup label="Residential">
<option data-lpd="300" value="Residential buildings (flat)">Residential buildings (flat) —
                          200–300</option>
<option data-lpd="350" value="Villas">Villas — 250–350</option>
<option data-lpd="350" value="Mixed used residential">Mixed used residential — 250–350</option>
<option data-lpd="150" value="Labour accommodation">Labour accommodation — 80–150</option>
</optgroup>
<optgroup label="Office &amp; Commercial">
<option data-lpd="60" value="Offices">Offices — 45–60</option>
<option data-lpd="80" value="Headquarters">Headquarters — 60–80</option>
<option data-lpd="100" value="Commercial buildings">Commercial buildings — 60–100</option>
<option data-lpd="80" value="Mixed used commercial">Mixed used commercial — 60–80</option>
<option data-lpd="75" value="Logistic, academic &amp; business center">Logistic, academic &amp;
                          business center — 60–75</option>
</optgroup>
<optgroup label="Retail &amp; Leisure">
<option data-lpd="82" value="Local plaza / retail / town center">Local plaza / retail / town
                          center — 60–82</option>
<option data-lpd="60" value="Shops">Shops — 45–60</option>
<option data-lpd="100" value="Club house / recreation">Club house / recreation — 100</option>
<option data-lpd="60" value="Entertainment &amp; leisure / theater">Entertainment &amp; leisure
                          / theater — 10–60</option>
<option data-lpd="50" value="Theatre">Theatre — 10–50</option>
<option data-lpd="50" value="Events">Events — 10–50</option>
</optgroup>
<optgroup label="Hospitality">
<option data-lpd="300" value="Hotels (per guest)">Hotels (per guest) — 200–300</option>
<option data-lpd="80" value="Hotels (per employee)">Hotels (per employee) — 60–80</option>
<option data-lpd="15" value="Restaurant (per meal)">Restaurant (per meal) — 10–15 l/meal
                        </option>
<option data-lpd="40" value="Visitors">Visitors — 14–40</option>
</optgroup>
<optgroup label="Education">
<option data-lpd="60" value="Schools / university">Schools / university — 40–60</option>
<option data-lpd="70" value="Nursery / child care centre">Nursery / child care centre — 50–70
                        </option>
</optgroup>
<optgroup label="Medical &amp; Healthcare">
<option data-lpd="450" value="Medical (per bed)">Medical (per bed) — 350–450</option>
<option data-lpd="450" value="Day clinic (per medical practitioner) incl. visitors">Day clinic
                          (per medical practitioner) incl. visitors — 300–450</option>
<option data-lpd="80" value="Laboratory">Laboratory — 60–80</option>
</optgroup>
<optgroup label="Industrial">
<option data-lpd="80" value="Manufacturing / mineral">Manufacturing / mineral — 60–80</option>
<option data-lpd="80" value="Industrial (workshops / machinery / warehouse)">Industrial
                          (workshops / machinery / warehouse) — 60–80</option>
<option data-lpd="75" value="Guardhouse">Guardhouse — 60–75</option>
</optgroup>
<optgroup label="Public &amp; Assembly">
<option data-lpd="60" value="Mosques">Mosques — 10–60</option>
<option data-lpd="50" value="Public amenities">Public amenities — 10–50</option>
</optgroup>
</select>
</div>
<button data-action-click="wdAddFromForm()" data-action-mouseout="this.style.opacity='1'" data-action-mouseover="this.style.opacity='.88'" style="padding:10px 16px;background:var(--brand);color:#fff;border:none;border-radius:var(--r-sm);font-size:13px;font-weight:700;cursor:pointer;font-family:var(--font);box-shadow:0 2px 6px rgba(215,111,37,0.3);transition:opacity .15s;height:42px;line-height:1;">+ Add</button>
</div>
<div id="wd-form-msg" style="margin-top:10px;font-size:12px;min-height:16px;"></div>
</div>
</div>
<!-- Output Table Panel -->
<div style="min-width:0;">
<div class="scard">
<div class="scard-head">
<div class="scard-accent" style="background:var(--brand)"></div>
<div class="scard-title">Water Demand Schedule</div>
</div>
<div class="scard-body" style="padding:0">
<div style="padding:14px 16px 0;color:var(--muted);font-size:12px;display:flex;align-items:center;justify-content:space-between;gap:10px;flex-wrap:wrap">
<span>Total = No. of People × Water Consumption per Person per Day</span>
<div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap">
<span class="pcl-status-pill" id="wd-table-pill">Live Schedule</span>
<button class="pcl-inline-btn" data-action-click="wdExportToExcel()" data-action-mouseout="this.style.background='#f78f22';this.style.transform='none'" data-action-mouseover="this.style.background='#d17914';this.style.transform='translateY(-1px)'" style="width:auto;padding:7px 14px;background:#f78f22;color:#fff;font-weight:700;display:flex;align-items:center;gap:5px;box-shadow:0 2px 5px rgba(16,185,129,0.2);border-radius:6px;border:none;cursor:pointer;transition:all 0.15s ease;">📊 Export
                        Excel</button>
<button class="pcl-inline-btn secondary" data-action-click="wdClearAll()" style="width:auto;padding:7px 12px">Clear All</button>
</div>
</div>
<div style="padding:12px 16px 16px;overflow-x:auto">
<div class="pcl-table-wrap">
<!-- Column letters -->
<div style="display:grid;grid-template-columns:34px minmax(160px,2fr) 90px minmax(200px,2fr) 120px 130px 72px;background:#efefef;border-bottom:1px solid #d0d0d0">
<div style="padding:3px 4px;text-align:center;color:#999;font-size:9.5px;font-weight:700;border-right:1px solid #d8d8d8">
</div>
<div style="padding:3px 8px;text-align:center;color:#999;font-size:9.5px;font-weight:700;border-right:1px solid #d8d8d8">
                          A</div>
<div style="padding:3px 4px;text-align:center;color:#999;font-size:9.5px;font-weight:700;border-right:1px solid #d8d8d8">
                          B</div>
<div style="padding:3px 8px;text-align:center;color:#999;font-size:9.5px;font-weight:700;border-right:1px solid #d8d8d8">
                          C</div>
<div style="padding:3px 4px;text-align:center;color:#999;font-size:9.5px;font-weight:700;border-right:1px solid #d8d8d8">
                          D</div>
<div style="padding:3px 4px;text-align:center;color:#999;font-size:9.5px;font-weight:700;border-right:1px solid #d8d8d8">
                          E</div>
<div style="padding:3px 4px;text-align:center;color:#999;font-size:9.5px;font-weight:700"></div>
</div>
<table id="wd-table" style="width:100%;border-collapse:collapse;font-size:12.5px;table-layout:fixed">
<colgroup>
<col style="width:34px"/>
<col style="width:28%"/>
<col style="width:11%"/>
<col style="width:30%"/>
<col style="width:14%"/>
<col style="width:15%"/>
<col style="width:58px"/>
</colgroup>
<thead>
<tr style="background:var(--brand);color:#fff">
<th style="padding:9px 6px;text-align:center;font-weight:700;font-size:11px;border-right:1px solid rgba(255,255,255,0.18)">
                              #</th>
<th style="padding:9px 10px;text-align:left;font-weight:700;font-size:11.5px;border-right:1px solid rgba(255,255,255,0.18)">
                              Description</th>
<th style="padding:9px 6px;text-align:center;font-weight:700;font-size:11px;border-right:1px solid rgba(255,255,255,0.18)">
                              No. of<br/><span style="font-weight:400;font-size:9.5px;opacity:.85">People</span></th>
<th style="padding:9px 10px;text-align:left;font-weight:700;font-size:11.5px;border-right:1px solid rgba(255,255,255,0.18)">
                              User Category</th>
<th style="padding:9px 6px;text-align:right;font-weight:700;font-size:11px;border-right:1px solid rgba(255,255,255,0.18)">
                              Consumption<br/><span style="font-weight:400;font-size:9.5px;opacity:.85">(L/Person/Day)</span></th>
<th style="padding:9px 6px;text-align:right;font-weight:700;font-size:11px;border-right:1px solid rgba(255,255,255,0.18)">
                              Total Water<br/><span style="font-weight:400;font-size:9.5px;opacity:.85">(L/Day)</span>
</th>
<th style="padding:9px 4px;text-align:center;font-size:10px">Del</th>
</tr>
</thead>
<tbody id="wd-tbody">
<!-- filled by JS -->
</tbody>
<tfoot id="wd-tfoot"></tfoot>
</table>
<!-- Empty state -->
<div class="pcl-empty-hero" id="wd-empty" style="display:flex">
<div class="pcl-empty-icon">💧</div>
<div style="font-size:13px;font-weight:600;color:var(--muted);margin-bottom:4px">No entries yet
                        </div>
<div style="font-size:11.5px;color:var(--hint);text-align:center">Fill in Description, No. of
                          People and User Category above, then click <strong>+ Add</strong></div>
</div>
</div><!-- pcl-table-wrap -->
</div>
<!-- Summary stats -->
<div id="wd-summary" style="display:none;padding:0 16px 16px">
<div class="pcl-summary-grid">
<div class="pcl-stat">
<div class="res-row" style="padding:4px 0 2px">
<div class="res-label" style="font-size:11px">Total Entries</div>
<div class="res-val" id="wd-stat-entries" style="font-size:15px;font-weight:700;color:var(--brand)">0</div>
</div>
</div>
<div class="pcl-stat">
<div class="res-row" style="padding:4px 0 2px">
<div class="res-label" style="font-size:11px">Total People</div>
<div class="res-val" id="wd-stat-people" style="font-size:15px;font-weight:700;color:var(--brand)">0</div>
</div>
</div>
<div class="pcl-stat">
<div class="res-row" style="padding:4px 0 2px">
<div class="res-label" style="font-size:11px">Total Water Demand</div>
<div class="res-val" id="wd-stat-total" style="font-size:15px;font-weight:700;color:var(--brand)">0 L/Day</div>
</div>
</div>
<div class="pcl-stat">
<div class="res-row" style="padding:4px 0 2px">
<div class="res-label" style="font-size:11px">Peak Hour Flow (÷10)</div>
<div class="res-val" id="wd-stat-peak" style="font-size:15px;font-weight:700;color:var(--brand)">0 L/hr</div>
</div>
</div>
</div>
</div>
</div>
</div>
</div>
<!-- ══ IRRIGATION WATER DEMAND ══ -->
<div class="scard" style="margin-bottom:0">
<div class="scard-head" style="display:flex; justify-content:space-between; align-items:center;">
<div style="display:flex; align-items:center; gap:8px;">
<div class="scard-accent" style="background:#27ae60"></div>
<div class="scard-title">🌿 Irrigation Water Demand</div>
</div>
<button class="pcl-inline-btn" data-action-click="irrExportToExcel()" data-action-mouseout="this.style.background='#f78f22';this.style.transform='none'" data-action-mouseover="this.style.background='#d17914';this.style.transform='translateY(-1px)'" style="width:auto;padding:5px 12px;background:#f78f22;color:#fff;font-weight:700;display:flex;align-items:center;gap:5px;box-shadow:0 2px 5px rgba(16,185,129,0.15);border-radius:5px;border:none;cursor:pointer;transition:all 0.15s ease;font-size:11.5px;font-family:inherit">📊 Export Excel</button>
</div>
<div class="scard-body" style="padding:20px;">
<!-- Column headers -->
<div style="display:grid;grid-template-columns:1fr 1fr 1fr 1fr 36px;gap:12px;margin-bottom:6px;padding:0 2px;">
<div style="font-size:11px;font-weight:600;color:var(--muted)">Area of Lawn <span style="font-weight:400">(m²)</span></div>
<div style="font-size:11px;font-weight:600;color:var(--muted)">Type of Vegetation</div>
<div style="font-size:11px;font-weight:600;color:var(--muted)">Water Demand <span style="font-weight:400">(L/m²/Day)</span></div>
<div style="font-size:11px;font-weight:600;color:var(--muted)">Irrigation Demand <span style="font-weight:400">(L/Day)</span></div>
<div></div>
</div>
<!-- Rows container -->
<div id="irr-rows-container" style="display:flex;flex-direction:column;gap:10px;margin-bottom:14px;">
</div>
<!-- Add Row button -->
<button data-action-click="irrAddRow()" data-action-mouseout="this.style.background='#fff5e6'" data-action-mouseover="this.style.background='#d6f5e3'" style="display:flex;align-items:center;gap:6px;padding:9px 16px;background:#fff5e6;color:#27ae60;border:1.5px dashed #27ae60;border-radius:var(--r-sm);font-size:13px;font-weight:700;cursor:pointer;font-family:var(--font);transition:background .15s;width:100%;justify-content:center;">+ Add
                  Vegetation Row</button>
<!-- Total output -->
<div id="irr-total-box" style="display:none;margin-top:14px;background:#27ae60;border-radius:var(--r-sm);padding:14px 18px;display:none;justify-content:space-between;align-items:center;">
<div>
<div style="font-size:11px;font-weight:600;color:#fff;text-transform:uppercase;letter-spacing:.5px;margin-bottom:3px">
                      Total Irrigation Water Demand</div>
<div style="font-size:10.5px;color:rgba(255,255,255,.75)">Sum of all vegetation rows</div>
</div>
<div id="irr-out-total" style="font-size:22px;font-weight:800;color:#fff;letter-spacing:-.5px">—</div>
</div>
</div>
</div>
<!-- ══ SWIMMING POOL WATER DEMAND ══ -->
<div class="scard" style="margin-bottom:0">
<div class="scard-head" style="display:flex; justify-content:space-between; align-items:center;">
<div style="display:flex; align-items:center; gap:8px;">
<div class="scard-accent" style="background:#0288d1"></div>
<div class="scard-title">🏊 Swimming Pool Make-up Water Demand</div>
</div>
<button class="pcl-inline-btn" data-action-click="poolExportToExcel()" data-action-mouseout="this.style.background='#f78f22';this.style.transform='none'" data-action-mouseover="this.style.background='#d17914';this.style.transform='translateY(-1px)'" style="width:auto;padding:5px 12px;background:#f78f22;color:#fff;font-weight:700;display:flex;align-items:center;gap:5px;box-shadow:0 2px 5px rgba(16,185,129,0.15);border-radius:5px;border:none;cursor:pointer;transition:all 0.15s ease;font-size:11.5px;font-family:inherit">📊 Export Excel</button>
</div>
<div class="scard-body" style="padding:20px;">
<!-- Inputs row -->
<div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:16px;margin-bottom:20px;">
<div class="input-group" style="margin-bottom:0">
<div class="input-label">Area of Pool <span class="input-unit">m²</span></div>
<input class="inp" id="pool-in-area" min="0" data-action-input="poolCalc()" placeholder="e.g. 80" step="0.1" type="number"/>
</div>
<div class="input-group" style="margin-bottom:0">
<div class="input-label">Average Depth <span class="input-unit">m</span></div>
<input class="inp" id="pool-in-depth" min="0" data-action-input="poolCalc()" placeholder="e.g. 1.5" step="0.01" type="number"/>
</div>
<div class="input-group" style="margin-bottom:0">
<div class="input-label">Evaporation Rate <span class="input-unit">%/Day</span></div>
<input class="inp" id="pool-in-evap" max="100" min="0" data-action-input="poolCalc()" step="0.1" style="background:#fff9f0" type="number" value="10"/>
</div>
</div>
<!-- Output boxes -->
<div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:12px;">
<div style="background:#e3f2fd;border:1.5px solid #0288d1;border-radius:var(--r-sm);padding:14px 18px;">
<div style="font-size:11px;font-weight:600;color:#0288d1;text-transform:uppercase;letter-spacing:.5px;margin-bottom:3px">
                      Volume of Pool</div>
<div style="font-size:10.5px;color:var(--muted);margin-bottom:8px">Area × Average Depth</div>
<div id="pool-out-volume" style="font-size:20px;font-weight:800;color:#0288d1;letter-spacing:-.5px">
                      —</div>
</div>
<div style="background:#e3f2fd;border:1.5px solid #0288d1;border-radius:var(--r-sm);padding:14px 18px;">
<div style="font-size:11px;font-weight:600;color:#0288d1;text-transform:uppercase;letter-spacing:.5px;margin-bottom:3px">
                      Evaporation Rate</div>
<div style="font-size:10.5px;color:var(--muted);margin-bottom:8px">% of Pool Volume / Day</div>
<div id="pool-out-evap-pct" style="font-size:20px;font-weight:800;color:#0288d1;letter-spacing:-.5px">10 %</div>
</div>
<div style="background:#0288d1;border:1.5px solid #0277bd;border-radius:var(--r-sm);padding:14px 18px;">
<div style="font-size:11px;font-weight:600;color:#fff;text-transform:uppercase;letter-spacing:.5px;margin-bottom:3px">
                      Pool Make-up Water</div>
<div style="font-size:10.5px;color:rgba(255,255,255,.75);margin-bottom:8px">Volume × Evaporation
                      Rate</div>
<div id="pool-out-demand" style="font-size:20px;font-weight:800;color:#fff;letter-spacing:-.5px">—
                    </div>
</div>
</div>
</div>
</div>
<!-- ══ FIRE FIGHTING TANK CAPACITY ══ -->
<div class="scard" style="margin-bottom:0">
<div class="scard-head" style="display:flex; justify-content:space-between; align-items:center;">
<div style="display:flex; align-items:center; gap:8px;">
<div class="scard-accent" style="background:#e53935"></div>
<div class="scard-title">🔥 Fire Fighting Tank Capacity</div>
</div>
<button class="pcl-inline-btn" data-action-click="fireExportToExcel()" data-action-mouseout="this.style.background='#f78f22';this.style.transform='none'" data-action-mouseover="this.style.background='#d17914';this.style.transform='translateY(-1px)'" style="width:auto;padding:5px 12px;background:#f78f22;color:#fff;font-weight:700;display:flex;align-items:center;gap:5px;box-shadow:0 2px 5px rgba(16,185,129,0.15);border-radius:5px;border:none;cursor:pointer;transition:all 0.15s ease;font-size:11.5px;font-family:inherit">📊 Export Excel</button>
</div>
<div class="scard-body" style="padding:20px;">
<!-- Inputs row -->
<div style="display:grid;grid-template-columns:1fr 1fr;gap:16px;margin-bottom:20px;">
<div class="input-group" style="margin-bottom:0">
<div class="input-label">Fire Pump Flow Rate <span class="input-unit">USGPM</span></div>
<input class="inp" id="fire-in-flow" min="0" data-action-input="fireCalc()" placeholder="e.g. 500" step="1" type="number"/>
<div style="font-size:10.5px;color:var(--muted);margin-top:4px">1 USGPM = 3.785 L/min</div>
</div>
<div class="input-group" style="margin-bottom:0">
<div class="input-label">Fire Fighting Duration <span class="input-unit">minutes</span></div>
<div class="inp" style="background:#f0f0f0;color:var(--muted);cursor:not-allowed;display:flex;align-items:center;font-weight:700;font-size:14px;">
                      60 <span style="font-size:11px;font-weight:400;margin-left:6px;color:#aaa">(fixed)</span></div>
</div>
</div>
<!-- Output boxes -->
<div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:12px;">
<div style="background:#fff3e0;border:1.5px solid #e53935;border-radius:var(--r-sm);padding:14px 18px;">
<div style="font-size:11px;font-weight:600;color:#e53935;text-transform:uppercase;letter-spacing:.5px;margin-bottom:3px">
                      Flow Rate</div>
<div style="font-size:10.5px;color:var(--muted);margin-bottom:8px">Converted to L/min</div>
<div id="fire-out-lpm" style="font-size:20px;font-weight:800;color:#e53935;letter-spacing:-.5px">—
                    </div>
</div>
<div style="background:#fff3e0;border:1.5px solid #e53935;border-radius:var(--r-sm);padding:14px 18px;">
<div style="font-size:11px;font-weight:600;color:#e53935;text-transform:uppercase;letter-spacing:.5px;margin-bottom:3px">
                      Duration</div>
<div style="font-size:10.5px;color:var(--muted);margin-bottom:8px">Fire fighting period</div>
<div id="fire-out-duration" style="font-size:20px;font-weight:800;color:#e53935;letter-spacing:-.5px">—</div>
</div>
<div style="background:#e53935;border:1.5px solid #c62828;border-radius:var(--r-sm);padding:14px 18px;">
<div style="font-size:11px;font-weight:600;color:#fff;text-transform:uppercase;letter-spacing:.5px;margin-bottom:3px">
                      Fire Fighting Tank Capacity</div>
<div style="font-size:10.5px;color:rgba(255,255,255,.75);margin-bottom:8px">Flow Rate × Duration
                    </div>
<div id="fire-out-capacity" style="font-size:20px;font-weight:800;color:#fff;letter-spacing:-.5px">—
                    </div>
</div>
</div>
</div>
</div>
</div>
</div>
`;

window.CalculatorTemplates['drainage'] = `
<div class="page" id="page-drainage">
<div class="calc-header" style="background:linear-gradient(135deg,#f78f22,#d17914)">
<div class="calc-title">Drainage Sizing</div>
<div class="calc-std">IPC Table 702.1 - Drainage Fixture Unit Method</div>
</div>
<div class="calc-desc green">Size drainage pipes based on drainage fixture units (DFU) per IPC. Select system
            type and enter fixture counts.</div>
<div class="scard">
<div class="scard-head">
<div class="scard-accent" style="background:var(--brand)"></div>
<div class="scard-title">System Type</div>
</div>
<div class="scard-body">
<div class="chip-row">
<div class="chip sel-brand sel" data-action-click="setDrainType(this,'branch')">Horizontal Branch</div>
<div class="chip" data-action-click="setDrainType(this,'stack')">Stack</div>
<div class="chip" data-action-click="setDrainType(this,'building')">Building Drain</div>
</div>
</div>
</div>
<div class="scard">
<div class="scard-head">
<div class="scard-accent" style="background:var(--brand)"></div>
<div class="scard-title">Fixture Counts</div>
</div>
<div class="scard-body" id="drain-fixture-rows"></div>
</div>
<button class="calc-btn" data-action-click="calcDrainage();showRes('drain-res')" style="background:var(--brand);color:#fff;">⚡ Size Drain</button>
<div id="drain-res" style="display:none">
<div class="scard">
<div class="scard-head">
<div class="scard-accent" style="background:var(--brand)"></div>
<div class="scard-title">Drainage Result</div>
</div>
<div class="scard-body">
<div class="res-row">
<div class="res-label">Total DFU</div>
<div class="res-val" id="dr2-dfu">-</div>
</div>
<div class="res-row">
<div class="res-label">Required Pipe Size</div>
<div class="res-val primary" id="dr2-size" style="color:var(--brand)">-</div>
</div>
<div class="res-row">
<div class="res-label">Minimum Slope</div>
<div class="res-val" id="dr2-slope">-</div>
</div>
</div>
</div>
</div>
</div>
`;

window.CalculatorTemplates['tank-sizing'] = `
<div class="page" id="page-tank-sizing">
<div class="calc-header" style="background:linear-gradient(135deg,#f78f22,#d17914)">
<div class="calc-title">Tank Sizing</div>
<div class="calc-std">Storage Demand Method</div>
</div>
<div class="calc-desc green">Calculate required water storage tank capacity based on daily demand, peak flow,
            and storage duration.</div>
<div class="scard">
<div class="scard-head">
<div class="scard-accent" style="background:var(--green)"></div>
<div class="scard-title">Inputs</div>
</div>
<div class="scard-body">
<div class="input-group">
<div class="input-label">Daily Water Demand <span class="input-unit" id="ts-dem-unit">gal</span></div>
<input class="inp" id="ts-daily" data-action-input="calcTank()" placeholder="e.g. 5000" type="number"/>
</div>
<div class="input-group">
<div class="input-label">Storage Duration <span class="input-unit">days</span></div>
<input class="inp" id="ts-days" data-action-input="calcTank()" placeholder="e.g. 1" step="0.5" type="number"/>
</div>
<div class="input-group">
<div class="input-label">Peak Flow Rate <span class="input-unit" id="ts-flow-unit">GPM</span></div>
<input class="inp" id="ts-peak" data-action-input="calcTank()" placeholder="e.g. 40" type="number"/>
</div>
<div class="input-group">
<div class="input-label">Pump Fill Rate <span class="input-unit" id="ts-pump-unit">GPM</span></div>
<input class="inp" id="ts-pump" data-action-input="calcTank()" placeholder="e.g. 30" type="number"/>
</div>
</div>
</div>
<button class="calc-btn green" data-action-click="calcTank();showRes('tank-res')">⚡ Size Tank</button>
<div id="tank-res" style="display:none">
<div class="scard">
<div class="scard-head">
<div class="scard-accent" style="background:var(--green)"></div>
<div class="scard-title">Tank Sizing Result</div>
</div>
<div class="scard-body">
<div class="res-row">
<div class="res-label">Storage Volume</div>
<div class="res-val" id="t-storage">-</div>
</div>
<div class="res-row">
<div class="res-label">Break Tank (30-min peak)</div>
<div class="res-val" id="t-break">-</div>
</div>
<div class="res-row">
<div class="res-label">Recommended Capacity</div>
<div class="res-val primary" id="t-rec" style="color:var(--green)">-</div>
</div>
<div class="res-row">
<div class="res-label">Pump Fill Time</div>
<div class="res-val" id="t-fill">-</div>
</div>
</div>
</div>
</div>
</div>
`;

window.CalculatorTemplates['gas-tank'] = `
<div class="page" id="page-gas-tank">
<div class="calc-header" style="background:linear-gradient(135deg,#f78f22,#d17914)">
<div class="calc-title">🔥 Gas Storage Tank Capacity Calculator</div>
<div class="calc-std">MEP Plumbing Design Calculations</div>
</div>
<div class="calc-desc orange" style="background:#fff7ed; border-color:rgba(243,150,50,0.2)">
            Calculate required gas storage tank capacity and sizing based on residential and retail kitchen average daily demand, with support for Natural Gas and LPG options.
          </div>
<!-- GAS TYPE SELECTION CARD -->
<div class="scard">
<div class="scard-head">
<div class="scard-accent" style="background:#f78f22"></div>
<div class="scard-title">Select Gas Type</div>
</div>
<div class="scard-body">
<div class="chip-row" style="margin:0">
<div class="chip sel" id="gt-chip-ng" data-action-click="setGasType('ng')">Natural Gas</div>
<div class="chip" id="gt-chip-lpg" data-action-click="setGasType('lpg')">LPG</div>
</div>
<input id="gt-gas-type" type="hidden" value="ng"/>
</div>
</div>
<!-- SECTION 1: GAS CONSUMPTION CALCULATION FOR KITCHEN -->
<div class="scard">
<div class="scard-head" style="display:flex; justify-content:space-between; align-items:center; width:100%">
<div style="display:flex; align-items:center; gap:8px">
<div class="scard-accent" style="background:#f78f22"></div>
<div class="scard-title">Section 1: Gas Consumption (Kitchens)</div>
</div>
<div style="font-family:var(--font); color:var(--text); font-size:12px; font-weight:500; display:flex; align-items:center; gap:4px; text-transform:none">
<span>Res. Constant:</span>
<input id="gt-res-demand-const" data-action-input="calcGasTank()" data-action-mouseout="this.style.background='transparent'" data-action-mouseover="this.style.background='rgba(217,119,87,0.12)'; this.style.borderRadius='3px'" style="display:inline-block; width:36px; border:none; background:transparent; font-weight:700; color:var(--green); text-align:center; padding:2px 0; outline:none; font-family:var(--font); cursor:pointer; font-size:12px; transition:all 0.15s ease" type="text" value="0.19"/>
<span>m³/day</span>
</div>
</div>
<div class="scard-body" style="display:flex; flex-direction:column; gap:12px">
<div class="input-group" style="margin:0">
<div class="input-label">Number of Residential Kitchens <span class="input-unit">Nos.</span></div>
<input class="inp" id="gt-res-kitchens" min="0" data-action-input="calcGasTank()" placeholder="e.g. 20" type="number"/>
</div>
<div class="input-group" style="margin:0">
<div class="input-label">Total Gas Consumption for Residential <span class="input-unit">m³/day</span></div>
<input class="inp" id="gt-res-consumption" readonly="" style="background:#f3f4f6; color:#4b5563; cursor:not-allowed" type="text"/>
</div>
<!-- Retail Kitchen Section Header inside same card for compactness -->
<div style="border-top:1px dashed var(--border); margin:8px 0; padding-top:8px; display:flex; justify-content:space-between; align-items:center">
<span style="font-size:11px; font-weight:700; text-transform:uppercase; color:var(--muted)">Retail Food &amp; Beverage</span>
<div style="font-family:var(--font); color:var(--text); font-size:12px; font-weight:500; display:flex; align-items:center; gap:4px; text-transform:none">
<span>Retail Constant:</span>
<input id="gt-ret-demand-const" data-action-input="calcGasTank()" data-action-mouseout="this.style.background='transparent'" data-action-mouseover="this.style.background='rgba(217,119,87,0.12)'; this.style.borderRadius='3px'" style="display:inline-block; width:36px; border:none; background:transparent; font-weight:700; color:var(--green); text-align:center; padding:2px 0; outline:none; font-family:var(--font); cursor:pointer; font-size:12px; transition:all 0.15s ease" type="text" value="52"/>
<span>m³/day</span>
</div>
</div>
<div class="input-group" style="margin:0">
<div class="input-label">Number of Kitchens (F&amp;B Retail) <span class="input-unit">Nos.</span></div>
<input class="inp" id="gt-ret-kitchens" min="0" data-action-input="calcGasTank()" placeholder="e.g. 1" type="number"/>
</div>
<div class="input-group" style="margin:0">
<div class="input-label">Total Gas Consumption for Retail <span class="input-unit">m³/day</span></div>
<input class="inp" id="gt-ret-consumption" readonly="" style="background:#f3f4f6; color:#4b5563; cursor:not-allowed" type="text"/>
</div>
</div>
</div>
<!-- TOTAL GAS DEMAND CARD -->
<div class="scard">
<div class="scard-head">
<div class="scard-accent" style="background:#f78f22"></div>
<div class="scard-title">Total Gas Demand</div>
</div>
<div class="scard-body" style="display:flex; flex-direction:column; gap:12px">
<!-- Natural Gas demand (visible by default) -->
<div class="input-group" id="gt-demand-ng-group" style="margin:0">
<div class="input-label">Total Gas Demand (Natural Gas) <span class="input-unit">L/day</span></div>
<input class="inp" id="gt-demand-ng" readonly="" style="background:#fff5e6; color:#d17914; font-weight:700" type="text"/>
</div>
<!-- LPG demand (hidden by default) -->
<div class="input-group" id="gt-demand-lpg-group" style="margin:0; display:none">
<div class="input-label">Total Gas Demand (LPG Gas) <span class="input-unit">L/day</span></div>
<input class="inp" id="gt-demand-lpg" readonly="" style="background:#fef2f2; color:#d17914; font-weight:700" type="text"/>
</div>
</div>
</div>
<!-- SECTION 2: TANK CAPACITY / SIZING -->
<div class="scard">
<div class="scard-head">
<div class="scard-accent" style="background:#f78f22"></div>
<div class="scard-title">Section 2: Capacity Sizing &amp; Usability</div>
</div>
<div class="scard-body" style="display:flex; flex-direction:column; gap:12px">
<div class="input-group" style="margin:0">
<div class="input-label">Gas Tank Capacity (70% Usable Volume) <span class="input-unit">L/week</span></div>
<input class="inp" id="gt-tank-capacity" readonly="" style="background:#f3f4f6; color:#4b5563; cursor:not-allowed" type="text"/>
</div>
<div class="input-group" style="margin:0">
<div class="input-label">Storage Capacity (Installed Tank) <span class="input-unit">Litres</span></div>
<input class="inp" id="gt-storage-capacity" min="0" data-action-input="calcGasTank()" placeholder="e.g. 30000" type="number"/>
</div>
<div class="input-group" style="margin:0">
<div class="input-label">Usable Gas from the Tank <span class="input-unit">Litres</span></div>
<input class="inp" id="gt-usable-gas" readonly="" style="background:#f3f4f6; color:#4b5563; cursor:not-allowed" type="text"/>
</div>
</div>
</div>
<!-- ACTIONS -->
<div style="display:flex; gap:12px; margin-top:8px">
<button class="calc-btn orange" data-action-click="calcGasTank(); showRes('gas-tank-res')" style="margin:0; flex:1.2; background:#f78f22; color:#fff">⚡ Size Gas Storage Tank</button>
<button class="calc-btn blue" data-action-click="gtExportToExcel()" style="margin:0; flex:1; display:flex; align-items:center; justify-content:center; gap:8px; background:var(--blue)">
<span>📊</span> Export Excel
            </button>
</div>
<!-- GAS TANK RESULTS PANEL (ends with -res, triggers core's layout system) -->
<div id="gas-tank-res" style="display:none">
<div class="scard" style="border:1px solid #f1c38f">
<div class="scard-head">
<div class="scard-accent" style="background:#f78f22"></div>
<div class="scard-title">Project Results Panel</div>
</div>
<div class="scard-body" style="padding:16px">
<div class="pcl-summary-grid" style="margin-top:4px">
<!-- Residential Consumption Card -->
<div class="pcl-stat">
<div style="font-size:10px; font-weight:700; color:var(--muted); text-transform:uppercase; letter-spacing:0.5px">Res. Gas Consumption</div>
<div id="gt-card-res-cons" style="font-size:20px; font-weight:800; color:#f78f22; margin-top:4px">—</div>
<div style="font-size:11px; color:var(--muted); margin-top:2px">m³/day</div>
</div>
<!-- Retail Consumption Card -->
<div class="pcl-stat">
<div style="font-size:10px; font-weight:700; color:var(--muted); text-transform:uppercase; letter-spacing:0.5px">Retail Gas Consumption</div>
<div id="gt-card-ret-cons" style="font-size:20px; font-weight:800; color:#f78f22; margin-top:4px">—</div>
<div style="font-size:11px; color:var(--muted); margin-top:2px">m³/day</div>
</div>
<!-- Total Gas Demand Card -->
<div class="pcl-stat">
<div style="font-size:10px; font-weight:700; color:var(--muted); text-transform:uppercase; letter-spacing:0.5px">Total Gas Demand</div>
<div id="gt-card-total-demand" style="font-size:20px; font-weight:800; color:#d17914; margin-top:4px">—</div>
<div id="gt-card-demand-unit" style="font-size:11px; color:var(--muted); margin-top:2px">L/day</div>
</div>
<!-- Gas Tank Capacity Card -->
<div class="pcl-stat">
<div style="font-size:10px; font-weight:700; color:var(--muted); text-transform:uppercase; letter-spacing:0.5px">Gas Tank Capacity</div>
<div id="gt-card-tank-cap" style="font-size:20px; font-weight:800; color:var(--text); margin-top:4px">—</div>
<div style="font-size:11px; color:var(--muted); margin-top:2px">L/week</div>
</div>
<!-- Storage Capacity Card -->
<div class="pcl-stat">
<div style="font-size:10px; font-weight:700; color:var(--muted); text-transform:uppercase; letter-spacing:0.5px">Storage Capacity</div>
<div id="gt-card-storage-cap" style="font-size:20px; font-weight:800; color:var(--text); margin-top:4px">—</div>
<div style="font-size:11px; color:var(--muted); margin-top:2px">Litres</div>
</div>
<!-- Usable Gas From Tank Card -->
<div class="pcl-stat">
<div style="font-size:10px; font-weight:700; color:var(--muted); text-transform:uppercase; letter-spacing:0.5px">Usable Gas From Tank</div>
<div id="gt-card-usable-gas" style="font-size:20px; font-weight:800; color:#0284c7; margin-top:4px">—</div>
<div style="font-size:11px; color:var(--muted); margin-top:2px">Litres</div>
</div>
</div>
</div>
</div>
</div>
</div>
`;

window.CalculatorTemplates['k-factor'] = `
<div class="page" id="page-k-factor">
<div class="calc-header" style="background:linear-gradient(135deg,#f78f22,#d17914)">
<div class="calc-title">Sprinkler K-Factor Calculator</div>
<div class="calc-std">NFPA 13 - Q = K × √P</div>
</div>
<div class="calc-desc red">Calculate sprinkler discharge flow from pressure, or required pressure for target
            flow. Uses NFPA 13 standard K-factor values only.</div>
<div class="scard">
<div class="scard-head">
<div class="scard-accent" style="background:var(--red)"></div>
<div class="scard-title">Solve For</div>
</div>
<div class="scard-body">
<div class="chip-row">
<div class="chip sel-red sel" data-action-click="setKSolve(this,'Q')">Flow (Q)</div>
<div class="chip" data-action-click="setKSolve(this,'P')">Pressure (P)</div>
</div>
</div>
</div>
<div class="scard">
<div class="scard-head">
<div class="scard-accent" style="background:var(--red)"></div>
<div class="scard-title">Inputs</div>
</div>
<div class="scard-body">
<div class="input-group">
<div class="input-label">K-Factor (NFPA 13) <span class="input-unit" id="kf-k-unit">GPM/√psi</span>
</div>
<select class="inp inp-select" id="kf-k" data-action-change="calcKFactor()">
<option value="2.8">K-2.8 - Residential</option>
<option value="4.2">K-4.2</option>
<option selected="" value="5.6">K-5.6 - Standard</option>
<option value="8.0">K-8.0</option>
<option value="11.2">K-11.2 - ESFR</option>
<option value="14.0">K-14.0</option>
<option value="16.8">K-16.8</option>
<option value="19.6">K-19.6</option>
<option value="22.4">K-22.4</option>
<option value="25.2">K-25.2</option>
<option value="28.0">K-28.0</option>
</select>
</div>
<div class="input-group">
<div class="input-label"><span id="kf-known-label">Pressure (P)</span> <span class="input-unit" id="kf-known-unit">psi</span></div>
<input class="inp" id="kf-known" data-action-input="calcKFactor()" placeholder="e.g. 30" type="number"/>
</div>
</div>
</div>
<button class="calc-btn red" data-action-click="calcKFactor();showRes('kf-res')">⚡ Calculate</button>
<div id="kf-res" style="display:none">
<div id="kf-warn-area"></div>
<div class="scard">
<div class="scard-head">
<div class="scard-accent" style="background:var(--red)"></div>
<div class="scard-title">Result</div>
</div>
<div class="scard-body">
<div class="res-row">
<div class="res-label" id="kf-res-label">Discharge Flow (Q)</div>
<div class="res-val primary" id="kf-res-val" style="color:var(--red)">-</div>
</div>
<div class="res-row">
<div class="res-label">Formula Used</div>
<div class="res-val" id="kf-formula" style="font-family:var(--mono);font-size:12px">Q = K × √P</div>
</div>
<div class="res-row">
<div class="res-label">K-Factor</div>
<div class="res-val" id="kf-k-disp">-</div>
</div>
</div>
</div>
</div>
</div>
`;

window.CalculatorTemplates['hazen-williams'] = `
<div class="page" id="page-hazen-williams">
<div class="calc-header" style="background:linear-gradient(135deg,#f78f22,#d17914)">
<div class="calc-title">Flow &amp; Pressure - Hazen-Williams</div>
<div class="calc-std">NFPA 13 - hf = 4.52 × L × Q^1.85 / (C^1.85 × d^4.87)</div>
</div>
<div class="calc-desc red">Calculate friction loss in fire protection piping using Hazen-Williams equation.
            Valid for turbulent water flow in clean pipes.</div>
<div class="scard">
<div class="scard-head">
<div class="scard-accent" style="background:var(--red)"></div>
<div class="scard-title">Inputs</div>
</div>
<div class="scard-body">
<div class="input-group">
<div class="input-label">Flow Rate (Q) <span class="input-unit" id="hw-flow-unit">GPM</span></div>
<input class="inp" id="hw-flow" data-action-input="calcHazen()" placeholder="e.g. 100" type="number"/>
</div>
<div class="input-group">
<div class="input-label">Pipe Size <span class="input-unit">NPS</span></div>
<select class="inp inp-select" id="hw-pipe" data-action-change="calcHazen()">
<option value="1.049">1" - ID 1.049"</option>
<option value="1.380">1¼" - ID 1.380"</option>
<option value="1.610">1½" - ID 1.610"</option>
<option value="2.067">2" - ID 2.067"</option>
<option selected="" value="2.469">2½" - ID 2.469"</option>
<option value="3.068">3" - ID 3.068"</option>
<option value="4.026">4" - ID 4.026"</option>
<option value="6.065">6" - ID 6.065"</option>
</select>
</div>
<div class="input-group">
<div class="input-label">Pipe Material (C-factor)</div>
<select class="inp inp-select" id="hw-c" data-action-change="calcHazen()">
<option value="120">Schedule 40 Steel - C=120</option>
<option value="100">Black Steel (aged) - C=100</option>
<option value="150">CPVC - C=150</option>
<option value="130">Copper - C=130</option>
</select>
</div>
<div class="input-group">
<div class="input-label">Pipe Length <span class="input-unit" id="hw-len-unit">ft</span></div>
<input class="inp" id="hw-len" data-action-input="calcHazen()" placeholder="e.g. 100" type="number"/>
</div>
</div>
</div>
<button class="calc-btn red" data-action-click="calcHazen();showRes('hw-res')">⚡ Calculate Friction Loss</button>
<div id="hw-res" style="display:none">
<div id="hw-warn-area"></div>
<div class="scard">
<div class="scard-head">
<div class="scard-accent" style="background:var(--red)"></div>
<div class="scard-title">Friction Loss Result</div>
</div>
<div class="scard-body">
<div class="res-row">
<div class="res-label">Total Friction Loss</div>
<div class="res-val primary" id="hw-total" style="color:var(--red)">-</div>
</div>
<div class="res-row">
<div class="res-label">Loss per 100 ft</div>
<div class="res-val" id="hw-per100">-</div>
</div>
<div class="res-row">
<div class="res-label">Flow Velocity</div>
<div class="res-val" id="hw-vel">-</div>
</div>
</div>
</div>
<div class="scard">
<div class="expand-toggle" data-action-click="toggleExpand('hw-steps')">
<div class="expand-title">∑ Calculation Steps</div>
<span id="hw-steps-arrow">▼</span>
</div>
<div class="expand-body" id="hw-steps" style="display:none">
<div class="formula-step">
<div style="display:flex;gap:8px;margin-bottom:4px">
<div class="fs-num">1</div>
<div class="fs-label">Hazen-Williams friction loss</div>
</div>
<div class="fs-expr">hf = 4.52 × L × Q^1.85 / (C^1.85 × d^4.87)</div>
<div class="fs-result" id="hwfs1">-</div>
</div>
<div class="formula-step">
<div style="display:flex;gap:8px;margin-bottom:4px">
<div class="fs-num">2</div>
<div class="fs-label">Loss per 100 ft</div>
</div>
<div class="fs-expr">same formula with L=100</div>
<div class="fs-result" id="hwfs2">-</div>
</div>
<div class="formula-step">
<div style="display:flex;gap:8px;margin-bottom:4px">
<div class="fs-num">3</div>
<div class="fs-label">Flow velocity</div>
</div>
<div class="fs-expr">v = Q / (2.448 × d²)</div>
<div class="fs-result" id="hwfs3">-</div>
</div>
</div>
</div>
</div>
</div>
`;

window.CalculatorTemplates['fire-pump'] = `
<div class="page" id="page-fire-pump">
<div class="calc-header" style="background:linear-gradient(135deg,#f78f22,#d17914)">
<div class="calc-title">Fire Pump Duty Point</div>
<div class="calc-std">NFPA 20 - Pump Performance Requirements</div>
</div>
<div class="calc-desc red">Calculate fire pump rated duty, churn pressure, and peak flow point per NFPA 20
            requirements. Motor power estimate included.</div>
<div class="scard">
<div class="scard-head">
<div class="scard-accent" style="background:var(--red)"></div>
<div class="scard-title">System Demand</div>
</div>
<div class="scard-body">
<div class="input-group">
<div class="input-label">System Demand Flow <span class="input-unit" id="fp-flow-unit">GPM</span></div>
<input class="inp" id="fp-flow" data-action-input="calcFirePump()" placeholder="e.g. 500" type="number"/>
</div>
<div class="input-group">
<div class="input-label">System Demand Pressure <span class="input-unit" id="fp-press-unit">psi</span>
</div>
<input class="inp" id="fp-press" data-action-input="calcFirePump()" placeholder="e.g. 100" type="number"/>
</div>
<div class="input-group">
<div class="input-label">Suction Head (tank to pump) <span class="input-unit" id="fp-suct-unit">ft</span></div>
<input class="inp" id="fp-suct" data-action-input="calcFirePump()" placeholder="e.g. 8" type="number"/>
</div>
<div class="input-group">
<div class="input-label">Discharge Pipe Losses <span class="input-unit" id="fp-disch-unit">psi</span>
</div>
<input class="inp" id="fp-disch" data-action-input="calcFirePump()" placeholder="e.g. 5" type="number"/>
</div>
<div class="input-group">
<div class="input-label">Pump + Motor Efficiency <span class="input-unit">%</span></div>
<input class="inp" id="fp-eff" data-action-input="calcFirePump()" placeholder="e.g. 70" type="number"/>
</div>
</div>
</div>
<button class="calc-btn red" data-action-click="calcFirePump();showRes('fp-res')">⚡ Calculate Pump Duty</button>
<div id="fp-res" style="display:none">
<div id="fp-warn-area"></div>
<div class="duty-card" style="background:linear-gradient(135deg,#f78f22,#d17914)">
<div class="duty-label">Fire Pump Rated Duty (NFPA 20)</div>
<div class="duty-grid">
<div>
<div class="duty-col-label">Rated Flow</div>
<div class="duty-val" id="fp-rated-flow">-</div>
<div class="duty-unit" id="fp-flow-disp-unit">GPM</div>
</div>
<div class="duty-divider"></div>
<div>
<div class="duty-col-label">Rated Head</div>
<div class="duty-val" id="fp-rated-head">-</div>
<div class="duty-unit" id="fp-press-disp-unit">psi</div>
</div>
</div>
</div>
<div class="scard">
<div class="scard-head">
<div class="scard-accent" style="background:var(--red)"></div>
<div class="scard-title">NFPA 20 Performance Points</div>
</div>
<div class="scard-body">
<div class="res-row">
<div class="res-label">Churn Pressure (shut-off)</div>
<div class="res-val primary" id="fp-churn" style="color:var(--red)">-</div>
</div>
<div class="res-row">
<div class="res-label">Rated Point (100% flow)</div>
<div class="res-val" id="fp-rated-pt">-</div>
</div>
<div class="res-row">
<div class="res-label">Peak Flow (150% flow, 65% head)</div>
<div class="res-val" id="fp-peak-pt">-</div>
</div>
<div class="res-row">
<div class="res-label">Motor Power</div>
<div class="res-val" id="fp-power">-</div>
</div>
</div>
</div>
</div>
</div>
`;

window.CalculatorTemplates['fire-tank'] = `
<div class="page" id="page-fire-tank">
<div class="calc-header" style="background:linear-gradient(135deg,#f78f22,#d17914)">
<div class="calc-title">Fire Tank Capacity</div>
<div class="calc-std">NFPA 22 - Water Tanks for Private Fire Protection</div>
</div>
<div class="calc-desc red">Calculate required fire water tank capacity including sprinkler demand, standpipe
            demand, and hose stream allowance per NFPA 22.</div>
<div class="scard">
<div class="scard-head">
<div class="scard-accent" style="background:var(--red)"></div>
<div class="scard-title">System Type</div>
</div>
<div class="scard-body">
<div class="chip-row">
<div class="chip sel-red sel" data-action-click="setFTS(this,'combined')">Combined</div>
<div class="chip" data-action-click="setFTS(this,'sprinkler')">Sprinkler Only</div>
<div class="chip" data-action-click="setFTS(this,'standpipe')">Standpipe Only</div>
</div>
</div>
</div>
<div class="scard">
<div class="scard-head">
<div class="scard-accent" style="background:var(--red)"></div>
<div class="scard-title">Demand Inputs</div>
</div>
<div class="scard-body">
<div class="input-group" id="ft-sp-row">
<div class="input-label">Sprinkler Demand <span class="input-unit" id="ft-sp-unit">GPM</span></div>
<input class="inp" id="ft-sp-gpm" data-action-input="calcFireTank()" placeholder="e.g. 300" type="number"/>
</div>
<div class="input-group" id="ft-sp-dur-row">
<div class="input-label">Sprinkler Duration <span class="input-unit">min</span></div>
<input class="inp" id="ft-sp-dur" data-action-input="calcFireTank()" placeholder="e.g. 60" type="number"/>
</div>
<div class="input-group" id="ft-std-row">
<div class="input-label">Standpipe Demand <span class="input-unit" id="ft-std-unit">GPM</span></div>
<input class="inp" id="ft-std-gpm" data-action-input="calcFireTank()" placeholder="e.g. 500" type="number"/>
</div>
<div class="input-group" id="ft-std-dur-row">
<div class="input-label">Standpipe Duration <span class="input-unit">min</span></div>
<input class="inp" id="ft-std-dur" data-action-input="calcFireTank()" placeholder="e.g. 30" type="number"/>
</div>
<div class="input-group">
<div class="input-label">Hose Stream Allowance <span class="input-unit" id="ft-hs-unit">GPM</span></div>
<input class="inp" id="ft-hs-gpm" data-action-input="calcFireTank()" placeholder="e.g. 250" type="number"/>
</div>
<div class="input-group">
<div class="input-label">Hose Stream Duration <span class="input-unit">min</span></div>
<input class="inp" id="ft-hs-dur" data-action-input="calcFireTank()" placeholder="e.g. 60" type="number"/>
</div>
<div class="input-group">
<div class="input-label">Makeup Supply <span class="input-unit" id="ft-mu-unit">GPM</span> (0 = none)
                </div>
<input class="inp" id="ft-mu" data-action-input="calcFireTank()" placeholder="e.g. 0" type="number"/>
</div>
</div>
</div>
<button class="calc-btn red" data-action-click="calcFireTank();showRes('ft-res')">⚡ Calculate Tank Capacity</button>
<div id="ft-res" style="display:none">
<div id="ft-warn-area"></div>
<div class="scard">
<div class="scard-head">
<div class="scard-accent" style="background:var(--red)"></div>
<div class="scard-title">Tank Capacity Result</div>
</div>
<div class="scard-body">
<div class="res-row">
<div class="res-label">Sprinkler Volume</div>
<div class="res-val" id="ft-sp-vol">-</div>
</div>
<div class="res-row">
<div class="res-label">Standpipe Volume</div>
<div class="res-val" id="ft-std-vol">-</div>
</div>
<div class="res-row">
<div class="res-label">Hose Stream Volume</div>
<div class="res-val" id="ft-hs-vol">-</div>
</div>
<div class="res-row">
<div class="res-label">Total Required Capacity</div>
<div class="res-val primary" id="ft-total-gal" style="color:var(--red)">-</div>
</div>
<div class="res-row">
<div class="res-label">Total in Liters</div>
<div class="res-val" id="ft-total-l">-</div>
</div>
</div>
</div>
</div>
</div>
`;

window.CalculatorTemplates['unit-converter'] = `
<div class="page" id="page-unit-converter">
<div class="calc-header" style="background: linear-gradient(135deg, var(--brand), var(--brand-lt))">
<div class="calc-title">Unit Converter</div>
<div class="calc-std">Engineering units - all MEP disciplines</div>
</div>
<div class="conv-cats" id="conv-cats" style="margin-bottom: 20px"></div>
<div class="scard" style="border: 1px solid var(--border-strong); box-shadow: var(--shadow-md); border-radius: var(--r-lg)">
<div class="scard-body" style="padding: 24px">
<div class="input-group" style="margin-bottom: 20px">
<div class="input-label" style="font-weight: 600; font-size: 14px">Value to Convert</div>
<input class="inp" id="conv-input" data-action-input="doConvert()" placeholder="Enter value" style="font-size: 22px; font-weight: 800; padding: 12px 16px; border-radius: var(--r-md); background: var(--bg); transition: all 0.2s" type="number"/>
</div>
<div style="display: grid; grid-template-columns: 1fr auto 1fr; gap: 16px; align-items: end">
<div>
<div class="input-label" style="font-weight: 600">From</div>
<select class="inp inp-select" id="conv-from" data-action-change="doConvert()" style="padding: 10px 14px; font-size: 15px; font-weight: 600; border-radius: var(--r-sm)"></select>
</div>
<button id="conv-swap-btn" data-action-click="swapConv()" data-action-mouseout="this.style.background='var(--brand-tint)'; this.style.color='var(--brand)'; this.style.transform='rotate(0deg)'" data-action-mouseover="this.style.background='var(--brand)'; this.style.color='#fff'; this.style.transform='rotate(180deg)'" style="width: 44px; height: 44px; display: flex; align-items: center; justify-content: center; background: var(--brand-tint); border: 1.5px solid var(--brand); border-radius: 50%; cursor: pointer; font-size: 20px; transition: all 0.3s ease; margin-bottom: 0; color: var(--brand); box-shadow: var(--shadow-sm)">⇅</button>
<div>
<div class="input-label" style="font-weight: 600">To</div>
<select class="inp inp-select" id="conv-to" data-action-change="doConvert()" style="padding: 10px 14px; font-size: 15px; font-weight: 600; border-radius: var(--r-sm)"></select>
</div>
</div>
</div>
</div>
<div id="conv-result" style="display: none; margin-top: 20px">
<div class="conv-result-card">
<div class="conv-result-label">Converted Result</div>
<div class="conv-result-val" id="conv-res-val">-</div>
<div class="conv-result-unit" id="conv-res-unit">-</div>
</div>
<div id="conv-helper-card" style="margin-top: 14px; padding: 12px 16px; background: rgba(247, 143, 34, 0.06); border-radius: 10px; border: 1px solid rgba(247, 143, 34, 0.2); font-size: 12.5px; color: var(--muted); text-align: center; font-weight: 500">
              Formula: <span id="conv-formula-text" style="font-family: var(--mono); font-weight: 600; color: var(--brand)">-</span>
</div>
</div>
<div id="conv-quick-ref" style="margin-top: 24px">
<div class="section-header" style="margin-bottom: 12px">💡 Quick Reference Table</div>
<div class="scard" style="border-radius: var(--r-md)">
<div class="scard-body" id="conv-quick-ref-body" style="padding: 16px"></div>
</div>
</div>
</div>
`;

window.CalculatorTemplates['esp'] = `
<div class="page" id="page-esp">
<div class="calc-header">
<div class="calc-title">External Static Pressure (ESP)</div>
<div class="calc-std">AHU / FCU fan selection - total external static pressure</div>
</div>
<div class="calc-desc">Calculate total external static pressure available to the duct distribution system.
            Each component loss is entered separately for a clear breakdown.</div>
<div class="scard">
<div class="scard-head">
<div class="scard-accent" style="background:var(--blue)"></div>
<div class="scard-title">Supply Side Losses</div>
</div>
<div class="scard-body">
<div class="input-group">
<div class="input-label">Supply Duct System <span class="input-unit" id="esp-sup-unit">in w.g.</span>
</div>
<input class="inp" id="esp-sup" data-action-input="calcESP()" placeholder="e.g. 0.50" step="0.01" type="number"/>
</div>
<div class="input-group">
<div class="input-label">Supply Diffusers / Grilles <span class="input-unit" id="esp-diff-unit">in
                    w.g.</span></div>
<input class="inp" id="esp-diff" data-action-input="calcESP()" placeholder="e.g. 0.05" step="0.01" type="number"/>
</div>
</div>
</div>
<div class="scard">
<div class="scard-head">
<div class="scard-accent" style="background:var(--blue)"></div>
<div class="scard-title">Return Side Losses</div>
</div>
<div class="scard-body">
<div class="input-group">
<div class="input-label">Return Duct System <span class="input-unit" id="esp-ret-unit">in w.g.</span>
</div>
<input class="inp" id="esp-ret" data-action-input="calcESP()" placeholder="e.g. 0.30" step="0.01" type="number"/>
</div>
<div class="input-group">
<div class="input-label">Return Grilles / Louvres <span class="input-unit" id="esp-rg-unit">in
                    w.g.</span></div>
<input class="inp" id="esp-rg" data-action-input="calcESP()" placeholder="e.g. 0.05" step="0.01" type="number"/>
</div>
</div>
</div>
<div class="scard">
<div class="scard-head">
<div class="scard-accent" style="background:var(--blue)"></div>
<div class="scard-title">AHU Internal Components</div>
</div>
<div class="scard-body">
<div class="input-group">
<div class="input-label">Cooling Coil (dirty) <span class="input-unit" id="esp-coil-unit">in w.g.</span>
</div>
<input class="inp" id="esp-coil" data-action-input="calcESP()" placeholder="e.g. 0.60" step="0.01" type="number"/>
</div>
<div class="input-group">
<div class="input-label">Filter - Clean <span class="input-unit" id="esp-flt-unit">in w.g.</span></div>
<input class="inp" id="esp-flt-c" data-action-input="calcESP()" placeholder="e.g. 0.20" step="0.01" type="number"/>
</div>
<div class="input-group">
<div class="input-label">Filter - Dirty (design condition) <span class="input-unit" id="esp-flt-d-unit">in w.g.</span></div>
<input class="inp" id="esp-flt-d" data-action-input="calcESP()" placeholder="e.g. 0.50" step="0.01" type="number"/>
</div>
<div class="input-group">
<div class="input-label">Mixing Box / OA Damper <span class="input-unit" id="esp-mix-unit">in
                    w.g.</span></div>
<input class="inp" id="esp-mix" data-action-input="calcESP()" placeholder="e.g. 0.15" step="0.01" type="number"/>
</div>
<div class="input-group">
<div class="input-label">Accessories (humidifier, attenuator, etc.) <span class="input-unit" id="esp-acc-unit">in w.g.</span></div>
<input class="inp" id="esp-acc" data-action-input="calcESP()" placeholder="e.g. 0.10" step="0.01" type="number"/>
</div>
</div>
</div>
<button class="calc-btn blue" data-action-click="calcESP();showRes('esp-res')">⚡ Calculate ESP</button>
<div id="esp-res" style="display:none">
<div class="scard">
<div class="scard-head">
<div class="scard-accent" style="background:var(--blue)"></div>
<div class="scard-title">ESP Result</div>
</div>
<div class="scard-body">
<div class="res-row">
<div class="res-label">Total Supply Side</div>
<div class="res-val" id="esp-sup-tot">-</div>
</div>
<div class="res-row">
<div class="res-label">Total Return Side</div>
<div class="res-val" id="esp-ret-tot">-</div>
</div>
<div class="res-row">
<div class="res-label">AHU Internals (clean filter)</div>
<div class="res-val" id="esp-int-clean">-</div>
</div>
<div class="res-row">
<div class="res-label">AHU Internals (dirty filter)</div>
<div class="res-val" id="esp-int-dirty">-</div>
</div>
<div class="res-row">
<div class="res-label">Total ESP - Clean Filter</div>
<div class="res-val" id="esp-tot-clean">-</div>
</div>
<div class="res-row">
<div class="res-label">Total ESP - Dirty Filter (design)</div>
<div class="res-val primary" id="esp-tot-dirty">-</div>
</div>
</div>
</div>
<div id="esp-warn-area"></div>
</div>
</div>
`;

window.CalculatorTemplates['diffuser'] = `
<div class="page" id="page-diffuser">
<div class="calc-header">
<div class="calc-title">Diffuser Quick Selector</div>
<div class="calc-std">Based on typical manufacturer performance - not a substitute for manufacturer software
            </div>
</div>
<div class="calc-desc">Select diffuser type and estimate neck size, throw, and noise criterion for a given
            airflow. Results are based on typical published performance data.</div>
<div class="scard">
<div class="scard-head">
<div class="scard-accent" style="background:var(--blue)"></div>
<div class="scard-title">Room &amp; Airflow Inputs</div>
</div>
<div class="scard-body">
<div class="input-group">
<div class="input-label">Room Airflow <span class="input-unit" id="df-flow-unit">CFM</span></div>
<input class="inp" id="df-flow" data-action-input="calcDiffuser()" placeholder="e.g. 400" type="number"/>
</div>
<div class="input-group">
<div class="input-label">Number of Diffusers in Room</div>
<input class="inp" id="df-count" min="1" data-action-input="calcDiffuser()" placeholder="e.g. 2" type="number"/>
</div>
<div class="input-group">
<div class="input-label">Velocity <span class="input-unit" id="df-vt-unit">FPM</span></div>
<select class="inp inp-select" id="df-vel" data-action-change="calcDiffuser()">
<option value="2.0">2.0 m/s (350 FPM)</option>
<option value="2.5">2.5 m/s (500 FPM)</option>
</select>
</div>
<div class="input-group">
<div class="input-label">Diffuser Type</div>
<select class="inp inp-select" id="df-type" data-action-change="calcDiffuser()">
<option value="square">Square </option>
<option value="round">Round</option>
<option value="slot16">Linear Slot 16mm</option>
<option value="slot20">Linear Slot 20mm</option>
<option value="slot25">Linear Slot 25mm</option>
</select>
</div>
</div>
</div>
<button class="calc-btn blue" data-action-click="calcDiffuser();showRes('df-res')">⚡ Select Diffuser</button>
<div id="df-res" style="display:none">
<div class="scard">
<div class="scard-head">
<div class="scard-accent" style="background:var(--blue)"></div>
<div class="scard-title">Diffuser Selection</div>
</div>
<div class="scard-body">
<div class="res-row">
<div class="res-label">Flow per Diffuser</div>
<div class="res-val" id="df-per">-</div>
</div>
<div class="res-row">
<div class="res-label">Recommended Neck Size</div>
<div class="res-val primary" id="df-neck">-</div>
</div>
<div class="res-row">
<div class="res-label">Face Velocity</div>
<div class="res-val" id="df-fv">-</div>
</div>
<div class="res-row">
<div class="res-label">Estimated Throw (T50) <span style="font-size:10px;color:var(--muted)"> to 50
                      FPM terminal</span></div>
<div class="res-val" id="df-throw">-</div>
</div>
<div class="res-row">
<div class="res-label">Estimated NC Level</div>
<div class="res-val" id="df-nc">-</div>
</div>
<div class="res-row">
<div class="res-label">ADPI Suitability</div>
<div class="res-val" id="df-adpi">-</div>
</div>
</div>
</div>
<div id="df-warn-area"></div>
</div>
</div>
`;

window.CalculatorTemplates['lobby-press'] = `
<div class="page" id="page-lobby-press">
<div class="calc-header">
<div class="calc-title">Lobby Pressurisation/Makeup air Fan Calculation</div>
<div class="calc-std">Air Distribution</div>
</div>
<div class="calc-desc">Calculate Fresh Air Supply Rate and fan capacity for lobby pressurisation.</div>
<!-- ── CALCULATION STORAGE ACTIONS ── -->
<div class="calc-storage-bar" style="display:flex; gap:12px; margin-bottom:18px; background:var(--card); border:1px solid var(--border); border-radius:var(--r-md); padding:10px 14px; align-items:center;">
<span style="font-size:12px; font-weight:700; color:var(--text-sec); display:flex; align-items:center; gap:6px;">
              💾 Calculation Files:
            </span>
<div style="display:flex; gap:8px; margin-left:auto; align-items:center;">
<div id="lp-import-container" style="position:relative; display:inline-block;">
<button class="calc-btn" id="lp-import-btn" data-action-click="importFromSmokeExtract(event)" data-action-mouseout="this.style.background='rgba(59, 130, 246, 0.08)'" data-action-mouseover="this.style.background='rgba(59, 130, 246, 0.15)'" style="margin:0; width:auto; padding:7px 12px; font-size:11.5px; font-weight:700; border-radius:6px; display:flex; align-items:center; gap:6px; background:rgba(59, 130, 246, 0.08); color:var(--blue); border:1px solid rgba(59, 130, 246, 0.3); cursor:pointer; transition:all 0.2s;" type="button">
                  Import <span style="font-size: 8px; margin-left: 2px;">▼</span>
</button>
<div id="lp-import-dropdown" style="display:none; position:absolute; right:0; top:calc(100% + 6px); width:300px; border:1px solid var(--border); border-radius:8px; box-shadow:0 10px 25px -5px rgba(0,0,0,0.35), 0 8px 10px -6px rgba(0,0,0,0.35); z-index:999; padding:0; background:var(--card); text-align:left;">
<!-- Saved zones will be dynamically rendered here -->
</div>
</div>
<button class="calc-btn" data-action-click="openCustomSaveModal('lobby-press')" style="margin:0; width:auto; padding:8px 14px; font-size:11.5px; font-weight:700; border-radius:6px; display:flex; align-items:center; gap:6px; background:var(--blue); color:#fff; border:none; cursor:pointer; transition:all 0.2s;" type="button">
                💾 Save Current
              </button>
<button class="calc-btn" data-action-click="openCustomLoadModal('lobby-press')" data-action-mouseout="this.style.background='rgba(59, 130, 246, 0.08)'" data-action-mouseover="this.style.background='rgba(59, 130, 246, 0.15)'" style="margin:0; width:auto; padding:7px 12px; font-size:11.5px; font-weight:700; border-radius:6px; display:flex; align-items:center; gap:6px; background:rgba(59, 130, 246, 0.08); color:var(--blue); border:1px solid rgba(59, 130, 246, 0.3); cursor:pointer; transition:all 0.2s;" type="button">
                📂 Load Saved
              </button>
</div>
</div>
<div class="scard">
<div class="scard-head">
<div class="scard-accent" style="background:var(--blue)"></div>
<div class="scard-title">Parameters &amp; Calculations</div>
</div>
<div class="scard-body">
<div class="input-group">
<div class="input-label">Area of Lobby <span class="input-unit">m²</span></div>
<input class="inp" id="lp-area" data-action-input="calcLobbyPress()" placeholder="e.g. 50" type="number"/>
</div>
<div class="input-group">
<div class="input-label">Average Height of Lobby <span class="input-unit">m</span></div>
<input class="inp" id="lp-height" data-action-input="calcLobbyPress()" placeholder="e.g. 3" type="number"/>
</div>
<div class="input-group">
<div class="input-label">Volume of Lobby <span class="input-unit">m³</span></div>
<input class="inp" id="lp-volume" readonly="" style="background:rgba(0,0,0,0.03); color:var(--blue); font-weight:700;" type="text"/>
</div>
<div class="input-group">
<div class="input-label">Air Change per Hour (In Case of Fire) <span class="input-unit">/hr</span></div>
<input class="inp" id="lp-acph" data-action-input="calcLobbyPress()" placeholder="e.g. 10" type="number"/>
</div>
<div class="input-group">
<div class="input-label">Fresh Air Supply Rate/Floor <span class="input-unit">m³/s</span></div>
<input class="inp" id="lp-fresh-air" readonly="" style="background:rgba(0,0,0,0.03); color:var(--blue); font-weight:700;" type="text"/>
</div>
<div class="input-group">
<div class="input-label">Quantity of fans <span class="input-unit">No.</span></div>
<input class="inp" id="lp-fan-qty" data-action-input="calcLobbyPress()" placeholder="e.g. 2" type="number"/>
</div>
<div class="input-group">
<div class="input-label">Air Flow Rate for Each Fan <span class="input-unit">L/s</span></div>
<input class="inp" id="lp-flow-round" readonly="" style="background:rgba(0,0,0,0.03); color:var(--blue); font-weight:700;" type="text"/>
</div>
</div>
</div>
<div class="scard" style="margin-top:20px;">
<div class="scard-head">
<div class="scard-accent" style="background:var(--blue)"></div>
<div class="scard-title">Fan Head Requirement</div>
</div>
<div class="scard-body">
<div class="input-group">
<div class="input-label">Length of Ducting <span class="input-unit">m</span></div>
<input class="inp" id="lp-head-duct-len" data-action-input="calcLobbyPress()" placeholder="e.g. 20" step="0.1" type="number"/>
</div>
<div class="input-group">
<div class="input-label">Equivalent Length of Fittings + Accessories <span class="input-unit">m</span>
</div>
<input class="inp" id="lp-head-fittings" placeholder="Length × 0.6" readonly="" style="background:rgba(0,0,0,0.03); color:var(--blue); font-weight:700;" type="number"/>
</div>
<div class="input-group">
<div class="input-label">Total Equivalent Length <span class="input-unit">m</span></div>
<input class="inp" id="lp-head-eq-len" placeholder="Length + Fittings" readonly="" style="background:rgba(0,0,0,0.03); color:var(--blue); font-weight:700;" type="number"/>
</div>
<div class="input-group">
<div class="input-label">Frictional Factor <span class="input-unit">Pa/m</span></div>
<input class="inp" id="lp-head-friction-factor" data-action-input="calcLobbyPress()" placeholder="e.g. 1" step="0.01" type="number"/>
</div>
<div class="input-group">
<div class="input-label">Head Loss in Ducting <span class="input-unit">Pa</span></div>
<input class="inp" id="lp-head-friction-losses" placeholder="Frictional Factor × Eq Length" readonly="" style="background:rgba(0,0,0,0.03); color:var(--blue); font-weight:700;" type="text"/>
</div>
<div class="input-group">
<div class="input-label">Pressure Drop in Louvers + Grille <span class="input-unit">Pa</span></div>
<input class="inp" id="lp-head-louvers" data-action-input="calcLobbyPress()" placeholder="e.g. 50" step="1" type="number"/>
</div>
<div class="input-group">
<div class="input-label">Pressure Drop in Fan <span class="input-unit">Pa</span></div>
<input class="inp" id="lp-head-fan-losses" data-action-input="calcLobbyPress()" placeholder="e.g. 20" step="1" type="number"/>
</div>
<div class="input-group">
<div class="input-label">Head for the Fan <span class="input-unit">Pa</span></div>
<input class="inp" id="lp-head-total" placeholder="Rounded to nearest 10 Pa" readonly="" style="background:rgba(0,0,0,0.03); color:var(--blue); font-weight:700;" type="text"/>
</div>
</div>
</div>
<div class="scard" style="margin-top:20px;">
<div class="scard-head">
<div class="scard-accent" style="background:var(--blue)"></div>
<div class="scard-title">Calculations For Motor Selection</div>
</div>
<div class="scard-body">
<div class="input-group">
<div class="input-label">Flow of each fan <span class="input-unit">m³/s</span></div>
<input class="inp" id="lp-motor-flow" placeholder="Calculated (Q in m³/s)" readonly="" style="background:rgba(0,0,0,0.03); color:var(--blue); font-weight:700;" type="text"/>
</div>
<div class="input-group">
<div class="input-label">Total Static of the Fan <span class="input-unit">Pa</span></div>
<input class="inp" id="lp-motor-head" placeholder="Calculated (Head in Pa)" readonly="" style="background:rgba(0,0,0,0.03); color:var(--blue); font-weight:700;" type="text"/>
</div>
<div class="input-group">
<div class="input-label">Efficiency of Motor <span class="input-unit">% or dec</span></div>
<input class="inp" id="lp-motor-eff-motor" data-action-input="calcLobbyPress()" placeholder="e.g. 90" step="1" type="number" value="90"/>
</div>
<div class="input-group">
<div class="input-label">Efficiency of fan <span class="input-unit">% or dec</span></div>
<input class="inp" id="lp-motor-eff-fan" data-action-input="calcLobbyPress()" placeholder="e.g. 75" step="1" type="number" value="75"/>
</div>
<div class="input-group">
<div class="input-label">Power Required for Each Fan <span class="input-unit">kW</span></div>
<input class="inp" id="lp-motor-power" placeholder="Calculated (Ceiling of nearest round off)" readonly="" style="background:rgba(0,0,0,0.03); color:var(--blue); font-weight:700;" type="text"/>
</div>
<div class="input-group">
<div class="input-label">Number Of Fans <span class="input-unit">No.</span></div>
<input class="inp" id="lp-motor-fan-qty" data-action-input="this.dataset.userEdited='true'; calcLobbyPress()" placeholder="e.g. 2" step="1" type="number"/>
</div>
<div class="input-group">
<div class="input-label">Total Motor Power <span class="input-unit">kW</span></div>
<input class="inp" id="lp-motor-final-power" placeholder="Calculated (Power × 1.1 × Qty)" readonly="" style="background:rgba(0,0,0,0.03); color:var(--blue); font-weight:700;" type="text"/>
</div>
</div>
</div>
</div>
`;

window.CalculatorTemplates['stair-press'] = `
<div class="page" id="page-stair-press">
<div class="calc-header">
<div class="calc-title">Staircase Pressurization Calculator</div>
<div class="calc-std">Smoke Management</div>
</div>
<div class="calc-desc">Calculate air volume requirements for staircase pressurization to prevent smoke ingress during a fire.</div>
<div class="scard">
<div class="scard-head">
<div class="scard-accent" style="background:var(--blue)"></div>
<div class="scard-title">Design Parameters</div>
</div>
<div class="scard-body">
<div class="input-group">
<div class="input-label">Door Width <span class="input-unit">m</span></div>
<input class="inp" id="sp-door-width" data-action-input="calcStairPress()" placeholder="e.g. 1.0" step="0.1" type="number"/>
</div>
<div class="input-group">
<div class="input-label">Door Height <span class="input-unit">m</span></div>
<input class="inp" id="sp-door-height" data-action-input="calcStairPress()" placeholder="e.g. 2.1" step="0.1" type="number"/>
</div>
<div class="input-group">
<div class="input-label">Air Leakage at 12.5 Pascal <span class="input-unit">m³/s</span></div>
<input class="inp" id="sp-leakage" data-action-input="calcStairPress()" placeholder="e.g. 0.03" step="0.001" type="number"/>
</div>
<div class="input-group">
<div class="input-label">Number of Closed Doors <span class="input-unit">No.</span></div>
<input class="inp" id="sp-closed-doors" data-action-input="calcStairPress()" placeholder="e.g. 19" step="1" type="number"/>
</div>
</div>
</div>
<button class="calc-btn blue" data-action-click="calcStairPress();showRes('sp-res')">⚡ Calculate Pressurization</button>
<div id="sp-res" style="display:none">
<div id="sp-warn-area"></div>
<div class="scard">
<div class="scard-head">
<div class="scard-accent" style="background:var(--blue)"></div>
<div class="scard-title">Calculation Results</div>
</div>
<div class="scard-body">
<div class="res-row">
<div class="res-label">Door Area</div>
<div class="res-val" id="sp-r-door-area">-</div>
</div>
<div class="res-row">
<div class="res-label">Open Door Flow</div>
<div class="res-val" id="sp-r-open-flow">-</div>
</div>
<div class="res-row">
<div class="res-label">Closed Door Flow</div>
<div class="res-val" id="sp-r-closed-flow">-</div>
</div>
<div class="res-row">
<div class="res-label">Safety Flow (15%)</div>
<div class="res-val" id="sp-r-safety-flow">-</div>
</div>
<div class="res-row">
<div class="res-label">Total Air Volume</div>
<div class="res-val primary" id="sp-r-total-vol" style="color:var(--blue)">-</div>
</div>
</div>
</div>
</div>
</div>
`;

window.CalculatorTemplates['water-pipe'] = `
<div class="page" id="page-water-pipe">
<div class="calc-header" style="background:linear-gradient(135deg,#f78f22,#d17914)">
<div class="calc-title">Water Supply Pipe Sizer</div>
<div class="calc-std">IPC / ASPE - Velocity &amp; Pressure adequacy method</div>
</div>
<div class="calc-desc green">Size domestic water supply pipes and verify residual pressure at the most remote
            fixture. Uses Hazen-Williams with elevation and fitting allowances.</div>
<div class="scard">
<div class="scard-head">
<div class="scard-accent" style="background:var(--green)"></div>
<div class="scard-title">System Inputs</div>
</div>
<div class="scard-body">
<div class="input-group">
<div class="input-label">Design Flow Rate <span class="input-unit" id="wp-flow-unit">GPM</span></div>
<input class="inp" id="wp-flow" data-action-input="calcWaterPipe()" placeholder="e.g. 25" type="number"/>
</div>
<div class="input-group">
<div class="input-label">Available Supply Pressure <span class="input-unit" id="wp-pavail-unit">psi</span></div>
<input class="inp" id="wp-pavail" data-action-input="calcWaterPipe()" placeholder="e.g. 60" type="number"/>
</div>
<div class="input-group">
<div class="input-label">Required Residual at Fixture <span class="input-unit" id="wp-presid-unit">psi</span></div>
<input class="inp" id="wp-presid" data-action-input="calcWaterPipe()" placeholder="e.g. 20" type="number"/>
</div>
<div class="input-group">
<div class="input-label">Total Pipe Length <span class="input-unit" id="wp-len-unit">ft</span></div>
<input class="inp" id="wp-len" data-action-input="calcWaterPipe()" placeholder="e.g. 120" type="number"/>
</div>
<div class="input-group">
<div class="input-label">Fitting Allowance <span class="input-unit">% of pipe length</span></div>
<input class="inp" id="wp-fit" data-action-input="calcWaterPipe()" placeholder="e.g. 20" type="number"/>
</div>
<div class="input-group">
<div class="input-label">Elevation Rise (supply to fixture) <span class="input-unit" id="wp-elev-unit">ft</span></div>
<input class="inp" id="wp-elev" data-action-input="calcWaterPipe()" placeholder="e.g. 20" type="number"/>
</div>
<div class="input-group">
<div class="input-label">Pipe Material</div>
<select class="inp inp-select" id="wp-mat" data-action-change="calcWaterPipe()">
<option value="150">Copper Type L - C=150</option>
<option value="150">CPVC - C=150</option>
<option value="120">Galvanized Steel - C=120</option>
<option value="130">PEX - C=130</option>
</select>
</div>
</div>
</div>
<button class="calc-btn green" data-action-click="calcWaterPipe();showRes('wp-res')">⚡ Size Supply Pipe</button>
<div id="wp-res" style="display:none">
<div id="wp-warn-area"></div>
<div class="scard">
<div class="scard-head">
<div class="scard-accent" style="background:var(--green)"></div>
<div class="scard-title">Pipe Sizing Results - All Sizes</div>
</div>
<div class="scard-body" id="wp-table"></div>
</div>
<div class="scard">
<div class="scard-head">
<div class="scard-accent" style="background:var(--green)"></div>
<div class="scard-title">Recommended Selection</div>
</div>
<div class="scard-body">
<div class="res-row">
<div class="res-label">Recommended Pipe Size</div>
<div class="res-val primary" id="wp-rec-size" style="color:var(--green)">-</div>
</div>
<div class="res-row">
<div class="res-label">Velocity</div>
<div class="res-val" id="wp-rec-vel">-</div>
</div>
<div class="res-row">
<div class="res-label">Friction Loss</div>
<div class="res-val" id="wp-rec-fric">-</div>
</div>
<div class="res-row">
<div class="res-label">Elevation Pressure Loss</div>
<div class="res-val" id="wp-rec-elev">-</div>
</div>
<div class="res-row">
<div class="res-label">Residual at Remote Fixture</div>
<div class="res-val primary" id="wp-rec-resid" style="color:var(--green)">-</div>
</div>
</div>
</div>
</div>
</div>
`;

window.CalculatorTemplates['pressure-vessel'] = `
<div class="page" id="page-pressure-vessel">
<div class="calc-header" style="background:linear-gradient(135deg,var(--brand),var(--brand-md))">
<div class="calc-title">Pressure Vessel Sizing</div>
<div class="calc-std">Expansion/Buffer Tank calculations</div>
</div>
<div class="calc-desc">
            Calculate the required volume and size of a pressure vessel for the water supply system.
          </div>
<div class="scard">
<div class="scard-head" style="display:flex; justify-content:space-between; align-items:center">
<div style="display:flex; align-items:center">
<div class="scard-accent" style="background:var(--brand)"></div>
<div class="scard-title">Data Import</div>
</div>
</div>
<div class="scard-body">
<div style="display:flex; gap:12px; margin-bottom:16px;">
<button class="calc-btn" data-action-click="importForPressureVessel('booster')" style="flex:1">Import from Booster
                  Pump</button>
<button class="calc-btn" data-action-click="importForPressureVessel('transfer')" style="flex:1">Import from
                  Transfer Pump</button>
</div>
<div class="input-group" style="margin:0">
<div class="input-label">Imported Flow Rate (Total System Flow) <span class="input-unit">L/s</span>
</div>
<input class="inp" id="pv-imported-flow" readonly="" style="background:#f3f4f6; color:#4b5563;" type="number"/>
</div>
<div class="input-group" style="margin:0">
<div class="input-label">Imported Pump Head <span class="input-unit">bar</span></div>
<input class="inp" id="pv-imported-head" readonly="" style="background:#f3f4f6; color:#4b5563;" type="number"/>
</div>
</div>
</div>
<!-- SYSTEM PARAMETERS -->
<div class="scard">
<div class="scard-head">
<div class="scard-accent" style="background:var(--brand)"></div>
<div class="scard-title">System Parameters</div>
</div>
<div class="scard-body" style="display:flex; flex-direction:column; gap:12px">
<div class="input-group" style="margin:0">
<div class="input-label">Discharge Volume of Booster Pump (Q) <span class="input-unit">L/min</span>
</div>
<input class="inp" id="pv-q-lmin" readonly="" style="background:#f3f4f6; color:#4b5563;" type="number"/>
</div>
<div class="input-group" style="margin:0">
<div class="input-label">On / Off Band Factor</div>
<input class="inp" id="pv-band-factor" data-action-input="calcPressureVessel()" step="0.01" type="number" value="0.20"/>
</div>
<div class="input-group" style="margin:0">
<div class="input-label">Absolute pressure of Pump Stop (Pp) <span class="input-unit">Bar</span></div>
<input class="inp" id="pv-pp" readonly="" step="0.01" style="background:#f3f4f6; color:#4b5563;" type="number" value="8.52"/>
</div>
<div class="input-group" style="margin:0">
<div class="input-label">Absolute pressure of Pump Start (Pa) <span class="input-unit">Bar</span></div>
<input class="inp" id="pv-pa" readonly="" step="0.01" style="background:#f3f4f6; color:#4b5563;" type="number" value="5.68"/>
</div>
<div class="input-group" style="margin:0">
<div class="input-label">Absolute pressure - Preload of the Tank Pa - 0.2 (Pc) <span class="input-unit">Bar</span></div>
<input class="inp" id="pv-pc" readonly="" style="background:#f3f4f6; color:#4b5563;" type="number"/>
</div>
<div class="input-group" style="margin:0">
<div class="input-label">Times of Pump start in an hour (Zmax) <span class="input-unit">#</span></div>
<input class="inp" id="pv-zmax" data-action-input="calcPressureVessel()" type="number" value="60"/>
</div>
<div class="input-group" style="margin:0; display: none;">
<div class="input-label">Constant <span class="input-unit">#</span></div>
<input class="inp" id="pv-constant" data-action-input="calcPressureVessel()" step="0.1" type="number" value="16.5"/>
</div>
</div>
</div>
<button class="calc-btn" data-action-click="calcPressureVessel()">⚡ Calculate Capacity</button>
<!-- RESULTS CARD -->
<div id="pv-res" style="display:none; margin-top:20px;">
<div class="duty-card" style="background:linear-gradient(135deg,var(--brand),var(--brand-md))">
<div class="duty-label">Required Capacity of the Pressure Vessel</div>
<div class="duty-grid" style="grid-template-columns:1fr">
<div>
<div class="duty-col-label">Volume</div>
<div class="duty-val" id="pv-res-volume">-</div>
<div class="duty-unit">Liters</div>
</div>
</div>
</div>
</div>
</div>
`;

window.CalculatorTemplates['booster-pump'] = `
<div class="page" id="page-booster-pump">
<div class="calc-header" style="background:linear-gradient(135deg,var(--brand),var(--brand-md))">
<div class="calc-title">Pump Sizing (Transfer / Booster) &amp; Motor Calculation</div>
<div class="calc-std">Duty head &amp; flow flow calculations matching engineering standards</div>
</div>
<div class="calc-desc">
            Determine duty flow, head requirements, and motor selection for water supply pumps. Includes major/minor
            losses, static lift, safety margin, and power estimation.
          </div>
<!-- PUMP TYPE CHIP SELECTION -->
<div class="scard">
<div class="scard-head">
<div class="scard-accent" style="background:var(--brand)"></div>
<div class="scard-title">Select Pump Type</div>
</div>
<div class="scard-body">
<div class="chip-row" style="margin:0">
<div class="chip sel sel-brand" data-action-click="setPumpType(this,'booster')">Booster Pump</div>
<div class="chip" data-action-click="setPumpType(this,'transfer')">Transfer Pump</div>
<div class="chip" data-action-click="setPumpType(this,'transfer-booster')">Transfer-Booster</div>
</div>
<input id="bp-type" type="hidden" value="booster"/>
</div>
</div>
<!-- FLOW ESTIMATION BASIS -->
<div class="scard">
<div class="scard-head">
<div class="scard-accent" style="background:var(--brand)"></div>
<div class="scard-title">Flow Estimation Mode</div>
</div>
<div class="scard-body">
<!-- Transfer Pump Inputs -->
<div id="bp-flow-transfer-section" style="display:none; flex-direction:column; gap:12px">
<div class="input-group" style="margin:0">
<div class="input-label">Tank Capacity <span class="input-unit">Liters</span></div>
<input class="inp" id="bp-req" data-action-input="calcBooster()" placeholder="e.g. 10000" type="number"/>
</div>
<div class="input-group" style="margin:0">
<div class="input-label">Tank Fill Time <span class="input-unit">Hours</span></div>
<input class="inp" id="bp-time" data-action-input="calcBooster()" placeholder="e.g. 2" type="number"/>
</div>
</div>
<!-- Booster Pump Inputs -->
<div id="bp-flow-booster-section" style="display:flex; flex-direction:column; gap:12px">
<div class="input-group" style="margin:0">
<div class="input-label">Total Fixture Units <span class="input-unit">WSFU</span></div>
<input class="inp" id="bp-wsfu" data-action-input="calcBooster()" placeholder="Dynamic from project" type="number"/>
</div>
<div style="display:grid; grid-template-columns:1fr 1fr; gap:12px">
<div class="input-group" style="margin:0">
<div class="input-label">Number of pumps: Working</div>
<input class="inp" id="bp-pumps-work" min="1" data-action-input="calcBooster()" type="number" value="1"/>
</div>
<div class="input-group" style="margin:0">
<div class="input-label">Number of pumps: Standby</div>
<input class="inp" id="bp-pumps-stby" data-action-change="if(this.value==='') this.value='-'; calcBooster()" type="text" value="-"/>
</div>
</div>
<div style="font-size:11px; color:var(--muted); background:var(--brand-bg); padding:8px 12px; border-radius:8px">
                  💡 Flow will be calculated using the IPC Hunter Curve table with linear interpolation based on the
                  WSFU.
                </div>
</div>
<div class="input-group" style="margin-top:12px">
<div class="input-label">Design Flow Rate <span class="input-unit" id="bp-flow-unit-label">L/s</span>
</div>
<input class="inp" id="bp-flow" data-action-input="onFlowChange()" placeholder="Dynamic from project" style="background:#fff5e6; font-weight:700; color:var(--brand)" type="number"/>
</div>
</div>
</div>
<!-- MAJOR & MINOR HEAD LOSS -->
<div class="scard">
<div class="scard-head" style="display:flex; justify-content:space-between; align-items:center; width:100%">
<div style="display:flex; align-items:center; gap:8px">
<div class="scard-accent" style="background:var(--brand)"></div>
<div class="scard-title">Major &amp; Minor Head Loss (Piping Run)</div>
</div>
<div style="font-family:var(--font); color:var(--text); font-size:12px; font-weight:500; display:flex; align-items:center; gap:4px; text-transform:none">
<span>Friction Factor:</span>
<input id="bp-fric-factor" data-action-input="calcBooster()" data-action-mouseout="this.style.background='transparent'" data-action-mouseover="this.style.background='rgba(217,119,87,0.12)'; this.style.borderRadius='3px'" style="display:inline-block; width:32px; border:none; background:transparent; font-weight:700; color:var(--green); text-align:center; padding:2px 0; outline:none; font-family:var(--font); cursor:pointer; font-size:12px; transition:all 0.15s ease" type="text" value="0.4"/>
<span>bar/100m length</span>
</div>
</div>
<div class="scard-body" style="display:flex; flex-direction:column; gap:12px">
<div class="input-group" style="margin:0">
<div class="input-label">Vertical Pipe Length <span class="input-unit">m</span></div>
<input class="inp" id="bp-pipe-vert" data-action-input="calcBooster()" type="number" value="20"/>
</div>
<div class="input-group" style="margin:0">
<div class="input-label">Horizontal Pipe Length <span class="input-unit">m</span></div>
<input class="inp" id="bp-pipe-horiz" data-action-input="calcBooster()" type="number" value="50"/>
</div>
<div class="input-group" style="margin:0">
<div class="input-label">Elbows &amp; Reducers Equiv. <span class="input-unit">m</span></div>
<input class="inp" id="bp-pipe-elbows" readonly="" style="background:#f3f4f6; color:#4b5563; cursor:not-allowed" type="number"/>
</div>
<div class="input-group" style="margin:0">
<div class="input-label">Isolation Valves Equiv. <span class="input-unit">m</span></div>
<input class="inp" id="bp-pipe-valves" readonly="" style="background:#f3f4f6; color:#4b5563; cursor:not-allowed" type="number"/>
</div>
<div class="input-group" style="margin:0">
<div class="input-label">Equivalent Length <span class="input-unit">m</span></div>
<input class="inp" id="bp-pipe-equiv-input" readonly="" style="background:#f3f4f6; color:#4b5563; cursor:not-allowed" type="number"/>
</div>
<div class="input-group" style="margin:0">
<div class="input-label">Major + Minor Losses <span class="input-unit">bar</span></div>
<input class="inp" id="bp-pipe-loss-input" readonly="" style="background:#f3f4f6; color:#4b5563; cursor:not-allowed" type="number"/>
</div>
</div>
</div>
<!-- PUMP HEAD REQUIREMENT -->
<div class="scard">
<div class="scard-head">
<div class="scard-accent" style="background:var(--brand)"></div>
<div class="scard-title">Pump Head Requirement</div>
</div>
<div class="scard-body" style="display:flex; flex-direction:column; gap:12px">
<div id="bp-filters-section" style="display:none; flex-direction:column; gap:8px; margin:4px 0; background:#f8fafc; padding:12px; border-radius:8px; border:1px solid #e2e8f0">
<div class="input-label" style="margin-bottom:4px">Water Treatment Filters <span class="input-unit">Added to Head</span></div>
<label style="display:flex; align-items:center; gap:8px; font-size:12.5px; cursor:pointer; color:var(--text-sec)">
<input id="bp-filt-carbon" data-action-change="calcBooster()" type="checkbox" value="0.8"/> Carbon Filter (0.8
                  bar)
                </label>
<label style="display:flex; align-items:center; gap:8px; font-size:12.5px; cursor:pointer; color:var(--text-sec)">
<input id="bp-filt-mm" data-action-change="calcBooster()" type="checkbox" value="0.8"/> Multi-media Filter (0.8
                  bar)
                </label>
<label style="display:flex; align-items:center; gap:8px; font-size:12.5px; cursor:pointer; color:var(--text-sec)">
<input id="bp-filt-cuag" data-action-change="calcBooster()" type="checkbox" value="0.2"/> Cu-Ag Ionization (0.2
                  bar)
                </label>
<label style="display:flex; align-items:center; gap:8px; font-size:12.5px; cursor:pointer; color:var(--text-sec)">
<input id="bp-filt-soft" data-action-change="calcBooster()" type="checkbox" value="0.8"/> Softener (0.8 bar)
                </label>
</div>
<div class="input-group" style="margin:0">
<div class="input-label">Pressure Drop in the Piping <span class="input-unit">bar</span></div>
<input class="inp" id="bp-pipe-loss-input-head" readonly="" style="background:#f3f4f6; color:#4b5563; cursor:not-allowed" type="number"/>
</div>
<div class="input-group" style="margin:0">
<div class="input-label">Static Head <span class="input-unit">bar</span></div>
<input class="inp" id="bp-static-head" data-action-input="calcBooster()" step="0.1" type="number" value="5.0"/>
</div>
<div class="input-group" style="margin:0">
<div class="input-label">Residual Pressure at Outlet <span class="input-unit">bar</span></div>
<input class="inp" id="bp-presid" data-action-input="calcBooster()" step="0.1" type="number" value="1.0"/>
</div>
<div class="input-group" style="margin:0">
<div class="input-label">Suction Pressure (Available) <span class="input-unit">bar</span></div>
<input class="inp" id="bp-suction-p" data-action-input="calcBooster()" step="0.1" style="background:#fff5e6; color:#d17914" type="number" value="0.0"/>
</div>
<div class="input-group" style="margin:0">
<div class="input-label">Considering safety margin <span class="input-unit">%</span></div>
<input class="inp" id="bp-sf-head" data-action-input="calcBooster()" type="number" value="5"/>
</div>
<div class="input-group" style="margin:0">
<div class="input-label">Head for the Pump <span class="input-unit">bar</span></div>
<input class="inp" id="bp-pump-head-calc-input" readonly="" style="background:#f3f4f6; color:#4b5563; cursor:not-allowed" type="number"/>
</div>
</div>
</div>
<!-- MOTOR SELECTION -->
<div class="scard">
<div class="scard-head">
<div class="scard-accent" style="background:var(--brand)"></div>
<div class="scard-title">Selected Head &amp; Efficiency for Motor Sizing</div>
</div>
<div class="scard-body">
<div class="input-group">
<div class="input-label">Selected Head for the Pump <span class="input-unit">bar</span></div>
<input class="inp" id="bp-selected-head" data-action-input="calcBooster()" placeholder="Same as calculated head if blank" type="number"/>
</div>
<div style="display:grid; grid-template-columns:1fr 1fr; gap:12px; margin-top:12px">
<div class="input-group" style="margin:0">
<div class="input-label">Motor Efficiency <span class="input-unit">%</span></div>
<input class="inp" id="bp-eff-motor" data-action-input="calcBooster()" type="number" value="85"/>
</div>
<div class="input-group" style="margin:0">
<div class="input-label">Pump Efficiency <span class="input-unit">%</span></div>
<input class="inp" id="bp-eff-pump" data-action-input="calcBooster()" type="number" value="70"/>
</div>
</div>
</div>
</div>
<button class="calc-btn" data-action-click="calcBooster();showRes('bp-res')">⚡ Calculate Sizing &amp; Motor Sizing</button>
<!-- RESULTS CARD -->
<div id="bp-res" style="display:none">
<div class="duty-card" style="background:linear-gradient(135deg,var(--brand),var(--brand-md))">
<div class="duty-label" id="bp-duty-title">Booster Pump Duty</div>
<div class="duty-grid">
<div>
<div class="duty-col-label" id="bp-duty-flow-label">Flow Rate</div>
<div class="duty-val" id="bp-duty-flow">-</div>
<div class="duty-unit" id="bp-res-flow-unit">L/s</div>
</div>
<div class="duty-divider"></div>
<div>
<div class="duty-col-label">Required Head</div>
<div class="duty-val" id="bp-duty-head">-</div>
<div class="duty-unit">bar</div>
</div>
</div>
</div>
<!-- DETAIL BREAKDOWN -->
<div class="scard">
<div class="scard-head">
<div class="scard-accent" style="background:var(--brand)"></div>
<div class="scard-title">1. Friction and Equivalent Length Breakdown</div>
</div>
<div class="scard-body">
<div class="res-row">
<div class="res-label">Sum of Component Lengths</div>
<div class="res-val" id="bp-res-total-len">-</div>
</div>
<div class="res-row">
<div class="res-label">Total Equivalent Length (with Safety)</div>
<div class="res-val" id="bp-res-equiv-len">-</div>
</div>
<div class="res-row">
<div class="res-label">Major + Minor Friction Losses</div>
<div class="res-val" id="bp-res-friction-loss">-</div>
</div>
</div>
</div>
<div class="scard">
<div class="scard-head">
<div class="scard-accent" style="background:var(--brand)"></div>
<div class="scard-title">2. Sizing Head Requirements</div>
</div>
<div class="scard-body">
<div class="res-row">
<div class="res-label">Piping Friction Losses</div>
<div class="res-val" id="bp-res-loss-val">-</div>
</div>
<div class="res-row">
<div class="res-label">Static Elevation Lift</div>
<div class="res-val" id="bp-res-static-val">-</div>
</div>
<div class="res-row">
<div class="res-label">Residual Head at Outlet</div>
<div class="res-val" id="bp-res-outlet-val">-</div>
</div>
<div class="res-row">
<div class="res-label">Suction Pressure (Deducted)</div>
<div class="res-val" id="bp-res-suction-val" style="color:#d17914">-</div>
</div>
<div class="res-row">
<div class="res-label">Total Calculated Pump Head</div>
<div class="res-val primary" id="bp-res-total-pump-head" style="color:var(--brand); font-weight:700">-
                  </div>
</div>
</div>
</div>
<div class="scard">
<div class="scard-head">
<div class="scard-accent" style="background:var(--brand)"></div>
<div class="scard-title">3. Calculations for Motor Selection</div>
</div>
<div class="scard-body">
<div class="res-row">
<div class="res-label">Selected Head for the Pump</div>
<div class="res-val" id="bp-res-sel-head">-</div>
</div>
<div class="res-row">
<div class="res-label">Pump Flow Rate</div>
<div class="res-val" id="bp-res-flow-kg">-</div>
</div>
<div class="res-row">
<div class="res-label">Pressure Lift Requirement</div>
<div class="res-val" id="bp-res-lift-kpa">-</div>
</div>
<div class="res-row">
<div class="res-label">Shaft Power Requirement</div>
<div class="res-val" id="bp-res-shaft-kw">-</div>
</div>
<div class="res-row" style="background:rgba(217,119,87,0.08); padding:8px; border-radius:6px">
<div class="res-label" style="font-weight:700; color:var(--brand)">Estimated Motor Power</div>
<div class="res-val primary" id="bp-res-motor-power" style="color:var(--brand); font-weight:800; font-size:15px">-</div>
</div>
</div>
</div>
</div>
</div>
`;

window.CalculatorTemplates['sump-pump'] = `
<div class="page" id="page-sump-pump">
<div class="calc-header" style="background:linear-gradient(135deg,#f78f22,#d17914)">
<div class="calc-title">Sump Pump Sizing &amp; Motor Calculation</div>
<div class="calc-std">Evacuation capacity, piping losses, total dynamic head &amp; motor power</div>
</div>
<div class="calc-desc">
            Determine required flow rate, equivalent piping lengths, friction losses, static lift, and electric motor sizing to pump drainage or waste water from sump pits.
          </div>
<div class="scard">
<div class="scard-head">
<div class="scard-accent" style="background:#f78f22"></div>
<div class="scard-title">Sump Sizing Parameters</div>
</div>
<div class="scard-body" style="display:flex; flex-direction:column; gap:12px">
<div class="input-group" style="margin:0">
<div class="input-label">Sump Volumetric Requirement <span class="input-unit">Liters</span></div>
<input class="inp" id="sump-req" data-action-input="calcSump()" placeholder="e.g. 5000" type="number"/>
</div>
<div class="input-group" style="margin:0">
<div class="input-label">Required Drawdown Time <span class="input-unit">Hours</span></div>
<input class="inp" id="sump-time" data-action-input="calcSump()" placeholder="e.g. 1" type="number"/>
</div>
<div class="input-group" style="margin-top:12px">
<div class="input-label">Design Flow Rate <span class="input-unit">L/s</span></div>
<input class="inp" id="sump-flow" data-action-input="calcSump()" placeholder="Calculated or manual override" style="background:#fff5e6; font-weight:700; color:#d17914" type="number"/>
</div>
</div>
</div>
<!-- SUMP PIT SIZING INPUTS & RESULTS (SELF-CONTAINED) -->
<div class="scard">
<div class="scard-head">
<div class="scard-accent" style="background:#f78f22"></div>
<div class="scard-title">Sump Pit Sizing</div>
</div>
<div class="scard-body" style="display:flex; flex-direction:column; gap:12px">
<div class="input-group" style="margin:0">
<div class="input-label">Flow Through Each Sump <span class="input-unit">L/s</span></div>
<input class="inp" id="sump-pit-flow" data-action-input="calcSump()" type="number" value="10"/>
</div>
<div class="input-group" style="margin:0">
<div class="input-label">Holding Capacity of Sump <span class="input-unit">min</span></div>
<input class="inp" id="sump-pit-hold" data-action-input="calcSump()" type="number" value="10"/>
</div>
<div class="input-group" style="margin:0">
<div class="input-label">Longest Pipe Length <span class="input-unit">m</span></div>
<input class="inp" id="sump-pit-pipelen" data-action-input="calcSump()" type="number" value="100"/>
</div>
<div class="input-group" style="margin:0">
<div class="input-label">Proposed Sump Pit Length / Width <span class="input-unit">m</span></div>
<input class="inp" id="sump-pit-side" data-action-input="calcSump()" type="number" value="2.0"/>
</div>
<!-- Divider -->
<hr style="border: 0; border-top: 1px dashed #e2e8f0; margin: 8px 0;"/>
<!-- Calculated Results -->
<div class="res-row" style="padding: 0 4px;">
<div class="res-label" style="font-weight: 500; color: var(--muted);">Sump Pit Volume Required</div>
<div class="res-val" id="sump-pit-vol" style="font-weight: 700; color: var(--text);">- m³</div>
</div>
<div class="res-row" style="padding: 0 4px;">
<div class="res-label" style="font-weight: 500; color: var(--muted);">Pipe Invert Level</div>
<div class="res-val" id="sump-pit-invert" style="font-weight: 700; color: var(--text);">- m</div>
</div>
<!-- Hero Depth Card -->
<div style="background: linear-gradient(135deg,#f78f22 0%,#d17914 100%); color: #fff; padding: 18px 24px; border-radius: 12px; display: flex; justify-content: space-between; align-items: center; box-shadow: 0 4px 14px rgba(247, 143, 34, 0.3); margin-top: 4px;">
<div style="display: flex; flex-direction: column;">
<span style="font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 1px; opacity: 0.95;">Proposed Depth of Sump Pit</span>
<span style="font-size: 12px; opacity: 0.85; margin-top: 2px;">Calculated depth with min 1.0m water depth &amp; freeboard allowance</span>
</div>
<div id="sump-pit-depth" style="font-size: 26px; font-weight: 800; text-shadow: 0 2px 4px rgba(0,0,0,0.15); white-space: nowrap;">- m</div>
</div>
</div>
</div>
<div class="scard">
<div class="scard-head" style="display:flex; justify-content:space-between; align-items:center; width:100%">
<div style="display:flex; align-items:center; gap:8px">
<div class="scard-accent" style="background:#f78f22"></div>
<div class="scard-title">Major &amp; Minor Head Loss (Piping Run)</div>
</div>
<div style="font-family:var(--font); color:var(--text); font-size:12px; font-weight:500; display:flex; align-items:center; gap:4px; text-transform:none">
<span>Friction Factor:</span>
<input id="sump-fric-factor" data-action-input="calcSump()" data-action-mouseout="this.style.background='transparent'" data-action-mouseover="this.style.background='rgba(16,185,129,0.12)'; this.style.borderRadius='3px'" style="display:inline-block; width:32px; border:none; background:transparent; font-weight:700; color:#f78f22; text-align:center; padding:2px 0; outline:none; font-family:var(--font); cursor:pointer; font-size:12px; transition:all 0.15s ease" type="text" value="0.4"/>
<span>bar/100m length</span>
</div>
</div>
<div class="scard-body" style="display:flex; flex-direction:column; gap:12px">
<div class="input-group" style="margin:0">
<div class="input-label">Vertical Pipe Length <span class="input-unit">m</span></div>
<input class="inp" id="sump-pipe-vert" data-action-input="calcSump()" type="number" value="10"/>
</div>
<div class="input-group" style="margin:0">
<div class="input-label">Horizontal Pipe Length <span class="input-unit">m</span></div>
<input class="inp" id="sump-pipe-horiz" data-action-input="calcSump()" type="number" value="20"/>
</div>
<div class="input-group" style="margin:0">
<div class="input-label">Elbows &amp; Reducers Equiv. <span class="input-unit">m</span></div>
<input class="inp" id="sump-pipe-elbows" readonly="" style="background:#f3f4f6; color:#4b5563; cursor:not-allowed" type="number"/>
</div>
<div class="input-group" style="margin:0">
<div class="input-label">Isolation Valves Equiv. <span class="input-unit">m</span></div>
<input class="inp" id="sump-pipe-valves" readonly="" style="background:#f3f4f6; color:#4b5563; cursor:not-allowed" type="number"/>
</div>
<div class="input-group" style="margin:0">
<div class="input-label">Equivalent Length <span class="input-unit">m</span></div>
<input class="inp" id="sump-pipe-equiv-input" readonly="" style="background:#f3f4f6; color:#4b5563; cursor:not-allowed" type="number"/>
</div>
<div class="input-group" style="margin:0">
<div class="input-label">Major + Minor Losses <span class="input-unit">bar</span></div>
<input class="inp" id="sump-pipe-loss-input" readonly="" style="background:#f3f4f6; color:#4b5563; cursor:not-allowed" type="number"/>
</div>
</div>
</div>
<div class="scard">
<div class="scard-head">
<div class="scard-accent" style="background:#f78f22"></div>
<div class="scard-title">Pump Head Requirement</div>
</div>
<div class="scard-body" style="display:flex; flex-direction:column; gap:12px">
<div class="input-group" style="margin:0">
<div class="input-label">Pressure Drop in the Piping <span class="input-unit">bar</span></div>
<input class="inp" id="sump-pipe-loss-input-head" readonly="" style="background:#f3f4f6; color:#4b5563; cursor:not-allowed" type="number"/>
</div>
<div class="input-group" style="margin:0">
<div class="input-label">Static Head <span class="input-unit">bar</span></div>
<input class="inp" id="sump-static-head" data-action-input="calcSump()" step="0.1" type="number" value="1.0"/>
</div>
<div class="input-group" style="margin:0">
<div class="input-label">Residual Pressure at Outlet <span class="input-unit">bar</span></div>
<input class="inp" id="sump-presid" data-action-input="calcSump()" step="0.1" type="number" value="0.5"/>
</div>
<div class="input-group" style="margin:0">
<div class="input-label">Suction Pressure (Available) <span class="input-unit">bar</span></div>
<input class="inp" id="sump-suction-p" data-action-input="calcSump()" step="0.1" style="background:#fff5e6; color:#d17914" type="number" value="0.0"/>
</div>
<div class="input-group" style="margin:0">
<div class="input-label">Considering safety margin <span class="input-unit">%</span></div>
<input class="inp" id="sump-sf-head" data-action-input="calcSump()" type="number" value="5"/>
</div>
<div class="input-group" style="margin:0">
<div class="input-label">Head for the Pump <span class="input-unit">bar</span></div>
<input class="inp" id="sump-pump-head-calc-input" readonly="" style="background:#f3f4f6; color:#4b5563; cursor:not-allowed" type="number"/>
</div>
</div>
</div>
<div class="scard">
<div class="scard-head">
<div class="scard-accent" style="background:#f78f22"></div>
<div class="scard-title">Selected Head &amp; Efficiency for Motor Sizing</div>
</div>
<div class="scard-body">
<div class="input-group">
<div class="input-label">Selected Head for the Pump <span class="input-unit">bar</span></div>
<input class="inp" id="sump-selected-head" data-action-input="calcSump()" placeholder="Same as calculated head if blank" type="number"/>
</div>
<div style="display:grid; grid-template-columns:1fr 1fr; gap:12px; margin-top:12px">
<div class="input-group" style="margin:0">
<div class="input-label">Motor Efficiency <span class="input-unit">%</span></div>
<input class="inp" id="sump-eff-motor" data-action-input="calcSump()" type="number" value="85"/>
</div>
<div class="input-group" style="margin:0">
<div class="input-label">Pump Efficiency <span class="input-unit">%</span></div>
<input class="inp" id="sump-eff-pump" data-action-input="calcSump()" type="number" value="70"/>
</div>
</div>
</div>
</div>
<!-- ACTIONS -->
<div style="display:flex; gap:12px; margin-top:8px">
<button class="calc-btn green" data-action-click="calcSump(); showRes('sump-res')" style="margin:0; flex:1.2; background:#f78f22; color:#fff">⚡ Sump Pump Sizing</button>
<button class="calc-btn blue" data-action-click="sumpExportToExcel()" style="margin:0; flex:1; display:flex; align-items:center; justify-content:center; gap:8px; background:var(--blue)">
<span>📊</span> Export Excel
            </button>
</div>
<!-- RESULTS CARD -->
<div id="sump-res" style="display:none">
<div class="duty-card" style="background:linear-gradient(135deg,#f78f22,#d17914)">
<div class="duty-label">Sump Pump Sizing Duty</div>
<div class="duty-grid">
<div>
<div class="duty-col-label">Flow Rate</div>
<div class="duty-val" id="sump-duty-flow">-</div>
<div class="duty-unit">L/s</div>
</div>
<div class="duty-divider"></div>
<div>
<div class="duty-col-label">Required Head</div>
<div class="duty-val" id="sump-duty-head">-</div>
<div class="duty-unit">bar</div>
</div>
</div>
</div>
<!-- DETAIL BREAKDOWN -->
<div class="scard">
<div class="scard-head">
<div class="scard-accent" style="background:#f78f22"></div>
<div class="scard-title">1. Friction and Equivalent Length Breakdown</div>
</div>
<div class="scard-body">
<div class="res-row">
<div class="res-label">Sum of Component Lengths</div>
<div class="res-val" id="sump-res-total-len">-</div>
</div>
<div class="res-row">
<div class="res-label">Total Equivalent Length (with Safety)</div>
<div class="res-val" id="sump-res-equiv-len">-</div>
</div>
<div class="res-row">
<div class="res-label">Major + Minor Friction Losses</div>
<div class="res-val" id="sump-res-friction-loss">-</div>
</div>
</div>
</div>
<div class="scard">
<div class="scard-head">
<div class="scard-accent" style="background:#f78f22"></div>
<div class="scard-title">2. Sizing Head Requirements</div>
</div>
<div class="scard-body">
<div class="res-row">
<div class="res-label">Piping Friction Losses</div>
<div class="res-val" id="sump-res-loss-val">-</div>
</div>
<div class="res-row">
<div class="res-label">Static Elevation Lift</div>
<div class="res-val" id="sump-res-static-val">-</div>
</div>
<div class="res-row">
<div class="res-label">Residual Head at Outlet</div>
<div class="res-val" id="sump-res-outlet-val">-</div>
</div>
<div class="res-row">
<div class="res-label">Suction Pressure (Deducted)</div>
<div class="res-val" id="sump-res-suction-val" style="color:#d17914">-</div>
</div>
<div class="res-row">
<div class="res-label">Total Calculated Pump Head</div>
<div class="res-val primary" id="sump-res-total-pump-head" style="color:#d17914; font-weight:700">-</div>
</div>
</div>
</div>
<div class="scard">
<div class="scard-head">
<div class="scard-accent" style="background:#f78f22"></div>
<div class="scard-title">3. Calculations for Motor Selection</div>
</div>
<div class="scard-body">
<div class="res-row">
<div class="res-label">Selected Head for the Pump</div>
<div class="res-val" id="sump-res-sel-head">-</div>
</div>
<div class="res-row">
<div class="res-label">Pump Flow Rate</div>
<div class="res-val" id="sump-res-flow-kg">-</div>
</div>
<div class="res-row">
<div class="res-label">Pressure Lift Requirement</div>
<div class="res-val" id="sump-res-lift-kpa">-</div>
</div>
<div class="res-row">
<div class="res-label">Shaft Power Requirement</div>
<div class="res-val" id="sump-res-shaft-kw">-</div>
</div>
<div class="res-row" style="background:rgba(16,185,129,0.08); padding:8px; border-radius:6px">
<div class="res-label" style="font-weight:700; color:#d17914">Estimated Motor Power</div>
<div class="res-val primary" id="sump-res-motor-power" style="color:#d17914; font-weight:800; font-size:15px">-</div>
</div>
</div>
</div>
</div>
</div>
`;

window.CalculatorTemplates['hot-water'] = `
<div class="page" id="page-hot-water">
<div class="calc-header" style="background:linear-gradient(135deg,#f78f22,#d17914)">
<div class="calc-title">Hot Water System Calculator</div>
<div class="calc-std">Demand · Heater capacity · Storage · Recovery time</div>
</div>
<div class="calc-desc green">Size hot water heaters and storage tanks for residential, hotel, hospital, and
          commercial applications. Based on daily demand and peak draw patterns.</div>
<div class="scard">
<div class="scard-head">
<div class="scard-accent" style="background:var(--green)"></div>
<div class="scard-title">Occupancy &amp; Demand</div>
</div>
<div class="scard-body">
<div class="input-group">
<div class="input-label">Building type</div>
<select class="inp inp-select" id="hw-type" data-action-change="calcHotWater()">
<option value="50">Residential / Apartment - 50 L/person/day</option>
<option value="80">Hotel - 80 L/bed/day</option>
<option value="120">Hospital - 120 L/bed/day</option>
<option value="30">Office - 30 L/person/day</option>
<option value="40">School - 40 L/person/day</option>
<option value="60">Restaurant - 60 L/cover/day</option>
<option value="custom">Custom demand…</option>
</select>
</div>
<div class="input-group" id="hw-custom-row" style="display:none">
<div class="input-label">Custom demand <span class="input-unit">L/person/day</span></div><input class="inp" id="hw-custom" data-action-input="calcHotWater()" placeholder="e.g. 50" type="number"/>
</div>
<div class="input-group">
<div class="input-label">Number of persons / beds / covers</div><input class="inp" id="hw-occ" data-action-input="calcHotWater()" placeholder="e.g. 50" type="number"/>
</div>
<div class="input-group">
<div class="input-label">Peak draw factor <span class="input-unit">fraction of daily in peak hour</span>
</div><input class="inp" id="hw-peak" max="1" min="0.1" data-action-input="calcHotWater()" placeholder="e.g. 0.25" step="0.05" type="number"/>
</div>
</div>
</div>
<div class="scard">
<div class="scard-head">
<div class="scard-accent" style="background:var(--green)"></div>
<div class="scard-title">Temperature &amp; Heater</div>
</div>
<div class="scard-body">
<div class="input-group">
<div class="input-label">Cold water inlet temp <span class="input-unit" id="hw-tc-unit">°C</span></div>
<input class="inp" id="hw-tc" data-action-input="calcHotWater()" placeholder="e.g. 20" type="number"/>
</div>
<div class="input-group">
<div class="input-label">Hot water supply temp <span class="input-unit" id="hw-th-unit">°C</span></div>
<input class="inp" id="hw-th" data-action-input="calcHotWater()" placeholder="e.g. 60" type="number"/>
</div>
<div class="input-group">
<div class="input-label">Heater efficiency <span class="input-unit">%</span></div><input class="inp" id="hw-eff" data-action-input="calcHotWater()" placeholder="e.g. 90" type="number"/>
</div>
<div class="input-group">
<div class="input-label">Storage as % of daily demand <span class="input-unit">%</span></div><input class="inp" id="hw-storage-pct" data-action-input="calcHotWater()" placeholder="e.g. 60" type="number"/>
</div>
</div>
</div>
<button class="calc-btn green" data-action-click="calcHotWater();showRes('hotwater-res')">⚡ Size Hot Water
          System</button>
<div id="hotwater-res" style="display:none">
<div id="hotwater-warn-area"></div>
<div class="scard">
<div class="scard-head">
<div class="scard-accent" style="background:var(--green)"></div>
<div class="scard-title">Hot Water System Sizing</div>
</div>
<div class="scard-body">
<div class="res-row">
<div class="res-label">Daily hot water demand</div>
<div class="res-val" id="hw-r-daily">-</div>
</div>
<div class="res-row">
<div class="res-label">Peak hour demand</div>
<div class="res-val" id="hw-r-peak">-</div>
</div>
<div class="res-row">
<div class="res-label">Heater capacity required</div>
<div class="res-val primary" id="hw-r-kw" style="color:var(--green)">-</div>
</div>
<div class="res-row">
<div class="res-label">Storage tank capacity</div>
<div class="res-val primary" id="hw-r-tank" style="color:var(--green)">-</div>
</div>
<div class="res-row">
<div class="res-label">Recovery time (full tank)</div>
<div class="res-val" id="hw-r-recovery">-</div>
</div>
<div class="res-row">
<div class="res-label">Daily energy consumption</div>
<div class="res-val" id="hw-r-energy">-</div>
</div>
</div>
</div>
</div>
</div>
`;

window.CalculatorTemplates['pipe-check'] = `
<div class="page" id="page-pipe-check">
<div class="calc-header" style="background:linear-gradient(135deg,#f78f22,#d17914)">
<div class="calc-title">Pipe Design Check Tool</div>
<div class="calc-std">Velocity · pressure drop · sizing - design assistant</div>
</div>
<div class="calc-desc green">Enter your pipe system design values and get instant engineering feedback. Flags
          excessive velocity, undersized pipes, low pressure, and poor flow conditions.</div>
<div class="scard">
<div class="scard-head">
<div class="scard-accent" style="background:var(--green)"></div>
<div class="scard-title">Supply System Parameters</div>
</div>
<div class="scard-body">
<div class="input-group">
<div class="input-label">Cold water pipe velocity <span class="input-unit" id="pc-cv-unit">fps</span>
</div><input class="inp" id="pc-cw-vel" data-action-input="runPipeCheck()" placeholder="e.g. 5" step="0.5" type="number"/>
</div>
<div class="input-group">
<div class="input-label">Hot water pipe velocity <span class="input-unit" id="pc-hv-unit">fps</span>
</div><input class="inp" id="pc-hw-vel" data-action-input="runPipeCheck()" placeholder="e.g. 4" step="0.5" type="number"/>
</div>
<div class="input-group">
<div class="input-label">Residual pressure at critical fixture <span class="input-unit" id="pc-rp-unit">psi</span></div><input class="inp" id="pc-resid" data-action-input="runPipeCheck()" placeholder="e.g. 18" type="number"/>
</div>
<div class="input-group">
<div class="input-label">Maximum supply pressure <span class="input-unit" id="pc-mp-unit">psi</span>
</div><input class="inp" id="pc-max-press" data-action-input="runPipeCheck()" placeholder="e.g. 80" type="number"/>
</div>
</div>
</div>
<div class="scard">
<div class="scard-head">
<div class="scard-accent" style="background:var(--green)"></div>
<div class="scard-title">Drainage Parameters</div>
</div>
<div class="scard-body">
<div class="input-group">
<div class="input-label">Horizontal drain pipe velocity <span class="input-unit" id="pc-dv-unit">fps</span></div><input class="inp" id="pc-drain-vel" data-action-input="runPipeCheck()" placeholder="e.g. 2.5" step="0.5" type="number"/>
</div>
<div class="input-group">
<div class="input-label">Drain pipe slope <span class="input-unit">in/ft</span></div><input class="inp" id="pc-slope" data-action-input="runPipeCheck()" placeholder="e.g. 0.25" step="0.0625" type="number"/>
</div>
<div class="input-group">
<div class="input-label">Pipe fill ratio <span class="input-unit">% of diameter</span></div><input class="inp" id="pc-fill" data-action-input="runPipeCheck()" placeholder="e.g. 50" type="number"/>
</div>
</div>
</div>
<button class="calc-btn green" data-action-click="runPipeCheck();showRes('pc-res')">🔍 Run Pipe Design Check</button>
<div id="pc-res" style="display:none">
<div class="scard">
<div class="scard-head">
<div class="scard-accent" style="background:var(--green)"></div>
<div class="scard-title">Design Check Results</div>
</div>
<div class="scard-body" id="pc-results-body"></div>
</div>
</div>
</div>
`;

window.CalculatorTemplates['loading-unit-iop'] = `
<div class="page full-width-page" id="page-loading-unit-iop">
<div class="calc-header" style="background:linear-gradient(135deg,#f78f22,#d17914)">
<div class="calc-title">Loading Unit Calculator</div>
<div class="calc-std">Standard Loading Unit Method</div>
</div>
<div class="calc-desc green" style="display:flex; justify-content:space-between; align-items:center; gap:20px; flex-wrap:wrap">
<span>Traditional loading unit calculator for plumbing systems. Specify fixture quantities building-wide using
            standard frequencies.</span>
<div class="chip-group" style="margin:0; background:rgba(0,0,0,0.03); padding:4px; border-radius:10px; display:flex; gap:4px">
<div class="chip iop-std-chip" id="iop-chip-low" data-action-click="setIOPBuildingType('low')" style="font-size:11px; padding:6px 15px; border-radius:7px">Low</div>
<div class="chip iop-std-chip" id="iop-chip-med" data-action-click="setIOPBuildingType('med')" style="font-size:11px; padding:6px 15px; border-radius:7px">Medium</div>
<div class="chip iop-std-chip" id="iop-chip-high" data-action-click="setIOPBuildingType('high')" style="font-size:11px; padding:6px 15px; border-radius:7px">High</div>
</div>
</div>
<div class="scard" style="max-width:100%; overflow:hidden;">
<div class="scard-head" style="display:flex; align-items:center; justify-content:space-between">
<div style="display:flex; align-items:center">
<div class="scard-accent" style="background:var(--brand)"></div>
<div class="scard-title">Fixture Quantities (By Space / Area)</div>
</div>
<div style="display:flex; gap:8px">
<button data-action-click="PlumbingZoneLinker.openImportModal('loading-unit-iop')" style="border:1.5px solid var(--brand); background:rgba(243,150,50,0.06); color:var(--brand); border-radius:8px; padding:6px 12px; font-size:11px; font-weight:800; cursor:pointer; font-family:var(--font); display:flex; align-items:center; gap:5px">
                🔗 Import Zones</button>
<button data-action-click="clearAllIOPLUSpaces()" style="border:1px solid var(--red); background:rgba(220,38,38,0.04); color:var(--red); border-radius:8px; padding:6px 12px; font-size:11px; font-weight:700; cursor:pointer; font-family:var(--font)">🗑
                Clear All</button>
</div>
</div>
<div class="scard-body" id="iop-lu-fixture-rows" style="padding:0">
<!-- Table injected by JS -->
</div>
</div>
<button class="calc-btn" data-action-click="calcIOPLU();showRes('iop-lu-results')" style="background:var(--brand); color:#fff; border-radius:10px; margin-top:10px; box-shadow:0 4px 15px rgba(243,150,50,0.25)">⚡ Calculate Loading Units</button>
<div id="iop-lu-results" style="display:none">
<div class="scard" style="margin-top:15px; border-color:var(--brand)">
<div class="scard-head" style="background:var(--brand-tint)">
<div class="scard-accent" style="background:var(--brand)"></div>
<div class="scard-title" style="color:var(--brand)">Results Summary</div>
</div>
<div class="scard-body">
<div class="res-row">
<div class="res-label">Total Loading Units (L.U)</div>
<div class="res-val primary" id="iop-lu-r-total" style="color:var(--brand); font-size:18px">-</div>
</div>
<div class="res-row">
<div class="res-label">Flow Rate (L/s)</div>
<div class="res-val primary" id="iop-lu-r-flow" style="color:var(--brand); font-size:18px">-</div>
</div>
<div style="margin-top:15px; padding-top:15px; border-top:1px dashed #e2e8f0">
<div style="font-size:11px; font-weight:800; color:var(--text-sec); text-transform:uppercase; letter-spacing:0.8px; margin-bottom:8px">
                  Zone-wise Breakdown</div>
<div id="iop-lu-r-breakdown" style="font-size:12px; color:var(--muted); line-height:1.6; max-height:200px; overflow-y:auto; padding-right:10px">
</div>
</div>
</div>
</div>
</div>
</div>
`;

window.CalculatorTemplates['fixture-unit'] = `
<div class="page full-width-page" id="page-fixture-unit">
<div class="calc-header" style="background:linear-gradient(135deg,#f78f22,#d17914)">
<div class="calc-title">Fixture Unit Calculator</div>
<div class="calc-std">Water Supply Fixture Units (WSFU)</div>
</div>
<div class="calc-desc green">Select fixtures and specify usage standards (Cold, Hot, or Total). Automatically
          calculates WSFU and determines peak demand flow.</div>
<!-- Global chips removed to support independent per-zone standards -->
<div class="scard" style="max-width:100%; overflow:hidden;">
<div class="scard-head" style="display:flex; align-items:center; justify-content:space-between">
<div style="display:flex; align-items:center">
<div class="scard-accent" style="background:var(--brand)"></div>
<div class="scard-title">Fixture Quantities (By Space / Area)</div>
</div>
<div style="display:flex; gap:8px">
<button data-action-click="PlumbingZoneLinker.openImportModal('fixture-unit')" style="border:1px solid var(--brand); background:rgba(243,150,50,0.04); color:var(--brand); border-radius:6px; padding:4px 10px; font-size:11px; font-weight:700; cursor:pointer; font-family:var(--font)">🔗
                Import Zones</button>
<button data-action-click="clearAllFUSpaces()" style="border:1px solid var(--red); background:rgba(220,38,38,0.04); color:var(--red); border-radius:6px; padding:4px 10px; font-size:11px; font-weight:700; cursor:pointer; font-family:var(--font)">🗑
                Clear All Spaces</button>
</div>
</div>
<div class="scard-body" id="fu-fixture-rows" style="padding:0">
<!-- Table injected by JS -->
</div>
</div>
<button class="calc-btn" data-action-click="calcFixtureUnit();showRes('fu-results')" style="background:var(--brand);color:#fff;">⚡ Calculate Fixture Units</button>
<div id="fu-results" style="display:none">
<div class="scard">
<div class="scard-head">
<div class="scard-accent" style="background:var(--brand)"></div>
<div class="scard-title">Results</div>
</div>
<div class="scard-body">
<div class="res-row">
<div class="res-label">Selected Category</div>
<div class="res-val" id="fu-r-cat" style="font-weight:600;color:var(--brand)">-</div>
</div>
<div class="res-row">
<div class="res-label">Total Fixture Units (Wsfu)</div>
<div class="res-val primary" id="fu-r-total" style="color:var(--brand)">-</div>
</div>
<div class="res-row">
<div class="res-label">Probable peak flow (Curve Fit)</div>
<div class="res-val primary" id="fu-r-gpm" style="color:var(--brand)">-</div>
</div>
<div class="res-row">
<div class="res-label">Fixture breakdown</div>
<div class="res-val" id="fu-r-breakdown" style="font-size:11px;text-align:right;max-width:60%;white-space:pre-wrap">-</div>
</div>
<div class="res-row">
<div class="res-label">Applied Standard</div>
<div class="res-val" style="font-size:10px">Curve Fit Polynomial Method</div>
</div>
</div>
</div>
<div class="scard">
<div class="scard-head" data-action-click="toggleExpand('fu-details')">
<div class="scard-accent" style="background:var(--brand)"></div>
<div class="scard-title">Σ Detailed Calculations</div>
<div class="scard-arrow" id="fu-details-arrow">▼</div>
</div>
<div class="scard-body" id="fu-details" style="display:none;padding:12px">
<div id="fu-detailed-steps"></div>
</div>
</div>
<div class="scard">
<div class="scard-head" data-action-click="toggleExpand('fu-basis')">
<div class="scard-accent" style="background:var(--brand)"></div>
<div class="scard-title">ℹ Assumptions &amp; Basis</div>
<div class="scard-arrow" id="fu-basis-arrow">▼</div>
</div>
<div class="scard-body" id="fu-basis" style="display:none">
<div class="assump-body">
<div class="assump-item"><span class="assump-bullet">•</span><span>Standard: Water Supply Fixture Units
                    (WSFU) methodology.</span></div>
<div class="assump-item"><span class="assump-bullet">•</span><span>Categories: Usage standards (Cold,
                    Hot, or Total).</span></div>
<div class="assump-item"><span class="assump-bullet">•</span><span>Probable flow is derived from a Curve
                    Fit polynomial calculation in L/s.</span></div>
</div>
</div>
</div>
</div>
</div>
`;

window.CalculatorTemplates['discharge-unit'] = `
<div class="page full-width-page" id="page-discharge-unit">
<div class="calc-header" style="background:linear-gradient(135deg,#f78f22,#d17914)">
<div class="calc-title">Discharge Unit Smart Calculator</div>
<div class="calc-std">IOP / IPC - Discharge Units for Drainage System</div>
</div>
<div class="calc-desc green">Select fixtures and frequency of use to calculate total Discharge Units (D.U) for
          drainage pipe sizing according to engineering standards.</div>
<div class="scard" style="max-width:100%; overflow:hidden;">
<div class="scard-head" style="display:flex; align-items:center; justify-content:space-between">
<div style="display:flex; align-items:center">
<div class="scard-accent" style="background:var(--brand)"></div>
<div class="scard-title">Fixture Quantities (By Space / Area)</div>
</div>
<div style="display:flex; gap:8px">
<button data-action-click="PlumbingZoneLinker.openImportModal('discharge-unit')" style="border:1px solid var(--brand); background:rgba(243,150,50,0.04); color:var(--brand); border-radius:6px; padding:4px 10px; font-size:11px; font-weight:700; cursor:pointer; font-family:var(--font)">🔗
                Import Zones</button>
<button data-action-click="clearAllDUSpaces()" style="border:1px solid var(--red); background:rgba(220,38,38,0.04); color:var(--red); border-radius:6px; padding:4px 10px; font-size:11px; font-weight:700; cursor:pointer; font-family:var(--font)">🗑
                Clear All Spaces</button>
</div>
</div>
<div class="scard-body" id="du-fixture-rows" style="padding:0">
<!-- Table injected by JS -->
</div>
</div>
<button class="calc-btn" data-action-click="calcDischargeUnit();showRes('du-results')" style="background:var(--brand);color:#fff;">⚡ Calculate Discharge Units</button>
<div id="du-results" style="display:none">
<div class="scard">
<div class="scard-head">
<div class="scard-accent" style="background:var(--brand)"></div>
<div class="scard-title">Results</div>
</div>
<div class="scard-body">
<div class="res-row">
<div class="res-label">Total DU (Black Water)</div>
<div class="res-val primary" id="du-r-black" style="color:#991b1b">-</div>
</div>
<div class="res-row">
<div class="res-label">Total DU (Grey Water)</div>
<div class="res-val primary" id="du-r-grey" style="color:#166534">-</div>
</div>
<div class="res-row" style="border-top:1px dashed var(--border); padding-top:12px; margin-top:12px">
<div class="res-label">Total Discharge Units (Sum)</div>
<div class="res-val primary" id="du-r-total" style="color:var(--brand)">-</div>
</div>
<div class="res-row">
<div class="res-label">Probable peak flow (Hunter's)</div>
<div class="res-val primary" id="du-r-gpm" style="color:var(--brand)">-</div>
</div>
<div class="res-row">
<div class="res-label">Fixture breakdown</div>
<div class="res-val" id="du-r-breakdown" style="font-size:11px;text-align:right;max-width:60%;white-space:pre-wrap">-</div>
</div>
<div class="res-row">
<div class="res-label">Applied Standard</div>
<div class="res-val" style="font-size:10px">Institute of Plumbing (IOP) / IPC</div>
</div>
</div>
</div>
<div class="scard">
<div class="scard-head" data-action-click="toggleExpand('du-details')">
<div class="scard-accent" style="background:var(--brand)"></div>
<div class="scard-title">Σ Detailed Calculations</div>
<div class="scard-arrow" id="du-details-arrow">▼</div>
</div>
<div class="scard-body" id="du-details" style="display:none;padding:12px">
<div id="du-detailed-steps"></div>
</div>
</div>
<div class="scard">
<div class="scard-head" data-action-click="toggleExpand('du-basis')">
<div class="scard-accent" style="background:var(--brand)"></div>
<div class="scard-title">ℹ Assumptions &amp; Basis</div>
<div class="scard-arrow" id="du-basis-arrow">▼</div>
</div>
<div class="scard-body" id="du-basis" style="display:none">
<div class="assump-body">
<div class="assump-item"><span class="assump-bullet">•</span><span>Standard: Discharge unit methodology
                    for drainage systems.</span></div>
<div class="assump-item"><span class="assump-bullet">•</span><span>Categories: Low, Medium, High
                    represent frequency of use.</span></div>
<div class="assump-item"><span class="assump-bullet">•</span><span>Fallback Rules: If a category value
                    is null, the system defaults to Medium, then Low.</span></div>
<div class="assump-item"><span class="assump-bullet">•</span><span>Probable flow is derived from
                    Hunter's curve based on total D.U.</span></div>
</div>
</div>
</div>
</div>
</div>
`;

window.CalculatorTemplates['gravity-flow'] = `
<div class="page" id="page-gravity-flow">
<div class="calc-header" style="background:linear-gradient(135deg,#f78f22,#d17914)">
<div class="calc-title">Gravity Flow Check</div>
<div class="calc-std">Manning's equation - partial flow in circular pipes</div>
</div>
<div class="calc-desc green">Verify gravity drainage pipe performance using Manning's equation. Checks that
          velocity and fill ratio are within acceptable limits for self-cleansing flow.</div>
<div class="scard">
<div class="scard-head">
<div class="scard-accent" style="background:var(--green)"></div>
<div class="scard-title">Pipe &amp; Flow Inputs</div>
</div>
<div class="scard-body">
<div class="input-group">
<div class="input-label">Pipe internal diameter <span class="input-unit" id="gf-dia-unit">in</span>
</div>
<select class="inp inp-select" id="gf-dia" data-action-change="calcGravityFlow()">
<option value="2">2" (50mm)</option>
<option value="3">3" (75mm)</option>
<option selected="" value="4">4" (100mm)</option>
<option value="6">6" (150mm)</option>
<option value="8">8" (200mm)</option>
<option value="10">10" (250mm)</option>
<option value="12">12" (300mm)</option>
</select>
</div>
<div class="input-group">
<div class="input-label">Pipe slope <span class="input-unit">in/ft</span></div>
<select class="inp inp-select" id="gf-slope" data-action-change="calcGravityFlow()">
<option value="0.0625">1/16" per foot (0.52%)</option>
<option value="0.125">1/8" per foot (1.04%)</option>
<option selected="" value="0.25">1/4" per foot (2.08%)</option>
<option value="0.5">1/2" per foot (4.17%)</option>
<option value="1.0">1" per foot (8.33%)</option>
</select>
</div>
<div class="input-group">
<div class="input-label">Manning's n (pipe material)</div>
<select class="inp inp-select" id="gf-n" data-action-change="calcGravityFlow()">
<option value="0.011">PVC / HDPE - n = 0.011</option>
<option selected="" value="0.013">Cast iron / ductile iron - n = 0.013</option>
<option value="0.015">Concrete - n = 0.015</option>
<option value="0.013">Vitrified clay - n = 0.013</option>
</select>
</div>
<div class="input-group">
<div class="input-label">Design flow rate <span class="input-unit" id="gf-flow-unit">GPM</span></div>
<input class="inp" id="gf-flow" data-action-input="calcGravityFlow()" placeholder="e.g. 20" type="number"/>
</div>
</div>
</div>
<button class="calc-btn green" data-action-click="calcGravityFlow();showRes('gf-res')">⚡ Check Gravity Flow</button>
<div id="gf-res" style="display:none">
<div id="gf-warn-area"></div>
<div class="scard">
<div class="scard-head">
<div class="scard-accent" style="background:var(--green)"></div>
<div class="scard-title">Gravity Flow Results</div>
</div>
<div class="scard-body">
<div class="res-row">
<div class="res-label">Full-flow capacity</div>
<div class="res-val" id="gf-r-full">-</div>
</div>
<div class="res-row">
<div class="res-label">Full-flow velocity</div>
<div class="res-val" id="gf-r-vfull">-</div>
</div>
<div class="res-row">
<div class="res-label">Pipe fill ratio</div>
<div class="res-val primary" id="gf-r-fill" style="color:var(--green)">-</div>
</div>
<div class="res-row">
<div class="res-label">Actual flow velocity</div>
<div class="res-val primary" id="gf-r-vel" style="color:var(--green)">-</div>
</div>
<div class="res-row">
<div class="res-label">Self-cleansing check (≥ 2 fps)</div>
<div class="res-val" id="gf-r-cleanse">-</div>
</div>
<div class="res-row">
<div class="res-label">Scouring check (≤ 10 fps)</div>
<div class="res-val" id="gf-r-scour">-</div>
</div>
</div>
</div>
</div>
</div>
`;

window.CalculatorTemplates['sewage-pump'] = `
<div class="page" id="page-sewage-pump">
<div class="calc-header" style="background:linear-gradient(135deg,#f78f22,#d17914)">
<div class="calc-title">Sewage Pump Sizing</div>
<div class="calc-std">Submersible / ejector pump - sump volume + cycle time</div>
</div>
<div class="calc-desc green">Size sewage ejector or submersible sump pump for basement or low-level drainage.
          Calculates required pump capacity, sump volume, and cycle time.</div>
<div class="scard">
<div class="scard-head">
<div class="scard-accent" style="background:var(--green)"></div>
<div class="scard-title">Flow &amp; Sump Inputs</div>
</div>
<div class="scard-body">
<div class="input-group">
<div class="input-label">Peak sewage inflow rate <span class="input-unit" id="sp-flow-unit">GPM</span>
</div><input class="inp" id="sp-inflow" data-action-input="calcSewagePump()" placeholder="e.g. 30" type="number"/>
</div>
<div class="input-group">
<div class="input-label">Desired pump cycle time <span class="input-unit">minutes</span></div><input class="inp" id="sp-cycle" min="1" data-action-input="calcSewagePump()" placeholder="e.g. 5" step="0.5" type="number"/>
</div>
<div class="input-group">
<div class="input-label">Minimum starts per hour <span class="input-unit">max</span></div><input class="inp" id="sp-starts" max="20" min="1" data-action-input="calcSewagePump()" placeholder="e.g. 6" type="number"/>
</div>
<div class="input-group">
<div class="input-label">Static lift (invert to discharge) <span class="input-unit" id="sp-lift-unit">ft</span></div><input class="inp" id="sp-lift" data-action-input="calcSewagePump()" placeholder="e.g. 15" type="number"/>
</div>
<div class="input-group">
<div class="input-label">Friction head in discharge pipe <span class="input-unit" id="sp-hf-unit">ft</span></div><input class="inp" id="sp-hf" data-action-input="calcSewagePump()" placeholder="e.g. 5" type="number"/>
</div>
<div class="input-group">
<div class="input-label">Safety factor <span class="input-unit">%</span></div><input class="inp" id="sp-sf" data-action-input="calcSewagePump()" placeholder="e.g. 20" type="number"/>
</div>
</div>
</div>
<button class="calc-btn green" data-action-click="calcSewagePump();showRes('sewage-pump-res')">⚡ Size Sewage
          Pump</button>
<div id="sewage-pump-res" style="display:none">
<div id="sp-warn-area"></div>
<div class="duty-card" style="background:linear-gradient(135deg,#f78f22,#da7212)">
<div class="duty-label">Pump Duty</div>
<div class="duty-grid">
<div>
<div class="duty-col-label">Capacity</div>
<div class="duty-val" id="sp-r-pump-gpm">-</div>
<div class="duty-unit" id="sp-r-pump-unit">GPM</div>
</div>
<div class="duty-divider"></div>
<div>
<div class="duty-col-label">Total Head</div>
<div class="duty-val" id="sp-r-head">-</div>
<div class="duty-unit">ft w.g.</div>
</div>
</div>
</div>
<div class="scard">
<div class="scard-head">
<div class="scard-accent" style="background:var(--green)"></div>
<div class="scard-title">Sump &amp; Cycle Details</div>
</div>
<div class="scard-body">
<div class="res-row">
<div class="res-label">Sump working volume</div>
<div class="res-val" id="sp-r-sump">-</div>
</div>
<div class="res-row">
<div class="res-label">Pump run time per cycle</div>
<div class="res-val" id="sp-r-runtime">-</div>
</div>
<div class="res-row">
<div class="res-label">Starts per hour (at peak)</div>
<div class="res-val" id="sp-r-starts">-</div>
</div>
<div class="res-row">
<div class="res-label">Total head (static + friction)</div>
<div class="res-val" id="sp-r-tothead">-</div>
</div>
<div class="res-row">
<div class="res-label">Motor power estimate</div>
<div class="res-val" id="sp-r-power">-</div>
</div>
</div>
</div>
</div>
</div>
`;

window.CalculatorTemplates['rainwater'] = `
<div class="page full-width-page" id="page-rainwater">
<div class="calc-header" style="background:linear-gradient(135deg,#f78f22,#d17914)">
<div class="calc-title">Storm Water Calculation</div>
<div class="calc-std">Runoff Flow Estimation - Rational Method</div>
</div>
<div class="calc-desc">Calculate storm water flow rate from roof and pool deck areas based on surface type and rainfall intensity.</div>
<div class="scard" style="overflow-x: auto;">
<div class="scard-head">
<div class="scard-accent" style="background:var(--brand)"></div>
<div class="scard-title">Storm Water Runoff Schedule</div>
</div>
<div class="scard-body" style="padding:15px">
<div style="display:flex; align-items:center; justify-content:space-between; gap:10px; margin-bottom:12px; flex-wrap:wrap">
<div class="live-badge" id="sw-status-msg" style="background:#e6f4ea; color:#137333; padding:5px 10px; border-radius:15px; font-size:12px; font-weight:600">Live values ready</div>
<div style="display:flex; gap:8px">
<button class="calc-btn" data-action-click="swExportToExcel()" style="margin:0; width:auto; padding:6px 12px; font-size:12.5px; background:var(--brand); color:#fff; display:flex; align-items:center; gap:6px">📊 Export Excel</button>
<button class="calc-btn" data-action-click="swDeleteSelected()" style="margin:0; width:auto; padding:6px 12px; font-size:12.5px; background:#fce8e6; color:#c5221f; display:flex; align-items:center; gap:6px">🗑️ Delete Selected</button>
<button class="calc-btn" data-action-click="swClearAll()" style="margin:0; width:auto; padding:6px 12px; font-size:12.5px; background:#e8eaed; color:#3c4043; display:flex; align-items:center; gap:6px">🔄 Clear All</button>
</div>
</div>
<div class="pcl-table-wrap" style="margin-top:12px">
<table id="sw-table" style="width:100%; border-collapse:collapse; font-size:12px; table-layout:fixed">
<colgroup>
<col style="width:40px"/>
<col style="width:40px"/>
<col style="width:25%"/>
<col style="width:12%"/>
<col style="width:23%"/>
<col style="width:13%"/>
<col style="width:8%"/>
<col style="width:15%"/>
</colgroup>
<thead>
<tr style="background:#ffffff; color:#334155; font-weight:700; border-bottom:2px solid #cbd5e1">
<th style="padding:10px 6px; text-align:center; border-right:1px solid #e2e8f0"><input id="sw-select-all" data-action-change="swToggleSelectAll(this.checked)" style="cursor:pointer" type="checkbox"/></th>
<th style="padding:10px 6px; text-align:center; font-weight:700; font-size:11.5px; border-right:1px solid #e2e8f0">#</th>
<th style="padding:10px 12px; text-align:left; font-weight:700; font-size:11.5px; border-right:1px solid #e2e8f0">Catchment / Area Name</th>
<th style="padding:10px 12px; text-align:right; font-weight:700; font-size:11.5px; border-right:1px solid #e2e8f0">Area <span class="sw-area-unit" style="font-weight:400; font-size:9.5px; color:#64748b">(m²)</span></th>
<th style="padding:10px 12px; text-align:left; font-weight:700; font-size:11.5px; border-right:1px solid #e2e8f0">Surface Type</th>
<th style="padding:10px 12px; text-align:right; font-weight:700; font-size:11.5px; border-right:1px solid #e2e8f0">Intensity <span class="sw-intensity-unit" style="font-weight:400; font-size:9.5px; color:#64748b">(mm/hr)</span></th>
<th style="padding:10px 6px; text-align:center; font-weight:700; font-size:11.5px; border-right:1px solid #e2e8f0">C</th>
<th style="padding:10px 12px; text-align:right; font-weight:700; font-size:11.5px">Flow Rate <span class="sw-flow-unit" style="font-weight:400; font-size:9.5px; color:#64748b">(L/s)</span></th>
</tr>
</thead>
<tbody>
<!-- Entry form row -->
<tr id="sw-entry-row" style="background:#f8fafc; border-bottom:1.5px solid #cbd5e1">
<td colspan="2" style="padding:8px 6px; text-align:center; background:#f1f5f9; border-right:1px solid #cbd5e1">
<button class="pcl-inline-btn" data-action-click="swAddRow()" style="padding:6px 0; width:100%; border-radius:6px; font-size:12px; display:flex; align-items:center; justify-content:center; gap:4px; background:#f78f22; color:#fff; border:none; cursor:pointer; font-weight:700"><span style="font-size:14px; line-height:1;">+</span> Add</button>
</td>
<td style="padding:6px; border-right:1px solid #e2e8f0">
<input class="pcl-inline-inp" id="sw-input-name" data-action-input="swPreviewRow()" placeholder="e.g. Roof Area" type="text" value="New Catchment"/>
</td>
<td style="padding:6px; border-right:1px solid #e2e8f0">
<input class="pcl-inline-inp" id="sw-input-area" min="0" data-action-input="swPreviewRow()" placeholder="e.g. 500" step="10" style="text-align:right" type="number"/>
</td>
<td style="padding:6px; border-right:1px solid #e2e8f0">
<select class="pcl-inline-select" id="sw-input-surface" data-action-change="swPreviewRow()">
<option value="0.95">Asphalt (0.95)</option>
<option value="0.85">Brick (0.85)</option>
<option value="0.95">Concrete (0.95)</option>
<option value="0.20">Sandy Soil (0.20)</option>
<option selected="" value="0.85">Clay Soil (0.85)</option>
<option value="0.30">Agricultural (0.30)</option>
<option value="0.30">Unimproved (0.30)</option>
<option value="0.25">Parks &amp; Playgrounds (0.25)</option>
<option value="0.25">Cemeteries (0.25)</option>
<option value="0.35">Playground (0.35)</option>
<option value="0.95">Business District (0.95)</option>
<option value="0.50">Small Villas (0.50)</option>
<option value="0.40">Large Villas (0.40)</option>
<option value="0.70">Apartments (0.70)</option>
<option value="0.80">Industrial Light (0.80)</option>
<option value="0.90">Industrial Heavy (0.90)</option>
</select>
</td>
<td style="padding:6px; border-right:1px solid #e2e8f0">
<input class="pcl-inline-inp" id="sw-input-intensity" min="0" data-action-input="swPreviewRow()" step="1" style="text-align:right" type="number" value="75"/>
</td>
<td id="sw-preview-c" style="padding:6px; text-align:center; color:#475569; font-weight:600; border-right:1px solid #e2e8f0; font-size:12px">0.85</td>
<td id="sw-preview-q" style="padding:6px; text-align:right; color:#f78f22; font-weight:700; font-size:12.5px">—</td>
</tr>
</tbody>
<!-- Data rows -->
<tbody id="sw-tbody">
</tbody>
<!-- Summary row -->
<tfoot>
<tr style="background:#f8fafc; border-top:2px solid #cbd5e1; border-bottom:2px solid #cbd5e1; font-weight:700; color:#0f172a">
<td colspan="3" style="padding:12px 10px; text-align:right; border-right:1px solid #e2e8f0; font-size:12.5px">TOTAL:</td>
<td id="sw-total-area" style="padding:12px 12px; text-align:right; border-right:1px solid #e2e8f0; font-size:12.5px">0.0</td>
<td style="border-right:1px solid #e2e8f0"></td>
<td style="border-right:1px solid #e2e8f0"></td>
<td id="sw-total-c" style="padding:12px 6px; text-align:center; border-right:1px solid #e2e8f0; font-size:12.5px">0.00</td>
<td id="sw-total-q" style="padding:12px 12px; text-align:right; color:#f78f22; font-size:13px">0.0 L/s</td>
</tr>
</tfoot>
</table>
</div>
</div>
</div>
<div id="rw-res" style="display:none">
<div class="scard">
<div class="scard-head">
<div class="scard-accent" style="background:var(--brand)"></div>
<div class="scard-title">Storm Water Results</div>
</div>
<div class="scard-body">
<div class="res-row" style="display:none">
<div class="res-label">Total Catchments</div>
<div class="res-val" id="sw-r-roof-flow">-</div>
</div>
<div class="res-row">
<div class="res-label">Runoff Coefficient (C)</div>
<div class="res-val" id="sw-r-c">-</div>
</div>
<div class="res-row">
<div class="res-label">Total Catchment Area</div>
<div class="res-val primary" id="sw-r-pool-flow" style="color:var(--brand)">-</div>
</div>
<div class="res-row" style="border-top:1px dashed rgba(0,0,0,0.1); padding-top:10px; font-weight:700">
<div class="res-label">Total Storm Water Flow</div>
<div class="res-val primary" id="sw-r-total-flow" style="color:var(--brand)">-</div>
</div>
</div>
</div>
<div class="scard">
<div class="scard-head" data-action-click="toggleExpand('sw-details')">
<div class="scard-accent" style="background:var(--brand)"></div>
<div class="scard-title">Σ Detailed Calculations</div>
<div class="scard-arrow" id="sw-details-arrow">▼</div>
</div>
<div class="scard-body" id="sw-details" style="display:none;padding:12px">
<div id="sw-detailed-steps"></div>
</div>
</div>
<div class="scard">
<div class="scard-head" data-action-click="toggleExpand('sw-basis')">
<div class="scard-accent" style="background:var(--brand)"></div>
<div class="scard-title">ℹ Assumptions &amp; Basis</div>
<div class="scard-arrow" id="sw-basis-arrow">▼</div>
</div>
<div class="scard-body" id="sw-basis" style="display:none;padding:15px">
<div class="assump-body" style="font-size:12.5px; line-height:1.6">
<div class="assump-item"><span class="assump-bullet">•</span><span>Standard: Rational Method (Q = C × i × A / 3600) for storm water runoff estimation.</span></div>
<div class="assump-item"><span class="assump-bullet">•</span><span>Surface runoff coefficients based on selected maximum surface coefficients.</span></div>
<div class="assump-item"><span class="assump-bullet">•</span><span>Rainfall intensity is design parameter, defaults to 75 mm/hr.</span></div>
<div class="assump-item"><span class="assump-bullet">•</span><span>Flow conversion: 1 L/s = 15.85 GPM; 1 m² = 10.7639 ft².</span></div>
</div>
</div>
</div>
</div>
</div>
`;

window.CalculatorTemplates['greywater'] = `
<div class="page" id="page-greywater">
<div class="calc-header" style="background:linear-gradient(135deg,#f78f22,#d17914)">
<div class="calc-title">Grey Water / Reuse Calculator</div>
<div class="calc-std">Generation estimate · reuse potential · demand matching</div>
</div>
<div class="calc-desc green">Estimate grey water generation from showers, basins, and laundry; compare against
          reuse demand (toilet flushing, irrigation). Supports sustainable water design.</div>
<div class="scard">
<div class="scard-head">
<div class="scard-accent" style="background:var(--green)"></div>
<div class="scard-title">Grey Water Generation</div>
</div>
<div class="scard-body">
<div class="input-group">
<div class="input-label">Number of occupants</div><input class="inp" id="gw-occ" data-action-input="calcGreywater()" placeholder="e.g. 50" type="number"/>
</div>
<div class="input-group">
<div class="input-label">Shower / bath use <span class="input-unit">L/person/day</span></div><input class="inp" id="gw-shower" data-action-input="calcGreywater()" placeholder="e.g. 45" type="number"/>
</div>
<div class="input-group">
<div class="input-label">Washbasin use <span class="input-unit">L/person/day</span></div><input class="inp" id="gw-basin" data-action-input="calcGreywater()" placeholder="e.g. 10" type="number"/>
</div>
<div class="input-group">
<div class="input-label">Laundry <span class="input-unit">L/person/day</span></div><input class="inp" id="gw-laundry" data-action-input="calcGreywater()" placeholder="e.g. 15" type="number"/>
</div>
<div class="input-group">
<div class="input-label">Grey water treatment efficiency <span class="input-unit">%</span></div><input class="inp" id="gw-eff" data-action-input="calcGreywater()" placeholder="e.g. 85" type="number"/>
</div>
</div>
</div>
<div class="scard">
<div class="scard-head">
<div class="scard-accent" style="background:var(--green)"></div>
<div class="scard-title">Reuse Demand</div>
</div>
<div class="scard-body">
<div class="input-group">
<div class="input-label">WC flushing demand <span class="input-unit">L/person/day</span></div><input class="inp" id="gw-wc" data-action-input="calcGreywater()" placeholder="e.g. 30" type="number"/>
</div>
<div class="input-group">
<div class="input-label">Irrigation demand <span class="input-unit">L/day</span></div><input class="inp" id="gw-irrig" data-action-input="calcGreywater()" placeholder="e.g. 200" type="number"/>
</div>
</div>
</div>
<button class="calc-btn green" data-action-click="calcGreywater();showRes('gw-res')">⚡ Calculate Reuse
          Potential</button>
<div id="gw-res" style="display:none">
<div class="scard">
<div class="scard-head">
<div class="scard-accent" style="background:var(--green)"></div>
<div class="scard-title">Grey Water Balance</div>
</div>
<div class="scard-body">
<div class="res-row">
<div class="res-label">Total grey water generated</div>
<div class="res-val" id="gw-r-gen">-</div>
</div>
<div class="res-row">
<div class="res-label">Treated grey water available</div>
<div class="res-val" id="gw-r-treated">-</div>
</div>
<div class="res-row">
<div class="res-label">Total reuse demand</div>
<div class="res-val" id="gw-r-demand">-</div>
</div>
<div class="res-row">
<div class="res-label">Reuse coverage</div>
<div class="res-val primary" id="gw-r-coverage" style="color:var(--green)">-</div>
</div>
<div class="res-row">
<div class="res-label">Potable water saving</div>
<div class="res-val primary" id="gw-r-saving" style="color:var(--green)">-</div>
</div>
<div class="res-row">
<div class="res-label">Surplus / shortfall</div>
<div class="res-val" id="gw-r-balance">-</div>
</div>
</div>
</div>
</div>
</div>
`;

window.CalculatorTemplates['airflow-calc'] = `
<div class="page" id="page-airflow-calc">
<div class="calc-header">
<div class="calc-title">Airflow Calculator</div>
<div class="calc-std">CFM from TR · Sensible heat · Delta-T method</div>
</div>
<div class="calc-desc">Calculate required supply airflow from cooling capacity, sensible load, or temperature
          difference. Three independent methods - use whichever data you have.</div>
<div class="scard">
<div class="scard-head">
<div class="scard-accent" style="background:var(--blue)"></div>
<div class="scard-title">Method 1 - From Cooling Capacity (TR)</div>
</div>
<div class="scard-body">
<div class="input-group">
<div class="input-label">Cooling capacity <span class="input-unit" id="af-tr-unit">TR</span></div><input class="inp" id="af-tr" data-action-input="calcAirflow()" placeholder="e.g. 10" step="0.5" type="number"/>
</div>
<div class="input-group">
<div class="input-label">CFM per TR factor <span class="input-unit">CFM/TR</span></div><input class="inp" id="af-cfmtr" data-action-input="calcAirflow()" placeholder="e.g. 400" step="10" type="number"/>
<div style="font-size:11px;color:var(--muted);margin-top:4px">Typical: 350–450 CFM/TR. Use 400 for
                office, 450 for high-latent spaces.</div>
</div>
</div>
</div>
<div class="scard">
<div class="scard-head">
<div class="scard-accent" style="background:var(--blue)"></div>
<div class="scard-title">Method 2 - From Sensible Heat Load</div>
</div>
<div class="scard-body">
<div class="input-group">
<div class="input-label">Sensible heat load <span class="input-unit" id="af-sh-unit">BTU/hr</span></div>
<input class="inp" id="af-sh" data-action-input="calcAirflow()" placeholder="e.g. 40000" step="1000" type="number"/>
</div>
<div class="input-group">
<div class="input-label">Room temp (T_room) <span class="input-unit" id="af-tr-temp-unit">°F</span>
</div><input class="inp" id="af-troom" data-action-input="calcAirflow()" placeholder="e.g. 75" type="number"/>
</div>
<div class="input-group">
<div class="input-label">Supply air temp (T_supply) <span class="input-unit" id="af-ts-unit">°F</span>
</div><input class="inp" id="af-tsup" data-action-input="calcAirflow()" placeholder="e.g. 55" type="number"/>
</div>
</div>
</div>
<div class="scard">
<div class="scard-head">
<div class="scard-accent" style="background:var(--blue)"></div>
<div class="scard-title">Method 3 - From ΔT + Airflow (reverse)</div>
</div>
<div class="scard-body">
<div class="input-group">
<div class="input-label">Known airflow <span class="input-unit" id="af-q-unit">CFM</span></div><input class="inp" id="af-q" data-action-input="calcAirflow()" placeholder="e.g. 4000" step="100" type="number"/>
</div>
<div class="input-group">
<div class="input-label">ΔT (room − supply) <span class="input-unit" id="af-dt-unit">°F</span></div>
<input class="inp" id="af-dt" data-action-input="calcAirflow()" placeholder="e.g. 20" type="number"/>
</div>
</div>
</div>
<button class="calc-btn blue" data-action-click="calcAirflow();showRes('af-res')">⚡ Calculate Airflow</button>
<div id="af-res" style="display:none">
<div id="af-warn-area"></div>
<div class="scard">
<div class="scard-head">
<div class="scard-accent" style="background:var(--blue)"></div>
<div class="scard-title">Results</div>
</div>
<div class="scard-body">
<div class="res-row">
<div class="res-label">Method 1 - From TR</div>
<div class="res-val primary" id="af-r1">-</div>
</div>
<div class="res-row">
<div class="res-label">Method 2 - From sensible heat</div>
<div class="res-val primary" id="af-r2">-</div>
</div>
<div class="res-row">
<div class="res-label">Method 3 - Sensible capacity of airflow</div>
<div class="res-val" id="af-r3">-</div>
</div>
</div>
</div>
</div>
</div>
`;

window.CalculatorTemplates['cooling-coil'] = `
<div class="page" id="page-cooling-coil">
<div class="calc-header">
<div class="calc-title">Cooling Coil Calculator</div>
<div class="calc-std">Coil load · SHR · ADP · Bypass factor - simplified</div>
</div>
<div class="calc-desc">Calculate cooling coil performance from entering and leaving air conditions. Simplified
          psychrometric coil analysis. Not a substitute for full coil selection software.</div>
<div class="scard">
<div class="scard-head">
<div class="scard-accent" style="background:var(--blue)"></div>
<div class="scard-title">Entering Air Conditions (EAC)</div>
</div>
<div class="scard-body">
<div class="input-group">
<div class="input-label">Entering DBT <span class="input-unit" id="cc-edb-unit">°C</span></div><input class="inp" id="cc-edb" data-action-input="calcCoil()" placeholder="e.g. 80" type="number"/>
</div>
<div class="input-group">
<div class="input-label">Entering WBT <span class="input-unit" id="cc-ewb-unit">°C</span></div><input class="inp" id="cc-ewb" data-action-input="calcCoil()" placeholder="e.g. 67" type="number"/>
</div>
</div>
</div>
<div class="scard">
<div class="scard-head">
<div class="scard-accent" style="background:var(--blue)"></div>
<div class="scard-title">Leaving Air Conditions (LAC)</div>
</div>
<div class="scard-body">
<div class="input-group">
<div class="input-label">Leaving DBT <span class="input-unit" id="cc-ldb-unit">°C </span></div><input class="inp" id="cc-ldb" data-action-input="calcCoil()" placeholder="e.g. 55" type="number"/>
</div>
<div class="input-group">
<div class="input-label">Leaving WBT <span class="input-unit" id="cc-lwb-unit">°C</span></div><input class="inp" id="cc-lwb" data-action-input="calcCoil()" placeholder="e.g. 54" type="number"/>
</div>
</div>
</div>
<div class="scard">
<div class="scard-head">
<div class="scard-accent" style="background:var(--blue)"></div>
<div class="scard-title">Airflow</div>
</div>
<div class="scard-body">
<div class="input-group">
<div class="input-label">Supply airflow <span class="input-unit" id="cc-cfm-unit">CFM</span></div><input class="inp" id="cc-cfm" data-action-input="calcCoil()" placeholder="e.g. 4000" step="100" type="number"/>
</div>
</div>
</div>
<button class="calc-btn blue" data-action-click="calcCoil();showRes('cc-res')">⚡ Calculate Coil Performance</button>
<div id="cc-res" style="display:none">
<div id="cc-warn-area"></div>
<div class="scard">
<div class="scard-head">
<div class="scard-accent" style="background:var(--blue)"></div>
<div class="scard-title">Coil Performance</div>
</div>
<div class="scard-body">
<div class="res-row">
<div class="res-label">Total coil load</div>
<div class="res-val primary" id="cc-r-total">-</div>
</div>
<div class="res-row">
<div class="res-label">Sensible load</div>
<div class="res-val" id="cc-r-sens">-</div>
</div>
<div class="res-row">
<div class="res-label">Latent load</div>
<div class="res-val" id="cc-r-lat">-</div>
</div>
<div class="res-row">
<div class="res-label">SHR (sensible heat ratio)</div>
<div class="res-val primary" id="cc-r-shr">-</div>
</div>
<div class="res-row">
<div class="res-label">Approx. ADP (apparatus dew point)</div>
<div class="res-val" id="cc-r-adp">-</div>
</div>
<div class="res-row">
<div class="res-label">Bypass factor (BF)</div>
<div class="res-val" id="cc-r-bf">-</div>
</div>
<div class="res-row">
<div class="res-label">Cooling in TR</div>
<div class="res-val" id="cc-r-tr">-</div>
</div>
</div>
</div>
</div>
</div>
`;

window.CalculatorTemplates['fan-power'] = `
<div class="page" id="page-fan-power">
<div class="calc-header">
<div class="calc-title">Fan Power Calculator</div>
<div class="calc-std">Fluid power + shaft power + motor sizing</div>
</div>
<div class="calc-desc">Calculate fan shaft power from airflow and total static pressure, accounting for fan
          and motor efficiencies.</div>
<div class="scard">
<div class="scard-head">
<div class="scard-accent" style="background:var(--blue)"></div>
<div class="scard-title">Inputs</div>
</div>
<div class="scard-body">
<div class="input-group">
<div class="input-label">Airflow (Q) <span class="input-unit" id="fp2-q-unit">CFM</span></div><input class="inp" id="fp2-q" data-action-input="calcFanPower()" placeholder="e.g. 10000" step="100" type="number"/>
</div>
<div class="input-group">
<div class="input-label">Total static pressure <span class="input-unit" id="fp2-esp-unit">in w.g.</span>
</div><input class="inp" id="fp2-esp" data-action-input="calcFanPower()" placeholder="e.g. 2.0" step="0.1" type="number"/>
</div>
<div class="input-group">
<div class="input-label">Fan total efficiency <span class="input-unit">%</span></div><input class="inp" id="fp2-fan-eff" data-action-input="calcFanPower()" placeholder="e.g. 70" step="1" type="number"/>
</div>
<div class="input-group">
<div class="input-label">Motor efficiency <span class="input-unit">%</span></div><input class="inp" id="fp2-mot-eff" data-action-input="calcFanPower()" placeholder="e.g. 90" step="1" type="number"/>
</div>
<div class="input-group">
<div class="input-label">Drive transmission efficiency <span class="input-unit">%</span></div><input class="inp" id="fp2-drv-eff" data-action-input="calcFanPower()" placeholder="e.g. 97" step="1" type="number"/>
<div style="font-size:11px;color:var(--muted);margin-top:4px">Direct drive: 100% · Belt drive: 95–98%
              </div>
</div>
</div>
</div>
<button class="calc-btn blue" data-action-click="calcFanPower();showRes('fp2-res')">⚡ Calculate Fan Power</button>
<div id="fp2-res" style="display:none">
<div id="fp2-warn-area"></div>
<div class="scard">
<div class="scard-head">
<div class="scard-accent" style="background:var(--blue)"></div>
<div class="scard-title">Fan Power Results</div>
</div>
<div class="scard-body">
<div class="res-row">
<div class="res-label">Air (fluid) power</div>
<div class="res-val" id="fp2-r-air">-</div>
</div>
<div class="res-row">
<div class="res-label">Fan shaft power</div>
<div class="res-val primary" id="fp2-r-shaft">-</div>
</div>
<div class="res-row">
<div class="res-label">Motor input power</div>
<div class="res-val primary" id="fp2-r-motor">-</div>
</div>
<div class="res-row">
<div class="res-label">Suggested motor size</div>
<div class="res-val" id="fp2-r-hp">-</div>
</div>
<div class="res-row">
<div class="res-label">Overall system efficiency</div>
<div class="res-val" id="fp2-r-overall">-</div>
</div>
</div>
</div>
</div>
</div>
`;

window.CalculatorTemplates['fan-laws'] = `
<div class="page" id="page-fan-laws">
<div class="calc-header">
<div class="calc-title">Fan Laws Calculator</div>
<div class="calc-std">Affinity laws - speed change effect on flow, pressure, power</div>
</div>
<div class="calc-desc">Apply fan affinity laws for VFD speed changes. Flow ∝ N, Pressure ∝ N², Power ∝ N³.
          Essential for energy optimisation and VAV system design.</div>
<div class="scard">
<div class="scard-head">
<div class="scard-accent" style="background:var(--blue)"></div>
<div class="scard-title">Original Operating Point</div>
</div>
<div class="scard-body">
<div class="input-group">
<div class="input-label">Original airflow (Q₁) <span class="input-unit" id="fl-q1-unit">CFM</span></div>
<input class="inp" id="fl-q1" data-action-input="calcFanLaws()" placeholder="e.g. 10000" step="100" type="number"/>
</div>
<div class="input-group">
<div class="input-label">Original static pressure (P₁) <span class="input-unit" id="fl-p1-unit">in
                  w.g.</span></div><input class="inp" id="fl-p1" data-action-input="calcFanLaws()" placeholder="e.g. 2.0" step="0.1" type="number"/>
</div>
<div class="input-group">
<div class="input-label">Original fan power (W₁) <span class="input-unit">kW</span></div><input class="inp" id="fl-w1" data-action-input="calcFanLaws()" placeholder="e.g. 5.5" step="0.1" type="number"/>
</div>
</div>
</div>
<div class="scard">
<div class="scard-head">
<div class="scard-accent" style="background:var(--blue)"></div>
<div class="scard-title">New Speed</div>
</div>
<div class="scard-body">
<div class="input-group">
<div class="input-label">New speed as % of original <span class="input-unit">%</span></div><input class="inp" id="fl-speed" max="110" min="10" data-action-input="calcFanLaws()" placeholder="e.g. 80" step="5" type="number"/>
<div style="font-size:11px;color:var(--muted);margin-top:4px">VFD turndown: typically 40–100% of design
                speed</div>
</div>
</div>
</div>
<button class="calc-btn blue" data-action-click="calcFanLaws();showRes('fl-res')">⚡ Apply Fan Laws</button>
<div id="fl-res" style="display:none">
<div class="scard">
<div class="scard-head">
<div class="scard-accent" style="background:var(--blue)"></div>
<div class="scard-title">New Operating Point</div>
</div>
<div class="scard-body">
<div class="res-row">
<div class="res-label">Speed ratio (N₂/N₁)</div>
<div class="res-val" id="fl-r-ratio">-</div>
</div>
<div class="res-row">
<div class="res-label">New airflow (Q₂ = Q₁ × N)</div>
<div class="res-val primary" id="fl-r-q2">-</div>
</div>
<div class="res-row">
<div class="res-label">New pressure (P₂ = P₁ × N²)</div>
<div class="res-val primary" id="fl-r-p2">-</div>
</div>
<div class="res-row">
<div class="res-label">New power (W₂ = W₁ × N³)</div>
<div class="res-val primary" id="fl-r-w2">-</div>
</div>
<div class="res-row">
<div class="res-label">Power saving vs original</div>
<div class="res-val" id="fl-r-saving">-</div>
</div>
<div class="res-row">
<div class="res-label">Power saving (%)</div>
<div class="res-val" id="fl-r-savepct">-</div>
</div>
</div>
</div>
<div id="fl-warn-area"></div>
</div>
</div>
`;

window.CalculatorTemplates['fresh-air'] = `
<div class="page" id="page-fresh-air">
<div class="calc-header">
<div class="calc-title">Fresh Air Requirement</div>
<div class="calc-std">ASHRAE 62.1 - people + area components</div>
</div>
<div class="calc-desc">Calculate minimum outdoor air requirement from occupancy and floor area. Combines
          people-based and area-based components per ASHRAE 62.1 Ventilation Rate Procedure.</div>
<div class="scard">
<div class="scard-head">
<div class="scard-accent" style="background:var(--blue)"></div>
<div class="scard-title">Space Details</div>
</div>
<div class="scard-body">
<div class="input-group">
<div class="input-label">Space type</div>
<select class="inp inp-select" id="fa-space" data-action-change="calcFreshAir()">
<option value="5,0.06">Office - Open Plan (5 CFM/p, 0.06 CFM/ft²)</option>
<option value="5,0.06">Conference Room (5 CFM/p, 0.06 CFM/ft²)</option>
<option value="10,0.12">Classroom (10 CFM/p, 0.12 CFM/ft²)</option>
<option value="7.5,0.12">Retail (7.5 CFM/p, 0.12 CFM/ft²)</option>
<option value="7.5,0.18">Dining Area (7.5 CFM/p, 0.18 CFM/ft²)</option>
<option value="20,0.06">Gym / Fitness (20 CFM/p, 0.06 CFM/ft²)</option>
<option value="7.5,0.06">Lobby (7.5 CFM/p, 0.06 CFM/ft²)</option>
<option value="0,0.06">Corridor / Storage (0.06 CFM/ft²)</option>
<option value="25,0.06">Hospital - Patient Room (25 CFM/p)</option>
</select>
</div>
<div class="input-group">
<div class="input-label">Floor area <span class="input-unit" id="fa-area-unit">ft²</span></div><input class="inp" id="fa-area" data-action-input="calcFreshAir()" placeholder="e.g. 2000" type="number"/>
</div>
<div class="input-group">
<div class="input-label">Design occupancy <span class="input-unit">people</span></div><input class="inp" id="fa-occ" data-action-input="calcFreshAir()" placeholder="e.g. 40" type="number"/>
</div>
<div class="input-group">
<div class="input-label">Number of zones / AHUs</div><input class="inp" id="fa-zones" min="1" data-action-input="calcFreshAir()" placeholder="e.g. 1" type="number"/>
</div>
<div class="input-group">
<div class="input-label">Ez - Zone air distribution effectiveness</div>
<select class="inp inp-select" id="fa-ez" data-action-change="calcFreshAir()">
<option value="1.0">1.0 - Ceiling supply / ceiling return</option>
<option value="1.2">1.2 - Ceiling supply / floor return</option>
<option value="0.8">0.8 - Floor supply / ceiling return</option>
<option value="0.7">0.7 - Ceiling supply within 4.5ft of floor</option>
</select>
</div>
</div>
</div>
<button class="calc-btn blue" data-action-click="calcFreshAir();showRes('fa-res')">⚡ Calculate Fresh Air</button>
<div id="fa-res" style="display:none">
<div class="scard">
<div class="scard-head">
<div class="scard-accent" style="background:var(--blue)"></div>
<div class="scard-title">Fresh Air Requirements</div>
</div>
<div class="scard-body">
<div class="res-row">
<div class="res-label">People component (Rp × occupants)</div>
<div class="res-val" id="fa-r-people">-</div>
</div>
<div class="res-row">
<div class="res-label">Area component (Ra × area)</div>
<div class="res-val" id="fa-r-area">-</div>
</div>
<div class="res-row">
<div class="res-label">Breathing zone OA rate (Vbz)</div>
<div class="res-val" id="fa-r-vbz">-</div>
</div>
<div class="res-row">
<div class="res-label">Zone ventilation rate (Vz = Vbz/Ez)</div>
<div class="res-val primary" id="fa-r-vz">-</div>
</div>
<div class="res-row">
<div class="res-label">Per person</div>
<div class="res-val" id="fa-r-perperson">-</div>
</div>
<div class="res-row">
<div class="res-label">Per m² / ft²</div>
<div class="res-val" id="fa-r-perarea">-</div>
</div>
</div>
</div>
<div id="fa-warn-area"></div>
</div>
</div>
`;

window.CalculatorTemplates['fresh-air-load'] = `
<div class="page two-col-page" id="page-fresh-air-load">
<div class="calc-header">
<div class="two-col-header-left">
<div class="calc-title">❄️ Fresh Air Cooling Load</div>
<div class="calc-std">HVAC Psychrometric Load Analysis (101 kPa Atmospheric Pressure)</div>
</div>
<div class="two-col-header-badge">❄️ HVAC · Load &amp; Ventilation</div>
</div>
<div class="calc-desc">
          Calculate the Sensible, Latent, and Total cooling loads introduced by fresh outdoor air entering a cooling
          coil.
        </div>
<div class="calc-two-col">
<!-- Left Column (Inputs) -->
<div class="calc-col-left">
<div class="calc-col-panel">
<div class="calc-col-panel-head">
<div class="calc-col-panel-accent" style="background:var(--blue)"></div>
<div class="calc-col-panel-title">Entering Coil Air Properties</div>
</div>
<div class="calc-col-panel-body">
<div class="input-group">
<div class="input-label">Dry Bulb Temperature <span class="input-unit" id="fal-dbt-in-unit">°C</span>
</div>
<input class="inp" id="fal-dbt-in" data-action-input="updateLiveRatios()" placeholder="e.g. 35" step="0.1" type="number"/>
</div>
<div class="input-group">
<div class="input-label">Wet Bulb Temperature <span class="input-unit" id="fal-wbt-in-unit">°C</span>
</div>
<input class="inp" id="fal-wbt-in" data-action-input="updateLiveRatios()" placeholder="e.g. 28" step="0.1" type="number"/>
</div>
<div style="font-size:11.5px; color:var(--muted); padding:4px 0 8px; font-family:var(--font);">
                  Calculated Entering Hum. Ratio: <strong id="fal-w-in-val" style="color:var(--blue)">-</strong>
</div>
</div>
</div>
<div class="calc-col-panel">
<div class="calc-col-panel-head">
<div class="calc-col-panel-accent" style="background:var(--blue)"></div>
<div class="calc-col-panel-title">Leaving Coil Air Properties</div>
</div>
<div class="calc-col-panel-body">
<div class="input-group">
<div class="input-label">Dry Bulb Temperature <span class="input-unit" id="fal-dbt-out-unit">°C</span>
</div>
<input class="inp" id="fal-dbt-out" data-action-input="updateLiveRatios()" placeholder="e.g. 13" step="0.1" type="number"/>
</div>
<div class="input-group">
<div class="input-label">Wet Bulb Temperature <span class="input-unit" id="fal-wbt-out-unit">°C</span>
</div>
<input class="inp" id="fal-wbt-out" data-action-input="updateLiveRatios()" placeholder="e.g. 12.5" step="0.1" type="number"/>
</div>
<div style="font-size:11.5px; color:var(--muted); padding:4px 0 8px; font-family:var(--font);">
                  Calculated Leaving Hum. Ratio: <strong id="fal-w-out-val" style="color:var(--blue)">-</strong>
</div>
</div>
</div>
<div class="calc-col-panel">
<div class="calc-col-panel-head">
<div class="calc-col-panel-accent" style="background:var(--brand)"></div>
<div class="calc-col-panel-title">Airflow Rate</div>
</div>
<div class="calc-col-panel-body">
<div class="input-group">
<div class="input-label">Total Fresh Air Flow Rate <span class="input-unit" id="fal-flow-unit">m³/s</span></div>
<input class="inp" id="fal-flow" data-action-input="calcFreshAirLoad()" placeholder="e.g. 1.0" step="0.01" type="number"/>
</div>
</div>
</div>
<button class="calc-btn blue" data-action-click="calcFreshAirLoad();showRes('fresh-air-load-res')">⚡ Calculate
              Load</button>
</div>
<!-- Right Column (Results) -->
<div class="calc-col-right">
<!-- Placeholder -->
<div class="result-placeholder" id="fresh-air-load-res-placeholder">
<div class="result-placeholder-icon">❄️</div>
<div class="result-placeholder-text">
                Enter coil air conditions and airflow rate,<br/>then click <strong>Calculate Load</strong> to view
                results.
              </div>
</div>
<!-- Results container -->
<div id="fresh-air-load-res" style="display:none">
<div class="calc-col-panel">
<div class="res-action-bar">
<button class="res-action-btn" id="fal-save-btn" data-action-click="saveFromCache('fresh-air-load-res')">💾 Save
                    Calculation</button>
<button class="res-action-btn" id="fal-pdf-btn" data-action-click="pdfFromCache('fresh-air-load-res')">📄 Export
                    PDF</button>
</div>
<div class="calc-col-panel-head">
<div class="calc-col-panel-accent" style="background:var(--blue)"></div>
<div class="calc-col-panel-title">Cooling Load Summary</div>
</div>
<div class="calc-col-panel-body" style="padding-bottom:4px">
<div class="res-row">
<div class="res-label">Sensible Cooling Load</div>
<div class="res-val primary" id="fal-r-sens" style="color:#f78f22">-</div>
</div>
<div class="res-row">
<div class="res-label">Latent Cooling Load</div>
<div class="res-val primary" id="fal-r-lat" style="color:#f78f22">-</div>
</div>
<div class="res-row">
<div class="res-label">Total Cooling Load</div>
<div class="res-val primary" id="fal-r-tot" style="font-weight:800">-</div>
</div>
<div class="res-row">
<div class="res-label">Cooling Capacity</div>
<div class="res-val primary" id="fal-r-tons" style="color:var(--brand)">-</div>
</div>
<div style="border-top:1px dashed var(--border); margin:12px 0 8px;"></div>
<div class="res-row">
<div class="res-label">Entering Humidity Ratio (W<sub>in</sub>)</div>
<div class="res-val" id="fal-r-win">-</div>
</div>
<div class="res-row">
<div class="res-label">Leaving Humidity Ratio (W<sub>out</sub>)</div>
<div class="res-val" id="fal-r-wout">-</div>
</div>
<div class="res-row">
<div class="res-label">Humidity Ratio Difference (ΔW)</div>
<div class="res-val" id="fal-r-wdiff" style="font-weight:700">-</div>
</div>
</div>
</div>
<!-- Chart SVG goes here -->
<div id="fresh-air-load-chart"></div>
<!-- Alert area -->
<div id="fal-warn-area"></div>
</div>
</div>
</div>
</div>
`;

window.CalculatorTemplates['smoke-extract'] = `
<div class="page" id="page-smoke-extract">
<div class="calc-header" style="background:linear-gradient(135deg,#f78f22,#d17914)">
<div class="calc-title">Smoke Extract Fan Calculation</div>
<div class="calc-std">GF Entrance Corridor Smoke Extract &amp; Fan Head Sizing</div>
</div>
<div class="calc-desc" style="background:#EEF4FF;border-color:rgba(0,102,204,0.2)">
          Calculate the smoke extract fan flow capacity and head requirement for the Ground Floor Entrance Corridor
          based on space dimensions and ducting layouts.
        </div>
<!-- ── CALCULATION STORAGE ACTIONS ── -->
<div class="calc-storage-bar" style="display:flex; gap:12px; margin-bottom:18px; background:var(--card); border:1px solid var(--border); border-radius:var(--r-md); padding:10px 14px; align-items:center;">
<span style="font-size:12px; font-weight:700; color:var(--text-sec); display:flex; align-items:center; gap:6px;">
            💾 Calculation Files:
          </span>
<div style="display:flex; gap:8px; margin-left:auto;">
<button class="calc-btn" data-action-click="openCustomSaveModal('smoke-extract')" style="margin:0; width:auto; padding:8px 14px; font-size:11.5px; font-weight:700; border-radius:6px; display:flex; align-items:center; gap:6px; background:var(--blue); color:#fff; border:none; cursor:pointer; transition:all 0.2s;" type="button">
              💾 Save Current
            </button>
<button class="calc-btn" data-action-click="openCustomLoadModal('smoke-extract')" data-action-mouseout="this.style.background='rgba(59, 130, 246, 0.08)'" data-action-mouseover="this.style.background='rgba(59, 130, 246, 0.15)'" style="margin:0; width:auto; padding:7px 12px; font-size:11.5px; font-weight:700; border-radius:6px; display:flex; align-items:center; gap:6px; background:rgba(59, 130, 246, 0.08); color:var(--blue); border:1px solid rgba(59, 130, 246, 0.3); cursor:pointer; transition:all 0.2s;" type="button">
              📂 Load Saved
            </button>
</div>
</div>
<div class="scard">
<div class="scard-head">
<div class="scard-accent" style="background:var(--blue)"></div>
<div class="scard-title">Corridor Parameters</div>
</div>
<div class="scard-body">
<div class="input-group">
<div class="input-label">Area of Corridor <span class="input-unit">m²</span></div>
<input class="inp" id="se-corridor-area" data-action-input="calcSmokeExtract()" placeholder="e.g. 50" step="0.1" type="number"/>
</div>
<div class="input-group">
<div class="input-label">Average Height of Corridor <span class="input-unit">m</span></div>
<input class="inp" id="se-corridor-height" data-action-input="calcSmokeExtract()" placeholder="e.g. 3" step="0.1" type="number"/>
</div>
<div class="input-group">
<div class="input-label">Volume of the Corridor <span class="input-unit">m³</span></div>
<input class="inp" id="se-corridor-volume" placeholder="Calculated automatically (A × h)" readonly="" style="background:#f3f4f6; color:#4b5563;" type="number"/>
</div>
<div class="input-group">
<div class="input-label">Air Changes per Hour (In Case of Fire) <span class="input-unit">/hr</span></div>
<input class="inp" id="se-acph" data-action-input="calcSmokeExtract()" placeholder="e.g. 10" step="1" type="number"/>
</div>
<div class="input-group">
<div class="input-label">Quantity Of Fans <span class="input-unit">No.</span></div>
<input class="inp" id="se-fan-qty" min="1" data-action-input="calcSmokeExtract()" placeholder="e.g. 2" step="1" type="number"/>
</div>
<div class="input-group">
<div class="input-label">Air Flow Rate for Each Fan <span class="input-unit">L/s</span></div>
<input class="inp" id="se-fan-flow-rate" placeholder="Calculated (Ceiling 5 L/s)" readonly="" style="background:#f3f4f6; color:#4b5563; font-weight:700;" type="number"/>
</div>
</div>
</div>
<div class="scard" id="se-head-card">
<div class="scard-head">
<div class="scard-accent" style="background:var(--blue)"></div>
<div class="scard-title">Fan Head Requirement</div>
</div>
<div class="scard-body">
<div class="input-group">
<div class="input-label">Length of Ducting <span class="input-unit">m</span></div>
<input class="inp" id="se-smoke-length-of-ducting" placeholder="e.g. 30" style="display:none" type="number"/>
<input class="inp" id="se-smoke-duct-length" data-action-input="calcSmokeExtract()" placeholder="e.g. 30" step="0.1" type="number"/>
</div>
<div class="input-group">
<div class="input-label">Equivalent Length of Fittings + Accessories <span class="input-unit">m</span>
</div>
<input class="inp" id="se-smoke-duct-fittings" placeholder="Length × 0.6" readonly="" style="background:#f3f4f6; color:#4b5563;" type="number"/>
</div>
<div class="input-group">
<div class="input-label">Total Equivalent Length <span class="input-unit">m</span></div>
<input class="inp" id="se-smoke-equivalent-length-of-ducting" placeholder="Length + Fittings" style="display:none" type="number"/>
<input class="inp" id="se-smoke-duct-eq-length" placeholder="Length + Fittings" readonly="" style="background:#f3f4f6; color:#4b5563;" type="number"/>
</div>
<div class="input-group">
<div class="input-label">Frictional Factor <span class="input-unit">Pa/m</span></div>
<input class="inp" id="se-smoke-duct-friction-factor" data-action-input="calcSmokeExtract()" placeholder="e.g. 1.2" step="0.01" type="number"/>
</div>
<div class="input-group">
<div class="input-label">Head Loss in Ducting <span class="input-unit">Pa</span></div>
<input class="inp" id="se-smoke-frictional-losses-in-ducting" placeholder="Frictional Factor × Eq Length" style="display:none" type="number"/>
<input class="inp" id="se-smoke-duct-friction-losses" placeholder="Frictional Factor × Eq Length" readonly="" style="background:#f3f4f6; color:#4b5563;" type="number"/>
</div>
<div class="input-group">
<div class="input-label">Pressure Drop in Louvers + Grille <span class="input-unit">Pa</span></div>
<input class="inp" id="se-smoke-losses-louvers" data-action-input="calcSmokeExtract()" placeholder="e.g. 50" step="1" type="number"/>
</div>
<div class="input-group">
<div class="input-label">Pressure Drop in Fan <span class="input-unit">Pa</span></div>
<input class="inp" id="se-smoke-losses-fan" data-action-input="calcSmokeExtract()" placeholder="e.g. 150" step="1" type="number"/>
</div>
<div class="input-group">
<div class="input-label">Head for the Fan <span class="input-unit">Pa</span></div>
<input class="inp" id="se-smoke-fan-head" placeholder="Rounded to nearest 10 Pa" readonly="" style="background:#f3f4f6; color:#4b5563; font-weight:700;" type="number"/>
</div>
</div>
</div>
<div class="scard" id="se-motor-card">
<div class="scard-head">
<div class="scard-accent" style="background:var(--blue)"></div>
<div class="scard-title">Calculations For Motor Selection</div>
</div>
<div class="scard-body">
<div class="input-group">
<div class="input-label">Flow of each fan <span class="input-unit">m³/s</span></div>
<input class="inp" id="se-motor-flow" placeholder="Calculated (Q in m³/s)" readonly="" style="background:#f3f4f6; color:#4b5563;" type="number"/>
</div>
<div class="input-group">
<div class="input-label">Total Static of the Fan <span class="input-unit">Pa</span></div>
<input class="inp" id="se-motor-static" placeholder="Calculated (Head in Pa)" readonly="" style="background:#f3f4f6; color:#4b5563;" type="number"/>
</div>
<div class="input-group">
<div class="input-label">Efficiency of Motor <span class="input-unit">%</span></div>
<input class="inp" id="se-motor-eff-motor" data-action-input="calcSmokeExtract()" placeholder="e.g. 90" step="1" type="number" value="90"/>
</div>
<div class="input-group">
<div class="input-label">Efficiency of fan <span class="input-unit">%</span></div>
<input class="inp" id="se-motor-eff-fan" data-action-input="calcSmokeExtract()" placeholder="e.g. 75" step="1" type="number" value="75"/>
</div>
<div class="input-group">
<div class="input-label">Power required for each fan <span class="input-unit">kW</span></div>
<input class="inp" id="se-motor-power-each" placeholder="Calculated (Ceiling of nearest round off)" readonly="" style="background:#f3f4f6; color:#4b5563; font-weight:700;" type="number"/>
</div>
<div class="input-group">
<div class="input-label">Number Of Fans <span class="input-unit">No.</span></div>
<input class="inp" id="se-motor-fan-qty" data-action-input="this.dataset.userEdited='true'; calcSmokeExtract()" placeholder="e.g. 2" step="1" type="number"/>
</div>
<div class="input-group">
<div class="input-label">Total Motor Power <span class="input-unit">kW</span></div>
<input class="inp" id="se-motor-total-power" placeholder="Calculated (Power × 1.1 × Qty)" readonly="" style="background:#f3f4f6; color:#4b5563; font-weight:700;" type="number"/>
</div>
</div>
</div>
<button class="calc-btn blue" data-action-click="calcSmokeExtract();showRes('se-res')">⚡ Calculate Sizing</button>
<div id="se-res" style="display:none">
<!-- Right side remains empty for now since no values are to be shown on calculate yet -->
</div>
</div>
`;

window.CalculatorTemplates['chiller-cop'] = `
<div class="page" id="page-chiller-cop">
<div class="calc-header">
<div class="calc-title">Chiller COP / Efficiency</div>
<div class="calc-std">COP · kW/TR · IPLV basis</div>
</div>
<div class="calc-desc">Calculate chiller coefficient of performance and specific energy consumption. Compare
          against industry benchmarks for efficiency rating.</div>
<div class="scard">
<div class="scard-head">
<div class="scard-accent" style="background:var(--blue)"></div>
<div class="scard-title">Inputs</div>
</div>
<div class="scard-body">
<div class="input-group">
<div class="input-label">Cooling load delivered <span class="input-unit" id="cop-load-unit">TR</span>
</div><input class="inp" id="cop-load" data-action-input="calcChillerCOP()" placeholder="e.g. 200" step="5" type="number"/>
</div>
<div class="input-group">
<div class="input-label">Compressor power input <span class="input-unit">kW</span></div><input class="inp" id="cop-power" data-action-input="calcChillerCOP()" placeholder="e.g. 130" step="1" type="number"/>
</div>
<div class="input-group">
<div class="input-label">CHW supply temperature <span class="input-unit" id="cop-chws-unit">°F</span>
</div><input class="inp" id="cop-chws" data-action-input="calcChillerCOP()" placeholder="e.g. 44" type="number"/>
</div>
<div class="input-group">
<div class="input-label">CHW return temperature <span class="input-unit" id="cop-chwr-unit">°F</span>
</div><input class="inp" id="cop-chwr" data-action-input="calcChillerCOP()" placeholder="e.g. 54" type="number"/>
</div>
<div class="input-group">
<div class="input-label">CW inlet temperature <span class="input-unit" id="cop-cwi-unit">°F</span></div>
<input class="inp" id="cop-cwi" data-action-input="calcChillerCOP()" placeholder="e.g. 85" type="number"/>
</div>
</div>
</div>
<button class="calc-btn blue" data-action-click="calcChillerCOP();showRes('cop-res')">⚡ Calculate Efficiency</button>
<div id="cop-res" style="display:none">
<div id="cop-warn-area"></div>
<div class="scard">
<div class="scard-head">
<div class="scard-accent" style="background:var(--blue)"></div>
<div class="scard-title">Chiller Efficiency</div>
</div>
<div class="scard-body">
<div class="res-row">
<div class="res-label">COP</div>
<div class="res-val primary" id="cop-r-cop">-</div>
</div>
<div class="res-row">
<div class="res-label">kW/TR</div>
<div class="res-val primary" id="cop-r-kwtr">-</div>
</div>
<div class="res-row">
<div class="res-label">EER (BTU/Wh)</div>
<div class="res-val" id="cop-r-eer">-</div>
</div>
<div class="res-row">
<div class="res-label">Efficiency rating</div>
<div class="res-val" id="cop-r-rating">-</div>
</div>
<div class="res-row">
<div class="res-label">Heat rejection (condenser)</div>
<div class="res-val" id="cop-r-reject">-</div>
</div>
<div class="res-row">
<div class="res-label">CHW ΔT</div>
<div class="res-val" id="cop-r-dt">-</div>
</div>
</div>
</div>
</div>
</div>
`;

window.CalculatorTemplates['cooling-tower'] = `
<div class="page" id="page-cooling-tower">
<div class="calc-header">
<div class="calc-title">Cooling Tower Calculator</div>
<div class="calc-std">Heat rejection · Range · Approach - simplified</div>
</div>
<div class="calc-desc">Estimate cooling tower water flow and capacity from heat rejection load, range, and
          approach. Simplified model - not a full tower simulation.</div>
<div class="scard">
<div class="scard-head">
<div class="scard-accent" style="background:var(--blue)"></div>
<div class="scard-title">Inputs</div>
</div>
<div class="scard-body">
<div class="input-group">
<div class="input-label">Heat rejection load <span class="input-unit" id="ct-load-unit">TR</span></div>
<input class="inp" id="ct-load" data-action-input="calcCoolingTower()" placeholder="e.g. 250" step="5" type="number"/>
</div>
<div class="input-group">
<div class="input-label">CW inlet to tower (hot) <span class="input-unit" id="ct-hot-unit">°F</span>
</div><input class="inp" id="ct-hot" data-action-input="calcCoolingTower()" placeholder="e.g. 95" type="number"/>
</div>
<div class="input-group">
<div class="input-label">CW outlet from tower (cold) <span class="input-unit" id="ct-cold-unit">°F</span>
</div><input class="inp" id="ct-cold" data-action-input="calcCoolingTower()" placeholder="e.g. 85" type="number"/>
</div>
<div class="input-group">
<div class="input-label">Ambient wet bulb temperature <span class="input-unit" id="ct-wb-unit">°F</span>
</div><input class="inp" id="ct-wb" data-action-input="calcCoolingTower()" placeholder="e.g. 78" type="number"/>
</div>
<div class="input-group">
<div class="input-label">Cycles of concentration (CoC)</div><input class="inp" id="ct-coc" min="1" data-action-input="calcCoolingTower()" placeholder="e.g. 4" step="0.5" type="number"/>
<div style="font-size:11px;color:var(--muted);margin-top:4px">Typical: 3–6 cycles depending on water
                quality</div>
</div>
</div>
</div>
<button class="calc-btn blue" data-action-click="calcCoolingTower();showRes('ct-res')">⚡ Calculate Cooling
          Tower</button>
<div id="ct-res" style="display:none">
<div id="ct-warn-area"></div>
<div class="scard">
<div class="scard-head">
<div class="scard-accent" style="background:var(--blue)"></div>
<div class="scard-title">Cooling Tower Results</div>
</div>
<div class="scard-body">
<div class="res-row">
<div class="res-label">Range (T_hot − T_cold)</div>
<div class="res-val" id="ct-r-range">-</div>
</div>
<div class="res-row">
<div class="res-label">Approach (T_cold − T_wb)</div>
<div class="res-val" id="ct-r-approach">-</div>
</div>
<div class="res-row">
<div class="res-label">Circulating water flow</div>
<div class="res-val primary" id="ct-r-flow">-</div>
</div>
<div class="res-row">
<div class="res-label">Evaporation losses</div>
<div class="res-val" id="ct-r-evap">-</div>
</div>
<div class="res-row">
<div class="res-label">Blowdown required</div>
<div class="res-val" id="ct-r-blowdown">-</div>
</div>
<div class="res-row">
<div class="res-label">Makeup water required</div>
<div class="res-val" id="ct-r-makeup">-</div>
</div>
<div class="res-row">
<div class="res-label">Heat rejection load (kW)</div>
<div class="res-val" id="ct-r-kw">-</div>
</div>
</div>
</div>
</div>
</div>
`;

window.CalculatorTemplates['ref-pipe'] = `
<div class="page" id="page-ref-pipe">
<div class="calc-header">
<div class="calc-title">Refrigerant Pipe Sizing</div>
<div class="calc-std">Velocity-based estimation - suction / liquid / discharge lines</div>
</div>
<div class="calc-desc" style="background:#FEF3C7;border-color:rgba(217,119,6,0.25)"><strong>Estimation tool
            only.</strong> Based on recommended velocity ranges. Always verify with refrigerant-specific pressure drop
          calculations and manufacturer data. Not a substitute for full refrigerant system design.</div>
<div class="scard">
<div class="scard-head">
<div class="scard-accent" style="background:var(--blue)"></div>
<div class="scard-title">Inputs</div>
</div>
<div class="scard-body">
<div class="input-group">
<div class="input-label">Cooling capacity <span class="input-unit" id="rp-cap-unit">TR</span></div>
<input class="inp" id="rp-cap" data-action-input="calcRefPipe()" placeholder="e.g. 10" step="0.5" type="number"/>
</div>
<div class="input-group">
<div class="input-label">Refrigerant type</div>
<select class="inp inp-select" id="rp-ref" data-action-change="calcRefPipe()">
<option value="R410A">R-410A</option>
<option value="R22">R-22</option>
<option value="R32">R-32</option>
<option value="R134a">R-134a</option>
<option value="R407C">R-407C</option>
</select>
</div>
<div class="input-group">
<div class="input-label">Line type</div>
<div class="chip-row">
<div class="chip sel" data-action-click="setRefLine(this,'suction')">Suction</div>
<div class="chip" data-action-click="setRefLine(this,'liquid')">Liquid</div>
<div class="chip" data-action-click="setRefLine(this,'discharge')">Discharge</div>
</div>
</div>
</div>
</div>
<button class="calc-btn blue" data-action-click="calcRefPipe();showRes('rp-res')">⚡ Size Refrigerant Pipe</button>
<div id="rp-res" style="display:none">
<div id="rp-warn-area"></div>
<div class="scard">
<div class="scard-head">
<div class="scard-accent" style="background:var(--blue)"></div>
<div class="scard-title">Pipe Size Estimate</div>
</div>
<div class="scard-body">
<div class="res-row">
<div class="res-label">Line type</div>
<div class="res-val" id="rp-r-type">-</div>
</div>
<div class="res-row">
<div class="res-label">Recommended pipe OD</div>
<div class="res-val primary" id="rp-r-od">-</div>
</div>
<div class="res-row">
<div class="res-label">Velocity range (typical)</div>
<div class="res-val" id="rp-r-vel">-</div>
</div>
<div class="res-row">
<div class="res-label">Basis</div>
<div class="res-val" id="rp-r-basis">-</div>
</div>
</div>
</div>
</div>
</div>
`;

window.CalculatorTemplates['condensate'] = `
<div class="page" id="page-condensate">
<div class="calc-header">
<div class="calc-title">Condensate Drain Sizing</div>
<div class="calc-std">Condensate flow rate · Pipe size · Slope</div>
</div>
<div class="calc-desc">Estimate condensate generation rate from latent cooling load and determine appropriate
          drain pipe size and slope.</div>
<div class="scard">
<div class="scard-head">
<div class="scard-accent" style="background:var(--blue)"></div>
<div class="scard-title">Inputs</div>
</div>
<div class="scard-body">
<div class="input-group">
<div class="input-label">Input method</div>
<div class="chip-row">
<div class="chip sel" data-action-click="setCondMode(this,'tr')">From TR (cooling capacity)</div>
<div class="chip" data-action-click="setCondMode(this,'lat')">From latent load</div>
</div>
</div>
<div class="input-group" id="cond-tr-row" style="margin-top:12px">
<div class="input-label">Cooling capacity <span class="input-unit" id="cond-tr-unit">TR</span></div>
<input class="inp" id="cond-tr" data-action-input="calcCondensate()" placeholder="e.g. 10" step="0.5" type="number"/>
</div>
<div class="input-group" id="cond-lat-row" style="display:none">
<div class="input-label">Latent load <span class="input-unit" id="cond-lat-unit">BTU/hr</span></div>
<input class="inp" id="cond-lat" data-action-input="calcCondensate()" placeholder="e.g. 12000" step="500" type="number"/>
</div>
<div class="input-group">
<div class="input-label">Number of AHU / FCU units</div><input class="inp" id="cond-units" min="1" data-action-input="calcCondensate()" placeholder="e.g. 1" type="number"/>
</div>
<div class="input-group">
<div class="input-label">Drain length <span class="input-unit" id="cond-len-unit">ft</span></div><input class="inp" id="cond-len" data-action-input="calcCondensate()" placeholder="e.g. 10" type="number"/>
</div>
</div>
</div>
<button class="calc-btn blue" data-action-click="calcCondensate();showRes('cond-res')">⚡ Size Condensate Drain</button>
<div id="cond-res" style="display:none">
<div class="scard">
<div class="scard-head">
<div class="scard-accent" style="background:var(--blue)"></div>
<div class="scard-title">Condensate Drain Result</div>
</div>
<div class="scard-body">
<div class="res-row">
<div class="res-label">Condensate flow rate</div>
<div class="res-val primary" id="cond-r-flow">-</div>
</div>
<div class="res-row">
<div class="res-label">Condensate per hour</div>
<div class="res-val" id="cond-r-hr">-</div>
</div>
<div class="res-row">
<div class="res-label">Recommended pipe size</div>
<div class="res-val primary" id="cond-r-size">-</div>
</div>
<div class="res-row">
<div class="res-label">Minimum slope</div>
<div class="res-val" id="cond-r-slope">-</div>
</div>
<div class="res-row">
<div class="res-label">Total drop over run</div>
<div class="res-val" id="cond-r-drop">-</div>
</div>
</div>
</div>
</div>
</div>
`;

window.CalculatorTemplates['sanity-check'] = `
<div class="page" id="page-sanity-check">
<div class="calc-header" style="background:linear-gradient(135deg,#f78f22,#d17914)">
<div class="calc-title">🔍 Design Sanity Check</div>
<div class="calc-std">Design Assistant - velocity · friction · airflow · pressure checks</div>
</div>
<div class="calc-desc" style="background:#EEF4FF;border-color:rgba(0,102,204,0.2)">Enter your system design
          values and get instant engineering feedback. Acts as a second opinion on your HVAC design parameters.</div>
<div class="scard">
<div class="scard-head">
<div class="scard-accent" style="background:var(--brand)"></div>
<div class="scard-title">Duct System</div>
</div>
<div class="scard-body">
<div class="input-group">
<div class="input-label">Supply main duct velocity <span class="input-unit" id="sc-dv-unit">FPM</span>
</div><input class="inp" id="sc-duct-vel" data-action-input="runSanityCheck()" placeholder="e.g. 1500" type="number"/>
</div>
<div class="input-group">
<div class="input-label">Duct friction rate <span class="input-unit" id="sc-dfr-unit">in
                  w.g./100ft</span></div><input class="inp" id="sc-duct-fr" data-action-input="runSanityCheck()" placeholder="e.g. 0.08" step="0.01" type="number"/>
</div>
<div class="input-group">
<div class="input-label">Total External Static Pressure <span class="input-unit" id="sc-esp-unit">in
                  w.g.</span></div><input class="inp" id="sc-esp" data-action-input="runSanityCheck()" placeholder="e.g. 1.5" step="0.1" type="number"/>
</div>
</div>
</div>
<div class="scard">
<div class="scard-head">
<div class="scard-accent" style="background:var(--brand)"></div>
<div class="scard-title">Pipe System</div>
</div>
<div class="scard-body">
<div class="input-group">
<div class="input-label">CHW main pipe velocity <span class="input-unit" id="sc-pv-unit">fps</span>
</div><input class="inp" id="sc-pipe-vel" data-action-input="runSanityCheck()" placeholder="e.g. 4.0" step="0.5" type="number"/>
</div>
<div class="input-group">
<div class="input-label">Pump total head <span class="input-unit" id="sc-ph-unit">ft w.g.</span></div>
<input class="inp" id="sc-pump-head" data-action-input="runSanityCheck()" placeholder="e.g. 65" type="number"/>
</div>
</div>
</div>
<div class="scard">
<div class="scard-head">
<div class="scard-accent" style="background:var(--brand)"></div>
<div class="scard-title">Air &amp; Load</div>
</div>
<div class="scard-body">
<div class="input-group">
<div class="input-label">Airflow per TR <span class="input-unit">CFM/TR</span></div><input class="inp" id="sc-cfmtr" data-action-input="runSanityCheck()" placeholder="e.g. 400" type="number"/>
</div>
<div class="input-group">
<div class="input-label">Supply air temperature <span class="input-unit" id="sc-sat-unit">°F</span>
</div><input class="inp" id="sc-sat" data-action-input="runSanityCheck()" placeholder="e.g. 55" type="number"/>
</div>
<div class="input-group">
<div class="input-label">CHW ΔT (supply to return) <span class="input-unit">°F</span></div><input class="inp" id="sc-chwdt" data-action-input="runSanityCheck()" placeholder="e.g. 10" type="number"/>
</div>
<div class="input-group">
<div class="input-label">Chiller kW/TR</div><input class="inp" id="sc-kwtr" data-action-input="runSanityCheck()" placeholder="e.g. 0.65" step="0.05" type="number"/>
</div>
</div>
</div>
<button class="calc-btn" data-action-click="runSanityCheck();showRes('hvac-sc-res')" style="background:var(--brand);color:#fff;">🔍 Run Sanity Check</button>
<div id="hvac-sc-res" style="display:none">
<div class="scard">
<div class="scard-head">
<div class="scard-accent" style="background:var(--brand)"></div>
<div class="scard-title">Design Check Results</div>
</div>
<div class="scard-body" id="sc-results-body"></div>
</div>
</div>
</div>
`;

window.CalculatorTemplates['heating-load'] = `
<div class="page" id="page-heating-load">
<div class="calc-header" style="background:linear-gradient(135deg,#f78f22,#d17914)">
<div class="calc-title">🔥 Heating Load Calculator</div>
<div class="calc-std">Simplified winter heat loss - envelope + infiltration</div>
</div>
<div class="calc-desc" style="background:#EEF4FF;border-color:rgba(0,102,204,0.2)">
          Estimate building heating load for boiler, AHU heating coil, or electric heater sizing. Covers envelope
          conduction and infiltration losses. Simplified - not a full calculation.
        </div>
<div class="scard">
<div class="scard-head">
<div class="scard-accent" style="background:var(--brand)"></div>
<div class="scard-title">Space &amp; Envelope</div>
</div>
<div class="scard-body">
<div class="input-group">
<div class="input-label">Floor area <span class="input-unit" id="hl2-area-unit">ft²</span></div><input class="inp" id="hl2-area" data-action-input="calcHeatingLoad()" placeholder="e.g. 2000" type="number"/>
</div>
<div class="input-group">
<div class="input-label">Ceiling height <span class="input-unit" id="hl2-ht-unit">ft</span></div><input class="inp" id="hl2-ht" data-action-input="calcHeatingLoad()" placeholder="e.g. 10" type="number"/>
</div>
<div class="input-group">
<div class="input-label">Wall + roof U-value <span class="input-unit">BTU/hr·ft²·°F</span></div><input class="inp" id="hl2-uwall" data-action-input="calcHeatingLoad()" placeholder="e.g. 0.065" step="0.005" type="number"/>
</div>
<div class="input-group">
<div class="input-label">Glazing area <span class="input-unit" id="hl2-glaz-unit">ft²</span></div><input class="inp" id="hl2-glaz" data-action-input="calcHeatingLoad()" placeholder="e.g. 200" type="number"/>
</div>
<div class="input-group">
<div class="input-label">Glazing U-value <span class="input-unit">BTU/hr·ft²·°F</span></div><input class="inp" id="hl2-uglaz" data-action-input="calcHeatingLoad()" placeholder="e.g. 0.28" step="0.02" type="number"/>
</div>
<div class="input-group">
<div class="input-label">Outdoor design temperature <span class="input-unit" id="hl2-oat-unit">°F</span>
</div><input class="inp" id="hl2-oat" data-action-input="calcHeatingLoad()" placeholder="e.g. 32" type="number"/>
</div>
<div class="input-group">
<div class="input-label">Indoor setpoint <span class="input-unit" id="hl2-iat-unit">°F</span></div>
<input class="inp" id="hl2-iat" data-action-input="calcHeatingLoad()" placeholder="e.g. 70" type="number"/>
</div>
<div class="input-group">
<div class="input-label">Infiltration (ACH) <span class="input-unit">air changes/hr</span></div><input class="inp" id="hl2-ach" data-action-input="calcHeatingLoad()" placeholder="e.g. 0.5" step="0.1" type="number"/>
</div>
</div>
</div>
<button class="calc-btn" data-action-click="calcHeatingLoad();showRes('hl2-res')" style="background:var(--brand);color:#fff;">⚡ Calculate Heating Load</button>
<div id="hl2-res" style="display:none">
<div id="hl2-warn-area"></div>
<div class="scard">
<div class="scard-head">
<div class="scard-accent" style="background:var(--brand)"></div>
<div class="scard-title">Heating Load Breakdown</div>
</div>
<div class="scard-body">
<div class="res-row">
<div class="res-label">Envelope conduction loss</div>
<div class="res-val" id="hl2-r-cond">-</div>
</div>
<div class="res-row">
<div class="res-label">Glazing conduction loss</div>
<div class="res-val" id="hl2-r-glaz">-</div>
</div>
<div class="res-row">
<div class="res-label">Infiltration heat loss</div>
<div class="res-val" id="hl2-r-inf">-</div>
</div>
<div class="res-row">
<div class="res-label">Total heating load</div>
<div class="res-val primary" id="hl2-r-total" style="color:var(--brand)">-</div>
</div>
<div class="res-row">
<div class="res-label">Load per ft²</div>
<div class="res-val" id="hl2-r-perft">-</div>
</div>
<div class="res-row">
<div class="res-label">Heater / boiler capacity</div>
<div class="res-val primary" id="hl2-r-kw" style="color:var(--brand)">-</div>
</div>
</div>
</div>
<div class="calc-chart" id="heatload-chart" style="display:none"></div>
</div>
</div>
`;

window.CalculatorTemplates['prelim-cooling'] = `
<div class="page two-col-page pcl-shell" id="page-prelim-cooling">
<div class="calc-header" style="background:linear-gradient(135deg,#f78f22,#d17914)">
<div class="calc-title">❄️ Preliminary Cooling Load</div>
<div class="calc-std">Space-by-space heat dissipation estimate · W/m² lookup method</div>
</div>
<div class="calc-desc" style="background:#EEF4FF;border-color:rgba(0,102,204,0.2)">
          Select the type of space — Cooling Load Density is auto-filled from the lookup table. Cooling Load =
          <strong>Area × Cooling Load Density</strong>. Preliminary estimate only — not a substitute for a full
          room-by-room cooling load analysis.
        </div>
<div style="display:flex; flex-direction:column; gap:16px;">
<!-- Cooling Load Schedule -->
<div style="min-width:0;">
<div class="scard">
<div class="scard-head">
<div class="scard-accent" style="background:var(--brand)"></div>
<div class="scard-title">Cooling Load Schedule</div>
</div>
<div class="scard-body" style="padding:0">
<div style="padding:14px 16px 0;color:var(--muted);font-size:12px;display:flex;align-items:center;justify-content:space-between;gap:10px;flex-wrap:wrap">
<span>Enter \`Name of Space\` and \`Area\` directly in the first table row. Type auto-detects from the
                    name when possible.</span>
<div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap">
<span class="pcl-status-pill" id="pcl-table-pill">Live Schedule</span>
<button class="pcl-inline-btn" data-action-click="PlumbingZoneLinker.openImportModal('preliminary-cooling-load')" data-action-mouseout="this.style.background='#f78f22';this.style.transform='none'" data-action-mouseover="this.style.background='#2563eb';this.style.transform='translateY(-1px)'" style="width:auto;padding:7px 14px;background:#f78f22;color:#fff;font-weight:700;display:flex;align-items:center;gap:5px;box-shadow:0 2px 5px rgba(59,130,246,0.2);border-radius:6px;border:none;cursor:pointer;transition:all 0.15s ease;">📥 Import</button>
<button class="pcl-inline-btn" data-action-click="pclExportToExcel()" data-action-mouseout="this.style.background='#f78f22';this.style.transform='none'" data-action-mouseover="this.style.background='#d17914';this.style.transform='translateY(-1px)'" style="width:auto;padding:7px 14px;background:#f78f22;color:#fff;font-weight:700;display:flex;align-items:center;gap:5px;box-shadow:0 2px 5px rgba(16,185,129,0.2);border-radius:6px;border:none;cursor:pointer;transition:all 0.15s ease;">📊 Export
                      Excel</button>
<button class="pcl-inline-btn" data-action-click="pclDeleteSelected()" data-action-mouseout="this.style.background='#fff1f2';this.style.borderColor='#ffe4e6';this.style.transform='none'" data-action-mouseover="this.style.background='#ffe4e6';this.style.borderColor='#fecdd3';this.style.transform='translateY(-1px)'" style="width:auto;padding:7px 14px;background:#fff1f2;border:1px solid #ffe4e6;color:#e11d48;font-weight:600;display:flex;align-items:center;gap:6px;border-radius:6px;cursor:pointer;transition:all 0.15s ease;box-shadow:0 1px 2px rgba(225, 29, 72, 0.05);">
<span style="font-size:14px">🗑️</span> Delete Selected
                    </button>
<button class="pcl-inline-btn secondary" data-action-click="pclClearAll()" style="width:auto;padding:7px 12px">Clear All</button>
</div>
</div>
<div style="padding:12px 16px 16px;overflow-x:auto">
<div class="pcl-table-wrap">
<table id="pcl-table" style="width:100%;border-collapse:collapse;font-size:12.5px;table-layout:fixed">
<colgroup>
<col style="width:34px"/>
<col style="width:34px"/>
<col style="width:23%"/>
<col style="width:11%"/>
<col style="width:22%"/>
<col style="width:13%"/>
<col style="width:15%"/>
<col style="width:12%"/>
</colgroup>
<thead>
<tr style="background:var(--brand);color:#fff">
<th style="padding:9px 6px;text-align:center"><input id="pcl-select-all" data-action-click="pclToggleSelectAll(this.checked)" style="cursor:pointer" type="checkbox"/></th>
<th style="padding:9px 6px;text-align:center;font-weight:700;font-size:11px;border-right:1px solid rgba(255,255,255,0.18)">
                            #</th>
<th style="padding:9px 10px;text-align:center;font-weight:700;font-size:11.5px;border-right:1px solid rgba(255,255,255,0.18)">
                            Name of Space</th>
<th style="padding:9px 6px;text-align:center;font-weight:700;font-size:11px;border-right:1px solid rgba(255,255,255,0.18)">
                            Area<br/><span style="font-weight:400;font-size:9.5px;opacity:.85">(m²)</span></th>
<th style="padding:9px 10px;text-align:center;font-weight:700;font-size:11.5px;border-right:1px solid rgba(255,255,255,0.18)">
                            Type of Space</th>
<th style="padding:9px 6px;text-align:center;font-weight:700;font-size:11px;border-right:1px solid rgba(255,255,255,0.18)">
                            Cooling Load Density<br/><span style="font-weight:400;font-size:9.5px;opacity:.85">(W/m²)</span></th>
<th style="padding:9px 6px;text-align:center;font-weight:700;font-size:11px;border-right:1px solid rgba(255,255,255,0.18)">
                            Cooling Load<br/><span style="font-weight:400;font-size:9.5px;opacity:.85">(kW)</span></th>
<th style="padding:9px 6px;text-align:center;font-weight:700;font-size:11px;border-right:1px solid rgba(255,255,255,0.18)">
                            Load<br/><span style="font-weight:400;font-size:9.5px;opacity:.85">(TR)</span></th>
</tr>
</thead>
<tbody id="pcl-entry-tbody">
<tr id="pcl-entry-row" style="background:#fffaf4;border-bottom:1px dashed #f5c289">
<td colspan="2" style="padding:6px;text-align:center;background:#fff3e0;border-right:1px solid #f5d7a5">
<button class="pcl-inline-btn" data-action-click="pclAddFromForm()" style="padding:5px 0; width:100%; border-radius:6px; font-size:12px; display:flex; align-items:center; justify-content:center; gap:4px;"><span style="font-size:14px; line-height:1;">+</span> Add</button>
</td>
<td style="padding:6px;border-right:1px solid #f6e4c7"><input class="pcl-inline-inp" id="pcl-row-name" data-action-blur="pclPreviewCalc()" data-action-input="pclPreviewCalc()" placeholder="e.g. Office 01" type="text"/></td>
<td style="padding:6px;border-right:1px solid #f6e4c7"><input class="pcl-inline-inp" id="pcl-row-area" min="0" data-action-blur="pclPreviewCalc()" data-action-input="pclPreviewCalc()" placeholder="50" step="any" type="number"/></td>
<td style="padding:6px;border-right:1px solid #f6e4c7">
<select class="pcl-inline-select" id="pcl-row-type" data-action-blur="pclPreviewCalc()" data-action-change="pclPreviewCalc()">
<option value="">— Select Type —</option>
<optgroup label="Residential">
<option data-density="120" value="Apartment - Dwelling Unit">Apartment - Dwelling Unit
                                </option>
<option data-density="60" value="Corridor - Residential">Corridor - Residential
                                </option>
<option data-density="180" value="Lobby - Residential">Lobby - Residential</option>
</optgroup>
<optgroup label="Retail &amp; F&amp;B">
<option data-density="230" value="Supermarket">Supermarket</option>
<option data-density="400" value="Retail Shop - Mixed Building">Retail Shop - Mixed
                                  Building</option>
<option data-density="200" value="Retail Shop - Mall">Retail Shop - Mall</option>
<option data-density="2000" value="Food &amp; Beverage">Food &amp; Beverage</option>
<option data-density="600" value="Kitchen - Public">Kitchen - Public</option>
<option data-density="120" value="Kitchen - Private">Kitchen - Private</option>
<option data-density="140" value="Café">Café</option>
</optgroup>
<optgroup label="Office &amp; Coworking">
<option data-density="120" value="Office - Cabin">Office - Cabin</option>
<option data-density="120" value="Office - Meeting Room">Office - Meeting Room
                                </option>
<option data-density="120" value="Office - Common Room">Office - Common Room</option>
<option data-density="120" value="Coworking Space">Coworking Space</option>
</optgroup>
<optgroup label="Education">
<option data-density="140" value="Classroom - EYFS">Classroom - EYFS</option>
<option data-density="140" value="Classroom - Middle School">Classroom - Middle School
                                </option>
<option data-density="140" value="Classroom - Art">Classroom - Art</option>
<option data-density="150" value="Classroom - High School">Classroom - High School
                                </option>
<option data-density="180" value="ICT Room">ICT Room</option>
<option data-density="180" value="Lab - School">Lab - School</option>
<option data-density="180" value="Lab - Science">Lab - Science</option>
<option data-density="100" value="Lobby - School">Lobby - School</option>
</optgroup>
<optgroup label="Wellness &amp; Leisure">
<option data-density="180" value="GYM">GYM</option>
<option data-density="150" value="SPA">SPA</option>
<option data-density="250" value="Kids Play Area">Kids Play Area</option>
</optgroup>
<optgroup label="Medical">
<option data-density="250" value="Clinic">Clinic</option>
<option data-density="140" value="Clinic - Treatment Room">Clinic - Treatment Room
                                </option>
<option data-density="140" value="Clinic - Doctor Room">Clinic - Doctor Room</option>
<option data-density="140" value="Storage - Medical">Storage - Medical</option>
</optgroup>
<optgroup label="Hospitality">
<option data-density="100" value="Lobby - Hotel">Lobby - Hotel</option>
</optgroup>
<optgroup label="Utilities &amp; Services">
<option data-density="120" value="Airlock">Airlock</option>
<option data-density="60" value="Washroom">Washroom</option>
<option data-density="100" value="Toilet - EYFS Attached">Toilet - EYFS Attached
                                </option>
<option data-density="100" value="Toilet - Public">Toilet - Public</option>
<option data-density="60" value="Male Prayer Room">Male Prayer Room</option>
<option data-density="150" value="Laundry / House Keeping">Laundry / House Keeping
                                </option>
<option data-density="120" value="Garbage Room">Garbage Room</option>
<option data-density="100" value="Stairs">Stairs</option>
<option data-density="100" value="Lobby - Lift">Lobby - Lift</option>
<option data-density="120" value="Corridor - BOH/Service">Corridor - BOH/Service
                                </option>
</optgroup>
<optgroup label="MEP Rooms">
<option data-density="300" value="MTR Room">MTR Room</option>
<option data-density="90" value="LV Room">LV Room</option>
<option data-density="300" value="Server Room">Server Room</option>
<option data-density="300" value="CCTV Room">CCTV Room</option>
<option data-density="100" value="Typ. Electrical Room">Typ. Electrical Room</option>
<option data-density="1500" value="Typ. IDF Room">Typ. IDF Room</option>
<option data-density="120" value="FCC Room">FCC Room</option>
<option data-density="120" value="ETS Room">ETS Room</option>
<option data-density="120" value="ETS Control Room">ETS Control Room</option>
<option data-density="120" value="Chilled Water Pump Room">Chilled Water Pump Room
                                </option>
<option data-density="150" value="Fire Pump Room">Fire Pump Room</option>
<option data-density="100" value="ETS Pump Room">ETS Pump Room</option>
<option data-density="200" value="Boiler Room">Boiler Room</option>
</optgroup>
<optgroup label="Storage">
<option data-density="100" value="Storage - Dry">Storage - Dry</option>
<option data-density="1000" value="Storage - IT">Storage - IT</option>
<option data-density="120" value="Storage - Occupied">Storage - Occupied</option>
</optgroup>
</select>
</td>
<td style="padding:8px 6px;text-align:center;border-right:1px solid #f6e4c7"><span class="pcl-inline-val" id="pcl-row-density">—</span></td>
<td style="padding:8px 6px;text-align:center;border-right:1px solid #f6e4c7"><span class="pcl-inline-val" id="pcl-row-diss">—</span></td>
<td style="padding:8px 6px;text-align:center;border-right:1px solid #f6e4c7"><span class="pcl-inline-val" id="pcl-row-kw">—</span></td>
</tr>
</tbody>
<tbody id="pcl-tbody">
</tbody>
<tfoot id="pcl-tfoot">
<tr style="background:var(--brand-bg);border-top:2px solid var(--brand)">
<td colspan="4" style="padding:9px 10px;font-weight:700;font-size:12.5px;border-right:1px solid #f5c289">
                            TOTAL</td>
<td style="padding:9px 6px;text-align:right;font-weight:500;color:var(--muted);font-size:11px;border-right:1px solid #f5c289">
                            —</td>
<td id="pcl-total-w" style="padding:9px 6px;text-align:right;font-weight:700;font-size:13px;color:var(--brand);border-right:1px solid #f5c289">0.00 kW</td>
<td id="pcl-total-kw" style="padding:9px 6px;text-align:right;font-weight:700;font-size:12px;color:var(--brand)">0.00 TR</td>
<td></td>
</tr>
</tfoot>
</table>
<!-- Empty state -->
<div class="pcl-empty-hero" id="pcl-empty-state" style="padding:32px 16px;text-align:center;color:var(--hint);font-size:12.5px;line-height:1.8;border-top:1px solid var(--border)">
<div class="pcl-empty-icon">🏢</div>
                      No spaces added yet.<br/><span class="pcl-preview-note">Type in the first table row to build the
                        schedule.</span>
</div>
</div>
<div class="pcl-summary-grid">
<div class="pcl-stat">
<div class="res-row">
<div class="res-label">Total Spaces</div>
<div class="res-val" id="pcl-s-count">0 spaces</div>
</div>
</div>
<div class="pcl-stat">
<div class="res-row">
<div class="res-label">Total Floor Area</div>
<div class="res-val" id="pcl-s-area">0.0 m²</div>
</div>
</div>
<div class="pcl-stat">
<div class="res-row">
<div class="res-label">Total Cooling Load (kW)</div>
<div class="res-val" id="pcl-s-w">0.00 kW</div>
</div>
</div>
<div class="pcl-stat">
<div class="res-row">
<div class="res-label">Total Load (TR)</div>
<div class="res-val primary" id="pcl-s-kw">0.00 TR</div>
</div>
</div>
<div class="pcl-stat">
<div class="res-row">
<div class="res-label">Total Load (TR)</div>
<div class="res-val primary" id="pcl-s-tr">0.00 TR</div>
</div>
</div>
<div class="pcl-stat">
<div class="res-row">
<div class="res-label">Average Load Density</div>
<div class="res-val" id="pcl-s-density">0.0 W/m²</div>
</div>
</div>
</div>
</div>
</div>
</div>
</div>
</div>
<div class="calc-desc" style="font-size:11.5px;color:var(--muted);margin-top:4px">
          ⚠ Heat density values are standard defaults from lookup table. Always verify with a full cooling load
          analysis before finalising equipment selection.
        </div>
</div>
`;

window.CalculatorTemplates['condensate-calc'] = `
<div class="page two-col-page pcl-shell" id="page-condensate-calc">
<div class="calc-header" style="background:linear-gradient(135deg,#0284c7,#0369a1)">
<div class="calc-title">💧 Condensate Drain Sizing &amp; Calculation</div>
<div class="calc-std">Estimate water condensation from air-conditioning cooling coils</div>
</div>
<div class="calc-desc" style="background:#f0f9ff;border-color:rgba(14,165,233,0.2)">
          Input entering and leaving air conditions and airflow rate to calculate the final condensate flow rate. Calculations are based on standard atmospheric pressure (101.325 kPa).
        </div>
<div style="display:flex; flex-direction:column; gap:16px;">
<!-- Condensate Drain Schedule -->
<div style="min-width:0;">
<div class="scard">
<div class="scard-head">
<div class="scard-accent" style="background:#0284c7"></div>
<div class="scard-title">Condensate Drain Schedule</div>
</div>
<div class="scard-body" style="padding:0">
<div style="padding:14px 16px 0;color:var(--muted);font-size:12px;display:flex;align-items:center;justify-content:space-between;gap:10px;flex-wrap:wrap">
<span>Enter unit conditions and flow rates directly in the first row, then click <strong>+ Add</strong>.</span>
<div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap">
<span class="pcl-status-pill" id="cdc-table-pill">Live Schedule</span>
<button class="pcl-inline-btn" data-action-click="cdcExportToExcel()" data-action-mouseout="this.style.background='#f78f22';this.style.transform='none'" data-action-mouseover="this.style.background='#d17914';this.style.transform='translateY(-1px)'" style="width:auto;padding:7px 14px;background:#f78f22;color:#fff;font-weight:700;display:flex;align-items:center;gap:5px;box-shadow:0 2px 5px rgba(16,185,129,0.2);border-radius:6px;border:none;cursor:pointer;transition:all 0.15s ease;">📊 Export Excel</button>
<button class="pcl-inline-btn" data-action-click="cdcDeleteSelected()" data-action-mouseout="this.style.background='#fff1f2';this.style.borderColor='#ffe4e6';this.style.transform='none'" data-action-mouseover="this.style.background='#ffe4e6';this.style.borderColor='#fecdd3';this.style.transform='translateY(-1px)'" style="width:auto;padding:7px 14px;background:#fff1f2;border:1px solid #ffe4e6;color:#e11d48;font-weight:600;display:flex;align-items:center;gap:6px;border-radius:6px;cursor:pointer;transition:all 0.15s ease;box-shadow:0 1px 2px rgba(225, 29, 72, 0.05);">
<span style="font-size:14px">🗑️</span> Delete Selected
                    </button>
<button class="pcl-inline-btn secondary" data-action-click="cdcClearAll()" style="width:auto;padding:7px 12px">Clear All</button>
</div>
</div>
<div style="padding:12px 16px 16px;overflow-x:auto">
<div class="pcl-table-wrap">
<table id="cdc-table" style="width:100%;border-collapse:collapse;font-size:12px;table-layout:fixed">
<colgroup>
<col style="width:36px"/>
<col style="width:36px"/>
<col style="width:18%"/>
<col style="width:16%"/>
<col style="width:16%"/>
<col style="width:12%"/>
<col style="width:12%"/>
<col style="width:12%"/>
<col style="width:14%"/>
</colgroup>
<thead>
<tr style="background:#0284c7;color:#fff">
<th rowspan="2" style="padding:9px 6px;text-align:center"><input id="cdc-select-all" data-action-click="cdcToggleSelectAll(this.checked)" style="cursor:pointer" type="checkbox"/>
</th>
<th rowspan="2" style="padding:9px 6px;text-align:center;font-weight:700;font-size:11px;border-right:1px solid rgba(255,255,255,0.18)">
                            #</th>
<th rowspan="2" style="padding:9px 10px;text-align:center;font-weight:700;font-size:11.5px;border-right:1px solid rgba(255,255,255,0.18)">
                            Unit Ref.</th>
<th style="padding:6px 10px;text-align:center;font-weight:700;font-size:11px;border-right:1px solid rgba(255,255,255,0.18)">
                            On Coil Conditions</th>
<th style="padding:6px 10px;text-align:center;font-weight:700;font-size:11px;border-right:1px solid rgba(255,255,255,0.18)">
                            Off Coil Conditions</th>
<th rowspan="2" style="padding:9px 6px;text-align:center;font-weight:700;font-size:11px;border-right:1px solid rgba(255,255,255,0.18)">
                            Air Flow Rate<br/><span class="cdc-flow-unit-label" style="font-weight:400;font-size:9.5px;opacity:.85">(L/s)</span></th>
<th rowspan="2" style="padding:9px 6px;text-align:center;font-weight:700;font-size:11px;border-right:1px solid rgba(255,255,255,0.18)">
                            On-Coil Sp. Hum.<br/><span style="font-weight:400;font-size:9px;opacity:.85">(kg/kg dry air)</span>
</th>
<th rowspan="2" style="padding:9px 6px;text-align:center;font-weight:700;font-size:11px;border-right:1px solid rgba(255,255,255,0.18)">
                            Off-Coil Sp. Hum.<br/><span style="font-weight:400;font-size:9px;opacity:.85">(kg/kg dry air)</span>
</th>
<th rowspan="2" style="padding:9px 6px;text-align:center;font-weight:700;font-size:11px">
                            Condensate Flow<br/><span class="cdc-cond-flow-unit-label" style="font-weight:400;font-size:9px;opacity:.85">(L/s)</span></th>
</tr>
<tr style="background:#0284c7;color:#fff">
<th style="padding:4px 6px;text-align:center;font-size:10px;font-weight:600;border-right:1px solid rgba(255,255,255,0.18)">
                            DB / WB (<span class="cdc-temp-unit">°C</span>)</th>
<th style="padding:4px 6px;text-align:center;font-size:10px;font-weight:600;border-right:1px solid rgba(255,255,255,0.18)">
                            DB / WB (<span class="cdc-temp-unit2">°C</span>)</th>
</tr>
</thead>
<tbody>
<!-- Entry form row -->
<tr id="cdc-entry-row" style="background:#f0f9ff;border-bottom:1px dashed #0284c7">
<td colspan="2" style="padding:6px;text-align:center;background:#e0f2fe;border-right:1px solid #bae6fd">
<button class="pcl-inline-btn" data-action-click="cdcAddFromForm()" style="padding:5px 0; width:100%; border-radius:6px; font-size:12px; display:flex; align-items:center; justify-content:center; gap:4px;background:#0284c7;color:#fff;border:none;cursor:pointer"><span style="font-size:14px; line-height:1;">+</span> Add</button>
</td>
<td style="padding:6px;border-right:1px solid #bae6fd">
<input class="pcl-inline-inp" id="cdc-row-name" data-action-blur="cdcPreviewCalc()" data-action-input="cdcPreviewCalc()" placeholder="e.g. AHU-01" type="text"/>
</td>
<td style="padding:6px;border-right:1px solid #bae6fd">
<div style="display:flex;gap:4px">
<input class="pcl-inline-inp" id="cdc-row-db-in" min="0" data-action-blur="cdcPreviewCalc()" data-action-input="cdcPreviewCalc()" placeholder="DB" step="0.1" style="width:50%" type="number"/>
<input class="pcl-inline-inp" id="cdc-row-wb-in" min="0" data-action-blur="cdcPreviewCalc()" data-action-input="cdcPreviewCalc()" placeholder="WB" step="0.1" style="width:50%" type="number"/>
</div>
</td>
<td style="padding:6px;border-right:1px solid #bae6fd">
<div style="display:flex;gap:4px">
<input class="pcl-inline-inp" id="cdc-row-db-out" min="0" data-action-blur="cdcPreviewCalc()" data-action-input="cdcPreviewCalc()" placeholder="DB" step="0.1" style="width:50%" type="number"/>
<input class="pcl-inline-inp" id="cdc-row-wb-out" min="0" data-action-blur="cdcPreviewCalc()" data-action-input="cdcPreviewCalc()" placeholder="WB" step="0.1" style="width:50%" type="number"/>
</div>
</td>
<td style="padding:6px;border-right:1px solid #bae6fd">
<input class="pcl-inline-inp" id="cdc-row-flow" min="0" data-action-blur="cdcPreviewCalc()" data-action-input="cdcPreviewCalc()" placeholder="1000" step="0.1" type="number"/>
</td>
<td id="cdc-row-win-val" style="padding:6px;text-align:center;color:var(--muted);font-weight:500;border-right:1px solid #bae6fd;font-size:11px">
                            —</td>
<td id="cdc-row-wout-val" style="padding:6px;text-align:center;color:var(--muted);font-weight:500;border-right:1px solid #bae6fd;font-size:11px">
                            —</td>
<td id="cdc-row-cond-val" style="padding:6px;text-align:center;color:var(--blue);font-weight:700;font-size:11.5px">
                            —</td>
</tr>
</tbody>
<!-- Data rows render here -->
<tbody id="cdc-tbody">
</tbody>
<!-- Summary row -->
<tfoot>
<tr style="background:#f8fafc;border-top:2px solid var(--border);border-bottom:2px solid var(--border);font-weight:700">
<td colspan="5" style="padding:10px 8px;text-align:right;border-right:1px solid var(--border)">TOTAL:</td>
<td id="cdc-total-flow" style="padding:10px 6px;text-align:center;border-right:1px solid var(--border)">0 L/s</td>
<td colspan="2" style="border-right:1px solid var(--border)"></td>
<td id="cdc-total-cond" style="padding:10px 6px;text-align:center;color:var(--blue)">0.0000 L/s</td>
</tr>
</tfoot>
</table>
<!-- Empty state -->
<div class="pcl-empty-hero" id="cdc-empty-state" style="padding:32px 16px;text-align:center;color:var(--hint);font-size:12.5px;line-height:1.8;border-top:1px solid var(--border)">
<div class="pcl-empty-icon">💧</div>
                      No units added yet.<br/><span class="pcl-preview-note">Type in the first row and click + Add to
                        build the schedule.</span>
</div>
</div>
<div class="pcl-summary-grid" style="grid-template-columns: repeat(auto-fit, minmax(240px, 1fr))">
<div class="pcl-stat">
<div class="res-row">
<div class="res-label">Total Units Sized</div>
<div class="res-val" id="cdc-s-count">0 units</div>
</div>
</div>
<div class="pcl-stat">
<div class="res-row">
<div class="res-label">Total Airflow</div>
<div class="res-val" id="cdc-s-flow">0 L/s</div>
</div>
</div>
<div class="pcl-stat">
<div class="res-row">
<div class="res-label">Total Condensate Flow</div>
<div class="res-val primary" id="cdc-s-cond">0.0000 L/s</div>
</div>
</div>
</div>
<div id="cdc-form-msg" style="margin-top:12px;font-size:12px;font-weight:600;text-align:center"></div>
</div>
</div>
</div>
</div>
</div>
</div>
`;

window.CalculatorTemplates['basement-smoke'] = `
<div class="page two-col-page pcl-shell" id="page-basement-smoke">
<div class="calc-header" style="background:linear-gradient(135deg,#475569,#334155)">
<div class="calc-title">💨 Basement Smoke Ventilation Calculator</div>
<div class="calc-std">Calculate normal &amp; fire mode smoke extract requirements</div>
</div>
<div class="calc-desc" style="background:#f8fafc;border-color:rgba(71,85,105,0.2)">
          Calculate normal ventilation (3 ACH / 6 ACH) and emergency fire mode (10 ACH) smoke extract requirements and fan capacities per floor.
        </div>
<div class="two-col-layout" style="display:flex;gap:16px;align-items:flex-start;flex-wrap:wrap">
<!-- Left Column: Table Schedule -->
<div style="flex:2; min-width:600px;">
<div class="scard">
<div class="scard-head">
<div class="scard-accent" style="background:#475569"></div>
<div class="scard-title">Basement Ventilation Schedule</div>
</div>
<div class="scard-body" style="padding:0">
<div style="padding:14px 16px 0;color:var(--muted);font-size:12px;display:flex;align-items:center;justify-content:space-between;gap:10px;flex-wrap:wrap">
<div style="display:flex;align-items:center;gap:14px;flex-wrap:wrap">
<span>Enter parking level inputs directly in the first row, then click <strong>+ Add</strong>.</span>
<div style="display:flex;align-items:center;gap:8px">
<label style="font-size:12px;font-weight:700;color:var(--text);white-space:nowrap">Total No. of Fans:</label>
<input id="bs-global-fans" min="1" data-action-blur="bsCalculate()" data-action-input="bsCalculate()" step="1" style="width:64px;padding:5px 8px;border:1.5px solid #cbd5e1;border-radius:6px;font-size:13px;font-family:var(--mono);text-align:center;font-weight:700;color:#475569" type="number" value="2"/>
</div>
</div>
<div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap">
<span class="pcl-status-pill" id="bs-table-pill">Live Schedule</span>
<button class="pcl-inline-btn" data-action-click="bsExportToExcel()" data-action-mouseout="this.style.background='#f78f22';this.style.transform='none'" data-action-mouseover="this.style.background='#d17914';this.style.transform='translateY(-1px)'" style="width:auto;padding:7px 14px;background:#f78f22;color:#fff;font-weight:700;display:flex;align-items:center;gap:5px;box-shadow:0 2px 5px rgba(16,185,129,0.2);border-radius:6px;border:none;cursor:pointer;transition:all 0.15s ease;">📊 Export Excel</button>
<button class="pcl-inline-btn" data-action-click="bsDeleteSelected()" data-action-mouseout="this.style.background='#fff1f2';this.style.borderColor='#ffe4e6';this.style.transform='none'" data-action-mouseover="this.style.background='#ffe4e6';this.style.borderColor='#fecdd3';this.style.transform='translateY(-1px)'" style="width:auto;padding:7px 14px;background:#fff1f2;border:1px solid #ffe4e6;color:#e11d48;font-weight:600;display:flex;align-items:center;gap:6px;border-radius:6px;cursor:pointer;transition:all 0.15s ease;box-shadow:0 1px 2px rgba(225, 29, 72, 0.05);">
                      🗑️ Delete Selected
                    </button>
<button class="pcl-inline-btn secondary" data-action-click="bsClearAll()" style="width:auto;padding:7px 12px">Clear All</button>
</div>
</div>
<div style="padding:12px 16px 16px;overflow-x:auto">
<div class="pcl-table-wrap">
<table id="bs-table" style="width:100%;border-collapse:collapse;font-size:12px;table-layout:fixed">
<colgroup>
<col style="width:36px"/>
<col style="width:36px"/>
<col style="width:22%"/>
<col style="width:15%"/>
<col style="width:18%"/>
<col style="width:12%"/>
<col style="width:13%"/>
<col style="width:13%"/>
<col style="width:13%"/>
</colgroup>
<thead>
<tr style="background:#475569;color:#fff">
<th style="padding:9px 6px;text-align:center"><input id="bs-select-all" data-action-click="bsToggleSelectAll(this.checked)" style="cursor:pointer" type="checkbox"/></th>
<th style="padding:9px 6px;text-align:center;font-weight:700;font-size:11px;border-right:1px solid rgba(255,255,255,0.18)">#</th>
<th style="padding:9px 10px;text-align:center;font-weight:700;font-size:11.5px;border-right:1px solid rgba(255,255,255,0.18)">Floor Name</th>
<th style="padding:9px 6px;text-align:center;font-weight:700;font-size:11px;border-right:1px solid rgba(255,255,255,0.18)">Floor Area<br/><span class="bs-area-unit-label" style="font-weight:400;font-size:9.5px;opacity:.85">(m²)</span></th>
<th style="padding:9px 6px;text-align:center;font-weight:700;font-size:11px;border-right:1px solid rgba(255,255,255,0.18)">Eff. Parking Area<br/><span class="bs-area-unit-label2" style="font-weight:400;font-size:9.5px;opacity:.85">(m²)</span></th>
<th style="padding:9px 6px;text-align:center;font-weight:700;font-size:11px;border-right:1px solid rgba(255,255,255,0.18)">Height<br/><span class="bs-height-unit-label" style="font-weight:400;font-size:9.5px;opacity:.85">(m)</span></th>
<th style="padding:9px 6px;text-align:center;font-weight:700;font-size:11px;border-right:1px solid rgba(255,255,255,0.18)">3 ACH<br/><span class="bs-flow-unit-label" style="font-weight:400;font-size:9px;opacity:.85">(L/s)</span></th>
<th style="padding:9px 6px;text-align:center;font-weight:700;font-size:11px;border-right:1px solid rgba(255,255,255,0.18)">6 ACH<br/><span class="bs-flow-unit-label2" style="font-weight:400;font-size:9px;opacity:.85">(L/s)</span></th>
<th style="padding:9px 6px;text-align:center;font-weight:700;font-size:11px">10 ACH (Fire)<br/><span class="bs-flow-unit-label3" style="font-weight:400;font-size:9px;opacity:.85">(L/s)</span></th>
</tr>
</thead>
<tbody>
<!-- Entry form row -->
<tr id="bs-entry-row" style="background:#f8fafc;border-bottom:1px dashed #475569">
<td colspan="2" style="padding:6px;text-align:center;background:#e2e8f0;border-right:1px solid #cbd5e1">
<button class="pcl-inline-btn" data-action-click="bsAddFromForm()" style="padding:5px 0; width:100%; border-radius:6px; font-size:12px; display:flex; align-items:center; justify-content:center; gap:4px;background:#475569;color:#fff;border:none;cursor:pointer"><span style="font-size:14px; line-height:1;">+</span> Add</button>
</td>
<td style="padding:6px;border-right:1px solid #cbd5e1">
<input class="pcl-inline-inp" id="bs-row-name" data-action-blur="bsPreviewCalc()" data-action-input="bsPreviewCalc()" placeholder="e.g. B1" type="text"/>
</td>
<td style="padding:6px;border-right:1px solid #cbd5e1">
<input class="pcl-inline-inp" id="bs-row-area" min="0" data-action-blur="bsPreviewCalc()" data-action-input="bsPreviewCalc()" placeholder="600" step="1" type="number"/>
</td>
<td style="padding:6px;border-right:1px solid #cbd5e1">
<input class="pcl-inline-inp" id="bs-row-eff-area" min="0" data-action-blur="bsPreviewCalc()" data-action-input="bsPreviewCalc()" placeholder="500" step="1" type="number"/>
</td>
<td style="padding:6px;border-right:1px solid #cbd5e1">
<input class="pcl-inline-inp" id="bs-row-height" min="0" data-action-blur="bsPreviewCalc()" data-action-input="bsPreviewCalc()" placeholder="3.0" step="0.1" type="number"/>
</td>
<td id="bs-row-3ach-val" style="padding:6px;text-align:center;color:var(--muted);font-weight:500;border-right:1px solid #cbd5e1;font-size:11px">—</td>
<td id="bs-row-6ach-val" style="padding:6px;text-align:center;color:var(--muted);font-weight:500;border-right:1px solid #cbd5e1;font-size:11px">—</td>
<td id="bs-row-10ach-val" style="padding:6px;text-align:center;color:var(--blue);font-weight:700;font-size:11.5px">—</td>
</tr>
</tbody>
<!-- Data rows -->
<tbody id="bs-tbody">
</tbody>
<!-- Summary row -->
<tfoot>
<tr style="background:#f8fafc;border-top:2px solid var(--border);border-bottom:2px solid var(--border);font-weight:700">
<td colspan="3" style="padding:10px 8px;text-align:right;border-right:1px solid var(--border)">TOTAL:</td>
<td style="border-right:1px solid var(--border)"></td>
<td style="border-right:1px solid var(--border)"></td>
<td style="border-right:1px solid var(--border)"></td>
<td id="bs-total-3ach" style="padding:10px 6px;text-align:center;border-right:1px solid var(--border)">0 L/s</td>
<td id="bs-total-6ach" style="padding:10px 6px;text-align:center;border-right:1px solid var(--border)">0 L/s</td>
<td id="bs-total-10ach" style="padding:10px 6px;text-align:center;font-size:11px;color:var(--muted)">MAX: 0 L/s</td>
</tr>
</tfoot>
</table>
<!-- Empty state -->
<div class="pcl-empty-hero" id="bs-empty-state" style="padding:32px 16px;text-align:center;color:var(--hint);font-size:12.5px;line-height:1.8;border-top:1px solid var(--border)">
<div class="pcl-empty-icon">💨</div>
                      No floors added yet.<br/><span class="pcl-preview-note">Type in the first row and click + Add to build the schedule.</span>
</div>
</div>
<div id="bs-form-msg" style="margin-top:12px;font-size:12px;font-weight:600;text-align:center"></div>
</div>
</div>
</div>
</div>
<!-- Right Column: Final Summary & Fan Selection -->
<div style="flex:1; min-width:320px; display:flex; flex-direction:column; gap:16px;">
<!-- Project Results Card -->
<div class="scard">
<div class="scard-head">
<div class="scard-accent" style="background:#475569"></div>
<div class="scard-title">Project Results</div>
</div>
<div class="scard-body" style="padding:16px">
<div style="display:flex; flex-direction:column; gap:12px">
<div style="font-weight:700;font-size:11px;text-transform:uppercase;color:#475569;border-bottom:1px solid var(--border);padding-bottom:4px">Normal Mode</div>
<div class="res-row" style="display:flex;justify-content:space-between;font-size:12.5px;padding:4px 0">
<span style="color:var(--text);font-weight:500">CO &lt; 50 ppm (3 ACH Total):</span>
<span id="bs-res-3ach" style="font-weight:700;color:var(--blue)">0 L/s</span>
</div>
<div class="res-row" style="display:flex;justify-content:space-between;font-size:12.5px;padding:4px 0">
<span style="color:var(--text);font-weight:500">CO &gt; 50 ppm (6 ACH Total):</span>
<span id="bs-res-6ach" style="font-weight:700;color:var(--blue)">0 L/s</span>
</div>
<div style="font-weight:700;font-size:11px;text-transform:uppercase;color:#475569;border-bottom:1px solid var(--border);padding-bottom:4px;margin-top:8px">Fire Mode</div>
<div class="res-row" style="display:flex;justify-content:space-between;font-size:12.5px;padding:4px 0">
<span style="color:var(--text);font-weight:500">Fire Extract (10 ACH Max Floor):</span>
<span id="bs-res-10ach" style="font-weight:700;color:#e11d48">0 L/s</span>
</div>
<div style="font-weight:700;font-size:11px;text-transform:uppercase;color:#475569;border-bottom:1px solid var(--border);padding-bottom:4px;margin-top:8px">Fan Selection</div>
<div class="res-row" style="display:flex;justify-content:space-between;font-size:12.5px;padding:4px 0">
<span style="color:var(--text);font-weight:500">Total Fans:</span>
<span id="bs-res-total-fans" style="font-weight:700">—</span>
</div>
<div class="res-row" style="display:flex;justify-content:space-between;font-size:12.5px;padding:4px 0;background:#f8fafc;padding:6px;border-radius:6px">
<span style="color:var(--text);font-weight:600">Low Speed Fan Capacity:</span>
<span id="bs-res-low-cap" style="font-weight:700;color:var(--blue)">0 L/s</span>
</div>
<div class="res-row" style="display:flex;justify-content:space-between;font-size:12.5px;padding:4px 0;background:#f8fafc;padding:6px;border-radius:6px">
<span style="color:var(--text);font-weight:600">High Speed Fan Capacity:</span>
<span id="bs-res-high-cap" style="font-weight:700;color:#e11d48">0 L/s</span>
</div>
</div>
<button class="pcl-inline-btn" data-action-click="bsOpenFanSystemsModal()" data-action-mouseout="this.style.background='#475569'" data-action-mouseover="this.style.background='#334155'" style="margin-top:16px;width:100%;padding:10px;font-size:13px;font-weight:700;background:#475569;color:#fff;border:none;border-radius:6px;cursor:pointer;transition:all 0.15s ease;">⚙️ Generate Fan Systems</button>
</div>
</div>
</div>
</div>
<!-- ══ FAN SYSTEM DESIGN SECTION ══ -->
<div id="bs-fan-systems-section" style="margin-top:32px; display:none; width:100%;">
<!-- Proper Section Header Card -->
<div class="calc-header" style="background:linear-gradient(135deg,#475569,#334155); margin-bottom:0; border-bottom-left-radius:0; border-bottom-right-radius:0;">
<div class="calc-title">🌀 Fan System Design</div>
<div class="calc-std">Smoke Extract Fan Selection &amp; Static Pressure Calculation</div>
</div>
<div class="calc-desc" style="background:#f8fafc; border-color:rgba(71,85,105,0.2); border-top:none; margin-bottom:20px; border-top-left-radius:0; border-top-right-radius:0; font-size:12.5px; color:var(--muted);">
            Design and manage smoke extract fan systems for basement ventilation. Select served levels and configure ductwork parameters to calculate total static pressure head.
          </div>
<div class="bs-fan-systems-grid" id="bs-fan-systems-grid">
<!-- Fan System Cards will stack vertically here -->
</div>
</div>
</div>
`;

window.CalculatorTemplates['air-mixing'] = `
<div class="page" id="page-air-mixing">
<div class="calc-header">
<div class="calc-title">Air Mixing Calculator</div>
<div class="calc-std">Multi-stream mixing - psychrometric basis</div>
</div>
<div class="calc-desc">Calculate mixed air conditions when two airstreams (e.g. return air + outdoor air) are
          combined. Uses mass balance and energy balance per ASHRAE Fundamentals.</div>
<div class="scard">
<div class="scard-head">
<div class="scard-accent" style="background:var(--blue)"></div>
<div class="scard-title">Stream 1 - Return / Primary Air</div>
</div>
<div class="scard-body">
<div class="input-group">
<div class="input-label">Airflow <span class="input-unit" id="am-cfm1-unit">CFM</span></div><input class="inp" id="am-cfm1" data-action-input="calcAirMix()" placeholder="e.g. 8000" type="number"/>
</div>
<div class="input-group">
<div class="input-label">Dry bulb temp <span class="input-unit" id="am-t1-unit">°F</span></div><input class="inp" id="am-t1" data-action-input="calcAirMix()" placeholder="e.g. 75" type="number"/>
</div>
<div class="input-group">
<div class="input-label">Relative humidity <span class="input-unit">%</span></div><input class="inp" id="am-rh1" max="100" min="0" data-action-input="calcAirMix()" placeholder="e.g. 50" type="number"/>
</div>
</div>
</div>
<div class="scard">
<div class="scard-head">
<div class="scard-accent" style="background:var(--blue)"></div>
<div class="scard-title">Stream 2 - Outdoor / Secondary Air</div>
</div>
<div class="scard-body">
<div class="input-group">
<div class="input-label">Airflow <span class="input-unit" id="am-cfm2-unit">CFM</span></div><input class="inp" id="am-cfm2" data-action-input="calcAirMix()" placeholder="e.g. 2000" type="number"/>
</div>
<div class="input-group">
<div class="input-label">Dry bulb temp <span class="input-unit" id="am-t2-unit">°F</span></div><input class="inp" id="am-t2" data-action-input="calcAirMix()" placeholder="e.g. 95" type="number"/>
</div>
<div class="input-group">
<div class="input-label">Relative humidity <span class="input-unit">%</span></div><input class="inp" id="am-rh2" max="100" min="0" data-action-input="calcAirMix()" placeholder="e.g. 65" type="number"/>
</div>
</div>
</div>
<button class="calc-btn blue" data-action-click="calcAirMix();showRes('am-res')">⚡ Calculate Mixed Air</button>
<div id="am-res" style="display:none">
<div class="scard">
<div class="scard-head">
<div class="scard-accent" style="background:var(--blue)"></div>
<div class="scard-title">Mixed Air Conditions</div>
</div>
<div class="scard-body">
<div class="res-row">
<div class="res-label">Total mixed airflow</div>
<div class="res-val" id="am-r-cfm">-</div>
</div>
<div class="res-row">
<div class="res-label">OA fraction</div>
<div class="res-val" id="am-r-oafrac">-</div>
</div>
<div class="res-row">
<div class="res-label">Mixed dry bulb</div>
<div class="res-val primary" id="am-r-mdb">-</div>
</div>
<div class="res-row">
<div class="res-label">Mixed wet bulb (approx)</div>
<div class="res-val" id="am-r-mwb">-</div>
</div>
<div class="res-row">
<div class="res-label">Mixed humidity ratio</div>
<div class="res-val" id="am-r-mw">-</div>
</div>
<div class="res-row">
<div class="res-label">Mixed enthalpy</div>
<div class="res-val" id="am-r-mh">-</div>
</div>
</div>
</div>
</div>
</div>
`;

window.CalculatorTemplates['room-press'] = `
<div class="page" id="page-room-press">
<div class="calc-header">
<div class="calc-title">Room Pressurization Calculator</div>
<div class="calc-std">Supply vs return/exhaust balance - Pa differential</div>
</div>
<div class="calc-desc">Determine required supply/exhaust airflow imbalance to maintain a target room pressure
          differential. Used for clean rooms, hospitals, labs, and odour containment.</div>
<div class="scard">
<div class="scard-head">
<div class="scard-accent" style="background:var(--blue)"></div>
<div class="scard-title">Room &amp; Leakage Inputs</div>
</div>
<div class="scard-body">
<div class="input-group">
<div class="input-label">Target pressure differential <span class="input-unit" id="rp-pa-unit">Pa</span>
</div><input class="inp" id="rp-pa" data-action-input="calcRoomPress()" placeholder="e.g. 12.5" step="2.5" type="number"/>
</div>
<div class="input-group">
<div class="input-label">Room type / target</div>
<select class="inp inp-select" id="rp-type" data-action-change="setRPTarget(this)">
<option value="12.5">Clean corridor / ward - +12.5 Pa</option>
<option value="25">Operating theatre - +25 Pa</option>
<option value="-8">Isolation room - −8 Pa (negative)</option>
<option value="8">Pharmacy / clean room - +8 Pa</option>
<option value="custom">Custom…</option>
</select>
</div>
<div class="input-group">
<div class="input-label">Room door gap area <span class="input-unit">cm²</span></div><input class="inp" id="rp-gap" data-action-input="calcRoomPress()" placeholder="e.g. 40" type="number"/>
</div>
<div class="input-group">
<div class="input-label">Wall leakage area (all surfaces) <span class="input-unit">cm²</span></div>
<input class="inp" id="rp-wall" data-action-input="calcRoomPress()" placeholder="e.g. 30" type="number"/>
</div>
<div class="input-group">
<div class="input-label">Room supply airflow <span class="input-unit" id="rp-cfm-unit">CFM</span></div>
<input class="inp" id="rp-supply" data-action-input="calcRoomPress()" placeholder="e.g. 1000" type="number"/>
</div>
</div>
</div>
<button class="calc-btn blue" data-action-click="calcRoomPress();showRes('roompress-res')">⚡ Calculate
          Pressurization</button>
<div id="roompress-res" style="display:none">
<div class="scard">
<div class="scard-head">
<div class="scard-accent" style="background:var(--blue)"></div>
<div class="scard-title">Pressurization Results</div>
</div>
<div class="scard-body">
<div class="res-row">
<div class="res-label">Leakage flow at target ΔP</div>
<div class="res-val" id="rp-r-leak">-</div>
</div>
<div class="res-row">
<div class="res-label">Required exhaust airflow</div>
<div class="res-val primary" id="rp-r-exhaust">-</div>
</div>
<div class="res-row">
<div class="res-label">Supply/exhaust imbalance</div>
<div class="res-val primary" id="rp-r-imbal">-</div>
</div>
<div class="res-row">
<div class="res-label">Target ΔP</div>
<div class="res-val" id="rp-r-dp">-</div>
</div>
<div class="res-row">
<div class="res-label">Pressurization direction</div>
<div class="res-val" id="rp-r-dir">-</div>
</div>
</div>
</div>
</div>
</div>
`;

window.CalculatorTemplates['insulation'] = `
<div class="page" id="page-insulation">
<div class="calc-header">
<div class="calc-title">Insulation Thickness Estimator</div>
<div class="calc-std">Pipe &amp; duct insulation - heat loss / anti-condensation</div>
</div>
<div class="calc-desc">Estimate minimum insulation thickness for pipes and ducts to limit heat loss or prevent
          condensation. Based on steady-state cylindrical heat transfer (pipes) or flat wall (ducts).</div>
<div class="scard">
<div class="scard-head">
<div class="scard-accent" style="background:var(--blue)"></div>
<div class="scard-title">System Type &amp; Conditions</div>
</div>
<div class="scard-body">
<div class="input-group">
<div class="input-label">Application</div>
<select class="inp inp-select" id="ins-app" data-action-change="calcInsulation()">
<option value="pipe-chw">Chilled water pipe (anti-condensation)</option>
<option value="pipe-hw">Hot water pipe (heat loss limit)</option>
<option value="duct-supply">Supply air duct (anti-condensation)</option>
<option value="duct-exhaust">Exhaust / hot air duct (heat loss)</option>
<option value="pipe-ref">Refrigerant suction pipe</option>
</select>
</div>
<div class="input-group">
<div class="input-label">Fluid / air temperature <span class="input-unit" id="ins-tf-unit">°F</span>
</div><input class="inp" id="ins-tf" data-action-input="calcInsulation()" placeholder="e.g. 45" type="number"/>
</div>
<div class="input-group">
<div class="input-label">Ambient temperature <span class="input-unit" id="ins-ta-unit">°F</span></div>
<input class="inp" id="ins-ta" data-action-input="calcInsulation()" placeholder="e.g. 86" type="number"/>
</div>
<div class="input-group">
<div class="input-label">Ambient relative humidity <span class="input-unit">%</span></div><input class="inp" id="ins-rh" data-action-input="calcInsulation()" placeholder="e.g. 70" type="number"/>
</div>
<div class="input-group">
<div class="input-label">Pipe outer diameter / duct perimeter <span class="input-unit">mm</span></div>
<input class="inp" id="ins-od" data-action-input="calcInsulation()" placeholder="e.g. 60" type="number"/>
</div>
<div class="input-group">
<div class="input-label">Insulation thermal conductivity (k) <span class="input-unit">W/m·K</span></div>
<select class="inp inp-select" id="ins-k" data-action-change="calcInsulation()">
<option value="0.035">Foam glass - 0.035</option>
<option selected="" value="0.038">Mineral wool - 0.038</option>
<option value="0.030">Elastomeric foam (Armaflex) - 0.030</option>
<option value="0.025">PIR / polyisocyanurate - 0.025</option>
</select>
</div>
</div>
</div>
<button class="calc-btn blue" data-action-click="calcInsulation();showRes('ins-res')">⚡ Estimate Insulation</button>
<div id="ins-res" style="display:none">
<div id="ins-warn-area"></div>
<div class="scard">
<div class="scard-head">
<div class="scard-accent" style="background:var(--blue)"></div>
<div class="scard-title">Insulation Recommendation</div>
</div>
<div class="scard-body">
<div class="res-row">
<div class="res-label">Dew point temperature</div>
<div class="res-val" id="ins-r-dp">-</div>
</div>
<div class="res-row">
<div class="res-label">Temperature difference</div>
<div class="res-val" id="ins-r-dt">-</div>
</div>
<div class="res-row">
<div class="res-label">Minimum insulation thickness</div>
<div class="res-val primary" id="ins-r-thick">-</div>
</div>
<div class="res-row">
<div class="res-label">Recommended (next standard size)</div>
<div class="res-val primary" id="ins-r-std">-</div>
</div>
<div class="res-row">
<div class="res-label">Heat gain / loss at recommended</div>
<div class="res-val" id="ins-r-heat">-</div>
</div>
<div class="res-row">
<div class="res-label">Condensation risk</div>
<div class="res-val" id="ins-r-cond-risk">-</div>
</div>
</div>
</div>
</div>
</div>
`;

window.CalculatorTemplates['ach-rec'] = `
<div class="page" id="page-ach-rec">
<div class="calc-header">
<div class="calc-title">ACH Recommendation Tool</div>
<div class="calc-std">ASHRAE 62.1 / HTM / CIBSE reference levels</div>
</div>
<div class="calc-desc">Quick reference for recommended air change rates (ACH) by space type. Use as input for
          VENTILATION calculator or to validate existing system design.</div>
<div class="scard">
<div class="scard-head">
<div class="scard-accent" style="background:var(--blue)"></div>
<div class="scard-title">Space Selection</div>
</div>
<div class="scard-body">
<div class="input-group">
<div class="input-label">Building type</div>
<select class="inp inp-select" id="ach-cat" data-action-change="updateACHRec()">
<option value="office">Office / Commercial</option>
<option value="health">Healthcare</option>
<option value="industrial">Industrial / Lab</option>
<option value="residential">Residential</option>
<option value="hospitality">Hotel / Restaurant</option>
</select>
</div>
<div class="input-group">
<div class="input-label">Space type</div><select class="inp inp-select" id="ach-space" data-action-change="updateACHRec()"></select>
</div>
<div class="input-group">
<div class="input-label">Room volume <span class="input-unit" id="ach-vol-unit">ft³</span></div><input class="inp" id="ach-vol" data-action-input="updateACHRec()" placeholder="e.g. 5000" type="number"/>
</div>
</div>
</div>
<div id="ach-rec-card" style="display:none">
<div class="scard">
<div class="scard-head">
<div class="scard-accent" style="background:var(--blue)"></div>
<div class="scard-title">Recommended ACH</div>
</div>
<div class="scard-body">
<div class="res-row">
<div class="res-label">Recommended ACH range</div>
<div class="res-val primary" id="ach-r-range">-</div>
</div>
<div class="res-row">
<div class="res-label">Design ACH (midpoint)</div>
<div class="res-val" id="ach-r-design">-</div>
</div>
<div class="res-row">
<div class="res-label">Required airflow (design ACH)</div>
<div class="res-val primary" id="ach-r-cfm">-</div>
</div>
<div class="res-row">
<div class="res-label">Pressure requirement</div>
<div class="res-val" id="ach-r-press">-</div>
</div>
<div class="res-row">
<div class="res-label">Standard reference</div>
<div class="res-val" id="ach-r-std">-</div>
</div>
<div class="res-row">
<div class="res-label">Notes</div>
<div class="res-val" id="ach-r-notes" style="font-size:11px;text-align:right;max-width:55%;white-space:normal">-</div>
</div>
</div>
</div>
</div>
</div>
`;

window.CalculatorTemplates['sprinkler-density'] = `
<div class="page" id="page-sprinkler-density">
<div class="calc-header" style="background:linear-gradient(135deg,#f78f22,#d17914)">
<div class="calc-title">Sprinkler Density &amp; Flow</div>
<div class="calc-std">NFPA 13 - design density method</div>
</div>
<div class="calc-desc red">Calculate sprinkler flow requirement from design density and coverage area. NFPA 13
          density/area method - preliminary sizing only, not full hydraulic network analysis.</div>
<div class="scard">
<div class="scard-head">
<div class="scard-accent" style="background:var(--red)"></div>
<div class="scard-title">Hazard Classification</div>
</div>
<div class="scard-body">
<div class="input-group">
<div class="input-label">Hazard category (NFPA 13)</div>
<select class="inp inp-select" id="sd-hazard" data-action-change="calcSprinklerDensity()">
<option value="0.10,1500">Light Hazard - 0.10 GPM/ft² / 1500 ft²</option>
<option selected="" value="0.15,1500">Ordinary Hazard Gp 1 - 0.15 / 1500 ft²</option>
<option value="0.20,1500">Ordinary Hazard Gp 2 - 0.20 / 1500 ft²</option>
<option value="0.30,2500">Extra Hazard Gp 1 - 0.30 / 2500 ft²</option>
<option value="0.40,2500">Extra Hazard Gp 2 - 0.40 / 2500 ft²</option>
<option value="custom,custom">Custom…</option>
</select>
</div>
<div id="sd-custom-row" style="display:none">
<div class="input-group">
<div class="input-label">Custom density <span class="input-unit">GPM/ft²</span></div><input class="inp" id="sd-custom-dens" data-action-input="calcSprinklerDensity()" placeholder="e.g. 0.20" step="0.01" type="number"/>
</div>
<div class="input-group">
<div class="input-label">Custom design area <span class="input-unit">ft²</span></div><input class="inp" id="sd-custom-area" data-action-input="calcSprinklerDensity()" placeholder="e.g. 1500" type="number"/>
</div>
</div>
<div class="input-group">
<div class="input-label">Coverage area per sprinkler <span class="input-unit" id="sd-cov-unit">ft²</span>
</div><input class="inp" id="sd-coverage" data-action-input="calcSprinklerDensity()" placeholder="e.g. 130" type="number"/>
</div>
<div class="input-group">
<div class="input-label">Sprinkler K-factor <span class="input-unit">GPM/√psi</span></div><input class="inp" id="sd-k" data-action-input="calcSprinklerDensity()" placeholder="e.g. 5.6" step="0.1" type="number"/>
</div>
</div>
</div>
<button class="calc-btn red" data-action-click="calcSprinklerDensity();showRes('sd-res')">⚡ Calculate Sprinkler
          Flow</button>
<div id="sd-res" style="display:none">
<div id="sd-warn-area"></div>
<div class="scard">
<div class="scard-head">
<div class="scard-accent" style="background:var(--red)"></div>
<div class="scard-title">Sprinkler System Flow</div>
</div>
<div class="scard-body">
<div class="res-row">
<div class="res-label">Design density</div>
<div class="res-val" id="sd-r-dens">-</div>
</div>
<div class="res-row">
<div class="res-label">Design area</div>
<div class="res-val" id="sd-r-area">-</div>
</div>
<div class="res-row">
<div class="res-label">Flow per sprinkler (min)</div>
<div class="res-val" id="sd-r-per-sprink">-</div>
</div>
<div class="res-row">
<div class="res-label">Min operating pressure (K=<span id="sd-r-k-disp">5.6</span>)</div>
<div class="res-val" id="sd-r-press">-</div>
</div>
<div class="res-row">
<div class="res-label">Number of sprinklers in design area</div>
<div class="res-val" id="sd-r-count">-</div>
</div>
<div class="res-row">
<div class="res-label">Total sprinkler demand (design area)</div>
<div class="res-val primary" id="sd-r-total" style="color:var(--red)">-</div>
</div>
<div class="res-row">
<div class="res-label">Add hose allowance (NFPA 13)</div>
<div class="res-val" id="sd-r-hose">-</div>
</div>
<div class="res-row">
<div class="res-label">Total system demand</div>
<div class="res-val primary" id="sd-r-system" style="color:var(--red)">-</div>
</div>
</div>
</div>
</div>
</div>
`;

window.CalculatorTemplates['equiv-length'] = `
<div class="page" id="page-equiv-length">
<div class="calc-header" style="background:linear-gradient(135deg,#f78f22,#d17914)">
<div class="calc-title">Equivalent Length Calculator</div>
<div class="calc-std">Fitting losses as equivalent pipe length - NFPA 13 basis</div>
</div>
<div class="calc-desc red">Convert pipe fittings and valves to equivalent lengths of straight pipe for use in
          Hazen-Williams friction loss calculations.</div>
<div class="scard">
<div class="scard-head">
<div class="scard-accent" style="background:var(--red)"></div>
<div class="scard-title">Pipe Size</div>
</div>
<div class="scard-body">
<div class="input-group">
<div class="input-label">Nominal pipe size <span class="input-unit">NPS inches</span></div>
<select class="inp inp-select" id="el-pipe" data-action-change="calcEquivLength()">
<option value="1">1"</option>
<option value="1.25">1¼"</option>
<option value="1.5">1½"</option>
<option selected="" value="2">2"</option>
<option value="2.5">2½"</option>
<option value="3">3"</option>
<option value="4">4"</option>
<option value="6">6"</option>
<option value="8">8"</option>
</select>
</div>
</div>
</div>
<div class="scard">
<div class="scard-head">
<div class="scard-accent" style="background:var(--red)"></div>
<div class="scard-title">Fitting Quantities</div>
</div>
<div class="scard-body" id="el-fitting-rows"></div>
</div>
<div class="scard">
<div class="scard-head">
<div class="scard-accent" style="background:var(--red)"></div>
<div class="scard-title">Pipe Run</div>
</div>
<div class="scard-body">
<div class="input-group">
<div class="input-label">Actual pipe length <span class="input-unit" id="el-len-unit">ft</span></div>
<input class="inp" id="el-pipelen" data-action-input="calcEquivLength()" placeholder="e.g. 100" type="number"/>
</div>
</div>
</div>
<button class="calc-btn red" data-action-click="calcEquivLength();showRes('el-res')">⚡ Calculate Equivalent
          Length</button>
<div id="el-res" style="display:none">
<div class="scard">
<div class="scard-head">
<div class="scard-accent" style="background:var(--red)"></div>
<div class="scard-title">Results</div>
</div>
<div class="scard-body">
<div class="res-row">
<div class="res-label">Actual pipe length</div>
<div class="res-val" id="el-r-pipe">-</div>
</div>
<div class="res-row">
<div class="res-label">Total fitting equivalent length</div>
<div class="res-val" id="el-r-fittings">-</div>
</div>
<div class="res-row">
<div class="res-label">Total equivalent length</div>
<div class="res-val primary" id="el-r-total" style="color:var(--red)">-</div>
</div>
<div class="res-row">
<div class="res-label">Fitting allowance</div>
<div class="res-val" id="el-r-pct">-</div>
</div>
</div>
</div>
</div>
</div>
`;

window.CalculatorTemplates['fire-water-demand'] = `
<div class="page" id="page-fire-water-demand">
<div class="calc-header" style="background:linear-gradient(135deg,#f78f22,#d17914)">
<div class="calc-title">Fire Water Demand Calculator</div>
<div class="calc-std">Simultaneous demand - sprinkler + hydrant + hose reel</div>
</div>
<div class="calc-desc red">Calculate total fire water demand for pump and tank sizing. Combines sprinkler
          demand, hydrant flow, and hose reel flow per simultaneous operation requirements.</div>
<div class="scard">
<div class="scard-head">
<div class="scard-accent" style="background:var(--red)"></div>
<div class="scard-title">Sprinkler Demand</div>
</div>
<div class="scard-body">
<div class="input-group">
<div class="input-label">Sprinkler system flow <span class="input-unit" id="fwd-sp-unit">GPM</span>
</div><input class="inp" id="fwd-sp-flow" data-action-input="calcFireWaterDemand()" placeholder="e.g. 500" step="10" type="number"/>
</div>
<div class="input-group">
<div class="input-label">Sprinkler residual pressure required <span class="input-unit">psi</span></div>
<input class="inp" id="fwd-sp-press" data-action-input="calcFireWaterDemand()" placeholder="e.g. 100" type="number"/>
</div>
</div>
</div>
<div class="scard">
<div class="scard-head">
<div class="scard-accent" style="background:var(--red)"></div>
<div class="scard-title">Hydrant Demand (external)</div>
</div>
<div class="scard-body">
<div class="input-group">
<div class="input-label">Number of simultaneous hydrants</div><input class="inp" id="fwd-hy-count" min="0" data-action-input="calcFireWaterDemand()" placeholder="e.g. 2" type="number"/>
</div>
<div class="input-group">
<div class="input-label">Flow per hydrant <span class="input-unit" id="fwd-hy-unit">GPM</span></div>
<input class="inp" id="fwd-hy-flow" data-action-input="calcFireWaterDemand()" placeholder="e.g. 250" step="50" type="number"/>
</div>
</div>
</div>
<div class="scard">
<div class="scard-head">
<div class="scard-accent" style="background:var(--red)"></div>
<div class="scard-title">Hose Reel Demand</div>
</div>
<div class="scard-body">
<div class="input-group">
<div class="input-label">Number of simultaneous hose reels</div><input class="inp" id="fwd-hr-count" min="0" data-action-input="calcFireWaterDemand()" placeholder="e.g. 2" type="number"/>
</div>
<div class="input-group">
<div class="input-label">Flow per hose reel <span class="input-unit" id="fwd-hr-unit">GPM</span></div>
<input class="inp" id="fwd-hr-flow" data-action-input="calcFireWaterDemand()" placeholder="e.g. 26" step="1" type="number"/>
</div>
</div>
</div>
<button class="calc-btn red" data-action-click="calcFireWaterDemand();showRes('fwd-res')">⚡ Calculate Total
          Demand</button>
<div id="fwd-res" style="display:none">
<div id="fwd-warn-area"></div>
<div class="scard">
<div class="scard-head">
<div class="scard-accent" style="background:var(--red)"></div>
<div class="scard-title">Fire Water Demand Summary</div>
</div>
<div class="scard-body">
<div class="res-row">
<div class="res-label">Sprinkler demand</div>
<div class="res-val" id="fwd-r-sp">-</div>
</div>
<div class="res-row">
<div class="res-label">Hydrant demand</div>
<div class="res-val" id="fwd-r-hy">-</div>
</div>
<div class="res-row">
<div class="res-label">Hose reel demand</div>
<div class="res-val" id="fwd-r-hr">-</div>
</div>
<div class="res-row">
<div class="res-label">Total simultaneous demand</div>
<div class="res-val primary" id="fwd-r-total" style="color:var(--red)">-</div>
</div>
<div class="res-row">
<div class="res-label">Design pump capacity (min)</div>
<div class="res-val primary" id="fwd-r-pump" style="color:var(--red)">-</div>
</div>
<div class="res-row">
<div class="res-label">Tank sizing basis (60 min)</div>
<div class="res-val" id="fwd-r-tank60">-</div>
</div>
<div class="res-row">
<div class="res-label">Tank sizing basis (90 min)</div>
<div class="res-val" id="fwd-r-tank90">-</div>
</div>
</div>
</div>
</div>
</div>
`;

window.CalculatorTemplates['fm200'] = `
<div class="page" id="page-fm200">
<div class="calc-header" style="background:linear-gradient(135deg,#f78f22,#d17914)">
<div class="calc-title">FM-200 Calculation</div>
<div class="calc-std">Clean Agent Fire Suppression System Design (NFPA 2001)</div>
</div>
<div class="calc-desc red">Calculate the volume and required weight of FM-200 (HFC-227ea) clean agent for a total flooding fire suppression system per NFPA 2001.</div>
<div class="scard">
<div class="scard-head">
<div class="scard-accent" style="background:var(--red)"></div>
<div class="scard-title">Enclosure Dimensions</div>
</div>
<div class="scard-body">
<div class="input-group">
<div class="input-label">Area <span class="input-unit">Sq.Mtr</span></div>
<input class="inp" id="fm-area" data-action-input="calcFM200()" placeholder="e.g. 100" step="0.1" type="number"/>
</div>
<div class="input-group">
<div class="input-label">Height <span class="input-unit">Mtr</span></div>
<input class="inp" id="fm-height" data-action-input="calcFM200()" placeholder="e.g. 3" step="0.1" type="number"/>
</div>
</div>
</div>
<button class="calc-btn red" data-action-click="calcFM200();showRes('fm200-res')">⚡ Calculate FM-200 Weight</button>
<div id="fm200-res" style="display:none">
<div id="fm-warn-area"></div>
<div class="scard">
<div class="scard-head">
<div class="scard-accent" style="background:var(--red)"></div>
<div class="scard-title">Calculation Results</div>
</div>
<div class="scard-body">
<div class="res-row">
<div class="res-label">Area</div>
<div class="res-val" id="fm-r-area">-</div>
</div>
<div class="res-row">
<div class="res-label">Height</div>
<div class="res-val" id="fm-r-height">-</div>
</div>
<div class="res-row">
<div class="res-label">Volume</div>
<div class="res-val primary" id="fm-r-volume" style="color:var(--red)">-</div>
</div>
<div class="res-row">
<div class="res-label">S Value</div>
<div class="res-val" id="fm-r-s">-</div>
</div>
<div class="res-row">
<div class="res-label">C Value</div>
<div class="res-val" id="fm-r-c">-</div>
</div>
<div class="res-row">
<div class="res-label">FM-200 Clean Agent Weight</div>
<div class="res-val primary" id="fm-r-weight" style="color:var(--red)">-</div>
</div>
</div>
</div>
</div>
</div>
`;

window.CalculatorTemplates['fire-pipe-check'] = `
<div class="page" id="page-fire-pipe-check">
<div class="calc-header" style="background:linear-gradient(135deg,#f78f22,#d17914)">
<div class="calc-title">Fire Pipe Design Check</div>
<div class="calc-std">Velocity · friction · pressure - design assistant</div>
</div>
<div class="calc-desc red">Enter fire protection pipe design values and get instant engineering feedback on
          velocity, friction loss, and pressure adequacy per NFPA 13/14/20 guidelines.</div>
<div class="scard">
<div class="scard-head">
<div class="scard-accent" style="background:var(--red)"></div>
<div class="scard-title">Pipe System Parameters</div>
</div>
<div class="scard-body">
<div class="input-group">
<div class="input-label">Pipe velocity <span class="input-unit" id="fpc-vel-unit">fps</span></div><input class="inp" id="fpc-vel" data-action-input="runFirePipeCheck()" placeholder="e.g. 8" step="0.5" type="number"/>
</div>
<div class="input-group">
<div class="input-label">Friction loss per foot <span class="input-unit" id="fpc-fr-unit">psi/ft</span>
</div><input class="inp" id="fpc-fr" data-action-input="runFirePipeCheck()" placeholder="e.g. 0.005" step="0.001" type="number"/>
</div>
<div class="input-group">
<div class="input-label">Residual pressure at remote head <span class="input-unit">psi</span></div>
<input class="inp" id="fpc-resid" data-action-input="runFirePipeCheck()" placeholder="e.g. 18" type="number"/>
</div>
<div class="input-group">
<div class="input-label">Pump discharge pressure <span class="input-unit">psi</span></div><input class="inp" id="fpc-pump" data-action-input="runFirePipeCheck()" placeholder="e.g. 150" type="number"/>
</div>
<div class="input-group">
<div class="input-label">Max system pressure (churn) <span class="input-unit">psi</span></div><input class="inp" id="fpc-churn" data-action-input="runFirePipeCheck()" placeholder="e.g. 175" type="number"/>
</div>
</div>
</div>
<button class="calc-btn red" data-action-click="runFirePipeCheck();showRes('fpc-res')">🔍 Run Fire Pipe Check</button>
<div id="fpc-res" style="display:none">
<div class="scard">
<div class="scard-head">
<div class="scard-accent" style="background:var(--red)"></div>
<div class="scard-title">Design Check Results</div>
</div>
<div class="scard-body" id="fpc-results-body"></div>
</div>
</div>
</div>
`;

window.CalculatorTemplates['pump-suction'] = `
<div class="page" id="page-pump-suction">
<div class="calc-header" style="background:linear-gradient(135deg,#f78f22,#d17914)">
<div class="calc-title">Pump Suction / NPSH Check</div>
<div class="calc-std">NPSH available - cavitation prevention - simplified</div>
</div>
<div class="calc-desc red"><strong>Simplified NPSH estimation.</strong> Actual NPSH required (NPSHr) must be
          obtained from the pump manufacturer's performance curve. This tool estimates NPSH available (NPSHa) to
          verify margin.</div>
<div class="scard">
<div class="scard-head">
<div class="scard-accent" style="background:var(--red)"></div>
<div class="scard-title">Suction Conditions</div>
</div>
<div class="scard-body">
<div class="input-group">
<div class="input-label">Suction source type</div>
<select class="inp inp-select" id="ns-source" data-action-change="calcNPSH()">
<option value="flooded">Flooded suction (tank above pump)</option>
<option selected="" value="lift">Suction lift (pump above tank)</option>
</select>
</div>
<div class="input-group">
<div class="input-label">Suction head / lift <span class="input-unit" id="ns-hs-unit">ft (+ve = flooded,
                  −ve = lift)</span></div><input class="inp" id="ns-hs" data-action-input="calcNPSH()" placeholder="e.g. -5" step="0.5" type="number"/>
</div>
<div class="input-group">
<div class="input-label">Suction pipe friction loss <span class="input-unit" id="ns-hf-unit">ft</span>
</div><input class="inp" id="ns-hf" data-action-input="calcNPSH()" placeholder="e.g. 3" step="0.5" type="number"/>
</div>
<div class="input-group">
<div class="input-label">Water temperature <span class="input-unit" id="ns-temp-unit">°F</span></div>
<input class="inp" id="ns-temp" data-action-input="calcNPSH()" placeholder="e.g. 68" type="number"/>
</div>
<div class="input-group">
<div class="input-label">Site elevation <span class="input-unit">ft above sea level</span></div><input class="inp" id="ns-elev" data-action-input="calcNPSH()" placeholder="e.g. 0" type="number"/>
</div>
<div class="input-group">
<div class="input-label">Pump manufacturer NPSHr <span class="input-unit">ft</span></div><input class="inp" id="ns-npshr" data-action-input="calcNPSH()" placeholder="e.g. 15" type="number"/>
</div>
</div>
</div>
<button class="calc-btn red" data-action-click="calcNPSH();showRes('ns-res')">⚡ Check NPSH</button>
<div id="ns-res" style="display:none">
<div id="ns-warn-area"></div>
<div class="scard">
<div class="scard-head">
<div class="scard-accent" style="background:var(--red)"></div>
<div class="scard-title">NPSH Analysis</div>
</div>
<div class="scard-body">
<div class="res-row">
<div class="res-label">Atmospheric pressure head</div>
<div class="res-val" id="ns-r-atm">-</div>
</div>
<div class="res-row">
<div class="res-label">Vapour pressure head</div>
<div class="res-val" id="ns-r-vp">-</div>
</div>
<div class="res-row">
<div class="res-label">Static suction head (±)</div>
<div class="res-val" id="ns-r-hs">-</div>
</div>
<div class="res-row">
<div class="res-label">Suction friction losses</div>
<div class="res-val" id="ns-r-hf">-</div>
</div>
<div class="res-row">
<div class="res-label">NPSHa (available)</div>
<div class="res-val primary" id="ns-r-npsha" style="color:var(--red)">-</div>
</div>
<div class="res-row">
<div class="res-label">NPSHr (required - manufacturer)</div>
<div class="res-val" id="ns-r-npshr">-</div>
</div>
<div class="res-row">
<div class="res-label">NPSH margin</div>
<div class="res-val" id="ns-r-margin">-</div>
</div>
<div class="res-row">
<div class="res-label">Status</div>
<div class="res-val" id="ns-r-status">-</div>
</div>
</div>
</div>
</div>
</div>
`;

window.CalculatorTemplates['tank-duration'] = `
<div class="page" id="page-tank-duration">
<div class="calc-header" style="background:linear-gradient(135deg,#f78f22,#d17914)">
<div class="calc-title">Tank Duration / Refill Calculator</div>
<div class="calc-std">NFPA 22 - duration validation &amp; refill time</div>
</div>
<div class="calc-desc red">Validate fire water tank capacity against required duration, and estimate refill
          time from mains supply. Cross-checks against NFPA 22 basis.</div>
<div class="scard">
<div class="scard-head">
<div class="scard-accent" style="background:var(--red)"></div>
<div class="scard-title">Demand &amp; Duration</div>
</div>
<div class="scard-body">
<div class="input-group">
<div class="input-label">Total fire water demand <span class="input-unit" id="td-dem-unit">GPM</span>
</div><input class="inp" id="td-demand" data-action-input="calcTankDuration()" placeholder="e.g. 750" step="25" type="number"/>
</div>
<div class="input-group">
<div class="input-label">Required duration <span class="input-unit">minutes</span></div>
<select class="inp inp-select" id="td-dur" data-action-change="calcTankDuration()">
<option value="30">30 min - light hazard</option>
<option selected="" value="60">60 min - ordinary hazard</option>
<option value="90">90 min - extra hazard</option>
<option value="120">120 min - high-rise / special</option>
<option value="custom">Custom…</option>
</select>
</div>
<div class="input-group" id="td-custom-row" style="display:none">
<div class="input-label">Custom duration <span class="input-unit">minutes</span></div><input class="inp" id="td-custom-dur" data-action-input="calcTankDuration()" placeholder="e.g. 60" type="number"/>
</div>
<div class="input-group">
<div class="input-label">Actual tank capacity <span class="input-unit" id="td-tank-unit">gal</span>
</div><input class="inp" id="td-tank" data-action-input="calcTankDuration()" placeholder="e.g. 50000" step="1000" type="number"/>
</div>
</div>
</div>
<div class="scard">
<div class="scard-head">
<div class="scard-accent" style="background:var(--red)"></div>
<div class="scard-title">Refill Conditions</div>
</div>
<div class="scard-body">
<div class="input-group">
<div class="input-label">Mains refill rate <span class="input-unit" id="td-refill-unit">GPM</span></div>
<input class="inp" id="td-refill" data-action-input="calcTankDuration()" placeholder="e.g. 100" type="number"/>
</div>
</div>
</div>
<button class="calc-btn red" data-action-click="calcTankDuration();showRes('td-res')">⚡ Validate Tank</button>
<div id="td-res" style="display:none">
<div id="td-warn-area"></div>
<div class="scard">
<div class="scard-head">
<div class="scard-accent" style="background:var(--red)"></div>
<div class="scard-title">Tank Duration Analysis</div>
</div>
<div class="scard-body">
<div class="res-row">
<div class="res-label">Required volume</div>
<div class="res-val" id="td-r-req">-</div>
</div>
<div class="res-row">
<div class="res-label">Tank capacity</div>
<div class="res-val" id="td-r-tank">-</div>
</div>
<div class="res-row">
<div class="res-label">Actual duration at design demand</div>
<div class="res-val primary" id="td-r-actual" style="color:var(--red)">-</div>
</div>
<div class="res-row">
<div class="res-label">Required duration</div>
<div class="res-val" id="td-r-required">-</div>
</div>
<div class="res-row">
<div class="res-label">Capacity status</div>
<div class="res-val" id="td-r-status">-</div>
</div>
<div class="res-row">
<div class="res-label">Full refill time (from empty)</div>
<div class="res-val" id="td-r-refill">-</div>
</div>
</div>
</div>
</div>
</div>
`;

window.CalculatorTemplates['hose-coverage'] = `
<div class="page" id="page-hose-coverage">
<div class="calc-header" style="background:linear-gradient(135deg,#f78f22,#d17914)">
<div class="calc-title">Hose Reel / Hydrant Coverage</div>
<div class="calc-std">Coverage radius · area · outlet count</div>
</div>
<div class="calc-desc red">Calculate effective coverage area for hose reels and hydrants, and determine the
          minimum number of outlets required to cover a floor area.</div>
<div class="scard">
<div class="scard-head">
<div class="scard-accent" style="background:var(--red)"></div>
<div class="scard-title">Outlet Parameters</div>
</div>
<div class="scard-body">
<div class="input-group">
<div class="input-label">Type</div>
<div class="chip-row">
<div class="chip sel sel-red" data-action-click="setHoseType(this,'reel')">Hose Reel</div>
<div class="chip" data-action-click="setHoseType(this,'hydrant')">Hose-down Hydrant</div>
<div class="chip" data-action-click="setHoseType(this,'monitor')">Monitor / Deluge</div>
</div>
</div>
<div class="input-group" style="margin-top:12px">
<div class="input-label">Hose length <span class="input-unit" id="hc-len-unit">ft</span></div><input class="inp" id="hc-len" data-action-input="calcHoseCoverage()" placeholder="e.g. 100" type="number"/>
</div>
<div class="input-group">
<div class="input-label">Effective reach beyond hose end <span class="input-unit" id="hc-reach-unit">ft</span></div><input class="inp" id="hc-reach" data-action-input="calcHoseCoverage()" placeholder="e.g. 20" type="number"/>
</div>
<div class="input-group">
<div class="input-label">Floor / protection area <span class="input-unit" id="hc-area-unit">ft²</span>
</div><input class="inp" id="hc-area" data-action-input="calcHoseCoverage()" placeholder="e.g. 10000" step="500" type="number"/>
</div>
<div class="input-group">
<div class="input-label">Obstruction factor <span class="input-unit">0.5 = heavy obstacles, 1.0 =
                  open</span></div><input class="inp" id="hc-obs" max="1.0" min="0.3" data-action-input="calcHoseCoverage()" placeholder="e.g. 0.8" step="0.1" type="number"/>
</div>
</div>
</div>
<button class="calc-btn red" data-action-click="calcHoseCoverage();showRes('hc-res')">⚡ Calculate Coverage</button>
<div id="hc-res" style="display:none">
<div id="hc-warn-area"></div>
<div class="scard">
<div class="scard-head">
<div class="scard-accent" style="background:var(--red)"></div>
<div class="scard-title">Coverage Results</div>
</div>
<div class="scard-body">
<div class="res-row">
<div class="res-label">Effective radius (hose + jet)</div>
<div class="res-val" id="hc-r-radius">-</div>
</div>
<div class="res-row">
<div class="res-label">Theoretical coverage per outlet</div>
<div class="res-val" id="hc-r-cov-th">-</div>
</div>
<div class="res-row">
<div class="res-label">Effective coverage (with obstruction factor)</div>
<div class="res-val primary" id="hc-r-cov-eff" style="color:var(--red)">-</div>
</div>
<div class="res-row">
<div class="res-label">Protection area to cover</div>
<div class="res-val" id="hc-r-protect">-</div>
</div>
<div class="res-row">
<div class="res-label">Minimum outlets required</div>
<div class="res-val primary" id="hc-r-count" style="color:var(--red)">-</div>
</div>
<div class="res-row">
<div class="res-label">Max spacing between outlets</div>
<div class="res-val" id="hc-r-spacing">-</div>
</div>
</div>
</div>
</div>
</div>
`;

window.CalculatorTemplates['water-hammer'] = `
<div class="page" id="page-water-hammer">
<div class="calc-header" style="background:linear-gradient(135deg,#f78f22,#d17914)">
<div class="calc-title">Water Hammer (Surge Pressure)</div>
<div class="calc-std">Joukowski equation - valve closure surge</div>
</div>
<div class="calc-desc green">Estimate surge pressure from rapid valve closure (water hammer). Checks if pipe
          pressure rating is adequate. Based on Joukowski equation.</div>
<div class="scard">
<div class="scard-head">
<div class="scard-accent" style="background:var(--green)"></div>
<div class="scard-title">System Inputs</div>
</div>
<div class="scard-body">
<div class="input-group">
<div class="input-label">Flow velocity <span class="input-unit" id="wh-v-unit">fps</span></div><input class="inp" id="wh-v" data-action-input="calcWaterHammer()" placeholder="e.g. 5" step="0.5" type="number"/>
</div>
<div class="input-group">
<div class="input-label">Pipe material</div>
<select class="inp inp-select" id="wh-mat" data-action-change="calcWaterHammer()">
<option value="1400">Steel - bulk modulus 1400 MPa</option>
<option value="100">PVC - 100 MPa</option>
<option value="800">Copper - 800 MPa</option>
<option value="1700">Ductile iron - 1700 MPa</option>
<option value="70">HDPE - 70 MPa</option>
</select>
</div>
<div class="input-group">
<div class="input-label">Pipe outer diameter <span class="input-unit">mm</span></div><input class="inp" id="wh-od" data-action-input="calcWaterHammer()" placeholder="e.g. 100" type="number"/>
</div>
<div class="input-group">
<div class="input-label">Pipe wall thickness <span class="input-unit">mm</span></div><input class="inp" id="wh-t" data-action-input="calcWaterHammer()" placeholder="e.g. 6" type="number"/>
</div>
<div class="input-group">
<div class="input-label">Normal operating pressure <span class="input-unit" id="wh-p-unit">psi</span>
</div><input class="inp" id="wh-p" data-action-input="calcWaterHammer()" placeholder="e.g. 60" type="number"/>
</div>
</div>
</div>
<button class="calc-btn green" data-action-click="calcWaterHammer();showRes('wh-res')">⚡ Calculate Surge
          Pressure</button>
<div id="wh-res" style="display:none">
<div id="wh-warn-area"></div>
<div class="scard">
<div class="scard-head">
<div class="scard-accent" style="background:var(--green)"></div>
<div class="scard-title">Water Hammer Results</div>
</div>
<div class="scard-body">
<div class="res-row">
<div class="res-label">Wave speed (a)</div>
<div class="res-val" id="wh-r-wave">-</div>
</div>
<div class="res-row">
<div class="res-label">Surge pressure (ΔP)</div>
<div class="res-val primary" id="wh-r-surge" style="color:var(--green)">-</div>
</div>
<div class="res-row">
<div class="res-label">Total pressure (operating + surge)</div>
<div class="res-val primary" id="wh-r-total" style="color:var(--green)">-</div>
</div>
<div class="res-row">
<div class="res-label">Surge vs operating ratio</div>
<div class="res-val" id="wh-r-ratio">-</div>
</div>
</div>
</div>
</div>
</div>
`;

window.CalculatorTemplates['elec-energy'] = `
<div class="page" id="page-elec-energy">
<div class="calc-header" style="background:linear-gradient(135deg,#f78f22,#d17914)">
<div class="calc-title">⚡ Energy Consumption Calculator</div>
<div class="calc-std">kWh / cost estimation - energy audit basis</div>
</div>
<div class="calc-desc" style="background:#FEF3C7;border-color:rgba(217,119,6,0.25)">Estimate electrical energy
          consumption and running cost for equipment and systems. Useful for energy audits, LEED calculations, and
          equipment justification studies.</div>
<div class="elec-unit-note">⚡ Electrical calculators use IEC/SI units (kW, V, A, kVA, mm²) regardless of the
          IP/SI toggle.</div>
<div class="scard">
<div class="scard-head">
<div class="scard-accent" style="background:var(--amber)"></div>
<div class="scard-title">Load Inputs</div>
</div>
<div class="scard-body" id="energy-load-rows"></div>
<div style="padding:10px 16px;border-top:1px solid var(--border)">
<button data-action-click="addEnergyLoad()" style="width:100%;padding:8px;border-radius:8px;border:1px dashed var(--amber);background:rgba(217,119,6,0.05);color:var(--amber);font-size:12px;font-weight:700;cursor:pointer;font-family:var(--font)">+
              Add Equipment</button>
</div>
</div>
<div class="scard">
<div class="scard-head">
<div class="scard-accent" style="background:var(--amber)"></div>
<div class="scard-title">Tariff</div>
</div>
<div class="scard-body">
<div class="input-group">
<div class="input-label">Energy tariff <span class="input-unit">$/kWh</span></div><input class="inp" id="energy-tariff" data-action-input="calcEnergy()" placeholder="e.g. 0.12" step="0.01" type="number"/>
</div>
<div class="input-group">
<div class="input-label">Operating days per year</div><input class="inp" id="energy-days" data-action-input="calcEnergy()" placeholder="e.g. 250" type="number"/>
</div>
</div>
</div>
<button class="calc-btn" data-action-click="calcEnergy();showRes('energy-res')" style="background:var(--amber)">⚡
          Calculate Energy Use</button>
<div id="energy-res" style="display:none">
<div class="scard">
<div class="scard-head">
<div class="scard-accent" style="background:var(--amber)"></div>
<div class="scard-title">Energy Summary</div>
</div>
<div class="scard-body">
<div class="res-row">
<div class="res-label">Total connected load</div>
<div class="res-val" id="energy-r-kw">-</div>
</div>
<div class="res-row">
<div class="res-label">Daily energy consumption</div>
<div class="res-val" id="energy-r-daily">-</div>
</div>
<div class="res-row">
<div class="res-label">Monthly energy (30 days)</div>
<div class="res-val primary" id="energy-r-monthly" style="color:var(--amber)">-</div>
</div>
<div class="res-row">
<div class="res-label">Annual energy</div>
<div class="res-val primary" id="energy-r-annual" style="color:var(--amber)">-</div>
</div>
<div class="res-row">
<div class="res-label">Annual running cost</div>
<div class="res-val primary" id="energy-r-cost" style="color:var(--amber)">-</div>
</div>
<div class="res-row">
<div class="res-label">Peak demand</div>
<div class="res-val" id="energy-r-peak">-</div>
</div>
</div>
</div>
</div>
</div>
`;

window.CalculatorTemplates['thumb-rules'] = `
<div class="page" id="page-thumb-rules">
<div class="calc-header">
<div class="calc-title">Thumb Rules</div>
<div class="calc-std">Quick engineering estimates - clearly labeled, never mistaken for calculations</div>
</div>
<div class="thumb-banner">
<div class="thumb-banner-icon">⚠</div>
<div class="thumb-banner-text"><strong>THUMB RULES ONLY.</strong> Quick estimates for preliminary design
            only. Always verify with full calculations before finalising any design.</div>
</div>
<div class="ref-search-wrap">
<span class="ref-search-icon">🔍</span>
<input autocomplete="off" class="ref-search-inp" id="thumb-search" data-action-input="buildRules()" placeholder="Search rules… e.g. CHW, duct velocity, pump…"/>
<span class="ref-search-clear" id="thumb-search-clear" data-action-click="document.getElementById('thumb-search').value='';buildRules()">✕</span>
</div>
<div class="rule-filter-bar" id="rule-filter"></div>
<div class="ref-count-bar" id="thumb-count"></div>
<div class="rules-grid" id="rules-list"></div>
</div>
`;

window.CalculatorTemplates['projects'] = `
<div class="page full-width-page" id="page-projects" style="padding: 24px; max-width: 100%">
  <!-- Redesigned Page Header -->
  <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:28px; border-bottom:1px solid var(--border); padding-bottom:20px; flex-wrap:wrap; gap:16px">
    <div>
      <h1 style="margin:0; font-size:28px; font-weight:800; color:var(--text); letter-spacing:-0.5px">PROJECTS</h1>
      <p style="margin:6px 0 0 0; font-size:14px; color:var(--muted)">Manage engineering projects and calculation workspaces</p>
    </div>
  </div>

  <!-- Redesigned New Project Form Card (Always Visible) -->
  <div class="scard" id="new-project-form" style="margin: 0 0 28px 0; border: 1.5px solid var(--brand); box-shadow: 0 10px 15px -3px rgba(0,0,0,0.05)">
    <div class="scard-head" style="border-bottom:1px solid var(--border); padding:16px 20px">
      <div class="scard-accent" style="background:var(--brand)"></div>
      <div class="scard-title" style="font-size:16px; font-weight:800">Create New Project Workspace</div>
    </div>
    <div class="scard-body" style="padding:20px; display:grid; grid-template-columns: repeat(auto-fit, minmax(280px, 1fr)); gap: 20px">
      <div class="input-group" style="margin:0">
        <div class="input-label" style="font-weight:700; font-size:12px; margin-bottom:6px">Project Name <span style="color:var(--red)">*</span></div>
        <input class="inp" id="new-proj-name" maxlength="60" placeholder="e.g. Dubai Mall Expansion" style="width:100%; box-sizing:border-box"/>
      </div>
      <div class="input-group" style="margin:0">
        <div class="input-label" style="font-weight:700; font-size:12px; margin-bottom:6px">Client Name</div>
        <input class="inp" id="new-proj-client" placeholder="e.g. Emaar" style="width:100%; box-sizing:border-box"/>
      </div>
      <div class="input-group" style="margin:0">
        <div class="input-label" style="font-weight:700; font-size:12px; margin-bottom:6px">Project Number</div>
        <input class="inp" id="new-proj-number" placeholder="e.g. PRJ-2026-001" style="width:100%; box-sizing:border-box"/>
      </div>
      <div class="input-group" style="margin:0">
        <div class="input-label" style="font-weight:700; font-size:12px; margin-bottom:6px">Location</div>
        <input class="inp" id="new-proj-location" placeholder="e.g. Dubai, UAE" style="width:100%; box-sizing:border-box"/>
      </div>
      <div class="input-group" style="grid-column: 1 / -1; margin:0">
        <div class="input-label" style="font-weight:700; font-size:12px; margin-bottom:6px">Description</div>
        <input class="inp" id="new-proj-desc" placeholder="Brief description of the engineering scope..." style="width:100%; box-sizing:border-box"/>
      </div>
      <div class="input-group" style="grid-column: 1 / -1; margin:0">
        <div class="input-label" style="font-weight:700; font-size:12px; margin-bottom:6px">Optional Notes</div>
        <textarea class="inp" id="new-proj-notes" rows="3" placeholder="Specify design codes, regulations, or overall standards (e.g. ASHRAE, NFPA, IBC)..." style="resize:vertical; font-family:inherit; width:100%; box-sizing:border-box"></textarea>
      </div>
      <div style="grid-column: 1 / -1; display:flex; gap:12px; margin-top:8px; justify-content:flex-end">
        <button class="calc-btn blue" data-action-click="window.ProjectService.submitCreateProject()" style="margin:0; padding:10px 24px; font-weight:700; font-size:13px; border-radius:8px">Create Project</button>
        <button data-action-click="document.getElementById('new-proj-name').value='';document.getElementById('new-proj-client').value='';document.getElementById('new-proj-number').value='';document.getElementById('new-proj-location').value='';document.getElementById('new-proj-desc').value='';document.getElementById('new-proj-notes').value=''" style="padding:10px 20px; border-radius:8px; border:1px solid var(--border); background:var(--card); cursor:pointer; font-family:var(--font); font-size:13px; font-weight:700; color:var(--muted)">Cancel</button>
      </div>
    </div>
  </div>

  <!-- Projects Grid container -->
  <div id="projects-list" style="margin-bottom: 20px; width: 100%"></div>
</div>
`;

window.CalculatorTemplates['settings'] = `
<div class="page" id="page-settings">
<div class="calc-header">
<div class="calc-title">Settings</div>
<div class="calc-std">App preferences</div>
</div>
<div class="scard">
<div class="scard-head">
<div class="scard-accent" style="background:var(--blue)"></div>
<div class="scard-title">Unit System</div>
</div>
<div class="scard-body">
<p style="font-size:13px;color:var(--muted);margin-bottom:14px;line-height:1.6">
<strong>IP (Imperial):</strong> BTU, °F, ft, GPM, psi, CFM, in w.g.<br/>
<strong>SI (Metric):</strong> kJ, °C, m, L/s, kPa, m³/s, Pa
            </p>
<div style="display:grid;grid-template-columns:1fr 1fr;gap:10px">
<div id="set-ip-btn" data-action-click="setUnit('ip')" style="padding:14px;border-radius:10px;border:2px solid var(--blue);background:var(--blue-lt);cursor:pointer;text-align:center">
<div style="font-size:20px;margin-bottom:6px">🇺🇸</div>
<div style="font-size:14px;font-weight:700;color:var(--blue)">IP - Imperial</div>
<div style="font-size:11px;color:var(--muted);margin-top:2px">Default</div>
</div>
<div id="set-si-btn" data-action-click="setUnit('si')" style="padding:14px;border-radius:10px;border:1px solid var(--border);background:var(--card);cursor:pointer;text-align:center">
<div style="font-size:20px;margin-bottom:6px">🌍</div>
<div style="font-size:14px;font-weight:700;color:var(--muted)">SI - Metric</div>
<div style="font-size:11px;color:var(--muted);margin-top:2px">International</div>
</div>
</div>
</div>
</div>
<div class="scard">
<div class="scard-head">
<div class="scard-accent" style="background:var(--blue)"></div>
<div class="scard-title">Theme</div>
</div>
<div class="scard-body">
<div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:8px">
<div id="theme-light-btn" data-action-click="setTheme('light')" style="padding:12px 8px;border-radius:10px;border:2px solid var(--blue);background:var(--blue-lt);cursor:pointer;text-align:center">
<div style="font-size:18px;margin-bottom:4px">☀️</div>
<div style="font-size:12px;font-weight:700;color:var(--blue)">Light</div>
</div>
<div id="theme-dark-btn" data-action-click="setTheme('dark')" style="padding:12px 8px;border-radius:10px;border:1px solid var(--border);background:var(--card);cursor:pointer;text-align:center">
<div style="font-size:18px;margin-bottom:4px">🌙</div>
<div style="font-size:12px;font-weight:700;color:var(--muted)">Dark</div>
</div>
<div id="theme-system-btn" data-action-click="setTheme('system')" style="padding:12px 8px;border-radius:10px;border:1px solid var(--border);background:var(--card);cursor:pointer;text-align:center">
<div style="font-size:18px;margin-bottom:4px">💻</div>
<div style="font-size:12px;font-weight:700;color:var(--muted)">System</div>
</div>
</div>
</div>
</div>
<div class="scard">
<div class="scard-head">
<div class="scard-accent" style="background:var(--blue)"></div>
<div class="scard-title">About MEP Design Calculation</div>
</div>
<div class="scard-body">
<div style="font-size:13px;font-weight:700;color:var(--text);margin-bottom:2px">MEP Design Calculation
            </div>
<div style="font-size:12px;color:var(--brand);font-weight:600;margin-bottom:10px"></div>
<div style="font-size:12px;color:var(--muted);line-height:1.7;margin-bottom:12px"></div>
<div style="display:flex;gap:6px;flex-wrap:wrap;margin-bottom:14px">
<span style="font-size:10.5px;font-weight:700;padding:3px 10px;border-radius:20px;background:var(--blue-lt);color:var(--blue);border:1px solid rgba(0,102,204,0.2)">ASHRAE</span>
<span style="font-size:10.5px;font-weight:700;padding:3px 10px;border-radius:20px;background:var(--red-lt);color:#d17914;border:1px solid rgba(220,38,38,0.2)">NFPA</span>
<span style="font-size:10.5px;font-weight:700;padding:3px 10px;border-radius:20px;background:var(--green-lt);color:var(--brand);border:1px solid rgba(247,143,34,0.2)">IEC</span>
<span style="font-size:10.5px;font-weight:700;padding:3px 10px;border-radius:20px;background:var(--amber-lt);color:#D97706;border:1px solid rgba(217,119,6,0.2)">SMACNA</span>
<span style="font-size:10.5px;font-weight:700;padding:3px 10px;border-radius:20px;background:var(--blue-lt);color:#e47e20;border:1px solid rgba(0,102,204,0.2)">IPC</span>
</div>
<div style="font-size:11px;color:var(--hint);line-height:1.65;background:var(--bg);border-radius:8px;padding:10px 12px;border:1px solid var(--border)">
</div>
</div>
</div>
<div class="scard">
<div class="scard-head">
<div class="scard-accent" style="background:var(--red)"></div>
<div class="scard-title">Data Management</div>
</div>
<div class="scard-body">
<p style="font-size:13px;color:var(--muted);margin-bottom:14px">All calculations and projects are stored
              locally in your browser's localStorage. Clearing browser data will erase saved calculations.</p>
<button data-action-click="confirmClearData()" style="width:100%;padding:11px;border-radius:8px;border:1px solid rgba(220,38,38,0.3);background:var(--red-lt);color:var(--red);font-size:13px;font-weight:600;cursor:pointer;font-family:var(--font)">Clear
              All Saved Data</button>
</div>
</div>
</div>
`;

window.CalculatorTemplates['standards'] = `
<div class="page" id="page-standards">
<div class="calc-header">
<div class="calc-title">Standards Notes</div>
<div class="calc-std">Quick reference cards - ASHRAE · SMACNA · IPC · NFPA · IEC · NEC</div>
</div>
<div class="ref-search-wrap">
<span class="ref-search-icon">🔍</span>
<input autocomplete="off" class="ref-search-inp" id="std-search" data-action-input="buildStandards()" placeholder="Search standards… e.g. ASHRAE 62.1, voltage drop, sprinkler…"/>
<span class="ref-search-clear" id="std-search-clear" data-action-click="document.getElementById('std-search').value='';buildStandards()">✕</span>
</div>
<div id="std-filter-bar" style="display:flex;gap:8px;margin-bottom:8px;flex-wrap:wrap"></div>
<div class="ref-count-bar" id="std-count"></div>
<div id="std-cards-list"></div>
</div>
`;

window.CalculatorTemplates['tool-design-check'] = `
<div class="page" id="page-tool-design-check">
<div class="calc-header" style="background:linear-gradient(135deg,#f78f22,#d17914)">
<div class="calc-title">🔍 MEP Design Checker</div>
<div class="calc-std">Quick validation - OK / Warning / Not Acceptable</div>
</div>
<div class="calc-desc" style="background:#E6F0FB;border-color:rgba(0,102,204,0.15)">Enter any combination of
          design parameters and get instant pass/fail feedback with recommended engineering ranges. Works like a rapid
          design review on your phone.</div>
<div id="dc-checks-container"></div>
<div class="scard" id="dc-results-card" style="display:none">
<div class="scard-head">
<div class="scard-accent" style="background:var(--blue)"></div>
<div class="scard-title">Validation Results</div>
</div>
<div class="scard-body" id="dc-results-body"></div>
</div>
</div>
`;

window.CalculatorTemplates['tool-elec-quick'] = `
<div class="page" id="page-tool-elec-quick">
<div class="calc-header" style="background:linear-gradient(135deg,#f78f22,#d17914)">
<div class="calc-title">⚡ Electrical Quick Tools</div>
<div class="calc-std">kW↔HP↔kVA · Phase · Diversity · Demand factors</div>
</div>
<div class="calc-desc" style="background:#FEF3C7;border-color:rgba(217,119,6,0.2)">Fast conversions and
          decision guides for everyday electrical design. No complex inputs - instant answers.</div>
<!-- kW / HP / kVA Converter -->
<div class="scard">
<div class="scard-head">
<div class="scard-accent" style="background:var(--amber)"></div>
<div class="scard-title">⚡ kW ↔ HP ↔ kVA Converter</div>
</div>
<div class="scard-body">
<div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:8px">
<div>
<div class="input-label" style="font-size:11px">kW</div><input class="inp" id="eq-kw" data-action-input="calcEQ('kw')" placeholder="e.g. 22" step="0.5" style="padding:8px" type="number"/>
</div>
<div>
<div class="input-label" style="font-size:11px">HP</div><input class="inp" id="eq-hp" data-action-input="calcEQ('hp')" step="0.5" style="padding:8px" type="number"/>
</div>
<div>
<div class="input-label" style="font-size:11px">kVA (PF=0.85)</div><input class="inp" id="eq-kva" data-action-input="calcEQ('kva')" step="0.5" style="padding:8px" type="number"/>
</div>
</div>
</div>
</div>
<!-- Diversity & Demand Factor Guide -->
<div class="scard">
<div class="scard-head">
<div class="scard-accent" style="background:var(--amber)"></div>
<div class="scard-title">📊 Diversity &amp; Demand Factor Guide</div>
</div>
<div class="scard-body">
<div style="font-size:12px;line-height:1.9;color:var(--text)">
<div style="display:grid;grid-template-columns:1fr 80px 80px;gap:4px;font-size:11px;font-weight:700;color:var(--muted);padding-bottom:6px;border-bottom:1px solid var(--border);margin-bottom:8px">
<div>Load Type</div>
<div>Demand F</div>
<div>Diversity F</div>
</div>
<div style="display:grid;grid-template-columns:1fr 80px 80px;gap:4px;font-size:12px;padding:4px 0;border-bottom:1px solid var(--border)">
<div>Lighting</div>
<div>0.85</div>
<div>0.90</div>
</div>
<div style="display:grid;grid-template-columns:1fr 80px 80px;gap:4px;font-size:12px;padding:4px 0;border-bottom:1px solid var(--border)">
<div>Receptacles</div>
<div>0.75</div>
<div>0.80</div>
</div>
<div style="display:grid;grid-template-columns:1fr 80px 80px;gap:4px;font-size:12px;padding:4px 0;border-bottom:1px solid var(--border)">
<div>HVAC</div>
<div>0.65</div>
<div>0.75</div>
</div>
<div style="display:grid;grid-template-columns:1fr 80px 80px;gap:4px;font-size:12px;padding:4px 0;border-bottom:1px solid var(--border)">
<div>Motors</div>
<div>0.75</div>
<div>0.70</div>
</div>
<div style="display:grid;grid-template-columns:1fr 80px 80px;gap:4px;font-size:12px;padding:4px 0;border-bottom:1px solid var(--border)">
<div>Office equipment</div>
<div>0.70</div>
<div>0.75</div>
</div>
<div style="display:grid;grid-template-columns:1fr 80px 80px;gap:4px;font-size:12px;padding:4px 0">
<div>Entire building</div>
<div>-</div>
<div>0.65–0.80</div>
</div>
</div>
</div>
</div>
<!-- Cable Type Selector -->
<div class="scard">
<div class="scard-head">
<div class="scard-accent" style="background:var(--amber)"></div>
<div class="scard-title">🔌 Cable Type Selector Guide</div>
</div>
<div class="scard-body" id="cable-type-guide">
<div id="cable-type-cards" style="display:grid;grid-template-columns:1fr 1fr;gap:8px"></div>
</div>
</div>
<!-- Voltage System Guide -->
<div class="scard">
<div class="scard-head">
<div class="scard-accent" style="background:var(--amber)"></div>
<div class="scard-title">🔋 Voltage System Reference</div>
</div>
<div class="scard-body">
<div style="font-size:12px;line-height:1.9">
<div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:4px;font-size:10px;font-weight:700;color:var(--muted);padding-bottom:5px;border-bottom:1px solid var(--border);margin-bottom:6px">
<div>System</div>
<div>L-L</div>
<div>L-N</div>
</div>
<div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:4px;font-size:11px;padding:3px 0;border-bottom:1px solid var(--border)">
<div>IEC 3-phase</div>
<div>400V</div>
<div>230V</div>
</div>
<div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:4px;font-size:11px;padding:3px 0;border-bottom:1px solid var(--border)">
<div>Gulf region</div>
<div>415V</div>
<div>240V</div>
</div>
<div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:4px;font-size:11px;padding:3px 0;border-bottom:1px solid var(--border)">
<div>US 3-phase</div>
<div>480V</div>
<div>277V</div>
</div>
<div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:4px;font-size:11px;padding:3px 0;border-bottom:1px solid var(--border)">
<div>US commercial</div>
<div>208V</div>
<div>120V</div>
</div>
<div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:4px;font-size:11px;padding:3px 0">
<div>MV distribution</div>
<div>11kV / 33kV</div>
<div>-</div>
</div>
</div>
</div>
</div>
</div>
`;

window.CalculatorTemplates['tool-power-triangle'] = `
<div class="page" id="page-tool-power-triangle">
<div class="calc-header" style="background:linear-gradient(135deg,#f78f22,#d17914)">
<div class="calc-title">⚡ Power Triangle Tool</div>
<div class="calc-std">P · Q · S · PF - interactive visual</div>
</div>
<div class="calc-desc" style="background:#FEF3C7;border-color:rgba(217,119,6,0.2)">Enter any two of P (kW), Q
          (kVAR), S (kVA), or PF - the rest are calculated instantly. Visualised as a power triangle.</div>
<div class="scard">
<div class="scard-head">
<div class="scard-accent" style="background:var(--amber)"></div>
<div class="scard-title">Inputs (enter any two)</div>
</div>
<div class="scard-body">
<div style="display:grid;grid-template-columns:1fr 1fr;gap:10px">
<div class="input-group" style="margin:0">
<div class="input-label">P - Active power <span class="input-unit">kW</span></div><input class="inp" id="pt-p" data-action-input="calcPowerTriangle()" placeholder="e.g. 80" step="0.5" type="number"/>
</div>
<div class="input-group" style="margin:0">
<div class="input-label">Q - Reactive <span class="input-unit">kVAR</span></div><input class="inp" id="pt-q" data-action-input="calcPowerTriangle()" placeholder="e.g. 60" step="0.5" type="number"/>
</div>
<div class="input-group" style="margin:0">
<div class="input-label">S - Apparent <span class="input-unit">kVA</span></div><input class="inp" id="pt-s" data-action-input="calcPowerTriangle()" placeholder="e.g. 100" step="0.5" type="number"/>
</div>
<div class="input-group" style="margin:0">
<div class="input-label">PF <span class="input-unit">0–1</span></div><input class="inp" id="pt-pf" max="1" min="0.01" data-action-input="calcPowerTriangle()" placeholder="e.g. 0.8" step="0.01" type="number"/>
</div>
</div>
</div>
</div>
<div id="pt-results" style="display:none">
<div class="scard">
<div class="scard-head">
<div class="scard-accent" style="background:var(--amber)"></div>
<div class="scard-title">Results</div>
</div>
<div class="scard-body">
<div class="res-row">
<div class="res-label">Active power (P)</div>
<div class="res-val primary" id="pt-r-p" style="color:var(--amber)">-</div>
</div>
<div class="res-row">
<div class="res-label">Reactive power (Q)</div>
<div class="res-val" id="pt-r-q">-</div>
</div>
<div class="res-row">
<div class="res-label">Apparent power (S)</div>
<div class="res-val" id="pt-r-s">-</div>
</div>
<div class="res-row">
<div class="res-label">Power factor (PF)</div>
<div class="res-val" id="pt-r-pf">-</div>
</div>
<div class="res-row">
<div class="res-label">Phase angle (φ)</div>
<div class="res-val" id="pt-r-phi">-</div>
</div>
<div class="res-row">
<div class="res-label">PF classification</div>
<div class="res-val" id="pt-r-class">-</div>
</div>
</div>
</div>
<!-- SVG Triangle -->
<div class="scard">
<div class="scard-head">
<div class="scard-accent" style="background:var(--amber)"></div>
<div class="scard-title">Power Triangle</div>
</div>
<div class="scard-body" style="padding:8px">
<svg id="pt-svg" style="width:100%;max-width:340px;display:block;margin:0 auto" viewbox="0 0 300 180"></svg>
</div>
</div>
</div>
</div>
`;

window.CalculatorTemplates['tool-selector-elec'] = `
<div class="page" id="page-tool-selector-elec">
<div class="calc-header" style="background:linear-gradient(135deg,#f78f22,#d17914)">
<div class="calc-title">⚡ Electrical Selector Guides</div>
<div class="calc-std">Protection device · Earthing type · Transformer type</div>
</div>
<div class="ref-search-wrap" style="margin-bottom:12px">
<span class="ref-search-icon">🔍</span>
<input autocomplete="off" class="ref-search-inp" id="elec-sel-search" data-action-input="buildElecSelectors()" placeholder="Search… e.g. MCB, earthing, TN-S, motor protection…"/>
<span class="ref-search-clear" data-action-click="document.getElementById('elec-sel-search').value='';buildElecSelectors()">✕</span>
</div>
<div class="ref-count-bar" id="elec-sel-count"></div>
<div id="elec-selector-content"></div>
</div>
`;

window.CalculatorTemplates['tool-flow-velocity'] = `
<div class="page" id="page-tool-flow-velocity">
<div class="calc-header" style="background:linear-gradient(135deg,#f78f22,#d17914)">
<div class="calc-title">Flow ↔ Velocity Calculator</div>
<div class="calc-std">Q = A × V - pipe and duct</div>
</div>
<div class="calc-desc">Instantly convert between flow rate, velocity, and pipe/duct cross-section. Works for
          both round pipes and rectangular ducts.</div>
<div class="scard">
<div class="scard-head">
<div class="scard-accent" style="background:var(--blue)"></div>
<div class="scard-title">Round Pipe</div>
</div>
<div class="scard-body">
<div style="display:grid;grid-template-columns:1fr 1fr;gap:10px">
<div class="input-group" style="margin:0">
<div class="input-label">Diameter <span class="input-unit">mm</span></div><input class="inp" id="fv-dia" data-action-input="calcFVPipe()" placeholder="e.g. 100" type="number"/>
</div>
<div class="input-group" style="margin:0">
<div class="input-label">Velocity <span class="input-unit">m/s</span></div><input class="inp" id="fv-vel" data-action-input="calcFVPipe()" placeholder="e.g. 2.5" step="0.1" type="number"/>
</div>
</div>
<div style="margin-top:10px;padding:10px;background:var(--bg);border-radius:8px;font-size:13px">
<span style="color:var(--muted)">Flow = </span><span id="fv-r-flow" style="font-weight:700;color:var(--blue)">-</span>
               | <span id="fv-r-flow2" style="color:var(--muted);font-size:12px">-</span>
</div>
</div>
</div>
<div class="scard">
<div class="scard-head">
<div class="scard-accent" style="background:var(--blue)"></div>
<div class="scard-title">Rectangular Duct</div>
</div>
<div class="scard-body">
<div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:8px">
<div class="input-group" style="margin:0">
<div class="input-label">W <span class="input-unit">mm</span></div><input class="inp" id="fv-dw" data-action-input="calcFVDuct()" placeholder="e.g. 600" style="padding:8px" type="number"/>
</div>
<div class="input-group" style="margin:0">
<div class="input-label">H <span class="input-unit">mm</span></div><input class="inp" id="fv-dh" data-action-input="calcFVDuct()" placeholder="e.g. 300" style="padding:8px" type="number"/>
</div>
<div class="input-group" style="margin:0">
<div class="input-label">Vel <span class="input-unit">m/s</span></div><input class="inp" id="fv-dv" data-action-input="calcFVDuct()" placeholder="e.g. 5" step="0.5" style="padding:8px" type="number"/>
</div>
</div>
<div style="margin-top:10px;padding:10px;background:var(--bg);border-radius:8px;font-size:13px">
<span style="color:var(--muted)">Flow = </span><span id="fv-r-duct" style="font-weight:700;color:var(--blue)">-</span>
               | <span id="fv-r-duct2" style="color:var(--muted);font-size:12px">-</span>
</div>
</div>
</div>
<div class="scard">
<div class="scard-head">
<div class="scard-accent" style="background:var(--blue)"></div>
<div class="scard-title">Find Velocity from Flow</div>
</div>
<div class="scard-body">
<div style="display:grid;grid-template-columns:1fr 1fr;gap:10px">
<div class="input-group" style="margin:0">
<div class="input-label">Flow <span class="input-unit">L/s or CFM</span></div>
<select class="inp inp-select" id="fv-flow-unit" data-action-change="calcFVReverse()" style="margin-bottom:6px">
<option value="ls">L/s</option>
<option value="cfm">CFM</option>
<option value="m3h">m³/h</option>
</select>
<input class="inp" id="fv-flow-in" data-action-input="calcFVReverse()" placeholder="e.g. 10" type="number"/>
</div>
<div class="input-group" style="margin:0">
<div class="input-label">Pipe diameter <span class="input-unit">mm</span></div><input class="inp" id="fv-dia-rev" data-action-input="calcFVReverse()" placeholder="e.g. 100" type="number"/>
</div>
</div>
<div style="margin-top:10px;padding:10px;background:var(--bg);border-radius:8px;font-size:13px">
<span style="color:var(--muted)">Velocity = </span><span id="fv-r-vel" style="font-weight:700;color:var(--blue)">-</span>
<span id="fv-r-vel-chk" style="font-size:11px;margin-left:8px">-</span>
</div>
</div>
</div>
</div>
`;

window.CalculatorTemplates['tool-pipe-weight'] = `
<div class="page" id="page-tool-pipe-weight">
<div class="calc-header" style="background:linear-gradient(135deg,#f78f22,#d17914)">
<div class="calc-title">Pipe Weight Calculator</div>
<div class="calc-std">Pipe + water weight for structural loading</div>
</div>
<div class="calc-desc">Calculate weight of pipe (empty and water-filled) per metre run. Useful for support
          spacing and structural loading estimates.</div>
<div class="scard">
<div class="scard-head">
<div class="scard-accent" style="background:var(--blue)"></div>
<div class="scard-title">Pipe Inputs</div>
</div>
<div class="scard-body">
<div class="input-group">
<div class="input-label">Pipe material</div>
<select class="inp inp-select" id="pw-mat" data-action-change="calcPipeWeight()">
<option value="7850">Carbon steel - 7850 kg/m³</option>
<option value="7900">Stainless steel - 7900 kg/m³</option>
<option value="8900">Copper - 8900 kg/m³</option>
<option value="2700">Aluminium - 2700 kg/m³</option>
<option value="1400">UPVC - 1400 kg/m³</option>
<option value="950">HDPE / PP-R - 950 kg/m³</option>
<option value="7200">Ductile iron - 7200 kg/m³</option>
</select>
</div>
<div class="input-group">
<div class="input-label">Outer diameter <span class="input-unit">mm</span></div><input class="inp" id="pw-od" data-action-input="calcPipeWeight()" placeholder="e.g. 114.3" step="0.1" type="number"/>
</div>
<div class="input-group">
<div class="input-label">Wall thickness <span class="input-unit">mm</span></div><input class="inp" id="pw-wt" data-action-input="calcPipeWeight()" placeholder="e.g. 6.0" step="0.1" type="number"/>
</div>
<div class="input-group">
<div class="input-label">Length of run <span class="input-unit">m</span></div><input class="inp" id="pw-len" data-action-input="calcPipeWeight()" placeholder="e.g. 10" type="number"/>
</div>
</div>
</div>
<div class="scard">
<div class="scard-head">
<div class="scard-accent" style="background:var(--blue)"></div>
<div class="scard-title">Results</div>
</div>
<div class="scard-body">
<div class="res-row">
<div class="res-label">Internal diameter</div>
<div class="res-val" id="pw-r-id">-</div>
</div>
<div class="res-row">
<div class="res-label">Pipe weight (empty)</div>
<div class="res-val" id="pw-r-empty">-</div>
</div>
<div class="res-row">
<div class="res-label">Water weight inside</div>
<div class="res-val" id="pw-r-water">-</div>
</div>
<div class="res-row">
<div class="res-label">Total weight (water-filled)</div>
<div class="res-val primary" id="pw-r-total">-</div>
</div>
<div class="res-row">
<div class="res-label">Weight per metre</div>
<div class="res-val" id="pw-r-per-m">-</div>
</div>
</div>
</div>
</div>
`;

window.CalculatorTemplates['tool-pump-power'] = `
<div class="page" id="page-tool-pump-power">
<div class="calc-header" style="background:linear-gradient(135deg,#f78f22,#d17914)">
<div class="calc-title">Pump Power (Quick)</div>
<div class="calc-std">P = ρgQH/η - instant motor sizing</div>
</div>
<div class="calc-desc">Quickly estimate pump motor power from flow and head. Works for water, chilled water,
          fire water - any Newtonian fluid.</div>
<div class="scard">
<div class="scard-head">
<div class="scard-accent" style="background:var(--blue)"></div>
<div class="scard-title">Inputs</div>
</div>
<div class="scard-body">
<div class="input-group">
<div class="input-label">Flow rate</div>
<div style="display:flex;gap:8px"><input class="inp" id="pp-flow" data-action-input="calcPumpPowerQuick()" placeholder="e.g. 50" style="flex:1" type="number"/>
<select class="inp inp-select" id="pp-flow-unit" data-action-change="calcPumpPowerQuick()" style="flex:0.8">
<option value="gpm">GPM</option>
<option value="ls">L/s</option>
<option value="m3h">m³/h</option>
</select>
</div>
</div>
<div class="input-group">
<div class="input-label">Total head <span class="input-unit">m w.g.</span></div><input class="inp" id="pp-head" data-action-input="calcPumpPowerQuick()" placeholder="e.g. 30" type="number"/>
</div>
<div class="input-group">
<div class="input-label">Overall efficiency <span class="input-unit">% (pump+motor)</span></div><input class="inp" id="pp-eff" data-action-input="calcPumpPowerQuick()" placeholder="e.g. 65" type="number"/>
</div>
<div class="input-group">
<div class="input-label">Fluid</div>
<select class="inp inp-select" id="pp-fluid" data-action-change="calcPumpPowerQuick()">
<option value="998">Water (20°C) - 998 kg/m³</option>
<option value="1000">Water (cold) - 1000 kg/m³</option>
<option value="1040">Glycol 25% - 1040 kg/m³</option>
<option value="850">Light oil - 850 kg/m³</option>
</select>
</div>
</div>
</div>
<div class="scard">
<div class="scard-head">
<div class="scard-accent" style="background:var(--blue)"></div>
<div class="scard-title">Results</div>
</div>
<div class="scard-body">
<div class="res-row">
<div class="res-label">Hydraulic power</div>
<div class="res-val" id="pp-r-hydro">-</div>
</div>
<div class="res-row">
<div class="res-label">Shaft / motor input power</div>
<div class="res-val primary" id="pp-r-shaft">-</div>
</div>
<div class="res-row">
<div class="res-label">Nearest standard motor</div>
<div class="res-val" id="pp-r-motor">-</div>
</div>
<div class="res-row">
<div class="res-label">HP equivalent</div>
<div class="res-val" id="pp-r-hp">-</div>
</div>
</div>
</div>
</div>
`;

window.CalculatorTemplates['tool-selector-mep'] = `
<div class="page" id="page-tool-selector-mep">
<div class="calc-header" style="background:linear-gradient(135deg,#f78f22,#d17914)">
<div class="calc-title">MEP System Selector</div>
<div class="calc-std">AHU type · Pump type · Fire system · Lighting type</div>
</div>
<div class="ref-search-wrap" style="margin-bottom:12px">
<span class="ref-search-icon">🔍</span>
<input autocomplete="off" class="ref-search-inp" id="mep-sel-search" data-action-input="buildMEPSelectors()" placeholder="Search… e.g. hospital, pump, sprinkler, LED, VRF…"/>
<span class="ref-search-clear" data-action-click="document.getElementById('mep-sel-search').value='';buildMEPSelectors()">✕</span>
</div>
<div class="ref-count-bar" id="mep-sel-count"></div>
<div id="mep-selector-content"></div>
</div>
`;

window.CalculatorTemplates['tool-pipe-material'] = `
<div class="page" id="page-tool-pipe-material">
<div class="calc-header" style="background:linear-gradient(135deg,#f78f22,#d17914)">
<div class="calc-title">Pipe Material Selection Guide</div>
<div class="calc-std">Quick selection by service · temperature · pressure</div>
</div>
<div class="ref-search-wrap" style="margin-bottom:12px">
<span class="ref-search-icon">🔍</span>
<input autocomplete="off" class="ref-search-inp" id="pipe-search" data-action-input="buildPipeMaterialGuide()" placeholder="Search… e.g. fire, chilled water, gas, HDPE, copper…"/>
<span class="ref-search-clear" data-action-click="document.getElementById('pipe-search').value='';buildPipeMaterialGuide()">✕</span>
</div>
<div class="ref-count-bar" id="pipe-count"></div>
<div id="pipe-material-content"></div>
</div>
`;

window.CalculatorTemplates['tool-site'] = `
<div class="page" id="page-tool-site">
<div class="calc-header" style="background:linear-gradient(135deg,#f78f22,#d17914)">
<div class="calc-title">Site Quick Tools</div>
<div class="calc-std">Pump head · Tank fill · Fuel · Fixture count · Cable length</div>
</div>
<div class="calc-desc">Fast on-site calculations. Minimal inputs, instant answers - designed for use on a
          phone on site.</div>
<!-- Pump Head from Height -->
<div class="scard">
<div class="scard-head">
<div class="scard-accent" style="background:var(--blue)"></div>
<div class="scard-title">💧 Pump Head from Building Height</div>
</div>
<div class="scard-body">
<div style="display:grid;grid-template-columns:1fr 1fr;gap:8px">
<div>
<div class="input-label" style="font-size:11px">Height (m)</div><input class="inp" id="st-height" data-action-input="calcSiteTools()" placeholder="e.g. 20" style="padding:8px" type="number"/>
</div>
<div>
<div class="input-label" style="font-size:11px">Friction add (%)</div><input class="inp" id="st-fric" data-action-input="calcSiteTools()" placeholder="e.g. 20" style="padding:8px" type="number"/>
</div>
</div>
<div style="margin-top:8px;padding:10px;background:var(--bg);border-radius:8px;font-size:13px">
<span style="color:var(--muted)">Approx pump head: </span><span id="st-r-head" style="font-weight:700;color:var(--blue)">-</span>
</div>
</div>
</div>
<!-- Tank Fill Time -->
<div class="scard">
<div class="scard-head">
<div class="scard-accent" style="background:var(--blue)"></div>
<div class="scard-title">🪣 Tank Fill Time</div>
</div>
<div class="scard-body">
<div style="display:grid;grid-template-columns:1fr 1fr;gap:8px">
<div>
<div class="input-label" style="font-size:11px">Tank volume (L)</div><input class="inp" id="st-tank-vol" data-action-input="calcSiteTools()" placeholder="e.g. 10000" style="padding:8px" type="number"/>
</div>
<div>
<div class="input-label" style="font-size:11px">Fill rate (L/min)</div><input class="inp" id="st-fill-rate" data-action-input="calcSiteTools()" placeholder="e.g. 200" style="padding:8px" type="number"/>
</div>
</div>
<div style="margin-top:8px;padding:10px;background:var(--bg);border-radius:8px;font-size:13px">
<span style="color:var(--muted)">Fill time: </span><span id="st-r-fill" style="font-weight:700;color:var(--blue)">-</span>
</div>
</div>
</div>
<!-- Generator Fuel Estimate -->
<div class="scard">
<div class="scard-head">
<div class="scard-accent" style="background:var(--blue)"></div>
<div class="scard-title">⛽ Generator Fuel Estimate</div>
</div>
<div class="scard-body">
<div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:8px">
<div>
<div class="input-label" style="font-size:11px">Load (kVA)</div><input class="inp" id="st-gen-kva" data-action-input="calcSiteTools()" placeholder="e.g. 200" style="padding:8px" type="number"/>
</div>
<div>
<div class="input-label" style="font-size:11px">Load % </div><input class="inp" id="st-gen-load" data-action-input="calcSiteTools()" placeholder="e.g. 75" style="padding:8px" type="number"/>
</div>
<div>
<div class="input-label" style="font-size:11px">Hours</div><input class="inp" id="st-gen-hrs" data-action-input="calcSiteTools()" placeholder="e.g. 8" style="padding:8px" type="number"/>
</div>
</div>
<div style="margin-top:8px;padding:10px;background:var(--bg);border-radius:8px;font-size:13px">
<span style="color:var(--muted)">Diesel consumed: </span><span id="st-r-fuel" style="font-weight:700;color:var(--blue)">-</span>
</div>
</div>
</div>
<!-- Lighting Fixture Count -->
<div class="scard">
<div class="scard-head">
<div class="scard-accent" style="background:var(--blue)"></div>
<div class="scard-title">💡 Quick Lighting Count</div>
</div>
<div class="scard-body">
<div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:8px">
<div>
<div class="input-label" style="font-size:11px">Area (m²)</div><input class="inp" id="st-ltg-area" data-action-input="calcSiteTools()" placeholder="e.g. 100" style="padding:8px" type="number"/>
</div>
<div>
<div class="input-label" style="font-size:11px">Lux target</div><input class="inp" id="st-ltg-lux" data-action-input="calcSiteTools()" placeholder="e.g. 500" style="padding:8px" type="number"/>
</div>
<div>
<div class="input-label" style="font-size:11px">Lm/fitting</div><input class="inp" id="st-ltg-lm" data-action-input="calcSiteTools()" placeholder="e.g. 4000" style="padding:8px" type="number"/>
</div>
</div>
<div style="margin-top:8px;padding:10px;background:var(--bg);border-radius:8px;font-size:13px">
<span style="color:var(--muted)">Approx fittings: </span><span id="st-r-ltg" style="font-weight:700;color:var(--blue)">-</span>
</div>
</div>
</div>
<!-- Cable / Pipe Length Estimator -->
<div class="scard">
<div class="scard-head">
<div class="scard-accent" style="background:var(--blue)"></div>
<div class="scard-title">📏 Cable / Pipe Length with Waste</div>
</div>
<div class="scard-body">
<div style="display:grid;grid-template-columns:1fr 1fr;gap:8px">
<div>
<div class="input-label" style="font-size:11px">Net run (m)</div><input class="inp" id="st-len-net" data-action-input="calcSiteTools()" placeholder="e.g. 80" style="padding:8px" type="number"/>
</div>
<div>
<div class="input-label" style="font-size:11px">Waste/fittings (%)</div><input class="inp" id="st-len-waste" data-action-input="calcSiteTools()" placeholder="e.g. 15" style="padding:8px" type="number"/>
</div>
</div>
<div style="margin-top:8px;padding:10px;background:var(--bg);border-radius:8px;font-size:13px">
<span style="color:var(--muted)">Order quantity: </span><span id="st-r-len" style="font-weight:700;color:var(--blue)">-</span>
</div>
</div>
</div>
</div>
`;

window.CalculatorTemplates['elec-load'] = `
<div class="page" id="page-elec-load">
<div class="calc-header" style="background:linear-gradient(135deg,#f78f22,#d17914)">
<div class="calc-title">⚡ Load Calculation</div>
<div class="calc-std">Demand load estimation - NEC 220 / IEC 60364 conceptual basis</div>
</div>
<div class="calc-desc" style="background:#FEF3C7;border-color:rgba(217,119,6,0.25);color:#d65e19">
<strong>PRELIMINARY ESTIMATION ONLY.</strong> Not a full NEC Art. 220 or IEC 60364 load schedule. Results
          must be verified by a qualified electrical engineer.
        </div>
<div class="elec-unit-note">⚡ Electrical calculators use IEC/SI units (kW, V, A, kVA, mm²) regardless of the
          IP/SI toggle.</div>
<div class="scard">
<div class="scard-head">
<div class="scard-accent" style="background:var(--amber)"></div>
<div class="scard-title">Load Inputs (kW)</div>
</div>
<div class="scard-body">
<div class="input-group">
<div class="input-label">Lighting load <span class="input-unit">kW</span></div><input class="inp" id="el-ltg" data-action-input="calcElecLoad()" placeholder="e.g. 20" step="0.5" type="number"/>
</div>
<div class="input-group">
<div class="input-label">Receptacle / General Power <span class="input-unit">kW</span></div><input class="inp" id="el-rec" data-action-input="calcElecLoad()" placeholder="e.g. 30" step="0.5" type="number"/>
</div>
<div class="input-group">
<div class="input-label">HVAC / Mechanical <span class="input-unit">kW</span></div><input class="inp" id="el-hvac" data-action-input="calcElecLoad()" placeholder="e.g. 45" step="0.5" type="number"/>
</div>
<div class="input-group">
<div class="input-label">Motor loads <span class="input-unit">kW</span></div><input class="inp" id="el-mot" data-action-input="calcElecLoad()" placeholder="e.g. 15" step="0.5" type="number"/>
</div>
<div class="input-group">
<div class="input-label">Special / Process loads <span class="input-unit">kW</span></div><input class="inp" id="el-spl" data-action-input="calcElecLoad()" placeholder="e.g. 10" step="0.5" type="number"/>
</div>
</div>
</div>
<div class="scard">
<div class="scard-head">
<div class="scard-accent" style="background:var(--amber)"></div>
<div class="scard-title">Demand Factors</div>
</div>
<div class="scard-body">
<div class="input-group">
<div class="input-label">Lighting demand factor <span class="input-unit">0–1</span></div><input class="inp" id="el-df-ltg" max="1" min="0.1" placeholder="e.g. 0.85" step="0.05" type="number"/>
</div>
<div class="input-group">
<div class="input-label">Receptacle demand factor <span class="input-unit">0–1</span></div><input class="inp" id="el-df-rec" max="1" min="0.1" placeholder="e.g. 0.75" step="0.05" type="number"/>
</div>
<div class="input-group">
<div class="input-label">HVAC demand factor <span class="input-unit">0–1</span></div><input class="inp" id="el-df-hvac" max="1" min="0.1" placeholder="e.g. 0.65" step="0.05" type="number"/>
</div>
<div class="input-group">
<div class="input-label">Motor demand factor <span class="input-unit">0–1</span></div><input class="inp" id="el-df-mot" max="1" min="0.1" placeholder="e.g. 0.75" step="0.05" type="number"/>
</div>
<div class="input-group">
<div class="input-label">Special loads factor <span class="input-unit">0–1</span></div><input class="inp" id="el-df-spl" max="1" min="0.1" placeholder="e.g. 1.0" step="0.05" type="number"/>
</div>
<div class="input-group">
<div class="input-label">Diversity factor <span class="input-unit">0–1</span></div><input class="inp" id="el-div" max="1" min="0.1" placeholder="e.g. 0.85" step="0.05" type="number"/>
</div>
<div class="input-group">
<div class="input-label">Power factor <span class="input-unit">0–1</span></div><input class="inp" id="el-pf" max="1" min="0.1" placeholder="e.g. 0.85" step="0.05" type="number"/>
</div>
<div class="input-group">
<div class="input-label">Supply voltage <span class="input-unit">V (L-L)</span></div>
<select class="inp inp-select" id="el-volt">
<option value="415">415 V (3-phase, 50 Hz)</option>
<option value="400">400 V (3-phase, 50 Hz)</option>
<option value="480">480 V (3-phase, 60 Hz)</option>
<option value="208">208 V (3-phase, 60 Hz)</option>
<option value="230">230 V (1-phase)</option>
</select>
</div>
</div>
</div>
<button class="calc-btn" data-action-click="calcElecLoad();showRes('el-load-res')" style="background:var(--amber)">⚡
          Calculate Demand Load</button>
<div id="el-load-res" style="display:none">
<div id="el-load-warn-area"></div>
<div class="scard">
<div class="scard-head">
<div class="scard-accent" style="background:var(--amber)"></div>
<div class="scard-title">Load Summary</div>
</div>
<div class="scard-body">
<div class="res-row">
<div class="res-label">Connected load</div>
<div class="res-val" id="el-r-connected">-</div>
</div>
<div class="res-row">
<div class="res-label">Demand load (after factors)</div>
<div class="res-val primary" id="el-r-demand" style="color:var(--amber)">-</div>
</div>
<div class="res-row">
<div class="res-label">Apparent power (kVA)</div>
<div class="res-val primary" id="el-r-kva" style="color:var(--amber)">-</div>
</div>
<div class="res-row">
<div class="res-label">Design current (3-phase)</div>
<div class="res-val primary" id="el-r-current" style="color:var(--amber)">-</div>
</div>
<div class="res-row">
<div class="res-label">Lighting (demand)</div>
<div class="res-val" id="el-r-ltg">-</div>
</div>
<div class="res-row">
<div class="res-label">Receptacles (demand)</div>
<div class="res-val" id="el-r-rec">-</div>
</div>
<div class="res-row">
<div class="res-label">HVAC (demand)</div>
<div class="res-val" id="el-r-hvac">-</div>
</div>
<div class="res-row">
<div class="res-label">Motors (demand)</div>
<div class="res-val" id="el-r-mot">-</div>
</div>
<div class="res-row">
<div class="res-label">Special (demand)</div>
<div class="res-val" id="el-r-spl">-</div>
</div>
</div>
</div>
</div>
</div>
`;

window.CalculatorTemplates['elec-current'] = `
<div class="page" id="page-elec-current">
<div class="calc-header" style="background:linear-gradient(135deg,#f78f22,#d17914)">
<div class="calc-title">⚡ Current Calculator</div>
<div class="calc-std">kW / kVA to current - single and three phase</div>
</div>
<div class="calc-desc" style="background:#FEF3C7;border-color:rgba(217,119,6,0.25)">Convert between power and
          current for any voltage and phase configuration. Accounts for power factor.</div>
<div class="elec-unit-note">⚡ Electrical calculators use IEC/SI units (kW, V, A, kVA, mm²) regardless of the
          IP/SI toggle.</div>
<div class="scard">
<div class="scard-head">
<div class="scard-accent" style="background:var(--amber)"></div>
<div class="scard-title">Inputs</div>
</div>
<div class="scard-body">
<div class="input-group">
<div class="input-label">Phase Type</div>
<div class="chip-row">
<div class="chip sel" data-action-click="setElecPhase(this,'single')" style="border-color:var(--amber)">Single
                  Phase</div>
<div class="chip" data-action-click="setElecPhase(this,'three')">Three Phase</div>
</div>
</div>
<div class="input-group" style="margin-top:12px">
<div class="input-label">Input Mode</div>
<div class="chip-row">
<div class="chip sel" data-action-click="setElecMode(this,'kw')" style="border-color:var(--amber)">kW (with PF)
                </div>
<div class="chip" data-action-click="setElecMode(this,'kva')">kVA (apparent)</div>
</div>
</div>
<div class="input-group" style="margin-top:12px">
<div class="input-label"><span id="ec-power-label">Active Power</span> <span class="input-unit" id="ec-power-unit">kW</span></div>
<input class="inp" id="ec-power" data-action-input="calcElecCurrent()" placeholder="e.g. 50" step="0.5" type="number"/>
</div>
<div class="input-group" id="ec-pf-row">
<div class="input-label">Power Factor <span class="input-unit">0–1</span></div>
<input class="inp" id="ec-pf" max="1" min="0.1" data-action-input="calcElecCurrent()" placeholder="e.g. 0.85" step="0.05" type="number"/>
</div>
<div class="input-group">
<div class="input-label">Voltage <span class="input-unit" id="ec-volt-unit">V (L-L)</span></div>
<select class="inp inp-select" id="ec-volt" data-action-change="calcElecCurrent()">
<option value="415">415 V</option>
<option value="400">400 V</option>
<option value="480">480 V</option>
<option value="208">208 V</option>
<option value="230">230 V</option>
<option value="120">120 V</option>
<option value="110">110 V</option>
<option value="11000">11,000 V</option>
</select>
</div>
</div>
</div>
<button class="calc-btn" data-action-click="calcElecCurrent();showRes('ec-res')" style="background:var(--amber)">⚡
          Calculate Current</button>
<div id="ec-res" style="display:none">
<div class="scard">
<div class="scard-head">
<div class="scard-accent" style="background:var(--amber)"></div>
<div class="scard-title">Result</div>
</div>
<div class="scard-body">
<div class="res-row">
<div class="res-label">Current (A)</div>
<div class="res-val primary" id="ec-r-current" style="color:var(--amber)">-</div>
</div>
<div class="res-row">
<div class="res-label">Apparent power (kVA)</div>
<div class="res-val" id="ec-r-kva">-</div>
</div>
<div class="res-row">
<div class="res-label">Active power (kW)</div>
<div class="res-val" id="ec-r-kw">-</div>
</div>
<div class="res-row">
<div class="res-label">Reactive power (kVAR)</div>
<div class="res-val" id="ec-r-kvar">-</div>
</div>
<div class="res-row">
<div class="res-label">Phase</div>
<div class="res-val" id="ec-r-phase">-</div>
</div>
<div class="res-row">
<div class="res-label">Formula used</div>
<div class="res-val" id="ec-r-formula" style="font-family:var(--mono);font-size:11px">-</div>
</div>
</div>
</div>
</div>
</div>
`;

window.CalculatorTemplates['elec-cable'] = `
<div class="page" id="page-elec-cable">
<div class="calc-header" style="background:linear-gradient(135deg,#f78f22,#d17914)">
<div class="calc-title">⚡ Cable Sizing Calculator</div>
<div class="calc-std">IEC 60364-5-52 simplified - current capacity + voltage drop</div>
</div>
<div class="calc-desc" style="background:#FEF3C7;border-color:rgba(217,119,6,0.25)">Engineering estimation
          tool. IEC 60364-5-52 simplified current capacity tables with ambient temperature and grouping derating. Not
          a full compliance check.</div>
<div class="elec-unit-note">⚡ Electrical calculators use IEC/SI units (kW, V, A, kVA, mm²) regardless of the
          IP/SI toggle.</div>
<div class="scard">
<div class="scard-head">
<div class="scard-accent" style="background:var(--amber)"></div>
<div class="scard-title">Circuit Parameters</div>
</div>
<div class="scard-body">
<div class="input-group">
<div class="input-label">Design Current <span class="input-unit">A</span></div><input class="inp" id="cs-current" data-action-input="calcCableSizing()" placeholder="e.g. 80" type="number"/>
</div>
<div class="input-group">
<div class="input-label">Conductor Material</div>
<div class="chip-row">
<div class="chip sel" data-action-click="setCsMat(this,'cu')" style="border-color:var(--amber)">Copper (Cu)
                </div>
<div class="chip" data-action-click="setCsMat(this,'al')">Aluminium (Al)</div>
</div>
</div>
<div class="input-group" style="margin-top:12px">
<div class="input-label">Installation Method</div>
<select class="inp inp-select" id="cs-install" data-action-change="calcCableSizing()">
<option value="conduit">In conduit / trunking</option>
<option value="tray">On cable tray / ladder</option>
<option value="air">In free air</option>
<option value="buried">Direct buried</option>
</select>
</div>
<div class="input-group">
<div class="input-label">Ambient Temperature <span class="input-unit">°C</span></div>
<select class="inp inp-select" id="cs-temp" data-action-change="calcCableSizing()">
<option value="1.06">25°C (factor 1.06)</option>
<option selected="" value="1.00">30°C (factor 1.00)</option>
<option value="0.94">35°C (factor 0.94)</option>
<option value="0.87">40°C (factor 0.87)</option>
<option value="0.79">45°C (factor 0.79)</option>
<option value="0.71">50°C (factor 0.71)</option>
</select>
</div>
<div class="input-group">
<div class="input-label">Circuits grouped together</div>
<select class="inp inp-select" id="cs-group" data-action-change="calcCableSizing()">
<option value="1.00">1 circuit (no derating)</option>
<option value="0.80">2 circuits (factor 0.80)</option>
<option value="0.70">3 circuits (factor 0.70)</option>
<option value="0.65">4–5 circuits (factor 0.65)</option>
<option value="0.60">6–9 circuits (factor 0.60)</option>
<option value="0.55">10+ circuits (factor 0.55)</option>
</select>
</div>
<div class="input-group">
<div class="input-label">Circuit Length (one-way) <span class="input-unit">m</span></div><input class="inp" id="cs-len" data-action-input="calcCableSizing()" placeholder="e.g. 50" type="number"/>
</div>
<div class="input-group">
<div class="input-label">System Voltage <span class="input-unit">V (L-L for 3-ph)</span></div>
<select class="inp inp-select" id="cs-volt" data-action-change="calcCableSizing()">
<option value="415">415 V (3-phase)</option>
<option value="400">400 V (3-phase)</option>
<option value="480">480 V (3-phase)</option>
<option value="230">230 V (1-phase)</option>
<option value="120">120 V (1-phase)</option>
</select>
</div>
<div class="input-group">
<div class="input-label">Phase</div>
<div class="chip-row">
<div class="chip sel" data-action-click="setCsPhase(this,'three')" style="border-color:var(--amber)">Three Phase
                </div>
<div class="chip" data-action-click="setCsPhase(this,'single')">Single Phase</div>
</div>
</div>
</div>
</div>
<button class="calc-btn" data-action-click="calcCableSizing();showRes('cs-res')" style="background:var(--amber)">⚡ Size
          Cable</button>
<div id="cs-res" style="display:none">
<div id="cs-warn-area"></div>
<div class="scard">
<div class="scard-head">
<div class="scard-accent" style="background:var(--amber)"></div>
<div class="scard-title">Cable Selection</div>
</div>
<div class="scard-body">
<div class="res-row">
<div class="res-label">Minimum cable size required</div>
<div class="res-val" id="cs-r-min">-</div>
</div>
<div class="res-row">
<div class="res-label">Selected cable size</div>
<div class="res-val primary" id="cs-r-selected" style="color:var(--amber)">-</div>
</div>
<div class="res-row">
<div class="res-label">Rated current (base)</div>
<div class="res-val" id="cs-r-rated">-</div>
</div>
<div class="res-row">
<div class="res-label">Total derating factor</div>
<div class="res-val" id="cs-r-derate">-</div>
</div>
<div class="res-row">
<div class="res-label">Derated current capacity</div>
<div class="res-val" id="cs-r-derated-cap">-</div>
</div>
<div class="res-row">
<div class="res-label">Loading (%)</div>
<div class="res-val" id="cs-r-loading">-</div>
</div>
<div class="res-row">
<div class="res-label">Voltage drop (V)</div>
<div class="res-val" id="cs-r-vdv">-</div>
</div>
<div class="res-row">
<div class="res-label">Voltage drop (%)</div>
<div class="res-val primary" id="cs-r-vdpct" style="color:var(--amber)">-</div>
</div>
</div>
</div>
</div>
</div>
`;

window.CalculatorTemplates['elec-vdrop'] = `
<div class="page" id="page-elec-vdrop">
<div class="calc-header" style="background:linear-gradient(135deg,#f78f22,#d17914)">
<div class="calc-title">⚡ Voltage Drop Calculator</div>
<div class="calc-std">IEC 60364 / NEC basis - resistive component method</div>
</div>
<div class="calc-desc" style="background:#FEF3C7;border-color:rgba(217, 101, 6, 0.25)">Calculate voltage drop
          for a circuit. Uses resistive component only. Reactive component adds 1–3% additional drop in heavily
          inductive circuits.</div>
<div class="elec-unit-note">⚡ Electrical calculators use IEC/SI units (kW, V, A, kVA, mm²) regardless of the
          IP/SI toggle.</div>
<div class="scard">
<div class="scard-head">
<div class="scard-accent" style="background:var(--amber)"></div>
<div class="scard-title">Circuit Inputs</div>
</div>
<div class="scard-body">
<div class="input-group">
<div class="input-label">Phase Type</div>
<div class="chip-row">
<div class="chip sel" data-action-click="setVdPhase(this,'three')" style="border-color:var(--amber)">Three Phase
                </div>
<div class="chip" data-action-click="setVdPhase(this,'single')">Single Phase</div>
</div>
</div>
<div class="input-group" style="margin-top:12px">
<div class="input-label">System Voltage <span class="input-unit">V (L-L)</span></div><select class="inp inp-select" id="vd-volt" data-action-change="calcVDrop()">
<option value="415">415 V</option>
<option value="400">400 V</option>
<option value="480">480 V</option>
<option value="230">230 V</option>
<option value="120">120 V</option>
</select>
</div>
<div class="input-group">
<div class="input-label">Design Current <span class="input-unit">A</span></div><input class="inp" id="vd-current" data-action-input="calcVDrop()" placeholder="e.g. 60" type="number"/>
</div>
<div class="input-group">
<div class="input-label">Cable Length (one-way) <span class="input-unit">m</span></div><input class="inp" id="vd-len" data-action-input="calcVDrop()" placeholder="e.g. 75" type="number"/>
</div>
<div class="input-group">
<div class="input-label">Cable Size <span class="input-unit">mm²</span></div>
<select class="inp inp-select" id="vd-size" data-action-change="calcVDrop()">
<option value="1.5">1.5 mm²</option>
<option value="2.5">2.5 mm²</option>
<option value="4">4 mm²</option>
<option value="6">6 mm²</option>
<option value="10">10 mm²</option>
<option value="16">16 mm²</option>
<option selected="" value="25">25 mm²</option>
<option value="35">35 mm²</option>
<option value="50">50 mm²</option>
<option value="70">70 mm²</option>
<option value="95">95 mm²</option>
<option value="120">120 mm²</option>
<option value="150">150 mm²</option>
<option value="185">185 mm²</option>
<option value="240">240 mm²</option>
<option value="300">300 mm²</option>
</select>
</div>
<div class="input-group">
<div class="input-label">Conductor Material</div>
<div class="chip-row">
<div class="chip sel" data-action-click="setVdMat(this,'cu')" style="border-color:var(--amber)">Copper</div>
<div class="chip" data-action-click="setVdMat(this,'al')">Aluminium</div>
</div>
</div>
<div class="input-group" style="margin-top:12px">
<div class="input-label">Operating Temperature <span class="input-unit">°C</span></div><input class="inp" id="vd-temp" data-action-input="calcVDrop()" placeholder="e.g. 75" type="number"/>
</div>
</div>
</div>
<button class="calc-btn" data-action-click="calcVDrop();showRes('vd-res')" style="background:var(--amber)">⚡ Calculate
          Voltage Drop</button>
<div id="vd-res" style="display:none">
<div id="vd-warn-area"></div>
<div class="scard">
<div class="scard-head">
<div class="scard-accent" style="background:var(--amber)"></div>
<div class="scard-title">Voltage Drop Results</div>
</div>
<div class="scard-body">
<div class="res-row">
<div class="res-label">Conductor resistance at temp</div>
<div class="res-val" id="vd-r-res">-</div>
</div>
<div class="res-row">
<div class="res-label">Voltage drop (V)</div>
<div class="res-val" id="vd-r-vdv">-</div>
</div>
<div class="res-row">
<div class="res-label">Voltage drop (%)</div>
<div class="res-val primary" id="vd-r-pct" style="color:var(--amber)">-</div>
</div>
<div class="res-row">
<div class="res-label">Receiving end voltage</div>
<div class="res-val" id="vd-r-recv">-</div>
</div>
<div class="res-row">
<div class="res-label">IEC 3% limit status</div>
<div class="res-val" id="vd-r-3pct">-</div>
</div>
<div class="res-row">
<div class="res-label">IEC 5% limit status</div>
<div class="res-val" id="vd-r-5pct">-</div>
</div>
</div>
</div>
</div>
</div>
`;

window.CalculatorTemplates['elec-transformer'] = `
<div class="page" id="page-elec-transformer">
<div class="calc-header" style="background:linear-gradient(135deg,#f78f22,#d17914)">
<div class="calc-title">⚡ Transformer Sizing</div>
<div class="calc-std">kVA rating selection - IEC 60076 conceptual basis</div>
</div>
<div class="calc-desc" style="background:#FEF3C7;border-color:rgba(217,119,6,0.25)">Select standard
          transformer kVA rating for a given electrical load with diversity and growth factors.</div>
<div class="elec-unit-note">⚡ Electrical calculators use IEC/SI units (kW, V, A, kVA, mm²) regardless of the
          IP/SI toggle.</div>
<div class="scard">
<div class="scard-head">
<div class="scard-accent" style="background:var(--amber)"></div>
<div class="scard-title">Load Inputs</div>
</div>
<div class="scard-body">
<div class="input-group">
<div class="input-label">Total connected load <span class="input-unit">kW</span></div><input class="inp" id="tx-kw" data-action-input="calcTransformer()" placeholder="e.g. 350" step="5" type="number"/>
</div>
<div class="input-group">
<div class="input-label">Power factor <span class="input-unit">0–1</span></div><input class="inp" id="tx-pf" max="1" min="0.1" data-action-input="calcTransformer()" placeholder="e.g. 0.85" step="0.05" type="number"/>
</div>
<div class="input-group">
<div class="input-label">Diversity factor <span class="input-unit">0–1</span></div><input class="inp" id="tx-div" max="1" min="0.1" data-action-input="calcTransformer()" placeholder="e.g. 0.80" step="0.05" type="number"/>
</div>
<div class="input-group">
<div class="input-label">Future growth factor <span class="input-unit">≥1.0</span></div><input class="inp" id="tx-fut" max="2" min="1" data-action-input="calcTransformer()" placeholder="e.g. 1.20" step="0.05" type="number"/>
</div>
<div class="input-group">
<div class="input-label">Safety margin <span class="input-unit">%</span></div><input class="inp" id="tx-sf" data-action-input="calcTransformer()" placeholder="e.g. 10" type="number"/>
</div>
</div>
</div>
<button class="calc-btn" data-action-click="calcTransformer();showRes('tx-res')" style="background:var(--amber)">⚡ Size
          Transformer</button>
<div id="tx-res" style="display:none">
<div id="tx-warn-area"></div>
<div class="scard">
<div class="scard-head">
<div class="scard-accent" style="background:var(--amber)"></div>
<div class="scard-title">Transformer Selection</div>
</div>
<div class="scard-body">
<div class="res-row">
<div class="res-label">Required kVA (calculated)</div>
<div class="res-val" id="tx-r-req">-</div>
</div>
<div class="res-row">
<div class="res-label">Recommended standard size</div>
<div class="res-val primary" id="tx-r-std" style="color:var(--amber)">-</div>
</div>
<div class="res-row">
<div class="res-label">Loading at design load</div>
<div class="res-val" id="tx-r-load-pct">-</div>
</div>
<div class="res-row">
<div class="res-label">Loading with future factor</div>
<div class="res-val" id="tx-r-fut-pct">-</div>
</div>
<div class="res-row">
<div class="res-label">Headroom remaining</div>
<div class="res-val" id="tx-r-headroom">-</div>
</div>
</div>
</div>
</div>
</div>
`;

window.CalculatorTemplates['elec-generator'] = `
<div class="page" id="page-elec-generator">
<div class="calc-header" style="background:linear-gradient(135deg,#f78f22,#d17914)">
<div class="calc-title">⚡ Generator Sizing</div>
<div class="calc-std">Standby / prime power DG set sizing</div>
</div>
<div class="calc-desc" style="background:#FEF3C7;border-color:rgba(217,119,6,0.25)">Estimate diesel generator
          kVA rating accounting for running loads, motor starting, diversity, and future growth.</div>
<div class="elec-unit-note">⚡ Electrical calculators use IEC/SI units (kW, V, A, kVA, mm²) regardless of the
          IP/SI toggle.</div>
<div class="scard">
<div class="scard-head">
<div class="scard-accent" style="background:var(--amber)"></div>
<div class="scard-title">Load Inputs</div>
</div>
<div class="scard-body">
<div class="input-group">
<div class="input-label">Running load (non-motor) <span class="input-unit">kW</span></div><input class="inp" id="gen-run" data-action-input="calcGenerator()" placeholder="e.g. 150" step="5" type="number"/>
</div>
<div class="input-group">
<div class="input-label">Motor loads (running) <span class="input-unit">kW</span></div><input class="inp" id="gen-mot" data-action-input="calcGenerator()" placeholder="e.g. 50" step="5" type="number"/>
</div>
<div class="input-group">
<div class="input-label">Motor starting method</div>
<select class="inp inp-select" id="gen-start" data-action-change="calcGenerator()">
<option value="6.0">DOL (direct-on-line) - 6× factor</option>
<option selected="" value="2.5">Star-Delta - 2.5× factor</option>
<option value="2.0">Soft starter - 2× factor</option>
<option value="1.5">VFD drive - 1.5× factor</option>
</select>
</div>
<div class="input-group">
<div class="input-label">Power factor <span class="input-unit">0–1</span></div><input class="inp" id="gen-pf" max="1" min="0.1" data-action-input="calcGenerator()" placeholder="e.g. 0.80" step="0.05" type="number"/>
</div>
<div class="input-group">
<div class="input-label">Diversity factor <span class="input-unit">0–1</span></div><input class="inp" id="gen-div" max="1" min="0.1" data-action-input="calcGenerator()" placeholder="e.g. 0.80" step="0.05" type="number"/>
</div>
<div class="input-group">
<div class="input-label">Future growth factor <span class="input-unit">≥1.0</span></div><input class="inp" id="gen-fut" min="1" data-action-input="calcGenerator()" placeholder="e.g. 1.20" step="0.05" type="number"/>
</div>
</div>
</div>
<button class="calc-btn" data-action-click="calcGenerator();showRes('gen-res')" style="background:var(--amber)">⚡ Size
          Generator</button>
<div id="gen-res" style="display:none">
<div id="gen-warn-area"></div>
<div class="duty-card" style="background:linear-gradient(135deg,#d85910,#B45309)">
<div class="duty-label">Generator Duty</div>
<div class="duty-grid">
<div>
<div class="duty-col-label">Running kVA</div>
<div class="duty-val" id="gen-r-run-kva">-</div>
<div class="duty-unit">kVA</div>
</div>
<div class="duty-divider"></div>
<div>
<div class="duty-col-label">Recommended Size</div>
<div class="duty-val" id="gen-r-std">-</div>
<div class="duty-unit">kVA</div>
</div>
</div>
</div>
<div class="scard">
<div class="scard-head">
<div class="scard-accent" style="background:var(--amber)"></div>
<div class="scard-title">Sizing Breakdown</div>
</div>
<div class="scard-body">
<div class="res-row">
<div class="res-label">Running kVA (total)</div>
<div class="res-val" id="gen-r-run">-</div>
</div>
<div class="res-row">
<div class="res-label">Starting kVA (motor peak)</div>
<div class="res-val" id="gen-r-start">-</div>
</div>
<div class="res-row">
<div class="res-label">Governing condition</div>
<div class="res-val" id="gen-r-governs">-</div>
</div>
<div class="res-row">
<div class="res-label">Design kVA (with diversity + growth)</div>
<div class="res-val" id="gen-r-design">-</div>
</div>
<div class="res-row">
<div class="res-label">Loading at design</div>
<div class="res-val" id="gen-r-loading">-</div>
</div>
</div>
</div>
</div>
</div>
`;

window.CalculatorTemplates['elec-pfc'] = `
<div class="page" id="page-elec-pfc">
<div class="calc-header" style="background:linear-gradient(135deg,#f78f22,#d17914)">
<div class="calc-title">⚡ Power Factor Correction</div>
<div class="calc-std">Capacitor bank sizing - Q = P·(tan φ₁ − tan φ₂)</div>
</div>
<div class="calc-desc" style="background:#FEF3C7;border-color:rgba(217,119,6,0.25)">Calculate required
          capacitor bank kVAR to improve power factor to target. Shows kVA reduction and current saving.</div>
<div class="elec-unit-note">⚡ Electrical calculators use IEC/SI units (kW, V, A, kVA, mm²) regardless of the
          IP/SI toggle.</div>
<div class="scard">
<div class="scard-head">
<div class="scard-accent" style="background:var(--amber)"></div>
<div class="scard-title">Inputs</div>
</div>
<div class="scard-body">
<div class="input-group">
<div class="input-label">Active load <span class="input-unit">kW</span></div><input class="inp" id="pfc-kw" data-action-input="calcPFC()" placeholder="e.g. 200" step="5" type="number"/>
</div>
<div class="input-group">
<div class="input-label">Existing power factor</div><input class="inp" id="pfc-pf1" max="1" min="0.1" data-action-input="calcPFC()" placeholder="e.g. 0.72" step="0.01" type="number"/>
</div>
<div class="input-group">
<div class="input-label">Target power factor</div><input class="inp" id="pfc-pf2" max="1" min="0.1" data-action-input="calcPFC()" placeholder="e.g. 0.95" step="0.01" type="number"/>
</div>
<div class="input-group">
<div class="input-label">System voltage <span class="input-unit">V (L-L)</span></div><select class="inp inp-select" id="pfc-volt" data-action-change="calcPFC()">
<option value="415">415 V</option>
<option value="400">400 V</option>
<option value="480">480 V</option>
<option value="230">230 V</option>
</select>
</div>
</div>
</div>
<button class="calc-btn" data-action-click="calcPFC();showRes('pfc-res')" style="background:var(--amber)">⚡ Calculate
          Correction</button>
<div id="pfc-res" style="display:none">
<div id="pfc-warn-area"></div>
<div class="scard">
<div class="scard-head">
<div class="scard-accent" style="background:var(--amber)"></div>
<div class="scard-title">Correction Results</div>
</div>
<div class="scard-body">
<div class="res-row">
<div class="res-label">Required capacitor bank</div>
<div class="res-val primary" id="pfc-r-kvar" style="color:var(--amber)">-</div>
</div>
<div class="res-row">
<div class="res-label">kVA before correction</div>
<div class="res-val" id="pfc-r-kva1">-</div>
</div>
<div class="res-row">
<div class="res-label">kVA after correction</div>
<div class="res-val" id="pfc-r-kva2">-</div>
</div>
<div class="res-row">
<div class="res-label">kVA reduction</div>
<div class="res-val" id="pfc-r-kvared">-</div>
</div>
<div class="res-row">
<div class="res-label">Current before (A)</div>
<div class="res-val" id="pfc-r-i1">-</div>
</div>
<div class="res-row">
<div class="res-label">Current after (A)</div>
<div class="res-val" id="pfc-r-i2">-</div>
</div>
<div class="res-row">
<div class="res-label">Current reduction</div>
<div class="res-val" id="pfc-r-ired">-</div>
</div>
</div>
</div>
</div>
</div>
`;

window.CalculatorTemplates['elec-lighting'] = `
<div class="page" id="page-elec-lighting">
<div class="calc-header" style="background:linear-gradient(135deg,#f78f22,#d17914)">
<div class="calc-title">⚡ Lighting Calculator (Lumen Method)</div>
<div class="calc-std">N = (E × A) / (Φ × UF × MF) - not a DIALux replacement</div>
</div>
<div class="calc-desc" style="background:#FEF3C7;border-color:rgba(217,119,6,0.25)">Estimate number of
          luminaires using the lumen method. Quick sizing tool for preliminary design. Use DIALux or AGi32 for full
          photometric calculations.</div>
<div class="elec-unit-note">⚡ Electrical calculators use IEC/SI units (kW, V, A, kVA, mm²) regardless of the
          IP/SI toggle.</div>
<div class="scard">
<div class="scard-head">
<div class="scard-accent" style="background:var(--amber)"></div>
<div class="scard-title">Room &amp; Lighting Inputs</div>
</div>
<div class="scard-body">
<div class="input-group">
<div class="input-label">Room Area <span class="input-unit" id="lg-area-unit">m²</span></div><input class="inp" id="lg-area" data-action-input="calcLighting()" placeholder="e.g. 200" type="number"/>
</div>
<div class="input-group">
<div class="input-label">Target Illuminance</div>
<select class="inp inp-select" id="lg-lux" data-action-change="calcLighting()">
<option value="50">50 lux - Storage / plant room</option>
<option value="100">100 lux - Corridor / stairwell</option>
<option value="150">150 lux - Warehouse</option>
<option value="200">200 lux - Lobby / reception</option>
<option value="300">300 lux - Workshop / retail</option>
<option selected="" value="500">500 lux - Office (general)</option>
<option value="750">750 lux - Drawing / design office</option>
<option value="1000">1000 lux - Precision work</option>
<option value="custom">Custom lux value…</option>
</select>
</div>
<div class="input-group" id="lg-custom-row" style="display:none">
<div class="input-label">Custom lux level</div><input class="inp" id="lg-lux-custom" data-action-input="calcLighting()" placeholder="e.g. 500" type="number"/>
</div>
<div class="input-group">
<div class="input-label">Luminaire type</div>
<select class="inp inp-select" id="lg-type" data-action-change="calcLighting()">
<option value="3000">LED Panel 600×600 - 3000 lm</option>
<option value="4000">LED Panel 600×600 - 4000 lm</option>
<option value="5000">LED Highbay - 5000 lm</option>
<option value="10000">LED Highbay - 10000 lm</option>
<option value="20000">LED Highbay - 20000 lm</option>
<option value="custom">Custom flux…</option>
</select>
</div>
<div class="input-group" id="lg-flux-row" style="display:none">
<div class="input-label">Custom lamp flux <span class="input-unit">lm</span></div><input class="inp" id="lg-flux-custom" data-action-input="calcLighting()" placeholder="e.g. 4000" type="number"/>
</div>
<div class="input-group">
<div class="input-label">Luminaire wattage <span class="input-unit">W</span></div><input class="inp" id="lg-watt" data-action-input="calcLighting()" placeholder="e.g. 36" type="number"/>
</div>
<div class="input-group">
<div class="input-label">Utilisation factor (UF) <span class="input-unit">0.4–0.8</span></div><input class="inp" id="lg-uf" max="1" min="0.1" data-action-input="calcLighting()" placeholder="e.g. 0.60" step="0.05" type="number"/>
</div>
<div class="input-group">
<div class="input-label">Maintenance factor (MF) <span class="input-unit">0.65–0.85</span></div><input class="inp" id="lg-mf" max="1" min="0.1" data-action-input="calcLighting()" placeholder="e.g. 0.75" step="0.05" type="number"/>
</div>
</div>
</div>
<button class="calc-btn" data-action-click="calcLighting();showRes('lg-res')" style="background:var(--amber)">⚡
          Calculate Lighting</button>
<div id="lg-res" style="display:none">
<div class="scard">
<div class="scard-head">
<div class="scard-accent" style="background:var(--amber)"></div>
<div class="scard-title">Lighting Result</div>
</div>
<div class="scard-body">
<div class="res-row">
<div class="res-label">Number of luminaires</div>
<div class="res-val primary" id="lg-r-n" style="color:var(--amber)">-</div>
</div>
<div class="res-row">
<div class="res-label">Achieved illuminance</div>
<div class="res-val" id="lg-r-achieved">-</div>
</div>
<div class="res-row">
<div class="res-label">Total installed load</div>
<div class="res-val" id="lg-r-load">-</div>
</div>
<div class="res-row">
<div class="res-label">Installed load density</div>
<div class="res-val" id="lg-r-density">-</div>
</div>
</div>
</div>
</div>
</div>
`;

window.CalculatorTemplates['elec-earth'] = `
<div class="page" id="page-elec-earth">
<div class="calc-header" style="background:linear-gradient(135deg,#f78f22,#d17914)">
<div class="calc-title">⚡ Earthing Resistance (Basic)</div>
<div class="calc-std">Dwight formula - BS 7430 / IEEE 142 basis</div>
</div>
<div class="calc-desc" style="background:#FEF3C7;border-color:rgba(217,119,6,0.25)"><strong>Preliminary
            estimation only.</strong> Dwight formula accuracy ±30%. Actual soil resistivity varies with moisture and
          season. Geotechnical survey required for design.</div>
<div class="elec-unit-note">⚡ Electrical calculators use IEC/SI units (kW, V, A, kVA, mm²) regardless of the
          IP/SI toggle.</div>
<div class="scard">
<div class="scard-head">
<div class="scard-accent" style="background:var(--brand)"></div>
<div class="scard-title">Electrode &amp; Soil Inputs</div>
</div>
<div class="scard-body">
<div class="input-group">
<div class="input-label">Soil Type (resistivity guide)</div>
<select class="inp inp-select" id="er-soil-type" data-action-change="setSoilRho(this)">
<option value="20">Wet clay - ~20 Ω·m</option>
<option selected="" value="50">Moist loam - ~50 Ω·m</option>
<option value="100">Dry loam - ~100 Ω·m</option>
<option value="200">Moist sand - ~200 Ω·m</option>
<option value="1000">Dry sand - ~1000 Ω·m</option>
<option value="5000">Gravel - ~5000 Ω·m</option>
<option value="custom">Custom value…</option>
</select>
</div>
<div class="input-group">
<div class="input-label">Soil Resistivity (ρ) <span class="input-unit">Ω·m</span></div><input class="inp" id="er-rho" data-action-input="calcEarthing()" placeholder="e.g. 50" type="number"/>
</div>
<div class="input-group">
<div class="input-label">Electrode Length <span class="input-unit">m</span></div><input class="inp" id="er-len" data-action-input="calcEarthing()" placeholder="e.g. 3" step="0.5" type="number"/>
</div>
<div class="input-group">
<div class="input-label">Electrode Diameter <span class="input-unit">mm</span></div><input class="inp" id="er-dia" data-action-input="calcEarthing()" placeholder="e.g. 16" type="number"/>
</div>
<div class="input-group">
<div class="input-label">Number of electrodes in parallel</div><input class="inp" id="er-n" max="20" min="1" data-action-input="calcEarthing()" placeholder="e.g. 1" type="number"/>
</div>
<div class="input-group" id="er-spacing-row" style="display:none">
<div class="input-label">Electrode spacing <span class="input-unit">m</span></div><input class="inp" id="er-spacing" data-action-input="calcEarthing()" placeholder="e.g. 3" type="number"/>
</div>
</div>
</div>
<button class="calc-btn" data-action-click="calcEarthing();showRes('er-res')" style="background:var(--amber)">⚡
          Calculate Resistance</button>
<div id="er-res" style="display:none">
<div class="scard">
<div class="scard-head">
<div class="scard-accent" style="background:var(--brand)"></div>
<div class="scard-title">Earthing Resistance</div>
</div>
<div class="scard-body">
<div class="res-row">
<div class="res-label">Single electrode resistance</div>
<div class="res-val" id="er-r-single">-</div>
</div>
<div class="res-row">
<div class="res-label">System resistance (parallel)</div>
<div class="res-val primary" id="er-r-system" style="color:var(--brand)">-</div>
</div>
<div class="res-row">
<div class="res-label">vs. 1 Ω (sensitive equipment)</div>
<div class="res-val" id="er-r-1ohm">-</div>
</div>
<div class="res-row">
<div class="res-label">vs. 5 Ω (general earthing)</div>
<div class="res-val" id="er-r-5ohm">-</div>
</div>
<div class="res-row">
<div class="res-label">vs. 10 Ω (lightning protection)</div>
<div class="res-val" id="er-r-10ohm">-</div>
</div>
</div>
</div>
</div>
</div>
`;

window.CalculatorTemplates['elec-sc'] = `
<div class="page" id="page-elec-sc">
<div class="calc-header" style="background:linear-gradient(135deg,#f78f22,#d17914)">
<div class="calc-title">⚡ Short Circuit Current (Basic)</div>
<div class="calc-std">Simplified infinite bus method - preliminary only</div>
</div>
<div class="calc-desc" style="background:#FEF7ED;border-color:rgba(220,38,38,0.3);color:#991B1B"><strong>⚠
            SIMPLIFIED CALCULATION.</strong> Assumes infinite upstream source. Does not account for upstream network
          impedance, cable path impedance, motor contribution, or generator contribution. Use ETAP / DIgSILENT / SKM
          for actual short circuit studies.</div>
<div class="elec-unit-note">⚡ Electrical calculators use IEC/SI units (kW, V, A, kVA, mm²) regardless of the
          IP/SI toggle.</div>
<div class="scard">
<div class="scard-head">
<div class="scard-accent" style="background:var(--brand)"></div>
<div class="scard-title">Transformer Data</div>
</div>
<div class="scard-body">
<div class="input-group">
<div class="input-label">Transformer rating <span class="input-unit">kVA</span></div><select class="inp inp-select" id="sc-kva" data-action-change="calcSC()">
<option value="100">100 kVA</option>
<option value="160">160 kVA</option>
<option value="250">250 kVA</option>
<option value="315">315 kVA</option>
<option value="400">400 kVA</option>
<option value="500">500 kVA</option>
<option value="630">630 kVA</option>
<option value="800">800 kVA</option>
<option selected="" value="1000">1000 kVA</option>
<option value="1250">1250 kVA</option>
<option value="1600">1600 kVA</option>
<option value="2000">2000 kVA</option>
<option value="2500">2500 kVA</option>
</select>
</div>
<div class="input-group">
<div class="input-label">Secondary voltage <span class="input-unit">V (L-L)</span></div><select class="inp inp-select" id="sc-volt" data-action-change="calcSC()">
<option selected="" value="415">415 V</option>
<option value="400">400 V</option>
<option value="480">480 V</option>
<option value="208">208 V</option>
</select>
</div>
<div class="input-group">
<div class="input-label">Transformer impedance (Z%) <span class="input-unit">%</span></div><select class="inp inp-select" id="sc-z" data-action-change="calcSC()">
<option value="4">4% (small TX)</option>
<option selected="" value="5">5% (standard)</option>
<option value="6">6% (large TX)</option>
<option value="7">7% (large TX)</option>
<option value="8">8%</option>
</select>
</div>
<div class="input-group">
<div class="input-label">Cable to fault point <span class="input-unit">mΩ (optional, 0 = busbar
                  fault)</span></div><input class="inp" id="sc-zcable" data-action-input="calcSC()" placeholder="e.g. 0" step="1" type="number"/>
</div>
</div>
</div>
<button class="calc-btn" data-action-click="calcSC();showRes('sc-res')" style="background:var(--amber)">⚡ Estimate Fault
          Current</button>
<div id="sc-res" style="display:none">
<div class="scard">
<div class="scard-head">
<div class="scard-accent" style="background:var(--brand)"></div>
<div class="scard-title">Fault Current (Simplified)</div>
</div>
<div class="scard-body">
<div class="res-row">
<div class="res-label">Transformer impedance (Ω)</div>
<div class="res-val" id="sc-r-zohm">-</div>
</div>
<div class="res-row">
<div class="res-label">Symmetrical fault current (kA)</div>
<div class="res-val primary" id="sc-r-ika" style="color:var(--brand)">-</div>
</div>
<div class="res-row">
<div class="res-label">Asymmetrical peak (kA) - est.</div>
<div class="res-val" id="sc-r-peak">-</div>
</div>
<div class="res-row">
<div class="res-label">Fault MVA</div>
<div class="res-val" id="sc-r-mva">-</div>
</div>
</div>
</div>
<div class="warn-card brand">
<div class="warn-head brand">⚠ Important limitation</div>
<div class="warn-item"><span>•</span><span>Infinite bus assumption - actual fault current will be lower
                due to upstream impedance. Use ETAP, DIgSILENT, or SKM for switchgear and protection
                specification.</span></div>
</div>
</div>
</div>
`;

window.CalculatorTemplates['elec-ups'] = `
<div class="page" id="page-elec-ups">
<div class="calc-header" style="background:linear-gradient(135deg,#f78f22,#d17914)">
<div class="calc-title">⚡ Battery / UPS Sizing</div>
<div class="calc-std">Ah capacity calculation - backup time method</div>
</div>
<div class="calc-desc" style="background:#FEF3C7;border-color:rgba(217,119,6,0.25)">Calculate battery bank
          capacity in Ah for a given load and backup duration. Accounts for inverter efficiency, depth of discharge,
          and ageing factor.</div>
<div class="elec-unit-note">⚡ Electrical calculators use IEC/SI units (kW, V, A, kVA, mm²) regardless of the
          IP/SI toggle.</div>
<div class="scard">
<div class="scard-head">
<div class="scard-accent" style="background:var(--brand)"></div>
<div class="scard-title">Load &amp; Backup Inputs</div>
</div>
<div class="scard-body">
<div class="input-group">
<div class="input-label">Connected load <span class="input-unit">W</span></div><input class="inp" id="ups-load" data-action-input="calcUPS()" placeholder="e.g. 5000" step="100" type="number"/>
</div>
<div class="input-group">
<div class="input-label">Backup time required <span class="input-unit">hours</span></div><input class="inp" id="ups-time" min="0.25" data-action-input="calcUPS()" placeholder="e.g. 1" step="0.25" type="number"/>
</div>
<div class="input-group">
<div class="input-label">Battery bank voltage <span class="input-unit">V DC</span></div><select class="inp inp-select" id="ups-volt" data-action-change="calcUPS()">
<option value="12">12 V</option>
<option value="24">24 V</option>
<option selected="" value="48">48 V</option>
<option value="110">110 V</option>
<option value="220">220 V</option>
</select>
</div>
<div class="input-group">
<div class="input-label">Battery technology</div><select class="inp inp-select" id="ups-tech" data-action-change="calcUPS()">
<option value="0.80">Lead-acid / VRLA (DoD 80%)</option>
<option selected="" value="0.90">Lithium-ion LFP (DoD 90%)</option>
<option value="0.85">Lithium NMC (DoD 85%)</option>
</select>
</div>
<div class="input-group">
<div class="input-label">Inverter efficiency <span class="input-unit">%</span></div><input class="inp" id="ups-eff" data-action-input="calcUPS()" placeholder="e.g. 90" type="number"/>
</div>
<div class="input-group">
<div class="input-label">Ageing / derating factor <span class="input-unit">1.0–1.25</span></div><input class="inp" id="ups-age" max="1.5" min="1" data-action-input="calcUPS()" placeholder="e.g. 1.15" step="0.05" type="number"/>
</div>
</div>
</div>
<button class="calc-btn" data-action-click="calcUPS();showRes('ups-res')" style="background:var(--amber)">⚡ Size Battery
          Bank</button>
<div id="ups-res" style="display:none">
<div class="scard">
<div class="scard-head">
<div class="scard-accent" style="background:var(--brand)"></div>
<div class="scard-title">Battery Sizing Result</div>
</div>
<div class="scard-body">
<div class="res-row">
<div class="res-label">Required capacity (net)</div>
<div class="res-val" id="ups-r-net">-</div>
</div>
<div class="res-row">
<div class="res-label">Required capacity (with ageing)</div>
<div class="res-val primary" id="ups-r-ah" style="color:var(--brand)">-</div>
</div>
<div class="res-row">
<div class="res-label">Bank energy (kWh)</div>
<div class="res-val" id="ups-r-kwh">-</div>
</div>
<div class="res-row">
<div class="res-label">Battery bank voltage</div>
<div class="res-val" id="ups-r-volt">-</div>
</div>
<div class="res-row">
<div class="res-label">Depth of discharge used</div>
<div class="res-val" id="ups-r-dod">-</div>
</div>
<div class="res-row">
<div class="res-label">Inverter efficiency applied</div>
<div class="res-val" id="ups-r-eff">-</div>
</div>
</div>
</div>
</div>
</div>
`;

window.CalculatorTemplates['elec-breaker'] = `
<div class="page" id="page-elec-breaker">
<div class="calc-header" style="background:linear-gradient(135deg,#f78f22,#d17914)">
<div class="calc-title">⚡ Circuit Breaker / Protection Sizing</div>
<div class="calc-std">MCB / MCCB selection - IEC 60898 / IEC 60947 basis</div>
</div>
<div class="calc-desc" style="background:#FEF3C7;border-color:rgba(217,119,6,0.25)">Select the appropriate
          breaker rating for a circuit. Rule: breaker ≥ 1.25 × design current AND ≤ cable ampacity. Estimation tool -
          coordinate with protection engineer for final design.</div>
<div class="elec-unit-note">⚡ Electrical calculators use IEC/SI units (kW, V, A, kVA, mm²) regardless of the
          IP/SI toggle.</div>
<div class="scard">
<div class="scard-head">
<div class="scard-accent" style="background:var(--brand)"></div>
<div class="scard-title">Circuit Inputs</div>
</div>
<div class="scard-body">
<div class="input-group">
<div class="input-label">Design current (Ib) <span class="input-unit">A</span></div><input class="inp" id="cb-ib" data-action-input="calcBreaker()" placeholder="e.g. 45" type="number"/>
</div>
<div class="input-group">
<div class="input-label">Cable ampacity (Iz) - from cable sizing <span class="input-unit">A</span></div>
<input class="inp" id="cb-iz" data-action-input="calcBreaker()" placeholder="e.g. 84" type="number"/>
</div>
<div class="input-group">
<div class="input-label">Safety factor for breaker <span class="input-unit">typical 1.25</span></div>
<input class="inp" id="cb-sf" max="2.0" min="1.0" data-action-input="calcBreaker()" placeholder="e.g. 1.25" step="0.05" type="number"/>
</div>
<div class="input-group">
<div class="input-label">Breaker type</div>
<select class="inp inp-select" id="cb-type" data-action-change="calcBreaker()">
<option value="mcb">MCB - up to 125A (IEC 60898)</option>
<option value="mccb">MCCB - 100A to 2500A (IEC 60947)</option>
<option value="acb">ACB - above 800A</option>
</select>
</div>
</div>
</div>
<button class="calc-btn" data-action-click="calcBreaker();showRes('cb-res')" style="background:var(--amber)">⚡ Size
          Breaker</button>
<div id="cb-res" style="display:none">
<div id="cb-warn-area"></div>
<div class="scard">
<div class="scard-head">
<div class="scard-accent" style="background:var(--brand)"></div>
<div class="scard-title">Breaker Selection</div>
</div>
<div class="scard-body">
<div class="res-row">
<div class="res-label">Minimum breaker rating (Ib × SF)</div>
<div class="res-val" id="cb-r-min">-</div>
</div>
<div class="res-row">
<div class="res-label">Recommended standard rating (In)</div>
<div class="res-val primary" id="cb-r-std" style="color:var(--brand)">-</div>
</div>
<div class="res-row">
<div class="res-label">Cable ampacity check (In ≤ Iz)</div>
<div class="res-val" id="cb-r-cable">-</div>
</div>
<div class="res-row">
<div class="res-label">Loading on breaker (Ib / In)</div>
<div class="res-val" id="cb-r-loading">-</div>
</div>
<div class="res-row">
<div class="res-label">Breaker type</div>
<div class="res-val" id="cb-r-type">-</div>
</div>
<div class="res-row">
<div class="res-label">IEC rule check: Ib ≤ In ≤ Iz</div>
<div class="res-val" id="cb-r-rule">-</div>
</div>
</div>
</div>
</div>
</div>
`;

window.CalculatorTemplates['elec-derating'] = `
<div class="page" id="page-elec-derating">
<div class="calc-header" style="background:linear-gradient(135deg,#f78f22,#d17914)">
<div class="calc-title">⚡ Cable Ampacity &amp; Derating</div>
<div class="calc-std">IEC 60364-5-52 - combined derating factors</div>
</div>
<div class="calc-desc" style="background:#FEF3C7;border-color:rgba(217,119,6,0.25)">Apply multiple derating
          factors to find the actual current capacity of a cable in field conditions. Selects adjusted cable size if
          current capacity drops below design requirement.</div>
<div class="elec-unit-note">⚡ Electrical calculators use IEC/SI units (kW, V, A, kVA, mm²) regardless of the
          IP/SI toggle.</div>
<div class="scard">
<div class="scard-head">
<div class="scard-accent" style="background:var(--brand)"></div>
<div class="scard-title">Base Cable &amp; Derating Inputs</div>
</div>
<div class="scard-body">
<div class="input-group">
<div class="input-label">Cable size <span class="input-unit">mm²</span></div>
<select class="inp inp-select" id="dr-size" data-action-change="calcDerating()">
<option value="1.5">1.5</option>
<option value="2.5">2.5</option>
<option value="4">4</option>
<option value="6">6</option>
<option value="10">10</option>
<option value="16">16</option>
<option selected="" value="25">25</option>
<option value="35">35</option>
<option value="50">50</option>
<option value="70">70</option>
<option value="95">95</option>
<option value="120">120</option>
<option value="150">150</option>
<option value="185">185</option>
<option value="240">240</option>
<option value="300">300</option>
</select>
</div>
<div class="input-group">
<div class="input-label">Installation method</div>
<select class="inp inp-select" id="dr-install" data-action-change="calcDerating()">
<option value="conduit">In conduit / trunking</option>
<option selected="" value="tray">On cable tray</option>
<option value="air">In free air</option>
<option value="buried">Direct buried</option>
</select>
</div>
<div class="input-group">
<div class="input-label">Ambient temperature</div>
<select class="inp inp-select" id="dr-temp" data-action-change="calcDerating()">
<option value="1.06">25°C - factor 1.06</option>
<option selected="" value="1.00">30°C - factor 1.00</option>
<option value="0.94">35°C - factor 0.94</option>
<option value="0.87">40°C - factor 0.87</option>
<option value="0.79">45°C - factor 0.79</option>
<option value="0.71">50°C - factor 0.71</option>
</select>
</div>
<div class="input-group">
<div class="input-label">Grouping (circuits in bundle)</div>
<select class="inp inp-select" id="dr-group" data-action-change="calcDerating()">
<option value="1.00">1 circuit - 1.00</option>
<option value="0.80">2 circuits - 0.80</option>
<option value="0.70">3 circuits - 0.70</option>
<option selected="" value="0.65">4–5 circuits - 0.65</option>
<option value="0.60">6–9 circuits - 0.60</option>
<option value="0.55">10+ circuits - 0.55</option>
</select>
</div>
<div class="input-group">
<div class="input-label">Depth of burial / soil thermal factor</div>
<select class="inp inp-select" id="dr-soil" data-action-change="calcDerating()">
<option selected="" value="1.00">N/A (not buried)</option>
<option value="1.00">Standard soil - 1.00</option>
<option value="0.90">Dry soil - 0.90</option>
<option value="0.80">Very dry soil - 0.80</option>
</select>
</div>
<div class="input-group">
<div class="input-label">Design current required <span class="input-unit">A</span></div><input class="inp" id="dr-ib" data-action-input="calcDerating()" placeholder="e.g. 60" type="number"/>
</div>
</div>
</div>
<button class="calc-btn" data-action-click="calcDerating();showRes('dr-res')" style="background:var(--amber)">⚡ Apply
          Derating</button>
<div id="dr-res" style="display:none">
<div id="dr-warn-area"></div>
<div class="scard">
<div class="scard-head">
<div class="scard-accent" style="background:var(--brand)"></div>
<div class="scard-title">Derating Results</div>
</div>
<div class="scard-body">
<div class="res-row">
<div class="res-label">Base current capacity (30°C)</div>
<div class="res-val" id="dr-r-base">-</div>
</div>
<div class="res-row">
<div class="res-label">Temperature factor</div>
<div class="res-val" id="dr-r-tf">-</div>
</div>
<div class="res-row">
<div class="res-label">Grouping factor</div>
<div class="res-val" id="dr-r-gf">-</div>
</div>
<div class="res-row">
<div class="res-label">Soil/burial factor</div>
<div class="res-val" id="dr-r-sf">-</div>
</div>
<div class="res-row">
<div class="res-label">Combined derating factor</div>
<div class="res-val" id="dr-r-total-f">-</div>
</div>
<div class="res-row">
<div class="res-label">Derated capacity (Iz)</div>
<div class="res-val primary" id="dr-r-iz" style="color:var(--brand)">-</div>
</div>
<div class="res-row">
<div class="res-label">Design current (Ib)</div>
<div class="res-val" id="dr-r-ib">-</div>
</div>
<div class="res-row">
<div class="res-label">Loading</div>
<div class="res-val" id="dr-r-loading">-</div>
</div>
<div class="res-row">
<div class="res-label">Adjusted cable size needed</div>
<div class="res-val primary" id="dr-r-adj" style="color:var(--brand)">-</div>
</div>
</div>
</div>
</div>
</div>
`;

window.CalculatorTemplates['elec-vdopt'] = `
<div class="page" id="page-elec-vdopt">
<div class="calc-header" style="background:linear-gradient(135deg,#f78f22,#d17914)">
<div class="calc-title">⚡ Voltage Drop Optimization</div>
<div class="calc-std">Cable size comparison - find optimal selection</div>
</div>
<div class="calc-desc" style="background:#FEF3C7;border-color:rgba(217,119,6,0.25)">Compare voltage drop
          across all standard cable sizes for a given circuit. Find the smallest cable that satisfies both current and
          voltage drop limits.</div>
<div class="elec-unit-note">⚡ Electrical calculators use IEC/SI units (kW, V, A, kVA, mm²) regardless of the
          IP/SI toggle.</div>
<div class="scard">
<div class="scard-head">
<div class="scard-accent" style="background:var(--brand)"></div>
<div class="scard-title">Circuit Parameters</div>
</div>
<div class="scard-body">
<div class="input-group">
<div class="input-label">Design current <span class="input-unit">A</span></div><input class="inp" id="vo-ib" data-action-input="calcVDOpt()" placeholder="e.g. 60" type="number"/>
</div>
<div class="input-group">
<div class="input-label">Circuit length (one-way) <span class="input-unit">m</span></div><input class="inp" id="vo-len" data-action-input="calcVDOpt()" placeholder="e.g. 80" type="number"/>
</div>
<div class="input-group">
<div class="input-label">System voltage <span class="input-unit">V</span></div><select class="inp inp-select" id="vo-volt" data-action-change="calcVDOpt()">
<option value="415">415 V (3-phase)</option>
<option value="400">400 V (3-phase)</option>
<option value="230">230 V (1-phase)</option>
<option value="120">120 V (1-phase)</option>
</select>
</div>
<div class="input-group">
<div class="input-label">Phase</div>
<div class="chip-row">
<div class="chip sel" data-action-click="setVoPhase(this,'three')" style="border-color:var(--amber)">Three Phase
                </div>
<div class="chip" data-action-click="setVoPhase(this,'single')">Single Phase</div>
</div>
</div>
<div class="input-group" style="margin-top:12px">
<div class="input-label">Conductor material</div>
<div class="chip-row">
<div class="chip sel" data-action-click="setVoMat(this,'cu')" style="border-color:var(--amber)">Copper</div>
<div class="chip" data-action-click="setVoMat(this,'al')">Aluminium</div>
</div>
</div>
<div class="input-group" style="margin-top:12px">
<div class="input-label">Max allowable voltage drop <span class="input-unit">%</span></div><input class="inp" id="vo-limit" max="10" min="1" data-action-input="calcVDOpt()" placeholder="e.g. 3" step="0.5" type="number"/>
</div>
</div>
</div>
<button class="calc-btn" data-action-click="calcVDOpt();showRes('vo-res')" style="background:var(--amber)">⚡ Optimize
          Cable Size</button>
<div id="vo-res" style="display:none">
<div class="scard">
<div class="scard-head">
<div class="scard-accent" style="background:var(--brand)"></div>
<div class="scard-title">Cable Comparison - All Sizes</div>
</div>
<div class="scard-body" id="vo-table"></div>
</div>
<div class="scard">
<div class="scard-head">
<div class="scard-accent" style="background:var(--brand)"></div>
<div class="scard-title">Recommended Selection</div>
</div>
<div class="scard-body">
<div class="res-row">
<div class="res-label">Optimal cable size</div>
<div class="res-val primary" id="vo-r-size" style="color:var(--brand)">-</div>
</div>
<div class="res-row">
<div class="res-label">Voltage drop</div>
<div class="res-val" id="vo-r-vd">-</div>
</div>
<div class="res-row">
<div class="res-label">Current capacity (derated)</div>
<div class="res-val" id="vo-r-iz">-</div>
</div>
<div class="res-row">
<div class="res-label">Selection basis</div>
<div class="res-val" id="vo-r-basis">-</div>
</div>
</div>
</div>
</div>
</div>
`;

window.CalculatorTemplates['elec-panel'] = `
<div class="page" id="page-elec-panel">
<div class="calc-header" style="background:linear-gradient(135deg,#f78f22,#d17914)">
<div class="calc-title">⚡ Panel Load Schedule</div>
<div class="calc-std">Distribution board summary - preliminary</div>
</div>
<div class="calc-desc" style="background:#FEF3C7;border-color:rgba(217,119,6,0.25)">Build a basic load
          schedule for a distribution panel. Enter circuits, apply demand factors, and get total connected and demand
          loads. Preliminary design tool - not a substitute for a full load schedule.</div>
<div class="elec-unit-note">⚡ Electrical calculators use IEC/SI units (kW, V, A, kVA, mm²) regardless of the
          IP/SI toggle.</div>
<div class="scard">
<div class="scard-head">
<div class="scard-accent" style="background:var(--brand)"></div>
<div class="scard-title">Panel Details</div>
</div>
<div class="scard-body">
<div class="input-group">
<div class="input-label">Panel / DB name</div><input class="inp" id="pl-name" placeholder="e.g. DB-L2-01" type="text" value="DB-L2-01"/>
</div>
<div class="input-group">
<div class="input-label">Supply voltage <span class="input-unit">V (L-L)</span></div><select class="inp inp-select" id="pl-volt">
<option selected="" value="415">415 V</option>
<option value="400">400 V</option>
<option value="480">480 V</option>
<option value="230">230 V</option>
</select>
</div>
<div class="input-group">
<div class="input-label">Panel diversity factor <span class="input-unit">0–1</span></div><input class="inp" id="pl-div" max="1.0" min="0.1" placeholder="e.g. 0.80" step="0.05" type="number" value="0.80"/>
</div>
<div class="input-group">
<div class="input-label">Power factor <span class="input-unit">0–1</span></div><input class="inp" id="pl-pf" max="1.0" min="0.1" placeholder="e.g. 0.85" step="0.05" type="number" value="0.85"/>
</div>
</div>
</div>
<div class="scard" id="pl-circuits-card">
<div class="scard-head">
<div class="scard-accent" style="background:var(--brand)"></div>
<div class="scard-title">Circuits</div>
</div>
<div class="scard-body" id="pl-circuit-rows"></div>
<div style="padding:12px 16px;border-top:1px solid var(--border)">
<button data-action-click="addPanelCircuit()" style="width:100%;padding:9px;border-radius:8px;border:1px dashed var(--amber);background:rgba(217,119,6,0.05);color:var(--amber);font-size:12px;font-weight:700;cursor:pointer;font-family:var(--font)">+
              Add Circuit</button>
</div>
</div>
<button class="calc-btn" data-action-click="calcPanel();showRes('pl-res')" style="background:var(--amber)">⚡ Generate
          Schedule</button>
<div id="pl-res" style="display:none">
<div class="scard">
<div class="scard-head">
<div class="scard-accent" style="background:var(--brand)"></div>
<div class="scard-title">Panel Summary</div>
</div>
<div class="scard-body">
<div class="res-row">
<div class="res-label">Total connected load</div>
<div class="res-val" id="pl-r-connected">-</div>
</div>
<div class="res-row">
<div class="res-label">Demand load (after diversity)</div>
<div class="res-val primary" id="pl-r-demand" style="color:var(--brand)">-</div>
</div>
<div class="res-row">
<div class="res-label">Apparent power (kVA)</div>
<div class="res-val primary" id="pl-r-kva" style="color:var(--brand)">-</div>
</div>
<div class="res-row">
<div class="res-label">Incoming current (3-phase)</div>
<div class="res-val primary" id="pl-r-current" style="color:var(--brand)">-</div>
</div>
<div class="res-row">
<div class="res-label">Recommended incomer breaker</div>
<div class="res-val" id="pl-r-breaker">-</div>
</div>
<div class="res-row">
<div class="res-label">Circuit count</div>
<div class="res-val" id="pl-r-circuits">-</div>
</div>
</div>
</div>
</div>
</div>
`;

window.CalculatorTemplates['elec-motor'] = `
<div class="page" id="page-elec-motor">
<div class="calc-header" style="background:linear-gradient(135deg,#f78f22,#d17914)">
<div class="calc-title">⚡ Motor Starting Current</div>
<div class="calc-std">DOL · Star-Delta · Soft Starter · VFD comparison</div>
</div>
<div class="calc-desc" style="background:#FEF3C7;border-color:rgba(217,119,6,0.25)">Calculate motor full-load
          current and peak starting current for all common starting methods. Essential for generator, transformer, and
          breaker sizing.</div>
<div class="elec-unit-note">⚡ Electrical calculators use IEC/SI units (kW, V, A, kVA, mm²) regardless of the
          IP/SI toggle.</div>
<div class="scard">
<div class="scard-head">
<div class="scard-accent" style="background:var(--brand)"></div>
<div class="scard-title">Motor Parameters</div>
</div>
<div class="scard-body">
<div class="input-group">
<div class="input-label">Motor power</div>
<select class="inp inp-select" id="mot-pow" data-action-change="calcMotor()">
<option value="0.75">0.75 kW (1 HP)</option>
<option value="1.5">1.5 kW (2 HP)</option>
<option value="2.2">2.2 kW (3 HP)</option>
<option value="3.7">3.7 kW (5 HP)</option>
<option value="5.5">5.5 kW (7.5 HP)</option>
<option value="7.5">7.5 kW (10 HP)</option>
<option value="11">11 kW (15 HP)</option>
<option value="15">15 kW (20 HP)</option>
<option value="18.5">18.5 kW (25 HP)</option>
<option selected="" value="22">22 kW (30 HP)</option>
<option value="30">30 kW (40 HP)</option>
<option value="37">37 kW (50 HP)</option>
<option value="45">45 kW (60 HP)</option>
<option value="55">55 kW (75 HP)</option>
<option value="75">75 kW (100 HP)</option>
<option value="90">90 kW (125 HP)</option>
<option value="110">110 kW (150 HP)</option>
<option value="custom">Custom kW…</option>
</select>
</div>
<div class="input-group" id="mot-custom-row" style="display:none">
<div class="input-label">Custom power <span class="input-unit">kW</span></div><input class="inp" id="mot-custom" data-action-input="calcMotor()" placeholder="e.g. 22" type="number"/>
</div>
<div class="input-group">
<div class="input-label">Supply voltage <span class="input-unit">V (L-L)</span></div><select class="inp inp-select" id="mot-volt" data-action-change="calcMotor()">
<option selected="" value="415">415 V</option>
<option value="400">400 V</option>
<option value="480">480 V</option>
<option value="6600">6.6 kV</option>
<option value="11000">11 kV</option>
</select>
</div>
<div class="input-group">
<div class="input-label">Motor efficiency <span class="input-unit">%</span></div><input class="inp" id="mot-eff" data-action-input="calcMotor()" placeholder="e.g. 92" type="number"/>
</div>
<div class="input-group">
<div class="input-label">Motor power factor</div><input class="inp" id="mot-pf" data-action-input="calcMotor()" placeholder="e.g. 0.85" step="0.05" type="number"/>
</div>
<div class="input-group">
<div class="input-label">Service factor <span class="input-unit">1.0–1.25</span></div><input class="inp" id="mot-sf" data-action-input="calcMotor()" placeholder="e.g. 1.0" step="0.05" type="number"/>
</div>
</div>
</div>
<button class="calc-btn" data-action-click="calcMotor();showRes('mot-res')" style="background:var(--amber)">⚡ Calculate
          Starting Current</button>
<div id="mot-res" style="display:none">
<div class="scard">
<div class="scard-head">
<div class="scard-accent" style="background:var(--brand)"></div>
<div class="scard-title">Motor Full-Load Current</div>
</div>
<div class="scard-body">
<div class="res-row">
<div class="res-label">Full-load current (FLC)</div>
<div class="res-val primary" id="mot-r-flc" style="color:var(--brand)">-</div>
</div>
<div class="res-row">
<div class="res-label">Service factor current</div>
<div class="res-val" id="mot-r-sfc">-</div>
</div>
</div>
</div>
<div class="scard">
<div class="scard-head">
<div class="scard-accent" style="background:var(--brand)"></div>
<div class="scard-title">Starting Current by Method</div>
</div>
<div class="scard-body">
<div class="res-row">
<div class="res-label">DOL (Direct-on-line) - 6× FLC</div>
<div class="res-val" id="mot-r-dol">-</div>
</div>
<div class="res-row">
<div class="res-label">Star-Delta - 2× FLC (inrush ~6×, reduced to 2×)</div>
<div class="res-val" id="mot-r-sd">-</div>
</div>
<div class="res-row">
<div class="res-label">Soft Starter - 2.5× FLC (adjustable)</div>
<div class="res-val" id="mot-r-ss">-</div>
</div>
<div class="res-row">
<div class="res-label">VFD - 1.1× FLC (smooth ramp)</div>
<div class="res-val" id="mot-r-vfd">-</div>
</div>
<div class="res-row">
<div class="res-label">kVA for generator (DOL)</div>
<div class="res-val" id="mot-r-kva-gen">-</div>
</div>
<div class="res-row">
<div class="res-label">kVA for generator (Star-Delta)</div>
<div class="res-val" id="mot-r-kva-sd">-</div>
</div>
</div>
</div>
</div>
</div>
`;

window.CalculatorTemplates['elec-conduit'] = `
<div class="page" id="page-elec-conduit">
<div class="calc-header" style="background:linear-gradient(135deg,#f78f22,#d17914)">
<div class="calc-title">⚡ Conduit Sizing Calculator</div>
<div class="calc-std">IEC 61386 / NEC Chapter 9 - cable fill method</div>
</div>
<div class="calc-desc" style="background:#FEF3C7;border-color:rgba(217,119,6,0.25)">Select conduit size based
          on cable fill ratio. Maximum fill: 40% for 3+ cables, 53% for 2 cables, 31% for 1 cable (NEC Table 1).
          Estimation - verify with conduit manufacturer fill tables.</div>
<div class="elec-unit-note">⚡ Electrical calculators use IEC/SI units (kW, V, A, kVA, mm²) regardless of the
          IP/SI toggle.</div>
<div class="scard">
<div class="scard-head">
<div class="scard-accent" style="background:var(--brand)"></div>
<div class="scard-title">Cables in Conduit</div>
</div>
<div class="scard-body" id="conduit-cable-rows"></div>
<div style="padding:10px 16px;border-top:1px solid var(--border)">
<button data-action-click="addConduitCable()" style="width:100%;padding:8px;border-radius:8px;border:1px dashed var(--amber);background:rgba(217,119,6,0.05);color:var(--amber);font-size:12px;font-weight:700;cursor:pointer;font-family:var(--font)">+
              Add Cable</button>
</div>
</div>
<button class="calc-btn" data-action-click="calcConduit();showRes('conduit-res')" style="background:var(--amber)">⚡ Size
          Conduit</button>
<div id="conduit-res" style="display:none">
<div id="conduit-warn-area"></div>
<div class="scard">
<div class="scard-head">
<div class="scard-accent" style="background:var(--brand)"></div>
<div class="scard-title">Conduit Selection</div>
</div>
<div class="scard-body">
<div class="res-row">
<div class="res-label">Total cable area</div>
<div class="res-val" id="conduit-r-area">-</div>
</div>
<div class="res-row">
<div class="res-label">Number of cables</div>
<div class="res-val" id="conduit-r-count">-</div>
</div>
<div class="res-row">
<div class="res-label">Max fill ratio allowed</div>
<div class="res-val" id="conduit-r-maxfill">-</div>
</div>
<div class="res-row">
<div class="res-label">Minimum conduit size</div>
<div class="res-val primary" id="conduit-r-size" style="color:var(--brand)">-</div>
</div>
<div class="res-row">
<div class="res-label">Actual fill ratio</div>
<div class="res-val" id="conduit-r-fill">-</div>
</div>
</div>
</div>
</div>
</div>
`;

window.CalculatorTemplates['elec-lux'] = `
<div class="page" id="page-elec-lux">
<div class="calc-header" style="background:linear-gradient(135deg,#f78f22,#d17914)">
<div class="calc-title">⚡ Lux Level Recommendation</div>
<div class="calc-std">EN 12464-1 / AS/NZS 1680 / IES reference levels</div>
</div>
<div class="calc-desc" style="background:#FEF3C7;border-color:rgba(217,119,6,0.25)">Quick reference for
          recommended illuminance levels by space type. Use these as design targets for the Lighting Lumen Calculator.
          Based on EN 12464-1 (Europe) and IES (North America).</div>
<div class="elec-unit-note">⚡ Electrical calculators use IEC/SI units (kW, V, A, kVA, mm²) regardless of the
          IP/SI toggle.</div>
<div class="scard">
<div class="scard-head">
<div class="scard-accent" style="background:var(--brand)"></div>
<div class="scard-title">Select Space Type</div>
</div>
<div class="scard-body">
<div class="input-group">
<div class="input-label">Building category</div>
<select class="inp inp-select" id="lux-cat" data-action-change="updateLuxRec()">
<option value="office">Office &amp; Commercial</option>
<option value="industrial">Industrial &amp; Warehouse</option>
<option value="health">Healthcare &amp; Medical</option>
<option value="education">Education</option>
<option value="hospitality">Hospitality &amp; Retail</option>
<option value="residential">Residential</option>
<option value="outdoor">Outdoor &amp; Carpark</option>
<option value="emergency">Emergency &amp; Safety</option>
</select>
</div>
<div class="input-group">
<div class="input-label">Space / room type</div>
<select class="inp inp-select" id="lux-space" data-action-change="updateLuxRec()"></select>
</div>
</div>
</div>
<div id="lux-result-card" style="display:none">
<div class="scard">
<div class="scard-head">
<div class="scard-accent" style="background:var(--brand)"></div>
<div class="scard-title">Recommended Illuminance</div>
</div>
<div class="scard-body">
<div class="res-row">
<div class="res-label">Maintained illuminance (Em)</div>
<div class="res-val primary" id="lux-r-em" style="color:var(--brand)">-</div>
</div>
<div class="res-row">
<div class="res-label">Uniformity ratio (Uo)</div>
<div class="res-val" id="lux-r-uo">-</div>
</div>
<div class="res-row">
<div class="res-label">Limiting glare index (UGR)</div>
<div class="res-val" id="lux-r-ugr">-</div>
</div>
<div class="res-row">
<div class="res-label">Colour rendering index (Ra)</div>
<div class="res-val" id="lux-r-ra">-</div>
</div>
<div class="res-row">
<div class="res-label">Standard reference</div>
<div class="res-val" id="lux-r-std">-</div>
</div>
<div class="res-row">
<div class="res-label">Typical installed load</div>
<div class="res-val" id="lux-r-load">-</div>
</div>
</div>
</div>
<div style="padding:12px 16px;background:rgba(217,119,6,0.06);border-radius:10px;border:1px solid rgba(217,119,6,0.2);margin-bottom:14px">
<div style="font-size:11px;font-weight:700;color:var(--amber);margin-bottom:6px">💡 Use with Lighting
              Calculator</div>
<div id="lux-r-tip" style="font-size:12px;color:var(--muted);line-height:1.6">Enter this lux level in the
              Lighting (Lumen) calculator to determine number of luminaires required.</div>
</div>
</div>
</div>
`;

window.CalculatorTemplates['elec-design-check'] = `
<div class="page" id="page-elec-design-check">
<div class="calc-header" style="background:linear-gradient(135deg,#f78f22,#d17914)">
<div class="calc-title">⚡ Electrical Design Check Tool</div>
<div class="calc-std">Design assistant - cable · voltage drop · breaker validation</div>
</div>
<div class="calc-desc" style="background:#FEF3C7;border-color:rgba(217,119,6,0.25)">Enter your electrical
          design values and get instant feedback on cable loading, voltage drop, breaker sizing, and power factor
          compliance. Acts as a second opinion on your design.</div>
<div class="elec-unit-note">⚡ Electrical calculators use IEC/SI units (kW, V, A, kVA, mm²) regardless of the
          IP/SI toggle.</div>
<div class="scard">
<div class="scard-head">
<div class="scard-accent" style="background:var(--brand)"></div>
<div class="scard-title">Circuit Design Values</div>
</div>
<div class="scard-body">
<div class="input-group">
<div class="input-label">Design current (Ib) <span class="input-unit">A</span></div><input class="inp" id="edc-ib" data-action-input="runElecCheck()" placeholder="e.g. 65" type="number"/>
</div>
<div class="input-group">
<div class="input-label">Cable ampacity after derating (Iz) <span class="input-unit">A</span></div>
<input class="inp" id="edc-iz" data-action-input="runElecCheck()" placeholder="e.g. 84" type="number"/>
</div>
<div class="input-group">
<div class="input-label">Breaker rating (In) <span class="input-unit">A</span></div><input class="inp" id="edc-in" data-action-input="runElecCheck()" placeholder="e.g. 80" type="number"/>
</div>
<div class="input-group">
<div class="input-label">Voltage drop <span class="input-unit">%</span></div><input class="inp" id="edc-vd" data-action-input="runElecCheck()" placeholder="e.g. 2.8" step="0.1" type="number"/>
</div>
<div class="input-group">
<div class="input-label">Power factor</div><input class="inp" id="edc-pf" data-action-input="runElecCheck()" placeholder="e.g. 0.87" step="0.01" type="number"/>
</div>
<div class="input-group">
<div class="input-label">Operating temperature <span class="input-unit">°C</span></div><input class="inp" id="edc-temp" data-action-input="runElecCheck()" placeholder="e.g. 38" type="number"/>
</div>
</div>
</div>
<button class="calc-btn" data-action-click="runElecCheck();showRes('edc-res')" style="background:var(--amber)">🔍 Run
          Design Check</button>
<div id="edc-res" style="display:none">
<div class="scard">
<div class="scard-head">
<div class="scard-accent" style="background:var(--brand)"></div>
<div class="scard-title">Design Check Results</div>
</div>
<div class="scard-body" id="edc-results-body"></div>
</div>
</div>
</div>
`;

window.CalculatorTemplates['elec-tray'] = `
<div class="page full-width-page" id="page-elec-tray">
  <style>
    #page-elec-tray .eng-table th, 
    #page-elec-tray .eng-table td {
      border: 1px solid var(--border) !important;
      vertical-align: middle;
      padding: 0 !important;
    }
    #page-elec-tray .eng-table th {
      padding: 10px 8px !important;
      background: var(--brand);
      color: #fff;
      font-weight: 700;
      border: 1px solid rgba(255, 255, 255, 0.2) !important;
      letter-spacing: 0.5px;
    }
    #page-elec-tray .eng-table tbody select {
      border: none;
      background: transparent;
      outline: none;
      cursor: pointer;
      width: 100%;
      height: 38px;
      font-weight: 600;
      font-family: inherit;
      color: var(--text);
      text-align: center;
      text-align-last: center;
      box-sizing: border-box;
      padding: 0 8px;
      transition: background 0.15s;
    }
    #page-elec-tray .eng-table tbody input:not([type="checkbox"]) {
      border: none;
      background: transparent;
      outline: none;
      width: 100%;
      height: 38px;
      font-weight: 600;
      font-family: inherit;
      color: var(--text);
      box-sizing: border-box;
      padding: 0 8px;
      transition: background 0.15s;
    }
    #page-elec-tray .eng-table tbody input.center {
      text-align: center;
    }
    #page-elec-tray .eng-table tbody select:focus,
    #page-elec-tray .eng-table tbody input:not([type="checkbox"]):focus {
      background: #fff;
      box-shadow: inset 0 0 0 2px var(--brand);
    }
    #page-elec-tray .eng-table input[type="checkbox"] {
      width: 16px !important;
      height: 16px !important;
      margin: 0 auto;
      display: block;
      cursor: pointer;
    }
    #page-elec-tray tbody[id^="elec-tray-entry-tbody-"] .pcl-inline-inp,
    #page-elec-tray tbody[id^="elec-tray-entry-tbody-"] .pcl-inline-select {
      border-color: #fbd38d;
      background: #fff;
      padding: 5px 7px;
      border-radius: 6px;
      font-size: 12px;
    }
    #page-elec-tray tbody[id^="elec-tray-entry-tbody-"] .pcl-inline-inp:focus,
    #page-elec-tray tbody[id^="elec-tray-entry-tbody-"] .pcl-inline-select:focus {
      border-color: var(--brand);
      box-shadow: 0 0 0 3px rgba(247, 143, 34, 0.15);
    }
  </style>

  <div class="calc-header" style="background:var(--brand); padding: 20px; border-radius: 8px 8px 0 0; color:#fff">
    <div class="calc-title" style="font-size:20px; font-weight:800; margin:0">Cable Tray Containment Sizing</div>
    <div class="calc-std" style="font-size:12.5px; opacity:0.9; margin: 4px 0 8px">MEP Electrical Design Calculations</div>
    <span style="background:rgba(255,255,255,0.2); border:1px solid rgba(255,255,255,0.4); color:#fff; padding:3px 10px; border-radius:20px; font-size:11px; font-weight:700; display:inline-block">⚡ Electrical</span>
  </div>

  <div class="calc-desc" style="background:#FFFBEB; border:1px solid #FEF3C7; border-left:4px solid #F59E0B; color:#B45309; padding:12px 16px; border-radius:6px; margin: 16px 0; font-size:12.5px; line-height:1.5">
    Calculates required cable tray containment width based on cable diameters lookup, 1D spacing rule, and 20% spare capacity, mapping to standard configurations.
  </div>

  <div class="elec-unit-note" style="background:#FFF7ED; border:1px solid #FFEDD5; color:#C2410C; padding:10px 14px; border-radius:6px; margin-bottom:16px; font-size:12px; font-weight:600">
    ⚡ Electrical calculators use IEC/SI units (kW, V, A, kVA, mm²) regardless of the IP/SI toggle.
  </div>

  <!-- Global Action Bar -->
  <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:16px; flex-wrap:wrap; gap:12px">
    <div class="search-box" style="flex:1; max-width:400px; padding:6px 12px; border-radius:8px; background:var(--bg)">
      <span class="search-icon">🔍</span>
      <input class="search-inp" id="elec-tray-search" data-action-input="window.cableTrayRender()" placeholder="Search trays, cables or sizes..." type="text"/>
    </div>
    <div style="display:flex; align-items:center; gap:8px">
      <button class="pcl-inline-btn" data-action-click="window.cableTrayAddTray()" style="width:auto !important; padding:8px 16px; background:var(--brand); color:#fff; font-weight:700; border:none; border-radius:8px; cursor:pointer; display:flex; align-items:center; gap:6px; white-space:nowrap; font-size:12.5px; box-shadow:0 2px 4px rgba(247,143,34,0.1)">
        ➕ Add Cable Tray
      </button>
      <button class="pcl-inline-btn" data-action-click="window.cableTrayExportExcel()" style="width:auto !important; padding:8px 14px; background:#64748b; color:#fff; font-weight:700; border:none; border-radius:8px; cursor:pointer; display:flex; align-items:center; gap:6px; white-space:nowrap; font-size:12.5px">
        📊 Export All Trays
      </button>
    </div>
  </div>

  <!-- Container for Dynamic Cable Tray Cards -->
  <div id="elec-trays-container" style="margin-top:16px"></div>

  <!-- Results Panel -->
  <div id="elec-tray-res" style="display:flex; flex-direction:column; gap:10px; margin-top:16px">
    <div id="elec-tray-warn-area"></div>

    <!-- Hidden values for debugging & script compatibility -->
    <div style="display:none">
      <span id="elec-tray-r-width-required"></span>
      <span id="elec-tray-r-width-cables"></span>
      <span id="elec-tray-r-width-spacing"></span>
      <span id="elec-tray-r-width-spare"></span>
      <span id="elec-tray-r-width-available"></span>
      <span id="elec-tray-r-tray-size"></span>
      <span id="elec-tray-r-tray-count"></span>
      <span id="elec-tray-r-actual-spare"></span>
      <span id="elec-tray-r-status"></span>
    </div>
    
    <div class="scard" style="margin-top:10px;background:var(--amber-lt);border:1px solid rgba(217,119,6,0.2)">
      <div class="scard-body" style="padding:14px 16px">
        <div style="font-size:11px;font-weight:700;color:var(--amber);text-transform:uppercase;letter-spacing:.5px;margin-bottom:6px">📋 Project Sizing Summary</div>
        <div id="elec-tray-summary-text" style="font-size:12.5px;color:var(--text);line-height:1.5;font-weight:500">
          <!-- Generated summary -->
        </div>
      </div>
    </div>
  </div>
</div>
`;


window.CalculatorTemplates['elec-cbs'] = `
<div class="page" id="page-elec-cbs">
  <div class="calc-header" style="background:linear-gradient(135deg,#f78f22,#d17914)">
    <div class="two-col-header-left">
      <div class="calc-title">⚡ CBS Battery Sizing Calculator</div>
      <div class="calc-std">Central Battery System for Emergency Lighting</div>
    </div>
    <div class="two-col-header-badge">⚡ Electrical</div>
  </div>

  <div class="calc-desc" style="background:#FEF3C7;border-color:rgba(217,119,6,0.25);color:#d65e19">
    Calculates total emergency lighting load, safety margins (+25% and +20%), required CBS rating in kVA, and the battery capacity (Ah/kWh) for specified backup hours.
  </div>

  <div class="elec-unit-note">⚡ Electrical calculators use IEC/SI units (kW, V, A, kVA, mm²) regardless of the IP/SI toggle.</div>

  <!-- Section 1: Floor-wise Load Schedule -->
  <div class="scard">
    <div class="scard-head">
      <div class="scard-accent" style="background:var(--amber)"></div>
      <div class="scard-title">Section 1: Floor-wise Emergency Lighting Loads</div>
    </div>
    <div class="scard-body" style="padding:0">
      <div style="padding:12px 16px;overflow-x:auto">
        <div class="pcl-table-wrap">
          <table style="width:100%;border-collapse:collapse;font-size:12.5px;table-layout:fixed">
            <colgroup>
              <col style="width:60%"/>
              <col style="width:30%"/>
              <col style="width:50px"/>
            </colgroup>
            <thead>
              <tr style="background:var(--amber);color:#fff">
                <th style="padding:9px 10px;text-align:left;font-weight:700;font-size:11.5px">Floor / Area Description</th>
                <th style="padding:9px 10px;text-align:center;font-weight:700;font-size:11.5px">Emergency Load (kW)</th>
                <th style="padding:9px 4px;text-align:center;font-size:10px">Del</th>
              </tr>
            </thead>
            <tbody id="elec-cbs-tbody">
              <!-- Dynamic rows populated by JS -->
            </tbody>
          </table>
          
          <!-- Empty State -->
          <div class="pcl-empty-hero" id="elec-cbs-empty" style="display:none;padding:20px;text-align:center;background:#fff">
            <div class="pcl-empty-icon">🔋</div>
            <div style="font-size:13px;font-weight:600;color:var(--muted);margin-bottom:4px">No floors in schedule</div>
            <div style="font-size:11.5px;color:var(--hint)">Click <strong>+ Add Floor</strong> below to add one.</div>
          </div>
        </div>
      </div>
      <div style="padding:0 16px 16px;display:flex;gap:10px;justify-content:space-between">
        <button class="pcl-inline-btn" data-action-click="window.cbsAddRow()" style="background:var(--amber);color:#fff;border:none;border-radius:4px;padding:6px 12px;font-weight:700;cursor:pointer">+ Add Floor</button>
        <button class="pcl-inline-btn secondary" data-action-click="window.cbsClearAll()" style="padding:6px 12px;cursor:pointer">Clear All</button>
      </div>
    </div>
  </div>

  <!-- Section 2: System Configuration -->
  <div class="scard">
    <div class="scard-head">
      <div class="scard-accent" style="background:var(--amber)"></div>
      <div class="scard-title">Section 2: System Configuration</div>
    </div>
    <div class="scard-body">
      <div class="input-group">
        <div class="input-label">Power Factor</div>
        <input class="inp" id="elec-cbs-pf" type="number" min="0.5" max="1.0" step="0.01" value="0.85" data-action-input="window.calcCBS()"/>
      </div>
      
      <div class="input-group">
        <div class="input-label">Battery Backup Time (hours)</div>
        <select class="inp inp-select" id="elec-cbs-backup-time" data-action-change="window.calcCBS()">
          <option value="1">1 Hour</option>
          <option value="1.5">1.5 Hours</option>
          <option value="2">2 Hours</option>
          <option value="3" selected>3 Hours</option>
          <option value="4">4 Hours</option>
          <option value="5">5 Hours</option>
          <option value="8">8 Hours</option>
        </select>
      </div>
      
      <div class="input-group">
        <div class="input-label">Battery System DC Voltage (V)</div>
        <select class="inp inp-select" id="elec-cbs-voltage" data-action-change="window.calcCBS()">
          <option value="24">24 V DC</option>
          <option value="48">48 V DC</option>
          <option value="110">110 V DC</option>
          <option value="220" selected>220 V DC</option>
          <option value="custom">Custom</option>
        </select>
      </div>

      <div class="input-group" id="elec-cbs-custom-volt-group" style="display:none">
        <div class="input-label">Custom Battery Voltage (V DC)</div>
        <input class="inp" id="elec-cbs-custom-volt" type="number" min="12" step="1" placeholder="e.g. 120" data-action-input="window.calcCBS()"/>
      </div>

      <div class="input-group">
        <div class="input-label">Selected CBS Capacity (kVA)</div>
        <select class="inp inp-select" id="elec-cbs-selected-rating" data-action-change="window.calcCBS()">
          <option value="0.5">0.5 kVA</option>
          <option value="1">1 kVA</option>
          <option value="2">2 kVA</option>
          <option value="3">3 kVA</option>
          <option value="5" selected>5 kVA</option>
          <option value="7.5">7.5 kVA</option>
          <option value="10">10 kVA</option>
          <option value="15">15 kVA</option>
          <option value="20">20 kVA</option>
          <option value="25">25 kVA</option>
          <option value="30">30 kVA</option>
          <option value="40">40 kVA</option>
          <option value="50">50 kVA</option>
          <option value="60">60 kVA</option>
          <option value="80">80 kVA</option>
          <option value="100">100 kVA</option>
          <option value="120">120 kVA</option>
          <option value="150">150 kVA</option>
          <option value="custom">Custom / Exceeds</option>
        </select>
      </div>

      <div class="input-group" id="elec-cbs-custom-rating-group" style="display:none">
        <div class="input-label">Custom CBS Capacity (kVA)</div>
        <input class="inp" id="elec-cbs-custom-rating" type="number" min="0.1" step="0.1" placeholder="e.g. 12.5" data-action-input="window.calcCBS()"/>
      </div>
    </div>
  </div>

  <button class="calc-btn" data-action-click="window.calcCBS();window.showRes('elec-cbs-res')" style="background:var(--amber);color:#fff">⚡ Size CBS & Battery</button>

  <!-- Results Panel -->
  <div id="elec-cbs-res" style="display:none">
    <div id="elec-cbs-warn-area"></div>
    
    <div class="scard">
      <div class="scard-head">
        <div class="scard-accent" style="background:var(--amber)"></div>
        <div class="scard-title">Sizing Results</div>
      </div>
      <div class="scard-body">
        <div class="res-row">
          <div class="res-label">Total Connected Load</div>
          <div class="res-val" id="elec-cbs-r-total-load">-</div>
        </div>
        <div class="res-row">
          <div class="res-label">Design Load (with +25% and +20% margins)</div>
          <div class="res-val" id="elec-cbs-r-design-load-kw">-</div>
        </div>
        <div class="res-row">
          <div class="res-label">Required Capacity (kVA)</div>
          <div class="res-val primary" id="elec-cbs-r-design-load-kva" style="color:var(--amber)">-</div>
        </div>
        <div class="res-row">
          <div class="res-label">Recommended CBS Rating</div>
          <div class="res-val" id="elec-cbs-r-recommended-rating">-</div>
        </div>
        <div class="res-row">
          <div class="res-label">Battery Capacity (kWh)</div>
          <div class="res-val" id="elec-cbs-r-battery-kwh">-</div>
        </div>
        <div class="res-row">
          <div class="res-label">Battery Capacity (Ah)</div>
          <div class="res-val" id="elec-cbs-r-battery-ah">-</div>
        </div>
        <div class="res-row">
          <div class="res-label">Selected Capacity</div>
          <div class="res-val" id="elec-cbs-r-selected-capacity">-</div>
        </div>
        <div class="res-row">
          <div class="res-label">Acceptability Status</div>
          <div class="res-val primary" id="elec-cbs-r-status" style="font-weight:800">-</div>
        </div>
      </div>
    </div>
    
    <div class="scard" style="margin-top:10px;background:var(--amber-lt);border:1px solid rgba(217,119,6,0.2)">
      <div class="scard-body" style="padding:14px 16px">
        <div style="font-size:11px;font-weight:700;color:var(--amber);text-transform:uppercase;letter-spacing:.5px;margin-bottom:6px">📋 CBS Sizing Summary</div>
        <div id="elec-cbs-summary-text" style="font-size:12.5px;color:var(--text);line-height:1.5;font-weight:500">
          <!-- Generated summary -->
        </div>
      </div>
    </div>
  </div>
</div>
`;

window.CalculatorTemplates['elec-density-wsf'] = `
<div class="page full-width-page" id="page-elec-density-wsf">
  <style>
    #page-elec-density-wsf .eng-table th, 
    #page-elec-density-wsf .eng-table td {
      border: 1px solid var(--border) !important;
    }
    #page-elec-density-wsf .eng-table input::placeholder {
      font-style: italic;
      color: #9ca3af;
    }
    #page-elec-density-wsf .eng-table select {
      border: none;
      background: transparent;
      outline: none;
      -webkit-appearance: none;
      -moz-appearance: none;
      appearance: none;
      cursor: pointer;
    }
    #page-elec-density-wsf .eng-table select::-ms-expand {
      display: none;
    }
  </style>

  <div class="calc-header" style="background:var(--brand); padding: 20px; border-radius: 8px 8px 0 0; color:#fff">
    <div class="calc-title" style="font-size:20px; font-weight:800; margin:0">Density (W/Sq.M) Calculator</div>
    <div class="calc-std" style="font-size:12.5px; opacity:0.9; margin: 4px 0 8px">Space Planning & Area Power Density Sizing (Spreadsheet Mode)</div>
    <span style="background:rgba(255,255,255,0.2); border:1px solid rgba(255,255,255,0.4); color:#fff; padding:3px 10px; border-radius:20px; font-size:11px; font-weight:700; display:inline-block">⚡ Electrical</span>
  </div>

  <div class="calc-desc" style="background:#FFFBEB; border:1px solid #FEF3C7; border-left:4px solid #F59E0B; color:#B45309; padding:12px 16px; border-radius:6px; margin: 16px 0; font-size:12.5px; line-height:1.5">
    Determines power density in Watts per Square Meter based on selected light types, counts, and areas. Yellow fields represent light properties, and green fields represent active user inputs.
  </div>

  <div class="elec-unit-note" style="background:#FFF7ED; border:1px solid #FFEDD5; color:#C2410C; padding:10px 14px; border-radius:6px; margin-bottom:16px; font-size:12px; font-weight:600">
    ⚡ Electrical calculators use IEC/SI units (kW, V, A, kVA, mm²) regardless of the IP/SI toggle.
  </div>

  <!-- Interactive Schedule Section -->
  <div class="scard" style="border:1px solid var(--border); border-radius:8px; background:#fff; overflow:hidden; margin-bottom:16px">
    <div class="scard-head" style="display:flex; justify-content:space-between; align-items:center; padding:14px 16px; border-bottom:1px solid var(--border)">
      <div style="display:flex; align-items:center; gap:8px">
        <div style="width:4px; height:16px; background:var(--brand); border-radius:2px"></div>
        <div class="scard-title" style="font-weight:700; font-size:12.5px; color:#475569; text-transform:uppercase; letter-spacing:0.5px">Area Sizing Schedule</div>
      </div>
      <div style="display:flex; gap:8px">
        <button class="pcl-inline-btn" data-action-click="window.densityAddRow()" style="background:var(--brand);color:#fff;border:none;border-radius:8px;padding:8px 16px;font-weight:700;font-size:12px;cursor:pointer;box-shadow:0 1px 2px rgba(0,0,0,0.05)">+ Add Area</button>
        <button class="pcl-inline-btn secondary" data-action-click="window.densityClearAll()" style="background:#64748b;color:#fff;border:none;border-radius:8px;padding:8px 16px;font-weight:700;font-size:12px;cursor:pointer;box-shadow:0 1px 2px rgba(0,0,0,0.05)">Clear All</button>
      </div>
    </div>
    
    <div class="scard-body" style="padding:0">
      <div style="width:100%; overflow-x:auto">
        <table class="eng-table" style="width:100%; border-collapse:collapse; font-size:12px; table-layout:fixed; min-width:1000px">
          <colgroup>
            <col style="width:3%"/>
            <col style="width:12%"/>
            <col style="width:12%"/>
            <col style="width:12%"/>
            <col style="width:7%"/>
            <col style="width:7%"/>
            <col style="width:8%"/>
            <col style="width:8%"/>
            <col style="width:5%"/>
            <col style="width:14%"/>
            <col style="width:8%"/>
            <col style="width:4%"/>
          </colgroup>
          <thead>
            <tr style="background:#f8fafc; border-bottom:1px solid var(--border)">
              <th style="padding:10px 8px; text-align:center; font-weight:700; border-right:1px solid var(--border)">S.No.</th>
              <th style="padding:10px 8px; text-align:left; font-weight:700; border-right:1px solid var(--border)">Area Name</th>
              <th style="padding:10px 8px; text-align:left; font-weight:700; border-right:1px solid var(--border)">Type of Area</th>
              <th style="padding:10px 8px; text-align:left; font-weight:700; background:#fef9c3; border-right:1px solid var(--border)">Light Type</th>
              <th style="padding:10px 8px; text-align:center; font-weight:700; background:#fef9c3; border-right:1px solid var(--border)">Unit Wattage</th>
              <th style="padding:10px 8px; text-align:center; font-weight:700; border-right:1px solid var(--border)">No. of Lights</th>
              <th style="padding:10px 8px; text-align:center; font-weight:700; border-right:1px solid var(--border)">Total Watts</th>
              <th style="padding:10px 8px; text-align:center; font-weight:700; background:#f0fdf4; border-right:1px solid var(--border)">Area (Sq.M)</th>
              <th style="padding:10px 8px; text-align:center; font-weight:700; background:#f0fdf4; color:#16a34a; border-right:1px solid var(--border)">W/Sq.M</th>
              <th style="padding:10px 8px; text-align:center; font-weight:700; border-right:1px solid var(--border)">LPD As Per Authority (W/Sq.M)</th>
              <th style="padding:10px 8px; text-align:center; font-weight:700; border-right:1px solid var(--border)">Status</th>
              <th style="padding:10px 8px; text-align:center; font-weight:700">Delete</th>
            </tr>
          </thead>
          <tbody id="elec-density-tbody">
            <!-- Dynamic rows injected here -->
          </tbody>
          <tbody id="elec-density-empty" style="display:none">
            <tr>
              <td colspan="12" style="padding:40px; text-align:center; color:var(--muted)">
                <div style="font-size:24px; margin-bottom:8px">💡</div>
                <div style="font-weight:700">No areas added to schedule.</div>
                <div style="font-size:11px; margin-top:4px">Click "+ Add Area" above to begin sizing.</div>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  </div>

  <button class="calc-btn" data-action-click="window.calcDensity();window.showRes('elec-density-res')" style="background:var(--brand);color:#fff;border:none;border-radius:8px;padding:12px;font-weight:700;font-size:14px;cursor:pointer;width:100%;box-shadow:0 2px 4px rgba(0,0,0,0.05)">⚡ Calculate Density</button>

  <!-- Results Panel -->
  <div id="elec-density-res" style="display:none; margin-top:16px">
    <div id="elec-density-warn-area"></div>
    
    <div class="scard" style="border:1px solid var(--border); border-radius:8px; background:#fff; overflow:hidden">
      <div class="scard-head" style="padding:14px 16px; border-bottom:1px solid var(--border); display:flex; align-items:center; gap:8px">
        <div style="width:4px; height:16px; background:var(--brand); border-radius:2px"></div>
        <div class="scard-title" style="font-weight:700; font-size:12px; color:#475569; text-transform:uppercase; letter-spacing:0.5px">OVERALL SIZING SUMMARY</div>
      </div>
      <div class="scard-body" style="padding:16px">
        <div class="res-row" style="display:flex; justify-content:space-between; padding:8px 0; border-bottom:1px solid #f1f5f9">
          <div class="res-label" style="font-size:13px; color:#475569; font-weight:500">Total Load Wattage</div>
          <div class="res-val primary" id="elec-density-r-total-watts" style="font-size:14px; color:var(--brand); font-weight:700">-</div>
        </div>
        <div class="res-row" style="display:flex; justify-content:space-between; padding:8px 0; border-bottom:1px solid #f1f5f9">
          <div class="res-label" style="font-size:13px; color:#475569; font-weight:500">Total Floor Area (Sq. M)</div>
          <div class="res-val" id="elec-density-r-total-sqm" style="font-size:14px; color:#ef4444; font-weight:700">-</div>
        </div>
        <div class="res-row" style="display:flex; justify-content:space-between; padding:8px 0">
          <div class="res-label" style="font-size:13px; color:#475569; font-weight:500">OVERALL AVERAGE DENSITY</div>
          <div class="res-val primary" id="elec-density-r-total" style="font-size:14px; color:#22c55e; font-weight:800">-</div>
        </div>
      </div>
    </div>
    
    <div class="scard" style="margin-top:10px;background:var(--amber-lt);border:1px solid rgba(217,119,6,0.2)">
      <div class="scard-body" style="padding:14px 16px">
        <div style="font-size:11px;font-weight:700;color:var(--amber);text-transform:uppercase;letter-spacing:.5px;margin-bottom:6px">📋 Sizing Basis Summary</div>
        <div id="elec-density-summary-text" style="font-size:12.5px;color:var(--text);line-height:1.5;font-weight:500">
          <!-- Generated summary -->
        </div>
      </div>
    </div>
  </div>

</div>
`;




