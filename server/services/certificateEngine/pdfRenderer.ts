import { getBrowser } from "../../cardGenerationService";

export interface CertificateRenderInput {
  html: string;
}

export async function renderCertificatePdf(input: CertificateRenderInput): Promise<Buffer> {
  const browser = await getBrowser();
  const page = await browser.newPage();
  try {
    await page.setContent(input.html, { waitUntil: "networkidle0" as any, timeout: 30000 });
    try {
      await page.evaluate(() => (document as any).fonts?.ready);
    } catch {
      // ignore font-loading errors
    }
    const buffer = await page.pdf({
      width: "11in",
      height: "8.5in",
      landscape: false,
      printBackground: true,
      margin: { top: "0mm", right: "0mm", bottom: "0mm", left: "0mm" },
    });
    return Buffer.from(buffer);
  } finally {
    await page.close();
  }
}
