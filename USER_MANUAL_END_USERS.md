# 📘 MEP Calculator — End-User & Organization Operations Manual

> [!NOTE]
> This official manual is designed for **Organization Admins, Senior Design Engineers, Junior Design Engineers, and Viewers**. It provides step-by-step instructions on tab navigation, engineering calculations, role-specific tasks, and license activation.

---

## 🗂️ Table of Contents
1. [🚀 Quick Start & License Activation Guide](#-1-quick-start--license-activation-guide)
2. [🗺️ Application Layout & Tab Navigation](#-2-application-layout--tab-navigation)
3. [⚡ Engineering Calculators Suite (HVAC, Plumbing & Electrical)](#-3-engineering-calculators-suite-hvac-plumbing--electrical)
4. [👥 Role-Based Workflow & Task Matrix](#-4-role-based-workflow--task-matrix)
5. [📑 Generating & Exporting Engineering Reports (PDF & Excel)](#-5-generating--exporting-engineering-reports-pdf--excel)

---

## 🚀 1. Quick Start & License Activation Guide

### 🎁 14-Day Free Trial
When you first register an account, your email receives an OTP verification code. Upon logging in, you automatically receive a **14-Day Free Trial** with unrestricted access to all calculation tools.

---

### 💳 How to Purchase a Pro Plan & Paste License Key

When your 14-day trial expires (or when your organization purchases a Pro License):

```mermaid
flowchart LR
    Step1["1. Purchase License Key from Provider"]
    Step2["2. Org Admin Receives Key (MEP-XXX-YYY)"]
    Step3["3. Click 'Activate License' in Header"]
    Step4["4. Paste Key & Click Submit"]
    Step5["5. Auto-Bind Org Name & Unlock Seats"]

    Step1 --> Step2 --> Step3 --> Step4 --> Step5
```

#### Step-by-Step Activation Instructions:
1. **Locate Your License Key**: Obtain your 16-character license key (format: `MEP-XXXX-XXXX-XXXX`) provided to your organization admin.
2. **Open License Popup**:
   - Click your **Profile Name** or **Settings** icon in the top-right header.
   - Click the purple **"Activate License Key"** button (or wait for the automatic renewal popup).
3. **Paste Key**: Paste your key into the text field.
4. **Click Activate**: Click **"Submit / Activate"**.
5. **Automatic Organization Binding**:
   - Your account is immediately linked to your organization (`organization_id`).
   - Your organization name (e.g. *ABC Engineering Consultants*) automatically displays under your profile.
   - Your license status changes to **ACTIVE**.

---

## 🗺️ 2. Application Layout & Tab Navigation

The MEP Calculator features an intuitive sidebar navigation structure:

| Sidebar Tab | Description & Key Functionality |
| :--- | :--- |
| 📊 **Dashboard** | Overview of active projects, assigned teams, recent activity logs, and system announcements. |
| 📁 **Projects** | Central hub to create new engineering projects, assign team members, and view load schedules. |
| 🧮 **Calculators** | Complete suite of HVAC, Plumbing, Firefighting, and Electrical calculation tools. |
| 👥 **Teams** | Create internal design teams, add engineers to teams, and link teams to specific projects. |
| 🏢 **Organization** | *(Org Admin Only)* Manage paid user seats, view active members, and configure backup paths. |
| ⚙️ **Settings** | Update your user profile, change password, manage shortcuts, and check for software updates. |

---

## ⚡ 3. Engineering Calculators Suite (HVAC, Plumbing & Electrical)

### 🌀 A. HVAC (Heating, Ventilation & Air Conditioning) Tab

| Calculator Name | Where to Click | What it Calculates & Computes |
| :--- | :--- | :--- |
| **Duct Sizer** | *Calculators ➔ HVAC ➔ Duct Sizer* | Calculates equal friction duct dimensions (Width x Height), air velocity (FPM), friction loss per 100 ft, and equivalent round diameter. |
| **Preliminary Cooling Load** | *Calculators ➔ HVAC ➔ Cooling Load* | Estimates total room tonnage (TR), sensible/latent heat gains, and CFM required per sq ft. |
| **Fresh Air Cooling Load** | *Calculators ➔ HVAC ➔ Fresh Air Load* | Computes outdoor air ventilation requirements based on ASHRAE 62.1 occupant density and outdoor air enthalpy. |
| **Refrigerant Pipe Sizing** | *Calculators ➔ HVAC ➔ Refrigerant Sizing* | Sizes suction, discharge, and liquid refrigerant lines for R410A, R32, R134a, and R407C systems. |
| **Diffuser Selector** | *Calculators ➔ HVAC ➔ Diffuser Selector* | Determines supply air grille and diffuser neck sizes, throw distance, and NC noise criteria levels. |
| **Smoke Extract Fan** | *Calculators ➔ HVAC ➔ Smoke Extract* | Calculates smoke extraction exhaust rates (CFM) for atrium and corridor smoke management. |
| **Basement Smoke Calc** | *Calculators ➔ HVAC ➔ Basement Smoke* | Calculates air change rates (ACH) for basement car park ventilation per NBC/BS standards. |
| **Staircase Pressurization** | *Calculators ➔ HVAC ➔ Stair Pressurization* | Calculates fan airflow (CFM) required to maintain positive pressure (50 Pa) across open/closed staircase doors. |
| **Lobby Pressurization** | *Calculators ➔ HVAC ➔ Lobby Pressurization* | Determines pressure differential fan duty for elevator lobbies and fire escape routes. |
| **Condensate Drain Calc** | *Calculators ➔ HVAC ➔ Condensate Drain* | Sizes FCU/AHU condensate drain pipe diameters based on cooling coil latent tonnage. |
| **Psychrometric Chart** | *Calculators ➔ HVAC ➔ Psychrometric* | Plots dry bulb, wet bulb, relative humidity, dew point, enthalpy, and specific volume. |
| **Heating Load** | *Calculators ➔ HVAC ➔ Heating Load* | Calculates winter fabric heat loss (U-value x Area x ΔT) and infiltration heat loss. |
| **Zones & Spaces** | *Calculators ➔ HVAC ➔ Zones* | Groups multiple thermal spaces into conditioned zones for AHU sizing. |

---

### 🚰 B. Plumbing & Firefighting Tab

| Calculator Name | Where to Click | What it Calculates & Computes |
| :--- | :--- | :--- |
| **Water Demand** | *Calculators ➔ Plumbing ➔ Water Demand* | Calculates daily domestic cold water & hot water storage demand (Liters/Day) per capita. |
| **Tank Sizing** | *Calculators ➔ Plumbing ➔ Tank Sizing* | Determines overhead and underground domestic water tank dimensions (Length x Width x Depth). |
| **Sump Pump Sizing** | *Calculators ➔ Plumbing ➔ Sump Pump* | Calculates drainage sump pit volume and pump discharge head/flow rate (GPM & Head Feet). |
| **Sewage Pump Duty** | *Calculators ➔ Plumbing ➔ Sewage Pump* | Sizes sewage lift station pumps and solids-handling impellers. |
| **Loading Unit (BS 6700)** | *Calculators ➔ Plumbing ➔ Loading Unit* | Converts fixture loading units (LU) to peak design flow rate (L/s) using Hunter's Curve. |
| **Fixture Unit (IPC)** | *Calculators ➔ Plumbing ➔ Fixture Unit* | Computes Water Supply Fixture Units (WSFU) and Drainage Fixture Units (DFU) for pipe sizing. |
| **Gas Tank Sizing** | *Calculators ➔ Plumbing ➔ Gas Tank* | Sizes LPG/Natural Gas storage tanks and vaporizers for commercial kitchens. |
| **Hazen-Williams Pipe Loss** | *Calculators ➔ Plumbing ➔ Hazen-Williams* | Computes friction head loss (PSI / 100 ft) for water supply and sprinkler piping. |
| **Sprinkler Density** | *Calculators ➔ Plumbing ➔ Sprinkler Density* | Computes NFPA 13 hazard classification flow density (GPM/sq ft) and remote area coverage. |
| **Sprinkler K-Factor** | *Calculators ➔ Plumbing ➔ K-Factor* | Calculates sprinkler discharge flow $Q = K \cdot \sqrt{P}$ for K-5.6, K-8.0, and K-11.2 heads. |
| **Fire Water Demand** | *Calculators ➔ Plumbing ➔ Fire Water Demand* | Computes total fire protection water storage volume for hydrants and sprinklers. |
| **Fire Tank Duration** | *Calculators ➔ Plumbing ➔ Fire Tank Duration* | Calculates required fire water tank retention time (30, 60, 90, or 120 minutes). |
| **Fire Pump Duty** | *Calculators ➔ Plumbing ➔ Fire Pump* | Determines main electric, diesel standby, and jockey pump flow rate (GPM) and total dynamic head (PSI). |
| **FM200 Fire Suppression** | *Calculators ➔ Plumbing ➔ FM200* | Calculates clean agent FM200 / Novec 1230 gas cylinder quantity for server room fire protection. |

---

### ⚡ C. Electrical Tab

| Calculator Name | Where to Click | What it Calculates & Computes |
| :--- | :--- | :--- |
| **Cable Voltage Drop** | *Calculators ➔ Electrical ➔ Cable Voltage Drop* | Calculates percentage voltage drop (% VD) and selects copper/aluminum cable cross-section (sq mm). |
| **Busbar Voltage Drop** | *Calculators ➔ Electrical ➔ Busbar Voltage Drop* | Computes sandwich busduct voltage drop and current carrying capacity. |
| **Conductor Sizing** | *Calculators ➔ Electrical ➔ Conductor Sizing* | Sizes phase, neutral, and earth conductors based on ambient temperature and grouping derating factors. |
| **Circuit Breaker Sizing** | *Calculators ➔ Electrical ➔ Circuit Breaker* | Selects MCB, MCCB, and ACB trip ratings (Amps) and short circuit withstand ratings (kA). |
| **Transformer Sizing** | *Calculators ➔ Electrical ➔ Transformer Sizing* | Calculates required kVA transformer rating with diversity and 20% future expansion margin. |
| **Generator Sizing** | *Calculators ➔ Electrical ➔ Generator Sizing* | Sizes standby diesel generator kVA / kW rating considering motor step starting kVA. |
| **UPS Sizing** | *Calculators ➔ Electrical ➔ UPS Sizing* | Calculates UPS rating (kVA) and battery bank backup runtime duration (Minutes). |
| **Central Battery Sizing** | *Calculators ➔ Electrical ➔ Central Battery* | Sizes central emergency lighting battery inverter capacity (3-hour backup per emergency code). |
| **Capacitor Bank Sizing** | *Calculators ➔ Electrical ➔ Capacitor Bank* | Computes reactive power (kVAr) required to improve power factor from 0.80 to 0.98. |
| **LPD Calculation** | *Calculators ➔ Electrical ➔ LPD Calc* | Computes Lighting Power Density (Watts / sq m) for ECBC & ASHRAE 90.1 compliance. |
| **Lighting Lux Calculation** | *Calculators ➔ Electrical ➔ Lux Calc* | Calculates number of LED luminaires required using the Lumen / Cavity Ratio method. |
| **Short Circuit Calculation** | *Calculators ➔ Electrical ➔ Short Circuit* | Computes 3-phase symmetrical fault current (kA) at main switchboards (MDB / SMDB). |

---

## 👥 4. Role-Based Workflow & Task Matrix

### 🏢 Organization Admin (`ORG_ADMIN`)
* **Primary Responsibilities**:
  1. **Manage License Seats**: View total available user seats (`max_users`) vs used seats (`used_users`).
  2. **Invite & Manage Staff**: Add design engineers to your organization and grant appropriate roles.
  3. **Configure Backup Paths**: Click *Organization ➔ Backup Settings* to set local (`C:\Backups`) and network server backup paths.
  4. **Create Design Teams**: Go to *Teams ➔ Create Team* to group engineers into discipline teams (HVAC Team, Electrical Team).
  5. **Review Audit Logs**: Click *Dashboard ➔ Activity Logs* to monitor organization activity history.

---

### 👷 Senior Design Engineer (`Sr. Design Engineer`)
* **Primary Responsibilities**:
  1. **Project Creation & Management**: Create new engineering projects, enter client names, and set project codes.
  2. **Assign Engineers & Teams**: Open *Project Modal ➔ Assign Members* to grant Junior Engineers access to specific projects.
  3. **Version Approval**: Review saved calculation snapshots (`V1.0`, `V2.0`) and restore baseline versions if needed.
  4. **Export Master Schedules**: Generate combined MEP load schedules and export full project Excel reports.

---

### 🔧 Junior Design Engineer (`Jr. Design Engineer`)
* **Primary Responsibilities**:
  1. **Perform Day-to-Day Calculations**: Input CFM, GPM, Lux, and Cable parameters into calculator sheets.
  2. **Save Calculation Snapshots**: Click **"Save Version"** in any calculator to store named snapshots (e.g. *V1.0 - Initial HVAC Sizing*).
  3. **Edit Assigned Projects**: Access and update calculation workspaces assigned by Senior Engineers.

---

### 👁️ Viewer (`Viewer`)
* **Primary Responsibilities**:
  1. **Read-Only Inspection**: Inspect project calculations, space parameters, and single-line diagrams.
  2. **Export PDF Reports**: Click **"Export PDF"** to print calculation sheets for client reviews or municipality submission.

---

## 📜 5. How to Save & Restore Calculation Versions (Version Control)

Version Control allows engineers to save named snapshots of their calculation sheets (e.g. *V1.0 - Concept Design*, *V2.0 - Final Client Submission*) and restore any past version with 1 click.

```mermaid
flowchart LR
    Step1["1. Open Calculation Sheet"]
    Step2["2. Click 'Save Version Snapshot'"]
    Step3["3. Enter Tag (V1.0) & Notes"]
    Step4["4. Open Version History"]
    Step5["5. Click 'Restore Version'"]

    Step1 --> Step2 --> Step3 --> Step4 --> Step5
```

### 💾 A. How to Save a Calculation Version Snapshot
1. Open any calculator (e.g., *HVAC Duct Sizer*, *Plumbing Water Demand*, or *Electrical Cable Voltage Drop*).
2. Enter your calculation inputs (CFM, Pipe GPM, Voltage, Cable Length, Lux).
3. Click the purple **"Save Version Snapshot"** button at the top-right of the calculation workspace card.
4. In the Version Popup:
   - **Version Tag**: Enter a version identifier (e.g. `V1.0`, `V1.1`, or `V2.0-Final`).
   - **Revision Description**: Add notes (e.g. *Updated duct friction factor per ASHRAE 2024*).
5. Click **"Save Version"**.
6. The snapshot is saved to local storage (`data/project_versions.json`) AND synchronized to Supabase Cloud DB (`project_versions`).

---

### 🕒 B. How to View Version History & Timeline
1. Inside any calculator workspace, click the **"Version History"** tab (or click **"View History"**).
2. A chronological timeline of all saved calculation snapshots is displayed, showing:
   - **Version Tag** (e.g. `V1.0`, `V1.1`)
   - **Author Name** (e.g. *John Doe - Sr. Design Engineer*)
   - **Timestamp** (e.g. *24 Aug 2026, 11:40 AM*)
   - **Revision Notes** (e.g. *Initial Duct Sizing for Tower A*)

---

### 🔄 C. How to Restore a Historical Version Snapshot
1. Open the **Version History Timeline**.
2. Locate the historical version you want to restore (e.g. `V1.0`).
3. Click the green **"Restore Version"** button next to that version item.
4. Click **"Confirm Restore"** on the confirmation popup.
5. **Instant Hydration**: Your current workspace inputs and calculation outputs immediately revert to the exact parameters of that historical version!
6. A notification banner displays: *"Restored to Version V1.0"*.

---

## 📑 6. Generating & Exporting Engineering Reports (PDF & Excel)

1. **How to Export PDF Reports**:
   - Open any calculator (e.g. *Duct Sizer* or *Cable Voltage Drop*).
   - Complete your calculation inputs.
   - Click the blue **"Export PDF"** button at the top-right of the calculation card.
   - A branded calculation report with company header, input summary, and output results is saved to your downloads.

2. **How to Export Excel Schedules**:
   - Navigate to *Projects ➔ Select Project ➔ Export Load Schedule*.
   - Select desired tabs (HVAC, Plumbing, Electrical).
   - Click **"Export to Excel (.xlsx)"**. An editable multi-sheet workbook will be downloaded.
