# 🚀 MEP Calculator — System Architecture & Data Flow Guide

> [!NOTE]
> This document provides an end-to-end technical overview of the MEP Calculator enterprise platform, detailing the system topology, license lifecycle, entity-relationship database schema, multi-tenant security model, and performance/egress optimization strategy.

---

## 📐 1. High-Level System Architecture Topology

The application operates as a hybrid Tauri Desktop / Web Client communicating with an optimized local Node.js Authentication & License Engine, backed by Supabase PostgreSQL Cloud Database storage.

```mermaid
graph TD
    subgraph Client Layer ["🖥️ Client Layer (Desktop / Web)"]
        Tauri["Tauri Native Windows Wrapper (v0.0.3)"]
        ViteUI["Vite + React 18 SPA (Port 8081)"]
        HWID["Hardware Fingerprint Engine (mep_stable_hwid_v2)"]
    end

    subgraph Backend Layer ["⚙️ Local Backend Engine (Port 4000)"]
        AuthServer["Node.js Express / Auth Engine (authServer.js)"]
        UserCache["In-Memory User Cache (30s TTL)"]
        JSONFallback["Local Persistence Fallback (data/*.json)"]
    end

    subgraph Cloud Storage ["☁️ Cloud Infrastructure"]
        SupabaseDB["Supabase PostgreSQL Cloud DB"]
        PostgREST["Supabase PostgREST API"]
    end

    Tauri --> ViteUI
    ViteUI -->|HTTP / REST API| AuthServer
    ViteUI -->|HWID Hash| HWID
    AuthServer -->|30s In-Memory Check| UserCache
    AuthServer -->|Network Failure Fallback| JSONFallback
    AuthServer -->|Indexed SQL Queries| PostgREST
    PostgREST --> SupabaseDB
```

---

## 🔑 2. License Lifecycle & Activation Flow

This diagram illustrates the complete 14-day free trial, license key purchase, Super Admin generation, user activation, hardware binding, and organization auto-display.

```mermaid
sequenceDiagram
    autonumber
    actor User as 👤 Organization User
    actor OrgAdmin as 🏢 Organization Admin
    actor SuperAdmin as 👑 Super Admin (Provider)
    participant Client as 🖥️ MEP App (Client)
    participant Server as ⚙️ Auth Server (Port 4000)
    participant DB as ☁️ Supabase Cloud DB

    Note over User, Client: Phase 1: 14-Day Free Trial
    User->>Client: Sign up / Register account
    Client->>Server: POST /api/auth/register
    Server->>DB: Insert custom_users (subscription_expires = Date.now() + 14 Days)
    Server-->>Client: Verification OTP Sent & Access Granted (Trial Active)

    Note over OrgAdmin, SuperAdmin: Phase 2: License Purchase & Generation
    OrgAdmin->>SuperAdmin: Purchase license for N user seats
    SuperAdmin->>Server: POST /api/admin/licenses/generate
    Server->>DB: Create License (Key: MEP-XXX-YYY-ZZZ, Max Users: N)
    SuperAdmin-->>OrgAdmin: Provide License Key

    Note over User, Server: Phase 3: License Activation & HWID Binding
    User->>Client: Trial expires (14 Days) -> License Popup Appears
    User->>Client: Enter License Key & Submit
    Client->>Server: POST /api/license/activate { license_key, hwid }
    Server->>DB: Validate Key, Bind HWID, Link User to Organization
    Server-->>Client: Success (Org Name Auto-Displayed, License Status: ACTIVE)
```

---

## 🗄️ 3. Complete Database Entity-Relationship Diagram (ERD)

The relational schema ensures strict multi-tenant isolation by anchoring `custom_users`, `teams`, `projects`, and `announcements` to `organizations.id`.

```mermaid
erDiagram
    ORGANIZATIONS ||--o{ CUSTOM_USERS : "contains"
    ORGANIZATIONS ||--o{ TEAMS : "owns"
    ORGANIZATIONS ||--o{ PROJECTS : "owns"
    ORGANIZATIONS ||--o{ ANNOUNCEMENTS : "publishes"
    
    CUSTOM_USERS ||--o{ PROJECTS : "creates"
    CUSTOM_USERS ||--o{ ACTIVITY_LOGS : "logs"
    
    TEAMS ||--o{ TEAM_MEMBERS : "has"
    CUSTOM_USERS ||--o{ TEAM_MEMBERS : "belongs_to"
    
    PROJECTS ||--o{ PROJECT_USERS : "assigned_user"
    CUSTOM_USERS ||--o{ PROJECT_USERS : "member_of"
    
    PROJECTS ||--o{ PROJECT_TEAMS : "assigned_team"
    TEAMS ||--o{ PROJECT_TEAMS : "member_of"

    ORGANIZATIONS {
        uuid id PK
        string name
        string subscription_plan
        int max_users
        int used_users
        string status
        timestamptz created_at
    }

    CUSTOM_USERS {
        string id PK
        string name
        string email
        string password
        string role
        boolean isAccountVerified
        uuid organization_id FK
        string subscription_expires
        jsonb features
        string status
    }

    TEAMS {
        string id PK
        string name
        string created_by FK
        uuid organization_id FK
        timestamptz created_at
    }

    PROJECTS {
        string id PK
        string name
        string code
        string client
        string location
        string status
        string created_by FK
        uuid organization_id FK
        jsonb workspace_data
        timestamptz created_at
        timestamptz last_modified
    }

    TEAM_MEMBERS {
        int id PK
        string team_id FK
        string user_id FK
        timestamptz added_at
    }

    PROJECT_USERS {
        int id PK
        string project_id FK
        string user_id FK
    }

    PROJECT_TEAMS {
        int id PK
        string project_id FK
        string team_id FK
    }

    ANNOUNCEMENTS {
        uuid id PK
        string message
        string type
        boolean is_active
        uuid organization_id FK
        timestamptz created_at
    }

    ACTIVITY_LOGS {
        uuid id PK
        string user_id FK
        string action_type
        jsonb details
        timestamptz created_at
    }
```

---

## 🔒 4. Multi-Tenant Access Control & Security Matrix

Access control enforces role-based permissions (RBAC) across Super Admins, Organization Admins, Senior Design Engineers, Junior Design Engineers, and Viewers.

| Role | Scope | Organization Management | Project Creation & Edit | User Assignment | Log Audit Access |
| :--- | :--- | :---: | :---: | :---: | :---: |
| 👑 **SUPER_ADMIN** | Global System | Full CRUD across all orgs | Full Access | Full Access | Global System Logs |
| 🏢 **ORG_ADMIN** | Single Organization | Manage Org seats & users | Full Access within Org | Assign Org users/teams | Organization Logs |
| 👷 **Sr. Design Engineer** | Organization Projects | View Org settings | Full Create, Edit & Delete | Assign Team Members | Personal Activity Logs |
| 🔧 **Jr. Design Engineer** | Assigned Projects | None | Create & Edit Assigned | Assigned Teams | Personal Activity Logs |
| 👁️ **Viewer** | Assigned Projects | None | Read-Only | None | Read-Only |

---

## ⚡ 5. Egress Optimization & Bandwidth Management

To prevent high Supabase network egress costs, the system uses a three-tier performance optimization strategy:

```mermaid
graph LR
    subgraph Client Request
        Req["GET /api/projects/list"]
    end

    subgraph Optimization Tier 1 ["Tier 1: Column Projection"]
        ProjList["Exclude heavy 'workspace_data' (3D models, drawings)<br/>Select metadata ONLY (id, name, code, status)"]
    end

    subgraph Optimization Tier 2 ["Tier 2: SQL Server-Side Filtering"]
        SQLFilter["WHERE organization_id = 'org-uuid'<br/>OR created_by = 'user-id'"]
    end

    subgraph Optimization Tier 3 ["Tier 3: Node In-Memory Cache"]
        TTLCache["30-Second TTL User Cache<br/>(Serves repeat polling without DB query)"]
    end

    Req --> ProjList
    ProjList --> SQLFilter
    SQLFilter --> TTLCache
    TTLCache -->|95% Egress Reduction| Result["Fast Response (< 10ms)"]
```
