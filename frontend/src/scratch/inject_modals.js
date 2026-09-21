const fs = require('fs');
const path = 'z:/00 R&D Server/04 MISC/Vikrams  MEP CALCULATOR UPDATED/vikram_updated_calc/New Ui MEP/MEP_Calculator_Project/frontend/src/routes/plumbing-sump-pump.tsx';

let content = fs.readFileSync(path, 'utf8');

// 1. Add state for the modals
if (!content.includes('const [formulaModalOpen, setFormulaModalOpen] = useState(false);')) {
  content = content.replace(
    'const [commentModalOpen, setCommentModalOpen] = useState(false);',
    'const [commentModalOpen, setCommentModalOpen] = useState(false);\n  const [formulaModalOpen, setFormulaModalOpen] = useState(false);\n  const [previewModalOpen, setPreviewModalOpen] = useState(false);'
  );
}

// 2. Add Formula Breakdown button in header
if (!content.includes('setFormulaModalOpen(true)')) {
  content = content.replace(
    '<div className="flex items-center gap-2 select-none shrink-0">\n                <TBtn onClick={handleExport}>',
    `<div className="flex items-center gap-2 select-none shrink-0">
                <button
                  type="button"
                  onClick={() => setFormulaModalOpen(true)}
                  className="px-3 py-1.5 text-xs font-semibold rounded-full transition-all duration-150 cursor-pointer bg-surface-2 hover:bg-surface border border-border/80 text-muted-foreground hover:text-foreground inline-flex items-center gap-1.5 shadow-2xs"
                  title="View Formulas"
                >
                  <Info className="size-3.5 text-primary" />
                  <span>Formula Breakdown</span>
                </button>
                <div className="h-4 w-px bg-border/80 mx-1 hidden sm:block" />
                <TBtn onClick={handleExport}>`
  );
}

// 3. Add Calculation Preview button in Results Header
if (!content.includes('setPreviewModalOpen(true)')) {
  content = content.replace(
    '<p className="text-xs text-muted-foreground font-medium">Auto-calculated pump duty point and volume requirements</p>\n                          </div>\n                        </div>',
    `<p className="text-xs text-muted-foreground font-medium">Auto-calculated pump duty point and volume requirements</p>
                          </div>
                        </div>
                        
                        <div className="flex justify-end mb-4">
                          <button
                            type="button"
                            onClick={() => setPreviewModalOpen(true)}
                            className="text-xs font-semibold px-3 py-1.5 bg-primary/10 text-primary hover:bg-primary/20 transition-colors rounded-lg flex items-center gap-1.5"
                          >
                            <Activity className="size-3.5" />
                            Calculation Preview
                          </button>
                        </div>`
  );
}

// 4. Add the modals at the end of the file
const modalsCode = `

// Mathematical Formula Breakdown Modal
function SumpPumpFormulaModal({
  onClose,
}: { onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-50 bg-background/80 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-card border border-border rounded-2xl max-w-2xl w-full max-h-[90vh] flex flex-col shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-200">
        
        {/* Header */}
        <div className="p-4 border-b border-border flex items-center justify-between bg-primary/5">
          <div className="flex items-center gap-2">
            <FileText className="size-5 text-primary" />
            <div>
              <h3 className="text-base font-bold text-foreground">Sump Pump Mathematical Equations</h3>
              <p className="text-xs text-muted-foreground">Standard formulas applied in dynamic head, storage volume & power sizing</p>
            </div>
          </div>
          <button onClick={onClose} className="p-1 rounded-lg hover:bg-muted text-muted-foreground hover:text-foreground cursor-pointer">
            <X className="size-5" />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto custom-scrollbar p-6 space-y-6 text-xs text-foreground">
          
          {/* Equation 1: Flow Rate */}
          <div className="p-4 rounded-xl border border-border bg-muted/20 space-y-2">
            <span className="font-bold text-primary uppercase tracking-wider text-[11px]">1. Flow Rate (Q)</span>
            <div className="p-2.5 bg-background rounded-lg font-mono font-bold text-foreground text-center border border-border">
              Q = Pit Volume / Drawdown Time
            </div>
            <p className="text-muted-foreground text-[11.5px]">
              The required flow rate is derived from the volumetric requirement divided by the intended drawdown time.
            </p>
          </div>

          {/* Equation 2: Friction Loss */}
          <div className="p-4 rounded-xl border border-border bg-muted/20 space-y-2">
            <span className="font-bold text-primary uppercase tracking-wider text-[11px]">2. Friction Loss (H_loss)</span>
            <div className="p-2.5 bg-background rounded-lg font-mono font-bold text-foreground text-center border border-border">
              H_loss = L_equiv × (Friction Factor / 100)
            </div>
            <p className="text-muted-foreground text-[11.5px]">
              Calculated using standard friction tables per 100 ft (or 100 m) of pipe, multiplied by the total equivalent length (including vertical, horizontal, and fittings).
            </p>
          </div>

          {/* Equation 3: Total Dynamic Head */}
          <div className="p-4 rounded-xl border border-border bg-muted/20 space-y-2">
            <span className="font-bold text-primary uppercase tracking-wider text-[11px]">3. Total Dynamic Head (TDH)</span>
            <div className="p-2.5 bg-background rounded-lg font-mono font-bold text-foreground text-center border border-border">
              TDH = Static Head + Friction Loss + Residual Pressure + Suction Head + Safety Factor
            </div>
            <p className="text-muted-foreground text-[11.5px]">
              TDH represents the total equivalent height that a fluid is to be pumped, taking into account friction losses in the pipe and the residual pressure required at the discharge.
            </p>
          </div>

          {/* Equation 4: Motor Power */}
          <div className="p-4 rounded-xl border border-border bg-muted/20 space-y-2">
            <span className="font-bold text-primary uppercase tracking-wider text-[11px]">4. Motor Power (HP)</span>
            <div className="p-2.5 bg-background rounded-lg font-mono font-bold text-foreground text-center border border-border">
              HP = (Q × TDH × SG) / (3960 × Pump Efficiency × Motor Efficiency)
            </div>
            <p className="text-muted-foreground text-[11.5px]">
              Standard pump power equation where SG is Specific Gravity (typically 1.0 for water/sewage).
            </p>
          </div>
          
        </div>
      </div>
    </div>
  );
}

// Calculation Preview Modal
function SumpPumpPreviewModal({
  onClose,
  calcResults,
  unitSystem
}: { 
  onClose: () => void;
  calcResults: any;
  unitSystem: "ip" | "si";
}) {
  const isSI = unitSystem === "si";
  const GPM_TO_LPS = 0.06309;
  const PSI_TO_BAR = 0.0689476;
  const FT_TO_M = 0.3048;

  const flow = isSI ? calcResults.Q_flow : calcResults.Q_flow / GPM_TO_LPS;
  const flowUnit = isSI ? "L/s" : "GPM";
  
  const tdh = isSI ? calcResults.H_pump_calc : calcResults.H_pump_calc / PSI_TO_BAR;
  const tdhUnit = isSI ? "bar" : "psi";

  const headLoss = isSI ? calcResults.H_loss : calcResults.H_loss / PSI_TO_BAR;
  const equivLength = isSI ? calcResults.L_equiv : calcResults.L_equiv / FT_TO_M;
  const lengthUnit = isSI ? "m" : "ft";

  const hp = calcResults.HP;
  const kw = calcResults.P_motor;

  return (
    <div className="fixed inset-0 z-50 bg-background/80 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-card border border-border rounded-2xl max-w-2xl w-full max-h-[90vh] flex flex-col shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-200">
        
        {/* Header */}
        <div className="p-4 border-b border-border flex items-center justify-between bg-primary/5">
          <div className="flex items-center gap-2">
            <Activity className="size-5 text-primary" />
            <div>
              <h3 className="text-base font-bold text-foreground">Calculation Preview</h3>
              <p className="text-xs text-muted-foreground">Step-by-step breakdown of your current results</p>
            </div>
          </div>
          <button onClick={onClose} className="p-1 rounded-lg hover:bg-muted text-muted-foreground hover:text-foreground cursor-pointer">
            <X className="size-5" />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto custom-scrollbar p-6 space-y-6 text-xs text-foreground font-mono">
          
          <div className="space-y-4">
            <div className="border-b border-border pb-2">
              <span className="font-bold text-primary">1. PUMP DUTY FLOW</span>
            </div>
            <div className="flex flex-col gap-1 pl-4">
              <span className="text-muted-foreground">Calculated Flow Rate = {flow.toFixed(2)} {flowUnit}</span>
            </div>
          </div>

          <div className="space-y-4">
            <div className="border-b border-border pb-2">
              <span className="font-bold text-primary">2. FRICTION LOSS</span>
            </div>
            <div className="flex flex-col gap-1 pl-4">
              <span className="text-muted-foreground">Total Equivalent Length (L_equiv) = {equivLength.toFixed(2)} {lengthUnit}</span>
              <span className="text-muted-foreground">Friction Loss (H_loss) = L_equiv × Friction Factor / 100</span>
              <span className="text-foreground font-bold mt-1">H_loss = {headLoss.toFixed(3)} {tdhUnit}</span>
            </div>
          </div>

          <div className="space-y-4">
            <div className="border-b border-border pb-2">
              <span className="font-bold text-primary">3. TOTAL DYNAMIC HEAD (TDH)</span>
            </div>
            <div className="flex flex-col gap-1 pl-4">
              <span className="text-muted-foreground">TDH = Static Head + Friction Loss + Residual + Suction + Safety Factor</span>
              <span className="text-foreground font-bold mt-1">TDH = {tdh.toFixed(3)} {tdhUnit}</span>
            </div>
          </div>

          <div className="space-y-4">
            <div className="border-b border-border pb-2">
              <span className="font-bold text-primary">4. MOTOR POWER</span>
            </div>
            <div className="flex flex-col gap-1 pl-4">
              <span className="text-muted-foreground">Mechanical Power (HP) = {hp.toFixed(2)} HP</span>
              <span className="text-foreground font-bold mt-1">Electrical Power = {kw.toFixed(2)} kW</span>
            </div>
          </div>
          
        </div>
      </div>
    </div>
  );
}
`;

if (!content.includes('SumpPumpFormulaModal')) {
  content = content + modalsCode;
}

// 5. Render Modals in JSX
if (!content.includes('formulaModalOpen &&')) {
  content = content.replace(
    '<AssignCommentModal',
    `{formulaModalOpen && (
        <SumpPumpFormulaModal onClose={() => setFormulaModalOpen(false)} />
      )}
      
      {previewModalOpen && (
        <SumpPumpPreviewModal 
          onClose={() => setPreviewModalOpen(false)} 
          calcResults={calcResults}
          unitSystem={unitSystem}
        />
      )}
      
      <AssignCommentModal`
  );
}

fs.writeFileSync(path, content, 'utf8');
console.log('Successfully injected modals and buttons!');
