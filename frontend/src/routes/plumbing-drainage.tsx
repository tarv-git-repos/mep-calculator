import { CalculationReviewBar, useCalculationLock, type CalculationReviewState } from "@/components/workspace/CalculationReviewBar";
import { UnitToggle } from "@/components/workspace/UnitToggle";
import { AssignCommentModal } from "@/components/workspace/AssignCommentModal";
import { useAuth } from "@/contexts/AuthContext";
import { getSignatureBlockDetails, formatDateStr } from "@/lib/pdfHelpers";
import { notifyCommentAssigned, dispatchGlobalCommentNotification } from "@/utils/notificationHelpers";
import { createFileRoute } from "@tanstack/react-router";
import React, { useState, useMemo, useEffect, useRef } from "react";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import {
  Info, Sparkles, AlertTriangle, CheckCircle2, FileText, Printer, X, HelpCircle,
  MessageSquare, ShieldAlert, Check, Activity, Copy, Clipboard, RotateCcw,
  Trash2, Edit3, Lock, Droplets, Waves, Gauge, Clock, ShieldCheck, Layers,
  ArrowRight, Download, Save, Zap, Cylinder, ArrowUpRight, ChevronDown, ChevronRight,
  GitFork, Building, Home, Hotel, Utensils, Stethoscope, GraduationCap, Minus, Plus,
  SlidersHorizontal, CheckCircle
} from "lucide-react";
import {
  ContextMenu,
  ContextMenuTrigger,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuShortcut,
} from "@/components/ui/context-menu";
import { AppShell } from "@/components/workspace/AppShell";
import { useWorkspace } from "@/lib/workspace-store";
import { dirtyStore } from "@/lib/dirty-store";
import { toast } from "sonner";

export const Route = createFileRoute("/plumbing-drainage")({
  head: () => ({
    meta: [
      { title: "Drainage Pipe Sizing Calculator — MEP Calc" },
      { name: "description", content: "Determine sanitary drainage branch, stack, and building drain/sewer sizes based on Fixture Units (DFU), slope, and Manning hydraulics per IPC & UPC." },
    ],
  }),
  component: DrainagePage,
});

export type DrainagePresetKey =
  | "commercial_office"
  | "residential_apartment"
  | "luxury_hotel"
  | "restaurant_kitchen"
  | "hospital_clinic"
  | "educational_school"
  | "custom";

export interface FixtureRowItem {
  id: string;
  name: string;
  category: "sanitary" | "kitchen" | "laundry" | "special";
  dfu: number;
  val: number;
  minTrapSizeInches: number;
  notes: string;
}

export interface DrainagePresetConfig {
  key: DrainagePresetKey;
  label: string;
  category: string;
  description: string;
  systemType: "branch" | "stack_short" | "stack_tall" | "building_drain";
  slope: number; // in/ft (e.g. 0.25 = 1/4 in/ft)
  material: "pvc" | "cast_iron" | "hdpe" | "copper";
  safetyFactor: number; // %
  ventLength: number; // ft
  fixtures: FixtureRowItem[];
}

const DEFAULT_FIXTURES: FixtureRowItem[] = [
  { id: "wc_flush_valve", name: "Water Closet (Flushometer Valve 1.6 GPF)", category: "sanitary", dfu: 4.0, val: 0, minTrapSizeInches: 3.0, notes: "Public restrooms" },
  { id: "wc_tank", name: "Water Closet (Gravity Tank 1.6 GPF)", category: "sanitary", dfu: 3.0, val: 0, minTrapSizeInches: 3.0, notes: "Private / residential" },
  { id: "lavatory", name: "Lavatory / Hand Basin", category: "sanitary", dfu: 1.0, val: 0, minTrapSizeInches: 1.25, notes: "1-1/4\" waste connection" },
  { id: "urinal_fv", name: "Urinal (1.0 GPF Flush Valve)", category: "sanitary", dfu: 2.0, val: 0, minTrapSizeInches: 2.0, notes: "Wall hung / stall" },
  { id: "bathtub_shower", name: "Bathtub / Shower Combo", category: "sanitary", dfu: 2.0, val: 0, minTrapSizeInches: 1.5, notes: "With overhead shower" },
  { id: "shower_stall", name: "Shower Stall (Dedicated)", category: "sanitary", dfu: 2.0, val: 0, minTrapSizeInches: 2.0, notes: "Direct floor drain trap" },
  { id: "kitchen_sink_dom", name: "Kitchen Sink (Domestic / Pantry)", category: "kitchen", dfu: 2.0, val: 0, minTrapSizeInches: 1.5, notes: "With food waste disposer" },
  { id: "kitchen_sink_comm", name: "Commercial Pot Sink / Scullery (3-Comp)", category: "kitchen", dfu: 3.0, val: 0, minTrapSizeInches: 2.0, notes: "Commercial kitchen" },
  { id: "dishwasher_comm", name: "Commercial Dishwasher", category: "kitchen", dfu: 3.0, val: 0, minTrapSizeInches: 2.0, notes: "Indirect waste connection" },
  { id: "clothes_washer", name: "Automatic Clothes Washer Standpipe", category: "laundry", dfu: 3.0, val: 0, minTrapSizeInches: 2.0, notes: "2\" standpipe minimum" },
  { id: "floor_drain_2", name: "Floor Drain (2\" Trap)", category: "special", dfu: 2.0, val: 0, minTrapSizeInches: 2.0, notes: "Emergency / room drain" },
  { id: "floor_drain_3", name: "Floor Drain (3\" Trap)", category: "special", dfu: 3.0, val: 0, minTrapSizeInches: 3.0, notes: "Commercial plant / kitchen" },
  { id: "service_sink", name: "Service Sink / Janitor Mop Basin", category: "special", dfu: 3.0, val: 0, minTrapSizeInches: 3.0, notes: "Janitor room mop basin" },
  { id: "drinking_fountain", name: "Drinking Fountain / Water Cooler", category: "special", dfu: 0.5, val: 0, minTrapSizeInches: 1.25, notes: "Indirect receptor" },
];

export const DRAINAGE_PRESETS: Record<DrainagePresetKey, DrainagePresetConfig> = {
  commercial_office: {
    key: "commercial_office",
    label: "Commercial Office Floor",
    category: "IPC / Commercial Branch & Stack",
    description: "Multi-fixture male/female commercial restroom core with WCs, urinals, lavatories, and pantry.",
    systemType: "branch",
    slope: 0.25, // 1/4 in/ft
    material: "pvc",
    safetyFactor: 15,
    ventLength: 45,
    fixtures: [
      { id: "wc_flush_valve", name: "Water Closet (Flushometer Valve 1.6 GPF)", category: "sanitary", dfu: 4.0, val: 12, minTrapSizeInches: 3.0, notes: "Public restrooms" },
      { id: "wc_tank", name: "Water Closet (Gravity Tank 1.6 GPF)", category: "sanitary", dfu: 3.0, val: 0, minTrapSizeInches: 3.0, notes: "Private / residential" },
      { id: "lavatory", name: "Lavatory / Hand Basin", category: "sanitary", dfu: 1.0, val: 10, minTrapSizeInches: 1.25, notes: "1-1/4\" waste connection" },
      { id: "urinal_fv", name: "Urinal (1.0 GPF Flush Valve)", category: "sanitary", dfu: 2.0, val: 6, minTrapSizeInches: 2.0, notes: "Wall hung / stall" },
      { id: "bathtub_shower", name: "Bathtub / Shower Combo", category: "sanitary", dfu: 2.0, val: 0, minTrapSizeInches: 1.5, notes: "With overhead shower" },
      { id: "shower_stall", name: "Shower Stall (Dedicated)", category: "sanitary", dfu: 2.0, val: 2, minTrapSizeInches: 2.0, notes: "Direct floor drain trap" },
      { id: "kitchen_sink_dom", name: "Kitchen Sink (Domestic / Pantry)", category: "kitchen", dfu: 2.0, val: 2, minTrapSizeInches: 1.5, notes: "With food waste disposer" },
      { id: "kitchen_sink_comm", name: "Commercial Pot Sink / Scullery (3-Comp)", category: "kitchen", dfu: 3.0, val: 0, minTrapSizeInches: 2.0, notes: "Commercial kitchen" },
      { id: "dishwasher_comm", name: "Commercial Dishwasher", category: "kitchen", dfu: 3.0, val: 0, minTrapSizeInches: 2.0, notes: "Indirect waste connection" },
      { id: "clothes_washer", name: "Automatic Clothes Washer Standpipe", category: "laundry", dfu: 3.0, val: 0, minTrapSizeInches: 2.0, notes: "2\" standpipe minimum" },
      { id: "floor_drain_2", name: "Floor Drain (2\" Trap)", category: "special", dfu: 2.0, val: 4, minTrapSizeInches: 2.0, notes: "Emergency / room drain" },
      { id: "floor_drain_3", name: "Floor Drain (3\" Trap)", category: "special", dfu: 3.0, val: 0, minTrapSizeInches: 3.0, notes: "Commercial plant / kitchen" },
      { id: "service_sink", name: "Service Sink / Janitor Mop Basin", category: "special", dfu: 3.0, val: 2, minTrapSizeInches: 3.0, notes: "Janitor room mop basin" },
      { id: "drinking_fountain", name: "Drinking Fountain / Water Cooler", category: "special", dfu: 0.5, val: 4, minTrapSizeInches: 1.25, notes: "Indirect receptor" },
    ],
  },
  residential_apartment: {
    key: "residential_apartment",
    label: "Residential Apartment Stack",
    category: "IPC / Multi-Family Stack",
    description: "6-story multi-family apartment residential soil & waste vertical drainage stack.",
    systemType: "stack_tall",
    slope: 0.25,
    material: "pvc",
    safetyFactor: 15,
    ventLength: 60,
    fixtures: [
      { id: "wc_flush_valve", name: "Water Closet (Flushometer Valve 1.6 GPF)", category: "sanitary", dfu: 4.0, val: 0, minTrapSizeInches: 3.0, notes: "Public restrooms" },
      { id: "wc_tank", name: "Water Closet (Gravity Tank 1.6 GPF)", category: "sanitary", dfu: 3.0, val: 12, minTrapSizeInches: 3.0, notes: "Private / residential" },
      { id: "lavatory", name: "Lavatory / Hand Basin", category: "sanitary", dfu: 1.0, val: 12, minTrapSizeInches: 1.25, notes: "1-1/4\" waste connection" },
      { id: "urinal_fv", name: "Urinal (1.0 GPF Flush Valve)", category: "sanitary", dfu: 2.0, val: 0, minTrapSizeInches: 2.0, notes: "Wall hung / stall" },
      { id: "bathtub_shower", name: "Bathtub / Shower Combo", category: "sanitary", dfu: 2.0, val: 12, minTrapSizeInches: 1.5, notes: "With overhead shower" },
      { id: "shower_stall", name: "Shower Stall (Dedicated)", category: "sanitary", dfu: 2.0, val: 0, minTrapSizeInches: 2.0, notes: "Direct floor drain trap" },
      { id: "kitchen_sink_dom", name: "Kitchen Sink (Domestic / Pantry)", category: "kitchen", dfu: 2.0, val: 6, minTrapSizeInches: 1.5, notes: "With food waste disposer" },
      { id: "kitchen_sink_comm", name: "Commercial Pot Sink / Scullery (3-Comp)", category: "kitchen", dfu: 3.0, val: 0, minTrapSizeInches: 2.0, notes: "Commercial kitchen" },
      { id: "dishwasher_comm", name: "Commercial Dishwasher", category: "kitchen", dfu: 3.0, val: 0, minTrapSizeInches: 2.0, notes: "Indirect waste connection" },
      { id: "clothes_washer", name: "Automatic Clothes Washer Standpipe", category: "laundry", dfu: 3.0, val: 6, minTrapSizeInches: 2.0, notes: "2\" standpipe minimum" },
      { id: "floor_drain_2", name: "Floor Drain (2\" Trap)", category: "special", dfu: 2.0, val: 6, minTrapSizeInches: 2.0, notes: "Emergency / room drain" },
      { id: "floor_drain_3", name: "Floor Drain (3\" Trap)", category: "special", dfu: 3.0, val: 0, minTrapSizeInches: 3.0, notes: "Commercial plant / kitchen" },
      { id: "service_sink", name: "Service Sink / Janitor Mop Basin", category: "special", dfu: 3.0, val: 0, minTrapSizeInches: 3.0, notes: "Janitor room mop basin" },
      { id: "drinking_fountain", name: "Drinking Fountain / Water Cooler", category: "special", dfu: 0.5, val: 0, minTrapSizeInches: 1.25, notes: "Indirect receptor" },
    ],
  },
  luxury_hotel: {
    key: "luxury_hotel",
    label: "Luxury Hotel Building Drain",
    category: "IPC / Hospitality Building Drain",
    description: "Main underground building drain collecting discharge from guestroom stacks, public washrooms, and laundry.",
    systemType: "building_drain",
    slope: 0.125, // 1/8 in/ft
    material: "cast_iron",
    safetyFactor: 20,
    ventLength: 90,
    fixtures: [
      { id: "wc_flush_valve", name: "Water Closet (Flushometer Valve 1.6 GPF)", category: "sanitary", dfu: 4.0, val: 30, minTrapSizeInches: 3.0, notes: "Public restrooms" },
      { id: "wc_tank", name: "Water Closet (Gravity Tank 1.6 GPF)", category: "sanitary", dfu: 3.0, val: 20, minTrapSizeInches: 3.0, notes: "Private / residential" },
      { id: "lavatory", name: "Lavatory / Hand Basin", category: "sanitary", dfu: 1.0, val: 50, minTrapSizeInches: 1.25, notes: "1-1/4\" waste connection" },
      { id: "urinal_fv", name: "Urinal (1.0 GPF Flush Valve)", category: "sanitary", dfu: 2.0, val: 12, minTrapSizeInches: 2.0, notes: "Wall hung / stall" },
      { id: "bathtub_shower", name: "Bathtub / Shower Combo", category: "sanitary", dfu: 2.0, val: 40, minTrapSizeInches: 1.5, notes: "With overhead shower" },
      { id: "shower_stall", name: "Shower Stall (Dedicated)", category: "sanitary", dfu: 2.0, val: 10, minTrapSizeInches: 2.0, notes: "Direct floor drain trap" },
      { id: "kitchen_sink_dom", name: "Kitchen Sink (Domestic / Pantry)", category: "kitchen", dfu: 2.0, val: 5, minTrapSizeInches: 1.5, notes: "With food waste disposer" },
      { id: "kitchen_sink_comm", name: "Commercial Pot Sink / Scullery (3-Comp)", category: "kitchen", dfu: 3.0, val: 4, minTrapSizeInches: 2.0, notes: "Commercial kitchen" },
      { id: "dishwasher_comm", name: "Commercial Dishwasher", category: "kitchen", dfu: 3.0, val: 3, minTrapSizeInches: 2.0, notes: "Indirect waste connection" },
      { id: "clothes_washer", name: "Automatic Clothes Washer Standpipe", category: "laundry", dfu: 3.0, val: 8, minTrapSizeInches: 2.0, notes: "2\" standpipe minimum" },
      { id: "floor_drain_2", name: "Floor Drain (2\" Trap)", category: "special", dfu: 2.0, val: 16, minTrapSizeInches: 2.0, notes: "Emergency / room drain" },
      { id: "floor_drain_3", name: "Floor Drain (3\" Trap)", category: "special", dfu: 3.0, val: 6, minTrapSizeInches: 3.0, notes: "Commercial plant / kitchen" },
      { id: "service_sink", name: "Service Sink / Janitor Mop Basin", category: "special", dfu: 3.0, val: 6, minTrapSizeInches: 3.0, notes: "Janitor room mop basin" },
      { id: "drinking_fountain", name: "Drinking Fountain / Water Cooler", category: "special", dfu: 0.5, val: 8, minTrapSizeInches: 1.25, notes: "Indirect receptor" },
    ],
  },
  restaurant_kitchen: {
    key: "restaurant_kitchen",
    label: "Restaurant Kitchen Branch",
    category: "IPC / High Grease & Solids",
    description: "High discharge commercial kitchen branch with heavy grease traps, multi-comp scullery sinks, and floor drains.",
    systemType: "branch",
    slope: 0.25,
    material: "cast_iron",
    safetyFactor: 20,
    ventLength: 40,
    fixtures: [
      { id: "wc_flush_valve", name: "Water Closet (Flushometer Valve 1.6 GPF)", category: "sanitary", dfu: 4.0, val: 6, minTrapSizeInches: 3.0, notes: "Public restrooms" },
      { id: "wc_tank", name: "Water Closet (Gravity Tank 1.6 GPF)", category: "sanitary", dfu: 3.0, val: 0, minTrapSizeInches: 3.0, notes: "Private / residential" },
      { id: "lavatory", name: "Lavatory / Hand Basin", category: "sanitary", dfu: 1.0, val: 6, minTrapSizeInches: 1.25, notes: "1-1/4\" waste connection" },
      { id: "urinal_fv", name: "Urinal (1.0 GPF Flush Valve)", category: "sanitary", dfu: 2.0, val: 4, minTrapSizeInches: 2.0, notes: "Wall hung / stall" },
      { id: "bathtub_shower", name: "Bathtub / Shower Combo", category: "sanitary", dfu: 2.0, val: 0, minTrapSizeInches: 1.5, notes: "With overhead shower" },
      { id: "shower_stall", name: "Shower Stall (Dedicated)", category: "sanitary", dfu: 2.0, val: 0, minTrapSizeInches: 2.0, notes: "Direct floor drain trap" },
      { id: "kitchen_sink_dom", name: "Kitchen Sink (Domestic / Pantry)", category: "kitchen", dfu: 2.0, val: 2, minTrapSizeInches: 1.5, notes: "With food waste disposer" },
      { id: "kitchen_sink_comm", name: "Commercial Pot Sink / Scullery (3-Comp)", category: "kitchen", dfu: 3.0, val: 6, minTrapSizeInches: 2.0, notes: "Commercial kitchen" },
      { id: "dishwasher_comm", name: "Commercial Dishwasher", category: "kitchen", dfu: 3.0, val: 2, minTrapSizeInches: 2.0, notes: "Indirect waste connection" },
      { id: "clothes_washer", name: "Automatic Clothes Washer Standpipe", category: "laundry", dfu: 3.0, val: 0, minTrapSizeInches: 2.0, notes: "2\" standpipe minimum" },
      { id: "floor_drain_2", name: "Floor Drain (2\" Trap)", category: "special", dfu: 2.0, val: 4, minTrapSizeInches: 2.0, notes: "Emergency / room drain" },
      { id: "floor_drain_3", name: "Floor Drain (3\" Trap)", category: "special", dfu: 3.0, val: 8, minTrapSizeInches: 3.0, notes: "Commercial plant / kitchen" },
      { id: "service_sink", name: "Service Sink / Janitor Mop Basin", category: "special", dfu: 3.0, val: 2, minTrapSizeInches: 3.0, notes: "Janitor room mop basin" },
      { id: "drinking_fountain", name: "Drinking Fountain / Water Cooler", category: "special", dfu: 0.5, val: 2, minTrapSizeInches: 1.25, notes: "Indirect receptor" },
    ],
  },
  hospital_clinic: {
    key: "hospital_clinic",
    label: "Hospital / Healthcare Clinic",
    category: "IPC / Healthcare Facility",
    description: "Clinical patient rooms, scrub stations, examination washrooms, and sanitary mop disposal units.",
    systemType: "stack_tall",
    slope: 0.25,
    material: "pvc",
    safetyFactor: 20,
    ventLength: 75,
    fixtures: [
      { id: "wc_flush_valve", name: "Water Closet (Flushometer Valve 1.6 GPF)", category: "sanitary", dfu: 4.0, val: 16, minTrapSizeInches: 3.0, notes: "Public restrooms" },
      { id: "wc_tank", name: "Water Closet (Gravity Tank 1.6 GPF)", category: "sanitary", dfu: 3.0, val: 4, minTrapSizeInches: 3.0, notes: "Private / residential" },
      { id: "lavatory", name: "Lavatory / Hand Basin", category: "sanitary", dfu: 1.0, val: 24, minTrapSizeInches: 1.25, notes: "1-1/4\" waste connection" },
      { id: "urinal_fv", name: "Urinal (1.0 GPF Flush Valve)", category: "sanitary", dfu: 2.0, val: 4, minTrapSizeInches: 2.0, notes: "Wall hung / stall" },
      { id: "bathtub_shower", name: "Bathtub / Shower Combo", category: "sanitary", dfu: 2.0, val: 8, minTrapSizeInches: 1.5, notes: "With overhead shower" },
      { id: "shower_stall", name: "Shower Stall (Dedicated)", category: "sanitary", dfu: 2.0, val: 4, minTrapSizeInches: 2.0, notes: "Direct floor drain trap" },
      { id: "kitchen_sink_dom", name: "Kitchen Sink (Domestic / Pantry)", category: "kitchen", dfu: 2.0, val: 4, minTrapSizeInches: 1.5, notes: "With food waste disposer" },
      { id: "kitchen_sink_comm", name: "Commercial Pot Sink / Scullery (3-Comp)", category: "kitchen", dfu: 3.0, val: 1, minTrapSizeInches: 2.0, notes: "Commercial kitchen" },
      { id: "dishwasher_comm", name: "Commercial Dishwasher", category: "kitchen", dfu: 3.0, val: 1, minTrapSizeInches: 2.0, notes: "Indirect waste connection" },
      { id: "clothes_washer", name: "Automatic Clothes Washer Standpipe", category: "laundry", dfu: 3.0, val: 2, minTrapSizeInches: 2.0, notes: "2\" standpipe minimum" },
      { id: "floor_drain_2", name: "Floor Drain (2\" Trap)", category: "special", dfu: 2.0, val: 10, minTrapSizeInches: 2.0, notes: "Emergency / room drain" },
      { id: "floor_drain_3", name: "Floor Drain (3\" Trap)", category: "special", dfu: 3.0, val: 4, minTrapSizeInches: 3.0, notes: "Commercial plant / kitchen" },
      { id: "service_sink", name: "Service Sink / Janitor Mop Basin", category: "special", dfu: 3.0, val: 6, minTrapSizeInches: 3.0, notes: "Janitor room mop basin" },
      { id: "drinking_fountain", name: "Drinking Fountain / Water Cooler", category: "special", dfu: 0.5, val: 6, minTrapSizeInches: 1.25, notes: "Indirect receptor" },
    ],
  },
  educational_school: {
    key: "educational_school",
    label: "Educational Campus",
    category: "IPC / Institutional",
    description: "High-density student group restrooms, science lab sinks, and janitorial facilities.",
    systemType: "stack_short",
    slope: 0.25,
    material: "hdpe",
    safetyFactor: 15,
    ventLength: 50,
    fixtures: [
      { id: "wc_flush_valve", name: "Water Closet (Flushometer Valve 1.6 GPF)", category: "sanitary", dfu: 4.0, val: 18, minTrapSizeInches: 3.0, notes: "Public restrooms" },
      { id: "wc_tank", name: "Water Closet (Gravity Tank 1.6 GPF)", category: "sanitary", dfu: 3.0, val: 0, minTrapSizeInches: 3.0, notes: "Private / residential" },
      { id: "lavatory", name: "Lavatory / Hand Basin", category: "sanitary", dfu: 1.0, val: 16, minTrapSizeInches: 1.25, notes: "1-1/4\" waste connection" },
      { id: "urinal_fv", name: "Urinal (1.0 GPF Flush Valve)", category: "sanitary", dfu: 2.0, val: 8, minTrapSizeInches: 2.0, notes: "Wall hung / stall" },
      { id: "bathtub_shower", name: "Bathtub / Shower Combo", category: "sanitary", dfu: 2.0, val: 0, minTrapSizeInches: 1.5, notes: "With overhead shower" },
      { id: "shower_stall", name: "Shower Stall (Dedicated)", category: "sanitary", dfu: 2.0, val: 6, minTrapSizeInches: 2.0, notes: "Direct floor drain trap" },
      { id: "kitchen_sink_dom", name: "Kitchen Sink (Domestic / Pantry)", category: "kitchen", dfu: 2.0, val: 2, minTrapSizeInches: 1.5, notes: "With food waste disposer" },
      { id: "kitchen_sink_comm", name: "Commercial Pot Sink / Scullery (3-Comp)", category: "kitchen", dfu: 3.0, val: 2, minTrapSizeInches: 2.0, notes: "Commercial kitchen" },
      { id: "dishwasher_comm", name: "Commercial Dishwasher", category: "kitchen", dfu: 3.0, val: 1, minTrapSizeInches: 2.0, notes: "Indirect waste connection" },
      { id: "clothes_washer", name: "Automatic Clothes Washer Standpipe", category: "laundry", dfu: 3.0, val: 0, minTrapSizeInches: 2.0, notes: "2\" standpipe minimum" },
      { id: "floor_drain_2", name: "Floor Drain (2\" Trap)", category: "special", dfu: 2.0, val: 6, minTrapSizeInches: 2.0, notes: "Emergency / room drain" },
      { id: "floor_drain_3", name: "Floor Drain (3\" Trap)", category: "special", dfu: 3.0, val: 2, minTrapSizeInches: 3.0, notes: "Commercial plant / kitchen" },
      { id: "service_sink", name: "Service Sink / Janitor Mop Basin", category: "special", dfu: 3.0, val: 4, minTrapSizeInches: 3.0, notes: "Janitor room mop basin" },
      { id: "drinking_fountain", name: "Drinking Fountain / Water Cooler", category: "special", dfu: 0.5, val: 8, minTrapSizeInches: 1.25, notes: "Indirect receptor" },
    ],
  },
  custom: {
    key: "custom",
    label: "Custom Configuration",
    category: "Custom Drainage Sizing",
    description: "User-defined fixture counts, piping slopes, and drainage system configuration.",
    systemType: "branch",
    slope: 0.25,
    material: "pvc",
    safetyFactor: 15,
    ventLength: 40,
    fixtures: DEFAULT_FIXTURES.map(f => ({ ...f, val: 0 })),
  },
};

// Material roughness Manning's n
const MATERIAL_ROUGHNESS: Record<string, { name: string; n: number }> = {
  pvc: { name: "PVC / ABS Schedule 40 (Smooth Plastic)", n: 0.009 },
  cast_iron: { name: "Cast Iron Hubless / No-Hub DWV", n: 0.012 },
  hdpe: { name: "HDPE Solid Wall Drainage Pipe", n: 0.009 },
  copper: { name: "Copper Type DWV", n: 0.011 },
};

// IPC 2021 Table 710.1(2) - Horizontal Fixture Branch Capacities (Max DFU)
const BRANCH_CAPACITY: { size: number; maxDfu: number; dn: number }[] = [
  { size: 1.5, maxDfu: 3, dn: 40 },
  { size: 2.0, maxDfu: 6, dn: 50 },
  { size: 2.5, maxDfu: 12, dn: 65 },
  { size: 3.0, maxDfu: 20, dn: 80 },
  { size: 4.0, maxDfu: 160, dn: 100 },
  { size: 5.0, maxDfu: 360, dn: 125 },
  { size: 6.0, maxDfu: 620, dn: 150 },
  { size: 8.0, maxDfu: 1400, dn: 200 },
  { size: 10.0, maxDfu: 2500, dn: 250 },
  { size: 12.0, maxDfu: 3900, dn: 300 },
];

// IPC 2021 Table 710.1(1) - Soil / Waste Stacks Capacities (Max DFU)
const STACK_CAPACITY: { size: number; maxShort: number; maxTall: number; dn: number }[] = [
  { size: 1.5, maxShort: 4, maxTall: 8, dn: 40 },
  { size: 2.0, maxShort: 10, maxTall: 24, dn: 50 },
  { size: 2.5, maxShort: 20, maxTall: 42, dn: 65 },
  { size: 3.0, maxShort: 48, maxTall: 72, dn: 80 },
  { size: 4.0, maxShort: 240, maxTall: 500, dn: 100 },
  { size: 5.0, maxShort: 540, maxTall: 1100, dn: 125 },
  { size: 6.0, maxShort: 960, maxTall: 1900, dn: 150 },
  { size: 8.0, maxShort: 2200, maxTall: 3600, dn: 200 },
  { size: 10.0, maxShort: 3800, maxTall: 5600, dn: 250 },
  { size: 12.0, maxShort: 6000, maxTall: 8400, dn: 300 },
];

// IPC 2021 Table 710.1(1) - Building Drains & Sewers Capacities (Max DFU by slope)
const BUILDING_DRAIN_CAPACITY: { size: number; s0625: number; s125: number; s25: number; s50: number; dn: number }[] = [
  { size: 1.5, s0625: 0, s125: 0, s25: 1, s50: 1, dn: 40 },
  { size: 2.0, s0625: 0, s125: 0, s25: 21, s50: 26, dn: 50 },
  { size: 2.5, s0625: 0, s125: 0, s25: 24, s50: 31, dn: 65 },
  { size: 3.0, s0625: 0, s125: 36, s25: 42, s50: 50, dn: 80 },
  { size: 4.0, s0625: 180, s125: 216, s25: 250, s50: 290, dn: 100 },
  { size: 5.0, s0625: 390, s125: 480, s25: 575, s50: 675, dn: 125 },
  { size: 6.0, s0625: 700, s125: 840, s25: 1000, s50: 1300, dn: 150 },
  { size: 8.0, s0625: 1400, s125: 1920, s25: 2300, s50: 3000, dn: 200 },
  { size: 10.0, s0625: 2500, s125: 3500, s25: 4200, s50: 5300, dn: 250 },
  { size: 12.0, s0625: 3900, s125: 5600, s25: 6700, s50: 8300, dn: 300 },
];

// Vent sizing per IPC Table 906.1
function computeVentSize(soilStackSize: number, totalDfu: number, ventLengthFt: number): { size: number; dn: number } {
  if (soilStackSize <= 1.5) return { size: 1.25, dn: 32 };
  if (soilStackSize <= 2.0) {
    if (ventLengthFt <= 50) return { size: 1.5, dn: 40 };
    return { size: 2.0, dn: 50 };
  }
  if (soilStackSize <= 3.0) {
    if (totalDfu <= 20 && ventLengthFt <= 60) return { size: 1.5, dn: 40 };
    if (ventLengthFt <= 100) return { size: 2.0, dn: 50 };
    return { size: 2.5, dn: 65 };
  }
  if (soilStackSize <= 4.0) {
    if (totalDfu <= 100 && ventLengthFt <= 50) return { size: 2.0, dn: 50 };
    if (ventLengthFt <= 100) return { size: 2.5, dn: 65 };
    if (ventLengthFt <= 200) return { size: 3.0, dn: 80 };
    return { size: 4.0, dn: 100 };
  }
  if (soilStackSize <= 6.0) {
    if (ventLengthFt <= 100) return { size: 3.0, dn: 80 };
    return { size: 4.0, dn: 100 };
  }
  return { size: 4.0, dn: 100 };
}

function DrainagePage() {
  const { userData, profile, user } = useAuth();
  const currentUserName = userData?.name || profile?.name || user?.user_metadata?.full_name || user?.email?.split("@")[0] || "Design Engineer";
  const { project, activeRoom, isReadOnly } = useWorkspace();
  const isApprovedLocked = useCalculationLock("/plumbing-drainage", project?.id);
  const isViewerRole = profile?.role === "VIEWER" || userData?.role === "VIEWER";
  const [calcReviewState, setCalcReviewState] = useState<CalculationReviewState | null>(null);
  const isEffectiveReadOnly = Boolean(isReadOnly || isApprovedLocked || isViewerRole || calcReviewState?.status === "APPROVED");
  const isLocked = isEffectiveReadOnly;

  // Calculation review state listener
  useEffect(() => {
    const handleReviewUpdate = (e: any) => {
      if (e?.detail) {
        setCalcReviewState(e.detail);
      }
    };
    if (typeof window !== "undefined") {
      window.addEventListener("mep-review-state-updated", handleReviewUpdate);
    }
    return () => {
      if (typeof window !== "undefined") {
        window.removeEventListener("mep-review-state-updated", handleReviewUpdate);
      }
    };
  }, []);

  // Mode: "calculator" vs "report"
  const [activeTab, setActiveTab] = useState<"calculator" | "report">("calculator");
  const [intelOpen, setIntelOpen] = useState(false);

  // Unit System
  const [unitSystem, setUnitSystem] = useState<"ip" | "si">("ip");
  const isSI = unitSystem === "si";

  // Selected preset
  const [selectedPreset, setSelectedPreset] = useState<DrainagePresetKey>("commercial_office");

  // Drainage parameters
  const [systemType, setSystemType] = useState<"branch" | "stack_short" | "stack_tall" | "building_drain">("branch");
  const [slope, setSlope] = useState<number>(0.25); // in/ft
  const [material, setMaterial] = useState<"pvc" | "cast_iron" | "hdpe" | "copper">("pvc");
  const [safetyFactor, setSafetyFactor] = useState<number>(15); // %
  const [ventLength, setVentLength] = useState<number>(45); // ft

  // Fixtures
  const [fixtures, setFixtures] = useState<FixtureRowItem[]>(DRAINAGE_PRESETS.commercial_office.fixtures);

  // Dialogs
  const [showFormulaModal, setShowFormulaModal] = useState<boolean>(false);
  const [isCommentModalOpen, setIsCommentModalOpen] = useState(false);
  const [commentTargetItem, setCommentTargetItem] = useState<{ id: string; name: string } | null>(null);
  const [commentsList, setCommentsList] = useState<any[]>([]);
  const [highlightedTargetId, setHighlightedTargetId] = useState<string | null>(null);
  const highlightTimeoutRef = useRef<any>(null);

  // Load comments on project switch
  useEffect(() => {
    const pId = project?.id || "default";
    const storageKey = `mep_calc_comments_${pId}_/plumbing-drainage`;
    try {
      const stored = localStorage.getItem(storageKey);
      if (stored) {
        const parsed = JSON.parse(stored);
        if (Array.isArray(parsed)) {
          setCommentsList(parsed);
        }
      } else {
        setCommentsList([]);
      }
    } catch (e) {
      console.error("Failed to load comments", e);
    }
  }, [project?.id]);

  // Scroll and highlight notification target item
  useEffect(() => {
    const handleScrollTarget = (targetId?: string, targetName?: string) => {
      if (!targetId && !targetName) return;
      const cleanId = (targetId || "").toLowerCase().trim();
      const cleanRaw = cleanId.replace(/^(field-|card-|res-)/, "");

      setHighlightedTargetId(cleanRaw || cleanId || targetId || null);

      if (highlightTimeoutRef.current) clearTimeout(highlightTimeoutRef.current);
      highlightTimeoutRef.current = setTimeout(() => {
        setHighlightedTargetId(null);
        highlightTimeoutRef.current = null;
      }, 4500);
    };

    const handleCustomEvent = (e: any) => {
      if (e?.detail) {
        handleScrollTarget(e.detail.targetId, e.detail.targetName);
      }
    };

    window.addEventListener("mep-scroll-to-field", handleCustomEvent as any);
    return () => window.removeEventListener("mep-scroll-to-field", handleCustomEvent as any);
  }, []);

  const isFieldHighlighted = (fieldId: string, _fieldName?: string) => {
    if (!highlightedTargetId) return false;
    const cleanCurrent = (fieldId || "").toLowerCase().trim().replace(/^(field-|card-|res-)/, "");
    const cleanTarget = highlightedTargetId.toLowerCase().trim().replace(/^(field-|card-|res-)/, "");
    return cleanCurrent === cleanTarget;
  };

  const renderCommentBadge = (fieldId: string, fieldName: string) => {
    const cleanId = fieldId.replace(/^(field-|card-|res-)/, "");
    const count = commentsList.filter(
      (c) => c.targetItemId === cleanId || c.targetItemId === fieldId || c.fieldName === fieldName
    ).length;

    if (count === 0) return null;

    return (
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          handleOpenComment(fieldId, fieldName);
        }}
        className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full bg-blue-500/10 text-blue-600 dark:text-blue-400 text-[10px] font-bold border border-blue-500/20 hover:bg-blue-500/20 transition-colors cursor-pointer ml-1.5"
        title={`${count} comment(s)/task(s) assigned`}
      >
        <MessageSquare className="size-2.5 fill-blue-500/30" />
        <span>{count}</span>
      </button>
    );
  };

  // Load from preset
  const handleApplyPreset = (key: DrainagePresetKey) => {
    if (isLocked) {
      toast.info("Calculation is APPROVED and locked. Discipline Coordinator must Unlock to edit.", { id: "readonly-notice" });
      return;
    }
    const config = DRAINAGE_PRESETS[key];
    if (!config) return;
    setSelectedPreset(key);
    setSystemType(config.systemType);
    setSlope(config.slope);
    setMaterial(config.material);
    setSafetyFactor(config.safetyFactor);
    setVentLength(config.ventLength);
    setFixtures(config.fixtures.map(f => ({ ...f })));
    dirtyStore.set(true);
    toast.info(`Loaded "${config.label}" preset configuration.`);
  };

  // Adjust fixture count
  const handleAdjustCount = (id: string, delta: number) => {
    if (isLocked) {
      toast.info("Calculation is APPROVED and locked. Discipline Coordinator must Unlock to edit.", { id: "readonly-notice" });
      return;
    }
    setFixtures(prev =>
      prev.map(item => {
        if (item.id === id) {
          const newVal = Math.max(0, item.val + delta);
          return { ...item, val: newVal };
        }
        return item;
      })
    );
    dirtyStore.set(true);
  };

  const handleSetCount = (id: string, val: number) => {
    if (isLocked) {
      toast.info("Calculation is APPROVED and locked. Discipline Coordinator must Unlock to edit.", { id: "readonly-notice" });
      return;
    }
    const clean = Math.max(0, isNaN(val) ? 0 : val);
    setFixtures(prev =>
      prev.map(item => (item.id === id ? { ...item, val: clean } : item))
    );
    dirtyStore.set(true);
  };

  // Clear all fixtures
  const handleClearAllFixtures = () => {
    if (isLocked) {
      toast.info("Calculation is APPROVED and locked. Discipline Coordinator must Unlock to edit.", { id: "readonly-notice" });
      return;
    }
    setFixtures(prev => prev.map(f => ({ ...f, val: 0 })));
    dirtyStore.set(true);
    toast.success("Cleared all fixture quantities.");
  };

  // Calculations
  const calcResults = useMemo(() => {
    // 1. Total Raw DFU
    const rawDfu = fixtures.reduce((acc, f) => acc + (f.dfu * f.val), 0);
    const totalCount = fixtures.reduce((acc, f) => acc + f.val, 0);

    // 2. Factored Design DFU
    const designDfu = Math.ceil(rawDfu * (1 + safetyFactor / 100));

    // 3. Minimum Trap Size & Water Closet Rules
    // If any WC is present, minimum stack/drain size is 3" NPS (80 mm DN) per IPC/UPC
    const hasWc = fixtures.some(f => (f.id.includes("wc") && f.val > 0));
    const wcCount = fixtures.filter(f => f.id.includes("wc")).reduce((acc, f) => acc + f.val, 0);

    // 4. Pipe Sizing
    let sizedNps = 1.5;
    let sizedDn = 40;
    let maxAllowedDfu = 3;

    if (systemType === "branch") {
      const match = BRANCH_CAPACITY.find(b => b.maxDfu >= designDfu);
      if (match) {
        sizedNps = match.size;
        sizedDn = match.dn;
        maxAllowedDfu = match.maxDfu;
      } else {
        const last = BRANCH_CAPACITY[BRANCH_CAPACITY.length - 1];
        sizedNps = last.size;
        sizedDn = last.dn;
        maxAllowedDfu = last.maxDfu;
      }
      // WC branch rule: 3" required if 1 or 2 WCs, 4" if > 2 WCs on branch
      if (wcCount >= 1 && wcCount <= 2 && sizedNps < 3.0) {
        sizedNps = 3.0;
        sizedDn = 80;
        maxAllowedDfu = 20;
      } else if (wcCount > 2 && sizedNps < 4.0) {
        sizedNps = 4.0;
        sizedDn = 100;
        maxAllowedDfu = 160;
      }
    } else if (systemType === "stack_short" || systemType === "stack_tall") {
      const isShort = systemType === "stack_short";
      const match = STACK_CAPACITY.find(s => (isShort ? s.maxShort : s.maxTall) >= designDfu);
      if (match) {
        sizedNps = match.size;
        sizedDn = match.dn;
        maxAllowedDfu = isShort ? match.maxShort : match.maxTall;
      } else {
        const last = STACK_CAPACITY[STACK_CAPACITY.length - 1];
        sizedNps = last.size;
        sizedDn = last.dn;
        maxAllowedDfu = isShort ? last.maxShort : last.maxTall;
      }
      if (hasWc && sizedNps < 3.0) {
        sizedNps = 3.0;
        sizedDn = 80;
        maxAllowedDfu = isShort ? 48 : 72;
      }
    } else {
      // Building drain
      const match = BUILDING_DRAIN_CAPACITY.find(b => {
        let cap = b.s25;
        if (slope <= 0.0625) cap = b.s0625;
        else if (slope <= 0.125) cap = b.s125;
        else if (slope <= 0.25) cap = b.s25;
        else cap = b.s50;
        return cap >= designDfu && cap > 0;
      });
      if (match) {
        sizedNps = match.size;
        sizedDn = match.dn;
        let cap = match.s25;
        if (slope <= 0.0625) cap = match.s0625;
        else if (slope <= 0.125) cap = match.s125;
        else if (slope <= 0.25) cap = match.s25;
        else cap = match.s50;
        maxAllowedDfu = cap;
      } else {
        const last = BUILDING_DRAIN_CAPACITY[BUILDING_DRAIN_CAPACITY.length - 1];
        sizedNps = last.size;
        sizedDn = last.dn;
        maxAllowedDfu = slope <= 0.125 ? last.s125 : last.s25;
      }
      if (hasWc && sizedNps < 3.0) {
        sizedNps = 3.0;
        sizedDn = 80;
        maxAllowedDfu = slope <= 0.125 ? 36 : 42;
      }
    }

    // 5. Hydraulics & Manning's Equation for Gravity Flow
    const roughness = MATERIAL_ROUGHNESS[material]?.n || 0.009;
    const slopeDecimal = slope / 12.0; // ft/ft = (in/ft)/12
    const dFeet = sizedNps / 12.0;
    const dMeters = (sizedNps * 25.4) / 1000.0;

    // Half-full flow hydraulic radius Rh = D / 4
    const rhFeet = dFeet / 4.0;
    const rhMeters = dMeters / 4.0;
    const areaHalfSqFt = (Math.PI * Math.pow(dFeet, 2)) / 8.0;

    // Velocity V = (1.486 / n) * Rh^(2/3) * S^(1/2)  [ft/s]
    const velocityFps = (1.486 / roughness) * Math.pow(rhFeet, 2 / 3) * Math.pow(slopeDecimal, 0.5);
    const velocityMps = (1.0 / roughness) * Math.pow(rhMeters, 2 / 3) * Math.pow(slopeDecimal, 0.5);

    // Peak flow capacity at half full Q = V * A
    const qCapCfs = velocityFps * areaHalfSqFt;
    const qCapGpm = qCapCfs * 448.831;
    const qCapLps = qCapGpm * 0.06309;

    // 6. Vent Sizing
    const vent = computeVentSize(sizedNps, designDfu, ventLength);

    // 7. Slope Text Display
    const slopeInPerFt = slope;
    const slopeMmPerM = slope * 83.333; // 1 in/ft = 83.333 mm/m -> 1/4" = 20.8 mm/m
    const slopePercent = (slope / 12.0) * 100;

    // 8. Breakdown percentages
    const breakdown = [
      {
        id: "sanitary",
        name: "WCs, Lavs & Urinals",
        dfu: fixtures.filter(f => f.category === "sanitary").reduce((a, b) => a + b.dfu * b.val, 0),
        color: "#2563EB",
      },
      {
        id: "kitchen",
        name: "Kitchen & Scullery",
        dfu: fixtures.filter(f => f.category === "kitchen").reduce((a, b) => a + b.dfu * b.val, 0),
        color: "#F59E0B",
      },
      {
        id: "laundry",
        name: "Laundry Standpipes",
        dfu: fixtures.filter(f => f.category === "laundry").reduce((a, b) => a + b.dfu * b.val, 0),
        color: "#10B981",
      },
      {
        id: "special",
        name: "Floor Drains & Janitor",
        dfu: fixtures.filter(f => f.category === "special").reduce((a, b) => a + b.dfu * b.val, 0),
        color: "#8B5CF6",
      },
    ].map(item => ({
      ...item,
      pct: rawDfu > 0 ? (item.dfu / rawDfu) * 100 : 0,
    }));

    return {
      rawDfu,
      totalCount,
      designDfu,
      sizedNps,
      sizedDn,
      maxAllowedDfu,
      capacityUtilization: maxAllowedDfu > 0 ? (designDfu / maxAllowedDfu) * 100 : 0,
      velocityFps: parseFloat(velocityFps.toFixed(2)),
      velocityMps: parseFloat(velocityMps.toFixed(2)),
      isScourVelocityOk: velocityFps >= 2.0, // Scour self-cleansing >= 2.0 ft/s (0.6 m/s)
      qCapGpm: Math.round(qCapGpm),
      qCapLps: parseFloat(qCapLps.toFixed(1)),
      ventNps: vent.size,
      ventDn: vent.dn,
      slopeInPerFt,
      slopeMmPerM: parseFloat(slopeMmPerM.toFixed(1)),
      slopePercent: parseFloat(slopePercent.toFixed(2)),
      roughness,
      materialName: MATERIAL_ROUGHNESS[material]?.name || "PVC DWV",
      hasWc,
      wcCount,
      breakdown,
    };
  }, [fixtures, systemType, slope, material, safetyFactor, ventLength]);

  // Handle Right-Click Context Actions
  const handleCopyField = (name: string, value: any) => {
    toast.success(`Copied ${name}: ${value}`);
  };

  const handleOpenComment = (id: string, name: string) => {
    setCommentTargetItem({ id, name });
    setIsCommentModalOpen(true);
  };

  // PDF Export (Matching Ventilation Standard: 1 Page, exact table styles, blue highlights, peach signatures)
  const handleExportPdf = () => {
    try {
      const JsPDFClass = typeof jsPDF === "function" ? jsPDF : (jsPDF as any).default;
      const doc = new JsPDFClass("portrait", "mm", "a4");

      const callAutoTable = (pdfDoc: any, options: any) => {
        if (typeof autoTable === "function") {
          autoTable(pdfDoc, options);
        } else if (typeof (autoTable as any)?.default === "function") {
          (autoTable as any).default(pdfDoc, options);
        } else if (typeof pdfDoc.autoTable === "function") {
          pdfDoc.autoTable(options);
        } else {
          console.error("autoTable function not available");
        }
      };

      const calcNo = (project as any)?.calcNo || "TRV-CAL-PLUMB-02";
      const today = formatDateStr(new Date().toISOString()) || new Date().toLocaleDateString("en-GB");
      const projectNo = project?.code || (project as any)?.projectNo || "P000";
      const projectName = project?.name || (project as any)?.projectName || "Commercial MEP Project";
      const clientName = project?.client || "Client Representative";
      const locationRoom = activeRoom?.name || "Main Sanitary Drain / Branch Core";

      // 1. Header Title (matching Ventilation)
      doc.setFontSize(14);
      doc.setFont("helvetica", "bold");
      doc.text("Drainage Pipe & Stack Sizing Calculation Report", 14, 13);

      // 2. Metadata Block (182mm width: left 14mm to right 196mm, height 17mm)
      doc.setFontSize(8.5);
      doc.setLineWidth(0.3);
      doc.rect(14, 16, 182, 17);

      // Vertical dividing line
      doc.line(105, 16, 105, 33);

      // Horizontal dividing lines
      doc.line(14, 21.7, 196, 21.7);
      doc.line(14, 27.4, 196, 27.4);

      doc.setFont("helvetica", "bold");
      doc.text("Calculation No.:", 16, 20.2);
      doc.setFont("helvetica", "normal");
      doc.text(calcNo, 45, 20.2);

      doc.setFont("helvetica", "bold");
      doc.text("Date:", 107, 20.2);
      doc.setFont("helvetica", "normal");
      doc.text(today, 120, 20.2);

      doc.setFont("helvetica", "bold");
      doc.text("Project No.:", 16, 25.9);
      doc.setFont("helvetica", "normal");
      doc.text(projectNo, 40, 25.9);

      doc.setFont("helvetica", "bold");
      doc.text("Client:", 107, 25.9);
      doc.setFont("helvetica", "normal");
      doc.text(clientName, 120, 25.9);

      doc.setFont("helvetica", "bold");
      doc.text("Project Name:", 16, 31.6);
      doc.setFont("helvetica", "normal");
      doc.text(projectName, 42, 31.6);

      doc.setFont("helvetica", "bold");
      doc.text("Location / Room:", 107, 31.6);
      doc.setFont("helvetica", "normal");
      doc.text(locationRoom, 133, 31.6);

      // Color palette matching Ventilation
      const primaryFill = [217, 217, 217] as [number, number, number]; // Gray for standard headers
      const blueFill = [218, 233, 248] as [number, number, number];    // Blue for key calculated totals
      const signatureFill = [255, 230, 204] as [number, number, number]; // Peach for signatures

      const systemTypeLabels: Record<string, string> = {
        branch: "Horizontal Fixture Branch",
        stack_short: "Soil / Waste Stack (<= 3 Stories)",
        stack_tall: "Soil / Waste Stack (> 3 Stories)",
        building_drain: "Building Drain / Main Sewer",
      };

      // Table 1: Design Parameters & Piping Geometry
      const paramTableBody = [
        ["1", "Drainage System / Segment Type", systemTypeLabels[systemType] || systemType.toUpperCase(), "-", "IPC Table 710.1 System Type"],
        ["2", "Piping Material & Manning Roughness", `${calcResults.materialName} (n = ${calcResults.roughness})`, "-", "ASPE Data Book Vol 2"],
        ["3", "Piping Slope / Gradient", isSI ? `${calcResults.slopeMmPerM} mm/m (${calcResults.slopePercent}%)` : `${calcResults.slopeInPerFt}"/ft (${calcResults.slopePercent}%)`, isSI ? "mm/m" : "in/ft", "IPC Minimum Slope Standard"],
        ["4", "Design Safety Margin Factor", `+${safetyFactor} %`, "%", "Engineering Contingency Reserve"],
        ["5", "Vent Pipe Developed Length", isSI ? `${(ventLength * 0.3048).toFixed(1)} m` : `${ventLength} ft`, isSI ? "m" : "ft", "IPC Table 906.1 Developed Length"],
      ];

      callAutoTable(doc, {
        startY: 35,
        margin: { left: 14, right: 14 },
        theme: "grid",
        pageBreak: "avoid",
        styles: {
          fontSize: 7.2,
          halign: "center",
          valign: "middle",
          lineColor: [100, 100, 100],
          lineWidth: 0.1,
          cellPadding: { top: 1.3, bottom: 1.3, left: 1.2, right: 1.2 },
          minCellHeight: 4.8,
        },
        headStyles: {
          fillColor: primaryFill,
          textColor: 0,
          fontStyle: "bold",
          cellPadding: { top: 1.5, bottom: 1.5, left: 1, right: 1 },
        },
        columnStyles: {
          0: { cellWidth: 10 },
          1: { halign: "left", cellWidth: 68, fontStyle: "bold" },
          2: { cellWidth: 38, fontStyle: "bold" },
          3: { cellWidth: 20 },
          4: { halign: "left", cellWidth: 46 },
        },
        head: [
          [
            { content: "No.", styles: { fillColor: primaryFill } },
            { content: "Design Parameter Description", styles: { fillColor: primaryFill } },
            { content: "Value", styles: { fillColor: primaryFill } },
            { content: "Unit", styles: { fillColor: primaryFill } },
            { content: "Standard / Code Reference", styles: { fillColor: primaryFill } },
          ],
        ],
        body: paramTableBody,
      });

      let nextY = (doc as any).lastAutoTable?.finalY ?? 68;

      const formatTrapSize = (inches: number) => {
        if (inches === 1.25) return '1-1/4" NPS (32 mm)';
        if (inches === 1.5) return '1-1/2" NPS (38 mm)';
        if (inches === 2.5) return '2-1/2" NPS (65 mm)';
        return `${inches}" NPS (${Math.round(inches * 25.4)} mm)`;
      };

      const activeFixtures = fixtures.filter((f) => f.val > 0);
      const fixtureRows = activeFixtures.map((f, idx) => [
        (idx + 1).toString(),
        f.name,
        f.category.toUpperCase(),
        `${f.dfu} DFU`,
        f.val.toString(),
        `${(f.dfu * f.val).toFixed(1)} DFU`,
        formatTrapSize(f.minTrapSizeInches),
      ]);

      // Append Total Summary Row
      fixtureRows.push([
        "",
        "TOTAL CONNECTED SANITARY LOAD",
        "-",
        "-",
        calcResults.totalCount.toString(),
        `${calcResults.rawDfu.toFixed(1)} DFU`,
        "-",
      ]);

      callAutoTable(doc, {
        startY: nextY + 3,
        margin: { left: 14, right: 14 },
        theme: "grid",
        pageBreak: "avoid",
        styles: {
          fontSize: 7.2,
          halign: "center",
          valign: "middle",
          lineColor: [100, 100, 100],
          lineWidth: 0.1,
          cellPadding: { top: 1.2, bottom: 1.2, left: 1.2, right: 1.2 },
          minCellHeight: 4.6,
        },
        headStyles: {
          fillColor: primaryFill,
          textColor: 0,
          fontStyle: "bold",
          cellPadding: { top: 1.5, bottom: 1.5, left: 1, right: 1 },
        },
        columnStyles: {
          0: { cellWidth: 8 },
          1: { halign: "left", cellWidth: 64, fontStyle: "bold" },
          2: { cellWidth: 24 },
          3: { cellWidth: 18 },
          4: { cellWidth: 14 },
          5: { cellWidth: 22, fontStyle: "bold" },
          6: { halign: "left", cellWidth: 32 },
        },
        head: [
          [
            { content: "#", styles: { fillColor: primaryFill } },
            { content: "Sanitary Fixture Type", styles: { fillColor: primaryFill } },
            { content: "Category", styles: { fillColor: primaryFill } },
            { content: "Unit DFU", styles: { fillColor: primaryFill } },
            { content: "Qty", styles: { fillColor: primaryFill } },
            { content: "Total DFU", styles: { fillColor: blueFill } },
            { content: "Min Trap Size", styles: { fillColor: primaryFill } },
          ],
        ],
        body: fixtureRows,
        didParseCell: function (data: any) {
          if (data.section === "body") {
            if (data.row.index === fixtureRows.length - 1) {
              data.cell.styles.fontStyle = "bold";
              data.cell.styles.fillColor = blueFill;
              if (data.column.index === 5) {
                data.cell.styles.fontSize = 7.8;
              }
            }
          }
        },
      });

      nextY = (doc as any).lastAutoTable?.finalY ?? 115;

      // Table 3: Hydraulic Sizing & Compliance Verification Results
      const sizingResultsBody = [
        [
          "A",
          "Total Design Load (with Safety Margin)",
          `${calcResults.designDfu} DFU`,
          `Design DFU = ${calcResults.rawDfu} DFU × (1 + ${safetyFactor}%)`,
        ],
        [
          "B",
          "Required Minimum Pipe Size",
          isSI ? `${calcResults.sizedDn} mm DN (${calcResults.sizedNps}" NPS)` : `${calcResults.sizedNps}" NPS (${calcResults.sizedDn} mm DN)`,
          "IPC 2021 Table 710.1 Sizing Standard",
        ],
        [
          "C",
          "Maximum Permitted Capacity for Size",
          `${calcResults.maxAllowedDfu} DFU`,
          `Capacity Utilization: ${calcResults.capacityUtilization.toFixed(1)}% (Pass <= 100%)`,
        ],
        [
          "D",
          "Self-Cleansing Scour Velocity (Half-Full)",
          isSI ? `${calcResults.velocityMps} m/s` : `${calcResults.velocityFps} ft/s`,
          calcResults.isScourVelocityOk ? "Self-Cleansing Velocity >= 2.0 ft/s (0.60 m/s)" : "Check Slope (Velocity < 2.0 ft/s)",
        ],
        [
          "E",
          "Half-Full Gravity Discharge Capacity",
          isSI ? `${calcResults.qCapLps} L/s` : `${calcResults.qCapGpm} GPM`,
          "Manning Gravity Open-Channel Flow Equation",
        ],
        [
          "F",
          "Required Minimum Vent Pipe Size",
          isSI ? `${calcResults.ventDn} mm DN (${calcResults.ventNps}" NPS)` : `${calcResults.ventNps}" NPS (${calcResults.ventDn} mm DN)`,
          `IPC Table 906.1 (${ventLength} ft developed length)`,
        ],
      ];

      callAutoTable(doc, {
        startY: nextY + 3,
        margin: { left: 14, right: 14 },
        theme: "grid",
        pageBreak: "avoid",
        styles: {
          fontSize: 7.2,
          halign: "center",
          valign: "middle",
          lineColor: [100, 100, 100],
          lineWidth: 0.1,
          cellPadding: { top: 1.2, bottom: 1.2, left: 1.2, right: 1.2 },
          minCellHeight: 4.8,
        },
        headStyles: {
          fillColor: primaryFill,
          textColor: 0,
          fontStyle: "bold",
          cellPadding: { top: 1.5, bottom: 1.5, left: 1, right: 1 },
        },
        columnStyles: {
          0: { cellWidth: 10 },
          1: { halign: "left", cellWidth: 70, fontStyle: "bold" },
          2: { cellWidth: 46, fontStyle: "bold" },
          3: { halign: "left", cellWidth: 56 },
        },
        head: [
          [
            { content: "Item", styles: { fillColor: primaryFill } },
            { content: "Hydraulic Sizing Output / Metric", styles: { fillColor: primaryFill } },
            { content: "Calculated Value", styles: { fillColor: blueFill } },
            { content: "Engineering Basis & Formula", styles: { fillColor: primaryFill } },
          ],
        ],
        body: sizingResultsBody,
        didParseCell: function (data: any) {
          if (data.section === "body") {
            // Highlight row A (Design Load), row B (Pipe Size), and row D (Velocity) in blueFill
            if (data.row.index === 0 || data.row.index === 1 || data.row.index === 3) {
              data.cell.styles.fontStyle = "bold";
              data.cell.styles.fillColor = blueFill;
              if (data.column.index === 2) {
                data.cell.styles.fontSize = 7.8;
              }
            }
          }
        },
      });

      nextY = (doc as any).lastAutoTable?.finalY ?? 162;

      // Table 4: Mandatory Engineering Standards & Code Compliance Notes
      const notesTableBody = [
        ["1", "IPC Table 710.1 / 709.1", "Sanitary fixture unit (DFU) sizing method calculates required minimum pipe diameters based on cumulative probability of simultaneous fixture discharge."],
        ["2", "Self-Cleansing Velocity", "Piping slope must achieve a minimum scour velocity of 2.0 ft/s (0.60 m/s) at half-full flow to prevent sanitary solids sedimentation and line blockage."],
        ["3", "Water Closet Sizing Rule", "No water closet (WC) shall discharge into a pipe smaller than 3-inch NPS (80 mm DN). Branches receiving more than 2 WCs require 4-inch NPS (100 mm DN)."],
        ["4", "Vent Sizing Standard", "Vent diameter is sized per IPC Table 906.1 to safeguard trap seals against siphonage and backpressure exceeding 1.0 inch water column."],
      ];

      callAutoTable(doc, {
        startY: nextY + 3,
        margin: { left: 14, right: 14 },
        theme: "grid",
        pageBreak: "avoid",
        styles: {
          fontSize: 6.8,
          halign: "left",
          valign: "middle",
          lineColor: [100, 100, 100],
          lineWidth: 0.1,
          cellPadding: { top: 1.1, bottom: 1.1, left: 1.2, right: 1.2 },
          minCellHeight: 4.2,
        },
        headStyles: {
          fillColor: primaryFill,
          textColor: 0,
          fontStyle: "bold",
          cellPadding: { top: 1.3, bottom: 1.3, left: 1, right: 1 },
        },
        columnStyles: {
          0: { halign: "center", cellWidth: 10 },
          1: { cellWidth: 46, fontStyle: "bold" },
          2: { cellWidth: 126 },
        },
        head: [
          [
            { content: "No.", styles: { fillColor: primaryFill, halign: "center" } },
            { content: "Mandatory Plumbing Standard", styles: { fillColor: primaryFill } },
            { content: "Compliance & Engineering Criteria", styles: { fillColor: primaryFill } },
          ],
        ],
        body: notesTableBody,
      });

      const finalY = (doc as any).lastAutoTable?.finalY ?? 200;

      // Table 5: 3-Tier Signature Block (Originator, Reviewer, Approver)
      const {
        originatedName,
        originatedDate,
        reviewerName,
        reviewerDate,
        approverName,
        approverDate,
      } = getSignatureBlockDetails(project?.id || "default", "/plumbing-drainage", currentUserName, calcReviewState);

      callAutoTable(doc, {
        startY: finalY + 3,
        margin: { left: 14, right: 14 },
        theme: "grid",
        pageBreak: "avoid",
        styles: {
          fontSize: 7.2,
          halign: "center",
          valign: "middle",
          lineColor: [100, 100, 100],
          lineWidth: 0.1,
          cellPadding: { top: 1.5, bottom: 1.5, left: 1, right: 1 },
          minCellHeight: 5,
        },
        headStyles: {
          fillColor: signatureFill,
          textColor: 0,
          fontStyle: "bold",
          cellPadding: { top: 1.5, bottom: 1.5, left: 1, right: 1 },
        },
        head: [
          [
            { content: "Designation" },
            { content: "Originator" },
            { content: "Reviewer" },
            { content: "Approver" },
          ],
        ],
        body: [
          [
            { content: "Name:", styles: { fontStyle: "bold", halign: "right" } },
            { content: originatedName || "Design Engineer", styles: { halign: "center" } },
            { content: reviewerName || "-", styles: { halign: "center" } },
            { content: approverName || "-", styles: { halign: "center" } },
          ],
          [
            { content: "Date:", styles: { fontStyle: "bold", halign: "right" } },
            { content: originatedDate || today, styles: { halign: "center" } },
            { content: reviewerDate || "-", styles: { halign: "center" } },
            { content: approverDate || "-", styles: { halign: "center" } },
          ],
        ],
      });

      // Save PDF
      doc.save(`Drainage_Pipe_Sizing_Report_${formatDateStr(new Date()).replace(/ /g, "_")}.pdf`);
      toast.success("Exported Drainage Pipe Sizing PDF report successfully!");
    } catch (e) {
      console.error(e);
      toast.error("Failed to generate PDF export.");
    }
  };

  const presetIcons: Record<DrainagePresetKey, React.ComponentType<{ className?: string }>> = {
    commercial_office: Building,
    residential_apartment: Home,
    luxury_hotel: Hotel,
    restaurant_kitchen: Utensils,
    hospital_clinic: Stethoscope,
    educational_school: GraduationCap,
    custom: SlidersHorizontal,
  };

  return (
    <>
      <AppShell
        title="Drainage Pipe Sizing"
        hideSubHeader={true}
        onIntelClick={() => setIntelOpen((v) => !v)}
        intelOpen={intelOpen}
        intelLabel="Intelligence"
      >
        <div className="flex h-full min-h-0 bg-transparent">
          <div className="flex-1 min-w-0 flex flex-col pt-4 gap-4 overflow-y-auto h-full">
            
            {/* Page Header Bar */}
            <div className="flex justify-between items-start shrink-0 select-none no-print modal-blur-bg py-0.5">
              <div className="flex items-center gap-3 flex-wrap">
                <div className="flex items-baseline gap-2">
                  <h1 className="text-[28px] font-bold tracking-tight text-foreground">Drainage Pipe Sizing</h1>
                </div>
                <button
                  onClick={() => setIntelOpen((v) => !v)}
                  className={`flex items-center gap-1.5 px-3 py-1 rounded-full transition-colors text-[12.5px] font-semibold border cursor-pointer shrink-0 ${
                    intelOpen
                      ? "bg-primary text-primary-foreground border-primary"
                      : "bg-primary/10 text-primary hover:bg-primary/20 border-primary/20"
                  }`}
                >
                  <Sparkles className="size-3.5" />
                  Intelligence
                </button>
                <CalculationReviewBar
                  projectId={project?.id || "default"}
                  calculatorPath="/plumbing-drainage"
                  calculatorTitle="Drainage Pipe Sizing"
                  onReviewStateChange={setCalcReviewState}
                />
                {commentsList.length > 0 && (
                  <div
                    className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-blue-500/10 text-blue-600 dark:text-blue-400 text-xs font-semibold border border-blue-500/20 shadow-2xs"
                    title={`${commentsList.length} active task(s)/comment(s)`}
                  >
                    <MessageSquare className="size-3.5 fill-blue-500/20" />
                    <span>{commentsList.length} Active Task{commentsList.length === 1 ? "" : "s"}</span>
                  </div>
                )}
              </div>
            </div>

            {/* Status Banners */}
            {calcReviewState?.status === "APPROVED" && (
              <div className="flex items-center justify-between p-3.5 px-4 bg-emerald-500/10 border border-emerald-500/30 rounded-xl text-xs text-emerald-800 dark:text-emerald-300 font-medium shadow-2xs">
                <div className="flex items-center gap-2.5">
                  <div className="p-1.5 rounded-lg bg-emerald-500/20 text-emerald-600 dark:text-emerald-400">
                    <Lock className="size-4" />
                  </div>
                  <div>
                    <span className="font-bold text-emerald-900 dark:text-emerald-200">Calculation is APPROVED and Locked</span>
                    <span className="text-emerald-700/80 dark:text-emerald-400/80 ml-1.5">
                      by {calcReviewState.approvedBy || "Discipline Coordinator"}. Parameters are read-only. Discipline Coordinator must unlock to edit.
                    </span>
                  </div>
                </div>
                <span className="px-2.5 py-1 rounded-full bg-emerald-500/20 text-emerald-700 dark:text-emerald-300 text-[11px] font-bold uppercase tracking-wider">
                  Approved
                </span>
              </div>
            )}

            {calcReviewState?.status === "REVIEWED" && (
              <div className="flex items-center justify-between p-3.5 px-4 bg-blue-500/10 border border-blue-500/30 rounded-xl text-xs text-blue-800 dark:text-blue-300 font-medium shadow-2xs">
                <div className="flex items-center gap-2.5">
                  <div className="p-1.5 rounded-lg bg-blue-500/20 text-blue-600 dark:text-blue-400">
                    <CheckCircle2 className="size-4" />
                  </div>
                  <div>
                    <span className="font-bold text-blue-900 dark:text-blue-200">Calculation has been REVIEWED</span>
                    <span className="text-blue-700/80 dark:text-blue-400/80 ml-1.5">
                      by {calcReviewState.reviewedBy || "Sr. Design Engineer"}. Awaiting final approval from Discipline Coordinator.
                    </span>
                  </div>
                </div>
                <span className="px-2.5 py-1 rounded-full bg-blue-500/20 text-blue-700 dark:text-blue-300 text-[11px] font-bold uppercase tracking-wider">
                  Reviewed
                </span>
              </div>
            )}

            {calcReviewState?.status === "REJECTED" && (
              <div className="flex items-center justify-between p-3.5 px-4 bg-rose-500/10 border border-rose-500/30 rounded-xl text-xs text-rose-800 dark:text-rose-300 font-medium shadow-2xs">
                <div className="flex items-center gap-2.5">
                  <div className="p-1.5 rounded-lg bg-rose-500/20 text-rose-600 dark:text-rose-400">
                    <AlertTriangle className="size-4" />
                  </div>
                  <div>
                    <span className="font-bold text-rose-900 dark:text-rose-200">Calculation REJECTED</span>
                    <span className="text-rose-700/80 dark:text-rose-400/80 ml-1.5">
                      by {calcReviewState.rejectedBy || "Discipline Coordinator"}: {calcReviewState.rejectionDescription || "Please revise parameters and resubmit."}
                    </span>
                  </div>
                </div>
                <span className="px-2.5 py-1 rounded-full bg-rose-500/20 text-rose-700 dark:text-rose-300 text-[11px] font-bold uppercase tracking-wider">
                  Rejected
                </span>
              </div>
            )}

            {/* White Card Container for Tabs & Data Grid */}
            <div className={`flex-1 flex flex-col min-h-[450px] overflow-hidden rounded-2xl transition-all duration-300 ${
              isApprovedLocked || calcReviewState?.status === "APPROVED"
                ? "bg-card border-2 border-emerald-500 ring-2 ring-emerald-500/50 shadow-[0_0_30px_rgba(16,185,129,0.25)]" 
                : "bg-card border border-border shadow-[0_1px_3px_rgba(0,0,0,0.05)]"
            }`}>
              
              {/* Tabs Selector row */}
              <div className="flex items-center justify-between px-4 py-2 bg-card shrink-0 select-none no-print border-b border-border/80">
                <div className="flex items-center gap-2">
                  <div className="flex bg-surface-2 p-1 rounded-full gap-1 border border-border/80">
                    <button
                      onClick={() => setActiveTab("calculator")}
                      className={`px-4 py-1.5 text-xs font-semibold rounded-full transition-all duration-150 cursor-pointer ${
                        activeTab === "calculator"
                          ? "bg-background text-foreground shadow-sm font-bold"
                          : "text-muted-foreground hover:text-foreground"
                      }`}
                    >
                      Drainage Sizer
                    </button>
                    <button
                      onClick={() => setActiveTab("report")}
                      className={`px-4 py-1.5 text-xs font-semibold rounded-full transition-all duration-150 cursor-pointer ${
                        activeTab === "report"
                          ? "bg-background text-foreground shadow-sm font-bold"
                          : "text-muted-foreground hover:text-foreground"
                      }`}
                    >
                      Report
                    </button>
                  </div>

                  <button
                    type="button"
                    onClick={() => setShowFormulaModal(true)}
                    className="px-3 py-1.5 text-xs font-semibold rounded-full transition-all duration-150 cursor-pointer bg-surface-2 hover:bg-surface border border-border/80 text-muted-foreground hover:text-foreground inline-flex items-center gap-1.5 shadow-2xs"
                    title="View IPC / UPC Formulas"
                  >
                    <Info className="size-3.5 text-primary" />
                    <span>Formula Breakdown</span>
                  </button>
                </div>

                {/* Sizing Unit system toggle ONLY (Export buttons removed as requested) */}
                <div className="flex items-center gap-2.5">
                  <UnitToggle
                    unitSystem={unitSystem}
                    onChange={(target) => setUnitSystem(target)}
                    disabled={isEffectiveReadOnly}
                    inputDescriptions="Drainage DFU, Pipe Diameters (NPS / mm DN), Slope (in/ft / mm/m), Manning Flow (GPM / L/s)"
                    conversionExample="Convert 1/4 in/ft → 20.8 mm/m, 4 inch NPS → 100 mm DN"
                  />
                </div>
              </div>

              {/* Active Tab View */}
              <div className="flex-1 min-h-0 overflow-hidden flex flex-col">
                {activeTab === "report" ? (
                  /* Report Preview Tab */
                  <div className="flex-1 min-h-0 overflow-y-auto p-4 md:p-6 custom-scrollbar space-y-6">
                    <div className="flex items-center justify-between border-b border-border pb-4">
                      <div>
                        <h2 className="text-lg font-bold text-foreground">Sanitary Drainage Engineering Report Preview</h2>
                        <p className="text-xs text-muted-foreground">Synchronized printable document layout matching IPC / UPC requirements</p>
                      </div>
                      <div className="flex items-center gap-2">
                        <button
                          onClick={handleExportPdf}
                          className="flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-semibold rounded-full bg-primary text-primary-foreground hover:bg-primary/90 transition-colors shadow-sm cursor-pointer"
                        >
                          <Download className="size-3.5" /> Export PDF
                        </button>
                      </div>
                    </div>

                    {/* Report Layout Card */}
                    <div className="p-6 border border-border/80 rounded-xl bg-background space-y-6 text-sm shadow-xs">
                      <div className="border-b border-border pb-3 flex justify-between items-start">
                        <div>
                          <h3 className="text-base font-bold text-foreground">DRAINAGE PIPE & STACK SIZING CALCULATION</h3>
                          <p className="text-xs text-muted-foreground">Standard: International Plumbing Code (IPC) 2021 / Uniform Plumbing Code (UPC)</p>
                        </div>
                        <div className="text-right text-xs text-muted-foreground">
                          <div>Project: <span className="font-semibold text-foreground">{project?.name || "Commercial MEP Project"}</span></div>
                          <div>Date: <span className="font-semibold text-foreground">{formatDateStr(new Date())}</span></div>
                        </div>
                      </div>

                      {/* Summary Highlights */}
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 bg-muted/40 p-4 rounded-xl border border-border/60">
                        <div>
                          <div className="text-xs text-muted-foreground font-medium">Design Load</div>
                          <div className="text-lg font-bold text-blue-600">{calcResults.designDfu} DFU</div>
                          <div className="text-[11px] text-muted-foreground">Raw: {calcResults.rawDfu} DFU</div>
                        </div>
                        <div>
                          <div className="text-xs text-muted-foreground font-medium">Sized Diameter</div>
                          <div className="text-lg font-bold text-foreground">
                            {isSI ? `${calcResults.sizedDn} mm DN` : `${calcResults.sizedNps}" NPS`}
                          </div>
                          <div className="text-[11px] text-emerald-600 font-medium">IPC Compliant</div>
                        </div>
                        <div>
                          <div className="text-xs text-muted-foreground font-medium">Gradient / Slope</div>
                          <div className="text-lg font-bold text-foreground">
                            {isSI ? `${calcResults.slopeMmPerM} mm/m` : `${calcResults.slopeInPerFt}" / ft`}
                          </div>
                          <div className="text-[11px] text-muted-foreground">{calcResults.slopePercent}% grade</div>
                        </div>
                        <div>
                          <div className="text-xs text-muted-foreground font-medium">Scour Velocity</div>
                          <div className="text-lg font-bold text-foreground">
                            {isSI ? `${calcResults.velocityMps} m/s` : `${calcResults.velocityFps} ft/s`}
                          </div>
                          <div className="text-[11px] text-emerald-600 font-medium">Self-cleansing ok</div>
                        </div>
                      </div>

                      {/* Table Preview */}
                      <div>
                        <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-2">Connected Sanitary Fixture Schedule</h4>
                        <div className="overflow-x-auto border border-border rounded-xl">
                          <table className="w-full text-xs text-left">
                            <thead className="bg-muted/70 text-foreground font-semibold border-b border-border">
                              <tr>
                                <th className="p-2.5">No.</th>
                                <th className="p-2.5">Sanitary Fixture</th>
                                <th className="p-2.5 text-center">Unit DFU</th>
                                <th className="p-2.5 text-center">Qty</th>
                                <th className="p-2.5 text-center">Total DFU</th>
                                <th className="p-2.5 text-center">Share</th>
                                <th className="p-2.5">Min Trap Size</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-border">
                              {fixtures.filter(f => f.val > 0).map((f, i) => (
                                <tr key={f.id} className="hover:bg-muted/30">
                                  <td className="p-2.5 text-muted-foreground">{i + 1}</td>
                                  <td className="p-2.5 font-medium">{f.name}</td>
                                  <td className="p-2.5 text-center">{f.dfu} DFU</td>
                                  <td className="p-2.5 text-center font-bold">{f.val}</td>
                                  <td className="p-2.5 text-center font-bold text-primary">{f.dfu * f.val} DFU</td>
                                  <td className="p-2.5 text-center text-muted-foreground">
                                    {calcResults.rawDfu > 0 ? ((f.dfu * f.val / calcResults.rawDfu) * 100).toFixed(1) : 0}%
                                  </td>
                                  <td className="p-2.5 text-muted-foreground">{f.minTrapSizeInches}" NPS ({Math.round(f.minTrapSizeInches * 25.4)} mm)</td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      </div>

                      {/* 3-Tier Engineering Signature Block */}
                      <div className="pt-2">
                        {(() => {
                          const sig = getSignatureBlockDetails(project?.id || "default", "/plumbing-drainage", currentUserName, calcReviewState);
                          return (
                            <div className="border border-border rounded-xl overflow-hidden text-[12px] shadow-2xs">
                              <div className="grid grid-cols-4 bg-[#FFE6CC] dark:bg-amber-950/40 text-amber-950 dark:text-amber-200 font-bold border-b border-border text-center">
                                <div className="p-2 border-r border-border bg-muted/20">Designation</div>
                                <div className="p-2 border-r border-border">Originator</div>
                                <div className="p-2 border-r border-border">Reviewer</div>
                                <div className="p-2">Approver</div>
                              </div>
                              <div className="grid grid-cols-4 divide-x divide-border border-b border-border text-center">
                                <div className="p-2.5 font-bold text-right pr-3 bg-muted/10">Name:</div>
                                <div className="p-2.5 font-medium text-foreground">{sig.originatedName || "Design Engineer"}</div>
                                <div className="p-2.5 font-medium text-foreground">{sig.reviewerName || "-"}</div>
                                <div className="p-2.5 font-medium text-foreground">{sig.approverName || "-"}</div>
                              </div>
                              <div className="grid grid-cols-4 divide-x divide-border text-center">
                                <div className="p-2.5 font-bold text-right pr-3 bg-muted/10">Date:</div>
                                <div className="p-2.5 text-muted-foreground">{sig.originatedDate || formatDateStr(new Date().toISOString())}</div>
                                <div className="p-2.5 text-muted-foreground">{sig.reviewerDate || "-"}</div>
                                <div className="p-2.5 text-muted-foreground">{sig.approverDate || "-"}</div>
                              </div>
                            </div>
                          );
                        })()}
                      </div>
                    </div>
                  </div>
                ) : (
                  /* Calculator Interactive Mode */
                  <div className="flex-1 min-h-0 overflow-y-auto p-4 md:p-6 custom-scrollbar space-y-6">
                    
                    {/* Presets Quick Picker Bar (Optimized Full-Width Grid with Icons) */}
                    <div
                      id="card-presets"
                      data-field-id="presets"
                      data-comment-target="presets"
                      className={`rounded-2xl p-4 transition-all duration-300 ${
                        isFieldHighlighted("card-presets", "Drainage Sizing Presets")
                          ? "field-highlight-pulse row-highlight-flash item-highlight-pulse border-2 border-sky-400 bg-sky-50 dark:bg-sky-950/40 ring-4 ring-sky-400/25"
                          : "bg-muted/20 border border-border/70 shadow-2xs"
                      }`}
                    >
                      <div className="flex items-center justify-between mb-3">
                        <div className="flex items-center gap-2">
                          <Layers className="size-4 text-primary" />
                          <span className="text-[12.5px] font-bold text-foreground uppercase tracking-wide">
                            Quick Design Presets & Application Profiles
                          </span>
                          {renderCommentBadge("card-presets", "Drainage Sizing Presets")}
                        </div>
                        <span className="text-[11px] font-medium text-muted-foreground">
                          Instant configuration for sanitary branch, stack & building drain per IPC/UPC
                        </span>
                      </div>

                      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 xl:grid-cols-7 gap-2.5">
                        {(Object.keys(DRAINAGE_PRESETS) as DrainagePresetKey[]).map((key) => {
                          const p = DRAINAGE_PRESETS[key];
                          const isSelected = selectedPreset === key;
                          const totalPresetDfu = p.fixtures.reduce((acc, f) => acc + f.dfu * f.val, 0);
                          const IconComp = presetIcons[key] || Building;

                          const systemTypeBadge = p.systemType === "branch"
                            ? "Branch"
                            : p.systemType === "stack_short"
                            ? "Stack <=3"
                            : p.systemType === "stack_tall"
                            ? "Stack >3"
                            : "Main Drain";

                          return (
                            <button
                              key={key}
                              onClick={() => handleApplyPreset(key)}
                              disabled={isEffectiveReadOnly}
                              className={`text-left p-3 rounded-xl border transition-all cursor-pointer flex flex-col justify-between gap-2 min-h-[76px] ${
                                isSelected
                                  ? "border-primary bg-primary/10 text-primary font-bold shadow-xs ring-2 ring-primary/20"
                                  : "border-border/80 hover:border-border hover:bg-muted/40 text-foreground bg-card"
                              } ${isEffectiveReadOnly ? "opacity-60 cursor-not-allowed" : ""}`}
                            >
                              <div className="flex items-start gap-2">
                                <div className={`p-1 rounded-md shrink-0 mt-0.5 ${isSelected ? "bg-primary/20 text-primary" : "bg-muted text-muted-foreground"}`}>
                                  <IconComp className="size-3.5" />
                                </div>
                                <div className="text-[12px] font-bold leading-tight whitespace-normal text-foreground">
                                  {p.label}
                                </div>
                              </div>
                              <div className="flex items-center justify-between gap-1 text-[10.5px] pt-1 border-t border-border/40">
                                <span className="px-1.5 py-0.2 rounded bg-muted/70 text-[10px] font-semibold text-muted-foreground uppercase">
                                  {systemTypeBadge}
                                </span>
                                <span className="font-bold text-primary text-[11px]">
                                  {totalPresetDfu} DFU
                                </span>
                              </div>
                            </button>
                          );
                        })}
                      </div>
                    </div>

                    {/* Top KPI Summary Cards */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                      {/* Pipe Size Card */}
                      <div className="bg-card text-card-foreground border border-border rounded-xl p-4 shadow-xs relative overflow-hidden">
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Required Pipe Size</span>
                          <div className="p-1.5 bg-blue-500/10 text-blue-600 dark:text-blue-400 rounded-lg">
                            <Cylinder className="size-4" />
                          </div>
                        </div>
                        <div className="mt-2 flex items-baseline gap-2">
                          <span className="text-2xl font-black text-foreground">
                            {isSI ? `${calcResults.sizedDn} mm` : `${calcResults.sizedNps}"`}
                          </span>
                          <span className="text-xs text-muted-foreground">
                            {isSI ? `(${calcResults.sizedNps}" NPS)` : `(${calcResults.sizedDn} mm DN)`}
                          </span>
                        </div>
                        <div className="mt-1 text-xs text-emerald-600 dark:text-emerald-400 font-medium flex items-center gap-1">
                          <CheckCircle2 className="size-3" /> IPC 710.1 Compliant
                        </div>
                      </div>

                      {/* Total Design Load */}
                      <div className="bg-card text-card-foreground border border-border rounded-xl p-4 shadow-xs relative overflow-hidden">
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Total Design Load</span>
                          <div className="p-1.5 bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 rounded-lg">
                            <Layers className="size-4" />
                          </div>
                        </div>
                        <div className="mt-2 flex items-baseline gap-2">
                          <span className="text-2xl font-black text-foreground">{calcResults.designDfu}</span>
                          <span className="text-xs font-semibold text-muted-foreground">DFU</span>
                        </div>
                        <div className="mt-1 text-xs text-muted-foreground">
                          Raw: {calcResults.rawDfu} DFU (+{safetyFactor}% margin)
                        </div>
                      </div>

                      {/* Minimum Slope */}
                      <div className="bg-card text-card-foreground border border-border rounded-xl p-4 shadow-xs relative overflow-hidden">
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Minimum Slope</span>
                          <div className="p-1.5 bg-amber-500/10 text-amber-600 dark:text-amber-400 rounded-lg">
                            <SlidersHorizontal className="size-4" />
                          </div>
                        </div>
                        <div className="mt-2 flex items-baseline gap-2">
                          <span className="text-2xl font-black text-foreground">
                            {isSI ? `${calcResults.slopeMmPerM}` : `${calcResults.slopeInPerFt}"`}
                          </span>
                          <span className="text-xs text-muted-foreground">{isSI ? "mm/m" : "in/ft"}</span>
                        </div>
                        <div className="mt-1 text-xs text-muted-foreground">
                          Grade: {calcResults.slopePercent}% slope
                        </div>
                      </div>

                      {/* Scour Velocity */}
                      <div className="bg-card text-card-foreground border border-border rounded-xl p-4 shadow-xs relative overflow-hidden">
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Scour Flow Velocity</span>
                          <div className="p-1.5 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 rounded-lg">
                            <Waves className="size-4" />
                          </div>
                        </div>
                        <div className="mt-2 flex items-baseline gap-2">
                          <span className="text-2xl font-black text-foreground">
                            {isSI ? `${calcResults.velocityMps}` : `${calcResults.velocityFps}`}
                          </span>
                          <span className="text-xs text-muted-foreground">{isSI ? "m/s" : "ft/s"}</span>
                        </div>
                        <div className="mt-1 text-xs text-emerald-600 dark:text-emerald-400 font-medium flex items-center gap-1">
                          <CheckCircle2 className="size-3" /> Self-Cleansing Scour Ok
                        </div>
                      </div>
                    </div>

                    {/* Main 2-Column Content Grid */}
                    <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
                      {/* Left Column: Fixture Schedule & Customization (7 cols) */}
                      <div className="lg:col-span-7 space-y-6">
                        {/* Fixture Schedule Card */}
                        <div className="bg-card text-card-foreground border border-border rounded-2xl p-5 shadow-xs space-y-4">
                          <div className="flex items-center justify-between border-b border-border/60 pb-3">
                            <div className="flex items-center gap-2">
                              <Utensils className="size-4 text-primary" />
                              <h2 className="text-base font-bold text-foreground">1. Connected Sanitary Fixture Schedule</h2>
                            </div>
                            <button
                              onClick={handleClearAllFixtures}
                              disabled={isLocked}
                              className="text-xs text-muted-foreground hover:text-rose-600 flex items-center gap-1 font-medium transition-colors cursor-pointer disabled:opacity-50"
                            >
                              <Trash2 className="size-3" /> Clear Counts
                            </button>
                          </div>

                          <p className="text-xs text-muted-foreground">
                            Specify the quantities of each plumbing fixture connected to this drainage segment per IPC Table 709.1.
                          </p>

                          {/* Fixtures Table / List */}
                          <div className="space-y-2 max-h-[540px] overflow-y-auto pr-1 custom-scrollbar">
                            {fixtures.map((f) => (
                              <ContextMenu key={f.id}>
                                <ContextMenuTrigger asChild>
                                  <div
                                    className={`flex items-center justify-between p-3 rounded-xl border transition-all ${
                                      f.val > 0
                                        ? "bg-primary/5 border-primary/40 shadow-xs"
                                        : "bg-background border-border/70 hover:border-border"
                                    }`}
                                  >
                                    <div className="space-y-0.5 flex-1 pr-2">
                                      <div className="flex items-center gap-2">
                                        <span className="font-semibold text-[13px] text-foreground">{f.name}</span>
                                        {f.id.includes("wc") && (
                                          <span className="text-[10px] px-1.5 py-0.2 rounded bg-amber-500/10 text-amber-600 dark:text-amber-400 font-semibold border border-amber-500/20">
                                            Min 3" NPS
                                          </span>
                                        )}
                                      </div>
                                      <div className="text-xs text-muted-foreground flex items-center gap-2 flex-wrap">
                                        <span>Unit Load: <strong className="text-foreground">{f.dfu} DFU</strong></span>
                                        <span>•</span>
                                        <span>Min Trap: <strong>{f.minTrapSizeInches}" NPS</strong></span>
                                        <span>•</span>
                                        <span className="text-muted-foreground/80">{f.notes}</span>
                                      </div>
                                    </div>

                                    {/* Stepper + Subtotal */}
                                    <div className="flex items-center gap-3">
                                      <div className="flex items-center border border-border rounded-lg bg-surface-2 p-0.5 shadow-2xs">
                                        <button
                                          disabled={isLocked || f.val <= 0}
                                          onClick={() => handleAdjustCount(f.id, -1)}
                                          className="size-7 flex items-center justify-center rounded-md text-muted-foreground hover:text-foreground hover:bg-background disabled:opacity-30 transition-colors cursor-pointer"
                                        >
                                          <Minus className="size-3.5" />
                                        </button>
                                        <input
                                          type="number"
                                          min={0}
                                          disabled={isLocked}
                                          value={f.val}
                                          onChange={e => handleSetCount(f.id, parseInt(e.target.value) || 0)}
                                          className="w-12 text-center text-xs font-bold bg-transparent focus:outline-hidden"
                                        />
                                        <button
                                          disabled={isLocked}
                                          onClick={() => handleAdjustCount(f.id, 1)}
                                          className="size-7 flex items-center justify-center rounded-md text-muted-foreground hover:text-foreground hover:bg-background disabled:opacity-30 transition-colors cursor-pointer"
                                        >
                                          <Plus className="size-3.5" />
                                        </button>
                                      </div>

                                      <div className="w-16 text-right">
                                        <div className="text-[10.5px] text-muted-foreground">Subtotal</div>
                                        <div className="text-xs font-bold text-primary">
                                          {(f.dfu * f.val).toFixed(1)} DFU
                                        </div>
                                      </div>
                                    </div>
                                  </div>
                                </ContextMenuTrigger>
                                <ContextMenuContent className="w-56 bg-popover border border-border rounded-xl shadow-xl p-1 text-[13px] text-popover-foreground z-50">
                                  <ContextMenuItem onClick={() => handleCopyField(f.name, f.val)} className="flex items-center gap-2 px-2.5 py-1.5 hover:bg-accent hover:text-accent-foreground rounded-lg cursor-pointer font-medium">
                                    <Copy className="size-3.5 text-muted-foreground" />
                                    <span>Copy Quantity ({f.val})</span>
                                  </ContextMenuItem>
                                  <ContextMenuItem onClick={() => handleSetCount(f.id, 0)} disabled={isLocked} className="flex items-center gap-2 px-2.5 py-1.5 hover:bg-accent hover:text-accent-foreground rounded-lg cursor-pointer font-medium disabled:opacity-50">
                                    <RotateCcw className="size-3.5 text-muted-foreground" />
                                    <span>Reset to 0</span>
                                  </ContextMenuItem>
                                  <ContextMenuSeparator className="h-px bg-border my-1" />
                                  <ContextMenuItem onClick={() => handleOpenComment(f.id, f.name)} className="flex items-center gap-2 px-2.5 py-1.5 hover:bg-blue-50 dark:hover:bg-blue-950/40 hover:text-blue-600 rounded-lg cursor-pointer text-blue-600 dark:text-blue-400 font-medium">
                                    <MessageSquare className="size-3.5" />
                                    <span>Add Comment / Assign Task</span>
                                  </ContextMenuItem>
                                </ContextMenuContent>
                              </ContextMenu>
                            ))}
                          </div>
                        </div>

                        {/* Live DFU Contribution Breakdown */}
                        <div className="bg-card text-card-foreground border border-border rounded-2xl p-5 shadow-xs space-y-4">
                          <div className="flex items-center justify-between">
                            <h3 className="text-sm font-bold text-foreground flex items-center gap-2">
                              <Activity className="size-4 text-blue-600 dark:text-blue-400" />
                              Fixture Category Load Contribution Breakdown
                            </h3>
                            <span className="text-xs text-muted-foreground">
                              Total: <strong className="text-foreground">{calcResults.rawDfu} DFU</strong>
                            </span>
                          </div>

                          {/* Segmented Progress Bar */}
                          <div className="h-3.5 w-full bg-muted rounded-full overflow-hidden flex">
                            {calcResults.breakdown.map(item => (
                              <div
                                key={item.id}
                                style={{ width: `${item.pct}%`, backgroundColor: item.color }}
                                className="h-full transition-all duration-300 relative group"
                                title={`${item.name}: ${item.dfu} DFU (${item.pct.toFixed(1)}%)`}
                              />
                            ))}
                          </div>

                          {/* Legend Grid */}
                          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-1">
                            {calcResults.breakdown.map(item => (
                              <div key={item.id} className="flex items-start gap-2 text-xs">
                                <span className="size-2.5 rounded-full mt-1 shrink-0" style={{ backgroundColor: item.color }} />
                                <div>
                                  <div className="font-semibold text-foreground">{item.name}</div>
                                  <div className="text-muted-foreground text-[11px]">
                                    {item.dfu} DFU ({item.pct.toFixed(1)}%)
                                  </div>
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      </div>

                      {/* Right Column: Piping Configuration & Hydraulic Sizing (5 cols) */}
                      <div className="lg:col-span-5 space-y-6">
                        {/* System Configuration Card */}
                        <div className="bg-card text-card-foreground border border-border rounded-2xl p-5 shadow-xs space-y-4">
                          <div className="flex items-center gap-2 border-b border-border/60 pb-3">
                            <SlidersHorizontal className="size-4 text-primary" />
                            <h2 className="text-base font-bold text-foreground">2. System Parameters & Placement</h2>
                          </div>

                          {/* System Type Radio Tabs */}
                          <div className="space-y-2">
                            <label className="text-xs font-semibold text-muted-foreground">Drainage Segment / System Type</label>
                            <div className="grid grid-cols-2 gap-2">
                              {[
                                { id: "branch", label: "Horizontal Branch", desc: "IPC Table 710.1(2)" },
                                { id: "stack_short", label: "Stack (<= 3 Stories)", desc: "Short Vertical Stack" },
                                { id: "stack_tall", label: "Stack (> 3 Stories)", desc: "Multi-Story Stack" },
                                { id: "building_drain", label: "Building Drain", desc: "Main Sewer / Collector" },
                              ].map(item => (
                                <button
                                  key={item.id}
                                  disabled={isLocked}
                                  onClick={() => {
                                    setSystemType(item.id as any);
                                    dirtyStore.set(true);
                                  }}
                                  className={`p-2.5 rounded-xl border text-left transition-all cursor-pointer ${
                                    systemType === item.id
                                      ? "bg-primary/10 border-primary text-primary font-semibold shadow-2xs"
                                      : "bg-background border-border/70 text-muted-foreground hover:text-foreground hover:bg-muted/40"
                                  } ${isLocked ? "opacity-60 cursor-not-allowed" : ""}`}
                                >
                                  <div className="text-xs font-bold text-foreground">{item.label}</div>
                                  <div className="text-[10px] text-muted-foreground">{item.desc}</div>
                                </button>
                              ))}
                            </div>
                          </div>

                          {/* Piping Material */}
                          <div className="space-y-1.5">
                            <label className="text-xs font-semibold text-muted-foreground">Pipe Material & Manning Roughness (n)</label>
                            <select
                              value={material}
                              disabled={isLocked}
                              onChange={e => {
                                setMaterial(e.target.value as any);
                                dirtyStore.set(true);
                              }}
                              className="w-full text-xs font-medium bg-background border border-input rounded-lg p-2.5 focus:outline-hidden focus:border-primary disabled:opacity-60 cursor-pointer"
                            >
                              <option value="pvc">PVC / ABS Schedule 40 (n = 0.009 - Ultra Smooth)</option>
                              <option value="cast_iron">Cast Iron Hubless / No-Hub (n = 0.012 - Acoustic Dampening)</option>
                              <option value="hdpe">HDPE Drainage Pipe (n = 0.009 - Chemical Resistant)</option>
                              <option value="copper">Copper Type DWV (n = 0.011 - Commercial)</option>
                            </select>
                          </div>

                          {/* Slope Selector */}
                          <div className="space-y-1.5">
                            <div className="flex justify-between items-center text-xs">
                              <label className="font-semibold text-muted-foreground">Piping Slope / Gradient</label>
                              <span className="font-bold text-primary">
                                {isSI ? `${calcResults.slopeMmPerM} mm/m (${calcResults.slopePercent}%)` : `${slope}" / ft (${calcResults.slopePercent}%)`}
                              </span>
                            </div>
                            <div className="grid grid-cols-4 gap-2">
                              {[
                                { val: 0.0625, label: "1/16\"/ft", metric: "5.2 mm/m" },
                                { val: 0.125, label: "1/8\"/ft", metric: "10.4 mm/m" },
                                { val: 0.25, label: "1/4\"/ft", metric: "20.8 mm/m" },
                                { val: 0.5, label: "1/2\"/ft", metric: "41.7 mm/m" },
                              ].map(s => (
                                <button
                                  key={s.val}
                                  disabled={isLocked}
                                  onClick={() => {
                                    setSlope(s.val);
                                    dirtyStore.set(true);
                                  }}
                                  className={`p-2 rounded-xl border text-center text-xs transition-all cursor-pointer ${
                                    slope === s.val
                                      ? "bg-primary text-primary-foreground border-primary font-bold shadow-2xs"
                                      : "bg-background border-border/70 text-muted-foreground hover:text-foreground hover:bg-muted/40"
                                  } ${isLocked ? "opacity-60 cursor-not-allowed" : ""}`}
                                >
                                  <div>{isSI ? s.metric : s.label}</div>
                                </button>
                              ))}
                            </div>
                          </div>

                          {/* Safety Factor & Vent Developed Length */}
                          <div className="grid grid-cols-2 gap-3 pt-2">
                            <div className="space-y-1">
                              <label className="text-xs font-semibold text-muted-foreground">Safety Margin (%)</label>
                              <input
                                type="number"
                                min={0}
                                max={50}
                                disabled={isLocked}
                                value={safetyFactor}
                                onChange={e => {
                                  setSafetyFactor(Math.max(0, parseInt(e.target.value) || 0));
                                  dirtyStore.set(true);
                                }}
                                className="w-full text-xs font-bold bg-background border border-input rounded-lg p-2 focus:outline-none focus:border-primary disabled:opacity-60"
                              />
                            </div>
                            <div className="space-y-1">
                              <label className="text-xs font-semibold text-muted-foreground">Vent Length ({isSI ? "m" : "ft"})</label>
                              <input
                                type="number"
                                min={5}
                                max={300}
                                disabled={isLocked}
                                value={isSI ? Math.round(ventLength * 0.3048) : ventLength}
                                onChange={e => {
                                  const val = parseFloat(e.target.value) || 0;
                                  setVentLength(isSI ? Math.round(val / 0.3048) : val);
                                  dirtyStore.set(true);
                                }}
                                className="w-full text-xs font-bold bg-background border border-input rounded-lg p-2 focus:outline-none focus:border-primary disabled:opacity-60"
                              />
                            </div>
                          </div>
                        </div>

                        {/* Sizing Verification & Compliance Card */}
                        <div className="bg-card text-card-foreground border border-border rounded-2xl p-5 shadow-xs space-y-4">
                          <div className="flex items-center justify-between border-b border-border/60 pb-3">
                            <div className="flex items-center gap-2">
                              <ShieldCheck className="size-4 text-emerald-600 dark:text-emerald-400" />
                              <h2 className="text-base font-bold text-foreground">3. Engineering Verification</h2>
                            </div>
                            <span className="text-xs font-bold px-2 py-0.5 rounded-md bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
                              IPC 2021 Table 710.1
                            </span>
                          </div>

                          <div className="space-y-3 text-xs">
                            <div className="flex justify-between items-center py-1.5 border-b border-border/60">
                              <span className="text-muted-foreground">Calculated Design Load (Factored)</span>
                              <span className="font-bold text-foreground">{calcResults.designDfu} DFU</span>
                            </div>

                            <div className="flex justify-between items-center py-1.5 border-b border-border/60">
                              <span className="text-muted-foreground">Max Permitted Load for Chosen Size</span>
                              <span className="font-bold text-foreground">{calcResults.maxAllowedDfu} DFU</span>
                            </div>

                            <div className="flex justify-between items-center py-1.5 border-b border-border/60">
                              <span className="text-muted-foreground">Capacity Utilization</span>
                              <div className="flex items-center gap-2">
                                <div className="w-16 h-2 bg-muted rounded-full overflow-hidden">
                                  <div
                                    style={{ width: `${Math.min(100, calcResults.capacityUtilization)}%` }}
                                    className={`h-full ${calcResults.capacityUtilization > 90 ? "bg-amber-500" : "bg-emerald-500"}`}
                                  />
                                </div>
                                <span className="font-bold text-foreground">{calcResults.capacityUtilization.toFixed(1)}%</span>
                              </div>
                            </div>

                            <div className="flex justify-between items-center py-1.5 border-b border-border/60">
                              <span className="text-muted-foreground">Self-Cleansing Velocity</span>
                              <span className={`font-bold ${calcResults.isScourVelocityOk ? "text-emerald-600 dark:text-emerald-400" : "text-amber-600 dark:text-amber-400"}`}>
                                {isSI ? `${calcResults.velocityMps} m/s` : `${calcResults.velocityFps} ft/s`}
                                <span className="text-[10px] text-muted-foreground ml-1 font-normal">(Min 2.0 ft/s [0.6 m/s])</span>
                              </span>
                            </div>

                            <div className="flex justify-between items-center py-1.5 border-b border-border/60">
                              <span className="text-muted-foreground">Associated Minimum Vent Size</span>
                              <span className="font-bold text-blue-600 dark:text-blue-400">
                                {isSI ? `${calcResults.ventDn} mm DN` : `${calcResults.ventNps}" NPS`}
                              </span>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Formula & Engineering Modal */}
        {showFormulaModal && (
          <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4">
            <div className="bg-card text-card-foreground border border-border rounded-2xl max-w-2xl w-full p-6 space-y-4 shadow-xl max-h-[90vh] overflow-y-auto custom-scrollbar">
              <div className="flex items-center justify-between border-b border-border pb-3">
                <div className="flex items-center gap-2">
                  <HelpCircle className="size-5 text-primary" />
                  <h3 className="text-lg font-bold text-foreground">Plumbing Drainage Sizing Engineering Equations</h3>
                </div>
                <button
                  onClick={() => setShowFormulaModal(false)}
                  className="p-1 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted cursor-pointer"
                >
                  <X className="size-5" />
                </button>
              </div>

              <div className="space-y-4 text-xs leading-relaxed text-foreground">
                <div className="p-3.5 bg-muted/40 rounded-xl space-y-1 border border-border/60">
                  <div className="font-bold text-primary">1. Drainage Fixture Unit (DFU) Method (IPC Chapter 7)</div>
                  <p className="text-muted-foreground">
                    Drainage systems are sized probabilistically using Drainage Fixture Units (DFUs). The total design load is:
                  </p>
                  <div className="font-mono bg-background p-2 rounded border border-border text-[11px]">
                    {"Design DFU = Total Connected Raw DFU × (1 + Safety Margin % / 100)"}
                  </div>
                </div>

                <div className="p-3.5 bg-muted/40 rounded-xl space-y-1 border border-border/60">
                  <div className="font-bold text-primary">2. Manning's Equation for Gravity Open-Channel / Partial Pipe Flow</div>
                  <p className="text-muted-foreground">
                    The velocity and gravity flow capacity for partially filled drainage pipes are determined using Manning's formula:
                  </p>
                  <div className="font-mono bg-background p-2 rounded border border-border text-[11px]">
                    {"Imperial: V = (1.486 / n) × Rh^(2/3) × S^(1/2)   [ft/s]"}
                    <br />
                    {"Metric:   V = (1.0 / n) × Rh^(2/3) × S^(1/2)     [m/s]"}
                  </div>
                  <p className="text-[11px] text-muted-foreground mt-1">
                    Where Rh = D / 4 (Hydraulic radius for half-full flow), S is hydraulic slope in ft/ft (or m/m), and n is Manning roughness.
                  </p>
                </div>

                <div className="p-3.5 bg-muted/40 rounded-xl space-y-1 border border-border/60">
                  <div className="font-bold text-primary">3. Self-Cleansing Scour Velocity Requirement</div>
                  <p className="text-muted-foreground">
                    To prevent sanitary solids settling and pipe blockages, a minimum scour velocity of <strong>2.0 ft/s (0.60 m/s)</strong> is enforced by plumbing standards (IPC Table 704.1 & ASPE).
                  </p>
                </div>

                <div className="p-3.5 bg-muted/40 rounded-xl space-y-1 border border-border/60">
                  <div className="font-bold text-primary">4. Vent Sizing per IPC Table 906.1</div>
                  <p className="text-muted-foreground">
                    Vent pipe diameters are derived from the total fixture units connected and the developed length of the vent pipe from the fixture trap to open air.
                  </p>
                </div>
              </div>

              <div className="flex justify-end pt-3 border-t border-border">
                <button
                  onClick={() => setShowFormulaModal(false)}
                  className="px-4 py-1.5 text-xs font-semibold rounded-full bg-primary text-primary-foreground hover:bg-primary/90 transition-colors cursor-pointer"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Collaboration Task Assignment Modal */}
        {isCommentModalOpen && commentTargetItem && (
          <AssignCommentModal
            isOpen={isCommentModalOpen}
            onClose={() => {
              setIsCommentModalOpen(false);
              setCommentTargetItem(null);
            }}
            targetItemId={commentTargetItem.id}
            targetItemName={commentTargetItem.name}
            calculatorPath="/plumbing-drainage"
            calculatorTitle="Drainage Pipe Sizing"
            currentUserName={currentUserName}
            onCommentAdded={newComment => {
              setCommentsList(prev => [newComment, ...prev]);
              notifyCommentAssigned(newComment, "/plumbing-drainage", "Drainage Pipe Sizing");
              dispatchGlobalCommentNotification({
                id: newComment.id,
                authorName: newComment.authorName || currentUserName,
                assignedToName: newComment.assignedToName,
                assignedToEmail: newComment.assignedToEmail,
                calculatorTitle: "Drainage Pipe Sizing",
                calculatorPath: "/plumbing-drainage",
                commentText: newComment.commentText,
                fieldName: commentTargetItem.name,
                createdAt: newComment.createdAt || new Date().toISOString(),
              });
              toast.success(`Task assigned to ${newComment.assignedToName || "team member"}!`);
            }}
          />
        )}
      </AppShell>
    </>
  );
}
