const fs = require('fs');
const file = 'frontend/src/routes/liftwell-pressurization.tsx';
let data = fs.readFileSync(file, 'utf8');

data = data.replace('27.23 sq ft\" : \"2.53 m²', '29.7 sq ft\" : \"2.76 m²');
data = data.replace('e.g. 2.53 m² / 27.23 sq ft', 'e.g. 2.76 m² / 29.7 sq ft');
data = data.replace('placeholder={unitSystem === "ip" ? "27.23" : "2.53"}', 'placeholder={unitSystem === "ip" ? "29.7" : "2.76"}');
data = data.replace('Reset to Default (2 doors)', 'Reset to Default (1 door)');
data = data.replace('Reset to Default (16 doors)', 'Reset to Default (17 doors)');

fs.writeFileSync(file, data);
