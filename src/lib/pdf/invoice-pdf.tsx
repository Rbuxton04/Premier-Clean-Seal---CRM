import React from "react";
import fs from "fs";
import path from "path";
import { Document, Page, View, Text, Image, Svg, Path, StyleSheet, renderToBuffer } from "@react-pdf/renderer";

export type InvoicePdfData = {
  invoiceNumber: string;
  jobNumber: string | null;
  createdAt: Date;
  dueDate: Date;
  customerName: string;
  customerCompany: string | null;
  propertyAddress: string | null;
  jobPrice: number;
  depositPaid: number;
  subtotal: number;
  vatApplied: boolean;
  vatRatePercent: number;
  vatAmount: number;
  amount: number;
};

const PLUM = "#3C2263";
const SLATE = "#58606B";
const SLATE_INK = "#2E333B";

const styles = StyleSheet.create({
  page: { padding: 40, fontSize: 10, color: SLATE_INK, fontFamily: "Helvetica" },
  headerRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 20 },
  brandRow: { flexDirection: "row", alignItems: "center", gap: 10 },
  logo: { width: 36, height: 36, borderRadius: 4 },
  wordmark: { fontSize: 14, fontFamily: "Helvetica-Bold", color: SLATE_INK, letterSpacing: 1 },
  wordmarkSub: { fontSize: 7, color: SLATE, letterSpacing: 2 },
  swoosh: { marginTop: 2 },
  invoiceMeta: { alignItems: "flex-end" },
  invoiceNumber: { fontSize: 16, fontFamily: "Helvetica-Bold", color: PLUM },
  metaLine: { fontSize: 9, color: SLATE, marginTop: 2 },
  sectionTitle: { fontSize: 8, textTransform: "uppercase", letterSpacing: 1, color: SLATE, marginBottom: 4 },
  customerBlock: { marginBottom: 16 },
  customerName: { fontSize: 12, fontFamily: "Helvetica-Bold" },
  table: { marginTop: 16, marginBottom: 12 },
  tableHeaderRow: { flexDirection: "row", borderBottomWidth: 1, borderBottomColor: PLUM, paddingBottom: 4, marginBottom: 4 },
  tableRow: { flexDirection: "row", borderBottomWidth: 0.5, borderBottomColor: "#E0E0E0", paddingVertical: 5 },
  colDescription: { flex: 3, paddingRight: 6 },
  colAmount: { flex: 1, textAlign: "right" },
  th: { fontSize: 8, textTransform: "uppercase", letterSpacing: 0.5, color: SLATE },
  totalsBlock: { alignSelf: "flex-end", width: 220, marginTop: 8 },
  totalsRow: { flexDirection: "row", justifyContent: "space-between", paddingVertical: 2 },
  totalsLabel: { color: SLATE },
  grandTotalRow: { flexDirection: "row", justifyContent: "space-between", paddingTop: 6, marginTop: 4, borderTopWidth: 1, borderTopColor: PLUM },
  grandTotalLabel: { fontSize: 12, fontFamily: "Helvetica-Bold" },
  grandTotalValue: { fontSize: 12, fontFamily: "Helvetica-Bold", color: PLUM },
  footerSection: { marginTop: 20, paddingTop: 12, borderTopWidth: 0.5, borderTopColor: "#E0E0E0" },
  payBox: { marginTop: 16, padding: 12, backgroundColor: "#EDE7F6", borderRadius: 4 },
  payTitle: { fontSize: 11, fontFamily: "Helvetica-Bold", color: PLUM, marginBottom: 4 },
  small: { fontSize: 8, color: SLATE, marginTop: 10 },
});

function gbp(n: number) {
  return new Intl.NumberFormat("en-GB", { style: "currency", currency: "GBP" }).format(n);
}

function InvoiceDocument({ data, logoSrc }: { data: InvoicePdfData; logoSrc: string | null }) {
  return (
    <Document title={`Invoice ${data.invoiceNumber}`}>
      <Page size="A4" style={styles.page}>
        <View style={styles.headerRow}>
          <View>
            <View style={styles.brandRow}>
              {logoSrc && <Image src={logoSrc} style={styles.logo} />}
              <View>
                <Text style={styles.wordmark}>PREMIER</Text>
                <Text style={styles.wordmarkSub}>CLEAN &amp; SEAL</Text>
              </View>
            </View>
            <Svg width={140} height={12} viewBox="0 0 320 24" style={styles.swoosh}>
              <Path
                d="M2 16 C 40 4, 78 4, 112 12 S 200 22, 250 14 S 305 8, 318 10"
                stroke={PLUM}
                strokeWidth={4}
                fill="none"
              />
            </Svg>
          </View>
          <View style={styles.invoiceMeta}>
            <Text style={styles.invoiceNumber}>{data.invoiceNumber}</Text>
            <Text style={styles.metaLine}>Issued {data.createdAt.toLocaleDateString("en-GB")}</Text>
            <Text style={styles.metaLine}>Due {data.dueDate.toLocaleDateString("en-GB")}</Text>
            {data.jobNumber && <Text style={styles.metaLine}>Job {data.jobNumber}</Text>}
          </View>
        </View>

        <View style={styles.customerBlock}>
          <Text style={styles.sectionTitle}>Invoice to</Text>
          <Text style={styles.customerName}>{data.customerName}</Text>
          {data.customerCompany && <Text>{data.customerCompany}</Text>}
          {data.propertyAddress && <Text>{data.propertyAddress}</Text>}
        </View>

        <View style={styles.table}>
          <View style={styles.tableHeaderRow}>
            <Text style={[styles.th, styles.colDescription]}>Description</Text>
            <Text style={[styles.th, styles.colAmount]}>Amount</Text>
          </View>
          <View style={styles.tableRow}>
            <Text style={styles.colDescription}>Job price{data.jobNumber ? ` — ${data.jobNumber}` : ""}</Text>
            <Text style={styles.colAmount}>{gbp(data.jobPrice)}</Text>
          </View>
          {data.depositPaid > 0 && (
            <View style={styles.tableRow}>
              <Text style={styles.colDescription}>Less: deposit paid</Text>
              <Text style={styles.colAmount}>-{gbp(data.depositPaid)}</Text>
            </View>
          )}
        </View>

        <View style={styles.totalsBlock}>
          <View style={styles.totalsRow}>
            <Text style={styles.totalsLabel}>Subtotal</Text>
            <Text>{gbp(data.subtotal)}</Text>
          </View>
          <View style={styles.totalsRow}>
            <Text style={styles.totalsLabel}>
              {data.vatApplied ? `VAT (${data.vatRatePercent}%)` : "VAT (not yet registered)"}
            </Text>
            <Text>{gbp(data.vatAmount)}</Text>
          </View>
          <View style={styles.grandTotalRow}>
            <Text style={styles.grandTotalLabel}>Amount due</Text>
            <Text style={styles.grandTotalValue}>{gbp(data.amount)}</Text>
          </View>
        </View>

        <View style={styles.payBox}>
          <Text style={styles.payTitle}>Payment</Text>
          <Text style={styles.small}>
            Online card payment isn&apos;t available yet — please contact us to arrange payment of this invoice
            quoting {data.invoiceNumber}.
          </Text>
        </View>

        <View style={styles.footerSection}>
          <Text style={styles.small}>
            This is a VAT invoice only where VAT is shown as applied above. Payment is due by the date shown.
          </Text>
        </View>
      </Page>
    </Document>
  );
}

export async function renderInvoicePdfBuffer(data: InvoicePdfData): Promise<Buffer> {
  let logoSrc: string | null = null;
  try {
    const logoPath = path.join(process.cwd(), "public", "logo.png");
    const logoBuffer = fs.readFileSync(logoPath);
    logoSrc = `data:image/png;base64,${logoBuffer.toString("base64")}`;
  } catch {
    logoSrc = null;
  }

  return renderToBuffer(<InvoiceDocument data={data} logoSrc={logoSrc} />);
}
