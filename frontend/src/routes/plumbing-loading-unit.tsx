import { CalculationReviewBar, useCalculationLock, useCalculationEffectiveReadOnly, useCalculationReviewState, getCalculationStatusBorderClass, type CalculationReviewState } from "@/components/workspace/CalculationReviewBar";
import { downloadFile } from "@/lib/download";
import { createFileRoute } from "@tanstack/react-router";
import React, { useState, useMemo, useEffect, useRef } from "react";
import { AppShell } from "@/components/workspace/AppShell";
import { useAuth } from "@/contexts/AuthContext";
import { AssignCommentModal } from "@/components/workspace/AssignCommentModal";
import { notifyCommentAssigned } from "@/utils/notificationHelpers";
import { EditLoadingUnitRowModal } from "@/components/workspace/EditLoadingUnitRowModal";
import { TBtn, BulkBtn } from "@/components/workspace/Button";
import { Trash2, Save, Info, Sparkles, Plus, Building2, Copy, Edit3, CheckSquare, Square, X, MessageSquare, Flag, Filter, SlidersHorizontal, Search, Download, ChevronDown, ChevronUp, FileText, Calculator, CheckCircle2, AlertTriangle, Printer, Layers, Globe } from "lucide-react";
import { ContextMenu, ContextMenuContent, ContextMenuItem, ContextMenuSeparator, ContextMenuTrigger, ContextMenuShortcut } from "@/components/ui/context-menu";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import * as XLSX from "xlsx";
import { addPdfHeader, addPdfSignatureBlock, getSignatureBlockDetails, formatDateStr, resolveLatestReviewState } from "@/lib/pdfHelpers";
import { useWorkspace, workspaceStore } from "@/lib/workspace-store";
import { dirtyStore } from "@/lib/dirty-store";
import { toast } from "sonner";
import { exportLoadingUnitPDF } from "@/lib/exportLoadingUnitPDF";

export const Route = createFileRoute("/plumbing-loading-unit")({
  head: () => ({
    meta: [
      { title: "Loading Unit & Pipe Sizer â€” MEP Calc" },
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

export function isLUPlaceholderName(name?: string): boolean {
  if (!name) return true;
  const n = name.trim().toLowerCase();
  if (n === "" || n === "untitled space" || n === "untitled" || n === "new space") return true;
  if (n.startsWith("new restroom") || n.startsWith("new space") || n.startsWith("space ")) return true;
  return false;
}

export function getLUSpaceValidation(s?: Partial<LUSpace>) {
  const warnings: string[] = [];
  if (!s) return { isFlagged: false, isAutoFlagged: false, isMissing: false, warnings: [], reason: "" };

  const descTrimmed = (s.desc || "").trim();
  const isPlaceholder = isLUPlaceholderName(descTrimmed);
  const totalFixtures = Object.values(s.fixtures || {}).reduce((sum, v) => sum + (Number(v) || 0), 0);
  const hasFixtures = totalFixtures > 0;
  const validQty = (s.qty ?? 1) > 0 && (s.floorQty ?? 1) > 0;

  if (isPlaceholder && !hasFixtures) {
    warnings.push("Please enter space name and fixture counts (0 LU)");
  } else {
    if (isPlaceholder) warnings.push("Default placeholder space name (rename for clarity)");
    if (!hasFixtures) warnings.push("No fixtures specified for this space (0 LU)");
    if (!validQty) warnings.push("Space quantity and number of floors must be at least 1");
  }

  const isAutoFlagged = warnings.length > 0;
  const isManualFlagged = s.flagged !== undefined;
  const isFlagged = s.flagged !== undefined ? Boolean(s.flagged) : isAutoFlagged;
  const reason = warnings.join(" • ");

  return { isFlagged, isManualFlagged, isAutoFlagged, isMissing: isAutoFlagged, warnings, reason };
}

export function calculateSpaceLU(space?: Partial<LUSpace>, weights: Record<string, number> = {}): number {
  if (!space || !space.fixtures) return 0;
  return Object.entries(space.fixtures).reduce((sum, [key, val]) => {
    const count = Number(val) || 0;
    const weight = weights[key] ?? 0;
    return sum + count * weight;
  }, 0);
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
  // ðŸ‡¬ðŸ‡§ IoP PESDG Table 15 / BS EN 806 (Loading Units - LU)
  iop_bs: {
    low: EXTRACTED_FIXTURE_WEIGHTS_BY_STANDARD.iop_low,
    med: EXTRACTED_FIXTURE_WEIGHTS_BY_STANDARD.iop_med,
    high: EXTRACTED_FIXTURE_WEIGHTS_BY_STANDARD.iop_high,
  },
  // ðŸ‡¦ðŸ‡ª Dubai Standard (DBC 2021 / BS EN 806-3 / CIBSE Guide G)
  dubai: {
    low: { wc: 1.5, wc_tank: 1.5, wc_valve: 15.0, handspray: 1.0, basin: 1.0, sink: 1.5, shower: 1.5, washer: 2.0, servicesink: 2.0, hose_bibb: 1.5, dishwasher: 1.5, hose_bibb_1: 1.0, bath: 4.0, bibtap: 1.5 },
    med: { wc: 2.5, wc_tank: 2.0, wc_valve: 28.0, handspray: 1.0, basin: 1.0, sink: 1.5, shower: 2.0, washer: 3.0, servicesink: 3.0, hose_bibb: 2.5, dishwasher: 1.5, hose_bibb_1: 1.0, bath: 10.0, bibtap: 2.5 },
    high: { wc: 2.5, wc_tank: 2.5, wc_valve: 28.0, handspray: 2.0, basin: 2.0, sink: 5.0, shower: 4.0, washer: 4.0, servicesink: 5.0, hose_bibb: 5.0, dishwasher: 4.0, hose_bibb_1: 2.5, bath: 12.0, bibtap: 5.0 }
  },
  // ðŸ‡¦ðŸ‡ª Abu Dhabi Standard (ADM Table 6-7 / Table 6-9)
  abudhabi: {
    low: { wc: 2.5, wc_tank: 2.5, wc_valve: 3.5, handspray: 0.75, basin: 0.75, sink: 1.125, shower: 1.5, washer: 1.5, servicesink: 2.25, hose_bibb: 1.5, dishwasher: 1.4, hose_bibb_1: 1.0, bath: 1.4, bibtap: 1.5 },
    med: { wc: 2.5, wc_tank: 2.5, wc_valve: 5.0, handspray: 1.0, basin: 1.0, sink: 1.5, shower: 2.0, washer: 3.0, servicesink: 3.0, hose_bibb: 2.5, dishwasher: 1.5, hose_bibb_1: 1.0, bath: 1.4, bibtap: 2.5 },
    high: { wc: 3.5, wc_tank: 3.5, wc_valve: 8.0, handspray: 2.0, basin: 2.0, sink: 2.0, shower: 4.0, washer: 4.0, servicesink: 3.0, hose_bibb: 3.0, dishwasher: 3.0, hose_bibb_1: 2.0, bath: 3.0, bibtap: 3.0 }
  },
  // ðŸŒ International IPC / UPC Standard (IPC Table E103.3(2))
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
  { id: 'wc', key: 'wc', label: 'W/C', short: 'W/C' },
  { id: 'handspray', key: 'handspray', label: 'Hand Spray', short: 'Hand Spray (Bibb)' },
  { id: 'basin', key: 'basin', label: 'WASH BASIN', short: 'WASH BASIN' },
  { id: 'sink', key: 'sink', label: 'Sink Kitchen', short: 'Sink Kitchen' },
  { id: 'shower', key: 'shower', label: 'Shower', short: 'Shower' },
  { id: 'washer', key: 'washer', label: 'WASHING MACHINE', short: 'WASHING MACHINE' },
  { id: 'servicesink', key: 'servicesink', label: 'Service Sink', short: 'Service Sink' },
  { id: 'hose_bibb', key: 'hose_bibb', label: 'Hose Bibb', short: 'Hose Bibb' },
  { id: 'dishwasher', key: 'dishwasher', label: 'DISH WASHER', short: 'DISH WASHER' },
  { id: 'hose_bibb_1', key: 'hose_bibb_1', label: 'Bib Tap', short: 'Bib Tap' }
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
      return { val, formatted: `${val.toFixed(3)} mÂ³/h` };
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

function FloorNameInput({
  floor,
  disabled,
  onRename,
}: {
  floor: string;
  disabled?: boolean;
  onRename: (oldName: string, newName: string) => void;
}) {
  const [val, setVal] = useState(floor);

  useEffect(() => {
    setVal(floor);
  }, [floor]);

  const commitRename = () => {
    const trimmed = val.trim();
    if (trimmed && trimmed !== floor) {
      onRename(floor, trimmed);
    } else {
      setVal(floor);
    }
  };

  return (
    <input
      type="text"
      value={val}
      disabled={disabled}
      onChange={e => setVal(e.target.value)}
      onBlur={commitRename}
      onFocus={e => e.target.select()}
      onKeyDown={e => {
        if (e.key === "Enter") {
          e.currentTarget.blur();
        } else if (e.key === "Escape") {
          setVal(floor);
          e.currentTarget.blur();
        }
      }}
      className="bg-transparent border border-transparent hover:border-border/80 focus:border-[#0A7BC7] focus:bg-white dark:focus:bg-slate-950 px-1.5 py-0.5 rounded font-extrabold text-[#0A7BC7] text-xs uppercase outline-none transition-all cursor-text min-w-[80px]"
      title="Click to edit floor name (Press Enter or click outside to save)"
    />
  );
}

function LoadingUnitPage() {
  const { project, activeProjectId, forceSaveToCloud, isReadOnly } = useWorkspace();
  const calcReviewState = useCalculationReviewState("/plumbing-loading-unit", activeProjectId || project?.id);
  const { userData, profile } = useAuth();
  const currentUserName = profile?.full_name || (userData as any)?.name || (userData as any)?.email || "Lead Engineer";

  const isApprovedLocked = useCalculationLock("/plumbing-loading-unit", project?.id || activeProjectId);
  const isEffectiveReadOnly = useCalculationEffectiveReadOnly("/plumbing-loading-unit", project?.id || activeProjectId);
  const isLocked = isEffectiveReadOnly || isApprovedLocked;
  const isViewerRole = profile?.role === "VIEWER" || userData?.role === "VIEWER";
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

  // Auto-clear selection when calculation is locked/approved
  useEffect(() => {
    if (isLocked) {
      setSelectedIds([]);
    }
  }, [isLocked]);

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
  const [lastSelectedId, setLastSelectedId] = useState<number | null>(null);

  useEffect(() => {
    if (isApprovedLocked) {
      setSelectedIds([]);
    }
  }, [isApprovedLocked]);
  const [editingSpace, setEditingSpace] = useState<{ space: LUSpace; floor: string } | null>(null);
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number; spaceId: number } | null>(null);
  const [assignCommentOpen, setAssignCommentOpen] = useState(false);
  const [commentTarget, setCommentTarget] = useState<{ id: string; name: string; type: 'space' } | null>(null);
  // Deep-linking and auto-scroll from notifications (exact Ventilation logic)
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const handleScrollToItem = (e: any) => {
      const { id, name } = e.detail || {};
      if (!id && !name) return;
      setActiveTab("spaces");
      const targetSpace = iopSpaces.find(s => String(s.id) === id || s.desc === name);
      if (targetSpace) {
        setSelectedIds([targetSpace.id]);
        setTimeout(() => {
          const el = document.getElementById(`lu-space-${targetSpace.id}`) || document.getElementById(`row-${targetSpace.id}`);
          if (el) {
            el.scrollIntoView({ behavior: "smooth", block: "center" });
            el.classList.add("ring-2", "ring-primary", "bg-primary/10");
            setTimeout(() => el.classList.remove("ring-2", "ring-primary", "bg-primary/10"), 3000);
          }
        }, 150);
      }
    };
    window.addEventListener("mep-scroll-to-item" as any, handleScrollToItem);

    const params = new URLSearchParams(window.location.search);
    const targetId = params.get("commentTargetId") || params.get("targetId");
    const targetName = params.get("commentTargetName") || params.get("targetName");
    if (targetId || targetName) {
      setActiveTab("spaces");
      setTimeout(() => {
        handleScrollToItem({ detail: { id: targetId, name: targetName } });
      }, 500);
    }

    return () => window.removeEventListener("mep-scroll-to-item" as any, handleScrollToItem);
  }, [iopSpaces]);

  const [searchQuery, setSearchQuery] = useState("");
  const [showFlaggedOnly, setShowFlaggedOnly] = useState(false);
  const [filterFloor, setFilterFloor] = useState<string>("all");
  const [rowDensity, setRowDensity] = useState<"default" | "compact">("default");
  const [sortBy, setSortBy] = useState<"none" | "desc" | "lu">("none");

  const importFileRef = useRef<HTMLInputElement>(null);

  const handleImportExcel = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (evt) => {
      try {
        const bstr = evt.target?.result;
        const wb = XLSX.read(bstr, { type: "binary" });
        const wsName = wb.SheetNames[0];
        const ws = wb.Sheets[wsName];
        const rows = XLSX.utils.sheet_to_json(ws, { header: 1 });

        if (!rows || rows.length < 2) {
          toast.error("Imported sheet is empty or invalid format.");
          return;
        }

        const newSpaces = [];
        let currentFloor = "6th FLOOR";
        const foundFloors = new Set();

        for (let i = 0; i < rows.length; i++) {
          const row = rows[i];
          if (!row || row.length === 0) continue;

          const firstCell = String(row[0] || "").trim();
          if (!firstCell) continue;

          if (/floor|level|basement|ground|roof/i.test(firstCell) && row.length <= 3) {
            currentFloor = firstCell.toUpperCase();
            foundFloors.add(currentFloor);
            continue;
          }

          if (firstCell.toLowerCase() === "description" || firstCell.toLowerCase() === "sr.") continue;

          const fixtures = {};
          LU_FIXTURES_META.forEach((f, idx) => {
            const colVal = Number(row[idx + 1]);
            if (!isNaN(colVal) && colVal > 0) {
              fixtures[f.id] = colVal;
            }
          });

          const qtyColIdx = 1 + LU_FIXTURES_META.length + 1;
          const spaceQty = Number(row[qtyColIdx]) || 1;
          const floorQty = Number(row[qtyColIdx + 1]) || 1;

          newSpaces.push({
            id: Date.now() + i + Math.random(),
            desc: firstCell,
            floor: currentFloor,
            qty: Math.max(1, spaceQty),
            floorQty: Math.max(1, floorQty),
            std: selectedCategory || "med",
            fixtures,
          });
          foundFloors.add(currentFloor);
        }

        if (newSpaces.length > 0) {
          setIopSpaces(newSpaces);
          if (foundFloors.size > 0) {
            setFloorSections(Array.from(foundFloors));
          }
          toast.success(`Successfully imported ${newSpaces.length} space(s) from Excel!`);
        } else {
          toast.error("Could not find valid space schedule rows in file.");
        }
      } catch (err) {
        console.error("Excel import error:", err);
        toast.error("Failed to parse Excel file.");
      } finally {
        if (e.target) e.target.value = "";
      }
    };
    reader.readAsBinaryString(file);
  };

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
          if (data.luColWidths) setLuColWidths(data.luColWidths);
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
        floorSections,
        luColWidths
      };
      localStorage.setItem(`mep_loading_unit_calc_${project.id}`, JSON.stringify(dataToSave));
      dirtyStore.set(true);
    }
  }, [project?.id, loadedProjectId, unitSystem, standardPreset, selectedCategory, weightOverrides, calcMeta, iopSpaces, floorSections, luColWidths]);

  // Version History Restore Listener
  useEffect(() => {
    const handleVersionRestored = (e: any) => {
      const pKey = `mep_loading_unit_calc_${project?.id || "default"}`;
      const lsCache = e?.detail?.localStorageCache;
      let restoredData: any = null;
      if (lsCache && lsCache[pKey]) {
        try {
          restoredData = typeof lsCache[pKey] === "string" ? JSON.parse(lsCache[pKey]) : lsCache[pKey];
        } catch (err) { }
      }
      if (!restoredData) {
        const stored = localStorage.getItem(pKey);
        if (stored) {
          try {
            restoredData = JSON.parse(stored);
          } catch (err) { }
        }
      }
      if (restoredData) {
        if (restoredData.unitSystem) setUnitSystem(restoredData.unitSystem);
        if (restoredData.standardPreset) setStandardPreset(restoredData.standardPreset);
        if (restoredData.selectedCategory) {
          setSelectedCategory(restoredData.selectedCategory);
        } else if (restoredData.standardPreset) {
          setSelectedCategory(DEFAULT_CATEGORY_FOR_PRESET[restoredData.standardPreset as StandardPreset] || "med");
        }
        if (restoredData.weightOverrides) setWeightOverrides(restoredData.weightOverrides);
        if (restoredData.calcMeta) setCalcMeta(restoredData.calcMeta);
        if (Array.isArray(restoredData.floorSections)) setFloorSections(restoredData.floorSections);
        if (Array.isArray(restoredData.iopSpaces)) {
          setIopSpaces(restoredData.iopSpaces);
          if (restoredData.iopSpaces[0]?.floor) setActiveFloor(restoredData.iopSpaces[0].floor);
        }
        toast.success("Loading Unit calculation restored to selected version!");
      }
    };
    window.addEventListener("mep_version_restored", handleVersionRestored as any);
    return () => window.removeEventListener("mep_version_restored", handleVersionRestored as any);
  }, [project?.id]);

  const [undoStack, setUndoStack] = useState<LUSpace[][]>([]);
  const [redoStack, setRedoStack] = useState<LUSpace[][]>([]);
  const [clipboard, setClipboard] = useState<LUSpace[]>(() => {
    if (typeof window !== "undefined") {
      try {
        const saved = localStorage.getItem("mep_clipboard_loading_unit_spaces");
        if (saved) return JSON.parse(saved);
      } catch (e) { }
    }
    return [];
  });

  const pushToUndo = (currentSpaces: LUSpace[]) => {
    setUndoStack((prev) => [...prev.slice(-30), JSON.parse(JSON.stringify(currentSpaces))]);
    setRedoStack([]);
  };

  const handleUndo = () => {
    if (isApprovedLocked || undoStack.length === 0) return;
    const previous = undoStack[undoStack.length - 1];
    setRedoStack((prev) => [...prev.slice(-30), JSON.parse(JSON.stringify(iopSpaces))]);
    setIopSpaces(previous);
    setUndoStack((prev) => prev.slice(0, -1));
    dirtyStore.set(true);
    toast.success("Undo successful");
  };

  const handleRedo = () => {
    if (isApprovedLocked || redoStack.length === 0) return;
    const next = redoStack[redoStack.length - 1];
    setUndoStack((prev) => [...prev.slice(-30), JSON.parse(JSON.stringify(iopSpaces))]);
    setIopSpaces(next);
    setRedoStack((prev) => prev.slice(0, -1));
    dirtyStore.set(true);
    toast.success("Redo successful");
  };

  // Click Outside to Close Context Menu
  useEffect(() => {
    const handleClick = () => setContextMenu(null);
    window.addEventListener("click", handleClick);
    return () => window.removeEventListener("click", handleClick);
  }, []);

  // Load state from localStorage on project change
  useEffect(() => {
    if (!project?.id) return;
    try {
      const stored = localStorage.getItem(`mep_loading_unit_calc_${project.id}`);
      if (stored) {
        const data = JSON.parse(stored);
        if (data.unitSystem) setUnitSystem(data.unitSystem);
        if (data.standardPreset) setStandardPreset(data.standardPreset);
        if (data.selectedCategory) setSelectedCategory(data.selectedCategory);
        if (data.weightOverrides) setWeightOverrides(data.weightOverrides);
        if (data.iopSpaces) setIopSpaces(data.iopSpaces);
        if (data.floorSections) setFloorSections(data.floorSections);
        if (data.luColWidths) setLuColWidths(data.luColWidths);
      }
      setTimeout(() => dirtyStore.set(false), 50);
    } catch (e) {
      console.error("Failed to load loading unit calculation", e);
    }
    setLoadedProjectId(project.id);
  }, [project?.id]);

  // Auto-save state to localStorage on state change
  useEffect(() => {
    if (project?.id && loadedProjectId === project.id) {
      const dataToSave = {
        unitSystem,
        standardPreset,
        selectedCategory,
        weightOverrides,
        iopSpaces,
        floorSections,
        luColWidths,
      };
      localStorage.setItem(`mep_loading_unit_calc_${project.id}`, JSON.stringify(dataToSave));
      dirtyStore.set(true);
    }
  }, [
    project?.id,
    loadedProjectId,
    unitSystem,
    standardPreset,
    selectedCategory,
    weightOverrides,
    iopSpaces,
    floorSections,
    luColWidths,
  ]);

  const handleSaveCurrent = () => {
    try {
      if (project?.id) {
        const dataToSave = {
          unitSystem,
          standardPreset,
          selectedCategory,
          weightOverrides,
          iopSpaces,
          floorSections,
          luColWidths,
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
      } catch (e) { }
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

  const currentWeights = activeWeights;

  // Filtered spaces list for search, filter & sort
  const filteredSpaces = useMemo(() => {
    let list = iopSpaces || [];
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      list = list.filter(s => (s.desc || "").toLowerCase().includes(q) || (s.floor || "").toLowerCase().includes(q));
    }
    if (showFlaggedOnly) {
      list = list.filter(s => getLUSpaceValidation(s).isFlagged);
    }
    if (filterFloor !== "all") {
      list = list.filter(s => (s.floor || "6th FLOOR") === filterFloor);
    }
    if (sortBy === "desc") {
      list = [...list].sort((a, b) => (a.desc || "").localeCompare(b.desc || ""));
    } else if (sortBy === "lu") {
      list = [...list].sort((a, b) => {
        const luA = Object.entries(a.fixtures || {}).reduce((sum, [fid, qty]) => sum + (Number(qty) || 0) * (currentWeights[fid] || 0), 0);
        const luB = Object.entries(b.fixtures || {}).reduce((sum, [fid, qty]) => sum + (Number(qty) || 0) * (currentWeights[fid] || 0), 0);
        return luB - luA;
      });
    }
    return list;
  }, [iopSpaces, searchQuery, showFlaggedOnly, filterFloor, sortBy, currentWeights]);

  // Selection Handlers (Matching Ventilation & Drainage)
  const handleToggleSelectAll = (checked: boolean) => {
    if (isApprovedLocked) {
      toast.info("Calculation is Approved and locked in Read-Only mode. Selection is locked.", { id: "readonly-notice" });
      return;
    }
    if (checked) {
      setSelectedIds(iopSpaces.map(s => s.id));
      toast.info(`Selected all ${iopSpaces.length} space(s)`);
    } else {
      setSelectedIds([]);
    }
  };

  const handleToggleSelectSpace = (id: number, e?: React.MouseEvent, explicitChecked?: boolean) => {
    if (isApprovedLocked) {
      toast.info("Calculation is Approved and locked in Read-Only mode. Selection is locked.", { id: "readonly-notice" });
      return;
    }

    // Shift+Click Range Selection
    if (e?.shiftKey && lastSelectedId !== null) {
      const allIds = filteredSpaces.map(s => s.id);
      const lastIdx = allIds.indexOf(lastSelectedId);
      const curIdx = allIds.indexOf(id);
      if (lastIdx !== -1 && curIdx !== -1) {
        const start = Math.min(lastIdx, curIdx);
        const end = Math.max(lastIdx, curIdx);
        const rangeIds = allIds.slice(start, end + 1);
        setSelectedIds(prev => Array.from(new Set([...prev, ...rangeIds])));
        setLastSelectedId(id);
        return;
      }
    }

    // Ctrl / Cmd or Explicit Checkbox Click (Toggle Selection)
    if (e?.ctrlKey || e?.metaKey || explicitChecked !== undefined) {
      setSelectedIds(prev => {
        const isSelected = prev.includes(id);
        const shouldSelect = explicitChecked !== undefined ? explicitChecked : !isSelected;
        if (shouldSelect) {
          return isSelected ? prev : [...prev, id];
        } else {
          return prev.filter(x => x !== id);
        }
      });
      setLastSelectedId(id);
      return;
    }

    // Plain Click (Select Single Row)
    setSelectedIds([id]);
    setLastSelectedId(id);
  };

  // Clipboard & Bulk Actions (Matching Ventilation Standards)
  const handleCopySpaces = (ids?: number[]) => {
    const targetIds = ids && ids.length > 0 ? ids : selectedIds;
    const targets = iopSpaces.filter(s => targetIds.includes(s.id));
    if (targets.length === 0) return;
    const cloned: LUSpace[] = JSON.parse(JSON.stringify(targets));
    setClipboard(cloned);
    if (typeof window !== "undefined") {
      try {
        localStorage.setItem("mep_clipboard_loading_unit_spaces", JSON.stringify(cloned));
        const headers = ["Floor", "Space Description", ...LU_FIXTURES_META.map(f => f.label), "Unit LU", "Space Qty", "No. Floors", "Total LU"];
        const rows = cloned.map(s => {
          const spaceLu = calculateSpaceLU(s, activeWeights);
          const totalLu = spaceLu * (s.qty || 1) * (s.floorQty || 1);
          return [
            s.floor || "6th FLOOR",
            s.desc || "Space",
            ...LU_FIXTURES_META.map(f => s.fixtures?.[f.key] || 0),
            spaceLu.toFixed(1),
            s.qty ?? 1,
            s.floorQty ?? 1,
            totalLu.toFixed(1),
          ];
        });
        const tsv = [headers.join("\t"), ...rows.map(r => r.join("\t"))].join("\n");
        navigator.clipboard?.writeText(tsv).catch(() => { });
      } catch (e) { }
    }
    toast.info(`${targets.length} space(s) copied to clipboard`);
  };

  const handleCutSpaces = (ids?: number[]) => {
    if (isApprovedLocked) {
      toast.info("Calculation is Approved and locked in Read-Only mode. Modifications are locked.", { id: "readonly-notice" });
      return;
    }
    const targetIds = ids && ids.length > 0 ? ids : selectedIds;
    const targets = iopSpaces.filter(s => targetIds.includes(s.id));
    if (targets.length === 0) return;
    if (targets.length >= iopSpaces.length) {
      toast.error("Cannot cut all spaces. Keep at least one space in schedule.");
      return;
    }
    pushToUndo(iopSpaces);
    handleCopySpaces(targetIds);
    setIopSpaces(prev => prev.filter(s => !targetIds.includes(s.id)));
    setSelectedIds([]);
    dirtyStore.set(true);
    toast.info(`${targets.length} space(s) cut to clipboard`);
  };

  const handlePasteSpaces = () => {
    if (isApprovedLocked) {
      toast.info("Calculation is Approved and locked in Read-Only mode. Modifications are locked.", { id: "readonly-notice" });
      return;
    }
    let sourceSpaces = clipboard;
    if (sourceSpaces.length === 0 && typeof window !== "undefined") {
      try {
        const saved = localStorage.getItem("mep_clipboard_loading_unit_spaces");
        if (saved) sourceSpaces = JSON.parse(saved);
      } catch (e) { }
    }
    if (sourceSpaces.length === 0) {
      toast.info("Clipboard is empty. Copy or cut spaces first (Ctrl+C).");
      return;
    }

    pushToUndo(iopSpaces);
    const targetFloor = activeFloor || floorSections[0] || "6th FLOOR";
    const pasted: LUSpace[] = sourceSpaces.map((s, idx) => ({
      ...s,
      id: Date.now() + idx + Math.floor(Math.random() * 1000),
      floor: floorSections.includes(s.floor) ? s.floor : targetFloor,
      desc: `${(s.desc || "Space").replace(/ \(Copy(-\d+)?\)$/, "")} (Copy)`,
      fixtures: { ...(s.fixtures || {}) }
    }));

    setIopSpaces(prev => [...prev, ...pasted]);
    setSelectedIds(pasted.map(s => s.id));
    dirtyStore.set(true);
    toast.success(`${pasted.length} space(s) pasted from clipboard`);
  };

  const handleBulkDuplicate = (ids?: number[]) => {
    if (isApprovedLocked) return;
    const targetIds = ids && ids.length > 0 ? ids : selectedIds;
    if (targetIds.length === 0) return;
    pushToUndo(iopSpaces);
    const duplicates: LUSpace[] = [];
    iopSpaces.forEach(s => {
      if (targetIds.includes(s.id)) {
        duplicates.push({
          ...s,
          id: Date.now() + Math.floor(Math.random() * 100000),
          desc: `${(s.desc || "Space").replace(/ \(Copy(-\d+)?\)$/, "")} (Copy)`,
          fixtures: { ...(s.fixtures || {}) }
        });
      }
    });
    setIopSpaces(prev => [...prev, ...duplicates]);
    setSelectedIds(duplicates.map(d => d.id));
    dirtyStore.set(true);
    toast.success(`Duplicated ${duplicates.length} space(s).`);
  };

  const handleBulkDelete = (ids?: number[]) => {
    if (isApprovedLocked) {
      toast.info("Calculation is Approved and Locked. Discipline Coordinator must unlock to delete spaces.", { id: "readonly-notice" });
      return;
    }
    const targetIds = ids && ids.length > 0 ? ids : selectedIds;
    if (targetIds.length === 0) return;
    if (targetIds.length >= iopSpaces.length) {
      toast.error("Cannot delete all spaces. Keep at least one space in schedule.");
      return;
    }
    pushToUndo(iopSpaces);
    const count = targetIds.length;
    setIopSpaces(prev => prev.filter(s => !targetIds.includes(s.id)));
    setSelectedIds([]);
    dirtyStore.set(true);
    toast.info(`Deleted ${count} space(s)`);
  };

  const handleBulkMoveFloor = () => {
    if (selectedIds.length === 0) return;
    const newTargetFloor = prompt("Enter target Floor Section for selected space(s):", activeFloor);
    if (newTargetFloor && newTargetFloor.trim()) {
      const cleanFloor = newTargetFloor.trim().toUpperCase();
      pushToUndo(iopSpaces);
      setIopSpaces(iopSpaces.map(s => {
        if (selectedIds.includes(s.id)) {
          return { ...s, floor: cleanFloor };
        }
        return s;
      }));
      dirtyStore.set(true);
      toast.success(`Moved ${selectedIds.length} space(s) to ${cleanFloor}`);
    }
  };

  const handleBulkEditQty = () => {
    if (selectedIds.length === 0) return;
    const newQtyVal = prompt("Enter new Quantity for selected space(s):", "1");
    if (newQtyVal && !isNaN(Number(newQtyVal))) {
      const qtyNum = Math.max(1, Number(newQtyVal));
      pushToUndo(iopSpaces);
      setIopSpaces(iopSpaces.map(s => {
        if (selectedIds.includes(s.id)) {
          return { ...s, qty: qtyNum };
        }
        return s;
      }));
      dirtyStore.set(true);
      toast.success(`Updated Qty to ${qtyNum} for ${selectedIds.length} space(s)`);
    }
  };

  // Keyboard Shortcuts Listener (Ctrl+A, Escape, Delete, Ctrl+C, Ctrl+X, Ctrl+V, Ctrl+D, Ctrl+Z, Ctrl+Y, Ctrl+S, F)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Escape: Close modals / menus or deselect rows
      if (e.key === "Escape") {
        if (editingSpace || assignCommentOpen || contextMenu) {
          setEditingSpace(null);
          setAssignCommentOpen(false);
          setContextMenu(null);
        } else if (selectedIds.length > 0) {
          e.preventDefault();
          setSelectedIds([]);
        }
        return;
      }

      const isMac = navigator.platform.toUpperCase().indexOf("MAC") >= 0;
      const isCmdOrCtrl = isMac ? e.metaKey : e.ctrlKey;
      const activeEl = document.activeElement;
      const isModalActive = Boolean(editingSpace || assignCommentOpen);

      // Lock Protection: Block select-all and modification shortcuts when calculation is locked/approved
      if (isLocked) {
        if (isCmdOrCtrl && (e.key.toLowerCase() === "a" || e.code === "KeyA")) {
          e.preventDefault();
          toast.info("Calculation is Approved & Locked. Selection is locked.", { id: "readonly-notice" });
          return;
        }
        if (["Delete", "Backspace"].includes(e.key) || (isCmdOrCtrl && ["x", "v", "d", "z", "y"].includes(e.key.toLowerCase()))) {
          e.preventDefault();
          toast.info("Calculation is Approved & Locked. Modifications are locked.", { id: "readonly-notice" });
          return;
        }
      }

      // 1. Ctrl+A / Cmd+A: Select All Spaces (when no modal is active)
      if (isCmdOrCtrl && (e.key.toLowerCase() === "a" || e.code === "KeyA")) {
        if (!isModalActive) {
          e.preventDefault();
          if (activeEl && "blur" in activeEl) {
            (activeEl as HTMLElement).blur();
          }
          if (iopSpaces.length > 0) {
            setSelectedIds(iopSpaces.map(s => s.id));
            toast.info(`Selected all ${iopSpaces.length} space(s) (Ctrl+A)`);
          }
          return;
        }
      }

      // Do NOT intercept if typing inside an active form input/textarea/select
      const isInput = activeEl && (
        (activeEl.tagName === "INPUT" && (activeEl as HTMLInputElement).type !== "checkbox" && (activeEl as HTMLInputElement).type !== "radio") ||
        activeEl.tagName === "TEXTAREA" ||
        (activeEl as HTMLElement).isContentEditable ||
        activeEl.tagName === "SELECT"
      );
      if (isInput) return;

      // 2. Undo / Redo: Ctrl+Z / Ctrl+Y / Ctrl+Shift+Z
      if (isCmdOrCtrl && !e.shiftKey && e.key.toLowerCase() === "z") {
        e.preventDefault();
        handleUndo();
        return;
      }
      if ((isCmdOrCtrl && e.key.toLowerCase() === "y") || (isCmdOrCtrl && e.shiftKey && e.key.toLowerCase() === "z")) {
        e.preventDefault();
        handleRedo();
        return;
      }

      // 3. Delete / Backspace: Delete selected space(s)
      if (e.key === "Delete" || e.key === "Backspace") {
        if (selectedIds.length > 0) {
          e.preventDefault();
          handleBulkDelete();
        }
        return;
      }

      // 4. Ctrl+C: Copy selected space(s)
      if (isCmdOrCtrl && e.key.toLowerCase() === "c") {
        if (selectedIds.length > 0) {
          e.preventDefault();
          handleCopySpaces();
        }
        return;
      }

      // 5. Ctrl+X: Cut selected space(s)
      if (isCmdOrCtrl && e.key.toLowerCase() === "x") {
        if (selectedIds.length > 0) {
          e.preventDefault();
          handleCutSpaces();
        }
        return;
      }

      // 6. Ctrl+V: Paste space(s) from clipboard
      if (isCmdOrCtrl && e.key.toLowerCase() === "v") {
        e.preventDefault();
        handlePasteSpaces();
        return;
      }

      // 7. Ctrl+D: Duplicate selected space(s)
      if (isCmdOrCtrl && e.key.toLowerCase() === "d") {
        if (selectedIds.length > 0) {
          e.preventDefault();
          handleBulkDuplicate();
        }
        return;
      }

      // 8. Ctrl+S: Save calculation
      if (isCmdOrCtrl && e.key.toLowerCase() === "s") {
        e.preventDefault();
        handleSaveCurrent();
        return;
      }

      // 9. F key: Toggle Flag on selected space(s)
      if (!isCmdOrCtrl && (e.key.toLowerCase() === "f" || e.code === "KeyF")) {
        if (selectedIds.length > 0) {
          e.preventDefault();
          const targets = iopSpaces.filter(s => selectedIds.includes(s.id));
          const hasUnflagged = targets.some(s => !s.flagged && !getLUSpaceValidation(s).isMissing);
          const newFlagged = hasUnflagged;
          setIopSpaces(prev => prev.map(item => selectedIds.includes(item.id) ? { ...item, flagged: newFlagged } : item));
          dirtyStore.set(true);
          toast.info(newFlagged ? `Flagged ${targets.length} space(s) for review` : `Unflagged ${targets.length} space(s)`);
        }
        return;
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [
    selectedIds,
    iopSpaces,
    editingSpace,
    assignCommentOpen,
    contextMenu,
    clipboard,
    undoStack,
    redoStack,
    isApprovedLocked,
    floorSections,
    activeFloor,
    activeWeights,
    filteredSpaces,
    lastSelectedId
  ]);

  const handleAddSpace = () => {
    if (isApprovedLocked) {
      toast.info("Calculation is Approved and Locked. Discipline Coordinator must unlock to add spaces.", { id: "readonly-notice" });
      return;
    }
    const targetFloor = activeFloor || floorSections[0] || "6th FLOOR";
    if (!floorSections.includes(targetFloor)) {
      setFloorSections(prev => [...prev, targetFloor]);
    }
    const nextId = Date.now();
    const newSpace: LUSpace = {
      id: nextId,
      desc: `New Space (${iopSpaces.length + 1})`,
      floor: targetFloor,
      qty: 1,
      floorQty: 1,
      std: selectedCategory || "med",
      fixtures: {},
      flagged: true
    };
    setIopSpaces(prev => [...prev, newSpace]);
    setShowFlaggedOnly(false);
    setSearchQuery("");
    toast.success(`Added new space to ${targetFloor}`);
  };

  const handleAddSpaceToFloor = (floorTarget: string) => {
    if (isApprovedLocked) {
      toast.info("Calculation is Approved and Locked. Discipline Coordinator must unlock to add spaces.", { id: "readonly-notice" });
      return;
    }
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
    if (isApprovedLocked) {
      toast.info("Calculation is Approved and Locked. Discipline Coordinator must unlock to add floors.", { id: "readonly-notice" });
      return;
    }
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
    if (isApprovedLocked) {
      toast.info("Calculation is Approved and Locked. Discipline Coordinator must unlock to delete floors.", { id: "readonly-notice" });
      return;
    }
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



  // PDF Export Function (Matching Ventilation PDF Format & Corporate Standards)
  const handleExportPDF = async () => {
    await exportLoadingUnitPDF({
      iopSpaces,
      floorSections,
      activeWeights: currentWeights,
      standardPreset,
      selectedCategory,
      unitLabel,
      calculations,
      showSpaceQty,
      showFloorsCol,
      meta: {
        projectName: (project as any)?.name || calcMeta.projectName,
        client: (project as any)?.client || calcMeta.client,
        projectNo: (project as any)?.code || calcMeta.projectNo,
        calcNo: (project as any)?.calcNo || calcMeta.calcNo,
        date: calcMeta.date,
        endUser: (project as any)?.endUser || calcMeta.endUser,
        userName: currentUserName,
        reviewState: calcReviewState
      }
    });
  };


  // Group by floor for listing
  const floorsGrouped = useMemo(() => {
    const grouped = {};
    floorSections.forEach(fl => {
      grouped[fl] = [];
    });
    filteredSpaces.forEach(s => {
      const fl = s.floor || "6th FLOOR";
      if (!grouped[fl]) grouped[fl] = [];
      grouped[fl].push(s);
    });
    return grouped;
  }, [filteredSpaces, floorSections]);

  const allSelected = selectedIds.length === iopSpaces.length && iopSpaces.length > 0;

  return (
    <AppShell title="Loading Unit Calculator" onIntelClick={() => setIntelOpen((v) => !v)} intelOpen={intelOpen} hideSubHeader={true}>
      <div className="flex h-full min-h-0 bg-transparent font-sans">
        <div className="flex-1 min-w-0 flex flex-col pt-4 gap-4 overflow-y-auto h-full">

          {/* Header Bar */}
          <div className="flex justify-between items-center shrink-0 select-none no-print py-0.5 flex-wrap gap-2">
            <div className="flex items-center gap-3 flex-wrap">
              <h1 className="text-[28px] font-bold tracking-tight text-foreground">
                Loading Unit Calculator
              </h1>
              <button
                type="button"
                onClick={() => setIntelOpen((v) => !v)}
                className={`flex items-center gap-1.5 px-3 py-1 rounded-full transition-colors text-[12.5px] font-semibold border cursor-pointer shrink-0 ${intelOpen
                  ? "bg-primary text-primary-foreground border-primary"
                  : "bg-primary/10 text-primary hover:bg-primary/20 border-primary/20"
                  }`}
                title="Toggle Loading Unit Intelligence"
              >
                <Sparkles className="size-3.5" />
                Intelligence
              </button>
              <CalculationReviewBar projectId={project?.id || "default"} calculatorPath="/plumbing-loading-unit" calculatorTitle="Loading Unit Calculator" />
            </div>
          </div>

          {/* Unified White Card Container (Matching Ventilation Layout Structure) */}
          <div className={`flex-1 flex flex-col min-h-[450px] overflow-hidden rounded-2xl transition-all duration-300 ${calcReviewState?.status === "APPROVED"
            ? "bg-card border-2 border-emerald-500 ring-2 ring-emerald-500/50 shadow-[0_0_30px_rgba(16,185,129,0.25)]"
            : calcReviewState?.status === "REJECTED"
              ? "bg-card border-2 border-red-500 ring-2 ring-red-500/50 shadow-[0_0_30px_rgba(239,68,68,0.25)]"
              : calcReviewState?.status === "REVIEWED"
                ? "bg-card border-2 border-indigo-500 ring-2 ring-indigo-500/50 shadow-[0_0_30px_rgba(99,102,241,0.25)]"
                : "bg-card border border-border shadow-[0_1px_3px_rgba(0,0,0,0.05)]"
            }`}>

            {/* Row 1: Header / Main Tabs on Left + Standard & Category Dropdowns on Right */}
            <div className="flex items-center justify-between px-4 py-2 bg-card shrink-0 select-none no-print border-b border-border/50 gap-4 flex-wrap">
              <div className="flex bg-slate-100 dark:bg-slate-900/70 p-1 rounded-full gap-1 border border-border/80">
                <button
                  type="button"
                  onClick={() => setActiveTab("spaces")}
                  className={`px-4 py-1.5 text-xs font-semibold rounded-full transition-all duration-150 cursor-pointer ${activeTab === "spaces"
                    ? "bg-background text-foreground shadow-xs font-bold"
                    : "text-muted-foreground hover:text-foreground"
                    }`}
                >
                  Spaces
                </button>

                <button
                  type="button"
                  onClick={() => setActiveTab("report")}
                  className={`px-4 py-1.5 text-xs font-semibold rounded-full transition-all duration-150 cursor-pointer ${activeTab === "report"
                    ? "bg-background text-foreground shadow-xs font-bold"
                    : "text-muted-foreground hover:text-foreground"
                    }`}
                >
                  Report
                </button>
              </div>

              {/* Right Side Standard & Category Selectors */}
              <div className="flex items-center gap-2 flex-wrap">
                <div className="flex items-center gap-1.5 bg-slate-50 dark:bg-slate-900/60 p-1 px-3 rounded-full border border-border/80 text-xs font-semibold select-none">
                  <Globe className="size-3.5 text-primary shrink-0" />
                  <label className="text-[11px] font-bold text-muted-foreground whitespace-nowrap">Standard:</label>
                  <div className="relative inline-flex items-center">
                    <select
                      value={standardPreset}
                      onChange={(e) => {
                        const newPreset = e.target.value as StandardPreset;
                        setStandardPreset(newPreset);
                        setSelectedCategory(DEFAULT_CATEGORY_FOR_PRESET[newPreset] || "std");
                        setWeightOverrides({});
                      }}
                      className="appearance-none bg-background border border-border/60 rounded-full pl-2.5 pr-6 py-0.5 text-xs font-bold text-foreground outline-none focus:border-primary shadow-2xs cursor-pointer h-7 max-w-[200px] sm:max-w-[250px] truncate"
                    >
                      <optgroup label="Regional UAE">
                        <option value="dubai">Dubai Standard (DBC 2021 / CIBSE Q = 0.10 * √LU)</option>
                      </optgroup>
                      <optgroup label="British Standards & CIPHE">
                        <option value="iop_bs">IoP PESDG / BS EN 806 / BS 8558 (LU Standard)</option>
                        <option value="bs_806">BS 806 / BS EN 806 (UK / Europe)</option>
                        <option value="bs_8558">BS 8558 Water Supply</option>
                        <option value="iop_low">IoP / CIPHE Low Demand</option>
                        <option value="iop_med">IoP / CIPHE Medium Demand</option>
                        <option value="iop_high">IoP / CIPHE High Demand</option>
                      </optgroup>
                      <optgroup label="International Codes (US)">
                        <option value="ipc_upc">IPC / UPC Combined Standard (WSFU)</option>
                        <option value="ipc">IPC (International Plumbing Code - Table E103.3)</option>
                        <option value="upc">UPC (Uniform Plumbing Code)</option>
                      </optgroup>
                    </select>
                    <ChevronDown className="size-3 absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none" />
                  </div>
                </div>

                {STANDARD_CATEGORIES[standardPreset] && STANDARD_CATEGORIES[standardPreset].length > 1 && (
                  <div className="flex items-center gap-1.5 bg-slate-50 dark:bg-slate-900/60 p-1 px-3 rounded-full border border-border/80 text-xs font-semibold select-none">
                    <label className="text-[11px] font-bold text-muted-foreground whitespace-nowrap">Category:</label>
                    <div className="relative inline-flex items-center">
                      <select
                        value={selectedCategory}
                        onChange={(e) => {
                          setSelectedCategory(e.target.value);
                          setWeightOverrides({});
                        }}
                        className="appearance-none bg-background border border-border/60 rounded-full pl-2.5 pr-6 py-0.5 text-xs font-bold text-foreground outline-none focus:border-primary shadow-2xs cursor-pointer h-7 max-w-[150px] sm:max-w-[200px] truncate"
                      >
                        {STANDARD_CATEGORIES[standardPreset].map(cat => (
                          <option key={cat.id} value={cat.id}>{cat.label}</option>
                        ))}
                      </select>
                      <ChevronDown className="size-3 absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none" />
                    </div>
                  </div>
                )}

                {Object.keys(weightOverrides).length > 0 && (
                  <button
                    type="button"
                    onClick={handleResetWeightsToDefault}
                    className="text-[10.5px] font-bold text-amber-600 dark:text-amber-400 bg-amber-500/10 hover:bg-amber-500/20 border border-amber-500/30 px-2.5 py-1 rounded-full transition-all cursor-pointer"
                    title="Reset custom weights to standard defaults"
                  >
                    ↺ Reset Weights
                  </button>
                )}
              </div>
            </div>

            {/* Row 2: Action Toolbar (Search, Filter, Sort, Import, Export, + Add Floor Section, + Add Space) */}
            {activeTab === "spaces" && (
              <div className="relative flex items-center justify-between px-4 py-2 bg-slate-50/50 dark:bg-slate-900/30 shrink-0 select-none no-print border-b border-border/50 gap-3 flex-wrap">
                {/* Left Side: Search Filter & Sort Options */}
                <div className="flex items-center gap-2 flex-wrap">
                  <div className="relative flex items-center">
                    <Search className="size-3.5 absolute left-3 text-muted-foreground pointer-events-none" />
                    <input
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      placeholder="Filter spaces..."
                      className="h-8 w-48 pl-8 pr-3 bg-background border border-border rounded-full text-xs outline-none focus:border-primary transition-all"
                    />
                  </div>

                  {/* Filter Popover */}
                  <Popover>
                    <PopoverTrigger asChild>
                      <button
                        className={`relative inline-flex items-center justify-center h-8 w-8 rounded-full border transition-all cursor-pointer group overflow-visible ${activeFiltersCount > 0
                          ? "bg-primary/10 border-primary/45 text-primary font-medium"
                          : "border-border text-muted-foreground hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-foreground"
                          }`}
                        title="Filter spaces"
                      >
                        <Filter className="size-3.5 shrink-0" />
                        {activeFiltersCount > 0 && (
                          <span className="absolute -top-1 -right-1 flex items-center justify-center bg-primary text-white font-bold rounded-full size-3.5 text-[8.5px] shadow-xs">
                            {activeFiltersCount}
                          </span>
                        )}
                      </button>
                    </PopoverTrigger>
                    <PopoverContent align="start" className="w-64 p-3 bg-popover border border-border rounded-xl shadow-lg font-sans flex flex-col gap-2.5 z-50">
                      <div className="flex items-center justify-between pb-1.5 border-b border-border">
                        <span className="text-xs font-semibold text-foreground">Filter Spaces</span>
                        {activeFiltersCount > 0 && (
                          <button onClick={handleResetFilters} className="text-[10px] text-primary hover:underline font-semibold cursor-pointer">
                            Clear All
                          </button>
                        )}
                      </div>
                      <div className="flex flex-col gap-1">
                        <span className="text-[10.5px] font-semibold text-muted-foreground uppercase tracking-wider">Floor Section</span>
                        <div className="relative flex items-center">
                          <select
                            value={filterFloor}
                            onChange={(e) => setFilterFloor(e.target.value)}
                            className="h-8 w-full appearance-none pl-2.5 pr-7 bg-slate-100 dark:bg-slate-900 border border-border rounded-lg text-xs outline-none cursor-pointer text-foreground focus:border-primary"
                          >
                            <option value="all">All Floor Sections</option>
                            {floorSections.map(fl => (
                              <option key={fl} value={fl}>{fl}</option>
                            ))}
                          </select>
                          <ChevronDown className="size-3 absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none" />
                        </div>
                      </div>
                    </PopoverContent>
                  </Popover>

                  {/* View / Sort Popover */}
                  <Popover>
                    <PopoverTrigger asChild>
                      <button
                        className={`relative inline-flex items-center justify-center h-8 w-8 rounded-full border transition-all cursor-pointer group overflow-visible ${sortBy !== "none" || rowDensity === "compact"
                          ? "bg-primary/10 border-primary/45 text-primary font-medium"
                          : "border-border text-muted-foreground hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-foreground"
                          }`}
                        title="Sort & View Options"
                      >
                        <SlidersHorizontal className="size-3.5 shrink-0" />
                        {sortBy !== "none" && (
                          <span className="absolute -top-1 -right-1 flex items-center justify-center bg-primary text-white font-bold rounded-full size-3.5 text-[8.5px] shadow-xs">
                            ✓
                          </span>
                        )}
                      </button>
                    </PopoverTrigger>
                    <PopoverContent align="start" className="w-56 p-3 bg-popover border border-border rounded-xl shadow-lg font-sans flex flex-col gap-2.5 z-50">
                      <div className="pb-1.5 border-b border-border text-xs font-semibold text-foreground">
                        View Options
                      </div>

                      <div className="flex flex-col gap-1">
                        <span className="text-[10.5px] font-semibold text-muted-foreground uppercase tracking-wider">Row Density</span>
                        <div className="flex rounded-full border border-border p-0.5 bg-slate-100 dark:bg-slate-900">
                          <button
                            onClick={() => setRowDensity("default")}
                            className={`flex-1 py-0.5 text-[10.5px] font-semibold rounded-full transition-all ${rowDensity === "default" ? "bg-background shadow-xs text-foreground" : "text-muted-foreground"
                              }`}
                          >
                            Default
                          </button>
                          <button
                            onClick={() => setRowDensity("compact")}
                            className={`flex-1 py-0.5 text-[10.5px] font-semibold rounded-full transition-all ${rowDensity === "compact" ? "bg-background shadow-xs text-foreground" : "text-muted-foreground"
                              }`}
                          >
                            Compact
                          </button>
                        </div>
                      </div>

                      <div className="flex flex-col gap-1">
                        <span className="text-[10.5px] font-semibold text-muted-foreground uppercase tracking-wider">Sort By</span>
                        <div className="relative flex items-center">
                          <select
                            value={sortBy}
                            onChange={(e) => setSortBy(e.target.value as any)}
                            className="h-8 w-full appearance-none pl-2.5 pr-7 bg-slate-100 dark:bg-slate-900 border border-border rounded-lg text-xs outline-none cursor-pointer text-foreground focus:border-primary"
                          >
                            <option value="none">Original Order</option>
                            <option value="desc">Description (A-Z)</option>
                            <option value="lu">Total LU (High to Low)</option>
                          </select>
                          <ChevronDown className="size-3 absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none" />
                        </div>
                      </div>
                    </PopoverContent>
                  </Popover>
                </div>

                {/* Right Side Actions */}
                <div className="ml-auto flex items-center gap-1.5 flex-wrap">
                  <input
                    type="file"
                    ref={importFileRef}
                    onChange={handleImportExcel}
                    accept=".xlsx,.xls,.csv"
                    className="hidden"
                  />
                  <button
                    type="button"
                    disabled={isEffectiveReadOnly}
                    onClick={() => {
                      if (isEffectiveReadOnly) {
                        toast.info("Workspace is in Read-Only mode. Modifications are locked.", { id: "readonly-notice" });
                        return;
                      }
                      importFileRef.current?.click();
                    }}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-full border border-border bg-background hover:bg-slate-100 dark:hover:bg-slate-800 transition-all cursor-pointer shadow-2xs disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <Download className="size-3.5" /> Import
                  </button>

                  <button
                    type="button"
                    onClick={handleExportPDF}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-full border border-border bg-background hover:bg-slate-100 dark:hover:bg-slate-800 transition-all cursor-pointer shadow-2xs"
                  >
                    <FileText className="size-3.5" /> Export
                  </button>

                  <button
                    type="button"
                    disabled={isEffectiveReadOnly}
                    onClick={handleAddNewFloorSection}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-full border border-primary/30 bg-primary/10 text-primary hover:bg-primary/20 transition-all cursor-pointer shadow-2xs disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <Plus className="size-3.5" /> Add Floor Section
                  </button>

                  <button
                    type="button"
                    disabled={isEffectiveReadOnly}
                    onClick={handleAddSpace}
                    className="inline-flex items-center gap-1.5 px-4 py-1.5 text-xs font-semibold rounded-full bg-primary hover:bg-primary/90 text-primary-foreground shadow-xs transition-all cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <Plus className="size-3.5" /> Add Space
                  </button>
                </div>

                {/* Bulk actions bar overlay (Matching Ventilation Schedule exactly) */}
                {!isApprovedLocked && selectedIds.length > 0 && (
                  <div className="absolute inset-0 flex items-center justify-between px-3 bg-[#eef6fc] dark:bg-[#0c2233] text-[12px] text-[#06456F] dark:text-[#0A7BC7] z-20 no-print modal-blur-bg">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-semibold">{selectedIds.length} selected</span>
                      <span className="text-primary/30">·</span>
                      <BulkBtn icon={Copy} onClick={() => handleCopySpaces()}>Copy</BulkBtn>
                      <BulkBtn icon={Copy} onClick={() => handleCutSpaces()}>Cut</BulkBtn>
                      <BulkBtn icon={Copy} onClick={() => handleBulkDuplicate()}>Duplicate</BulkBtn>
                      <BulkBtn icon={Building2} onClick={handleBulkMoveFloor}>Move to Floor</BulkBtn>
                      <BulkBtn icon={Edit3} onClick={handleBulkEditQty}>Edit Qty</BulkBtn>
                      <BulkBtn icon={Trash2} onClick={() => handleBulkDelete()}>Delete</BulkBtn>
                    </div>

                    <button onClick={() => setSelectedIds([])} className="ml-auto text-[#06456F]/70 hover:text-[#06456F] dark:text-[#0A7BC7]/80 dark:hover:text-[#0A7BC7] inline-flex items-center gap-1 text-[11.5px] font-semibold transition-colors hover:bg-primary/5 active:bg-primary/10 px-2 py-0.5 rounded cursor-pointer">
                      <X className="size-3" /> Clear (Esc)
                    </button>
                  </div>
                )}
              </div>
            )}

            {/* Row 3: Tab Content Body Area */}
            <div className="flex-1 min-h-0 flex flex-col overflow-hidden">
              {activeTab === "spaces" && (
                <div className="flex-1 min-h-0 flex flex-col overflow-hidden">

                  {/* Main Spaces Schedule Table with Floor Section Grouping */}
                  <div className="overflow-y-auto overflow-x-hidden w-full flex-1 min-h-0 custom-scrollbar">
                    <table className="w-full table-fixed border-collapse text-[11.5px] font-sans text-left">
                      <colgroup>
                        <col style={{ width: "3.5%" }} />
                        <col style={{ width: "17%" }} />
                        <col style={{ width: "5.1%" }} />
                        <col style={{ width: "5.1%" }} />
                        <col style={{ width: "5.1%" }} />
                        <col style={{ width: "5.1%" }} />
                        <col style={{ width: "5.1%" }} />
                        <col style={{ width: "5.1%" }} />
                        <col style={{ width: "5.1%" }} />
                        <col style={{ width: "5.1%" }} />
                        <col style={{ width: "5.1%" }} />
                        <col style={{ width: "5.1%" }} />
                        <col style={{ width: "5%" }} />
                        <col style={{ width: "6.2%" }} />
                        <col style={{ width: "6.2%" }} />
                        <col style={{ width: "6.3%" }} />
                        <col style={{ width: "4%" }} />
                      </colgroup>
                      <thead>
                        <tr className="bg-slate-50 dark:bg-slate-900/60 border-b border-border/80 text-muted-foreground uppercase text-[10px] tracking-tight font-bold select-none sticky top-0 z-20 backdrop-blur-sm h-9">
                          <th className="py-2 px-1 text-center">
                            <input
                              type="checkbox"
                              disabled={isLocked}
                              checked={allSelected && !isLocked}
                              ref={(el) => {
                                if (el) {
                                  el.indeterminate = selectedIds.length > 0 && !allSelected && !isLocked;
                                }
                              }}
                              onChange={(e) => handleToggleSelectAll(e.target.checked)}
                              className="size-3.5 accent-primary cursor-pointer rounded disabled:opacity-40 disabled:cursor-not-allowed"
                              title={isLocked ? "Calculation is locked" : "Select All Spaces (Ctrl+A)"}
                            />
                          </th>
                          <th className="py-2 px-2 text-left text-[11px] tracking-wider truncate">DESCRIPTION</th>
                          {LU_FIXTURES_META.map(f => (
                            <th key={f.key} className="py-1 px-0.5 text-center font-mono text-[9px] sm:text-[9.5px] leading-tight font-bold uppercase" title={f.label}>
                              <span className="block truncate">{f.label}</span>
                            </th>
                          ))}
                          <th className="py-2 px-1 text-center text-primary text-[10.5px]">LU</th>
                          <th className="py-2 px-0.5 text-center leading-tight text-[9.5px]">SPACE QTY</th>
                          <th className="py-2 px-0.5 text-center leading-tight text-[9.5px]">NO. OF FLOORS</th>
                          <th className="py-2 px-1 text-right text-primary font-bold leading-tight text-[10.5px]">TOTAL LU</th>
                          <th className="py-2 px-0.5 text-center text-[9.5px]">ACTIONS</th>
                        </tr>

                        {/* Fixture Weights Overview Row */}
                        <tr className="bg-slate-100/70 dark:bg-slate-900/40 border-b border-border/60 text-[10px] text-muted-foreground select-none h-7">
                          <td className="p-1 text-center"></td>
                          <td className="p-1 px-2 text-left font-semibold text-muted-foreground italic text-[10px] truncate">Standard Rate Override</td>
                          {LU_FIXTURES_META.map(f => {
                            const val = currentWeights[f.key] ?? 0;
                            const isOverridden = weightOverrides[f.key] !== undefined;
                            return (
                              <td key={f.key} className="p-0.5 text-center font-mono">
                                <input
                                  type="number"
                                  step="0.1"
                                  min="0"
                                  disabled={isApprovedLocked}
                                  value={val}
                                  onChange={(e) => {
                                    if (isApprovedLocked) return;
                                    const raw = e.target.value;
                                    if (raw === "") {
                                      const next = { ...weightOverrides };
                                      delete next[f.key];
                                      setWeightOverrides(next);
                                    } else {
                                      const num = parseFloat(raw);
                                      if (!isNaN(num) && num >= 0) {
                                        setWeightOverrides(prev => ({ ...prev, [f.key]: num }));
                                      }
                                    }
                                  }}
                                  className={`w-11 h-5 text-center text-[10px] font-bold font-mono rounded border outline-none transition-all ${isOverridden
                                    ? "bg-amber-500/15 border-amber-500 text-amber-600 dark:text-amber-400 font-extrabold focus:ring-1 focus:ring-amber-500"
                                    : "bg-blue-500/5 dark:bg-blue-950/40 border-blue-500/30 text-[#0A7BC7] dark:text-blue-400 focus:ring-1 focus:ring-[#0A7BC7]"
                                    } ${isApprovedLocked ? "opacity-50 cursor-not-allowed" : "cursor-pointer"}`}
                                  title={
                                    isOverridden
                                      ? `Custom weight override (${val} LU/WSFU). Clear input to restore standard rate default.`
                                      : `Standard rate (${val} LU/WSFU). Type a new number to override weight.`
                                  }
                                />
                              </td>
                            );
                          })}
                          <td className="p-0.5 text-center font-mono font-bold text-primary text-[10.5px]">Σ</td>
                          <td className="p-0.5 text-center">
                            <button
                              type="button"
                              onClick={() => {
                                if (isApprovedLocked) return;
                                const nextState = !showSpaceQty;
                                setShowSpaceQty(nextState);
                                toast.info(`Space Quantity multiplier ${nextState ? 'enabled (ON)' : 'disabled (OFF)'}`);
                              }}
                              disabled={isApprovedLocked}
                              className={`inline-flex items-center justify-center px-1.5 py-0.5 rounded text-[8.5px] font-bold font-mono transition-all cursor-pointer ${showSpaceQty
                                ? "bg-[#0A7BC7] text-white shadow-2xs hover:bg-[#0865A3]"
                                : "bg-slate-200 dark:bg-slate-800 text-muted-foreground hover:bg-slate-300 dark:hover:bg-slate-700"
                                } ${isApprovedLocked ? "opacity-50 cursor-not-allowed" : ""}`}
                              title={showSpaceQty ? "Space Quantity enabled in calculation. Click to toggle OFF." : "Space Quantity disabled in calculation. Click to toggle ON."}
                            >
                              {showSpaceQty ? "ON" : "OFF"}
                            </button>
                          </td>
                          <td className="p-0.5 text-center">
                            <button
                              type="button"
                              onClick={() => {
                                if (isApprovedLocked) return;
                                const nextState = !showFloorsCol;
                                setShowFloorsCol(nextState);
                                toast.info(`No. of Floors multiplier ${nextState ? 'enabled (ON)' : 'disabled (OFF)'}`);
                              }}
                              disabled={isApprovedLocked}
                              className={`inline-flex items-center justify-center px-1.5 py-0.5 rounded text-[8.5px] font-bold font-mono transition-all cursor-pointer ${showFloorsCol
                                ? "bg-[#0A7BC7] text-white shadow-2xs hover:bg-[#0865A3]"
                                : "bg-slate-200 dark:bg-slate-800 text-muted-foreground hover:bg-slate-300 dark:hover:bg-slate-700"
                                } ${isApprovedLocked ? "opacity-50 cursor-not-allowed" : ""}`}
                              title={showFloorsCol ? "No. of Floors multiplier enabled in calculation. Click to toggle OFF." : "No. of Floors multiplier disabled in calculation. Click to toggle ON."}
                            >
                              {showFloorsCol ? "ON" : "OFF"}
                            </button>
                          </td>
                          <td className="p-0.5 px-1 text-right font-mono font-bold text-primary text-[10px]">Total</td>
                          <td className="p-0.5 text-center"></td>
                        </tr>
                      </thead>

                      {Object.keys(floorsGrouped).map((floor) => (
                        <tbody key={floor} className="divide-y divide-border/50">
                          {/* Floor Group Section Header */}
                          <ContextMenu>
                            <ContextMenuTrigger asChild>
                              <tr className="bg-slate-50/90 dark:bg-slate-900/70 border-y border-border/70 text-foreground font-bold text-[12px] group select-none cursor-pointer">
                                <td colSpan={LU_FIXTURES_META.length + 7} className="py-2 px-3 text-left">
                                  <div className="flex items-center justify-between">
                                    <div className="flex items-center gap-2">
                                      <ChevronDown className="size-3.5 text-primary shrink-0" />
                                      <FloorNameInput
                                        floor={floor}
                                        disabled={isApprovedLocked}
                                        onRename={handleRenameFloorGroup}
                                      />
                                      <span className="text-[10px] text-muted-foreground font-normal">({floorsGrouped[floor].length} space types)</span>
                                      <span className="text-[10px] text-muted-foreground/60 font-normal hidden sm:inline">(Right-click or press Delete to remove)</span>
                                    </div>

                                    <div className="flex items-center gap-2">
                                      <button
                                        type="button"
                                        disabled={isApprovedLocked}
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          if (isApprovedLocked) return;
                                          setActiveFloor(floor);
                                          const nextId = Date.now() + Math.random();
                                          const newSpace: LUSpace = {
                                            id: nextId,
                                            desc: "New Space",
                                            floor: floor,
                                            qty: 1,
                                            floorQty: 1,
                                            std: selectedCategory || "med",
                                            fixtures: {}
                                          };
                                          setIopSpaces(prev => [...prev, newSpace]);
                                          toast.success(`Added new space to ${floor}`);
                                        }}
                                        className="flex items-center gap-1 text-[#0A7BC7] hover:bg-blue-50 dark:hover:bg-blue-950/40 text-[10.5px] font-bold px-2.5 py-0.5 rounded-full border border-blue-300 dark:border-blue-700 transition-colors cursor-pointer bg-white dark:bg-slate-900 shadow-2xs"
                                        title={`Add a new space row to ${floor}`}
                                      >
                                        <Plus className="size-3" />
                                        <span>Add Space to {floor}</span>
                                      </button>
                                      <button
                                        type="button"
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          handleDeleteFloorGroup(floor);
                                        }}
                                        className="text-destructive hover:underline text-[10.5px] font-semibold px-2 py-0.5 rounded cursor-pointer border-0 bg-transparent transition-colors"
                                      >
                                        Delete Section
                                      </button>
                                    </div>
                                  </div>
                                </td>
                              </tr>
                            </ContextMenuTrigger>
                            <ContextMenuContent className="w-52 bg-popover border border-border rounded-lg shadow-lg p-1 text-[13px] text-popover-foreground z-50 font-sans">
                              <ContextMenuItem
                                disabled={isApprovedLocked}
                                onClick={() => {
                                  if (isApprovedLocked) return;
                                  setActiveFloor(floor);
                                  const nextId = Date.now() + Math.random();
                                  const newSpace: LUSpace = {
                                    id: nextId,
                                    desc: "New Space",
                                    floor: floor,
                                    qty: 1,
                                    floorQty: 1,
                                    std: selectedCategory || "med",
                                    fixtures: {}
                                  };
                                  setIopSpaces(prev => [...prev, newSpace]);
                                  toast.success(`Added new space to ${floor}`);
                                }}
                                className="flex items-center gap-2 px-2 py-1.5 hover:bg-accent hover:text-accent-foreground rounded cursor-pointer text-[13px]"
                              >
                                <Plus className="size-3.5 text-blue-500" />
                                <span>Add Space to {floor}</span>
                              </ContextMenuItem>
                              <ContextMenuItem
                                onClick={() => {
                                  const newName = window.prompt("Enter new floor section name:", floor);
                                  if (newName && newName.trim() && newName.trim() !== floor) {
                                    handleRenameFloorGroup(floor, newName.trim());
                                  }
                                }}
                                className="flex items-center gap-2 px-2 py-1.5 hover:bg-accent hover:text-accent-foreground rounded cursor-pointer text-[13px]"
                              >
                                <Edit3 className="size-3.5 text-muted-foreground" />
                                <span>Rename Section</span>
                              </ContextMenuItem>
                              <ContextMenuSeparator className="h-px bg-border my-1" />
                              <ContextMenuItem
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleDeleteFloorGroup(floor);
                                }}
                                className="flex items-center gap-2 px-2 py-1.5 hover:bg-destructive/10 hover:text-destructive rounded text-destructive cursor-pointer text-[13px]"
                              >
                                <Trash2 className="size-3.5" />
                                <span>Delete Section</span>
                              </ContextMenuItem>
                            </ContextMenuContent>
                          </ContextMenu>

                          {/* Existing Spaces on this Floor */}
                          {floorsGrouped[floor].map((s, spaceIdx) => {
                            const isSelected = selectedIds.includes(s.id);
                            const isEditing = editingSpace?.space.id === s.id;
                            const isModalOpen = editingSpace !== null;
                            const spaceLU = calculateSpaceLU(s, currentWeights);
                            const totalSpaceLU = spaceLU * (s.qty || 1) * (s.floorQty || 1);

                            return (
                              <ContextMenu key={s.id}>
                                <ContextMenuTrigger asChild>
                                  <tr
                                    id={`lu-space-${s.id}`}
                                    data-row-id={s.id}
                                    data-space-id={s.id}
                                    data-item-id={s.id}
                                    title="Click to select, Ctrl+Click to multi-select, Double-click to edit, Ctrl+A to select all"
                                    onClick={(e) => {
                                      if (isLocked) return;
                                      const target = e.target as HTMLElement;
                                      if (target.tagName === "INPUT" || target.tagName === "BUTTON" || target.closest("button") || target.closest("input") || target.closest("select")) {
                                        return;
                                      }
                                      handleToggleSelectSpace(s.id, e);
                                    }}
                                    onDoubleClick={(e) => {
                                      if (isLocked) {
                                        toast.info("Calculation is Approved & Locked. Discipline Coordinator must unlock to make changes.", { id: "readonly-notice" });
                                        return;
                                      }
                                      const target = e.target as HTMLElement;
                                      if (target.tagName === "INPUT" || target.tagName === "BUTTON" || target.closest("button") || target.closest("input") || target.closest("select")) {
                                        return;
                                      }
                                      setSelectedIds([s.id]);
                                      setEditingSpace({ space: s, floor });
                                    }}
                                    className={`group transition-all duration-150 cursor-pointer ${rowDensity === "compact" ? "h-7 text-[11px]" : "h-8.5 text-xs"} ${isEditing
                                      ? "bg-primary/20 ring-2 ring-primary border-y border-primary font-bold shadow-sm z-10 relative"
                                      : isSelected
                                        ? "bg-primary/15 dark:bg-primary/25 border-l-2 border-l-primary font-semibold"
                                        : spaceIdx % 2 === 0
                                          ? "bg-background hover:bg-slate-100/70 dark:hover:bg-slate-900/60"
                                          : "bg-slate-50/40 dark:bg-slate-900/20 hover:bg-slate-100/70 dark:hover:bg-slate-900/60"
                                      }`}
                                  >
                                    <td className="p-1 text-center" onDoubleClick={(e) => e.stopPropagation()}>
                                      <div className="flex items-center justify-center gap-1">
                                        <input
                                          type="checkbox"
                                          disabled={isLocked}
                                          checked={isSelected && !isLocked}
                                          onChange={(e) => handleToggleSelectSpace(s.id, undefined, e.target.checked)}
                                          className="size-3.5 accent-primary cursor-pointer rounded shrink-0 disabled:opacity-40 disabled:cursor-not-allowed"
                                        />

                                        {Array.isArray(s.comments) && s.comments.length > 0 && (
                                          <button
                                            type="button"
                                            title={`${s.comments.length} comment(s)/task(s) assigned`}
                                            className="inline-flex items-center gap-0.5 px-1 py-0.5 rounded-full bg-blue-500/10 dark:bg-blue-950/70 text-blue-600 dark:text-blue-400 font-bold text-[9px] hover:bg-blue-500/20 transition cursor-pointer shrink-0"
                                            onClick={(e) => {
                                              e.stopPropagation();
                                              setCommentTarget({ id: String(s.id), name: s.desc, type: 'space' });
                                              setAssignCommentOpen(true);
                                            }}
                                          >
                                            <MessageSquare className="size-2.5 fill-blue-500/20 text-blue-600 dark:text-blue-400" />
                                            <span>{s.comments.length}</span>
                                          </button>
                                        )}
                                      </div>
                                    </td>

                                    <td className="p-0.5 px-1 truncate" onDoubleClick={(e) => e.stopPropagation()}>
                                      <input
                                        type="text"
                                        disabled={isApprovedLocked}
                                        value={s.desc || ""}
                                        placeholder="Space Description"
                                        onChange={(e) => {
                                          if (isApprovedLocked) return;
                                          const val = e.target.value;
                                          setIopSpaces(prev => prev.map(item => {
                                            if (item.id === s.id) {
                                              const updated = { ...item, desc: val };
                                              const wasMissing = getLUSpaceValidation(item).isMissing;
                                              const isMissing = getLUSpaceValidation(updated).isMissing;
                                              let flagged = updated.flagged;
                                              if (isMissing) {
                                                flagged = true;
                                              } else if (wasMissing && !isMissing) {
                                                flagged = false;
                                              }
                                              return { ...updated, flagged };
                                            }
                                            return item;
                                          }));
                                        }}
                                        className="w-full bg-transparent hover:bg-background focus:bg-background border border-transparent hover:border-border/60 focus:border-primary rounded px-1.5 py-0.5 text-xs font-bold text-foreground outline-none transition-all truncate cursor-text"
                                        title={s.desc || "Untitled Space"}
                                      />
                                    </td>

                                    {LU_FIXTURES_META.map(f => {
                                      const count = Number(s.fixtures?.[f.key] || 0);
                                      return (
                                        <td key={f.key} className="p-0.5 text-center font-mono text-[11px]" onDoubleClick={(e) => e.stopPropagation()}>
                                          <input
                                            type="number"
                                            min="0"
                                            step="1"
                                            disabled={isApprovedLocked}
                                            value={count > 0 ? count : ""}
                                            placeholder="—"
                                            onChange={(e) => {
                                              if (isApprovedLocked) return;
                                              const raw = e.target.value;
                                              const val = raw === "" ? 0 : parseInt(raw, 10);
                                              setIopSpaces(prev => prev.map(item => {
                                                if (item.id === s.id) {
                                                  const updatedFixtures = { ...(item.fixtures || {}) };
                                                  if (!isNaN(val) && val > 0) {
                                                    updatedFixtures[f.key] = val;
                                                  } else {
                                                    delete updatedFixtures[f.key];
                                                  }
                                                  return { ...item, fixtures: updatedFixtures };
                                                }
                                                return item;
                                              }));
                                            }}
                                            className={`w-7 h-5.5 text-center text-[11px] font-mono font-bold rounded border outline-none transition-all ${count > 0
                                              ? "bg-primary/10 border-primary/40 text-foreground font-extrabold focus:bg-background focus:ring-1 focus:ring-primary"
                                              : "bg-transparent border-transparent hover:border-border/40 text-muted-foreground/30 placeholder:text-muted-foreground/25 focus:bg-background focus:border-primary focus:text-foreground"
                                              } ${isApprovedLocked ? "opacity-50 cursor-not-allowed" : "cursor-text"}`}
                                          />
                                        </td>
                                      );
                                    })}

                                    <td className="p-1 text-center font-mono font-bold text-primary text-[11.5px]">
                                      {spaceLU.toFixed(1)}
                                    </td>

                                    <td className="p-0.5 text-center font-mono text-[11px]" onDoubleClick={(e) => e.stopPropagation()}>
                                      <input
                                        type="number"
                                        min="1"
                                        step="1"
                                        disabled={isApprovedLocked}
                                        value={s.qty ?? 1}
                                        onChange={(e) => {
                                          if (isApprovedLocked) return;
                                          const raw = e.target.value;
                                          const val = raw === "" ? 1 : parseInt(raw, 10);
                                          const qtyVal = isNaN(val) || val < 1 ? 1 : val;
                                          setIopSpaces(prev => prev.map(item => item.id === s.id ? { ...item, qty: qtyVal } : item));
                                        }}
                                        className="w-10 h-5.5 text-center text-[11px] font-bold font-mono rounded border border-transparent hover:border-border/60 focus:border-primary bg-transparent focus:bg-background outline-none transition-all cursor-text"
                                      />
                                    </td>

                                    <td className="p-0.5 text-center font-mono text-[11px]" onDoubleClick={(e) => e.stopPropagation()}>
                                      <input
                                        type="number"
                                        min="1"
                                        step="1"
                                        disabled={isApprovedLocked}
                                        value={s.floorQty ?? 1}
                                        onChange={(e) => {
                                          if (isApprovedLocked) return;
                                          const raw = e.target.value;
                                          const val = raw === "" ? 1 : parseInt(raw, 10);
                                          const floorQtyVal = isNaN(val) || val < 1 ? 1 : val;
                                          setIopSpaces(prev => prev.map(item => item.id === s.id ? { ...item, floorQty: floorQtyVal } : item));
                                        }}
                                        className="w-10 h-5.5 text-center text-[11px] font-bold font-mono rounded border border-transparent hover:border-border/60 focus:border-primary bg-transparent focus:bg-background outline-none transition-all cursor-text"
                                      />
                                    </td>

                                    <td className="p-1 px-1.5 text-right font-mono font-extrabold text-primary text-[11.5px]">
                                      {totalSpaceLU.toFixed(1)}
                                    </td>

                                    <td className="p-0.5 text-center" onDoubleClick={(e) => e.stopPropagation()}>
                                      <div className="flex items-center justify-center gap-0.5">
                                        <button
                                          type="button"
                                          onClick={(e) => {
                                            e.stopPropagation();
                                            const targets = selectedIds.includes(s.id) && selectedIds.length > 1 ? selectedIds : [s.id];
                                            const validation = getLUSpaceValidation(s);
                                            const isEffectivelyFlagged = validation.isFlagged;
                                            const newFlagged = !isEffectivelyFlagged;
                                            setIopSpaces(prev => prev.map(item => targets.includes(item.id) ? { ...item, flagged: newFlagged } : item));
                                            dirtyStore.set(true);
                                            toast.info(newFlagged ? `Flagged ${targets.length > 1 ? `${targets.length} spaces` : `"${s.desc}"`} for review` : `Unflagged ${targets.length > 1 ? `${targets.length} spaces` : `"${s.desc}"`}`);
                                          }}
                                          className="p-1 rounded hover:bg-surface-2 transition-colors cursor-pointer group flex items-center justify-center mx-auto"
                                          title={(() => {
                                            const validation = getLUSpaceValidation(s);
                                            if (validation.isMissing) {
                                              return validation.reason || "Missing space data";
                                            }
                                            return isEffectivelyFlagged ? "Unflag space" : "Flag space for review";
                                          })()}
                                        >
                                          <Flag className={`size-3.5 transition-all duration-200 ${isEffectivelyFlagged ? "fill-red-500 text-red-500 scale-110" : "text-muted-foreground/30 hover:text-red-500/60 group-hover:scale-110"}`} />
                                        </button>
                                      </div>
                                    </td>
                                  </tr>
                                </ContextMenuTrigger>
                                <ContextMenuContent className="w-56 bg-popover border border-border rounded-lg shadow-lg p-1 text-[13px] text-popover-foreground z-50 font-sans">
                                  <ContextMenuItem
                                    onClick={() => setEditingSpace({ space: s, floor })}
                                    className="flex items-center gap-2 px-2 py-1.5 hover:bg-accent hover:text-accent-foreground rounded cursor-pointer text-[13px]"
                                  >
                                    <Edit3 className="size-3.5 text-muted-foreground" />
                                    <span>Edit Space</span>
                                    <ContextMenuShortcut className="text-[10px] text-muted-foreground font-mono ml-auto">Double Click</ContextMenuShortcut>
                                  </ContextMenuItem>
                                  <ContextMenuItem
                                    onClick={() => {
                                      setCommentTarget({ id: String(s.id), name: s.desc, type: 'space' });
                                      setAssignCommentOpen(true);
                                    }}
                                    className="flex items-center gap-2 px-2 py-1.5 hover:bg-blue-50 dark:hover:bg-blue-950/40 hover:text-blue-600 rounded cursor-pointer text-blue-600 dark:text-blue-400 font-medium text-[13px]"
                                  >
                                    <MessageSquare className="size-3.5" />
                                    <span>Add / View Comment</span>
                                  </ContextMenuItem>
                                  <ContextMenuItem
                                    onClick={() => {
                                      const targets = selectedIds.includes(s.id) ? selectedIds : [s.id];
                                      const newFlagged = !s.flagged;
                                      setIopSpaces((prev) => prev.map((item) => targets.includes(item.id) ? { ...item, flagged: newFlagged } : item));
                                    }}
                                    className="flex items-center gap-2 px-2 py-1.5 hover:bg-accent hover:text-accent-foreground rounded cursor-pointer text-[13px]"
                                  >
                                    <Flag className={`size-3.5 ${s.flagged ? "text-amber-500 fill-amber-500" : "text-amber-500"}`} />
                                    <span>{s.flagged ? "Unflag Space" : "Flag for Review"}</span>
                                    <ContextMenuShortcut className="text-[10px] text-muted-foreground font-mono ml-auto">F</ContextMenuShortcut>
                                  </ContextMenuItem>
                                  <ContextMenuSeparator className="h-px bg-border my-1" />
                                  <ContextMenuItem
                                    onClick={() => {
                                      const targets = selectedIds.includes(s.id) ? selectedIds : [s.id];
                                      handleCopySpaces(targets);
                                    }}
                                    className="flex items-center gap-2 px-2 py-1.5 hover:bg-accent hover:text-accent-foreground rounded cursor-pointer text-[13px]"
                                  >
                                    <Copy className="size-3.5 text-muted-foreground" />
                                    <span>Copy Space{selectedIds.includes(s.id) && selectedIds.length > 1 ? "s" : ""}</span>
                                    <ContextMenuShortcut className="text-[10px] text-muted-foreground font-mono ml-auto">Ctrl+C</ContextMenuShortcut>
                                  </ContextMenuItem>
                                  <ContextMenuItem
                                    disabled={isApprovedLocked}
                                    onClick={() => {
                                      const targets = selectedIds.includes(s.id) ? selectedIds : [s.id];
                                      handleCutSpaces(targets);
                                    }}
                                    className="flex items-center gap-2 px-2 py-1.5 hover:bg-accent hover:text-accent-foreground rounded cursor-pointer text-[13px]"
                                  >
                                    <Copy className="size-3.5 text-muted-foreground" />
                                    <span>Cut Space{selectedIds.includes(s.id) && selectedIds.length > 1 ? "s" : ""}</span>
                                    <ContextMenuShortcut className="text-[10px] text-muted-foreground font-mono ml-auto">Ctrl+X</ContextMenuShortcut>
                                  </ContextMenuItem>
                                  <ContextMenuItem
                                    disabled={isApprovedLocked}
                                    onClick={handlePasteSpaces}
                                    className="flex items-center gap-2 px-2 py-1.5 hover:bg-accent hover:text-accent-foreground rounded cursor-pointer text-[13px]"
                                  >
                                    <Plus className="size-3.5 text-muted-foreground" />
                                    <span>Paste Spaces</span>
                                    <ContextMenuShortcut className="text-[10px] text-muted-foreground font-mono ml-auto">Ctrl+V</ContextMenuShortcut>
                                  </ContextMenuItem>
                                  <ContextMenuItem
                                    disabled={isApprovedLocked}
                                    onClick={() => {
                                      const targets = selectedIds.includes(s.id) ? selectedIds : [s.id];
                                      handleBulkDuplicate(targets);
                                    }}
                                    className="flex items-center gap-2 px-2 py-1.5 hover:bg-accent hover:text-accent-foreground rounded cursor-pointer text-[13px]"
                                  >
                                    <Copy className="size-3.5 text-muted-foreground" />
                                    <span>Duplicate Space{selectedIds.includes(s.id) && selectedIds.length > 1 ? ` (${selectedIds.length})` : ""}</span>
                                    <ContextMenuShortcut className="text-[10px] text-muted-foreground font-mono ml-auto">Ctrl+D</ContextMenuShortcut>
                                  </ContextMenuItem>
                                  <ContextMenuSeparator className="h-px bg-border my-1" />
                                  <ContextMenuItem
                                    disabled={isApprovedLocked}
                                    onClick={() => {
                                      const targets = selectedIds.includes(s.id) ? selectedIds : [s.id];
                                      handleBulkDelete(targets);
                                    }}
                                    className="flex items-center gap-2 px-2 py-1.5 hover:bg-destructive/10 hover:text-destructive rounded text-destructive cursor-pointer text-[13px]"
                                  >
                                    <Trash2 className="size-3.5" />
                                    <span>Delete Space{selectedIds.includes(s.id) && selectedIds.length > 1 ? ` (${selectedIds.length})` : ""}</span>
                                    <ContextMenuShortcut className="text-[10px] text-muted-foreground font-mono ml-auto">Delete</ContextMenuShortcut>
                                  </ContextMenuItem>
                                </ContextMenuContent>
                              </ContextMenu>);
                          })}
                        </tbody>
                      ))}
                    </table>
                  </div>

                  {/* Pinned Bottom Summary Footer Strip */}
                  <div className="flex items-center justify-between px-3 h-7 border-t border-border bg-header-bg text-[11px] text-muted-foreground shrink-0 select-none no-print">
                    <div>
                      Showing <span className="text-foreground font-medium tabular">{filteredSpaces.length}</span> of {iopSpaces.length} spaces
                    </div>
                    <div className="flex items-center gap-4 tabular">
                      <span>Total {unitLabel}: <strong className="text-primary font-mono font-bold">{calculations.totalLU.toFixed(1)}</strong></span>
                      <span>Design Flow: <strong className="text-primary font-mono font-bold">{calculations.displayFlow}</strong></span>
                      <span>Recommended Pipe Size: <strong className="text-foreground font-mono font-bold">{calculations.pipeSizing.sizeMM} mm (DN{calculations.pipeSizing.sizeMM})</strong></span>
                    </div>
                  </div>
                </div>
              )}

              {/* Sizing & Report Tab View */}
              {activeTab === "report" && (
                <LoadingUnitReportView
                  calculations={calculations}
                  iopSpaces={iopSpaces}
                  floorSections={floorSections}
                  currentWeights={currentWeights}
                  unitLabel={unitLabel}
                  standardPreset={standardPreset}
                  selectedCategory={selectedCategory}
                  project={project}
                  calcMeta={calcMeta}
                  calcReviewState={calcReviewState}
                  currentUserName={currentUserName}
                  onExportPdf={handleExportPDF}
                />
              )}
            </div>
          </div>
        </div>

        {/* Intelligence Drawer (Collapsible Right Side Panel) */}
        <div
          className={`shrink-0 transition-[width,margin] duration-300 ease-out overflow-hidden ${intelOpen ? "w-[360px] my-2 ml-4 mr-0.5 border border-border rounded-2xl bg-background shadow-lg" : "w-0"
            }`}
        >
          {intelOpen && (
            <LoadingUnitIntelligenceDrawer
              onClose={() => setIntelOpen(false)}
              calculations={calculations}
              iopSpaces={iopSpaces}
              unitLabel={unitLabel}
              standardPreset={standardPreset}
              setActiveTab={setActiveTab}
            />
          )}
        </div>
      </div>

      {/* Edit Space Modal */}
      {editingSpace && (
        <EditLoadingUnitRowModal
          space={editingSpace.space}
          floor={editingSpace.floor}
          currentWeights={currentWeights}
          onSave={handleSaveEditedSpace}
          onClose={() => setEditingSpace(null)}
          onDelete={() => {
            setIopSpaces(prev => prev.filter(s => s.id !== editingSpace.space.id));
            setEditingSpace(null);
            toast.success("Space deleted");
          }}
        />
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
          calculatorTitle="Loading Unit & Pipe Sizer"
          calculatorPath="/plumbing-loading-unit"
          existingComments={iopSpaces.find((s) => String(s.id) === commentTarget.id)?.comments || []}
          onSave={(newComment) => {
            const next = iopSpaces.map(s => {
              if (String(s.id) === commentTarget.id) {
                const currentComments = Array.isArray(s.comments) ? s.comments : [];
                return { ...s, comments: [...currentComments, newComment] };
              }
              return s;
            });
            setIopSpaces(next);
            saveState(next);
            notifyCommentAssigned(newComment, "Loading Unit & Pipe Sizer", "/plumbing-loading-unit", commentTarget.name);
          }}
        />
      )}
    </AppShell>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// In-Browser Preliminary Engineering Report Component (Matching Ventilation Format)
// ─────────────────────────────────────────────────────────────────────────────
function LoadingUnitReportView({
  calculations,
  iopSpaces,
  floorSections,
  currentWeights,
  unitLabel,
  standardPreset,
  selectedCategory,
  project,
  calcMeta,
  calcReviewState,
  currentUserName,
  onExportPdf,
}: {
  calculations: any;
  iopSpaces: LUSpace[];
  floorSections: string[];
  currentWeights: Record<string, number>;
  unitLabel: string;
  standardPreset: StandardPreset;
  selectedCategory: string;
  project: any;
  calcMeta: any;
  calcReviewState: CalculationReviewState | null;
  currentUserName: string;
  onExportPdf: () => void;
}) {
  const calcNo = calcMeta.calcNo || project?.calcNo || "TRV-LU-CALC-R01";
  const projectNo = calcMeta.projectNo || project?.code || project?.projectNo || "P000";
  const projectName = calcMeta.projectName || project?.name || project?.projectName || "Plumbing Fixture Unit Sizing";
  const clientName = calcMeta.client || project?.client || "Design Client";
  const endUser = calcMeta.endUser || project?.endUser || project?.location || "Site Development";
  const today = calcMeta.date || formatDateStr(new Date().toISOString());

  const sigDetails = getSignatureBlockDetails(project?.id || "default", "/plumbing-loading-unit", currentUserName, calcReviewState);

  const activeFixtures = LU_FIXTURES_META;

  return (
    <div className="flex flex-col h-full">
      {/* Top Action Bar matching Ventilation */}
      <div className="flex items-center gap-1 px-4 h-11 shrink-0 border-b border-border/50 bg-card/50 no-print">
        <span className="text-[12px] text-muted-foreground font-semibold">
          Generated: <span className="text-foreground font-mono">{today}</span>
        </span>
        <div className="ml-auto flex items-center gap-1.5">
          <TBtn onClick={() => window.print()}><Printer className="size-3.5" /> Print</TBtn>
          <TBtn primary onClick={onExportPdf}><FileText className="size-3.5" /> Export PDF</TBtn>
        </div>
      </div>

      {/* Document Paper Container */}
      <div className="flex-1 overflow-y-auto p-4 md:p-8 space-y-6 custom-scrollbar bg-slate-100/50 dark:bg-zinc-950/40">
        <div className="max-w-4xl mx-auto bg-card border border-border shadow-md rounded-2xl p-6 md:p-8 space-y-6 font-sans">

          {/* Document Header */}
          <div className="flex justify-between items-start pb-4 border-b border-border">
            <div>
              <h2 className="text-xl font-black text-foreground uppercase tracking-wide">
                Loading Unit &amp; Pipe Sizing Calculation Report
              </h2>
              <p className="text-[12px] text-muted-foreground mt-0.5">
                Plumbing Loading Units (WSFU / LU), Hunter's Curve Demand &amp; Hydraulic Pipework Sizing
              </p>
            </div>
            <div className="text-right">
              <span className="text-[11px] text-muted-foreground block mt-0.5">Date: {today}</span>
            </div>
          </div>

          {/* Enclosed 3x2 Metadata Box */}
          <div className="border border-border rounded-xl overflow-hidden text-xs">
            <div className="grid grid-cols-2 sm:grid-cols-4 bg-muted/40 font-bold border-b border-border divide-x divide-border">
              <div className="p-2.5">Calculation No.:</div>
              <div className="p-2.5 font-mono text-primary font-normal">{calcNo}</div>
              <div className="p-2.5">Date:</div>
              <div className="p-2.5 font-normal">{today}</div>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-4 border-b border-border divide-x divide-border">
              <div className="p-2.5 font-bold bg-muted/20">Project No.:</div>
              <div className="p-2.5 font-mono">{projectNo}</div>
              <div className="p-2.5 font-bold bg-muted/20">Client:</div>
              <div className="p-2.5">{clientName}</div>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-4 divide-x divide-border">
              <div className="p-2.5 font-bold bg-muted/20">Project Name:</div>
              <div className="p-2.5">{projectName}</div>
              <div className="p-2.5 font-bold bg-muted/20">End User:</div>
              <div className="p-2.5">{endUser}</div>
            </div>
          </div>

          {/* Table 1: Project Summary & Parameters */}
          <div className="space-y-2">
            <h3 className="text-[13px] font-bold text-foreground uppercase tracking-wider">
              1. Project Summary &amp; Design Parameters
            </h3>
            <div className="border border-border rounded-xl overflow-hidden text-xs">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-[#D9D9D9] dark:bg-zinc-800 text-foreground font-bold border-b border-border">
                    <th className="p-2.5 w-12 text-center">No.</th>
                    <th className="p-2.5">Parameter Description</th>
                    <th className="p-2.5 text-center w-36">Calculated Value</th>
                    <th className="p-2.5 text-center w-20">Unit</th>
                    <th className="p-2.5">Engineering Design Basis / Notes</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  <tr>
                    <td className="p-2.5 text-center font-mono text-muted-foreground">1</td>
                    <td className="p-2.5 font-bold">Total Connected Spaces</td>
                    <td className="p-2.5 text-center font-mono font-bold text-foreground">{iopSpaces.length}</td>
                    <td className="p-2.5 text-center">spaces</td>
                    <td className="p-2.5 text-muted-foreground">Architectural Space Schedule</td>
                  </tr>
                  <tr className="bg-slate-50/50 dark:bg-zinc-900/50">
                    <td className="p-2.5 text-center font-mono text-muted-foreground">2</td>
                    <td className="p-2.5 font-bold">Total Water Supply Loading Units</td>
                    <td className="p-2.5 text-center font-mono font-bold text-primary">{calculations.totalLU.toFixed(1)}</td>
                    <td className="p-2.5 text-center font-mono font-bold">{unitLabel}</td>
                    <td className="p-2.5 text-muted-foreground">Sum of connected fixture loading units</td>
                  </tr>
                  <tr>
                    <td className="p-2.5 text-center font-mono text-muted-foreground">3</td>
                    <td className="p-2.5 font-bold">Simultaneous Peak Demand Flow Rate</td>
                    <td className="p-2.5 text-center font-mono font-bold text-primary">{calculations.displayFlow}</td>
                    <td className="p-2.5 text-center font-mono font-bold">L/s</td>
                    <td className="p-2.5 text-muted-foreground">Interpolated standard diversity curve / Hunter's Curve</td>
                  </tr>
                  <tr className="bg-slate-50/50 dark:bg-zinc-900/50">
                    <td className="p-2.5 text-center font-mono text-muted-foreground">4</td>
                    <td className="p-2.5 font-bold">Recommended Pipe Header Size</td>
                    <td className="p-2.5 text-center font-mono font-bold text-foreground">DN{calculations.pipeSizing.sizeMM} mm</td>
                    <td className="p-2.5 text-center">mm</td>
                    <td className="p-2.5 text-muted-foreground">Velocity limit V ≤ 1.5 - 2.0 m/s (Max capacity: {calculations.pipeSizing.maxFlowLPS} L/s)</td>
                  </tr>
                  <tr>
                    <td className="p-2.5 text-center font-mono text-muted-foreground">5</td>
                    <td className="p-2.5 font-bold">Booster Pump Duty Flow Rate (Q)</td>
                    <td className="p-2.5 text-center font-mono font-bold text-primary">{calculations.displaySelectedFlow}</td>
                    <td className="p-2.5 text-center font-mono font-bold">L/s</td>
                    <td className="p-2.5 text-muted-foreground">Standard 1W + 1A + 1S triplex booster pump station arrangement</td>
                  </tr>
                  <tr className="bg-slate-50/50 dark:bg-zinc-900/50">
                    <td className="p-2.5 text-center font-mono text-muted-foreground">6</td>
                    <td className="p-2.5 font-bold">Governing Sizing Standard</td>
                    <td className="p-2.5 text-center font-mono font-bold text-foreground">{standardPreset.toUpperCase()}</td>
                    <td className="p-2.5 text-center">{selectedCategory}</td>
                    <td className="p-2.5 text-muted-foreground">Standard Fixture Loading Unit weights &amp; diversity curve</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>

          {/* Table 2: Detailed Fixture Schedule by Floor */}
          <div className="space-y-2 mt-6">
            <h3 className="text-[13px] font-bold text-foreground uppercase tracking-wider">
              2. Floor-by-Floor Fixture Units Schedule &amp; Distribution
            </h3>
            <div className="border border-border rounded-xl overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="bg-[#D9D9D9] dark:bg-zinc-800 text-foreground font-bold border-b border-border">
                    <th className="p-2 text-center w-10">Sr.</th>
                    <th className="p-2">Space Description</th>
                    <th className="p-2 text-center w-24">Floor</th>
                    <th className="p-2 text-center w-14">Qty</th>
                    <th className="p-2 text-center w-14">Fl. Qty</th>
                    {activeFixtures.map(f => (
                      <th key={f.key} className="p-1.5 text-center font-mono text-[10.5px]" title={f.label}>
                        {f.short}
                      </th>
                    ))}
                    <th className="p-2 text-center w-16">Unit {unitLabel}</th>
                    <th className="p-2 text-right w-20">Total {unitLabel}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {floorSections.map(fl => {
                    const floorItems = iopSpaces.filter(s => (s.floor || "6th FLOOR") === fl);
                    if (floorItems.length === 0) return null;

                    let floorTotalLU = 0;

                    return (
                      <React.Fragment key={fl}>
                        <tr className="bg-slate-100 dark:bg-zinc-800/60 font-bold border-y border-border">
                          <td colSpan={5 + activeFixtures.length + 2} className="p-2 px-3 uppercase text-foreground">
                            {fl}
                          </td>
                        </tr>
                        {floorItems.map((s, sIdx) => {
                          const unitLU = calculateSpaceLU(s, currentWeights);
                          const totalSpaceLU = unitLU * (s.qty || 1) * (s.floorQty || 1);
                          floorTotalLU += totalSpaceLU;

                          return (
                            <tr key={s.id} className={sIdx % 2 === 0 ? "bg-card" : "bg-slate-50/40 dark:bg-zinc-900/30"}>
                              <td className="p-2 text-center font-mono text-muted-foreground">{sIdx + 1}</td>
                              <td className="p-2 font-bold text-foreground">{s.desc}</td>
                              <td className="p-2 text-center text-muted-foreground">{fl}</td>
                              <td className="p-2 text-center font-mono">{s.qty || 1}</td>
                              <td className="p-2 text-center font-mono">{s.floorQty || 1}</td>
                              {activeFixtures.map(f => (
                                <td key={f.key} className="p-1.5 text-center font-mono text-[11px]">
                                  {Number(s.fixtures?.[f.key] || 0) > 0 ? (
                                    <span className="font-bold text-foreground">{s.fixtures[f.key]}</span>
                                  ) : (
                                    <span className="text-muted-foreground/30">—</span>
                                  )}
                                </td>
                              ))}
                              <td className="p-2 text-center font-mono font-bold text-foreground">{unitLU.toFixed(1)}</td>
                              <td className="p-2 text-right font-mono font-bold text-primary">{totalSpaceLU.toFixed(1)}</td>
                            </tr>
                          );
                        })}
                        {/* Floor Subtotal Row with Soft Blue Highlighting */}
                        <tr className="bg-[#DAE9F8] dark:bg-[#0c2e47] text-slate-900 dark:text-slate-100 font-bold border-y border-border">
                          <td colSpan={5 + activeFixtures.length + 1} className="p-2 px-3 text-right">
                            TOTAL ({fl.toUpperCase()})
                          </td>
                          <td className="p-2 text-right font-mono font-bold text-primary">
                            {floorTotalLU.toFixed(1)} {unitLabel}
                          </td>
                        </tr>
                      </React.Fragment>
                    );
                  })}
                  {/* Grand Total Row with Soft Blue Highlighting */}
                  <tr className="bg-[#DAE9F8] dark:bg-[#0c2e47] text-slate-900 dark:text-slate-100 font-extrabold border-y-2 border-border">
                    <td colSpan={5 + activeFixtures.length + 1} className="p-2.5 px-3 text-right text-xs uppercase tracking-wider">
                      TOTAL BUILDING WATER SUPPLY LOADING UNITS
                    </td>
                    <td className="p-2.5 text-right font-mono text-sm font-extrabold text-primary">
                      {calculations.totalLU.toFixed(1)} {unitLabel}
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>

          {/* Table 3: Hydraulic Pipe Sizing & Velocity Limits Schedule */}
          <div className="space-y-2 mt-6">
            <h3 className="text-[13px] font-bold text-foreground uppercase tracking-wider">
              3. Hydraulic Pipe Sizing &amp; Velocity Capacity Schedule
            </h3>
            <div className="border border-border rounded-xl overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="bg-[#D9D9D9] dark:bg-zinc-800 text-foreground font-bold border-b border-border">
                    <th className="p-2.5 text-center">Nominal Pipe Size</th>
                    <th className="p-2.5 text-center">Design Flow Range ({unitLabel})</th>
                    <th className="p-2.5 text-center">Max Flow Capacity (L/s)</th>
                    <th className="p-2.5 text-center">Flow @ 1.2 m/s</th>
                    <th className="p-2.5 text-center">Flow @ 1.5 m/s</th>
                    <th className="p-2.5 text-center">Flow @ 1.8 m/s</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {PIPE_SIZING_TABLE.map((row) => {
                    const isSelected = calculations.pipeSizing.sizeMM === row.sizeMM;
                    return (
                      <tr
                        key={row.sizeMM}
                        className={
                          isSelected
                            ? "bg-[#DAE9F8] dark:bg-[#0c2e47] text-slate-900 dark:text-slate-100 font-bold"
                            : "hover:bg-slate-50/50 dark:hover:bg-zinc-900/50"
                        }
                      >
                        <td className="p-2 text-center font-bold font-mono">
                          DN{row.sizeMM} mm {isSelected ? "★ (Recommended)" : ""}
                        </td>
                        <td className="p-2 text-center font-mono">{row.wsfuRange}</td>
                        <td className="p-2 text-center font-mono font-bold">{row.flowMax} L/s</td>
                        <td className="p-2 text-center font-mono">{row.q4fps.toFixed(2)} L/s</td>
                        <td className="p-2 text-center font-mono">{row.q5fps.toFixed(2)} L/s</td>
                        <td className="p-2 text-center font-mono">{row.q6fps.toFixed(2)} L/s</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          {/* Compliance Verification Banner */}
          <div className="p-4 bg-emerald-500/10 border border-emerald-500/30 rounded-xl flex items-start gap-3">
            <CheckCircle2 className="size-4 text-emerald-600 dark:text-emerald-400 shrink-0 mt-0.5" />
            <div className="text-xs space-y-1">
              <span className="font-bold text-emerald-800 dark:text-emerald-300">
                Hydraulic Loading &amp; Pipework Compliance Verification
              </span>
              <p className="text-muted-foreground leading-relaxed">
                This calculation conforms to {standardPreset.toUpperCase()} standards for simultaneous fixture loading units ({calculations.totalLU.toFixed(1)} {unitLabel}) and peak design flow ({calculations.displayFlow}). Hydraulic pipe sizing velocity limits are satisfied within allowable code constraints (Max v ≤ 1.5 - 2.0 m/s).
              </p>
            </div>
          </div>

          {/* Table 4: 4-Column Professional Review & Sign-Off Block */}
          <div className="space-y-2 mt-6">
            <h3 className="text-[13px] font-bold text-foreground uppercase tracking-wider">
              4. Professional Review &amp; Sign-Off Block
            </h3>
            <div className="border border-border rounded-xl overflow-hidden text-xs">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-[#D9D9D9] dark:bg-zinc-800 text-foreground font-bold border-b border-border">
                    <th className="p-2.5 text-left w-1/4">Approval Role</th>
                    <th className="p-2.5 text-center w-1/4">Originated By</th>
                    <th className="p-2.5 text-center w-1/4">Reviewed By</th>
                    <th className="p-2.5 text-center w-1/4">Approved By</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  <tr>
                    <td className="p-2.5 font-bold text-muted-foreground">Name:</td>
                    <td className="p-2.5 text-center font-bold text-foreground">{sigDetails.originatedName}</td>
                    <td className="p-2.5 text-center font-bold text-foreground">{sigDetails.reviewerName || "Pending Review"}</td>
                    <td className="p-2.5 text-center font-bold text-foreground">{sigDetails.approverName || "Pending Approval"}</td>
                  </tr>
                  <tr className="bg-slate-50/50 dark:bg-zinc-900/50">
                    <td className="p-2.5 font-bold text-muted-foreground">Role / Status:</td>
                    <td className="p-2.5 text-center text-muted-foreground">MEP Design Engineer</td>
                    <td className="p-2.5 text-center text-muted-foreground">Discipline Quality Review</td>
                    <td className="p-2.5 text-center text-muted-foreground">Head of Engineering / MEP QA</td>
                  </tr>
                  <tr>
                    <td className="p-2.5 font-bold text-muted-foreground">Date:</td>
                    <td className="p-2.5 text-center font-mono text-muted-foreground">{sigDetails.originatedDate || today}</td>
                    <td className="p-2.5 text-center font-mono text-muted-foreground">{sigDetails.reviewerDate || "—"}</td>
                    <td className="p-2.5 text-center font-mono text-muted-foreground">{sigDetails.approverDate || "—"}</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>

        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Intelligence Drawer Component for Loading Unit Calculator
// ─────────────────────────────────────────────────────────────────────────────
function LoadingUnitIntelligenceDrawer({
  onClose,
  calculations,
  iopSpaces,
  unitLabel,
  standardPreset,
  setActiveTab,
}: {
  onClose: () => void;
  calculations: any;
  iopSpaces: LUSpace[];
  unitLabel: string;
  standardPreset: StandardPreset;
  setActiveTab: (t: "spaces" | "report") => void;
}) {
  const flaggedCount = iopSpaces.filter((s) => s.flagged).length;
  const missingFixtures = iopSpaces.filter((s) => !Object.values(s.fixtures || {}).some((v) => Number(v) > 0)).length;
  const compliancePct = iopSpaces.length > 0 ? Math.round(((iopSpaces.length - flaggedCount) / iopSpaces.length) * 100) : 100;

  return (
    <div className="h-full w-[360px] flex flex-col animate-fade-in font-sans">
      <header className="h-11 px-3 flex items-center justify-between border-b border-border shrink-0">
        <div className="flex items-center gap-2">
          <Sparkles className="size-3.5 text-primary" />
          <span className="text-[13px] font-semibold tracking-tight">Intelligence</span>
        </div>
        <button
          onClick={onClose}
          className="size-7 grid place-items-center rounded hover:bg-muted text-muted-foreground hover:text-foreground cursor-pointer"
        >
          <X className="size-3.5" />
        </button>
      </header>

      <div className="flex-1 overflow-y-auto p-4 space-y-4 custom-scrollbar">
        {/* Compliance Status */}
        <div className="p-3.5 bg-card border border-border rounded-xl space-y-2 shadow-xs">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="size-4 text-emerald-500" />
            <span className="text-xs font-bold text-foreground">Standard Compliance Status</span>
          </div>
          <div className="text-[11.5px] text-muted-foreground">
            {standardPreset.toUpperCase()} validation across {iopSpaces.length} defined spaces.
          </div>
          <div className="flex items-center gap-2 mt-1">
            <div className="flex-1 h-1.5 bg-muted rounded-full overflow-hidden">
              <div className="h-full bg-emerald-500 rounded-full transition-all" style={{ width: `${compliancePct}%` }} />
            </div>
            <span className="font-mono text-[11px] font-bold text-foreground">{compliancePct}%</span>
          </div>
        </div>

        {/* Loading Unit & Demand KPI */}
        <div className="p-3.5 bg-card border border-border rounded-xl space-y-2.5 shadow-xs">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Building2 className="size-4 text-primary" />
              <span className="text-xs font-bold text-foreground">Loading Unit Summary</span>
            </div>
            <button
              onClick={() => setActiveTab("spaces")}
              className="text-[10.5px] text-primary hover:underline font-semibold cursor-pointer"
            >
              View Spaces
            </button>
          </div>
          <div className="space-y-1.5 text-xs">
            <div className="flex justify-between items-center py-0.5 border-b border-border/40">
              <span className="text-muted-foreground">Total {unitLabel}:</span>
              <span className="font-mono font-bold text-primary text-xs">{calculations.totalLU.toFixed(1)}</span>
            </div>
            <div className="flex justify-between items-center py-0.5 border-b border-border/40">
              <span className="text-muted-foreground">Simultaneous Flow:</span>
              <span className="font-mono font-bold text-foreground">{calculations.displayFlow}</span>
            </div>
            <div className="flex justify-between items-center py-0.5 border-b border-border/40">
              <span className="text-muted-foreground">Pump Flow (Q):</span>
              <span className="font-mono font-bold text-primary">{calculations.displaySelectedFlow}</span>
            </div>
            <div className="flex justify-between items-center pt-1 font-bold">
              <span className="text-foreground">Recommended Pipe:</span>
              <span className="font-mono text-primary text-xs font-extrabold">DN{calculations.pipeSizing.sizeMM} mm</span>
            </div>
          </div>
        </div>

        {/* Calculation Issues & Warnings */}
        <div className="p-3.5 bg-card border border-border rounded-xl space-y-2 shadow-xs">
          <div className="flex items-center gap-2">
            <AlertTriangle className={`size-4 ${flaggedCount > 0 || missingFixtures > 0 ? "text-amber-500" : "text-muted-foreground"}`} />
            <span className="text-xs font-bold text-foreground">Audit &amp; Flagged Items</span>
          </div>
          <div className="space-y-1 text-xs">
            <div className="flex justify-between items-center">
              <span className="text-muted-foreground">Flagged spaces:</span>
              <span className={`font-mono font-bold ${flaggedCount > 0 ? "text-amber-500" : "text-muted-foreground"}`}>{flaggedCount}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-muted-foreground">Spaces with 0 fixtures:</span>
              <span className={`font-mono font-bold ${missingFixtures > 0 ? "text-amber-500" : "text-muted-foreground"}`}>{missingFixtures}</span>
            </div>
          </div>
        </div>

      </div>
    </div>
  );
}
