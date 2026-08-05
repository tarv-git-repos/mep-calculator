import nodemailer from 'nodemailer';
import * as dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.join(__dirname, '.env') });

const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS
    }
});

const multiProviderTransporter = {
    sendMail: async (options) => {
        try {
            console.log(`\n==================================================`);
            console.log(`Attempting to send email via Gmail SMTP...`);
            
            const info = await transporter.sendMail({
                from: options.from || process.env.SENDER_EMAIL,
                to: options.to,
                subject: options.subject,
                html: options.html,
            });

            console.log(`EMAIL DELIVERED via Gmail SMTP to ${options.to}`);
            console.log(`Message ID: ${info.messageId}`);
            console.log(`==================================================\n`);
            return info;
        } catch (error) {
            console.error('\n==================================================');
            console.error(`FATAL ERROR: Email failed to send via Gmail SMTP!`);
            console.error(`Error details: ${error.message}`);
            console.error('==================================================\n');
            throw error;
        }
    }
};

export default multiProviderTransporter;
