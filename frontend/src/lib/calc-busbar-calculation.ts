import { TaskComment } from "@/lib/ventilation-calc";

export interface BusbarRow {
  id: string;
  from: string;
  desc: string;
  ref: string;
  length: number | "";
  loadKw: number | "";
  div: number | "";
  flagged?: boolean;
  comments?: TaskComment[];
}

export function getBusbarRowValidation(r?: Partial<BusbarRow>, vdPercent: number = 0) {
  const warnings: string[] = [];
  if (!r) return { isAutoFlagged: false, isFlagged: false, warnings: [] };

  const descEmpty = !r.desc || String(r.desc).trim() === "";
  const lenEmpty = r.length === "" || r.length === undefined || r.length === null || Number(r.length) === 0;
  const loadEmpty = r.loadKw === "" || r.loadKw === undefined || r.loadKw === null || Number(r.loadKw) === 0;

  // Don't auto-flag brand new completely blank rows
  const isCompletelyEmpty = descEmpty && lenEmpty && loadEmpty;

  if (!isCompletelyEmpty) {
    if (descEmpty) {
      warnings.push("description");
    }
    if (r.length === "" || r.length === undefined || r.length === null || isNaN(Number(r.length)) || Number(r.length) <= 0) {
      warnings.push("length (0 or missing)");
    }
    if (r.loadKw === "" || r.loadKw === undefined || r.loadKw === null || isNaN(Number(r.loadKw)) || Number(r.loadKw) <= 0) {
      warnings.push("load (kW)");
    }
  }

  if (Number(vdPercent) > 2.5) {
    warnings.push("exceeds 2.5% V.drop");
  }

  const isAutoFlagged = warnings.length > 0;
  const isFlagged = r.flagged !== undefined ? Boolean(r.flagged) : isAutoFlagged;
  return { isAutoFlagged, isFlagged, warnings };
}

export interface BusbarSection {
  id: string;
  name: string;
  ratingId: string;
  volts: number | "";
  pf: number | "";
  useMdForCurrent?: boolean;
  rows: BusbarRow[];
}

export interface LVPanel {
  id: string;
  name: string;
  sections: BusbarSection[];
}

export function calculateBusbarPanels(panels: LVPanel[], allBusbarData: Record<string, { r: number; x: number; label: string }>, unitSystem: string) {
  return panels.map(panel => {
    const calcSections = panel.sections.map(section => {
      let totalLoad = 0;
      let totalLength = 0;
      section.rows.forEach(r => {
        totalLoad += (Number(r.loadKw) || 0);
        totalLength += (Number(r.length) || 0);
      });

      let currentRemainingTCL = totalLoad;
      let cumulativeVdPercent = 0;
      let maxDesignCurrent = 0;

      const useMd = section.useMdForCurrent !== false;

      const calcRows = section.rows.map((r) => {
        const tcl = currentRemainingTCL;
        const md = tcl * (Number(r.div) || 0);
        const loadForCurrent = useMd ? md : tcl;
        let current = 0;
        const volts = Number(section.volts) || 0;
        const isThreePhase = volts >= 300;
        const pf = Number(section.pf) || 0;
        if (volts > 0 && pf > 0) {
          if (isThreePhase) {
            current = (loadForCurrent * 1000) / (Math.sqrt(3) * volts * pf);
          } else {
            current = (loadForCurrent * 1000) / (volts * pf);
          }
        }

        if (current > maxDesignCurrent) {
          maxDesignCurrent = current;
        }

        const rData = allBusbarData[section.ratingId] || { r: 0, x: 0 };
        const phi = Math.acos(pf);
        const sinPhi = Math.sin(phi);
        
        const lenNum = Number(r.length) || 0;
        const lenMeters = unitSystem === "ip" ? lenNum * 0.3048 : lenNum;
        
        let vd = 0;
        if (isThreePhase) {
          vd = (Math.sqrt(3) * current * lenMeters * ((rData.r * pf) + (rData.x * sinPhi))) / 1000;
        } else {
          vd = (2 * current * lenMeters * ((rData.r * pf) + (rData.x * sinPhi))) / 1000;
        }
        
        const vdPercent = volts > 0 ? (vd / volts) * 100 : 0;
        cumulativeVdPercent += vdPercent;
        currentRemainingTCL -= (Number(r.loadKw) || 0);

        return {
          ...r,
          description: r.desc,
          tcl,
          md,
          current,
          designCurrent: current,
          r: rData.r,
          x: rData.x,
          vd,
          cumulativeVd: vd,
          vdPercent,
          cumulativeVdPercent,
          cumulativeVdPct: cumulativeVdPercent,
          isCompliant: cumulativeVdPercent <= 3.0,
        };
      });

      const totalCumulativeVd = calcRows.length > 0 ? calcRows[calcRows.length - 1].cumulativeVdPercent : 0;

      return {
        ...section,
        calcRows,
        totalCumulativeVd,
        busbarLength: totalLength,
        totalConnectedLoad: totalLoad,
        totalDesignCurrent: maxDesignCurrent,
        maxVdPct: totalCumulativeVd,
      };
    });

    return {
      ...panel,
      calcSections
    };
  });
}
