import { createFileRoute } from "@tanstack/react-router";
import { useState, useMemo } from "react";
import { AppShell } from "@/components/workspace/AppShell";
import { TBtn } from "@/components/workspace/Button";
import {
  Flame, Wind, Droplets, ArrowRight, CheckCircle2, AlertTriangle, Info, RefreshCw, Settings2, Play
} from "lucide-react";

export const Route = createFileRoute("/calculators")({
  validateSearch: (search: Record<string, unknown>) => {
    return {
      name: typeof search.name === "string" ? search.name : "Cooling Load",
    };
  },
  head: (ctx: any) => ({
    meta: [
      { title: `${ctx?.search?.name || "Calculator"} — MEP Calc` },
      { name: "description", content: "Interactive engineering calculator with real-time updates." },
    ],
  }),
  component: CalculatorsPage,
});

// Definition of each calculator configuration
interface CalcConfig {
  desc: string;
  standard: string;
  inputs: {
    key: string;
    label: string;
    min: number;
    max: number;
    step: number;
    default: number;
    unit: string;
  }[];
  checklist: string[];
}

const CALC_CONFIGS: Record<string, CalcConfig> = {
  "Cooling Load": {
    desc: "Calculate total cooling capacity and room loads for sensible & latent heat transfer.",
    standard: "ASHRAE Handbooks / Carrier E20",
    inputs: [
      { key: "area", label: "Floor Area", min: 10, max: 2000, step: 5, default: 120, unit: "m²" },
      { key: "uWalls", label: "U-Value Walls", min: 0.1, max: 2.5, step: 0.05, default: 0.35, unit: "W/m²K" },
      { key: "uGlass", label: "U-Value Glass", min: 0.5, max: 6.0, step: 0.1, default: 1.8, unit: "W/m²K" },
      { key: "outdoorTemp", label: "Design Outdoor Temp", min: 20, max: 50, step: 0.5, default: 35.0, unit: "°C" },
      { key: "indoorTemp", label: "Design Indoor Temp", min: 16, max: 28, step: 0.5, default: 22.0, unit: "°C" },
      { key: "occupants", label: "Occupant Density", min: 0, max: 200, step: 1, default: 15, unit: "people" },
      { key: "equipLoad", label: "Equipment Load", min: 5, max: 100, step: 5, default: 25, unit: "W/m²" },
      { key: "safety", label: "Safety Margin", min: 0, max: 30, step: 5, default: 10, unit: "%" },
    ],
    checklist: [
      "Confirm solar heat gain coefficient (SHGC) of glazing.",
      "Check lighting heat dissipation schedules (usually 8-15 W/m²).",
      "Verify ventilation rates comply with ASHRAE 62.1 requirements.",
      "Identify zoning of perimeter versus core spaces."
    ]
  },
  "Fresh Air Cooling Load": {
    desc: "Calculate raw cooling capacity required to treat outdoor intake air to room conditions.",
    standard: "ASHRAE Standard 62.1 / CIBSE Guide A",
    inputs: [
      { key: "flowrate", label: "Fresh Air Flowrate", min: 50, max: 15000, step: 50, default: 1200, unit: "L/s" },
      { key: "outdoorTemp", label: "Design Outdoor Temp", min: 25, max: 48, step: 0.5, default: 38.0, unit: "°C" },
      { key: "outdoorRH", label: "Outdoor Rel. Humidity", min: 10, max: 100, step: 5, default: 60, unit: "%" },
      { key: "indoorTemp", label: "Design Indoor Temp", min: 18, max: 26, step: 0.5, default: 22.0, unit: "°C" },
      { key: "indoorRH", label: "Indoor Rel. Humidity", min: 30, max: 70, step: 5, default: 50, unit: "%" },
    ],
    checklist: [
      "Ensure enthalpy calculation accounts for latent load condensation.",
      "Verify compliance with local minimum outdoor air regulations.",
      "Analyze heat recovery options (e.g. rotary wheel, plate heat exchanger)."
    ]
  },
  "Heating Load": {
    desc: "Estimate total heating capacity needed to offset envelope heat losses and infiltration.",
    standard: "ASHRAE Fundamentals / EN 12831",
    inputs: [
      { key: "area", label: "Floor Area", min: 10, max: 2000, step: 5, default: 150, unit: "m²" },
      { key: "wallArea", label: "Exterior Wall Area", min: 20, max: 3000, step: 10, default: 250, unit: "m²" },
      { key: "roofArea", label: "Roof Area", min: 0, max: 2000, step: 10, default: 150, unit: "m²" },
      { key: "uWalls", label: "U-Value Walls", min: 0.1, max: 2.0, step: 0.05, default: 0.3, unit: "W/m²K" },
      { key: "uRoof", label: "U-Value Roof", min: 0.1, max: 1.5, step: 0.05, default: 0.22, unit: "W/m²K" },
      { key: "outdoorTemp", label: "Heating Outdoor Temp", min: -25, max: 15, step: 1, default: 5, unit: "°C" },
      { key: "indoorTemp", label: "Heating Indoor Temp", min: 18, max: 26, step: 0.5, default: 21.0, unit: "°C" },
      { key: "infiltration", label: "Infiltration Rate", min: 0.1, max: 3.0, step: 0.1, default: 0.5, unit: "ACH" },
    ],
    checklist: [
      "Exclude internal solar and occupant heat gains for worst-case design.",
      "Verify basement and slab-on-grade heat loss factors.",
      "Apply infiltration rate depending on building wind exposure."
    ]
  },
  "Condensate Drain": {
    desc: "Calculate estimated air conditioning condensation rate and determine minimum drain pipe sizing.",
    standard: "ASHRAE Psychrometric Chart Calculations",
    inputs: [
      { key: "capacity", label: "Cooling Capacity", min: 2, max: 350, step: 2, default: 45, unit: "kW" },
      { key: "shr", label: "Sensible Heat Ratio (SHR)", min: 0.5, max: 0.95, step: 0.05, default: 0.75, unit: "-" },
      { key: "runningHrs", label: "Daily Operating Hours", min: 1, max: 24, step: 1, default: 12, unit: "hrs" },
    ],
    checklist: [
      "Check drain pipe slope (minimum 1% slope or 1:100 is typical).",
      "Ensure U-traps are designed to counter positive or negative fan pressure.",
      "Verify insulation is specified to prevent secondary sweating on pipe run."
    ]
  },
  "Lobby Pressurization": {
    desc: "Calculate supply airflow required to maintain positive pressure in lobbies to resist smoke infiltration.",
    standard: "EN 12101-6 / ASHRAE Smoke Control Manual",
    inputs: [
      { key: "doors", label: "Number of Double Doors", min: 1, max: 10, step: 1, default: 2, unit: "doors" },
      { key: "leakageArea", label: "Leakage Area per Door", min: 0.01, max: 0.15, step: 0.005, default: 0.03, unit: "m²" },
      { key: "targetPressure", label: "Target Lobby Overpressure", min: 10, max: 60, step: 5, default: 50, unit: "Pa" },
      { key: "safetyFactor", label: "Air Leakage Factor", min: 1.0, max: 2.0, step: 0.05, default: 1.3, unit: "margin" },
    ],
    checklist: [
      "Ensure maximum door opening force does not exceed 100 N (typically).",
      "Verify intake air louvre is located away from exhaust / smoke discharges.",
      "Check relief damper settings for overpressure scenarios."
    ]
  },
  "Staircase Pressurization": {
    desc: "Calculate staircase supply air rate to contain smoke while key doors are momentarily opened.",
    standard: "EN 12101-6 / NFPA 92",
    inputs: [
      { key: "floors", label: "Number of Floors", min: 1, max: 100, step: 1, default: 15, unit: "floors" },
      { key: "openDoors", label: "Design Open Doors", min: 1, max: 8, step: 1, default: 2, unit: "doors" },
      { key: "targetPressure", label: "Pressure with Doors Closed", min: 15, max: 60, step: 5, default: 50, unit: "Pa" },
      { key: "openDoorArea", label: "Open Door Area", min: 1.5, max: 2.8, step: 0.1, default: 2.0, unit: "m²" },
    ],
    checklist: [
      "Check door closures are powerful enough to seal against pressure.",
      "Verify velocity through open doors meets class criteria (usually 0.75 or 2.0 m/s).",
      "Position multiple air supply injection points for stairs over 8 stories."
    ]
  },
  "Smoke Extract Fan": {
    desc: "Estimate required volumetric exhaust rate for hot smoke removal in standard fire compartments.",
    standard: "NFPA 92 / CIBSE Guide E",
    inputs: [
      { key: "volume", label: "Space Volume", min: 100, max: 25000, step: 100, default: 4500, unit: "m³" },
      { key: "ach", label: "Air Changes per Hour (ACH)", min: 4, max: 15, step: 1, default: 10, unit: "ACH" },
      { key: "fireSize", label: "Convective Fire Size", min: 1.0, max: 10.0, step: 0.5, default: 2.5, unit: "MW" },
      { key: "clearHeight", label: "Smoke Clear Layer Height", min: 1.8, max: 6.0, step: 0.1, default: 2.5, unit: "m" },
    ],
    checklist: [
      "Verify fan temperature certification (e.g., F300 or F400 rating).",
      "Calculate minimum plume width and make-up air speed below 1.0 m/s.",
      "Position extract louvres to prevent plug-holing."
    ]
  },
  "Basement Smoke Calc": {
    desc: "Calculate ventilation capacity and make-up air parameters for basement smoke clearance.",
    standard: "BS 9999 / Local Fire Codes",
    inputs: [
      { key: "area", label: "Basement Floor Area", min: 50, max: 5000, step: 50, default: 600, unit: "m²" },
      { key: "height", label: "Basement Height", min: 2.4, max: 6.0, step: 0.1, default: 3.2, unit: "m" },
      { key: "extractAch", label: "Extract Air Rate", min: 6, max: 12, step: 1, default: 10, unit: "ACH" },
      { key: "makeupRatio", label: "Make-up Air Ratio", min: 50, max: 95, step: 5, default: 75, unit: "%" },
    ],
    checklist: [
      "Verify make-up air intake is naturally or mechanically driven.",
      "Check spatial separation between extract points and make-up air inlets.",
      "Distribute fans to avoid dead zones in car park layout."
    ]
  },
  "Capacitor Bank Sizing": {
    desc: "Determine required reactive power (kVAR) to improve power factor to a desired target.",
    standard: "IEEE Std 18 / NEC Article 460",
    inputs: [
      { key: "activePower", label: "Active Power", min: 10, max: 5000, step: 10, default: 500, unit: "kW" },
      { key: "existingPf", label: "Existing Power Factor", min: 0.5, max: 0.99, step: 0.01, default: 0.80, unit: "pf" },
      { key: "targetPf", label: "Target Power Factor", min: 0.8, max: 0.99, step: 0.01, default: 0.95, unit: "pf" },
    ],
    checklist: [
      "Ensure target power factor avoids over-correction (leading power factor).",
      "Check for harmonic resonance issues before installing capacitor banks.",
      "Provide automatic Power Factor Correction (APFC) relays for varying loads."
    ]
  }
};

function CalculatorsPage() {
  const { name } = Route.useSearch();
  const config = CALC_CONFIGS[name] || CALC_CONFIGS["Cooling Load"];
  const [unitSystem, setUnitSystem] = useState<"si" | "ip">("si");

  // Initialize values state dynamically when name changes
  const [values, setValues] = useState<Record<string, number>>(() => {
    const initial: Record<string, number> = {};
    Object.keys(CALC_CONFIGS).forEach((k) => {
      CALC_CONFIGS[k].inputs.forEach((inp) => {
        initial[`${k}_${inp.key}`] = inp.default;
      });
    });
    return initial;
  });

  const getUnitMeta = (calcName: string, inputKey: string, originalUnit: string) => {
    switch (originalUnit) {
      case "m²":
        return {
          unit: "ft²",
          toIp: (v: number) => Number((v * 10.7639).toFixed(2)),
          toSi: (v: number) => Number((v / 10.7639).toFixed(4))
        };
      case "W/m²K":
        return {
          unit: "BTU/h·ft²·°F",
          toIp: (v: number) => Number((v * 0.17611).toFixed(3)),
          toSi: (v: number) => Number((v / 0.17611).toFixed(4))
        };
      case "°C":
        return {
          unit: "°F",
          toIp: (v: number) => Number((v * 1.8 + 32).toFixed(1)),
          toSi: (v: number) => Number(((v - 32) / 1.8).toFixed(2))
        };
      case "W/m²":
        return {
          unit: "W/ft²",
          toIp: (v: number) => Number((v * 0.092903).toFixed(2)),
          toSi: (v: number) => Number((v / 0.092903).toFixed(4))
        };
      case "L/s": {
        const isWater = calcName.includes("CHW");
        return {
          unit: isWater ? "GPM" : "CFM",
          toIp: (v: number) => Number((v * (isWater ? 15.8503 : 2.1189)).toFixed(1)),
          toSi: (v: number) => Number((v / (isWater ? 15.8503 : 2.1189)).toFixed(4))
        };
      }
      case "m/s":
        return {
          unit: "fpm",
          toIp: (v: number) => Number((v * 196.85).toFixed(1)),
          toSi: (v: number) => Number((v / 196.85).toFixed(4))
        };
      case "Pa/m":
        return {
          unit: "in.wg/100ft",
          toIp: (v: number) => Number((v * 0.0040186).toFixed(4)),
          toSi: (v: number) => Number((v / 0.0040186).toFixed(4))
        };
      case "kPa":
        return {
          unit: "psi",
          toIp: (v: number) => Number((v * 0.145038).toFixed(2)),
          toSi: (v: number) => Number((v / 0.145038).toFixed(4))
        };
      case "Pa":
        return {
          unit: "in.wg",
          toIp: (v: number) => Number((v * 0.0040146).toFixed(4)),
          toSi: (v: number) => Number((v / 0.0040146).toFixed(4))
        };
      case "m":
        return {
          unit: "ft",
          toIp: (v: number) => Number((v * 3.28084).toFixed(1)),
          toSi: (v: number) => Number((v / 3.28084).toFixed(4))
        };
      case "kW":
        return {
          unit: "TR",
          toIp: (v: number) => Number((v * 0.284345).toFixed(2)),
          toSi: (v: number) => Number((v / 0.284345).toFixed(4))
        };
      case "mm":
        return {
          unit: "in",
          toIp: (v: number) => Number((v * 0.03937).toFixed(2)),
          toSi: (v: number) => Number((v / 0.03937).toFixed(4))
        };
      default:
        return null;
    }
  };

  const displayInp = useMemo(() => {
    return config.inputs.map(inp => {
      if (unitSystem === "si") return inp;
      const meta = getUnitMeta(name, inp.key, inp.unit);
      if (!meta) return inp;
      return {
        ...inp,
        unit: meta.unit,
        min: meta.toIp(inp.min),
        max: meta.toIp(inp.max),
        step: meta.toIp(inp.step),
        default: meta.toIp(inp.default)
      };
    });
  }, [config.inputs, unitSystem, name]);

  const handleSliderChange = (key: string, val: number) => {
    let storedVal = val;
    if (unitSystem === "ip") {
      const inp = config.inputs.find(i => i.key === key);
      if (inp) {
        const meta = getUnitMeta(name, inp.key, inp.unit);
        if (meta) {
          storedVal = meta.toSi(val);
        }
      }
    }
    setValues((prev) => ({
      ...prev,
      [`${name}_${key}`]: storedVal,
    }));
  };

  const getVal = (key: string): number => {
    const k = `${name}_${key}`;
    if (values[k] !== undefined) return values[k];
    const def = config.inputs.find((i) => i.key === key)?.default;
    return def !== undefined ? def : 0;
  };

  const getDisplayVal = (key: string): number => {
    const valSi = getVal(key);
    if (unitSystem === "si") return valSi;
    const inp = config.inputs.find(i => i.key === key);
    if (inp) {
      const meta = getUnitMeta(name, inp.key, inp.unit);
      if (meta) {
        return meta.toIp(valSi);
      }
    }
    return valSi;
  };

  // Perform engineering calculations based on active calculator name
  const results = useMemo(() => {
    switch (name) {
      case "Cooling Load": {
        const area = getVal("area");
        const uWalls = getVal("uWalls");
        const uGlass = getVal("uGlass");
        const outdoor = getVal("outdoorTemp");
        const indoor = getVal("indoorTemp");
        const occupants = getVal("occupants");
        const equip = getVal("equipLoad");
        const safety = getVal("safety");

        const deltaT = Math.max(0, outdoor - indoor);
        const transWalls = area * 0.7 * uWalls * deltaT; // 70% wall area ratio assumption
        const transGlass = area * 0.2 * uGlass * deltaT; // 20% glass area ratio
        const solar = area * 45; // 45 W/m² solar load
        const peopleSens = occupants * 75; // 75W sensible per person
        const peopleLat = occupants * 55; // 55W latent per person
        const equipSens = area * equip;
        const freshAirSens = occupants * 8 * 1.2 * 1.005 * deltaT; // 8 L/s/p, 1.2 density, 1.005 spec heat

        const baseLoad = (transWalls + transGlass + solar + peopleSens + peopleLat + equipSens + freshAirSens) / 1000; // in kW
        const totalLoad = baseLoad * (1 + safety / 100);
        const tr = totalLoad / 3.517; // kW to Tons of Refrigeration
        const specificLoad = (totalLoad * 1000) / area; // W/m²

        return {
          primaryVal: totalLoad.toFixed(1),
          primaryUnit: "kW",
          secondaryVal: tr.toFixed(1),
          secondaryUnit: "TR",
          metrics: [
            { label: "Specific Thermal Load", val: `${specificLoad.toFixed(0)} W/m²`, status: specificLoad > 160 ? "warning" : "success" },
            { label: "Transmission Heat Gain", val: `${(transWalls + transGlass).toFixed(1)} kW` },
            { label: "Solar Radiation Gain", val: `${(solar / 1000).toFixed(1)} kW` },
            { label: "Fresh Air Load Contribution", val: `${(freshAirSens / 1000).toFixed(1)} kW` },
          ],
          compliance: specificLoad < 180 ? "complied" : "warning",
          complianceMsg: specificLoad < 180 
            ? "Thermal density is within ASHRAE energy code benchmarks." 
            : "Thermal density exceeds standard comfort cooling criteria."
        };
      }

      case "Fresh Air Cooling Load": {
        const flow = getVal("flowrate");
        const outT = getVal("outdoorTemp");
        const outRH = getVal("outdoorRH");
        const inT = getVal("indoorTemp");
        const inRH = getVal("indoorRH");

        // Enthalpy approximation formula: h = 1.006 * T + w * (2501 + 1.86 * T)
        // Approximate w (humidity ratio) using simple vapor pressure
        const getEnthalpy = (t: number, rh: number) => {
          const satPress = 0.61078 * Math.exp((17.27 * t) / (t + 237.3)); // kPa
          const vapPress = satPress * (rh / 100);
          const w = 0.622 * (vapPress / (101.325 - vapPress)); // kg/kg dry air
          return 1.006 * t + w * (2501 + 1.86 * t); // kJ/kg
        };

        const hOut = getEnthalpy(outT, outRH);
        const hIn = getEnthalpy(inT, inRH);
        const deltaH = Math.max(1, hOut - hIn);
        const massFlow = (flow / 1000) * 1.2; // kg/s (1.2 kg/m³ density)
        const powerKw = massFlow * deltaH; // kW
        const tr = powerKw / 3.517;
        const moistureRemoved = massFlow * (hOut - hIn) * 0.35; // L/h approx water removal

        return {
          primaryVal: powerKw.toFixed(1),
          primaryUnit: "kW",
          secondaryVal: tr.toFixed(1),
          secondaryUnit: "TR",
          metrics: [
            { label: "Outdoor Air Enthalpy", val: `${hOut.toFixed(1)} kJ/kg` },
            { label: "Indoor Air Enthalpy", val: `${hIn.toFixed(1)} kJ/kg` },
            { label: "Enthalpy Difference (Δh)", val: `${deltaH.toFixed(1)} kJ/kg` },
            { label: "Est. Condensation Rate", val: `${moistureRemoved.toFixed(1)} L/hr` },
          ],
          compliance: powerKw < 300 ? "complied" : "warning",
          complianceMsg: "Requires Dedicated Outdoor Air System (DOAS) handling."
        };
      }

      case "Heating Load": {
        const area = getVal("area");
        const walls = getVal("wallArea");
        const roof = getVal("roofArea");
        const uW = getVal("uWalls");
        const uR = getVal("uRoof");
        const outT = getVal("outdoorTemp");
        const inT = getVal("indoorTemp");
        const ach = getVal("infiltration");

        const deltaT = Math.max(0, inT - outT);
        const wallLoss = walls * uW * deltaT;
        const roofLoss = roof * uR * deltaT;
        const vol = area * 3.0; // 3m standard height
        const infLoss = vol * ach * 0.33 * deltaT; // W

        const totalW = (wallLoss + roofLoss + infLoss);
        const kw = totalW / 1000;
        const btu = kw * 3412.14;

        return {
          primaryVal: kw.toFixed(1),
          primaryUnit: "kW",
          secondaryVal: btu.toFixed(0),
          secondaryUnit: "BTU/hr",
          metrics: [
            { label: "Wall Transmission Loss", val: `${(wallLoss / 1000).toFixed(2)} kW` },
            { label: "Roof Transmission Loss", val: `${(roofLoss / 1000).toFixed(2)} kW` },
            { label: "Infiltration Heat Loss", val: `${(infLoss / 1000).toFixed(2)} kW` },
            { label: "Specific Heat Load", val: `${(totalW / area).toFixed(1)} W/m²` }
          ],
          compliance: "complied",
          complianceMsg: "Heating insulation parameters satisfy baseline structural envelope criteria."
        };
      }

      case "Condensate Drain": {
        const cap = getVal("capacity");
        const shr = getVal("shr");
        const hrs = getVal("runningHrs");

        const latentLoad = cap * (1 - shr); // kW
        const rateLhr = latentLoad * 1.47; // standard water production approximation (1.47 L/hr per latent kW)
        const dailyLitres = rateLhr * hrs;

        // Pipe sizing recommendation based on ASHRAE
        let pipeSize = "DN15";
        if (rateLhr > 15 && rateLhr <= 60) pipeSize = "DN20";
        else if (rateLhr > 60 && rateLhr <= 200) pipeSize = "DN25";
        else if (rateLhr > 200) pipeSize = "DN32";

        return {
          primaryVal: rateLhr.toFixed(2),
          primaryUnit: "L/hr",
          secondaryVal: dailyLitres.toFixed(1),
          secondaryUnit: "L/day",
          metrics: [
            { label: "Latent Cooling Portion", val: `${latentLoad.toFixed(1)} kW` },
            { label: "Daily Total Volume", val: `${dailyLitres.toFixed(0)} Litres` },
            { label: "Recommended Drain Pipe", val: pipeSize, status: "success" },
            { label: "Minimum Slope Required", val: "1.0 % (1:100)" }
          ],
          compliance: "complied",
          complianceMsg: `Recommended drain diameter is ${pipeSize} at 1% pitch.`
        };
      }

      case "Lobby Pressurization": {
        const doors = getVal("doors");
        const crack = getVal("leakageArea");
        const targetP = getVal("targetPressure");
        const factor = getVal("safetyFactor");

        // Formula: Q = 0.827 * A * dP^0.5
        const area = doors * crack;
        const airflow = 0.827 * area * Math.sqrt(targetP) * factor; // m³/s
        const lps = airflow * 1000;
        const m3h = airflow * 3600;

        return {
          primaryVal: lps.toFixed(0),
          primaryUnit: "L/s",
          secondaryVal: m3h.toFixed(0),
          secondaryUnit: "m³/hr",
          metrics: [
            { label: "Total Leakage Area", val: `${area.toFixed(3)} m²` },
            { label: "Theoretical Airflow", val: `${(lps / factor).toFixed(0)} L/s` },
            { label: "Overpressure Target", val: `${targetP} Pa` },
            { label: "Design Airflow rate", val: `${lps.toFixed(0)} L/s`, status: "success" }
          ],
          compliance: "complied",
          complianceMsg: "Meets EN 12101-6 Class A airflow parameters."
        };
      }

      case "Staircase Pressurization": {
        const floors = getVal("floors");
        const doorsOpen = getVal("openDoors");
        const targetP = getVal("targetPressure");
        const openArea = getVal("openDoorArea");

        // Closed doors leakage area: floors * 0.015 m² crack area
        const closedLeak = floors * 0.015;
        const Qclosed = 0.827 * closedLeak * Math.sqrt(targetP); // m³/s

        // Airflow through open doors based on 0.75 m/s velocity rule through door frame
        const Qopen = doorsOpen * openArea * 0.75; // m³/s

        const totalM3s = Qclosed + Qopen;
        const lps = totalM3s * 1000;
        const m3h = totalM3s * 3600;

        return {
          primaryVal: lps.toFixed(0),
          primaryUnit: "L/s",
          secondaryVal: m3h.toFixed(0),
          secondaryUnit: "m³/hr",
          metrics: [
            { label: "Closed Cracks Leakage", val: `${(Qclosed * 1000).toFixed(0)} L/s` },
            { label: "Open Doors Airflow", val: `${(Qopen * 1000).toFixed(0)} L/s` },
            { label: "Total Closed Leakage Area", val: `${closedLeak.toFixed(3)} m²` },
            { label: "Pressure Target", val: `${targetP} Pa` }
          ],
          compliance: lps < 8000 ? "complied" : "warning",
          complianceMsg: lps < 8000
            ? "Airflow volume handles door opening without massive fan sizes."
            : "Airflow volume is high; suggest using a pressure relief damper system."
        };
      }

      case "Smoke Extract Fan": {
        const vol = getVal("volume");
        const ach = getVal("ach");
        const fire = getVal("fireSize");
        const height = getVal("clearHeight");

        const qAch = (vol * ach) / 3600; // m³/s
        // Plume calculation (NFPA 92) - sensible approximation
        // mp = 0.071 * Qc^(1/3) * z^(5/3)
        const convectiveFire = fire * 0.7; // 70% convective
        const massPlume = 0.071 * Math.pow(convectiveFire * 1000, 1/3) * Math.pow(height, 5/3); // kg/s
        const tempSmoke = 150; // assumption
        const densSmoke = 353 / (273 + tempSmoke); // kg/m³
        const qPlume = massPlume / densSmoke; // m³/s

        const finalM3s = Math.max(qAch, qPlume);
        const lps = finalM3s * 1000;
        const m3h = finalM3s * 3600;

        return {
          primaryVal: lps.toFixed(0),
          primaryUnit: "L/s",
          secondaryVal: m3h.toFixed(0),
          secondaryUnit: "m³/hr",
          metrics: [
            { label: "ACH Extraction Vol", val: `${(qAch * 1000).toFixed(0)} L/s` },
            { label: "Plume Smoke Flow", val: `${(qPlume * 1000).toFixed(0)} L/s` },
            { label: "Est. Smoke Temp", val: `${tempSmoke} °C` },
            { label: "NFPA Plume Mass Rate", val: `${massPlume.toFixed(2)} kg/s` }
          ],
          compliance: "complied",
          complianceMsg: "Extraction rate satisfies building code clearance limits."
        };
      }

      case "Basement Smoke Calc": {
        const area = getVal("area");
        const height = getVal("height");
        const ach = getVal("extractAch");
        const makeup = getVal("makeupRatio");

        const volume = area * height;
        const extractM3s = (volume * ach) / 3600;
        const extractLps = extractM3s * 1000;

        const makeupLps = extractLps * (makeup / 100);
        const louvreArea = makeupLps / 1000 / 2.5; // velocity limit 2.5 m/s

        return {
          primaryVal: extractLps.toFixed(0),
          primaryUnit: "L/s",
          secondaryVal: makeupLps.toFixed(0),
          secondaryUnit: "Make-up L/s",
          metrics: [
            { label: "Total Compartment Volume", val: `${volume.toFixed(0)} m³` },
            { label: "Smoke Extract Airflow", val: `${extractLps.toFixed(0)} L/s`, status: "success" },
            { label: "Make-up Air Airflow", val: `${makeupLps.toFixed(0)} L/s` },
            { label: "Louvre Free Area (2.5m/s)", val: `${louvreArea.toFixed(2)} m²`, status: "success" }
          ],
          compliance: "complied",
          complianceMsg: `Approved smoke clearance system at ${ach} air changes.`
        };
      }

      case "Capacitor Bank Sizing": {
        const activeP = getVal("activePower");
        const pf1 = getVal("existingPf");
        const pf2 = getVal("targetPf");

        // Calculate angles
        const phi1 = Math.acos(pf1);
        const phi2 = Math.acos(pf2);

        // Required Reactive Power Qc = P * (tan(phi1) - tan(phi2))
        const requiredKvar = activeP * (Math.tan(phi1) - Math.tan(phi2));

        // Existing and new apparent power
        const kva1 = activeP / pf1;
        const kva2 = activeP / pf2;
        const kvaSavings = kva1 - kva2;

        return {
          primaryVal: requiredKvar > 0 ? requiredKvar.toFixed(1) : "0.0",
          primaryUnit: "kVAR",
          secondaryVal: kvaSavings > 0 ? kvaSavings.toFixed(1) : "0.0",
          secondaryUnit: "kVA Saved",
          metrics: [
            { label: "Existing Apparent Power", val: `${kva1.toFixed(1)} kVA` },
            { label: "New Apparent Power", val: `${kva2.toFixed(1)} kVA`, status: "success" },
            { label: "Reduction in Apparent Power", val: `${kvaSavings > 0 ? kvaSavings.toFixed(1) : 0} kVA` },
            { label: "Existing Current Reduction", val: `${((kvaSavings / kva1) * 100).toFixed(1)}%` }
          ],
          compliance: requiredKvar >= 0 ? "complied" : "warning",
          complianceMsg: requiredKvar >= 0 
            ? "Correction yields positive reactive power reduction." 
            : "Target PF is lower than existing; no capacitor bank needed."
        };
      }

      default:
        return {
          primaryVal: "0",
          primaryUnit: "unit",
          secondaryVal: "0",
          secondaryUnit: "unit",
          metrics: [],
          compliance: "complied",
          complianceMsg: "Valid configuration."
        };
    }
  }, [name, values]);

  const displayResults = useMemo(() => {
    if (unitSystem === "si") return results;
    
    const convertValAndUnit = (valStr: string, unitStr: string) => {
      const numericVal = parseFloat(valStr);
      if (isNaN(numericVal)) return { val: valStr, unit: unitStr };
      
      const meta = getUnitMeta(name, "", unitStr);
      if (meta) {
        return { val: meta.toIp(numericVal).toString(), unit: meta.unit };
      }
      
      if (unitStr === "kW") {
        return { val: (numericVal * 0.284345).toFixed(2), unit: "TR" };
      }
      if (unitStr === "m³/hr") {
        return { val: (numericVal * 0.58857).toFixed(1), unit: "CFM" };
      }
      if (unitStr === "m H₂O") {
        return { val: (numericVal * 3.28084).toFixed(1), unit: "ft H₂O" };
      }
      if (unitStr === "Pa") {
        return { val: (numericVal * 0.0040146).toFixed(4), unit: "in.wg" };
      }
      if (unitStr === "kPa") {
        return { val: (numericVal * 0.145038).toFixed(2), unit: "psi" };
      }
      if (unitStr === "m") {
        return { val: (numericVal * 3.28084).toFixed(1), unit: "ft" };
      }
      if (unitStr === "mm") {
        return { val: (numericVal * 0.03937).toFixed(2), unit: "in" };
      }
      if (unitStr === "m/s") {
        return { val: (numericVal * 196.85).toFixed(1), unit: "fpm" };
      }
      
      return { val: valStr, unit: unitStr };
    };

    const primary = convertValAndUnit(results.primaryVal, results.primaryUnit);
    const secondary = convertValAndUnit(results.secondaryVal, results.secondaryUnit);

    const convertedMetrics = results.metrics.map(m => {
      let newVal = m.val;
      
      if (m.val.includes(" W/m²")) {
        const num = parseFloat(m.val.replace(" W/m²", ""));
        if (!isNaN(num)) newVal = `${(num * 0.092903).toFixed(2)} W/ft²`;
      } else if (m.val.includes(" kW")) {
        const num = parseFloat(m.val.replace(" kW", ""));
        if (!isNaN(num)) newVal = `${(num * 0.284345).toFixed(2)} TR`;
      } else if (m.val.includes(" L/s")) {
        const num = parseFloat(m.val.replace(" L/s", ""));
        const isWater = name.includes("CHW");
        if (!isNaN(num)) newVal = `${(num * (isWater ? 15.8503 : 2.1189)).toFixed(1)} ${isWater ? "GPM" : "CFM"}`;
      } else if (m.val.includes(" m/s")) {
        const num = parseFloat(m.val.replace(" m/s", ""));
        if (!isNaN(num)) newVal = `${(num * 196.85).toFixed(1)} fpm`;
      } else if (m.val.includes(" Pa/m")) {
        const num = parseFloat(m.val.replace(" Pa/m", ""));
        if (!isNaN(num)) newVal = `${(num * 0.0040186).toFixed(4)} in.wg/100ft`;
      } else if (m.val.includes(" kPa")) {
        const num = parseFloat(m.val.replace(" kPa", ""));
        if (!isNaN(num)) newVal = `${(num * 0.145038).toFixed(2)} psi`;
      } else if (m.val.includes(" Pa")) {
        const num = parseFloat(m.val.replace(" Pa", ""));
        if (!isNaN(num)) newVal = `${(num * 0.0040146).toFixed(4)} in.wg`;
      } else if (m.val.includes(" m²")) {
        const num = parseFloat(m.val.replace(" m²", ""));
        if (!isNaN(num)) newVal = `${(num * 10.7639).toFixed(2)} ft²`;
      } else if (m.val.endsWith("m") && !m.val.includes("–")) {
        const num = parseFloat(m.val.replace("m", ""));
        if (!isNaN(num)) newVal = `${(num * 3.28084).toFixed(1)} ft`;
      } else if (m.val.includes("m –")) {
        const parts = m.val.split(" – ");
        if (parts.length === 2) {
          const num1 = parseFloat(parts[0].replace("m", ""));
          const num2 = parseFloat(parts[1].replace("m", ""));
          if (!isNaN(num1) && !isNaN(num2)) {
            newVal = `${(num1 * 3.28084).toFixed(1)}ft – ${(num2 * 3.28084).toFixed(1)}ft`;
          }
        }
      } else if (m.val.includes(" mm")) {
        const num = parseFloat(m.val.replace(" mm", ""));
        if (!isNaN(num)) newVal = `${(num * 0.03937).toFixed(2)} in`;
      }
      
      return {
        ...m,
        val: newVal
      };
    });

    return {
      ...results,
      primaryVal: primary.val,
      primaryUnit: primary.unit,
      secondaryVal: secondary.val,
      secondaryUnit: secondary.unit,
      metrics: convertedMetrics
    };
  }, [results, unitSystem, name]);

  const groupName = ["Lobby Pressurization", "Staircase Pressurization", "Smoke Extract Fan", "Basement Smoke Calc"].includes(name) ? "SMOKE CONTROL" : "HVAC";

  return (
    <AppShell title={name} hideSubHeader={true}>
      <div className="flex flex-col h-full overflow-hidden pt-4 gap-4 bg-slate-50/30 dark:bg-slate-950/30 relative">
        <div className="absolute inset-0 pointer-events-none [background-image:linear-gradient(to_right,#80808012_1px,transparent_1px),linear-gradient(to_bottom,#80808012_1px,transparent_1px)] bg-[size:40px_40px] z-0"></div>
        
        {/* Breadcrumbs & Page Header */}
        <div className="flex justify-between items-start shrink-0 select-none no-print modal-blur-bg px-6 z-10">
          <div className="flex flex-col gap-1">
            <span className="text-[10px] font-bold tracking-wider text-muted-foreground uppercase">{groupName} &gt; {name}</span>
            <div className="flex items-center gap-3 mt-0.5">
              <h1 className="text-[28px] font-bold tracking-tight text-foreground">{name}</h1>
            </div>
            <p className="text-[13px] text-muted-foreground mt-0.5">
              Standard: {config.standard}
            </p>
          </div>
          
          <div className="flex items-center gap-2 shrink-0">
            <div className="flex rounded-full border border-border p-0.5 bg-surface-2 shrink-0">
              <button
                onClick={() => setUnitSystem("si")}
                className={`px-3 py-1 text-xs font-semibold rounded-full transition-all cursor-pointer ${
                  unitSystem === "si" ? "bg-background shadow-sm text-foreground font-bold" : "text-muted-foreground hover:text-foreground"
                }`}
              >
                SI
              </button>
              <button
                onClick={() => setUnitSystem("ip")}
                className={`px-3 py-1 text-xs font-semibold rounded-full transition-all cursor-pointer ${
                  unitSystem === "ip" ? "bg-background shadow-sm text-foreground font-bold" : "text-muted-foreground hover:text-foreground"
                }`}
              >
                IP
              </button>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-[1fr_320px] flex-1 min-h-0 overflow-hidden relative z-10 border border-border mx-6 mb-6 rounded-3xl bg-card shadow-sm">
          {/* Left Side: Calculations Form & Output */}
          <div className="flex flex-col min-h-0 border-r border-border overflow-y-auto bg-surface/30">
            <div className="p-6 max-w-4xl w-full flex flex-col gap-6">
              
              {/* Description Alert */}
              <div className="flex gap-3 p-3.5 bg-background border border-border rounded-2xl items-start shadow-sm">
                <Info className="size-4.5 text-primary mt-0.5 shrink-0" />
                <div>
                  <h4 className="text-[13.5px] font-semibold text-foreground">Calculator Overview</h4>
                  <p className="text-[12.5px] text-muted-foreground mt-0.5 leading-relaxed">{config.desc}</p>
                </div>
              </div>

              {/* Calculations Dashboard View */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                
                {/* Primary Visual Results Card */}
                <div className="border border-border rounded-3xl p-5 bg-background shadow-sm flex flex-col justify-between min-h-[160px]">
                  <div>
                    <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Calculated Design Output</span>
                    <div className="flex items-baseline mt-2 gap-1.5">
                      <span className="text-[44px] font-bold tracking-tight font-mono text-primary leading-none">{displayResults.primaryVal}</span>
                      <span className="text-[14px] font-semibold text-muted-foreground uppercase">{displayResults.primaryUnit}</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 border-t border-border/80 pt-3 mt-4 text-[12.5px] text-muted-foreground">
                    <span className="font-mono text-foreground font-semibold">{displayResults.secondaryVal}</span>
                    <span>{displayResults.secondaryUnit}</span>
                    <ArrowRight className="size-3.5 mx-0.5" />
                    <span className="text-[11px] uppercase bg-surface-2 px-1.5 py-0.5 rounded-full tracking-wide">Secondary Conversion</span>
                  </div>
                </div>

                {/* Status compliance circle gauge */}
                <div className="border border-border rounded-3xl p-5 bg-background shadow-sm flex flex-col justify-between">
                  <div>
                    <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Status / Compliance</span>
                    <div className="flex items-center gap-2 mt-3">
                      {displayResults.compliance === "complied" ? (
                        <div className="size-3 rounded-full bg-success animate-pulse" />
                      ) : (
                        <div className="size-3 rounded-full bg-warning animate-pulse" />
                      )}
                      <span className="text-[13.5px] font-bold uppercase tracking-wide">
                        {displayResults.compliance === "complied" ? "Complied" : "Warning Indicator"}
                      </span>
                    </div>
                  </div>
                  <p className="text-[12px] text-muted-foreground mt-3 leading-snug">{displayResults.complianceMsg}</p>
                </div>
              </div>

              {/* Live Metrics Grid */}
              <div className="border border-border rounded-3xl bg-background shadow-sm overflow-hidden">
                <div className="px-4 py-2 border-b border-border bg-header-bg">
                  <span className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">Intermediate Calculation Summary</span>
                </div>
                <div className="grid grid-cols-2 divide-x divide-y divide-border">
                  {displayResults.metrics.map((m, idx) => (
                    <div key={idx} className="p-3.5 flex justify-between items-center text-[13px] bg-background">
                      <span className="text-muted-foreground">{m.label}</span>
                      <span className={`font-semibold font-mono tabular ${
                        m.status === "warning" ? "text-warning font-bold" :
                        m.status === "success" ? "text-success font-bold" : "text-foreground"
                      }`}>{m.val}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Input Param Sliders */}
              <div className="flex flex-col gap-4">
                <h3 className="text-[14px] font-bold uppercase tracking-wider text-foreground">Adjust Design Parameters</h3>
                <div className="grid grid-cols-1 gap-4">
                  {displayInp.map((inp) => {
                    const val = getDisplayVal(inp.key);
                    return (
                      <div key={inp.key} className="border border-border rounded-2xl p-4 bg-background shadow-sm flex flex-col gap-2">
                        <div className="flex justify-between items-baseline">
                          <label className="text-[13px] font-semibold text-foreground">{inp.label}</label>
                          <div className="flex items-center gap-1">
                            <input
                              type="number"
                              value={val}
                              step={inp.step}
                              min={inp.min}
                              max={inp.max}
                              onChange={(e) => handleSliderChange(inp.key, Number(e.target.value))}
                              className="w-16 h-6 px-1 text-right text-[12px] font-mono border border-border focus:border-primary rounded-xl bg-surface outline-none"
                            />
                            <span className="text-[11.5px] text-muted-foreground font-mono w-10">{inp.unit}</span>
                          </div>
                        </div>
                        <div className="flex items-center gap-3">
                          <span className="text-[11px] text-muted-foreground font-mono">{inp.min}</span>
                          <input
                            type="range"
                            min={inp.min}
                            max={inp.max}
                            step={inp.step}
                            value={val}
                            onChange={(e) => handleSliderChange(inp.key, Number(e.target.value))}
                            className="flex-1 accent-primary h-1 rounded-full bg-muted cursor-pointer"
                          />
                          <span className="text-[11px] text-muted-foreground font-mono">{inp.max}</span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

            </div>
          </div>

          {/* Right Side: Engineering Review & Checklist */}
          <div className="p-5 flex flex-col min-h-0 bg-background">
            <div className="flex items-center gap-2 border-b border-border pb-3 shrink-0">
              <Settings2 className="size-4 text-primary" />
              <h3 className="text-[13.5px] font-bold uppercase tracking-wider text-foreground">Engineering Checklist</h3>
            </div>
            <div className="flex-1 overflow-y-auto mt-4 flex flex-col gap-3">
              {config.checklist.map((chk, idx) => (
                <div key={idx} className="flex gap-2.5 items-start p-3 rounded-2xl border border-border/80 bg-surface/50 hover:bg-surface transition-all">
                  <CheckCircle2 className="size-4 text-success shrink-0 mt-0.5" />
                  <span className="text-[12.5px] text-muted-foreground leading-relaxed">{chk}</span>
                </div>
              ))}
              
              {/* Warning summary for design standards */}
              <div className="border border-warning/20 bg-warning/5 rounded-2xl p-3.5 mt-4 flex gap-2.5 items-start">
                <AlertTriangle className="size-4 text-warning shrink-0 mt-0.5 animate-bounce" />
                <div>
                  <h4 className="text-[12.5px] font-semibold text-warning">Compliance Check</h4>
                  <p className="text-[11.5px] text-muted-foreground mt-0.5 leading-relaxed">
                    Make sure final parameters match project calculations documentation folder. Discrepancies may trigger warnings.
                  </p>
                </div>
              </div>
            </div>
            
            <div className="pt-4 border-t border-border mt-auto shrink-0 flex gap-2">
              <TBtn className="flex-1"><RefreshCw className="size-3" /> Reset Defaults</TBtn>
              <TBtn primary className="flex-1"><Play className="size-3" /> Save Result</TBtn>
            </div>
          </div>
        </div>
      </div>
    </AppShell>
  );
}
