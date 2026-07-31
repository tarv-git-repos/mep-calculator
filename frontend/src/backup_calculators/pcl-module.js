(function(){
  function esc(s){ return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;'); }
  function get(id){ return document.getElementById(id); }

  var rows = [];
  window.pclRows = rows; // Expose globally for ZoneLinker
  try {
    var saved = localStorage.getItem('pcl_rows');
    if(saved) {
      rows = JSON.parse(saved);
      window.pclRows = rows;
    }
  } catch(e) { console.error('PCL: Failed to load rows', e); }

  var rowCount = 0;
  try {
    var savedCount = localStorage.getItem('pcl_rowCount');
    if(savedCount) rowCount = parseInt(savedCount) || 0;
  } catch(e) {}

  function save(){
    localStorage.setItem('pcl_rows', JSON.stringify(rows));
    localStorage.setItem('pcl_rowCount', rowCount.toString());
    if (typeof PlumbingZoneLinker !== 'undefined' && typeof PlumbingZoneLinker.syncFromPCL === 'function') {
      PlumbingZoneLinker.syncFromPCL();
    }
  }
  window.pclSave = save;

  function extractFloor(name) {
    var match = name.match(/^([0-9]|B|G|LG|UG|SF|RF|M|P)[FLfli]?/i);
    return match ? match[0].toUpperCase().replace(/L$/i, 'F') : 'General';
  }

  function inferTypeFromName(name){
    var q = String(name || '').toLowerCase().trim();
    var map = [
      ['apartment','Apartment - Dwelling Unit'],['dwelling','Apartment - Dwelling Unit'],
      ['bedroom','Apartment - Dwelling Unit'],['living','Apartment - Dwelling Unit'],
      ['dining','Apartment - Dwelling Unit'],['residential','Apartment - Dwelling Unit'],
      ['corridor','Corridor - Residential'],['lobby','Lobby - Residential'],
      ['reception','Lobby - Residential'],['office','Office - Cabin'],
      ['cabin','Office - Cabin'],['meeting','Office - Meeting Room'],
      ['conference','Office - Meeting Room'],['classroom','Classroom - Middle School'],
      ['school','Classroom - Middle School'],['university','Classroom - Middle School'],
      ['lab','Lab - School'],['gym','GYM'],['fitness','GYM'],['spa','SPA'],
      ['clinic','Clinic'],['medical','Clinic'],['doctor','Clinic - Doctor Room'],
      ['treatment','Clinic - Treatment Room'],['hotel','Lobby - Hotel'],
      ['kitchen','Kitchen - Public'],['pantry','Kitchen - Private'],
      ['washroom','Washroom'],['toilet','Toilet - Public'],['wc','Toilet - Public'],
      ['restroom','Toilet - Public'],['server','Server Room'],['cctv','CCTV Room'],
      ['idf','Typ. IDF Room'],['electrical','Typ. Electrical Room'],
      ['elec','Typ. Electrical Room'],['storage','Storage - Dry'],['store','Storage - Dry'],
      ['caf','Café'],['restaurant','Food & Beverage'],['supermarket','Supermarket'],
      ['retail','Retail Shop - Mixed Building'],['shop','Retail Shop - Mixed Building'],
      ['mall','Retail Shop - Mall'],['prayer','Male Prayer Room'],['mosque','Male Prayer Room']
    ];
    for(var i=0;i<map.length;i++){ if(q.indexOf(map[i][0]) !== -1) return map[i][1]; }
    return '';
  }

  function getState(){
    var nameEl = get('pcl-row-name'), areaEl = get('pcl-row-area'), typeEl = get('pcl-row-type');
    if(!nameEl || !areaEl || !typeEl) return null;
    var opt = typeEl.options[typeEl.selectedIndex];
    var density = opt ? parseFloat(opt.getAttribute('data-density')) : NaN;
    var area = parseFloat(areaEl.value);
    return { name:nameEl.value.trim(), area:area, type:typeEl.value, density:density, valid:!!(nameEl.value.trim() && !isNaN(area) && area > 0 && typeEl.value && !isNaN(density)) };
  }

  function clearEntry(keepMessage){
    if(get('pcl-row-name')) get('pcl-row-name').value = '';
    if(get('pcl-row-area')) get('pcl-row-area').value = '';
    if(get('pcl-row-type')){ get('pcl-row-type').value = ''; get('pcl-row-type').dataset.manual = ''; }
    if(get('pcl-row-density')) get('pcl-row-density').textContent = '—';
    if(get('pcl-row-diss')) get('pcl-row-diss').textContent = '—';
    if(get('pcl-row-kw')) get('pcl-row-kw').textContent = '—';
    if(!keepMessage && get('pcl-form-msg')) get('pcl-form-msg').textContent = '';
    
    var livePill = get('pcl-live-pill');
    if(livePill){ livePill.textContent = 'Waiting for input'; livePill.classList.remove('live'); }
    
    if(get('pcl-row-name')) get('pcl-row-name').focus();
  }

  function toggleEmpty(){
    var empty = get('pcl-empty-state');
    if(empty) empty.style.display = rows.length ? 'none' : '';
  }

  function updateEntryOutputs(){
    var densityEl = get('pcl-row-density'), dissEl = get('pcl-row-diss'), kwEl = get('pcl-row-kw'), livePill = get('pcl-live-pill');
    var state = getState();
    if(!densityEl || !dissEl || !kwEl) return;
    
    densityEl.textContent = state && !isNaN(state.density) ? state.density + ' W/m²' : '—';
    
    if(state && !isNaN(state.density) && !isNaN(state.area) && state.area > 0){
      var diss = state.density * state.area;
      dissEl.textContent = (diss / 1000).toFixed(2) + ' kW';
      kwEl.textContent = (diss / 3517).toFixed(2) + ' TR';
      if(livePill){ livePill.textContent = 'Live values ready'; livePill.classList.add('live'); }
    } else {
      dissEl.textContent = '—';
      kwEl.textContent = '—';
      if(livePill){ livePill.textContent = 'Waiting for input'; livePill.classList.remove('live'); }
    }
  }

  function updateTotals(){
    var totalArea = 0, totalW = 0;
    rows.forEach(function(r){
      totalArea += r.area;
      totalW += r.dissipation;
    });
    
    var totalKw = totalW / 1000, totalTr = totalKw / 3.517, avg = totalArea > 0 ? totalW / totalArea : 0;
    
    if(get('pcl-total-w')) get('pcl-total-w').textContent = totalKw.toFixed(2) + ' kW';
    if(get('pcl-total-kw')) get('pcl-total-kw').textContent = totalTr.toFixed(2) + ' TR';
    if(get('pcl-s-count')) get('pcl-s-count').textContent = rows.length + ' space' + (rows.length === 1 ? '' : 's');
    if(get('pcl-s-area')) get('pcl-s-area').textContent = totalArea.toFixed(1) + ' m²';
    if(get('pcl-s-w')) get('pcl-s-w').textContent = totalKw.toFixed(2) + ' kW';
    if(get('pcl-s-kw')) get('pcl-s-kw').textContent = totalTr.toFixed(2) + ' TR';
    if(get('pcl-s-tr')) get('pcl-s-tr').textContent = totalTr.toFixed(2) + ' TR';
    if(get('pcl-s-density')) get('pcl-s-density').textContent = avg.toFixed(1) + ' W/m²';
  }

  window.pclPreviewCalc = function(){
    var nameEl = get('pcl-row-name'), typeEl = get('pcl-row-type');
    if(!nameEl || !typeEl) return;
    
    // If name is cleared, we can reset the manual flag to allow auto-detect again
    if(!nameEl.value.trim()){
      typeEl.dataset.manual = '';
    }

    if(!typeEl.dataset.manual && nameEl.value){
      var inferred = inferTypeFromName(nameEl.value);
      if(inferred) typeEl.value = inferred;
    }
    updateEntryOutputs();
  };

  window.pclCommitIfReady = function(){
    // Kept for backward compatibility if called from HTML onchange
    updateEntryOutputs();
  }

  window.pclAddFromForm = function(){
    var state = getState(), msg = get('pcl-form-msg');
    
    if(!state || !state.name){ if(msg){ msg.textContent='Please enter a Name of Space.'; msg.style.color='#dc2626'; } return false; }
    if(isNaN(state.area) || state.area <= 0){ if(msg){ msg.textContent='Please enter a valid Area (m²).'; msg.style.color='#dc2626'; } return false; }
    if(!state.type || isNaN(state.density)){ if(msg){ msg.textContent='Please select a Type of Space.'; msg.style.color='#dc2626'; } return false; }
    
    var diss = state.density * state.area, kw = diss / 1000;
    rowCount++;
    
    rows.push({
      id: rowCount,
      name: state.name,
      area: state.area,
      type: state.type,
      density: state.density,
      dissipation: diss,
      kw: kw,
      floor: extractFloor(state.name)
    });
    
    if(msg){ msg.textContent='Space added successfully!'; msg.className='pcl-message-success'; msg.style.color='#16a34a'; }
    clearEntry(true);
    save();
    pclRender();
    return true;
  };

  window.pclRemoveRow = function(id){
    var idx = rows.findIndex(function(r){ return r.id === id; });
    if (idx !== -1) {
        rows.splice(idx, 1);
        save();
        pclRender();
    }
  };

  window.pclDeleteSelected = function() {
    var checkboxes = document.querySelectorAll('.pcl-row-checkbox:checked');
    if (checkboxes.length === 0) {
      if (typeof appAlert === 'function') {
        appAlert("No Spaces Selected", "Please select at least one space to delete.");
      } else {
        alert("Please select at least one space to delete.");
      }
      return;
    }

    var idsToDelete = Array.from(checkboxes).map(cb => parseInt(cb.value));

    if (typeof appConfirm === 'function') {
      appConfirm("Delete Selected", "Are you sure you want to remove " + idsToDelete.length + " selected spaces?", function() {
        rows = rows.filter(r => !idsToDelete.includes(r.id));
        var selectAllCb = document.getElementById('pcl-select-all');
        if (selectAllCb) selectAllCb.checked = false;
        save();
        pclRender();
      });
    } else {
      if (confirm("Are you sure you want to remove " + idsToDelete.length + " selected spaces?")) {
        rows = rows.filter(r => !idsToDelete.includes(r.id));
        var selectAllCb = document.getElementById('pcl-select-all');
        if (selectAllCb) selectAllCb.checked = false;
        save();
        pclRender();
      }
    }
  };

  window.pclToggleSelectAll = function(isChecked) {
    var checkboxes = document.querySelectorAll('.pcl-row-checkbox');
    checkboxes.forEach(cb => cb.checked = isChecked);
  };

  window.pclUpdateRowArea = function(id, val){
    var num = parseFloat(val);
    if(isNaN(num) || num <= 0) return;
    var idx = rows.findIndex(function(r){ return r.id === id; });
    if(idx !== -1) {
      rows[idx].area = num;
      rows[idx].dissipation = rows[idx].density * num;
      rows[idx].kw = rows[idx].dissipation / 1000;
      save();
      pclRender();
    }
  };

  window.pclUpdateRowType = function(id, selectEl){
    var type = selectEl.value;
    var opt = selectEl.options[selectEl.selectedIndex];
    var density = opt ? parseFloat(opt.getAttribute('data-density')) : NaN;
    
    if(!type || isNaN(density)) return;
    
    var idx = rows.findIndex(function(r){ return r.id === id; });
    if(idx !== -1) {
      rows[idx].type = type;
      rows[idx].density = density;
      rows[idx].dissipation = density * rows[idx].area;
      rows[idx].kw = rows[idx].dissipation / 1000;
      save();
      pclRender();
    }
  };

  function getTypeSelectHtml(row) {
    var typeEl = get('pcl-row-type');
    if (!typeEl) return esc(row.type);
    
    var html = '<select onchange="pclUpdateRowType(' + row.id + ', this)" style="border:none;background:transparent;width:100%;font-size:12px;font-family:inherit;color:var(--text);outline:none;cursor:pointer;font-weight:500">';
    html += '<option value="">— Select Type —</option>';
    
    for (var i = 0; i < typeEl.children.length; i++) {
      var child = typeEl.children[i];
      if (child.tagName.toUpperCase() === 'OPTGROUP') {
        html += '<optgroup label="' + esc(child.label) + '">';
        for (var j = 0; j < child.children.length; j++) {
          var opt = child.children[j];
          var sel = opt.value === row.type ? ' selected' : '';
          html += '<option value="' + esc(opt.value) + '" data-density="' + opt.getAttribute('data-density') + '"' + sel + '>' + esc(opt.text) + '</option>';
        }
        html += '</optgroup>';
      } else if (child.tagName.toUpperCase() === 'OPTION' && child.value) {
        var sel = child.value === row.type ? ' selected' : '';
        html += '<option value="' + esc(child.value) + '" data-density="' + child.getAttribute('data-density') + '"' + sel + '>' + esc(child.text) + '</option>';
      }
    }
    html += '</select>';
    return html;
  }

  window.pclClearAll = function(){
    appConfirm('Clear All Spaces', 'Are you sure you want to remove all spaces from the schedule? This action cannot be undone.', function(){
      rows = [];
      clearEntry(true);
      if(get('pcl-form-msg')){ 
        get('pcl-form-msg').textContent = 'All spaces cleared'; 
        get('pcl-form-msg').style.color = 'var(--muted)'; 
      }
      save();
      pclRender();
    });
  };

  window.pclRender = function(){
    var tbody = get('pcl-tbody');
    if(!tbody) return;
    
    tbody.innerHTML = '';
    
    if (rows.length === 0) {
        toggleEmpty();
        updateTotals();
        return;
    }
    
    // Group by floor
    var grouped = {};
    rows.forEach(function(row) {
        if (!grouped[row.floor]) {
            grouped[row.floor] = [];
        }
        grouped[row.floor].push(row);
    });

    // Sort floors (1F, 2F, 3F... then B, G, RF, General)
    var sortFloor = function(a, b) {
        var order = { 'B': -2, 'G': -1 };
        var aNum = parseInt(a);
        var bNum = parseInt(b);
        if (!isNaN(aNum) && !isNaN(bNum)) return aNum - bNum;
        return (order[a] || 999) - (order[b] || 999);
    };

    var sortedFloors = Object.keys(grouped).sort(sortFloor);
    var displayCount = 1;

    sortedFloors.forEach(function(floor) {
        // Add floor header
        var headerRow = document.createElement('tr');
        headerRow.style.cssText = 'background: linear-gradient(90deg, #f7d4b0 0%, rgba(247,212,176,0.4) 100%); border-top: 2px solid #f78f22;';
        headerRow.innerHTML = '<td colspan="9" style="font-weight:700; color:#c45804; padding:10px 12px; letter-spacing:0.3px; font-size:12.5px;">📍 Floor: ' + esc(floor) + '</td>';
        tbody.appendChild(headerRow);

        // Add rows for this floor
        grouped[floor].forEach(function(row) {
            var tr = document.createElement('tr');
            tr.style.cssText = 'border-bottom:1px solid #f2dfc8;background:#fff';
            tr.innerHTML =
              '<td style="padding:6px;text-align:center;border-right:1px solid #f3e5d3"><input type="checkbox" class="pcl-row-checkbox" value="' + row.id + '" style="cursor:pointer" onclick="event.stopPropagation()"></td>'+
              '<td style="padding:8px 6px;text-align:center;font-size:11px;font-weight:700;color:var(--brand);border-right:1px solid #f3e5d3">' + displayCount++ + '</td>'+
              '<td style="padding:8px 10px;text-align:center;font-weight:500;color:#3f2f1f;font-size:12.5px;border-right:1px solid #f3e5d3;overflow:hidden;text-overflow:ellipsis;white-space:nowrap" title="'+esc(row.name)+'">'+esc(row.name)+'</td>'+
              '<td style="padding:4px 6px;text-align:center;border-right:1px solid #f3e5d3;width:100px">'+
                '<input type="number" value="' + row.area + '" min="0.1" step="0.1" style="border:none;background:transparent;width:100%;font-size:12.5px;font-family:var(--mono);color:var(--text);outline:none;text-align:center;font-weight:600" onchange="pclUpdateRowArea(' + row.id + ', this.value)">'+
              '</td>'+
              '<td style="padding:4px 10px;text-align:center;border-right:1px solid #f3e5d3">' + getTypeSelectHtml(row) + '</td>'+
              '<td style="padding:8px 6px;text-align:center;border-right:1px solid #f3e5d3"><span style="background:var(--brand-bg);color:var(--brand);padding:3px 8px;border-radius:12px;font-size:11.5px;font-weight:700;white-space:nowrap">'+row.density+' W/m²</span></td>'+
              '<td style="padding:8px 6px;text-align:center;font-weight:700;font-size:13px;color:var(--brand);border-right:1px solid #f3e5d3;white-space:nowrap">'+(row.dissipation/1000).toFixed(2)+' kW</td>'+
              '<td style="padding:8px 6px;text-align:center;font-weight:700;font-size:12.5px;color:var(--brand);border-right:1px solid #f3e5d3;white-space:nowrap">'+(row.kw/3.517).toFixed(2)+' TR</td>';
            tbody.appendChild(tr);
        });
    });

    toggleEmpty();
    updateTotals();
  };

  window.pclExportToExcel = function() {
    if (rows.length === 0) {
        appAlert('Export Excel', 'No data to export. Please add some spaces to the schedule first.');
        return;
    }

    var totalArea = 0, totalW = 0;
    rows.forEach(function(r){
      totalArea += r.area;
      totalW += r.dissipation;
    });
    var totalKw = totalW / 1000;
    var totalTr = totalKw / 3.517;
    var avg = totalArea > 0 ? totalW / totalArea : 0;

    // Group by floor
    var grouped = {};
    rows.forEach(function(row) {
        if (!grouped[row.floor]) {
            grouped[row.floor] = [];
        }
        grouped[row.floor].push(row);
    });

    // Sort floors (1F, 2F, 3F... then B, G, RF, General)
    var sortFloor = function(a, b) {
        var order = { 'B': -2, 'G': -1 };
        var aNum = parseInt(a);
        var bNum = parseInt(b);
        if (!isNaN(aNum) && !isNaN(bNum)) return aNum - bNum;
        return (order[a] || 999) - (order[b] || 999);
    };

    var sortedFloors = Object.keys(grouped).sort(sortFloor);

    // Build the data array for SheetJS
    var aoa = [];
    
    // 1. Title Block (Excel Row 1)
    aoa.push(["PRELIMINARY COOLING LOAD REPORT", "", "", "", "", "", ""]);
    aoa.push(["", "", "", "", "", "", ""]); // Empty (Row 2)
    
    // 2. Metadata (Row 3)
    var dateStr = new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
    aoa.push(["Consistent Engineering Consultants", "", "", "", "", "Date: " + dateStr, ""]);
    aoa.push(["", "", "", "", "", "", ""]); // Empty (Row 4)

    // 3. Summary Block (Row 5 to 8)
    aoa.push(["📊 PROJECT SUMMARY STATS", "", "", "", "", "", ""]);
    aoa.push(["Total Spaces:", rows.length, "", "Total Load (TR):", "", +(totalKw/3.517).toFixed(2), ""]);
    aoa.push(["Total Floor Area (m²):", totalArea, "", "Total Load (TR):", "", +(totalKw/3.517).toFixed(2), ""]);
    aoa.push(["Total Cooling Load (kW):", +(totalW/1000).toFixed(2), "", "Average Load Density (W/m²):", "", avg, ""]);
    aoa.push(["", "", "", "", "", "", ""]); // Empty (Row 9)

    // 4. Schedule Header (Row 10)
    aoa.push(["❄️ COOLING LOAD SCHEDULE", "", "", "", "", "", ""]);
    
    // Table Headers (Row 11)
    aoa.push(["S.No", "Name of Space", "Area (m²)", "Type of Space", "Heat Density (W/m²)", "Cooling Load (kW)", "Load (TR)"]);

    var merges = [
      { s: { r: 0, c: 0 }, e: { r: 0, c: 6 } }, // Title
      { s: { r: 2, c: 0 }, e: { r: 2, c: 2 } }, // Company Name
      { s: { r: 2, c: 5 }, e: { r: 2, c: 6 } }, // Date
      { s: { r: 4, c: 0 }, e: { r: 4, c: 6 } }, // Summary Header
      { s: { r: 5, c: 3 }, e: { r: 5, c: 4 } }, // Stat 2 Label (Total Load kW)
      { s: { r: 5, c: 5 }, e: { r: 5, c: 6 } }, // Stat 2 Value
      { s: { r: 6, c: 3 }, e: { r: 6, c: 4 } }, // Stat 4 Label (Total Load TR)
      { s: { r: 6, c: 5 }, e: { r: 6, c: 6 } }, // Stat 4 Value
      { s: { r: 7, c: 3 }, e: { r: 7, c: 4 } }, // Stat 6 Label (Avg Density)
      { s: { r: 7, c: 5 }, e: { r: 7, c: 6 } }, // Stat 6 Value
      { s: { r: 9, c: 0 }, e: { r: 9, c: 6 } }  // Schedule Header
    ];

    var displayCount = 1;
    var rIndex = 11; // 0-indexed row tracker for dynamic schedule section (since headers end at index 10)

    // Setup sheet & merges to apply style
    var ws = XLSX.utils.aoa_to_sheet(aoa);

    // Dynamic building of schedule and styling
    sortedFloors.forEach(function(floor) {
        var floorRowIndex = rIndex++;
        aoa.push(["📍 Floor: " + floor, "", "", "", "", "", ""]);
        merges.push({ s: { r: floorRowIndex, c: 0 }, e: { r: floorRowIndex, c: 6 } });

        grouped[floor].forEach(function(row) {
            aoa.push([
                displayCount++,
                row.name,
                row.area,
                row.type,
                row.density,
                +(row.dissipation/1000).toFixed(2),
                +(row.kw/3.517).toFixed(2)
            ]);
            rIndex++;
        });
    });

    // Total Row
    var totalRowIndex = rIndex++;
    aoa.push(["TOTAL", "", totalArea, "", avg, +(totalW/1000).toFixed(2), +(totalKw/3.517).toFixed(2)]);
    merges.push({ s: { r: totalRowIndex, c: 0 }, e: { r: totalRowIndex, c: 1 } });

    // Re-create worksheet with all populated dynamic rows
    ws = XLSX.utils.aoa_to_sheet(aoa);
    ws['!merges'] = merges;

    // --- APPLY PREMIUM BRAND STYLING & FORMATTING ---
    var fontName = "Segoe UI";
    
    var styleTitle = {
        font: { name: fontName, sz: 14, bold: true, color: { rgb: "FFFFFF" } },
        fill: { fgColor: { rgb: "F78F22" } },
        alignment: { horizontal: "center", vertical: "center" }
    };
    
    var styleCompany = {
        font: { name: fontName, sz: 10, bold: true, color: { rgb: "333333" } },
        alignment: { horizontal: "left", vertical: "center" }
    };
    
    var styleDate = {
        font: { name: fontName, sz: 10, color: { rgb: "666666" } },
        alignment: { horizontal: "right", vertical: "center" }
    };
    
    var styleSectionHeader = {
        font: { name: fontName, sz: 11, bold: true, color: { rgb: "FFFFFF" } },
        fill: { fgColor: { rgb: "C45804" } },
        alignment: { horizontal: "left", vertical: "center" }
    };
    
    var styleSummaryLabel = {
        font: { name: fontName, sz: 10, bold: true, color: { rgb: "444444" } },
        fill: { fgColor: { rgb: "FFFAF4" } },
        alignment: { horizontal: "left", vertical: "center" },
        border: {
            top: { style: "thin", color: { rgb: "EDD8C1" } },
            bottom: { style: "thin", color: { rgb: "EDD8C1" } },
            left: { style: "thin", color: { rgb: "EDD8C1" } },
            right: { style: "thin", color: { rgb: "EDD8C1" } }
        }
    };
    
    var styleSummaryValue = {
        font: { name: fontName, sz: 10, bold: true, color: { rgb: "C45804" } },
        fill: { fgColor: { rgb: "FFFAF4" } },
        alignment: { horizontal: "right", vertical: "center" },
        border: {
            top: { style: "thin", color: { rgb: "EDD8C1" } },
            bottom: { style: "thin", color: { rgb: "EDD8C1" } },
            left: { style: "thin", color: { rgb: "EDD8C1" } },
            right: { style: "thin", color: { rgb: "EDD8C1" } }
        }
    };
    
    var styleTableHeader = {
        font: { name: fontName, sz: 10, bold: true, color: { rgb: "FFFFFF" } },
        fill: { fgColor: { rgb: "F78F22" } },
        alignment: { horizontal: "center", vertical: "center" },
        border: {
            top: { style: "thin", color: { rgb: "F5C289" } },
            bottom: { style: "thin", color: { rgb: "F5C289" } },
            left: { style: "thin", color: { rgb: "F5C289" } },
            right: { style: "thin", color: { rgb: "F5C289" } }
        }
    };
    
    var styleFloorHeader = {
        font: { name: fontName, sz: 11, bold: true, color: { rgb: "C45804" } },
        fill: { fgColor: { rgb: "F7D4B0" } },
        alignment: { horizontal: "left", vertical: "center" },
        border: {
            top: { style: "thin", color: { rgb: "F3E5D3" } },
            bottom: { style: "thin", color: { rgb: "F3E5D3" } },
            left: { style: "thin", color: { rgb: "F3E5D3" } },
            right: { style: "thin", color: { rgb: "F3E5D3" } }
        }
    };
    
    var styleTotalRow = {
        font: { name: fontName, sz: 10, bold: true, color: { rgb: "C45804" } },
        fill: { fgColor: { rgb: "F7D4B0" } },
        alignment: { horizontal: "right", vertical: "center" },
        border: {
            top: { style: "thin", color: { rgb: "F5C289" } },
            bottom: { style: "double", color: { rgb: "C45804" } },
            left: { style: "thin", color: { rgb: "F5C289" } },
            right: { style: "thin", color: { rgb: "F5C289" } }
        }
    };

    var styleTotalLabel = {
        font: { name: fontName, sz: 10, bold: true, color: { rgb: "C45804" } },
        fill: { fgColor: { rgb: "F7D4B0" } },
        alignment: { horizontal: "left", vertical: "center" },
        border: {
            top: { style: "thin", color: { rgb: "F5C289" } },
            bottom: { style: "double", color: { rgb: "C45804" } },
            left: { style: "thin", color: { rgb: "F5C289" } },
            right: { style: "thin", color: { rgb: "F5C289" } }
        }
    };

    function applyStyle(ws, r, c, style) {
        var addr = XLSX.utils.encode_cell({ r: r, c: c });
        if (!ws[addr]) ws[addr] = { v: "" };
        ws[addr].s = style;
    }

    function styleRange(ws, rStart, rEnd, cStart, cEnd, style) {
        for (var r = rStart; r <= rEnd; r++) {
            for (var c = cStart; c <= cEnd; c++) {
                applyStyle(ws, r, c, style);
            }
        }
    }

    // Static Ranges Styling
    styleRange(ws, 0, 0, 0, 6, styleTitle);
    styleRange(ws, 2, 2, 0, 2, styleCompany);
    styleRange(ws, 2, 2, 5, 6, styleDate);
    styleRange(ws, 4, 4, 0, 6, styleSectionHeader);

    // Summary Row 1
    applyStyle(ws, 5, 0, styleSummaryLabel);
    applyStyle(ws, 5, 1, styleSummaryValue);
    styleRange(ws, 5, 5, 3, 4, styleSummaryLabel);
    styleRange(ws, 5, 5, 5, 6, styleSummaryValue);

    // Summary Row 2
    applyStyle(ws, 6, 0, styleSummaryLabel);
    applyStyle(ws, 6, 1, styleSummaryValue);
    styleRange(ws, 6, 6, 3, 4, styleSummaryLabel);
    styleRange(ws, 6, 6, 5, 6, styleSummaryValue);

    // Summary Row 3
    applyStyle(ws, 7, 0, styleSummaryLabel);
    applyStyle(ws, 7, 1, styleSummaryValue);
    styleRange(ws, 7, 7, 3, 4, styleSummaryLabel);
    styleRange(ws, 7, 7, 5, 6, styleSummaryValue);

    // Table Schedule Header Row
    styleRange(ws, 9, 9, 0, 6, styleSectionHeader);
    styleRange(ws, 10, 10, 0, 6, styleTableHeader);

    // Loop through dynamic rows and style them
    var dIndex = 11;
    sortedFloors.forEach(function(floor) {
        var fIdx = dIndex++;
        styleRange(ws, fIdx, fIdx, 0, 6, styleFloorHeader);

        grouped[floor].forEach(function(row) {
            var rowIdx = dIndex++;
            var styleCellCenter = {
                font: { name: fontName, sz: 10, color: { rgb: "333333" } },
                alignment: { horizontal: "center", vertical: "center" },
                border: {
                    top: { style: "thin", color: { rgb: "F3E5D3" } },
                    bottom: { style: "thin", color: { rgb: "F3E5D3" } },
                    left: { style: "thin", color: { rgb: "F3E5D3" } },
                    right: { style: "thin", color: { rgb: "F3E5D3" } }
                }
            };
            var styleCellLeft = {
                font: { name: fontName, sz: 10, color: { rgb: "333333" } },
                alignment: { horizontal: "left", vertical: "center" },
                border: {
                    top: { style: "thin", color: { rgb: "F3E5D3" } },
                    bottom: { style: "thin", color: { rgb: "F3E5D3" } },
                    left: { style: "thin", color: { rgb: "F3E5D3" } },
                    right: { style: "thin", color: { rgb: "F3E5D3" } }
                }
            };
            var styleCellRight = {
                font: { name: fontName, sz: 10, color: { rgb: "333333" } },
                alignment: { horizontal: "right", vertical: "center" },
                border: {
                    top: { style: "thin", color: { rgb: "F3E5D3" } },
                    bottom: { style: "thin", color: { rgb: "F3E5D3" } },
                    left: { style: "thin", color: { rgb: "F3E5D3" } },
                    right: { style: "thin", color: { rgb: "F3E5D3" } }
                }
            };

            applyStyle(ws, rowIdx, 0, styleCellCenter); // S.No
            applyStyle(ws, rowIdx, 1, styleCellLeft);   // Name
            applyStyle(ws, rowIdx, 2, styleCellRight);  // Area
            applyStyle(ws, rowIdx, 3, styleCellLeft);   // Type
            applyStyle(ws, rowIdx, 4, styleCellRight);  // Density
            applyStyle(ws, rowIdx, 5, styleCellRight);  // Dissipation
            applyStyle(ws, rowIdx, 6, styleCellRight);  // Load

            // Apply formats on numbers
            var cellC = ws[XLSX.utils.encode_cell({ r: rowIdx, c: 2 })];
            if (cellC) { cellC.t = 'n'; cellC.z = '0.0'; }
            var cellE = ws[XLSX.utils.encode_cell({ r: rowIdx, c: 4 })];
            if (cellE) { cellE.t = 'n'; cellE.z = '0.0'; }
            var cellF = ws[XLSX.utils.encode_cell({ r: rowIdx, c: 5 })];
            if (cellF) { cellF.t = 'n'; cellF.z = '0.00'; }
            var cellG = ws[XLSX.utils.encode_cell({ r: rowIdx, c: 6 })];
            if (cellG) { cellG.t = 'n'; cellG.z = '0.00'; }
        });
    });

    // Total Row
    var totIdx = dIndex++;
    styleRange(ws, totIdx, totIdx, 0, 6, styleTotalRow);
    applyStyle(ws, totIdx, 0, styleTotalLabel);
    applyStyle(ws, totIdx, 1, styleTotalLabel);

    // Specific formatting for cells in Total Row
    var totC = ws[XLSX.utils.encode_cell({ r: totIdx, c: 2 })];
    if (totC) { totC.t = 'n'; totC.z = '0.0'; }
    var totE = ws[XLSX.utils.encode_cell({ r: totIdx, c: 4 })];
    if (totE) { totE.t = 'n'; totE.z = '0.0'; }
    var totF = ws[XLSX.utils.encode_cell({ r: totIdx, c: 5 })];
    if (totF) { totF.t = 'n'; totF.z = '0.00'; }
    var totG = ws[XLSX.utils.encode_cell({ r: totIdx, c: 6 })];
    if (totG) { totG.t = 'n'; totG.z = '0.00'; }

    // Format specific summary stat numbers
    var cellsToFormat = [
        { addr: 'F6', t: 'n', z: '0.00' }, // Total Load TR
        { addr: 'B7', t: 'n', z: '0.0' },  // Total Area
        { addr: 'F7', t: 'n', z: '0.00' }, // Total Load TR
        { addr: 'B8', t: 'n', z: '0.00' },// Total Cooling Load kW
        { addr: 'F8', t: 'n', z: '0.0' }   // Avg Density
    ];
    cellsToFormat.forEach(function(item) {
        var cell = ws[item.addr];
        if (cell) {
            cell.t = item.t;
            cell.z = item.z;
        }
    });

    // Column Widths
    ws['!cols'] = [
        { wch: 8 },  // Col A: S.No
        { wch: 25 }, // Col B: Space Name
        { wch: 14 }, // Col C: Area (m2)
        { wch: 28 }, // Col D: Type of Space
        { wch: 20 }, // Col E: Heat Density (W/m2)
        { wch: 22 }, // Col F: Cooling Load (kW)
        { wch: 15 }  // Col G: Load (TR)
    ];

    // Create workbook and write out using a native Blob download to force correct file extension on local file:/// protocol
    var wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Cooling Load");
    
    // Generate binary xlsx content
    var wbout = XLSX.write(wb, { bookType: 'xlsx', type: 'binary' });
    
    // Convert binary string to ArrayBuffer
    var buf = new ArrayBuffer(wbout.length);
    var view = new Uint8Array(buf);
    for (var i = 0; i < wbout.length; i++) {
        view[i] = wbout.charCodeAt(i) & 0xFF;
    }
    
    // Create native file blob with correct XLSX mime type
    var blob = new Blob([buf], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
    var url = URL.createObjectURL(blob);

    // Construct a physical DOM download anchor to override file protocol GUID renaming
    var link = document.createElement("a");
    link.href = url;
    link.download = "Cooling_Load_Report_Grouped.xlsx";
    document.body.appendChild(link);
    link.click();
    
    // Delayed clean up
    setTimeout(function() {
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
    }, 100);
  };

  function init(){
    var nameEl = get('pcl-row-name'), areaEl = get('pcl-row-area'), typeEl = get('pcl-row-type');
    if(nameEl){ nameEl.addEventListener('input', window.pclPreviewCalc); nameEl.addEventListener('blur', window.pclPreviewCalc); }
    if(areaEl){ areaEl.addEventListener('input', window.pclPreviewCalc); areaEl.addEventListener('blur', window.pclPreviewCalc); }
    if(typeEl){ 
      typeEl.addEventListener('change', function(e){ 
        // Only set manual flag if the event comes from a real user interaction
        if(e.isTrusted && typeEl.value){
          typeEl.dataset.manual = '1'; 
        } else if(!typeEl.value) {
          typeEl.dataset.manual = '';
        }
        window.pclPreviewCalc(); 
      }); 
    }
    pclRender();
    updateEntryOutputs();
  }

  if(document.readyState === 'loading'){ document.addEventListener('DOMContentLoaded', init); } else { init(); }
})();
