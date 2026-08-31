import { Resend } from 'resend';
import nodemailer from 'nodemailer';
import * as dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.join(__dirname, '.env') });

const getTransporter = () => {
    const smtpUser = process.env.SMTP_USER || 'sigmavvok@gmail.com';
    const smtpPass = (process.env.SMTP_PASS || 'wjzf mprj qvnq wzla').replace(/"/g, '').trim();
    return nodemailer.createTransport({
        service: 'gmail',
        auth: {
            user: smtpUser,
            pass: smtpPass,
        },
    });
};

const multiProviderTransporter = {
    sendMail: async (options) => {
        const resendApiKey = process.env.RESEND_API_KEY || 're_ZBPnr884_Gey1graw4sTXj2dNDj9gYWe3';
        const resendFrom = process.env.RESEND_FROM_EMAIL || 'support@tarv.ai';
        const targetEmail = Array.isArray(options.to) ? options.to[0] : options.to;

        // 1. Try Resend HTTP API
        if (resendApiKey) {
            try {
                console.log(`\n==================================================`);
                console.log(`🚀 Attempting to send OTP email to ${targetEmail} via Resend...`);
                const resend = new Resend(resendApiKey);
                const { data, error } = await resend.emails.send({
                    from: resendFrom,
                    to: Array.isArray(options.to) ? options.to : [options.to],
                    subject: options.subject,
                    html: options.html,
                });

                if (error) {
                    console.warn(`⚠️ Resend Warning:`, error.message || error);
                    throw error;
                }

                console.log(`✅ EMAIL DELIVERED via Resend to ${targetEmail} (ID: ${data?.id})`);
                console.log(`==================================================\n`);
                return data;
            } catch (resendError) {
                console.warn(`⚠️ Resend send failed (${resendError.message}). Falling back to Gmail SMTP...`);
            }
        }

        // 2. Fallback to Gmail SMTP Transporter
        try {
            console.log(`📧 Attempting to send OTP email to ${targetEmail} via Gmail SMTP...`);
            const gmailTransporter = getTransporter();
            const smtpUser = process.env.SMTP_USER || 'sigmavvok@gmail.com';
            
            const info = await gmailTransporter.sendMail({
                from: `"MEP Calculator Security" <${smtpUser}>`,
                to: options.to,
                subject: options.subject,
                html: options.html,
            });

            console.log(`✅ EMAIL DELIVERED via Gmail SMTP to ${targetEmail} (MessageId: ${info.messageId})`);
            console.log(`==================================================\n`);
            return info;
        } catch (smtpError) {
            console.error('\n==================================================');
            console.error(`🚨 FATAL: All email delivery providers failed!`);
            console.error(`SMTP Error details: ${smtpError.message}`);
            console.error('==================================================\n');
            return { messageId: 'failed-' + Date.now(), error: smtpError.message };
        }
    }
};

export default multiProviderTransporter;
