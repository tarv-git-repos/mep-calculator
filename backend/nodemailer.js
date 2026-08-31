import nodemailer from 'nodemailer';
import * as dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.join(__dirname, '.env') });

const SMTP_USER = process.env.SMTP_USER || 'sigmavvok@gmail.com';
const rawPass = process.env.SMTP_PASS || 'wjzf mprj qvnq wzla';
const SMTP_PASS = rawPass.replace(/"/g, '').replace(/\s+/g, '').trim();
const SENDER_EMAIL = process.env.SENDER_EMAIL || SMTP_USER;

// Create Nodemailer transport for Gmail SMTP
const smtpTransporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: SMTP_USER,
    pass: SMTP_PASS
  }
});

const multiProviderTransporter = {
  sendMail: async (options) => {
    const recipient = Array.isArray(options.to) ? options.to[0] : options.to;
    console.log(`\n==================================================`);
    console.log(`🚀 Sending email via Gmail SMTP to: ${recipient}...`);

    const mailOptions = {
      from: options.from || `"MEP Calculator" <${SENDER_EMAIL}>`,
      to: options.to,
      subject: options.subject,
      html: options.html
    };

    try {
      const info = await smtpTransporter.sendMail(mailOptions);
      console.log(`✅ EMAIL DELIVERED via Gmail SMTP to ${recipient}`);
      console.log(`🆔 Message ID: ${info.messageId}`);
      console.log(`==================================================\n`);
      return info;
    } catch (err) {
      console.error(`❌ Gmail SMTP Error sending to ${recipient}:`, err.message || err);
      console.log(`==================================================\n`);
      throw err;
    }
  }
};

export default multiProviderTransporter;
