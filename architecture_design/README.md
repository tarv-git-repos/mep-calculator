# 🏛️ MEP Calculator — Master Architecture & Systems Documentation

Welcome to the central repository of architectural designs, data flow charts, database models, security matrices, and subsystem specifications for the MEP Calculator system.

---

## 📚 Architectural Guides Index

### 1. [01_system_architecture_overview.md](./01_system_architecture_overview.md)
* **High-Level System Topology**: Hybrid Tauri / React Client ↔ Node.js Local Auth Engine ↔ Supabase Cloud DB.
* **License Lifecycle Flow**: 14-day trial, license key generation, HWID binding, and org auto-display.
* **Complete Database ERD Diagram**: Relational models for organizations, custom_users, 	eams, projects, nnouncements, ctivity_logs, and junction tables.
* **Multi-Tenant Security Matrix**: Role-Based Access Control (RBAC) permissions.
* **Egress Optimization Strategy**: 3-tier bandwidth reduction architecture (>90% egress savings).

### 2. [02_advanced_architectural_diagrams.md](./02_advanced_architectural_diagrams.md)
* **Authentication, Session & HWID Security**: JWT signing, HTTP-only cookie, HWID hardware anti-abuse, and ghost account cleanup.
* **Project Calculation Data & State Pipeline**: Debounced Zustand state updates to Supabase JSONB payload.
* **Team & Project Access Inheritance**: Access decision tree for assigned vs. organization-wide projects.
* **Auto-Updater & Build Deployment Pipeline**: Tauri NSIS setup builder (MEP Calculator_0.0.3_x64-setup.exe) & update manifest check.
* **Dual-Storage Resilience Topology**: Cloud database primary with local JSON fallback (data/*.json).

### 3. [03_version_control_architecture.md](./03_version_control_architecture.md)
* **Version Save & Restore Workflow**: Flowchart for saving calculation snapshots and restoring past revisions.
* **Sequence Diagram**: Snapshot tag creation (V1.0, V2.0), local disk + Supabase cloud sync, and React state hydration.
* **project_versions Schema Model**: Entity relationship schema for calculation snapshots.

### 4. [04_complete_system_subsystems_architecture.md](./04_complete_system_subsystems_architecture.md)
* **Automated Database Backup Engine**: 24-hour automated backup timer, manual dump export, and atomic database restoration.
* **Announcement Broadcasting**: Super Admin / Org Admin publishing & client alert banner streaming.
* **License Seat Pool Control**: Capacity tracking (max_users vs used_users).
* **Hardware Anti-Abuse**: Device fingerprint session revocation.
* **Network-Share File Lock Handlers**: Exponential backoff retry engine for Windows SMB shared drives.
