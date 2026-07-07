import { randomBytes } from "crypto";
import { PrismaClient, type Role } from "@prisma/client";

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

  // Sample quotes across the lifecycle (draft / sent / approved) so the
  // list and public approval flow aren't empty on first view.
  const existingQuotes = await db.quote.count({ where: { organisationId: org.id } });
  if (existingQuotes === 0) {
    const jracine = await db.customer.findFirst({ where: { organisationId: org.id, name: "James Ractliffe" } });
    const sarahCustomer = await db.customer.findFirst({ where: { organisationId: org.id, name: "Sarah Whitfield" } });
    const sarahEnquiry = await db.enquiry.findFirst({ where: { organisationId: org.id, name: "Sarah Whitfield", stage: "QUOTED" } });

    if (jracine) {
      await db.quote.create({
        data: {
          organisationId: org.id,
          quoteNumber: "#Q-0001",
          customerId: jracine.id,
          status: "SENT",
          scopeOfWorks: "Reseal ensuite shower tray and surrounding tiles.",
          subtotal: 180,
          vatApplied: false,
          vatRatePercent: 0,
          vatAmount: 0,
          total: 180,
          warrantyMonths: 12,
          // SENT (not DRAFT) so the seeded customer portal has a quote
          // waiting for approval — see the Milestone 11 portal token below.
          approvalToken: randomBytes(24).toString("hex"),
          expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
          lineItems: {
            create: [
              { description: "Cut out and reseal — Dow 785+ White", quantity: 6, unit: "metres", unitPrice: 8, total: 48, sortOrder: 0 },
              { description: "Labour", quantity: 3, unit: "hours", unitPrice: 44, total: 132, sortOrder: 1 },
            ],
          },
        },
      });
    }

    if (sarahCustomer) {
      await db.quote.create({
        data: {
          organisationId: org.id,
          quoteNumber: "#Q-0002",
          customerId: sarahCustomer.id,
          enquiryId: sarahEnquiry?.id,
          status: "SENT",
          scopeOfWorks: "Annual reseal of external window units and two expansion joints before winter.",
          subtotal: 640,
          vatApplied: false,
          vatRatePercent: 0,
          vatAmount: 0,
          total: 640,
          warrantyMonths: 12,
          approvalToken: randomBytes(24).toString("hex"),
          expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
          lineItems: {
            create: [
              { description: "External window unit resealing — Dow 791 Weatherproofing", quantity: 40, unit: "metres", unitPrice: 9, total: 360, sortOrder: 0 },
              { description: "Expansion joint resealing", quantity: 2, unit: "each", unitPrice: 60, total: 120, sortOrder: 1 },
              { description: "Labour", quantity: 4, unit: "hours", unitPrice: 40, total: 160, sortOrder: 2 },
            ],
          },
        },
      });

      await db.quote.create({
        data: {
          organisationId: org.id,
          quoteNumber: "#Q-0003",
          customerId: sarahCustomer.id,
          status: "APPROVED",
          scopeOfWorks: "Reseal Flat 2 kitchen and bathroom ahead of new tenancy.",
          subtotal: 208.5,
          vatApplied: false,
          vatRatePercent: 0,
          vatAmount: 0,
          total: 208.5,
          warrantyMonths: 12,
          approvalToken: randomBytes(24).toString("hex"),
          approvedAt: new Date("2025-11-02"),
          approvedName: "Sarah Whitfield",
          approvedIp: "203.0.113.42",
          lineItems: {
            create: [
              { description: "Kitchen and bathroom reseal — Dow 785+ White", quantity: 12, unit: "metres", unitPrice: 8, total: 96, sortOrder: 0 },
              { description: "Labour", quantity: 2.5, unit: "hours", unitPrice: 45, total: 112.5, sortOrder: 1 },
            ],
          },
        },
      });
    }

    await db.organisation.update({ where: { id: org.id }, data: { quoteCounter: 3 } });
    console.log("Seeded sample quotes.");
  }

  // Sample technicians (idempotent)
  const existingTechnicians = await db.user.count({ where: { organisationId: org.id, role: "TECHNICIAN" } });
  if (existingTechnicians === 0) {
    await db.user.createMany({
      data: [
        { organisationId: org.id, name: "Roman", email: "roman@premiercleanandseal.co.uk", role: "TECHNICIAN" },
        { organisationId: org.id, name: "Danny", email: "danny@premiercleanandseal.co.uk", role: "TECHNICIAN" },
        { organisationId: org.id, name: "Mia", email: "mia@premiercleanandseal.co.uk", role: "TECHNICIAN" },
      ],
    });
    console.log("Seeded sample technicians.");
  }

  // Sample jobs across statuses and days so the list and calendar aren't
  // empty on first view. Converts the seeded APPROVED quote into a job to
  // demonstrate that flow.
  const existingJobs = await db.job.count({ where: { organisationId: org.id } });
  if (existingJobs === 0) {
    const roman = await db.user.findFirst({ where: { organisationId: org.id, name: "Roman" } });
    const danny = await db.user.findFirst({ where: { organisationId: org.id, name: "Danny" } });
    const mia = await db.user.findFirst({ where: { organisationId: org.id, name: "Mia" } });

    const jracine = await db.customer.findFirst({ where: { organisationId: org.id, name: "James Ractliffe" } });
    const brambleClose = jracine ? await db.property.findFirst({ where: { customerId: jracine.id, addressLine1: "14 Bramble Close" } }) : null;

    const sarahCustomer = await db.customer.findFirst({ where: { organisationId: org.id, name: "Sarah Whitfield" } });
    const standishgateFlat = sarahCustomer ? await db.property.findFirst({ where: { customerId: sarahCustomer.id, addressLine1: "Flat 2, 88 Standishgate" } }) : null;
    const theOldMill = sarahCustomer ? await db.property.findFirst({ where: { customerId: sarahCustomer.id, addressLine1: "The Old Mill, Unit 4" } }) : null;

    // Milestone 13 — pre-fill known Wigan coordinates so the job map shows
    // pins immediately without a live Mapbox geocode call on first load.
    const seedCoords: Array<{ id: string | undefined; latitude: number; longitude: number }> = [
      { id: brambleClose?.id, latitude: 53.5372, longitude: -2.6218 },
      { id: standishgateFlat?.id, latitude: 53.5455, longitude: -2.6318 },
      { id: theOldMill?.id, latitude: 53.529, longitude: -2.649 },
    ];
    for (const c of seedCoords) {
      if (!c.id) continue;
      await db.property.updateMany({
        where: { id: c.id, latitude: null },
        data: { latitude: c.latitude, longitude: c.longitude },
      });
    }

    const approvedQuote = await db.quote.findFirst({ where: { organisationId: org.id, quoteNumber: "#Q-0003" } });

    const today = new Date();
    const daysFromNow = (n: number, hour = 9) => {
      const d = new Date(today);
      d.setDate(d.getDate() + n);
      d.setHours(hour, 0, 0, 0);
      return d;
    };

    let jobCounter = 0;
    const addMonths = (d: Date, months: number): Date => {
      const result = new Date(d);
      result.setMonth(result.getMonth() + months);
      return result;
    };
    // Self-contained placeholder image (no external network call) so the
    // gallery and before/after slider render with content even before real
    // completion photos exist.
    const placeholderImage = (label: string, bg: string): string => {
      const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="800" height="600"><rect width="100%" height="100%" fill="${bg}"/><text x="50%" y="50%" font-family="Arial" font-size="48" fill="#ffffff" text-anchor="middle" dominant-baseline="middle">${label}</text></svg>`;
      return `data:image/svg+xml;base64,${Buffer.from(svg).toString("base64")}`;
    };

    // Job 1: converted from the approved quote — demonstrates the M4 -> M5 flow.
    if (approvedQuote && sarahCustomer) {
      jobCounter += 1;
      const jobNumber = `#J-000${jobCounter}`;
      await db.job.create({
        data: {
          organisationId: org.id,
          jobNumber,
          customerId: sarahCustomer.id,
          propertyId: standishgateFlat?.id,
          quoteId: approvedQuote.id,
          technicianId: danny?.id,
          status: "BOOKED",
          scheduledStart: daysFromNow(2),
          scheduledEnd: daysFromNow(2, 11),
          price: approvedQuote.total,
          depositPaid: 0,
          balanceDue: approvedQuote.total,
          paymentStatus: "UNPAID",
        },
      });
      await db.timelineEvent.create({
        data: { customerId: sarahCustomer.id, type: "JOB_CREATED", title: `Job ${jobNumber} created from quote ${approvedQuote.quoteNumber}` },
      });
    }

    // Job 2: manual booked job, scheduled this week
    if (jracine) {
      jobCounter += 1;
      await db.job.create({
        data: {
          organisationId: org.id,
          jobNumber: `#J-000${jobCounter}`,
          customerId: jracine.id,
          propertyId: brambleClose?.id,
          technicianId: roman?.id,
          status: "BOOKED",
          // Scheduled today (not tomorrow) so the job map has a pin to show
          // by default without the user having to change the date.
          scheduledStart: daysFromNow(0),
          scheduledEnd: daysFromNow(0, 12),
          price: 180,
          depositPaid: 0,
          balanceDue: 180,
          paymentStatus: "UNPAID",
          notes: "Ensuite shower tray reseal.",
        },
      });
    }

    // Job 3: unscheduled — sits in the calendar's unscheduled tray
    if (sarahCustomer) {
      jobCounter += 1;
      await db.job.create({
        data: {
          organisationId: org.id,
          jobNumber: `#J-000${jobCounter}`,
          customerId: sarahCustomer.id,
          propertyId: theOldMill?.id,
          status: "BOOKED",
          price: 320,
          depositPaid: 0,
          balanceDue: 320,
          paymentStatus: "UNPAID",
          notes: "Commercial unit — awaiting access booking.",
        },
      });
    }

    // Job 4: completed last week — enriched with materials, warranty,
    // invoice, and a scheduled reminder so those views aren't empty either.
    if (jracine) {
      jobCounter += 1;
      const jobNumber = `#J-000${jobCounter}`;
      const actualEnd = daysFromNow(-6, 13);

      const job4 = await db.job.create({
        data: {
          organisationId: org.id,
          jobNumber,
          customerId: jracine.id,
          propertyId: brambleClose?.id,
          technicianId: mia?.id,
          status: "COMPLETED",
          scheduledStart: daysFromNow(-6),
          scheduledEnd: daysFromNow(-6, 13),
          actualStart: daysFromNow(-6),
          actualEnd,
          price: 150,
          depositPaid: 50,
          balanceDue: 100,
          paymentStatus: "PAID",
          completionNotes: "Bathroom reseal completed — old silicone removed, mould treated, resealed in Jasmine White.",
          metresInstalled: 9.5,
          satisfactionRating: 5,
        },
      });

      const jasmineWhiteForJob = await db.product.findFirst({ where: { organisationId: org.id, manufacturer: "Dow", colour: "Jasmine White" } });
      if (jasmineWhiteForJob) {
        await db.materialUsage.create({
          data: {
            jobId: job4.id,
            productId: jasmineWhiteForJob.id,
            batchNumber: "B2311-04",
            applicationArea: "BATHROOM",
            quantityUsed: 3,
            unit: "tubes",
            cost: 4.5,
          },
        });
      }

      await db.warranty.create({
        data: {
          jobId: job4.id,
          startDate: actualEnd,
          endDate: addMonths(actualEnd, org.defaultWarrantyMonths),
          coverage: `${org.defaultWarrantyMonths}-month warranty against installation defects covering: Bathroom.`,
        },
      });

      const invoiceNumber = "#I-0001";
      const dueDate = new Date(actualEnd);
      dueDate.setDate(dueDate.getDate() + 14);
      await db.invoice.create({
        data: {
          invoiceNumber,
          customerId: jracine.id,
          jobId: job4.id,
          subtotal: 100,
          vatApplied: false,
          vatRatePercent: 0,
          vatAmount: 0,
          amount: 100,
          status: "PAID",
          dueDate,
          paidAt: daysFromNow(-4),
        },
      });
      await db.organisation.update({ where: { id: org.id }, data: { invoiceCounter: 1 } });

      await db.marketingReminder.create({
        data: {
          organisationId: org.id,
          customerId: jracine.id,
          jobId: job4.id,
          dueDate: addMonths(actualEnd, org.defaultReminderMonths),
          intervalMonths: org.defaultReminderMonths,
          channels: jracine.marketingEmail ? ["EMAIL"] : [],
          status: "SCHEDULED",
        },
      });

      await db.timelineEvent.createMany({
        data: [
          { customerId: jracine.id, jobId: job4.id, type: "JOB_COMPLETED", title: `Job ${jobNumber} completed` },
          { customerId: jracine.id, jobId: job4.id, type: "WARRANTY_ISSUED", title: `Warranty issued for job ${jobNumber} (${org.defaultWarrantyMonths} months)` },
          { customerId: jracine.id, jobId: job4.id, type: "INVOICE_RAISED", title: `Invoice ${invoiceNumber} raised` },
        ],
      });

      // Milestone 7: a paired before/after photo (for the gallery slider) and
      // a compliance document, so those views aren't empty either.
      const beforePhoto = await db.mediaFile.create({
        data: {
          organisationId: org.id,
          customerId: jracine.id,
          jobId: job4.id,
          kind: "PHOTO",
          category: "BEFORE",
          url: placeholderImage("BEFORE", "#58606B"),
          mimeType: "image/svg+xml",
          sizeBytes: 0,
          // Shared so the Milestone 11 seeded portal token has a before/after to show.
          sharedToPortal: true,
        },
      });
      const afterPhoto = await db.mediaFile.create({
        data: {
          organisationId: org.id,
          customerId: jracine.id,
          jobId: job4.id,
          kind: "PHOTO",
          category: "AFTER",
          url: placeholderImage("AFTER", "#3C2263"),
          mimeType: "image/svg+xml",
          sizeBytes: 0,
          sharedToPortal: true,
        },
      });
      await db.mediaFile.update({ where: { id: beforePhoto.id }, data: { pairedWithId: afterPhoto.id } });
      await db.mediaFile.update({ where: { id: afterPhoto.id }, data: { pairedWithId: beforePhoto.id } });

      await db.mediaFile.create({
        data: {
          organisationId: org.id,
          customerId: jracine.id,
          jobId: job4.id,
          kind: "DOCUMENT",
          category: "RAMS",
          url: `data:text/plain;base64,${Buffer.from("RAMS - Risk Assessment Method Statement (placeholder document).").toString("base64")}`,
          mimeType: "text/plain",
          sizeBytes: 0,
        },
      });

      // Milestone 8: a second, due-soon reminder (the 12-month one above is
      // the "later" one) so the dashboard and "Run reminders now" have
      // something ready to send immediately.
      await db.marketingReminder.create({
        data: {
          organisationId: org.id,
          customerId: jracine.id,
          jobId: job4.id,
          dueDate: daysFromNow(-1),
          intervalMonths: 1,
          channels: jracine.marketingEmail ? ["EMAIL"] : jracine.marketingSms ? ["SMS"] : [],
          status: "SCHEDULED",
        },
      });
    }

    // Milestone 9: a few more completed jobs spread across recent months so
    // the dashboard charts (revenue trend, monthly jobs, top colours/products,
    // repeat vs new revenue) show more than a single data point.
    const dowExternal = await db.product.findFirst({ where: { organisationId: org.id, manufacturer: "Dow", name: "791 Weatherproofing" } });
    const dowWhite = await db.product.findFirst({ where: { organisationId: org.id, manufacturer: "Dow", colour: "White", name: "785+ Bacteria Resistant" } });
    const sikaWhite = await db.product.findFirst({ where: { organisationId: org.id, manufacturer: "Sika" } });

    if (sarahCustomer && dowExternal) {
      jobCounter += 1;
      const job5 = await db.job.create({
        data: {
          organisationId: org.id,
          jobNumber: `#J-000${jobCounter}`,
          customerId: sarahCustomer.id,
          propertyId: standishgateFlat?.id,
          technicianId: danny?.id,
          status: "COMPLETED",
          scheduledStart: daysFromNow(-45),
          scheduledEnd: daysFromNow(-45, 12),
          actualStart: daysFromNow(-45),
          actualEnd: daysFromNow(-45, 12),
          price: 210,
          depositPaid: 210,
          balanceDue: 0,
          paymentStatus: "PAID",
          metresInstalled: 6,
          satisfactionRating: 4,
        },
      });
      await db.materialUsage.create({
        data: { jobId: job5.id, productId: dowExternal.id, applicationArea: "EXTERNAL", quantityUsed: 5, unit: "tubes", cost: 6 },
      });
    }

    if (jracine && dowWhite) {
      jobCounter += 1;
      const job6 = await db.job.create({
        data: {
          organisationId: org.id,
          jobNumber: `#J-000${jobCounter}`,
          customerId: jracine.id,
          propertyId: brambleClose?.id,
          technicianId: roman?.id,
          status: "COMPLETED",
          scheduledStart: daysFromNow(-100),
          scheduledEnd: daysFromNow(-100, 11),
          actualStart: daysFromNow(-100),
          actualEnd: daysFromNow(-100, 11),
          price: 165,
          depositPaid: 165,
          balanceDue: 0,
          paymentStatus: "PAID",
          metresInstalled: 7.5,
          satisfactionRating: 5,
        },
      });
      await db.materialUsage.create({
        data: { jobId: job6.id, productId: dowWhite.id, applicationArea: "BATHROOM", quantityUsed: 2, unit: "tubes", cost: 4.5 },
      });
    }

    if (sarahCustomer && sikaWhite) {
      jobCounter += 1;
      const job7 = await db.job.create({
        data: {
          organisationId: org.id,
          jobNumber: `#J-000${jobCounter}`,
          customerId: sarahCustomer.id,
          propertyId: theOldMill?.id,
          technicianId: mia?.id,
          status: "COMPLETED",
          scheduledStart: daysFromNow(-20),
          scheduledEnd: daysFromNow(-20, 15),
          actualStart: daysFromNow(-20),
          actualEnd: daysFromNow(-20, 15),
          price: 340,
          depositPaid: 100,
          balanceDue: 240,
          paymentStatus: "PARTIALLY_PAID",
          metresInstalled: 12,
          satisfactionRating: 4,
        },
      });
      await db.materialUsage.create({
        data: { jobId: job7.id, productId: sikaWhite.id, applicationArea: "KITCHEN", quantityUsed: 8, unit: "tubes", cost: 5 },
      });
      await db.invoice.create({
        data: {
          invoiceNumber: "#I-0002",
          customerId: sarahCustomer.id,
          jobId: job7.id,
          subtotal: 240,
          vatApplied: false,
          vatRatePercent: 0,
          vatAmount: 0,
          amount: 240,
          status: "PARTIALLY_PAID",
          dueDate: daysFromNow(-6),
          paidAt: daysFromNow(-18),
        },
      });
      await db.organisation.update({ where: { id: org.id }, data: { invoiceCounter: 2 } });
    }

    await db.organisation.update({ where: { id: org.id }, data: { jobCounter } });
    console.log("Seeded sample jobs.");
  }

  // Sample AI campaign draft so the marketing dashboard isn't empty.
  const existingCampaigns = await db.campaign.count({ where: { organisationId: org.id } });
  if (existingCampaigns === 0) {
    await db.campaign.create({
      data: {
        organisationId: org.id,
        name: "Friendly Email draft — 12-month reseal reminder",
        channel: "EMAIL",
        content:
          "Hi {firstName},\n\nIt's been about a year since we resealed your bathroom in {colour} — silicone typically starts to wear after 12-18 months, especially somewhere as steamy as a bathroom.\n\nFancy a free check? Just book a slot and we'll take a look: {bookLink}\n\nThanks,\nPremier Clean & Seal",
        tone: "FRIENDLY",
        aiGenerated: true,
      },
    });
    console.log("Seeded sample campaign draft.");
  }

  // Sample insight report so the dashboard panel and /insights history
  // aren't empty on first look.
  const existingInsightReports = await db.insightReport.count({ where: { organisationId: org.id } });
  if (existingInsightReports === 0) {
    const periodEnd = new Date();
    const periodStart = new Date(periodEnd);
    periodStart.setDate(periodStart.getDate() - 7);

    await db.insightReport.create({
      data: {
        organisationId: org.id,
        periodStart,
        periodEnd,
        summary:
          "This week: 1 job completed, a modest amount collected. Most-used colour: Jasmine White. Repeat customer rate is building nicely across the Bramble Close and Standishgate properties. A couple of customers look likely to rebook soon based on how long it's been since their last reseal. Enable AI (set AI_API_KEY) for a fuller narrative report and revenue forecast.",
        data: { seeded: true, note: "Placeholder report — run Generate now for a live one." },
      },
    });
    console.log("Seeded sample insight report.");
  }

  // Milestone 11: a stable portal token for James Ractliffe so the customer
  // portal can be tested end-to-end (he already has a warranty, an invoice,
  // a shared before/after pair, and now a SENT quote awaiting approval).
  const jracineForPortal = await db.customer.findFirst({ where: { organisationId: org.id, name: "James Ractliffe" } });
  if (jracineForPortal) {
    const existingPortalToken = await db.portalToken.findFirst({
      where: { customerId: jracineForPortal.id, scope: { has: "portal" } },
    });
    if (!existingPortalToken) {
      const portalToken = "demo-portal-token-james-ractliffe";
      const farFuture = new Date();
      farFuture.setFullYear(farFuture.getFullYear() + 1);
      await db.portalToken.create({
        data: { customerId: jracineForPortal.id, token: portalToken, scope: ["portal"], expiresAt: farFuture },
      });
      const appUrl = process.env.APP_URL ?? "http://localhost:3000";
      console.log(`Seeded customer portal token. Test portal URL: ${appUrl}/portal/${portalToken}`);
    }
  }

  // Milestone 12: default Permission rows so Settings -> Staff & roles has
  // real data to show, not just the hardcoded fallback in permissions.ts.
  // These mirror DEFAULT_PERMISSIONS in src/lib/permissions.ts — if you
  // change one, change the other.
  const defaultPermissionRows: Array<{ role: Role; resource: string; actions: string[] }> = [
    { role: "OFFICE", resource: "customers", actions: ["read", "create", "update", "delete"] },
    { role: "OFFICE", resource: "quotes", actions: ["read", "create", "update", "delete"] },
    { role: "OFFICE", resource: "jobs", actions: ["read", "create", "update", "delete"] },
    { role: "OFFICE", resource: "invoices", actions: ["read", "create", "update"] },
    { role: "OFFICE", resource: "financials", actions: ["read"] },
    { role: "OFFICE", resource: "marketing", actions: ["read", "create", "update", "delete"] },
    { role: "ESTIMATOR", resource: "customers", actions: ["read", "create", "update"] },
    { role: "ESTIMATOR", resource: "quotes", actions: ["read", "create", "update"] },
    { role: "ESTIMATOR", resource: "jobs", actions: ["read"] },
    { role: "SALES", resource: "customers", actions: ["read", "create", "update"] },
    { role: "SALES", resource: "quotes", actions: ["read", "create"] },
    { role: "SALES", resource: "marketing", actions: ["read", "create", "update"] },
    { role: "TECHNICIAN", resource: "jobs", actions: ["read", "update"] },
    { role: "TECHNICIAN", resource: "gallery", actions: ["read", "create"] },
    { role: "READONLY", resource: "customers", actions: ["read"] },
    { role: "READONLY", resource: "quotes", actions: ["read"] },
    { role: "READONLY", resource: "jobs", actions: ["read"] },
    { role: "READONLY", resource: "invoices", actions: ["read"] },
  ];
  for (const row of defaultPermissionRows) {
    await db.permission.upsert({
      where: { organisationId_role_resource: { organisationId: org.id, role: row.role, resource: row.resource } },
      update: {},
      create: { organisationId: org.id, role: row.role, resource: row.resource, actions: row.actions },
    });
  }

  // A few sample AuditLog entries so the ADMIN-only viewer isn't empty on
  // first look. Idempotent by checking for a marker entry first.
  const auditSeeded = await db.auditLog.findFirst({ where: { organisationId: org.id, resource: "organisation.settings", action: "SEED" } });
  if (!auditSeeded) {
    await db.auditLog.createMany({
      data: [
        { organisationId: org.id, action: "SEED", resource: "organisation.settings", after: { note: "Initial seed run" } },
        { organisationId: org.id, action: "CREATE", resource: "customer", resourceId: jracineForPortal?.id, after: { name: "James Ractliffe" } },
        { organisationId: org.id, action: "CREATE", resource: "tag", after: { name: "Contractor" } },
      ],
    });
    console.log("Seeded sample audit log entries.");
  }

  console.log(`Seeded organisation "${org.name}" with starter product catalogue.`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => db.$disconnect());
