# Render Deployment Guide for Backend

Follow these steps to deploy your Node.js backend safely to Render.com!

## Step 1: Push to GitHub
Render connects directly to your GitHub repository to pull the code.

1. Open your terminal in the main project folder (`MEP_Calculator_Project`).
2. Run these commands to commit your code:
   ```bash
   git add .
   git commit -m "Prepare backend for Render deployment"
   ```
3. Create a **Private** repository on GitHub, and push this code there.
   *(Make sure it's Private! Though your passwords are protected by `.gitignore` now, it's always best to keep your proprietary backend logic private).*

## Step 2: Create the Render Web Service
1. Go to [Render.com](https://render.com) and log in.
2. Click **New +** and select **Web Service**.
3. Connect your GitHub account and select your newly created private repository.

## Step 3: Configure Render Settings
Fill out the deployment form with these exact settings:
- **Name**: `mep-calculator-api` (or whatever you like)
- **Region**: Choose the one closest to you (e.g., Frankfurt or Singapore).
- **Branch**: `main` or `master`.
- **Root Directory**: `backend` (very important! This tells Render to only look at the backend folder).
- **Runtime**: `Node`
- **Build Command**: `npm install`
- **Start Command**: `node authServer.js`
- **Instance Type**: Select the Free tier.

## Step 4: Add Environment Variables
Scroll down to the **Environment Variables** section. You MUST add these three keys exactly as they appear in your local `backend/.env` file:
1. `SUPABASE_URL` = `https://ttqgrcmesxrnujmhesnk.supabase.co`
2. `SUPABASE_ANON_KEY` = `(Paste the huge token from your local backend/.env)`
3. `JWT_SECRET` = `mep_calculator_auth_secret_key_2026`
4. `SENDER_EMAIL` = `tarv.official@gmail.com`

## Step 5: Deploy & Connect!
1. Click **Create Web Service**.
2. Wait a few minutes for Render to build and start your server.
3. Once it says "Live", copy the URL at the top (it will look like `https://mep-calculator-api.onrender.com`).
4. Paste that URL into your `frontend/.env` file on your computer:
   `VITE_API_URL=https://mep-calculator-api.onrender.com`

You are now fully live on the cloud!
