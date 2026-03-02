import cron from "node-cron";
import { generateMonthlySalaryReport } from "./salaryReport";
import { sendSalaryReport } from "./email";
import { storage } from "./storage";

function isLastDayOfMonth(): boolean {
  const today = new Date();
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);
  return tomorrow.getDate() === 1;
}

export function startScheduler() {
  cron.schedule("0 18 28-31 * *", async () => {
    if (!isLastDayOfMonth()) {
      console.log("[scheduler] Not the last day of the month, skipping salary report.");
      return;
    }

    console.log("[scheduler] Last day of month detected. Generating salary report...");
    try {
      const now = new Date();
      const year = now.getFullYear();
      const month = now.getMonth() + 1;

      const report = await generateMonthlySalaryReport(year, month);
      console.log(`[scheduler] Report generated: ${report.summary.totalEmployees} employees, $${report.summary.totalPayable} total payable.`);

      const recipientsSetting = await storage.getSystemSetting("salary_report_recipients");
      const recipients = recipientsSetting?.value as { to: string[]; cc: string[] } | undefined;

      const emailResult = await sendSalaryReport({
        csvContent: report.csv,
        summary: report.summary,
        recipients,
      });

      if (emailResult.success) {
        console.log("[scheduler] Salary report email sent successfully.");
      } else {
        console.error("[scheduler] Failed to send salary report email:", emailResult.error);
      }
    } catch (error) {
      console.error("[scheduler] Error generating/sending salary report:", error);
    }
  }, {
    timezone: "America/Chicago",
  });

  console.log("[scheduler] Monthly salary report cron job scheduled (last day of month at 6 PM CST).");
}
