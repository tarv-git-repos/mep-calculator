import { Cable, Tray, getCableTraySize } from "./cableTrayHelpers";

export function calculateTraySizing(
  filteredCables: Cable[], 
  cableDatabase: Record<string, Record<string, number>>, 
  spacingFactorStr: number | string | undefined, 
  spareCapacityStr: number | string | undefined
) {
  let subTotal1 = 0;
  let hasValidCables = false;
  
  const calcCables = filteredCables.map(c => {
    const baseOd = c.cores && c.size ? (cableDatabase[c.cores]?.[c.size] ?? NaN) : NaN;
    const od = c.customOd !== undefined && c.customOd !== "" ? Number(c.customOd) : baseOd;
    const qtyNum = typeof c.qty === 'number' ? c.qty : 0;
    const sumOd = !isNaN(od) && qtyNum > 0 ? od * qtyNum : NaN;
    
    if (!isNaN(sumOd) && qtyNum > 0) {
      subTotal1 += sumOd;
      hasValidCables = true;
    }
    return { ...c, od, sumOd };
  });

  const spacingFactor = Number(spacingFactorStr ?? 1);
  const spacingWidth = subTotal1 * spacingFactor;
  const subTotal2 = subTotal1 + spacingWidth;
  const sparePercentage = Number(spareCapacityStr ?? 20);
  const spareWidth = subTotal2 * (sparePercentage / 100);
  const totalWidth = subTotal2 + spareWidth;
  const traySize = hasValidCables ? getCableTraySize(totalWidth) : 'N/A';

  return {
    calcCables,
    subTotal1,
    spacingFactor,
    spacingWidth,
    subTotal2,
    sparePercentage,
    spareWidth,
    totalWidth,
    traySize,
    hasValidCables
  };
}
