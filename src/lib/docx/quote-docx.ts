import fs from "fs";
import path from "path";
import {
  Document, Packer, Paragraph, TextRun, Table, TableRow, TableCell, AlignmentType,
  ImageRun, WidthType, BorderStyle, ShadingType,
} from "docx";
import type { QuotePdfData } from "@/lib/pdf/quote-pdf";

// Same branded template and the SAME QuotePdfData the PDF generator uses
// (quote.service.ts's buildPdfData feeds both) -- the editable Word
// download for when staff want to tweak wording before sending, per the
// measuring-tool brief's "PDF or Word" export choice. Content/layout match
// the PDF as closely as the two formats allow.

const PLUM = "3C2263";
const SLATE = "58606B";

function gbp(n: number): string {
  return new Intl.NumberFormat("en-GB", { style: "currency", currency: "GBP" }).format(n);
}

function noBorder() {
  return { style: BorderStyle.NONE, size: 0, color: "FFFFFF" };
}

function cell(text: string, opts: { bold?: boolean; align?: (typeof AlignmentType)[keyof typeof AlignmentType]; width?: number; shaded?: boolean } = {}) {
  return new TableCell({
    width: opts.width ? { size: opts.width, type: WidthType.PERCENTAGE } : undefined,
    shading: opts.shaded ? { type: ShadingType.CLEAR, fill: "EDE7F6" } : undefined,
    borders: { top: noBorder(), bottom: { style: BorderStyle.SINGLE, size: 4, color: "E0E0E0" }, left: noBorder(), right: noBorder() },
    children: [new Paragraph({ alignment: opts.align, children: [new TextRun({ text, bold: opts.bold })] })],
  });
}

export async function renderQuoteDocxBuffer(data: QuotePdfData): Promise<Buffer> {
  let logoImage: ImageRun | null = null;
  try {
    const logoBuffer = fs.readFileSync(path.join(process.cwd(), "public", "logo.png"));
    logoImage = new ImageRun({ type: "png", data: logoBuffer, transformation: { width: 40, height: 40 } });
  } catch {
    logoImage = null;
  }

  const headerChildren = [
    new Paragraph({
      children: [
        ...(logoImage ? [logoImage, new TextRun({ text: "   " })] : []),
        new TextRun({ text: "PREMIER CLEAN & SEAL", bold: true, size: 28, color: "2E333B" }),
      ],
    }),
    new Paragraph({
      children: [new TextRun({ text: data.quoteNumber, bold: true, size: 32, color: PLUM })],
      alignment: AlignmentType.RIGHT,
    }),
    new Paragraph({
      children: [new TextRun({ text: `Issued ${data.createdAt.toLocaleDateString("en-GB")}`, size: 18, color: SLATE })],
      alignment: AlignmentType.RIGHT,
    }),
    ...(data.expiresAt
      ? [new Paragraph({ children: [new TextRun({ text: `Valid until ${data.expiresAt.toLocaleDateString("en-GB")}`, size: 18, color: SLATE })], alignment: AlignmentType.RIGHT })]
      : []),
  ];

  const customerChildren = [
    new Paragraph({ children: [new TextRun({ text: "QUOTE FOR", size: 16, color: SLATE, bold: true })] }),
    new Paragraph({ children: [new TextRun({ text: data.customerName, bold: true, size: 24 })] }),
    ...(data.customerCompany ? [new Paragraph({ text: data.customerCompany })] : []),
    ...(data.propertyAddress ? [new Paragraph({ text: data.propertyAddress })] : []),
  ];

  const scopeChildren = [
    new Paragraph({ children: [new TextRun({ text: "SCOPE OF WORKS", size: 16, color: SLATE, bold: true })], spacing: { before: 200 } }),
    new Paragraph({ text: data.scopeOfWorks, spacing: { after: 200 } }),
  ];

  const table = new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    rows: [
      new TableRow({
        children: [
          cell("Description", { bold: true, width: 46 }),
          cell("Qty", { bold: true, align: AlignmentType.RIGHT, width: 13 }),
          cell("Unit", { bold: true, width: 13 }),
          cell("Unit price", { bold: true, align: AlignmentType.RIGHT, width: 14 }),
          cell("Total", { bold: true, align: AlignmentType.RIGHT, width: 14 }),
        ],
      }),
      ...data.lineItems.map(
        (item) =>
          new TableRow({
            children: [
              cell(item.description),
              cell(String(item.quantity), { align: AlignmentType.RIGHT }),
              cell(item.unit),
              cell(gbp(item.unitPrice), { align: AlignmentType.RIGHT }),
              cell(gbp(item.total), { align: AlignmentType.RIGHT }),
            ],
          })
      ),
    ],
  });

  const totalsChildren = [
    new Paragraph({ alignment: AlignmentType.RIGHT, spacing: { before: 200 }, children: [new TextRun({ text: `Subtotal: ${gbp(data.subtotal)}`, size: 20 })] }),
    new Paragraph({
      alignment: AlignmentType.RIGHT,
      children: [new TextRun({ text: `${data.vatApplied ? `VAT (${data.vatRatePercent}%)` : "VAT (not yet registered)"}: ${gbp(data.vatAmount)}`, size: 20 })],
    }),
    new Paragraph({
      alignment: AlignmentType.RIGHT,
      spacing: { before: 100 },
      children: [new TextRun({ text: `Total: ${gbp(data.total)}`, bold: true, size: 26, color: PLUM })],
    }),
    ...(data.depositAmount != null && data.depositAmount > 0
      ? [new Paragraph({ alignment: AlignmentType.RIGHT, children: [new TextRun({ text: `Deposit due on approval: ${gbp(data.depositAmount)}`, size: 20 })] })]
      : []),
  ];

  const footerChildren = [
    ...(data.warrantyMonths != null
      ? [
          new Paragraph({
            spacing: { before: 300 },
            text: `This work is covered by a ${data.warrantyMonths}-month warranty against installation defects from the completion date.`,
          }),
        ]
      : []),
    ...(data.terms
      ? [
          new Paragraph({ children: [new TextRun({ text: "TERMS", size: 16, color: SLATE, bold: true })], spacing: { before: 200 } }),
          new Paragraph({ text: data.terms }),
        ]
      : []),
    ...(data.approvalUrl
      ? [
          new Paragraph({
            spacing: { before: 300 },
            children: [new TextRun({ text: "Ready to go ahead? Review the full breakdown and approve online: ", size: 20 })],
          }),
          new Paragraph({ children: [new TextRun({ text: data.approvalUrl, color: PLUM, underline: {} })] }),
        ]
      : []),
    new Paragraph({
      spacing: { before: 300 },
      children: [
        new TextRun({
          text:
            "This is a draft estimate of costs based on the information available at the time of issue and is not a VAT invoice. Typed-name online approval is accepted as a reasonable electronic acceptance of this quote and its terms for the purposes of this contract.",
          size: 15,
          color: SLATE,
          italics: true,
        }),
      ],
    }),
  ];

  const doc = new Document({
    sections: [
      {
        properties: {},
        children: [...headerChildren, ...customerChildren, ...scopeChildren, table, ...totalsChildren, ...footerChildren],
      },
    ],
  });

  const buffer = await Packer.toBuffer(doc);
  return buffer as Buffer;
}
