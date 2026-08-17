import { createFileRoute } from "@tanstack/react-router";
import { FileText, Download } from "lucide-react";
import { AppShell } from "@/components/workspace/AppShell";
import { TBtn } from "@/components/workspace/Button";

export const Route = createFileRoute("/reports")({
  head: () => ({
    meta: [
      { title: "Reports — Airflow" },
      { name: "description", content: "Generate compliance reports and engineering documentation." },
    ],
  }),
  component: ReportsPage,
});

const REPORTS = [
  { name: "ASHRAE 62.1 Compliance", desc: "Ventilation rates per occupiable space, by zone and system.", date: "Updated 2h ago" },
  { name: "Pressure Balance Report", desc: "Building-wide pressure differentials and balance analysis.", date: "Updated 1d ago" },
  { name: "Equipment Schedule", desc: "AHU, EAF, and exhaust equipment schedule with capacities.", date: "Updated 3d ago" },
  { name: "Zone Airflow Summary", desc: "Fresh and extract air totals per zone, building, and floor.", date: "Updated 2h ago" },
  { name: "Spaces Without Equipment", desc: "Audit of spaces missing equipment assignment.", date: "Live" },
  { name: "Full Project Calculation Sheet", desc: "Complete engineering documentation for handover.", date: "Updated 5d ago" },
];

function ReportsPage() {
  return (
    <AppShell title="Reports" subtitle="6 templates" actions={<TBtn primary><FileText className="size-3.5" /> New Report</TBtn>}>
      <div className="p-6 overflow-auto h-full">
        <div className="grid grid-cols-2 gap-3 max-w-5xl">
          {REPORTS.map((r) => (
            <div key={r.name} className="border border-border rounded p-4 hover:border-border-strong hover:shadow-sm transition-all bg-background">
              <div className="flex items-start justify-between">
                <FileText className="size-4 text-primary mt-0.5" />
                <span className="text-[10.5px] text-muted-foreground uppercase tracking-wider">{r.date}</span>
              </div>
              <h3 className="mt-3 text-[13.5px] font-semibold">{r.name}</h3>
              <p className="mt-1 text-[12px] text-muted-foreground leading-relaxed">{r.desc}</p>
              <div className="mt-3 flex gap-1.5">
                <TBtn><Download className="size-3" /> PDF</TBtn>
                <TBtn>Generate</TBtn>
              </div>
            </div>
          ))}
        </div>
      </div>
    </AppShell>
  );
}