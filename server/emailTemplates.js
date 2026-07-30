export const WELCOME_EMAIL_TEMPLATE = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Welcome to MEP Calculator</title>
  <style type="text/css">
    body {
      margin: 0;
      padding: 0;
      min-width: 100%;
      background-color: #0f172a;
      font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif;
    }
    table {
      border-spacing: 0;
      font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif;
      color: #333333;
    }
    td {
      padding: 0;
    }
    .wrapper {
      width: 100%;
      table-layout: fixed;
      background-color: #0f172a;
      padding: 40px 0;
    }
    .main {
      background-color: #ffffff;
      margin: 0 auto;
      width: 100%;
      max-width: 600px;
      border-radius: 20px;
      overflow: hidden;
      box-shadow: 0 20px 40px rgba(0,0,0,0.3);
    }
    .header-banner {
      background: linear-gradient(135deg, #0A7BC7 0%, #2563eb 50%, #4f46e5 100%);
      padding: 40px 30px;
      text-align: center;
      color: #ffffff;
    }
    .content {
      padding: 36px 32px;
      color: #1e293b;
    }
    .btn-primary {
      background: linear-gradient(135deg, #0A7BC7 0%, #2563eb 100%);
      color: #ffffff !important;
      text-decoration: none;
      padding: 14px 32px;
      border-radius: 30px;
      font-weight: bold;
      display: inline-block;
      font-size: 15px;
      box-shadow: 0 4px 15px rgba(10, 123, 199, 0.4);
    }
    .card-grid {
      background-color: #f8fafc;
      border-radius: 12px;
      padding: 20px;
      margin: 24px 0;
      border: 1px solid #e2e8f0;
    }
    .footer {
      background-color: #f1f5f9;
      padding: 24px;
      text-align: center;
      font-size: 12px;
      color: #64748b;
    }
  </style>
</head>
<body>
  <div class="wrapper">
    <table class="main" align="center">
      <tr>
        <td class="header-banner">
          <div style="font-size: 28px; font-weight: 800; letter-spacing: -0.5px; margin-bottom: 8px;">
            MEP Calculator Suite
          </div>
          <div style="font-size: 18px; font-weight: 500; opacity: 0.9;">
            Welcome to Universal MEP Engineering Suite 🚀
          </div>
        </td>
      </tr>
      <tr>
        <td class="content">
          <h2 style="font-size: 22px; font-weight: 700; margin: 0 0 16px; color: #0f172a;">
            Hi {{name}},
          </h2>
          <p style="font-size: 15px; line-height: 1.6; color: #475569; margin: 0 0 20px;">
            Welcome to <strong>MEP Calculator</strong>! Your account has been registered successfully. We are excited to provide you with industry-grade HVAC, Electrical, and Plumbing calculation tools.
          </p>

          <div style="text-align: center; margin: 30px 0;">
            <a href="http://localhost:5173" class="btn-primary" target="_blank">Access MEP Calculators &rarr;</a>
          </div>

          <div class="card-grid">
            <h3 style="font-size: 16px; font-weight: 700; margin: 0 0 14px; color: #1e293b;">
              Your Account Features:
            </h3>
            <table width="100%">
              <tr>
                <td style="padding: 8px 0; font-size: 14px; color: #334155;">
                  ❄️ <strong>HVAC Calculators:</strong> Duct Sizer, Chilled Water, Preliminary Load Sizer & Ventilation.
                </td>
              </tr>
              <tr>
                <td style="padding: 8px 0; font-size: 14px; color: #334155;">
                  ⚡ <strong>Electrical Calculators:</strong> Load Schedule, Cable Sizer, Voltage Drop & Busbar.
                </td>
              </tr>
              <tr>
                <td style="padding: 8px 0; font-size: 14px; color: #334155;">
                  💧 <strong>Plumbing Calculators:</strong> Water Demand, Fixture Unit, Sump Pump & Tank Sizing.
                </td>
              </tr>
            </table>
          </div>

          <p style="font-size: 14px; line-height: 1.5; color: #64748b; margin: 0;">
            If you have any questions, feel free to contact engineering support.
            <br><br>
            Best regards,<br>
            <strong>MEP Calculator Engineering Team</strong>
          </p>
        </td>
      </tr>
      <tr>
        <td class="footer">
          <p style="margin: 0 0 8px;">This email was sent to <strong>{{email}}</strong> to confirm your registration.</p>
          <p style="margin: 0;">&copy; 2026 MEP Calculator. All rights reserved.</p>
        </td>
      </tr>
    </table>
  </div>
</body>
</html>
`;

export const EMAIL_VERIFY_TEMPLATE = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Account Verification OTP</title>
  <style type="text/css">
    body {
      margin: 0;
      padding: 0;
      min-width: 100%;
      background-color: #0f172a;
      font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif;
    }
    table {
      border-spacing: 0;
      font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif;
      color: #333333;
    }
    td {
      padding: 0;
    }
    .wrapper {
      width: 100%;
      table-layout: fixed;
      background-color: #0f172a;
      padding: 40px 0;
    }
    .main {
      background-color: #ffffff;
      margin: 0 auto;
      width: 100%;
      max-width: 550px;
      border-radius: 20px;
      overflow: hidden;
      box-shadow: 0 20px 40px rgba(0,0,0,0.3);
    }
    .header {
      background: linear-gradient(135deg, #0f172a 0%, #1e293b 100%);
      padding: 32px 24px;
      text-align: center;
      color: #ffffff;
    }
    .content {
      padding: 36px 32px;
      color: #1e293b;
      text-align: center;
    }
    .otp-card {
      background: linear-gradient(135deg, #0A7BC7 0%, #2563eb 100%);
      border-radius: 16px;
      padding: 24px;
      margin: 28px 0;
      color: #ffffff;
      box-shadow: 0 10px 25px rgba(10, 123, 199, 0.35);
    }
    .otp-code {
      font-size: 38px;
      font-weight: 800;
      letter-spacing: 12px;
      color: #ffffff;
      margin: 10px 0 0 12px;
      font-family: 'Courier New', Courier, monospace;
    }
    .footer {
      background-color: #f8fafc;
      padding: 20px;
      text-align: center;
      font-size: 12px;
      color: #64748b;
      border-top: 1px solid #e2e8f0;
    }
  </style>
</head>
<body>
  <div class="wrapper">
    <table class="main" align="center">
      <tr>
        <td class="header">
          <div style="font-size: 24px; font-weight: 800; letter-spacing: -0.5px;">
            MEP Calculator
          </div>
          <div style="font-size: 14px; opacity: 0.85; margin-top: 4px;">
            Account Verification OTP
          </div>
        </td>
      </tr>
      <tr>
        <td class="content">
          <h2 style="font-size: 22px; font-weight: 700; margin: 0 0 12px; color: #0f172a;">
            Verify Your Email Address
          </h2>
          <p style="font-size: 15px; line-height: 1.6; color: #475569; margin: 0;">
            You are just one step away from verifying your MEP Calculator account for <strong style="color: #0A7BC7;">{{email}}</strong>.
            Use the 6-digit OTP code below to complete your verification:
          </p>

          <div class="otp-card">
            <div style="font-size: 12px; font-weight: 700; text-transform: uppercase; letter-spacing: 2px; opacity: 0.9;">
              Your One-Time Password
            </div>
            <div class="otp-code">
              {{otp}}
            </div>
          </div>

          <p style="font-size: 13px; color: #64748b; margin: 0 0 20px;">
            ⏳ This OTP is valid for <strong>24 hours</strong>. Please do not share this code with anyone.
          </p>
        </td>
      </tr>
      <tr>
        <td class="footer">
          <p style="margin: 0;">If you didn't request this email, please ignore it.</p>
          <p style="margin: 6px 0 0;">&copy; 2026 MEP Calculator. All rights reserved.</p>
        </td>
      </tr>
    </table>
  </div>
</body>
</html>
`;

export const PASSWORD_RESET_TEMPLATE = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Password Reset OTP</title>
  <style type="text/css">
    body {
      margin: 0;
      padding: 0;
      min-width: 100%;
      background-color: #0f172a;
      font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif;
    }
    table {
      border-spacing: 0;
      font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif;
      color: #333333;
    }
    td {
      padding: 0;
    }
    .wrapper {
      width: 100%;
      table-layout: fixed;
      background-color: #0f172a;
      padding: 40px 0;
    }
    .main {
      background-color: #ffffff;
      margin: 0 auto;
      width: 100%;
      max-width: 550px;
      border-radius: 20px;
      overflow: hidden;
      box-shadow: 0 20px 40px rgba(0,0,0,0.3);
    }
    .header {
      background: linear-gradient(135deg, #991b1b 0%, #dc2626 100%);
      padding: 32px 24px;
      text-align: center;
      color: #ffffff;
    }
    .content {
      padding: 36px 32px;
      color: #1e293b;
      text-align: center;
    }
    .otp-card {
      background: linear-gradient(135deg, #dc2626 0%, #ef4444 100%);
      border-radius: 16px;
      padding: 24px;
      margin: 28px 0;
      color: #ffffff;
      box-shadow: 0 10px 25px rgba(220, 38, 38, 0.35);
    }
    .otp-code {
      font-size: 38px;
      font-weight: 800;
      letter-spacing: 12px;
      color: #ffffff;
      margin: 10px 0 0 12px;
      font-family: 'Courier New', Courier, monospace;
    }
    .footer {
      background-color: #f8fafc;
      padding: 20px;
      text-align: center;
      font-size: 12px;
      color: #64748b;
      border-top: 1px solid #e2e8f0;
    }
  </style>
</head>
<body>
  <div class="wrapper">
    <table class="main" align="center">
      <tr>
        <td class="header">
          <div style="font-size: 24px; font-weight: 800; letter-spacing: -0.5px;">
            MEP Calculator
          </div>
          <div style="font-size: 14px; opacity: 0.85; margin-top: 4px;">
            Password Reset Request
          </div>
        </td>
      </tr>
      <tr>
        <td class="content">
          <h2 style="font-size: 22px; font-weight: 700; margin: 0 0 12px; color: #0f172a;">
            Reset Your Password
          </h2>
          <p style="font-size: 15px; line-height: 1.6; color: #475569; margin: 0;">
            We received a password reset request for your account: <strong style="color: #dc2626;">{{email}}</strong>.
            Use the OTP below to reset your password:
          </p>

          <div class="otp-card">
            <div style="font-size: 12px; font-weight: 700; text-transform: uppercase; letter-spacing: 2px; opacity: 0.9;">
              Password Reset Code
            </div>
            <div class="otp-code">
              {{otp}}
            </div>
          </div>

          <p style="font-size: 13px; color: #64748b; margin: 0 0 20px;">
            ⏳ This code is valid for <strong>15 minutes</strong>. If you did not request a password reset, please secure your account immediately.
          </p>
        </td>
      </tr>
      <tr>
        <td class="footer">
          <p style="margin: 0;">If you didn't request a password reset, you can safely ignore this email.</p>
          <p style="margin: 6px 0 0;">&copy; 2026 MEP Calculator. All rights reserved.</p>
        </td>
      </tr>
    </table>
  </div>
</body>
</html>
`;
