# 🏰 MEP Calculator — Final Master Subsystem Architecture Diagrams

> [!NOTE]
> This final master guide completes the full architectural documentation suite for the MEP Calculator, covering Automated Database Backups, Announcement Broadcasting, Seat License Pool Management, Hardware Device Anti-Abuse, and Network-Share Lock Resilience.

---

## 💾 1. Automated Database Backup & Cloud Recovery Architecture

This diagram illustrates how automatic daily database backups, local directory exports, and one-click cloud database restoration operate.

```mermaid
flowchart TD
    subgraph Trigger Methods
        ScheduleTimer["🕒 Cron / 24-Hour Timer"]
        AdminManual["👑 Admin Clicks 'Backup Database Now'"]
    end

    subgraph Backup Engine ["⚙️ Backup Engine (authServer.js)"]
        FetchTables["1. Export all tables (custom_users, projects, teams, licenses, announcements)"]
        CreateDump["2. Generate Timestamped JSON Dump (mep_backup_YYYY-MM-DD.json)"]
        LocalWrite["3. Save to Org Local Backup Directory (local_backup_path)"]
        ServerWrite["4. Save to Server Central Backup Directory (server_backup_path)"]
        SupabaseSync["5. Persist Backup Record to Supabase"]
    end

    subgraph Restore Flow ["🔄 One-Click Restore Engine"]
        SelectBackup["Admin Selects Backup File"]
        ValidateSchema["Validate Schema Integrity & Hashes"]
        AtomicRestore["Atomic Database Hydration"]
        SuccessMsg["Database Restored & Cache Invalidated"]
    end

    ScheduleTimer --> FetchTables
    AdminManual --> FetchTables
    FetchTables --> CreateDump
    CreateDump --> LocalWrite
    CreateDump --> ServerWrite
    CreateDump --> SupabaseSync

    SelectBackup --> ValidateSchema
    ValidateSchema --> AtomicRestore
    AtomicRestore --> SuccessMsg
```

---

## 📢 2. Global & Organization Announcement Broadcasting Architecture

This diagram shows how Super Admins and Org Admins publish real-time system alerts, maintenance notices, and organization notifications.

```mermaid
sequenceDiagram
    autonumber
    actor Admin as 👑 Admin / 🏢 Org Admin
    participant Server as ⚙️ Auth Server (Port 4000)
    participant DB as ☁️ Supabase Cloud DB
    actor User as 👤 Engineer Client UI

    Admin->>Server: POST /api/announcements/create { message, type, organization_id }
    Server->>DB: INSERT INTO announcements (id, message, type, is_active, organization_id)
    DB-->>Server: 201 Created
    Server-->>Admin: 200 OK (Announcement Broadcasted)

    Note over User, Server: Client Announcement Polling / Stream
    User->>Server: GET /api/announcements/list
    Server->>DB: SELECT * FROM announcements WHERE is_active = true AND (organization_id = user.org OR organization_id IS NULL)
    DB-->>Server: Active Announcements Array
    Server-->>Client Banner: 200 OK
    Client Banner-->>User: Display Toast / Header Banner Alert
```

---

## 🎫 3. License Seat Pool & Organization Capacity Management

This flowchart illustrates how license seats (`max_users` vs `used_users`) are allocated, tracked, and checked whenever a new user joins an organization.

```mermaid
flowchart TD
    UserJoin["User Enters Organization License Key"]
    FetchOrg["Query organizations Table by license_key"]
    CheckSeats{"Is used_users < max_users?"}
    
    AllowJoin["1. Bind custom_users.organization_id = org.id<br/>2. Increment organizations.used_users = used_users + 1<br/>3. Set user.subscription_expires = license expiration"]
    RejectJoin["❌ Reject Activation: 'Organization seat capacity reached (N/N max users). Contact your Admin to upgrade seats.'"]
    
    UserJoin --> FetchOrg
    FetchOrg --> CheckSeats
    CheckSeats -->|Yes (Seat Available)| AllowJoin
    CheckSeats -->|No (Limit Reached)| RejectJoin
```

---

## 🛡️ 4. Hardware Fingerprint Anti-Abuse & Multi-Device Control

This diagram shows how hardware fingerprints (`mep_stable_hwid_v2`) prevent license key leaks and account sharing across unauthorized devices.

```mermaid
sequenceDiagram
    autonumber
    actor Dev1 as 💻 Authorized Device (Device A)
    actor Dev2 as 📱 Unauthorized Device (Device B)
    participant Server as ⚙️ Auth Server
    participant Cache as 🧠 Session Store

    Dev1->>Server: Login & Bind Hardware ID (HWID-DEV-A)
    Server->>Cache: Store Session (User: John, HWID: HWID-DEV-A)
    Server-->>Dev1: Access Granted

    Note over Dev2, Server: Attempting Access from Device B
    Dev2->>Server: Request API Access using copied cookie (HWID-DEV-B)
    Server->>Cache: Compare Request HWID-DEV-B with Active HWID-DEV-A
    Server-->>Dev2: 401 Session Revoked ("Logged out: Account active on another device")
```

---

## 🔄 5. Network-Share File Lock Retry & Resilience Architecture

This diagram shows the automatic retry mechanism that handles Windows SMB network share file locks when running in shared directory environments.

```mermaid
flowchart TD
    BuildReq["Execute Build / File Write Operation"]
    AttemptWrite["Attempt File Sync / Write"]
    CheckError{"Hit Windows Network Lock?"}
    
    WaitRetry["Wait 2000ms & Retry (Attempt N / 5)"]
    Success["Write Completed Successfully"]
    ThrowError["Fail gracefully with error log"]

    BuildReq --> AttemptWrite
    AttemptWrite --> CheckError
    CheckError -->|Yes (Lock Error)| WaitRetry
    WaitRetry --> AttemptWrite
    CheckError -->|No (Clean Write)| Success
    WaitRetry -->|Attempts > 5| ThrowError
```

---

## 📚 Complete Architectural Documentation Index

You now possess the **complete, 100% exhaustive architectural documentation suite** for the MEP Calculator system:

1. 📄 **[`system_architecture_overview.md`](file:///C:/Users/ADMIN/.gemini/antigravity/brain/e84890ff-a93e-4957-a302-1a47fde14d94/system_architecture_overview.md)**: High-Level System Topology, License Flow, Database ERD, Security Matrix, Egress Optimization.
2. 📄 **[`advanced_architectural_diagrams.md`](file:///C:/Users/ADMIN/.gemini/antigravity/brain/e84890ff-a93e-4957-a302-1a47fde14d94/advanced_architectural_diagrams.md)**: Authentication Security, Calculation State Pipeline, Access Inheritance, Auto-Update Packaging, Dual-Storage Topology.
3. 📄 **[`version_control_architecture.md`](file:///C:/Users/ADMIN/.gemini/antigravity/brain/e84890ff-a93e-4957-a302-1a47fde14d94/version_control_architecture.md)**: Version Save & Restoration Sequence, Snapshot Schema, Rollback Safeguards.
4. 📄 **[`complete_system_subsystems_architecture.md`](file:///C:/Users/ADMIN/.gemini/antigravity/brain/e84890ff-a93e-4957-a302-1a47fde14d94/complete_system_subsystems_architecture.md)** *(This File)*: Automated Backups, Announcement Broadcasting, License Seat Pool Control, Hardware Anti-Abuse, Network-Share Lock Handlers.
