const fs = require('fs');
const p = 'frontend/src/routes/diffuser-selector.tsx';
let c = fs.readFileSync(p, 'utf8');

const targetState = `  const [showDetailModal, setShowDetailModal] = useState<boolean>(false);`;
const replaceState = `  const [showDetailModal, setShowDetailModal] = useState<boolean>(false);
  const [showDetailedCalcs, setShowDetailedCalcs] = useState<boolean>(false);`;

if (c.includes(targetState) && !c.includes('showDetailedCalcs')) {
  c = c.replace(targetState, replaceState);
}

const startStr = '{showDetailModal && selectedDetailRow && (() => {';
const endStr = '              </div>\n            </div>\n          );\n        })()}';

const startIdx = c.indexOf(startStr);
const endIdx = c.indexOf(endStr, startIdx) + endStr.length;

if (startIdx !== -1 && endIdx !== -1) {
  const newModal = `{showDetailModal && selectedDetailRow && (() => {
          const row = rows.find(r => r.id === selectedDetailRow.id) || selectedDetailRow;
          const sizing = computeRowSizing(row, ip);
          const flowVal = row.airflow !== "" ? Number(row.airflow) : 0;
          const countVal = row.count !== "" && Number(row.count) > 0 ? Number(row.count) : 1;
          const kwVal = row.coolingKw !== "" ? Number(row.coolingKw) : 0;
          const dtVal = row.deltaT !== "" ? Number(row.deltaT) : 10;

          const updateRowField = (field: string, val: string | number) => {
            setRows(prev => prev.map(r => r.id === row.id ? { ...r, [field]: val } : r));
          };

          return (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4">
              <div className="bg-card border border-border rounded-3xl p-6 max-w-2xl w-full shadow-2xl flex flex-col gap-5 max-h-[90vh] overflow-y-auto animate-in fade-in zoom-in-95 duration-150">
                <div className="flex items-center justify-between border-b border-border/70 pb-3">
                  <div className="flex items-center gap-3">
                    <div className="p-2.5 bg-primary/10 rounded-xl text-primary">
                      <Calculator className="size-5" />
                    </div>
                    <div>
                      <h3 className="text-base font-bold text-foreground flex items-center gap-2">
                        {row.name} &mdash; {showDetailedCalcs ? "Calculation Preview" : "Properties & Tuning"}
                      </h3>
                      <p className="text-xs text-muted-foreground">
                        Floor: {row.floor} &bull; Zone: {row.zone}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => setShowDetailedCalcs(!showDetailedCalcs)}
                      className="px-3 py-1.5 bg-primary/10 text-primary font-bold rounded-lg text-xs hover:bg-primary/20 transition-colors cursor-pointer"
                    >
                      {showDetailedCalcs ? "Edit Properties" : "Calculation Preview"}
                    </button>
                    <button
                      onClick={() => setShowDetailModal(false)}
                      className="text-muted-foreground hover:bg-surface-2 hover:text-foreground text-sm font-bold p-1.5 rounded-full transition-colors cursor-pointer"
                    >
                      <X className="size-4" />
                    </button>
                  </div>
                </div>

                {!showDetailedCalcs ? (
                  <div className="flex flex-col gap-4 py-2">
                    <div className="grid grid-cols-2 gap-4">
                      <div className="flex flex-col gap-1.5">
                        <label className="text-[11px] font-semibold text-muted-foreground">Diffuser Type</label>
                        <select
                          disabled={isApprovedLocked}
                          value={row.diffType}
                          onChange={e => updateRowField('diffType', e.target.value)}
                          className="w-full bg-surface-2 border border-border/80 rounded-lg px-3 py-2 text-xs font-semibold text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
                        >
                          {Object.entries(DIFFUSER_NAMES).map(([k, v]) => (
                            <option key={k} value={k}>{v}</option>
                          ))}
                        </select>
                      </div>
                      
                      <div className="flex flex-col gap-1.5">
                        <label className="text-[11px] font-semibold text-muted-foreground">Total Airflow ({flowUnit})</label>
                        <input
                          type="number"
                          disabled={isApprovedLocked}
                          value={row.airflow}
                          onChange={e => updateRowField('airflow', e.target.value)}
                          className="w-full bg-background border border-border/80 rounded-lg px-3 py-2 text-xs font-mono focus:outline-none focus:ring-1 focus:ring-primary"
                        />
                      </div>

                      <div className="flex flex-col gap-1.5">
                        <label className="text-[11px] font-semibold text-muted-foreground">Diffuser Count</label>
                        <input
                          type="number"
                          min="1"
                          max="50"
                          disabled={isApprovedLocked}
                          value={row.count}
                          onChange={e => updateRowField('count', e.target.value)}
                          className="w-full bg-background border border-border/80 rounded-lg px-3 py-2 text-xs font-mono focus:outline-none focus:ring-1 focus:ring-primary"
                        />
                      </div>

                      <div className="flex flex-col gap-1.5">
                        <label className="text-[11px] font-semibold text-muted-foreground">Sensible Cooling (kW)</label>
                        <input
                          type="number"
                          disabled={isApprovedLocked}
                          value={row.coolingKw}
                          onChange={e => updateRowField('coolingKw', e.target.value)}
                          className="w-full bg-background border border-border/80 rounded-lg px-3 py-2 text-xs font-mono focus:outline-none focus:ring-1 focus:ring-primary"
                          placeholder="Optional for derived airflow"
                        />
                      </div>

                      <div className="flex flex-col gap-1.5">
                        <label className="text-[11px] font-semibold text-muted-foreground">Delta T (°C)</label>
                        <input
                          type="number"
                          disabled={isApprovedLocked}
                          value={row.deltaT}
                          onChange={e => updateRowField('deltaT', e.target.value)}
                          className="w-full bg-background border border-border/80 rounded-lg px-3 py-2 text-xs font-mono focus:outline-none focus:ring-1 focus:ring-primary"
                        />
                      </div>
                      
                      <div className="flex flex-col gap-1.5">
                        <label className="text-[11px] font-semibold text-muted-foreground">Space Name</label>
                        <input
                          type="text"
                          disabled={isApprovedLocked}
                          value={row.name}
                          onChange={e => updateRowField('name', e.target.value)}
                          className="w-full bg-background border border-border/80 rounded-lg px-3 py-2 text-xs font-sans focus:outline-none focus:ring-1 focus:ring-primary"
                        />
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="flex flex-col gap-3 font-sans">
                    {/* Step 1: Thermal Sizing */}
                    <div className="p-3.5 rounded-xl bg-surface-2/70 border border-border/80 flex flex-col gap-1.5">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-bold text-primary flex items-center gap-1.5">
                          <Zap className="size-3.5" /> Step 1: Sensible Cooling Thermal Sizing (Q = m &bull; Cp &bull; Î”T)
                        </span>
                        <span className="text-xs font-mono font-bold text-foreground">
                          {kwVal > 0 ? \`\${kwVal} kW\` : "Direct Airflow Input"}
                        </span>
                      </div>
                      <p className="text-[11px] text-muted-foreground font-mono leading-relaxed">
                        {kwVal > 0
                          ? \`m = \${kwVal} kW Ã· (1.005 kJ/kg&bull;K &times; \${dtVal}°C) = \${(kwVal / (1.005 * (dtVal || 10))).toFixed(3)} kg/s dry air mass flow\`
                          : "Airflow manually entered or transferred from space airflow schedule."}
                      </p>
                    </div>

                    {/* Step 2: Total Volumetric Airflow */}
                    <div className="p-3.5 rounded-xl bg-surface-2/70 border border-border/80 flex flex-col gap-1.5">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-bold text-foreground flex items-center gap-1.5">
                          <Wind className="size-3.5 text-blue-500" /> Step 2: Total Room Supply Airflow Demand (V)
                        </span>
                        <span className="text-sm font-black font-mono text-primary">
                          {flowVal} {flowUnit}
                        </span>
                      </div>
                      <p className="text-[11px] text-muted-foreground font-mono">
                        V_total = {flowVal} {flowUnit} supplied across {countVal} ceiling outlet(s)
                      </p>
                    </div>

                    {/* Step 3: Terminal Airflow & Velocity */}
                    <div className="p-3.5 rounded-xl bg-surface-2/70 border border-border/80 flex flex-col gap-1.5">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-bold text-foreground flex items-center gap-1.5">
                          <Gauge className="size-3.5 text-indigo-500" /> Step 3: Flow per Diffuser & Neck Velocity
                        </span>
                        <span className="text-xs font-mono font-bold text-foreground">
                          {sizing.flowPerDiff.toFixed(1)} {flowUnit} / diffuser
                        </span>
                      </div>
                      <div className="grid grid-cols-3 gap-2 mt-1 pt-2 border-t border-border/60 text-center font-mono">
                        <div>
                          <span className="text-[10px] text-muted-foreground block">RECOMMENDED NECK</span>
                          <span className="text-xs font-bold text-primary">{sizing.neckSize}</span>
                        </div>
                        <div>
                          <span className="text-[10px] text-muted-foreground block">DISCHARGE VELOCITY</span>
                          <span className="text-xs font-bold text-foreground">{ip ? \`\${sizing.velocityFpm.toFixed(0)} FPM\` : \`\${sizing.velocity.toFixed(2)} m/s\`}</span>
                        </div>
                        <div>
                          <span className="text-[10px] text-muted-foreground block">THROW RADIUS (T50)</span>
                          <span className="text-xs font-bold text-foreground">{sizing.throwVal}</span>
                        </div>
                      </div>
                    </div>

                    {/* Step 4: Acoustic & Comfort Compliance */}
                    <div className="p-3.5 rounded-xl bg-surface-2/70 border border-border/80 flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <ShieldCheck className="size-4 text-emerald-500" />
                        <div className="flex flex-col">
                          <span className="text-xs font-bold text-foreground">Acoustic Noise Criteria (NC) & ADPI Comfort</span>
                          <span className="text-[11px] text-muted-foreground">{sizing.adpi}</span>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-black font-mono text-emerald-600 bg-emerald-50 dark:bg-emerald-950/40 px-2 py-0.5 rounded">
                          {sizing.nc}
                        </span>
                        <span className="text-xs font-bold text-emerald-600">PASS</span>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>
          );
        })()}`;

  c = c.substring(0, startIdx) + newModal + c.substring(endIdx);
  fs.writeFileSync(p, c);
  console.log('Done rewriting DetailModal');
} else {
  console.log('Modal start or end not found!');
}
