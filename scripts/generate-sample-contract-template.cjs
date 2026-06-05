/**
 * Generates a sample Staffing Services Agreement DOCX with:
 *  - {{#candidates}} loop block in section 2
 *  - {{agreement_date}}, {{agency_signatory_name}}, {{client_signatory_name}},
 *    {{client_signatory_title}} in the signature block
 */
const PizZip = require("pizzip");
const path = require("path");
const fs = require("fs");

// Minimal valid DOCX word/document.xml with the updated template
const DOCUMENT_XML = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:document xmlns:wpc="http://schemas.microsoft.com/office/word/2010/wordprocessingCanvas"
  xmlns:cx="http://schemas.microsoft.com/office/drawing/2014/chartex"
  xmlns:mc="http://schemas.openxmlformats.org/markup-compatibility/2006"
  xmlns:aink="http://schemas.microsoft.com/office/drawing/2016/ink"
  xmlns:am3d="http://schemas.microsoft.com/office/drawing/2017/model3d"
  xmlns:o="urn:schemas-microsoft-com:office:office"
  xmlns:oel="http://schemas.microsoft.com/office/2019/extlst"
  xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"
  xmlns:m="http://schemas.openxmlformats.org/officeDocument/2006/math"
  xmlns:v="urn:schemas-microsoft-com:vml"
  xmlns:wp14="http://schemas.microsoft.com/office/word/2010/wordprocessingDrawing"
  xmlns:wp="http://schemas.openxmlformats.org/drawingml/2006/wordprocessingDrawing"
  xmlns:w10="urn:schemas-microsoft-com:office:word"
  xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"
  xmlns:w14="http://schemas.microsoft.com/office/word/2010/wordml"
  xmlns:w15="http://schemas.microsoft.com/office/word/2012/wordml"
  xmlns:w16cex="http://schemas.microsoft.com/office/word/2018/wordml/cex"
  xmlns:w16cid="http://schemas.microsoft.com/office/word/2016/wordml/cid"
  xmlns:w16="http://schemas.microsoft.com/office/word/2018/wordml"
  xmlns:w16sdtdh="http://schemas.microsoft.com/office/word/2020/wordml/sdtdatahash"
  xmlns:w16se="http://schemas.microsoft.com/office/word/2015/wordml/symex"
  xmlns:wpg="http://schemas.microsoft.com/office/word/2010/wordprocessingGroup"
  xmlns:wpi="http://schemas.microsoft.com/office/word/2010/wordprocessingInk"
  xmlns:wne="http://schemas.microsoft.com/office/word/2006/wordml"
  xmlns:wps="http://schemas.microsoft.com/office/word/2010/wordprocessingShape"
  mc:Ignorable="w14 w15 w16se w16cid w16 w16cex w16sdtdh wp14">
<w:body>

<w:p><w:pPr><w:jc w:val="center"/><w:rPr><w:b/><w:sz w:val="32"/></w:rPr></w:pPr>
<w:r><w:rPr><w:b/><w:sz w:val="32"/></w:rPr><w:t>STAFFING SERVICES AGREEMENT</w:t></w:r></w:p>

<w:p><w:r><w:t></w:t></w:r></w:p>

<w:p><w:r><w:t xml:space="preserve">This Staffing Services Agreement ("Agreement") is entered into as of {{contract_date}} between:</w:t></w:r></w:p>

<w:p><w:r><w:t></w:t></w:r></w:p>

<w:p><w:r><w:rPr><w:b/></w:rPr><w:t xml:space="preserve">CLIENT: </w:t></w:r><w:r><w:t xml:space="preserve">{{client_name}}, {{client_address}}</w:t></w:r></w:p>

<w:p><w:r><w:rPr><w:b/></w:rPr><w:t xml:space="preserve">AGENCY: </w:t></w:r><w:r><w:t>Rayomind Solutions LLP</w:t></w:r></w:p>

<w:p><w:r><w:t></w:t></w:r></w:p>

<w:p><w:pPr><w:rPr><w:b/></w:rPr></w:pPr>
<w:r><w:rPr><w:b/></w:rPr><w:t>1. SERVICES</w:t></w:r></w:p>

<w:p><w:r><w:t xml:space="preserve">Agency agrees to provide staffing services for the following candidate(s):</w:t></w:r></w:p>

<w:p><w:r><w:t></w:t></w:r></w:p>

<w:p><w:pPr><w:rPr><w:b/></w:rPr></w:pPr>
<w:r><w:rPr><w:b/></w:rPr><w:t>2. CANDIDATE DETAILS</w:t></w:r></w:p>

<w:p><w:r><w:t>{{#candidates}}</w:t></w:r></w:p>
<w:p><w:r><w:t xml:space="preserve">Name: {{name}}  |  Role: {{role}}  |  Start Date: {{startDate}}  |  Location: {{location}}  |  Engagement Type: {{engagementType}}</w:t></w:r></w:p>
<w:p><w:r><w:t>{{/candidates}}</w:t></w:r></w:p>

<w:p><w:r><w:t></w:t></w:r></w:p>

<w:p><w:pPr><w:rPr><w:b/></w:rPr></w:pPr>
<w:r><w:rPr><w:b/></w:rPr><w:t>3. COMPENSATION</w:t></w:r></w:p>

<w:p><w:r><w:t xml:space="preserve">The Client agrees to pay Agency a margin of {{margin_per_hour}} per hour. Payment terms: Net {{payment_terms_days}} days.</w:t></w:r></w:p>

<w:p><w:r><w:t xml:space="preserve">Billing shall occur on a {{billing_frequency}} basis.</w:t></w:r></w:p>

<w:p><w:r><w:t></w:t></w:r></w:p>

<w:p><w:pPr><w:rPr><w:b/></w:rPr></w:pPr>
<w:r><w:rPr><w:b/></w:rPr><w:t>4. TERM</w:t></w:r></w:p>

<w:p><w:r><w:t xml:space="preserve">This Agreement commences on {{start_date}} and continues until {{end_date}}, unless terminated earlier.</w:t></w:r></w:p>

<w:p><w:r><w:t></w:t></w:r></w:p>

<w:p><w:pPr><w:rPr><w:b/></w:rPr></w:pPr>
<w:r><w:rPr><w:b/></w:rPr><w:t>5. CONFIDENTIALITY</w:t></w:r></w:p>

<w:p><w:r><w:t>Both parties agree to maintain the confidentiality of proprietary information disclosed during the term of this Agreement.</w:t></w:r></w:p>

<w:p><w:r><w:t></w:t></w:r></w:p>

<w:p><w:r><w:t xml:space="preserve">IN WITNESS WHEREOF, the parties have executed this Agreement as of {{agreement_date}}.</w:t></w:r></w:p>

<w:p><w:r><w:t></w:t></w:r></w:p>

<w:p><w:pPr><w:rPr><w:b/></w:rPr></w:pPr>
<w:r><w:rPr><w:b/></w:rPr><w:t>CLIENT SIGNATURE</w:t></w:r></w:p>

<w:p><w:r><w:t xml:space="preserve">Name: {{client_signatory_name}}</w:t></w:r></w:p>

<w:p><w:r><w:t xml:space="preserve">Title: {{client_signatory_title}}</w:t></w:r></w:p>

<w:p><w:r><w:t>Date: _______________</w:t></w:r></w:p>

<w:p><w:r><w:t></w:t></w:r></w:p>

<w:p><w:pPr><w:rPr><w:b/></w:rPr></w:pPr>
<w:r><w:rPr><w:b/></w:rPr><w:t>RAYOMIND SOLUTIONS LLP</w:t></w:r></w:p>

<w:p><w:r><w:t xml:space="preserve">Name: {{agency_signatory_name}}</w:t></w:r></w:p>

<w:p><w:r><w:t>Date: _______________</w:t></w:r></w:p>

<w:p><w:r><w:t></w:t></w:r></w:p>

<w:sectPr/>
</w:body>
</w:document>`;

const CONTENT_TYPES_XML = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
  <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
  <Default Extension="xml" ContentType="application/xml"/>
  <Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>
</Types>`;

const RELS_XML = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/>
</Relationships>`;

const WORD_RELS_XML = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
</Relationships>`;

function buildDocx() {
  const zip = new PizZip();
  zip.file("[Content_Types].xml", CONTENT_TYPES_XML);
  zip.file("_rels/.rels", RELS_XML);
  zip.file("word/document.xml", DOCUMENT_XML);
  zip.file("word/_rels/document.xml.rels", WORD_RELS_XML);
  return zip.generate({ type: "nodebuffer", compression: "DEFLATE" });
}

const outPath = path.resolve(__dirname, "../public/samples/Staffing_Services_Agreement_Sample.docx");
fs.mkdirSync(path.dirname(outPath), { recursive: true });
const buf = buildDocx();
fs.writeFileSync(outPath, buf);
console.log("Sample template written to:", outPath, "(" + buf.length + " bytes)");
