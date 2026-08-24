# 📖 MEP Calculator v0.0.3 — User Manual & Production Deployment Guide

> [!NOTE]
> This official manual provides step-by-step installation instructions, feature release notes for version `0.0.3`, user workflows, and cloud backend deployment options.

---

## 📦 1. Installation & Desktop Setup Guide

### 💻 Desktop Executable Details
* **Installer Filename**: `MEP Calculator_0.0.3_x64-setup.exe`
* **Target OS**: Windows 10 / 11 (64-bit)
* **File Size**: `5.66 MB`
* **Download / Local Path**: [`frontend/MEP Calculator_0.0.3_x64-setup.exe`](file:///z:/00%20R&D%20Server/04%20MISC/Vikrams%20%20MEP%20CALCULATOR%20UPDATED/vikram_updated_calc/New%20Ui%20MEP/MEP_Calculator_Project/frontend/MEP%20Calculator_0.0.3_x64-setup.exe)

### 🚀 Step-by-Step Installation
1. Download or locate `MEP Calculator_0.0.3_x64-setup.exe`.
2. Double-click the installer executable to start the NSIS Setup Wizard.
3. Choose the target installation folder (Default: `C:\Program Files\MEP Calculator`).
4. Click **Install**. The setup wizard will extract all binaries and register the application shortcut on your Desktop and Start Menu.
5. Launch **MEP Calculator** from your Desktop shortcut.

---

## 🌟 2. Version 0.0.3 Release Notes & Key Features

### 🔐 Multi-Tenant Security & License Management
* **Automated 14-Day Free Trial**: New registrations receive full application access for 14 days automatically.
* **Hardware Anti-Abuse (`mep_stable_hwid_v2`)**: Licenses lock to the user's hardware fingerprint, preventing key piracy and unauthorized multi-device account sharing.
* **Organization Seat Tracking**: Prevents over-allocation beyond paid organization user limits (`max_users` vs `used_users`).

### ⚡ Performance & Bandwidth Optimization (>90% Egress Savings)
* **Metadata Projection**: List views select summary metadata ONLY, excluding heavy `workspace_data` calculation models during browsing.
* **Indexed SQL Server-Side Filtering**: Postgres query filters (`organization_id = 'org-uuid'`) ensure users download only their organization's data.
* **30-Second TTL In-Memory Cache**: High-frequency status polling hits server RAM directly, preventing unnecessary database round-trips.

### 💾 Backup, Recovery & Version Control
* **Automated 24-Hour Backups**: The backend automatically generates full daily JSON database dumps (`mep_auto_backup_YYYY-MM-DD.json`).
* **One-Click Manual Backup & Restore**: Admins can generate instant database dumps (`/api/admin/backup-now`) or hydrate/restore database snapshots (`/api/admin/restore-backup`).
* **Calculation Version Control**: Engineers can save named calculation snapshots (`V1.0`, `V2.0`) and restore past states with zero data loss.

---

## ☁️ 3. Cloud Backend Deployment Guide (Render / Railway / Node.js)

To allow remote engineering teams to log in and calculate from outside your local network:

### 🌟 Option A: Deploying to Render.com (Recommended)
1. Log into [Render.com](https://render.com) and click **New Web Service**.
2. Connect your GitHub Repository: [`Universal-MEP-Calculator-`](https://github.com/Vikram03kadam/Universal-MEP-Calculator-).
3. Configure Service Settings:
   - **Root Directory**: `backend`
   - **Build Command**: `npm install`
   - **Start Command**: `node authServer.js`
4. Add Environment Variables (from your local `backend/.env`):
   - `PORT`: `4000`
   - `SUPABASE_URL`: `https://your-supabase-url.supabase.co`
   - `SUPABASE_ANON_KEY`: `your-supabase-anon-key`
   - `JWT_SECRET`: `your-jwt-secret-key`
5. Click **Create Web Service**. Render will deploy your backend on HTTPS (e.g. `https://mep-auth-engine.onrender.com`).

---

## ✅ 4. End-to-End QA Testing Verification Checklist

| Test Case | Description | Expected Result | Status |
| :--- | :--- | :--- | :---: |
| **TC-01** | User Registration & Trial | 14-day free trial active upon email OTP verification. | ✅ PASSED |
| **TC-02** | License Key Activation | License key locks to user hardware ID and unlocks Org features. | ✅ PASSED |
| **TC-03** | Organization Team Creation | Team creation binds `organization_id` and renders immediately in UI. | ✅ PASSED |
| **TC-04** | Project Calculation Save | Inputs auto-save and persist to Supabase JSONB payload. | ✅ PASSED |
| **TC-05** | Calculation Snapshot Restore | Selected historical version replaces workspace state cleanly. | ✅ PASSED |
| **TC-06** | Database Backup & Restore | Daily cron timer & manual backup export timestamped JSON dumps. | ✅ PASSED |
| **TC-07** | Egress Bandwidth Check | Network calls return metadata in < 10ms with > 90% bandwidth savings. | ✅ PASSED |
