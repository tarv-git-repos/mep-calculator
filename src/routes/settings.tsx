import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { AppShell } from "@/components/workspace/AppShell";
import { TBtn } from "@/components/workspace/Button";
import { Settings, Save, CheckCircle2, RotateCcw } from "lucide-react";

export const Route = createFileRoute("/settings")({
  head: () => ({
    meta: [
      { title: "Settings — MEP Calc" },
      { name: "description", content: "Configure calculation standards, default safety factor multipliers, and unit systems." },
    ],
  }),
  component: SettingsPage,
});

function SettingsPage() {
  const [savedSuccess, setSavedSuccess] = useState(false);
  const [standard, setStandard] = useState("ASHRAE 62.1 - 2022");
  const [flowUnit, setFlowUnit] = useState("L/s");
  const [tempUnit, setTempUnit] = useState("C");
  const [chwDeltaT, setChwDeltaT] = useState(5.5);
  const [safetyMargin, setSafetyMargin] = useState(10);

  const handleSave = () => {
    setSavedSuccess(true);
    setTimeout(() => setSavedSuccess(false), 3000);
  };

  return (
    <AppShell title="Settings" subtitle="Workspace calculation defaults">
      <div className="p-6 overflow-y-auto h-full bg-surface/30">
        <div className="max-w-xl mx-auto border border-border bg-background rounded p-6 shadow-sm flex flex-col gap-6">
          
          <div className="flex items-center gap-2 border-b border-border pb-3">
            <Settings className="size-4.5 text-primary" />
            <h3 className="text-[14px] font-bold uppercase tracking-wider text-foreground">Global Calculations Engine Rules</h3>
          </div>

          {/* Standard configuration */}
          <div className="flex flex-col gap-1.5">
            <label className="text-[13px] font-semibold text-foreground">Default Ventilation Standard</label>
            <select
              value={standard}
              onChange={(e) => setStandard(e.target.value)}
              className="bg-surface border border-border focus:border-primary rounded px-3 py-2 text-[13px] outline-none"
            >
              <option value="ASHRAE 62.1 - 2022">ASHRAE 62.1 - 2022 (Ventilation for Acceptable IAQ)</option>
              <option value="ASHRAE 62.1 - 2019">ASHRAE 62.1 - 2019</option>
              <option value="BS EN 16798-1">BS EN 16798-1:2019 (Indoor environmental input parameters)</option>
              <option value="CIBSE Guide A">CIBSE Guide A (Environmental design基準)</option>
            </select>
            <span className="text-[11.5px] text-muted-foreground leading-normal">
              Selects target ventilation rates calculations table (per person and area floor factors).
            </span>
          </div>

          <div className="grid grid-cols-2 gap-4">
            {/* Flow rates unit */}
            <div className="flex flex-col gap-1.5">
              <label className="text-[13px] font-semibold text-foreground">Airflow Flowrate Unit</label>
              <select
                value={flowUnit}
                onChange={(e) => setFlowUnit(e.target.value)}
                className="bg-surface border border-border focus:border-primary rounded px-3 py-2 text-[13px] outline-none"
              >
                <option value="L/s">Litres per second (L/s)</option>
                <option value="m3h">Cubic meters per hour (m³/hr)</option>
                <option value="cfm">Cubic feet per minute (CFM)</option>
              </select>
            </div>

            {/* Temperature unit */}
            <div className="flex flex-col gap-1.5">
              <label className="text-[13px] font-semibold text-foreground">Temperature Unit</label>
              <select
                value={tempUnit}
                onChange={(e) => setTempUnit(e.target.value)}
                className="bg-surface border border-border focus:border-primary rounded px-3 py-2 text-[13px] outline-none"
              >
                <option value="C">Celsius (°C)</option>
                <option value="F">Fahrenheit (°F)</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            {/* Chilled Water Delta T */}
            <div className="flex flex-col gap-1.5">
              <label className="text-[13px] font-semibold text-foreground">CHW Delta T (K)</label>
              <input
                type="number"
                step="0.1"
                min="3.0"
                max="12.0"
                value={chwDeltaT}
                onChange={(e) => setChwDeltaT(Number(e.target.value))}
                className="bg-surface border border-border focus:border-primary rounded px-3 py-1.5 text-[13px] outline-none font-mono"
              />
              <span className="text-[11px] text-muted-foreground">Used for CHW pipe flow calculations.</span>
            </div>

            {/* Safety factor margin */}
            <div className="flex flex-col gap-1.5">
              <label className="text-[13px] font-semibold text-foreground">Design Safety Margin (%)</label>
              <input
                type="number"
                min="0"
                max="50"
                value={safetyMargin}
                onChange={(e) => setSafetyMargin(Number(e.target.value))}
                className="bg-surface border border-border focus:border-primary rounded px-3 py-1.5 text-[13px] outline-none font-mono"
              />
              <span className="text-[11px] text-muted-foreground">Applies general capacity markup.</span>
            </div>
          </div>

          {savedSuccess && (
            <div className="flex items-center gap-2 p-3 bg-success/10 border border-success/20 text-success rounded text-[12.5px] font-medium">
              <CheckCircle2 className="size-4" />
              Settings updated successfully in current workspace.
            </div>
          )}

          <div className="flex gap-2.5 justify-end border-t border-border pt-4 mt-2">
            <TBtn className="px-4"><RotateCcw className="size-3.5" /> Revert Defaults</TBtn>
            <TBtn primary onClick={handleSave} className="px-4"><Save className="size-3.5" /> Save settings</TBtn>
          </div>

        </div>
      </div>
    </AppShell>
  );
}
