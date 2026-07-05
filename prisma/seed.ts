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

    // Sample work log entry so the feature isn't empty on first look.
    const brambleClose = await db.property.findFirst({ where: { customerId: jracine.id, addressLine1: "14 Bramble Close" } });
    const jasmineWhite = await db.product.findFirst({ where: { organisationId: org.id, manufacturer: "Dow", colour: "Jasmine White" } });
    if (brambleClose) {
      await db.propertyWorkLog.create({
        data: {
          propertyId: brambleClose.id,
          description: "1 bathroom — cut out & reseal",
          productId: jasmineWhite?.id,
          productText: jasmineWhite ? `${jasmineWhite.manufacturer} ${jasmineWhite.name}` : "Dow 785+ Bacteria Resistant",
          colour: "Jasmine White",
          area: "BATHROOM",
          completedAt: new Date("2025-03-14"),
        },
      });
      await db.timelineEvent.create({
        data: { customerId: jracine.id, type: "WORK_LOG_ADDED", title: "Work logged at 14 Bramble Close: 1 bathroom — Jasmine White" },
      });
    }

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

  // Sample enquiries across a few pipeline stages so the Kanban isn't empty.
  const existingEnquiries = await db.enquiry.count({ where: { organisationId: org.id } });
  if (existingEnquiries === 0) {
    const sarah = await db.customer.findFirst({ where: { organisationId: org.id, name: "Sarah Whitfield" } });

    const ogden = await db.enquiry.create({
      data: {
        organisationId: org.id,
        name: "Michael Ogden",
        phone: "07700 900112",
        email: "m.ogden@example.co.uk",
        addressText: "22 Chapel Lane",
        postcode: "WN2 3JD",
        propertyType: "RESIDENTIAL",
        workTypes: ["BATHROOM", "CUT_OUT_RESEAL"],
        description: "Mould around the bath seal, would like it cut out and redone in white.",
        preferredContact: "PHONE",
        consentGiven: true,
        stage: "NEW",
        priority: "NORMAL",
        kanbanOrder: 0,
      },
    });

    // Sample AI analysis so the panel isn't empty on first view.
    const jasmineWhiteForAi = await db.product.findFirst({ where: { organisationId: org.id, manufacturer: "Dow", colour: "Jasmine White" } });
    await db.aIAnalysis.create({
      data: {
        enquiryId: ogden.id,
        findings: {
          mould: true,
          missingSilicone: false,
          crackedSilicone: true,
          waterIngress: false,
          tileGaps: false,
          groutCondition: "fair",
          cleanliness: "fair",
          safetyIssues: [],
        },
        jobSummary: "Bathroom seal has failed around the bath — mould present and the existing bead is cracked in several places. Straightforward cut-out and reseal.",
        estimatedWork: "Cut out and remove old silicone around the bath, treat mould, reseal in white with a sanitary-grade product.",
        estimatedMetres: 9.5,
        suggestedProducts: jasmineWhiteForAi ? [{ label: `${jasmineWhiteForAi.manufacturer} ${jasmineWhiteForAi.name}` }] : [{ label: "Dow 785+ Bacteria Resistant" }],
        suggestedColours: ["Jasmine White"],
        suggestedLabourHrs: 3.5,
        quoteNotes: "Customer asked for white — Jasmine White is the closest sanitary-grade match in stock.",
        confidence: 82,
        model: "gpt-4o",
        editedByUser: false,
      },
    });

    await db.enquiry.create({
      data: {
        organisationId: org.id,
        name: "Sarah Whitfield",
        company: "Whitfield Lettings Ltd",
        phone: "07700 900654",
        email: "sarah@whitfieldlettings.co.uk",
        customerId: sarah?.id,
        addressText: "The Old Mill, Unit 4",
        postcode: "WN3 5BD",
        propertyType: "COMMERCIAL",
        workTypes: ["EXTERNAL_WINDOWS", "EXPANSION_JOINTS"],
        description: "Annual reseal of external window units and two expansion joints before winter.",
        preferredContact: "EMAIL",
        consentGiven: true,
        stage: "QUOTED",
        priority: "HIGH",
        estimatedValue: 640,
        kanbanOrder: 0,
      },
    });

    await db.enquiry.create({
      data: {
        organisationId: org.id,
        name: "Priya Kaur",
        phone: "07700 900778",
        email: "priya.kaur@example.co.uk",
        addressText: "9 Beech Grove",
        postcode: "WN5 8QF",
        propertyType: "RESIDENTIAL",
        workTypes: ["KITCHEN", "SHOWER"],
        description: "New kitchen worktop upstand and shower enclosure sealing, ideally this month.",
        preferredContact: "WHATSAPP",
        consentGiven: true,
        stage: "WAITING_DECISION",
        priority: "NORMAL",
        estimatedValue: 220,
        kanbanOrder: 0,
      },
    });

    console.log("Seeded sample enquiries.");
  }

  console.log(`Seeded organisation "${org.name}" with starter product catalogue.`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => db.$disconnect());
