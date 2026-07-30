import http from 'http';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import transporter from './nodemailer.js';
import { WELCOME_EMAIL_TEMPLATE, EMAIL_VERIFY_TEMPLATE, PASSWORD_RESET_TEMPLATE } from './emailTemplates.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PORT = process.env.PORT || 4000;
const JWT_SECRET = process.env.JWT_SECRET || 'mep_calculator_auth_secret_key_2026';
const SENDER_EMAIL = process.env.SENDER_EMAIL || 'tarv.official@gmail.com';

// Local database persistence
const DATA_DIR = path.join(__dirname, 'data');
const USERS_FILE = path.join(DATA_DIR, 'users.json');

if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}
if (!fs.existsSync(USERS_FILE)) {
  fs.writeFileSync(USERS_FILE, JSON.stringify([]), 'utf8');
}

function readUsers() {
  try {
    const data = fs.readFileSync(USERS_FILE, 'utf8');
    const users = JSON.parse(data || '[]');
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
        role: 'ADMIN',
        resetOtp: '',
        resetOtpExpireAt: 0,
        createdAt: new Date().toISOString()
      };
      users.push(adminUser);
      fs.writeFileSync(USERS_FILE, JSON.stringify(users, null, 2), 'utf8');
    }
    return users;
  } catch (e) {
    return [];
  }
}

function writeUsers(users) {
  try {
    fs.writeFileSync(USERS_FILE, JSON.stringify(users, null, 2), 'utf8');
  } catch (e) {
    console.error('Error writing users:', e);
  }
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

function getUserFromReq(req) {
  const cookies = parseCookies(req);
  let token = cookies.token;
  if (!token && req.headers.authorization) {
    token = req.headers.authorization.replace('Bearer ', '').trim();
  }
  if (!token) return null;
  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    const users = readUsers();
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

    const users = readUsers();
    const cleanEmail = email.trim().toLowerCase();
    const existingUser = users.find((u) => u.email === cleanEmail);

    if (existingUser) {
      if (!existingUser.isAccountVerified) {
        // User attempted sign up previously but hasn't completed OTP verification yet.
        // Update details, generate fresh 6-digit OTP, send verification email, and open OTP screen!
        const otp = String(Math.floor(100000 + Math.random() * 900000));
        existingUser.name = name.trim();
        existingUser.password = await bcrypt.hash(password, 10);
        existingUser.verifyOtp = otp;
        existingUser.verifyOtpExpireAt = Date.now() + 24 * 60 * 60 * 1000;

        writeUsers(users.map((u) => (u.id === existingUser.id ? existingUser : u)));

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
      resetOtp: '',
      resetOtpExpireAt: 0,
      createdAt: new Date().toISOString(),
    };

    users.push(newUser);
    writeUsers(users);

    const token = jwt.sign({ id: userId, email: cleanEmail }, JWT_SECRET, { expiresIn: '7d' });
    const cookieStr = `token=${token}; HttpOnly; Path=/; Max-Age=604800; SameSite=Lax`;

    // Dispatch Emails via Nodemailer Engine
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

    const users = readUsers();
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
    const userFromToken = getUserFromReq(req);
    const users = readUsers();
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

    writeUsers(users.map((u) => (u.id === user.id ? user : u)));

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
    const userFromToken = getUserFromReq(req);

    if (!otp) {
      return sendJSON(res, 200, { success: false, message: 'Missing 6-digit OTP' });
    }

    const users = readUsers();
    const cleanEmail = (email || '').trim().toLowerCase();
    const user = userFromToken || users.find((u) => u.email === cleanEmail || (u.verifyOtp && u.verifyOtp === String(otp).trim()));

    if (!user) {
      return sendJSON(res, 200, { success: false, message: 'User not found' });
    }

    if (!user.verifyOtp || String(user.verifyOtp).trim() !== String(otp).trim()) {
      return sendJSON(res, 200, { success: false, message: 'Invalid OTP code' });
    }

    if (user.verifyOtpExpireAt < Date.now()) {
      return sendJSON(res, 200, { success: false, message: 'OTP Expired. Please click Resend OTP.' });
    }

    user.isAccountVerified = true;
    user.verifyOtp = '';
    user.verifyOtpExpireAt = 0;

    writeUsers(users.map((u) => (u.id === user.id ? user : u)));

    return sendJSON(res, 200, {
      success: true,
      message: 'Email Verified Successfully',
      userData: {
        id: user.id,
        name: user.name,
        email: user.email,
        isAccountVerified: true,
      },
    });
  }

  // 6. IS AUTH CHECK
  if (req.method === 'GET' && url === '/api/auth/is-auth') {
    const user = getUserFromReq(req);
    if (user) {
      return sendJSON(res, 200, {
        success: true,
        userData: { id: user.id, name: user.name, email: user.email, isAccountVerified: user.isAccountVerified },
      });
    }
    return sendJSON(res, 200, { success: false, message: 'Not authenticated' });
  }

  // 7. USER DATA
  if (req.method === 'GET' && url === '/api/user/data') {
    const user = getUserFromReq(req);
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
      },
    });
  }

  // 8. SEND RESET OTP
  if (req.method === 'POST' && url === '/api/auth/send-reset-otp') {
    const { email } = await getRequestBody(req);
    if (!email) {
      return sendJSON(res, 200, { success: false, message: 'Email is required' });
    }

    const users = readUsers();
    const cleanEmail = email.trim().toLowerCase();
    const user = users.find((u) => u.email === cleanEmail);

    if (!user) {
      return sendJSON(res, 200, { success: false, message: 'User not found with this email' });
    }

    const otp = String(Math.floor(100000 + Math.random() * 900000));
    user.resetOtp = otp;
    user.resetOtpExpireAt = Date.now() + 15 * 60 * 1000;

    writeUsers(users.map((u) => (u.id === user.id ? user : u)));

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

    const users = readUsers();
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

    const hashedPassword = await bcrypt.hash(newPassword, 10);
    user.password = hashedPassword;
    user.resetOtp = '';
    user.resetOtpExpireAt = 0;

    writeUsers(users.map((u) => (u.id === user.id ? user : u)));

    return sendJSON(res, 200, { success: true, message: 'Password reset successfully' });
  }

  // 404 Fallback
  return sendJSON(res, 404, { success: false, message: 'Endpoint not found' });
});

server.listen(PORT, () => {
  console.log(`\n==================================================`);
  console.log(`🚀 MEP Calculator Auth Engine running on http://localhost:${PORT}`);
  console.log(`==================================================\n`);
});
