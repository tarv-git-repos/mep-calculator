$path = "frontend\src\routes\capacitor-bank-sizing.tsx"
$text = [IO.File]::ReadAllText($path)

$targetInterface = @"
interface CapPanel {
  id: string;
  name: string;
  panelRef: string;
  totalLoadKw: number | "";
  maxDemandLoadKw: number | "";
  initialPf: number | "";
  targetPf: number | "";
  stepUnit: number;
  overcurrentFactor: number;
  voltageKv: number;
  flagged?: boolean;
  comments?: TaskComment[];
}
"@

$targetCalc = @"
  const calculatePanel = (p: CapPanel) => {
    const demand = Number(p.maxDemandLoadKw) || 0;
    const pf1 = Number(p.initialPf) || 1;
    const pf2 = Number(p.targetPf) || 1;

    const safePf1 = Math.min(Math.max(pf1, 0.1), 1);
    const safePf2 = Math.min(Math.max(pf2, 0.1), 1);

    const theta1Rad = Math.acos(safePf1);
    const theta2Rad = Math.acos(safePf2);
    
    const theta1Deg = theta1Rad * (180 / Math.PI);
    const theta2Deg = theta2Rad * (180 / Math.PI);

    const tanTheta1 = Math.tan(theta1Rad);
    const tanTheta2 = Math.tan(theta2Rad);
    const tanThetaDiff = tanTheta1 - tanTheta2;

    const requiredKvar = demand * tanThetaDiff;

    let proposedKvar = Math.ceil(requiredKvar / 25) * 25;
    if (proposedKvar <= 0) proposedKvar = 25;

    const stepUnit = Number(p.stepUnit) || 50;
    const numFullSteps = Math.floor(proposedKvar / stepUnit);
    const remainderStep = proposedKvar % stepUnit;

    const initialKva = demand / safePf1;
    const targetKva = demand / safePf2;
    const initialKvar = Math.sin(theta1Rad) * initialKva;
    const targetKvar = Math.sin(theta2Rad) * targetKva;

    const overcurrentFactor = Number(p.overcurrentFactor) || 1.35;
    const voltageKv = Number(p.voltageKv) || 0.4;
    const ampI = (overcurrentFactor * proposedKvar) / (1.732 * voltageKv);

    return {
      theta1Deg, theta2Deg, tanTheta1, tanTheta2, tanThetaDiff,
      requiredKvar, proposedKvar, numFullSteps, remainderStep,
      initialKva, targetKva, initialKvar, targetKvar, ampI
    };
  };
"@

$targetGetMultiplyingFactor = @"
function getMultiplyingFactor(initialPf: number, targetPf: number) {
  if (initialPf >= targetPf) return "-";
  const tan1 = Math.tan(Math.acos(initialPf));
  const tan2 = Math.tan(Math.acos(targetPf));
  const diff = tan1 - tan2;
  return diff > 0 ? diff.toFixed(3) : "-";
}
"@

$text = $text.Replace($targetInterface, 'import { CapPanel, calculateCapacitorPanel as calculatePanel, getMultiplyingFactor } from "@/lib/calc-capacitor-bank";')
$text = $text.Replace($targetCalc, "")
$text = $text.Replace($targetGetMultiplyingFactor, "")

[IO.File]::WriteAllText($path, $text)
Write-Host "Replacement Complete."
