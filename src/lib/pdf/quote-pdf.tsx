import React from "react";
import fs from "fs";
import path from "path";
import { Document, Page, View, Text, Image, Svg, Path, StyleSheet, renderToBuffer } from "@react-pdf/renderer";

export type QuotePdfLineItem = { description: string; quantity: number; unit: string; unitPrice: number; total: number };

export type QuotePdfData = {
  quoteNumber: string;
  createdAt: Date;
  expiresAt: Date | null;
  customerName: string;
  customerCompany: string | null;
  propertyAddress: string | null;
  scopeOfWorks: string;
  lineItems: QuotePdfLineItem[];
  subtotal: number;
  vatApplied: boolean;
  vatRatePercent: number;
  vatAmount: number;
  total: number;
  depositAmount: number | null;
  terms: string | null;
  warrantyMonths: number | null;
  approvalUrl?: string;
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
  quoteMeta: { alignItems: "flex-end" },
  quoteNumber: { fontSize: 16, fontFamily: "Helvetica-Bold", color: PLUM },
  metaLine: { fontSize: 9, color: SLATE, marginTop: 2 },
  sectionTitle: { fontSize: 8, textTransform: "uppercase", letterSpacing: 1, color: SLATE, marginBottom: 4 },
  customerBlock: { marginBottom: 16 },
  customerName: { fontSize: 12, fontFamily: "Helvetica-Bold" },
  bodyText: { fontSize: 10, lineHeight: 1.5, marginBottom: 12 },
  table: { marginTop: 8, marginBottom: 12 },
  tableHeaderRow: { flexDirection: "row", borderBottomWidth: 1, borderBottomColor: PLUM, paddingBottom: 4, marginBottom: 4 },
  tableRow: { flexDirection: "row", borderBottomWidth: 0.5, borderBottomColor: "#E0E0E0", paddingVertical: 5 },
  colDescription: { flex: 3, paddingRight: 6 },
  colQty: { flex: 1, textAlign: "right", paddingRight: 8 },
  colUnit: { flex: 1, paddingRight: 6 },
  colPrice: { flex: 1, textAlign: "right", paddingRight: 8 },
  colTotal: { flex: 1, textAlign: "right" },
  th: { fontSize: 8, textTransform: "uppercase", letterSpacing: 0.5, color: SLATE },
  totalsBlock: { alignSelf: "flex-end", width: 220, marginTop: 8 },
  totalsRow: { flexDirection: "row", justifyContent: "space-between", paddingVertical: 2 },
  totalsLabel: { color: SLATE },
  grandTotalRow: { flexDirection: "row", justifyContent: "space-between", paddingTop: 6, marginTop: 4, borderTopWidth: 1, borderTopColor: PLUM },
  grandTotalLabel: { fontSize: 12, fontFamily: "Helvetica-Bold" },
  grandTotalValue: { fontSize: 12, fontFamily: "Helvetica-Bold", color: PLUM },
  footerSection: { marginTop: 20, paddingTop: 12, borderTopWidth: 0.5, borderTopColor: "#E0E0E0" },
  approvalBox: { marginTop: 16, padding: 12, backgroundColor: "#EDE7F6", borderRadius: 4 },
  approvalTitle: { fontSize: 11, fontFamily: "Helvetica-Bold", color: PLUM, marginBottom: 4 },
  small: { fontSize: 8, color: SLATE, marginTop: 10 },
});

function gbp(n: number) {
  return new Intl.NumberFormat("en-GB", { style: "currency", currency: "GBP" }).format(n);
}

function QuoteDocument({ data, logoSrc }: { data: QuotePdfData; logoSrc: string | null }) {
  return (
    <Document title={`Quote ${data.quoteNumber}`}>
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
          <View style={styles.quoteMeta}>
            <Text style={styles.quoteNumber}>{data.quoteNumber}</Text>
            <Text style={styles.metaLine}>Issued {data.createdAt.toLocaleDateString("en-GB")}</Text>
            {data.expiresAt && <Text style={styles.metaLine}>Valid until {data.expiresAt.toLocaleDateString("en-GB")}</Text>}
          </View>
        </View>

        <View style={styles.customerBlock}>
          <Text style={styles.sectionTitle}>Quote for</Text>
          <Text style={styles.customerName}>{data.customerName}</Text>
          {data.customerCompany && <Text>{data.customerCompany}</Text>}
          {data.propertyAddress && <Text>{data.propertyAddress}</Text>}
        </View>

        <Text style={styles.sectionTitle}>Scope of works</Text>
        <Text style={styles.bodyText}>{data.scopeOfWorks}</Text>

        <View style={styles.table}>
          <View style={styles.tableHeaderRow}>
            <Text style={[styles.th, styles.colDescription]}>Description</Text>
            <Text style={[styles.th, styles.colQty]}>Qty</Text>
            <Text style={[styles.th, styles.colUnit]}>Unit</Text>
            <Text style={[styles.th, styles.colPrice]}>Unit price</Text>
            <Text style={[styles.th, styles.colTotal]}>Total</Text>
          </View>
          {data.lineItems.map((item, i) => (
            <View key={i} style={styles.tableRow}>
              <Text style={styles.colDescription}>{item.description}</Text>
              <Text style={styles.colQty}>{item.quantity}</Text>
              <Text style={styles.colUnit}>{item.unit}</Text>
              <Text style={styles.colPrice}>{gbp(item.unitPrice)}</Text>
              <Text style={styles.colTotal}>{gbp(item.total)}</Text>
            </View>
          ))}
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
            <Text style={styles.grandTotalLabel}>Total</Text>
            <Text style={styles.grandTotalValue}>{gbp(data.total)}</Text>
          </View>
          {data.depositAmount != null && data.depositAmount > 0 && (
            <View style={styles.totalsRow}>
              <Text style={styles.totalsLabel}>Deposit due on approval</Text>
              <Text>{gbp(data.depositAmount)}</Text>
            </View>
          )}
        </View>

        <View style={styles.footerSection}>
          {data.warrantyMonths != null && (
            <Text style={styles.bodyText}>
              This work is covered by a {data.warrantyMonths}-month warranty against installation defects from the completion date.
            </Text>
          )}
          {data.terms && (
            <>
              <Text style={styles.sectionTitle}>Terms</Text>
              <Text style={styles.bodyText}>{data.terms}</Text>
            </>
          )}
        </View>

        {data.approvalUrl && (
          <View style={styles.approvalBox}>
            <Text style={styles.approvalTitle}>Ready to go ahead?</Text>
            <Text style={styles.bodyText}>
              Approve this quote online at: {data.approvalUrl}
            </Text>
          </View>
        )}

        <Text style={styles.small}>
          This is a draft estimate of costs based on the information available at the time of issue and is not a VAT
          invoice. Typed-name online approval is accepted as a reasonable electronic acceptance of this quote and its
          terms for the purposes of this contract.
        </Text>
      </Page>
    </Document>
  );
}

export async function renderQuotePdfBuffer(data: QuotePdfData): Promise<Buffer> {
  let logoSrc: string | null = null;
  try {
    const logoPath = path.join(process.cwd(), "public", "logo.png");
    const logoBuffer = fs.readFileSync(logoPath);
    logoSrc = `data:image/png;base64,${logoBuffer.toString("base64")}`;
  } catch {
    logoSrc = null;
  }

  return renderToBuffer(<QuoteDocument data={data} logoSrc={logoSrc} />);
}
