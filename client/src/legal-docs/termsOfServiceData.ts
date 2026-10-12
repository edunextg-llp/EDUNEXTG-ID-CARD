import type { LegalDocument } from "./types";

export const termsOfServiceData: LegalDocument = {
  id: "terms-of-service",
  title: "Terms of Service",
  shortTitle: "Terms of Service",
  category: "Public Policy",
  version: "1.0",
  effectiveDate: "April 1, 2026",
  lastUpdated: "April 1, 2026",
  summary:
    "These Terms of Service govern the access to and use of Insight Education's website, School ID Card Management Suite portal, card design templates, and physical manufacturing order fulfillment for schools, colleges, and authorized partners across India.",
  applicableLaw:
    "Indian Contract Act, 1872; Information Technology Act, 2000; and applicable commercial laws of the Republic of India.",
  jurisdiction: "Republic of India (Exclusive Jurisdiction: Courts in Kolkata, West Bengal)",
  routePath: "/terms-of-service",
  sourceReference:
    "Adapted from General-Legal/legal-templates (terms-of-use template under CC0 1.0 Universal license) and customized for school identity card manufacturing and software management in India.",
  placeholders: [
    {
      key: "[PLACEHOLDER: GSTIN of Insight Education]",
      description: "Goods and Services Tax Identification Number of Insight Education.",
      defaultValue: "[PLACEHOLDER: Insight Education GSTIN]",
    },
    {
      key: "[PLACEHOLDER: Inspection and Defect Reporting Window]",
      description: "Number of calendar days following courier delivery during which the school must report manufacturing defects.",
      defaultValue: "[PLACEHOLDER: 7 calendar days from confirmed delivery receipt]",
    },
    {
      key: "[PLACEHOLDER: Standard Production Turnaround Time]",
      description: "Typical manufacturing duration from digital proof sign-off to dispatch.",
      defaultValue: "[PLACEHOLDER: 7 to 10 working days following final digital proof sign-off]",
    },
    {
      key: "[PLACEHOLDER: Commercial Advance Payment Percentage]",
      description: "Required advance payment percentage before starting physical printing.",
      defaultValue: "[PLACEHOLDER: 50% advance on approval of digital proof, balance on delivery / dispatch]",
    },
  ],
  sections: [
    {
      id: "acceptance-of-terms",
      number: "1",
      title: "Agreement to Terms",
      lead: "Please read these Terms of Service carefully before accessing or using the Insight Education portal and services.",
      content: [
        "These Terms of Service ('Terms') constitute a legally binding agreement between you (whether individually or on behalf of an educational institution, school, college, or commercial partner entity) and Insight Education ('Insight Education', 'we', 'us', or 'our'), having its principal office at AF-333, Rabindrapally, Talbagan, P.O. Prafulla Kanan, Kolkata-700101, West Bengal, India [PLACEHOLDER: GSTIN of Insight Education].",
        "By accessing our website, creating an account on the School ID Card Management Suite, uploading school rosters, approving digital card proofs, or placing purchase orders for ID cards, lanyards, holders, or accessories, you acknowledge that you have read, understood, and agree to be bound by these Terms and our Privacy Policy.",
        "If you are entering into these Terms on behalf of an educational institution or school society/trust, you represent and warrant that you possess the full legal authority to bind that institution.",
      ],
    },
    {
      id: "portal-accounts",
      number: "2",
      title: "User Accounts and Portal Access",
      subsections: [
        {
          id: "account-registration",
          number: "2.1",
          title: "Registration and Account Integrity",
          content: [
            "Access to the ID Card Management Suite requires authorized credentials issued to school administrators, partner coordinators, or super administrators. When establishing an account, you agree to provide authentic, accurate, and current administrative and institutional information.",
          ],
        },
        {
          id: "credential-security",
          number: "2.2",
          title: "Account Security and Responsibilities",
          content: [
            "Account credentials must be safeguarded. You are solely responsible for all activities, data submissions, and card order approvals conducted under your account. You agree to notify Insight Education immediately at insiteducation@gmail.com or +91 81008 79809 if you detect or suspect any unauthorized login or breach of security.",
          ],
        },
      ],
    },
    {
      id: "school-data-responsibilities",
      number: "3",
      title: "School Data, Consents and Content Representations",
      lead: "Educational institutions retain ownership of their data and warrant the lawfulness of all content uploaded.",
      content: [
        "In order to manufacture custom student and staff ID cards, the customer uploads personal records, academic information, photographs, and school logos.",
      ],
      bullets: [
        "Lawful Authority & Parental Consent: The school represents and warrants that it has secured all necessary rights, approvals, and parental/guardian consents required under Indian law (including the DPDP Act, 2023) to collect and supply student minor records and photographs for identity card fabrication.",
        "Accuracy of Submitted Data: The school is solely responsible for verifying the accuracy of spellings, student roll numbers, classes, blood groups, addresses, and emergency phone numbers before submitting data and confirming digital proofs.",
        "Institutional Logos & Intellectual Property: The school grants Insight Education a non-exclusive, limited license to reproduce the school's crest, emblem, and registered name solely for the purpose of printing authorized ID cards, custom lanyards, and promotional samples approved by the institution.",
      ],
    },
    {
      id: "ordering-proofing-manufacturing",
      number: "4",
      title: "Ordering, Digital Proof Approval, and Manufacturing",
      subsections: [
        {
          id: "digital-proof-approval",
          number: "4.1",
          title: "Mandatory Digital Proof Approval",
          content: [
            "Prior to physical production, Insight Education generates digital card previews through the portal. The school administrator or authorized coordinator must carefully inspect the digital proof for card layout, font sizing, color alignment, photo clarity, and field placement.",
            "Written or portal-based digital confirmation of the proof constitutes formal authorization to initiate mass physical production. Insight Education shall not be liable for typographical errors, misspellings, or erroneous data that were present and visible in the approved digital proof.",
          ],
        },
        {
          id: "manufacturing-standards",
          number: "4.2",
          title: "Manufacturing Specifications and Tolerances",
          content: [
            "ID cards are produced using high-grade PVC stock adhering to CR80 international dimensional standards (85.60 mm x 53.98 mm) with specified thickness (typically 30 mil / 0.76 mm). Due to thermal, re-transfer, and offset printing processes, minor variations in color hue (within industry delta-E tolerances) may occur between on-screen RGB monitor previews and final CMYK printed cards.",
          ],
        },
        {
          id: "production-timelines",
          number: "4.3",
          title: "Turnaround Timelines and Delivery",
          content: [
            "Standard manufacturing turnaround is [PLACEHOLDER: Standard Production Turnaround Time] following final digital proof sign-off and receipt of advance payment. During peak academic admission seasons (April–July), extended timelines may apply as specified in the relevant purchase order.",
            "Delivery is executed via registered domestic couriers or local delivery channels. Insight Education is not liable for dispatch delays resulting from courier network disruption, natural disasters, or local transit restrictions.",
          ],
        },
        {
          id: "inspection-defect-policy",
          number: "4.4",
          title: "Inspection and Defect Reporting Window",
          content: [
            "Upon delivery, the school must inspect the consignment. Any claims regarding manufacturing defects (such as lamination peeling, print smearing, physical warping, or quantity shortages) must be reported in writing within [PLACEHOLDER: Inspection and Defect Reporting Window], accompanied by clear photographic evidence.",
            "Defects attributable to Insight Education's manufacturing faults will be reprinted and replaced expeditiously at no additional charge. Reprints necessitated by incorrect source data provided by the school will be billed at applicable unit reprint rates.",
          ],
        },
      ],
    },
    {
      id: "fees-payment-terms",
      number: "5",
      title: "Pricing, Invoicing, and Payment Terms",
      bullets: [
        "Commercial Quotations: Pricing for ID cards, printed lanyards, card holders, and accessories is provided in official written quotations or purchase orders based on order volume.",
        "Goods and Services Tax (GST): All quoted rates are exclusive of applicable GST unless explicitly stated otherwise. Invoices will itemize statutory GST in accordance with Indian tax statutes.",
        "Payment Schedule: Unless otherwise agreed in an executed Master Services Agreement, orders require [PLACEHOLDER: Commercial Advance Payment Percentage]. Full payment is required before or upon delivery.",
        "Late Payments: Overdue balances may incur simple interest at the rate of 1.5% per month or the maximum permissible rate under Indian law from the due date until full payment.",
      ],
    },
    {
      id: "intellectual-property",
      number: "6",
      title: "Intellectual Property Rights",
      content: [
        "The School ID Card Management Suite, including software code, template layout engines, barcode generators, portal user interfaces, graphics, documentation, and the brand 'Insight Education' are the exclusive intellectual property of Insight Education and its licensors.",
        "You are granted a revocable, non-exclusive, non-transferable right to access and use the portal solely for managing institutional ID card orders. You may not reverse-engineer, decompile, resell, or duplicate any software component or proprietary card finishing design.",
      ],
    },
    {
      id: "limitation-of-liability",
      number: "7",
      title: "Limitation of Liability and Disclaimers",
      callout: {
        type: "warning",
        title: "Commercial Liability Cap",
        text: "To the maximum extent permitted under applicable Indian law, Insight Education's total aggregate liability arising out of or related to any order, defect, or portal downtime shall be strictly capped at the total amount paid by the customer for the specific order giving rise to the claim.",
      },
      content: [
        "Under no circumstances shall Insight Education be liable for any indirect, incidental, consequential, special, or exemplary damages, including loss of institutional goodwill, administrative inconvenience, or academic calendar disruptions.",
        "The portal is provided on an 'as is' and 'as available' basis. While we strive for 99.5% operational uptime, we do not warrant that portal access will be entirely uninterrupted or immune from internet network failures.",
      ],
    },
    {
      id: "indemnification",
      number: "8",
      title: "Indemnification",
      content: [
        "The customer agrees to defend, indemnify, and hold harmless Insight Education, its proprietors, employees, and logistics agents against any third-party claims, liabilities, damages, or costs (including reasonable legal fees) arising from: (a) infringement of third-party trademarks, logos, or copyrights contained in materials submitted by the customer; or (b) breach of applicable data protection statutes resulting from the customer's failure to secure valid parental or employee authorization.",
      ],
    },
    {
      id: "governing-law-dispute-resolution",
      number: "9",
      title: "Governing Law and Dispute Resolution",
      lead: "These Terms are governed by and construed in accordance with the laws of the Republic of India.",
      content: [
        "In the event of any controversy, claim, or dispute arising out of or in connection with these Terms or any order, the parties shall first endeavor to resolve the matter amicably through good-faith executive discussions within thirty (30) days of written notice.",
        "If unresolved, the dispute shall be submitted to the exclusive jurisdiction of the competent civil courts situated in Kolkata, West Bengal, India. Alternatively, by mutual written consent, disputes may be referred to sole arbitration in Kolkata under the Indian Arbitration and Conciliation Act, 1996.",
      ],
    },
    {
      id: "contact-information",
      number: "10",
      title: "Contact and Official Communications",
      content: [
        "For any inquiries, official notices, or assistance regarding these Terms of Service, please contact:",
        "Insight Education",
        "AF-333, Rabindrapally, Talbagan, P.O. Prafulla Kanan, Kolkata-700101, West Bengal, India",
        "Phone: +91 81008 79809 | Email: insiteducation@gmail.com",
        "Business Hours: Monday to Saturday, 9:30 AM to 6:30 PM IST",
      ],
    },
  ],
};
