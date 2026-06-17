// SendGrid email service
import sgMail from '@sendgrid/mail';

const FROM_EMAIL = 'alina.carter@hire-in.com'; // NOTE: alina.carter@hire-in.com must be a verified sender in SendGrid (domain or single-sender verification) for emails to deliver successfully.

const SIGNOFF_HTML = `
            <div style="margin: 32px 0 0; padding-top: 20px; border-top: 1px solid #e2e8f0;">
              <p style="color: #475569; margin: 0 0 4px; font-size: 14px;">Best regards,</p>
              <p style="color: #1e293b; font-weight: 600; margin: 0 0 2px; font-size: 14px;">Alina Carter</p>
              <p style="color: #64748b; margin: 0 0 2px; font-size: 13px;">HR Manager &middot; Hire&rsquo;in Solutions</p>
              <p style="color: #64748b; margin: 0; font-size: 13px;"><a href="mailto:alina.carter@hire-in.com" style="color: #3b82f6; text-decoration: none;">alina.carter@hire-in.com</a></p>
            </div>`;

const SIGNOFF_TEXT = `\n\nBest regards,\nAlina Carter\nHR Manager · Hire'in Solutions\nalina.carter@hire-in.com`;

async function getUncachableSendGridClient() {
  const apiKey = process.env.SENDGRID_API_KEY_NEW;
  if (!apiKey) throw new Error('SENDGRID_API_KEY_NEW is not set');
  sgMail.setApiKey(apiKey);
  return {
    client: sgMail,
    fromEmail: FROM_EMAIL
  };
}

export async function sendInvitationEmail(options: {
  to: string;
  firstName: string;
  lastName: string;
  role: string;
  temporaryPassword: string;
  loginUrl: string;
  employeeId?: string;
}) {
  try {
    const { client, fromEmail } = await getUncachableSendGridClient();
    const roleLabels: Record<string, string> = {
      super_admin: "Super Admin",
      admin: "Admin",
      hr: "HR Manager",
      operations: "Operations",
      manager: "Manager",
      employee: "Employee",
    };
    const roleName = roleLabels[options.role] || options.role;
    const employeeIdRow = options.employeeId ? `
                <tr>
                  <td style="color: #64748b; padding: 4px 0;">Employee ID:</td>
                  <td style="color: #1e293b; font-weight: 500; padding: 4px 0; font-family: monospace;">${options.employeeId}</td>
                </tr>` : "";

    const msg = {
      to: options.to,
      from: { email: fromEmail, name: "Alina Carter" },
      subject: "You're Invited to Rayomind Solutions LLP Employee Portal",
      html: `
        <div style="font-family: 'Segoe UI', Arial, sans-serif; max-width: 600px; margin: 0 auto; background: #ffffff;">
          <div style="background: linear-gradient(135deg, #1e40af 0%, #3b82f6 100%); padding: 32px; text-align: center;">
            <h1 style="color: #ffffff; margin: 0; font-size: 24px; font-weight: 700;">Rayomind Solutions LLP</h1>
            <p style="color: #dbeafe; margin: 8px 0 0; font-size: 14px;">AI-Powered Recruitment Platform</p>
          </div>
          <div style="padding: 32px;">
            <h2 style="color: #1e293b; margin: 0 0 16px; font-size: 20px;">Welcome, ${options.firstName}!</h2>
            <p style="color: #475569; line-height: 1.6; margin: 0 0 16px;">
              You've been invited to join the Rayomind Solutions LLP employee portal as <strong>${roleName}</strong>.
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
                </tr>${employeeIdRow}
              </table>
            </div>
            <p style="color: #dc2626; font-size: 13px; margin: 0 0 24px;">
              Please change your password after your first login for security.
            </p>

            <div style="background: #eff6ff; border: 1px solid #bfdbfe; border-radius: 8px; padding: 20px; margin: 24px 0;">
              <p style="color: #1e40af; font-weight: 600; margin: 0 0 12px; font-size: 15px;">Post-Onboarding Checklist</p>
              <p style="color: #475569; font-size: 13px; margin: 0 0 12px;">Please complete the following at your earliest convenience:</p>
              <table style="width: 100%; border-collapse: collapse;">
                <tr><td style="color: #475569; padding: 6px 0; font-size: 13px;">&#9744; Upload KYC documents (Aadhaar Card, PAN Card)</td></tr>
                <tr><td style="color: #475569; padding: 6px 0; font-size: 13px;">&#9744; Upload educational certificates (10th, 12th, Graduation)</td></tr>
                <tr><td style="color: #475569; padding: 6px 0; font-size: 13px;">&#9744; Upload previous employment documents (Relieving Letter, Last 3 months' Salary Slips)</td></tr>
                <tr><td style="color: #475569; padding: 6px 0; font-size: 13px;">&#9744; Complete bank account details (Cancelled Cheque, Account Number, IFSC)</td></tr>
                <tr><td style="color: #475569; padding: 6px 0; font-size: 13px;">&#9744; Add emergency contact information</td></tr>
                <tr><td style="color: #475569; padding: 6px 0; font-size: 13px;">&#9744; Set up Two-Factor Authentication for account security</td></tr>
              </table>
              <p style="color: #1e40af; font-size: 12px; margin: 12px 0 0; font-weight: 500;">
                You can complete these from the "My Documents" section in the employee portal.
              </p>
            </div>

            <div style="text-align: center; margin: 24px 0;">
              <a href="${options.loginUrl}" style="display: inline-block; background: #1e40af; color: #ffffff; text-decoration: none; padding: 12px 32px; border-radius: 6px; font-weight: 600; font-size: 15px;">
                Login to Portal
              </a>
            </div>
            ${SIGNOFF_HTML}
          </div>
          <div style="background: #f8fafc; padding: 20px 32px; text-align: center; border-top: 1px solid #e2e8f0;">
            <p style="color: #94a3b8; font-size: 12px; margin: 0;">
              &copy; ${new Date().getFullYear()} Hire'in Solutions (Rayomind Solutions LLP). All rights reserved.
            </p>
          </div>
        </div>
      `,
      text: `Welcome to Hire'in Solutions, ${options.firstName}!\n\nYou've been invited as ${roleName}.${options.employeeId ? `\nEmployee ID: ${options.employeeId}` : ""}\n\nYour login credentials:\nEmail: ${options.to}\nPassword: ${options.temporaryPassword}\n\nLogin at: ${options.loginUrl}\n\nPlease change your password after your first login.\n\nPost-Onboarding Checklist:\n- Upload KYC documents (Aadhaar Card, PAN Card)\n- Upload educational certificates (10th, 12th, Graduation)\n- Upload previous employment documents (Relieving Letter, Last 3 months' Salary Slips)\n- Complete bank account details (Cancelled Cheque, Account Number, IFSC)\n- Add emergency contact information\n- Set up Two-Factor Authentication${SIGNOFF_TEXT}`,
    };

    await client.send(msg);
    console.log(`Invitation email sent to ${options.to}`);
    return { success: true };
  } catch (error: any) {
    console.error("Failed to send invitation email:", error?.response?.body || error.message);
    return { success: false, error: error.message };
  }
}

export async function sendRayoAcademyCredentialsEmail(options: {
  to: string;
  firstName: string;
  tempPassword: string;
}) {
  try {
    const { client, fromEmail } = await getUncachableSendGridClient();
    const msg = {
      to: options.to,
      from: { email: fromEmail, name: "Alina Carter" },
      subject: "Your Rayo Academy Training Account",
      html: `
        <div style="font-family: 'Segoe UI', Arial, sans-serif; max-width: 600px; margin: 0 auto; background: #ffffff;">
          <div style="background: linear-gradient(135deg, #7c3aed 0%, #a78bfa 100%); padding: 32px; text-align: center;">
            <h1 style="color: #ffffff; margin: 0; font-size: 24px; font-weight: 700;">Rayo Academy</h1>
            <p style="color: #ede9fe; margin: 8px 0 0; font-size: 14px;">Professional Development Platform</p>
          </div>
          <div style="padding: 32px;">
            <h2 style="color: #1e293b; margin: 0 0 16px; font-size: 20px;">Hi ${options.firstName},</h2>
            <p style="color: #475569; line-height: 1.6; margin: 0 0 16px;">
              A Rayo Academy training account has been created for you. Use the credentials below to access your training courses.
            </p>
            <div style="background: #f5f3ff; border: 1px solid #ddd6fe; border-radius: 8px; padding: 20px; margin: 24px 0;">
              <p style="color: #1e293b; font-weight: 600; margin: 0 0 12px;">Your Rayo Academy Credentials</p>
              <table style="width: 100%; border-collapse: collapse;">
                <tr>
                  <td style="color: #64748b; padding: 4px 0; width: 140px;">Email:</td>
                  <td style="color: #1e293b; font-weight: 500; padding: 4px 0;">${options.to}</td>
                </tr>
                <tr>
                  <td style="color: #64748b; padding: 4px 0;">Temporary Password:</td>
                  <td style="color: #1e293b; font-weight: 500; padding: 4px 0; font-family: monospace;">${options.tempPassword}</td>
                </tr>
              </table>
            </div>
            <p style="color: #dc2626; font-size: 13px; margin: 0 0 24px;">
              Please change your password after your first login to Rayo Academy.
            </p>
            <div style="text-align: center; margin: 24px 0;">
              <a href="https://rayo.academy" style="display: inline-block; background: #7c3aed; color: #ffffff; text-decoration: none; padding: 12px 32px; border-radius: 6px; font-weight: 600; font-size: 15px;">
                Open Rayo Academy
              </a>
            </div>
            ${SIGNOFF_HTML}
          </div>
          <div style="background: #f8fafc; padding: 20px 32px; text-align: center; border-top: 1px solid #e2e8f0;">
            <p style="color: #94a3b8; font-size: 12px; margin: 0;">
              &copy; ${new Date().getFullYear()} Hire'in Solutions (Rayomind Solutions LLP). All rights reserved.
            </p>
          </div>
        </div>
      `,
      text: `Hi ${options.firstName},\n\nA Rayo Academy training account has been created for you.\n\nYour credentials:\nEmail: ${options.to}\nTemporary Password: ${options.tempPassword}\n\nPlease visit https://rayo.academy to log in and change your password.${SIGNOFF_TEXT}`,
    };
    await client.send(msg);
    console.log(`Rayo Academy credentials email sent to ${options.to}`);
    return { success: true };
  } catch (error: any) {
    console.error("Failed to send Rayo Academy credentials email:", error?.response?.body || error.message);
    return { success: false, error: error.message };
  }
}

export async function sendDocumentReminderEmail(options: {
  to: string;
  firstName: string;
  pendingDocuments: string[];
}) {
  try {
    const { client, fromEmail } = await getUncachableSendGridClient();

    const docLabels: Record<string, string> = {
      aadhaar: "Aadhaar Card",
      pan: "PAN Card",
      passport: "Passport",
      voter_id_dl: "Voter ID / Driving License",
      "10th_marksheet": "10th Mark Sheet / Certificate",
      "12th_marksheet": "12th Mark Sheet / Certificate",
      graduation_cert: "Graduation Certificate",
      postgrad_cert: "Post-Graduation Certificate",
      relieving_letter: "Relieving Letter / Experience Letter",
      salary_slips_prev: "Last 3 Months' Salary Slips",
      form16: "Form 16",
      cancelled_cheque: "Cancelled Cheque / Bank Passbook",
    };

    const docListHtml = options.pendingDocuments
      .map(d => `<li style="color: #475569; padding: 4px 0; font-size: 14px;">${docLabels[d] || d}</li>`)
      .join("");

    const msg = {
      to: options.to,
      from: { email: fromEmail, name: "Alina Carter" },
      subject: "Reminder: Pending Onboarding Documents - Rayomind Solutions LLP",
      html: `
        <div style="font-family: 'Segoe UI', Arial, sans-serif; max-width: 600px; margin: 0 auto; background: #ffffff;">
          <div style="background: linear-gradient(135deg, #1e40af 0%, #3b82f6 100%); padding: 32px; text-align: center;">
            <h1 style="color: #ffffff; margin: 0; font-size: 24px; font-weight: 700;">Rayomind Solutions LLP</h1>
            <p style="color: #dbeafe; margin: 8px 0 0; font-size: 14px;">Document Reminder</p>
          </div>
          <div style="padding: 32px;">
            <h2 style="color: #1e293b; margin: 0 0 16px; font-size: 20px;">Hi ${options.firstName},</h2>
            <p style="color: #475569; line-height: 1.6; margin: 0 0 16px;">
              This is a friendly reminder that the following mandatory documents are still pending upload:
            </p>
            <div style="background: #fef2f2; border: 1px solid #fecaca; border-radius: 8px; padding: 20px; margin: 24px 0;">
              <p style="color: #dc2626; font-weight: 600; margin: 0 0 12px;">Pending Documents (${options.pendingDocuments.length})</p>
              <ul style="margin: 0; padding: 0 0 0 20px;">
                ${docListHtml}
              </ul>
            </div>
            <p style="color: #475569; line-height: 1.6; margin: 0 0 16px;">
              Please log in to the employee portal and navigate to <strong>"My Documents"</strong> to upload the required documents.
            </p>
            ${SIGNOFF_HTML}
          </div>
          <div style="background: #f8fafc; padding: 20px 32px; text-align: center; border-top: 1px solid #e2e8f0;">
            <p style="color: #94a3b8; font-size: 12px; margin: 0;">
              &copy; ${new Date().getFullYear()} Hire'in Solutions (Rayomind Solutions LLP). All rights reserved.
            </p>
          </div>
        </div>
      `,
      text: `Hi ${options.firstName},\n\nThis is a reminder that the following documents are still pending:\n${options.pendingDocuments.map(d => `- ${docLabels[d] || d}`).join("\n")}\n\nPlease log in to the employee portal and navigate to "My Documents" to upload them.${SIGNOFF_TEXT}`,
    };

    await client.send(msg);
    console.log(`Document reminder email sent to ${options.to}`);
    return { success: true };
  } catch (error: any) {
    console.error("Failed to send document reminder email:", error?.response?.body || error.message);
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
      from: { email: fromEmail, name: "Alina Carter" },
      subject: "Password Reset - Rayomind Solutions LLP",
      html: `
        <div style="font-family: 'Segoe UI', Arial, sans-serif; max-width: 600px; margin: 0 auto; background: #ffffff;">
          <div style="background: linear-gradient(135deg, #1e40af 0%, #3b82f6 100%); padding: 32px; text-align: center;">
            <h1 style="color: #ffffff; margin: 0; font-size: 24px; font-weight: 700;">Rayomind Solutions LLP</h1>
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
            ${SIGNOFF_HTML}
          </div>
          <div style="background: #f8fafc; padding: 20px 32px; text-align: center; border-top: 1px solid #e2e8f0;">
            <p style="color: #94a3b8; font-size: 12px; margin: 0;">
              &copy; ${new Date().getFullYear()} Hire'in Solutions (Rayomind Solutions LLP). All rights reserved.
            </p>
          </div>
        </div>
      `,
      text: `Hi ${options.firstName},\n\nWe received a request to reset your password. Visit the link below to set a new password (expires in 1 hour):\n\n${options.resetUrl}\n\nIf you didn't request this, you can safely ignore this email.${SIGNOFF_TEXT}`,
    };

    await client.send(msg);
    console.log(`Password reset email sent to ${options.to}`);
    return { success: true };
  } catch (error: any) {
    console.error("Failed to send password reset email:", error?.response?.body || error.message);
    return { success: false, error: error.message };
  }
}

export interface SalaryReportAdjustment {
  employeeName: string;
  email: string;
  comment: string;
  fields: Record<string, { oldValue: number; newValue: number }>;
}

export async function sendSalaryReport(options: {
  csvContent: string;
  summary: { year: number; month: number; monthName: string; totalEmployees: number; totalPayable: number; totalHoursWorked: number; generatedAt: string };
  recipients?: { to: string[]; cc: string[] };
  adjustments?: Record<string, SalaryReportAdjustment>;
  rows?: any[];
}) {
  try {
    const { client, fromEmail } = await getUncachableSendGridClient();

    const adjustments = options.adjustments || {};
    const adjustedCount = Object.keys(adjustments).length;

    const toAddresses = options.recipients?.to?.length ? options.recipients.to : ["accounts@hire-in.com"];
    const ccAddresses = options.recipients?.cc?.length ? options.recipients.cc : ["simranjeet@hire-in.com"];

    const adjustmentNote = adjustedCount > 0
      ? `<div style="background: #fff7ed; border: 1px solid #fed7aa; border-radius: 8px; padding: 12px 16px; margin: 0 0 20px;">
           <p style="color: #c2410c; font-weight: 600; margin: 0 0 4px; font-size: 14px;">⚠ ${adjustedCount} row(s) manually adjusted before approval</p>
           <p style="color: #9a3412; font-size: 13px; margin: 0;">Rows highlighted in orange below were reviewed and adjusted by an admin prior to dispatch. The original calculated values have been overridden.</p>
         </div>`
      : "";

    let rowsHtml = "";
    if (options.rows && options.rows.length > 0) {
      const fmt = (n: number) => new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 }).format(n);
      const headerRow = `<tr style="background:#f1f5f9;">
        <th style="padding:8px 10px;text-align:left;font-size:12px;color:#475569;">Employee</th>
        <th style="padding:8px 10px;text-align:right;font-size:12px;color:#475569;">Present</th>
        <th style="padding:8px 10px;text-align:right;font-size:12px;color:#475569;">LOP</th>
        <th style="padding:8px 10px;text-align:right;font-size:12px;color:#475569;">Deductions</th>
        <th style="padding:8px 10px;text-align:right;font-size:12px;color:#475569;">Net Payable</th>
      </tr>`;
      const dataRows = options.rows.map((r: any) => {
        const isAdj = !!adjustments[r.email];
        const bg = isAdj ? "background:#fff7ed;" : "";
        const commentCell = isAdj
          ? `<tr style="${bg}"><td colspan="5" style="padding:2px 10px 8px;font-size:11px;color:#c2410c;font-style:italic;">Adjusted: ${adjustments[r.email].comment}</td></tr>`
          : "";
        return `<tr style="border-top:1px solid #e2e8f0;${bg}">
          <td style="padding:7px 10px;font-size:13px;">${r.employeeName}${isAdj ? ' <span style="background:#f97316;color:#fff;border-radius:3px;padding:1px 5px;font-size:10px;font-weight:600;">ADJUSTED</span>' : ""}</td>
          <td style="padding:7px 10px;text-align:right;font-size:13px;">${r.presentDays}</td>
          <td style="padding:7px 10px;text-align:right;font-size:13px;color:${r.lopLeaves > 0 ? "#c2410c" : "inherit"};">${r.lopLeaves}</td>
          <td style="padding:7px 10px;text-align:right;font-size:13px;">${fmt(r.deductions)}</td>
          <td style="padding:7px 10px;text-align:right;font-size:13px;font-weight:600;">${fmt(r.netPayable)}</td>
        </tr>${commentCell}`;
      }).join("");
      rowsHtml = `<div style="margin:20px 0;">
        <p style="color:#1e293b;font-weight:600;margin:0 0 8px;font-size:14px;">Employee Breakdown</p>
        <table style="width:100%;border-collapse:collapse;font-family:'Segoe UI',Arial,sans-serif;">
          <thead>${headerRow}</thead>
          <tbody>${dataRows}</tbody>
        </table>
      </div>`;
    }

    const fileName = `Salary_Report_${options.summary.monthName}_${options.summary.year}.csv`;
    const csvBase64 = Buffer.from(options.csvContent).toString("base64");

    const msg: any = {
      to: toAddresses,
      cc: ccAddresses,
      from: { email: fromEmail, name: "Alina Carter" },
      subject: `Monthly Salary Processing Report - ${options.summary.monthName} ${options.summary.year}${adjustedCount > 0 ? ` [${adjustedCount} Adjusted]` : ""}`,
      html: `
        <div style="font-family: 'Segoe UI', Arial, sans-serif; max-width: 680px; margin: 0 auto; background: #ffffff;">
          <div style="background: linear-gradient(135deg, #1e40af 0%, #3b82f6 100%); padding: 32px; text-align: center;">
            <h1 style="color: #ffffff; margin: 0; font-size: 24px; font-weight: 700;">Rayomind Solutions LLP</h1>
            <p style="color: #dbeafe; margin: 8px 0 0; font-size: 14px;">Monthly Salary Processing Report</p>
          </div>
          <div style="padding: 32px;">
            <h2 style="color: #1e293b; margin: 0 0 16px; font-size: 20px;">
              Salary Report: ${options.summary.monthName} ${options.summary.year}
            </h2>
            ${adjustmentNote}
            <div style="background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 20px; margin: 0 0 24px;">
              <table style="width: 100%; border-collapse: collapse;">
                <tr>
                  <td style="color: #64748b; padding: 8px 0;">Total Employees:</td>
                  <td style="color: #1e293b; font-weight: 600; padding: 8px 0; text-align: right;">${options.summary.totalEmployees}</td>
                </tr>
                <tr>
                  <td style="color: #64748b; padding: 8px 0;">Total Hours Worked:</td>
                  <td style="color: #1e293b; font-weight: 600; padding: 8px 0; text-align: right;">${options.summary.totalHoursWorked.toLocaleString()}</td>
                </tr>
                <tr style="border-top: 2px solid #e2e8f0;">
                  <td style="color: #1e40af; padding: 12px 0; font-weight: 600; font-size: 16px;">Total Payable:</td>
                  <td style="color: #1e40af; font-weight: 700; padding: 12px 0; text-align: right; font-size: 16px;">₹${options.summary.totalPayable.toLocaleString()}</td>
                </tr>
              </table>
            </div>
            ${rowsHtml}
            <p style="color: #475569; line-height: 1.6; margin: 0 0 8px;">
              The detailed salary processing report is attached as a CSV file. Please review and process accordingly.
            </p>
            <p style="color: #94a3b8; font-size: 12px; margin: 16px 0 0;">
              Generated on: ${new Date(options.summary.generatedAt).toLocaleString()}
            </p>
            ${SIGNOFF_HTML}
          </div>
          <div style="background: #f8fafc; padding: 20px 32px; text-align: center; border-top: 1px solid #e2e8f0;">
            <p style="color: #94a3b8; font-size: 12px; margin: 0;">
              &copy; ${new Date().getFullYear()} Hire'in Solutions (Rayomind Solutions LLP). All rights reserved.
            </p>
          </div>
        </div>
      `,
      text: `Salary Report: ${options.summary.monthName} ${options.summary.year}\n\nTotal Employees: ${options.summary.totalEmployees}\nTotal Hours Worked: ${options.summary.totalHoursWorked}\nTotal Payable: ₹${options.summary.totalPayable}${adjustedCount > 0 ? `\n\nNote: ${adjustedCount} row(s) were manually adjusted before dispatch.` : ""}\n\nPlease see the attached CSV for details.${SIGNOFF_TEXT}`,
      attachments: [{
        content: csvBase64,
        filename: fileName,
        type: "text/csv",
        disposition: "attachment",
      }],
    };

    await client.send(msg);
    console.log(`Salary report email sent to ${toAddresses.join(", ")}`);
    return { success: true };
  } catch (error: any) {
    console.error("Failed to send salary report email:", error?.response?.body || error.message);
    return { success: false, error: error.message };
  }
}

export async function sendSalaryReportApprovalReminder(options: {
  to: string[];
  year: number;
  month: number;
  monthName: string;
  portalUrl: string;
}) {
  try {
    const { client, fromEmail } = await getUncachableSendGridClient();
    const msg = {
      to: options.to,
      from: { email: fromEmail, name: "Alina Carter" },
      subject: `Action Required: Salary Report Pending Approval — ${options.monthName} ${options.year}`,
      html: `
        <div style="font-family: 'Segoe UI', Arial, sans-serif; max-width: 600px; margin: 0 auto; background: #ffffff;">
          <div style="background: linear-gradient(135deg, #1e40af 0%, #3b82f6 100%); padding: 32px; text-align: center;">
            <h1 style="color: #ffffff; margin: 0; font-size: 24px; font-weight: 700;">Rayomind Solutions LLP</h1>
            <p style="color: #dbeafe; margin: 8px 0 0; font-size: 14px;">Payroll Approval Reminder</p>
          </div>
          <div style="padding: 32px;">
            <h2 style="color: #1e293b; margin: 0 0 16px; font-size: 20px;">Salary Report Awaiting Approval</h2>
            <div style="background: #fff7ed; border: 1px solid #fed7aa; border-radius: 8px; padding: 16px 20px; margin: 0 0 24px;">
              <p style="color: #c2410c; font-weight: 600; margin: 0 0 6px;">⚠ Pending action required</p>
              <p style="color: #9a3412; margin: 0; font-size: 14px;">
                The salary report for <strong>${options.monthName} ${options.year}</strong> is still in <em>pending approval</em> status.
                Please log in to review, adjust if needed, and approve the report so it can be dispatched to accounts.
              </p>
            </div>
            <div style="text-align: center; margin: 24px 0;">
              <a href="${options.portalUrl}/admin/hr/salary-reports" style="display: inline-block; background: #1e40af; color: #ffffff; text-decoration: none; padding: 12px 32px; border-radius: 6px; font-weight: 600; font-size: 15px;">
                Review & Approve Report
              </a>
            </div>
            ${SIGNOFF_HTML}
          </div>
          <div style="background: #f8fafc; padding: 20px 32px; text-align: center; border-top: 1px solid #e2e8f0;">
            <p style="color: #94a3b8; font-size: 12px; margin: 0;">
              &copy; ${new Date().getFullYear()} Hire'in Solutions (Rayomind Solutions LLP). All rights reserved.
            </p>
          </div>
        </div>
      `,
      text: `The salary report for ${options.monthName} ${options.year} is still pending approval. Please log in and approve it at ${options.portalUrl}/admin/hr/salary-reports${SIGNOFF_TEXT}`,
    };
    await client.send(msg);
    console.log(`Salary report approval reminder sent to ${options.to.join(", ")}`);
    return { success: true };
  } catch (error: any) {
    console.error("Failed to send salary report approval reminder:", error?.response?.body || error.message);
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
      from: { email: fromEmail, name: "Alina Carter" },
      subject: "Welcome to Rayomind Solutions LLP!",
      html: `
        <div style="font-family: 'Segoe UI', Arial, sans-serif; max-width: 600px; margin: 0 auto; background: #ffffff;">
          <div style="background: linear-gradient(135deg, #1e40af 0%, #3b82f6 100%); padding: 32px; text-align: center;">
            <h1 style="color: #ffffff; margin: 0; font-size: 24px; font-weight: 700;">Rayomind Solutions LLP</h1>
            <p style="color: #dbeafe; margin: 8px 0 0; font-size: 14px;">AI-Powered Recruitment Platform</p>
          </div>
          <div style="padding: 32px;">
            <h2 style="color: #1e293b; margin: 0 0 16px; font-size: 20px;">Welcome aboard, ${options.firstName} ${options.lastName}!</h2>
            <p style="color: #475569; line-height: 1.6; margin: 0 0 16px;">
              Your account on the Rayomind Solutions LLP employee portal is now active. Here's what you can do:
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
            ${SIGNOFF_HTML}
          </div>
          <div style="background: #f8fafc; padding: 20px 32px; text-align: center; border-top: 1px solid #e2e8f0;">
            <p style="color: #94a3b8; font-size: 12px; margin: 0;">
              &copy; ${new Date().getFullYear()} Hire'in Solutions (Rayomind Solutions LLP). All rights reserved.
            </p>
          </div>
        </div>
      `,
      text: `Welcome aboard, ${options.firstName} ${options.lastName}!\n\nYour Hire'in Solutions employee portal account is now active.\n\nYou can:\n- View your dashboard\n- Track attendance\n- Manage leave requests\n- View holidays and org chart\n- Set up 2FA for security\n\nWe recommend enabling two-factor authentication from your profile.${SIGNOFF_TEXT}`,
    };

    await client.send(msg);
    console.log(`Welcome email sent to ${options.to}`);
    return { success: true };
  } catch (error: any) {
    console.error("Failed to send welcome email:", error?.response?.body || error.message);
    return { success: false, error: error.message };
  }
}

export async function sendOfferLetterEmail(options: {
  to: string;
  candidateName: string;
  designation: string;
  acceptUrl: string;
  expiresAt: Date;
  cc?: string[];
}) {
  try {
    const { client, fromEmail } = await getUncachableSendGridClient();
    const expiryStr = options.expiresAt.toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" });
    const msg = {
      to: options.to,
      cc: options.cc?.length ? options.cc : undefined,
      from: { email: fromEmail, name: "Alina Carter" },
      replyTo: { email: 'alina.carter@hire-in.com', name: 'Alina Carter' },
      subject: `Offer Letter from Rayomind Solutions LLP — ${options.designation}`,
      html: `
        <div style="font-family: 'Segoe UI', Arial, sans-serif; max-width: 600px; margin: 0 auto; background: #ffffff;">
          <div style="background: linear-gradient(135deg, #1e40af 0%, #3b82f6 100%); padding: 32px; text-align: center;">
            <h1 style="color: #ffffff; margin: 0; font-size: 24px; font-weight: 700;">Rayomind Solutions LLP</h1>
            <p style="color: #dbeafe; margin: 8px 0 0; font-size: 14px;">AI-Powered Recruitment Platform</p>
          </div>
          <div style="padding: 32px;">
            <h2 style="color: #1e293b; margin: 0 0 16px; font-size: 20px;">Congratulations, ${options.candidateName}!</h2>
            <p style="color: #475569; line-height: 1.6; margin: 0 0 16px;">
              We are excited to extend an offer to you for the position of <strong>${options.designation}</strong> at Rayomind Solutions LLP.
            </p>
            <p style="color: #475569; line-height: 1.6; margin: 0 0 24px;">
              Please review your offer letter and accept it by clicking the button below. This offer is valid until <strong>${expiryStr}</strong>.
            </p>
            <div style="text-align: center; margin: 24px 0;">
              <a href="${options.acceptUrl}" style="display: inline-block; background-color: #1e40af; color: #ffffff; text-decoration: none; padding: 14px 32px; border-radius: 8px; font-size: 16px; font-weight: 600;">
                View & Accept Your Offer
              </a>
            </div>
            <p style="color: #94a3b8; font-size: 13px; line-height: 1.5; margin: 16px 0 0;">
              If the button doesn't work, copy and paste this link in your browser:<br/>
              <a href="${options.acceptUrl}" style="color: #3b82f6; word-break: break-all;">${options.acceptUrl}</a>
            </p>
            ${SIGNOFF_HTML}
          </div>
          <div style="background: #f8fafc; padding: 20px 32px; text-align: center; border-top: 1px solid #e2e8f0;">
            <p style="color: #94a3b8; font-size: 12px; margin: 0;">
              &copy; ${new Date().getFullYear()} Hire'in Solutions (Rayomind Solutions LLP). All rights reserved.
            </p>
          </div>
        </div>
      `,
      text: `Congratulations, ${options.candidateName}!\n\nWe are excited to extend an offer for the position of ${options.designation} at Rayomind Solutions LLP.\n\nPlease review and accept your offer by visiting:\n${options.acceptUrl}\n\nThis offer is valid until ${expiryStr}.${SIGNOFF_TEXT}`,
    };
    await client.send(msg);
    console.log(`Offer letter email sent to ${options.to}`);
    return { success: true };
  } catch (error: any) {
    console.error("Failed to send offer letter email:", error?.response?.body || error.message);
    return { success: false, error: error.message };
  }
}

export async function sendOfferLetterPendingApprovalEmail(options: {
  to: string | string[];
  managerName: string;
  candidateName: string;
  designation: string;
  salary?: string | null;
  reviewUrl: string;
}) {
  try {
    const { client, fromEmail } = await getUncachableSendGridClient();
    const msg = {
      to: options.to,
      from: { email: fromEmail, name: "Alina Carter" },
      subject: `Offer Letter Pending Approval — ${options.candidateName} (${options.designation})`,
      html: `
        <div style="font-family: 'Segoe UI', Arial, sans-serif; max-width: 600px; margin: 0 auto; background: #ffffff;">
          <div style="background: linear-gradient(135deg, #1e40af 0%, #3b82f6 100%); padding: 32px; text-align: center;">
            <h1 style="color: #ffffff; margin: 0; font-size: 24px; font-weight: 700;">Rayomind Solutions LLP</h1>
            <p style="color: #dbeafe; margin: 8px 0 0; font-size: 14px;">Offer Letter Approval Required</p>
          </div>
          <div style="padding: 32px;">
            <h2 style="color: #1e293b; margin: 0 0 16px; font-size: 20px;">New Offer Letter Awaiting Your Review</h2>
            <p style="color: #475569; line-height: 1.6; margin: 0 0 16px;">
              <strong>${options.managerName}</strong> has submitted an offer letter that requires your approval before it is sent to the candidate.
            </p>
            <div style="background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 20px; margin: 24px 0;">
              <p style="color: #1e293b; font-weight: 600; margin: 0 0 12px;">Offer Details</p>
              <table style="width: 100%; border-collapse: collapse;">
                <tr>
                  <td style="color: #64748b; padding: 4px 0; width: 140px;">Candidate:</td>
                  <td style="color: #1e293b; font-weight: 500; padding: 4px 0;">${options.candidateName}</td>
                </tr>
                <tr>
                  <td style="color: #64748b; padding: 4px 0;">Designation:</td>
                  <td style="color: #1e293b; font-weight: 500; padding: 4px 0;">${options.designation}</td>
                </tr>
                ${options.salary ? `<tr>
                  <td style="color: #64748b; padding: 4px 0;">Salary:</td>
                  <td style="color: #1e293b; font-weight: 500; padding: 4px 0;">${options.salary}</td>
                </tr>` : ""}
                <tr>
                  <td style="color: #64748b; padding: 4px 0;">Submitted By:</td>
                  <td style="color: #1e293b; font-weight: 500; padding: 4px 0;">${options.managerName}</td>
                </tr>
              </table>
            </div>
            <div style="text-align: center; margin: 24px 0;">
              <a href="${options.reviewUrl}" style="display: inline-block; background: #1e40af; color: #ffffff; text-decoration: none; padding: 12px 32px; border-radius: 6px; font-weight: 600; font-size: 15px;">
                Review &amp; Approve
              </a>
            </div>
            <p style="color: #94a3b8; font-size: 13px; margin: 16px 0 0;">
              Please log in to the HR portal, go to Offer Letters, and switch to the "Pending Approval" tab to review this offer.
            </p>
            ${SIGNOFF_HTML}
          </div>
          <div style="background: #f8fafc; padding: 20px 32px; text-align: center; border-top: 1px solid #e2e8f0;">
            <p style="color: #94a3b8; font-size: 12px; margin: 0;">
              &copy; ${new Date().getFullYear()} Hire'in Solutions (Rayomind Solutions LLP). All rights reserved.
            </p>
          </div>
        </div>
      `,
      text: `New Offer Letter Awaiting Approval\n\n${options.managerName} has submitted an offer letter for ${options.candidateName} (${options.designation})${options.salary ? ` at ${options.salary}` : ""}.\n\nPlease review and approve at:\n${options.reviewUrl}${SIGNOFF_TEXT}`,
    };
    await client.send(msg);
    console.log(`Offer letter pending approval email sent to HR`);
    return { success: true };
  } catch (error: any) {
    console.error("Failed to send offer letter pending approval email:", error?.response?.body || error.message);
    return { success: false, error: error.message };
  }
}

export async function sendOfferLetterApprovalDecisionEmail(options: {
  to: string;
  managerFirstName: string;
  candidateName: string;
  designation: string;
  approved: boolean;
  rejectionReason?: string;
  reviewUrl: string;
}) {
  try {
    const { client, fromEmail } = await getUncachableSendGridClient();
    const subject = options.approved
      ? `Your Offer Letter for ${options.candidateName} Has Been Approved`
      : `Your Offer Letter for ${options.candidateName} Has Been Rejected`;
    const statusColor = options.approved ? "#16a34a" : "#dc2626";
    const statusLabel = options.approved ? "Approved" : "Rejected";
    const bodyText = options.approved
      ? `Great news — the offer letter you submitted for <strong>${options.candidateName}</strong> (${options.designation}) has been <strong style="color: #16a34a;">approved</strong>. The candidate has been emailed with the offer link.`
      : `The offer letter you submitted for <strong>${options.candidateName}</strong> (${options.designation}) has been <strong style="color: #dc2626;">rejected</strong>.`;
    const msg = {
      to: options.to,
      from: { email: fromEmail, name: "Alina Carter" },
      subject,
      html: `
        <div style="font-family: 'Segoe UI', Arial, sans-serif; max-width: 600px; margin: 0 auto; background: #ffffff;">
          <div style="background: linear-gradient(135deg, #1e40af 0%, #3b82f6 100%); padding: 32px; text-align: center;">
            <h1 style="color: #ffffff; margin: 0; font-size: 24px; font-weight: 700;">Rayomind Solutions LLP</h1>
            <p style="color: #dbeafe; margin: 8px 0 0; font-size: 14px;">Offer Letter Decision</p>
          </div>
          <div style="padding: 32px;">
            <h2 style="color: #1e293b; margin: 0 0 16px; font-size: 20px;">Hi ${options.managerFirstName},</h2>
            <div style="background: ${options.approved ? "#f0fdf4" : "#fef2f2"}; border: 1px solid ${options.approved ? "#bbf7d0" : "#fecaca"}; border-radius: 8px; padding: 16px; margin: 0 0 20px; text-align: center;">
              <span style="color: ${statusColor}; font-size: 18px; font-weight: 700;">${statusLabel}</span>
            </div>
            <p style="color: #475569; line-height: 1.6; margin: 0 0 16px;">
              ${bodyText}
            </p>
            ${!options.approved && options.rejectionReason ? `
            <div style="background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 16px; margin: 16px 0;">
              <p style="color: #1e293b; font-weight: 600; margin: 0 0 8px;">Reason for Rejection:</p>
              <p style="color: #475569; margin: 0; line-height: 1.6;">${options.rejectionReason}</p>
            </div>` : ""}
            <div style="text-align: center; margin: 24px 0;">
              <a href="${options.reviewUrl}" style="display: inline-block; background: #1e40af; color: #ffffff; text-decoration: none; padding: 12px 32px; border-radius: 6px; font-weight: 600; font-size: 15px;">
                View Offer Letters
              </a>
            </div>
            ${SIGNOFF_HTML}
          </div>
          <div style="background: #f8fafc; padding: 20px 32px; text-align: center; border-top: 1px solid #e2e8f0;">
            <p style="color: #94a3b8; font-size: 12px; margin: 0;">
              &copy; ${new Date().getFullYear()} Hire'in Solutions (Rayomind Solutions LLP). All rights reserved.
            </p>
          </div>
        </div>
      `,
      text: `Hi ${options.managerFirstName},\n\nYour offer letter for ${options.candidateName} (${options.designation}) has been ${statusLabel.toLowerCase()}.${!options.approved && options.rejectionReason ? `\n\nReason: ${options.rejectionReason}` : ""}\n\nView details at:\n${options.reviewUrl}${SIGNOFF_TEXT}`,
    };
    await client.send(msg);
    console.log(`Offer letter approval decision email sent to manager`);
    return { success: true };
  } catch (error: any) {
    console.error("Failed to send offer letter approval decision email:", error?.response?.body || error.message);
    return { success: false, error: error.message };
  }
}

export async function sendHrLetterEmail(options: {
  to: string;
  employeeName: string;
  letterType: string;
  referenceNumber: string;
  authCode: string;
  verifyUrl: string;
  pdfBuffer?: Buffer;
  pdfFilename?: string;
  cc?: string[];
}) {
  try {
    const { client, fromEmail } = await getUncachableSendGridClient();
    const letterTypeLabel: Record<string, string> = {
      experience: "Experience Letter",
      internship_completion: "Internship Completion Letter",
      internship_certificate: "Internship Certificate",
      relieving: "Relieving Letter",
      salary_revision: "Salary Revision Letter",
      role_change: "Designation / Promotion Letter",
      combined: "Salary & Designation Amendment",
      device_allocation: "Device Allocation Letter",
    };
    const typeLabel = letterTypeLabel[options.letterType] || "HR Letter";

    const mimeType = options.pdfFilename?.toLowerCase().endsWith(".docx")
      ? "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
      : "application/pdf";

    const attachments = options.pdfBuffer && options.pdfFilename ? [{
      content: options.pdfBuffer.toString("base64"),
      filename: options.pdfFilename,
      type: mimeType,
      disposition: "attachment" as const,
    }] : undefined;

    const msg = {
      to: options.to,
      cc: options.cc?.length ? options.cc : undefined,
      from: { email: fromEmail, name: "Alina Carter" },
      replyTo: { email: 'alina.carter@hire-in.com', name: 'Alina Carter' },
      subject: `Your ${typeLabel} — Rayomind Solutions LLP (Ref: ${options.referenceNumber})`,
      attachments,
      html: `
        <div style="font-family: 'Segoe UI', Arial, sans-serif; max-width: 600px; margin: 0 auto; background: #ffffff;">
          <div style="background: linear-gradient(135deg, #F96D3E 0%, #ff8c5a 100%); padding: 32px; text-align: center;">
            <h1 style="color: #ffffff; margin: 0; font-size: 24px; font-weight: 700;">Rayomind Solutions LLP</h1>
            <p style="color: #fff3e0; margin: 8px 0 0; font-size: 14px;">Official Document</p>
          </div>
          <div style="padding: 32px;">
            <h2 style="color: #1e293b; margin: 0 0 16px; font-size: 20px;">Dear ${options.employeeName},</h2>
            <p style="color: #475569; line-height: 1.6; margin: 0 0 16px;">
              Please find attached your <strong>${typeLabel}</strong> issued by Rayomind Solutions LLP.
            </p>
            <div style="background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 16px; margin: 16px 0;">
              <p style="color: #475569; margin: 0 0 8px; font-size: 14px;"><strong>Reference Number:</strong> ${options.referenceNumber}</p>
              <p style="color: #475569; margin: 0; font-size: 14px;"><strong>Verification Code:</strong> ${options.authCode}</p>
            </div>
            <p style="color: #475569; line-height: 1.6; margin: 0 0 24px;">
              You can verify the authenticity of this document anytime using the reference number and verification code above.
            </p>
            <div style="text-align: center; margin: 24px 0;">
              <a href="${options.verifyUrl}" style="display: inline-block; background-color: #F96D3E; color: #ffffff; text-decoration: none; padding: 14px 32px; border-radius: 8px; font-size: 16px; font-weight: 600;">
                Verify Document
              </a>
            </div>
            ${SIGNOFF_HTML}
          </div>
          <div style="background: #f8fafc; padding: 20px 32px; text-align: center; border-top: 1px solid #e2e8f0;">
            <p style="color: #94a3b8; font-size: 12px; margin: 0;">
              &copy; ${new Date().getFullYear()} Hire'in Solutions (Rayomind Solutions LLP). All rights reserved.
            </p>
          </div>
        </div>
      `,
      text: `Dear ${options.employeeName},\n\nPlease find attached your ${typeLabel} issued by Hire'in Solutions.\n\nReference Number: ${options.referenceNumber}\nVerification Code: ${options.authCode}\n\nVerify at: ${options.verifyUrl}${SIGNOFF_TEXT}`,
    };
    await client.send(msg);
    console.log(`HR letter email sent to ${options.to} (${options.referenceNumber})`);
    return { success: true };
  } catch (error: unknown) {
    const errMsg = error instanceof Error ? error.message : "Unknown error";
    console.error("Failed to send HR letter email:", errMsg);
    return { success: false, error: errMsg };
  }
}

export async function sendOnboardingWelcomeEmail(options: {
  to: string;
  firstName: string;
  lastName: string;
  employeeId: string;
  temporaryPassword: string;
  designation: string;
  loginUrl: string;
}) {
  try {
    const { client, fromEmail } = await getUncachableSendGridClient();
    const msg = {
      to: options.to,
      from: { email: fromEmail, name: "Alina Carter" },
      subject: `Welcome to Rayomind Solutions LLP — Your Onboarding Guide`,
      html: `
        <div style="font-family: 'Segoe UI', Arial, sans-serif; max-width: 700px; margin: 0 auto; background: #ffffff;">
          <div style="background: linear-gradient(135deg, #1e40af 0%, #3b82f6 100%); padding: 32px; text-align: center;">
            <h1 style="color: #ffffff; margin: 0; font-size: 24px; font-weight: 700;">Rayomind Solutions LLP</h1>
            <p style="color: #dbeafe; margin: 8px 0 0; font-size: 14px;">Welcome to the Team!</p>
          </div>
          <div style="padding: 32px;">
            <h2 style="color: #1e293b; margin: 0 0 16px; font-size: 20px;">Welcome aboard, ${options.firstName} ${options.lastName}!</h2>
            <p style="color: #475569; line-height: 1.6; margin: 0 0 20px;">
              Congratulations on joining Rayomind Solutions LLP as <strong>${options.designation}</strong>! Your employee portal account is ready. Here are your login credentials:
            </p>

            <div style="background: #f0f9ff; border: 1px solid #bae6fd; border-radius: 8px; padding: 20px; margin: 0 0 24px;">
              <h3 style="color: #0369a1; margin: 0 0 12px; font-size: 16px;">Your Credentials</h3>
              <table style="width: 100%; border-collapse: collapse;">
                <tr><td style="color: #64748b; padding: 4px 0; width: 140px;">Employee ID:</td><td style="color: #1e293b; font-weight: 600;">${options.employeeId}</td></tr>
                <tr><td style="color: #64748b; padding: 4px 0;">Email:</td><td style="color: #1e293b; font-weight: 600;">${options.to}</td></tr>
                <tr><td style="color: #64748b; padding: 4px 0;">Temporary Password:</td><td style="color: #1e293b; font-weight: 600; font-family: monospace;">${options.temporaryPassword}</td></tr>
              </table>
            </div>

            <h3 style="color: #1e293b; margin: 0 0 12px; font-size: 18px;">📋 Your 10-Step Onboarding Checklist</h3>
            <ol style="color: #475569; line-height: 2; padding-left: 20px; margin: 0 0 24px;">
              <li><strong>Log In & Change Password</strong> — Visit <a href="${options.loginUrl}" style="color: #3b82f6;">${options.loginUrl}</a> and change your temporary password immediately</li>
              <li><strong>Set Up Two-Factor Authentication (2FA)</strong> — Go to Profile → Security and enable TOTP 2FA (required for all employees)</li>
              <li><strong>Upload KYC Documents</strong> — Upload your government-issued ID (Aadhaar/PAN/Passport) under Documents → KYC</li>
              <li><strong>Upload Education Certificates</strong> — Add your highest qualification certificates under Documents → Education</li>
              <li><strong>Upload Employment Documents</strong> — Previous experience letters, relieving letters under Documents → Employment</li>
              <li><strong>Upload Cancelled Cheque / Voided Check</strong> — Required for payroll setup under Documents → Bank</li>
              <li><strong>Enter Bank Account Details</strong> — Go to Profile → Bank Details and enter your bank account information for salary processing</li>
              <li><strong>Add Emergency Contacts</strong> — Go to Profile → Emergency Contacts and add at least one emergency contact</li>
              <li><strong>Select Your 2 Floating Holidays</strong> — Go to Holidays → Regional and choose 2 optional holidays for the year</li>
              <li><strong>Start Punching Attendance</strong> — Use the Attendance page to punch in/out daily (8-hour threshold, 7 PM - 4 AM IST shift)</li>
            </ol>

            <h3 style="color: #1e293b; margin: 0 0 12px; font-size: 18px;">🗺 Portal Navigation</h3>
            <div style="background: #f8fafc; border-radius: 8px; padding: 16px; margin: 0 0 24px;">
              <table style="width: 100%; border-collapse: collapse; font-size: 14px;">
                <tr><td style="color: #64748b; padding: 6px 0; width: 160px;">Dashboard</td><td style="color: #1e293b;">Overview of your activity & announcements</td></tr>
                <tr><td style="color: #64748b; padding: 6px 0;">Attendance</td><td style="color: #1e293b;">Punch in/out, view history & monthly summary</td></tr>
                <tr><td style="color: #64748b; padding: 6px 0;">Leave Management</td><td style="color: #1e293b;">Apply for leave, view balances & accruals</td></tr>
                <tr><td style="color: #64748b; padding: 6px 0;">Holidays</td><td style="color: #1e293b;">Company holidays & optional regional selections</td></tr>
                <tr><td style="color: #64748b; padding: 6px 0;">Documents</td><td style="color: #1e293b;">Upload & manage KYC, education, employment docs</td></tr>
                <tr><td style="color: #64748b; padding: 6px 0;">Profile</td><td style="color: #1e293b;">Personal info, bank details, emergency contacts, 2FA</td></tr>
                <tr><td style="color: #64748b; padding: 6px 0;">Tickets</td><td style="color: #1e293b;">Raise IT/HR support tickets</td></tr>
                <tr><td style="color: #64748b; padding: 6px 0;">Org Chart</td><td style="color: #1e293b;">View company hierarchy & team structure</td></tr>
              </table>
            </div>

            <div style="text-align: center; margin: 24px 0;">
              <a href="${options.loginUrl}" style="display: inline-block; background: linear-gradient(135deg, #1e40af 0%, #3b82f6 100%); color: #ffffff; text-decoration: none; padding: 14px 32px; border-radius: 8px; font-size: 16px; font-weight: 600;">
                Log In to Your Portal
              </a>
            </div>

            <p style="color: #475569; line-height: 1.6; margin: 16px 0 0;">
              If you have any questions, reach out to HR via the Tickets section or email your manager directly.
            </p>
            ${SIGNOFF_HTML}
          </div>
          <div style="background: #f8fafc; padding: 20px 32px; text-align: center; border-top: 1px solid #e2e8f0;">
            <p style="color: #94a3b8; font-size: 12px; margin: 0;">
              &copy; ${new Date().getFullYear()} Hire'in Solutions (Rayomind Solutions LLP). All rights reserved.
            </p>
          </div>
        </div>
      `,
      text: `Welcome aboard, ${options.firstName} ${options.lastName}!\n\nYour Hire'in Solutions employee portal account is ready.\n\nCredentials:\n- Employee ID: ${options.employeeId}\n- Email: ${options.to}\n- Temporary Password: ${options.temporaryPassword}\n\n10-Step Onboarding Checklist:\n1. Log in and change your password at ${options.loginUrl}\n2. Set up 2FA (required)\n3. Upload KYC documents\n4. Upload education certificates\n5. Upload employment documents\n6. Upload cancelled cheque/voided check\n7. Enter bank account details\n8. Add emergency contacts\n9. Select 2 floating holidays\n10. Start punching attendance daily\n\nQuestions? Raise a ticket in the portal or contact HR.${SIGNOFF_TEXT}`,
    };
    await client.send(msg);
    console.log(`Onboarding welcome email sent to ${options.to}`);
    return { success: true };
  } catch (error: any) {
    console.error("Failed to send onboarding email:", error?.response?.body || error.message);
    return { success: false, error: error.message };
  }
}

export async function sendReviewCycleOpenedEmail(options: {
  to: string;
  firstName: string;
  cycleName: string;
  endDate: string;
}) {
  try {
    const { client, fromEmail } = await getUncachableSendGridClient();
    const msg = {
      to: options.to,
      from: { email: fromEmail, name: "Alina Carter" },
      subject: `Performance Review Cycle Opened: ${options.cycleName}`,
      html: `
        <div style="font-family: 'Segoe UI', Arial, sans-serif; max-width: 600px; margin: 0 auto; background: #ffffff;">
          <div style="background: linear-gradient(135deg, #1e40af 0%, #3b82f6 100%); padding: 32px; text-align: center;">
            <h1 style="color: #ffffff; margin: 0; font-size: 24px; font-weight: 700;">Rayomind Solutions LLP</h1>
            <p style="color: #dbeafe; margin: 8px 0 0; font-size: 14px;">Performance Review</p>
          </div>
          <div style="padding: 32px;">
            <h2 style="color: #1e293b; margin: 0 0 16px; font-size: 20px;">Hi ${options.firstName},</h2>
            <p style="color: #475569; line-height: 1.6; margin: 0 0 16px;">
              A new performance review cycle <strong>"${options.cycleName}"</strong> has been opened.
            </p>
            <p style="color: #475569; line-height: 1.6; margin: 0 0 16px;">
              Please submit your self-review before <strong>${options.endDate}</strong>.
            </p>
            ${SIGNOFF_HTML}
          </div>
          <div style="background: #f8fafc; padding: 20px 32px; text-align: center; border-top: 1px solid #e2e8f0;">
            <p style="color: #94a3b8; font-size: 12px; margin: 0;">&copy; ${new Date().getFullYear()} Hire'in Solutions (Rayomind Solutions LLP). All rights reserved.</p>
          </div>
        </div>
      `,
      text: `Hi ${options.firstName},\n\nA new performance review cycle "${options.cycleName}" has been opened. Please submit your self-review before ${options.endDate}.${SIGNOFF_TEXT}`,
    };
    await client.send(msg);
    console.log(`Review cycle opened email sent to ${options.to}`);
    return { success: true };
  } catch (error: any) {
    console.error("Failed to send review cycle email:", error?.response?.body || error.message);
    return { success: false, error: error.message };
  }
}

export async function sendSelfReviewDueReminderEmail(options: {
  to: string;
  firstName: string;
  cycleName: string;
  dueDate: string;
}) {
  try {
    const { client, fromEmail } = await getUncachableSendGridClient();
    const msg = {
      to: options.to,
      from: { email: fromEmail, name: "Alina Carter" },
      subject: `Reminder: Self-Review Due — ${options.cycleName}`,
      html: `
        <div style="font-family: 'Segoe UI', Arial, sans-serif; max-width: 600px; margin: 0 auto; background: #ffffff;">
          <div style="background: linear-gradient(135deg, #1e40af 0%, #3b82f6 100%); padding: 32px; text-align: center;">
            <h1 style="color: #ffffff; margin: 0; font-size: 24px; font-weight: 700;">Rayomind Solutions LLP</h1>
            <p style="color: #dbeafe; margin: 8px 0 0; font-size: 14px;">Self-Review Reminder</p>
          </div>
          <div style="padding: 32px;">
            <h2 style="color: #1e293b; margin: 0 0 16px; font-size: 20px;">Hi ${options.firstName},</h2>
            <p style="color: #475569; line-height: 1.6; margin: 0 0 16px;">
              Your self-review for <strong>"${options.cycleName}"</strong> is due by <strong>${options.dueDate}</strong>.
            </p>
            <p style="color: #475569; line-height: 1.6; margin: 0 0 16px;">
              Please log in to the portal and complete your review.
            </p>
            ${SIGNOFF_HTML}
          </div>
          <div style="background: #f8fafc; padding: 20px 32px; text-align: center; border-top: 1px solid #e2e8f0;">
            <p style="color: #94a3b8; font-size: 12px; margin: 0;">&copy; ${new Date().getFullYear()} Hire'in Solutions (Rayomind Solutions LLP). All rights reserved.</p>
          </div>
        </div>
      `,
      text: `Hi ${options.firstName},\n\nYour self-review for "${options.cycleName}" is due by ${options.dueDate}. Please log in to the portal and complete it.${SIGNOFF_TEXT}`,
    };
    await client.send(msg);
    console.log(`Self-review reminder sent to ${options.to}`);
    return { success: true };
  } catch (error: any) {
    console.error("Failed to send self-review reminder:", error?.response?.body || error.message);
    return { success: false, error: error.message };
  }
}

export async function sendAddendumEmail(options: {
  to: string;
  candidateName: string;
  addendumType: string;
  acceptUrl: string;
  cc?: string[];
}) {
  try {
    const { client, fromEmail } = await getUncachableSendGridClient();
    const typeLabels: Record<string, string> = {
      salary_revision: "Salary Revision",
      role_change: "Role / Title Change",
      probation_extension: "Probation Extension",
      combined: "Combined Role & Salary Change",
      custom: "Custom Amendment",
    };
    const typeLabel = typeLabels[options.addendumType] || "Amendment";

    const msg = {
      to: options.to,
      cc: options.cc?.length ? options.cc : undefined,
      from: { email: fromEmail, name: "Alina Carter" },
      replyTo: { email: 'alina.carter@hire-in.com', name: 'Alina Carter' },
      subject: `Amendment to Your Offer — ${typeLabel}`,
      html: `
        <div style="font-family: 'Segoe UI', Arial, sans-serif; max-width: 600px; margin: 0 auto; background: #ffffff;">
          <div style="background: linear-gradient(135deg, #1e40af 0%, #3b82f6 100%); padding: 32px; text-align: center;">
            <h1 style="color: #ffffff; margin: 0; font-size: 24px; font-weight: 700;">Rayomind Solutions LLP</h1>
            <p style="color: #dbeafe; margin: 8px 0 0; font-size: 14px;">Offer Letter Amendment</p>
          </div>
          <div style="padding: 32px;">
            <h2 style="color: #1e293b; margin: 0 0 16px; font-size: 20px;">Dear ${options.candidateName},</h2>
            <p style="color: #475569; line-height: 1.6; margin: 0 0 16px;">
              An amendment (<strong>${typeLabel}</strong>) to your offer letter has been issued by Rayomind Solutions LLP.
            </p>
            <p style="color: #475569; line-height: 1.6; margin: 0 0 24px;">
              Please review the updated terms and provide your digital signature by clicking the button below.
            </p>
            <div style="text-align: center; margin: 24px 0;">
              <a href="${options.acceptUrl}" style="display: inline-block; background-color: #1e40af; color: #ffffff; text-decoration: none; padding: 14px 32px; border-radius: 8px; font-size: 16px; font-weight: 600;">
                Review & Sign Addendum
              </a>
            </div>
            <p style="color: #94a3b8; font-size: 13px; margin: 16px 0 0;">
              If the button doesn't work, copy and paste this link in your browser:<br/>
              <a href="${options.acceptUrl}" style="color: #3b82f6; word-break: break-all;">${options.acceptUrl}</a>
            </p>
            ${SIGNOFF_HTML}
          </div>
          <div style="background: #f8fafc; padding: 20px 32px; text-align: center; border-top: 1px solid #e2e8f0;">
            <p style="color: #94a3b8; font-size: 12px; margin: 0;">
              &copy; ${new Date().getFullYear()} Hire'in Solutions (Rayomind Solutions LLP). All rights reserved.
            </p>
          </div>
        </div>
      `,
      text: `Dear ${options.candidateName},\n\nAn amendment (${typeLabel}) to your offer letter has been issued.\n\nPlease review and sign at:\n${options.acceptUrl}${SIGNOFF_TEXT}`,
    };
    await client.send(msg);
    console.log(`Addendum email sent to ${options.to}`);
    return { success: true };
  } catch (error: any) {
    console.error("Failed to send addendum email:", error?.response?.body || error.message);
    return { success: false, error: error.message };
  }
}

export async function sendAddendumAcceptedEmail(options: {
  to: string;
  candidateName: string;
  addendumType: string;
}) {
  try {
    const { client, fromEmail } = await getUncachableSendGridClient();
    const typeLabels: Record<string, string> = {
      salary_revision: "Salary Revision",
      role_change: "Role / Title Change",
      probation_extension: "Probation Extension",
      combined: "Combined Role & Salary Change",
      custom: "Custom Amendment",
    };
    const typeLabel = typeLabels[options.addendumType] || "Amendment";

    const msg = {
      to: options.to,
      from: { email: fromEmail, name: "Alina Carter" },
      subject: `Addendum Signed — ${options.candidateName} (${typeLabel})`,
      html: `
        <div style="font-family: 'Segoe UI', Arial, sans-serif; max-width: 600px; margin: 0 auto; background: #ffffff;">
          <div style="background: linear-gradient(135deg, #16a34a 0%, #22c55e 100%); padding: 32px; text-align: center;">
            <h1 style="color: #ffffff; margin: 0; font-size: 24px; font-weight: 700;">Rayomind Solutions LLP</h1>
            <p style="color: #dcfce7; margin: 8px 0 0; font-size: 14px;">Addendum Accepted</p>
          </div>
          <div style="padding: 32px;">
            <h2 style="color: #1e293b; margin: 0 0 16px; font-size: 20px;">Addendum Signed</h2>
            <p style="color: #475569; line-height: 1.6; margin: 0 0 16px;">
              <strong>${options.candidateName}</strong> has reviewed and digitally signed the <strong>${typeLabel}</strong> addendum to their offer letter.
            </p>
            <p style="color: #475569; line-height: 1.6; margin: 0 0 16px;">
              You may now counter-sign the addendum from the HR Tools → Offer Letters dashboard.
            </p>
            ${SIGNOFF_HTML}
          </div>
          <div style="background: #f8fafc; padding: 20px 32px; text-align: center; border-top: 1px solid #e2e8f0;">
            <p style="color: #94a3b8; font-size: 12px; margin: 0;">
              &copy; ${new Date().getFullYear()} Hire'in Solutions (Rayomind Solutions LLP). All rights reserved.
            </p>
          </div>
        </div>
      `,
      text: `${options.candidateName} has signed the ${typeLabel} addendum. Please counter-sign from the HR Tools dashboard.${SIGNOFF_TEXT}`,
    };
    await client.send(msg);
    console.log(`Addendum accepted notification sent to ${options.to}`);
    return { success: true };
  } catch (error: any) {
    console.error("Failed to send addendum accepted email:", error?.response?.body || error.message);
    return { success: false, error: error.message };
  }
}

export async function sendLeaveAppliedEmail(options: {
  to: string;
  managerName: string;
  employeeName: string;
  leaveType: string;
  startDate: string;
  endDate: string;
  totalDays: string;
  reason: string;
  approvalUrl: string;
}) {
  try {
    const { client, fromEmail } = await getUncachableSendGridClient();
    const msg = {
      to: options.to,
      from: { email: fromEmail, name: "Alina Carter" },
      subject: `Leave Request: ${options.employeeName} — ${options.leaveType}`,
      html: `
        <div style="font-family: 'Segoe UI', Arial, sans-serif; max-width: 600px; margin: 0 auto; background: #ffffff;">
          <div style="background: linear-gradient(135deg, #1e40af 0%, #3b82f6 100%); padding: 32px; text-align: center;">
            <h1 style="color: #ffffff; margin: 0; font-size: 24px; font-weight: 700;">Rayomind Solutions LLP</h1>
            <p style="color: #dbeafe; margin: 8px 0 0; font-size: 14px;">Leave Request Notification</p>
          </div>
          <div style="padding: 32px;">
            <h2 style="color: #1e293b; margin: 0 0 16px; font-size: 20px;">Hi ${options.managerName},</h2>
            <p style="color: #475569; line-height: 1.6; margin: 0 0 16px;">
              <strong>${options.employeeName}</strong> has submitted a leave request that requires your approval.
            </p>
            <div style="background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 20px; margin: 24px 0;">
              <p style="color: #1e293b; font-weight: 600; margin: 0 0 12px;">Leave Details</p>
              <table style="width: 100%; border-collapse: collapse;">
                <tr>
                  <td style="color: #64748b; padding: 6px 0; width: 120px;">Employee:</td>
                  <td style="color: #1e293b; font-weight: 500; padding: 6px 0;">${options.employeeName}</td>
                </tr>
                <tr>
                  <td style="color: #64748b; padding: 6px 0;">Leave Type:</td>
                  <td style="color: #1e293b; font-weight: 500; padding: 6px 0;">${options.leaveType}</td>
                </tr>
                <tr>
                  <td style="color: #64748b; padding: 6px 0;">From:</td>
                  <td style="color: #1e293b; font-weight: 500; padding: 6px 0;">${options.startDate}</td>
                </tr>
                <tr>
                  <td style="color: #64748b; padding: 6px 0;">To:</td>
                  <td style="color: #1e293b; font-weight: 500; padding: 6px 0;">${options.endDate}</td>
                </tr>
                <tr>
                  <td style="color: #64748b; padding: 6px 0;">Total Days:</td>
                  <td style="color: #1e293b; font-weight: 500; padding: 6px 0;">${options.totalDays}</td>
                </tr>
                ${options.reason ? `<tr>
                  <td style="color: #64748b; padding: 6px 0; vertical-align: top;">Reason:</td>
                  <td style="color: #1e293b; font-weight: 500; padding: 6px 0;">${options.reason}</td>
                </tr>` : ""}
              </table>
            </div>
            <div style="text-align: center; margin: 24px 0;">
              <a href="${options.approvalUrl}" style="display: inline-block; background: #1e40af; color: #ffffff; text-decoration: none; padding: 12px 32px; border-radius: 6px; font-weight: 600; font-size: 15px;">
                Review Leave Request
              </a>
            </div>
            ${SIGNOFF_HTML}
          </div>
          <div style="background: #f8fafc; padding: 20px 32px; text-align: center; border-top: 1px solid #e2e8f0;">
            <p style="color: #94a3b8; font-size: 12px; margin: 0;">
              &copy; ${new Date().getFullYear()} Hire'in Solutions (Rayomind Solutions LLP). All rights reserved.
            </p>
          </div>
        </div>
      `,
      text: `Hi ${options.managerName},\n\n${options.employeeName} has submitted a leave request.\n\nLeave Type: ${options.leaveType}\nFrom: ${options.startDate}\nTo: ${options.endDate}\nTotal Days: ${options.totalDays}${options.reason ? `\nReason: ${options.reason}` : ""}\n\nReview at: ${options.approvalUrl}${SIGNOFF_TEXT}`,
    };
    await client.send(msg);
    console.log(`Leave applied email sent to ${options.to}`);
    return { success: true };
  } catch (error: any) {
    console.error("Failed to send leave applied email:", error?.response?.body || error.message);
    return { success: false, error: error.message };
  }
}

export async function sendReviewAssignmentEmail(options: {
  to: string;
  cc?: string[];
  reviewerName: string;
  articleTitle: string;
  excerpt?: string | null;
  contentType?: string | null;
  category?: string | null;
  projectName?: string | null;
  dueDate?: string | null;
  reviewUrl: string;
}) {
  try {
    const { client, fromEmail } = await getUncachableSendGridClient();
    const detailRow = (label: string, value?: string | null) =>
      value
        ? `<tr><td style="color:#64748b;padding:6px 0;width:120px;">${label}:</td><td style="color:#1e293b;font-weight:500;padding:6px 0;">${value}</td></tr>`
        : "";
    const ccList = (options.cc ?? []).filter((e) => e && e !== options.to);
    const msg: any = {
      to: options.to,
      ...(ccList.length ? { cc: Array.from(new Set(ccList)) } : {}),
      from: { email: fromEmail, name: "Alina Carter" },
      subject: `New article to review: ${options.articleTitle}${options.dueDate ? ` — due ${options.dueDate}` : ""}`,
      html: `
        <div style="font-family: 'Segoe UI', Arial, sans-serif; max-width: 600px; margin: 0 auto; background: #ffffff;">
          <div style="background: linear-gradient(135deg, #1F3A6E 0%, #F47C20 100%); padding: 32px; text-align: center;">
            <h1 style="color: #ffffff; margin: 0; font-size: 24px; font-weight: 700;">Hire'in Content Studio</h1>
            <p style="color: #e2e8f0; margin: 8px 0 0; font-size: 14px;">New Review Assignment</p>
          </div>
          <div style="padding: 32px;">
            <h2 style="color: #1e293b; margin: 0 0 16px; font-size: 20px;">Hi ${options.reviewerName},</h2>
            <p style="color: #475569; line-height: 1.6; margin: 0 0 16px;">
              You have a new article to review: <strong>${options.articleTitle}</strong>${options.dueDate ? ` — due <strong>${options.dueDate}</strong>` : ""}.
            </p>
            <div style="background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 20px; margin: 24px 0;">
              <p style="color: #1e293b; font-weight: 600; margin: 0 0 12px;">Article Details</p>
              <table style="width: 100%; border-collapse: collapse;">
                ${detailRow("Title", options.articleTitle)}
                ${detailRow("Project", options.projectName)}
                ${detailRow("Content Type", options.contentType)}
                ${detailRow("Category", options.category)}
                ${detailRow("Due", options.dueDate)}
              </table>
              ${options.excerpt ? `<p style="color:#475569;line-height:1.6;margin:16px 0 0;">${options.excerpt}</p>` : ""}
            </div>
            <div style="text-align: center; margin: 24px 0;">
              <a href="${options.reviewUrl}" style="display: inline-block; background: #1F3A6E; color: #ffffff; text-decoration: none; padding: 12px 32px; border-radius: 6px; font-weight: 600; font-size: 15px;">
                Review Article
              </a>
            </div>
            ${SIGNOFF_HTML}
          </div>
          <div style="background: #f8fafc; padding: 20px 32px; text-align: center; border-top: 1px solid #e2e8f0;">
            <p style="color: #94a3b8; font-size: 12px; margin: 0;">
              &copy; ${new Date().getFullYear()} Hire'in Solutions (Rayomind Solutions LLP). All rights reserved.
            </p>
          </div>
        </div>
      `,
      text: `Hi ${options.reviewerName},\n\nYou have a new article to review: ${options.articleTitle}${options.dueDate ? ` — due ${options.dueDate}` : ""}.\n\n${options.projectName ? `Project: ${options.projectName}\n` : ""}${options.contentType ? `Content Type: ${options.contentType}\n` : ""}${options.category ? `Category: ${options.category}\n` : ""}${options.excerpt ? `\n${options.excerpt}\n` : ""}\nReview at: ${options.reviewUrl}${SIGNOFF_TEXT}`,
    };
    await client.send(msg);
    console.log(`Review assignment email sent to ${options.to}`);
    return { success: true };
  } catch (error: any) {
    console.error("Failed to send review assignment email:", error?.response?.body || error.message);
    return { success: false, error: error.message };
  }
}

// One-time internal "Hire'in Insights is live" launch announcement. Sent to the
// whole active team with the founder CC'd by convention. Internal-only — this is
// not a public/marketing send.
export async function sendInsightsLaunchAnnouncementEmail(options: {
  to: string[];
  portalUrl: string;
}) {
  try {
    const { client, fromEmail } = await getUncachableSendGridClient();
    const recipients = Array.from(new Set((options.to ?? []).filter(Boolean)));
    if (recipients.length === 0) return { success: false, error: "no_recipients" };
    const founderCc = "simranjeet@hire-in.com";
    const cc = recipients.includes(founderCc) ? [] : [founderCc];
    const msg: any = {
      to: recipients,
      ...(cc.length ? { cc } : {}),
      from: { email: fromEmail, name: "Alina Carter" },
      replyTo: { email: "alina.carter@hire-in.com", name: "Alina Carter" },
      subject: "Hire'in Insights is live — internal pilot launch",
      html: `
        <div style="font-family: 'Segoe UI', Arial, sans-serif; max-width: 600px; margin: 0 auto; background: #ffffff;">
          <div style="background: linear-gradient(135deg, #1F3A6E 0%, #F47C20 100%); padding: 32px; text-align: center;">
            <h1 style="color: #ffffff; margin: 0; font-size: 24px; font-weight: 700;">Hire'in Insights</h1>
            <p style="color: #ffe8d6; margin: 8px 0 0; font-size: 14px;">Internal pilot launch</p>
          </div>
          <div style="padding: 32px;">
            <h2 style="color: #1e293b; margin: 0 0 16px; font-size: 20px;">Our content engine is live</h2>
            <p style="color: #475569; line-height: 1.6; margin: 0 0 16px;">
              The first Hire'in Insights content package is loaded into Content Studio. These articles cover
              healthcare and IT staffing, recruiter playbooks, candidate tips, employer guides and AI in recruiting.
            </p>
            <p style="color: #475569; line-height: 1.6; margin: 0 0 16px;">
              Every article moves through <strong>draft → review → approval → publish</strong>. If you are assigned a
              review, you will get a notification and an email — please action it within the review window. Nothing
              goes public, and no social post is published, until a human approves it.
            </p>
            <div style="text-align: center; margin: 24px 0;">
              <a href="${options.portalUrl}" style="display: inline-block; background: #1F3A6E; color: #ffffff; text-decoration: none; padding: 12px 32px; border-radius: 6px; font-weight: 600; font-size: 15px;">
                Open Content Studio
              </a>
            </div>
            ${SIGNOFF_HTML}
          </div>
          <div style="background: #f8fafc; padding: 20px 32px; text-align: center; border-top: 1px solid #e2e8f0;">
            <p style="color: #94a3b8; font-size: 12px; margin: 0;">
              &copy; ${new Date().getFullYear()} Hire'in Solutions (Rayomind Solutions LLP). All rights reserved.
            </p>
          </div>
        </div>
      `,
      text: `Our content engine is live.\n\nThe first Hire'in Insights content package is loaded into Content Studio (healthcare & IT staffing, recruiter playbooks, candidate tips, employer guides, AI in recruiting).\n\nEvery article moves through draft -> review -> approval -> publish. If you are assigned a review, you will get a notification and an email. Nothing goes public, and no social post is published, until a human approves it.\n\nOpen Content Studio: ${options.portalUrl}${SIGNOFF_TEXT}`,
    };
    await client.send(msg);
    console.log(`Insights launch announcement sent to ${recipients.length} recipients`);
    return { success: true };
  } catch (error: any) {
    console.error("Failed to send insights launch announcement:", error?.response?.body || error.message);
    return { success: false, error: error.message };
  }
}

export async function sendLeaveDecisionEmail(options: {
  to: string;
  employeeName: string;
  leaveType: string;
  startDate: string;
  endDate: string;
  status: "approved" | "rejected";
  reviewComment?: string | null;
}) {
  try {
    const { client, fromEmail } = await getUncachableSendGridClient();
    const isApproved = options.status === "approved";
    const headerColor = isApproved
      ? "linear-gradient(135deg, #16a34a 0%, #22c55e 100%)"
      : "linear-gradient(135deg, #dc2626 0%, #ef4444 100%)";
    const headerSubtitle = isApproved ? "Leave Approved" : "Leave Rejected";
    const statusText = isApproved ? "approved" : "rejected";

    const msg = {
      to: options.to,
      from: { email: fromEmail, name: "Alina Carter" },
      subject: `Your Leave Request Has Been ${isApproved ? "Approved" : "Rejected"}`,
      html: `
        <div style="font-family: 'Segoe UI', Arial, sans-serif; max-width: 600px; margin: 0 auto; background: #ffffff;">
          <div style="background: ${headerColor}; padding: 32px; text-align: center;">
            <h1 style="color: #ffffff; margin: 0; font-size: 24px; font-weight: 700;">Rayomind Solutions LLP</h1>
            <p style="color: ${isApproved ? "#dcfce7" : "#fee2e2"}; margin: 8px 0 0; font-size: 14px;">${headerSubtitle}</p>
          </div>
          <div style="padding: 32px;">
            <h2 style="color: #1e293b; margin: 0 0 16px; font-size: 20px;">Hi ${options.employeeName},</h2>
            <p style="color: #475569; line-height: 1.6; margin: 0 0 16px;">
              Your leave request has been <strong>${statusText}</strong>.
            </p>
            <div style="background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 20px; margin: 24px 0;">
              <p style="color: #1e293b; font-weight: 600; margin: 0 0 12px;">Leave Details</p>
              <table style="width: 100%; border-collapse: collapse;">
                <tr>
                  <td style="color: #64748b; padding: 6px 0; width: 120px;">Leave Type:</td>
                  <td style="color: #1e293b; font-weight: 500; padding: 6px 0;">${options.leaveType}</td>
                </tr>
                <tr>
                  <td style="color: #64748b; padding: 6px 0;">From:</td>
                  <td style="color: #1e293b; font-weight: 500; padding: 6px 0;">${options.startDate}</td>
                </tr>
                <tr>
                  <td style="color: #64748b; padding: 6px 0;">To:</td>
                  <td style="color: #1e293b; font-weight: 500; padding: 6px 0;">${options.endDate}</td>
                </tr>
                <tr>
                  <td style="color: #64748b; padding: 6px 0;">Status:</td>
                  <td style="color: ${isApproved ? "#16a34a" : "#dc2626"}; font-weight: 600; padding: 6px 0; text-transform: capitalize;">${statusText}</td>
                </tr>
                ${options.reviewComment ? `<tr>
                  <td style="color: #64748b; padding: 6px 0; vertical-align: top;">Comment:</td>
                  <td style="color: #1e293b; font-weight: 500; padding: 6px 0;">${options.reviewComment}</td>
                </tr>` : ""}
              </table>
            </div>
            <p style="color: #475569; line-height: 1.6; margin: 0;">
              You can view your leave history in the employee portal.
            </p>
            ${SIGNOFF_HTML}
          </div>
          <div style="background: #f8fafc; padding: 20px 32px; text-align: center; border-top: 1px solid #e2e8f0;">
            <p style="color: #94a3b8; font-size: 12px; margin: 0;">
              &copy; ${new Date().getFullYear()} Hire'in Solutions (Rayomind Solutions LLP). All rights reserved.
            </p>
          </div>
        </div>
      `,
      text: `Hi ${options.employeeName},\n\nYour leave request has been ${statusText}.\n\nLeave Type: ${options.leaveType}\nFrom: ${options.startDate}\nTo: ${options.endDate}${options.reviewComment ? `\nComment: ${options.reviewComment}` : ""}\n\nYou can view your leave history in the employee portal.${SIGNOFF_TEXT}`,
    };
    await client.send(msg);
    console.log(`Leave decision email sent to ${options.to}`);
    return { success: true };
  } catch (error: any) {
    console.error("Failed to send leave decision email:", error?.response?.body || error.message);
    return { success: false, error: error.message };
  }
}

export async function sendLeaveAccrualEmail(options: {
  to: string;
  employeeName: string;
  year: number;
  month: number;
  types: Array<{ leaveTypeName: string; days: number; newBalance: number; accrualType: string }>;
}) {
  try {
    const { client, fromEmail } = await getUncachableSendGridClient();
    const monthName = new Date(options.year, options.month - 1, 1).toLocaleString("en-IN", { month: "long" });
    const typeRows = options.types.map(t => {
      const bonus = t.accrualType === "monthly+bonus" ? " <span style='color:#7c3aed;font-size:11px;'>(Bonus Month)</span>" : "";
      return `<tr>
        <td style="color:#1e293b;padding:6px 8px;">${t.leaveTypeName}${bonus}</td>
        <td style="color:#16a34a;font-weight:600;padding:6px 8px;">+${t.days}</td>
        <td style="color:#1e293b;font-weight:600;padding:6px 8px;">${t.newBalance.toFixed(1)} days</td>
      </tr>`;
    }).join("");
    const typeText = options.types.map(t => {
      const bonus = t.accrualType === "monthly+bonus" ? " (Bonus Month)" : "";
      return `${t.leaveTypeName}${bonus}: +${t.days} → balance: ${t.newBalance.toFixed(1)} days`;
    }).join("\n");

    const msg = {
      to: options.to,
      from: { email: fromEmail, name: "Alina Carter" },
      subject: `${monthName} ${options.year} Leave Credited — ${options.employeeName}`,
      html: `
        <div style="font-family:'Segoe UI',Arial,sans-serif;max-width:600px;margin:0 auto;background:#ffffff;">
          <div style="background:linear-gradient(135deg,#1e40af 0%,#3b82f6 100%);padding:32px;text-align:center;">
            <h1 style="color:#ffffff;margin:0;font-size:24px;font-weight:700;">Rayomind Solutions LLP</h1>
            <p style="color:#dbeafe;margin:8px 0 0;font-size:14px;">Monthly Leave Credit Notification</p>
          </div>
          <div style="padding:32px;">
            <p style="color:#475569;margin:0 0 4px;">Dear <strong>${options.employeeName}</strong>,</p>
            <p style="color:#475569;line-height:1.6;margin:0 0 24px;">
              Your leave balance has been updated for <strong>${monthName} ${options.year}</strong>.
            </p>
            <div style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:8px;padding:20px;margin:0 0 24px;">
              <p style="color:#1e293b;font-weight:600;margin:0 0 12px;">Leave Credited This Month</p>
              <table style="width:100%;border-collapse:collapse;">
                <thead>
                  <tr style="border-bottom:1px solid #e2e8f0;">
                    <th style="text-align:left;color:#64748b;padding:6px 8px;font-size:12px;">Type</th>
                    <th style="text-align:left;color:#64748b;padding:6px 8px;font-size:12px;">Credited</th>
                    <th style="text-align:left;color:#64748b;padding:6px 8px;font-size:12px;">New Balance</th>
                  </tr>
                </thead>
                <tbody>${typeRows}</tbody>
              </table>
            </div>
            <p style="color:#475569;font-size:13px;line-height:1.6;margin:0;">
              Log in to the HR portal to view your full leave balance and apply for leave.
            </p>
            ${SIGNOFF_HTML}
          </div>
          <div style="background:#f8fafc;padding:20px 32px;text-align:center;border-top:1px solid #e2e8f0;">
            <p style="color:#94a3b8;font-size:12px;margin:0;">&copy; ${new Date().getFullYear()} Hire'in Solutions (Rayomind Solutions LLP). All rights reserved.</p>
          </div>
        </div>
      `,
      text: `Dear ${options.employeeName},\n\n${monthName} ${options.year} Leave Credited:\n${typeText}\n\nLog in to the HR portal to view your balance.${SIGNOFF_TEXT}`,
    };
    await client.send(msg);
    console.log(`Leave accrual email sent to ${options.to}`);
    return { success: true };
  } catch (error: any) {
    console.error("Failed to send leave accrual email:", error?.response?.body || error.message);
    return { success: false, error: error.message };
  }
}

export async function sendLeaveYearEndEmail(options: {
  to: string;
  employeeName: string;
  year: number;
  events: Array<{ action: string; leaveTypeName: string; days: number }>;
}) {
  try {
    const { client, fromEmail } = await getUncachableSendGridClient();
    const carries = options.events.filter(e => e.action === "carry_forward");
    const lapses = options.events.filter(e => e.action === "lapse");
    const coExpires = options.events.filter(e => e.action === "co_expire");

    const rows = [
      ...carries.map(e => `<tr><td style="padding:6px 8px;color:#1e293b;">${e.leaveTypeName}</td><td style="padding:6px 8px;color:#16a34a;font-weight:600;">Carried forward</td><td style="padding:6px 8px;color:#1e293b;font-weight:600;">${e.days.toFixed(1)} days</td></tr>`),
      ...lapses.map(e => `<tr><td style="padding:6px 8px;color:#1e293b;">${e.leaveTypeName}</td><td style="padding:6px 8px;color:#dc2626;font-weight:600;">Lapsed (Dec 31)</td><td style="padding:6px 8px;color:#1e293b;font-weight:600;">${e.days.toFixed(1)} days</td></tr>`),
      ...coExpires.map(e => `<tr><td style="padding:6px 8px;color:#1e293b;">${e.leaveTypeName}</td><td style="padding:6px 8px;color:#d97706;font-weight:600;">Expired (>30 days)</td><td style="padding:6px 8px;color:#1e293b;font-weight:600;">${e.days.toFixed(1)} days</td></tr>`),
    ].join("");

    const textSummary = [
      ...carries.map(e => `${e.leaveTypeName}: ${e.days.toFixed(1)} days carried forward`),
      ...lapses.map(e => `${e.leaveTypeName}: ${e.days.toFixed(1)} days lapsed on Dec 31`),
      ...coExpires.map(e => `${e.leaveTypeName}: ${e.days.toFixed(1)} days expired (>30 days old)`),
    ].join("\n");

    const msg = {
      to: options.to,
      from: { email: fromEmail, name: "Alina Carter" },
      subject: `Year-End Leave Update — ${options.year}`,
      html: `
        <div style="font-family:'Segoe UI',Arial,sans-serif;max-width:600px;margin:0 auto;background:#ffffff;">
          <div style="background:linear-gradient(135deg,#1e40af 0%,#3b82f6 100%);padding:32px;text-align:center;">
            <h1 style="color:#ffffff;margin:0;font-size:24px;font-weight:700;">Rayomind Solutions LLP</h1>
            <p style="color:#dbeafe;margin:8px 0 0;font-size:14px;">Year-End Leave Statement — ${options.year}</p>
          </div>
          <div style="padding:32px;">
            <p style="color:#475569;margin:0 0 4px;">Dear <strong>${options.employeeName}</strong>,</p>
            <p style="color:#475569;line-height:1.6;margin:0 0 24px;">
              Year-end leave processing has been completed for <strong>${options.year}</strong>. Here is a summary of changes to your leave balance:
            </p>
            <div style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:8px;padding:20px;margin:0 0 24px;">
              <p style="color:#1e293b;font-weight:600;margin:0 0 12px;">Year-End Leave Summary</p>
              <table style="width:100%;border-collapse:collapse;">
                <thead>
                  <tr style="border-bottom:1px solid #e2e8f0;">
                    <th style="text-align:left;color:#64748b;padding:6px 8px;font-size:12px;">Leave Type</th>
                    <th style="text-align:left;color:#64748b;padding:6px 8px;font-size:12px;">Action</th>
                    <th style="text-align:left;color:#64748b;padding:6px 8px;font-size:12px;">Days</th>
                  </tr>
                </thead>
                <tbody>${rows}</tbody>
              </table>
            </div>
            <p style="color:#475569;line-height:1.6;margin:0;">
              Please contact HR if you have any questions about your leave balance.
            </p>
            ${SIGNOFF_HTML}
          </div>
          <div style="background:#f8fafc;padding:20px 32px;text-align:center;border-top:1px solid #e2e8f0;">
            <p style="color:#94a3b8;font-size:12px;margin:0;">&copy; ${new Date().getFullYear()} Hire'in Solutions (Rayomind Solutions LLP). All rights reserved.</p>
          </div>
        </div>
      `,
      text: `Dear ${options.employeeName},\n\nYear-end leave processing for ${options.year} is complete:\n\n${textSummary}\n\nContact HR for any questions.${SIGNOFF_TEXT}`,
    };
    await client.send(msg);
    return { success: true };
  } catch (error: any) {
    console.error("Failed to send year-end leave email:", error?.response?.body || error.message);
    return { success: false, error: error.message };
  }
}

export async function sendCheckInReminderEmail(options: {
  to: string;
  firstName: string;
  scheduledDate: string;
  managerName: string;
  notes?: string;
}) {
  try {
    const { client, fromEmail } = await getUncachableSendGridClient();
    const notesBlock = options.notes
      ? `<div style="background: #f8fafc; border-left: 4px solid #3b82f6; border-radius: 4px; padding: 12px 16px; margin: 16px 0;">
          <p style="color: #1e293b; font-weight: 600; margin: 0 0 6px; font-size: 13px;">Notes from your manager:</p>
          <p style="color: #475569; margin: 0; font-size: 14px; white-space: pre-wrap;">${options.notes}</p>
        </div>`
      : "";
    const notesText = options.notes ? `\n\nNotes from your manager:\n${options.notes}` : "";
    const msg = {
      to: options.to,
      from: { email: fromEmail, name: "Alina Carter" },
      subject: `Check-In Scheduled: ${options.scheduledDate}`,
      html: `
        <div style="font-family: 'Segoe UI', Arial, sans-serif; max-width: 600px; margin: 0 auto; background: #ffffff;">
          <div style="background: linear-gradient(135deg, #1e40af 0%, #3b82f6 100%); padding: 32px; text-align: center;">
            <h1 style="color: #ffffff; margin: 0; font-size: 24px; font-weight: 700;">Rayomind Solutions LLP</h1>
            <p style="color: #dbeafe; margin: 8px 0 0; font-size: 14px;">Check-In Scheduled</p>
          </div>
          <div style="padding: 32px;">
            <h2 style="color: #1e293b; margin: 0 0 16px; font-size: 20px;">Hi ${options.firstName},</h2>
            <p style="color: #475569; line-height: 1.6; margin: 0 0 16px;">
              A check-in has been scheduled for <strong>${options.scheduledDate}</strong> with <strong>${options.managerName}</strong>.
            </p>
            ${notesBlock}
            <p style="color: #475569; line-height: 1.6; margin: 0 0 16px;">
              Please prepare your notes and discussion items before the meeting.
            </p>
            ${SIGNOFF_HTML}
          </div>
          <div style="background: #f8fafc; padding: 20px 32px; text-align: center; border-top: 1px solid #e2e8f0;">
            <p style="color: #94a3b8; font-size: 12px; margin: 0;">&copy; ${new Date().getFullYear()} Hire'in Solutions (Rayomind Solutions LLP). All rights reserved.</p>
          </div>
        </div>
      `,
      text: `Hi ${options.firstName},\n\nA check-in has been scheduled for ${options.scheduledDate} with ${options.managerName}.${notesText}\n\nPlease prepare your notes and discussion items before the meeting.${SIGNOFF_TEXT}`,
    };
    await client.send(msg);
    console.log(`Check-in scheduled email sent to ${options.to}`);
    return { success: true };
  } catch (error: any) {
    console.error("Failed to send check-in scheduled email:", error?.response?.body || error.message);
    return { success: false, error: error.message };
  }
}

export async function sendPolicyUpdateEmail(options: {
  to: string;
  firstName: string;
  lastName: string;
  trackTitle: string;
  versionNumber: number;
}) {
  try {
    const { client, fromEmail } = await getUncachableSendGridClient();
    const msg = {
      to: options.to,
      from: { email: fromEmail, name: "Alina Carter" },
      subject: `Action Required: "${options.trackTitle}" Policy Updated — Re-sign Required`,
      html: `
        <div style="font-family: 'Segoe UI', Arial, sans-serif; max-width: 600px; margin: 0 auto; background: #ffffff;">
          <div style="background: linear-gradient(135deg, #dc2626 0%, #b91c1c 100%); padding: 32px; text-align: center;">
            <h1 style="color: #ffffff; margin: 0; font-size: 22px; font-weight: 700;">Policy Update — Action Required</h1>
          </div>
          <div style="padding: 32px;">
            <h2 style="color: #1e293b; margin: 0 0 16px; font-size: 18px;">Hi ${options.firstName},</h2>
            <p style="color: #475569; line-height: 1.6; margin: 0 0 16px;">
              The employment policy <strong>"${options.trackTitle}"</strong> has been updated to <strong>Version ${options.versionNumber}</strong>.
            </p>
            <p style="color: #475569; line-height: 1.6; margin: 0 0 16px;">
              As a mandatory compliance requirement, you must review and re-sign this policy before you can continue accessing the HR portal.
            </p>
            <div style="background: #fef2f2; border: 1px solid #fca5a5; border-radius: 8px; padding: 16px; margin: 24px 0;">
              <p style="color: #991b1b; font-weight: 600; margin: 0;">⚠ Your portal access will be restricted until you re-sign this policy.</p>
            </div>
            <p style="color: #475569; line-height: 1.6;">
              Please log in to the portal and complete the policy acknowledgment at your earliest convenience.
            </p>
            ${SIGNOFF_HTML}
          </div>
          <div style="background: #f8fafc; padding: 20px 32px; text-align: center; border-top: 1px solid #e2e8f0;">
            <p style="color: #94a3b8; font-size: 12px; margin: 0;">&copy; ${new Date().getFullYear()} Hire'in Solutions (Rayomind Solutions LLP). All rights reserved.</p>
          </div>
        </div>
      `,
      text: `Hi ${options.firstName},\n\nThe policy "${options.trackTitle}" has been updated to Version ${options.versionNumber}. You must re-sign it before you can access the HR portal.\n\nPlease log in to complete the acknowledgment.${SIGNOFF_TEXT}`,
    };
    await client.send(msg);
    console.log(`Policy update email sent to ${options.to}`);
    return { success: true };
  } catch (error: any) {
    console.error("Failed to send policy update email:", error?.response?.body || error.message);
    return { success: false, error: error.message };
  }
}

export async function sendTrainingRequestEmail(options: {
  to: string;
  employeeName: string;
  subject: string;
  heading: string;
  body: string;
  comment?: string;
}) {
  try {
    const { client, fromEmail } = await getUncachableSendGridClient();
    const commentBlock = options.comment
      ? `<div style="background: #f1f5f9; border-left: 4px solid #64748b; padding: 12px 16px; margin: 16px 0; border-radius: 0 4px 4px 0;">
           <p style="color: #374151; margin: 0; font-style: italic;">"${options.comment}"</p>
         </div>`
      : "";
    const msg = {
      to: options.to,
      from: { email: fromEmail, name: "Alina Carter" },
      subject: options.subject,
      html: `
        <div style="font-family: 'Segoe UI', Arial, sans-serif; max-width: 600px; margin: 0 auto; background: #ffffff;">
          <div style="background: linear-gradient(135deg, #1e40af 0%, #3b82f6 100%); padding: 32px; text-align: center;">
            <h1 style="color: #ffffff; margin: 0; font-size: 24px; font-weight: 700;">Rayomind Solutions LLP</h1>
            <p style="color: #dbeafe; margin: 8px 0 0; font-size: 14px;">Training Portal</p>
          </div>
          <div style="padding: 32px;">
            <h2 style="color: #1e293b; margin: 0 0 16px; font-size: 20px;">${options.heading}</h2>
            <p style="color: #475569; line-height: 1.6; margin: 0 0 16px; white-space: pre-line;">${options.body}</p>
            ${commentBlock}
            <p style="color: #475569; line-height: 1.6; margin: 16px 0 0;">Please log in to the portal for more details.</p>
            ${SIGNOFF_HTML}
          </div>
          <div style="background: #f8fafc; padding: 20px 32px; text-align: center; border-top: 1px solid #e2e8f0;">
            <p style="color: #94a3b8; font-size: 12px; margin: 0;">&copy; ${new Date().getFullYear()} Hire'in Solutions (Rayomind Solutions LLP). All rights reserved.</p>
          </div>
        </div>
      `,
      text: `${options.heading}\n\n${options.body}${options.comment ? `\n\nComment: "${options.comment}"` : ""}\n\nPlease log in to the portal for more details.${SIGNOFF_TEXT}`,
    };
    await client.send(msg);
    return { success: true };
  } catch (error: any) {
    console.error("Failed to send training request email:", error?.response?.body || error.message);
    return { success: false, error: error.message };
  }
}

export async function sendContractSigningEmail(options: {
  to: string;
  clientName: string;
  candidateName?: string;
  signingUrl: string;
}) {
  try {
    const { client, fromEmail } = await getUncachableSendGridClient();
    const msg = {
      to: options.to,
      from: { email: fromEmail, name: "Alina Carter" },
      subject: `Action Required: Please sign your staffing contract`,
      html: `
        <div style="font-family:'Segoe UI',Arial,sans-serif;max-width:600px;margin:0 auto;background:#ffffff;">
          <div style="background:linear-gradient(135deg,#1F3A6E 0%,#2d5aa0 100%);padding:32px;text-align:center;">
            <h1 style="color:#ffffff;margin:0;font-size:24px;font-weight:700;">Rayomind Solutions LLP</h1>
            <p style="color:#bfdbfe;margin:8px 0 0;font-size:14px;">Contract Signing</p>
          </div>
          <div style="padding:32px;">
            <h2 style="color:#1e293b;margin:0 0 16px;font-size:20px;">Dear ${options.clientName},</h2>
            <p style="color:#475569;line-height:1.6;margin:0 0 16px;">
              A staffing services contract${options.candidateName ? ` for <strong>${options.candidateName}</strong>` : ""} is ready for your review and signature.
            </p>
            <p style="color:#475569;line-height:1.6;margin:0 0 24px;">Please click the button below to review and sign the contract:</p>
            <div style="text-align:center;margin:24px 0;">
              <a href="${options.signingUrl}" style="background:#F47C20;color:#ffffff;padding:14px 32px;text-decoration:none;border-radius:6px;font-weight:600;font-size:16px;display:inline-block;">
                Review & Sign Contract
              </a>
            </div>
            <p style="color:#94a3b8;font-size:12px;margin:24px 0 0;">If you did not expect this email, please ignore it. The link is secure and unique to you.</p>
            ${SIGNOFF_HTML}
          </div>
          <div style="background:#f8fafc;padding:20px 32px;text-align:center;border-top:1px solid #e2e8f0;">
            <p style="color:#94a3b8;font-size:12px;margin:0;">&copy; ${new Date().getFullYear()} Hire'in Solutions (Rayomind Solutions LLP). All rights reserved.</p>
          </div>
        </div>
      `,
      text: `Dear ${options.clientName},\n\nA staffing services contract${options.candidateName ? ` for ${options.candidateName}` : ""} is ready for your signature.\n\nSign here: ${options.signingUrl}${SIGNOFF_TEXT}`,
    };
    await client.send(msg);
    return { success: true };
  } catch (error: any) {
    console.error("Failed to send contract signing email:", error?.response?.body || error.message);
    return { success: false, error: error.message };
  }
}

export async function sendContractCountersignEmail(options: {
  to: string;
  clientName: string;
  candidateName?: string;
  authCode: string;
}) {
  try {
    const { client, fromEmail } = await getUncachableSendGridClient();
    const msg = {
      to: options.to,
      from: { email: fromEmail, name: "Alina Carter" },
      subject: `Contract fully executed — your verification code`,
      html: `
        <div style="font-family:'Segoe UI',Arial,sans-serif;max-width:600px;margin:0 auto;background:#ffffff;">
          <div style="background:linear-gradient(135deg,#1F3A6E 0%,#2d5aa0 100%);padding:32px;text-align:center;">
            <h1 style="color:#ffffff;margin:0;font-size:24px;font-weight:700;">Rayomind Solutions LLP</h1>
            <p style="color:#bfdbfe;margin:8px 0 0;font-size:14px;">Contract Confirmation</p>
          </div>
          <div style="padding:32px;">
            <h2 style="color:#1e293b;margin:0 0 16px;font-size:20px;">Contract Fully Executed</h2>
            <p style="color:#475569;line-height:1.6;margin:0 0 16px;">
              Dear ${options.clientName}, your staffing contract${options.candidateName ? ` for <strong>${options.candidateName}</strong>` : ""} has been countersigned by Rayomind Solutions LLP and is now fully executed.
            </p>
            <div style="background:#f0fdf4;border:1px solid #bbf7d0;border-radius:8px;padding:16px;margin:20px 0;text-align:center;">
              <p style="color:#475569;font-size:13px;margin:0 0 8px;">Your verification auth code:</p>
              <p style="color:#15803d;font-size:28px;font-weight:700;font-family:monospace;margin:0;letter-spacing:4px;">${options.authCode}</p>
            </div>
            <p style="color:#475569;line-height:1.6;font-size:13px;">Keep this code safe. You can use it at any time to verify the authenticity of your contract on our portal.</p>
            ${SIGNOFF_HTML}
          </div>
          <div style="background:#f8fafc;padding:20px 32px;text-align:center;border-top:1px solid #e2e8f0;">
            <p style="color:#94a3b8;font-size:12px;margin:0;">&copy; ${new Date().getFullYear()} Hire'in Solutions (Rayomind Solutions LLP). All rights reserved.</p>
          </div>
        </div>
      `,
      text: `Dear ${options.clientName},\n\nYour contract has been fully executed. Your verification auth code is: ${options.authCode}${SIGNOFF_TEXT}`,
    };
    await client.send(msg);
    return { success: true };
  } catch (error: any) {
    console.error("Failed to send countersign email:", error?.response?.body || error.message);
    return { success: false, error: error.message };
  }
}

export async function sendPraiseEmail(options: {
  to: string;
  recipientFirstName: string;
  giverName: string;
  badgeName: string;
  badgeEmoji: string;
  message: string;
}) {
  try {
    const { client, fromEmail } = await getUncachableSendGridClient();
    const msg = {
      to: options.to,
      from: { email: fromEmail, name: "Alina Carter" },
      subject: `${options.badgeEmoji} You received a ${options.badgeName} badge!`,
      html: `
        <div style="font-family: 'Segoe UI', Arial, sans-serif; max-width: 600px; margin: 0 auto; background: #ffffff;">
          <div style="background: linear-gradient(135deg, #1e40af 0%, #3b82f6 100%); padding: 32px; text-align: center;">
            <h1 style="color: #ffffff; margin: 0; font-size: 24px; font-weight: 700;">Hire'in Solutions</h1>
            <p style="color: #dbeafe; margin: 8px 0 0; font-size: 14px;">Recognition & Praise</p>
          </div>
          <div style="padding: 32px;">
            <div style="text-align: center; margin-bottom: 24px;">
              <div style="font-size: 64px; line-height: 1; margin-bottom: 12px;">${options.badgeEmoji}</div>
              <h2 style="color: #1e293b; margin: 0 0 8px; font-size: 22px;">Congratulations, ${options.recipientFirstName}!</h2>
              <p style="color: #475569; margin: 0; font-size: 16px;">You've been awarded the <strong>${options.badgeName}</strong> badge</p>
            </div>
            <div style="background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 20px; margin: 24px 0;">
              <p style="color: #64748b; font-size: 13px; margin: 0 0 8px;">From <strong style="color: #1e293b;">${options.giverName}</strong>:</p>
              <p style="color: #1e293b; font-style: italic; margin: 0; line-height: 1.6;">"${options.message}"</p>
            </div>
            <p style="color: #475569; line-height: 1.6; margin: 0 0 8px;">Log in to the portal to view your badge, leave a comment, and manage your pinned badges on your profile.</p>
            ${SIGNOFF_HTML}
          </div>
          <div style="background: #f8fafc; padding: 20px 32px; text-align: center; border-top: 1px solid #e2e8f0;">
            <p style="color: #94a3b8; font-size: 12px; margin: 0;">&copy; ${new Date().getFullYear()} Hire'in Solutions (Rayomind Solutions LLP). All rights reserved.</p>
          </div>
        </div>
      `,
      text: `Congratulations ${options.recipientFirstName}!\n\nYou've been awarded the ${options.badgeEmoji} ${options.badgeName} badge by ${options.giverName}.\n\nMessage: "${options.message}"${SIGNOFF_TEXT}`,
    };
    await client.send(msg);
    return { success: true };
  } catch (error: any) {
    console.error("Failed to send praise email:", error?.response?.body || error.message);
    return { success: false, error: error.message };
  }
}

export async function sendAttendanceApprovalRequestEmail(options: {
  to: string;
  managerName: string;
  month: string;
  year: number;
  deadlineAt: Date;
  approvalUrl: string;
}) {
  try {
    const { client, fromEmail } = await getUncachableSendGridClient();
    const deadline = options.deadlineAt.toLocaleString("en-IN", { timeZone: "Asia/Kolkata", dateStyle: "medium", timeStyle: "short" });
    const msg: any = {
      to: options.to,
      from: { email: fromEmail, name: "Hire'in HR" },
      subject: `Action Required: Review Attendance Report for ${options.month} ${options.year}`,
      html: `
        <div style="font-family:'Segoe UI',Arial,sans-serif;max-width:600px;margin:0 auto;background:#fff;">
          <div style="background:linear-gradient(135deg,#1F3A6E 0%,#2563eb 100%);padding:28px 32px;text-align:center;">
            <h1 style="color:#fff;margin:0;font-size:22px;font-weight:700;">Hire'in Solutions</h1>
            <p style="color:#dbeafe;margin:8px 0 0;font-size:13px;">Monthly Attendance Approval</p>
          </div>
          <div style="padding:32px;">
            <h2 style="color:#1e293b;margin:0 0 16px;font-size:18px;">Hi ${options.managerName},</h2>
            <p style="color:#475569;line-height:1.6;">Your team's attendance report for <strong>${options.month} ${options.year}</strong> is ready for your review.</p>
            <div style="background:#fef3c7;border:1px solid #fde68a;border-radius:8px;padding:16px;margin:16px 0;">
              <p style="color:#92400e;font-weight:600;margin:0 0 4px;">⏰ Deadline: ${deadline} IST</p>
              <p style="color:#78350f;font-size:13px;margin:0;">Please approve or submit corrections before the deadline. Salary run is gated until all managers respond.</p>
            </div>
            <div style="text-align:center;margin:24px 0;">
              <a href="${options.approvalUrl}" style="display:inline-block;background:#1F3A6E;color:#fff;text-decoration:none;padding:12px 32px;border-radius:6px;font-weight:600;font-size:15px;">Review & Approve</a>
            </div>
            ${SIGNOFF_HTML}
          </div>
          <div style="background:#f8fafc;padding:16px 32px;text-align:center;border-top:1px solid #e2e8f0;">
            <p style="color:#94a3b8;font-size:12px;margin:0;">&copy; ${new Date().getFullYear()} Hire'in Solutions</p>
          </div>
        </div>
      `,
      text: `Hi ${options.managerName},\n\nYour team's attendance report for ${options.month} ${options.year} requires your review.\nDeadline: ${deadline} IST\n\nReview here: ${options.approvalUrl}${SIGNOFF_TEXT}`,
    };
    await client.send(msg);
    return { success: true };
  } catch (error: any) {
    console.error("sendAttendanceApprovalRequestEmail error:", error?.response?.body || error.message);
    return { success: false, error: error.message };
  }
}

export async function sendAttendanceEditsSubmittedEmail(options: {
  toEmails: string[];
  managerName: string;
  month: string;
  year: number;
  correctionCount: number;
  reviewUrl: string;
}) {
  try {
    const { client, fromEmail } = await getUncachableSendGridClient();
    const msg: any = {
      to: options.toEmails,
      from: { email: fromEmail, name: "Hire'in HR" },
      subject: `Attendance Corrections Submitted — ${options.month} ${options.year}`,
      html: `
        <div style="font-family:'Segoe UI',Arial,sans-serif;max-width:600px;margin:0 auto;background:#fff;">
          <div style="background:linear-gradient(135deg,#1F3A6E 0%,#2563eb 100%);padding:28px 32px;text-align:center;">
            <h1 style="color:#fff;margin:0;font-size:22px;font-weight:700;">Hire'in Solutions</h1>
            <p style="color:#dbeafe;margin:8px 0 0;font-size:13px;">Attendance Edit Review</p>
          </div>
          <div style="padding:32px;">
            <h2 style="color:#1e293b;margin:0 0 16px;font-size:18px;">Corrections Pending HR Review</h2>
            <p style="color:#475569;line-height:1.6;"><strong>${options.managerName}</strong> has submitted <strong>${options.correctionCount}</strong> attendance correction(s) for <strong>${options.month} ${options.year}</strong> that require your review.</p>
            <div style="text-align:center;margin:24px 0;">
              <a href="${options.reviewUrl}" style="display:inline-block;background:#1F3A6E;color:#fff;text-decoration:none;padding:12px 32px;border-radius:6px;font-weight:600;font-size:15px;">Review Corrections</a>
            </div>
            ${SIGNOFF_HTML}
          </div>
        </div>
      `,
      text: `${options.managerName} submitted ${options.correctionCount} attendance correction(s) for ${options.month} ${options.year}.\n\nReview here: ${options.reviewUrl}${SIGNOFF_TEXT}`,
    };
    await client.send(msg);
    return { success: true };
  } catch (error: any) {
    console.error("sendAttendanceEditsSubmittedEmail error:", error?.response?.body || error.message);
    return { success: false, error: error.message };
  }
}

export async function sendAttendanceDeadlineExpiredEmail(options: {
  toEmails: string[];
  month: string;
  year: number;
  overrideUrl: string;
}) {
  try {
    const { client, fromEmail } = await getUncachableSendGridClient();
    const msg: any = {
      to: options.toEmails,
      from: { email: fromEmail, name: "Hire'in HR" },
      subject: `⚠ Attendance Approval Deadline Expired — ${options.month} ${options.year}`,
      html: `
        <div style="font-family:'Segoe UI',Arial,sans-serif;max-width:600px;margin:0 auto;background:#fff;">
          <div style="background:linear-gradient(135deg,#dc2626 0%,#ef4444 100%);padding:28px 32px;text-align:center;">
            <h1 style="color:#fff;margin:0;font-size:22px;font-weight:700;">Hire'in Solutions</h1>
            <p style="color:#fecaca;margin:8px 0 0;font-size:13px;">Attendance Approval Deadline Alert</p>
          </div>
          <div style="padding:32px;">
            <h2 style="color:#1e293b;margin:0 0 16px;font-size:18px;">Approval Deadline Expired</h2>
            <p style="color:#475569;line-height:1.6;">The 24-hour approval window for <strong>${options.month} ${options.year}</strong> attendance has expired without all managers responding. An HR override is required to unlock the salary run.</p>
            <div style="text-align:center;margin:24px 0;">
              <a href="${options.overrideUrl}" style="display:inline-block;background:#dc2626;color:#fff;text-decoration:none;padding:12px 32px;border-radius:6px;font-weight:600;font-size:15px;">Override & Unlock</a>
            </div>
            ${SIGNOFF_HTML}
          </div>
        </div>
      `,
      text: `The attendance approval deadline for ${options.month} ${options.year} has expired. Override required.\n\nOverride here: ${options.overrideUrl}${SIGNOFF_TEXT}`,
    };
    await client.send(msg);
    return { success: true };
  } catch (error: any) {
    console.error("sendAttendanceDeadlineExpiredEmail error:", error?.response?.body || error.message);
    return { success: false, error: error.message };
  }
}

export async function sendContractDispatchEmail(options: {
  to: string;
  clientName: string;
  deliveryMethod: "esign_link" | "presigned_pdf" | "both";
  signingUrl?: string;
  refNumber?: string;
  authCode?: string;
  approvedByName: string;
  approvedByEmail: string;
  ccRecipients?: string[];
  pdfBuffer?: Buffer;
  contractDocxBuffer?: Buffer; // actual contract content — attached when available
}) {
  try {
    const { client } = await getUncachableSendGridClient();

    const attachments: any[] = [];
    if (options.pdfBuffer) {
      attachments.push({
        content: options.pdfBuffer.toString("base64"),
        filename: `Contract_${options.clientName.replace(/\s+/g, "_")}_Verification.pdf`,
        type: "application/pdf",
        disposition: "attachment",
      });
    }
    // Attach the original contract DOCX so the recipient receives the full contract text
    if (options.contractDocxBuffer) {
      attachments.push({
        content: options.contractDocxBuffer.toString("base64"),
        filename: `Contract_${options.clientName.replace(/\s+/g, "_")}.docx`,
        type: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        disposition: "attachment",
      });
    }

    const signingSection = options.signingUrl
      ? `<div style="text-align: center; margin: 24px 0;"><a href="${options.signingUrl}" style="display: inline-block; background: #1F3A6E; color: #ffffff; text-decoration: none; padding: 12px 32px; border-radius: 6px; font-weight: 600; font-size: 15px;">Review & Sign Contract</a></div>`
      : "";

    const verifySection = (options.refNumber && options.authCode)
      ? `<div style="background: #f0fdf4; border: 1px solid #bbf7d0; border-radius: 8px; padding: 16px; margin: 16px 0;"><p style="color: #166534; font-weight: 600; margin: 0 0 8px;">Document Verification Details</p><p style="color: #374151; font-size: 13px; margin: 0 0 4px;">Reference: <code style="background: #f3f4f6; padding: 2px 6px; border-radius: 4px;">${options.refNumber}</code></p><p style="color: #374151; font-size: 13px; margin: 0;">Auth Code: <code style="background: #f3f4f6; padding: 2px 6px; border-radius: 4px;">${options.authCode}</code></p><p style="color: #6b7280; font-size: 12px; margin: 8px 0 0;">Verify authenticity at <a href="https://hire-in.com/verify" style="color: #1F3A6E;">hire-in.com/verify</a></p></div>`
      : "";

    const msg: any = {
      to: options.to,
      from: { email: `noreply@hirein.com`, name: options.approvedByName },
      replyTo: { email: options.approvedByEmail, name: options.approvedByName },
      subject: `Staffing Services Agreement — ${options.clientName}`,
      html: `
        <div style="font-family: 'Segoe UI', Arial, sans-serif; max-width: 600px; margin: 0 auto; background: #ffffff;">
          <div style="background: linear-gradient(135deg, #1F3A6E 0%, #2563eb 100%); padding: 32px; text-align: center;">
            <h1 style="color: #ffffff; margin: 0; font-size: 24px; font-weight: 700;">Hire'in Solutions</h1>
            <p style="color: #dbeafe; margin: 8px 0 0; font-size: 14px;">Staffing Services Agreement</p>
          </div>
          <div style="padding: 32px;">
            <h2 style="color: #1e293b; margin: 0 0 16px; font-size: 20px;">Dear ${options.clientName},</h2>
            <p style="color: #475569; line-height: 1.6; margin: 0 0 16px;">
              Please find your Staffing Services Agreement attached${options.signingUrl ? " and the link below to review and sign online" : ""}.
            </p>
            ${signingSection}
            ${verifySection}
            ${SIGNOFF_HTML}
          </div>
          <div style="background: #f8fafc; padding: 20px 32px; text-align: center; border-top: 1px solid #e2e8f0;">
            <p style="color: #94a3b8; font-size: 12px; margin: 0;">&copy; ${new Date().getFullYear()} Hire'in Solutions. All rights reserved.</p>
          </div>
        </div>
      `,
      text: `Dear ${options.clientName},\n\nPlease find your Staffing Services Agreement attached.${options.signingUrl ? `\n\nSign online: ${options.signingUrl}` : ""}${options.refNumber ? `\n\nRef: ${options.refNumber}\nAuth: ${options.authCode}\nVerify at: hire-in.com/verify` : ""}${SIGNOFF_TEXT}`,
      attachments,
    };

    if (options.ccRecipients && options.ccRecipients.length > 0) {
      msg.cc = options.ccRecipients;
    }

    await client.send(msg);
    return { success: true };
  } catch (error: any) {
    console.error("Failed to send contract dispatch email:", error?.response?.body || error.message);
    return { success: false, error: error.message };
  }
}

export async function sendAttendanceApprovalCompleteEmail(options: {
  toEmails: string[];
  month: string;
  year: number;
  overridden: boolean;
  salaryRunUrl: string;
  entrySummary: Array<{ name: string; employeeId: string; presentDays: number; absentDays: number; lopDays: number; leaveDays: number; holidayDays: number; totalHours: number }>;
}) {
  try {
    const { client, fromEmail } = await getUncachableSendGridClient();

    const csvHeader = "Employee ID,Name,Present Days,Absent Days,LOP Days,Leave Days,Holiday Days,Total Hours";
    const csvRows = options.entrySummary.map(e =>
      `${e.employeeId},"${e.name}",${e.presentDays},${e.absentDays},${e.lopDays},${e.leaveDays},${e.holidayDays},${e.totalHours}`
    );
    const csvContent = [csvHeader, ...csvRows].join("\n");
    const csvBase64 = Buffer.from(csvContent).toString("base64");

    const tableRows = options.entrySummary.slice(0, 20).map(e => `
      <tr style="border-bottom:1px solid #e2e8f0;">
        <td style="padding:8px 12px;color:#334155;">${e.employeeId}</td>
        <td style="padding:8px 12px;color:#334155;">${e.name}</td>
        <td style="padding:8px 12px;text-align:center;color:#334155;">${e.presentDays}</td>
        <td style="padding:8px 12px;text-align:center;color:#334155;">${e.absentDays}</td>
        <td style="padding:8px 12px;text-align:center;color:#dc2626;">${e.lopDays}</td>
        <td style="padding:8px 12px;text-align:center;color:#334155;">${e.leaveDays}</td>
        <td style="padding:8px 12px;text-align:center;color:#334155;">${e.totalHours.toFixed(1)}h</td>
      </tr>`).join("");

    const moreRow = options.entrySummary.length > 20
      ? `<tr><td colspan="7" style="padding:8px 12px;color:#94a3b8;font-style:italic;text-align:center;">... and ${options.entrySummary.length - 20} more employees — see attached CSV</td></tr>`
      : "";

    const msg: any = {
      to: options.toEmails,
      from: { email: fromEmail, name: "Hire'in HR" },
      subject: `✅ Attendance ${options.overridden ? "Overridden" : "Approved"} — ${options.month} ${options.year} Salary Run Unlocked`,
      html: `
        <div style="font-family:'Segoe UI',Arial,sans-serif;max-width:680px;margin:0 auto;background:#fff;">
          <div style="background:linear-gradient(135deg,#166534 0%,#16a34a 100%);padding:28px 32px;text-align:center;">
            <h1 style="color:#fff;margin:0;font-size:22px;font-weight:700;">Hire'in Solutions</h1>
            <p style="color:#bbf7d0;margin:8px 0 0;font-size:13px;">Monthly Attendance ${options.overridden ? "Override Applied" : "Approval Complete"}</p>
          </div>
          <div style="padding:32px;">
            <div style="background:#f0fdf4;border:1px solid #bbf7d0;border-radius:8px;padding:16px;margin-bottom:24px;">
              <p style="color:#166534;font-weight:600;margin:0;">✅ Attendance for <strong>${options.month} ${options.year}</strong> has been ${options.overridden ? "overridden by HR" : "approved by all managers"}.</p>
              <p style="color:#15803d;font-size:13px;margin:8px 0 0;">You can now generate the salary run for this month.</p>
            </div>
            <h3 style="color:#1e293b;margin:0 0 12px;font-size:15px;">Attendance Snapshot (${options.entrySummary.length} employees)</h3>
            <table style="width:100%;border-collapse:collapse;font-size:13px;margin-bottom:16px;">
              <thead>
                <tr style="background:#f8fafc;">
                  <th style="padding:8px 12px;text-align:left;color:#64748b;font-weight:600;">Emp ID</th>
                  <th style="padding:8px 12px;text-align:left;color:#64748b;font-weight:600;">Name</th>
                  <th style="padding:8px 12px;text-align:center;color:#64748b;font-weight:600;">Present</th>
                  <th style="padding:8px 12px;text-align:center;color:#64748b;font-weight:600;">Absent</th>
                  <th style="padding:8px 12px;text-align:center;color:#dc2626;font-weight:600;">LOP</th>
                  <th style="padding:8px 12px;text-align:center;color:#64748b;font-weight:600;">Leave</th>
                  <th style="padding:8px 12px;text-align:center;color:#64748b;font-weight:600;">Hours</th>
                </tr>
              </thead>
              <tbody>${tableRows}${moreRow}</tbody>
            </table>
            <p style="color:#64748b;font-size:12px;">Full attendance snapshot attached as CSV.</p>
            <div style="text-align:center;margin:24px 0;">
              <a href="${options.salaryRunUrl}" style="display:inline-block;background:#166534;color:#fff;text-decoration:none;padding:12px 32px;border-radius:6px;font-weight:600;font-size:15px;">Generate Salary Run</a>
            </div>
            ${SIGNOFF_HTML}
          </div>
        </div>
      `,
      text: `Attendance for ${options.month} ${options.year} has been ${options.overridden ? "overridden by HR" : "approved"}. Salary run is now unlocked.\n\nGenerate here: ${options.salaryRunUrl}${SIGNOFF_TEXT}`,
      attachments: [{
        content: csvBase64,
        filename: `attendance_${options.month.toLowerCase()}_${options.year}.csv`,
        type: "text/csv",
        disposition: "attachment",
      }],
    };
    await client.send(msg);
    return { success: true };
  } catch (error: any) {
    console.error("sendAttendanceApprovalCompleteEmail error:", error?.response?.body || error.message);
    return { success: false, error: error.message };
  }
}

const REQUEST_TYPE_DISPLAY: Record<string, string> = {
  missed_punch_in: "Missed Punch In",
  missed_punch_out: "Missed Punch Out",
  wrong_absent: "Wrong Absent Mark",
  correction: "Time Correction",
};

export async function sendRegularizationDecisionEmail(options: {
  to: string;
  employeeName: string;
  attendanceDate: string;
  requestType: string;
  status: "approved" | "rejected";
  reviewerName: string;
  reviewerComment: string;
}) {
  try {
    const { client, fromEmail } = await getUncachableSendGridClient();
    const typeLabel = REQUEST_TYPE_DISPLAY[options.requestType] ?? options.requestType.replace(/_/g, " ");
    const isApproved = options.status === "approved";
    const headerBg = isApproved
      ? "linear-gradient(135deg, #166534 0%, #16a34a 100%)"
      : "linear-gradient(135deg, #7f1d1d 0%, #dc2626 100%)";
    const headerSub = isApproved ? "Attendance Correction Approved" : "Attendance Correction Rejected";
    const statusLabel = isApproved ? "✅ Approved" : "❌ Rejected";

    const msg: any = {
      to: options.to,
      from: { email: fromEmail, name: "Hire'in HR" },
      subject: `Regularization ${isApproved ? "Approved" : "Rejected"} — ${options.attendanceDate}`,
      html: `
        <div style="font-family:'Segoe UI',Arial,sans-serif;max-width:580px;margin:0 auto;background:#fff;">
          <div style="background:${headerBg};padding:28px 32px;text-align:center;">
            <h1 style="color:#fff;margin:0;font-size:22px;font-weight:700;">Hire'in Solutions</h1>
            <p style="color:#e0e7ff;margin:8px 0 0;font-size:13px;">${headerSub}</p>
          </div>
          <div style="padding:28px 32px;">
            <p style="color:#1e293b;font-size:15px;margin:0 0 20px;">Dear ${options.employeeName},</p>
            <div style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:8px;padding:18px;margin-bottom:20px;">
              <table style="width:100%;font-size:14px;border-collapse:collapse;">
                <tr><td style="color:#64748b;padding:4px 0;width:40%;">Date</td><td style="color:#1e293b;font-weight:500;">${options.attendanceDate}</td></tr>
                <tr><td style="color:#64748b;padding:4px 0;">Type</td><td style="color:#1e293b;font-weight:500;">${typeLabel}</td></tr>
                <tr><td style="color:#64748b;padding:4px 0;">Decision</td><td style="font-weight:600;color:${isApproved ? "#166534" : "#7f1d1d"};">${statusLabel}</td></tr>
                <tr><td style="color:#64748b;padding:4px 0;">Reviewed by</td><td style="color:#1e293b;">${options.reviewerName}</td></tr>
              </table>
            </div>
            ${options.reviewerComment ? `
            <div style="background:${isApproved ? "#f0fdf4" : "#fef2f2"};border:1px solid ${isApproved ? "#bbf7d0" : "#fecaca"};border-radius:8px;padding:14px;margin-bottom:20px;">
              <p style="color:${isApproved ? "#166534" : "#7f1d1d"};font-size:13px;font-weight:600;margin:0 0 6px;">Reviewer Note</p>
              <p style="color:#374151;font-size:14px;margin:0;">${options.reviewerComment}</p>
            </div>` : ""}
            <p style="color:#64748b;font-size:13px;">
              ${isApproved
                ? "Your attendance record has been updated to reflect this correction."
                : "Your original attendance record remains unchanged. If you believe this was incorrect, please contact HR."}
            </p>
            ${SIGNOFF_HTML}
          </div>
          <div style="background:#f8fafc;padding:16px 32px;text-align:center;border-top:1px solid #e2e8f0;">
            <p style="color:#94a3b8;font-size:12px;margin:0;">&copy; ${new Date().getFullYear()} Hire'in Solutions. All rights reserved.</p>
          </div>
        </div>
      `,
      text: `Dear ${options.employeeName},\n\nYour regularization request for ${options.attendanceDate} (${typeLabel}) has been ${options.status}.\nReviewed by: ${options.reviewerName}${options.reviewerComment ? `\nNote: ${options.reviewerComment}` : ""}${SIGNOFF_TEXT}`,
    };

    await client.send(msg);
    return { success: true };
  } catch (error: any) {
    console.error("sendRegularizationDecisionEmail error:", error?.response?.body || error.message);
    return { success: false, error: error.message };
  }
}

export async function sendManagerRegularizationDigestEmail(options: {
  to: string;
  managerName: string;
  pendingRequests: Array<{ employeeName: string; attendanceDate: string; requestType: string; submittedAt: string }>;
  reviewUrl: string;
}) {
  try {
    const { client, fromEmail } = await getUncachableSendGridClient();
    const now = new Date();
    const tableRows = options.pendingRequests.slice(0, 20).map(r => {
      const typeLabel = REQUEST_TYPE_DISPLAY[r.requestType] ?? r.requestType.replace(/_/g, " ");
      const submittedDate = new Date(r.submittedAt);
      const daysPending = Math.max(0, Math.floor((now.getTime() - submittedDate.getTime()) / 86400000));
      const daysPendingLabel = daysPending === 0 ? "Today" : daysPending === 1 ? "1 day" : `${daysPending} days`;
      const isUrgent = daysPending >= 3;
      return `<tr style="border-bottom:1px solid #e2e8f0;">
        <td style="padding:8px 12px;color:#1e293b;">${r.employeeName}</td>
        <td style="padding:8px 12px;font-family:monospace;color:#334155;">${r.attendanceDate}</td>
        <td style="padding:8px 12px;color:#334155;">${typeLabel}</td>
        <td style="padding:8px 12px;font-size:12px;color:${isUrgent ? "#dc2626" : "#64748b"};font-weight:${isUrgent ? "600" : "400"};">${daysPendingLabel}</td>
      </tr>`;
    }).join("");

    const moreRow = options.pendingRequests.length > 20
      ? `<tr><td colspan="4" style="padding:8px 12px;color:#94a3b8;font-style:italic;text-align:center;">... and ${options.pendingRequests.length - 20} more — see portal</td></tr>`
      : "";

    const msg: any = {
      to: options.to,
      from: { email: fromEmail, name: "Hire'in HR" },
      subject: `Action Required: ${options.pendingRequests.length} Pending Regularization Request${options.pendingRequests.length === 1 ? "" : "s"} — Month-End`,
      html: `
        <div style="font-family:'Segoe UI',Arial,sans-serif;max-width:640px;margin:0 auto;background:#fff;">
          <div style="background:linear-gradient(135deg,#92400e 0%,#d97706 100%);padding:28px 32px;text-align:center;">
            <h1 style="color:#fff;margin:0;font-size:22px;font-weight:700;">Hire'in Solutions</h1>
            <p style="color:#fef3c7;margin:8px 0 0;font-size:13px;">Month-End Regularization Reminder</p>
          </div>
          <div style="padding:28px 32px;">
            <p style="color:#1e293b;font-size:15px;margin:0 0 12px;">Dear ${options.managerName},</p>
            <div style="background:#fffbeb;border:1px solid #fcd34d;border-radius:8px;padding:16px;margin-bottom:20px;">
              <p style="color:#92400e;font-weight:600;margin:0 0 4px;">⏰ Month-End: Pending Approvals Require Immediate Action</p>
              <p style="color:#78350f;font-size:13px;margin:0;">You have <strong>${options.pendingRequests.length} pending</strong> attendance correction request${options.pendingRequests.length === 1 ? "" : "s"} that must be approved or rejected before the salary run is processed.</p>
            </div>
            <h3 style="color:#1e293b;font-size:14px;margin:0 0 10px;">Pending Requests</h3>
            <table style="width:100%;border-collapse:collapse;font-size:13px;margin-bottom:20px;">
              <thead><tr style="background:#f8fafc;">
                <th style="padding:8px 12px;text-align:left;color:#64748b;font-weight:600;">Employee</th>
                <th style="padding:8px 12px;text-align:left;color:#64748b;font-weight:600;">Date</th>
                <th style="padding:8px 12px;text-align:left;color:#64748b;font-weight:600;">Type</th>
                <th style="padding:8px 12px;text-align:left;color:#64748b;font-weight:600;">Days Pending</th>
              </tr></thead>
              <tbody>${tableRows}${moreRow}</tbody>
            </table>
            <div style="text-align:center;margin:24px 0;">
              <a href="${options.reviewUrl}" style="display:inline-block;background:#d97706;color:#fff;text-decoration:none;padding:12px 32px;border-radius:6px;font-weight:600;font-size:15px;">Review Requests Now</a>
            </div>
            ${SIGNOFF_HTML}
          </div>
        </div>
      `,
      text: `Dear ${options.managerName},\n\nYou have ${options.pendingRequests.length} pending regularization request(s) requiring your review before the salary run.\n\nReview here: ${options.reviewUrl}${SIGNOFF_TEXT}`,
    };

    await client.send(msg);
    return { success: true };
  } catch (error: any) {
    console.error("sendManagerRegularizationDigestEmail error:", error?.response?.body || error.message);
    return { success: false, error: error.message };
  }
}

export interface AnnouncementBlock {
  icon: string;
  title: string;
  body: string;
  cta_label: string;
  cta_path: string;
}

export interface AnnouncementContent {
  title: string;
  subtitle: string;
  blocks: AnnouncementBlock[];
}

const ICON_EMOJI: Record<string, string> = {
  star: "⭐",
  message: "💬",
  clock: "🕐",
  bell: "🔔",
  heart: "❤️",
  award: "🏆",
};

export async function sendWhatsNewEmail(options: {
  employees: Array<{ email: string; firstName: string }>;
  content: AnnouncementContent;
  portalUrl?: string;
}): Promise<{ sent: number; failed: number }> {
  const { client, fromEmail } = await getUncachableSendGridClient();
  const portalUrl = options.portalUrl || "https://hire-in.com/admin/hr";
  let sent = 0;
  let failed = 0;

  const blockCards = options.content.blocks.map((block) => {
    const emoji = ICON_EMOJI[block.icon] || "✨";
    const ctaUrl = block.cta_path.startsWith("http") ? block.cta_path : `https://hire-in.com${block.cta_path}`;
    return `
      <div style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:10px;padding:20px 24px;margin:0 0 16px;">
        <div style="display:flex;align-items:flex-start;gap:12px;">
          <span style="font-size:22px;line-height:1;">${emoji}</span>
          <div style="flex:1;">
            <p style="color:#1e293b;font-weight:700;font-size:15px;margin:0 0 6px;">${block.title}</p>
            <p style="color:#475569;font-size:14px;line-height:1.6;margin:0 0 14px;">${block.body}</p>
            <a href="${ctaUrl}" style="display:inline-block;background:#1e40af;color:#ffffff;text-decoration:none;padding:8px 20px;border-radius:6px;font-weight:600;font-size:13px;">${block.cta_label}</a>
          </div>
        </div>
      </div>`;
  }).join("");

  for (const emp of options.employees) {
    try {
      const msg = {
        to: emp.email,
        from: { email: fromEmail, name: "Alina Carter" },
        subject: `${options.content.title} — Hire'in Solutions`,
        html: `
          <div style="font-family:'Segoe UI',Arial,sans-serif;max-width:600px;margin:0 auto;background:#ffffff;">
            <div style="background:linear-gradient(135deg,#1e40af 0%,#3b82f6 100%);padding:32px;text-align:center;">
              <h1 style="color:#ffffff;margin:0;font-size:24px;font-weight:700;">Hire'in Solutions</h1>
              <p style="color:#dbeafe;margin:8px 0 0;font-size:14px;">Employee Portal</p>
            </div>
            <div style="padding:32px;">
              <h2 style="color:#1e293b;margin:0 0 4px;font-size:22px;font-weight:700;">${options.content.title}</h2>
              <p style="color:#64748b;margin:0 0 24px;font-size:15px;">${options.content.subtitle}</p>
              <p style="color:#1e293b;margin:0 0 20px;font-size:15px;">Hi ${emp.firstName},</p>
              <p style="color:#475569;margin:0 0 24px;font-size:14px;line-height:1.6;">We've made some updates to the Hire'in portal that are worth exploring. Here's a quick look at what's new:</p>
              ${blockCards}
              <div style="text-align:center;margin:28px 0 8px;">
                <a href="${portalUrl}" style="display:inline-block;background:#1e40af;color:#ffffff;text-decoration:none;padding:13px 36px;border-radius:6px;font-weight:600;font-size:15px;">Open My Portal</a>
              </div>
              ${SIGNOFF_HTML}
            </div>
            <div style="background:#f8fafc;padding:20px 32px;text-align:center;border-top:1px solid #e2e8f0;">
              <p style="color:#94a3b8;font-size:12px;margin:0;">&copy; ${new Date().getFullYear()} Hire'in Solutions (Rayomind Solutions LLP). All rights reserved.</p>
            </div>
          </div>`,
        text: `Hi ${emp.firstName},\n\n${options.content.title}\n${options.content.subtitle}\n\n${options.content.blocks.map(b => `${b.title}\n${b.body}\n${b.cta_label}: https://hire-in.com${b.cta_path}`).join("\n\n")}\n\nOpen your portal: ${portalUrl}${SIGNOFF_TEXT}`,
      };
      await client.send(msg);
      sent++;
    } catch (error: any) {
      console.error(`sendWhatsNewEmail failed for ${emp.email}:`, error?.response?.body || error.message);
      failed++;
    }
  }

  return { sent, failed };
}

export async function sendStudioPublishedEmail(options: {
  to: string;
  recipientName: string;
  articleTitle: string;
  projectName?: string | null;
  scheduledFor?: string | null;
  publishedAt?: string | null;
  publishedByName?: string | null;
}) {
  try {
    const { client, fromEmail } = await getUncachableSendGridClient();
    const isScheduled = !!options.scheduledFor;
    const headline = isScheduled ? "Article Scheduled" : "Article Published";
    const detailRow = (label: string, value?: string | null) =>
      value
        ? `<tr><td style="color:#64748b;padding:6px 0;width:140px;">${label}:</td><td style="color:#1e293b;font-weight:500;padding:6px 0;">${value}</td></tr>`
        : "";
    const msg = {
      to: options.to,
      from: { email: fromEmail, name: "Alina Carter" },
      subject: `${isScheduled ? "Scheduled" : "Published"}: ${options.articleTitle}`,
      html: `
        <div style="font-family: 'Segoe UI', Arial, sans-serif; max-width: 600px; margin: 0 auto; background: #ffffff;">
          <div style="background: linear-gradient(135deg, #1F3A6E 0%, #F47C20 100%); padding: 32px; text-align: center;">
            <h1 style="color: #ffffff; margin: 0; font-size: 24px; font-weight: 700;">Hire'in Content Studio</h1>
            <p style="color: #e2e8f0; margin: 8px 0 0; font-size: 14px;">${headline}</p>
          </div>
          <div style="padding: 32px;">
            <h2 style="color: #1e293b; margin: 0 0 16px; font-size: 20px;">Hi ${options.recipientName},</h2>
            <p style="color: #475569; line-height: 1.6; margin: 0 0 16px;">
              ${isScheduled
                ? `<strong>${options.articleTitle}</strong> has received final sign-off and is scheduled to go live.`
                : `<strong>${options.articleTitle}</strong> has received final sign-off and is now published.`}
            </p>
            <div style="background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 20px; margin: 24px 0;">
              <table style="width: 100%; border-collapse: collapse;">
                ${detailRow("Project", options.projectName)}
                ${detailRow("Scheduled for", options.scheduledFor)}
                ${detailRow("Published at", options.publishedAt)}
                ${detailRow("Signed off by", options.publishedByName)}
              </table>
            </div>
            ${SIGNOFF_HTML}
          </div>
          <div style="background: #f8fafc; padding: 20px 32px; text-align: center; border-top: 1px solid #e2e8f0;">
            <p style="color: #94a3b8; font-size: 12px; margin: 0;">
              &copy; ${new Date().getFullYear()} Hire'in Solutions (Rayomind Solutions LLP). All rights reserved.
            </p>
          </div>
        </div>
      `,
      text: `Hi ${options.recipientName},\n\n${options.articleTitle} has received final sign-off and is ${isScheduled ? "scheduled to go live" : "now published"}.\n\n${options.projectName ? `Project: ${options.projectName}\n` : ""}${options.scheduledFor ? `Scheduled for: ${options.scheduledFor}\n` : ""}${options.publishedAt ? `Published at: ${options.publishedAt}\n` : ""}${options.publishedByName ? `Signed off by: ${options.publishedByName}\n` : ""}${SIGNOFF_TEXT}`,
    };
    await client.send(msg);
    console.log(`Studio published email sent to ${options.to}`);
    return { success: true };
  } catch (error: any) {
    console.error("Failed to send studio published email:", error?.response?.body || error.message);
    return { success: false, error: error.message };
  }
}

export async function sendStudioRejectionEmail(options: {
  to: string;
  recipientName: string;
  articleTitle: string;
  stage: "marketing" | "final";
  reason: string;
  rejectedByName?: string | null;
  editUrl?: string | null;
}) {
  try {
    const { client, fromEmail } = await getUncachableSendGridClient();
    const stageLabel = options.stage === "final" ? "final sign-off" : "marketing review";
    const msg = {
      to: options.to,
      from: { email: fromEmail, name: "Alina Carter" },
      subject: `Changes requested: ${options.articleTitle}`,
      html: `
        <div style="font-family: 'Segoe UI', Arial, sans-serif; max-width: 600px; margin: 0 auto; background: #ffffff;">
          <div style="background: linear-gradient(135deg, #1F3A6E 0%, #F47C20 100%); padding: 32px; text-align: center;">
            <h1 style="color: #ffffff; margin: 0; font-size: 24px; font-weight: 700;">Hire'in Content Studio</h1>
            <p style="color: #e2e8f0; margin: 8px 0 0; font-size: 14px;">Sent Back for Changes</p>
          </div>
          <div style="padding: 32px;">
            <h2 style="color: #1e293b; margin: 0 0 16px; font-size: 20px;">Hi ${options.recipientName},</h2>
            <p style="color: #475569; line-height: 1.6; margin: 0 0 16px;">
              <strong>${options.articleTitle}</strong> was sent back to draft during ${stageLabel}${options.rejectedByName ? ` by ${options.rejectedByName}` : ""}.
            </p>
            <div style="background: #fef2f2; border: 1px solid #fecaca; border-radius: 8px; padding: 20px; margin: 24px 0;">
              <p style="color: #991b1b; font-weight: 600; margin: 0 0 8px;">Reason</p>
              <p style="color: #7f1d1d; line-height: 1.6; margin: 0;">${options.reason}</p>
            </div>
            ${options.editUrl ? `<div style="text-align: center; margin: 24px 0;">
              <a href="${options.editUrl}" style="display: inline-block; background: #1F3A6E; color: #ffffff; text-decoration: none; padding: 12px 32px; border-radius: 6px; font-weight: 600; font-size: 15px;">
                Open Article
              </a>
            </div>` : ""}
            ${SIGNOFF_HTML}
          </div>
          <div style="background: #f8fafc; padding: 20px 32px; text-align: center; border-top: 1px solid #e2e8f0;">
            <p style="color: #94a3b8; font-size: 12px; margin: 0;">
              &copy; ${new Date().getFullYear()} Hire'in Solutions (Rayomind Solutions LLP). All rights reserved.
            </p>
          </div>
        </div>
      `,
      text: `Hi ${options.recipientName},\n\n${options.articleTitle} was sent back to draft during ${stageLabel}${options.rejectedByName ? ` by ${options.rejectedByName}` : ""}.\n\nReason: ${options.reason}\n${options.editUrl ? `\nOpen article: ${options.editUrl}\n` : ""}${SIGNOFF_TEXT}`,
    };
    await client.send(msg);
    console.log(`Studio rejection email sent to ${options.to}`);
    return { success: true };
  } catch (error: any) {
    console.error("Failed to send studio rejection email:", error?.response?.body || error.message);
    return { success: false, error: error.message };
  }
}

// ===========================================================================
// Newsletter (Hire'in Insights) — subscribe welcome + new-content notification
// ===========================================================================

// Shared transparency + unsubscribe footer used by every newsletter email
// (legal requirement: state why they get it + a one-click unsubscribe link).
function newsletterFooterHtml(email: string, unsubscribeUrl: string) {
  return `
          <div style="background: #f8fafc; padding: 24px 32px; text-align: center; border-top: 1px solid #e2e8f0;">
            <p style="color: #64748b; font-size: 12px; line-height: 1.6; margin: 0 0 8px;">
              You're receiving this because you subscribed to Hire'in Insights as
              <span style="color: #1F3A6E; font-weight: 600;">${email}</span>.
            </p>
            <p style="color: #94a3b8; font-size: 12px; margin: 0 0 8px;">
              <a href="${unsubscribeUrl}" style="color: #F47C20; text-decoration: underline;">Unsubscribe</a>
              from these emails at any time.
            </p>
            <p style="color: #94a3b8; font-size: 12px; margin: 0;">
              &copy; ${new Date().getFullYear()} Hire'in Solutions (Rayomind Solutions LLP). All rights reserved.
            </p>
          </div>`;
}

function newsletterFooterText(email: string, unsubscribeUrl: string) {
  return `\n\nYou're receiving this because you subscribed to Hire'in Insights as ${email}.\nUnsubscribe at any time: ${unsubscribeUrl}\n\n© ${new Date().getFullYear()} Hire'in Solutions (Rayomind Solutions LLP).`;
}

export async function sendNewsletterWelcomeEmail(options: {
  to: string;
  unsubscribeUrl: string;
  insightsUrl: string;
}) {
  try {
    const { client, fromEmail } = await getUncachableSendGridClient();
    const msg = {
      to: options.to,
      from: { email: fromEmail, name: "Hire'in Insights" },
      subject: "You're subscribed to Hire'in Insights",
      html: `
        <div style="font-family: 'Inter', 'Segoe UI', Arial, sans-serif; max-width: 600px; margin: 0 auto; background: #ffffff;">
          <div style="background: linear-gradient(135deg, #1F3A6E 0%, #F47C20 100%); padding: 36px 32px; text-align: center;">
            <h1 style="color: #ffffff; margin: 0; font-size: 26px; font-weight: 700; font-family: 'Playfair Display', Georgia, serif;">Hire'in Insights</h1>
            <p style="color: #e2e8f0; margin: 10px 0 0; font-size: 14px;">Welcome aboard</p>
          </div>
          <div style="padding: 32px;">
            <h2 style="color: #1e293b; margin: 0 0 16px; font-size: 20px;">You're subscribed!</h2>
            <p style="color: #475569; line-height: 1.7; margin: 0 0 16px;">
              Thanks for subscribing to <strong>Hire'in Insights</strong>. You'll now get a short email
              whenever we publish a new article on staffing, hiring, and recruitment — no spam, just the
              ideas worth your time.
            </p>
            <p style="color: #475569; line-height: 1.7; margin: 0 0 24px;">
              In the meantime, explore what we've already published.
            </p>
            <div style="text-align: center; margin: 8px 0 8px;">
              <a href="${options.insightsUrl}" style="display: inline-block; background: #1F3A6E; color: #ffffff; text-decoration: none; padding: 12px 32px; border-radius: 6px; font-weight: 600; font-size: 15px;">
                Browse Insights
              </a>
            </div>
          </div>
          ${newsletterFooterHtml(options.to, options.unsubscribeUrl)}
        </div>
      `,
      text: `You're subscribed!\n\nThanks for subscribing to Hire'in Insights. You'll now get a short email whenever we publish a new article on staffing, hiring, and recruitment.\n\nBrowse Insights: ${options.insightsUrl}${newsletterFooterText(options.to, options.unsubscribeUrl)}`,
    };
    await client.send(msg);
    console.log(`Newsletter welcome email sent to ${options.to}`);
    return { success: true };
  } catch (error: any) {
    console.error("Failed to send newsletter welcome email:", error?.response?.body || error.message);
    return { success: false, error: error.message };
  }
}

export async function sendNewsletterNotificationEmail(options: {
  to: string;
  unsubscribeUrl: string;
  articleTitle: string;
  articleExcerpt?: string | null;
  articleImageUrl?: string | null;
  articleUrl: string;
}) {
  try {
    const { client, fromEmail } = await getUncachableSendGridClient();
    const image = options.articleImageUrl
      ? `<img src="${options.articleImageUrl}" alt="${options.articleTitle}" style="width: 100%; max-width: 536px; border-radius: 10px; display: block; margin: 0 0 20px;" />`
      : "";
    const excerpt = options.articleExcerpt
      ? `<p style="color: #475569; line-height: 1.7; margin: 0 0 24px; font-size: 15px;">${options.articleExcerpt}</p>`
      : "";
    const msg = {
      to: options.to,
      from: { email: fromEmail, name: "Hire'in Insights" },
      subject: `New on Hire'in Insights: ${options.articleTitle}`,
      html: `
        <div style="font-family: 'Inter', 'Segoe UI', Arial, sans-serif; max-width: 600px; margin: 0 auto; background: #ffffff;">
          <div style="background: linear-gradient(135deg, #1F3A6E 0%, #F47C20 100%); padding: 28px 32px; text-align: center;">
            <h1 style="color: #ffffff; margin: 0; font-size: 22px; font-weight: 700; font-family: 'Playfair Display', Georgia, serif;">Hire'in Insights</h1>
            <p style="color: #e2e8f0; margin: 8px 0 0; font-size: 13px;">New article published</p>
          </div>
          <div style="padding: 32px;">
            ${image}
            <h2 style="color: #1e293b; margin: 0 0 14px; font-size: 22px; line-height: 1.3; font-family: 'Playfair Display', Georgia, serif;">${options.articleTitle}</h2>
            ${excerpt}
            <div style="text-align: center; margin: 8px 0 8px;">
              <a href="${options.articleUrl}" style="display: inline-block; background: #F47C20; color: #ffffff; text-decoration: none; padding: 13px 36px; border-radius: 6px; font-weight: 600; font-size: 15px;">
                Read the article
              </a>
            </div>
          </div>
          ${newsletterFooterHtml(options.to, options.unsubscribeUrl)}
        </div>
      `,
      text: `New on Hire'in Insights: ${options.articleTitle}\n\n${options.articleExcerpt ? options.articleExcerpt + "\n\n" : ""}Read the article: ${options.articleUrl}${newsletterFooterText(options.to, options.unsubscribeUrl)}`,
    };
    await client.send(msg);
    console.log(`Newsletter notification email sent to ${options.to}`);
    return { success: true };
  } catch (error: any) {
    console.error("Failed to send newsletter notification email:", error?.response?.body || error.message);
    return { success: false, error: error.message };
  }
}
