/**
 * Contract Template Seeder — 22nd Century Healthcare LLC
 *
 * Idempotent seeder that:
 *  1. Upserts "22nd Century Healthcare LLC" into contract_clients
 *  2. Generates the SSA DOCX template buffer using the docx package
 *  3. Uploads to object storage
 *  4. Inserts contract_templates with is_default = true
 *
 * Called from app startup and post-merge script. Gracefully no-ops if
 * object storage is unavailable.
 */

import { db } from "./db";
import { contractClients, contractTemplates } from "@shared/schema";
import { eq, and } from "drizzle-orm";
import { ObjectStorageService } from "./replit_integrations/object_storage/objectStorage";
import {
  Document, Paragraph, Table, TableRow, TableCell, TextRun, HeadingLevel,
  AlignmentType, WidthType, BorderStyle, Packer, PageOrientation,
  convertInchesToTwip, TableLayoutType,
} from "docx";

const objectStorageService = new ObjectStorageService();

const CLIENT_NAME = "22nd Century Healthcare LLC";
const TEMPLATE_NAME = "22nd Century Healthcare — SSA";

// ─── Generate SSA DOCX buffer ─────────────────────────────────────────────────
async function generateSsaDocxBuffer(): Promise<Buffer> {
  const headerBorder = {
    top: { style: BorderStyle.SINGLE, size: 6, color: "1F3A6E" },
    bottom: { style: BorderStyle.SINGLE, size: 6, color: "1F3A6E" },
    left: { style: BorderStyle.SINGLE, size: 6, color: "1F3A6E" },
    right: { style: BorderStyle.SINGLE, size: 6, color: "1F3A6E" },
  };
  const cellBorder = {
    top: { style: BorderStyle.SINGLE, size: 1, color: "CCCCCC" },
    bottom: { style: BorderStyle.SINGLE, size: 1, color: "CCCCCC" },
    left: { style: BorderStyle.SINGLE, size: 1, color: "CCCCCC" },
    right: { style: BorderStyle.SINGLE, size: 1, color: "CCCCCC" },
  };

  const p = (text: string, opts?: { bold?: boolean; size?: number; alignment?: (typeof AlignmentType)[keyof typeof AlignmentType]; color?: string; spacingBefore?: number; spacingAfter?: number }) =>
    new Paragraph({
      alignment: opts?.alignment ?? AlignmentType.LEFT,
      spacing: { before: opts?.spacingBefore ?? 0, after: opts?.spacingAfter ?? 120 },
      children: [
        new TextRun({
          text,
          bold: opts?.bold ?? false,
          size: opts?.size ?? 22,
          color: opts?.color ?? "222222",
        }),
      ],
    });

  const candidateTable = new Table({
    layout: TableLayoutType.FIXED,
    width: { size: 100, type: WidthType.PERCENTAGE },
    rows: [
      // Header row
      new TableRow({
        tableHeader: true,
        children: [
          new TableCell({
            borders: headerBorder,
            shading: { fill: "1F3A6E" },
            children: [new Paragraph({ children: [new TextRun({ text: "Candidate Name", bold: true, color: "FFFFFF", size: 18 })] })],
          }),
          new TableCell({
            borders: headerBorder,
            shading: { fill: "1F3A6E" },
            children: [new Paragraph({ children: [new TextRun({ text: "Role / Title", bold: true, color: "FFFFFF", size: 18 })] })],
          }),
          new TableCell({
            borders: headerBorder,
            shading: { fill: "1F3A6E" },
            children: [new Paragraph({ children: [new TextRun({ text: "Start Date", bold: true, color: "FFFFFF", size: 18 })] })],
          }),
          new TableCell({
            borders: headerBorder,
            shading: { fill: "1F3A6E" },
            children: [new Paragraph({ children: [new TextRun({ text: "Location", bold: true, color: "FFFFFF", size: 18 })] })],
          }),
          new TableCell({
            borders: headerBorder,
            shading: { fill: "1F3A6E" },
            children: [new Paragraph({ children: [new TextRun({ text: "Engagement Type", bold: true, color: "FFFFFF", size: 18 })] })],
          }),
          new TableCell({
            borders: headerBorder,
            shading: { fill: "1F3A6E" },
            children: [new Paragraph({ children: [new TextRun({ text: "Hire'in Fee", bold: true, color: "FFFFFF", size: 18 })] })],
          }),
        ],
      }),
      // Loop row: {{#candidates}}...{{/candidates}} — docxtemplater loops the entire row
      new TableRow({
        children: [
          new TableCell({
            borders: cellBorder,
            children: [new Paragraph({ children: [new TextRun({ text: "{{#candidates}}{{name}}", size: 20 })] })],
          }),
          new TableCell({
            borders: cellBorder,
            children: [new Paragraph({ children: [new TextRun({ text: "{{role}}", size: 20 })] })],
          }),
          new TableCell({
            borders: cellBorder,
            children: [new Paragraph({ children: [new TextRun({ text: "{{startDate}}", size: 20 })] })],
          }),
          new TableCell({
            borders: cellBorder,
            children: [new Paragraph({ children: [new TextRun({ text: "{{location}}", size: 20 })] })],
          }),
          new TableCell({
            borders: cellBorder,
            children: [new Paragraph({ children: [new TextRun({ text: "{{engagementType}}", size: 20 })] })],
          }),
          new TableCell({
            borders: cellBorder,
            children: [new Paragraph({ children: [new TextRun({ text: "{{hiresInFee}}{{/candidates}}", size: 20 })] })],
          }),
        ],
      }),
    ],
  });

  const doc = new Document({
    sections: [
      {
        properties: {},
        children: [
          // Title
          new Paragraph({
            alignment: AlignmentType.CENTER,
            spacing: { before: 0, after: 200 },
            children: [
              new TextRun({ text: "STAFFING SERVICES AGREEMENT", bold: true, size: 32, color: "1F3A6E" }),
            ],
          }),
          new Paragraph({
            alignment: AlignmentType.CENTER,
            spacing: { before: 0, after: 400 },
            children: [
              new TextRun({ text: "This Staffing Services Agreement (the \"Agreement\") is entered into as of ", size: 22 }),
              new TextRun({ text: "{{agreement_date}}", bold: true, size: 22 }),
              new TextRun({ text: " (\"Effective Date\") between:", size: 22 }),
            ],
          }),

          // Parties
          p("Client: {{client_name}}", { bold: true }),
          p("Address: {{client_address}}", {}),
          p(""),
          p("Sub-Contractor: {{subcontractor_name}}", { bold: true }),
          p("Address: {{subcontractor_address}}", {}),
          p(""),
          p("(collectively, the \"Parties\")", { spacingAfter: 300 }),

          // Section 1 — Services
          p("1.  SCOPE OF SERVICES", { bold: true, color: "1F3A6E", spacingBefore: 200, spacingAfter: 160 }),
          p("1.1  Sub-Contractor agrees to provide staffing and placement services to Client, including sourcing, screening, and presenting qualified candidates for temporary, contract-to-hire, and permanent positions as mutually agreed upon by the Parties."),
          p("1.2  Sub-Contractor shall provide candidates who meet the qualifications, skills, and experience requirements specified by Client for each engagement."),
          p("1.3  All candidate engagements shall be governed by this Agreement unless the Parties execute a separate Statement of Work (SOW) for a specific engagement."),
          p(""),

          // Section 2 — Candidate Schedule (TABLE)
          p("2.  CANDIDATE SCHEDULE", { bold: true, color: "1F3A6E", spacingBefore: 200, spacingAfter: 160 }),
          p("The following candidates are engaged under this Agreement. Hire'in fees are as specified per candidate below:"),
          candidateTable,
          p(""),

          // Section 3 — Representations and Warranties
          p("3.  REPRESENTATIONS AND WARRANTIES", { bold: true, color: "1F3A6E", spacingBefore: 200, spacingAfter: 160 }),
          p("3.1  Sub-Contractor represents and warrants that all candidates presented shall have the qualifications, certifications, and authorisations required for the applicable role."),
          p("3.2  Sub-Contractor shall conduct background verification and skills assessment as agreed between the Parties prior to presentation of any candidate."),
          p("3.3  Client shall ensure that all engagements comply with applicable employment, immigration, and healthcare regulations."),
          p(""),

          // Section 4 — Fees and Payment
          p("4.  FEES AND PAYMENT", { bold: true, color: "1F3A6E", spacingBefore: 200, spacingAfter: 160 }),
          p("4.1  The Hire'in fee per candidate is as specified in Section 2 above."),
          new Paragraph({
            spacing: { before: 0, after: 120 },
            children: [
              new TextRun({ text: "4.2  Sub-Contractor shall submit invoices on a ", size: 22 }),
              new TextRun({ text: "{{billing_frequency}}", bold: true, size: 22 }),
              new TextRun({ text: " basis in accordance with the candidate placements and services rendered during such period.", size: 22 }),
            ],
          }),
          new Paragraph({
            spacing: { before: 0, after: 120 },
            children: [
              new TextRun({ text: "4.3  Payments within ", size: 22 }),
              new TextRun({ text: "{{payment_terms_days}}", bold: true, size: 22 }),
              new TextRun({ text: " days of receipt of an undisputed invoice.", size: 22 }),
            ],
          }),
          p("4.4  All fees are exclusive of applicable taxes unless otherwise stated. Client shall bear all taxes, levies, and charges imposed on services under this Agreement."),
          p(""),

          // Section 5 — Confidentiality
          p("5.  CONFIDENTIALITY", { bold: true, color: "1F3A6E", spacingBefore: 200, spacingAfter: 160 }),
          p("5.1  Each Party agrees to keep confidential all non-public information disclosed by the other Party in connection with this Agreement, including but not limited to candidate information, client requirements, pay rates, and business processes."),
          p("5.2  The confidentiality obligations under this Section shall survive the termination of this Agreement for a period of three (3) years."),
          p(""),

          // Section 6 — Non-Solicitation
          p("6.  NON-SOLICITATION", { bold: true, color: "1F3A6E", spacingBefore: 200, spacingAfter: 160 }),
          p("6.1  During the term of this Agreement and for a period of twelve (12) months thereafter, Client agrees not to directly solicit, recruit, hire, or engage any candidate introduced by Sub-Contractor without prior written consent."),
          p("6.2  Any breach of this clause shall entitle Sub-Contractor to a conversion fee equal to twenty-five percent (25%) of the candidate's first-year compensation."),
          p(""),

          // Section 7 — Term and Termination
          p("7.  TERM AND TERMINATION", { bold: true, color: "1F3A6E", spacingBefore: 200, spacingAfter: 160 }),
          p("7.1  This Agreement shall commence on the Effective Date and continue until terminated by either Party upon thirty (30) days' written notice."),
          p("7.2  Either Party may terminate this Agreement immediately upon written notice if the other Party materially breaches any provision of this Agreement and such breach remains uncured for fifteen (15) days after written notice thereof."),
          p(""),

          // Section 8 — Governing Law
          p("8.  GOVERNING LAW", { bold: true, color: "1F3A6E", spacingBefore: 200, spacingAfter: 160 }),
          p("This Agreement shall be governed by and construed in accordance with the laws of the State of New Jersey, United States of America, without regard to its conflict of law provisions."),
          p(""),

          // Section 9 — Entire Agreement
          p("9.  ENTIRE AGREEMENT", { bold: true, color: "1F3A6E", spacingBefore: 200, spacingAfter: 160 }),
          p("This Agreement constitutes the entire agreement between the Parties with respect to the subject matter hereof and supersedes all prior negotiations, understandings, and agreements between the Parties relating to such subject matter."),
          p(""),

          // Signatures
          p("IN WITNESS WHEREOF, the Parties have executed this Agreement as of the date first written above.", { spacingBefore: 300 }),
          p(""),
          new Paragraph({
            spacing: { before: 400, after: 120 },
            children: [
              new TextRun({ text: "FOR CLIENT:", bold: true, size: 22, color: "1F3A6E" }),
            ],
          }),
          p("Signature: ___________________________"),
          p("Name: {{client_signatory_name}}"),
          p("Title: {{client_signatory_title}}"),
          p("Date: ___________________________"),
          p(""),
          new Paragraph({
            spacing: { before: 400, after: 120 },
            children: [
              new TextRun({ text: "FOR SUB-CONTRACTOR (Hire'in Solutions):", bold: true, size: 22, color: "1F3A6E" }),
            ],
          }),
          p("Signature: ___________________________"),
          p("Name: {{subcontractor_name}}"),
          p("Title: Authorised Signatory"),
          p("Date: ___________________________"),
        ],
      },
    ],
  });

  return Buffer.from(await Packer.toBuffer(doc));
}

// ─── Idempotent seeder ────────────────────────────────────────────────────────
export async function seedContractTemplates(): Promise<{ created: boolean; skipped: boolean; error?: string }> {
  try {
    // Check if template already exists
    const existing = await db.select({ id: contractTemplates.id })
      .from(contractTemplates)
      .where(eq(contractTemplates.name, TEMPLATE_NAME))
      .limit(1);

    if (existing.length > 0) {
      return { created: false, skipped: true };
    }

    // Upsert 22nd Century Healthcare LLC client
    let clientId: string;
    const existingClient = await db.select({ id: contractClients.id })
      .from(contractClients)
      .where(eq(contractClients.name, CLIENT_NAME))
      .limit(1);

    if (existingClient.length > 0) {
      clientId = existingClient[0].id;
    } else {
      const [newClient] = await db.insert(contractClients).values({
        name: CLIENT_NAME,
        address: "22nd Century Healthcare LLC\nUnited States",
        signatoryName: "",
        signatoryTitle: "",
        isActive: true,
      }).returning({ id: contractClients.id });
      clientId = newClient.id;
    }

    // Generate DOCX buffer
    const docxBuffer = await generateSsaDocxBuffer();

    // Upload to object storage
    const filePath = await objectStorageService.uploadBuffer(
      docxBuffer,
      `.private/contract-templates/22nd_century_ssa_${Date.now()}.docx`,
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
    );

    // Extract placeholders from the generated DOCX
    const { extractPlaceholders } = await import("./contractTemplateEngine");
    const placeholders = extractPlaceholders(docxBuffer);

    // Insert template
    await db.insert(contractTemplates).values({
      name: TEMPLATE_NAME,
      description: "Standard Staffing Services Agreement for 22nd Century Healthcare LLC. Includes candidate schedule table with Hire'in fees, configurable billing frequency and payment terms.",
      filePath,
      placeholderList: placeholders as any,
      clientId,
      isDefault: true,
    } as any);

    console.log(`[contractTemplateSeed] Created 22nd Century Healthcare SSA template (client: ${clientId})`);
    return { created: true, skipped: false };
  } catch (err: any) {
    // Graceful no-op if object storage is unavailable
    if (err.message?.includes("storage") || err.message?.includes("bucket") || err.message?.includes("403") || err.message?.includes("404")) {
      console.warn("[contractTemplateSeed] Object storage unavailable — skipping seeder:", err.message);
      return { created: false, skipped: true, error: err.message };
    }
    console.error("[contractTemplateSeed] Seeder failed:", err);
    return { created: false, skipped: false, error: err.message };
  }
}

// ── CLI entry point ──────────────────────────────────────────────────────────
// Allows post-merge.sh to invoke the seeder directly:
//   npx tsx server/contractTemplateSeed.ts
const isMainModule = process.argv[1] && (
  process.argv[1].endsWith("contractTemplateSeed.ts") ||
  process.argv[1].endsWith("contractTemplateSeed.js")
);
if (isMainModule) {
  seedContractTemplates()
    .then(result => {
      console.log("[contractTemplateSeed] CLI result:", result);
      process.exit(0);
    })
    .catch(err => {
      console.error("[contractTemplateSeed] CLI error:", err);
      process.exit(0); // non-fatal — startup will retry
    });
}
