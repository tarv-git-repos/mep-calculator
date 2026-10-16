import React, { useMemo, useState } from "react";
import {
  Sparkles,
  X,
  CheckCircle2,
  AlertTriangle,
  Info,
  Zap,
  Flag,
  Check,
  ChevronDown,
  ChevronUp,
  Lightbulb,
} from "lucide-react";

export interface LpdIntelligenceDrawerProps {
  groups: any[];
  unitSystem?: "si" | "ip";
  authorityMapping?: Record<string, number>;
  onClose: () => void;
  onScrollToSpace: (spaceId: string, groupId?: string) => void;
  onAutoFlagNonCompliant: () => void;
  onClearAllFlags: () => void;
  onAutoFillBaselines: () => void;
  onOpenPreview?: (space: any, groupName?: string) => void;
}

export function LpdIntelligenceDrawer({
  groups,
  unitSystem = "si",
  onClose,
  onScrollToSpace,
  onAutoFlagNonCompliant,
  onClearAllFlags,
  onAutoFillBaselines,
  onOpenPreview,
}: LpdIntelligenceDrawerProps) {
  const [openSections, setOpenSections] = useState<Record<string, boolean>>({
    missingArea: false,
    missingType: false,
    missingBaseline: false,
    zeroWatts: false,
  });

  const toggleSection = (key: string) => {
    setOpenSections((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  const isIp = unitSystem === "ip";

  const allSpaces = useMemo(() => {
    return groups.flatMap((g) =>
      (g.spaces || []).map((s: any) => {
        const totalWatts = (s.fixtures || []).reduce(
          (sum: number, f: any) => sum + (parseFloat(f.watts) || 0) * (parseFloat(f.qty) || 0),
          0
        );
        const rawArea = parseFloat(s.areaSqM) || 0;
        const sqM = isIp ? rawArea / 10.76391 : rawArea;
        const sqF = isIp ? rawArea : rawArea * 10.76391;
        const primaryArea = isIp ? sqF : sqM;
        const proposedLpd = primaryArea > 0 ? totalWatts / primaryArea : 0;
        const baselineLpd = parseFloat(s.baselineLpd) || 0;
        const isCompliant = primaryArea > 0 && baselineLpd > 0 ? proposedLpd <= baselineLpd : null;
        const isExceeding = primaryArea > 0 && baselineLpd > 0 && proposedLpd > baselineLpd;
        const diffLpd = proposedLpd - baselineLpd;

        return {
          ...s,
          groupId: g.id,
          groupName: g.name,
          totalWatts,
          rawArea,
          sqM,
          sqF,
          primaryArea,
          proposedLpd,
          baselineLpd,
          isCompliant,
          isExceeding,
          diffLpd,
        };
      })
    );
  }, [groups, isIp]);

  const totalSpaces = allSpaces.length;
  const evaluatedSpaces = allSpaces.filter((s) => s.primaryArea > 0 && s.baselineLpd > 0);
  const compliantSpaces = evaluatedSpaces.filter((s) => s.isCompliant);
  const nonCompliantSpaces = allSpaces.filter((s) => s.isExceeding);
  const flaggedSpaces = allSpaces.filter((s) => s.flagged);

  const missingAreaSpaces = allSpaces.filter((s) => s.primaryArea <= 0);
  const missingTypeSpaces = allSpaces.filter((s) => !s.areaType || s.areaType.trim() === "");
  const missingBaselineSpaces = allSpaces.filter((s) => s.baselineLpd <= 0);
  const missingWattsSpaces = allSpaces.filter((s) => s.totalWatts <= 0);

  const complianceRate =
    evaluatedSpaces.length > 0
      ? Math.round((compliantSpaces.length / evaluatedSpaces.length) * 100)
      : 100;

  const totalWattsAll = allSpaces.reduce((a, s) => a + s.totalWatts, 0);
  const totalAreaAll = allSpaces.reduce((a, s) => a + s.primaryArea, 0);
  const allowedWattsAll = allSpaces.reduce((a, s) => a + s.primaryArea * s.baselineLpd, 0);
  const avgProposedLpd = totalAreaAll > 0 ? totalWattsAll / totalAreaAll : 0;
  const avgBaselineLpd = totalAreaAll > 0 ? allowedWattsAll / totalAreaAll : 0;
  const wattsDiff = totalWattsAll - allowedWattsAll;
  const pctSavings =
    allowedWattsAll > 0 ? ((allowedWattsAll - totalWattsAll) / allowedWattsAll) * 100 : 0;

  return (
    <div className="h-full w-[360px] flex flex-col animate-fade-in bg-card text-foreground select-none">
      {/* Drawer Header exactly matching Ventilation */}
      <header className="h-11 px-3 flex items-center justify-between border-b border-border shrink-0">
        <div className="flex items-center gap-2">
          <Sparkles className="size-3.5 text-primary" />
          <span className="text-[13px] font-semibold tracking-tight">Intelligence</span>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="size-7 grid place-items-center rounded hover:bg-surface-2 text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
          title="Close Intelligence Drawer"
        >
          <X className="size-3.5" />
        </button>
      </header>

      {/* Drawer Scrollable Body */}
      <div className="flex-1 overflow-y-auto">
        {/* Section 1: Compliance Status */}
        <IntelSection
          icon={CheckCircle2}
          tone={complianceRate >= 100 ? "success" : "warning"}
          title="Compliance Status"
        >
          <div className="text-[12px] text-muted-foreground">
            ASHRAE 90.1 &amp; Local Authority LPD verification across {totalSpaces} spaces.
          </div>
          <div className="mt-2 flex items-center gap-2">
            <div className="flex-1 h-1.5 bg-surface-2 rounded-full overflow-hidden">
              <div
                className={`h-full transition-all duration-500 ${
                  complianceRate >= 100
                    ? "bg-emerald-500"
                    : complianceRate >= 80
                    ? "bg-amber-500"
                    : "bg-red-500"
                }`}
                style={{ width: `${complianceRate}%` }}
              />
            </div>
            <span className="font-mono tabular text-[11.5px] font-semibold">{complianceRate}%</span>
          </div>
          <div className="text-[11.5px] text-muted-foreground border-t border-border/50 pt-2 mt-2 flex justify-between">
            <span>Spaces Compliant:</span>
            <span className="font-mono font-bold text-foreground">
              {compliantSpaces.length}/{evaluatedSpaces.length}
            </span>
          </div>
        </IntelSection>

        {/* Section 2: Energy Balance & Margins */}
        <IntelSection icon={Zap} tone="primary" title="Energy Balance & Margins">
          <KV
            k="Connected Lighting Load"
            v={`${(totalWattsAll / 1000).toFixed(2)} kW (${totalWattsAll.toLocaleString()} W)`}
          />
          <KV
            k="Total Lit Area"
            v={`${totalAreaAll.toFixed(1)} ${isIp ? "sq.ft" : "m²"}`}
          />
          <KV
            k="Area-Weighted LPD"
            v={`${avgProposedLpd.toFixed(2)} ${isIp ? "W/sq.ft" : "W/m²"}`}
          />
          <KV
            k="Baseline Allowance"
            v={`${avgBaselineLpd.toFixed(2)} ${isIp ? "W/sq.ft" : "W/m²"}`}
          />
          <KV
            k="Power Margin"
            v={
              <span
                className={
                  pctSavings >= 0
                    ? "text-emerald-600 dark:text-emerald-400 font-bold"
                    : "text-destructive font-bold"
                }
              >
                {pctSavings >= 0 ? "+" : ""}
                {pctSavings.toFixed(1)}% ({((allowedWattsAll - totalWattsAll) / 1000).toFixed(2)} kW)
              </span>
            }
          />
        </IntelSection>

        {/* Section 3: Non-Compliant Spaces Exceeding Baseline */}
        <IntelSection
          icon={AlertTriangle}
          tone={nonCompliantSpaces.length > 0 ? "warning" : "muted"}
          title="Exceeding Baseline LPD"
        >
          <div className="flex items-center justify-between mb-1.5">
            <span className="text-[11.5px] text-muted-foreground">
              {nonCompliantSpaces.length} space(s) exceeding code allowance
            </span>
            {nonCompliantSpaces.length > 0 && (
              <button
                type="button"
                onClick={onAutoFlagNonCompliant}
                className="text-[10.5px] font-semibold text-primary hover:underline cursor-pointer"
              >
                Flag All
              </button>
            )}
          </div>

          {nonCompliantSpaces.length === 0 ? (
            <div className="text-[12px] text-emerald-600 dark:text-emerald-400 flex items-center gap-1.5 py-1">
              <Check className="size-3.5" /> All evaluated spaces meet LPD baseline limits!
            </div>
          ) : (
            <div className="space-y-1.5 max-h-48 overflow-y-auto pr-1 custom-scrollbar">
              {nonCompliantSpaces.map((s) => (
                <div
                  key={s.id}
                  onClick={() => onScrollToSpace(s.id, s.groupId)}
                  onDoubleClick={() => onOpenPreview?.(s, s.groupName)}
                  className="p-2 rounded-lg bg-surface-2 hover:bg-surface-3 border border-border/60 transition-colors cursor-pointer text-[12px] group/item"
                  title="Click to locate. Double-click to preview calculation."
                >
                  <div className="flex items-center justify-between">
                    <span className="font-semibold text-foreground truncate max-w-[160px]">
                      {s.name || "Unnamed Space"}
                    </span>
                    <div className="flex items-center gap-1.5">
                      {onOpenPreview && (
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            onOpenPreview(s, s.groupName);
                          }}
                          className="opacity-0 group-hover/item:opacity-100 p-0.5 rounded hover:bg-primary/10 text-primary transition-opacity cursor-pointer"
                          title="Preview calculation"
                        >
                          <Sparkles className="size-3" />
                        </button>
                      )}
                      <span className="text-[10px] font-mono text-muted-foreground uppercase">
                        {s.groupName}
                      </span>
                    </div>
                  </div>
                  <div className="flex items-center justify-between mt-1 text-[11px] font-mono">
                    <span className="text-destructive font-bold">
                      {s.proposedLpd.toFixed(2)} {isIp ? "W/sq.ft" : "W/m²"}
                    </span>
                    <span className="text-muted-foreground">Baseline: {s.baselineLpd.toFixed(2)}</span>
                    <span className="text-destructive font-bold">+{s.diffLpd.toFixed(2)}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </IntelSection>

        {/* Section 4: Flagged Spaces */}
        <IntelSection
          icon={Flag}
          tone={flaggedSpaces.length > 0 ? "warning" : "muted"}
          title="Flagged Spaces"
        >
          <div className="flex items-center justify-between mb-1.5">
            <span className="text-[11.5px] text-muted-foreground">
              {flaggedSpaces.length} space(s) flagged for review
            </span>
            {flaggedSpaces.length > 0 && (
              <button
                type="button"
                onClick={onClearAllFlags}
                className="text-[10.5px] font-semibold text-muted-foreground hover:text-destructive cursor-pointer"
              >
                Clear All
              </button>
            )}
          </div>

          {flaggedSpaces.length === 0 ? (
            <div className="text-[12px] text-muted-foreground py-1">No spaces currently flagged.</div>
          ) : (
            <div className="space-y-1.5 max-h-40 overflow-y-auto pr-1 custom-scrollbar">
              {flaggedSpaces.map((s) => (
                <div
                  key={s.id}
                  onClick={() => onScrollToSpace(s.id, s.groupId)}
                  onDoubleClick={() => onOpenPreview?.(s, s.groupName)}
                  className="p-2 rounded-lg bg-surface-2 hover:bg-surface-3 border border-border/60 transition-colors cursor-pointer text-[12px] flex items-center justify-between group/item"
                  title="Click to locate. Double-click to preview calculation."
                >
                  <div className="truncate max-w-[190px]">
                    <span className="font-semibold text-foreground">{s.name || "Unnamed Space"}</span>
                    <div className="text-[10.5px] text-muted-foreground">{s.groupName}</div>
                  </div>
                  <div className="flex items-center gap-1.5">
                    {onOpenPreview && (
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          onOpenPreview(s, s.groupName);
                        }}
                        className="opacity-0 group-hover/item:opacity-100 p-0.5 rounded hover:bg-primary/10 text-primary transition-opacity cursor-pointer"
                        title="Preview calculation"
                      >
                        <Sparkles className="size-3" />
                      </button>
                    )}
                    <Flag className="size-3.5 fill-red-500 text-red-500 shrink-0" />
                  </div>
                </div>
              ))}
            </div>
          )}
        </IntelSection>

        {/* Section 5: Missing Data & Audit */}
        <IntelSection
          icon={Info}
          tone={
            missingAreaSpaces.length +
              missingTypeSpaces.length +
              missingBaselineSpaces.length +
              missingWattsSpaces.length >
            0
              ? "warning"
              : "muted"
          }
          title="Missing Data & Audit"
        >
          <CollapsibleMissingSection
            label="Missing Area (0 area)"
            count={missingAreaSpaces.length}
            itemsList={missingAreaSpaces.map((s) => ({
              id: s.id,
              name: s.name || "Unnamed Space",
              detail: s.groupName || "Floor",
            }))}
            isOpen={openSections.missingArea}
            onToggle={() => toggleSection("missingArea")}
            onItemClick={(id) => onScrollToSpace(id)}
          />

          <CollapsibleMissingSection
            label="Missing Space Type"
            count={missingTypeSpaces.length}
            itemsList={missingTypeSpaces.map((s) => ({
              id: s.id,
              name: s.name || "Unnamed Space",
              detail: `${s.primaryArea} ${isIp ? "sq.ft" : "m²"}`,
            }))}
            isOpen={openSections.missingType}
            onToggle={() => toggleSection("missingType")}
            onItemClick={(id) => onScrollToSpace(id)}
          />

          <div className="flex items-center justify-between">
            <div className="flex-1">
              <CollapsibleMissingSection
                label="No Baseline LPD"
                count={missingBaselineSpaces.length}
                itemsList={missingBaselineSpaces.map((s) => ({
                  id: s.id,
                  name: s.name || "Unnamed Space",
                  detail: s.areaType || "Unclassified",
                }))}
                isOpen={openSections.missingBaseline}
                onToggle={() => toggleSection("missingBaseline")}
                onItemClick={(id) => onScrollToSpace(id)}
              />
            </div>
            {missingBaselineSpaces.length > 0 && (
              <button
                type="button"
                onClick={onAutoFillBaselines}
                className="text-[10.5px] font-semibold text-primary hover:underline cursor-pointer shrink-0 ml-2"
                title="Auto-fill standard ASHRAE baselines"
              >
                Auto-Fill
              </button>
            )}
          </div>

          <CollapsibleMissingSection
            label="Zero Wattage / Fixtures"
            count={missingWattsSpaces.length}
            itemsList={missingWattsSpaces.map((s) => ({
              id: s.id,
              name: s.name || "Unnamed Space",
              detail: `${s.primaryArea} ${isIp ? "sq.ft" : "m²"}`,
            }))}
            isOpen={openSections.zeroWatts}
            onToggle={() => toggleSection("zeroWatts")}
            onItemClick={(id) => onScrollToSpace(id)}
          />
        </IntelSection>

        {/* Section 6: Optimization Suggestions */}
        <IntelSection icon={Sparkles} tone="primary" title="Optimization Suggestions">
          <ul className="text-[12px] text-muted-foreground space-y-1.5 list-disc pl-4">
            <li>
              Spaces exceeding baseline LPD by &gt;15% can achieve full compliance by retrofitting to 10W–15W LED luminaires.
            </li>
            <li>
              Implement automatic occupancy sensing and daylight harvesting to qualify for ASHRAE 90.1 control credits.
            </li>
            <li>
              Group common circulation corridors and rest rooms on unified baseline standards for consistent regulatory review.
            </li>
          </ul>
        </IntelSection>

        {/* Section 7: Engineering Standards Notes */}
        <IntelSection icon={Info} tone="muted" title="Engineering Standards Notes">
          <div className="text-[11.5px] text-muted-foreground space-y-1">
            <p><strong>ASHRAE 90.1:</strong> Energy Standard for Buildings Except Low-Rise Residential Buildings (Space-by-Space Method).</p>
            <p><strong>Dubai Al Sa'fat:</strong> Dubai Green Building System mandatory LPD energy compliance thresholds.</p>
            <p><strong>Saudi SBC 601:</strong> Saudi Building Code for Energy Conservation.</p>
          </div>
        </IntelSection>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Shared Subcomponents matching Ventilation exactly
// ─────────────────────────────────────────────────────────────────────────────

function IntelSection({
  icon: Icon,
  title,
  tone,
  children,
}: {
  icon: any;
  title: string;
  tone: "success" | "warning" | "primary" | "muted";
  children: React.ReactNode;
}) {
  const color =
    tone === "success"
      ? "text-emerald-500"
      : tone === "warning"
      ? "text-amber-500"
      : tone === "primary"
      ? "text-primary"
      : "text-muted-foreground";

  return (
    <section className="px-3 py-3 border-b border-border last:border-b-0">
      <div className="flex items-center gap-2 mb-2">
        <Icon className={`size-3.5 ${color}`} />
        <h4 className="text-[11px] uppercase tracking-wider font-semibold">{title}</h4>
      </div>
      {children}
    </section>
  );
}

function KV({ k, v }: { k: string; v: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between text-[12px] py-0.5">
      <span className="text-muted-foreground">{k}</span>
      <span className="font-mono tabular font-medium">{v}</span>
    </div>
  );
}

function CollapsibleMissingSection({
  label,
  count,
  itemsList,
  isOpen,
  onToggle,
  onItemClick,
}: {
  label: string;
  count: number;
  itemsList: { id: string; name: string; detail: string }[];
  isOpen: boolean;
  onToggle: () => void;
  onItemClick: (id: string) => void;
}) {
  return (
    <div className="border-b border-border/40 last:border-b-0 py-1.5">
      <button
        type="button"
        onClick={onToggle}
        className="w-full flex items-center justify-between text-[12.5px] font-medium text-foreground/90 hover:text-foreground transition-colors cursor-pointer select-none py-0.5"
      >
        <span className="flex items-center gap-1.5">
          <span>{label}</span>
          {isOpen ? (
            <ChevronUp className="size-3 text-muted-foreground" />
          ) : (
            <ChevronDown className="size-3 text-muted-foreground" />
          )}
        </span>
        <span className="font-mono tabular font-semibold text-foreground/80">{count}</span>
      </button>

      {isOpen && count > 0 && (
        <div className="mt-1.5 max-h-36 overflow-y-auto border border-border/60 rounded-md bg-surface-2 divide-y divide-border/40 font-mono text-[10.5px] text-muted-foreground custom-scrollbar">
          {itemsList.map((item) => (
            <button
              type="button"
              key={item.id}
              onClick={() => onItemClick(item.id)}
              className="block w-full px-2.5 py-1.5 hover:bg-surface-3 transition-colors text-left cursor-pointer select-none"
            >
              <div className="text-[11.5px] leading-relaxed whitespace-nowrap overflow-hidden text-ellipsis block">
                <span className="font-sans font-medium text-foreground/80 hover:text-primary transition-colors">
                  {item.name}
                </span>
                <span className="text-muted-foreground/50 text-[10px] font-mono ml-1.5">
                  ({item.detail})
                </span>
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
