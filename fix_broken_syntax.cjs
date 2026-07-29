const fs = require('fs');

const filesToFix = [
    {
        path: 'src/routes/chw-pipe-sizer.tsx',
        search: 'downloadFile(new Uint8Array(pdfBuffer), `${projectInfo.projectName.replace(/\\s+/g, "_", "PDF Document", ["pdf"]);}_report.pdf`);',
        replace: 'downloadFile(new Uint8Array(pdfBuffer), `${projectInfo.projectName.replace(/\\s+/g, "_")}_report.pdf`, "PDF Document", ["pdf"]);'
    },
    {
        path: 'src/routes/chw-pump-head.tsx',
        search: 'downloadFile(new Uint8Array(pdfBuffer), `${projectInfo.projectName.replace(/\\s+/g, "_", "PDF Document", ["pdf"]);}_report.pdf`);',
        replace: 'downloadFile(new Uint8Array(pdfBuffer), `${projectInfo.projectName.replace(/\\s+/g, "_")}_report.pdf`, "PDF Document", ["pdf"]);'
    },
    {
        path: 'src/routes/plumbing-storm-water.tsx',
        search: 'await downloadFile(new Uint8Array(buffer), `Storm_Water_Sizing_${project.name.replace(/\\s+/g, "_", "Excel Document", ["xlsx"]);}.xlsx`);',
        replace: 'await downloadFile(new Uint8Array(buffer), `Storm_Water_Sizing_${project.name.replace(/\\s+/g, "_")}.xlsx`, "Excel Document", ["xlsx"]);'
    },
    {
        path: 'src/routes/preliminary-cooling-load.tsx',
        search: 'downloadFile(new Uint8Array(pdfBuffer), `${projectInfo.projectName.replace(/\\s+/g, "_", "PDF Document", ["pdf"]);}_report.pdf`);',
        replace: 'downloadFile(new Uint8Array(pdfBuffer), `${projectInfo.projectName.replace(/\\s+/g, "_")}_report.pdf`, "PDF Document", ["pdf"]);'
    }
];

filesToFix.forEach(({ path, search, replace }) => {
    if (fs.existsSync(path)) {
        let content = fs.readFileSync(path, 'utf8');
        if (content.includes(search)) {
            content = content.replace(search, replace);
            fs.writeFileSync(path, content, 'utf8');
            console.log(`Fixed syntax in ${path}`);
        } else {
            console.log(`String not found in ${path}`);
        }
    }
});
