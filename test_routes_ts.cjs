const ts = require('./frontend/node_modules/typescript');
const path = require('path');

const targetFiles = [
  path.join(__dirname, 'frontend/src/routes/condensate-drain-calc.tsx'),
  path.join(__dirname, 'frontend/src/routes/psychrometric.tsx'),
  path.join(__dirname, 'frontend/src/routes/sanity-check-tool.tsx'),
  path.join(__dirname, 'frontend/src/routes/central-battery-sizing.tsx'),
  path.join(__dirname, 'frontend/src/routes/ups-sizing-calculation.tsx'),
  path.join(__dirname, 'frontend/src/routes/plumbing-discharge-unit.tsx'),
  path.join(__dirname, 'frontend/src/routes/plumbing-storm-water.tsx'),
  path.join(__dirname, 'frontend/src/routes/plumbing-fixture-unit.tsx'),
  path.join(__dirname, 'frontend/src/routes/plumbing-drainage.tsx')
];

const tsConfigPath = path.join(__dirname, 'frontend/tsconfig.json');
const configFile = ts.readConfigFile(tsConfigPath, ts.sys.readFile);
const parsedConfig = ts.parseJsonConfigFileContent(
  configFile.config,
  ts.sys,
  path.join(__dirname, 'frontend')
);

const program = ts.createProgram(targetFiles, {
  ...parsedConfig.options,
  noEmit: true,
  skipLibCheck: true
});

const diagnostics = ts.getPreEmitDiagnostics(program);

const relevantErrors = diagnostics.filter(d => {
  if (!d.file) return false;
  return targetFiles.some(tf => path.resolve(d.file.fileName) === path.resolve(tf));
});

if (relevantErrors.length === 0) {
  console.log('>>> ZERO ERRORS: All 9 calculator files compile cleanly with TypeScript! <<<');
} else {
  console.log(`Found ${relevantErrors.length} errors:`);
  relevantErrors.forEach(d => {
    const { line, character } = d.file.getLineAndCharacterOfPosition(d.start);
    const message = ts.flattenDiagnosticMessageText(d.messageText, '\n');
    console.log(`${path.basename(d.file.fileName)} (${line + 1},${character + 1}): ${message}`);
  });
}
