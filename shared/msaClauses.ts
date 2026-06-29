// Standard Master Services Agreement (MSA) clauses used as editable seeds in the
// freeform MSA builder. These are pre-written defaults — every field remains fully
// editable in the UI before generation.

export interface MsaClause {
  key: string;
  title: string;
  body: string;
}

export function buildGoverningLawClause(city: string, state: string, country: string): string {
  const parts = [city, state, country].map(p => (p || "").trim()).filter(Boolean);
  const jurisdiction = parts.length > 0 ? parts.join(", ") : "the agreed jurisdiction";
  return `This Agreement shall be governed by and construed in accordance with the laws of ${jurisdiction}, without regard to its conflict-of-law principles. The parties irrevocably submit to the exclusive jurisdiction of the courts located in ${city || state || country || "the agreed jurisdiction"} for the resolution of any dispute arising out of or relating to this Agreement.`;
}

export const GOVERNING_LAW_KEY = "governing_law";

// Default clause set. Order is preserved in the generated document.
export function buildDefaultMsaClauses(opts?: { city?: string; state?: string; country?: string }): MsaClause[] {
  const city = opts?.city || "";
  const state = opts?.state || "";
  const country = opts?.country || "";
  return [
    {
      key: "definitions",
      title: "1. Definitions",
      body: "Capitalized terms used in this Agreement shall have the meanings given to them where first defined. \"Services\" means the services described in any Statement of Work or order executed by the parties. \"Confidential Information\" means non-public information disclosed by one party to the other in connection with this Agreement.",
    },
    {
      key: "scope_of_services",
      title: "2. Scope of Services",
      body: "The Service Provider shall perform the Services described in one or more mutually executed Statements of Work. Each Statement of Work shall be governed by the terms of this Agreement. In the event of a conflict between a Statement of Work and this Agreement, this Agreement shall control unless the Statement of Work expressly states otherwise.",
    },
    {
      key: "term_termination",
      title: "3. Term & Termination",
      body: "This Agreement commences on the Effective Date and continues until terminated. Either party may terminate this Agreement or any Statement of Work for convenience upon thirty (30) days' written notice, or immediately upon a material breach that remains uncured for fifteen (15) days after written notice. Termination shall not relieve either party of obligations accrued prior to the effective date of termination.",
    },
    {
      key: "fees_payment",
      title: "4. Fees & Payment",
      body: "The Client shall pay the fees set out in the applicable Statement of Work. Unless otherwise stated, invoices are due in accordance with the payment terms agreed by the parties. Undisputed amounts not paid when due may accrue interest at the lower of 1.5% per month or the maximum rate permitted by law. Fees are exclusive of applicable taxes.",
    },
    {
      key: "confidentiality",
      title: "5. Confidentiality",
      body: "Each party shall protect the other's Confidential Information using at least the same degree of care it uses to protect its own confidential information, and in no event less than a reasonable degree of care. Confidential Information shall be used solely to perform under this Agreement and shall not be disclosed to third parties except as required to perform the Services or as required by law.",
    },
    {
      key: "ip_ownership",
      title: "6. Intellectual Property",
      body: "Except as expressly set out in a Statement of Work, each party retains all right, title and interest in its pre-existing intellectual property. Deliverables created specifically for the Client under a Statement of Work shall, upon full payment, be owned by the Client, excluding the Service Provider's pre-existing materials and tools, which are licensed to the Client on a non-exclusive basis to the extent needed to use the Deliverables.",
    },
    {
      key: "indemnification",
      title: "7. Indemnification",
      body: "Each party shall indemnify, defend and hold harmless the other party from and against third-party claims, damages, and reasonable costs arising out of the indemnifying party's gross negligence, willful misconduct, or breach of this Agreement, subject to the indemnified party promptly notifying the indemnifying party and providing reasonable cooperation.",
    },
    {
      key: "limitation_liability",
      title: "8. Limitation of Liability",
      body: "Except for breaches of confidentiality, indemnification obligations, or a party's gross negligence or willful misconduct, neither party shall be liable for any indirect, incidental, special, consequential or punitive damages. Each party's aggregate liability arising out of this Agreement shall not exceed the total fees paid or payable under the applicable Statement of Work in the twelve (12) months preceding the claim.",
    },
    {
      key: "independent_contractor",
      title: "9. Independent Contractor",
      body: "The Service Provider is an independent contractor. Nothing in this Agreement creates a partnership, joint venture, agency, or employment relationship between the parties. Neither party has authority to bind the other. Each party is solely responsible for its own personnel, taxes, and statutory obligations.",
    },
    {
      key: "non_solicitation",
      title: "10. Non-Solicitation",
      body: "During the term of this Agreement and for twelve (12) months thereafter, neither party shall directly solicit for employment any personnel of the other party who were directly involved in performing or receiving the Services, without the other party's prior written consent. General solicitations not specifically targeted at such personnel are not prohibited.",
    },
    {
      key: GOVERNING_LAW_KEY,
      title: "11. Governing Law & Jurisdiction",
      body: buildGoverningLawClause(city, state, country),
    },
    {
      key: "notices",
      title: "12. Notices",
      body: "All notices under this Agreement shall be in writing and delivered to the addresses set out above (or such other address as a party may designate in writing), by personal delivery, nationally recognized courier, or email with confirmation of receipt. Notices are deemed given upon receipt.",
    },
    {
      key: "entire_agreement",
      title: "13. Entire Agreement",
      body: "This Agreement, together with its Statements of Work and any attachments, constitutes the entire agreement between the parties regarding its subject matter and supersedes all prior or contemporaneous understandings. Any amendment must be in writing and signed by both parties. If any provision is held unenforceable, the remaining provisions shall remain in full force and effect.",
    },
  ];
}
