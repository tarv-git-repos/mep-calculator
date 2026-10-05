export interface LoadRow {
  id: string;
  description: string;
  qtySingle: number;
  qtyTwin: number;
  equipmentLoad: number; // Watts
  remarks: string;
  isFlagged?: boolean;
  flagReason?: string;
}


export function computeUpsSizing(loadRows: LoadRow[], diversityFactor: number, powerFactor: number, spareCapacity: number) {
  let totalConnectedW = 0;

  loadRows.forEach((r) => {
    const single = r.qtySingle || 0;
    const twin = r.qtyTwin || 0;
    const load = r.equipmentLoad || 0;

    // Connected Load = (Qty Single + 2 * Qty Twin) * Equipment Load
    const totalOutlets = single + (2 * twin);
    const rowConnected = totalOutlets * load;

    totalConnectedW += rowConnected;
  });

  const totalConnectedKw = totalConnectedW / 1000;
  const totalLoadAfterDiversityKw = totalConnectedKw * diversityFactor;
  
  const safePF = powerFactor <= 0 ? 0.8 : powerFactor;
  const upsRatingKva = totalLoadAfterDiversityKw / safePF;

  const finalRecommendedKva = upsRatingKva * (1 + spareCapacity / 100);

  return {
    totalConnectedKw,
    totalLoadAfterDiversityKw,
    upsRatingKva,
    finalRecommendedKva
  };
}
