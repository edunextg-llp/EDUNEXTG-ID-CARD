import type { LegalDocument } from "./types";

export const dataProcessingAgreementData: LegalDocument = {
  id: "data-processing-agreement",
  title: "Data Processing Agreement (DPA)",
  shortTitle: "Data Processing Agreement",
  category: "Data Protection",
  version: "1.0",
  effectiveDate: "April 1, 2026",
  lastUpdated: "April 1, 2026",
  summary:
    "This Data Processing Agreement governs the processing of personal data (including student minor records, staff rosters, and identity photographs) by Insight Education on behalf of educational institutions, in strict compliance with India's Digital Personal Data Protection Act, 2023 (DPDP Act) and the Information Technology (Reasonable Security Practices and Procedures and Sensitive Personal Data or Information) Rules, 2011.",
  applicableLaw:
    "Digital Personal Data Protection Act, 2023 (DPDP Act, 2023); Information Technology Act, 2000; and Information Technology (Reasonable Security Practices and Procedures and Sensitive Personal Data or Information) Rules, 2011 (SPDI Rules).",
  jurisdiction: "Republic of India (Courts in Kolkata, West Bengal)",
  routePath: "/legal/data-processing-agreement",
  sourceReference:
    "Adapted from General-Legal/legal-templates (dpa-global and dpa-us templates under CC0 1.0 Universal license) and restructured to reflect India's DPDP Act 2023 Fiduciary-Processor framework for educational data.",
  placeholders: [
    {
      key: "[PLACEHOLDER: Institution / Data Fiduciary Full Legal Name]",
      description: "Name of the School, College, or Society acting as the Data Fiduciary.",
      defaultValue: "[PLACEHOLDER: Educational Institution Legal Name]",
    },
    {
      key: "[PLACEHOLDER: Institution Data Protection Officer / Admin Contact]",
      description: "Official contact person or DPO designated by the School.",
      defaultValue: "[PLACEHOLDER: School Data Protection Coordinator / Administrator]",
    },
    {
      key: "[PLACEHOLDER: Incident Notification Window]",
      description: "Timeframe within which Insight Education must inform the School of a verified personal data breach.",
      defaultValue: "[PLACEHOLDER: Without undue delay and within 48 to 72 hours of verification]",
    },
    {
      key: "[PLACEHOLDER: Post-Fulfillment Data Purging Period]",
      description: "Number of days following physical delivery confirmation before digital student photo assets are purged.",
      defaultValue: "[PLACEHOLDER: 60 to 90 calendar days following delivery sign-off, or end of academic session]",
    },
    {
      key: "[PLACEHOLDER: Approved Sub-Processors Schedule]",
      description: "List of authorized cloud hosting providers, database services, and domestic courier networks.",
      defaultValue: "[PLACEHOLDER: Designated Cloud Hosting Provider, SMS Gateway, Domestic Courier Logistics Partners]",
    },
  ],
  sections: [
    {
      id: "context-and-purpose",
      number: "1",
      title: "Context, Scope, and Legal Foundation",
      lead: "This Data Processing Agreement ('DPA') supplements the Master Services Agreement / School Service Agreement entered into between Insight Education and the School.",
      content: [
        "WHEREAS: The School collects personal data concerning students (including minors), faculty, and administrative staff, and engages Insight Education to provide web portal management, template composition, and physical card printing and manufacturing services; and",
        "WHEREAS: The parties seek to ensure that all processing of personal data complies strictly with the Digital Personal Data Protection Act, 2023 (DPDP Act) and the Information Technology Act, 2000 of India.",
      ],
      callout: {
        type: "info",
        title: "Statutory Classification under DPDP Act, 2023",
        text: "The School acts as the 'Data Fiduciary' that determines the purpose and means of processing student and staff records. Insight Education acts as the 'Data Processor' that processes such personal data solely on behalf of and under the documented instructions of the School.",
      },
    },
    {
      id: "definitions",
      number: "2",
      title: "Definitions",
      bullets: [
        "'Applicable Data Protection Laws': The Digital Personal Data Protection Act, 2023, the Information Technology Act, 2000, the SPDI Rules, 2011, and any rules or notifications enacted thereunder by the Government of India.",
        "'Data Fiduciary': The School or educational entity that determines the purpose and means of processing personal data.",
        "'Data Processor': Insight Education, which processes personal data on behalf of the Data Fiduciary.",
        "'Data Principal': The individual to whom the personal data relates, including students, teaching staff, and emergency contacts / parents.",
        "'Personal Data': Any data about an individual who is identifiable by or in relation to such data, including names, admission numbers, dates of birth, blood groups, addresses, telephone numbers, and portrait photographs.",
        "'Personal Data Breach': Any unauthorized processing, accidental disclosure, acquisition, sharing, alteration, destruction, or loss of access to personal data that compromises confidentiality, integrity, or availability.",
      ],
    },
    {
      id: "details-of-processing",
      number: "3",
      title: "Details and Boundaries of Processing",
      subsections: [
        {
          id: "subject-matter-purpose",
          number: "3.1",
          title: "Subject Matter and Specific Purpose",
          content: [
            "The subject matter of data processing encompasses the intake of institutional rosters and photos, electronic proof composition, barcode encoding, thermal/re-transfer printing on PVC cards, lamination, sorting, and courier dispatch of identity products.",
            "Insight Education shall not process personal data for any purpose other than fulfilling the specific services commissioned by the School, except where strictly required by applicable Indian law.",
          ],
        },
        {
          id: "categories-of-data",
          number: "3.2",
          title: "Categories of Data Principals and Personal Data",
          bullets: [
            "Data Principals: Enrolled students (including minors under 18 years of age), faculty, administrative personnel, and parent/guardian emergency contacts.",
            "Data Fields: Student/Staff full name, admission/roll number, employee ID, class/grade, section, date of birth, blood group, emergency contact telephone numbers, residential address, and facial portrait photographs.",
          ],
        },
      ],
    },
    {
      id: "children-minor-data-obligations",
      number: "4",
      title: "Special Obligations Regarding Children's Data (Section 9 DPDP Act)",
      lead: "Special safeguards apply to data belonging to student minors.",
      bullets: [
        "Parental Consent Representation: The School, as Data Fiduciary, covenants and warrants that it has secured verifiable consent from parents or lawful guardians prior to uploading student minor records and photographs into the Portal.",
        "Prohibition of Behavioral Profiling: Insight Education shall not undertake tracking, behavioral monitoring, or commercial profiling of student minors, nor shall it direct any promotional or marketing communications toward students.",
        "Harm Prevention: Processing shall be conducted in a manner that causes no detrimental effect on the well-being of student minors.",
      ],
    },
    {
      id: "processor-obligations",
      number: "5",
      title: "Obligations of Insight Education (Data Processor)",
      subsections: [
        {
          id: "instruction-compliance",
          number: "5.1",
          title: "Compliance with Documented Instructions",
          content: [
            "Insight Education shall process personal data solely in accordance with the documented instructions of the School (including electronically submitted card print requests via the Portal) unless required otherwise by Indian statutory authorities.",
          ],
        },
        {
          id: "personnel-confidentiality",
          number: "5.2",
          title: "Personnel Confidentiality",
          content: [
            "Insight Education ensures that all operators, prepress designers, printing technicians, and packing staff who have access to personal data are bound by strict contractual confidentiality undertakings and trained on data privacy standards.",
          ],
        },
        {
          id: "rights-assistance",
          number: "5.3",
          title: "Assistance with Data Principal Rights",
          content: [
            "Taking into account the nature of processing, Insight Education shall assist the School through appropriate technical and organizational tools in responding to requests by Data Principals (or parents) exercising their statutory rights of access, correction, updating, or erasure under the DPDP Act.",
          ],
        },
      ],
    },
    {
      id: "technical-organizational-security",
      number: "6",
      title: "Technical and Organizational Security Measures (TOMs)",
      lead: "Insight Education maintains rigorous technical, administrative, and physical security measures:",
      bullets: [
        "Network & Portal Security: TLS 1.2+ encryption for all data in transit, firewalls, and role-based access control (RBAC) ensuring tenant isolation between schools.",
        "Physical Print Facility Safeguards: Secure, locked production rooms for card printing and personalization equipment. Strict prohibition of unauthorized photography or personal mobile phone use in active printing zones.",
        "Destruction of Production Waste: Physical test prints, calibration cards, misprints, and trimming waste containing personal data are cross-cut shredded or mechanically destroyed daily prior to recycling.",
        "Image Asset Protection: Uploaded student portrait photos are stored in private, authenticated cloud storage buckets accessible only via time-limited secure tokens during layout rendering.",
      ],
    },
    {
      id: "sub-processors",
      number: "7",
      title: "Sub-processors and Logistics Networks",
      content: [
        "The School provides general written authorization for Insight Education to engage reputable sub-processors strictly necessary for cloud infrastructure and domestic courier dispatch [PLACEHOLDER: Approved Sub-Processors Schedule].",
        "Insight Education shall impose data protection terms on each sub-processor that are no less protective than those set forth in this DPA. Insight Education remains fully responsible to the School for the performance of its sub-processors' data protection obligations.",
      ],
    },
    {
      id: "incident-management-notification",
      number: "8",
      title: "Personal Data Breach Notification",
      callout: {
        type: "warning",
        title: "Breach Notification Protocol",
        text: "In the event of a confirmed Personal Data Breach impacting the School's records, Insight Education shall notify the School [PLACEHOLDER: Incident Notification Window].",
      },
      content: [
        "Such notification shall describe the nature of the breach, estimated categories of Data Principals impacted, likely consequences, and the mitigation measures implemented or recommended to contain the incident.",
        "Insight Education shall provide reasonable cooperation to enable the School to fulfill any breach reporting obligations to the Data Protection Board of India or affected Data Principals as mandated under the DPDP Act, 2023.",
      ],
    },
    {
      id: "data-retention-deletion",
      number: "9",
      title: "Post-Fulfillment Return and Deletion of Data",
      content: [
        "Upon completion of order fulfillment and delivery sign-off, or upon termination of the Master Services Agreement, digital rosters and student photographs shall be retained only for [PLACEHOLDER: Post-Fulfillment Data Purging Period] to facilitate re-prints or replacement cards requested by the School.",
        "Following the expiration of this retention window, or upon the School's written request, Insight Education shall securely delete or irreversibly anonymize all digital personal records from its active databases, confirming deletion upon request.",
      ],
    },
    {
      id: "audit-rights",
      number: "10",
      title: "Audits and Compliance Verification",
      content: [
        "Upon reasonable advance written notice of at least fifteen (15) business days, Insight Education shall make available to the School documentation reasonably necessary to demonstrate compliance with its obligations under this DPA.",
        "Any on-site verification at the card manufacturing facility shall take place during regular business hours without disrupting active production schedules and subject to customary confidentiality and physical safety protocols.",
      ],
    },
    {
      id: "governing-law-jurisdiction",
      number: "11",
      title: "Governing Law and Dispute Resolution",
      content: [
        "This DPA is governed by the laws of the Republic of India, specifically the Digital Personal Data Protection Act, 2023 and the Information Technology Act, 2000.",
        "Any legal disputes arising out of or in connection with this DPA shall be subject to the exclusive jurisdiction of the competent courts in Kolkata, West Bengal, India, in alignment with the dispute resolution framework of the Master Services Agreement.",
      ],
    },
  ],
  annexures: [
    {
      id: "annexure-1-processing-details",
      title: "Schedule 1: Technical & Organizational Security Controls Summary",
      content: [
        "The following controls are maintained by Insight Education throughout the card manufacturing lifecycle:",
      ],
      items: [
        { label: "Data Transit Encryption", value: "TLS 1.2 / TLS 1.3 encryption across all web portal endpoints" },
        { label: "Tenant Segregation", value: "Logical database separation and tenant ID query filters" },
        { label: "Physical Production Access", value: "Keycard-controlled access to card personalization and printing bays" },
        { label: "Misprint Waste Disposal", value: "Cross-cut destruction and industrial shredding of discarded cards" },
        { label: "Staff Training & NDA", value: "Signed confidentiality agreements and annual privacy hygiene training" },
      ],
    },
  ],
};
