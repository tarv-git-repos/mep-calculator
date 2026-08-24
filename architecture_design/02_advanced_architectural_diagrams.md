# 🏛️ Advanced MEP Calculator — Deep-Dive Architectural Diagrams

> [!NOTE]
> This guide provides five detailed, component-level architectural diagrams covering authentication security, calculation state flow, access inheritance, the auto-updater pipeline, and dual-storage resilience.

---

## 🔐 1. Authentication, Session & Hardware Security Flow

This diagram illustrates how user authentication, JWT token signing, Hardware Fingerprint (`mep_stable_hwid_v2`) verification, session revocation, and unverified account auto-cleanup operate.

```mermaid
sequenceDiagram
    autonumber
    actor Client as 🖥️ Tauri Desktop / Browser
    participant AuthAPI as ⚙️ Auth Server (Port 4000)
    participant Cache as 🧠 In-Memory Cache (30s TTL)
    participant DB as ☁️ Supabase Cloud DB

    Note over Client, DB: Step 1: User Login & HWID Binding
    Client->>AuthAPI: POST /api/auth/login { email, password, hwid }
    AuthAPI->>Cache: Check user in cache
    alt Cache Miss
        AuthAPI->>DB: Query custom_users where email = req.email
        DB-->>AuthAPI: User record (Password Hash, HWID, Role)
    end
    AuthAPI->>AuthAPI: Verify bcrypt password & compare HWID
    AuthAPI->>AuthAPI: Generate 7-day JWT Token
    AuthAPI-->>Client: Set HttpOnly Cookie (token) + User Profile

    Note over Client, AuthAPI: Step 2: Request Authentication & Session Check
    Client->>AuthAPI: GET /api/license/status (with JWT + HWID)
    AuthAPI->>AuthAPI: Verify JWT signature & check HWID against stored session
    alt HWID Mismatch (Other Device Attempt)
        AuthAPI-->>Client: 401 Session Revoked / Logged out on other device
    else HWID Valid
        AuthAPI-->>Client: 200 OK (License ACTIVE)
    end

    Note over AuthAPI, DB: Step 3: Background Unverified Ghost Cleanup
    AuthAPI->>AuthAPI: Periodic check for unverified registrations (verifyOtpExpireAt < Date.now())
    AuthAPI->>DB: DELETE FROM custom_users WHERE isAccountVerified = false AND verifyOtpExpireAt < now
```

---

## 🧮 2. Project Calculation Data & State Pipeline

This diagram shows how complex MEP engineering calculations (Duct Sizer, CHW Pump Head, Electrical Cable Drop, Plumbing Fixture Units) flow from the React UI into local state, through the backend, and persist to Supabase JSONB.

```mermaid
graph TD
    subgraph Frontend Client ["🖥️ Frontend Client (Port 8081)"]
        UIInputs["User Calculation Inputs<br/>(Duct CFM, Pipe GPM, Lux, Cable Length)"]
        ZustandStore["Zustand Workspace Store<br/>(Transient Calculation State)"]
        AutoSaveBuffer["Debounced Auto-Save Buffer (1000ms)"]
    end

    subgraph Backend Server ["⚙️ Node Backend Engine (Port 4000)"]
        ValidationEngine["Input & Role Validation"]
        LocalCache["Local JSON Storage<br/>(data/projects.json)"]
    end

    subgraph Supabase Database ["☁️ Supabase Cloud DB"]
        ProjectsTable["projects Table"]
        JSONBField["workspace_data (JSONB Column)"]
    end

    UIInputs -->|State Update| ZustandStore
    ZustandStore -->|Debounce| AutoSaveBuffer
    AutoSaveBuffer -->|POST /api/projects/update-workspace| ValidationEngine
    ValidationEngine -->|Write Primary| ProjectsTable
    ProjectsTable -->|Persist Payload| JSONBField
    ValidationEngine -->|Sync Fallback| LocalCache
```

---

## 👥 3. Team & Project Assignment Access Inheritance

This chart demonstrates how project visibility is dynamically computed based on direct user assignment, team membership, or organization admin privileges.

```mermaid
graph TD
    subgraph User Roles
        SuperAdmin["👑 SUPER_ADMIN"]
        OrgAdmin["🏢 ORG_ADMIN"]
        SrEngineer["👷 Sr. Design Engineer"]
        JrEngineer["🔧 Jr. Design Engineer"]
    end

    subgraph Access Rules Engine ["⚙️ Access Rules Engine (projects/list)"]
        Rule1{"Is SUPER_ADMIN?"}
        Rule2{"Matches organization_id?"}
        Rule3{"Is Project Creator (created_by)?"}
        Rule4{"Assigned in project_users?"}
        Rule5{"Belongs to team in project_teams?"}
    end

    subgraph Project Visibility Results
        FullAccess["✅ Full Access to All Projects"]
        OrgAccess["✅ Access to All Org Projects"]
        AssignedAccess["✅ Access to Assigned Project"]
        Denied["❌ Access Denied"]
    end

    SuperAdmin --> Rule1
    Rule1 -->|Yes| FullAccess
    Rule1 -->|No| OrgAdmin
    OrgAdmin --> Rule2
    Rule2 -->|Yes| OrgAccess
    Rule2 -->|No| SrEngineer
    SrEngineer --> Rule3
    Rule3 -->|Yes| AssignedAccess
    Rule3 -->|No| JrEngineer
    JrEngineer --> Rule4
    Rule4 -->|Yes| AssignedAccess
    Rule4 -->|No| Rule5
    Rule5 -->|Yes| AssignedAccess
    Rule5 -->|No| Denied
```

---

## 🚀 4. Auto-Updater & Build Deployment Pipeline

This diagram shows how the Tauri desktop executable (`MEP Calculator_0.0.3_x64-setup.exe`) is compiled, packaged with NSIS, and checked against `update.json` for seamless desktop releases.

```mermaid
flowchart TD
    subgraph Build Phase ["📦 Build Phase (npm run tauri:full)"]
        ViteBuild["1. Vite Production Build"]
        NitroBuild["2. Nitro Server Bundle (dist-nitro-2)"]
        CSRPatch["3. Tauri CSR Patch (createRoot injection)"]
        CargoBuild["4. Cargo Rust Release Build (v0.0.3)"]
        NSISPackage["5. NSIS Installer Generator"]
        ExecOutput["MEP Calculator_0.0.3_x64-setup.exe (5.66 MB)"]
    end

    subgraph Update Check ["🌐 Client Auto-Update Check"]
        AppStart["App Launch (v0.0.3)"]
        FetchManifest["Fetch public/update.json"]
        CompareVersion{"Is update.json version > CURRENT_VERSION?"}
        ShowModal["Show Update Notification Modal"]
        NoAction["No Modal (App Up-to-Date)"]
    end

    ViteBuild --> NitroBuild
    NitroBuild --> CSRPatch
    CSRPatch --> CargoBuild
    CargoBuild --> NSISPackage
    NSISPackage --> ExecOutput

    AppStart --> FetchManifest
    FetchManifest --> CompareVersion
    CompareVersion -->|Yes (e.g. 0.0.4 > 0.0.3)| ShowModal
    CompareVersion -->|No (0.0.3 == 0.0.3)| NoAction
```

---

## 🛡️ 5. Dual-Storage Resilience & Fallback Topology

This diagram details the high-availability architecture ensuring zero data loss if network connectivity drops or network-share file locks occur.

```mermaid
graph TD
    subgraph Request Processing
        Req["API Write Request (Create/Update Project or User)"]
    end

    subgraph Primary Storage ["Primary Engine: Supabase Cloud"]
        CloudDB[("Supabase PostgreSQL DB")]
        CloudCheck{"Cloud Write Success?"}
    end

    subgraph Secondary Storage ["Secondary Engine: Local Persistence"]
        LocalFile[("backend/data/*.json")]
        LocalWrite["Write to Local JSON File"]
    end

    subgraph Recovery System ["Background Sync & Cache Invalidation"]
        InvalidateCache["Invalidate 30s User Cache"]
        LogActivity["Log Activity (activity_logs.json)"]
    end

    Req --> CloudDB
    CloudDB --> CloudCheck
    CloudCheck -->|Yes| InvalidateCache
    CloudCheck -->|No / Network Error| LocalWrite
    LocalWrite --> LogActivity
    InvalidateCache --> LogActivity
```
