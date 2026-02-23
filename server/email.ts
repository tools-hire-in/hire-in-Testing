// SendGrid email service - Replit SendGrid integration
import sgMail from '@sendgrid/mail';

let connectionSettings: any;

async function getCredentials() {
  const hostname = process.env.REPLIT_CONNECTORS_HOSTNAME;
  const xReplitToken = process.env.REPL_IDENTITY
    ? 'repl ' + process.env.REPL_IDENTITY
    : process.env.WEB_REPL_RENEWAL
    ? 'depl ' + process.env.WEB_REPL_RENEWAL
    : null;

  if (!xReplitToken) {
    throw new Error('X_REPLIT_TOKEN not found for repl/depl');
  }

  connectionSettings = await fetch(
    'https://' + hostname + '/api/v2/connection?include_secrets=true&connector_names=sendgrid',
    {
      headers: {
        'Accept': 'application/json',
        'X_REPLIT_TOKEN': xReplitToken
      }
    }
  ).then(res => res.json()).then(data => data.items?.[0]);

  if (!connectionSettings || (!connectionSettings.settings.api_key || !connectionSettings.settings.from_email)) {
    throw new Error('SendGrid not connected');
  }
  return { apiKey: connectionSettings.settings.api_key, email: connectionSettings.settings.from_email };
}

async function getUncachableSendGridClient() {
  const { apiKey, email } = await getCredentials();
  sgMail.setApiKey(apiKey);
  return {
    client: sgMail,
    fromEmail: email
  };
}

export async function sendInvitationEmail(options: {
  to: string;
  firstName: string;
  lastName: string;
  role: string;
  temporaryPassword: string;
  loginUrl: string;
}) {
  try {
    const { client, fromEmail } = await getUncachableSendGridClient();
    const roleLabels: Record<string, string> = {
      super_admin: "Super Admin",
      admin: "Admin",
      hr: "HR Manager",
      operations: "Operations",
      employee: "Employee",
    };
    const roleName = roleLabels[options.role] || options.role;

    const msg = {
      to: options.to,
      from: { email: fromEmail, name: "Hire'in Solutions" },
      subject: "You're Invited to Hire'in Solutions Employee Portal",
      html: `
        <div style="font-family: 'Segoe UI', Arial, sans-serif; max-width: 600px; margin: 0 auto; background: #ffffff;">
          <div style="background: linear-gradient(135deg, #1e40af 0%, #3b82f6 100%); padding: 32px; text-align: center;">
            <h1 style="color: #ffffff; margin: 0; font-size: 24px; font-weight: 700;">Hire'in Solutions</h1>
            <p style="color: #dbeafe; margin: 8px 0 0; font-size: 14px;">AI-Powered Recruitment Platform</p>
          </div>
          <div style="padding: 32px;">
            <h2 style="color: #1e293b; margin: 0 0 16px; font-size: 20px;">Welcome, ${options.firstName}!</h2>
            <p style="color: #475569; line-height: 1.6; margin: 0 0 16px;">
              You've been invited to join the Hire'in Solutions employee portal as <strong>${roleName}</strong>.
            </p>
            <div style="background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 20px; margin: 24px 0;">
              <p style="color: #1e293b; font-weight: 600; margin: 0 0 12px;">Your Login Credentials</p>
              <table style="width: 100%; border-collapse: collapse;">
                <tr>
                  <td style="color: #64748b; padding: 4px 0; width: 120px;">Email:</td>
                  <td style="color: #1e293b; font-weight: 500; padding: 4px 0;">${options.to}</td>
                </tr>
                <tr>
                  <td style="color: #64748b; padding: 4px 0;">Password:</td>
                  <td style="color: #1e293b; font-weight: 500; padding: 4px 0; font-family: monospace;">${options.temporaryPassword}</td>
                </tr>
              </table>
            </div>
            <p style="color: #dc2626; font-size: 13px; margin: 0 0 24px;">
              Please change your password after your first login for security.
            </p>
            <div style="text-align: center; margin: 24px 0;">
              <a href="${options.loginUrl}" style="display: inline-block; background: #1e40af; color: #ffffff; text-decoration: none; padding: 12px 32px; border-radius: 6px; font-weight: 600; font-size: 15px;">
                Login to Portal
              </a>
            </div>
          </div>
          <div style="background: #f8fafc; padding: 20px 32px; text-align: center; border-top: 1px solid #e2e8f0;">
            <p style="color: #94a3b8; font-size: 12px; margin: 0;">
              &copy; ${new Date().getFullYear()} Hire'in Solutions. All rights reserved.
            </p>
          </div>
        </div>
      `,
      text: `Welcome to Hire'in Solutions, ${options.firstName}!\n\nYou've been invited as ${roleName}.\n\nYour login credentials:\nEmail: ${options.to}\nPassword: ${options.temporaryPassword}\n\nLogin at: ${options.loginUrl}\n\nPlease change your password after your first login.`,
    };

    await client.send(msg);
    console.log(`Invitation email sent to ${options.to}`);
    return { success: true };
  } catch (error: any) {
    console.error("Failed to send invitation email:", error?.response?.body || error.message);
    return { success: false, error: error.message };
  }
}

export async function sendPasswordResetEmail(options: {
  to: string;
  firstName: string;
  resetUrl: string;
}) {
  try {
    const { client, fromEmail } = await getUncachableSendGridClient();

    const msg = {
      to: options.to,
      from: { email: fromEmail, name: "Hire'in Solutions" },
      subject: "Password Reset - Hire'in Solutions",
      html: `
        <div style="font-family: 'Segoe UI', Arial, sans-serif; max-width: 600px; margin: 0 auto; background: #ffffff;">
          <div style="background: linear-gradient(135deg, #1e40af 0%, #3b82f6 100%); padding: 32px; text-align: center;">
            <h1 style="color: #ffffff; margin: 0; font-size: 24px; font-weight: 700;">Hire'in Solutions</h1>
            <p style="color: #dbeafe; margin: 8px 0 0; font-size: 14px;">Password Reset Request</p>
          </div>
          <div style="padding: 32px;">
            <h2 style="color: #1e293b; margin: 0 0 16px; font-size: 20px;">Hi ${options.firstName},</h2>
            <p style="color: #475569; line-height: 1.6; margin: 0 0 16px;">
              We received a request to reset your password. Click the button below to set a new password. This link will expire in 1 hour.
            </p>
            <div style="text-align: center; margin: 24px 0;">
              <a href="${options.resetUrl}" style="display: inline-block; background: #1e40af; color: #ffffff; text-decoration: none; padding: 12px 32px; border-radius: 6px; font-weight: 600; font-size: 15px;">
                Reset Password
              </a>
            </div>
            <p style="color: #94a3b8; font-size: 13px; margin: 24px 0 0;">
              If you didn't request this, you can safely ignore this email. Your password will remain unchanged.
            </p>
          </div>
          <div style="background: #f8fafc; padding: 20px 32px; text-align: center; border-top: 1px solid #e2e8f0;">
            <p style="color: #94a3b8; font-size: 12px; margin: 0;">
              &copy; ${new Date().getFullYear()} Hire'in Solutions. All rights reserved.
            </p>
          </div>
        </div>
      `,
      text: `Hi ${options.firstName},\n\nWe received a request to reset your password. Visit the link below to set a new password (expires in 1 hour):\n\n${options.resetUrl}\n\nIf you didn't request this, you can safely ignore this email.`,
    };

    await client.send(msg);
    console.log(`Password reset email sent to ${options.to}`);
    return { success: true };
  } catch (error: any) {
    console.error("Failed to send password reset email:", error?.response?.body || error.message);
    return { success: false, error: error.message };
  }
}

export async function sendWelcomeEmail(options: {
  to: string;
  firstName: string;
  lastName: string;
}) {
  try {
    const { client, fromEmail } = await getUncachableSendGridClient();

    const msg = {
      to: options.to,
      from: { email: fromEmail, name: "Hire'in Solutions" },
      subject: "Welcome to Hire'in Solutions!",
      html: `
        <div style="font-family: 'Segoe UI', Arial, sans-serif; max-width: 600px; margin: 0 auto; background: #ffffff;">
          <div style="background: linear-gradient(135deg, #1e40af 0%, #3b82f6 100%); padding: 32px; text-align: center;">
            <h1 style="color: #ffffff; margin: 0; font-size: 24px; font-weight: 700;">Hire'in Solutions</h1>
            <p style="color: #dbeafe; margin: 8px 0 0; font-size: 14px;">AI-Powered Recruitment Platform</p>
          </div>
          <div style="padding: 32px;">
            <h2 style="color: #1e293b; margin: 0 0 16px; font-size: 20px;">Welcome aboard, ${options.firstName} ${options.lastName}!</h2>
            <p style="color: #475569; line-height: 1.6; margin: 0 0 16px;">
              Your account on the Hire'in Solutions employee portal is now active. Here's what you can do:
            </p>
            <ul style="color: #475569; line-height: 1.8; padding-left: 20px; margin: 0 0 16px;">
              <li>View your dashboard and company updates</li>
              <li>Track your attendance and punch in/out</li>
              <li>Manage leave requests and balances</li>
              <li>View company holidays and org chart</li>
              <li>Set up two-factor authentication for extra security</li>
            </ul>
            <p style="color: #475569; line-height: 1.6; margin: 0 0 24px;">
              We recommend setting up two-factor authentication (2FA) from your profile page for added security.
            </p>
          </div>
          <div style="background: #f8fafc; padding: 20px 32px; text-align: center; border-top: 1px solid #e2e8f0;">
            <p style="color: #94a3b8; font-size: 12px; margin: 0;">
              &copy; ${new Date().getFullYear()} Hire'in Solutions. All rights reserved.
            </p>
          </div>
        </div>
      `,
      text: `Welcome aboard, ${options.firstName} ${options.lastName}!\n\nYour Hire'in Solutions employee portal account is now active.\n\nYou can:\n- View your dashboard\n- Track attendance\n- Manage leave requests\n- View holidays and org chart\n- Set up 2FA for security\n\nWe recommend enabling two-factor authentication from your profile.`,
    };

    await client.send(msg);
    console.log(`Welcome email sent to ${options.to}`);
    return { success: true };
  } catch (error: any) {
    console.error("Failed to send welcome email:", error?.response?.body || error.message);
    return { success: false, error: error.message };
  }
}
