const fs = require('fs');
const path = require('path');
const file = path.join('Z:', '00 R&D Server', '04 MISC', 'Vikrams  MEP CALCULATOR UPDATED', 'vikram_updated_calc', 'New Ui MEP', 'MEP_Calculator_Project', 'frontend', 'src', 'routes', 'plumbing-fire-water-demand.tsx');
let content = fs.readFileSync(file, 'utf8');

const targetStart = '{/* Unified Toolbar (Tabs, Search, Filter, Actions) */}';
const targetEnd = '{/* Building Schedule DataGrid Table - Takes Full Container Height */}';

const startIndex = content.indexOf(targetStart);
const endIndex = content.indexOf(targetEnd);

if (startIndex !== -1 && endIndex !== -1) {
  const replacement = `{/* Unified Toolbar (Tabs, Search, Filter, Actions) */}
            <div className="relative flex items-center justify-between px-4 py-2.5 bg-card shrink-0 select-none no-print border-b border-border/80 gap-3 flex-wrap">
              
              {/* Left Side: Tabs + Formula + Presets */}
              <div className="flex items-center gap-3 flex-wrap">
                <div className="flex bg-surface-2 p-1 rounded-full gap-1 border border-border/80 shrink-0">
                  <button
                    onClick={() => setTab("schedule")}
                    className={\`px-4 py-1.5 text-xs font-semibold rounded-full transition-all duration-150 cursor-pointer \${
                      tab === "schedule" ? "bg-background text-foreground shadow-sm font-bold" : "text-muted-foreground hover:text-foreground"
                    }\`}
                  >
                    Building Schedule
                  </button>
                  <button
                    onClick={() => {
                      if (buildings.length > 0 && (!reportBuildingId || !buildings.find(b => b.id === reportBuildingId))) {
                        setReportBuildingId(buildings[0].id);
                      }
                      setTab("report");
                    }}
                    className={\`px-4 py-1.5 text-xs font-semibold rounded-full transition-all duration-150 cursor-pointer \${
                      tab === "report" ? "bg-background text-foreground shadow-sm font-bold" : "text-muted-foreground hover:text-foreground"
                    }\`}
                  >
                    Report
                  </button>
                </div>

                {tab === "schedule" && (
                  <div className="flex items-center gap-2 ml-2">
                    <div className="relative w-64">
                      <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-3.5 text-muted-foreground" />
                      <input
                        type="text"
                        placeholder="Search building name or occupancy..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="w-full pl-9 pr-3 py-1.5 text-xs bg-surface-2 border border-border rounded-lg text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
                      />
                    </div>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <button
                          className={\`relative inline-flex items-center justify-center h-7 w-7 rounded-full border transition-all duration-150 ease-out outline-none focus-visible:ring-1 focus-visible:ring-ring cursor-pointer group overflow-visible \${
                            filterOccupancy !== "all"
                              ? "bg-primary/10 border-primary/45 text-primary font-medium hover:bg-primary/15"
                              : "border-border text-muted-foreground hover:bg-surface-2 hover:text-foreground"
                          }\`}
                        >
                          <Filter className="size-3.5 shrink-0" />
                          <span className="absolute top-full left-1/2 -translate-x-1/2 mt-1.5 px-2 py-0.5 bg-popover text-popover-foreground text-[11px] font-semibold border border-border rounded-md shadow-sm pointer-events-none opacity-0 scale-75 group-hover:opacity-100 group-hover:scale-100 transition-all duration-150 origin-center select-none z-50 whitespace-nowrap">
                            Filter
                          </span>
                          {filterOccupancy !== "all" && (
                            <span className="absolute -top-1 -right-1 flex items-center justify-center bg-primary text-white font-bold rounded-full size-3.5 text-[8.5px] shadow-sm border border-background">
                              1
                            </span>
                          )}
                        </button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="start" className="w-56 p-1.5 bg-popover border border-border rounded-xl shadow-xl font-sans z-50">
                        <div className="flex items-center justify-between px-2 py-1 pb-1.5 border-b border-border mb-1">
                          <span className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider">Filter Occupancy</span>
                          {filterOccupancy !== "all" && (
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                setFilterOccupancy("all");
                              }}
                              className="text-[10.5px] text-primary hover:underline font-semibold cursor-pointer"
                            >
                              Clear
                            </button>
                          )}
                        </div>
                        <DropdownMenuItem
                          onClick={() => setFilterOccupancy("all")}
                          className={\`flex items-center justify-between px-2.5 py-1.5 text-xs rounded-lg cursor-pointer \${
                            filterOccupancy === "all" ? "bg-primary/10 text-primary font-bold" : "text-foreground hover:bg-surface-2"
                          }\`}
                        >
                          <span>All Occupancies ({buildings.length})</span>
                          {filterOccupancy === "all" && <Check className="size-3.5 text-primary shrink-0" />}
                        </DropdownMenuItem>
                        {OCCUPANCY_OPTIONS.map((o) => {
                          const isSelected = filterOccupancy === o.value;
                          const count = buildings.filter((b) => b.occupancy === o.value).length;
                          return (
                            <DropdownMenuItem
                              key={o.value}
                              onClick={() => setFilterOccupancy(o.value)}
                              className={\`flex items-center justify-between px-2.5 py-1.5 text-xs rounded-lg cursor-pointer \${
                                isSelected ? "bg-primary/10 text-primary font-bold" : "text-foreground hover:bg-surface-2"
                              }\`}
                            >
                              <span>{o.label.split(" (")[0]} ({count})</span>
                              {isSelected && <Check className="size-3.5 text-primary shrink-0" />}
                            </DropdownMenuItem>
                          );
                        })}
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                )}
              </div>

              {/* Right Side Controls: Export & Add Building */}
              <div className="flex items-center gap-2 select-none shrink-0">
                <TBtn onClick={handleExportPDF}>
                  <FileText className="size-3.5" /> Export
                </TBtn>
                
                {tab === "schedule" && (
                  <button
                    disabled={isEffectiveReadOnly}
                    onClick={handleAddNewBuilding}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-primary hover:bg-primary/90 text-primary-foreground text-xs font-semibold shadow-xs transition-all cursor-pointer disabled:opacity-50"
                  >
                    <Plus className="size-3.5" />
                    Add Building
                  </button>
                )}
              </div>

              {/* Bulk actions bar overlay (Ventilation standard) */}
              {!isEffectiveReadOnly && tab === "schedule" && selectedRowIds.size > 0 && (
                <div className="absolute inset-0 flex items-center gap-2 px-3 bg-[#eef6fc] dark:bg-[#0c2233] text-[12px] text-[#06456F] dark:text-[#0A7BC7] z-20 no-print modal-blur-bg rounded-t-2xl">
                  <span className="font-semibold">{selectedRowIds.size} selected</span>
                  <span className="text-primary/30">·</span>
                  <BulkBtn icon={Edit3} onClick={handleOpenBulkEdit}>Bulk edit</BulkBtn>
                  <BulkBtn icon={Copy} onClick={handleDuplicateSelected}>Duplicate</BulkBtn>
                  <BulkBtn icon={MessageSquare} onClick={handleAssignTaskForSelected}>Assign task</BulkBtn>
                  <BulkBtn icon={Trash2} onClick={handleDeleteSelected}>Delete</BulkBtn>
                  <button
                    onClick={() => setSelectedRowIds(new Set())}
                    className="ml-auto text-[#06456F]/70 hover:text-[#06456F] dark:text-[#0A7BC7]/80 dark:hover:text-[#0A7BC7] inline-flex items-center gap-1 text-[11.5px] font-semibold transition-colors hover:bg-primary/5 active:bg-primary/10 px-2 py-0.5 rounded cursor-pointer"
                  >
                    <X className="size-3" /> Clear
                  </button>
                </div>
              )}
            </div>

            {/* TAB 1: SCHEDULE (FULL-HEIGHT SPACIOUS DATAGRID WITH DOUBLE-CLICK EDITING) */}
            {tab === "schedule" && (
              <div className="flex-1 flex flex-col min-h-0 overflow-hidden">
                
`;

  content = content.substring(0, startIndex) + replacement + content.substring(endIndex);
  fs.writeFileSync(file, content, 'utf8');
  console.log('Successfully replaced');
} else {
  console.log('Could not find start or end markers', startIndex, endIndex);
}
