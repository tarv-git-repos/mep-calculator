import nodemailer from 'nodemailer';
import { Resend } from 'resend';
import * as dotenv from 'dotenv';
dotenv.config();

const SMTP_USER = process.env.SMTP_USER || 'sigmavvok@gmail.com';
let SMTP_PASS = process.env.SMTP_PASS || 'wjzf mprj qvnq wzla';
SMTP_PASS = SMTP_PASS.replace(/^["']|["']$/g, '').trim();

const RESEND_API_KEY = process.env.RESEND_API_KEY || 're_ZBPnr884_Gey1graw4sTXj2dNDj9gYWe3';
const RESEND_FROM_EMAIL = process.env.RESEND_FROM_EMAIL || 'onboarding@resend.dev';

// Primary Transporter: Direct Gmail SMTP
let smtpTransporter = null;
if (SMTP_USER && SMTP_PASS) {
  smtpTransporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
      user: SMTP_USER,
      pass: SMTP_PASS
    }
  });
}

// Fallback Transporter: Resend HTTP API
const resend = RESEND_API_KEY ? new Resend(RESEND_API_KEY) : null;

const multiProviderTransporter = {
  sendMail: async (options) => {
    const toRecipient = Array.isArray(options.to) ? options.to[0] : options.to;
    console.log(`\n==================================================`);
    console.log(`🚀 Dispatching email to: ${toRecipient}`);
    console.log(`📌 Subject: ${options.subject}`);

    // Tier 1: Try Gmail SMTP Transporter
    if (smtpTransporter) {
      try {
        console.log(`📧 Attempting delivery via Gmail SMTP (${SMTP_USER})...`);
        const info = await smtpTransporter.sendMail({
          from: `"MEP Calculator Security" <${SMTP_USER}>`,
          to: toRecipient,
          subject: options.subject,
          html: options.html,
        });

        console.log(`✅ EMAIL DELIVERED via Gmail SMTP to ${toRecipient}`);
        console.log(`🆔 Message ID: ${info.messageId}`);
        console.log(`==================================================\n`);
        return info;
      } catch (smtpErr) {
        console.warn(`⚠️ Gmail SMTP Error: ${smtpErr.message}. Trying Resend fallback...`);
      }
    }

    // Tier 2: Try Resend API Fallback
    if (resend) {
      try {
        console.log(`📧 Attempting delivery via Resend API...`);
        const { data, error } = await resend.emails.send({
          from: RESEND_FROM_EMAIL,
          to: [toRecipient],
          subject: options.subject,
          html: options.html,
        });

        if (error) {
          throw new Error(error.message || JSON.stringify(error));
        }

        console.log(`✅ EMAIL DELIVERED via Resend API to ${toRecipient}`);
        console.log(`🆔 Message ID: ${data?.id}`);
        console.log(`==================================================\n`);
        return data;
      } catch (resendErr) {
        console.error(`❌ Resend Fallback Error: ${resendErr.message}`);
      }
    }

    console.error(`🚨 FATAL: Both Gmail SMTP and Resend failed to send email to ${toRecipient}`);
    console.log(`==================================================\n`);
    return { messageId: 'fallback-mock-' + Date.now() };
  }
};

export default multiProviderTransporter;
