require("dotenv").config();
const nodemailer = require('nodemailer');

const transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: process.env.SMTP_PORT,
    secure: true,
    auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS
    }
});

// Verify transporter on startup
transporter.verify((error, success) => {
    if (error) {
      console.error("SMTP Verification Failed:", error);
    } else {
      console.log("SMTP Transporter is ready to send emails");
    }
  });

const emailStyles = `
    font-family: Arial, sans-serif;
    color: #333;
    line-height: 1.6;
`;

const sendWelcomeEmail = async (to, { name, email, password, subscription_plan, subscription_status } = {}, isAdminCreated = false) => {
    const planDetails = subscription_plan === 'yearly' ? '$156/year' : '$16.25/month';
    const htmlContent = isAdminCreated ? `
        <div style="${emailStyles}">
            <table width="100%" cellpadding="0" cellspacing="0" style="max-width: 600px; margin: 0 auto; border: 1px solid #e0e0e0;">
                <tr>
                    <td style="background-color: #4CAF50; padding: 20px; text-align: center;">
                        <h2 style="color: #ffffff; margin: 0;">Welcome to Arbilo!</h2>
                    </td>
                </tr>
                <tr>
                    <td style="padding: 20px;">
                        <p>Hello ${name || 'User'},</p>
                        <p>An admin has created your account. Below are your login credentials and subscription details:</p>
                        <table width="100%" cellpadding="10" cellspacing="0" style="background: #f5f5f5; border-radius: 5px;">
                            <tr><td width="30%"><strong>Email:</strong></td><td>${email}</td></tr>
                            <tr><td width="30%"><strong>Password:</strong></td><td>${password}</td></tr>
                            <tr><td width="30%"><strong>Plan:</strong></td><td>${planDetails} (${subscription_status})</td></tr>
                        </table>
                        <p><em>Taxes extra, if applicable as per your local regulations.</em></p>
                        <p>Please change your password after your first login for security.</p>
                        <p>Regards,<br>The iGrow Big Team</p>
                    </td>
                </tr>
                <tr>
                    <td style="background-color: #f0f0f0; padding: 10px; text-align: center; font-size: 12px;">
                        © 2025 iGrow Big. All rights reserved.
                    </td>
                </tr>
            </table>
        </div>
    ` : `
        <div style="${emailStyles}">
            <table width="100%" cellpadding="0" cellspacing="0" style="max-width: 600px; margin: 0 auto; border: 1px solid #e0e0e0;">
                <tr>
                    <td style="background-color: #4CAF50; padding: 20px; text-align: center;">
                        <h2 style="color: #ffffff; margin: 0;">Welcome to Arbilo!</h2>
                    </td>
                </tr>
                <tr>
                    <td style="padding: 20px;">
                        <p>Hello ${name || 'User'},</p>
                        <p>Thank you for signing up! Your account has been created with the following subscription:</p>
                        <table width="100%" cellpadding="10" cellspacing="0" style="background: #f5f5f5; border-radius: 5px;">
                            <tr><td width="30%"><strong>Plan:</strong></td><td>${planDetails} (${subscription_status})</td></tr>
                        </table>
                        <p><em>Taxes extra, if applicable as per your local regulations.</em></p>
                        <p>Get started by logging in with your credentials.</p>
                        <p>Regards,<br>The iGrow Big Team</p>
                    </td>
                </tr>
                <tr>
                    <td style="background-color: #f0f0f0; padding: 10px; text-align: center; font-size: 12px;">
                        © 2025 iGrow Big. All rights reserved.
                    </td>
                </tr>
            </table>
        </div>
    `;

    await transporter.sendMail({
        from: '"iGrow Big" <hello@arbilo.com>',
        to,
        subject: 'Welcome to iGrow Big',
        html: htmlContent
    });
};

const sendPasswordChangeEmail = async (to, name) => {
    const htmlContent = `
        <div style="${emailStyles}">
            <table width="100%" cellpadding="0" cellspacing="0" style="max-width: 600px; margin: 0 auto; border: 1px solid #e0e0e0;">
                <tr>
                    <td style="background-color: #4CAF50; padding: 20px; text-align: center;">
                        <h2 style="color: #ffffff; margin: 0;">Password Changed Successfully</h2>
                    </td>
                </tr>
                <tr>
                    <td style="padding: 20px;">
                        <p>Hello ${name || 'User'},</p>
                        <p>Your password has been successfully changed.</p>
                        <p>If you did not make this change, please contact our support team immediately at <a href="mailto:support@arbilo.com">support@arbilo.com</a>.</p>
                        <p>Regards,<br>The iGrow Big Team</p>
                    </td>
                </tr>
                <tr>
                    <td style="background-color: #f0f0f0; padding: 10px; text-align: center; font-size: 12px;">
                        © 2025 iGrow Big. All rights reserved.
                    </td>
                </tr>
            </table>
        </div>
    `;

    await transporter.sendMail({
        from: '"iGrow Big" <hello@arbilo.com>',
        to,
        subject: 'Password Change Notification',
        html: htmlContent
    });
};

module.exports = { sendWelcomeEmail, sendPasswordChangeEmail, transporter };