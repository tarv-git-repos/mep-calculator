# MEP Calculator - Auto-Updater Guide

This guide explains how to release a new version of the MEP Calculator app so that all your users automatically get the update.

## Prerequisites
- You must have your `mep_calc.key` (private key) and the password you used to generate it.
- Your Supabase project must have a public Storage bucket named **`updater`**, with a folder inside named **`releases`**.

## How to Publish a New Update

### Step 1: Bump the Version Number
Before you build, you must tell the app it is a newer version.
1. Open `frontend/src-tauri/tauri.conf.json` and change the `"version"` string (e.g., from `"0.1.0"` to `"0.1.1"`).
2. Open `frontend/package.json` and change the `"version"` string to match.
3. Open `frontend/src-tauri/Cargo.toml` and change the `version` string to match.

### Step 2: Build and Sign the App
Open a PowerShell terminal in your `frontend` folder and run the Tauri build command, providing your private key and password as environment variables.

For Windows PowerShell:
```powershell
$env:TAURI_SIGNING_PRIVATE_KEY="YOUR_ACTUAL_PRIVATE_KEY_STRING_OR_FILE_PATH"
$env:TAURI_SIGNING_PRIVATE_KEY_PASSWORD="YOUR_PASSWORD_HERE"
npm run tauri build
```

*(Note: If you are using the private key file directly, you can set `$env:TAURI_SIGNING_PRIVATE_KEY_PATH="src-tauri\mep_calc.key"` instead of the string).*

### Step 3: Locate the Output Files
Once the build succeeds, Tauri will generate several files in `frontend/src-tauri/target/release/bundle/msi/` (or `/nsis/`).
You need two specific files:
1. The zipped installer: e.g., `MEP Calculator_0.1.1_x64_en-US.msi.zip`
2. The updater manifest: `latest.json` (or `updater.json`) which contains the signature and version info.

### Step 4: Upload to Supabase
1. Go to your Supabase Dashboard -> Storage -> `updater` bucket -> `releases` folder.
2. Inside `releases`, create a folder structure matching your target: `windows-x86_64`.
3. Inside `windows-x86_64`, create a folder for the version: `0.1.1`.
4. Upload the `.zip` installer file into that `0.1.1` folder.
5. Upload the `latest.json` (or `updater.json`) file into the root of the `windows-x86_64` folder.

*(Your `tauri.conf.json` is configured to look at `https://ttqgrcmesxrnujmhesnk.supabase.co/storage/v1/object/public/updater/releases/{{target}}/{{current_version}}`)*

### Step 5: Test It!
Open the older version of your app (e.g., v0.1.0), go to Settings, and click **"Check for Updates"**. It should successfully detect v0.1.1, download the `.zip` from Supabase, and install it!
