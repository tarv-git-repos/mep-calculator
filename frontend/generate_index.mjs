import fs from 'fs/promises';
import path from 'path';

async function generateIndex() {
  const publicDir = path.join(process.cwd(), '.output', 'public');
  const assetsDir = path.join(publicDir, 'assets');
  
  const files = await fs.readdir(assetsDir);
  
  let mainJs = '';
  let mainCss = '';
  
  for (const file of files) {
    if (file.startsWith('index-') && file.endsWith('.js') && !file.includes('map')) {
      mainJs = file;
    }
    if (file.startsWith('index-') && file.endsWith('.css')) {
      mainCss = file;
    }
  }
  
  if (!mainJs) {
    console.error('Could not find main js file!');
    process.exit(1);
  }
  
  const cssTag = mainCss ? `<link rel="stylesheet" href="/assets/${mainCss}">` : '';
  
  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>MEP Calculator</title>
  ${cssTag}
</head>
<body>
  <div id="root"></div>
  <script type="module" src="/assets/${mainJs}"></script>
</body>
</html>`;

  await fs.writeFile(path.join(publicDir, 'index.html'), html);
  console.log('Successfully generated .output/public/index.html');
}

generateIndex().catch(console.error);
