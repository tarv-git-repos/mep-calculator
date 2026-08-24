# 📜 MEP Calculator — Version Control & Snapshot Restoration Architecture

> [!NOTE]
> This document details the architectural design, data pipelines, sequence diagrams, and schema models for creating, listing, comparing, and restoring historical engineering calculation snapshots (`project_versions`).

---

## 🔁 1. Complete Version Save & Restore Workflow

This flowchart illustrates the end-to-end process when an engineer creates a snapshot of their calculations and restores a previous version.

```mermaid
flowchart TD
    subgraph Client UI ["🖥️ Client Workspace (Vite + React)"]
        ActiveState["Active Engineering Calculation State<br/>(Duct Sizing, Pipe Head, Lux, Fixture Units)"]
        ClickSave["1. Engineer clicks 'Save Version Snapshot'"]
        PromptDetails["2. Input Version Tag (e.g. V1.2) & Revision Notes"]
        ClickRestore["3. Engineer selects Version V1.0 from History"]
        ConfirmRestore{"4. Confirm Overwrite Active Workspace?"}
        UpdateState["5. React State Hydrated with Historical Snapshot Data"]
    end

    subgraph Backend Server ["⚙️ Express Auth Server (Port 4000)"]
        SaveEndpoint["POST /api/versions/save"]
        ListEndpoint["GET /api/versions/list?project=..."]
        AuditLogger["Log Event: SAVE_VERSION / RESTORE_VERSION"]
        LocalFile[("data/project_versions.json")]
    end

    subgraph Supabase Database ["☁️ Supabase Cloud DB"]
        VersionTable[("project_versions Table")]
    end

    ActiveState --> ClickSave
    ClickSave --> PromptDetails
    PromptDetails -->|Payload: { projectName, calcName, version, data }| SaveEndpoint
    
    SaveEndpoint --> AuditLogger
    SaveEndpoint -->|Dual Persistence| LocalFile
    SaveEndpoint -->|Cloud Sync| VersionTable

    ClickRestore --> ListEndpoint
    ListEndpoint -->|Query Filtered Snapshots| VersionTable
    ListEndpoint -->> ClickRestore

    ClickRestore --> ConfirmRestore
    ConfirmRestore -->|Yes| UpdateState
    UpdateState --> ActiveState
```

---

## ⏱️ 2. Version Storage & Restoration Sequence Diagram

This sequence diagram demonstrates the exact API calls, dual-persistence, and state restoration mechanics.

```mermaid
sequenceDiagram
    autonumber
    actor Engineer as 👷 Design Engineer
    participant Client as 🖥️ React Workspace UI
    participant Server as ⚙️ Node Auth Server
    participant LocalDisk as 💾 Local JSON Storage
    participant Supabase as ☁️ Supabase Cloud DB

    Note over Engineer, Supabase: Phase A: Saving a Calculation Version
    Engineer->>Client: Click "Save Version" (Enter "V2.0 - Final Client Submission")
    Client->>Server: POST /api/versions/save { projectName, calculatorName, version, description, data }
    Server->>Server: Attach Timestamp, User ID, and organization_id
    Server->>LocalDisk: Append snapshot to data/project_versions.json
    Server->>Supabase: INSERT INTO project_versions (id, project_name, calc_name, version, data, organization_id)
    Supabase-->>Server: 201 Created
    Server-->>Client: 200 OK (Version V2.0 Saved)
    Client-->>Engineer: Show Success Toast Notification

    Note over Engineer, Supabase: Phase B: Restoring a Historical Version
    Engineer->>Client: Open "Version History Timeline"
    Client->>Server: GET /api/versions/list?project=BuildingA&calculator=DuctSizer
    Server->>Supabase: SELECT * FROM project_versions WHERE project_name = 'BuildingA' AND organization_id = 'org-uuid'
    Supabase-->>Server: Return Snapshot Array [V1.0, V1.1, V2.0]
    Server-->>Client: Render Timeline UI
    Engineer->>Client: Click "Restore V1.0"
    Client->>Client: Replace Active Workspace State with V1.0 Snapshot Data
    Client->>Server: POST /api/projects/update-workspace (Persist Restored State)
    Server-->>Client: 200 OK (Workspace Restored to V1.0)
    Client-->>Engineer: Display Banner: "Restored to Version V1.0"
```

---

## 🗃️ 3. Version Snapshot Database Schema Model

The `project_versions` entity stores full point-in-time calculation snapshots linked to the parent project and organization.

```mermaid
erDiagram
    ORGANIZATIONS ||--o{ PROJECT_VERSIONS : "owns"
    CUSTOM_USERS ||--o{ PROJECT_VERSIONS : "creates"
    PROJECTS ||--o{ PROJECT_VERSIONS : "has_history"

    PROJECT_VERSIONS {
        string id PK "e84890ff-..."
        string project_name "Building A - MEP"
        string calculator_name "Duct Sizer"
        string version "V1.2"
        string description "Updated duct friction factor per ASHRAE 2024"
        string user "John Doe"
        string user_id FK "usr_1787290..."
        uuid organization_id FK "org-uuid-1234"
        jsonb data "{ cfmt: 5000, velocity: 1200, duct_width: 24, duct_height: 12 }"
        timestamptz timestamp "2026-08-24T11:40:00Z"
    }
```

---

## 🛡️ 4. Key Architectural Safeguards

> [!IMPORTANT]
> **Data Loss Protection**: Restoring a historical version automatically creates a rollback snapshot of your current state prior to overwriting, ensuring zero accidental data loss.

> [!TIP]
> **Egress Efficiency**: Version history lists fetch only snapshot headers (`version`, `description`, `timestamp`, `user`). Heavy calculation `data` payloads are transferred only when a specific version is restored.
