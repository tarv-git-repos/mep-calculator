const fs = require('fs');
const file = 'frontend/src/routes/liftwell-pressurization.tsx';
let data = fs.readFileSync(file, 'utf8');

// 1. Remove handleExportExcel function
data = data.replace(
  /const handleExportExcel = async \(\) => \{[\s\S]*?catch \(err\) \{[\s\S]*?toast\.error\("Failed to export Excel"\);\n    \}\n  \};\n\n  const handleExportPdf/,
  'const handleExportPdf'
);

// 2. Change the header JSX to move Review Bar to the left and remove Excel button
data = data.replace(
  /        <div className="flex items-center justify-between p-4 bg-white border-b border-border shadow-sm shrink-0">[\s\S]*?<\/div>\n        <\/div>/,
  `        <div className="flex items-center justify-between p-4 bg-white border-b border-border shadow-sm shrink-0">
          <div className="flex items-center gap-3">
            <div>
              <h1 className="text-xl font-bold text-slate-900">Liftwell Pressurization</h1>
              <p className="text-xs text-muted-foreground mt-0.5">Horizontal Data Entry (Multiple Liftwells)</p>
            </div>
            <CalculationReviewBar projectId={project?.id || "default"} calculatorPath="/liftwell-pressurization" calculatorTitle="Liftwell Pressurization" />
          </div>
          <div className="flex items-center gap-2">
            <button onClick={handleExportPdf} className="flex items-center gap-1.5 px-4 py-1.5 text-xs font-bold rounded-full bg-[#0A7BC7] text-white hover:bg-[#0866A5] transition shadow-xs cursor-pointer">
              <FileText className="size-3.5" /> Export PDF
            </button>
          </div>
        </div>`
);

fs.writeFileSync(file, data, 'utf8');
