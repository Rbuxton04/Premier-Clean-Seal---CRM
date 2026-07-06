import React from "react";
import fs from "fs";
import path from "path";
import { Document, Page, View, Text, Image, Svg, Path, StyleSheet, renderToBuffer } from "@react-pdf/renderer";

export type WarrantyPdfMaterial = { productLabel: string; colour: string; area: string };

export type WarrantyPdfData = {
  jobNumber: string;
  customerName: string;
  propertyAddress: string | null;
  startDate: Date;
  endDate: Date;
  coverage: string;
  materials: WarrantyPdfMaterial[];
};

const PLUM = "#3C2263";
const SLATE = "#58606B";
const SLATE_INK = "#2E333B";

const styles = StyleSheet.create({
  page: { padding: 40, fontSize: 10, color: SLATE_INK, fontFamily: "Helvetica" },
  headerRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 24 },
  brandRow: { flexDirection: "row", alignItems: "center", gap: 10 },
  logo: { width: 36, height: 36, borderRadius: 4 },
  wordmark: { fontSize: 14, fontFamily: "Helvetica-Bold", color: SLATE_INK, letterSpacing: 1 },
  wordmarkSub: { fontSize: 7, color: SLATE, letterSpacing: 2 },
  swoosh: { marginTop: 2 },
  metaBlock: { alignItems: "flex-end" },
  metaLine: { fontSize: 9, color: SLATE, marginTop: 2 },
  title: { fontSize: 20, fontFamily: "Helvetica-Bold", color: PLUM, textAlign: "center", marginBottom: 4 },
  subtitle: { fontSize: 10, color: SLATE, textAlign: "center", marginBottom: 24 },
  sectionTitle: { fontSize: 8, textTransform: "uppercase", letterSpacing: 1, color: SLATE, marginBottom: 4 },
  customerBlock: { marginBottom: 16 },
  customerName: { fontSize: 12, fontFamily: "Helvetica-Bold" },
  bodyText: { fontSize: 10, lineHeight: 1.5, marginBottom: 12 },
  coverageBox: { marginTop: 4, padding: 14, backgroundColor: "#EDE7F6", borderRadius: 4 },
  datesRow: { flexDirection: "row", justifyContent: "space-between", marginTop: 16, marginBottom: 16 },
  dateBlock: { alignItems: "center", flex: 1 },
  dateLabel: { fontSize: 8, textTransform: "uppercase", letterSpacing: 0.5, color: SLATE },
  dateValue: { fontSize: 13, fontFamily: "Helvetica-Bold", marginTop: 2 },
  table: { marginTop: 8, marginBottom: 12 },
  tableHeaderRow: { flexDirection: "row", borderBottomWidth: 1, borderBottomColor: PLUM, paddingBottom: 4, marginBottom: 4 },
  tableRow: { flexDirection: "row", borderBottomWidth: 0.5, borderBottomColor: "#E0E0E0", paddingVertical: 5 },
  colProduct: { flex: 2, paddingRight: 6 },
  colColour: { flex: 1, paddingRight: 6 },
  colArea: { flex: 1 },
  th: { fontSize: 8, textTransform: "uppercase", letterSpacing: 0.5, color: SLATE },
  footerSection: { marginTop: 24, paddingTop: 12, borderTopWidth: 0.5, borderTopColor: "#E0E0E0" },
  small: { fontSize: 8, color: SLATE, marginTop: 10 },
});

function WarrantyDocument({ data, logoSrc }: { data: WarrantyPdfData; logoSrc: string | null }) {
  return (
    <Document title={`Warranty certificate — Job ${data.jobNumber}`}>
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
          <View style={styles.metaBlock}>
            <Text style={styles.metaLine}>Job {data.jobNumber}</Text>
            <Text style={styles.metaLine}>Issued {data.startDate.toLocaleDateString("en-GB")}</Text>
          </View>
        </View>

        <Text style={styles.title}>Certificate of Warranty</Text>
        <Text style={styles.subtitle}>Silicone sealant installation</Text>

        <View style={styles.customerBlock}>
          <Text style={styles.sectionTitle}>Issued to</Text>
          <Text style={styles.customerName}>{data.customerName}</Text>
          {data.propertyAddress && <Text>{data.propertyAddress}</Text>}
        </View>

        <View style={styles.datesRow}>
          <View style={styles.dateBlock}>
            <Text style={styles.dateLabel}>Cover starts</Text>
            <Text style={styles.dateValue}>{data.startDate.toLocaleDateString("en-GB")}</Text>
          </View>
          <View style={styles.dateBlock}>
            <Text style={styles.dateLabel}>Cover ends</Text>
            <Text style={styles.dateValue}>{data.endDate.toLocaleDateString("en-GB")}</Text>
          </View>
        </View>

        <Text style={styles.sectionTitle}>Coverage</Text>
        <View style={styles.coverageBox}>
          <Text style={styles.bodyText}>{data.coverage}</Text>
        </View>

        {data.materials.length > 0 && (
          <View style={styles.table}>
            <Text style={styles.sectionTitle}>Materials installed</Text>
            <View style={styles.tableHeaderRow}>
              <Text style={[styles.th, styles.colProduct]}>Product</Text>
              <Text style={[styles.th, styles.colColour]}>Colour</Text>
              <Text style={[styles.th, styles.colArea]}>Area</Text>
            </View>
            {data.materials.map((m, i) => (
              <View key={i} style={styles.tableRow}>
                <Text style={styles.colProduct}>{m.productLabel}</Text>
                <Text style={styles.colColour}>{m.colour}</Text>
                <Text style={styles.colArea}>{m.area}</Text>
              </View>
            ))}
          </View>
        )}

        <View style={styles.footerSection}>
          <Text style={styles.small}>
            This warranty covers defects in the installation of the silicone sealant described above and does not
            cover damage caused by misuse, structural movement, or third-party works. Please retain this certificate
            and contact us with your job number if you need to make a claim.
          </Text>
        </View>
      </Page>
    </Document>
  );
}

export async function renderWarrantyPdfBuffer(data: WarrantyPdfData): Promise<Buffer> {
  let logoSrc: string | null = null;
  try {
    const logoPath = path.join(process.cwd(), "public", "logo.png");
    const logoBuffer = fs.readFileSync(logoPath);
    logoSrc = `data:image/png;base64,${logoBuffer.toString("base64")}`;
  } catch {
    logoSrc = null;
  }

  return renderToBuffer(<WarrantyDocument data={data} logoSrc={logoSrc} />);
}
