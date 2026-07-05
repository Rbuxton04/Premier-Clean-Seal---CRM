import { PrismaClient } from "@prisma/client";

const db = new PrismaClient();

async function main() {
  const org = await db.organisation.upsert({
    where: { id: "org_premier" },
    update: {},
    create: {
      id: "org_premier",
      name: "Premier Clean & Seal",
      logoUrl: "/logo.png",
      // Business settings confirmed by the owner:
      vatRegistered: false, // toggle on in Settings when registered
      vatRatePercent: 20,
      defaultWarrantyMonths: 12,
      defaultReminderMonths: 12,
      quoteNumberFormat: "#Q-0000",
      invoiceNumberFormat: "#I-0000",
      jobNumberFormat: "#J-0000",
    },
  });

  // Starter silicone product catalogue
  const products: Array<{
    manufacturer: string;
    name: string;
    colour: string;
    attributes: string[];
  }> = [
    { manufacturer: "Dow", name: "785+ Bacteria Resistant", colour: "White", attributes: ["SANITARY", "NEUTRAL_CURE"] },
    { manufacturer: "Dow", name: "785+ Bacteria Resistant", colour: "Jasmine White", attributes: ["SANITARY", "NEUTRAL_CURE"] },
    { manufacturer: "Dow", name: "785+ Bacteria Resistant", colour: "Ivory", attributes: ["SANITARY", "NEUTRAL_CURE"] },
    { manufacturer: "Dow", name: "785+ Bacteria Resistant", colour: "Grey", attributes: ["SANITARY", "NEUTRAL_CURE"] },
    { manufacturer: "Dow", name: "785+ Bacteria Resistant", colour: "Anthracite", attributes: ["SANITARY", "NEUTRAL_CURE"] },
    { manufacturer: "Dow", name: "785+ Bacteria Resistant", colour: "Black", attributes: ["SANITARY", "NEUTRAL_CURE"] },
    { manufacturer: "Dow", name: "791 Weatherproofing", colour: "White", attributes: ["EXTERNAL", "NEUTRAL_CURE"] },
    { manufacturer: "Dow", name: "791 Weatherproofing", colour: "Anthracite Grey", attributes: ["EXTERNAL", "NEUTRAL_CURE"] },
    { manufacturer: "Sika", name: "Sikasil C", colour: "White", attributes: ["SANITARY"] },
    { manufacturer: "Mapei", name: "Mapesil AC", colour: "Manhattan 2000", attributes: ["SANITARY"] },
    { manufacturer: "Everbuild", name: "Firemate Intumescent", colour: "White", attributes: ["FIRE_RATED"] },
    { manufacturer: "Everbuild", name: "AC50 Acoustic", colour: "White", attributes: ["ACOUSTIC"] },
    { manufacturer: "Soudal", name: "Silirub LMN", colour: "Clear", attributes: ["LMN", "NEUTRAL_CURE"] },
  ];

  for (const p of products) {
    const existing = await db.product.findFirst({
      where: { organisationId: org.id, manufacturer: p.manufacturer, name: p.name, colour: p.colour },
    });
    if (!existing) {
      await db.product.create({ data: { organisationId: org.id, ...p } });
    }
  }

  console.log(`Seeded organisation "${org.name}" with starter product catalogue.`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => db.$disconnect());
