import type { LegalDocument } from "./types";

export const privacyPolicyData: LegalDocument = {
  id: "privacy-policy",
  title: "Privacy Policy",
  shortTitle: "Privacy Policy",
  category: "Public Policy",
  version: "1.0",
  effectiveDate: "April 1, 2026",
  lastUpdated: "April 1, 2026",
  summary:
    "This Privacy Policy describes how Insight Education collects, uses, protects, and handles personal data across our public website, School ID Card Management Suite, and institutional physical ID card manufacturing services, in compliance with the Digital Personal Data Protection Act, 2023 (DPDP Act) and the Information Technology Act, 2000 of India.",
  applicableLaw:
    "Digital Personal Data Protection Act, 2023 (DPDP Act, 2023); Information Technology Act, 2000; Information Technology (Reasonable Security Practices and Procedures and Sensitive Personal Data or Information) Rules, 2011 (SPDI Rules).",
  jurisdiction: "Republic of India (Courts in Kolkata, West Bengal)",
  routePath: "/privacy-policy",
  sourceReference:
    "Adapted from General-Legal/legal-templates (privacy-policy-us and privacy-policy-gdpr templates under CC0 1.0 Universal license) and localized for India education ID card operations.",
  placeholders: [
    {
      key: "[PLACEHOLDER: Legal Entity Form & Registration / CIN / GSTIN]",
      description: "Legal structure of Insight Education (e.g., Sole Proprietorship / Partnership / Private Limited Company) and official registration number.",
      defaultValue: "[PLACEHOLDER: Insight Education Registration / CIN / GSTIN]",
    },
    {
      key: "[PLACEHOLDER: Website Domain URL]",
      description: "Production domain name for Insight Education web portal.",
      defaultValue: "[PLACEHOLDER: https://insighteduation.in]",
    },
    {
      key: "[PLACEHOLDER: Grievance Officer Full Name]",
      description: "Name of the designated Grievance Officer under the Information Technology Act, 2000.",
      defaultValue: "[PLACEHOLDER: Grievance Redressal Officer Name]",
    },
    {
      key: "[PLACEHOLDER: Dedicated Grievance Email]",
      description: "Official email inbox monitored by the Grievance Officer.",
      defaultValue: "[PLACEHOLDER: grievance@insighteduation.in]",
    },
    {
      key: "[PLACEHOLDER: Student Print Batch Data Retention Period]",
      description: "Post-fulfillment digital retention period for student photos and card layouts before purging.",
      defaultValue: "[PLACEHOLDER: 90 days following successful order delivery confirmation or academic session completion]",
    },
  ],
  sections: [
    {
      id: "introduction",
      number: "1",
      title: "Introduction and Scope",
      lead: "Welcome to Insight Education.",
      content: [
        "Insight Education [PLACEHOLDER: Legal Entity Form & Registration / CIN / GSTIN] ('Insight Education', 'we', 'us', or 'our'), located at AF-333, Rabindrapally, Talbagan, P.O. Prafulla Kanan, Kolkata-700101, West Bengal, India, operates the School ID Card Management Suite web portal, associated ordering systems, and manufacturing operations for institutional student and staff identification products.",
        "This Privacy Policy outlines how we collect, store, process, transfer, and safeguard personal information obtained through our website, software platform, and commercial fulfillment operations. It applies to all school administrators, staff members, partner vendors, and authorized visitors accessing our services.",
      ],
      callout: {
        type: "info",
        title: "Distinct Roles under Indian Law",
        text: "Under the Digital Personal Data Protection Act, 2023 (DPDP Act), educational institutions (Schools, Colleges, Academies) act as the primary 'Data Fiduciaries' who collect student and staff data and authorize its processing. Insight Education acts as a 'Data Processor' when handling student photos, rosters, and ID card records on behalf of and strictly upon the instructions of such institutions.",
      },
    },
    {
      id: "data-we-collect",
      number: "2",
      title: "Personal Information We Collect",
      lead: "We collect information in two distinct capacities: direct business account information and institutional school records.",
      subsections: [
        {
          id: "direct-account-data",
          number: "2.1",
          title: "Account and Administrative Contact Information (Direct Collection)",
          content: [
            "When school authorities, purchase managers, or channel partners register for an account, request a quotation, or place an order, we collect:",
          ],
          bullets: [
            "Official Contact Details: Name, official designation, school/college affiliation, institutional email address, phone number, and postal billing/dispatch address.",
            "Authentication Credentials: Usernames, encrypted passwords, session security tokens, and multi-factor verification tokens.",
            "Order and Commercial Records: Transaction histories, GSTIN details, purchase order references, invoices, dispatch receipts, and payment logs.",
            "Support and Inquiries: Records of correspondence via phone (+91 81008 79809), email (insiteducation@gmail.com), WhatsApp, or web inquiry forms.",
          ],
        },
        {
          id: "institutional-id-data",
          number: "2.2",
          title: "Institutional ID Card Data (Processed on Behalf of Schools)",
          content: [
            "To design, generate, verify, and physically manufacture ID cards, schools upload student and staff records into our portal via Excel/CSV spreadsheets or automated card requests. Such data typically includes:",
          ],
          bullets: [
            "Student Identity Attributes: Full name, admission number, roll number, academic class/grade, section, house/stream, date of birth, blood group, emergency guardian phone number, and residential address.",
            "Staff Identity Attributes: Full name, employee code, department, designation, blood group, emergency contact number, and joining year.",
            "Photographs and Visual Imagery: Portrait headshots of students and staff members uploaded for card printing and badge rendering.",
            "Cardholder Barcodes and QR Codes: Encoded identification numbers used by schools for library, attendance, transport, or cafeteria access.",
          ],
        },
        {
          id: "automated-technical-data",
          number: "2.3",
          title: "Technical and Usage Information (Automated Collection)",
          content: [
            "When users interact with our web portal, our servers automatically log essential technical data to maintain system stability, security, and session persistence:",
          ],
          bullets: [
            "Device and Connection Data: IP address, browser type and version, operating system, and screen resolution.",
            "Activity and Audit Logs: Timestamps of template modifications, batch approvals, card print triggers, and administrative login activities.",
            "Essential Cookies: Strictly functional session tokens necessary for authenticated access and portal security. We do not use third-party behavioral advertising trackers.",
          ],
        },
      ],
    },
    {
      id: "how-we-use-data",
      number: "3",
      title: "How We Use Personal Information",
      lead: "Insight Education uses collected data strictly for lawful, contractually authorized educational and business purposes.",
      content: [
        "We do not monetize, rent, or sell any personal data. All processing is carried out pursuant to valid contract, school authorization, or legitimate statutory compliance under Indian law.",
      ],
      bullets: [
        "Card Production & Fulfillment: Generating digital previews, print-ready layouts, thermal/re-transfer printing, glossy/matte lamination, sorting, assembling custom lanyards and holders, and packaging.",
        "School Approval Workflows: Providing school administrators with digital card proofing, correction, and approval interfaces before physical batch printing.",
        "Account & Security Administration: Authenticating school administrators and partner coordinators, auditing template edits, and preventing unauthorized portal access.",
        "Order Communication: Dispatching status updates, courier tracking numbers, delivery confirmations, and invoice documentation.",
        "Legal & Regulatory Compliance: Complying with statutory book-keeping under the Companies Act, GST enactments, and cyber incident logging as mandated by Indian authorities.",
      ],
    },
    {
      id: "student-minor-safeguards",
      number: "4",
      title: "Protection of Student and Minor Data (DPDP Act, 2023)",
      lead: "We recognize the heightened sensitivity of student information and children's data.",
      content: [
        "In accordance with Section 9 of the Digital Personal Data Protection Act, 2023 (DPDP Act):",
      ],
      bullets: [
        "Parental/Guardian Authorization: Educational institutions engaging Insight Education warrant that they have established lawful consent or legitimate parental/guardian authorization to collect and process children's personal records and portrait photographs for school identity purposes.",
        "No Behavioral Profiling or Tracking: Insight Education does not engage in tracking, behavioral monitoring, commercial profiling, or targeted advertising directed at students or minors.",
        "Purpose Limitation: Student photographs and identity attributes are processed solely for the specific, limited purpose of creating, verifying, printing, and delivering institutional identity cards and accessories.",
        "Restricted Production Access: Digital card print files are accessible only to authorized technicians engaged in the immediate printing and quality inspection workflow.",
      ],
    },
    {
      id: "data-sharing",
      number: "5",
      title: "Sharing and Disclosure of Information",
      lead: "Insight Education shares personal information solely on a need-to-know basis with trusted operational partners.",
      content: [
        "We never sell or trade institutional data. Disclosures are limited to the following operational categories:",
      ],
      subsections: [
        {
          id: "logistics-partners",
          number: "5.1",
          title: "Logistics and Courier Partners",
          content: [
            "We share the school name, delivery address, purchase manager contact number, and package count with registered domestic courier services (e.g., India Post, DTDC, Blue Dart, or local freight partners) solely to execute physical delivery of printed ID cards, lanyards, and accessories.",
          ],
        },
        {
          id: "cloud-infrastructure",
          number: "5.2",
          title: "Cloud Infrastructure and Hosting",
          content: [
            "Our web application, databases, and secure image storage are hosted with reputable cloud infrastructure providers operating secure server environments with data processing agreements ensuring encryption and high availability.",
          ],
        },
        {
          id: "statutory-obligations",
          number: "5.3",
          title: "Legal and Regulatory Authorities",
          content: [
            "We may disclose records if required to do so by a valid judicial summons, court order, law enforcement directive, or statutory obligation under the laws of the Republic of India.",
          ],
        },
      ],
    },
    {
      id: "security-measures",
      number: "6",
      title: "Data Security and Protection Measures",
      lead: "Insight Education maintains comprehensive administrative, technical, and physical safeguards in accordance with Rule 8 of the SPDI Rules and the DPDP Act.",
      bullets: [
        "Encryption in Transit: All data exchanged between user web browsers and our portal is encrypted using modern TLS (Transport Layer Security) protocols.",
        "Role-Based Access Control (RBAC): Portal access is strictly segmented between Super Admin, School Administrator, and Partner Coordinator roles. Users cannot access records belonging to other institutions.",
        "Physical Facility Security: Our printing, lamination, and card-slitting facility maintains physical access controls. Visitors and unauthorized personnel are barred from production and data processing zones.",
        "Secure Waste Disposal: Misprints, test cards, and setup alignment scraps containing student or staff personal data are securely shredded and destroyed before recycling/disposal.",
        "Incident Response: In the unlikely event of an information security breach impacting personal records, we maintain an incident response protocol to notify impacted institutions and regulatory authorities in accordance with applicable Indian law.",
      ],
    },
    {
      id: "data-retention",
      number: "7",
      title: "Data Retention and Disposal",
      lead: "We retain personal information only for as long as necessary to fulfill the intended educational and commercial purposes.",
      content: [
        "Digital student photographs, rosters, and completed card print queues are retained on our production systems for [PLACEHOLDER: Student Print Batch Data Retention Period]. Following this period, digital batch assets may be archived or permanently purged upon mutual agreement with the institution.",
        "Institutional account credentials, invoices, and audit logs are retained for statutory accounting and legal compliance periods required by the Income Tax Act, 1961 and GST regulations.",
      ],
    },
    {
      id: "data-principal-rights",
      number: "8",
      title: "Your Rights under Indian Law",
      lead: "Under the Digital Personal Data Protection Act, 2023, Data Principals possess specific rights regarding their personal data.",
      bullets: [
        "Right to Access: School administrative users may view and retrieve their registered account details, order history, and active template designs at any time via the portal.",
        "Right to Correction and Updating: School administrators may update, modify, or correct student or staff records prior to final card approval and production.",
        "Right to Erasure: Institutions may request the deletion of completed print batches and temporary student photographs in accordance with our School Service Agreement.",
        "Exercise of Student/Parent Rights: Because the educational institution is the primary Data Fiduciary, students or parents wishing to access, correct, or remove records should contact their respective school administration. Insight Education will promptly assist schools in fulfilling verified requests.",
      ],
    },
    {
      id: "grievance-redressal",
      number: "9",
      title: "Grievance Redressal and Contact Details",
      lead: "In compliance with the Information Technology Act, 2000 and the DPDP Act, 2023, Insight Education has appointed a Grievance Redressal Officer.",
      content: [
        "If you have any questions, concerns, or grievances regarding this Privacy Policy or the handling of your personal data, please contact our designated Grievance Officer:",
      ],
      subsections: [
        {
          id: "officer-details",
          number: "9.1",
          title: "Grievance Officer Information",
          content: [
            "Name: [PLACEHOLDER: Grievance Officer Full Name]",
            "Designation: Grievance Redressal Officer",
            "Entity: Insight Education",
            "Address: AF-333, Rabindrapally, Talbagan, P.O. Prafulla Kanan, Kolkata-700101, West Bengal, India",
            "Email: insiteducation@gmail.com / [PLACEHOLDER: Dedicated Grievance Email]",
            "Phone: +91 81008 79809",
            "Working Hours: Monday through Saturday, 9:30 AM to 6:30 PM IST",
          ],
        },
      ],
    },
    {
      id: "updates",
      number: "10",
      title: "Updates to this Policy",
      lead: "We may update this Privacy Policy from time to time to reflect technological improvements, operational practices, or statutory developments.",
      content: [
        "When changes are made, the 'Last Updated' date at the top of this policy will be revised. Material changes will be communicated via notice on our website or through an announcement banner within the School ID Card Management Suite.",
      ],
    },
  ],
};
