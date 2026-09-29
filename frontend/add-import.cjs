const fs = require('fs');

const path = 'z:\\00 R&D Server\\04 MISC\\Vikrams  MEP CALCULATOR UPDATED\\vikram_updated_calc\\New Ui MEP\\MEP_Calculator_Project\\frontend\\src\\routes\\fresh-air-cooling-load.tsx';
let content = fs.readFileSync(path, 'utf8');

if (!content.includes('@/components/ui/dropdown-menu')) {
  content = content.replace(
    'import {',
    `import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import {`
  );
  fs.writeFileSync(path, content);
  console.log("Added DropdownMenu import.");
} else {
  console.log("DropdownMenu import already exists.");
}
