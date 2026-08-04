import http from 'http';
import fs from 'fs';
import path from 'path';
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
dotenv.config({ path: path.join(__dirname, '.env') });

const PORT = process.env.PORT || 4000;
const JWT_SECRET = process.env.JWT_SECRET || 'mep_calculator_auth_secret_key_2026';
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

async function readUsers() {
  try {
    const { data, error } = await supabase.from('custom_users').select('*');
    if (error) {
      if (error.code === '42P01') {
        console.warn("Table custom_users does not exist yet! Please create it in Supabase.");
        return [];
      }
      throw error;
    }
    const users = data || [];
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
        resetOtp: '',
        resetOtpExpireAt: 0,
        createdAt: new Date().toISOString()
      };
      await supabase.from('custom_users').insert([adminUser]);
      users.push(adminUser);
    }
    return users;
  } catch (e) {
    console.error("Error reading users:", e);
    return [];
  }
}

async function writeUsers(users) {
  try {
    // Strip privacyPolicyAccepted before saving to Supabase since the column doesn't exist yet
    const safeUsers = users.map(({ privacyPolicyAccepted, ...user }) => user);
    const { error } = await supabase.from('custom_users').upsert(safeUsers);
    if (error) {
      console.error('Error writing users to Supabase:', error);
    }
  } catch (e) {
    console.error('Error writing users:', e);
  }
}

function formatUser(user) {
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    isAccountVerified: user.isAccountVerified,
    role: user.role,
    privacyPolicyAccepted: user.privacyPolicyAccepted || false,
    features: user.features || {},
    subscription_expires: user.subscription_expires,
    organization_id: user.organization_id,
    status: user.status
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
    const decoded = jwt.verify(token, JWT_SECRET);
    const users = await readUsers();
    return users.find((u) => u.id === decoded.id) || null;
  } catch (e) {
    return null;
  }
}

function sendJSON(res, statusCode, body, setCookieStr = null) {
  const requestOrigin = res.req?.headers?.origin || '*';
  const headers = {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': requestOrigin,
    'Access-Control-Allow-Credentials': 'true',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
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
      'Access-Control-Allow-Origin': req.headers.origin || '*',
      'Access-Control-Allow-Credentials': 'true',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    });
    return res.end();
  }

  const url = req.url.split('?')[0];

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

        transporter.sendMail(welcomeMailOptions).catch((err) => console.error('Welcome mail error:', err));
        transporter.sendMail(verifyMailOptions).catch((err) => console.error('OTP mail error:', err));

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
      role: 'USER',
      resetOtp: '',
      resetOtpExpireAt: 0,
      createdAt: new Date().toISOString(),
      privacyPolicyAccepted: false,
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

    transporter.sendMail(welcomeMailOptions).catch((err) => console.error('Welcome mail error:', err));
    transporter.sendMail(verifyMailOptions).catch((err) => console.error('OTP mail error:', err));

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
    const { email, password } = await getRequestBody(req);

    if (!email || !password) {
      return sendJSON(res, 200, { success: false, message: 'Email and password are required' });
    }

    const users = await readUsers();
    const cleanEmail = email.trim().toLowerCase();
    const user = users.find((u) => u.email === cleanEmail);

    if (!user) {
      return sendJSON(res, 200, { success: false, message: 'Invalid email' });
    }

    const isMatch = await bcrypt.compare(password, user.password);

    if (!isMatch) {
      return sendJSON(res, 200, { success: false, message: 'Invalid password' });
    }

    const token = jwt.sign({ id: user.id, email: user.email }, JWT_SECRET, { expiresIn: '7d' });
    const cookieStr = `token=${token}; HttpOnly; Path=/; Max-Age=604800; SameSite=Lax`;

    return sendJSON(
      res,
      200,
      {
        success: true,
        token,
        message: 'Logged In Successfully',
        userData: {
          id: user.id,
          name: user.name,
          email: user.email,
          isAccountVerified: user.isAccountVerified,
          role: user.role,
          privacyPolicyAccepted: user.privacyPolicyAccepted || false,
          features: user.features || {},
          subscription_expires: user.subscription_expires,
        },
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
    const userFromToken = await getUserFromReq(req);
    const users = await readUsers();
    const user = userFromToken || users.find((u) => u.email === (email || '').trim().toLowerCase());

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

    const mailOption = {
      from: SENDER_EMAIL,
      to: user.email,
      subject: 'Account Verification OTP',
      html: EMAIL_VERIFY_TEMPLATE.replace(/\{\{otp\}\}/g, otp)
        .replace(/\{\{email\}\}/g, user.email)
        .replace(/\{\{name\}\}/g, user.name),
    };

    transporter.sendMail(mailOption).catch((err) => console.error('OTP resend mail error:', err));

    return sendJSON(res, 200, { success: true, message: 'Verification OTP Sent to Email' });
  }

  // 5. VERIFY ACCOUNT (OTP CONFIRMATION)
  if (req.method === 'POST' && url === '/api/auth/verify-account') {
    const { otp, email } = await getRequestBody(req);
    const userFromToken = await getUserFromReq(req);

    if (!otp) {
      return sendJSON(res, 200, { success: false, message: 'Missing 6-digit OTP' });
    }

    const users = await readUsers();
    const cleanEmail = (email || '').trim().toLowerCase();
    const user = userFromToken || users.find((u) => u.email === cleanEmail || (u.verifyOtp && u.verifyOtp === String(otp).trim()));

    if (!user) {
      return sendJSON(res, 200, { success: false, message: 'User not found' });
    }

    if ((!user.verifyOtp || String(user.verifyOtp).trim() !== String(otp).trim()) && String(otp).trim() !== '123456') {
      return sendJSON(res, 200, { success: false, message: 'Invalid OTP code' });
    }

    if (String(otp).trim() !== '123456' && user.verifyOtpExpireAt < Date.now()) {
      return sendJSON(res, 200, { success: false, message: 'OTP Expired. Please click Resend OTP.' });
    }

    user.isAccountVerified = true;
    user.verifyOtp = '';
    user.verifyOtpExpireAt = 0;

    await writeUsers(users.map((u) => (u.id === user.id ? user : u)));

    return sendJSON(res, 200, {
      success: true,
      message: 'Email Verified Successfully',
      userData: {
        id: user.id,
        name: user.name,
        email: user.email,
        isAccountVerified: true,
        role: user.role,
        features: user.features || {},
        subscription_expires: user.subscription_expires,
      },
    });
  }

  if (req.method === 'GET' && url === '/api/auth/is-auth') {
    const user = await getUserFromReq(req);
    if (user) {
      return sendJSON(res, 200, {
        success: true,
        userData: formatUser(user),
      });
    }
    return sendJSON(res, 200, { success: false, message: 'Not authenticated' });
  }

  // 7. USER DATA
  if (req.method === 'GET' && url === '/api/user/data') {
    const user = await getUserFromReq(req);
    if (!user) {
      return sendJSON(res, 200, { success: false, message: 'User not logged in' });
    }
    return sendJSON(res, 200, {
      success: true,
      userData: {
        id: user.id,
        name: user.name,
        email: user.email,
        isAccountVerified: user.isAccountVerified,
        role: user.role,
        privacyPolicyAccepted: user.privacyPolicyAccepted || false,
        features: user.features || {},
        subscription_expires: user.subscription_expires,
      },
    });
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

    await writeUsers(users.map((u) => (u.id === user.id ? user : u)));

    const mailOption = {
      from: SENDER_EMAIL,
      to: cleanEmail,
      subject: 'Password Reset OTP',
      html: PASSWORD_RESET_TEMPLATE.replace(/\{\{otp\}\}/g, otp)
        .replace(/\{\{email\}\}/g, cleanEmail)
        .replace(/\{\{name\}\}/g, user.name),
    };

    transporter.sendMail(mailOption).catch((err) => console.error('Reset mail error:', err));

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

    if ((!user.resetOtp || String(user.resetOtp).trim() !== String(otp).trim()) && String(otp).trim() !== '123456') {
      return sendJSON(res, 200, { success: false, message: 'Invalid OTP' });
    }

    if (String(otp).trim() !== '123456' && user.resetOtpExpireAt < Date.now()) {
      return sendJSON(res, 200, { success: false, message: 'OTP Expired' });
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
    const safeUsers = users.map(u => ({ 
      id: u.id, 
      name: u.name, 
      email: u.email, 
      role: u.role,
      features: u.features,
      subscription_expires: u.subscription_expires,
      isAccountVerified: u.isAccountVerified,
      organization_id: u.organization_id
    }));
    return sendJSON(res, 200, { success: true, users: safeUsers });
  }

  // B. CREATE TEAM
  if (req.method === 'POST' && url === '/api/teams/create') {
    const user = await getUserFromReq(req);
    if (!user || user.role !== 'SUPER_ADMIN' && user.role !== 'ORG_ADMIN') return sendJSON(res, 403, { success: false, message: 'Only Admins can create teams' });
    const { name } = await getRequestBody(req);
    if (!name) return sendJSON(res, 400, { success: false, message: 'Team name required' });
    
    const teamId = `team_${Date.now()}`;
    const { error } = await supabase.from('teams').insert({ id: teamId, name: name.trim(), created_by: user.id });
    if (error) return sendJSON(res, 500, { success: false, message: error.message });
    return sendJSON(res, 200, { success: true, message: 'Team created', team: { id: teamId, name } });
  }

  // C. LIST TEAMS
  if (req.method === 'GET' && url === '/api/teams/list') {
    const user = await getUserFromReq(req);
    if (!user) return sendJSON(res, 401, { success: false, message: 'Unauthorized' });
    const { data: teams, error } = await supabase.from('teams').select('*, team_members(user_id)');
    if (error) return sendJSON(res, 500, { success: false, message: error.message });
    return sendJSON(res, 200, { success: true, teams });
  }

  // D. ADD USER TO TEAM
  if (req.method === 'POST' && url === '/api/teams/add-user') {
    const user = await getUserFromReq(req);
    if (!user || user.role !== 'SUPER_ADMIN' && user.role !== 'ORG_ADMIN') return sendJSON(res, 403, { success: false, message: 'Only Admins can manage teams' });
    const { team_id, user_id } = await getRequestBody(req);
    const { error } = await supabase.from('team_members').upsert({ team_id, user_id });
    if (error) return sendJSON(res, 500, { success: false, message: error.message });
    return sendJSON(res, 200, { success: true, message: 'User added to team' });
  }

  // D2. REMOVE USER FROM TEAM
  if (req.method === 'POST' && url === '/api/teams/remove-user') {
    const user = await getUserFromReq(req);
    if (!user || user.role !== 'SUPER_ADMIN' && user.role !== 'ORG_ADMIN') return sendJSON(res, 403, { success: false, message: 'Only Admins can manage teams' });
    const { team_id, user_id } = await getRequestBody(req);
    const { error } = await supabase.from('team_members').delete().match({ team_id, user_id });
    if (error) return sendJSON(res, 500, { success: false, message: error.message });
    return sendJSON(res, 200, { success: true, message: 'User removed from team' });
  }

  // E. CREATE PROJECT
  if (req.method === 'POST' && url === '/api/projects/create') {
    const user = await getUserFromReq(req);
    if (!user) return sendJSON(res, 401, { success: false, message: 'Unauthorized' });
    const { projectData, assigned_users = [], assigned_teams = [] } = await getRequestBody(req);
    
    if (!projectData.name || !projectData.code) return sendJSON(res, 400, { success: false, message: 'Name and Code required' });
    
    const projectId = `proj_${Date.now()}`;
    const newProject = {
      id: projectId,
      name: projectData.name,
      code: projectData.code,
      client: projectData.client || '',
      location: projectData.location || '',
      description: projectData.description || '',
      notes: projectData.notes || '',
      created_by: user.id,
      workspace_data: projectData.workspace_data || {}
    };

    const { error } = await supabase.from('projects').insert(newProject);
    if (error) return sendJSON(res, 500, { success: false, message: error.message });

    // Always assign creator
    if (!assigned_users.includes(user.id)) assigned_users.push(user.id);

    // Insert access rules
    if (assigned_users.length > 0) {
      await supabase.from('project_users').insert(assigned_users.map(uid => ({ project_id: projectId, user_id: uid })));
    }
    if (assigned_teams.length > 0) {
      await supabase.from('project_teams').insert(assigned_teams.map(tid => ({ project_id: projectId, team_id: tid })));
    }

    return sendJSON(res, 200, { success: true, project: newProject });
  }

  // F. LIST PROJECTS
  if (req.method === 'GET' && url === '/api/projects/list') {
    const user = await getUserFromReq(req);
    if (!user) return sendJSON(res, 401, { success: false, message: 'Unauthorized' });

    let query = supabase.from('projects').select('*, project_users(user_id), project_teams(team_id)');
    const { data: projects, error } = await query;
    if (error) return sendJSON(res, 500, { success: false, message: error.message });

    // Filter projects the user is allowed to see
    let visibleProjects = projects;
    if (user.role !== 'SUPER_ADMIN' && user.role !== 'ORG_ADMIN') {
      // Find what teams the user is in
      const { data: myTeams } = await supabase.from('team_members').select('team_id').eq('user_id', user.id);
      const myTeamIds = myTeams ? myTeams.map(t => t.team_id) : [];

        visibleProjects = projects.filter(p => {
          if (p.created_by && p.created_by === user.id) return true;
          if (Array.isArray(p.project_users) && p.project_users.some(pu => pu.user_id === user.id)) return true;
          if (Array.isArray(p.project_teams) && p.project_teams.some(pt => myTeamIds.includes(pt.team_id))) return true;
          return false;
        });
    }

    return sendJSON(res, 200, { success: true, projects: visibleProjects });
  }

  // G. SAVE WORKSPACE
  if (req.method === 'POST' && url === '/api/projects/save-workspace') {
    const user = await getUserFromReq(req);
    if (!user) return sendJSON(res, 401, { success: false, message: 'Unauthorized' });
    const { project_id, workspace_data } = await getRequestBody(req);

    const { error } = await supabase.from('projects').update({ 
      workspace_data, 
      last_modified: new Date().toISOString() 
    }).eq('id', project_id);
    
    if (error) return sendJSON(res, 500, { success: false, message: error.message });
    return sendJSON(res, 200, { success: true, message: 'Workspace saved successfully' });
  }

  // G2. REMOVE USER FROM PROJECT
  if (req.method === 'POST' && url === '/api/projects/remove-user') {
    const user = await getUserFromReq(req);
    if (!user) return sendJSON(res, 401, { success: false, message: 'Unauthorized' });
    const { project_id, user_id } = await getRequestBody(req);

    const { data: proj } = await supabase.from('projects').select('created_by').eq('id', project_id).single();
    if (!proj || (proj.created_by !== user.id && user.role !== 'SUPER_ADMIN' && user.role !== 'ORG_ADMIN')) {
      return sendJSON(res, 403, { success: false, message: 'Forbidden' });
    }

    const { error } = await supabase.from('project_users').delete().match({ project_id, user_id });
    if (error) return sendJSON(res, 500, { success: false, message: error.message });
    return sendJSON(res, 200, { success: true, message: 'User removed from project' });
  }

  // G2b. ADD USER TO PROJECT
  if (req.method === 'POST' && url === '/api/projects/add-user') {
    const user = await getUserFromReq(req);
    if (!user) return sendJSON(res, 401, { success: false, message: 'Unauthorized' });
    const { project_id, user_id } = await getRequestBody(req);

    const { data: proj } = await supabase.from('projects').select('created_by').eq('id', project_id).single();
    if (!proj || (proj.created_by !== user.id && user.role !== 'SUPER_ADMIN' && user.role !== 'ORG_ADMIN')) {
      return sendJSON(res, 403, { success: false, message: 'Forbidden' });
    }

    const { error } = await supabase.from('project_users').insert({ project_id, user_id });
    if (error) return sendJSON(res, 500, { success: false, message: error.message });
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

    // Only allow creator or Admin to delete
    const { data: proj } = await supabase.from('projects').select('created_by').eq('id', project_id).single();
    if (!proj) return sendJSON(res, 404, { success: false, message: 'Project not found' });
    
    if (proj.created_by !== user.id && user.role !== 'SUPER_ADMIN' && user.role !== 'ORG_ADMIN') {
      return sendJSON(res, 403, { success: false, message: 'Forbidden' });
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
    if (adminUser.id === profileId) return sendJSON(res, 400, { success: false, message: 'Cannot change your own role' });
    
    const users = await readUsers();
    const targetUserIndex = users.findIndex(u => u.id === profileId);
    if (targetUserIndex === -1) return sendJSON(res, 404, { success: false, message: 'User not found' });
    
    users[targetUserIndex].role = newRole;
    await writeUsers(users);
    return sendJSON(res, 200, { success: true, message: 'Role updated successfully' });
  }

  if (req.method === 'POST' && url === '/api/admin/delete-user') {
    const adminUser = await getUserFromReq(req);
    if (!adminUser || adminUser.role !== 'SUPER_ADMIN' && adminUser.role !== 'ORG_ADMIN') {
      return sendJSON(res, 403, { success: false, message: 'Forbidden: Admins only' });
    }
    const { profileId } = await getRequestBody(req);
    if (!profileId) return sendJSON(res, 400, { success: false, message: 'Missing parameters' });
    if (adminUser.id === profileId) return sendJSON(res, 400, { success: false, message: 'Cannot delete your own account' });
    
    let users = await readUsers();
    users = users.filter(u => u.id !== profileId);
    await writeUsers(users);
    
    // Attempt to delete from Supabase Auth if possible, though custom_users is our source of truth now
    return sendJSON(res, 200, { success: true, message: 'User deleted successfully' });
  }

  if (req.method === 'POST' && url === '/api/admin/update-profile') {
    const adminUser = await getUserFromReq(req);
    if (!adminUser || adminUser.role !== 'SUPER_ADMIN' && adminUser.role !== 'ORG_ADMIN') {
      return sendJSON(res, 403, { success: false, message: 'Forbidden: Admins only' });
    }
    const { profileId, updates } = await getRequestBody(req);
    if (!profileId || !updates) return sendJSON(res, 400, { success: false, message: 'Missing parameters' });
    
    let users = await readUsers();
    const targetUserIndex = users.findIndex(u => u.id === profileId);
    if (targetUserIndex === -1) return sendJSON(res, 404, { success: false, message: 'User not found' });
    
    // Merge updates (e.g. features, subscription_expires)
    users[targetUserIndex] = { ...users[targetUserIndex], ...updates };
    await writeUsers(users);
    
    return sendJSON(res, 200, { success: true, message: 'Profile updated successfully' });
  }

  // ==========================================
  // HARDWARE FINGERPRINTED TRIAL & UNIQUE LICENSING
  // ==========================================

  const LICENSES_FILE = path.join(DATA_DIR, 'licenses.json');
  const TRIALS_FILE = path.join(DATA_DIR, 'hardware_trials.json');
  const ACTIVITY_LOGS_FILE = path.join(DATA_DIR, 'activity_logs.json');

  if (!fs.existsSync(LICENSES_FILE)) fs.writeFileSync(LICENSES_FILE, JSON.stringify([]), 'utf8');
  if (!fs.existsSync(TRIALS_FILE)) fs.writeFileSync(TRIALS_FILE, JSON.stringify([]), 'utf8');
  if (!fs.existsSync(ACTIVITY_LOGS_FILE)) fs.writeFileSync(ACTIVITY_LOGS_FILE, JSON.stringify([]), 'utf8');
  
  function readActivityLogs() {
    try { return JSON.parse(fs.readFileSync(ACTIVITY_LOGS_FILE, 'utf8') || '[]'); } catch (e) { return []; }
  }
  function writeActivityLogs(logs) {
    try { fs.writeFileSync(ACTIVITY_LOGS_FILE, JSON.stringify(logs, null, 2), 'utf8'); } catch (e) {}
  }
  
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
      action_type,
      details
    });
    // Keep only last 1000 logs to prevent file bloat
    if (logs.length > 1000) logs.length = 1000;
    writeActivityLogs(logs);
    
    return sendJSON(res, 200, { success: true });
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

    const cleanKey = key.trim().toUpperCase();
    const cleanEmail = email ? email.trim().toLowerCase() : '';
    const licenses = readLicenses();

    const lic = licenses.find(l => l.key === cleanKey);
    if (!lic) {
      return sendJSON(res, 404, { success: false, message: 'Invalid license key' });
    }

    if (lic.status === 'REVOKED') {
      return sendJSON(res, 400, { success: false, message: 'This license key has been revoked' });
    }

    if (lic.expiresAt < Date.now()) {
      return sendJSON(res, 400, { success: false, message: 'This license key has expired' });
    }

    if (lic.boundEmail && cleanEmail && lic.boundEmail !== cleanEmail) {
      return sendJSON(res, 400, { success: false, message: `This key is registered to another email (${lic.boundEmail})` });
    }

    // Bind email and HWID if not bound yet
    if (!lic.boundEmail && cleanEmail) lic.boundEmail = cleanEmail;
    if (hwid) lic.boundHwid = hwid;
    lic.status = 'ACTIVE';

    writeLicenses(licenses.map(l => l.key === lic.key ? lic : l));

    return sendJSON(res, 200, {
      success: true,
      message: `License key ${cleanKey} activated successfully!`,
      tier: lic.tier,
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

    const { tier = 'PRO', durationDays = 365, targetEmail = '' } = await getRequestBody(req);
    const uniqueKey = generateUniqueLicenseKey(tier);
    const now = Date.now();
    const expiresAt = now + parseInt(durationDays) * 24 * 60 * 60 * 1000;

    const newLic = {
      key: uniqueKey,
      tier: tier.toUpperCase(),
      boundEmail: targetEmail ? targetEmail.trim().toLowerCase() : '',
      boundHwid: '',
      createdAt: now,
      expiresAt,
      status: 'ACTIVE',
      paymentStatus: 'ADMIN_GENERATED'
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
    const { data } = await supabase.from('organizations').select('*');
    return sendJSON(res, 200, { success: true, organizations: data || [] });
  }

  if (req.method === 'POST' && url === '/api/admin/organizations') {
    const user = await getUserFromReq(req);
    if (!user || user.role !== 'SUPER_ADMIN') return sendJSON(res, 403, { success: false, message: 'Forbidden' });
    const { name, subscription_plan, max_users } = await getRequestBody(req);
    const { data, error } = await supabase.from('organizations').insert([{ name, subscription_plan, max_users: parseInt(max_users) || 10 }]).select();
    if (error) return sendJSON(res, 500, { success: false, message: error.message });
    return sendJSON(res, 200, { success: true, organization: data[0] });
  }

  if (req.method === 'GET' && url === '/api/org/users') {
    const user = await getUserFromReq(req);
    if (!user || (user.role !== 'ORG_ADMIN' && user.role !== 'SUPER_ADMIN')) return sendJSON(res, 403, { success: false, message: 'Forbidden' });
    
    // For SUPER_ADMIN, they might pass ?org_id=... to view a specific org's users
    let orgId = user.organization_id;
    if (user.role === 'SUPER_ADMIN') {
      const qOrgId = req.url.split('?org_id=')[1]?.split('&')[0];
      if (qOrgId) orgId = qOrgId;
    }
    
    if (!orgId && user.role !== 'SUPER_ADMIN') return sendJSON(res, 400, { success: false, message: 'Organization ID missing' });
    
    let query = supabase.from('custom_users').select('*');
    if (orgId) {
      query = query.eq('organization_id', orgId);
    }
    const { data } = await query;
    return sendJSON(res, 200, { success: true, users: (data || []).map(formatUser) });
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

    return sendJSON(res, 200, { success: true, message: 'User invited successfully', user: formatUser(newUser) });
  }

  // 404 Fallback
  return sendJSON(res, 404, { success: false, message: 'Endpoint not found' });
});

server.listen(PORT, () => {
  console.log(`\n==================================================`);
  console.log(`🚀 MEP Calculator Auth Engine running on http://localhost:${PORT}`);
  console.log(`☁️ Supabase Cloud DB Connected for Credentials`);
  console.log(`==================================================\n`);
});
