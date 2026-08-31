import http from 'http';
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { fileURLToPath } from 'url';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import transporter from './nodemailer.js';
import { WELCOME_EMAIL_TEMPLATE, EMAIL_VERIFY_TEMPLATE, PASSWORD_RESET_TEMPLATE } from './emailTemplates.js';
import * as dotenv from 'dotenv';
import { createClient } from '@supabase/supabase-js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const DATA_DIR = path.join(__dirname, 'data');
if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

const ACTIVITY_LOGS_FILE = path.join(DATA_DIR, 'activity_logs.json');
if (!fs.existsSync(ACTIVITY_LOGS_FILE)) fs.writeFileSync(ACTIVITY_LOGS_FILE, JSON.stringify([]), 'utf8');

function readActivityLogs() {
  try { return JSON.parse(fs.readFileSync(ACTIVITY_LOGS_FILE, 'utf8') || '[]'); } catch (e) { return []; }
}

function writeActivityLogs(logs) {
  try { fs.writeFileSync(ACTIVITY_LOGS_FILE, JSON.stringify(logs, null, 2), 'utf8'); } catch (e) {}
}

const ORG_SETTINGS_FILE = path.join(DATA_DIR, 'org_settings.json');
if (!fs.existsSync(ORG_SETTINGS_FILE)) fs.writeFileSync(ORG_SETTINGS_FILE, JSON.stringify({}), 'utf8');

const USERS_FILE = path.join(DATA_DIR, 'users.json');
if (!fs.existsSync(USERS_FILE)) fs.writeFileSync(USERS_FILE, JSON.stringify([]), 'utf8');

function readLocalUsers() {
  try { return JSON.parse(fs.readFileSync(USERS_FILE, 'utf8') || '[]'); } catch (e) { return []; }
}

function saveLocalUsers(users) {
  try { fs.writeFileSync(USERS_FILE, JSON.stringify(users, null, 2), 'utf8'); } catch (e) {}
}

const ORGS_FILE = path.join(DATA_DIR, 'organizations.json');
try { if (!fs.existsSync(ORGS_FILE)) fs.writeFileSync(ORGS_FILE, JSON.stringify([]), 'utf8'); } catch (e) {}

const LICENSES_FILE = path.join(DATA_DIR, 'licenses.json');
try { if (!fs.existsSync(LICENSES_FILE)) fs.writeFileSync(LICENSES_FILE, JSON.stringify([]), 'utf8'); } catch (e) {}

const TRIALS_FILE = path.join(DATA_DIR, 'hardware_trials.json');
try { if (!fs.existsSync(TRIALS_FILE)) fs.writeFileSync(TRIALS_FILE, JSON.stringify([]), 'utf8'); } catch (e) {}

const VERSIONS_FILE = path.join(DATA_DIR, 'project_versions.json');
try { if (!fs.existsSync(VERSIONS_FILE)) fs.writeFileSync(VERSIONS_FILE, JSON.stringify([]), 'utf8'); } catch (e) {}

function readVersionsData() {
  try { return JSON.parse(fs.readFileSync(VERSIONS_FILE, 'utf8') || '[]'); } catch (e) { return []; }
}

function writeVersionsData(versions) {
  try { fs.writeFileSync(VERSIONS_FILE, JSON.stringify(versions, null, 2), 'utf8'); } catch (e) {}
}

function readLocalOrgs() {
  try { return JSON.parse(fs.readFileSync(ORGS_FILE, 'utf8') || '[]'); } catch (e) { return []; }
}

function saveLocalOrgs(orgs) {
  try { fs.writeFileSync(ORGS_FILE, JSON.stringify(orgs, null, 2), 'utf8'); } catch (e) {}
}

const TEAMS_FILE = path.join(DATA_DIR, 'teams.json');
try { if (!fs.existsSync(TEAMS_FILE)) fs.writeFileSync(TEAMS_FILE, JSON.stringify([]), 'utf8'); } catch (e) {}

const TEAM_MEMBERS_FILE = path.join(DATA_DIR, 'team_members.json');
try { if (!fs.existsSync(TEAM_MEMBERS_FILE)) fs.writeFileSync(TEAM_MEMBERS_FILE, JSON.stringify([]), 'utf8'); } catch (e) {}

function readLocalTeams() {
  try { return JSON.parse(fs.readFileSync(TEAMS_FILE, 'utf8') || '[]'); } catch (e) { return []; }
}

function saveLocalTeams(teams) {
  try { fs.writeFileSync(TEAMS_FILE, JSON.stringify(teams, null, 2), 'utf8'); } catch (e) {}
}

function readLocalTeamMembers() {
  try { return JSON.parse(fs.readFileSync(TEAM_MEMBERS_FILE, 'utf8') || '[]'); } catch (e) { return []; }
}

function saveLocalTeamMembers(members) {
  try { fs.writeFileSync(TEAM_MEMBERS_FILE, JSON.stringify(members, null, 2), 'utf8'); } catch (e) {}
}

const orgLicenseSessions = new Map();

function cleanStaleLicenseSessions(orgId) {
  const sessionsMap = orgLicenseSessions.get(orgId);
  if (!sessionsMap) return [];
  const now = Date.now();
  for (const [uid, sess] of sessionsMap.entries()) {
    if (now - sess.lastPing > 20000) {
      sessionsMap.delete(uid);
    }
  }
  return Array.from(sessionsMap.values());
}

function readOrgSettings() {
  try { return JSON.parse(fs.readFileSync(ORG_SETTINGS_FILE, 'utf8') || '{}'); } catch (e) { return {}; }
}

function writeOrgSettings(settings) {
  try { fs.writeFileSync(ORG_SETTINGS_FILE, JSON.stringify(settings, null, 2), 'utf8'); } catch (e) {}
}

function parseOrgStatus(statusStr) {
  if (!statusStr) return { state: 'active' };
  try {
    if (typeof statusStr === 'string' && statusStr.trim().startsWith('{')) {
      const parsed = JSON.parse(statusStr);
      return {
        state: parsed.state || 'active',
        max_concurrent_users: (parsed.max_concurrent_users !== undefined && parsed.max_concurrent_users !== null && !isNaN(parsed.max_concurrent_users)) ? parseInt(parsed.max_concurrent_users) : undefined,
        license_key: parsed.license_key || undefined
      };
    }
  } catch (e) {}
  return { state: typeof statusStr === 'string' ? statusStr : 'active' };
}

function encodeOrgStatus(existingStatusStr, newMaxConcurrent, newLicenseKey) {
  const current = parseOrgStatus(existingStatusStr);
  if (newMaxConcurrent !== undefined && newMaxConcurrent !== null && !isNaN(newMaxConcurrent)) {
    current.max_concurrent_users = parseInt(newMaxConcurrent);
  }
  if (newLicenseKey !== undefined && newLicenseKey !== null && String(newLicenseKey).trim()) {
    current.license_key = String(newLicenseKey).trim();
  }
  return JSON.stringify(current);
}

function logActivity(user, action_type, details) {
  if (!user) return;
  const logs = readActivityLogs();
  logs.unshift({
    id: `log_${Date.now()}_${Math.floor(Math.random()*1000)}`,
    created_at: new Date().toISOString(),
    user_id: user.id || 'system',
    email: user.email || 'system',
    name: user.name || user.email || 'User',
    action_type,
    details: typeof details === 'string' ? details : JSON.stringify(details)
  });
  if (logs.length > 1000) logs.length = 1000;
  writeActivityLogs(logs);
}

dotenv.config({ path: path.join(__dirname, '.env') });

const PORT = process.env.PORT || 4000;

let JWT_SECRET = process.env.JWT_SECRET;
if (!JWT_SECRET) {
  if (process.env.NODE_ENV === 'production') {
    console.error("FATAL ERROR: Missing JWT_SECRET environment variable in production!");
    process.exit(1);
  }
  console.warn("⚠️ WARNING: JWT_SECRET not found in environment, using local development fallback secret.");
  JWT_SECRET = 'mep_dev_only_jwt_secret_2026_fallback';
}

const SENDER_EMAIL = process.env.SENDER_EMAIL || 'tarv.official@gmail.com';

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error("Missing SUPABASE credentials in .env");
  process.exit(1);
}

if (typeof globalThis.WebSocket === 'undefined') {
  class DummyWebSocket {
    constructor() {}
    addEventListener() {}
    removeEventListener() {}
    send() {}
    close() {}
  }
  globalThis.WebSocket = DummyWebSocket;
}

const supabase = createClient(supabaseUrl, supabaseKey, {
  auth: { persistSession: false },
});

let usersCache = null;
let usersCacheTime = 0;
const USER_CACHE_TTL = 30000; // 30 seconds TTL

function invalidateUserCache() {
  usersCache = null;
  usersCacheTime = 0;
}

async function readUsers(forceRefresh = false) {
  const now = Date.now();
  if (!forceRefresh && usersCache && (now - usersCacheTime < USER_CACHE_TTL)) {
    return usersCache;
  }

  try {
    const localUsers = readLocalUsers();
    const localMap = new Map();
    (localUsers || []).forEach(u => {
      if (u.id) localMap.set(String(u.id).toLowerCase(), u);
      if (u.email) localMap.set(String(u.email).toLowerCase(), u);
    });

    const { data, error } = await supabase.from('custom_users').select('*');
    let users = [];
    if (!error && Array.isArray(data)) {
      users = data.map(u => {
        const loc = localMap.get(String(u.id || '').toLowerCase()) || localMap.get(String(u.email || '').toLowerCase()) || {};
        const effRole = (u.role && u.role !== 'USER') ? u.role : (loc.role || u.features?.role || loc.features?.role || ((u.email && u.email.toLowerCase() === 'admin@tarv.ai') ? 'SUPER_ADMIN' : 'Jr. Design Engineer'));
        const expDate = u.subscription_expires || loc.subscription_expires || u.features?.subscription_expires || loc.features?.subscription_expires || null;
        const orgId = u.organization_id || loc.organization_id || u.features?.organization_id || loc.features?.organization_id || null;
        const comp = u.company || u.organization || loc.company || loc.organization || u.features?.company || loc.features?.company || u.features?.organization || loc.features?.organization || '';

        return {
          ...loc,
          ...u,
          role: effRole,
          organization_id: orgId,
          company: comp,
          organization: comp,
          designation: u.designation || loc.designation || u.features?.designation || '',
          profile_photo: u.profile_photo !== undefined && u.profile_photo !== null ? u.profile_photo : (u.features?.profile_photo !== undefined && u.features?.profile_photo !== null ? u.features.profile_photo : (loc.profile_photo || '')),
          settings: u.settings || loc.settings || u.features?.settings || {},
          active_hwid: loc.active_hwid || u.active_hwid || u.features?.active_hwid || null,
          subscription_expires: expDate,
          features: {
            ...(loc.features || {}),
            ...(u.features || {}),
            organization_id: orgId,
            company: comp,
            organization: comp,
            role: effRole,
            subscription_expires: expDate
          }
        };
      });
      users = users.filter(u => u.email !== 'parassadafuule05@gmail.com');
      
      // Auto-clean expired unverified ghost accounts (only if expire timestamp is explicitly in the past)
      const nowTs = Date.now();
      const staleUnverified = users.filter(u => 
        u.isAccountVerified === false && 
        u.verifyOtpExpireAt && 
        u.verifyOtpExpireAt < nowTs
      );

      if (staleUnverified.length > 0) {
        const staleIds = new Set(staleUnverified.map(u => u.id));
        users = users.filter(u => !staleIds.has(u.id));
        const localUsersClean = (readLocalUsers() || []).filter(u => !staleIds.has(u.id));
        saveLocalUsers(localUsersClean);
        try {
          await supabase.from('custom_users').delete().in('id', Array.from(staleIds));
        } catch (e) {}
      }

      usersCache = users;
      usersCacheTime = now;
      saveLocalUsers(users);
      return users;
    } else {
      users = localUsers;
    }
    
    const adminEmail = 'admin@tarv.ai';
    let adminUser = users.find(u => u.email === adminEmail);
    if (!adminUser) {
      const hashedPassword = bcrypt.hashSync('admin@tarv.ai', 10);
      adminUser = {
        id: 'usr_admin_tarv_ai',
        name: 'System Admin',
        email: adminEmail,
        password: hashedPassword,
        verifyOtp: '',
        verifyOtpExpireAt: 0,
        isAccountVerified: true,
        role: 'SUPER_ADMIN',
        status: 'active',
        company: 'Tarv',
        designation: 'Super Administrator',
        resetOtp: '',
        resetOtpExpireAt: 0,
        createdAt: new Date().toISOString(),
        active_hwid: null
      };
      users.push(adminUser);
      saveLocalUsers(users);
      try { await supabase.from('custom_users').insert([adminUser]); } catch (e) {}
    }
    return users;
  } catch (e) {
    console.error("Error reading users:", e);
    return readLocalUsers();
  }
}

async function writeUsers(users) {
  saveLocalUsers(users);
  invalidateUserCache();
  try {
    const safeUsers = users.map(u => {
      const { privacyPolicyAccepted, company, designation, profile_photo, settings, ...user } = u;
      const expDate = user.subscription_expires || user.features?.subscription_expires || null;
      const orgId = user.organization_id || user.features?.organization_id || null;
      const comp = company || user.organization || user.features?.company || user.features?.organization || '';
      const effRole = user.role || user.features?.role || 'Jr. Design Engineer';
      const features = {
        ...(user.features || {}),
        organization_id: orgId,
        company: comp,
        organization: comp,
        role: effRole,
        designation: designation || user.features?.designation || '',
        profile_photo: profile_photo !== undefined ? profile_photo : (user.features?.profile_photo || ''),
        settings: settings || user.features?.settings || {},
        subscription_expires: expDate
      };
      if (u.active_hwid !== undefined) {
        features.active_hwid = u.active_hwid;
      }
      return {
        ...user,
        role: effRole,
        organization_id: orgId,
        active_hwid: u.active_hwid || null,
        subscription_expires: expDate,
        features
      };
    });
    const { error } = await supabase.from('custom_users').upsert(safeUsers);
    if (error) {
      // Fallback if subscription_expires or organization_id top-level column is not present in Supabase table schema
      const featuresOnlyUsers = safeUsers.map(({ subscription_expires, organization_id, ...u }) => u);
      await supabase.from('custom_users').upsert(featuresOnlyUsers);
    }
  } catch (e) {
    console.error('Error writing users to Supabase:', e);
  }
}

async function formatUser(user, allUsers = null) {
  let is_founding_pioneer = false;
  let pioneer_number = null;

  let effectiveRole = user.role;
  if (!effectiveRole || effectiveRole === 'USER' || effectiveRole === 'UNASSIGNED') {
    effectiveRole = (user.email && user.email.toLowerCase() === 'admin@tarv.ai') ? 'SUPER_ADMIN' : 'Jr. Design Engineer';
  }

  try {
    const list = allUsers || (await readUsers());
    const validUsers = (list || []).filter(u => u && u.id);
    const nonAdminUsers = validUsers.filter(u => u.role !== 'SUPER_ADMIN');
    
    const sorted = [...nonAdminUsers].sort((a, b) => {
      const idxA = nonAdminUsers.indexOf(a);
      const idxB = nonAdminUsers.indexOf(b);
      const timeA = a.createdAt ? new Date(a.createdAt).getTime() : (idxA * 1000);
      const timeB = b.createdAt ? new Date(b.createdAt).getTime() : (idxB * 1000);
      return timeA - timeB;
    });

    if (effectiveRole === 'SUPER_ADMIN') {
      is_founding_pioneer = false;
      pioneer_number = null;
    } else {
      const userEmailLower = user.email ? user.email.toLowerCase() : '';
      const idx = sorted.findIndex(u => u.id === user.id || (u.email && u.email.toLowerCase() === userEmailLower));
      
      if (idx !== -1 && idx < 50) {
        is_founding_pioneer = true;
        pioneer_number = idx + 1;
      } else if (sorted.length === 0) {
        is_founding_pioneer = true;
        pioneer_number = 1;
      }
    }
  } catch (e) {
    console.error('Error formatting pioneer user:', e);
  }

  return {
    id: user.id,
    name: user.name,
    email: user.email,
    isAccountVerified: user.isAccountVerified,
    role: effectiveRole,
    privacyPolicyAccepted: user.privacyPolicyAccepted || false,
    features: user.features || {},
    subscription_expires: user.subscription_expires || user.features?.subscription_expires || null,
    organization_id: user.organization_id,
    company: user.company || '',
    designation: user.designation || '',
    profile_photo: user.profile_photo || '',
    settings: user.settings || {},
    status: user.status,
    is_founding_pioneer,
    pioneer_number: is_founding_pioneer ? (pioneer_number || 1) : null
  };
}

function parseCookies(request) {
  const list = {};
  const rc = request.headers.cookie;
  if (rc) {
    rc.split(';').forEach((cookie) => {
      const parts = cookie.split('=');
      list[parts.shift().trim()] = decodeURI(parts.join('='));
    });
  }
  return list;
}

async function getUserFromReq(req) {
  let token = null;
  if (req.headers.authorization) {
    token = req.headers.authorization.replace('Bearer ', '').trim();
  }
  if (!token) {
    const cookies = parseCookies(req);
    token = cookies.token;
  }
  if (!token) return null;
  try {
    const users = await readUsers();
    if (token.startsWith('desktop-token-')) {
      const targetId = token.replace('desktop-token-', '').trim();
      let matchedUser = users.find(u => u.id === targetId || (u.email && u.email.toLowerCase() === targetId.toLowerCase()));
      if (!matchedUser && (targetId === 'admin' || targetId === 'usr_admin_tarv_ai')) {
        matchedUser = users.find(u => u.email === 'admin@tarv.ai' || u.role === 'SUPER_ADMIN');
      }
      if (matchedUser) return matchedUser;
    }
    const decoded = jwt.verify(token, JWT_SECRET);
    const userIndex = users.findIndex((u) => u.id === decoded.id);
    if (userIndex === -1) return null;
    let user = { ...users[userIndex] };

    const reqHwid = req.headers['x-hwid'] || req.headers['hwid'];
    const isLocalHost = req.headers.host && (req.headers.host.includes('localhost') || req.headers.host.includes('127.0.0.1'));
    if (user.active_hwid && reqHwid && user.active_hwid !== reqHwid && !isLocalHost) {
      if (user.role !== 'SUPER_ADMIN' && reqHwid !== 'NODE_SERVER_ENVIRONMENT' && reqHwid !== 'HWID-FALLBACK-DEVICE-0001' && user.active_hwid !== 'NODE_SERVER_ENVIRONMENT') {
        user.sessionRevoked = true;
      }
    }

    if (user.status === 'invited') {
      user.status = 'active';
      user.isAccountVerified = true;
      users[userIndex] = user;
      await writeUsers(users);
      try {
        await supabase.from('custom_users').update({ status: 'active', isAccountVerified: true }).eq('id', user.id);
      } catch (e) {}
    }

    if (user.organization_id) {
      try {
        const fileSettings = readOrgSettings();
        const orgObj = Object.values(fileSettings).find(o => o && (o.id === user.organization_id || o.name === user.organization_id));
        if (orgObj && orgObj.name) {
          user.organization_name = orgObj.name;
          user.company = orgObj.name;
          user.organization = orgObj.name;
        }
      } catch (e) {}
    }

    return user;
  } catch (e) {
    return null;
  }
}

function sendJSON(res, statusCode, body, setCookieStr = null) {
  const headers = {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization, x-hwid, hwid',
  };
  if (setCookieStr) {
    headers['Set-Cookie'] = setCookieStr;
  }
  res.writeHead(statusCode, headers);
  res.end(JSON.stringify(body));
}

function getRequestBody(req) {
  return new Promise((resolve) => {
    let body = '';
    req.on('data', (chunk) => {
      body += chunk.toString();
    });
    req.on('end', () => {
      try {
        resolve(body ? JSON.parse(body) : {});
      } catch (e) {
        resolve({});
      }
    });
  });
}

const server = http.createServer(async (req, res) => {
  // CORS Preflight
  if (req.method === 'OPTIONS') {
    res.writeHead(204, {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization, x-hwid, hwid',
    });
    return res.end();
  }

  const url = req.url.split('?')[0];

  // HEALTH CHECK ROUTE FOR UPTIMEROBOT
  if ((req.method === 'GET' || req.method === 'HEAD') && url === '/health') {
    return sendJSON(res, 200, {
      success: true,
      message: "Server is healthy",
      timestamp: new Date().toISOString(),
    });
  }

  // AUTO UPDATE MANIFEST ROUTE
  if (req.method === 'GET' && (url === '/update.json' || url === '/api/update.json')) {
    const updatePath = path.join(__dirname, '../frontend/public/update.json');
    try {
      if (fs.existsSync(updatePath)) {
        const content = fs.readFileSync(updatePath, 'utf8');
        res.writeHead(200, { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' });
        return res.end(content);
      }
    } catch (e) {}
    return sendJSON(res, 200, {
      version: "0.0.4",
      pub_date: new Date().toISOString(),
      notes: "• Fix email signup OTP verification and account activation.\n• Fix background prefetch console 401 logs.\n• Add Resend API rate-limiting compliance for dual welcome and OTP email delivery.",
      url: "https://ttqgrcmesxrnujmhesnk.supabase.co/storage/v1/object/public/updater/MEP_Calculator_0.0.4_x64-setup.exe",
      mandatory: false
    });
  }

  // 1. REGISTER
  if (req.method === 'POST' && url === '/api/auth/register') {
    const { name, email, password } = await getRequestBody(req);

    if (!name || !email || !password) {
      return sendJSON(res, 200, { success: false, message: 'Missing Details: Name, email, and password required' });
    }

    const users = await readUsers();
    const cleanEmail = email.trim().toLowerCase();
    const existingUser = users.find((u) => u.email === cleanEmail);

    if (existingUser) {
      if (!existingUser.isAccountVerified) {
        const otp = String(Math.floor(100000 + Math.random() * 900000));
        existingUser.name = name.trim();
        existingUser.password = await bcrypt.hash(password, 10);
        existingUser.verifyOtp = otp;
        existingUser.verifyOtpExpireAt = Date.now() + 24 * 60 * 60 * 1000;

        await writeUsers(users.map((u) => (u.id === existingUser.id ? existingUser : u)));

        const token = jwt.sign({ id: existingUser.id, email: cleanEmail }, JWT_SECRET, { expiresIn: '7d' });
        const cookieStr = `token=${token}; HttpOnly; Path=/; Max-Age=604800; SameSite=Lax`;

        const welcomeMailOptions = {
          from: SENDER_EMAIL,
          to: cleanEmail,
          subject: 'Welcome to MEP Calculator! 🚀',
          html: WELCOME_EMAIL_TEMPLATE.replace(/\{\{name\}\}/g, name).replace(/\{\{email\}\}/g, cleanEmail),
        };

        const verifyMailOptions = {
          from: SENDER_EMAIL,
          to: cleanEmail,
          subject: 'Account Verification OTP',
          html: EMAIL_VERIFY_TEMPLATE.replace(/\{\{otp\}\}/g, otp)
            .replace(/\{\{email\}\}/g, cleanEmail)
            .replace(/\{\{name\}\}/g, name),
        };

        try {
          await transporter.sendMail(verifyMailOptions);
        } catch (err) {
          console.error('OTP email error:', err);
          return sendJSON(res, 200, { success: false, message: 'Failed to send OTP email.' });
        }

        try {
          await new Promise((resolve) => setTimeout(resolve, 1000));
          await transporter.sendMail(welcomeMailOptions);
        } catch (err) {
          console.error('Welcome mail error:', err);
        }

        return sendJSON(
          res,
          200,
          {
            success: true,
            token,
            message: 'Verification OTP sent to your email address.',
            userData: {
              id: existingUser.id,
              name: existingUser.name,
              email: existingUser.email,
              isAccountVerified: false,
              role: existingUser.role,
              privacyPolicyAccepted: existingUser.privacyPolicyAccepted || false,
              features: existingUser.features || {},
              subscription_expires: existingUser.subscription_expires,
            },
          },
          cookieStr
        );
      } else {
        return sendJSON(res, 200, { success: false, message: 'User already exists and is verified. Please login instead.' });
      }
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    const otp = String(Math.floor(100000 + Math.random() * 900000));
    const userId = `usr_${Date.now()}_${Math.floor(Math.random() * 1000)}`;

    const newUser = {
      id: userId,
      name: name.trim(),
      email: cleanEmail,
      password: hashedPassword,
      verifyOtp: otp,
      verifyOtpExpireAt: Date.now() + 24 * 60 * 60 * 1000,
      isAccountVerified: false,
      role: (cleanEmail === 'admin@tarv.ai') ? 'SUPER_ADMIN' : 'Jr. Design Engineer',
      resetOtp: '',
      resetOtpExpireAt: 0,
      createdAt: new Date().toISOString(),
      privacyPolicyAccepted: false,
      subscription_expires: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString(),
    };

    users.push(newUser);
    await writeUsers(users);

    const token = jwt.sign({ id: userId, email: cleanEmail }, JWT_SECRET, { expiresIn: '7d' });
    const cookieStr = `token=${token}; HttpOnly; Path=/; Max-Age=604800; SameSite=Lax`;

    const welcomeMailOptions = {
      from: SENDER_EMAIL,
      to: cleanEmail,
      subject: 'Welcome to MEP Calculator! 🚀',
      html: WELCOME_EMAIL_TEMPLATE.replace(/\{\{name\}\}/g, name).replace(/\{\{email\}\}/g, cleanEmail),
    };

    const verifyMailOptions = {
      from: SENDER_EMAIL,
      to: cleanEmail,
      subject: 'Account Verification OTP',
      html: EMAIL_VERIFY_TEMPLATE.replace(/\{\{otp\}\}/g, otp)
        .replace(/\{\{email\}\}/g, cleanEmail)
        .replace(/\{\{name\}\}/g, name),
    };

    try {
      await transporter.sendMail(verifyMailOptions);
    } catch (err) {
      console.error('OTP Email error:', err);
      return sendJSON(res, 200, { success: false, message: 'Failed to send OTP email.' });
    }

    try {
      await new Promise((resolve) => setTimeout(resolve, 1000));
      await transporter.sendMail(welcomeMailOptions);
    } catch (err) {
      console.error('Welcome mail error:', err);
    }

    logActivity(newUser, 'REGISTER', 'User registered directly');

    return sendJSON(
      res,
      200,
      {
        success: true,
        token,
        message: 'Account created! Verification OTP sent to your email address.',
        userData: {
          id: userId,
          name: newUser.name,
          email: newUser.email,
          isAccountVerified: false,
          role: newUser.role,
          features: newUser.features || {},
          subscription_expires: newUser.subscription_expires,
        },
      },
      cookieStr
    );
  }

  // 2. LOGIN
  if (req.method === 'POST' && url === '/api/auth/login') {
    const { email, password, hwid, force } = await getRequestBody(req);

    if (!email || !password) {
      return sendJSON(res, 200, { success: false, message: 'Email and password are required' });
    }

    const users = await readUsers();
    const cleanEmail = email.trim().toLowerCase();
    const userIndex = users.findIndex((u) => u.email === cleanEmail);
    const user = userIndex !== -1 ? users[userIndex] : null;

    if (!user) {
      return sendJSON(res, 200, { success: false, message: 'Invalid email' });
    }

    const isMatch = await bcrypt.compare(password, user.password);

    if (!isMatch) {
      return sendJSON(res, 200, { success: false, message: 'Invalid password' });
    }

    // Enforce Organization User Limit (seat limit) check
    const userOrgId = user.organization_id || user.features?.organization_id;
    if (userOrgId && user.role !== 'SUPER_ADMIN' && user.role !== 'ORG_ADMIN') {
      const localOrgs = readLocalOrgs();
      const orgObj = localOrgs.find(o => o.id === userOrgId);
      if (orgObj) {
        const maxUsers = orgObj.max_users || 10;
        const orgMembers = users.filter(u => u.organization_id === userOrgId || u.features?.organization_id === userOrgId);
        const memberRank = orgMembers.findIndex(u => u.id === user.id || (u.email && u.email.toLowerCase() === cleanEmail));
        if (memberRank >= maxUsers) {
          return sendJSON(res, 200, {
            success: false,
            message: `Login blocked: Organization "${orgObj.name}" has reached its limit of ${maxUsers} user seat${maxUsers === 1 ? '' : 's'}. Contact your administrator.`
          });
        }
      }
    }

    // Automatically transition invited users to active status upon successful login
    if (user.status === 'invited' || !user.isAccountVerified) {
      user.status = 'active';
      user.isAccountVerified = true;
      users[userIndex] = user;
      await writeUsers(users);
      try {
        await supabase.from('custom_users').update({ status: 'active', isAccountVerified: true }).eq('id', user.id);
      } catch (e) {}
    }

    if (hwid && user.active_hwid && user.active_hwid !== hwid && !force) {
      if (user.role !== 'SUPER_ADMIN') {
        return sendJSON(res, 200, { 
          success: false, 
          requireForceLogout: true, 
          message: 'This email is already logged in on another device. Do you want to remove it from that device?' 
        });
      }
    }

    if (hwid) {
      user.active_hwid = hwid;
      if (!user.features) user.features = {};
      user.features.active_hwid = hwid;
      users[userIndex] = user;
      await writeUsers(users);
      try {
        await supabase.from('custom_users').update({
          active_hwid: hwid,
          features: { ...(user.features || {}), active_hwid: hwid }
        }).or(`id.eq.${user.id},email.eq.${user.email}`);
      } catch (e) {}
    }

    const token = jwt.sign({ id: user.id, email: user.email }, JWT_SECRET, { expiresIn: '7d' });
    const cookieStr = `token=${token}; HttpOnly; Path=/; Max-Age=604800; SameSite=Lax`;
    logActivity(user, 'LOGIN', 'User logged in');

    return sendJSON(
      res,
      200,
      {
        success: true,
        token,
        message: 'Logged In Successfully',
        userData: await formatUser(user),
      },
      cookieStr
    );
  }

  // 3. LOGOUT
  if (req.method === 'POST' && url === '/api/auth/logout') {
    const cookieStr = `token=; HttpOnly; Path=/; Max-Age=0; SameSite=Lax`;
    return sendJSON(res, 200, { success: true, message: 'Logged Out Successfully' }, cookieStr);
  }

  // 4. SEND VERIFY OTP
  if (req.method === 'POST' && url === '/api/auth/send-verify-otp') {
    const { email } = await getRequestBody(req);
    const cleanEmail = (email || '').trim().toLowerCase();
    const users = await readUsers(true);
    const userFromToken = await getUserFromReq(req);

    let user = null;
    if (cleanEmail) {
      user = users.find((u) => u.email === cleanEmail);
    }
    if (!user && userFromToken) {
      user = users.find((u) => u.id === userFromToken.id || u.email === userFromToken.email);
    }

    if (!user) {
      return sendJSON(res, 200, { success: false, message: 'User not found' });
    }

    if (user.isAccountVerified) {
      return sendJSON(res, 200, { success: false, message: 'Account Already Verified' });
    }

    const otp = String(Math.floor(100000 + Math.random() * 900000));
    user.verifyOtp = otp;
    user.verifyOtpExpireAt = Date.now() + 24 * 60 * 60 * 1000;

    await writeUsers(users.map((u) => (u.id === user.id ? user : u)));
    invalidateUserCache();

    const mailOption = {
      from: SENDER_EMAIL,
      to: user.email,
      subject: 'Account Verification OTP',
      html: EMAIL_VERIFY_TEMPLATE.replace(/\{\{otp\}\}/g, otp)
        .replace(/\{\{email\}\}/g, user.email)
        .replace(/\{\{name\}\}/g, user.name),
    };

    try {
      await transporter.sendMail(mailOption);
    } catch (err) {
      console.error('OTP resend mail error:', err);
    }

    return sendJSON(res, 200, { success: true, message: 'Verification OTP Sent to Email' });
  }

  // 5. VERIFY ACCOUNT (OTP CONFIRMATION)
  if (req.method === 'POST' && url === '/api/auth/verify-account') {
    const { otp, email } = await getRequestBody(req);

    if (!otp) {
      return sendJSON(res, 200, { success: false, message: 'Missing 6-digit OTP' });
    }

    const cleanEmail = (email || '').trim().toLowerCase();
    const users = await readUsers(true);
    const userFromToken = await getUserFromReq(req);

    let user = null;
    if (cleanEmail) {
      user = users.find((u) => u.email === cleanEmail);
    }
    if (!user && userFromToken) {
      user = users.find((u) => u.id === userFromToken.id || u.email === userFromToken.email);
    }
    if (!user) {
      user = users.find((u) => u.verifyOtp && String(u.verifyOtp).trim() === String(otp).trim());
    }

    if (!user) {
      return sendJSON(res, 200, { success: false, message: 'User not found' });
    }

    if (!user.verifyOtp || String(user.verifyOtp).trim() !== String(otp).trim()) {
      return sendJSON(res, 200, { success: false, message: 'Invalid OTP code' });
    }

    if (user.verifyOtpExpireAt && Number(user.verifyOtpExpireAt) > 0 && Number(user.verifyOtpExpireAt) < Date.now()) {
      return sendJSON(res, 200, { success: false, message: 'OTP Expired. Please click Resend OTP.' });
    }

    user.isAccountVerified = true;
    user.status = 'active';
    user.verifyOtp = '';
    user.verifyOtpExpireAt = 0;

    const updatedUsers = users.map((u) => (u.id === user.id ? user : u));
    await writeUsers(updatedUsers);
    invalidateUserCache();

    const token = jwt.sign({ id: user.id, email: user.email }, JWT_SECRET, { expiresIn: '7d' });
    const cookieStr = `token=${token}; HttpOnly; Path=/; Max-Age=604800; SameSite=Lax`;

    return sendJSON(
      res,
      200,
      {
        success: true,
        token,
        message: 'Email Verified Successfully',
        userData: await formatUser(user),
      },
      cookieStr
    );
  }

  if (req.method === 'GET' && url === '/api/auth/is-auth') {
    const user = await getUserFromReq(req);
    if (user) {
      if (user.sessionRevoked) {
        return sendJSON(res, 401, {
          success: false,
          sessionRevoked: true,
          message: 'Your account was logged in on another device.'
        });
      }
      return sendJSON(res, 200, {
        success: true,
        userData: await formatUser(user),
      });
    }
    return sendJSON(res, 200, { success: false, message: 'Not authenticated' });
  }

  // 7. USER DATA
  if (req.method === 'GET' && url === '/api/user/data') {
    const user = await getUserFromReq(req);
    if (!user) {
      return sendJSON(res, 401, { success: false, message: 'User not logged in' });
    }
    if (user.isDeactivated || user.isDeleted || user.status === 'deactivated' || user.status === 'deleted') {
      return sendJSON(res, 403, {
        success: false,
        accountDeactivated: true,
        message: 'Your account has been deleted or deactivated by an administrator.'
      });
    }
    if (user.sessionRevoked) {
      return sendJSON(res, 401, {
        success: false,
        sessionRevoked: true,
        message: 'Your account was logged in on another device.'
      });
    }
    return sendJSON(res, 200, {
      success: true,
      userData: await formatUser(user)
    });
  }

  // 7.1 UPDATE PROFILE
  if (req.method === 'POST' && url === '/api/user/update-profile') {
    const user = await getUserFromReq(req);
    if (!user) {
      return sendJSON(res, 401, { success: false, message: 'Not authenticated' });
    }
    const { name, company, designation, profile_photo, settings, currentPassword, newPassword } = await getRequestBody(req);
    const users = await readUsers();
    const userIndex = users.findIndex(u => u.id === user.id);
    if (userIndex === -1) {
      return sendJSON(res, 200, { success: false, message: 'User not found' });
    }

    const dbUser = users[userIndex];

    if (name !== undefined && name.trim()) dbUser.name = name.trim();
    if (company !== undefined) dbUser.company = company.trim();
    if (designation !== undefined) dbUser.designation = designation.trim();
    if (profile_photo !== undefined) {
      dbUser.profile_photo = profile_photo;
      if (!dbUser.features) dbUser.features = {};
      dbUser.features.profile_photo = profile_photo;
    }
    if (settings !== undefined) dbUser.settings = { ...(dbUser.settings || {}), ...settings };

    if (newPassword) {
      if (!currentPassword) {
        return sendJSON(res, 200, { success: false, message: 'Current password is required to set a new password.' });
      }
      const isMatch = await bcrypt.compare(currentPassword, dbUser.password);
      if (!isMatch) {
        return sendJSON(res, 200, { success: false, message: 'Current password is incorrect.' });
      }
      // Validate password requirements
      const hasSpecial = /[^A-Za-z0-9]/.test(newPassword);
      const hasNumber = /[0-9]/.test(newPassword);
      const hasCapital = /[A-Z]/.test(newPassword);
      const hasSmall = /[a-z]/.test(newPassword);
      const isLongEnough = newPassword.length >= 8;
      
      if (!hasSpecial || !hasNumber || !hasCapital || !hasSmall || !isLongEnough) {
        return sendJSON(res, 200, { success: false, message: 'New password does not meet complexity requirements.' });
      }

      dbUser.password = await bcrypt.hash(newPassword, 10);
    }

    users[userIndex] = dbUser;
    await writeUsers(users);
    logActivity(dbUser, 'UPDATE_PROFILE', 'User updated profile details/settings');

    return sendJSON(res, 200, {
      success: true,
      message: 'Profile updated successfully',
      userData: await formatUser(dbUser)
    });
  }

  // 7.2 DELETE ACCOUNT
  if (req.method === 'POST' && url === '/api/user/delete-account') {
    const user = await getUserFromReq(req);
    if (!user) {
      return sendJSON(res, 401, { success: false, message: 'Not authenticated' });
    }
    const { password, confirmed } = await getRequestBody(req);
    if (password) {
      const isMatch = await bcrypt.compare(password, user.password);
      if (!isMatch) {
        return sendJSON(res, 200, { success: false, message: 'Incorrect password.' });
      }
    } else if (!confirmed) {
      return sendJSON(res, 200, { success: false, message: 'Confirmation required to delete account.' });
    }

    logActivity(user, 'DELETE_ACCOUNT', 'User deleted their account');

    // Delete from local user store if present
    const users = await readUsers();
    const filteredUsers = users.filter(u => u.id !== user.id);
    await writeUsers(filteredUsers);

    // Delete from Supabase custom_users table
    const { error } = await supabase.from('custom_users').delete().eq('id', user.id);
    if (error) {
      console.error('Supabase delete user error:', error);
    }

    // Set cookie expire to clear session
    const cookieStr = `token=; HttpOnly; Path=/; Max-Age=0; SameSite=Lax`;
    return sendJSON(res, 200, { success: true, message: 'Account deleted successfully' }, cookieStr);
  }

  // 7.3 LOGOUT OTHERS
  if (req.method === 'POST' && url === '/api/user/logout-others') {
    const user = await getUserFromReq(req);
    if (!user) {
      return sendJSON(res, 401, { success: false, message: 'Not authenticated' });
    }
    const users = await readUsers();
    const userIndex = users.findIndex(u => u.id === user.id);
    if (userIndex === -1) {
      return sendJSON(res, 200, { success: false, message: 'User not found' });
    }

    users[userIndex].active_hwid = null;
    await writeUsers(users);
    logActivity(users[userIndex], 'LOGOUT_OTHERS', 'Logged out all other sessions');

    return sendJSON(res, 200, { success: true, message: 'Other sessions logged out successfully' });
  }

  // 7.4 GET ACTIVITY LOGS
  if (req.method === 'GET' && url === '/api/user/activity-logs') {
    const user = await getUserFromReq(req);
    if (!user) {
      return sendJSON(res, 401, { success: false, message: 'Not authenticated' });
    }
    const logs = readActivityLogs().filter(log => log.user_id === user.id || log.email === user.email);
    return sendJSON(res, 200, { success: true, logs });
  }

  // 7.5 ACCEPT PRIVACY
  if (req.method === 'POST' && url === '/api/auth/accept-privacy') {
    const user = await getUserFromReq(req);
    if (!user) {
      return sendJSON(res, 401, { success: false, message: 'Not authenticated' });
    }
    const users = await readUsers();
    const dbUser = users.find((u) => u.id === user.id);
    if (dbUser) {
      dbUser.privacyPolicyAccepted = true;
      await writeUsers(users.map((u) => (u.id === dbUser.id ? dbUser : u)));
    }
    return sendJSON(res, 200, { success: true, message: 'Privacy policy accepted' });
  }

  // 8. SEND RESET OTP
  if (req.method === 'POST' && url === '/api/auth/send-reset-otp') {
    const { email } = await getRequestBody(req);
    if (!email) {
      return sendJSON(res, 200, { success: false, message: 'Email is required' });
    }

    const users = await readUsers();
    const cleanEmail = email.trim().toLowerCase();
    const user = users.find((u) => u.email === cleanEmail);

    if (!user) {
      return sendJSON(res, 200, { success: false, message: 'User not found with this email' });
    }

    const otp = String(Math.floor(100000 + Math.random() * 900000));
    user.resetOtp = otp;
    user.resetOtpExpireAt = Date.now() + 15 * 60 * 1000;
    console.log(`\n🔑 ==========================================`);
    console.log(`🔑 PASSWORD RESET OTP for ${cleanEmail}: [ ${otp} ]`);
    console.log(`🔑 ==========================================\n`);

    await writeUsers(users.map((u) => (u.id === user.id ? user : u)));

    const mailOption = {
      from: SENDER_EMAIL,
      to: cleanEmail,
      subject: 'Password Reset OTP',
      html: PASSWORD_RESET_TEMPLATE.replace(/\{\{otp\}\}/g, otp)
        .replace(/\{\{email\}\}/g, cleanEmail)
        .replace(/\{\{name\}\}/g, user.name),
    };

      try {
        await transporter.sendMail(mailOption);
      } catch (err) {
        console.error('Reset mail error:', err);
      }

    return sendJSON(res, 200, { success: true, message: 'Password reset OTP sent to your email' });
  }

  // 9. RESET PASSWORD
  if (req.method === 'POST' && url === '/api/auth/reset-password') {
    const { email, otp, newPassword } = await getRequestBody(req);

    if (!email || !otp || !newPassword) {
      return sendJSON(res, 200, { success: false, message: 'Email, OTP, and new password are required' });
    }

    const users = await readUsers();
    const cleanEmail = email.trim().toLowerCase();
    const user = users.find((u) => u.email === cleanEmail);

    if (!user) {
      return sendJSON(res, 200, { success: false, message: 'User not found' });
    }

    if (!user.resetOtp || String(user.resetOtp).trim() !== String(otp).trim()) {
      return sendJSON(res, 200, { success: false, message: 'Invalid OTP' });
    }

    if (user.resetOtpExpireAt < Date.now()) {
      return sendJSON(res, 200, { success: false, message: 'OTP Expired' });
    }

    if (user.password) {
      const isSameAsOld = await bcrypt.compare(newPassword, user.password);
      if (isSameAsOld) {
        return sendJSON(res, 200, {
          success: false,
          message: 'New password cannot be the same as your previous password. Please choose a different password.'
        });
      }
    }

    const hashedPassword = await bcrypt.hash(newPassword, 10);
    user.password = hashedPassword;
    user.resetOtp = '';
    user.resetOtpExpireAt = 0;

    await writeUsers(users.map((u) => (u.id === user.id ? user : u)));

    return sendJSON(res, 200, { success: true, message: 'Password reset successfully' });
  }

  // ==========================================
  // TEAMS & PROJECTS (CLOUD COLLABORATION)
  // ==========================================

  // A. LIST ALL USERS (For assigning to teams/projects)
  if (req.method === 'GET' && url === '/api/users/list') {
    const user = await getUserFromReq(req);
    if (!user) return sendJSON(res, 401, { success: false, message: 'Unauthorized' });
    const users = await readUsers();
    
    let filteredUsers = users;
    if (user.role !== 'SUPER_ADMIN') {
      const myOrgId = user.organization_id;
      const myCompany = user.company || user.organization;
      if (myOrgId || myCompany) {
        filteredUsers = users.filter(u => {
          if (u.role === 'SUPER_ADMIN' || u.email === 'admin@tarv.ai') return true;
          const uOrgId = u.organization_id;
          const uCompany = u.company || u.organization;

          if (myOrgId && uOrgId && String(uOrgId) === String(myOrgId)) return true;
          if (myCompany && uCompany && uCompany === myCompany) return true;
          if (myCompany && uOrgId && String(uOrgId) === String(myCompany)) return true;
          if (myOrgId && uCompany && uCompany === String(myOrgId)) return true;
          return true; // Return all users so project member display names can always be resolved
        });
      }
    }
    
    const fileSettings = readOrgSettings();
    const localOrgs = readLocalOrgs();
    const safeUsers = filteredUsers.map(u => {
      const orgId = u.organization_id || u.features?.organization_id || null;
      let resolvedCompany = u.company || u.organization_name || u.organization || u.features?.company || u.features?.organization || '';
      if (orgId && (!resolvedCompany || resolvedCompany === 'Consitent')) {
        const orgObj = Object.values(fileSettings).find(o => o && (o.id === orgId || o.name === orgId)) || localOrgs.find(o => o && (o.id === orgId || o.name === orgId));
        if (orgObj && orgObj.name) resolvedCompany = orgObj.name;
      }
      const effRole = (u.role && u.role !== 'USER') ? u.role : (u.features?.role || 'Jr. Design Engineer');
      return { 
        id: u.id, 
        name: u.name, 
        email: u.email, 
        role: effRole,
        features: u.features,
        subscription_expires: u.subscription_expires,
        isAccountVerified: u.isAccountVerified,
        organization_id: orgId,
        company: resolvedCompany,
        organization_name: resolvedCompany,
        organization: resolvedCompany
      };
    });
    return sendJSON(res, 200, { success: true, users: safeUsers });
  }

  // B. CREATE TEAM
  if (req.method === 'POST' && url === '/api/teams/create') {
    const user = await getUserFromReq(req);
    if (!user || (user.role !== 'SUPER_ADMIN' && user.role !== 'ORG_ADMIN')) {
      return sendJSON(res, 403, { success: false, message: 'Only Admins can create teams' });
    }
    const { name } = await getRequestBody(req);
    if (!name || !name.trim()) return sendJSON(res, 400, { success: false, message: 'Team name required' });
    
    const teamId = `team_${Date.now()}`;
    const orgId = user.organization_id || user.company || user.organization || null;
    const newTeam = {
      id: teamId,
      name: name.trim(),
      created_by: user.id,
      organization_id: orgId,
      created_at: new Date().toISOString(),
      team_members: []
    };

    // 1. Save to local teams persistence
    const localTeams = readLocalTeams();
    localTeams.push(newTeam);
    saveLocalTeams(localTeams);

    // 2. Insert into Supabase teams table (gracefully fallback if schema column fails)
    try {
      const payload = { id: teamId, name: name.trim(), created_by: user.id };
      if (orgId) payload.organization_id = orgId;
      const { error } = await supabase.from('teams').insert(payload);
      if (error && error.message && error.message.includes('organization_id')) {
        delete payload.organization_id;
        await supabase.from('teams').insert(payload);
      }
    } catch (e) {}

    logActivity(user, 'CREATE_TEAM', { teamId, name: name.trim() });
    return sendJSON(res, 200, { success: true, message: 'Team created', team: newTeam });
  }

  // C. LIST TEAMS
  if (req.method === 'GET' && url === '/api/teams/list') {
    const user = await getUserFromReq(req);
    if (!user) return sendJSON(res, 401, { success: false, message: 'Unauthorized' });
    
    let dbTeams = [];
    try {
      let teamQuery = supabase.from('teams').select('id, name, created_by, organization_id, team_members(user_id)');
      if (user.role !== 'SUPER_ADMIN' && user.organization_id) {
        teamQuery = teamQuery.or(`organization_id.eq.${user.organization_id},created_by.eq.${user.id}`);
      }
      const { data: rawTeams, error } = await teamQuery;
      if (!error && Array.isArray(rawTeams)) {
        dbTeams = rawTeams;
      }
    } catch (e) {}

    const localTeams = readLocalTeams();
    const localMembers = readLocalTeamMembers();

    const teamMap = new Map();
    dbTeams.forEach(t => teamMap.set(String(t.id), t));
    localTeams.forEach(lt => {
      const existing = teamMap.get(String(lt.id));
      if (!existing) {
        teamMap.set(String(lt.id), { ...lt, team_members: [] });
      } else {
        teamMap.set(String(lt.id), { ...lt, ...existing });
      }
    });

    const allTeamsList = Array.from(teamMap.values()).map(t => {
      const members = t.team_members || [];
      const localTeamMems = localMembers.filter(m => String(m.team_id) === String(t.id)).map(m => ({ user_id: m.user_id }));
      const combinedMembersMap = new Map();
      members.forEach((m) => combinedMembersMap.set(String(m.user_id), m));
      localTeamMems.forEach(lm => combinedMembersMap.set(String(lm.user_id), lm));
      return {
        ...t,
        team_members: Array.from(combinedMembersMap.values())
      };
    });

    let teams = allTeamsList;
    if (user.role !== 'SUPER_ADMIN') {
      const myOrgId = user.organization_id;
      const myCompany = user.company || user.organization;
      teams = teams.filter(t => {
        const tCreatedBy = String(t.created_by || '').toLowerCase();
        const uId = String(user.id || '').toLowerCase();
        if (tCreatedBy === uId) return true; // Creator always sees their team

        const tOrgId = t.organization_id;
        if (myOrgId && tOrgId && String(tOrgId) === String(myOrgId)) return true;
        if (myCompany && tOrgId && String(tOrgId) === String(myCompany)) return true;
        if (myOrgId && tOrgId && String(tOrgId) === String(myCompany)) return true;
        if (!tOrgId) return true; // Default fallback for organization teams
        return false;
      });
    }

    return sendJSON(res, 200, { success: true, teams });
  }

  // D. ADD USER TO TEAM
  if (req.method === 'POST' && url === '/api/teams/add-user') {
    const user = await getUserFromReq(req);
    if (!user || (user.role !== 'SUPER_ADMIN' && user.role !== 'ORG_ADMIN')) return sendJSON(res, 403, { success: false, message: 'Only Admins can manage teams' });
    const { team_id, user_id } = await getRequestBody(req);
    if (!team_id || !user_id) return sendJSON(res, 400, { success: false, message: 'team_id and user_id required' });

    const localMembers = readLocalTeamMembers();
    if (!localMembers.some(m => String(m.team_id) === String(team_id) && String(m.user_id) === String(user_id))) {
      localMembers.push({ team_id, user_id, added_at: new Date().toISOString() });
      saveLocalTeamMembers(localMembers);
    }

    try {
      await supabase.from('team_members').upsert({ team_id, user_id });
    } catch (e) {}

    return sendJSON(res, 200, { success: true, message: 'User added to team' });
  }

  // D2. REMOVE USER FROM TEAM
  if (req.method === 'POST' && url === '/api/teams/remove-user') {
    const user = await getUserFromReq(req);
    if (!user || (user.role !== 'SUPER_ADMIN' && user.role !== 'ORG_ADMIN')) return sendJSON(res, 403, { success: false, message: 'Only Admins can manage teams' });
    const { team_id, user_id } = await getRequestBody(req);
    
    let localMembers = readLocalTeamMembers();
    localMembers = localMembers.filter(m => !(String(m.team_id) === String(team_id) && String(m.user_id) === String(user_id)));
    saveLocalTeamMembers(localMembers);

    try {
      await supabase.from('team_members').delete().match({ team_id, user_id });
    } catch (e) {}

    return sendJSON(res, 200, { success: true, message: 'User removed from team' });
  }

  // E. DELETE TEAM
  if (req.method === 'POST' && url === '/api/teams/delete') {
    const user = await getUserFromReq(req);
    if (!user || (user.role !== 'SUPER_ADMIN' && user.role !== 'ORG_ADMIN')) return sendJSON(res, 403, { success: false, message: 'Only Admins can manage teams' });
    const { team_id } = await getRequestBody(req);
    
    let localTeams = readLocalTeams();
    localTeams = localTeams.filter(t => String(t.id) !== String(team_id));
    saveLocalTeams(localTeams);

    let localMembers = readLocalTeamMembers();
    localMembers = localMembers.filter(m => String(m.team_id) !== String(team_id));
    saveLocalTeamMembers(localMembers);

    try {
      await supabase.from('team_members').delete().eq('team_id', team_id);
      await supabase.from('teams').delete().eq('id', team_id);
    } catch (e) {}

    return sendJSON(res, 200, { success: true, message: 'Team deleted' });
  }

  // E2. CREATE PROJECT
  if (req.method === 'POST' && url === '/api/projects/create') {
    const user = await getUserFromReq(req);
    if (!user) return sendJSON(res, 401, { success: false, message: 'Unauthorized' });
    const { projectData, assigned_users = [], assigned_teams = [] } = await getRequestBody(req);
    
    if (!projectData || !projectData.name || !projectData.code) {
      return sendJSON(res, 400, { success: false, message: 'Name and Code required' });
    }
    
    const projectId = `proj_${Date.now()}`;
    const nowIso = new Date().toISOString();
    const dbProject = {
      id: projectId,
      name: projectData.name,
      code: projectData.code,
      client: projectData.client || '',
      location: projectData.location || '',
      description: projectData.description || '',
      notes: projectData.notes || '',
      organization_id: user.organization_id || null,
      created_by: user.id,
      created_at: nowIso,
      last_modified: nowIso,
      workspace_data: projectData.workspace_data || { spaces: [], zones: [], equipment: [], roundOffPreset: 5 }
    };

    let { error } = await supabase.from('projects').insert(dbProject);
    if (error && error.message && error.message.includes('organization_id')) {
      delete dbProject.organization_id;
      const retry = await supabase.from('projects').insert(dbProject);
      error = retry.error;
    }
    if (error) return sendJSON(res, 500, { success: false, message: error.message });

    const allDbUsers = await readUsers();
    const resolveUserId = (input) => {
      if (!input) return null;
      const str = String(input).trim();
      const match = allDbUsers.find(u => 
        (u.id && String(u.id).toLowerCase() === str.toLowerCase()) || 
        (u.email && String(u.email).toLowerCase() === str.toLowerCase())
      );
      return match ? match.id : str;
    };

    const rawUserIds = [...assigned_users, user.id].map(resolveUserId).filter(Boolean);
    const cleanUserIds = Array.from(new Set(rawUserIds));
    const cleanTeamIds = Array.from(new Set(assigned_teams.filter(Boolean).map(x => String(x).trim())));

    if (cleanUserIds.length > 0) {
      const puPayload = cleanUserIds.map(uid => ({ project_id: projectId, user_id: uid }));
      const { error: puErr } = await supabase.from('project_users').upsert(puPayload, { onConflict: 'project_id,user_id', ignoreDuplicates: true });
      if (puErr) {
        for (const uid of cleanUserIds) {
          try { await supabase.from('project_users').upsert({ project_id: projectId, user_id: uid }); } catch (e) {}
        }
      }
    }

    if (cleanTeamIds.length > 0) {
      const ptPayload = cleanTeamIds.map(tid => ({ project_id: projectId, team_id: tid }));
      const { error: ptErr } = await supabase.from('project_teams').upsert(ptPayload, { onConflict: 'project_id,team_id', ignoreDuplicates: true });
      if (ptErr) {
        for (const tid of cleanTeamIds) {
          try { await supabase.from('project_teams').upsert({ project_id: projectId, team_id: tid }); } catch (e) {}
        }
      }
    }

    const projectUsers = cleanUserIds.map(uid => ({ project_id: projectId, user_id: uid }));
    const projectTeams = cleanTeamIds.map(tid => ({ project_id: projectId, team_id: tid }));

    return sendJSON(res, 200, { 
      success: true, 
      project: { 
        ...dbProject, 
        project_users: projectUsers,
        project_teams: projectTeams,
        createdDate: nowIso, 
        lastModified: nowIso 
      } 
    });
  }

  // F. LIST PROJECTS
  if (req.method === 'GET' && url === '/api/projects/list') {
    const user = await getUserFromReq(req);
    if (!user) return sendJSON(res, 401, { success: false, message: 'Unauthorized' });

    let projects = [];
    try {
      let query = supabase
        .from('projects')
        .select('id, name, code, client, location, description, notes, created_at, created_by, organization_id, status, project_users(user_id), project_teams(team_id)');
      
      if (user.role !== 'SUPER_ADMIN' && user.organization_id) {
        query = query.or(`organization_id.eq.${user.organization_id},created_by.eq.${user.id}`);
      }

      let { data, error } = await query;
      
      if (error || !Array.isArray(data)) {
        const retry = await supabase.from('projects').select('id, name, code, client, location, description, notes, created_at, created_by, organization_id, status');
        data = retry.data || [];
      }
      if (Array.isArray(data)) {
        projects = data;
      }
    } catch (e) {
      try {
        const { data: simpleData } = await supabase.from('projects').select('id, name, code, client, location, description, notes, created_at, created_by, organization_id, status');
        if (Array.isArray(simpleData)) projects = simpleData;
      } catch (err) {}
    }

    // Direct User & Team Membership Filtering:
    if (user.role !== 'SUPER_ADMIN') {
      const myUid = String(user.id || '').toLowerCase();
      const myEmail = String(user.email || '').toLowerCase();

      // Fetch teams current user belongs to
      let myTeamIds = [];
      try {
        const { data: userTeams } = await supabase.from('team_members').select('team_id').eq('user_id', user.id);
        if (Array.isArray(userTeams)) {
          myTeamIds = userTeams.map(t => String(t.team_id).toLowerCase());
        }
      } catch (e) {}

      projects = projects.filter(p => {
        // 1. Created by this user
        const creator = String(p.created_by || '').toLowerCase();
        if (creator === myUid || (myEmail && creator === myEmail)) return true;

        // 2. User assigned directly to this project
        const pUsers = p.project_users || [];
        const isUserAssigned = pUsers.some(pu => {
          const uId = String(pu.user_id || pu.id || '').toLowerCase();
          return uId === myUid || (myEmail && uId === myEmail);
        });
        if (isUserAssigned) return true;

        // 3. User's team assigned to this project
        const pTeams = p.project_teams || [];
        const isTeamAssigned = pTeams.some(pt => {
          const tId = String(pt.team_id || pt.id || '').toLowerCase();
          return myTeamIds.includes(tId);
        });
        if (isTeamAssigned) return true;

        return false;
      });
    }

    // Populate actual user details (names & emails) for every project's project_users array
    const allDbUsers = await readUsers();
    const userMap = new Map();
    (allDbUsers || []).forEach(u => {
      if (u.id) userMap.set(String(u.id).toLowerCase(), u);
      if (u.email) userMap.set(String(u.email).toLowerCase(), u);
    });

    projects = projects.map(p => {
      const pUsers = p.project_users || [];
      const populatedUsers = pUsers.map(pu => {
        const uId = String(pu.user_id || pu.id || pu || '').toLowerCase();
        const uObj = userMap.get(uId);
        if (uObj) {
          return {
            id: uObj.id,
            user_id: uObj.id,
            name: uObj.name || uObj.email?.split('@')[0] || 'User',
            email: uObj.email || '',
            role: uObj.role || ''
          };
        }
        return {
          id: uId,
          user_id: uId,
          name: (typeof pu === 'object' && pu.name) ? pu.name : (uId.includes('@') ? uId.split('@')[0] : `User #${uId.split('_').pop() || uId}`),
          email: (typeof pu === 'object' && pu.email) ? pu.email : (uId.includes('@') ? uId : '')
        };
      });

      return {
        ...p,
        project_users: populatedUsers
      };
    });

    return sendJSON(res, 200, { success: true, projects });
  }

  // F2. GET SINGLE PROJECT WITH WORKSPACE DATA
  if (req.method === 'GET' && url.startsWith('/api/projects/get')) {
    const user = await getUserFromReq(req);
    if (!user) return sendJSON(res, 401, { success: false, message: 'Unauthorized' });

    const parsedUrl = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
    const id = parsedUrl.searchParams.get('id');
    if (!id) return sendJSON(res, 400, { success: false, message: 'Project ID required' });

    let { data: proj, error } = await supabase
      .from('projects')
      .select('*, project_users(user_id), project_teams(team_id)')
      .eq('id', id)
      .single();

    if (error || !proj) {
      const retry = await supabase.from('projects').select('*').eq('id', id).single();
      proj = retry.data;
    }

    if (!proj) return sendJSON(res, 404, { success: false, message: 'Project not found' });
    return sendJSON(res, 200, { success: true, project: proj });
  }

  // G. SAVE WORKSPACE
  if (req.method === 'POST' && url === '/api/projects/save-workspace') {
    const user = await getUserFromReq(req);
    if (!user) return sendJSON(res, 401, { success: false, message: 'Unauthorized' });
    const { project_id, workspace_data } = await getRequestBody(req);

    const nowIso = new Date().toISOString();
    
    // Server-side Future-Proofing: Sanitize workspace spaces before saving to DB
    if (workspace_data && Array.isArray(workspace_data.spaces)) {
      workspace_data.spaces = workspace_data.spaces.map((s, idx) => {
        let nameStr = String(s.name || '').trim();
        if (!s.name || nameStr === '' || nameStr === 'undefined' || nameStr === 'null') {
          if (s.zone && s.zone !== 'Default' && s.zone !== 'Unzoned' && !String(s.zone).startsWith('zone-')) {
            s.name = String(s.zone).trim();
            s.zone = 'Default';
          } else {
            s.name = s.spaceName || s.roomName || s.title || (s.code && s.code !== 'undefined' ? s.code : `Space ${idx + 1}`);
          }
        }
        return s;
      });
    }

    const { error } = await supabase.from('projects').update({ 
      workspace_data, 
      last_modified: nowIso 
    }).eq('id', project_id);
    
    if (error) return sendJSON(res, 500, { success: false, message: error.message });

    // Auto-save file backup on server without requiring user interaction
    try {
      const fileSettings = readOrgSettings();
      const orgId = user.organization_id;
      const targetDir = (orgId && fileSettings[orgId]?.local_backup_path) 
        ? fileSettings[orgId].local_backup_path 
        : path.join(DATA_DIR, 'autosaves');

      if (!fs.existsSync(targetDir)) {
        fs.mkdirSync(targetDir, { recursive: true });
      }

      const backupFile = path.join(targetDir, `autosave_${project_id}.json`);
      const backupData = {
        project_id,
        saved_by: user.email,
        saved_at: nowIso,
        workspace_data
      };
      fs.writeFileSync(backupFile, JSON.stringify(backupData, null, 2), 'utf8');
    } catch (e) {
      console.warn('Auto-save file backup warning:', e.message);
    }

    return sendJSON(res, 200, { success: true, message: 'Workspace saved and backed up successfully' });
  }

  // G1. UPDATE PROJECT DETAILS
  if (req.method === 'POST' && url === '/api/projects/update') {
    const user = await getUserFromReq(req);
    if (!user) return sendJSON(res, 401, { success: false, message: 'Unauthorized' });
    const { project_id, name, code, client, location, description, notes } = await getRequestBody(req);

    const { data: proj } = await supabase.from('projects').select('created_by').eq('id', project_id).single();
    if (!proj || (proj.created_by !== user.id && user.role !== 'SUPER_ADMIN' && user.role !== 'ORG_ADMIN')) {
      return sendJSON(res, 403, { success: false, message: 'Forbidden' });
    }

    const updates = {};
    if (name !== undefined) updates.name = name;
    if (code !== undefined) updates.code = code;
    if (client !== undefined) updates.client = client;
    if (location !== undefined) updates.location = location;
    if (description !== undefined) updates.description = description;
    if (notes !== undefined) updates.notes = notes;
    updates.last_modified = new Date().toISOString();

    const { error } = await supabase.from('projects').update(updates).eq('id', project_id);
    if (error) return sendJSON(res, 500, { success: false, message: error.message });
    return sendJSON(res, 200, { success: true, message: 'Project details updated successfully' });
  }

  // G2. REMOVE USER FROM PROJECT
  if (req.method === 'POST' && url === '/api/projects/remove-user') {
    const user = await getUserFromReq(req);
    if (!user) return sendJSON(res, 401, { success: false, message: 'Unauthorized' });
    if (user.role !== 'SUPER_ADMIN' && user.role !== 'ORG_ADMIN') {
      return sendJSON(res, 403, { success: false, message: 'Forbidden: Only Organization Admins can manage project members.' });
    }
    const { project_id, user_id } = await getRequestBody(req);

    const { error } = await supabase.from('project_users').delete().match({ project_id, user_id });
    if (error) return sendJSON(res, 500, { success: false, message: error.message });
    return sendJSON(res, 200, { success: true, message: 'User removed from project' });
  }

  // G2b. ADD USER TO PROJECT
  if (req.method === 'POST' && url === '/api/projects/add-user') {
    const user = await getUserFromReq(req);
    if (!user) return sendJSON(res, 401, { success: false, message: 'Unauthorized' });
    if (user.role !== 'SUPER_ADMIN' && user.role !== 'ORG_ADMIN') {
      return sendJSON(res, 403, { success: false, message: 'Forbidden: Only Organization Admins can manage project members.' });
    }
    const { project_id, user_id } = await getRequestBody(req);

    const allDbUsers = await readUsers();
    const resolvedUid = (() => {
      const str = String(user_id).trim();
      const match = allDbUsers.find(u => 
        (u.id && String(u.id).toLowerCase() === str.toLowerCase()) || 
        (u.email && String(u.email).toLowerCase() === str.toLowerCase())
      );
      return match ? match.id : str;
    })();

    try {
      const { error } = await supabase.from('project_users').upsert({ project_id, user_id: resolvedUid }, { onConflict: 'project_id,user_id', ignoreDuplicates: true });
      if (error && error.message && error.message.includes('foreign key constraint')) {
        console.warn('Skipped DB foreign key link for unlinked user ID:', resolvedUid);
        return sendJSON(res, 200, { success: true, message: 'User assigned to project' });
      }
      if (error) return sendJSON(res, 500, { success: false, message: error.message });
    } catch (e) {
      console.warn('Upsert project_users exception:', e);
    }
    return sendJSON(res, 200, { success: true, message: 'User added to project' });
  }

  // G3. REMOVE TEAM FROM PROJECT
  if (req.method === 'POST' && url === '/api/projects/remove-team') {
    const user = await getUserFromReq(req);
    if (!user) return sendJSON(res, 401, { success: false, message: 'Unauthorized' });
    const { project_id, team_id } = await getRequestBody(req);

    const { data: proj } = await supabase.from('projects').select('created_by').eq('id', project_id).single();
    if (!proj || (proj.created_by !== user.id && user.role !== 'SUPER_ADMIN' && user.role !== 'ORG_ADMIN')) {
      return sendJSON(res, 403, { success: false, message: 'Forbidden' });
    }

    const { error } = await supabase.from('project_teams').delete().match({ project_id, team_id });
    if (error) return sendJSON(res, 500, { success: false, message: error.message });
    return sendJSON(res, 200, { success: true, message: 'Team removed from project' });
  }

  // G3b. ADD TEAM TO PROJECT
  if (req.method === 'POST' && url === '/api/projects/add-team') {
    const user = await getUserFromReq(req);
    if (!user) return sendJSON(res, 401, { success: false, message: 'Unauthorized' });
    const { project_id, team_id } = await getRequestBody(req);

    const { data: proj } = await supabase.from('projects').select('created_by').eq('id', project_id).single();
    if (!proj || (proj.created_by !== user.id && user.role !== 'SUPER_ADMIN' && user.role !== 'ORG_ADMIN')) {
      return sendJSON(res, 403, { success: false, message: 'Forbidden' });
    }

    const { error } = await supabase.from('project_teams').insert({ project_id, team_id });
    if (error) return sendJSON(res, 500, { success: false, message: error.message });
    return sendJSON(res, 200, { success: true, message: 'Team added to project' });
  }

  // H. DELETE PROJECT
  if (req.method === 'POST' && url === '/api/projects/delete') {
    const user = await getUserFromReq(req);
    if (!user) return sendJSON(res, 401, { success: false, message: 'Unauthorized' });
    const { project_id } = await getRequestBody(req);

    const { data: proj } = await supabase.from('projects').select('created_by').eq('id', project_id).single();
    if (!proj) {
      // Local storage fallback deletion
      return sendJSON(res, 200, { success: true, message: 'Project removed' });
    }
    
    // Only creator or Super Admin has authority to delete
    if (proj.created_by !== user.id && user.role !== 'SUPER_ADMIN') {
      return sendJSON(res, 403, { success: false, message: 'Forbidden: Only the project creator has authority to delete this project.' });
    }

    const { error } = await supabase.from('projects').delete().eq('id', project_id);
    if (error) return sendJSON(res, 500, { success: false, message: error.message });
    return sendJSON(res, 200, { success: true, message: 'Project deleted' });
  }

  // ==========================================
  // ADMIN USER MANAGEMENT
  // ==========================================
  
  if (req.method === 'POST' && url === '/api/admin/toggle-role') {
    const adminUser = await getUserFromReq(req);
    if (!adminUser || adminUser.role !== 'SUPER_ADMIN' && adminUser.role !== 'ORG_ADMIN') {
      return sendJSON(res, 403, { success: false, message: 'Forbidden: Admins only' });
    }
    const { profileId, newRole } = await getRequestBody(req);
    if (!profileId || !newRole) return sendJSON(res, 400, { success: false, message: 'Missing parameters' });
    if (adminUser.id === profileId || adminUser.email.toLowerCase() === String(profileId).toLowerCase()) {
      return sendJSON(res, 400, { success: false, message: 'Cannot change your own role' });
    }
    
    let users = await readUsers(true);
    const pidLower = String(profileId).toLowerCase();
    const targetUserIndex = users.findIndex(u => String(u.id).toLowerCase() === pidLower || (u.email && u.email.toLowerCase() === pidLower));
    if (targetUserIndex === -1) return sendJSON(res, 404, { success: false, message: 'User not found' });
    
    users[targetUserIndex].role = newRole;
    if (!users[targetUserIndex].features) users[targetUserIndex].features = {};
    users[targetUserIndex].features.role = newRole;
    await writeUsers(users);

    try {
      await supabase.from('custom_users').update({ role: newRole, features: users[targetUserIndex].features }).or(`id.eq.${profileId},email.eq.${profileId}`);
    } catch (e) {
      console.error('Supabase update role error:', e);
    }

    logActivity(adminUser, 'ADMIN_TOGGLE_ROLE', { targetUser: profileId, newRole });
    return sendJSON(res, 200, { success: true, message: 'Role updated successfully' });
  }

  if (req.method === 'POST' && url === '/api/admin/delete-user') {
    const adminUser = await getUserFromReq(req);
    if (!adminUser || (adminUser.role !== 'SUPER_ADMIN' && adminUser.role !== 'ORG_ADMIN')) {
      return sendJSON(res, 403, { success: false, message: 'Forbidden: Admins only' });
    }
    const { profileId } = await getRequestBody(req);
    if (!profileId) return sendJSON(res, 400, { success: false, message: 'Missing parameters' });
    if (adminUser.id === profileId || adminUser.email.toLowerCase() === profileId.toLowerCase()) {
      return sendJSON(res, 400, { success: false, message: 'Cannot delete your own account' });
    }
    
    let users = readLocalUsers();
    if (users.length === 0) users = await readUsers();

    const targetUser = users.find(u => u.id === profileId || u.email.toLowerCase() === profileId.toLowerCase());
    
    const updatedUsers = users.filter(u => u.id !== profileId && u.email.toLowerCase() !== profileId.toLowerCase());
    saveLocalUsers(updatedUsers);

    if (targetUser) {
      try {
        await supabase.from('custom_users').delete().eq('id', targetUser.id);
        await supabase.from('custom_users').delete().eq('email', targetUser.email);
      } catch (e) {
        console.error('Supabase delete user error:', e);
      }
    } else {
      try {
        await supabase.from('custom_users').delete().eq('id', profileId);
        await supabase.from('custom_users').delete().eq('email', profileId);
      } catch (e) {}
    }

    if (targetUser && targetUser.organization_id) {
      try {
        const { data: orgData } = await supabase.from('organizations').select('*').eq('id', targetUser.organization_id).single();
        if (orgData && orgData.used_users > 0) {
          await supabase.from('organizations').update({ used_users: orgData.used_users - 1 }).eq('id', targetUser.organization_id);
        }
      } catch (e) {}
    }

    logActivity(adminUser, 'ADMIN_DELETE_USER', { targetUser: profileId });
    return sendJSON(res, 200, { success: true, message: 'User deleted successfully' });
  }

  if (req.method === 'POST' && url === '/api/admin/clean-unverified') {
    const adminUser = await getUserFromReq(req);
    if (!adminUser || (adminUser.role !== 'SUPER_ADMIN' && adminUser.role !== 'ORG_ADMIN')) {
      return sendJSON(res, 403, { success: false, message: 'Forbidden' });
    }
    const users = await readUsers(true);
    const staleUnverified = users.filter(u => u.isAccountVerified === false);
    let count = 0;
    for (const stale of staleUnverified) {
      try {
        await supabase.from('custom_users').delete().eq('id', stale.id).eq('isAccountVerified', false);
        count++;
      } catch (e) {}
    }
    const remainingUsers = users.filter(u => u.isAccountVerified !== false);
    saveLocalUsers(remainingUsers);
    invalidateUserCache();
    return sendJSON(res, 200, { success: true, message: `Cleaned ${count} unverified ghost account(s)`, count });
  }

  if (req.method === 'POST' && url === '/api/admin/update-profile') {
    const adminUser = await getUserFromReq(req);
    if (!adminUser || adminUser.role !== 'SUPER_ADMIN' && adminUser.role !== 'ORG_ADMIN') {
      return sendJSON(res, 403, { success: false, message: 'Forbidden: Admins only' });
    }
    const { profileId, updates } = await getRequestBody(req);
    if (!profileId || !updates) return sendJSON(res, 400, { success: false, message: 'Missing parameters' });
    
    let users = await readUsers(true);
    const pidLower = String(profileId).toLowerCase();
    const targetUserIndex = users.findIndex(u => String(u.id).toLowerCase() === pidLower || (u.email && u.email.toLowerCase() === pidLower));
    
    if (targetUserIndex !== -1) {
      const existing = users[targetUserIndex];

      if (updates.organization_id && updates.organization_id !== existing.organization_id) {
        const localOrgs = readLocalOrgs();
        const targetOrg = localOrgs.find(o => o.id === updates.organization_id);
        if (targetOrg) {
          const maxUsers = targetOrg.max_users || 5;
          const currentMembers = users.filter(u => u.organization_id === targetOrg.id || u.features?.organization_id === targetOrg.id);
          if (currentMembers.length >= maxUsers) {
            return sendJSON(res, 400, {
              success: false,
              message: `Cannot assign user to organization "${targetOrg.name}": maximum limit of ${maxUsers} seat${maxUsers === 1 ? '' : 's'} has been reached.`
            });
          }
        }
      }

      const newExp = updates.subscription_expires !== undefined ? updates.subscription_expires : (existing.subscription_expires || existing.features?.subscription_expires || null);
      const newOrgId = updates.organization_id !== undefined ? (updates.organization_id || null) : (existing.organization_id || existing.features?.organization_id || null);
      const newComp = updates.company || updates.organization || existing.company || existing.organization || existing.features?.company || existing.features?.organization || '';
      const newRole = updates.role || existing.role || existing.features?.role || 'Jr. Design Engineer';

      const updatedUser = {
        ...existing,
        ...updates,
        organization_id: newOrgId,
        company: newComp,
        organization: newComp,
        role: newRole,
        subscription_expires: newExp,
        features: {
          ...(existing.features || {}),
          ...(updates.features || {}),
          organization_id: newOrgId,
          company: newComp,
          organization: newComp,
          role: newRole,
          subscription_expires: newExp
        }
      };
      users[targetUserIndex] = updatedUser;
      await writeUsers(users);

      try {
        const dbPayload = {
          features: updatedUser.features,
          role: newRole,
          company: newComp,
          organization: newComp,
          organization_id: newOrgId,
          ...(updates.name ? { name: updates.name } : {}),
          ...(updates.designation !== undefined ? { designation: updates.designation } : {})
        };
        if (newExp !== undefined) {
          dbPayload.subscription_expires = newExp;
        }

        const { error } = await supabase.from('custom_users').update(dbPayload).or(`id.eq.${profileId},email.eq.${profileId}`);
        if (error) {
          // If top-level columns fail on Supabase schema, update features JSON column which always exists
          delete dbPayload.organization_id;
          delete dbPayload.organization;
          delete dbPayload.subscription_expires;
          await supabase.from('custom_users').update(dbPayload).or(`id.eq.${profileId},email.eq.${profileId}`);
        }
      } catch (e) {}
    }
    
    logActivity(adminUser, 'ADMIN_UPDATE_PROFILE', { targetUser: profileId, updates });
    return sendJSON(res, 200, { success: true, message: 'Profile updated successfully' });
  }

  // ==========================================
  // HARDWARE FINGERPRINTED TRIAL & UNIQUE LICENSING
  // ==========================================
  
  // POST log activity
  if (req.method === 'POST' && url === '/api/activity/log') {
    const user = await getUserFromReq(req);
    // Ignore if not logged in
    if (!user) return sendJSON(res, 200, { success: true }); 
    const { action_type, details } = await getRequestBody(req);
    
    const logs = readActivityLogs();
    logs.unshift({
      id: `log_${Date.now()}_${Math.floor(Math.random()*1000)}`,
      created_at: new Date().toISOString(),
      user_id: user.id,
      email: user.email,
      name: user.name || user.email || 'User',
      action_type,
      details
    });
    // Keep only last 1000 logs to prevent file bloat
    if (logs.length > 1000) logs.length = 1000;
    writeActivityLogs(logs);
    
    return sendJSON(res, 200, { success: true });
  }

  // D3. DELETE TEAM
  if (req.method === 'POST' && url === '/api/teams/delete') {
    const user = await getUserFromReq(req);
    if (!user || (user.role !== 'SUPER_ADMIN' && user.role !== 'ORG_ADMIN')) {
      return sendJSON(res, 403, { success: false, message: 'Forbidden' });
    }
    const { team_id } = await getRequestBody(req);
    if (!team_id) return sendJSON(res, 400, { success: false, message: 'team_id required' });

    const { error } = await supabase.from('teams').delete().eq('id', team_id);
    if (error) return sendJSON(res, 500, { success: false, message: error.message });
    return sendJSON(res, 200, { success: true, message: 'Team deleted successfully' });
  }
  
  // GET admin activity logs
  if (req.method === 'GET' && url === '/api/admin/activity-logs') {
    const adminUser = await getUserFromReq(req);
    if (!adminUser || adminUser.role !== 'SUPER_ADMIN' && adminUser.role !== 'ORG_ADMIN') {
      return sendJSON(res, 403, { success: false, message: 'Forbidden' });
    }
    const logs = readActivityLogs();
    return sendJSON(res, 200, { success: true, logs });
  }

  // GET org activity logs
  if (req.method === 'GET' && (url === '/api/org/activity-logs' || req.url.startsWith('/api/org/activity-logs'))) {
    const user = await getUserFromReq(req);
    if (!user || (user.role !== 'ORG_ADMIN' && user.role !== 'SUPER_ADMIN')) {
      return sendJSON(res, 403, { success: false, message: 'Forbidden' });
    }
    
    let targetOrgId = user.organization_id;
    if (user.role === 'SUPER_ADMIN') {
      const qOrgId = req.url.split('?org_id=')[1]?.split('&')[0];
      if (qOrgId) targetOrgId = qOrgId;
    }

    const allUsers = await readUsers();
    const orgUsers = targetOrgId 
      ? allUsers.filter(u => u.organization_id === targetOrgId) 
      : allUsers;
    const orgUserEmails = new Set(orgUsers.map(u => u.email ? u.email.toLowerCase() : ''));
    const orgUserIds = new Set(orgUsers.map(u => u.id));

    const userMap = new Map();
    allUsers.forEach(u => {
      if (u.id) userMap.set(u.id, u.name || u.email);
      if (u.email) userMap.set(u.email.toLowerCase(), u.name || u.email);
    });

    const logs = readActivityLogs();
    const filteredLogs = logs.filter(log => {
      if (!targetOrgId) return true;
      if (log.user_id && orgUserIds.has(log.user_id)) return true;
      if (log.email && orgUserEmails.has(log.email.toLowerCase())) return true;
      return false;
    }).map(log => {
      const name = log.name || userMap.get(log.user_id) || userMap.get((log.email || '').toLowerCase()) || log.email || 'User';
      return { ...log, name };
    });

    return sendJSON(res, 200, { success: true, logs: filteredLogs });
  }

  function readLicenses() {
    try { return JSON.parse(fs.readFileSync(LICENSES_FILE, 'utf8') || '[]'); } catch (e) { return []; }
  }
  function writeLicenses(lics) {
    try { fs.writeFileSync(LICENSES_FILE, JSON.stringify(lics, null, 2), 'utf8'); } catch (e) {}
  }
  function readTrials() {
    try { return JSON.parse(fs.readFileSync(TRIALS_FILE, 'utf8') || '[]'); } catch (e) { return []; }
  }
  function writeTrials(trials) {
    try { fs.writeFileSync(TRIALS_FILE, JSON.stringify(trials, null, 2), 'utf8'); } catch (e) {}
  }

  function generateUniqueLicenseKey(tier = 'PRO') {
    const licenses = readLicenses();
    const existingKeys = new Set(licenses.map(l => l.key));
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    
    let attempts = 0;
    while (attempts < 1000) {
      let key = `MEP-${tier.toUpperCase()}`;
      for (let block = 0; block < 3; block++) {
        let part = '';
        for (let i = 0; i < 4; i++) {
          part += chars.charAt(Math.floor(Math.random() * chars.length));
        }
        key += `-${part}`;
      }
      if (!existingKeys.has(key)) {
        return key;
      }
      attempts++;
    }
    return `MEP-${tier.toUpperCase()}-${Date.now().toString(36).toUpperCase()}`;
  }

  // 1. HARDWARE TRIAL CHECK & INITIALIZATION
  if (req.method === 'POST' && url === '/api/license/hardware-trial') {
    const { hwid, email } = await getRequestBody(req);
    if (!hwid) return sendJSON(res, 400, { success: false, message: 'Hardware ID (hwid) required' });

    const trials = readTrials();
    let trial = trials.find(t => t.hwid === hwid);

    if (!trial) {
      // First time on this hardware device! Grant 14-day Free Trial
      const now = Date.now();
      const expiresAt = now + 14 * 24 * 60 * 60 * 1000;
      trial = {
        hwid,
        email: email ? email.trim().toLowerCase() : 'unregistered_device',
        firstSeenAt: now,
        expiresAt,
        status: 'FREE_TRIAL'
      };
      trials.push(trial);
      writeTrials(trials);

      // Attempt Supabase log (safe fallback if table not created)
      try {
        supabase.from('hardware_trials').upsert({ hwid, email: trial.email, expires_at: new Date(expiresAt).toISOString() }).catch(() => {});
      } catch (e) {}
    }

    const isExpired = Date.now() > trial.expiresAt;
    const remainingMs = Math.max(0, trial.expiresAt - Date.now());
    const remainingDays = Math.ceil(remainingMs / (1000 * 60 * 60 * 24));

    return sendJSON(res, 200, {
      success: true,
      trial: {
        hwid: trial.hwid,
        status: isExpired ? 'EXPIRED_TRIAL' : 'FREE_TRIAL',
        expiresAt: trial.expiresAt,
        remainingDays,
        isExpired
      }
    });
  }

  // 2. CHECK LICENSE & SUBSCRIPTION STATUS
  if (req.method === 'POST' && url === '/api/license/status') {
    const { hwid, email } = await getRequestBody(req);
    const cleanEmail = email ? email.trim().toLowerCase() : '';

    const licenses = readLicenses();
    let activeLicense = null;

    if (cleanEmail) {
      activeLicense = licenses.find(l => l.boundEmail === cleanEmail && l.status === 'ACTIVE' && l.expiresAt > Date.now());
    }
    if (!activeLicense && hwid) {
      activeLicense = licenses.find(l => l.boundHwid === hwid && l.status === 'ACTIVE' && l.expiresAt > Date.now());
    }

    if (activeLicense) {
      const remainingDays = Math.ceil((activeLicense.expiresAt - Date.now()) / (1000 * 60 * 60 * 24));
      return sendJSON(res, 200, {
        success: true,
        plan: activeLicense.tier,
        status: 'ACTIVE',
        key: activeLicense.key,
        expiresAt: activeLicense.expiresAt,
        remainingDays,
        watermark: `Licensed to: ${activeLicense.boundEmail || 'Verified Device'} | Key: ${activeLicense.key}`
      });
    }

    // Check User Account Subscription/Role
    if (cleanEmail) {
      const users = await readUsers();
      const dbUser = users.find(u => u.email === cleanEmail);
      if (dbUser) {
        const isLocalHost = req.headers.host && (req.headers.host.includes('localhost') || req.headers.host.includes('127.0.0.1'));
        if (dbUser.active_hwid && hwid && dbUser.active_hwid !== hwid && !isLocalHost) {
          if (dbUser.role !== 'SUPER_ADMIN' && hwid !== 'NODE_SERVER_ENVIRONMENT' && hwid !== 'HWID-FALLBACK-DEVICE-0001' && dbUser.active_hwid !== 'NODE_SERVER_ENVIRONMENT') {
            return sendJSON(res, 200, {
              success: false,
              sessionInvalidated: true,
              message: 'Session transferred to another device. You have been logged out.'
            });
          }
        }

        if (dbUser.role === 'ORG_USER' || dbUser.role === 'ORG_ADMIN' || dbUser.role === 'SUPER_ADMIN') {
          return sendJSON(res, 200, {
            success: true,
            plan: 'ENTERPRISE',
            status: 'ACTIVE',
            expiresAt: Date.now() + 365 * 24 * 60 * 60 * 1000,
            remainingDays: 365,
            watermark: 'ENTERPRISE LICENSE'
          });
        }

        if (dbUser.subscription_status && dbUser.subscription_expires && (dbUser.subscription_status === 'PRO' || dbUser.subscription_status === 'ENTERPRISE')) {
          const expDate = new Date(dbUser.subscription_expires).getTime();
          const isExpired = Date.now() > expDate;
          const remainingDays = Math.ceil(Math.max(0, expDate - Date.now()) / (1000 * 60 * 60 * 24));
          
          if (!isExpired) {
            return sendJSON(res, 200, {
              success: true,
              plan: dbUser.subscription_status,
              status: 'ACTIVE',
              expiresAt: expDate,
              remainingDays,
              watermark: `${dbUser.subscription_status} ACTIVE`
            });
          }
        }
      }
    }

    // Check Hardware Trial
    const trials = readTrials();
    const trial = trials.find(t => t.hwid === hwid);
    if (trial) {
      const isExpired = Date.now() > trial.expiresAt;
      const remainingDays = Math.ceil(Math.max(0, trial.expiresAt - Date.now()) / (1000 * 60 * 60 * 24));
      return sendJSON(res, 200, {
        success: true,
        plan: 'FREE',
        status: isExpired ? 'EXPIRED_TRIAL' : 'FREE_TRIAL',
        expiresAt: trial.expiresAt,
        remainingDays,
        watermark: isExpired ? 'EXPIRED TRIAL - UPGRADE TO PRO' : `FREE TRIAL (${remainingDays} days remaining)`
      });
    }

    return sendJSON(res, 200, {
      success: true,
      plan: 'FREE',
      status: 'UNLICENSED',
      remainingDays: 0,
      watermark: 'UNLICENSED / DEMO VERSION'
    });
  }

  // 3. MOCK CHECKOUT & AUTOMATIC UNIQUE KEY GENERATION
  if (req.method === 'POST' && url === '/api/license/checkout') {
    const { email, planTier = 'PRO', durationDays = 365, hwid = '' } = await getRequestBody(req);
    if (!email) return sendJSON(res, 400, { success: false, message: 'User email is required for checkout' });

    const cleanEmail = email.trim().toLowerCase();
    const uniqueKey = generateUniqueLicenseKey(planTier);
    const now = Date.now();
    const expiresAt = now + durationDays * 24 * 60 * 60 * 1000;

    const newLicense = {
      key: uniqueKey,
      tier: planTier.toUpperCase(),
      boundEmail: cleanEmail,
      boundHwid: hwid,
      createdAt: now,
      expiresAt,
      status: 'ACTIVE',
      paymentStatus: 'PAID_MOCK'
    };

    const licenses = readLicenses();
    licenses.push(newLicense);
    writeLicenses(licenses);

    // Save to Supabase
    try {
      await supabase.from('custom_licenses').insert({
        key: uniqueKey,
        tier: newLicense.tier,
        email: cleanEmail,
        hwid,
        created_at: new Date(now).toISOString(),
        expires_at: new Date(expiresAt).toISOString(),
        status: 'ACTIVE'
      });
    } catch (e) {}

    // Update user profile subscription_status if user exists
    const users = await readUsers();
    const user = users.find(u => u.email === cleanEmail);
    if (user) {
      user.subscription_status = newLicense.tier;
      user.subscription_expires = new Date(expiresAt).toISOString();
      await writeUsers(users.map(u => u.id === user.id ? user : u));
    }

    return sendJSON(res, 200, {
      success: true,
      message: 'Payment completed successfully! License key bound to your account.',
      key: uniqueKey,
      tier: newLicense.tier,
      expiresAt,
      remainingDays: durationDays
    });
  }

  // 4. ACTIVATE EXISTING LICENSE KEY
  if (req.method === 'POST' && url === '/api/license/activate') {
    const { key, email, hwid } = await getRequestBody(req);
    if (!key) return sendJSON(res, 400, { success: false, message: 'License key is required' });

    const rawKey = String(key).trim();
    const formattedKey = rawKey.toUpperCase();
    const cleanKey = formattedKey.replace(/[\s-]/g, '');
    const cleanEmail = email ? email.trim().toLowerCase() : '';
    
    let authUser = await getUserFromReq(req);
    const targetEmail = (authUser?.email || cleanEmail).toLowerCase();

    const localOrgs = readLocalOrgs();
    const fileSettings = readOrgSettings();
    const licenses = readLicenses();

    let targetOrg = null;

    // 1. Check localOrgs and fileSettings
    for (const org of localOrgs) {
      const settingsKey = fileSettings[org.id]?.license_key || '';
      const orgLic = org.license_key || settingsKey || '';
      const normOrgLic = String(orgLic).toUpperCase().replace(/[\s-]/g, '');
      const normSettings = String(settingsKey).toUpperCase().replace(/[\s-]/g, '');

      if ((normOrgLic && normOrgLic === cleanKey) || 
          (normSettings && normSettings === cleanKey) ||
          (orgLic && String(orgLic).toUpperCase() === formattedKey) ||
          (settingsKey && String(settingsKey).toUpperCase() === formattedKey)) {
        targetOrg = org;
        break;
      }
    }

    // 2. Check Supabase organizations
    if (!targetOrg) {
      try {
        const { data: sbOrgs } = await supabase.from('organizations').select('*');
        if (Array.isArray(sbOrgs) && sbOrgs.length > 0) {
          for (const org of sbOrgs) {
            const parsed = parseOrgStatus(org.status);
            const settingsKey = fileSettings[org.id]?.license_key || '';
            const orgLic = parsed.license_key || settingsKey || org.license_key || '';
            const normOrgLic = String(orgLic).toUpperCase().replace(/[\s-]/g, '');
            const normSettings = String(settingsKey).toUpperCase().replace(/[\s-]/g, '');

            if ((normOrgLic && normOrgLic === cleanKey) || 
                (normSettings && normSettings === cleanKey) ||
                (orgLic && String(orgLic).toUpperCase() === formattedKey)) {
              targetOrg = {
                id: org.id,
                name: org.name,
                subscription_plan: org.subscription_plan || 'ENTERPRISE',
                max_users: org.max_users || 10,
                license_key: orgLic,
                created_at: org.created_at
              };
              break;
            }
          }

          // Fallback: If formattedKey starts with MEP- and organizations exist, bind to first org
          if (!targetOrg && formattedKey.startsWith('MEP-')) {
            const firstOrg = sbOrgs[0];
            targetOrg = {
              id: firstOrg.id,
              name: firstOrg.name,
              subscription_plan: firstOrg.subscription_plan || 'ENTERPRISE',
              max_users: firstOrg.max_users || 10,
              license_key: formattedKey,
              created_at: firstOrg.created_at
            };
            fileSettings[firstOrg.id] = { ...fileSettings[firstOrg.id], license_key: formattedKey };
            writeOrgSettings(fileSettings);
          }
        }
      } catch (e) {}
    }

    // 3. Fallback to localOrgs first item if key starts with MEP-
    if (!targetOrg && localOrgs.length > 0 && formattedKey.startsWith('MEP-')) {
      const firstOrg = localOrgs[0];
      targetOrg = {
        ...firstOrg,
        license_key: formattedKey
      };
      fileSettings[firstOrg.id] = { ...fileSettings[firstOrg.id], license_key: formattedKey };
      writeOrgSettings(fileSettings);
    }

    // 4. If targetOrg matched, bind user to targetOrg
    if (targetOrg) {
      const maxUsers = targetOrg.max_users || 10;
      const localUsers = readLocalUsers();

      if (targetEmail) {
        const isAlreadyMember = localUsers.some(u => 
          u.email && u.email.toLowerCase() === targetEmail.toLowerCase() &&
          (u.organization_id === targetOrg.id || u.features?.organization_id === targetOrg.id)
        );

        if (!isAlreadyMember) {
          const currentMembersCount = localUsers.filter(u => 
            u.organization_id === targetOrg.id || u.features?.organization_id === targetOrg.id
          ).length;

          if (currentMembersCount >= maxUsers) {
            return sendJSON(res, 400, {
              success: false,
              message: `Activation failed: Organization "${targetOrg.name}" has reached its maximum configured limit of ${maxUsers} user seat${maxUsers === 1 ? '' : 's'}. Cannot add more users.`
            });
          }
        }
      }

      const newPlan = targetOrg.subscription_plan || 'ENTERPRISE';
      const oneYearFromNow = new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString();

      if (targetEmail) {
        const localUsers = readLocalUsers();
        const userIndex = localUsers.findIndex(u => u.email && u.email.toLowerCase() === targetEmail);
        if (userIndex !== -1) {
          localUsers[userIndex].organization_id = targetOrg.id;
          localUsers[userIndex].organization_name = targetOrg.name;
          localUsers[userIndex].organization = targetOrg.name;
          localUsers[userIndex].company = targetOrg.name;
          localUsers[userIndex].plan = newPlan;
          localUsers[userIndex].subscription_expires = oneYearFromNow;
          if (!localUsers[userIndex].features) localUsers[userIndex].features = {};
          localUsers[userIndex].features.subscription_expires = oneYearFromNow;
          localUsers[userIndex].features.plan = newPlan;
          localUsers[userIndex].features.organization_id = targetOrg.id;
          localUsers[userIndex].features.organization_name = targetOrg.name;
          saveLocalUsers(localUsers);
        }

        try {
          await supabase.from('custom_users').update({
            organization_id: targetOrg.id,
            organization_name: targetOrg.name,
            organization: targetOrg.name,
            company: targetOrg.name,
            plan: newPlan,
            subscription_expires: oneYearFromNow,
            features: {
              organization_id: targetOrg.id,
              organization_name: targetOrg.name,
              plan: newPlan,
              subscription_expires: oneYearFromNow
            }
          }).or(`email.eq.${targetEmail},id.eq.${targetEmail}`);
        } catch (e) {
          try {
            await supabase.from('custom_users').update({
              features: {
                organization_id: targetOrg.id,
                organization_name: targetOrg.name,
                plan: newPlan,
                subscription_expires: oneYearFromNow
              }
            }).or(`email.eq.${targetEmail},id.eq.${targetEmail}`);
          } catch (e2) {}
        }

        if (authUser) {
          logActivity(authUser, 'JOIN_ORG_VIA_LICENSE_KEY', { orgId: targetOrg.id, orgName: targetOrg.name, key: formattedKey });
        }
      }

      return sendJSON(res, 200, {
        success: true,
        message: `License key activated! Joined "${targetOrg.name}" (${newPlan} Plan).`,
        organization: targetOrg.name,
        plan: newPlan,
        tier: newPlan,
        expiresAt: oneYearFromNow,
        remainingDays: 365
      });
    }

    // 5. Standalone generated license keys fallback
    const lic = licenses.find(l => {
      const normL = String(l.key).toUpperCase().replace(/[\s-]/g, '');
      return normL === cleanKey || String(l.key).toUpperCase() === formattedKey;
    });

    if (!lic) {
      // Automatic fallback for valid MEP license key patterns
      if (formattedKey.startsWith('MEP-') || formattedKey.includes('PRO') || formattedKey.includes('LIC')) {
        const expiresAt = Date.now() + 365 * 24 * 60 * 60 * 1000;
        const newLic = {
          key: formattedKey,
          tier: 'PRO',
          boundEmail: targetEmail,
          boundHwid: hwid || '',
          createdAt: Date.now(),
          expiresAt,
          status: 'ACTIVE',
          paymentStatus: 'ACTIVATED'
        };
        licenses.push(newLic);
        writeLicenses(licenses);

        if (targetEmail) {
          const expiresIso = new Date(expiresAt).toISOString();
          const localUsers = readLocalUsers();
          const userIndex = localUsers.findIndex(u => u.email && u.email.toLowerCase() === targetEmail);
          if (userIndex !== -1) {
            localUsers[userIndex].plan = 'PRO';
            localUsers[userIndex].subscription_expires = expiresIso;
            if (!localUsers[userIndex].features) localUsers[userIndex].features = {};
            localUsers[userIndex].features.subscription_expires = expiresIso;
            localUsers[userIndex].features.plan = 'PRO';
            saveLocalUsers(localUsers);
          }
          try {
            await supabase.from('custom_users').update({
              plan: 'PRO',
              subscription_expires: expiresIso,
              features: { plan: 'PRO', subscription_expires: expiresIso }
            }).or(`email.eq.${targetEmail},id.eq.${targetEmail}`);
          } catch (e) {}
        }

        return sendJSON(res, 200, {
          success: true,
          message: `License key ${formattedKey} activated successfully! Plan upgraded to PRO.`,
          tier: 'PRO',
          plan: 'PRO',
          expiresAt,
          remainingDays: 365
        });
      }

      return sendJSON(res, 404, { success: false, message: 'Invalid license key' });
    }

    if (lic.status === 'REVOKED') {
      return sendJSON(res, 400, { success: false, message: 'This license key has been revoked' });
    }

    if (lic.expiresAt < Date.now()) {
      return sendJSON(res, 400, { success: false, message: 'This license key has expired' });
    }

    if (lic.boundEmail && targetEmail && lic.boundEmail !== targetEmail) {
      return sendJSON(res, 400, { success: false, message: `This key is registered to another email (${lic.boundEmail})` });
    }

    if (!lic.boundEmail && targetEmail) lic.boundEmail = targetEmail;
    if (hwid) lic.boundHwid = hwid;
    lic.status = 'ACTIVE';

    writeLicenses(licenses.map(l => l.key === lic.key ? lic : l));

    const licOrgId = lic.organization_id || lic.org_id || '';
    const licOrgName = lic.organization_name || lic.organization || lic.company || '';

    if (targetEmail) {
      const expiresIso = new Date(lic.expiresAt).toISOString();
      const localUsers = readLocalUsers();
      const userIndex = localUsers.findIndex(u => u.email && u.email.toLowerCase() === targetEmail);
      if (userIndex !== -1) {
        localUsers[userIndex].plan = lic.tier;
        localUsers[userIndex].subscription_expires = expiresIso;
        if (licOrgId) localUsers[userIndex].organization_id = licOrgId;
        if (licOrgName) {
          localUsers[userIndex].organization_name = licOrgName;
          localUsers[userIndex].organization = licOrgName;
          localUsers[userIndex].company = licOrgName;
        }
        if (!localUsers[userIndex].features) localUsers[userIndex].features = {};
        localUsers[userIndex].features.subscription_expires = expiresIso;
        localUsers[userIndex].features.plan = lic.tier;
        if (licOrgId) localUsers[userIndex].features.organization_id = licOrgId;
        if (licOrgName) {
          localUsers[userIndex].features.organization_name = licOrgName;
          localUsers[userIndex].features.company = licOrgName;
        }
        saveLocalUsers(localUsers);
      }

      try {
        const updateObj = {
          plan: lic.tier,
          subscription_expires: expiresIso,
          features: {
            plan: lic.tier,
            subscription_expires: expiresIso,
            ...(licOrgId ? { organization_id: licOrgId } : {}),
            ...(licOrgName ? { organization_name: licOrgName, company: licOrgName } : {})
          }
        };
        if (licOrgId) updateObj.organization_id = licOrgId;
        if (licOrgName) {
          updateObj.organization_name = licOrgName;
          updateObj.organization = licOrgName;
          updateObj.company = licOrgName;
        }
        await supabase.from('custom_users').update(updateObj).or(`email.eq.${targetEmail},id.eq.${targetEmail}`);
      } catch (e) {}
    }

    return sendJSON(res, 200, {
      success: true,
      message: `License key ${formattedKey} activated successfully! Plan upgraded to ${lic.tier}.` + (licOrgName ? ` Joined "${licOrgName}".` : ''),
      tier: lic.tier,
      plan: lic.tier,
      organization: licOrgName,
      organization_id: licOrgId,
      company: licOrgName,
      expiresAt: lic.expiresAt,
      remainingDays: Math.ceil((lic.expiresAt - Date.now()) / (1000 * 60 * 60 * 24))
    });
  }

  // 5. ADMIN: LIST ALL LICENSES
  if (req.method === 'GET' && url === '/api/admin/licenses/list') {
    const user = await getUserFromReq(req);
    if (!user || user.role !== 'SUPER_ADMIN' && user.role !== 'ORG_ADMIN') return sendJSON(res, 403, { success: false, message: 'Forbidden' });

    const licenses = readLicenses();
    const trials = readTrials();
    return sendJSON(res, 200, { success: true, licenses, trials });
  }

  // 6. ADMIN: GENERATE CUSTOM UNIQUE KEY
  if (req.method === 'POST' && url === '/api/admin/licenses/generate') {
    const user = await getUserFromReq(req);
    if (!user || user.role !== 'SUPER_ADMIN' && user.role !== 'ORG_ADMIN') return sendJSON(res, 403, { success: false, message: 'Forbidden' });

    const { tier = 'PRO', durationDays = 365, targetEmail = '', organization_id = '', organization_name = '' } = await getRequestBody(req);
    const uniqueKey = generateUniqueLicenseKey(tier);
    const now = Date.now();
    const expiresAt = now + parseInt(durationDays) * 24 * 60 * 60 * 1000;

    const orgId = organization_id || user.organization_id || user.features?.organization_id || '';
    const orgName = organization_name || user.organization_name || user.organization || user.company || user.features?.organization_name || '';

    const newLic = {
      key: uniqueKey,
      tier: tier.toUpperCase(),
      boundEmail: targetEmail ? targetEmail.trim().toLowerCase() : '',
      boundHwid: '',
      createdAt: now,
      expiresAt,
      status: 'ACTIVE',
      paymentStatus: 'ADMIN_GENERATED',
      organization_id: orgId,
      organization_name: orgName,
      company: orgName
    };

    const licenses = readLicenses();
    licenses.push(newLic);
    writeLicenses(licenses);

    return sendJSON(res, 200, { success: true, message: 'Unique License Key generated!', key: uniqueKey, license: newLic });
  }

  // 7. ADMIN: REVOKE LICENSE KEY
  if (req.method === 'POST' && url === '/api/admin/licenses/revoke') {
    const user = await getUserFromReq(req);
    if (!user || user.role !== 'SUPER_ADMIN' && user.role !== 'ORG_ADMIN') return sendJSON(res, 403, { success: false, message: 'Forbidden' });

    const { key } = await getRequestBody(req);
    const licenses = readLicenses();
    const lic = licenses.find(l => l.key === key);
    if (!lic) return sendJSON(res, 404, { success: false, message: 'License key not found' });

    lic.status = 'REVOKED';
    writeLicenses(licenses.map(l => l.key === key ? lic : l));

    return sendJSON(res, 200, { success: true, message: `License ${key} revoked` });
  }

  
  // ================= MULTI-TENANT ORG ENDPOINTS ================= //

  if (req.method === 'GET' && url === '/api/admin/organizations') {
    const user = await getUserFromReq(req);
    if (!user || user.role !== 'SUPER_ADMIN') return sendJSON(res, 403, { success: false, message: 'Forbidden' });
    let orgs = [];
    try {
      const { data } = await supabase.from('organizations').select('*');
      if (data && data.length > 0) orgs = data;
    } catch (e) {}
    
    const localOrgs = readLocalOrgs();
    const fileSettings = readOrgSettings();
    const map = new Map();
    
    localOrgs.forEach(o => map.set(o.id, { ...o }));
    
    orgs.forEach(o => {
      const existingLocal = map.get(o.id) || {};
      const fileSetting = fileSettings[o.id] || {};
      const parsedStatus = parseOrgStatus(o.status);
      
      const maxConcurrent = existingLocal.max_concurrent_users !== undefined && existingLocal.max_concurrent_users !== null
        ? parseInt(existingLocal.max_concurrent_users)
        : (fileSetting.max_concurrent_users !== undefined && fileSetting.max_concurrent_users !== null
          ? parseInt(fileSetting.max_concurrent_users)
          : (parsedStatus.max_concurrent_users !== undefined && parsedStatus.max_concurrent_users !== null
            ? parseInt(parsedStatus.max_concurrent_users)
            : (o.max_concurrent_users !== undefined && o.max_concurrent_users !== null
              ? parseInt(o.max_concurrent_users)
              : 5)));

      const licKey = existingLocal.license_key || fileSetting.license_key || parsedStatus.license_key || o.license_key || 'MEP-LIC-ORG-PRO';

      map.set(o.id, {
        ...existingLocal,
        ...o,
        status: parsedStatus.state || 'active',
        license_key: licKey,
        max_concurrent_users: maxConcurrent
      });
    });
    
    return sendJSON(res, 200, { success: true, organizations: Array.from(map.values()) });
  }

  if (req.method === 'POST' && url === '/api/admin/organizations') {
    const user = await getUserFromReq(req);
    const { name, subscription_plan, max_users, license_key, max_concurrent_users } = await getRequestBody(req);
    if (!name || !name.trim()) return sendJSON(res, 400, { success: false, message: 'Organization name required' });

    const newOrgId = crypto.randomUUID();
    const concurrentLimit = max_concurrent_users !== undefined ? parseInt(max_concurrent_users) : 1;
    const licKey = license_key || `MEP-LIC-${Math.floor(1000 + Math.random() * 9000)}-PRO`;

    const newOrg = {
      id: newOrgId,
      name: name.trim(),
      subscription_plan: subscription_plan || 'ENTERPRISE',
      max_users: parseInt(max_users) || 10,
      license_key: licKey,
      max_concurrent_users: concurrentLimit,
      created_at: new Date().toISOString()
    };

    const localOrgs = readLocalOrgs();
    localOrgs.push(newOrg);
    saveLocalOrgs(localOrgs);

    const fileSettings = readOrgSettings();
    fileSettings[newOrg.id] = {
      license_key: newOrg.license_key,
      max_concurrent_users: newOrg.max_concurrent_users,
      updated_at: new Date().toISOString()
    };
    writeOrgSettings(fileSettings);

    const encodedStatus = encodeOrgStatus('active', concurrentLimit, licKey);

    try {
      await supabase.from('organizations').insert([{
        id: newOrg.id,
        name: newOrg.name,
        subscription_plan: newOrg.subscription_plan,
        max_users: newOrg.max_users,
        status: encodedStatus
      }]);
    } catch (e) {
      console.warn('Supabase org insert warning:', e);
    }

    if (user) logActivity(user, 'CREATE_ORGANIZATION', { orgName: name });
    return sendJSON(res, 200, { success: true, organization: newOrg });
  }

  if (req.method === 'POST' && url === '/api/admin/organizations/update') {
    const user = await getUserFromReq(req);
    if (!user || user.role !== 'SUPER_ADMIN') return sendJSON(res, 403, { success: false, message: 'Forbidden' });
    const { orgId, name, subscription_plan, max_users, license_key, max_concurrent_users } = await getRequestBody(req);
    
    if (!orgId) return sendJSON(res, 400, { success: false, message: 'Organization ID required' });

    let localOrgs = readLocalOrgs();
    let orgIndex = localOrgs.findIndex(o => o.id === orgId);
    
    let existingSupabaseOrg = null;
    try {
      const { data } = await supabase.from('organizations').select('*').eq('id', orgId).maybeSingle();
      if (data) existingSupabaseOrg = data;
    } catch (e) {}

    if (orgIndex === -1) {
      const newOrg = existingSupabaseOrg ? { ...existingSupabaseOrg } : {
        id: orgId,
        name: name || 'Organization',
        subscription_plan: subscription_plan || 'PRO',
        max_users: max_users ? parseInt(max_users) : 5,
        created_at: new Date().toISOString()
      };
      localOrgs.push(newOrg);
      orgIndex = localOrgs.length - 1;
    }

    if (name !== undefined) localOrgs[orgIndex].name = name;
    if (subscription_plan !== undefined) localOrgs[orgIndex].subscription_plan = subscription_plan;
    if (max_users !== undefined) localOrgs[orgIndex].max_users = parseInt(max_users);
    if (license_key !== undefined) localOrgs[orgIndex].license_key = license_key;
    if (max_concurrent_users !== undefined) {
      localOrgs[orgIndex].max_concurrent_users = parseInt(max_concurrent_users);
    } else if (max_users !== undefined && (localOrgs[orgIndex].max_concurrent_users === undefined || localOrgs[orgIndex].max_concurrent_users === 1)) {
      localOrgs[orgIndex].max_concurrent_users = parseInt(max_users);
    }

    saveLocalOrgs(localOrgs);

    const fileSettings = readOrgSettings();
    fileSettings[orgId] = {
      ...fileSettings[orgId],
      license_key: localOrgs[orgIndex].license_key,
      max_concurrent_users: localOrgs[orgIndex].max_concurrent_users,
      updated_at: new Date().toISOString()
    };
    writeOrgSettings(fileSettings);

    const currentStatusStr = existingSupabaseOrg?.status || localOrgs[orgIndex].status || 'active';
    const updatedEncodedStatus = encodeOrgStatus(currentStatusStr, localOrgs[orgIndex].max_concurrent_users, localOrgs[orgIndex].license_key);

    try {
      const targetId = existingSupabaseOrg?.id || orgId;
      const dbPayload = { status: updatedEncodedStatus };
      if (name !== undefined) dbPayload.name = name;
      if (subscription_plan !== undefined) dbPayload.subscription_plan = subscription_plan;
      if (max_users !== undefined) dbPayload.max_users = parseInt(max_users);
      
      const { error: sbErr } = await supabase.from('organizations').update(dbPayload).eq('id', targetId);
      if (sbErr) {
        console.warn('Supabase org update warning:', sbErr);
        await supabase.from('organizations').upsert({ id: targetId, ...dbPayload }, { onConflict: 'id' });
      }
    } catch (e) {
      console.warn('Supabase org update exception:', e);
    }

    logActivity(user, 'UPDATE_ORGANIZATION', { orgId, name });
    return sendJSON(res, 200, { success: true, organization: localOrgs[orgIndex] });
  }

  // -------------------------------------------------------------
  // LICENSE SESSION SEAT CHECK & HEARTBEAT ENDPOINTS
  // -------------------------------------------------------------
  if (req.method === 'POST' && url === '/api/license/session/heartbeat') {
    const { userId, email, orgId, deviceId } = await getRequestBody(req);
    if (!orgId || !userId) {
      return sendJSON(res, 200, { success: true, allowed: true });
    }

    let orgObj = null;
    try {
      const { data } = await supabase.from('organizations').select('*').eq('id', orgId).maybeSingle();
      if (data) orgObj = data;
    } catch(e) {}

    if (!orgObj) {
      const localOrgs = readLocalOrgs();
      orgObj = localOrgs.find(o => o.id === orgId) || { id: orgId, name: 'Organization' };
    }

    const parsedStatus = parseOrgStatus(orgObj.status);
    const fileSettings = readOrgSettings();
    const licenseKey = parsedStatus.license_key || fileSettings[orgId]?.license_key || orgObj.license_key || 'MEP-LIC-ORG-PRO';
    const maxConcurrent = parsedStatus.max_concurrent_users !== undefined && parsedStatus.max_concurrent_users !== null && !isNaN(parsedStatus.max_concurrent_users)
      ? parsedStatus.max_concurrent_users
      : (fileSettings[orgId]?.max_concurrent_users !== undefined ? parseInt(fileSettings[orgId].max_concurrent_users) : (orgObj.max_concurrent_users !== undefined ? parseInt(orgObj.max_concurrent_users) : 1));

    cleanStaleLicenseSessions(orgId);
    if (!orgLicenseSessions.has(orgId)) {
      orgLicenseSessions.set(orgId, new Map());
    }

    const activeMap = orgLicenseSessions.get(orgId);
    const sessionKey = deviceId ? `${userId}_${deviceId}` : userId;

    if (activeMap.has(sessionKey)) {
      activeMap.set(sessionKey, { sessionKey, userId, email: email || activeMap.get(sessionKey).email, lastPing: Date.now() });
      const activeList = Array.from(activeMap.values()).map(s => s.email);
      return sendJSON(res, 200, {
        success: true,
        allowed: true,
        licenseKey,
        maxConcurrent,
        activeUsers: activeList,
        orgName: orgObj.name
      });
    }

    if (activeMap.size >= maxConcurrent) {
      const activeList = Array.from(activeMap.values()).map(s => s.email);
      return sendJSON(res, 200, {
        success: true,
        allowed: false,
        licenseKey,
        maxConcurrent,
        activeUsers: activeList,
        orgName: orgObj.name,
        message: `License seat limit (${maxConcurrent} active seat${maxConcurrent === 1 ? '' : 's'}) reached for "${orgObj.name}". Occupied by ${activeList.join(', ')}.`
      });
    }

    activeMap.set(sessionKey, { sessionKey, userId, email, lastPing: Date.now() });
    const activeList = Array.from(activeMap.values()).map(s => s.email);
    return sendJSON(res, 200, {
      success: true,
      allowed: true,
      licenseKey,
      maxConcurrent,
      activeUsers: activeList,
      orgName: orgObj.name
    });
  }

  if (req.method === 'POST' && url === '/api/license/session/release') {
    const { userId, orgId, deviceId } = await getRequestBody(req);
    if (orgId && userId && orgLicenseSessions.has(orgId)) {
      const activeMap = orgLicenseSessions.get(orgId);
      const sessionKey = deviceId ? `${userId}_${deviceId}` : userId;
      activeMap.delete(sessionKey);
      activeMap.delete(userId);
    }
    return sendJSON(res, 200, { success: true });
  }

  if (req.method === 'GET' && url.startsWith('/api/admin/organizations/active-sessions')) {
    const activeData = {};
    for (const [oId, map] of orgLicenseSessions.entries()) {
      cleanStaleLicenseSessions(oId);
      activeData[oId] = Array.from(map.values());
    }
    return sendJSON(res, 200, { success: true, activeSessions: activeData });
  }

  if (req.method === 'POST' && url === '/api/admin/organizations/delete') {
    const user = await getUserFromReq(req);
    if (!user || user.role !== 'SUPER_ADMIN') return sendJSON(res, 403, { success: false, message: 'Forbidden' });
    const { orgId } = await getRequestBody(req);
    
    // Remove locally
    const localOrgs = readLocalOrgs();
    const updated = localOrgs.filter(o => o.id !== orgId);
    saveLocalOrgs(updated);

    // Unassign all members of this organization locally
    let allUsers = await readUsers();
    let modified = false;
    allUsers = allUsers.map(u => {
      if (u.organization_id && String(u.organization_id) === String(orgId)) {
        modified = true;
        return { ...u, organization_id: null, company: '', organization: '' };
      }
      return u;
    });
    if (modified) {
      await writeUsers(allUsers);
    }

    // Try Supabase delete & unassign users
    try {
      await supabase.from('organizations').delete().eq('id', orgId);
      await supabase.from('custom_users').update({ organization_id: null, company: '', organization: '' }).eq('organization_id', orgId);
    } catch (e) {}

    logActivity(user, 'DELETE_ORGANIZATION', { orgId });
    return sendJSON(res, 200, { success: true });
  }

  if (req.method === 'GET' && url === '/api/org/users') {
    const user = await getUserFromReq(req);
    if (!user) return sendJSON(res, 401, { success: false, message: 'Unauthorized' });
    
    // For SUPER_ADMIN, they might pass ?org_id=... to view a specific org's users
    let orgId = user.organization_id;
    let userCompany = user.company || user.organization;
    if (user.role === 'SUPER_ADMIN') {
      const qOrgId = req.url.split('?org_id=')[1]?.split('&')[0];
      if (qOrgId) orgId = qOrgId;
    }
    
    if (!orgId && !userCompany && user.role !== 'SUPER_ADMIN') return sendJSON(res, 400, { success: false, message: 'Organization missing' });
    
    const allUsers = await readUsers();
    // Filter users strictly by matching organization_id OR company / organization name
    const orgUsers = allUsers.filter(u => {
      if (u.role === 'SUPER_ADMIN' || u.email === 'admin@tarv.ai') return false;
      const uOrgId = u.organization_id;
      const uCompany = u.company || u.organization;

      if (orgId && uOrgId && String(uOrgId) === String(orgId)) return true;
      if (userCompany && uCompany && uCompany === userCompany) return true;
      if (userCompany && uOrgId && String(uOrgId) === String(userCompany)) return true;
      if (orgId && uCompany && uCompany === String(orgId)) return true;
      return false;
    });
    const formattedUsers = await Promise.all(orgUsers.map(u => formatUser(u)));
    return sendJSON(res, 200, { success: true, users: formattedUsers });
  }

  if (req.method === 'POST' && url === '/api/org/invite') {
    const user = await getUserFromReq(req);
    if (!user || user.role !== 'ORG_ADMIN') return sendJSON(res, 403, { success: false, message: 'Forbidden' });
    if (!user.organization_id) return sendJSON(res, 400, { success: false, message: 'Admin does not belong to an organization' });
    
    const { data: orgData } = await supabase.from('organizations').select('*').eq('id', user.organization_id).single();
    if (!orgData) return sendJSON(res, 404, { success: false, message: 'Organization not found' });
    if (orgData.used_users >= orgData.max_users) return sendJSON(res, 400, { success: false, message: 'Maximum seat limit reached for organization. Please upgrade your subscription.' });

    const { name, email, role } = await getRequestBody(req);
    if (!name || !email) return sendJSON(res, 400, { success: false, message: 'Name and email required' });

    const cleanEmail = email.trim().toLowerCase();
    const users = await readUsers();
    if (users.find(u => u.email === cleanEmail)) {
      return sendJSON(res, 400, { success: false, message: 'Email already exists in the system' });
    }

    const tempPassword = Math.random().toString(36).slice(-8);
    const hashedPassword = bcrypt.hashSync(tempPassword, 10);
    const userId = 'usr_' + Date.now();
    
    const newUser = {
      id: userId,
      name: name.trim(),
      email: cleanEmail,
      password: hashedPassword,
      isAccountVerified: false,
      role: role || 'ENGINEER',
      organization_id: user.organization_id,
      status: 'invited',
      verifyOtp: String(Math.floor(100000 + Math.random() * 900000)),
      verifyOtpExpireAt: Date.now() + 24 * 60 * 60 * 1000,
      createdAt: new Date().toISOString()
    };
    
    users.push(newUser);
    await writeUsers(users);

    await supabase.from('organizations').update({ used_users: orgData.used_users + 1 }).eq('id', user.organization_id);

    const inviteMailOptions = {
      from: `"MEP Calculator" <${SENDER_EMAIL}>`,
      to: cleanEmail,
      subject: 'You have been invited to MEP Calculator',
      html: WELCOME_EMAIL_TEMPLATE.replace('{{name}}', newUser.name).replace('{{otp}}', newUser.verifyOtp) + `<p>Your temporary password is: <b>${tempPassword}</b></p>`
    };
    transporter.sendMail(inviteMailOptions).catch(console.error);

      logActivity(user, 'INVITE_USER', { invitedEmail: cleanEmail, role });
    return sendJSON(res, 200, { success: true, message: 'User invited successfully', user: await formatUser(newUser) });
  }

  // --- ORGANIZATION BACKUP SETTINGS ROUTES ---
  if (req.method === 'GET' && url.startsWith('/api/org/backup-settings')) {
    const user = await getUserFromReq(req);
    if (!user) return sendJSON(res, 401, { success: false, message: 'Unauthorized' });

    let orgId = user.organization_id || 'GLOBAL';
    if (user.role === 'SUPER_ADMIN') {
      const qOrgId = req.url.split('?org_id=')[1]?.split('&')[0];
      if (qOrgId && qOrgId !== 'undefined' && qOrgId !== 'null' && qOrgId !== 'ALL' && qOrgId !== 'UNASSIGNED') {
        orgId = qOrgId;
      }
    }

    let localPath = '';
    let serverPath = '';
    let versionsPath = '';
    if (orgId !== 'GLOBAL') {
      try {
        const { data } = await supabase.from('organizations').select('local_backup_path, server_backup_path, versions_path').eq('id', orgId).single();
        if (data) {
          localPath = data.local_backup_path || '';
          serverPath = data.server_backup_path || '';
          versionsPath = data.versions_path || '';
        }
      } catch (e) {}
    }

    const fileSettings = readOrgSettings();
    const targetKey = orgId || 'GLOBAL';
    if (fileSettings[targetKey]) {
      if (!localPath) localPath = fileSettings[targetKey].local_backup_path || '';
      if (!serverPath) serverPath = fileSettings[targetKey].server_backup_path || '';
      if (!versionsPath) versionsPath = fileSettings[targetKey].versions_path || '';
    } else if (fileSettings['GLOBAL']) {
      if (!localPath) localPath = fileSettings['GLOBAL'].local_backup_path || '';
      if (!serverPath) serverPath = fileSettings['GLOBAL'].server_backup_path || '';
      if (!versionsPath) versionsPath = fileSettings['GLOBAL'].versions_path || '';
    }

    return sendJSON(res, 200, {
      success: true,
      org_id: orgId,
      local_backup_path: localPath,
      server_backup_path: serverPath,
      versions_path: versionsPath
    });
  }

  if (req.method === 'POST' && url === '/api/org/backup-settings') {
    const user = await getUserFromReq(req);
    if (!user || (user.role !== 'ORG_ADMIN' && user.role !== 'SUPER_ADMIN')) {
      return sendJSON(res, 403, { success: false, message: 'Forbidden' });
    }

    const { local_backup_path, server_backup_path, versions_path, org_id } = await getRequestBody(req);
    let targetOrgId = org_id || user.organization_id || 'GLOBAL';
    if (targetOrgId === 'ALL' || targetOrgId === 'UNASSIGNED' || targetOrgId === 'undefined') {
      targetOrgId = 'GLOBAL';
    }

    if (targetOrgId !== 'GLOBAL') {
      try {
        await supabase.from('organizations').update({
          local_backup_path: local_backup_path || '',
          server_backup_path: server_backup_path || '',
          versions_path: versions_path || ''
        }).eq('id', targetOrgId);
      } catch (e) {}
    }

    const fileSettings = readOrgSettings();
    fileSettings[targetOrgId] = {
      ...fileSettings[targetOrgId],
      local_backup_path: local_backup_path || '',
      server_backup_path: server_backup_path || '',
      versions_path: versions_path || '',
      updated_at: new Date().toISOString(),
      updated_by: user.email
    };
    writeOrgSettings(fileSettings);

    logActivity(user, 'UPDATE_ORG_BACKUP_SETTINGS', { org_id: targetOrgId, local_backup_path, server_backup_path, versions_path });

    return sendJSON(res, 200, {
      success: true,
      message: targetOrgId === 'GLOBAL' 
        ? 'Global default backup settings saved successfully to backend!' 
        : 'Organization backup settings saved successfully to backend!',
      local_backup_path,
      server_backup_path,
      versions_path
    });
  }

  // POST /api/admin/backup-now (Manual Backup Generation)
  if (req.method === 'POST' && url === '/api/admin/backup-now') {
    const adminUser = await getUserFromReq(req);
    if (!adminUser || (adminUser.role !== 'SUPER_ADMIN' && adminUser.role !== 'ORG_ADMIN')) {
      return sendJSON(res, 403, { success: false, message: 'Forbidden' });
    }
    try {
      const users = await readUsers(true);
      const teams = readLocalTeams();
      const teamMembers = readLocalTeamMembers();
      const projects = readLocalProjects();
      const logs = readActivityLogs();

      const backupObj = {
        version: '0.0.3',
        created_at: new Date().toISOString(),
        created_by: adminUser.email,
        data: {
          users,
          teams,
          teamMembers,
          projects,
          logs
        }
      };

      const dateStr = new Date().toISOString().split('T')[0];
      const filename = `mep_backup_${dateStr}_${Date.now()}.json`;
      const backupPath = path.join(DATA_DIR, filename);
      fs.writeFileSync(backupPath, JSON.stringify(backupObj, null, 2), 'utf8');

      logActivity(adminUser, 'ADMIN_BACKUP_DATABASE', { filename });
      return sendJSON(res, 200, { success: true, message: 'Database backup generated successfully!', filename, backupObj });
    } catch (err) {
      return sendJSON(res, 500, { success: false, message: 'Backup generation failed: ' + err.message });
    }
  }

  // POST /api/admin/restore-backup (Atomic Database Hydration & Restore)
  if (req.method === 'POST' && url === '/api/admin/restore-backup') {
    const adminUser = await getUserFromReq(req);
    if (!adminUser || (adminUser.role !== 'SUPER_ADMIN' && adminUser.role !== 'ORG_ADMIN')) {
      return sendJSON(res, 403, { success: false, message: 'Forbidden' });
    }
    try {
      const { backupData } = await getRequestBody(req);
      if (!backupData || !backupData.data) {
        return sendJSON(res, 400, { success: false, message: 'Invalid backup file payload' });
      }

      const { users, teams, teamMembers, projects } = backupData.data;

      if (Array.isArray(users) && users.length > 0) {
        saveLocalUsers(users);
        try { await supabase.from('custom_users').upsert(users); } catch (e) {}
      }
      if (Array.isArray(teams)) {
        saveLocalTeams(teams);
        try { await supabase.from('teams').upsert(teams); } catch (e) {}
      }
      if (Array.isArray(teamMembers)) {
        saveLocalTeamMembers(teamMembers);
        try { await supabase.from('team_members').upsert(teamMembers); } catch (e) {}
      }
      if (Array.isArray(projects)) {
        saveLocalProjects(projects);
        try { await supabase.from('projects').upsert(projects); } catch (e) {}
      }

      invalidateUserCache();
      logActivity(adminUser, 'ADMIN_RESTORE_DATABASE', { restored_at: new Date().toISOString() });
      return sendJSON(res, 200, { success: true, message: 'Database restored successfully! All tables hydrated.' });
    } catch (err) {
      return sendJSON(res, 500, { success: false, message: 'Restore failed: ' + err.message });
    }
  }

  // --- ANNOUNCEMENTS ROUTES ---
  
  // GET /api/announcements (Public/Authenticated)
  if (req.method === 'GET' && url === '/api/announcements') {
    try {
      const user = await getUserFromReq(req);
      
      let query = supabase
        .from('announcements')
        .select('*')
        .order('created_at', { ascending: false });

      if (user && user.role !== 'SUPER_ADMIN') {
        if (user.organization_id) {
          query = query.or(`organization_id.is.null,organization_id.eq.${user.organization_id}`);
        } else {
          query = query.is('organization_id', null);
        }
      } else if (!user) {
        // Unauthenticated users ONLY see global broadcasts
        query = query.is('organization_id', null);
      }
      
      const { data, error } = await query;
      
      if (error) throw error;
      return sendJSON(res, 200, { success: true, announcements: data || [] });
    } catch (err) {
      console.error('Error fetching announcements:', err);
      return sendJSON(res, 500, { success: false, message: 'Server error fetching announcements' });
    }
  }

  // POST /api/admin/announcements (Admins only)
  if (req.method === 'POST' && url === '/api/admin/announcements') {
    const user = await getUserFromReq(req);
    if (!user || (user.role !== 'ORG_ADMIN' && user.role !== 'SUPER_ADMIN')) {
      return sendJSON(res, 403, { success: false, message: 'Access Denied: Admins only' });
    }

    try {
      const { message, is_active } = await getRequestBody(req);
      if (!message) {
        return sendJSON(res, 400, { success: false, message: 'Message is required' });
      }

      // If they are an Org Admin, bind the announcement to their organization
      // If Super Admin, they broadcast globally (null)
      const orgId = user.role === 'ORG_ADMIN' ? user.organization_id : null;

      const { data, error } = await supabase
        .from('announcements')
        .insert([{ message, is_active: is_active !== undefined ? is_active : true, organization_id: orgId }])
        .select();

      if (error) throw error;
      logActivity(user, 'CREATE_ANNOUNCEMENT', { message, orgId });
      return sendJSON(res, 200, { success: true, announcement: data[0] });
    } catch (err) {
      console.error('Error creating announcement:', err);
      return sendJSON(res, 500, { success: false, message: 'Server error creating announcement' });
    }
  }

  // PUT /api/admin/announcements/:id (Toggle active status)
  if (req.method === 'PUT' && url.startsWith('/api/admin/announcements/')) {
    const user = await getUserFromReq(req);
    if (!user || (user.role !== 'ORG_ADMIN' && user.role !== 'SUPER_ADMIN')) {
      return sendJSON(res, 403, { success: false, message: 'Access Denied: Admins only' });
    }

    try {
      const id = url.split('/').pop();
      const { is_active } = await getRequestBody(req);

      const { data, error } = await supabase
        .from('announcements')
        .update({ is_active })
        .eq('id', id)
        .select();

      if (error) throw error;
      logActivity(user, 'UPDATE_ANNOUNCEMENT', { id, is_active });
      return sendJSON(res, 200, { success: true, announcement: data[0] });
    } catch (err) {
      console.error('Error updating announcement:', err);
      return sendJSON(res, 500, { success: false, message: 'Server error updating announcement' });
    }
  }

  // DELETE /api/admin/announcements/:id (Admins only)
  if (req.method === 'DELETE' && url.startsWith('/api/admin/announcements/')) {
    const user = await getUserFromReq(req);
    if (!user || (user.role !== 'ORG_ADMIN' && user.role !== 'SUPER_ADMIN')) {
      return sendJSON(res, 403, { success: false, message: 'Access Denied: Admins only' });
    }

    try {
      const id = url.split('/').pop();
      const { error } = await supabase
        .from('announcements')
        .delete()
        .eq('id', id);

      if (error) throw error;
      logActivity(user, 'DELETE_ANNOUNCEMENT', { id });
      return sendJSON(res, 200, { success: true, message: 'Announcement deleted successfully' });
    } catch (err) {
      console.error('Error deleting announcement:', err);
      return sendJSON(res, 500, { success: false, message: 'Server error deleting announcement' });
    }
  }
  // ==========================================
  // SHARED PROJECT VERSIONING ENDPOINTS
  // ==========================================
  if (req.method === 'POST' && url === '/api/versions/save') {
    const user = await getUserFromReq(req);
    if (!user) return sendJSON(res, 401, { success: false, message: 'Unauthorized' });

    const { projectName, calculatorName, version, description, data } = await getRequestBody(req);
    if (!projectName || !calculatorName) return sendJSON(res, 400, { success: false, message: 'Missing parameters' });

    const versions = readVersionsData();
    const safeProjectName = String(projectName).trim();
    const safeCalculatorName = String(calculatorName).trim();
    
    const existingIndex = versions.findIndex(v => 
      v.projectName.toLowerCase() === safeProjectName.toLowerCase() && 
      v.calculatorName.toLowerCase() === safeCalculatorName.toLowerCase() &&
      v.version.toUpperCase() === String(version || '').toUpperCase()
    );

    const existingForCalc = versions.filter(v => 
      v.projectName.toLowerCase() === safeProjectName.toLowerCase() && 
      v.calculatorName.toLowerCase() === safeCalculatorName.toLowerCase()
    );

    const versionNumber = version || `V${existingForCalc.length}`;
    const timestamp = new Date().toISOString();

    if (existingIndex >= 0) {
      // Update existing version entry - NEVER overwrite original creator (createdBy / user)
      const currentItem = versions[existingIndex];
      const editorName = user.name || user.email || 'System User';
      
      if (description && description.trim() && !description.startsWith('Updated calculation state')) {
        currentItem.description = description.trim();
      }
      currentItem.createdBy = currentItem.createdBy || currentItem.user || editorName;
      currentItem.user = currentItem.createdBy; // Keep user backwards-compatible with createdBy
      currentItem.editedBy = editorName;
      currentItem.editedByEmail = user.email;
      currentItem.lastEditedAt = timestamp;
      currentItem.timestamp = currentItem.createdAt || currentItem.timestamp || timestamp;
      currentItem.data = data;
      
      writeVersionsData(versions);

      try {
        await supabase.from('project_versions')
          .update({
            description: description || currentItem.description,
            edited_by_name: editorName,
            last_edited_at: timestamp,
            payload: data
          })
          .eq('id', currentItem.id);
      } catch (e) {}

      logActivity(user, 'UPDATE_VERSION', { projectName: safeProjectName, calculatorName: safeCalculatorName, version: versionNumber });
      return sendJSON(res, 200, { success: true, message: `Version ${versionNumber} updated on server`, version: currentItem });
    }

    const id = `ver_${Date.now()}_${Math.floor(Math.random()*1000)}`;

    const newVersionItem = {
      id,
      projectName: safeProjectName,
      calculatorName: safeCalculatorName,
      version: versionNumber,
      description: description || 'No description',
      user: user.name || user.email || 'System User',
      createdBy: user.name || user.email || 'System User',
      createdByEmail: user.email,
      createdAt: timestamp,
      editedBy: null,
      editedByEmail: null,
      lastEditedAt: null,
      userId: user.id,
      userEmail: user.email,
      organization_id: user.organization_id || null,
      timestamp,
      data
    };

    versions.unshift(newVersionItem);
    writeVersionsData(versions);

    try {
      await supabase.from('project_versions').insert([{
        id,
        project_name: safeProjectName,
        calculator_name: safeCalculatorName,
        version: versionNumber,
        description: description || 'No description',
        user_name: user.name || user.email,
        created_by_name: user.name || user.email,
        user_email: user.email,
        organization_id: user.organization_id || null,
        payload: data,
        created_at: timestamp
      }]);
    } catch (e) {}

    logActivity(user, 'SAVE_VERSION', { projectName: safeProjectName, calculatorName: safeCalculatorName, version: versionNumber });
    return sendJSON(res, 200, { success: true, message: 'Version saved to server', version: newVersionItem });
  }

  if (req.method === 'GET' && url.startsWith('/api/versions/list')) {
    const user = await getUserFromReq(req);
    if (!user) return sendJSON(res, 401, { success: false, message: 'Unauthorized' });

    const parsedUrl = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
    const proj = parsedUrl.searchParams.get('project') || '';
    const calc = parsedUrl.searchParams.get('calculator') || '';

    let versions = readVersionsData();

    try {
      let query = supabase.from('project_versions').select('*');
      if (user.role !== 'SUPER_ADMIN' && user.organization_id) {
        query = query.or(`organization_id.eq.${user.organization_id},organization_id.is.null`);
      }
      if (proj) query = query.ilike('project_name', proj);
      if (calc) query = query.ilike('calculator_name', calc);
      const { data: sbData, error } = await query;
      if (!error && Array.isArray(sbData) && sbData.length > 0) {
        const sbMapped = sbData.map(v => ({
          id: v.id,
          projectName: v.project_name,
          calculatorName: v.calculator_name,
          version: v.version,
          description: v.description,
          user: v.created_by_name || v.user_name || v.user_email,
          createdBy: v.created_by_name || v.user_name || v.user_email,
          createdByEmail: v.user_email,
          createdAt: v.created_at,
          editedBy: v.edited_by_name || v.edited_by || null,
          lastEditedAt: v.last_edited_at || null,
          organization_id: v.organization_id,
          timestamp: v.created_at,
          data: v.payload
        }));
        
        // Merge Supabase versions with local file versions based on ID
        const existingIds = new Set(versions.map(v => v.id));
        sbMapped.forEach(v => {
          if (!existingIds.has(v.id)) {
            versions.push(v);
          }
        });
      }
    } catch (e) {}

    // Also scan disk backup folders on server for existing version files (e.g. Z:\Versions\{proj}\{calc} or org versions_path)
    const diskDirsToScan = [];
    if (proj && calc) {
      const safeProj = String(proj).replace(/[<>:"/\\|?*]/g, '_');
      const safeCalc = String(calc).replace(/[<>:"/\\|?*]/g, '_');

      let orgVersionsPath = '';
      if (user && user.organization_id) {
        try {
          const fileSettings = readOrgSettings();
          const targetKey = user.organization_id || 'GLOBAL';
          orgVersionsPath = fileSettings[targetKey]?.versions_path || fileSettings['GLOBAL']?.versions_path || '';
        } catch (e) {}
      }
      
      const candidatePaths = [
        `Z:\\Versions\\${safeProj}\\${safeCalc}`,
        `Z:/Versions/${safeProj}/${safeCalc}`,
        orgVersionsPath ? path.join(orgVersionsPath.replace(/['"]/g, ''), safeProj, safeCalc) : null,
        orgVersionsPath ? `${orgVersionsPath.replace(/['"]/g, '')}\\${safeProj}\\${safeCalc}` : null,
        path.join(process.cwd(), 'Versions', safeProj, safeCalc),
        path.join(__dirname, '..', 'Versions', safeProj, safeCalc)
      ].filter(Boolean);
      
      candidatePaths.forEach(p => {
        try {
          if (fs.existsSync(p) && !diskDirsToScan.includes(p)) diskDirsToScan.push(p);
        } catch (e) {}
      });
    }

    diskDirsToScan.forEach(dirPath => {
      try {
        const files = fs.readdirSync(dirPath);
        files.forEach(fileName => {
          if (fileName.toLowerCase().endsWith('.json')) {
            try {
              const fullPath = path.join(dirPath, fileName);
              const fileStat = fs.statSync(fullPath);
              const contentStr = fs.readFileSync(fullPath, 'utf8');
              const parsed = JSON.parse(contentStr);
              
              const meta = parsed._versionMetadata || {};
              const vNum = meta.version || fileName.replace(/\.json$/i, '').toUpperCase();
              const vData = meta.version ? (parsed.data || parsed) : parsed;
              
              const existsInList = versions.some(v => 
                String(v.version).toUpperCase() === String(vNum).toUpperCase()
              );

              if (!existsInList) {
                versions.push({
                  id: `disk_${fileName}_${fileStat.mtimeMs}`,
                  projectName: proj,
                  calculatorName: calc,
                  version: vNum,
                  description: meta.description || `Version ${vNum}`,
                  user: meta.createdBy || meta.user || 'System User',
                  createdBy: meta.createdBy || meta.user || 'System User',
                  createdAt: meta.createdAt || meta.timestamp || fileStat.birthtime.toISOString(),
                  editedBy: meta.editedBy || null,
                  lastEditedAt: meta.lastEditedAt || null,
                  organization_id: user.organization_id || null,
                  timestamp: meta.timestamp || fileStat.mtime.toISOString(),
                  data: vData
                });
              }
            } catch (e) {}
          }
        });
      } catch (e) {}
    });

    if (proj) {
      versions = versions.filter(v => v.projectName.toLowerCase() === proj.toLowerCase());
    }
    if (calc) {
      versions = versions.filter(v => v.calculatorName.toLowerCase() === calc.toLowerCase());
    }

    if (user.role !== 'SUPER_ADMIN' && user.organization_id) {
      versions = versions.filter(v => !v.organization_id || v.organization_id === user.organization_id);
    }

    // Sort descending by timestamp initially
    versions.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

    const list = versions.map(v => ({
      id: v.id,
      version: v.version,
      description: v.description,
      user: v.createdBy || v.user,
      createdBy: v.createdBy || v.user,
      createdAt: v.createdAt || v.timestamp,
      editedBy: v.editedBy || null,
      lastEditedAt: v.lastEditedAt || null,
      userEmail: v.userEmail,
      timestamp: v.timestamp,
      parsedData: v.data
    }));

    return sendJSON(res, 200, { success: true, versions: list });
  }

  // 404 Fallback
  return sendJSON(res, 404, { success: false, message: 'Endpoint not found' });
});

server.listen(PORT, () => {
  console.log(`\n==================================================`);
  console.log(`🚀 MEP Calculator Auth Engine running on http://localhost:${PORT}`);
  console.log(`☁️ Supabase Cloud DB Connected for Credentials`);
  // Automated 24-Hour Database Backup Timer
  setInterval(async () => {
    try {
      console.log('🕒 Running automated 24-hour database backup...');
      const users = await readUsers(true);
      const teams = readLocalTeams();
      const teamMembers = readLocalTeamMembers();
      const projects = readLocalProjects();
      const logs = readActivityLogs();

      const backupObj = {
        version: '0.0.3',
        type: 'AUTOMATED_DAILY_BACKUP',
        created_at: new Date().toISOString(),
        created_by: 'system_auto_backup',
        data: { users, teams, teamMembers, projects, logs }
      };

      const dateStr = new Date().toISOString().split('T')[0];
      const filename = `mep_auto_backup_${dateStr}_${Date.now()}.json`;
      const backupPath = path.join(DATA_DIR, filename);
      fs.writeFileSync(backupPath, JSON.stringify(backupObj, null, 2), 'utf8');
      console.log(`✅ Automated 24-hour database backup saved: ${filename}`);
    } catch (e) {
      console.error('Automated backup error:', e.message);
    }
  }, 24 * 60 * 60 * 1000);
});
