const fs = require('fs');

const path = 'z:\\00 R&D Server\\04 MISC\\Vikrams  MEP CALCULATOR UPDATED\\vikram_updated_calc\\New Ui MEP\\MEP_Calculator_Project\\frontend\\src\\routes\\fresh-air-cooling-load.tsx';
let content = fs.readFileSync(path, 'utf8');

const startStr = '              {showFormulaPanel && (\\n                <div className="bg-primary/5';
const endStr = '                </div>\\n              )}';

const startIdx = content.indexOf(startStr);
const endIdx = content.indexOf(endStr, startIdx) + endStr.length;

if (startIdx === -1 || endIdx === -1 + endStr.length) {
  console.error("Could not find the block");
  process.exit(1);
}

const newBlock = `              {showFormulaPanel && typeof document !== "undefined" && createPortal(
                <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-[9999] p-4 font-sans animate-fade-in">
                  <div className="bg-card border border-border rounded-2xl w-full max-w-3xl p-6 flex flex-col gap-6 shadow-2xl animate-scale-in relative">
                    <button
                      type="button"
                      onClick={() => setShowFormulaPanel(false)}
                      className="absolute top-4 right-4 p-2 text-muted-foreground hover:bg-muted hover:text-foreground rounded-lg transition-colors cursor-pointer"
                    >
                      <X className="size-5" />
                    </button>
                    
                    <div className="flex items-center gap-3 border-b border-border/60 pb-4">
                      <div className="p-2.5 bg-primary/10 rounded-xl text-primary">
                        <Activity className="size-5" />
                      </div>
                      <h3 className="font-bold text-lg text-foreground">
                        Engineering Psychrometric Calculation Principles
                      </h3>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-5 text-muted-foreground leading-relaxed text-sm">
                      <div className="p-4 bg-slate-50 dark:bg-slate-900/50 rounded-xl border border-border/50 flex flex-col gap-2">
                        <strong className="text-foreground block text-base">1. Sensible Heat Load</strong>
                        <code className="text-xs text-primary font-mono block p-2 bg-primary/5 rounded-lg border border-primary/10">Q_sens = ṁ · c_p · (DB_in - DB_out)</code>
                        <span className="text-xs">Direct temperature drop of incoming outdoor air mass without dehumidification.</span>
                      </div>
                      
                      <div className="p-4 bg-slate-50 dark:bg-slate-900/50 rounded-xl border border-border/50 flex flex-col gap-2">
                        <strong className="text-foreground block text-base">2. Latent Heat Load</strong>
                        <code className="text-xs text-primary font-mono block p-2 bg-primary/5 rounded-lg border border-primary/10">Q_lat = ṁ · (W_in - W_out) · h_fg</code>
                        <span className="text-xs">Moisture extraction via coil condensation using absolute humidity ratio (W).</span>
                      </div>
                      
                      <div className="p-4 bg-slate-50 dark:bg-slate-900/50 rounded-xl border border-border/50 flex flex-col gap-2">
                        <strong className="text-foreground block text-base">3. Coil Capacity (TR)</strong>
                        <code className="text-xs text-primary font-mono block p-2 bg-primary/5 rounded-lg border border-primary/10">Capacity = Q_total(kW) / 3.51685</code>
                        <span className="text-xs">Total cooling duty with user-defined safety margin factored in.</span>
                      </div>
                    </div>
                  </div>
                </div>,
                document.body
              )}`;

content = content.slice(0, startIdx) + newBlock + content.slice(endIdx);
fs.writeFileSync(path, content);
console.log("Replaced successfully!");
