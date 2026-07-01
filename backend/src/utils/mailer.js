const nodemailer = require('nodemailer');

let _transporter = null;

async function getTransporter() {
  if (_transporter) return _transporter;

  if (process.env.SMTP_HOST) {
    const transport = nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: parseInt(process.env.SMTP_PORT || '587'),
      secure: process.env.SMTP_SECURE === 'true',
      auth: {
        user: process.env.SMTP_USER,
        // dotenv sometimes keeps surrounding quotes — strip them
        pass: (process.env.SMTP_PASS || '').replace(/^["']|["']$/g, ''),
      },
    });

    // Verify connection once on first use
    try {
      await transport.verify();
      console.log(`📧 Email ready via ${process.env.SMTP_HOST} (${process.env.SMTP_USER})`);
      _transporter = transport;
    } catch (err) {
      console.error('❌ Email connection failed:', err.message);
      console.error('   Check SMTP_HOST / SMTP_USER / SMTP_PASS in backend/.env');
      console.error('   Falling back to console output for verification links.');
      _transporter = null;
    }
  } else {
    // Ethereal catch-all for dev (no SMTP configured)
    try {
      const account = await nodemailer.createTestAccount();
      _transporter = nodemailer.createTransport({
        host: 'smtp.ethereal.email',
        port: 587,
        secure: false,
        auth: { user: account.user, pass: account.pass },
      });
      console.log('📧 No SMTP configured — using Ethereal preview email');
      console.log(`   Preview emails at https://ethereal.email  (login: ${account.user} / ${account.pass})`);
    } catch {
      _transporter = null;
    }
  }

  return _transporter;
}

function emailHtml(name, verifyUrl) {
  return `<!DOCTYPE html>
<html>
<head><meta charset="utf-8">
<style>
  body{margin:0;padding:20px;background:#f8fafc;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif}
  .wrap{max-width:480px;margin:0 auto;background:#fff;border-radius:20px;padding:40px;box-shadow:0 1px 3px rgba(0,0,0,.1)}
  .icon{width:56px;height:56px;background:#6366f1;border-radius:16px;display:flex;align-items:center;justify-content:center;font-size:26px;margin:0 auto 20px}
  h1{text-align:center;color:#0f172a;margin:0 0 8px;font-size:22px;font-weight:700}
  .sub{text-align:center;color:#64748b;margin:0 0 28px;font-size:15px}
  .btn{display:block;background:#6366f1;color:#fff!important;text-align:center;text-decoration:none;padding:14px;border-radius:12px;font-weight:600;font-size:15px;margin-bottom:20px}
  .link-box{background:#f8fafc;border:1px solid #e2e8f0;border-radius:10px;padding:12px;word-break:break-all;font-size:12px;color:#64748b}
  .foot{text-align:center;color:#94a3b8;font-size:12px;margin-top:24px}
</style></head>
<body>
<div class="wrap">
  <div style="text-align:center"><div class="icon">💸</div></div>
  <h1>Verify your email</h1>
  <p class="sub">Hi ${name}, welcome to SplitWise!<br>Click below to confirm your email address.</p>
  <a href="${verifyUrl}" class="btn">✓ Verify Email Address</a>
  <p style="color:#94a3b8;font-size:13px;text-align:center;margin-bottom:8px">Or copy this link:</p>
  <div class="link-box"><a href="${verifyUrl}" style="color:#6366f1">${verifyUrl}</a></div>
  <p style="color:#94a3b8;font-size:12px;text-align:center;margin-top:16px">
    Link expires in 24 hours. If you didn't sign up, you can safely ignore this email.
  </p>
  <div class="foot">SplitWise — Split expenses with friends</div>
</div>
</body></html>`;
}

async function sendVerificationEmail(user, token) {
  const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:5173';
  const verifyUrl = `${frontendUrl}/verify-email?token=${token}`;

  const transport = await getTransporter();

  if (!transport) {
    // Pure console fallback — zero setup needed
    console.log('\n──────────────────────────────────────────────────────');
    console.log('📧  VERIFICATION LINK  (no working SMTP — dev fallback)');
    console.log(`    To:   ${user.email}`);
    console.log(`    Link: ${verifyUrl}`);
    console.log('──────────────────────────────────────────────────────\n');
    return;
  }

  const from = process.env.SMTP_FROM || `SplitWise <${process.env.SMTP_USER}>`;

  const info = await transport.sendMail({
    from,
    to: user.email,
    subject: 'Verify your SplitWise account',
    html: emailHtml(user.name, verifyUrl),
    text: `Hi ${user.name},\n\nVerify your SplitWise account:\n${verifyUrl}\n\nLink expires in 24 hours.`,
  });

  console.log(`📧 Verification email sent to ${user.email}`);
  // Print Ethereal preview URL when using test accounts
  const preview = nodemailer.getTestMessageUrl(info);
  if (preview) console.log(`   Preview: ${preview}`);
}

module.exports = { sendVerificationEmail };
