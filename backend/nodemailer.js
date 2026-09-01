import nodemailer from 'nodemailer';
import { Resend } from 'resend';
import * as dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.join(__dirname, '.env') });

// 1. Gmail SMTP Configuration (Backup Fallback)
const SMTP_USER = process.env.SMTP_USER || 'sigmavvok@gmail.com';
const rawPass = process.env.SMTP_PASS || 'wjzf mprj qvnq wzla';
const SMTP_PASS = rawPass.replace(/"/g, '').replace(/\s+/g, '').trim();
const SENDER_EMAIL = process.env.SENDER_EMAIL || SMTP_USER;

const smtpTransporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: SMTP_USER,
    pass: SMTP_PASS
  }
});

// 2. Resend Multi-Key Pool Configuration
function getResendApiKeys() {
  const raw = process.env.RESEND_API_KEYS || process.env.RESEND_API_KEY || '';
  return raw
    .split(',')
    .map(k => k.trim().replace(/^["']|["']$/g, ''))
    .filter(k => k.startsWith('re_'));
}

const RESEND_FROM = process.env.RESEND_FROM_EMAIL || 'MEP Calculator <support@tarv.ai>';
let currentKeyIndex = 0;

const multiProviderTransporter = {
  sendMail: async (options) => {
    const recipient = Array.isArray(options.to) ? options.to[0] : options.to;
    const keys = getResendApiKeys();

    console.log(`\n==================================================`);
    console.log(`🚀 Dispatching email to: ${recipient}`);
    console.log(`📋 Subject: "${options.subject}"`);

    // A. If Resend keys are available, cycle through them
    if (keys.length > 0) {
      console.log(`🔑 Resend Multi-Key Pool active: ${keys.length} key(s) loaded.`);
      
      const totalKeys = keys.length;
      for (let attempt = 0; attempt < totalKeys; attempt++) {
        const keyIdx = (currentKeyIndex + attempt) % totalKeys;
        const apiKey = keys[keyIdx];
        const maskedKey = `${apiKey.slice(0, 6)}...${apiKey.slice(-4)}`;

        try {
          console.log(`🔄 Attempting send via Resend Account #${keyIdx + 1} (${maskedKey})...`);
          const resendClient = new Resend(apiKey);
          const { data, error } = await resendClient.emails.send({
            from: options.from || RESEND_FROM,
            to: Array.isArray(options.to) ? options.to : [options.to],
            subject: options.subject,
            html: options.html
          });

          if (error) {
            console.warn(`⚠️ Resend Key #${keyIdx + 1} rejected (${error.message}). Trying next key...`);
            continue;
          }

          // Advance pool index for round-robin load distribution
          currentKeyIndex = (keyIdx + 1) % totalKeys;

          console.log(`✅ EMAIL DELIVERED via Resend Account #${keyIdx + 1}`);
          console.log(`🆔 Message ID: ${data?.id}`);
          console.log(`==================================================\n`);
          return { messageId: data?.id, provider: 'resend', keyIndex: keyIdx + 1 };
        } catch (err) {
          console.warn(`⚠️ Error on Resend Key #${keyIdx + 1}: ${err.message || err}. Trying next key...`);
        }
      }

      console.warn(`⚠️ All ${totalKeys} Resend keys exhausted or failed. Falling back to Gmail SMTP...`);
    } else {
      console.log(`ℹ️ No Resend keys found in RESEND_API_KEYS. Using Gmail SMTP direct...`);
    }

    // B. Gmail SMTP Fallback
    try {
      console.log(`🚀 Sending via Gmail SMTP (${SMTP_USER})...`);
      const mailOptions = {
        from: options.from || `"MEP Calculator" <${SENDER_EMAIL}>`,
        to: options.to,
        subject: options.subject,
        html: options.html
      };

      const info = await smtpTransporter.sendMail(mailOptions);
      console.log(`✅ EMAIL DELIVERED via Gmail SMTP to ${recipient}`);
      console.log(`🆔 Message ID: ${info.messageId}`);
      console.log(`==================================================\n`);
      return { messageId: info.messageId, provider: 'gmail_smtp' };
    } catch (err) {
      console.error(`❌ All email providers failed for recipient ${recipient}:`, err.message || err);
      console.log(`==================================================\n`);
      throw err;
    }
  }
};

export default multiProviderTransporter;
