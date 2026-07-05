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

  // Starter client tags (idempotent)
  const contractorTag = await db.tag.upsert({
    where: { organisationId_name: { organisationId: org.id, name: "Contractor" } },
    update: {},
    create: { organisationId: org.id, name: "Contractor", colour: "#0369A1" },
  });
  const domesticTag = await db.tag.upsert({
    where: { organisationId_name: { organisationId: org.id, name: "Domestic" } },
    update: {},
    create: { organisationId: org.id, name: "Domestic", colour: "#1E7A5A" },
  });

  // Sample customers (only if none exist yet) so the app isn't empty on first look
  const existingCustomers = await db.customer.count({ where: { organisationId: org.id } });
  if (existingCustomers === 0) {
    const jracine = await db.customer.create({
      data: {
        organisationId: org.id,
        name: "James Ractliffe",
        company: null,
        phone: "07700 900321",
        email: "james.r@example.co.uk",
        notes: "Prefers weekday mornings. Recommended by a neighbour.",
        marketingEmail: true,
        consentAt: new Date(),
        totalSpend: 285,
        tags: { connect: { id: domesticTag.id } },
        properties: {
          create: [
            { addressLine1: "14 Bramble Close", city: "Wigan", postcode: "WN1 2AB", propertyType: "RESIDENTIAL", notes: "Main bathroom + ensuite." },
          ],
        },
      },
    });
    await db.timelineEvent.createMany({
      data: [
        { customerId: jracine.id, type: "CUSTOMER_CREATED", title: "Customer record created" },
        { customerId: jracine.id, type: "PROPERTY_ADDED", title: "Property added: 14 Bramble Close, WN1 2AB" },
      ],
    });

    await db.customer.create({
      data: {
        organisationId: org.id,
        name: "Sarah Whitfield",
        company: "Whitfield Lettings Ltd",
        phone: "07700 900654",
        email: "sarah@whitfieldlettings.co.uk",
        notes: "Manages 6 rental properties — recurring reseal work.",
        marketingEmail: true,
        marketingSms: true,
        consentAt: new Date(),
        totalSpend: 1240,
        tags: { connect: [{ id: contractorTag.id }] },
        properties: {
          create: [
            { addressLine1: "Flat 2, 88 Standishgate", city: "Wigan", postcode: "WN1 1XL", propertyType: "RESIDENTIAL" },
            { addressLine1: "The Old Mill, Unit 4", city: "Wigan", postcode: "WN3 5BD", propertyType: "COMMERCIAL" },
          ],
        },
      },
    });
    console.log("Seeded sample customers.");
  }

  console.log(`Seeded organisation "${org.name}" with starter product catalogue.`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => db.$disconnect());
