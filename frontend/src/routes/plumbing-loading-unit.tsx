import { CalculationReviewBar } from "@/components/workspace/CalculationReviewBar";
import { downloadFile } from "@/lib/download";
import { createFileRoute } from "@tanstack/react-router";
import { useState, useMemo, useEffect, useRef } from "react";
import { AppShell } from "@/components/workspace/AppShell";
import { AssignCommentModal } from "@/components/workspace/AssignCommentModal";
import { EditLoadingUnitRowModal } from "@/components/workspace/EditLoadingUnitRowModal";
import { Trash2, Save, Info, Sparkles, Plus, Building2, Copy, Edit3, CheckSquare, Square, X, MessageSquare, Flag, Filter, SlidersHorizontal, Search, Download, ChevronDown, FileText, Calculator } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import * as XLSX from "xlsx";
import ExcelJS from "exceljs";
import { addPdfHeader, addPdfSignatureBlock, getSignatureBlockDetails } from "@/lib/pdfHelpers";
import { useWorkspace, workspaceStore } from "@/lib/workspace-store";
import { dirtyStore } from "@/lib/dirty-store";
import { toast } from "sonner";

export const Route = createFileRoute("/plumbing-loading-unit")({
  head: () => ({
    meta: [
      { title: "Loading Unit & Pipe Sizer — MEP Calc" },
      { name: "description", content: "Dubai (DBC / BS EN 806 / CIBSE), Abu Dhabi (ADM), and IPC/UPC Plumbing Loading Unit & Pipe Sizing Calculator." },
    ],
  }),
  component: LoadingUnitPage,
});

export type StandardPreset =
  | "iop_bs"
  | "dubai"
  | "abudhabi"
  | "ipc_upc"
  | "as_nzs_3500"
  | "barrie"
  | "bs_806"
  | "bs_8558"
  | "iop_low"
  | "iop_med"
  | "iop_high"
  | "din_res"
  | "din_hosp"
  | "din_hotel"
  | "din_school"
  | "din_office"
  | "din_assisted"
  | "din_nursing"
  | "ipc"
  | "upc";

interface LUSpace {
  id: number;
  desc: string;
  floor: string;
  qty: number;
  floorQty?: number;
  std: string;
  fixtures: Record<string, number>;
  comments?: any[];
  flagged?: boolean;
}

export function getLUSpaceValidation(s?: Partial<LUSpace>) {
  const warnings: string[] = [];
  if (!s) return { isFlagged: false, warnings: [] };

  const descEmpty = !s.desc || s.desc.trim() === "";
  const hasFixtures = s.fixtures && Object.values(s.fixtures).some(v => Number(v) > 0);
  const qtyZero = !s.qty || Number(s.qty) <= 0;

  const isCompletelyEmpty = descEmpty && !hasFixtures && qtyZero;

  if (!isCompletelyEmpty) {
    if (descEmpty) warnings.push("Space description is empty");
    if (qtyZero) warnings.push("Space quantity must be at least 1");
    if (!hasFixtures) warnings.push("No fixtures specified for this space");
  }

  const isAutoFlagged = warnings.length > 0;
  const isManualFlagged = s.flagged === true;
  const isFlagged = s.flagged !== undefined ? Boolean(s.flagged) : isAutoFlagged;

  return { isFlagged, isManualFlagged, isAutoFlagged, warnings };
}

export interface StandardCategoryOption {
  id: string;
  label: string;
}

export const STANDARD_CATEGORIES: Record<StandardPreset, StandardCategoryOption[]> = {
  iop_bs: [
    { id: "med", label: "Medium Frequency of Use (Commercial / Offices / Hotels)" },
    { id: "low", label: "Low Frequency of Use (Dwellings / Low Demand)" },
    { id: "high", label: "High Frequency of Use (Public Washrooms / Assembly / Sports)" }
  ],
  dubai: [
    { id: "med", label: "Medium Demand (Commercial / Offices / Hotels)" },
    { id: "low", label: "Low Demand (Dwellings / Private Residential)" },
    { id: "high", label: "High Demand (Public Washrooms / Schools / Sports)" }
  ],
  abudhabi: [
    { id: "med", label: "Medium / Standard Demand (Commercial)" },
    { id: "low", label: "Low / Private Demand (Residential)" },
    { id: "high", label: "High / Public Demand (Assembly / Public)" }
  ],
  ipc_upc: [
    { id: "ipc_total", label: "Total WSFU (IPC Table E103.3(2))" },
    { id: "ipc_cold", label: "Cold Water WSFU (IPC Table E103.3(2))" },
    { id: "ipc_hot", label: "Hot Water WSFU (IPC Table E103.3(2))" },
    { id: "low", label: "Private / Residential WSFU" },
    { id: "high", label: "Public / Assembly WSFU" }
  ],
  as_nzs_3500: [{ id: "std", label: "AS/NZS 3500 Standard Loading" }],
  barrie: [{ id: "std", label: "Barrie's Book Standard Loading" }],
  bs_806: [{ id: "std", label: "BS 806 / BS EN 806 Standard Loading" }],
  bs_8558: [{ id: "std", label: "BS 8558 Standard Loading" }],
  iop_low: [{ id: "std", label: "IoP / CIPHE Low Demand" }],
  iop_med: [{ id: "std", label: "IoP / CIPHE Medium Demand" }],
  iop_high: [{ id: "std", label: "IoP / CIPHE High Demand" }],
  din_res: [{ id: "std", label: "DIN 1988-300 Residential (a=1.48, b=0.19, c=0.94)" }],
  din_hosp: [{ id: "std", label: "DIN 1988-300 Hospital (a=0.75, b=0.44, c=0.18)" }],
  din_hotel: [{ id: "std", label: "DIN 1988-300 Hotel (a=0.70, b=0.48, c=0.13)" }],
  din_school: [{ id: "std", label: "DIN 1988-300 School (a=0.91, b=0.31, c=0.38)" }],
  din_office: [{ id: "std", label: "DIN 1988-300 Office (a=0.91, b=0.31, c=0.38)" }],
  din_assisted: [{ id: "std", label: "DIN 1988-300 Assisted Living (a=1.48, b=0.19, c=0.94)" }],
  din_nursing: [{ id: "std", label: "DIN 1988-300 Nursing Home (a=1.40, b=0.14, c=0.92)" }],
  ipc: [{ id: "std", label: "IPC Table E103.3 Standard Loading" }],
  upc: [{ id: "std", label: "UPC Standard Loading" }]
};

export const DEFAULT_CATEGORY_FOR_PRESET: Record<StandardPreset, string> = {
  iop_bs: "med",
  dubai: "med",
  abudhabi: "med",
  ipc_upc: "ipc_total",
  as_nzs_3500: "std",
  barrie: "std",
  bs_806: "std",
  bs_8558: "std",
  iop_low: "std",
  iop_med: "std",
  iop_high: "std",
  din_res: "std",
  din_hosp: "std",
  din_hotel: "std",
  din_school: "std",
  din_office: "std",
  din_assisted: "std",
  din_nursing: "std",
  ipc: "std",
  upc: "std"
};

export const EXTRACTED_FIXTURE_WEIGHTS_BY_STANDARD: Record<string, Record<string, number>> = {
  as_nzs_3500: { wc: 2, handspray: 3, basin: 1, sink: 2, shower: 2, washer: 3, servicesink: 3, hose_bibb: 8, dishwasher: 3, hose_bibb_1: 8, bath: 8, bidet: 1, urinal: 2, bedpan: 3, beverage: 2, birthing: 16, cleaners: 3, fountain: 1, flushing_rim: 3, laundry: 3 },
  barrie: { wc: 2, handspray: 3, basin: 1, sink: 3, shower: 3, washer: 3, servicesink: 3, hose_bibb: 8, dishwasher: 3, hose_bibb_1: 8, bath: 8, bidet: 1, urinal: 2, bedpan: 3, beverage: 3, birthing: 16, cleaners: 3, fountain: 1, flushing_rim: 3, laundry: 3 },
  bs_806: { wc: 1, handspray: 2, basin: 1, sink: 2, shower: 2, washer: 2, servicesink: 2, hose_bibb: 5, dishwasher: 2, hose_bibb_1: 5, bath: 4, bidet: 1, urinal: 3, bedpan: 2, beverage: 2, birthing: 8, cleaners: 2, fountain: 1, flushing_rim: 2, laundry: 2 },
  bs_8558: { wc: 2, handspray: 3, basin: 1.5, sink: 3, shower: 3, washer: 3, servicesink: 3, hose_bibb: 3, dishwasher: 3, hose_bibb_1: 3, bath: 10, bidet: 1, urinal: 2, bedpan: 5, beverage: 3, birthing: 22, cleaners: 3, fountain: 2, flushing_rim: 5, laundry: 3 },
  iop_low: { wc: 1, handspray: 2, basin: 1, sink: 2, shower: 2, washer: 2, servicesink: 2, hose_bibb: 2, dishwasher: 2, hose_bibb_1: 2, bath: 4, bidet: 1, urinal: 1, bedpan: 5, beverage: 2, birthing: 16, cleaners: 2, fountain: 2, flushing_rim: 5, laundry: 2 },
  iop_med: { wc: 2, handspray: 5, basin: 2, sink: 5, shower: 3, washer: 2, servicesink: 5, hose_bibb: 5, dishwasher: 2, hose_bibb_1: 5, bath: 8, bidet: 1, urinal: 1, bedpan: 5, beverage: 5, birthing: 16, cleaners: 5, fountain: 5, flushing_rim: 5, laundry: 5 },
  iop_high: { wc: 5, handspray: 10, basin: 4, sink: 10, shower: 6, washer: 2, servicesink: 10, hose_bibb: 10, dishwasher: 2, hose_bibb_1: 10, bath: 16, bidet: 2, urinal: 1, bedpan: 5, beverage: 10, birthing: 16, cleaners: 10, fountain: 10, flushing_rim: 5, laundry: 10 },
  din_res: { wc: 0.1, handspray: 0.15, basin: 0.1, sink: 0.1, shower: 0.15, washer: 0.15, servicesink: 0.1, hose_bibb: 0.3, dishwasher: 0.1, hose_bibb_1: 0.3, bath: 0.15, bidet: 0.1, urinal: 0.15, bedpan: 0.5, beverage: 0.15, birthing: 0.3, cleaners: 0.1, fountain: 0.1, flushing_rim: 0.3, laundry: 0.15 },
  din_hosp: { wc: 0.1, handspray: 0.15, basin: 0.1, sink: 0.1, shower: 0.15, washer: 0.15, servicesink: 0.1, hose_bibb: 0.3, dishwasher: 0.1, hose_bibb_1: 0.3, bath: 0.15, bidet: 0.1, urinal: 0.15, bedpan: 0.5, beverage: 0.15, birthing: 0.3, cleaners: 0.1, fountain: 0.1, flushing_rim: 0.3, laundry: 0.15 },
  din_hotel: { wc: 0.1, handspray: 0.15, basin: 0.1, sink: 0.1, shower: 0.15, washer: 0.15, servicesink: 0.1, hose_bibb: 0.3, dishwasher: 0.1, hose_bibb_1: 0.3, bath: 0.15, bidet: 0.1, urinal: 0.15, bedpan: 0.5, beverage: 0.15, birthing: 0.3, cleaners: 0.1, fountain: 0.1, flushing_rim: 0.3, laundry: 0.15 },
  din_school: { wc: 0.1, handspray: 0.15, basin: 0.1, sink: 0.1, shower: 0.15, washer: 0.15, servicesink: 0.1, hose_bibb: 0.3, dishwasher: 0.1, hose_bibb_1: 0.3, bath: 0.15, bidet: 0.1, urinal: 0.15, bedpan: 0.5, beverage: 0.15, birthing: 0.3, cleaners: 0.1, fountain: 0.1, flushing_rim: 0.3, laundry: 0.15 },
  din_office: { wc: 0.1, handspray: 0.15, basin: 0.1, sink: 0.1, shower: 0.15, washer: 0.15, servicesink: 0.1, hose_bibb: 0.3, dishwasher: 0.1, hose_bibb_1: 0.3, bath: 0.15, bidet: 0.1, urinal: 0.15, bedpan: 0.5, beverage: 0.15, birthing: 0.3, cleaners: 0.1, fountain: 0.1, flushing_rim: 0.3, laundry: 0.15 },
  din_assisted: { wc: 0.1, handspray: 0.15, basin: 0.1, sink: 0.1, shower: 0.15, washer: 0.15, servicesink: 0.1, hose_bibb: 0.3, dishwasher: 0.1, hose_bibb_1: 0.3, bath: 0.15, bidet: 0.1, urinal: 0.15, bedpan: 0.5, beverage: 0.15, birthing: 0.3, cleaners: 0.1, fountain: 0.1, flushing_rim: 0.3, laundry: 0.15 },
  din_nursing: { wc: 0.1, handspray: 0.15, basin: 0.1, sink: 0.1, shower: 0.15, washer: 0.15, servicesink: 0.1, hose_bibb: 0.3, dishwasher: 0.1, hose_bibb_1: 0.3, bath: 0.15, bidet: 0.1, urinal: 0.15, bedpan: 0.5, beverage: 0.15, birthing: 0.3, cleaners: 0.1, fountain: 0.1, flushing_rim: 0.3, laundry: 0.15 },
  ipc: { wc: 2.5, handspray: 2.25, basin: 1, sink: 1.5, shower: 2, washer: 4, servicesink: 3, hose_bibb: 2.5, dishwasher: 1.5, hose_bibb_1: 2.5, bath: 4, bidet: 2, urinal: 2, bedpan: 3, beverage: 3, birthing: 16, cleaners: 3, fountain: 0.5, flushing_rim: 3, laundry: 1.5 },
  upc: { wc: 2.5, handspray: 3, basin: 1, sink: 1.5, shower: 2, washer: 4, servicesink: 3, hose_bibb: 2.5, dishwasher: 1.5, hose_bibb_1: 2.5, bath: 4, bidet: 2, urinal: 2, bedpan: 3, beverage: 1.5, birthing: 16, cleaners: 3, fountain: 0.5, flushing_rim: 3, laundry: 1.5 }
};

export const STANDARD_FIXTURE_WEIGHTS_BY_CATEGORY: Record<
  StandardPreset,
  Record<string, Record<string, number>>
> = {
  // 🇬🇧 IoP PESDG Table 15 / BS EN 806 (Loading Units - LU)
  iop_bs: {
    low: EXTRACTED_FIXTURE_WEIGHTS_BY_STANDARD.iop_low,
    med: EXTRACTED_FIXTURE_WEIGHTS_BY_STANDARD.iop_med,
    high: EXTRACTED_FIXTURE_WEIGHTS_BY_STANDARD.iop_high,
  },
  // 🇦🇪 Dubai Standard (DBC 2021 / BS EN 806-3 / CIBSE Guide G)
  dubai: {
    low: { wc: 1.5, wc_tank: 1.5, wc_valve: 15.0, handspray: 1.0, basin: 1.0, sink: 1.5, shower: 1.5, washer: 2.0, servicesink: 2.0, hose_bibb: 1.5, dishwasher: 1.5, hose_bibb_1: 1.0, bath: 4.0, bibtap: 1.5 },
    med: { wc: 2.5, wc_tank: 2.0, wc_valve: 28.0, handspray: 1.0, basin: 1.0, sink: 1.5, shower: 2.0, washer: 3.0, servicesink: 3.0, hose_bibb: 2.5, dishwasher: 1.5, hose_bibb_1: 1.0, bath: 10.0, bibtap: 2.5 },
    high: { wc: 2.5, wc_tank: 2.5, wc_valve: 28.0, handspray: 2.0, basin: 2.0, sink: 5.0, shower: 4.0, washer: 4.0, servicesink: 5.0, hose_bibb: 5.0, dishwasher: 4.0, hose_bibb_1: 2.5, bath: 12.0, bibtap: 5.0 }
  },
  // 🇦🇪 Abu Dhabi Standard (ADM Table 6-7 / Table 6-9)
  abudhabi: {
    low: { wc: 2.5, wc_tank: 2.5, wc_valve: 3.5, handspray: 0.75, basin: 0.75, sink: 1.125, shower: 1.5, washer: 1.5, servicesink: 2.25, hose_bibb: 1.5, dishwasher: 1.4, hose_bibb_1: 1.0, bath: 1.4, bibtap: 1.5 },
    med: { wc: 2.5, wc_tank: 2.5, wc_valve: 5.0, handspray: 1.0, basin: 1.0, sink: 1.5, shower: 2.0, washer: 3.0, servicesink: 3.0, hose_bibb: 2.5, dishwasher: 1.5, hose_bibb_1: 1.0, bath: 1.4, bibtap: 2.5 },
    high: { wc: 3.5, wc_tank: 3.5, wc_valve: 8.0, handspray: 2.0, basin: 2.0, sink: 2.0, shower: 4.0, washer: 4.0, servicesink: 3.0, hose_bibb: 3.0, dishwasher: 3.0, hose_bibb_1: 2.0, bath: 3.0, bibtap: 3.0 }
  },
  // 🌐 International IPC / UPC Standard (IPC Table E103.3(2))
  ipc_upc: {
    ipc_total: EXTRACTED_FIXTURE_WEIGHTS_BY_STANDARD.ipc,
    ipc_cold: EXTRACTED_FIXTURE_WEIGHTS_BY_STANDARD.ipc,
    ipc_hot: EXTRACTED_FIXTURE_WEIGHTS_BY_STANDARD.ipc,
    low: EXTRACTED_FIXTURE_WEIGHTS_BY_STANDARD.ipc,
    high: EXTRACTED_FIXTURE_WEIGHTS_BY_STANDARD.ipc
  },
  as_nzs_3500: { std: EXTRACTED_FIXTURE_WEIGHTS_BY_STANDARD.as_nzs_3500 },
  barrie: { std: EXTRACTED_FIXTURE_WEIGHTS_BY_STANDARD.barrie },
  bs_806: { std: EXTRACTED_FIXTURE_WEIGHTS_BY_STANDARD.bs_806 },
  bs_8558: { std: EXTRACTED_FIXTURE_WEIGHTS_BY_STANDARD.bs_8558 },
  iop_low: { std: EXTRACTED_FIXTURE_WEIGHTS_BY_STANDARD.iop_low },
  iop_med: { std: EXTRACTED_FIXTURE_WEIGHTS_BY_STANDARD.iop_med },
  iop_high: { std: EXTRACTED_FIXTURE_WEIGHTS_BY_STANDARD.iop_high },
  din_res: { std: EXTRACTED_FIXTURE_WEIGHTS_BY_STANDARD.din_res },
  din_hosp: { std: EXTRACTED_FIXTURE_WEIGHTS_BY_STANDARD.din_hosp },
  din_hotel: { std: EXTRACTED_FIXTURE_WEIGHTS_BY_STANDARD.din_hotel },
  din_school: { std: EXTRACTED_FIXTURE_WEIGHTS_BY_STANDARD.din_school },
  din_office: { std: EXTRACTED_FIXTURE_WEIGHTS_BY_STANDARD.din_office },
  din_assisted: { std: EXTRACTED_FIXTURE_WEIGHTS_BY_STANDARD.din_assisted },
  din_nursing: { std: EXTRACTED_FIXTURE_WEIGHTS_BY_STANDARD.din_nursing },
  ipc: { std: EXTRACTED_FIXTURE_WEIGHTS_BY_STANDARD.ipc },
  upc: { std: EXTRACTED_FIXTURE_WEIGHTS_BY_STANDARD.upc }
};

export const STANDARD_FIXTURE_WEIGHTS: Record<StandardPreset, Record<string, number>> = {
  iop_bs: STANDARD_FIXTURE_WEIGHTS_BY_CATEGORY.iop_bs.med,
  dubai: STANDARD_FIXTURE_WEIGHTS_BY_CATEGORY.dubai.med,
  abudhabi: STANDARD_FIXTURE_WEIGHTS_BY_CATEGORY.abudhabi.med,
  ipc_upc: STANDARD_FIXTURE_WEIGHTS_BY_CATEGORY.ipc_upc.ipc_total,
  as_nzs_3500: EXTRACTED_FIXTURE_WEIGHTS_BY_STANDARD.as_nzs_3500,
  barrie: EXTRACTED_FIXTURE_WEIGHTS_BY_STANDARD.barrie,
  bs_806: EXTRACTED_FIXTURE_WEIGHTS_BY_STANDARD.bs_806,
  bs_8558: EXTRACTED_FIXTURE_WEIGHTS_BY_STANDARD.bs_8558,
  iop_low: EXTRACTED_FIXTURE_WEIGHTS_BY_STANDARD.iop_low,
  iop_med: EXTRACTED_FIXTURE_WEIGHTS_BY_STANDARD.iop_med,
  iop_high: EXTRACTED_FIXTURE_WEIGHTS_BY_STANDARD.iop_high,
  din_res: EXTRACTED_FIXTURE_WEIGHTS_BY_STANDARD.din_res,
  din_hosp: EXTRACTED_FIXTURE_WEIGHTS_BY_STANDARD.din_hosp,
  din_hotel: EXTRACTED_FIXTURE_WEIGHTS_BY_STANDARD.din_hotel,
  din_school: EXTRACTED_FIXTURE_WEIGHTS_BY_STANDARD.din_school,
  din_office: EXTRACTED_FIXTURE_WEIGHTS_BY_STANDARD.din_office,
  din_assisted: EXTRACTED_FIXTURE_WEIGHTS_BY_STANDARD.din_assisted,
  din_nursing: EXTRACTED_FIXTURE_WEIGHTS_BY_STANDARD.din_nursing,
  ipc: EXTRACTED_FIXTURE_WEIGHTS_BY_STANDARD.ipc,
  upc: EXTRACTED_FIXTURE_WEIGHTS_BY_STANDARD.upc
};

export const LU_FIXTURES_META = [
  { id: 'wc', short: 'W/C' },
  { id: 'handspray', short: 'Hand Spray (Bibb)' },
  { id: 'basin', short: 'WASH BASIN' },
  { id: 'sink', short: 'Sink Kitchen' },
  { id: 'shower', short: 'Shower' },
  { id: 'washer', short: 'WASHING MACHINE' },
  { id: 'servicesink', short: 'Service Sink' },
  { id: 'hose_bibb', short: 'Hose Bibb' },
  { id: 'dishwasher', short: 'DISH WASHER' },
  { id: 'hose_bibb_1', short: 'Bib Tap' }
];

// UPC Abu Dhabi / UBC Table 6-9 Lookup Table (WSFU -> L/min)
const ADM_TABLE_6_9 = [
  { wsfu: 1, lmin: 0 },
  { wsfu: 2, lmin: 3.8 },
  { wsfu: 3, lmin: 11 },
  { wsfu: 4, lmin: 15 },
  { wsfu: 5, lmin: 19 },
  { wsfu: 6, lmin: 23 },
  { wsfu: 8, lmin: 25 },
  { wsfu: 10, lmin: 30 },
  { wsfu: 12, lmin: 34 },
  { wsfu: 14, lmin: 42 },
  { wsfu: 16, lmin: 45 },
  { wsfu: 18, lmin: 49 },
  { wsfu: 20, lmin: 53 },
  { wsfu: 25, lmin: 64 },
  { wsfu: 30, lmin: 76 },
  { wsfu: 35, lmin: 87 },
  { wsfu: 40, lmin: 95 },
  { wsfu: 45, lmin: 102 },
  { wsfu: 50, lmin: 110 },
  { wsfu: 60, lmin: 121 },
  { wsfu: 70, lmin: 132 },
  { wsfu: 80, lmin: 144 },
  { wsfu: 90, lmin: 155 },
  { wsfu: 100, lmin: 167 },
  { wsfu: 120, lmin: 182 },
  { wsfu: 140, lmin: 201 },
  { wsfu: 160, lmin: 216 },
  { wsfu: 180, lmin: 231 },
  { wsfu: 200, lmin: 246 },
  { wsfu: 225, lmin: 265 },
  { wsfu: 250, lmin: 284 },
  { wsfu: 275, lmin: 303 },
  { wsfu: 300, lmin: 322 },
  { wsfu: 400, lmin: 397 },
  { wsfu: 500, lmin: 473 },
  { wsfu: 750, lmin: 643 },
  { wsfu: 1000, lmin: 787 },
  { wsfu: 1250, lmin: 908 },
  { wsfu: 1500, lmin: 1011 },
  { wsfu: 1750, lmin: 1113 },
  { wsfu: 2000, lmin: 1215 },
  { wsfu: 2250, lmin: 1317 },
  { wsfu: 2500, lmin: 1419 },
  { wsfu: 2750, lmin: 1522 },
  { wsfu: 3000, lmin: 1635 },
  { wsfu: 4000, lmin: 1987 },
  { wsfu: 5000, lmin: 2245 },
  { wsfu: 6000, lmin: 2434 },
  { wsfu: 7000, lmin: 2593 },
  { wsfu: 8000, lmin: 2718 },
  { wsfu: 9000, lmin: 2820 },
  { wsfu: 10000, lmin: 2911 }
];

// Reference Lookup Tables & Empirical Calculations (from CIPHE, BS 8558, BS EN 806, IPC, UPC, AS/NZS 3500 & DIN 1988-300)

export const BS_8558_IOP_LOOKUP: Record<number, number> = {
  0: 0.00, 1: 0.09, 3: 0.15, 5: 0.20, 10: 0.30, 15: 0.38,
  20: 0.44, 30: 0.56, 40: 0.67, 50: 0.77, 80: 1.06, 100: 1.25,
  150: 1.68, 200: 2.11, 250: 2.44, 300: 2.80, 400: 3.55, 500: 4.10,
  700: 5.25, 1000: 6.76, 2000: 11.30, 3000: 15.10, 4000: 18.50,
  5000: 22.50, 6000: 25.20, 7000: 28.00, 7750: 30.00
};

export const BS_EN_806_LOOKUP: Record<number, number> = {
  1: 0.10, 2: 0.20, 3: 0.24, 4: 0.27, 5: 0.29, 6: 0.32, 7: 0.34,
  8: 0.36, 9: 0.38, 10: 0.40, 15: 0.46, 20: 0.52, 30: 0.62, 40: 0.70,
  50: 0.78, 60: 0.83, 70: 0.90, 80: 0.95, 90: 1.00, 100: 1.05,
  150: 1.25, 200: 1.40, 300: 1.70, 400: 2.00, 500: 2.30, 600: 2.60,
  700: 2.80, 800: 3.00, 900: 3.20, 1000: 3.40, 2000: 5.25, 3000: 6.75,
  5000: 9.00, 6000: 9.91, 7000: 10.87, 8000: 11.79, 9000: 12.66, 10000: 13.49
};

export const IPC_LOOKUP: Record<number, number> = {
  1: 0.1892706, 2: 0.315451, 3: 0.4100863, 4: 0.5047216, 5: 0.59304788, 6: 0.67506514,
  7: 0.74446436, 8: 0.80755456, 9: 0.86433574, 10: 0.92111692, 11: 0.97158908, 12: 1.0094432,
  13: 1.0409883, 14: 1.0725334, 15: 1.1040785, 16: 1.1356236, 17: 1.16085968, 18: 1.18609576,
  19: 1.21133184, 20: 1.23656792, 25: 1.3564393, 30: 1.47000166, 35: 1.57094598, 40: 1.65927226,
  45: 1.74759854, 50: 1.83592482, 60: 2.0188864, 70: 2.208157, 80: 2.3974276, 90: 2.5866982,
  100: 2.7444237, 120: 3.0283296, 140: 3.3122355, 160: 3.5961414, 180: 3.8485022, 200: 4.100863,
  225: 4.416314, 250: 4.731765, 275: 5.047216, 300: 5.362667, 400: 6.624471, 500: 7.8231848,
  750: 10.725334, 1000: 13.1227616, 1250: 15.0785578, 1500: 16.9712638, 1750: 18.7378894, 2000: 20.504315,
  2500: 23.974276, 3000: 27.3180566, 4000: 33.122355, 5000: 37.4124886
};

export const UPC_LOOKUP: Record<number, number> = {
  0: 0.00, 10: 0.5047216, 20: 0.946353, 40: 1.577255, 60: 2.0819766, 80: 2.3974276,
  100: 2.7128786, 120: 3.0283296, 140: 3.3437806, 160: 3.5961414, 180: 3.785412,
  200: 4.0377728, 220: 4.2270434, 240: 4.4794042, 250: 4.6055846, 500: 7.886275,
  750: 10.725334, 1000: 13.1227616, 1500: 17.034354, 2000: 20.504315, 2500: 23.8480956,
  3000: 27.128786
};

export const AS_NZS_3500_LOOKUP: Record<number, number> = {
  1: 0.09, 2: 0.12, 3: 0.14, 4: 0.16, 5: 0.18, 6: 0.20, 7: 0.22,
  8: 0.24, 9: 0.25, 10: 0.26, 11: 0.28, 12: 0.29, 13: 0.30, 14: 0.31,
  15: 0.33, 16: 0.34, 17: 0.35, 18: 0.36, 19: 0.37, 20: 0.38, 21: 0.39,
  22: 0.40, 23: 0.41, 24: 0.42, 25: 0.43, 26: 0.43, 27: 0.44, 28: 0.45,
  29: 0.46, 30: 0.47, 31: 0.48, 32: 0.49, 33: 0.49, 34: 0.50, 35: 0.51,
  36: 0.52, 37: 0.52, 38: 0.53, 39: 0.54, 40: 0.55, 41: 0.55, 42: 0.56,
  43: 0.57, 44: 0.58, 45: 0.58, 46: 0.59, 47: 0.60, 48: 0.60, 49: 0.61,
  50: 0.62, 51: 0.62, 52: 0.63, 53: 0.64, 54: 0.64, 55: 0.65, 56: 0.65,
  57: 0.66, 58: 0.67, 59: 0.67, 60: 0.68, 100: 1.20, 150: 1.35, 200: 1.45,
  250: 1.60, 300: 1.70, 350: 1.85, 400: 2.00, 450: 2.15, 500: 2.35, 550: 2.50,
  600: 2.60, 650: 2.75, 700: 2.85, 750: 2.95, 800: 3.05, 850: 3.20, 900: 3.30,
  950: 3.40, 1000: 3.50, 1200: 3.80, 1400: 4.20, 1600: 4.60, 1800: 4.90, 2000: 5.25,
  2200: 5.50, 2400: 5.75, 2600: 6.00, 2800: 6.35, 3000: 6.70, 3500: 7.25, 4000: 7.75,
  4500: 8.40, 5000: 9.00
};

export const BARRIES_BOOK_LOOKUP: Record<number, number> = {
  1: 0.1, 2: 0.12, 3: 0.15, 4: 0.18, 5: 0.21, 6: 0.23, 7: 0.24, 8: 0.25, 9: 0.26, 10: 0.27,
  11: 0.28, 12: 0.29, 13: 0.3, 14: 0.31, 15: 0.32, 16: 0.33, 17: 0.34, 18: 0.35, 19: 0.36, 20: 0.38,
  30: 0.42, 40: 0.45, 50: 0.52, 60: 0.64, 70: 0.73, 80: 0.83, 90: 0.92, 100: 1, 110: 1.1, 120: 1.2,
  130: 1.27, 140: 1.35, 150: 1.42, 160: 1.5, 170: 1.57, 180: 1.65, 190: 1.72, 200: 1.8, 240: 1.97,
  280: 2.2, 320: 2.42, 360: 2.57, 400: 2.73, 440: 2.95, 480: 3.1, 520: 3.26, 560: 3.41, 600: 3.48,
  640: 3.64, 680: 3.79, 720: 3.86, 760: 4.01, 800: 4.09, 840: 4.17, 880: 4.32, 920: 4.39, 960: 4.47,
  1000: 4.54, 1040: 4.7, 1080: 4.77, 1120: 4.85, 1160: 5, 1200: 5.07, 1240: 5.15, 1280: 5.23, 1320: 5.38,
  1360: 5.45, 1400: 5.53, 1440: 5.6, 1480: 5.68, 1520: 5.76, 1560: 5.91, 1600: 5.98, 1640: 6.06, 1680: 6.13,
  1720: 6.29, 1760: 6.36, 1800: 6.44, 1840: 6.51, 1880: 6.66, 1920: 6.74, 1960: 6.82, 2000: 6.89, 2040: 7.04,
  2080: 7.12, 2120: 7.19, 2160: 7.27, 2200: 7.42, 2240: 7.5, 2280: 7.57, 2320: 7.65, 2360: 7.8, 2400: 7.88,
  2440: 7.95, 2480: 8.03, 2520: 8.18, 2560: 8.25, 2600: 8.33, 2640: 8.48, 2680: 8.56, 2720: 8.63, 2760: 8.71,
  2800: 8.78, 2840: 8.94, 2880: 9.01, 2920: 9.09, 2960: 9.24, 3000: 9.31, 3040: 9.39, 3080: 9.47, 3120: 9.54,
  3160: 9.69, 3200: 9.77, 3240: 9.84, 3280: 9.92, 3320: 10, 3360: 10.15, 3400: 10.22, 3440: 10.3, 3480: 10.45,
  3520: 10.53, 3560: 10.6, 3600: 10.68, 3640: 10.83, 3680: 10.91, 3720: 10.98, 3760: 11.06, 3800: 11.13,
  3840: 11.28, 3880: 11.36, 3920: 11.44, 3960: 11.51, 4000: 11.66, 4500: 12.83, 5000: 14.11, 5500: 15.52,
  6000: 16.92, 6500: 18.44, 7000: 20.10, 7500: 21.91, 8000: 23.66, 8500: 25.55, 9000: 27.60, 9500: 29.80, 10000: 31.89
};

export const DIN_1988_COEFFS: Record<string, { a: number; b: number; c: number }> = {
  residential: { a: 1.48, b: 0.19, c: 0.94 },
  hospital: { a: 0.75, b: 0.44, c: 0.18 },
  hotel: { a: 0.70, b: 0.48, c: 0.13 },
  school: { a: 0.91, b: 0.31, c: 0.38 },
  office: { a: 0.91, b: 0.31, c: 0.38 },
  assisted_living: { a: 1.48, b: 0.19, c: 0.94 },
  nursing_home: { a: 1.40, b: 0.14, c: 0.92 }
};

// Floor / Step Lookup (returns key_max <= totalLU) matching extracted app.js lookupTableValue
export function lookupTableStep(totalLU: number, tableObj: Record<number, number>): number {
  if (totalLU <= 0) return 0;
  const keys = Object.keys(tableObj).map(Number).sort((a, b) => a - b);
  let closestKey = 0;
  for (const key of keys) {
    if (key <= totalLU) {
      closestKey = key;
    } else {
      break;
    }
  }
  return closestKey in tableObj ? tableObj[closestKey] : 0;
}

// Continuous Linear Interpolation between lookup table keys
export function lookupTableInterpolated(totalLU: number, tableObj: Record<number, number>): number {
  if (totalLU <= 0) return 0;
  const keys = Object.keys(tableObj).map(Number).sort((a, b) => a - b);
  if (totalLU <= keys[0]) return tableObj[keys[0]] * (totalLU / keys[0]);
  for (let i = 0; i < keys.length - 1; i++) {
    const k1 = keys[i];
    const k2 = keys[i + 1];
    if (totalLU >= k1 && totalLU <= k2) {
      const v1 = tableObj[k1];
      const v2 = tableObj[k2];
      return v1 + ((totalLU - k1) / (k2 - k1)) * (v2 - v1);
    }
  }
  const lastKey = keys[keys.length - 1];
  const secondLastKey = keys[keys.length - 2];
  const lastVal = tableObj[lastKey];
  const secondLastVal = tableObj[secondLastKey];
  const slope = (lastVal - secondLastVal) / (lastKey - secondLastKey);
  return lastVal + (totalLU - lastKey) * slope;
}

export function calcDinFlowRate(totalLU: number, buildingType: string = "residential"): number {
  if (totalLU <= 0) return 0;
  if (totalLU <= 0.2) return totalLU;
  const coeff = DIN_1988_COEFFS[buildingType] || DIN_1988_COEFFS.residential;
  return Math.max(0, coeff.a * Math.pow(totalLU, coeff.b) - coeff.c);
}

export function getFlowLPS(
  totalLU: number,
  standard: StandardPreset,
  mode: "interpolated" | "step" = "step"
): number {
  if (totalLU <= 0) return 0;

  const lookupFn = mode === "interpolated" ? lookupTableInterpolated : lookupTableStep;

  switch (standard) {
    case "as_nzs_3500":
      return lookupFn(totalLU, AS_NZS_3500_LOOKUP);
    case "barrie":
      return lookupFn(totalLU, BARRIES_BOOK_LOOKUP);
    case "bs_806":
      return lookupFn(totalLU, BS_EN_806_LOOKUP);
    case "bs_8558":
    case "iop_bs":
    case "iop_low":
    case "iop_med":
    case "iop_high":
      return lookupFn(totalLU, BS_8558_IOP_LOOKUP);
    case "din_res":
      return calcDinFlowRate(totalLU, "residential");
    case "din_hosp":
      return calcDinFlowRate(totalLU, "hospital");
    case "din_hotel":
      return calcDinFlowRate(totalLU, "hotel");
    case "din_school":
      return calcDinFlowRate(totalLU, "school");
    case "din_office":
      return calcDinFlowRate(totalLU, "office");
    case "din_assisted":
      return calcDinFlowRate(totalLU, "assisted_living");
    case "din_nursing":
      return calcDinFlowRate(totalLU, "nursing_home");
    case "ipc":
    case "ipc_upc":
      return lookupFn(totalLU, IPC_LOOKUP);
    case "upc":
      return lookupFn(totalLU, UPC_LOOKUP);
    case "dubai":
      return 0.1 * Math.sqrt(totalLU);
    case "abudhabi": {
      for (let i = 0; i < ADM_TABLE_6_9.length - 1; i++) {
        const curr = ADM_TABLE_6_9[i];
        const next = ADM_TABLE_6_9[i + 1];
        if (totalLU >= curr.wsfu && totalLU <= next.wsfu) {
          const lmin = curr.lmin + ((totalLU - curr.wsfu) / (next.wsfu - curr.wsfu)) * (next.lmin - curr.lmin);
          return lmin / 60; // Convert L/min to L/s
        }
      }
      if (totalLU > 10000) return (2911 + (totalLU - 10000) * 0.2) / 60;
      return 0;
    }
    default:
      return lookupFn(totalLU, BS_8558_IOP_LOOKUP);
  }
}

export function convertFlowRate(
  flowLPS: number,
  targetUnit: "l-sec" | "l-min" | "m3-h" | "gpm"
): { val: number; formatted: string } {
  switch (targetUnit) {
    case "l-min": {
      const val = flowLPS * 60;
      return { val, formatted: `${val.toFixed(2)} L/min` };
    }
    case "l-sec": {
      const val = flowLPS;
      return { val, formatted: `${val.toFixed(3)} L/s` };
    }
    case "m3-h": {
      const val = flowLPS * 3.6;
      return { val, formatted: `${val.toFixed(3)} m³/h` };
    }
    case "gpm": {
      const val = flowLPS * 15.850323074;
      return { val, formatted: `${val.toFixed(2)} GPM` };
    }
    default: {
      const val = flowLPS;
      return { val, formatted: `${val.toFixed(3)} L/s` };
    }
  }
}

// Recommended Pipe Sizing Table (15mm to 200mm) matching Table from Image 2
export const PIPE_SIZING_TABLE = [
  { sizeMM: 15, wsfuRange: "1 to 3", luMax: 3, flowMax: 0.18, q4fps: 0.21372, q5fps: 0.26494, q6fps: 0.32146 },
  { sizeMM: 20, wsfuRange: "3.5 to 6", luMax: 6, flowMax: 0.38, q4fps: 0.37994, q5fps: 0.47100, q6fps: 0.57148 },
  { sizeMM: 25, wsfuRange: "6.5 to 14", luMax: 14, flowMax: 0.70, q4fps: 0.59366, q5fps: 0.73594, q6fps: 0.89294 },
  { sizeMM: 32, wsfuRange: "14.5 to 25", luMax: 25, flowMax: 1.07, q4fps: 0.97265, q5fps: 1.20576, q6fps: 1.46299 },
  { sizeMM: 40, wsfuRange: "25.5 to 30", luMax: 30, flowMax: 1.27, q4fps: 1.51976, q5fps: 1.88400, q6fps: 2.28592 },
  { sizeMM: 50, wsfuRange: "30.5 to 80", luMax: 80, flowMax: 2.40, q4fps: 2.37463, q5fps: 2.94375, q6fps: 3.57175 },
  { sizeMM: 65, wsfuRange: "80.5 to 275", luMax: 275, flowMax: 5.05, q4fps: 4.013116, q5fps: 4.974938, q6fps: 6.036258 },
  { sizeMM: 80, wsfuRange: "275.5 to 500", luMax: 500, flowMax: 7.88, q4fps: 6.07904, q5fps: 7.53600, q6fps: 9.14368 },
  { sizeMM: 100, wsfuRange: "501 to 750", luMax: 750, flowMax: 10.72, q4fps: 9.49850, q5fps: 11.77500, q6fps: 14.28700 },
  { sizeMM: 150, wsfuRange: "750 to 4000", luMax: 4000, flowMax: 33.12, q4fps: 21.371625, q5fps: 26.49375, q6fps: 32.14575 },
  { sizeMM: 200, wsfuRange: "4001 to 10000", luMax: 10000, flowMax: 48.52, q4fps: 37.99400, q5fps: 47.10000, q6fps: 57.14800 }
];

export function getStandardDemandHeaderTitle(standardPreset: StandardPreset): string {
  switch (standardPreset) {
    case "abudhabi":
      return "MEDIUM FREQUENCY APPLICATION";
    case "dubai":
      return "BUILDING WATER DEMAND (DBC / BS EN 806)";
    case "iop_bs":
    case "iop_low":
    case "iop_med":
    case "iop_high":
    case "bs_8558":
    case "bs_806":
      return "INSTITUTE OF PLUMBING DEMAND (IoP PESDG / BS 6700)";
    case "din_res":
    case "din_hosp":
    case "din_hotel":
    case "din_school":
    case "din_office":
    case "din_assisted":
    case "din_nursing":
      return "GERMAN STANDARD DIN 1988-300 DEMAND";
    case "as_nzs_3500":
      return "AUSTRALIAN / NZ STANDARD AS/NZS 3500 DEMAND";
    case "barrie":
      return "BARRIE'S BOOK WATER DEMAND";
    case "ipc":
    case "upc":
    case "ipc_upc":
      return "INTERNATIONAL PLUMBING CODE DEMAND";
    default:
      return "INTERNATIONAL PLUMBING CODE DEMAND";
  }
}

export function getRecommendedPipeSize(lu: number, flowLPS: number): { sizeMM: number; maxFlowLPS: number } {
  for (const entry of PIPE_SIZING_TABLE) {
    if (lu <= entry.luMax || flowLPS <= entry.flowMax) {
      return { sizeMM: entry.sizeMM, maxFlowLPS: entry.flowMax };
    }
  }
  return { sizeMM: 200, maxFlowLPS: 48.52 };
}

function LoadingUnitPage() {
  const { project, forceSaveToCloud } = useWorkspace();
  const [activeTab, setActiveTab] = useState<"spaces" | "report">("spaces");
  const [unitSystem, setUnitSystem] = useState<"si" | "ip">("si");
  const [standardPreset, setStandardPreset] = useState<StandardPreset>("dubai");
  const [selectedCategory, setSelectedCategory] = useState<string>("med");
  const [weightOverrides, setWeightOverrides] = useState<Record<string, number>>({});
  const [intelOpen, setIntelOpen] = useState(false);
  const [iopSpaces, setIopSpaces] = useState<LUSpace[]>([]);
  const [floorSections, setFloorSections] = useState<string[]>(["6th FLOOR"]);
  const [activeFloor, setActiveFloor] = useState<string>("6th FLOOR");
  const [showSpaceQty, setShowSpaceQty] = useState<boolean>(true);
  const [showFloorsCol, setShowFloorsCol] = useState<boolean>(true);

  // Column Width Resizer State (Matching Ventilation / Busbar UI)
  const [luColWidths, setLuColWidths] = useState<Record<string, number>>({
    select: 36,
    desc: 180,
    wc: 60,
    handspray: 60,
    basin: 60,
    sink: 60,
    shower: 60,
    washer: 60,
    servicesink: 60,
    hose_bibb: 60,
    dishwasher: 60,
    hose_bibb_1: 60,
    unitLu: 70,
    spaceQty: 75,
    floorsQty: 75,
    totalLu: 85,
    actions: 60
  });

  const [resizingCol, setResizingCol] = useState<string | null>(null);
  const resizeStartRef = useRef<{ x: number; width: number }>({ x: 0, width: 0 });

  const handleResizeMouseDown = (colKey: string, e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setResizingCol(colKey);
    resizeStartRef.current = { x: e.clientX, width: luColWidths[colKey] || 60 };

    const handleMouseMove = (moveEvent: MouseEvent) => {
      const deltaX = moveEvent.clientX - resizeStartRef.current.x;
      const newWidth = Math.max(36, resizeStartRef.current.width + deltaX);
      setLuColWidths(prev => ({ ...prev, [colKey]: newWidth }));
    };

    const handleMouseUp = () => {
      setResizingCol(null);
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("mouseup", handleMouseUp);
    };

    window.addEventListener("mousemove", handleMouseMove);
    window.addEventListener("mouseup", handleMouseUp);
  };

  // Project / Calculation Header Metadata Block (Matching reference submittal sheet)
  const [calcMeta, setCalcMeta] = useState({
    calcNo: "CEC-MED-P539-202",
    revNo: "1",
    projectNo: "P539",
    projectName: "DH-RA Phase 2 Development Yas Island AUH",
    date: "14.07.2026",
    client: "ALDAR",
    endUser: ""
  });

  // Selection states for Bulk Editing
  const [selectedIds, setSelectedIds] = useState<number[]>([]);
  const [editingSpace, setEditingSpace] = useState<{ space: LUSpace; floor: string } | null>(null);
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number; spaceId: number } | null>(null);
  const [assignCommentOpen, setAssignCommentOpen] = useState(false);
  const [commentTarget, setCommentTarget] = useState<{ id: string; name: string; type: 'space' } | null>(null);

  const [searchQuery, setSearchQuery] = useState("");
  const [showFlaggedOnly, setShowFlaggedOnly] = useState(false);
  const [filterFloor, setFilterFloor] = useState<string>("all");
  const [rowDensity, setRowDensity] = useState<"default" | "compact">("default");
  const [sortBy, setSortBy] = useState<"none" | "desc" | "lu">("none");

  const flagStats = useMemo(() => {
    let totalCount = 0;
    let flaggedCount = 0;
    (iopSpaces || []).forEach((s) => {
      totalCount++;
      if (getLUSpaceValidation(s).isFlagged) flaggedCount++;
    });
    return { totalCount, flaggedCount };
  }, [iopSpaces]);

  const toggleFlagSpace = (targetId: number, currentFlagged: boolean) => {
    const targetIds = selectedIds.includes(targetId) && selectedIds.length > 1
      ? selectedIds
      : [targetId];
    
    const nextState = !currentFlagged;
    setIopSpaces(prev => prev.map(s => targetIds.includes(s.id) ? { ...s, flagged: nextState } : s));
    toast.info(nextState ? `Flagged ${targetIds.length} space(s)` : `Unflagged ${targetIds.length} space(s)`);
  };

  const activeFiltersCount = useMemo(() => {
    let count = 0;
    if (filterFloor !== "all") count++;
    return count;
  }, [filterFloor]);

  const handleResetFilters = () => {
    setFilterFloor("all");
  };

  // Form states
  const [newDesc, setNewDesc] = useState("");
  const [newQty, setNewQty] = useState<number>(1);
  const [newFloorQty, setNewFloorQty] = useState<number>(1);
  const [newFixtures, setNewFixtures] = useState<Record<string, number>>({});
  const [loadedProjectId, setLoadedProjectId] = useState<string | null>(null);

  // Load state from localStorage on project change
  useEffect(() => {
    if (project?.id) {
      try {
        const stored = localStorage.getItem(`mep_loading_unit_calc_${project.id}`);
        if (stored) {
          const data = JSON.parse(stored);
          if (data.unitSystem) setUnitSystem(data.unitSystem);
          if (data.standardPreset) setStandardPreset(data.standardPreset);
          if (data.selectedCategory) {
            setSelectedCategory(data.selectedCategory);
          } else if (data.standardPreset) {
            setSelectedCategory(DEFAULT_CATEGORY_FOR_PRESET[data.standardPreset as StandardPreset] || "med");
          }
          if (data.weightOverrides) setWeightOverrides(data.weightOverrides);
          if (data.calcMeta) setCalcMeta(data.calcMeta);
          if (Array.isArray(data.floorSections)) setFloorSections(data.floorSections);
          if (Array.isArray(data.iopSpaces) && data.iopSpaces.length > 0) {
            setIopSpaces(data.iopSpaces);
            if (data.iopSpaces[0].floor) setActiveFloor(data.iopSpaces[0].floor);
            // Derive floorSections if not present
            if (!data.floorSections) {
              const uniqueFs = Array.from(new Set(data.iopSpaces.map((s: LUSpace) => s.floor || "6th FLOOR")));
              setFloorSections(uniqueFs as string[]);
            }
          }
        } else {
          // Defaults for Dubai Project
          setUnitSystem("si");
          setStandardPreset("dubai");
          setSelectedCategory("med");
          setWeightOverrides({});
          setCalcMeta({
            calcNo: "CEC-MED-P539-202",
            revNo: "1",
            projectNo: "P539",
            projectName: "DH-RA Phase 2 Development Yas Island AUH",
            date: "14.07.2026",
            client: "ALDAR",
            endUser: ""
          });
          setActiveFloor("6th FLOOR");
          setFloorSections(["6th FLOOR"]);
          setIopSpaces([
            {
              id: 1,
              desc: "STUDIO",
              floor: "6th FLOOR",
              qty: 3,
              std: "med",
              fixtures: { wc: 1, handspray: 1, basin: 1, sink: 1, shower: 1, washer: 1, dishwasher: 1 }
            },
            {
              id: 2,
              desc: "1 BHK",
              floor: "6th FLOOR",
              qty: 7,
              std: "med",
              fixtures: { wc: 1, handspray: 1, basin: 1, sink: 1, shower: 1, washer: 1, dishwasher: 1 }
            },
            {
              id: 3,
              desc: "2 BHK",
              floor: "6th FLOOR",
              qty: 4,
              std: "med",
              fixtures: { wc: 2, handspray: 2, basin: 2, sink: 1, shower: 2, washer: 1, dishwasher: 1 }
            }
          ]);
        }
        setTimeout(() => dirtyStore.set(false), 50);
      } catch (e) {
        console.error("Failed to load loading unit calculation", e);
      }
      setLoadedProjectId(project.id);
    }
  }, [project?.id]);

  useEffect(() => {
    if (project?.id && loadedProjectId === project.id) {
      const dataToSave = {
        unitSystem,
        standardPreset,
        selectedCategory,
        weightOverrides,
        calcMeta,
        iopSpaces,
        floorSections
      };
      localStorage.setItem(`mep_loading_unit_calc_${project.id}`, JSON.stringify(dataToSave));
      dirtyStore.set(true);
    }
  }, [project?.id, loadedProjectId, unitSystem, standardPreset, selectedCategory, weightOverrides, calcMeta, iopSpaces, floorSections]);

  // Keyboard Shortcuts (Ctrl+A, Esc, Ctrl+D, Ctrl+S, Delete)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const isInput = ["INPUT", "TEXTAREA", "SELECT"].includes((e.target as HTMLElement)?.tagName);
      const isMac = navigator.platform.toUpperCase().indexOf("MAC") >= 0;
      const isCmdOrCtrl = isMac ? e.metaKey : e.ctrlKey;

      // 1. Esc key: Close modals or deselect rows
      if (e.key === "Escape") {
        if (editingSpace || assignCommentOpen || contextMenu) {
          setEditingSpace(null);
          setAssignCommentOpen(false);
          setContextMenu(null);
        } else {
          setSelectedIds([]);
        }
        return;
      }

      // 2. Ctrl+S / Cmd+S: Save calculation
      if (isCmdOrCtrl && e.key.toLowerCase() === "s") {
        e.preventDefault();
        handleSaveCurrent();
        return;
      }

      // 3. Ctrl+A / Cmd+A: Select All spaces (when not inside a text field)
      if (isCmdOrCtrl && e.key.toLowerCase() === "a") {
        if (!isInput && iopSpaces.length > 0) {
          e.preventDefault();
          setSelectedIds(iopSpaces.map(s => s.id));
        }
        return;
      }

      // 4. Ctrl+D / Cmd+D: Duplicate selected space(s)
      if (isCmdOrCtrl && e.key.toLowerCase() === "d") {
        if (!isInput && selectedIds.length > 0) {
          e.preventDefault();
          handleBulkDuplicate();
        }
        return;
      }

      // 5. Delete / Backspace: Delete selected space(s)
      if (!isInput && (e.key === "Delete" || e.key === "Backspace")) {
        if (selectedIds.length > 0) {
          e.preventDefault();
          handleBulkDelete();
        }
        return;
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [selectedIds, iopSpaces, editingSpace, assignCommentOpen, contextMenu]);

  // Click Outside to Close Context Menu
  useEffect(() => {
    const handleClick = () => setContextMenu(null);
    window.addEventListener("click", handleClick);
    return () => window.removeEventListener("click", handleClick);
  }, []);

  const handleSaveCurrent = () => {
    try {
      if (project?.id) {
        const dataToSave = {
          unitSystem,
          standardPreset,
          selectedCategory,
          weightOverrides,
          iopSpaces,
          floorSections
        };
        localStorage.setItem(`mep_loading_unit_calc_${project.id}`, JSON.stringify(dataToSave));
        dirtyStore.set(false);
        if (forceSaveToCloud) forceSaveToCloud();
        toast.success("Loading Unit Calculation saved to project successfully!");
      }
    } catch (e) {
      toast.error("Failed to save calculation.");
    }
  };

  const ip = unitSystem === "ip";

  // Unique list of floors currently in the list
  const existingFloors = useMemo(() => {
    const set = new Set<string>();
    iopSpaces.forEach(s => set.add(s.floor || "6th FLOOR"));
    if (!set.has(activeFloor)) set.add(activeFloor);
    return Array.from(set);
  }, [iopSpaces, activeFloor]);

  // Dynamic Fixture Weights for current Standard and Category (with user custom weight overrides)
  const activeWeights = useMemo(() => {
    const catDict = STANDARD_FIXTURE_WEIGHTS_BY_CATEGORY[standardPreset];
    const defaultCat = DEFAULT_CATEGORY_FOR_PRESET[standardPreset];
    const stdWeights = catDict[selectedCategory] || catDict[defaultCat] || STANDARD_FIXTURE_WEIGHTS[standardPreset];
    return {
      ...stdWeights,
      ...weightOverrides
    };
  }, [standardPreset, selectedCategory, weightOverrides]);

  const handleResetWeightsToDefault = () => {
    setWeightOverrides({});
    if (project?.id) {
      try {
        const key = `mep_loading_unit_calc_${project.id}`;
        const stored = localStorage.getItem(key);
        if (stored) {
          const data = JSON.parse(stored);
          data.weightOverrides = {};
          localStorage.setItem(key, JSON.stringify(data));
        }
      } catch (e) {}
    }
    toast.info("Reset fixture weights to standard defaults.");
  };

  // Calculations
  const calculations = useMemo(() => {
    let totalLU = 0;
    const spaceUnitLU: Record<number, number> = {};
    const spaceTotalsLU: Record<number, number> = {};
    const catDict = STANDARD_FIXTURE_WEIGHTS_BY_CATEGORY[standardPreset];
    const defaultCat = DEFAULT_CATEGORY_FOR_PRESET[standardPreset];

    iopSpaces.forEach(s => {
      const cat = s.std && catDict[s.std] ? s.std : selectedCategory;
      const baseWeights = catDict[cat] || catDict[defaultCat] || STANDARD_FIXTURE_WEIGHTS[standardPreset];
      // Include custom user overrides for active category
      const weights = (!s.std || s.std === selectedCategory)
        ? { ...baseWeights, ...weightOverrides }
        : baseWeights;

      let unitLU = 0;
      LU_FIXTURES_META.forEach(f => {
        const count = s.fixtures[f.id] || 0;
        if (count > 0) {
          const w = weights[f.id] ?? 0;
          unitLU += count * w;
        }
      });

      const qty = showSpaceQty ? (s.qty || 1) : 1;
      const floorQty = showFloorsCol ? (s.floorQty || 1) : 1;
      const spaceTotal = unitLU * qty * floorQty;

      spaceUnitLU[s.id] = unitLU;
      spaceTotalsLU[s.id] = spaceTotal;
      totalLU += spaceTotal;
    });

    const flowLPS = getFlowLPS(totalLU, standardPreset);
    const flowGPM = flowLPS * 15.8503;
    const selectedFlowLPS = Math.ceil(flowLPS * 2) / 2; // CEILING to nearest 0.5 L/s
    const isWsfu = standardPreset === "abudhabi" || standardPreset === "ipc_upc" || standardPreset === "ipc" || standardPreset === "upc";
    const unitLabel = isWsfu ? "WSFU" : "LU";
    const pipeSizing = getRecommendedPipeSize(totalLU, flowLPS);

    return {
      totalLU,
      spaceUnitLU,
      spaceTotalsLU,
      flowLPS,
      flowGPM,
      selectedFlowLPS,
      pipeSizing,
      unitLabel,
      displayFlow: ip ? `${flowGPM.toFixed(1)} GPM` : `${flowLPS.toFixed(3)} L/s`,
      displaySelectedFlow: ip ? `${(selectedFlowLPS * 15.8503).toFixed(1)} GPM` : `${selectedFlowLPS.toFixed(1)} L/s`
    };
  }, [iopSpaces, standardPreset, selectedCategory, weightOverrides, ip, showSpaceQty, showFloorsCol]);

  const unitLabel = calculations.unitLabel;

  // Selection Handlers
  const handleToggleSelectAll = (checked: boolean) => {
    if (checked) {
      setSelectedIds(iopSpaces.map(s => s.id));
    } else {
      setSelectedIds([]);
    }
  };

  const handleToggleSelect = (id: number, checked: boolean) => {
    if (checked) {
      setSelectedIds([...selectedIds, id]);
    } else {
      setSelectedIds(selectedIds.filter(x => x !== id));
    }
  };

  // Bulk Edit Actions
  const handleBulkMoveFloor = () => {
    if (selectedIds.length === 0) return;
    const newTargetFloor = prompt("Enter target Floor Section for selected space(s):", activeFloor);
    if (newTargetFloor && newTargetFloor.trim()) {
      const cleanFloor = newTargetFloor.trim().toUpperCase();
      setIopSpaces(iopSpaces.map(s => {
        if (selectedIds.includes(s.id)) {
          return { ...s, floor: cleanFloor };
        }
        return s;
      }));
      toast.success(`Moved ${selectedIds.length} space(s) to ${cleanFloor}`);
    }
  };

  const handleBulkEditQty = () => {
    if (selectedIds.length === 0) return;
    const newQtyVal = prompt("Enter new Quantity for selected space(s):", "1");
    if (newQtyVal && !isNaN(Number(newQtyVal))) {
      const qtyNum = Math.max(1, Number(newQtyVal));
      setIopSpaces(iopSpaces.map(s => {
        if (selectedIds.includes(s.id)) {
          return { ...s, qty: qtyNum };
        }
        return s;
      }));
      toast.success(`Updated Qty to ${qtyNum} for ${selectedIds.length} space(s)`);
    }
  };

  const handleBulkDuplicate = () => {
    if (selectedIds.length === 0) return;
    const clones: LUSpace[] = [];
    iopSpaces.forEach(s => {
      if (selectedIds.includes(s.id)) {
        clones.push({
          ...s,
          id: Date.now() + Math.random(),
          desc: `${s.desc} (Copy)`
        });
      }
    });
    setIopSpaces([...iopSpaces, ...clones]);
    toast.success(`Duplicated ${clones.length} space(s)`);
  };

  const handleBulkDelete = () => {
    if (selectedIds.length === 0) return;
    const count = selectedIds.length;
    setIopSpaces(iopSpaces.filter(s => !selectedIds.includes(s.id)));
    setSelectedIds([]);
    toast.info(`Deleted ${count} space(s)`);
  };

  const handleAddSpace = () => {
    const targetFloor = activeFloor || floorSections[0] || "6th FLOOR";
    const nextId = Date.now();
    setIopSpaces(prev => [...prev, {
      id: nextId,
      desc: "New Space",
      floor: targetFloor,
      qty: 1,
      floorQty: 1,
      std: selectedCategory || "med",
      fixtures: { wc: 1, basin: 1 }
    }]);
    toast.success("Added new space");
  };

  const handleAddSpaceToFloor = (floorTarget: string) => {
    if (!newDesc.trim()) {
      toast.error("Please enter a space description (e.g. 1 BHK)");
      return;
    }
    const fixturesCleaned: Record<string, number> = {};
    LU_FIXTURES_META.forEach(f => {
      const q = newFixtures[f.id] || 0;
      if (q > 0) fixturesCleaned[f.id] = q;
    });

    setIopSpaces([...iopSpaces, {
      id: Date.now(),
      desc: newDesc.trim(),
      floor: floorTarget,
      qty: Math.max(1, newQty || 1),
      floorQty: Math.max(1, newFloorQty || 1),
      std: "med",
      fixtures: fixturesCleaned
    }]);

    setNewDesc("");
    setNewQty(1);
    setNewFloorQty(1);
    setNewFixtures({});
    toast.success(`Added space to ${floorTarget}`);
  };

  const handleAddNewFloorSection = () => {
    const nextNum = floorSections.length + 6;
    const cleanName = `${nextNum}th FLOOR`;
    if (!floorSections.includes(cleanName)) {
      setFloorSections([...floorSections, cleanName]);
    }
    setActiveFloor(cleanName);
    toast.success(`Created ${cleanName} section. You can now add spaces to it.`);
  };

  const handleRenameFloorGroup = (oldFloorName: string, newFloorName: string) => {
    const clean = newFloorName.trim();
    if (!clean || clean === oldFloorName) return;
    setFloorSections(floorSections.map(f => f === oldFloorName ? clean : f));
    setIopSpaces(iopSpaces.map(s => {
      if ((s.floor || "6th FLOOR") === oldFloorName) {
        return { ...s, floor: clean };
      }
      return s;
    }));
    if (activeFloor === oldFloorName) {
      setActiveFloor(clean);
    }
  };

  const handleDeleteFloorGroup = (floorToDelete: string) => {
    if (confirm(`Delete floor section ${floorToDelete} and all its spaces?`)) {
      setFloorSections(floorSections.filter(f => f !== floorToDelete));
      setIopSpaces(iopSpaces.filter(s => s.floor !== floorToDelete));
      toast.info(`Deleted ${floorToDelete} section`);
    }
  };

  const handleFixtureChange = (spaceId: number, fixtureId: string, val: number) => {
    const targets = selectedIds.includes(spaceId) && selectedIds.length > 1 ? selectedIds : [spaceId];
    setIopSpaces(iopSpaces.map(s => {
      if (targets.includes(s.id)) {
        return {
          ...s,
          fixtures: {
            ...s.fixtures,
            [fixtureId]: Math.max(0, val)
          }
        };
      }
      return s;
    }));
  };

  const handleSpaceDescChange = (spaceId: number, val: string) => {
    const targets = selectedIds.includes(spaceId) && selectedIds.length > 1 ? selectedIds : [spaceId];
    setIopSpaces(iopSpaces.map(s => {
      if (targets.includes(s.id)) {
        return {
          ...s,
          desc: val
        };
      }
      return s;
    }));
  };

  const handleQtyChange = (spaceId: number, val: number) => {
    const targets = selectedIds.includes(spaceId) && selectedIds.length > 1 ? selectedIds : [spaceId];
    setIopSpaces(iopSpaces.map(s => {
      if (targets.includes(s.id)) {
        return {
          ...s,
          qty: Math.max(1, val)
        };
      }
      return s;
    }));
  };

  const handleFloorQtyChange = (spaceId: number, val: number) => {
    const targets = selectedIds.includes(spaceId) && selectedIds.length > 1 ? selectedIds : [spaceId];
    setIopSpaces(iopSpaces.map(s => {
      if (targets.includes(s.id)) {
        return {
          ...s,
          floorQty: Math.max(1, val)
        };
      }
      return s;
    }));
  };

  // Right Click Handler
  const handleContextMenu = (e: React.MouseEvent, spaceId: number) => {
    e.preventDefault();
    if (!selectedIds.includes(spaceId)) {
      setSelectedIds([spaceId]);
    }
    setContextMenu({ x: e.clientX, y: e.clientY, spaceId });
  };

  // Helper to convert 1-based col number to Excel column letter (e.g. 1 -> A, 14 -> N)
  const getColLetter = (colIdx: number): string => {
    let temp = "";
    let letter = "";
    while (colIdx > 0) {
      temp = (colIdx - 1) % 26;
      letter = String.fromCharCode(65 + temp) + letter;
      colIdx = Math.floor((colIdx - temp - 1) / 26);
    }
    return letter;
  };

  // Excel Export matching P539B Excel Sheet Format
  const handleExportExcel = async () => {
    try {
      const workbook = new ExcelJS.Workbook();
      const sheetName = standardPreset === "abudhabi" 
        ? "COLD WATER LOADING UNIT B" 
        : standardPreset === "dubai" 
        ? "COLD WATER LOADING UNIT D" 
        : standardPreset === "iop_bs"
        ? "COLD WATER LOADING UNIT IoP"
        : "COLD WATER LOADING UNIT I";
      
      const sheet = workbook.addWorksheet(sheetName);

      const activeFixtures = LU_FIXTURES_META;
      const numFixtures = activeFixtures.length; // 10
      const extraCols = (showSpaceQty ? 1 : 0) + (showFloorsCol ? 1 : 0);
      const totalCols = 1 + numFixtures + 1 + extraCols + 1; // 1 (Desc) + numFixtures + 1 (Unit LU) + extraCols + 1 (TOTAL LU)
      const lastColLetter = getColLetter(totalCols);

      const currentWeights = STANDARD_FIXTURE_WEIGHTS[standardPreset];
      const isWsfu = standardPreset === "abudhabi" || standardPreset === "ipc_upc";
      const unitLabel = isWsfu ? "WSFU" : "LU";

      // 1. Column Widths matching P539B
      sheet.getColumn(1).width = 25; // Description
      for (let c = 2; c <= 1 + numFixtures; c++) {
        sheet.getColumn(c).width = 13; // Fixtures
      }
      let currCol = 1 + numFixtures + 1; // Col for LU per Space
      sheet.getColumn(currCol).width = 13;
      const luColLet = getColLetter(currCol);

      let qtyColLet = "";
      if (showSpaceQty) {
        currCol++;
        sheet.getColumn(currCol).width = 11;
        qtyColLet = getColLetter(currCol);
      }

      let floorQtyColLet = "";
      if (showFloorsCol) {
        currCol++;
        sheet.getColumn(currCol).width = 13;
        floorQtyColLet = getColLetter(currCol);
      }

      currCol++;
      sheet.getColumn(currCol).width = 14;
      const totalLUColLet = getColLetter(currCol);

      // Helper styles
      const fontCambria11Bold = { name: "Cambria", size: 11, bold: true };
      const fontCambria11 = { name: "Cambria", size: 11, bold: false };
      const fontCambria10Bold = { name: "Cambria", size: 10, bold: true };
      const fillHeader = { type: "pattern" as const, pattern: "solid" as const, fgColor: { argb: "FFEFECE1" } };
      const fillBanner = { type: "pattern" as const, pattern: "solid" as const, fgColor: { argb: "FFF2DCDB" } };
      const fillPeach = { type: "pattern" as const, pattern: "solid" as const, fgColor: { argb: "FFFDEBDA" } };

      const borderThinAll: Partial<ExcelJS.Borders> = {
        top: { style: "thin" },
        bottom: { style: "thin" },
        left: { style: "thin" },
        right: { style: "thin" }
      };

      // 2. Fetch Project Metadata (matching Ventilation Calculation)
      const activeProj: any = workspaceStore.getState()?.project || project || {};
      const projectNo = activeProj.code || activeProj.project_number || activeProj.projectNumber || 'P539';
      const calcNo = activeProj.calcNo || activeProj.calc_number || `CEC-MED-${projectNo}-202   Rev. No:1`;
      const today = new Date().toLocaleDateString('en-GB');
      const projectName = activeProj.name || activeProj.project_name || activeProj.projectName || '';
      const clientName = activeProj.client || activeProj.client_name || activeProj.clientName || '';
      const endUser = activeProj.endUser || activeProj.end_user || activeProj.location || '';

      // Title Row (Row 2)
      sheet.getRow(2).height = 26;
      sheet.getCell("A2").value = "Loading Unit & Pipe Sizing Calculation";
      sheet.getCell("A2").font = { name: "Cambria", size: 16, bold: true };

      // Metadata Header Box (Rows 4-6)
      const splitColIndex = Math.max(6, Math.floor(totalCols / 2));
      const splitColLetter = getColLetter(splitColIndex);
      const splitColPlusLetter = getColLetter(splitColIndex + 1);

      // Row 4
      sheet.mergeCells(`A4:${splitColLetter}4`);
      sheet.mergeCells(`${splitColPlusLetter}4:${lastColLetter}4`);
      sheet.getCell("A4").value = `Calculation No.:   ${calcNo}`;
      sheet.getCell(`${splitColPlusLetter}4`).value = `Date:   ${today}`;

      // Row 5
      sheet.mergeCells(`A5:${splitColLetter}5`);
      sheet.mergeCells(`${splitColPlusLetter}5:${lastColLetter}5`);
      sheet.getCell("A5").value = `Project No.:   ${projectNo}`;
      sheet.getCell(`${splitColPlusLetter}5`).value = `Client:   ${clientName}`;

      // Row 6
      sheet.mergeCells(`A6:${splitColLetter}6`);
      sheet.mergeCells(`${splitColPlusLetter}6:${lastColLetter}6`);
      sheet.getCell("A6").value = `Project Name:   ${projectName}`;
      sheet.getCell(`${splitColPlusLetter}6`).value = `End User:   ${endUser}`;

      // Style Rows 4-6
      for (let r = 4; r <= 6; r++) {
        sheet.getRow(r).height = 22;
        for (let c = 1; c <= totalCols; c++) {
          const cell = sheet.getCell(r, c);
          cell.font = fontCambria11Bold;
          const topStyle = r === 4 ? "medium" : "thin";
          const bottomStyle = r === 6 ? "medium" : "thin";
          const leftStyle = (c === 1 || c === splitColIndex + 1) ? "medium" : "thin";
          const rightStyle = (c === totalCols || c === splitColIndex) ? "medium" : "thin";

          cell.border = {
            top: { style: topStyle },
            bottom: { style: bottomStyle },
            left: { style: leftStyle },
            right: { style: rightStyle }
          };
          cell.alignment = { vertical: "middle", horizontal: "left" };
        }
      }

      // 3. Table Header Rows (Rows 8 & 9)
      sheet.getRow(8).height = 43;
      sheet.getRow(9).height = 30;

      // Col A: Description (A8:A9)
      sheet.mergeCells("A8:A9");
      sheet.getCell("A8").value = "Description";

      // Fixtures: Row 8 (Name), Row 9 (Weight)
      activeFixtures.forEach((f, idx) => {
        const colIdx = 2 + idx;
        const colLet = getColLetter(colIdx);
        sheet.getCell(`${colLet}8`).value = f.short;
        sheet.getCell(`${colLet}9`).value = currentWeights[f.id] || 0;
      });

      // LU / WSFU per Space
      sheet.mergeCells(`${luColLet}8:${luColLet}9`);
      sheet.getCell(`${luColLet}8`).value = isWsfu ? "WSFU" : "LU per Space";

      if (showSpaceQty && qtyColLet) {
        sheet.mergeCells(`${qtyColLet}8:${qtyColLet}9`);
        sheet.getCell(`${qtyColLet}8`).value = "Space Qty";
      }

      if (showFloorsCol && floorQtyColLet) {
        sheet.mergeCells(`${floorQtyColLet}8:${floorQtyColLet}9`);
        sheet.getCell(`${floorQtyColLet}8`).value = "No. of Floors";
      }

      sheet.mergeCells(`${totalLUColLet}8:${totalLUColLet}9`);
      sheet.getCell(`${totalLUColLet}8`).value = isWsfu ? "TOTAL WSFU" : "TOTAL LU";

      // Style Header Rows 8 & 9
      [8, 9].forEach(r => {
        for (let c = 1; c <= totalCols; c++) {
          const cell = sheet.getCell(r, c);
          cell.font = fontCambria11Bold;
          cell.fill = fillHeader;
          cell.alignment = { vertical: "middle", horizontal: "center", wrapText: true };
          cell.border = {
            top: r === 8 ? { style: "medium" } : { style: "thin" },
            bottom: r === 9 ? { style: "medium" } : { style: "thin" },
            left: c === 1 ? { style: "medium" } : { style: "thin" },
            right: c === totalCols ? { style: "medium" } : { style: "thin" },
          };
        }
      });

      // 4. Data Rows (Grouped by Floor Section)
      let r = 10;
      const firstFixColLet = "B";
      const lastFixColLet = getColLetter(1 + numFixtures);

      const spaceTotalCellRefs: string[] = [];

      // Determine unique floors from iopSpaces or floorSections
      const activeFloors = floorSections.length > 0 ? floorSections : Array.from(new Set(iopSpaces.map(s => s.floor || "6th FLOOR")));

      activeFloors.forEach(flName => {
        const floorSpaces = iopSpaces.filter(s => (s.floor || activeFloors[0]) === flName);
        if (floorSpaces.length === 0) return;

        // Floor Section Header Banner Row
        sheet.getRow(r).height = 25;
        sheet.mergeCells(`A${r}:${lastColLetter}${r}`);
        const bannerCell = sheet.getCell(`A${r}`);
        bannerCell.value = flName.toUpperCase();
        bannerCell.font = fontCambria11Bold;
        bannerCell.fill = fillBanner;
        bannerCell.alignment = { vertical: "middle", horizontal: "center" };

        for (let c = 1; c <= totalCols; c++) {
          sheet.getCell(r, c).border = {
            top: { style: "medium" },
            bottom: { style: "medium" },
            left: c === 1 ? { style: "medium" } : { style: "thin" },
            right: c === totalCols ? { style: "medium" } : { style: "thin" },
          };
        }
        r++;

        // Space Data Rows
        floorSpaces.forEach(s => {
          sheet.getRow(r).height = 25;

          // Col A: Description
          const cellA = sheet.getCell(`A${r}`);
          cellA.value = s.desc;
          cellA.font = fontCambria11;
          cellA.alignment = { vertical: "middle", horizontal: "left" };
          cellA.border = { top: { style: "thin" }, bottom: { style: "thin" }, left: { style: "medium" }, right: { style: "thin" } };

          // Fixture Counts
          activeFixtures.forEach((f, idx) => {
            const colIdx = 2 + idx;
            const cell = sheet.getCell(r, colIdx);
            const count = s.fixtures[f.id] || 0;
            if (count > 0) cell.value = count;
            cell.font = fontCambria11Bold;
            cell.alignment = { vertical: "middle", horizontal: "center" };
            cell.numFmt = "0";
            cell.border = borderThinAll;
          });

          // Unit LU Formula: =SUMPRODUCT(B10:L10, $B$9:$L$9)
          const luCell = sheet.getCell(`${luColLet}${r}`);
          luCell.value = { formula: `SUMPRODUCT(${firstFixColLet}${r}:${lastFixColLet}${r},$${firstFixColLet}$9:$${lastFixColLet}$9)` };
          luCell.font = fontCambria11Bold;
          luCell.alignment = { vertical: "middle", horizontal: "center" };
          luCell.numFmt = "0.0";
          luCell.border = borderThinAll;

          let formulaParts = [`${luColLet}${r}`];

          if (showSpaceQty && qtyColLet) {
            const qtyCell = sheet.getCell(`${qtyColLet}${r}`);
            qtyCell.value = s.qty || 1;
            qtyCell.font = fontCambria11Bold;
            qtyCell.alignment = { vertical: "middle", horizontal: "center" };
            qtyCell.numFmt = "0";
            qtyCell.border = borderThinAll;
            formulaParts.push(`${qtyColLet}${r}`);
          }

          if (showFloorsCol && floorQtyColLet) {
            const floorQtyCell = sheet.getCell(`${floorQtyColLet}${r}`);
            floorQtyCell.value = s.floorQty || 1;
            floorQtyCell.font = fontCambria11Bold;
            floorQtyCell.alignment = { vertical: "middle", horizontal: "center" };
            floorQtyCell.numFmt = "0";
            floorQtyCell.border = borderThinAll;
            formulaParts.push(`${floorQtyColLet}${r}`);
          }

          const totalLUCell = sheet.getCell(`${totalLUColLet}${r}`);
          totalLUCell.value = { formula: formulaParts.join("*") };
          totalLUCell.font = fontCambria11Bold;
          totalLUCell.alignment = { vertical: "middle", horizontal: "center" };
          totalLUCell.numFmt = "0.0";
          totalLUCell.border = { top: { style: "thin" }, bottom: { style: "thin" }, left: { style: "thin" }, right: { style: "medium" } };

          spaceTotalCellRefs.push(`${totalLUColLet}${r}`);
          r++;
        });
      });

      // 5. Grand Total Row
      const grandTotalRow = r;
      sheet.getRow(grandTotalRow).height = 25;

      for (let c = 1; c <= totalCols; c++) {
        const cell = sheet.getCell(grandTotalRow, c);
        cell.border = {
          top: { style: "medium" },
          bottom: { style: "medium" },
          left: c === 1 ? { style: "medium" } : { style: "thin" },
          right: c === totalCols ? { style: "medium" } : { style: "thin" },
        };
      }

      const grandTotalCell = sheet.getCell(`${totalLUColLet}${grandTotalRow}`);
      grandTotalCell.value = spaceTotalCellRefs.length > 0 ? { formula: `SUM(${spaceTotalCellRefs.join(",")})` } : 0;
      grandTotalCell.font = { name: "Cambria", size: 11, bold: true, color: { argb: "FFFF0000" } }; // Red font in template
      grandTotalCell.fill = fillHeader;
      grandTotalCell.alignment = { vertical: "middle", horizontal: "center" };
      grandTotalCell.numFmt = "0.0";
      r++;

      // Spacer
      r++;

      // 6. Sizing & Booster Pump Summary Block
      sheet.getRow(r).height = 25;
      sheet.mergeCells(`A${r}:B${r}`);
      const appCell = sheet.getCell(`A${r}`);
      appCell.value = getStandardDemandHeaderTitle(standardPreset);
      appCell.font = fontCambria11Bold;
      appCell.alignment = { vertical: "middle", horizontal: "center" };
      appCell.border = { top: { style: "thin" }, bottom: { style: "thin" }, left: { style: "medium" }, right: { style: "thin" } };
      r++;

      sheet.getRow(r).height = 25;
      sheet.getCell(`A${r}`).value = "No of Booster Pump    ";
      sheet.getCell(`A${r}`).font = fontCambria11;
      sheet.getCell(`A${r}`).alignment = { vertical: "middle", horizontal: "left" };
      sheet.getCell(`A${r}`).border = { top: { style: "thin" }, bottom: { style: "thin" }, left: { style: "medium" }, right: { style: "thin" } };
      
      sheet.getCell(`B${r}`).value = "1W+1A+\n1S";
      sheet.getCell(`B${r}`).font = fontCambria11;
      sheet.getCell(`B${r}`).alignment = { vertical: "middle", horizontal: "center", wrapText: true };
      sheet.getCell(`B${r}`).border = borderThinAll;
      r++;

      sheet.getRow(r).height = 25;
      sheet.getCell(`A${r}`).value = `Total Water Supply Fixture Units (${unitLabel})`;
      sheet.getCell(`A${r}`).font = fontCambria11;
      sheet.getCell(`A${r}`).alignment = { vertical: "middle", horizontal: "left" };
      sheet.getCell(`A${r}`).border = { top: { style: "thin" }, bottom: { style: "thin" }, left: { style: "medium" }, right: { style: "thin" } };

      sheet.getCell(`B${r}`).value = { formula: `${totalLUColLet}${grandTotalRow}` };
      sheet.getCell(`B${r}`).font = fontCambria11;
      sheet.getCell(`B${r}`).alignment = { vertical: "middle", horizontal: "center" };
      sheet.getCell(`B${r}`).numFmt = "0.0";
      sheet.getCell(`B${r}`).border = borderThinAll;
      r++;

      sheet.getRow(r).height = 24;
      const flowRow = r;
      sheet.getCell(`A${r}`).value = "Flow due to loading unit (l/s)";
      sheet.getCell(`A${r}`).font = fontCambria11;
      sheet.getCell(`A${r}`).alignment = { vertical: "middle", horizontal: "left" };
      sheet.getCell(`A${r}`).border = { top: { style: "thin" }, bottom: { style: "thin" }, left: { style: "medium" }, right: { style: "thin" } };

      sheet.getCell(`B${r}`).value = Number(calculations.flowLPS.toFixed(3));
      sheet.getCell(`B${r}`).font = fontCambria11;
      sheet.getCell(`B${r}`).alignment = { vertical: "middle", horizontal: "center" };
      sheet.getCell(`B${r}`).numFmt = "0.000";
      sheet.getCell(`B${r}`).border = borderThinAll;
      r++;

      sheet.getRow(r).height = 25;
      sheet.getCell(`A${r}`).value = "Total Water demand considered (l/s)";
      sheet.getCell(`A${r}`).font = fontCambria11;
      sheet.getCell(`A${r}`).alignment = { vertical: "middle", horizontal: "left" };
      sheet.getCell(`A${r}`).border = { top: { style: "thin" }, bottom: { style: "thin" }, left: { style: "medium" }, right: { style: "thin" } };

      sheet.getCell(`B${r}`).value = { formula: `CEILING(B${flowRow},0.5)` };
      sheet.getCell(`B${r}`).font = fontCambria11;
      sheet.getCell(`B${r}`).alignment = { vertical: "middle", horizontal: "center" };
      sheet.getCell(`B${r}`).numFmt = "0.0";
      sheet.getCell(`B${r}`).border = borderThinAll;
      r++;

      sheet.getRow(r).height = 23;
      sheet.getCell(`A${r}`).value = "Diversity (if any)";
      sheet.getCell(`A${r}`).font = fontCambria11;
      sheet.getCell(`A${r}`).alignment = { vertical: "middle", horizontal: "left" };
      sheet.getCell(`A${r}`).border = { top: { style: "thin" }, bottom: { style: "thin" }, left: { style: "medium" }, right: { style: "thin" } };

      sheet.getCell(`B${r}`).value = "";
      sheet.getCell(`B${r}`).font = fontCambria11;
      sheet.getCell(`B${r}`).alignment = { vertical: "middle", horizontal: "center" };
      sheet.getCell(`B${r}`).border = borderThinAll;
      r++;

      sheet.getRow(r).height = 25;
      sheet.getCell(`A${r}`).value = "Selected Water Flow Rate (Q) L/s";
      sheet.getCell(`A${r}`).font = fontCambria10Bold;
      sheet.getCell(`A${r}`).fill = fillHeader;
      sheet.getCell(`A${r}`).alignment = { vertical: "middle", horizontal: "center", wrapText: true };
      sheet.getCell(`A${r}`).border = { top: { style: "thin" }, bottom: { style: "thin" }, left: { style: "medium" }, right: { style: "thin" } };

      sheet.getCell(`B${r}`).value = { formula: `CEILING(B${flowRow},0.5)` };
      sheet.getCell(`B${r}`).font = fontCambria10Bold;
      sheet.getCell(`B${r}`).fill = fillHeader;
      sheet.getCell(`B${r}`).alignment = { vertical: "middle", horizontal: "center" };
      sheet.getCell(`B${r}`).numFmt = "0.0";
      sheet.getCell(`B${r}`).border = borderThinAll;
      r++;

      // Spacer
      r++;

      // 7. Signature Block
      let currentUserName = "";
      if (typeof window !== "undefined") {
        try {
          const user = JSON.parse(localStorage.getItem('mep_user') || '{}');
          const profile = JSON.parse(localStorage.getItem('mep_user_data') || localStorage.getItem('mep_profile') || '{}');
          currentUserName = user.name || user.user?.name || profile.name || profile.user?.name || (window as any).currentMepUserName || "";
        } catch (e) {}
      }

      const { originatedName, originatedDate, reviewerName, reviewerDate, approverName, approverDate } = getSignatureBlockDetails((project as any)?.id || "default", "/plumbing-loading-unit", currentUserName);

      // Header row
      sheet.getRow(r).height = 22;
      sheet.getCell(`A${r}`).value = "";
      sheet.getCell(`A${r}`).border = { top: { style: "medium" }, bottom: { style: "thin" }, left: { style: "medium" }, right: { style: "thin" } };

      sheet.mergeCells(`B${r}:E${r}`);
      sheet.getCell(`B${r}`).value = "Originated by";

      sheet.mergeCells(`F${r}:G${r}`);
      sheet.getCell(`F${r}`).value = "Reviewed by";

      sheet.mergeCells(`H${r}:${lastColLetter}${r}`);
      sheet.getCell(`H${r}`).value = "Approved by";

      [ `B${r}`, `F${r}`, `H${r}` ].forEach(cellRef => {
        const c = sheet.getCell(cellRef);
        c.font = fontCambria11Bold;
        c.fill = fillPeach;
        c.alignment = { vertical: "middle", horizontal: "center" };
      });
      for (let c = 2; c <= totalCols; c++) {
        sheet.getCell(r, c).border = { top: { style: "medium" }, bottom: { style: "thin" }, left: { style: "thin" }, right: c === totalCols ? { style: "medium" } : { style: "thin" } };
      }
      r++;

      // Name row
      sheet.getRow(r).height = 20;
      sheet.getCell(`A${r}`).value = "Name:";
      sheet.getCell(`A${r}`).font = fontCambria11;
      sheet.getCell(`A${r}`).alignment = { vertical: "middle", horizontal: "left" };
      sheet.getCell(`A${r}`).border = { top: { style: "thin" }, bottom: { style: "thin" }, left: { style: "medium" }, right: { style: "thin" } };

      sheet.mergeCells(`B${r}:E${r}`);
      sheet.getCell(`B${r}`).value = originatedName;

      sheet.mergeCells(`F${r}:G${r}`);
      sheet.getCell(`F${r}`).value = reviewerName;

      sheet.mergeCells(`H${r}:${lastColLetter}${r}`);
      sheet.getCell(`H${r}`).value = approverName;

      [ `B${r}`, `F${r}`, `H${r}` ].forEach(cellRef => {
        const c = sheet.getCell(cellRef);
        c.font = fontCambria11Bold;
        c.alignment = { vertical: "middle", horizontal: "center" };
      });
      for (let c = 2; c <= totalCols; c++) {
        sheet.getCell(r, c).border = { top: { style: "thin" }, bottom: { style: "thin" }, left: { style: "thin" }, right: c === totalCols ? { style: "medium" } : { style: "thin" } };
      }
      r++;

      // Signature row
      sheet.getRow(r).height = 22;
      sheet.getCell(`A${r}`).value = "Signature:";
      sheet.getCell(`A${r}`).font = fontCambria11;
      sheet.getCell(`A${r}`).alignment = { vertical: "middle", horizontal: "left" };
      sheet.getCell(`A${r}`).border = { top: { style: "thin" }, bottom: { style: "thin" }, left: { style: "medium" }, right: { style: "thin" } };

      sheet.mergeCells(`B${r}:E${r}`);
      sheet.mergeCells(`F${r}:G${r}`);
      sheet.mergeCells(`H${r}:${lastColLetter}${r}`);

      for (let c = 2; c <= totalCols; c++) {
        sheet.getCell(r, c).border = { top: { style: "thin" }, bottom: { style: "thin" }, left: { style: "thin" }, right: c === totalCols ? { style: "medium" } : { style: "thin" } };
      }
      r++;

      // Date row
      sheet.getRow(r).height = 24;
      sheet.getCell(`A${r}`).value = "Date:";
      sheet.getCell(`A${r}`).font = fontCambria11;
      sheet.getCell(`A${r}`).alignment = { vertical: "middle", horizontal: "left" };
      sheet.getCell(`A${r}`).border = { top: { style: "thin" }, bottom: { style: "medium" }, left: { style: "medium" }, right: { style: "thin" } };

      sheet.mergeCells(`B${r}:E${r}`);
      sheet.getCell(`B${r}`).value = originatedDate;

      sheet.mergeCells(`F${r}:G${r}`);
      sheet.getCell(`F${r}`).value = reviewerDate;

      sheet.mergeCells(`H${r}:${lastColLetter}${r}`);
      sheet.getCell(`H${r}`).value = approverDate;

      [ `B${r}`, `F${r}`, `H${r}` ].forEach(cellRef => {
        const c = sheet.getCell(cellRef);
        c.font = fontCambria11;
        c.alignment = { vertical: "middle", horizontal: "center" };
      });
      for (let c = 2; c <= totalCols; c++) {
        sheet.getCell(r, c).border = { top: { style: "thin" }, bottom: { style: "medium" }, left: { style: "thin" }, right: c === totalCols ? { style: "medium" } : { style: "thin" } };
      }

      // Buffer & Download
      const xlsxBuffer = await workbook.xlsx.writeBuffer();
      downloadFile(new Uint8Array(xlsxBuffer), `Loading_Unit_Calculation_${standardPreset.toUpperCase()}.xlsx`, "Excel Document", ["xlsx"]);
      toast.success("Excel exported successfully!");
    } catch (err) {
      console.error("Excel export error:", err);
      toast.error("Failed to generate Excel export.");
    }
  };

  // PDF Export Function (Matching Ventilation PDF Format & Corporate Standards)
  const handleExportPDF = async () => {
    try {
      const jsPDFModule = await import('jspdf');
      const jsPDF = jsPDFModule.default || (jsPDFModule as any).jsPDF;
      const autoTableModule = await import('jspdf-autotable');
      const autoTable = autoTableModule.default || autoTableModule;

      // A4 Landscape Mode (Width: 297mm, Content Width: 269mm)
      const doc = new jsPDF("l", "mm", "a4");

      const activeProj: any = workspaceStore.getState()?.project || project || {};
      const projectNo = activeProj.code || activeProj.project_number || activeProj.projectNumber || calcMeta.projectNo || 'P539';
      const calcNo = activeProj.calcNo || activeProj.calc_number || calcMeta.calcNo || `CEC-MED-${projectNo}-202 Rev. No:1`;

      // 1. Add Title & Metadata Header Box (Matching Ventilation PDF Header exactly)
      let startY = addPdfHeader(doc, "Loading Unit & Pipe Sizing Calculation Report", {
        calcNo,
        projectNo,
        projectName: activeProj.name || activeProj.project_name || calcMeta.projectName || '',
        client: activeProj.client || activeProj.client_name || calcMeta.client || '',
        endUser: activeProj.endUser || activeProj.location || calcMeta.endUser || '',
        date: calcMeta.date || undefined,
      });

      const activeFixtures = LU_FIXTURES_META;
      const isWsfu = standardPreset === "abudhabi" || standardPreset === "ipc_upc";
      const unitLabel = isWsfu ? "WSFU" : "LU";

      const FIXTURE_LABELS: Record<string, string> = {
        wc: "W/C",
        handspray: "Hand Spray",
        basin: "Wash Basin",
        sink: "Sink Kitchen",
        shower: "Shower",
        washer: "Washing M/c",
        servicesink: "Service Sink",
        hose_bibb: "Hose Bibb",
        dishwasher: "Dishwasher",
        hose_bibb_1: "Bib Tap"
      };

      // 2. Main Fixture Schedule Headers (3-Tier Multi-Level Headers with separate Weight Value Row)
      const primaryFill: [number, number, number] = [217, 217, 217];
      const summaryColSpan = 1 + (showSpaceQty ? 1 : 0) + (showFloorsCol ? 1 : 0) + 1;
      const totalHeaderCols = 1 + activeFixtures.length + summaryColSpan;

      const multiLevelHeaders = [
        [
          { content: "Description", rowSpan: 3, styles: { fillColor: primaryFill, textColor: [0, 0, 0], fontStyle: "bold", valign: "middle", halign: "center" } },
          { content: "Sanitary Fixture Quantities", colSpan: activeFixtures.length, styles: { fillColor: primaryFill, textColor: [0, 0, 0], fontStyle: "bold", halign: "center", valign: "middle" } },
          { content: "Loading Unit Summary", colSpan: summaryColSpan, styles: { fillColor: primaryFill, textColor: [0, 0, 0], fontStyle: "bold", halign: "center", valign: "middle" } }
        ],
        [
          ...activeFixtures.map(f => {
            const label = FIXTURE_LABELS[f.id] || f.short || f.id.toUpperCase();
            return { content: label, styles: { fillColor: primaryFill, textColor: [0, 0, 0], fontStyle: "bold", halign: "center", valign: "middle" } };
          }),
          { content: `${unitLabel} /\nSpace`, rowSpan: 2, styles: { fillColor: primaryFill, textColor: [0, 0, 0], fontStyle: "bold", halign: "center", valign: "middle" } },
          ...(showSpaceQty ? [{ content: "Space\nQty", rowSpan: 2, styles: { fillColor: primaryFill, textColor: [0, 0, 0], fontStyle: "bold", halign: "center", valign: "middle" } }] : []),
          ...(showFloorsCol ? [{ content: "No. of\nFloors", rowSpan: 2, styles: { fillColor: primaryFill, textColor: [0, 0, 0], fontStyle: "bold", halign: "center", valign: "middle" } }] : []),
          { content: `TOTAL\n${unitLabel}`, rowSpan: 2, styles: { fillColor: primaryFill, textColor: [0, 0, 0], fontStyle: "bold", halign: "center", valign: "middle" } }
        ],
        [
          ...activeFixtures.map(f => {
            const weight = activeWeights[f.id] ?? 0;
            return { content: `${weight}`, styles: { fillColor: primaryFill, textColor: [0, 0, 0], fontStyle: "bold", halign: "center", valign: "middle" } };
          })
        ]
      ];

      // 3. Main Fixture Schedule Rows (Grouped by Floor)
      const tableRows: any[] = [];

      floorSections.forEach(fl => {
        const floorItems = iopSpaces.filter(s => (s.floor || "6th FLOOR") === fl);
        if (floorItems.length === 0) return;

        // Floor Section Header Row
        tableRows.push([
          { content: `${fl.toUpperCase()}`, colSpan: totalHeaderCols, styles: { fillColor: [240, 240, 240], textColor: [0, 0, 0], fontStyle: "bold", halign: "center" } }
        ]);

        let floorTotalLU = 0;

        floorItems.forEach((item: LUSpace) => {
          const unitLU = calculations.spaceUnitLU[item.id] || 0;
          const totalLu = calculations.spaceTotalsLU[item.id] || 0;
          floorTotalLU += totalLu;

          const rowData = [
            item.desc || "Space",
            ...activeFixtures.map(f => item.fixtures[f.id] || ""),
            Number(unitLU.toFixed(1)),
            ...(showSpaceQty ? [item.qty || 1] : []),
            ...(showFloorsCol ? [item.floors || 1] : []),
            Number(totalLu.toFixed(1))
          ];
          tableRows.push(rowData);
        });

        // Floor Subtotal Row
        const floorSubtotalRow = [
          { content: `TOTAL (${fl.toUpperCase()})`, colSpan: totalHeaderCols - 1, styles: { fontStyle: "bold", halign: "right", fillColor: [245, 245, 245], textColor: [0, 0, 0] } },
          { content: `${floorTotalLU.toFixed(1)} ${unitLabel}`, styles: { fontStyle: "bold", halign: "center", fillColor: [245, 245, 245], textColor: [0, 0, 0] } }
        ];
        tableRows.push(floorSubtotalRow);
      });

      // Total Building LU Summary Row
      tableRows.push([
        { content: "TOTAL BUILDING LOADING UNITS", colSpan: totalHeaderCols - 1, styles: { fontStyle: "bold", halign: "right", fillColor: [235, 235, 235], textColor: [0, 0, 0] } },
        { content: `${calculations.totalLU.toFixed(1)} ${unitLabel}`, styles: { fontStyle: "bold", textColor: [180, 0, 0], halign: "center", fillColor: [235, 235, 235] } }
      ]);

      const runAutoTable = (options: any) => {
        if (typeof autoTable === 'function') {
          autoTable(doc, options);
        } else if ((doc as any).autoTable) {
          (doc as any).autoTable(options);
        }
      };

      // Dynamic Uniform Column Width Calculation for A4 Landscape (Printable width: 269mm)
      const descWidth = 38;
      const numDataCols = activeFixtures.length + summaryColSpan;
      const dataColWidth = Number(((269 - descWidth) / numDataCols).toFixed(2));

      const tableColumnStyles: Record<number, any> = {
        0: { halign: "left", fontStyle: "bold", cellWidth: descWidth, cellPadding: { left: 3.5, right: 1.5, top: 3.0, bottom: 3.0 } }
      };

      for (let i = 1; i <= numDataCols; i++) {
        tableColumnStyles[i] = { cellWidth: dataColWidth, halign: "center" };
      }

      runAutoTable({
        startY: startY + 2,
        head: multiLevelHeaders,
        body: tableRows,
        theme: "grid",
        styles: {
          font: "helvetica",
          fontSize: 7.0,
          textColor: [0, 0, 0],
          halign: "center",
          valign: "middle",
          lineColor: [100, 100, 100],
          lineWidth: 0.1,
          cellPadding: { top: 3.0, bottom: 3.0, left: 1.5, right: 1.5 },
          minCellHeight: 8.5
        },
        headStyles: {
          fillColor: primaryFill,
          textColor: [0, 0, 0],
          fontStyle: "bold",
          fontSize: 7.0,
          halign: "center",
          valign: "middle",
          lineColor: [100, 100, 100],
          lineWidth: 0.1,
          cellPadding: { top: 3.0, bottom: 3.0, left: 1.0, right: 1.0 },
          minCellHeight: 8.5
        },
        bodyStyles: {
          fontSize: 7.0,
          halign: "center",
          valign: "middle",
          lineColor: [100, 100, 100],
          lineWidth: 0.1,
          cellPadding: { top: 3.0, bottom: 3.0, left: 1.5, right: 1.5 },
          minCellHeight: 8.5
        },
        columnStyles: tableColumnStyles,
        margin: { left: 14, right: 14 }
      });

      let finalY = (doc as any).lastAutoTable?.finalY || startY + 50;

      const appTitle = getStandardDemandHeaderTitle(standardPreset);

      const summaryTableRows = [
        [{ content: appTitle, colSpan: 2, styles: { fontStyle: "bold", halign: "center", fillColor: [217, 217, 217], textColor: [0, 0, 0] } }],
        ["No of Booster Pump", "1W+1A+1S"],
        [`Total Water Supply Fixture (${unitLabel})`, `${calculations.totalLU.toFixed(1)}`],
        ["Flow due to loading unit (l/s)", `${calculations.flowLPS.toFixed(3)}`],
        ["Total Water demand considered (l/s)", `${calculations.selectedFlowLPS.toFixed(1)}`],
        ["Diversity (if any)", "-"],
        [
          { content: "Selected Water Flow Rate (Q) L/s", styles: { fontStyle: "bold", fillColor: [253, 235, 218], textColor: [0, 0, 0], halign: "center" } },
          { content: `${calculations.selectedFlowLPS.toFixed(1)}`, styles: { fontStyle: "bold", fillColor: [253, 235, 218], textColor: [0, 0, 0], halign: "center" } }
        ]
      ];

      runAutoTable({
        startY: finalY + 6,
        body: summaryTableRows,
        theme: "grid",
        styles: {
          font: "helvetica",
          fontSize: 8.5,
          textColor: [0, 0, 0],
          valign: "middle",
          lineColor: [100, 100, 100],
          lineWidth: 0.1,
          cellPadding: { top: 3.5, bottom: 3.5, left: 3.5, right: 3.5 },
          minCellHeight: 9.0
        },
        bodyStyles: {
          fontSize: 8.5,
          valign: "middle",
          lineColor: [100, 100, 100],
          lineWidth: 0.1,
          cellPadding: { top: 3.5, bottom: 3.5, left: 3.5, right: 3.5 },
          minCellHeight: 9.0
        },
        columnStyles: {
          0: { fontStyle: "normal", cellWidth: 169, halign: "left", cellPadding: { left: 4.0, top: 3.5, bottom: 3.5, right: 2.0 } },
          1: { fontStyle: "normal", cellWidth: 100, halign: "center" }
        },
        margin: { left: 14, right: 14 }
      });

      finalY = (doc as any).lastAutoTable?.finalY || finalY + 40;

      // 5. Signature Block Table (Matching Ventilation PDF Format & Full Page Width)
      let currentUserName = "";
      if (typeof window !== "undefined") {
        try {
          const user = JSON.parse(localStorage.getItem('mep_user') || '{}');
          const profile = JSON.parse(localStorage.getItem('mep_user_data') || localStorage.getItem('mep_profile') || '{}');
          currentUserName = user.name || user.user?.name || profile.name || profile.user?.name || (window as any).currentMepUserName || "";
        } catch (e) {}
      }

      const { originatedName, originatedDate, reviewerName, reviewerDate, approverName, approverDate } = getSignatureBlockDetails((project as any)?.id || "default", "/plumbing-loading-unit", currentUserName);

      runAutoTable({
        startY: finalY + 6,
        margin: { left: 14, right: 14 },
        theme: "grid",
        styles: {
          font: "helvetica",
          fontSize: 8.5,
          textColor: [0, 0, 0],
          halign: "center",
          valign: "middle",
          lineColor: [100, 100, 100],
          lineWidth: 0.1,
          cellPadding: { top: 3.5, bottom: 3.5, left: 2.0, right: 2.0 },
          minCellHeight: 9.0
        },
        headStyles: {
          fillColor: [255, 230, 204],
          textColor: [0, 0, 0],
          fontStyle: "bold",
          halign: "center",
          valign: "middle",
          lineColor: [100, 100, 100],
          lineWidth: 0.1,
          cellPadding: { top: 3.5, bottom: 3.5, left: 2.0, right: 2.0 },
          minCellHeight: 9.0
        },
        bodyStyles: {
          fontSize: 8.5,
          textColor: [0, 0, 0],
          halign: "center",
          valign: "middle",
          lineColor: [100, 100, 100],
          lineWidth: 0.1,
          cellPadding: { top: 3.5, bottom: 3.5, left: 2.0, right: 2.0 },
          minCellHeight: 9.0
        },
        head: [
          [
            { content: "" },
            { content: "Originated by" },
            { content: "Reviewed by" },
            { content: "Approved by" }
          ]
        ],
        body: [
          [
            { content: "Name:", styles: { fontStyle: "bold", halign: "right" } },
            { content: originatedName, styles: { halign: "center" } },
            { content: reviewerName, styles: { halign: "center" } },
            { content: approverName, styles: { halign: "center" } }
          ],
          [
            { content: "Date:", styles: { fontStyle: "bold", halign: "right" } },
            { content: originatedDate, styles: { halign: "center" } },
            { content: reviewerDate, styles: { halign: "center" } },
            { content: approverDate, styles: { halign: "center" } }
          ]
        ],
        columnStyles: {
          0: { cellWidth: 38, fontStyle: "bold", halign: "right" },
          1: { cellWidth: 77, halign: "center" },
          2: { cellWidth: 77, halign: "center" },
          3: { cellWidth: 77, halign: "center" }
        }
      });

      doc.save(`Loading_Unit_Calculation_${projectNo}.pdf`);
      toast.success("PDF report exported successfully!");

    } catch (err: any) {
      console.error("PDF export error:", err);
      toast.error(err?.message || "Failed to generate PDF export.");
    }
  };

  // Group by floor for listing
  const floorsGrouped = useMemo(() => {
    let filtered = iopSpaces || [];

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      filtered = filtered.filter(s => (s.desc || "").toLowerCase().includes(q) || (s.floor || "").toLowerCase().includes(q));
    }

    if (showFlaggedOnly) {
      filtered = filtered.filter(s => getLUSpaceValidation(s).isFlagged);
    }

    if (filterFloor !== "all") {
      filtered = filtered.filter(s => (s.floor || "6th FLOOR") === filterFloor);
    }

    if (sortBy === "desc") {
      filtered = [...filtered].sort((a, b) => (a.desc || "").localeCompare(b.desc || ""));
    } else if (sortBy === "lu") {
      filtered = [...filtered].sort((a, b) => {
        const currentWeights = STANDARD_FIXTURE_WEIGHTS[standardPreset];
        const luA = Object.entries(a.fixtures || {}).reduce((sum, [fid, qty]) => sum + (Number(qty) || 0) * (currentWeights[fid] || 0), 0);
        const luB = Object.entries(b.fixtures || {}).reduce((sum, [fid, qty]) => sum + (Number(qty) || 0) * (currentWeights[fid] || 0), 0);
        return luB - luA;
      });
    }

    const grouped: Record<string, LUSpace[]> = {};
    floorSections.forEach(fl => {
      grouped[fl] = [];
    });
    filtered.forEach(s => {
      const fl = s.floor || "6th FLOOR";
      if (!grouped[fl]) grouped[fl] = [];
      grouped[fl].push(s);
    });
    return grouped;
  }, [iopSpaces, floorSections, searchQuery, showFlaggedOnly, filterFloor, sortBy, standardPreset]);

  const allSelected = selectedIds.length === iopSpaces.length && iopSpaces.length > 0;

  return (
    <AppShell title="Loading Unit Calculator" onIntelClick={() => setIntelOpen((v) => !v)} intelOpen={intelOpen} hideSubHeader={true}>
      <div className="flex h-full min-h-0 bg-transparent font-sans">
        <div className="flex-1 min-w-0 flex flex-col pt-3 gap-2.5 overflow-hidden h-full px-6 pb-4 animate-in fade-in-50 duration-200">
          
          {/* Top Stationary Header Block (Fixed & Stationary) */}
          <div className="shrink-0 flex flex-col gap-2.5">
            {/* Page Header */}
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-3 select-none">
              <div className="flex flex-col gap-1 max-w-2xl">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-[10px] font-bold tracking-wider text-muted-foreground uppercase">PLUMBING &gt; LOADING UNIT CALCULATOR</span>
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/20">
                    <Sparkles className="size-3" /> Dubai Building Code Ready
                  </span>
                </div>
                <div className="flex items-center gap-3 flex-wrap">
                  <h1 className="text-2xl sm:text-[28px] font-bold tracking-tight text-foreground mt-0.5">Loading Unit Calculator</h1>
                  <button 
                    onClick={() => setIntelOpen((v) => !v)}
                    className={`flex items-center gap-1.5 px-3 py-1 rounded-full transition-colors text-xs font-medium border cursor-pointer shrink-0 ${
                      intelOpen
                        ? "bg-primary text-primary-foreground border-primary"
                        : "bg-[#E8F2FC] text-[#0A7BC7] dark:bg-[#0C2538] dark:text-[#38BDF8] border-[#BCE0FD] dark:border-[#1E4968] hover:bg-[#D4E8FA] dark:hover:bg-[#10324C]"
                    }`}
                  >
                    <Sparkles className="size-3.5" />
                    Intelligence
                  </button>
                  <CalculationReviewBar calculatorPath="/plumbing-loading-unit" calculatorTitle="Loading Unit Calculator" />
                </div>
                <p className="text-xs sm:text-[13px] text-muted-foreground mt-0.5">
                  Calculate Loading Units (LU / WSFU), peak demand flow rates, and booster pump sizing.
                </p>
              </div>
            </div>

            {/* Top Navigation Tabs Bar (Aligned Left above Filter header with rounded-full capsule design) */}
            <div className="flex items-center justify-start select-none">
              <div className="inline-flex bg-slate-200/70 dark:bg-slate-800/80 p-1 rounded-full gap-1 border border-border/60 shadow-2xs">
                <button
                  type="button"
                  onClick={() => setActiveTab("spaces")}
                  className={`px-4 py-1.5 text-xs font-bold rounded-full transition-all cursor-pointer ${
                    activeTab === "spaces" ? "bg-white dark:bg-slate-900 text-foreground shadow-xs" : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  Spaces
                </button>
                <button
                  type="button"
                  onClick={() => setActiveTab("report")}
                  className={`px-4 py-1.5 text-xs font-bold rounded-full transition-all cursor-pointer ${
                    activeTab === "report" ? "bg-white dark:bg-slate-900 text-foreground shadow-xs" : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  Sizing &amp; Report
                </button>
              </div>
            </div>

            {/* Standard & Unit System Selector Header */}
            <div className="flex flex-col md:flex-row justify-between items-stretch md:items-center bg-slate-100 dark:bg-slate-900/60 p-2.5 sm:p-3 border border-border rounded-2xl gap-3 shadow-xs">
              <div className="flex items-center gap-3 w-full md:w-auto min-w-0 flex-wrap">
                <div className="flex items-center gap-1.5">
                  <span className="text-xs font-bold text-foreground shrink-0 uppercase tracking-wide">Standard Preset:</span>
                  <select
                    value={standardPreset}
                    onChange={(e) => {
                      const newPreset = e.target.value as StandardPreset;
                      setStandardPreset(newPreset);
                      setSelectedCategory(DEFAULT_CATEGORY_FOR_PRESET[newPreset] || "std");
                      setWeightOverrides({});
                    }}
                    className="bg-white dark:bg-slate-950 border border-border text-foreground text-xs font-bold rounded-xl px-2.5 py-1.5 outline-none focus:ring-2 focus:ring-[#0A7BC7] cursor-pointer min-w-[280px]"
                  >
                    <optgroup label="Regional UAE">
                      <option value="dubai">Dubai Standard (DBC 2021 / CIBSE Q = 0.10×√LU)</option>
                      <option value="abudhabi">Abu Dhabi Standard (ADM Table 6-7 & 6-9)</option>
                    </optgroup>
                    <optgroup label="British Standards & CIPHE">
                      <option value="iop_bs">IoP PESDG / BS EN 806 / BS 8558 (LU Standard)</option>
                      <option value="bs_806">BS 806 / BS EN 806 (UK / Europe)</option>
                      <option value="bs_8558">BS 8558 Water Supply</option>
                      <option value="iop_low">IoP / CIPHE Low Demand</option>
                      <option value="iop_med">IoP / CIPHE Medium Demand</option>
                      <option value="iop_high">IoP / CIPHE High Demand</option>
                    </optgroup>
                    <optgroup label="German DIN 1988-300">
                      <option value="din_res">DIN 1988-300 Residential (Equation)</option>
                      <option value="din_hosp">DIN 1988-300 Hospital (Equation)</option>
                      <option value="din_hotel">DIN 1988-300 Hotel (Equation)</option>
                      <option value="din_school">DIN 1988-300 School (Equation)</option>
                      <option value="din_office">DIN 1988-300 Office (Equation)</option>
                      <option value="din_assisted">DIN 1988-300 Assisted Living (Equation)</option>
                      <option value="din_nursing">DIN 1988-300 Nursing Home (Equation)</option>
                    </optgroup>
                    <optgroup label="International Codes (US)">
                      <option value="ipc_upc">IPC / UPC Combined Standard (WSFU)</option>
                      <option value="ipc">IPC (International Plumbing Code - Table E103.3)</option>
                      <option value="upc">UPC (Uniform Plumbing Code)</option>
                    </optgroup>
                    <optgroup label="Australia & Other">
                      <option value="as_nzs_3500">AS/NZS 3500 (Australia / New Zealand)</option>
                      <option value="barrie">Barrie's Book Method</option>
                    </optgroup>
                  </select>
                </div>

                <div className="flex items-center gap-1.5">
                  <span className="text-xs font-bold text-foreground shrink-0 uppercase tracking-wide">Demand Category:</span>
                  <select
                    value={selectedCategory}
                    onChange={(e) => {
                      setSelectedCategory(e.target.value);
                      setWeightOverrides({});
                    }}
                    className="bg-white dark:bg-slate-950 border border-border text-foreground text-xs font-bold rounded-xl px-2.5 py-1.5 outline-none focus:ring-2 focus:ring-[#0A7BC7] cursor-pointer min-w-[210px]"
                  >
                    {STANDARD_CATEGORIES[standardPreset].map(cat => (
                      <option key={cat.id} value={cat.id}>{cat.label}</option>
                    ))}
                  </select>
                </div>
              </div>
            </div>
          </div>

          {/* Spaces Tab View */}
          {activeTab === "spaces" && (
            <div className="flex-1 min-h-0 flex flex-col gap-2.5 overflow-hidden">
              {/* Workspace Header Toolbar Strip */}
          <div className="flex flex-wrap items-center justify-between px-4 py-2 min-h-[44px] h-auto border border-border bg-card rounded-2xl shrink-0 select-none gap-2 shadow-xs">
            <div className="flex flex-wrap items-center gap-2 w-full md:w-auto">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-3.5 text-muted-foreground" />
                <input
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Filter spaces..."
                  className="h-7 w-56 pl-8 pr-3 bg-surface-2 border border-transparent focus:border-border-strong focus:bg-background rounded-full text-[12px] outline-none transition-all"
                />
              </div>

              {/* Filters Icon Popover */}
              <Popover>
                <PopoverTrigger asChild>
                  <button
                    className={`relative inline-flex items-center justify-center h-7 w-7 rounded-full border transition-all duration-150 ease-out outline-none focus-visible:ring-1 focus-visible:ring-ring cursor-pointer group overflow-visible ${
                      activeFiltersCount > 0
                        ? "bg-primary/10 border-primary/45 text-primary font-medium hover:bg-primary/15"
                        : "border-border text-muted-foreground hover:bg-surface-2 hover:text-foreground"
                    }`}
                  >
                    <Filter className="size-3.5 shrink-0" />
                    <span className="absolute top-full left-1/2 -translate-x-1/2 mt-1.5 px-2 py-0.5 bg-popover text-popover-foreground text-[11px] font-semibold border border-border rounded-md shadow-sm pointer-events-none opacity-0 scale-75 group-hover:opacity-100 group-hover:scale-100 transition-all duration-150 origin-center select-none z-50 whitespace-nowrap">
                      Filter
                    </span>
                    {activeFiltersCount > 0 && (
                      <span className="absolute -top-1 -right-1 flex items-center justify-center bg-primary text-white font-bold rounded-full size-3.5 text-[8.5px] shadow-sm border border-background">
                        {activeFiltersCount}
                      </span>
                    )}
                  </button>
                </PopoverTrigger>
                <PopoverContent align="start" className="w-60 p-3 bg-popover border border-border rounded-xl shadow-lg flex flex-col gap-3 z-50">
                  <div className="flex items-center justify-between pb-1.5 border-b border-border">
                    <span className="text-xs font-bold text-foreground">Filter Spaces</span>
                    {activeFiltersCount > 0 && (
                      <button onClick={handleResetFilters} className="text-[10px] text-primary hover:underline font-semibold">
                        Reset All
                      </button>
                    )}
                  </div>

                  <div className="flex flex-col gap-1">
                    <span className="text-[10.5px] font-semibold text-muted-foreground uppercase tracking-wider">Floor Section</span>
                    <select
                      value={filterFloor}
                      onChange={(e) => setFilterFloor(e.target.value)}
                      className="h-7 w-full px-2 bg-surface-2 border border-border rounded-lg text-xs outline-none cursor-pointer"
                    >
                      <option value="all">All Floor Sections</option>
                      {floorSections.map(fl => (
                        <option key={fl} value={fl}>{fl}</option>
                      ))}
                    </select>
                  </div>
                </PopoverContent>
              </Popover>

              {/* View Icon Popover */}
              <Popover>
                <PopoverTrigger asChild>
                  <button
                    className={`relative inline-flex items-center justify-center h-7 w-7 rounded-full border transition-all duration-150 ease-out outline-none focus-visible:ring-1 focus-visible:ring-ring cursor-pointer group overflow-visible ${
                      sortBy !== "none" || rowDensity === "compact"
                        ? "bg-primary/10 border-primary/45 text-primary font-medium hover:bg-primary/15"
                        : "border-border text-muted-foreground hover:bg-surface-2 hover:text-foreground"
                    }`}
                  >
                    <SlidersHorizontal className="size-3.5 shrink-0" />
                    <span className="absolute top-full left-1/2 -translate-x-1/2 mt-1.5 px-2 py-0.5 bg-popover text-popover-foreground text-[11px] font-semibold border border-border rounded-md shadow-sm pointer-events-none opacity-0 scale-75 group-hover:opacity-100 group-hover:scale-100 transition-all duration-150 origin-center select-none z-50 whitespace-nowrap">
                      View / Sort
                    </span>
                  </button>
                </PopoverTrigger>
                <PopoverContent align="start" className="w-56 p-3 bg-popover border border-border rounded-xl shadow-lg flex flex-col gap-3 z-50">
                  <div className="pb-1.5 border-b border-border text-xs font-bold text-foreground">
                    View Options
                  </div>

                  <div className="flex flex-col gap-1">
                    <span className="text-[10.5px] font-semibold text-muted-foreground uppercase tracking-wider">Row Density</span>
                    <div className="flex rounded-full border border-border p-0.5 bg-surface-2">
                      <button
                        onClick={() => setRowDensity("default")}
                        className={`flex-1 py-0.5 text-[10.5px] font-semibold rounded-full transition-all ${
                          rowDensity === "default" ? "bg-background shadow-sm text-foreground" : "text-muted-foreground"
                        }`}
                      >
                        Default
                      </button>
                      <button
                        onClick={() => setRowDensity("compact")}
                        className={`flex-1 py-0.5 text-[10.5px] font-semibold rounded-full transition-all ${
                          rowDensity === "compact" ? "bg-background shadow-sm text-foreground" : "text-muted-foreground"
                        }`}
                      >
                        Compact
                      </button>
                    </div>
                  </div>

                  <div className="flex flex-col gap-1">
                    <span className="text-[10.5px] font-semibold text-muted-foreground uppercase tracking-wider">Sort By</span>
                    <select
                      value={sortBy}
                      onChange={(e) => setSortBy(e.target.value as any)}
                      className="h-7 w-full px-2 bg-surface-2 border border-border rounded-lg text-xs outline-none cursor-pointer"
                    >
                      <option value="none">Original Order</option>
                      <option value="desc">Description (A-Z)</option>
                      <option value="lu">Total LU (High to Low)</option>
                    </select>
                  </div>
                </PopoverContent>
              </Popover>
            </div>

            <div className="flex flex-wrap items-center gap-2 w-full md:w-auto justify-start md:justify-end">
              {/* Flag KPI Filter */}
              <button
                onClick={() => setShowFlaggedOnly(prev => !prev)}
                className={`flex items-center gap-1.5 px-3 py-1 text-xs font-semibold rounded-full border transition-all cursor-pointer ${
                  showFlaggedOnly
                    ? "bg-red-500/10 text-red-600 border-red-500/30 dark:bg-red-500/20 dark:text-red-400"
                    : "bg-surface-2 border-border text-muted-foreground hover:text-foreground hover:bg-surface-3"
                }`}
                title={showFlaggedOnly ? "Show all rows" : "Show flagged rows only"}
              >
                <Flag className={`size-3.5 ${flagStats.flaggedCount > 0 ? "fill-red-500 text-red-500" : ""}`} />
                <span>{flagStats.flaggedCount} Flagged</span>
                {showFlaggedOnly && <span className="text-[9px] bg-red-500 text-white px-1.5 rounded-full font-bold uppercase">Active</span>}
              </button>

              <button
                onClick={handleExportPDF}
                className="inline-flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-bold rounded-full border border-border/60 bg-white dark:bg-slate-900 text-foreground hover:bg-slate-100 dark:hover:bg-slate-800 transition-all cursor-pointer shadow-2xs"
              >
                <FileText className="size-3.5" /> Export PDF
              </button>

              <button
                onClick={handleAddSpace}
                className="inline-flex items-center gap-1.5 px-4 py-1.5 text-xs font-semibold rounded-full bg-primary hover:bg-primary/90 text-white shadow-sm transition-all cursor-pointer"
              >
                <Plus className="size-3.5" /> Add Space
              </button>
            </div>
          </div>

          {/* Bulk Action Toolbar Bar (Visible when items selected) */}
          {selectedIds.length > 0 && (
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between bg-[#0A7BC7]/10 border border-[#0A7BC7]/30 text-foreground p-2.5 sm:p-3 rounded-2xl animate-in fade-in duration-150 shadow-xs gap-2">
              <div className="flex items-center gap-2">
                <span className="bg-[#0A7BC7] text-white font-extrabold px-2.5 py-0.5 rounded-full text-xs font-mono">
                  {selectedIds.length} Selected
                </span>
                <span className="text-xs font-bold text-[#0A7BC7]">Bulk Actions:</span>
              </div>

              <div className="flex items-center gap-1.5 flex-wrap w-full sm:w-auto justify-end">
                <div className="flex items-center gap-1 bg-white dark:bg-slate-900 border border-border rounded-lg px-2 py-0.5 shadow-2xs">
                  <span className="text-[11px] font-bold text-muted-foreground">Category:</span>
                  <select
                    onChange={(e) => {
                      if (e.target.value) {
                        const newCat = e.target.value;
                        setIopSpaces(iopSpaces.map(s => selectedIds.includes(s.id) ? { ...s, std: newCat } : s));
                        toast.success(`Updated category for ${selectedIds.length} space(s)`);
                      }
                    }}
                    defaultValue=""
                    className="bg-transparent text-xs font-bold outline-none cursor-pointer text-foreground"
                  >
                    <option value="" disabled>Set Category...</option>
                    {STANDARD_CATEGORIES[standardPreset].map(cat => (
                      <option key={cat.id} value={cat.id}>{cat.label}</option>
                    ))}
                  </select>
                </div>
                <button
                  onClick={handleBulkMoveFloor}
                  className="flex items-center gap-1 bg-white dark:bg-slate-900 border border-border text-foreground hover:bg-slate-50 dark:hover:bg-slate-800 px-2.5 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer shadow-2xs"
                >
                  🏢 Move Floor
                </button>
                <button
                  onClick={handleBulkEditQty}
                  className="flex items-center gap-1 bg-white dark:bg-slate-900 border border-border text-foreground hover:bg-slate-50 dark:hover:bg-slate-800 px-2.5 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer shadow-2xs"
                >
                  <Edit3 className="size-3.5" /> Edit Qty
                </button>
                <button
                  onClick={handleBulkDuplicate}
                  className="flex items-center gap-1 bg-white dark:bg-slate-900 border border-border text-foreground hover:bg-slate-50 dark:hover:bg-slate-800 px-2.5 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer shadow-2xs"
                >
                  <Copy className="size-3.5" /> Duplicate
                </button>
                <button
                  onClick={handleBulkDelete}
                  className="flex items-center gap-1 bg-red-600 hover:bg-red-700 text-white px-2.5 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer shadow-2xs border-0"
                >
                  <Trash2 className="size-3.5" /> Delete
                </button>
                <button
                  onClick={() => setSelectedIds([])}
                  className="text-muted-foreground hover:text-foreground p-1 rounded-lg hover:bg-slate-200 dark:hover:bg-slate-800 cursor-pointer border-0 bg-transparent ml-1"
                >
                  <X className="size-4" />
                </button>
              </div>
            </div>
          )}

          {/* Full-width Main Fixtures Schedule Card Container (Matching Ventilation UI) */}
          <div className="bg-card border border-border rounded-2xl p-4 sm:p-5 flex flex-col gap-4 shadow-xs min-w-0 w-full">
            
            {/* Header bar with Floor Section Creator */}
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 pb-3 border-b border-border/60">
              <div className="flex items-center gap-2 flex-wrap">
                <div className="w-1 h-3.5 bg-[#0A7BC7] rounded-full"></div>
                <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground font-sans">📋 Fixture Schedule (Grouped By Floor)</h3>
                {Object.keys(weightOverrides).length > 0 && (
                  <button
                    onClick={handleResetWeightsToDefault}
                    className="text-[10.5px] font-bold text-amber-600 dark:text-amber-400 bg-amber-500/10 hover:bg-amber-500/20 border border-amber-500/30 px-2 py-0.5 rounded-full transition-all cursor-pointer"
                    title="Reset custom weights to standard defaults"
                  >
                    ↺ Reset Weights
                  </button>
                )}
              </div>

              <div className="flex items-center gap-2 w-full sm:w-auto justify-between sm:justify-end">
                <button
                  onClick={handleAddNewFloorSection}
                  className="flex items-center gap-1 bg-blue-50 dark:bg-blue-950/40 text-[#0A7BC7] hover:bg-blue-100 dark:hover:bg-blue-900/60 border border-blue-200 dark:border-blue-800 px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer"
                >
                  <Plus className="size-3.5" /> Add Floor Section
                </button>
                <button type="button" onClick={() => setIopSpaces([])} className="text-red-500 hover:text-red-700 text-xs font-bold flex items-center gap-1 hover:bg-red-50 dark:hover:bg-red-950/20 px-2 py-1 rounded transition-colors cursor-pointer border-0 bg-transparent">🗑 Clear All</button>
              </div>
            </div>

            {/* Table with Resizable Columns (Steady header & scrollable space rows) */}
            <div className="flex-1 min-h-[200px] max-h-[calc(100vh-420px)] overflow-x-auto overflow-y-auto border border-border rounded-xl w-full custom-scrollbar pb-6">
              <table className="w-full min-w-full border-collapse text-[11.5px] font-sans select-none">
                <thead className="bg-slate-100 dark:bg-slate-900 sticky top-0 z-20 border-b border-border text-muted-foreground select-none">
                  <tr className="text-left text-[10.5px] font-bold uppercase tracking-wider">
                    <th style={{ width: luColWidths.select, minWidth: luColWidths.select }} rowSpan={2} className="p-2 text-center relative group">
                      <input
                        type="checkbox"
                        checked={allSelected}
                        onChange={(e) => handleToggleSelectAll(e.target.checked)}
                        className="size-3.5 accent-[#0A7BC7] cursor-pointer rounded"
                      />
                      <div onMouseDown={(e) => handleResizeMouseDown("select", e)} className="absolute -right-1.5 top-0 bottom-0 w-3 cursor-col-resize hover:bg-primary/40 group-hover:bg-border/60 z-30" />
                    </th>
                    <th style={{ minWidth: luColWidths.desc }} rowSpan={2} className="p-2 text-left relative group">
                      Description
                      <div onMouseDown={(e) => handleResizeMouseDown("desc", e)} className="absolute -right-1.5 top-0 bottom-0 w-3 cursor-col-resize hover:bg-primary/40 group-hover:bg-border/60 z-30" />
                    </th>
                    {LU_FIXTURES_META.map(f => (
                      <th key={f.id} style={{ width: luColWidths[f.id] || 60, minWidth: luColWidths[f.id] || 60 }} className="p-2 text-center relative group">
                        {f.short}
                        <div onMouseDown={(e) => handleResizeMouseDown(f.id, e)} className="absolute -right-1.5 top-0 bottom-0 w-3 cursor-col-resize hover:bg-primary/40 group-hover:bg-border/60 z-30" />
                      </th>
                    ))}
                    <th style={{ width: luColWidths.unitLu, minWidth: luColWidths.unitLu }} rowSpan={2} className="p-2 text-center text-[#0A7BC7] font-bold relative group" title="Unit value per 1 space">
                      {standardPreset === "dubai" || standardPreset === "iop_bs" ? "LU" : "WSFU"}
                      <div onMouseDown={(e) => handleResizeMouseDown("unitLu", e)} className="absolute -right-1.5 top-0 bottom-0 w-3 cursor-col-resize hover:bg-primary/40 group-hover:bg-border/60 z-30" />
                    </th>
                    <th style={{ width: luColWidths.spaceQty, minWidth: luColWidths.spaceQty }} className="p-1.5 text-center text-foreground font-bold border-b border-border/40 relative group" title="Quantity of spaces per typical floor">
                      Space Qty
                      <div onMouseDown={(e) => handleResizeMouseDown("spaceQty", e)} className="absolute -right-1.5 top-0 bottom-0 w-3 cursor-col-resize hover:bg-primary/40 group-hover:bg-border/60 z-30" />
                    </th>
                    <th style={{ width: luColWidths.floorsQty, minWidth: luColWidths.floorsQty }} className="p-1.5 text-center text-foreground font-bold border-b border-border/40 relative group" title="Number of typical floors">
                      No. of Floors
                      <div onMouseDown={(e) => handleResizeMouseDown("floorsQty", e)} className="absolute -right-1.5 top-0 bottom-0 w-3 cursor-col-resize hover:bg-primary/40 group-hover:bg-border/60 z-30" />
                    </th>
                    <th style={{ width: luColWidths.totalLu, minWidth: luColWidths.totalLu }} rowSpan={2} className="p-2 text-center text-[#0A7BC7] font-bold relative group" title="Total LU = Unit Value × (Space Qty if ON) × (No. of Floors if ON)">
                      {standardPreset === "dubai" || standardPreset === "iop_bs" ? "TOTAL LU" : "TOTAL WSFU"}
                      <div onMouseDown={(e) => handleResizeMouseDown("totalLu", e)} className="absolute -right-1.5 top-0 bottom-0 w-3 cursor-col-resize hover:bg-primary/40 group-hover:bg-border/60 z-30" />
                    </th>
                    <th style={{ width: luColWidths.actions, minWidth: luColWidths.actions }} rowSpan={2} className="p-2 text-center font-bold">
                      Actions
                    </th>
                  </tr>
                      <tr className="bg-slate-50 dark:bg-slate-900 border-b border-border">
                        {LU_FIXTURES_META.map(f => (
                          <th key={f.id} className="p-1 px-0.5 text-center font-bold">
                            <input
                              type="number"
                              step="0.1"
                              min="0"
                              max="50"
                              value={activeWeights[f.id] ?? ""}
                              onChange={(e) => {
                                const raw = e.target.value !== "" ? Number(e.target.value) : 0;
                                const val = Math.min(50, Math.max(0, raw));
                                setWeightOverrides(prev => ({ ...prev, [f.id]: val }));
                              }}
                              className="w-12 text-center bg-white dark:bg-slate-950 border border-blue-300 dark:border-blue-700 rounded text-[#0A7BC7] font-extrabold text-[11.5px] py-0.5 outline-none focus:ring-2 focus:ring-[#0A7BC7]"
                              title={`Edit loading unit weight for ${f.short} (Standard default: ${STANDARD_FIXTURE_WEIGHTS_BY_CATEGORY[standardPreset]?.[selectedCategory]?.[f.id] ?? ""})`}
                            />
                          </th>
                        ))}
                        {/* Toggle button under Space Qty header */}
                        <th className="p-1 text-center border-b border-border">
                          <button
                            type="button"
                            onClick={() => setShowSpaceQty(!showSpaceQty)}
                            className={`px-2 py-0.5 rounded text-[10px] font-black transition-all cursor-pointer border ${showSpaceQty ? "bg-[#0A7BC7] text-white border-[#0A7BC7] shadow-xs" : "bg-slate-200 dark:bg-slate-800 text-slate-500 border-border"}`}
                            title={showSpaceQty ? "Space Qty is ON. Click to turn OFF." : "Space Qty is OFF. Click to turn ON."}
                          >
                            {showSpaceQty ? "ON" : "OFF"}
                          </button>
                        </th>
                        {/* Toggle button under No. of Floors header */}
                        <th className="p-1 text-center border-b border-border">
                          <button
                            type="button"
                            onClick={() => setShowFloorsCol(!showFloorsCol)}
                            className={`px-2 py-0.5 rounded text-[10px] font-black transition-all cursor-pointer border ${showFloorsCol ? "bg-[#0A7BC7] text-white border-[#0A7BC7] shadow-xs" : "bg-slate-200 dark:bg-slate-800 text-slate-500 border-border"}`}
                            title={showFloorsCol ? "No. of Floors is ON. Click to turn OFF." : "No. of Floors is OFF. Click to turn ON."}
                          >
                            {showFloorsCol ? "ON" : "OFF"}
                          </button>
                        </th>
                      </tr>
                    </thead>

                    {/* Floor Section Blocks */}
                    {Object.keys(floorsGrouped).map(floor => (
                      <tbody key={floor} className="border-b border-border/80">
                        
                        {/* Floor Section Header (Matching Ventilation UI) */}
                        <tr className="bg-slate-100/80 dark:bg-slate-900/60 border-y border-border/70 text-foreground font-bold text-[12px] group select-none">
                          <td colSpan={LU_FIXTURES_META.length + 7} className="py-2 px-3 text-left">
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-2">
                                <ChevronDown className="size-3.5 text-[#0A7BC7] shrink-0" />
                                <input
                                  type="text"
                                  value={floor}
                                  onChange={(e) => handleRenameFloorGroup(floor, e.target.value)}
                                  className="bg-transparent border-0 outline-none focus:bg-white dark:focus:bg-slate-950 px-1 py-0.5 rounded font-extrabold text-[#0A7BC7] text-xs uppercase"
                                  placeholder="Floor Name"
                                />
                                <span className="text-[10px] text-muted-foreground font-normal">({floorsGrouped[floor].length} space types)</span>
                                <span className="text-[10px] text-muted-foreground/60 font-normal hidden sm:inline">(Right-click or press Delete to remove)</span>
                              </div>

                              <div className="flex items-center gap-2">
                                <button
                                  type="button"
                                  onClick={() => handleDeleteFloorGroup(floor)}
                                  className="text-red-500 hover:text-red-700 text-[10.5px] font-semibold hover:bg-red-50 dark:hover:bg-red-950/20 px-2 py-0.5 rounded cursor-pointer border-0 bg-transparent transition-colors"
                                >
                                  Delete Section
                                </button>
                              </div>
                            </div>
                          </td>
                        </tr>

                        {/* Interactive adding row inside this floor section */}
                        <tr className="bg-blue-50/40 dark:bg-slate-900/40 border-b border-border/70 border-dashed">
                          <td className="p-2 text-center font-extrabold text-[#0A7BC7] text-[15px]">+</td>
                          <td className="p-1.5">
                            <input type="text" placeholder={`Add space to ${floor}`} value={activeFloor === floor ? newDesc : ""} onChange={e => { setActiveFloor(floor); setNewDesc(e.target.value); }} className="w-full bg-white dark:bg-slate-950 border border-border rounded-md px-2 py-1 outline-none focus:border-[#0A7BC7]" />
                          </td>
                          {LU_FIXTURES_META.map(f => (
                            <td key={f.id} className="p-1">
                              <input type="number" min="0" placeholder="-" value={activeFloor === floor ? (newFixtures[f.id] || "") : ""} onChange={e => { setActiveFloor(floor); setNewFixtures({ ...newFixtures, [f.id]: e.target.value !== "" ? Number(e.target.value) : 0 }); }} className="w-full bg-white dark:bg-slate-950 border border-border rounded-md py-1 text-center outline-none" />
                            </td>
                          ))}
                          <td className="p-1 text-center text-muted-foreground font-mono">—</td>
                          <td className="p-1.5 text-center">
                            {showSpaceQty ? (
                              <input type="number" min="1" value={activeFloor === floor ? newQty : 1} onChange={e => { setActiveFloor(floor); setNewQty(Number(e.target.value)); }} className="w-full bg-white dark:bg-slate-950 border border-border rounded-md py-1 text-center font-bold outline-none text-amber-600 dark:text-amber-400" title="Space Qty per floor" />
                            ) : (
                              <span className="text-muted-foreground font-mono text-[11px]">—</span>
                            )}
                          </td>
                          <td className="p-1.5 text-center">
                            {showFloorsCol ? (
                              <input type="number" min="1" value={activeFloor === floor ? newFloorQty : 1} onChange={e => { setActiveFloor(floor); setNewFloorQty(Number(e.target.value)); }} className="w-full bg-white dark:bg-slate-950 border border-border rounded-md py-1 text-center font-bold outline-none text-sky-600 dark:text-sky-400" title="No. of typical floors" />
                            ) : (
                              <span className="text-muted-foreground font-mono text-[11px]">—</span>
                            )}
                          </td>
                          <td className="p-2 text-center">
                            <button onClick={() => handleAddSpaceToFloor(floor)} className="bg-[#0A7BC7] hover:bg-[#06456F] text-white px-3 py-1 rounded font-bold transition-all cursor-pointer border-0 text-xs">Add</button>
                          </td>
                          <td className="p-1 text-center"></td>
                        </tr>

                        {/* Existing spaces on this floor */}
                        {floorsGrouped[floor].map((s) => {
                          const isSelected = selectedIds.includes(s.id);
                          const isEditing = editingSpace?.space.id === s.id;
                          const isModalOpen = editingSpace !== null;

                          return (
                            <tr
                              key={s.id}
                              onDoubleClick={() => {
                                setSelectedIds([s.id]);
                                setEditingSpace({ space: s, floor });
                              }}
                              onContextMenu={(e) => handleContextMenu(e, s.id)}
                              className={`transition-all duration-200 cursor-pointer ${rowDensity === "compact" ? "h-6 text-[11px]" : ""} ${
                                isEditing
                                  ? "bg-primary/20 ring-2 ring-primary border-y border-primary font-bold shadow-2xl z-30 relative opacity-100 blur-none scale-[1.005]"
                                  : isModalOpen
                                  ? "blur-[2.5px] opacity-35 select-none pointer-events-none transition-all duration-200"
                                  : isSelected
                                  ? "bg-blue-500/10 dark:bg-blue-950/30 font-semibold"
                                  : "hover:bg-slate-50/50 dark:hover:bg-slate-900/30"
                              }`}
                            >
                              <td className="p-2 text-center" onDoubleClick={(e) => e.stopPropagation()}>
                                <input
                                  type="checkbox"
                                  checked={isSelected}
                                  onChange={(e) => handleToggleSelect(s.id, e.target.checked)}
                                  className="size-3.5 accent-[#0A7BC7] cursor-pointer rounded"
                                />
                              </td>
                              <td className="p-1.5" onDoubleClick={() => { setSelectedIds([s.id]); setEditingSpace({ space: s, floor }); }}>
                                <div className="flex items-center gap-1.5 w-full">
                                  {s.comments && s.comments.length > 0 && (
                                    <span 
                                      title={`${s.comments.length} comment(s):\n${s.comments.map((c: any) => `${c.authorName}: ${c.text}`).join('\n')}`} 
                                      className="inline-flex items-center justify-center p-1 rounded bg-blue-500/10 text-blue-600 dark:text-blue-400 shrink-0 cursor-help"
                                    >
                                      <MessageSquare className="size-3.5" />
                                    </span>
                                  )}
                                  <input 
                                    type="text" 
                                    value={s.desc} 
                                    onDoubleClick={(e) => { e.stopPropagation(); setSelectedIds([s.id]); setEditingSpace({ space: s, floor }); }}
                                    onChange={e => handleSpaceDescChange(s.id, e.target.value)} 
                                    className="w-full bg-transparent border-0 outline-none focus:bg-white dark:focus:bg-slate-950 px-1 py-0.5 rounded font-bold text-foreground" 
                                  />
                                </div>
                              </td>
                              {LU_FIXTURES_META.map(f => (
                                <td key={f.id} className="p-1" onDoubleClick={() => { setSelectedIds([s.id]); setEditingSpace({ space: s, floor }); }}>
                                  <input 
                                    type="number" 
                                    min="0" 
                                    value={s.fixtures[f.id] || ""} 
                                    onDoubleClick={(e) => { e.stopPropagation(); setSelectedIds([s.id]); setEditingSpace({ space: s, floor }); }}
                                    onChange={e => handleFixtureChange(s.id, f.id, Number(e.target.value))} 
                                    className="w-full text-center bg-transparent border-0 outline-none focus:bg-white dark:focus:bg-slate-950 py-0.5 rounded font-mono font-medium" 
                                  />
                                </td>
                              ))}
                              <td className="p-2 text-center font-mono font-bold text-[#0A7BC7] bg-[#0A7BC7]/5" onDoubleClick={() => { setSelectedIds([s.id]); setEditingSpace({ space: s, floor }); }}>
                                {(calculations.spaceUnitLU[s.id] || 0).toFixed(1)}
                              </td>
                              <td className="p-1 text-center" onDoubleClick={() => { setSelectedIds([s.id]); setEditingSpace({ space: s, floor }); }}>
                                {showSpaceQty ? (
                                  <input 
                                    type="number" 
                                    min="1" 
                                    value={s.qty || 1} 
                                    onDoubleClick={(e) => { e.stopPropagation(); setSelectedIds([s.id]); setEditingSpace({ space: s, floor }); }}
                                    onChange={e => handleQtyChange(s.id, Number(e.target.value))} 
                                    className="w-full text-center bg-transparent border-0 outline-none focus:bg-white dark:focus:bg-slate-950 py-0.5 rounded font-mono font-medium text-foreground" 
                                    title="Space Qty per floor" 
                                  />
                                ) : (
                                  <span className="text-muted-foreground font-mono text-[11px]">—</span>
                                )}
                              </td>
                              <td className="p-1 text-center" onDoubleClick={() => { setSelectedIds([s.id]); setEditingSpace({ space: s, floor }); }}>
                                {showFloorsCol ? (
                                  <input 
                                    type="number" 
                                    min="1" 
                                    value={s.floorQty || 1} 
                                    onDoubleClick={(e) => { e.stopPropagation(); setSelectedIds([s.id]); setEditingSpace({ space: s, floor }); }}
                                    onChange={e => handleFloorQtyChange(s.id, Number(e.target.value))} 
                                    className="w-full text-center bg-transparent border-0 outline-none focus:bg-white dark:focus:bg-slate-950 py-0.5 rounded font-mono font-medium text-foreground" 
                                    title="No. of typical floors" 
                                  />
                                ) : (
                                  <span className="text-muted-foreground font-mono text-[11px]">—</span>
                                )}
                              </td>
                              <td className="p-2 text-center font-mono font-extrabold text-[#0A7BC7]" onDoubleClick={() => { setSelectedIds([s.id]); setEditingSpace({ space: s, floor }); }}>
                                {(calculations.spaceTotalsLU[s.id] || 0).toFixed(1)}
                              </td>
                              <td className="p-1 text-center" onDoubleClick={(e) => e.stopPropagation()}>
                                <div className="flex items-center justify-center gap-1">
                                  {(() => {
                                    const totalFixtures = Object.values(s.fixtures || {}).reduce((sum, q) => sum + (Number(q) || 0), 0);
                                    const isMissingDesc = !s.desc || s.desc.trim() === "";
                                    const isNoFixtures = totalFixtures === 0;
                                    const isMissingQty = showSpaceQty && (!s.qty || Number(s.qty) <= 0);
                                    const isMissingFloorQty = showFloorsCol && (!s.floorQty || Number(s.floorQty) <= 0);
                                    const isMissingValues = isMissingDesc || isNoFixtures || isMissingQty || isMissingFloorQty;
                                    const isFlagActive = s.flagged || isMissingValues;

                                    const missingMsg: string[] = [];
                                    if (isMissingDesc) missingMsg.push("description");
                                    if (isNoFixtures) missingMsg.push("fixtures (0 selected)");
                                    if (isMissingQty) missingMsg.push("space quantity");
                                    if (isMissingFloorQty) missingMsg.push("floor quantity");

                                    const tooltipTitle = missingMsg.length > 0
                                      ? `Missing required value(s): ${missingMsg.join(", ")}`
                                      : s.flagged ? "Unflag space" : "Flag space";

                                    return (
                                      <button
                                        type="button"
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          const targets = selectedIds.includes(s.id) ? selectedIds : [s.id];
                                          const newFlagged = !s.flagged;
                                          setIopSpaces(prev => prev.map(item => targets.includes(item.id) ? { ...item, flagged: newFlagged } : item));
                                        }}
                                        className="p-1 rounded hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer group flex items-center justify-center"
                                        title={tooltipTitle}
                                      >
                                        <Flag 
                                          className={`size-3.5 transition-all duration-200 ${
                                            isFlagActive 
                                              ? "fill-red-500 text-red-500 scale-110" 
                                              : "text-muted-foreground/30 hover:text-red-500/60 group-hover:scale-110"
                                          }`} 
                                        />
                                      </button>
                                    );
                                  })()}
                                </div>
                              </td>
                            </tr>
                          );
                        })}

                      </tbody>
                    ))}
                    {/* Bottom Padding Spacer Row for 100% full visibility of last space */}
                    <tbody>
                      <tr className="h-16 border-0 bg-transparent pointer-events-none">
                        <td colSpan={25} className="p-0 border-0 bg-transparent" />
                      </tr>
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* Sizing & Report Tab View */}
          {activeTab === "report" && (
            <div className="flex-1 min-h-0 overflow-y-auto flex flex-col gap-5 custom-scrollbar pr-1 animate-in fade-in-50 duration-200">
              
              {/* Report Header Export Triggers */}
              <div className="flex flex-wrap items-center justify-between gap-3 bg-card border border-border p-4 rounded-2xl shadow-xs">
                <div className="flex flex-col gap-0.5">
                  <h2 className="text-base font-bold text-foreground flex items-center gap-2">
                    <Calculator className="size-4 text-[#0A7BC7]" />
                    Building Water Demand Sizing Report
                  </h2>
                  <p className="text-xs text-muted-foreground">
                    Comprehensive demand calculations, pipe sizing, and submittal report summaries.
                  </p>
                </div>
                <div className="flex items-center gap-2.5">
                  <button
                    type="button"
                    onClick={handleExportExcel}
                    className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold bg-emerald-600 hover:bg-emerald-700 text-white shadow-xs transition-all cursor-pointer"
                  >
                    <Download className="size-3.5" />
                    Excel Submittal (.xlsx)
                  </button>
                  <button
                    type="button"
                    onClick={handleExportPDF}
                    className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold bg-[#0A7BC7] hover:bg-[#06456F] text-white shadow-xs transition-all cursor-pointer"
                  >
                    <FileText className="size-3.5" />
                    PDF Report (.pdf)
                  </button>
                </div>
              </div>

              {/* Sizing Results & Recommended Pipe Summary Cards */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 w-full">
                
                {/* Sizing Results Card */}
                <div className="bg-card border border-border rounded-2xl p-4 flex flex-col gap-3 shadow-xs">
                  <div className="flex items-center gap-1.5 pb-1 border-b border-border/60">
                    <div className="w-1 h-3.5 bg-[#0A7BC7] rounded-full"></div>
                    <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground font-sans">📊 Sizing Results</h3>
                  </div>

                  <div className="grid grid-cols-2 gap-3 font-sans text-xs">
                    <div className="flex flex-col p-2.5 bg-surface-2 rounded-xl border border-border/50">
                      <span className="font-semibold text-muted-foreground text-[10px] uppercase">Standard Preset</span>
                      <span className="font-bold text-foreground text-xs">{standardPreset === "iop_bs" ? "IoP PESDG / BS 6700" : standardPreset === "dubai" ? "Dubai (DBC)" : standardPreset === "abudhabi" ? "Abu Dhabi (ADM)" : "IPC / UPC"}</span>
                    </div>
                    <div className="flex flex-col p-2.5 bg-surface-2 rounded-xl border border-border/50">
                      <span className="font-semibold text-muted-foreground text-[10px] uppercase">Total Demand</span>
                      <strong className="font-bold text-foreground font-mono text-xs">{calculations.totalLU.toFixed(1)} {standardPreset === "dubai" || standardPreset === "iop_bs" ? "LU" : "WSFU"}</strong>
                    </div>
                    <div className="flex flex-col p-2.5 bg-surface-2 rounded-xl border border-border/50">
                      <span className="font-semibold text-muted-foreground text-[10px] uppercase">Peak Flow Rate</span>
                      <strong className="font-bold text-[#0A7BC7] font-mono text-xs">{calculations.displayFlow}</strong>
                    </div>
                    <div className="flex flex-col p-2.5 bg-blue-50/60 dark:bg-blue-950/30 border border-blue-200/50 dark:border-blue-800/40 rounded-xl">
                      <span className="font-bold text-foreground uppercase tracking-wide text-[9.5px]">Pump Flow (Q)</span>
                      <strong className="font-extrabold text-[#0A7BC7] text-xs font-mono">{calculations.displaySelectedFlow}</strong>
                    </div>
                  </div>
                </div>

                {/* Recommended Pipe Size Card */}
                <div className="bg-card border border-border rounded-2xl p-4 flex flex-col gap-3 shadow-xs">
                  <div className="flex items-center gap-1.5 pb-1 border-b border-border/60">
                    <div className="w-1 h-3.5 bg-emerald-500 rounded-full"></div>
                    <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground font-sans">🚰 Recommended Pipe</h3>
                  </div>

                  <div className="flex items-center justify-between bg-emerald-500/10 border border-emerald-500/20 p-3 rounded-xl">
                    <div className="flex flex-col">
                      <span className="text-[9.5px] font-bold uppercase tracking-wider text-emerald-700 dark:text-emerald-300">Nominal Size</span>
                      <span className="text-xl font-black text-emerald-600 dark:text-emerald-400 font-mono">DN{calculations.pipeSizing.sizeMM} mm</span>
                    </div>
                    <div className="text-right flex flex-col">
                      <span className="text-[9.5px] font-bold text-muted-foreground uppercase">Capacity Limit</span>
                      <span className="text-xs font-mono font-bold text-foreground">{calculations.pipeSizing.maxFlowLPS} L/s</span>
                    </div>
                  </div>

                  {/* Collapsible / Compact Pipe Schedule Table */}
                  <details className="group border border-border rounded-xl text-[10px]">
                    <summary className="p-2 font-semibold text-muted-foreground hover:text-foreground cursor-pointer flex items-center justify-between bg-slate-50 dark:bg-slate-900 rounded-xl select-none">
                      <span>View Pipe Size Table (15–200mm)</span>
                      <span className="group-open:rotate-180 transition-transform text-[9px]">▼</span>
                    </summary>
                    <div className="overflow-x-auto overflow-y-auto max-h-48 p-1 border-t border-border custom-scrollbar">
                      <table className="w-full border-collapse font-mono text-[9px]">
                        <thead>
                          <tr className="text-muted-foreground font-bold border-b border-border text-[9px] bg-slate-100 dark:bg-slate-800">
                            <th className="p-1 text-center">Pipe (mm)</th>
                            <th className="p-1 text-center">WSFU</th>
                            <th className="p-1 text-center">Max L/s</th>
                            <th className="p-1 text-center">@ 4 fps</th>
                            <th className="p-1 text-center">@ 5 fps</th>
                            <th className="p-1 text-center">@ 6 fps</th>
                          </tr>
                        </thead>
                        <tbody>
                          {PIPE_SIZING_TABLE.map((row) => {
                            const isMatch = calculations.pipeSizing.sizeMM === row.sizeMM;
                            return (
                              <tr key={row.sizeMM} className={`border-b border-border/30 ${isMatch ? "bg-emerald-500/25 font-extrabold text-emerald-800 dark:text-emerald-200" : ""}`}>
                                <td className="p-1 text-center font-bold">DN{row.sizeMM}</td>
                                <td className="p-1 text-center font-semibold">{row.wsfuRange}</td>
                                <td className="p-1 text-center">{row.flowMax}</td>
                                <td className="p-1 text-center">{row.q4fps.toFixed(2)}</td>
                                <td className="p-1 text-center">{row.q5fps.toFixed(2)}</td>
                                <td className="p-1 text-center">{row.q6fps.toFixed(2)}</td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  </details>

                  <div className="bg-slate-50 dark:bg-slate-900 border border-border rounded-xl p-1.5 flex gap-1.5 text-[9.5px] text-muted-foreground">
                    <Info className="size-3 shrink-0 text-[#0A7BC7] mt-0.5" />
                    <span>DBC 2021 &amp; BS EN 806 limits (V &le; 1.5 - 2.0 m/s).</span>
                  </div>
                </div>
              </div>

              {/* Building Water Demand Table Summary */}
              <div className="bg-card border border-border rounded-2xl overflow-hidden shadow-xs">
                <div className="bg-slate-100 dark:bg-slate-900 p-3 border-b border-border text-center font-bold text-xs uppercase tracking-wider text-foreground">
                  {getStandardDemandHeaderTitle(standardPreset)}
                </div>
                <div className="divide-y divide-border text-xs font-sans">
                  <div className="flex items-center justify-between p-3">
                    <span className="font-semibold text-muted-foreground">No of Booster Pump</span>
                    <span className="font-mono font-bold text-foreground">1W + 1A + 1S</span>
                  </div>
                  <div className="flex items-center justify-between p-3">
                    <span className="font-semibold text-muted-foreground">Total Water Supply Fixture ({unitLabel})</span>
                    <span className="font-mono font-bold text-foreground">{calculations.totalLU.toFixed(1)}</span>
                  </div>
                  <div className="flex items-center justify-between p-3">
                    <span className="font-semibold text-muted-foreground">Flow due to loading unit (L/s)</span>
                    <span className="font-mono font-bold text-[#0A7BC7]">{calculations.flowLPS.toFixed(3)}</span>
                  </div>
                  <div className="flex items-center justify-between p-3">
                    <span className="font-semibold text-muted-foreground">Total Water demand considered (L/s)</span>
                    <span className="font-mono font-bold text-foreground">{calculations.selectedFlowLPS.toFixed(1)}</span>
                  </div>
                  <div className="flex items-center justify-between p-3">
                    <span className="font-semibold text-muted-foreground">Diversity (if any)</span>
                    <span className="font-mono font-medium text-muted-foreground">—</span>
                  </div>
                  <div className="flex items-center justify-between p-3 bg-blue-50/70 dark:bg-blue-950/40 font-bold">
                    <span className="text-blue-700 dark:text-blue-300">Selected Water Flow Rate (Q) L/s</span>
                    <span className="font-mono text-base text-[#0A7BC7]">{calculations.selectedFlowLPS.toFixed(1)} L/s</span>
                  </div>
                </div>
              </div>

            </div>
          )}

        </div>
      </div>

      {/* Floating Right-Click Context Menu */}
      {contextMenu && (
        <div
          className="fixed z-50 bg-white dark:bg-slate-900 border border-border rounded-xl shadow-xl py-1.5 text-xs font-bold text-foreground w-48"
          style={{ top: `${contextMenu.y}px`, left: `${contextMenu.x}px` }}
        >
          <div className="px-3 py-1 text-[10.5px] text-muted-foreground border-b border-border/60 uppercase">
            Options ({selectedIds.length} selected)
          </div>
          <button
            onClick={handleBulkDuplicate}
            className="w-full px-3 py-2 text-left hover:bg-slate-100 dark:hover:bg-slate-800 flex items-center gap-2 cursor-pointer border-0 bg-transparent font-medium"
          >
            <Copy className="size-3.5 text-[#0A7BC7]" /> Duplicate Space(s)
          </button>
          <button
            onClick={handleBulkMoveFloor}
            className="w-full px-3 py-2 text-left hover:bg-slate-100 dark:hover:bg-slate-800 flex items-center gap-2 cursor-pointer border-0 bg-transparent font-medium"
          >
            🏢 Move to Another Floor
          </button>
          <button
            onClick={handleBulkEditQty}
            className="w-full px-3 py-2 text-left hover:bg-slate-100 dark:hover:bg-slate-800 flex items-center gap-2 cursor-pointer border-0 bg-transparent font-medium"
          >
            <Edit3 className="size-3.5 text-amber-500" /> Edit Quantity
          </button>
          <button
            onClick={() => {
              const targetSpace = iopSpaces.find(s => s.id === contextMenu.spaceId);
              if (targetSpace) {
                setCommentTarget({ id: String(targetSpace.id), name: targetSpace.desc, type: 'space' });
                setAssignCommentOpen(true);
              }
              setContextMenu(null);
            }}
            className="w-full px-3 py-2 text-left hover:bg-slate-100 dark:hover:bg-slate-800 flex items-center gap-2 cursor-pointer border-0 bg-transparent font-medium text-blue-600 dark:text-blue-400"
          >
            <MessageSquare className="size-3.5" /> Add comment
          </button>
          {(() => {
            const targetSpace = iopSpaces.find(s => s.id === contextMenu.spaceId);
            const totalFixtures = Object.values(targetSpace?.fixtures || {}).reduce((sum, q) => sum + (Number(q) || 0), 0);
            const isMissingDesc = !targetSpace?.desc || targetSpace?.desc.trim() === "";
            const isNoFixtures = totalFixtures === 0;
            const isMissingQty = showSpaceQty && (!targetSpace?.qty || Number(targetSpace.qty) <= 0);
            const isMissingFloorQty = showFloorsCol && (!targetSpace?.floorQty || Number(targetSpace.floorQty) <= 0);
            const isMissingValues = isMissingDesc || isNoFixtures || isMissingQty || isMissingFloorQty;
            const isFlagActive = targetSpace?.flagged || isMissingValues;

            return (
              <button
                onClick={() => {
                  const targets = selectedIds.includes(contextMenu.spaceId) ? selectedIds : [contextMenu.spaceId];
                  const newFlagged = !targetSpace?.flagged;
                  setIopSpaces(prev => prev.map(s => targets.includes(s.id) ? { ...s, flagged: newFlagged } : s));
                  setContextMenu(null);
                }}
                className="w-full px-3 py-2 text-left hover:bg-slate-100 dark:hover:bg-slate-800 flex items-center gap-2 cursor-pointer border-0 bg-transparent font-medium"
              >
                <Flag className={`size-3.5 ${isFlagActive ? "fill-red-500 text-red-500" : "text-muted-foreground"}`} />
                {targetSpace?.flagged ? "Unflag Space" : isMissingValues ? "Flag Space (Warning Active)" : "Flag Space"}
              </button>
            );
          })()}
          <div className="my-1 border-t border-border/60"></div>
          <button
            onClick={handleBulkDelete}
            className="w-full px-3 py-2 text-left hover:bg-red-50 dark:hover:bg-red-950/30 text-red-600 flex items-center gap-2 cursor-pointer border-0 bg-transparent font-semibold"
          >
            <Trash2 className="size-3.5" /> Delete Space(s)
          </button>
        </div>
      )}

      {/* Assign Comment Modal Overlay */}
      {commentTarget && (
        <AssignCommentModal
          isOpen={assignCommentOpen}
          onClose={() => {
            setAssignCommentOpen(false);
            setCommentTarget(null);
          }}
          targetId={commentTarget.id}
          targetName={commentTarget.name}
          targetType={commentTarget.type}
          onSave={(newComment) => {
            setIopSpaces(prev => {
              const next = prev.map(s => {
                if (String(s.id) === commentTarget.id) {
                  const comments = [...(s.comments || []), newComment];
                  return { ...s, comments };
                }
                return s;
              });

              const projId = project?.id || "default";
              try {
                const existingData = JSON.parse(localStorage.getItem(`mep_loading_unit_calc_${projId}`) || '{}');
                localStorage.setItem(`mep_loading_unit_calc_${projId}`, JSON.stringify({
                  ...existingData,
                  iopSpaces: next,
                  updatedAt: new Date().toISOString()
                }));
              } catch (e) {}
              return next;
            });
            toast.success(`Comment assigned on space "${commentTarget.name}"`);
            if (typeof window !== 'undefined') {
              window.dispatchEvent(new CustomEvent("mep-notification-added"));
            }
          }}
        />
      )}
      {/* Double-Click Calculation Breakdown & Edit Modal */}
      {editingSpace && (
        <EditLoadingUnitRowModal
          space={editingSpace.space}
          rowIndex={(floorsGrouped[editingSpace.floor] || []).findIndex((sp) => sp.id === editingSpace.space.id) + 1 || 1}
          floorName={editingSpace.floor}
          standardPreset={standardPreset}
          activeWeights={activeWeights}
          showSpaceQty={showSpaceQty}
          showFloorsCol={showFloorsCol}
          onClose={() => setEditingSpace(null)}
          onSave={(updated) => {
            setIopSpaces((prev) =>
              prev.map((sp) =>
                sp.id === editingSpace.space.id
                  ? {
                      ...sp,
                      desc: updated.desc,
                      fixtures: updated.fixtures,
                      qty: updated.qty,
                      floorQty: updated.floorQty,
                    }
                  : sp
              )
            );
            setEditingSpace(null);
            toast.success(`Updated "${updated.desc || 'Space'}" parameters.`);
          }}
        />
      )}
    </AppShell>
  );
}
