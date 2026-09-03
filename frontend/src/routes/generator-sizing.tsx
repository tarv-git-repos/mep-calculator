import {/* Sections Navigation (Tabs) */}
          <div className="px-4 py-2 border-b border-border/60 bg-surface-1/50 shrink-0 select-none flex items-center flex items-center justify-between gap-3">
            <div className="inline-flex bg-slate-200/70 dark:bg-slate-800/80 p-1 rounded-full gap-1 border border-border/60 shadow-2xs">
              <button
                type="button"
                onClick={() => setActiveTab("equipment")}
                className={`px-4 py-1.5 text-xs font-bold rounded-full transition-all cursor-pointer ${
                  activeTab === "equipment"
                    ? "bg-white dark:bg-slate-900 text-foreground shadow-xs"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                Generator
              </button>
              <button
                type="button"
                onClick={() => setActiveTab("report")}
                className={`px-4 py-1.5 text-xs font-bold rounded-full transition-all cursor-pointer ${
                  activeTab === "report"
                    ? "bg-white dark:bg-slate-900 text-foreground shadow-xs"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                Sizing &amp; Report
              </button>
            </div>
          </div>

          {activeTab === "report" && (
            <div className="flex-1 overflow-auto p-6 space-y-6">
              {/* Summary View Content */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="bg-surface-2/40 border border-border p-4 rounded-xl shadow-sm">
                  <h3 className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Total ACL</h3>
                  <p className="text-2xl font-black text-foreground mt-1">{calc.totalAcl.toFixed(2)} kW</p>
                  <p className="text-[11px] text-muted-foreground mt-1">Sum of all connected loads</p>
                </div>
                <div className="bg-surface-2/40 border border-border p-4 rounded-xl shadow-sm">
                  <h3 className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Total Emergency Load</h3>
                  <p className="text-2xl font-black text-primary mt-1">{calc.totalEmergency.toFixed(2)} kW</p>
                  <p className="text-[11px] text-muted-foreground mt-1">Sum of non-excluded emergency loads</p>
                </div>
                <div className="bg-amber-500/10 border border-amber-500/30 p-4 rounded-xl shadow-sm">
                  <h3 className="text-xs font-bold text-amber-700 dark:text-amber-400 uppercase tracking-wider">Recommended DG Set</h3>
                  <p className="text-2xl font-black text-amber-700 dark:text-amber-400 mt-1">{calc.selectedSize} kVA</p>
                  <p className="text-[11px] text-amber-600/80 dark:text-amber-400/80 mt-1">Based on highest load requirement</p>
                </div>
              </div>

              {/* Reports Export Cards */}
              <div className="border border-border rounded-xl p-5 bg-surface-1">
                <h2 className="text-sm font-bold text-foreground mb-4">Export Calculation Reports</h2>
                <div className="grid grid-cols-1 gap-4 max-w-md">
                  <div className="border border-border rounded-lg p-4 bg-background flex flex-col items-start gap-3">
                    <div className="size-10 rounded-full bg-red-500/10 text-red-600 flex items-center justify-center">
                      <FileText className="size-5" />
                    </div>
                    <div>
                      <h3 className="font-semibold text-[14px]">PDF Document</h3>
                      <p className="text-[12.5px] text-muted-foreground mt-1">
                        Generate a formatted PDF calculation report.
                      </p>
                    </div>
                    <TBtn primary onClick={exportPdf} className="mt-2 w-full justify-center">
                      Export PDF
                    </TBtn>
                  </div>
                </div>
              </div>
            </div>
          )}

          {activeTab === "equipment" && (
            <div className="flex flex-col h-full overflow-hidden">
              {/* Filter & Action Toolbar */}
              <div className="flex flex-wrap items-center justify-between px-4 py-2 min-h-[44px] h-auto border-b border-border bg-background shrink-0 select-none gap-2 overflow-visible">
                <div className="flex flex-wrap items-center gap-2 w-full md:w-auto">
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-3.5 text-muted-foreground" />
                    <input
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      placeholder="Filter loads..."
                      className="h-7 w-56 pl-8 pr-3 bg-surface-2 text-foreground border border-transparent focus:border-border-strong focus:bg-background rounded-full text-[12px] outline-none transition-all"
                    />
                  </div>

                  {/* Filters Icon Popover */}
                  <Popover>
                    <PopoverTrigger asChild>
                      <button
                        className={`relative inline-flex items-center justify-center h-7 w-7 rounded-full border transition-all duration-150 ease-out outline-none focus-visible:ring-1 focus-visible:ring-ring cursor-pointer group overflow-visible ${
                          activeFiltersCount > 0
                            ? "bg-primary/10 border-primary/45 text-primary font-medium hover:bg-primary/15"
                            : "border-border text-muted-foreground hover:bg-surface-2 hover:text-foreground"
                        }`}
                      >
                        <Filter className="size-3.5 shrink-0" />
                        <span className="absolute top-full left-1/2 -translate-x-1/2 mt-1.5 px-2 py-0.5 bg-popover text-popover-foreground text-[11px] font-semibold border border-border rounded-md shadow-sm pointer-events-none opacity-0 scale-75 group-hover:opacity-100 group-hover:scale-100 transition-all duration-150 origin-center select-none z-50 whitespace-nowrap">
                          Filter
                        </span>
                        {activeFiltersCount > 0 && (
                          <span className="absolute -top-1 -right-1 flex items-center justify-center bg-primary text-white font-bold rounded-full size-3.5 text-[8.5px] shadow-sm border border-background">
                            {activeFiltersCount}
                          </span>
                        )}
                      </button>
                    </PopoverTrigger>
                    <PopoverContent align="start" className="w-64 p-3 bg-popover border border-border rounded-xl shadow-lg flex flex-col gap-3 z-50">
                      <div className="flex items-center justify-between pb-1.5 border-b border-border">
                        <span className="text-xs font-bold text-foreground">Filter Loads</span>
                        {activeFiltersCount > 0 && (
                          <button onClick={handleResetFilters} className="text-[10px] text-primary hover:underline font-semibold">
                            Reset All
                          </button>
                        )}
                      </div>

                      <div className="flex flex-col gap-1">
                        <span className="text-[10.5px] font-semibold text-muted-foreground uppercase tracking-wider">Starter Type</span>
                        <select
                          value={filterStarter}
                          onChange={(e) => setFilterStarter(e.target.value)}
                          className="h-8 w-full px-2 bg-surface-2 text-foreground border border-border rounded-lg text-xs outline-none cursor-pointer"
                        >
                          <option value="all" className="bg-popover text-popover-foreground">All Starter Types</option>
                          <option value="DOL" className="bg-popover text-popover-foreground">DOL</option>
                          <option value="SD" className="bg-popover text-popover-foreground">Star Delta</option>
                          <option value="Soft Starter" className="bg-popover text-popover-foreground">Soft Starter</option>
                          <option value="VFD" className="bg-popover text-popover-foreground">VFD</option>
                          <option value="None" className="bg-popover text-popover-foreground">None</option>
                        </select>
                      </div>

                      <div className="flex flex-col gap-1">
                        <span className="text-[10.5px] font-semibold text-muted-foreground uppercase tracking-wider">Emergency Status</span>
                        <select
                          value={filterEmergency}
                          onChange={(e) => setFilterEmergency(e.target.value)}
                          className="h-8 w-full px-2 bg-surface-2 text-foreground border border-border rounded-lg text-xs outline-none cursor-pointer"
                        >
                          <option value="all" className="bg-popover text-popover-foreground">All Loads</option>
                          <option value="emergency" className="bg-popover text-popover-foreground">Emergency Included</option>
                          <option value="excluded" className="bg-popover text-popover-foreground">Emergency Excluded</option>
                        </select>
                      </div>
                    </PopoverContent>
                  </Popover>

                  {/* View Icon Popover */}
                  <Popover>
                    <PopoverTrigger asChild>
                      <button
                        className={`relative inline-flex items-center justify-center h-7 w-7 rounded-full border transition-all duration-150 ease-out outline-none focus-visible:ring-1 focus-visible:ring-ring cursor-pointer group overflow-visible ${
                          sortBy !== "none" || rowDensity === "compact"
                            ? "bg-primary/10 border-primary/45 text-primary font-medium hover:bg-primary/15"
                            : "border-border text-muted-foreground hover:bg-surface-2 hover:text-foreground"
                        }`}
                      >
                        <SlidersHorizontal className="size-3.5 shrink-0" />
                        <span className="absolute top-full left-1/2 -translate-x-1/2 mt-1.5 px-2 py-0.5 bg-popover text-popover-foreground text-[11px] font-semibold border border-border rounded-md shadow-sm pointer-events-none opacity-0 scale-75 group-hover:opacity-100 group-hover:scale-100 transition-all duration-150 origin-center select-none z-50 whitespace-nowrap">
                          View / Sort
                        </span>
                      </button>
                    </PopoverTrigger>
                    <PopoverContent align="start" className="w-56 p-3 bg-popover border border-border rounded-xl shadow-lg flex flex-col gap-3 z-50">
                      <div className="pb-1.5 border-b border-border text-xs font-bold text-foreground">
                        View Options
                      </div>

                      <div className="flex flex-col gap-1">
                        <span className="text-[10.5px] font-semibold text-muted-foreground uppercase tracking-wider">Row Density</span>
                        <div className="flex rounded-full border border-border p-0.5 bg-surface-2">
                          <button
                            onClick={() => setRowDensity("default")}
                            className={`flex-1 py-1 text-[11px] font-semibold rounded-full transition-all ${
                              rowDensity === "default" ? "bg-background shadow-sm text-foreground" : "text-muted-foreground"
                            }`}
                          >
                            Default
                          </button>
                          <button
                            onClick={() => setRowDensity("compact")}
                            className={`flex-1 py-1 text-[11px] font-semibold rounded-full transition-all ${
                              rowDensity === "compact" ? "bg-background shadow-sm text-foreground" : "text-muted-foreground"
                            }`}
                          >
                            Compact
                          </button>
                        </div>
                      </div>

                      <div className="flex flex-col gap-1">
                        <span className="text-[10.5px] font-semibold text-muted-foreground uppercase tracking-wider">Sort By</span>
                        <select
                          value={sortBy}
                          onChange={(e) => setSortBy(e.target.value as any)}
                          className="h-8 w-full px-2 bg-surface-2 text-foreground border border-border rounded-lg text-xs outline-none cursor-pointer"
                        >
                          <option value="none" className="bg-popover text-popover-foreground">Original Order</option>
                          <option value="desc" className="bg-popover text-popover-foreground">Description (A-Z)</option>
                          <option value="kw" className="bg-popover text-popover-foreground">Load kW (High to Low)</option>
                        </select>
                      </div>
                    </PopoverContent>
                  </Popover>
                </div>

                <div className="flex flex-wrap items-center gap-2 w-full md:w-auto justify-start md:justify-end">
                  <button
                    onClick={() => setShowFlaggedOnly(prev => !prev)}
                    className={`flex items-center gap-1.5 px-3 py-1 text-xs font-semibold rounded-full border transition-all cursor-pointer ${
                      showFlaggedOnly
                        ? "bg-red-500/10 text-red-600 border-red-500/30 dark:bg-red-500/20 dark:text-red-400"
                        : "bg-surface-2 border-border text-muted-foreground hover:text-foreground hover:bg-surface-3"
                    }`}
                    title={showFlaggedOnly ? "Show all rows" : "Show flagged rows only"}
                  >
                    <Flag className={`size-3.5 ${flagStats.flaggedCount > 0 ? "fill-red-500 text-red-500" : ""}`} />
                    <span>{flagStats.flaggedCount} Flagged</span>
                    {showFlaggedOnly && <span className="text-[9px] bg-red-500 text-white px-1.5 rounded-full font-bold uppercase">Active</span>}
                  </button>

                  <ImportExcelBtn
                    columnMapping={{
                      "Description": "desc",
                      "Unit": "unit",
                      "kW / UNIT": "kwPerUnit",
                      "Starter Types": "starter",
                      "Standby (A)": "standby",
                      "Emergency Load": "emergency",
                      "Power Failure Load": "powerFail",
                      "Remarks": "remark"
                    }}
                    onImport={handleImportExcelRows}
                  />

                  <button
                    onClick={exportPdf}
                    className="inline-flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-bold rounded-full border border-border/60 bg-white dark:bg-slate-900 text-foreground hover:bg-slate-100 dark:hover:bg-slate-800 transition-all cursor-pointer shadow-2xs"
                  >
                    <FileText className="size-3.5" /> Export PDF
                  </button>

                  <button
                    onClick={addRow}
                    className="flex items-center gap-1.5 px-4 py-1.5 text-xs font-semibold rounded-full bg-primary hover:bg-primary/90 text-white shadow-sm transition-all cursor-pointer"
                  >
                    <Plus className="size-3.5" /> New Row
                  </button>
                </div>
              </div>

              <div className="flex flex-col xl:flex-row flex-1 min-h-0 overflow-y-auto xl:overflow-hidden">
                {/* Left Side: Table */}
                <div className="flex flex-col flex-1 min-w-0 min-h-0 border-b xl:border-b-0 xl:border-r border-white/40 dark:border-white/10 overflow-y-auto bg-transparent">
                  <div className="p-4 md:p-6 flex-1 overflow-x-auto w-full">
                    <div className="bg-card border border-border rounded-2xl overflow-x-auto shadow-xs min-w-[1000px]">
                      <table id="generator-grid" className="w-full text-[12.5px] border-collapse">
                        <thead className="bg-header-bg sticky top-0 border-b border-border z-10 font-semibold text-muted-foreground">
                          <tr className="text-left font-semibold">
                            <th className="px-2 py-2 border-r border-border w-14 text-center">
                              <input
                                type="checkbox"
                                className="cursor-pointer"
                                checked={rows.length > 0 && selectedRows.size === rows.length}
                                onChange={(e) => {
                                  if (e.target.checked) selectAll();
                                  else clearSelection();
                                }}
                              />
                            </th>
                            <th className="px-3 py-2 border-r border-border">Description</th>
                            <th className="px-3 py-2 border-r border-border w-16 text-center">
                              Unit
                            </th>
                            <th className="px-3 py-2 border-r border-border w-20 text-center">
                              {unitSystem === "ip" ? "HP / UNIT" : "kW / UNIT"}
                            </th>
                            <th className="px-3 py-2 border-r border-border w-32 text-center">
                              Starter Type
                            </th>
                            <th className="px-3 py-2 border-r border-border w-16 text-center">
                              <span
                                className="flex items-center gap-1 justify-center w-full cursor-help"
                                title="Multiplication factor for starting current. Typically 7 for DOL, 3.5 for Star Delta/Soft Starter, 1 for VFD."
                              >
                                Mult. <Info className="size-3" />
                              </span>
                            </th>
                            <th className="px-3 py-2 border-r border-border w-24 text-center">
                              <span
                                className="flex items-center gap-1 justify-center w-full cursor-help"
                                title="kW * 1.739 * Multiplier"
                              >
                                Start Cur. <Info className="size-3" />
                              </span>
                            </th>
                            <th className="px-3 py-2 border-r border-border w-20 text-center">
                              {unitSystem === "ip" ? "Total (HP)" : "Total (kW)"}
                            </th>
                            <th className="px-3 py-2 border-r border-border w-20 text-center">
                              {unitSystem === "ip" ? "Standby (HP)" : "Standby (kW)"}
                            </th>
                            <th className="px-3 py-2 border-r border-border w-20 text-center">
                              <span
                                className="flex items-center gap-1 justify-center w-full cursor-help"
                                title="Actual Connected Load (Total kW - Standby)"
                              >
                                ACL <Info className="size-3" />
                              </span>
                            </th>
                            <th className="px-3 py-2 border-r border-border w-24 text-center">
                              <span
                                className="flex items-center gap-1 justify-center w-full cursor-help"
                                title="Defaults to ACL. Used to calculate emergency DG size."
                              >
                                Emergency <Info className="size-3" />
                              </span>
                            </th>
                            <th className="px-3 py-2 border-r border-border w-36 text-center">
                              <span
                                className="flex items-center gap-1 justify-center w-full cursor-help"
                                title="Power Failure Load"
                              >
                                {unitSystem === "ip" ? "Power Failure Load (HP)" : "Power Failure Load (kW)"}
                              </span>
                            </th>
                            <th className="px-3 py-2 border-r border-border w-48 text-center">
                              Remarks
                            </th>
                            <th className="px-2 py-2 text-center w-12 text-[11px]">
                              Actions
                            </th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-border">
                          {displayRows.length === 0 ? (
                            <tr>
                              <td
                                colSpan={14}
                                className="text-center py-10 text-muted-foreground italic"
                              >
                                {showFlaggedOnly ? "No flagged loads found." : "No loads added. Click \"+ Add Load\" to begin."}
                              </td>
                            </tr>
                          ) : (
                            displayRows.map((r, rowIndex) => {
                              const rKw = Number(r.kwPerUnit) || 0;
                              const rSb = Number(r.standby) || 0;
                              const rUnit = Number(r.unit) || 0;
                              const rMult = Number(r.multiplier) || 0;

                              const startCur = rKw * 1.739 * rMult;
                          const totalKw = rUnit * rKw;
                              const actualKw = totalKw - rSb;

                              const isEditing = editingRow?.row.id === r.id;
                              const isModalOpen = editingRow !== null;

                              return (
                                <ContextMenu key={r.id}>
                                  <ContextMenuTrigger asChild>
                                    <tr
                                      key={r.id}
                                      id={`gen-row-${r.id}`}
                                      onDoubleClick={() => {
                                        toggleSelection(r.id, false, false);
                                        setEditingRow({ row: r, index: rowIndex });
                                      }}
                                      className={`transition-all duration-200 cursor-pointer ${rowDensity === "compact" ? "h-7 text-[11.5px]" : "h-9 text-[12.5px]"} ${
                                        isEditing
                                          ? "bg-primary/20 ring-2 ring-primary border-y border-primary font-bold shadow-2xl z-30 relative opacity-100 blur-none scale-[1.005]"
                                          : isModalOpen
                                          ? "blur-[2.5px] opacity-35 select-none pointer-events-none transition-all duration-200"
                                          : selectedRows.has(r.id)
                                          ? "bg-primary/5"
                                          : "hover:bg-surface-2"
                                      } ${draggedRowIndex === rowIndex ? "opacity-50" : ""}`}
                                      draggable
                                      onDragStart={(e) => handleDragStart(e, rowIndex)}
                                      onDragOver={(e) => handleDragOver(e, rowIndex)}
                                      onDrop={handleDrop}
                                      onDragEnd={handleDrop}
                                      onClick={(e) => {
                                        const tagName = (e.target as HTMLElement).tagName;
                                        if (tagName === "TD") {
                                          toggleRowSelect(r.id, e.shiftKey, e.ctrlKey || e.metaKey);
                                        }
                                      }}
                                      onContextMenu={() => {
                                        if (!selectedRows.has(r.id)) {
                                          toggleSelection(r.id, false, false);
                                        }
                                      }}
                                    >
                                      <td className="p-0 border-r border-border">
                                        <div className="flex items-center justify-center gap-1.5 h-9 px-1">
                                          <GripVertical className="size-3.5 text-muted-foreground/50 cursor-grab active:cursor-grabbing hover:text-foreground" />
                                          <input
                                            type="checkbox"
                                            className="cursor-pointer"
                                            checked={selectedRows.has(r.id)}
                                            onChange={() => {}}
                                            onClick={(e) => {
                                              e.stopPropagation();
                                              toggleRowSelect(r.id, e.shiftKey, e.ctrlKey || e.metaKey);
                                            }}
                                          />
                                        </div>
                                      </td>
                                      <td className="p-0 border-r border-border">
                                        <div className="flex items-center gap-1.5 w-full px-2">
                                          {r.comments && r.comments.length > 0 && (
                                            <span
                                              className="inline-flex items-center justify-center p-1 rounded bg-blue-100 text-blue-600 dark:bg-blue-900/60 dark:text-blue-300 shrink-0 cursor-pointer"
                                              title={`${r.comments.length} comment(s):\n${r.comments.map((c: any) => `${c.authorName}: ${c.text}`).join('\n')}`}
                                              onClick={(e) => {
                                                e.stopPropagation();
                                                setCommentTarget({
                                                  id: r.id,
                                                  name: r.desc || `Row ${rowIndex + 1}`,
                                                  type: "space",
                                                });
                                                setAssignCommentOpen(true);
                                              }}
                                            >
                                              <MessageSquare className="size-3.5" />
                                            </span>
                                          )}
                                          <input
                                            data-row={rowIndex}
                                            data-col={0}
                                            type="text"
                                            className="w-full h-9 px-2 text-foreground placeholder:text-muted-foreground/60 bg-transparent outline-none focus:bg-white dark:focus:bg-surface-2 focus:text-foreground focus:ring-1 focus:ring-primary/50 transition-colors flex-1"
                                            value={r.desc}
                                            onChange={(e) => updateRow(r.id, "desc", e.target.value)}
                                            placeholder="Description"
                                          />
                                        </div>
                                      </td>
                                      <td className="p-0 border-r border-border">
                                        <input
                                          data-row={rowIndex}
                                          data-col={1}
                                          type="number"
                                          className="w-full h-9 px-2 text-center text-foreground bg-transparent outline-none focus:bg-white dark:focus:bg-surface-2 focus:text-foreground focus:ring-1 focus:ring-primary/50 transition-colors [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                                          value={r.unit}
                                          onChange={(e) => updateRow(r.id, "unit", e.target.value)}
                                        />
                                      </td>
                                      <td className="p-0 border-r border-border">
                                        <input
                                          data-row={rowIndex}
                                          data-col={2}
                                          type="number"
                                          className="w-full h-9 px-2 text-center text-foreground bg-transparent outline-none focus:bg-white dark:focus:bg-surface-2 focus:text-foreground focus:ring-1 focus:ring-primary/50 transition-colors [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                                          value={r.kwPerUnit}
                                          onChange={(e) => updateRow(r.id, "kwPerUnit", e.target.value)}
                                        />
                                      </td>
                                      <td className="p-0 border-r border-border">
                                        <select
                                          data-row={rowIndex}
                                          data-col={3}
                                          className="w-full h-9 px-2 text-center text-foreground bg-transparent outline-none focus:bg-white dark:focus:bg-surface-2 focus:text-foreground focus:ring-1 focus:ring-primary/50 transition-colors cursor-pointer"
                                          value={r.starter}
                                          onChange={(e) => updateRow(r.id, "starter", e.target.value)}
                                        >
                                          <option value="DOL" className="bg-popover text-popover-foreground">DOL</option>
                                          <option value="SD" className="bg-popover text-popover-foreground">Star Delta</option>
                                          <option value="Soft Starter" className="bg-popover text-popover-foreground">Soft Starter</option>
                                          <option value="VFD" className="bg-popover text-popover-foreground">VFD</option>
                                          <option value="None" className="bg-popover text-popover-foreground">None</option>
                                        </select>
                                      </td>
                                      <td className="p-0 border-r border-border bg-primary/10">
                                        <input
                                          data-row={rowIndex}
                                          data-col={4}
                                          type="number"
                                          className="w-full h-9 px-2 text-center text-foreground bg-transparent outline-none focus:bg-white dark:focus:bg-surface-2 focus:text-foreground focus:ring-1 focus:ring-primary/50 font-medium transition-colors [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                                          value={r.multiplier}
                                          onChange={(e) =>
                                            updateRow(r.id, "multiplier", e.target.value)
                                          }
                                        />
                                      </td>
                                      <td className="px-3 py-2 text-center font-semibold text-foreground border-r border-border">
                                        {startCur.toFixed(2)}
                                      </td>
                                      <td className="px-3 py-2 text-center text-muted-foreground border-r border-border">
                                        {totalKw.toFixed(2)}
                                      </td>
                                      <td className="p-0 border-r border-border">
                                        <input
                                          data-row={rowIndex}
                                          data-col={5}
                                          type="number"
                                          className="w-full h-9 px-2 text-center text-foreground bg-transparent outline-none focus:bg-white dark:focus:bg-surface-2 focus:text-foreground focus:ring-1 focus:ring-primary/50 transition-colors [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                                          value={r.standby}
                                          onChange={(e) => updateRow(r.id, "standby", e.target.value)}
                                        />
                                      </td>
                                      <td className="px-3 py-2 text-center font-semibold text-primary border-r border-border">
                                        {actualKw.toFixed(2)}
                                      </td>
                                      <td className="p-0 border-r border-border relative group/em">
                                        <div className="flex items-center w-full h-full">
                                          <input
                                            data-row={rowIndex}
                                            data-col={6}
                                            type="number"
                                            className={`w-full h-9 px-2 text-center text-foreground bg-transparent outline-none focus:bg-white dark:focus:bg-surface-2 focus:text-foreground focus:ring-1 focus:ring-primary/50 transition-colors [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none ${r.excludeEmergency ? "opacity-30 line-through" : ""}`}
                                            value={r.emergency}
                                            onChange={(e) =>
                                              updateRow(r.id, "emergency", e.target.value)
                                            }
                                            disabled={r.excludeEmergency}
                                          />
                                          <button
                                            onClick={() =>
                                              updateRow(r.id, "excludeEmergency", !r.excludeEmergency)
                                            }
                                            className="absolute right-1 opacity-0 group-hover/em:opacity-100 p-1 text-muted-foreground hover:text-red-500 transition-opacity bg-background dark:bg-surface-2 shadow-sm rounded border border-border"
                                            title={
                                              r.excludeEmergency
                                                ? "Include Emergency Load"
                                                : "Exclude Emergency Load"
                                            }
                                          >
                                            {r.excludeEmergency ? (
                                              <Plus className="size-3" />
                                            ) : (
                                              <Trash2 className="size-3" />
                                            )}
                                          </button>
                                        </div>
                                      </td>
                                      <td className="p-0 flex items-center border-r border-border">
                                        <input
                                          data-row={rowIndex}
                                          data-col={7}
                                          type="number"
                                          className="w-full h-9 px-2 text-center text-foreground bg-transparent outline-none focus:bg-white dark:focus:bg-surface-2 focus:text-foreground focus:ring-1 focus:ring-primary/50 transition-colors [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none flex-1"
                                          value={r.powerFail}
                                          onChange={(e) => updateRow(r.id, "powerFail", e.target.value)}
                                        />
                                        <select
                                          className="h-9 w-12 px-1 bg-primary/10 text-primary outline-none cursor-pointer border-l border-border/50 text-[11px] font-medium dark:bg-primary/20 dark:text-primary-foreground"
                                          defaultValue=""
                                          onChange={(e) => {
                                            setPowerFailPercent(r.id, e.target.value);
                                            e.target.value = "";
                                          }}
                                        >
                                          <option value="" disabled className="bg-popover text-popover-foreground">
                                            %
                                          </option>
                                          <option value="10" className="bg-popover text-popover-foreground">10%</option>
                                          <option value="20" className="bg-popover text-popover-foreground">20%</option>
                                          <option value="30" className="bg-popover text-popover-foreground">30%</option>
                                          <option value="40" className="bg-popover text-popover-foreground">40%</option>
                                          <option value="50" className="bg-popover text-popover-foreground">50%</option>
                                          <option value="60" className="bg-popover text-popover-foreground">60%</option>
                                          <option value="70" className="bg-popover text-popover-foreground">70%</option>
                                          <option value="80" className="bg-popover text-popover-foreground">80%</option>
                                          <option value="90" className="bg-popover text-popover-foreground">90%</option>
                                          <option value="100" className="bg-popover text-popover-foreground">100%</option>
                                        </select>
                                      </td>
                                      <td className="p-0 border-r border-border">
                                        <input
                                          data-row={rowIndex}
                                          data-col={8}
                                          type="text"
                                          className="w-full h-9 px-2 text-center text-foreground placeholder:text-muted-foreground/60 bg-transparent outline-none focus:bg-white dark:focus:bg-surface-2 focus:text-foreground focus:ring-1 focus:ring-primary/50 transition-colors"
                                          value={!r.remark || r.remark === "undefined" ? "" : r.remark}
                                          onChange={(e) => updateRow(r.id, "remark", e.target.value)}
                                        />
                                      </td>
                                      <td className="p-0 text-center">
                                        <div className="flex items-center justify-center gap-1 h-full w-full px-1">
                                          {(() => {
                                            const { isAutoFlagged, isFlagged, warnings } = getGenRowValidation(r);
                                            const tooltipText = isFlagged
                                              ? warnings.length > 0
                                                ? `Flagged for review. Warning(s): ${warnings.join(", ")}`
                                                : "Flagged for manual review"
                                              : "Flag load for review";

                                            return (
                                              <button
                                                onClick={(e) => {
                                                  e.stopPropagation();
                                                  toggleFlagRows(r.id, isFlagged);
                                                }}
                                                className={`p-1 rounded transition-colors cursor-pointer ${
                                                  isFlagged
                                                    ? "bg-red-500/10 text-red-600 dark:bg-red-500/20 dark:text-red-400 hover:bg-red-500/20"
                                                    : "text-muted-foreground hover:text-red-500 hover:bg-red-500/10"
                                                }`}
                                                title={tooltipText}
                                              >
                                                <Flag className={`size-3.5 ${isFlagged ? "fill-red-500 text-red-500" : ""}`} />
                                              </button>
                                            );
                                          })()}
                                        </div>
                                      </td>
                                    </tr>
                                  </ContextMenuTrigger>
                                  <ContextMenuContent className="w-56 bg-popover border border-border rounded-lg shadow-xl p-1 text-[13px] text-popover-foreground z-[999]">
                                    <ContextMenuItem
                                      onClick={() => {
                                        const { isFlagged } = getGenRowValidation(r);
                                        toggleFlagRows(r.id, isFlagged);
                                      }}
                                      className="flex items-center gap-2 px-2.5 py-1.5 hover:bg-accent hover:text-accent-foreground rounded cursor-pointer"
                                    >
                                      <Flag className={`size-3.5 ${getGenRowValidation(r).isFlagged ? "text-red-500 fill-red-500" : "text-muted-foreground"}`} />
                                      <span>{getGenRowValidation(r).isFlagged ? "Unflag Selected Row(s)" : "Flag Selected Row(s)"}</span>
                                    </ContextMenuItem>
                                    <ContextMenuSeparator />

                                    <ContextMenuItem
                                      onClick={() => {
                                        const el = document.querySelector(`input[data-row="${rowIndex}"][data-col="0"]`) as HTMLInputElement;
                                        if (el) el.focus();
                                      }}
                                      className="flex items-center gap-2 px-2.5 py-1.5 hover:bg-accent hover:text-accent-foreground rounded cursor-pointer"
                                    >
                                      <Edit3 className="size-3.5 text-muted-foreground" />
                                      <span>{selectedRows.size > 1 && selectedRows.has(r.id) ? `Edit Row (${selectedRows.size} selected)` : "Edit Row"}</span>
                                    </ContextMenuItem>

                                    <ContextMenuItem
                                      onClick={() => {
                                        const targets = selectedRows.has(r.id) ? Array.from(selectedRows) : [r.id];
                                        const newClones: GenRow[] = [];
                                        rows.forEach((row) => {
                                          if (targets.includes(row.id)) {
                                            newClones.push({
                                              ...row,
                                              id: `gen_${Date.now()}_${Math.floor(Math.random() * 1000)}_${Math.floor(Math.random() * 1000)}`,
                                              desc: row.desc ? `${row.desc} (Copy)` : "Copy Row",
                                            });
                                          }
                                        });
                                        const newRows = [...rows, ...newClones];
                                        pushState(newRows);
                                        toast.success(`Duplicated ${newClones.length} row(s)`);
                                      }}
                                      className="flex items-center gap-2 px-2.5 py-1.5 hover:bg-accent hover:text-accent-foreground rounded cursor-pointer"
                                    >
                                      <Copy className="size-3.5 text-muted-foreground" />
                                      <span>{selectedRows.size > 1 && selectedRows.has(r.id) ? `Duplicate Selected (${selectedRows.size})` : "Duplicate Row"}</span>
                                    </ContextMenuItem>

                                    <ContextMenuItem
                                      onClick={() => {
                                        setCommentTarget({
                                          id: r.id,
                                          name: r.desc || `Row ${rowIndex + 1}`,
                                          type: "space",
                                        });
                                        setAssignCommentOpen(true);
                                      }}
                                      className="flex items-center gap-2 px-2.5 py-1.5 hover:bg-accent hover:text-accent-foreground rounded cursor-pointer text-blue-600 dark:text-blue-400"
                                    >
                                      <MessageSquare className="size-3.5" />
                                      <span>Add comment</span>
                                    </ContextMenuItem>

                                    <ContextMenuSeparator className="h-px bg-border my-1" />

                                    <ContextMenuItem
                                      onClick={() => {
                                        const targets = selectedRows.has(r.id) ? Array.from(selectedRows) : [r.id];
                                        const newRows = rows.map((row) => {
                                          if (targets.includes(row.id)) {
                                            return { ...row, excludeEmergency: !r.excludeEmergency };
                                          }
                                          return row;
                                        });
                                        pushState(newRows);
                                        toast.info(`${r.excludeEmergency ? "Included" : "Excluded"} emergency load for ${targets.length} row(s)`);
                                      }}
                                      className="flex items-center gap-2 px-2.5 py-1.5 hover:bg-accent hover:text-accent-foreground rounded cursor-pointer"
                                    >
                                      <SlidersHorizontal className="size-3.5 text-muted-foreground" />
                                      <span>{r.excludeEmergency ? "Include Emergency Load" : "Exclude Emergency Load"}</span>
                                    </ContextMenuItem>

                                    <ContextMenuSeparator className="h-px bg-border my-1" />

                                    <ContextMenuItem
                                      onClick={() => {
                                        const targets = selectedRows.has(r.id) ? Array.from(selectedRows) : [r.id];
                                        const newRows = rows.filter((row) => !targets.includes(row.id));
                                        pushState(newRows);
                                        clearSelection();
                                        toast.info(`Deleted ${targets.length} row(s)`);
                                      }}
                                      className="flex items-center gap-2 px-2.5 py-1.5 hover:bg-destructive/10 hover:text-destructive rounded text-destructive cursor-pointer font-medium"
                                    >
                                      <Trash2 className="size-3.5" />
                                      <span>{selectedRows.size > 1 && selectedRows.has(r.id) ? `Delete Selected (${selectedRows.size})` : "Delete Row"}</span>
                                      <ContextMenuShortcut className="text-[10px] text-muted-foreground font-mono ml-auto">Delete</ContextMenuShortcut>
                                    </ContextMenuItem>
                                  </ContextMenuContent>
                                </ContextMenu>
                              );
                            })
                          )}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </div>

                {/* Right Side: Results & Config */}
                <div className="flex flex-col w-full xl:w-[320px] shrink-0 border-t xl:border-t-0 xl:border-l border-white/40 dark:border-white/10 bg-transparent overflow-y-auto p-4 gap-4">
                  <div className="bg-white/60 dark:bg-black/40 backdrop-blur-xl border border-white/50 dark:border-white/10 rounded-3xl shadow-[0_20px_50px_rgba(0,0,0,0.1)] p-4 shrink-0">
                    <h4 className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground mb-3 border-b border-white/40 dark:border-white/10 pb-2">
                      Sizing Parameters
                    </h4>
                    <div className="space-y-3 text-[13px]">
                      <div className="flex justify-between items-center">
                        <span className="font-medium">Power Factor (Lag)</span>
                        <input
                          type="number"
                          step="0.01"
                          className="w-20 px-2 py-1 border border-border bg-surface-2 text-foreground rounded outline-none text-right [appearance:textfield] focus:ring-1 focus:ring-primary focus:border-primary"
                          value={pf}
                          onChange={(e) => setPf(parseFloat(e.target.value) || 0.8)}
                        />
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="font-medium">Loading Factor</span>
                        <input
                          type="number"
                          step="0.01"
                          className="w-20 px-2 py-1 border border-border bg-surface-2 text-foreground rounded outline-none text-right [appearance:textfield] focus:ring-1 focus:ring-primary focus:border-primary"
                          value={lf}
                          onChange={(e) => setLf(parseFloat(e.target.value) || 0.9)}
                        />
                      </div>
                    </div>
                  </div>

                  <div data-ignore-persist="true" className="bg-white/60 dark:bg-black/40 backdrop-blur-xl border border-white/50 dark:border-white/10 rounded-3xl shadow-[0_20px_50px_rgba(0,0,0,0.1)] flex flex-col justify-between overflow-hidden shrink-0">
                    <div className="px-4 py-3 border-b border-white/40 dark:border-white/10 flex items-center justify-between bg-primary/10">
                      <div className="flex items-center gap-2">
                        <div className="w-1 h-4 bg-primary rounded-full" />
                        <h4 className="font-bold text-[12px] text-primary uppercase tracking-wide">
                          Generator Result
                        </h4>
                      </div>
                      {Object.keys(manualOverrides).length > 0 && (
                        <button 
                          onClick={clearOverrides}
                          className="text-[10px] bg-white/50 hover:bg-white dark:bg-black/20 dark:hover:bg-black/40 text-primary px-2 py-0.5 rounded font-bold uppercase transition-colors shadow-sm"
                        >
                          Clear Overrides
                        </button>
                      )}
                    </div>

                    <div className="p-4 space-y-3">
                      {/* Header Row */}
                      <div className="grid grid-cols-[1fr_80px_80px] gap-4 pb-2 border-b border-surface-2">
                        <span className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
                          Parameter
                        </span>
                        <span className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground text-right">
                          ACL Base
                        </span>
                        <span className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground text-right">
                          Emerg. Base
                        </span>
                      </div>

                      <div className="grid grid-cols-[1fr_80px_80px] gap-4 items-center pb-2 border-b border-surface-2">
                        <span 
                          className="text-[12.5px] font-medium text-muted-foreground border-b border-dotted border-muted-foreground/50 cursor-help inline-block w-fit"
                          title="Total Actual Connected Load"
                        >
                          Total ACL ({unitSystem === "ip" ? "HP" : "kW"})
                        </span>
                        <div className="text-right">
                          <input
                            type="number"
                            className="w-full text-right text-[13px] font-bold text-foreground bg-transparent border-b border-transparent hover:border-border focus:border-primary outline-none [appearance:textfield]"
                            value={
                              manualOverrides["acl"] !== undefined
                                ? manualOverrides["acl"]
                                : calc.totalAcl.toFixed(2)
                            }
                            onChange={(e) => setOverride("acl", e.target.value)}
                            onBlur={(e) => {
                              if (e.target.value === "") {
                                const copy = { ...manualOverrides };
                                delete copy["acl"];
                                setManualOverrides(copy);
                              }
                            }}
                          />
                        </div>
                        <div className="text-right">
                          <input
                            type="number"
                            className="w-full text-right text-[13px] font-bold text-foreground bg-transparent border-b border-transparent hover:border-border focus:border-primary outline-none [appearance:textfield]"
                            value={
                              manualOverrides["em"] !== undefined
                                ? manualOverrides["em"]
                                : calc.totalEmergency.toFixed(2)
                            }
                            onChange={(e) => setOverride("em", e.target.value)}
                            onBlur={(e) => {
                              if (e.target.value === "") {
                                const copy = { ...manualOverrides };
                                delete copy["em"];
                                setManualOverrides(copy);
                              }
                            }}
                          />
                        </div>
                      </div>

                      <div className="grid grid-cols-[1fr_80px_80px] gap-4 items-center pb-2 border-b border-surface-2">
                        <span 
                          className="text-[12.5px] font-medium text-muted-foreground border-b border-dotted border-muted-foreground/50 cursor-help inline-block w-fit"
                          title="Demand Load = Actual Connected Load / Power Factor"
                        >
                          Demand Load (kVA)
                        </span>
                        <div className="text-right">
                          <input
                            type="number"
                            className="w-full text-right text-[13px] font-bold text-foreground bg-transparent border-b border-transparent hover:border-border focus:border-primary outline-none [appearance:textfield]"
                            value={
                              manualOverrides["demandAcl"] !== undefined
                                ? manualOverrides["demandAcl"]
                                : calc.demandLoadAcl.toFixed(2)
                            }
                            onChange={(e) => setOverride("demandAcl", e.target.value)}
                            onBlur={(e) => {
                              if (e.target.value === "") {
                                const copy = { ...manualOverrides };
                                delete copy["demandAcl"];
                                setManualOverrides(copy);
                              }
                            }}
                          />
                        </div>
                        <div className="text-right">
                          <input
                            type="number"
                            className="w-full text-right text-[13px] font-bold text-foreground bg-transparent border-b border-transparent hover:border-border focus:border-primary outline-none [appearance:textfield]"
                            value={
                              manualOverrides["demandEm"] !== undefined
                                ? manualOverrides["demandEm"]
                                : calc.demandLoadEm.toFixed(2)
                            }
                            onChange={(e) => setOverride("demandEm", e.target.value)}
                            onBlur={(e) => {
                              if (e.target.value === "") {
                                const copy = { ...manualOverrides };
                                delete copy["demandEm"];
                                setManualOverrides(copy);
                              }
                            }}
                          />
                        </div>
                      </div>

                      <div className="grid grid-cols-[1fr_80px_80px] gap-4 items-center pb-2 border-b border-surface-2">
                        <span 
                          className="text-[12.5px] font-medium text-muted-foreground border-b border-dotted border-muted-foreground/50 cursor-help inline-block w-fit"
                          title="Calculated size for DG set (Demand Load / Loading Factor)"
                        >
                          Calc. DG Size (kVA)
                        </span>
                        <div className="text-right">
                          <input
                            type="number"
                            className="w-full text-right text-[13px] font-bold text-primary bg-transparent border-b border-transparent hover:border-border focus:border-primary outline-none [appearance:textfield]"
                            value={
                              manualOverrides["calcAcl"] !== undefined
                                ? manualOverrides["calcAcl"]
                                : calc.calcSizeAcl.toFixed(2)
                            }
                            onChange={(e) => setOverride("calcAcl", e.target.value)}
                            onBlur={(e) => {
                              if (e.target.value === "") {
                                const copy = { ...manualOverrides };
                                delete copy["calcAcl"];
                                setManualOverrides(copy);
                              }
                            }}
                          />
                        </div>
                        <div className="text-right">
                          <input
                            type="number"
                            className="w-full text-right text-[13px] font-bold text-primary bg-transparent border-b border-transparent hover:border-border focus:border-primary outline-none [appearance:textfield]"
                            value={
                              manualOverrides["calcEm"] !== undefined
                                ? manualOverrides["calcEm"]
                                : calc.calcSizeEm.toFixed(2)
                            }
                            onChange={(e) => setOverride("calcEm", e.target.value)}
                            onBlur={(e) => {
                              if (e.target.value === "") {
                                const copy = { ...manualOverrides };
                                delete copy["calcEm"];
                                setManualOverrides(copy);
                              }
                            }}
                          />
                        </div>
                      </div>

                      <div className="pt-3 border-t border-surface-2 space-y-3">
                        <div className="flex flex-wrap items-center justify-between gap-3">
                          <div>
                            <div className="flex items-center gap-2">
                              <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                                Selected DG Set Size
                              </span>
                              {userSelectedSize === null && (
                                <span className="text-[10px] bg-primary/10 text-primary px-1.5 py-0.5 rounded font-bold uppercase">
                                  Auto
                                </span>
                              )}
                            </div>
                            <div className="flex items-center gap-2 mt-1">
                              <Select
                                value={userSelectedSize !== null ? userSelectedSize.toString() : "auto"}
                                onValueChange={(val) => {
                                  if (val === "auto") {
                                    setUserSelectedSize(null);
                                  } else {
                                    setUserSelectedSize(Number(val));
                                  }
                                }}
                              >
                                <SelectTrigger className="text-[22px] h-auto font-bold tracking-tight text-primary bg-transparent outline-none border border-border rounded px-3 py-1 cursor-pointer hover:bg-surface-2 transition-colors focus:ring-2 focus:ring-primary/20 shadow-sm min-w-[160px]">
                                  <SelectValue>
                                    {`${calc.selectedSize} kVA`}
                                  </SelectValue>
                                </SelectTrigger>
                                <SelectContent className="max-h-[300px]">
                                  <SelectItem value="auto" className="text-[14px] font-semibold text-primary">
                                    ⚡ Auto ({calc.autoSize} kVA)
                                  </SelectItem>
                                  {STANDARD_SIZES.map((size) => (
                                    <SelectItem key={size} value={size.toString()} className="text-[14px]">
                                      {size} kVA
                                    </SelectItem>
                                  ))}
                                  {!STANDARD_SIZES.includes(calc.autoSize) && calc.autoSize > 5000 && (
                                    <SelectItem value={calc.autoSize.toString()} className="text-[14px]">
                                      {calc.autoSize} kVA (Calculated)
                                    </SelectItem>
                                  )}
                                </SelectContent>
                              </Select>
                              {userSelectedSize !== null && (
                                <button
                                  onClick={() => setUserSelectedSize(null)}
                                  className="text-[11px] bg-primary/10 hover:bg-primary/20 text-primary px-2.5 py-1.5 rounded font-semibold transition-colors shadow-sm whitespace-nowrap"
                                  title="Reset to Auto Sizing based on total calculated kVA"
                                >
                                  Reset to Auto
                                </button>
                              )}
                            </div>
                          </div>

                          <div className="text-right">
                            <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground block mb-1">
                              Max Starting Current
                            </span>
                            <div className="flex items-center justify-end gap-1">
                              <input
                                type="number"
                                className="w-28 text-right text-[14px] font-bold text-foreground bg-transparent border-b border-transparent hover:border-border focus:border-primary outline-none [appearance:textfield]"
                                value={
                                  manualOverrides["maxStart"] !== undefined
                                    ? manualOverrides["maxStart"]
                                    : calc.maxStartCur.toFixed(2)
                                }
                                onChange={(e) => setOverride("maxStart", e.target.value)}
                                onBlur={(e) => {
                                  if (e.target.value === "") {
                                    const copy = { ...manualOverrides };
                                    delete copy["maxStart"];
                                    setManualOverrides(copy);
                                  }
                                }}
                              />
                              <span className="text-[13px] font-bold text-foreground">A</span>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="bg-white/60 dark:bg-black/40 backdrop-blur-xl border border-white/50 dark:border-white/10 rounded-3xl shadow-[0_20px_50px_rgba(0,0,0,0.1)] p-4 text-[12.5px] shrink-0">
                    <h4 className="font-semibold text-muted-foreground mb-3 pb-2 border-b border-white/40 dark:border-white/10">
                      Motor Analysis
                    </h4>
                    <div className="space-y-2">
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Max Starting Current</span>
                        <span className="font-medium font-mono">
                          {calc.maxStartCur.toFixed(2)} A
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Largest Motor Size</span>
                        <span className="font-medium font-mono">
                          {calc.largestMotorKw > 0
                            ? unitSystem === "ip"
                              ? (calc.largestMotorKw / 0.746).toFixed(2) + " HP"
                              : calc.largestMotorKw.toFixed(2) + " kW"
                            : "-"}
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Largest Motor Starter</span>
                        <span className="font-medium">
                          {calc.largestMotorKw > 0 ? calc.largestMotorStarter : "-"}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {commentTarget && (
        <AssignCommentModal
          isOpen={assignCommentOpen}
          onClose={() => {
            setAssignCommentOpen(false);
            setCommentTarget(null);
          }}
          targetId={commentTarget.id}
          targetName={commentTarget.name}
          targetType={commentTarget.type}
          existingComments={rows.find((r) => r.id === commentTarget.id)?.comments || []}
          onSave={async (newComment) => {
            if (!commentTarget) return;
            const targetId = commentTarget.id;
            const targetRow = rows.find((r) => r.id === targetId);
            if (!targetRow) return;
            const currentUserName = userData?.name || profile?.name || "Design Engineer";
            const projId = activeProjectId || project?.id || "default";
            const projName = project?.name || "Active Project";

            const commentWithMeta = {
              ...newComment,
              targetId: commentTarget.id,
              targetName: commentTarget.name,
              targetType: "Generator Load",
              projectName: projName,
              projectId: projId,
              calculatorPath: "/generator-sizing",
            };

            const existingComments = targetRow.comments || [];
            const updatedComments = [...existingComments, commentWithMeta];

            const newRows = rows.map((r) =>
              r.id === targetId ? { ...r, comments: updatedComments } : r
            );
            pushState(newRows);

            if (project?.id) {
              try {
                let wdata = project.workspace_data || {};
                if (typeof wdata === 'string') { try { wdata = JSON.parse(wdata); } catch(e) {} }
                wdata.generator_calc = { ...(wdata.generator_calc || {}), rows: newRows };
                api.updateProject(project.id, { workspace_data: wdata }).catch(console.error);
              } catch(e) {}
            }

            if (typeof window !== 'undefined') {
              window.dispatchEvent(new CustomEvent("mep_notification_received", { detail: commentWithMeta }));
              window.dispatchEvent(new CustomEvent("mep-notification-added", { detail: commentWithMeta }));
              window.dispatchEvent(new Event("storage"));
            }

            toast.success(`Task comment saved for space ${commentTarget.name}`);
            notifyCommentAssigned({
              comment: commentWithMeta,
              targetId: commentTarget.id,
              targetName: commentTarget.name,
              targetType: "Generator Load",
              calculatorTitle: "Generator Sizing",
              calculatorPath: "/generator-sizing",
              project,
              currentUserName,
              currentUserId: userData?.id || profile?.id
            }).catch(console.error);
            setAssignCommentOpen(false);
            setCommentTarget(null);
          }}
        />
      )}
      {/* Double-Click Edit & Calculation Breakdown Modal */}
      {editingRow && (
        <EditGeneratorRowModal
          row={editingRow.row}
          rowIndex={editingRow.index + 1}
          projectName={currentProject}
          pf={pf}
          lf={lf}
          unitSystem={unitSystem}
          onClose={() => setEditingRow(null)}
          onSave={(updated) => {
            const targetId = editingRow.row.id;
            const newRows = rows.map((r) =>
              r.id === targetId
                ? {
                    ...r,
                    desc: updated.desc,
                    unit: updated.unit,
                    kwPerUnit: updated.kwPerUnit,
                    starter: updated.starter,
                    multiplier: updated.multiplier,
                    remark: updated.remark,
                    excludeEmergency: updated.excludeEmergency,
                  }
                : r
            );
            pushState(newRows);
            setEditingRow(null);
            toast.success(`Updated "${updated.desc || 'Load Item'}" parameters.`);
          }}
        />
      )}
    </AppShell>
  );
}
