const fs = require('fs');

const path = 'src/routes/heating-load.tsx';
let txt = fs.readFileSync(path, 'utf8');

const startStr = '{/* Formula Breakdown Modal */}';
const startIdx = txt.indexOf(startStr);
const endStr = '{/* Custom Heating Profile Configuration Modal */}';
const endIdx = txt.indexOf(endStr);

if (startIdx !== -1 && endIdx !== -1) {
    const replacement = `{/* Formula Breakdown Modal */}
      {formulaModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-200">
          <div className="bg-white dark:bg-zinc-950 border border-slate-200 dark:border-zinc-800 rounded-2xl shadow-2xl max-w-2xl w-full overflow-hidden flex flex-col">
            
            {/* Header */}
            <div className="flex items-center justify-between p-5 border-b border-slate-100 dark:border-zinc-800/60 bg-slate-50/50 dark:bg-zinc-900/20">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-xl bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400">
                  <Info className="size-5" />
                </div>
                <div>
                  <h3 className="font-bold text-foreground text-sm tracking-wide">
                    ASHRAE Steady-State Heating Equations
                  </h3>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Governing thermal conduction and air heating formulas
                  </p>
                </div>
              </div>
              <button
                onClick={() => setFormulaModalOpen(false)}
                className="p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-zinc-800 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 transition-colors cursor-pointer"
              >
                <X className="size-4" />
              </button>
            </div>

            {/* Clean List Content */}
            <div className="p-6 space-y-7 overflow-y-auto max-h-[60vh] custom-scrollbar">
              
              <div className="space-y-2.5">
                <div className="font-bold text-slate-700 dark:text-slate-200 text-sm flex items-center gap-2">
                  <span className="flex items-center justify-center w-5 h-5 rounded-full bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-400 text-[10px]">1</span>
                  Envelope Conduction Heat Loss
                </div>
                <div className="font-mono font-medium text-slate-800 dark:text-slate-300 text-[13px] bg-slate-50 dark:bg-zinc-900/50 py-2.5 px-3.5 rounded-lg border-l-2 border-blue-400 dark:border-blue-500/50">
                  Q_cond = U × A × (T_in - T_out)
                </div>
                <p className="text-[11.5px] leading-relaxed text-slate-500 dark:text-zinc-400 pl-1">
                  Where <span className="font-mono text-slate-700 dark:text-slate-300">U</span> is the thermal transmittance (U-value), <span className="font-mono text-slate-700 dark:text-slate-300">A</span> is the net surface area, and <span className="font-mono text-slate-700 dark:text-slate-300">(T_in - T_out)</span> is the winter design temperature differential (ΔT).
                </p>
              </div>

              <div className="space-y-2.5">
                <div className="font-bold text-slate-700 dark:text-slate-200 text-sm flex items-center gap-2">
                  <span className="flex items-center justify-center w-5 h-5 rounded-full bg-emerald-100 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-400 text-[10px]">2</span>
                  Infiltration & Ventilation (Sensible)
                </div>
                <div className="font-mono font-medium text-slate-800 dark:text-slate-300 text-[13px] bg-slate-50 dark:bg-zinc-900/50 py-2.5 px-3.5 rounded-lg border-l-2 border-emerald-400 dark:border-emerald-500/50 space-y-1">
                  <div>Q_air = 1.08 × CFM × (T_in - T_out) <span className="text-slate-400 dark:text-zinc-500 text-[10px] ml-2">// IP</span></div>
                  <div>Q_air = 1.20 × L/s × (T_in - T_out) <span className="text-slate-400 dark:text-zinc-500 text-[10px] ml-2">// SI (Watts)</span></div>
                </div>
                <p className="text-[11.5px] leading-relaxed text-slate-500 dark:text-zinc-400 pl-1">
                  The constant <span className="font-mono text-slate-700 dark:text-slate-300">1.08</span> represents standard air density multiplied by the specific heat of air and time conversion.
                </p>
              </div>

              <div className="space-y-2.5">
                <div className="font-bold text-slate-700 dark:text-slate-200 text-sm flex items-center gap-2">
                  <span className="flex items-center justify-center w-5 h-5 rounded-full bg-purple-100 dark:bg-purple-900/40 text-purple-700 dark:text-purple-400 text-[10px]">3</span>
                  Total Sized Plant Capacity
                </div>
                <div className="font-mono font-medium text-slate-800 dark:text-slate-300 text-[13px] bg-slate-50 dark:bg-zinc-900/50 py-2.5 px-3.5 rounded-lg border-l-2 border-purple-400 dark:border-purple-500/50">
                  Q_total = (Q_cond + Q_air) × (1 + Safety Margin)
                </div>
                <p className="text-[11.5px] leading-relaxed text-slate-500 dark:text-zinc-400 pl-1">
                  The safety margin accounts for morning warm-up recovery (pick-up load) after a night setback and cold-start thermal mass acceleration.
                </p>
              </div>

            </div>

            {/* Footer */}
            <div className="p-4 border-t border-slate-100 dark:border-zinc-800/60 bg-slate-50/50 dark:bg-zinc-900/20 flex justify-end">
              <button
                onClick={() => setFormulaModalOpen(false)}
                className="px-5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 dark:bg-slate-200 dark:hover:bg-white text-white dark:text-slate-900 text-xs font-bold transition-all cursor-pointer shadow-sm"
              >
                Close Breakdown
              </button>
            </div>
          </div>
        </div>
      )}

      `;
    
    txt = txt.substring(0, startIdx) + replacement + txt.substring(endIdx);
    fs.writeFileSync(path, txt);
    console.log("Done");
}
