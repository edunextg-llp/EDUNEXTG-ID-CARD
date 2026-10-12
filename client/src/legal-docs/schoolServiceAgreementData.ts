import type { LegalDocument } from "./types";

export const schoolServiceAgreementData: LegalDocument = {
  id: "school-service-agreement",
  title: "School Service Agreement / Master Services Agreement (MSA)",
  shortTitle: "School Service Agreement",
  category: "Institutional Agreement",
  version: "1.0",
  effectiveDate: "April 1, 2026",
  lastUpdated: "April 1, 2026",
  summary:
    "This Master Services Agreement establishes the terms and conditions under which Insight Education provides its School ID Card Management Suite software platform, digital proofing workflows, and specialized physical manufacturing and supply of student and staff ID cards, custom lanyards, holders, and badge accessories to educational institutions across India.",
  applicableLaw:
    "Indian Contract Act, 1872; Arbitration and Conciliation Act, 1996; Information Technology Act, 2000; and Digital Personal Data Protection Act, 2023.",
  jurisdiction: "Republic of India (Arbitration and Courts in Kolkata, West Bengal)",
  routePath: "/legal/school-service-agreement",
  sourceReference:
    "Adapted from General-Legal/legal-templates (master-services-agreement template under CC0 1.0 Universal license) and tailored for school institutional ID card manufacturing and software services.",
  placeholders: [
    {
      key: "[PLACEHOLDER: Institution Full Legal Name & Society / Trust]",
      description: "Official legal name of the educational institution and its operating trust or society.",
      defaultValue: "[PLACEHOLDER: Name of Educational Institution / School Society]",
    },
    {
      key: "[PLACEHOLDER: Institution Campus & Registered Address]",
      description: "Full postal address of the institution campus and administrative office.",
      defaultValue: "[PLACEHOLDER: Complete Campus Address, City, State, PIN]",
    },
    {
      key: "[PLACEHOLDER: Agreement Effective Date]",
      description: "The execution or effective commencement date of the agreement.",
      defaultValue: "[PLACEHOLDER: Effective Date, e.g., 1st day of April 2026]",
    },
    {
      key: "[PLACEHOLDER: Agreement Term / Academic Sessions Covered]",
      description: "Duration of the agreement (e.g., 1 academic year or 3 consecutive academic years).",
      defaultValue: "[PLACEHOLDER: Initial Term of One (1) Academic Session, renewable annually]",
    },
    {
      key: "[PLACEHOLDER: Institutional Payment Terms & Credit Period]",
      description: "Payment terms negotiated with the institution (e.g., 50% advance, Net 15 days upon delivery).",
      defaultValue: "[PLACEHOLDER: 50% advance upon digital proof approval, balance within 15 days of verified delivery]",
    },
    {
      key: "[PLACEHOLDER: Card Durability Warranty Period]",
      description: "Warranty period against print fading or lamination peeling under normal student wear.",
      defaultValue: "[PLACEHOLDER: Six (6) Months / Current Academic Year from date of delivery]",
    },
    {
      key: "[PLACEHOLDER: Authorized Signatory - School Representative]",
      description: "Name and designation of school principal, trustee, or purchase director.",
      defaultValue: "[PLACEHOLDER: Principal / Secretary / Director of Institution]",
    },
    {
      key: "[PLACEHOLDER: Authorized Signatory - Insight Education]",
      description: "Name and designation of Insight Education authorized representative.",
      defaultValue: "[PLACEHOLDER: Authorized Signatory, Insight Education]",
    },
  ],
  sections: [
    {
      id: "parties-and-recitals",
      number: "1",
      title: "Parties and Recitals",
      lead: "This Master Services Agreement ('Agreement') is made and entered into as of [PLACEHOLDER: Agreement Effective Date].",
      content: [
        "BETWEEN: Insight Education, an Indian identity solutions enterprise having its principal operational office at AF-333, Rabindrapally, Talbagan, P.O. Prafulla Kanan, Kolkata-700101, West Bengal, India (hereinafter referred to as the 'Service Provider' or 'Insight Education', which expression shall include its successors and permitted assigns);",
        "AND: [PLACEHOLDER: Institution Full Legal Name & Society / Trust], located at [PLACEHOLDER: Institution Campus & Registered Address] (hereinafter referred to as the 'School' or 'Institution', which expression shall include its administrative representatives, successors, and permitted assigns).",
        "WHEREAS: The School desires to engage Insight Education for the comprehensive provision of institutional identification services, including web-based card data management, template customization, and high-quality physical printing, fabrication, and supply of student and staff ID cards, lanyards, holders, and accessories; and",
        "WHEREAS: Insight Education possesses the requisite infrastructure, software suite, manufacturing facilities, and expertise, and agrees to provide such services subject to the terms and conditions set forth herein.",
      ],
    },
    {
      id: "definitions",
      number: "2",
      title: "Definitions and Interpretation",
      bullets: [
        "'Access Protocols': Login credentials, user authentication keys, and security permissions provided to School administrators to access the Portal.",
        "'Card Specifications': Physical dimensions (CR80 standard), PVC thickness, finish (glossy/matte), lamination grade, chip/barcode encoding, and lanyard material attributes specified in Work Orders.",
        "'Digital Proof': The rendered electronic preview generated by the Portal depicting final card layout, typography, school crest, student/staff photograph, and variable textual fields.",
        "'Institutional Data': All student rosters, employee lists, photographs, logos, and identity attributes provided by the School for card manufacturing.",
        "'Portal': The cloud-based School ID Card Management Suite hosted and maintained by Insight Education.",
        "'Work Order / Purchase Order': A formalized document or portal-generated order specifying exact card quantities, accessory bundles, delivery deadlines, and agreed unit rates.",
      ],
    },
    {
      id: "scope-of-services",
      number: "3",
      title: "Scope of Services and Deliverables",
      subsections: [
        {
          id: "saas-access",
          number: "3.1",
          title: "Portal Access and Template Customization",
          content: [
            "Insight Education grants the School a non-exclusive, non-transferable license to access the School ID Card Management Suite. The Portal enables the School to:",
          ],
          bullets: [
            "Upload student and staff demographic records and portrait photographs in bulk via standardized spreadsheets or individual card requests.",
            "Customize and preview card templates featuring institutional branding, safety guidelines, and barcode schemas.",
            "Review, approve, or reject digital card proofs with real-time audit tracking.",
            "Monitor live order fulfillment, batch packaging, and courier dispatch stages.",
          ],
        },
        {
          id: "physical-manufacturing",
          number: "3.2",
          title: "Physical Manufacturing and Supply",
          content: [
            "Insight Education shall manufacture and supply identification products meeting the following standards:",
          ],
          bullets: [
            "PVC Identity Cards: High-grade virgin PVC CR80 cards with durable heat-laminated overlays, high-definition thermal or re-transfer printing, and scratch-resistant finishes.",
            "Custom Printed Lanyards: Satin ribbon or woven polyester lanyards custom-printed with school name and logo via multi-color sublimation or screen printing, fitted with premium metal dog-hooks or alligator clamps.",
            "Holders and Badges: Transparent rigid/semi-rigid acrylic or molded PVC holders and safety release breakaways as requested.",
          ],
        },
      ],
    },
    {
      id: "ordering-and-approval-workflow",
      number: "4",
      title: "Ordering Workflow, Digital Proofing, and Turnaround",
      content: [
        "Fulfillment under this Agreement proceeds through an orderly four-step workflow:",
      ],
      bullets: [
        "Step 1: Data Ingestion — School uploads verified student and staff rosters and corresponding photo files into the Portal.",
        "Step 2: Proof Generation & Review — Insight Education generates digital card proofs. The School conducts inspection and records digital approval via the Portal.",
        "Step 3: Manufacturing & Quality Check — Upon digital sign-off, cards enter the physical press run, lamination, die-cutting, accessory assembly, and quality grading.",
        "Step 4: Packaging & Delivery — Consignments are packed by grade/class/section for effortless institutional distribution, accompanied by a packing slip and dispatched via secure logistics.",
      ],
      callout: {
        type: "note",
        title: "Proof Sign-off Responsibility",
        text: "Digital proof approval by the School constitutes the definitive authorization for printing. Insight Education is not responsible for typographical errors, misspelled names, or incorrect dates of birth that were accurately printed as approved in the digital proof.",
      },
    },
    {
      id: "institution-responsibilities",
      number: "5",
      title: "Institution Responsibilities and Legal Authorizations",
      bullets: [
        "Timely Provision of Records: The School shall furnish complete, high-resolution photographs and clean data spreadsheets in accordance with the agreed academic calendar onboarding schedule.",
        "Parental and Legal Consents: The School represents that it has complied with all statutory requirements under the Digital Personal Data Protection Act, 2023 (DPDP Act) and has obtained appropriate parental or guardian consent to process student minor information.",
        "Trademark & Crest Licensing: The School grants Insight Education the authorization to reproduce school logos, crests, and emblems solely for executing orders under this Agreement.",
      ],
    },
    {
      id: "commercial-terms-invoicing",
      number: "6",
      title: "Pricing, Invoicing, and Payment Schedule",
      bullets: [
        "Contract Rates: Product pricing is governed by the Schedule of Rates attached hereto as Annexure A or as established in executed Work Orders.",
        "Taxes: All rates are subject to Goods and Services Tax (GST) as applicable under Indian statute at the time of invoicing.",
        "Payment Terms: Unless otherwise specified in a Work Order, invoices are payable as follows: [PLACEHOLDER: Institutional Payment Terms & Credit Period].",
        "Tax Deducted at Source (TDS): If the School is required by the Income Tax Act, 1961 to deduct tax at source from payments, the School shall furnish requisite Form 16A certificates in a timely manner.",
      ],
    },
    {
      id: "confidentiality-data-protection",
      number: "7",
      title: "Confidentiality and Data Protection",
      content: [
        "Each party agrees that all commercial, technical, and institutional information disclosed hereunder shall be maintained in strict confidence.",
        "With respect to student and staff personal data, the parties shall strictly adhere to the terms of the companion Data Processing Agreement (DPA) executed concurrently herewith, which is incorporated by reference into this Agreement.",
      ],
    },
    {
      id: "warranties-quality-assurance",
      number: "8",
      title: "Warranties, Replacements, and Defect Redressal",
      content: [
        "Insight Education warrants that all delivered ID cards and accessories will be free from material defects in materials and workmanship for a period of [PLACEHOLDER: Card Durability Warranty Period] from the date of delivery.",
        "In the event of manufacturing defects (such as premature surface peeling, lamination bubbles, or faded dye under normal indoor student use), Insight Education shall reprint and deliver replacement cards within seven (7) business days of verified notification at no cost to the School.",
      ],
    },
    {
      id: "limitation-of-liability",
      number: "9",
      title: "Limitation of Liability",
      callout: {
        type: "warning",
        title: "Aggregate Liability Cap",
        text: "Except for breaches of confidentiality, data protection obligations under the DPA, or gross negligence, neither party's aggregate cumulative liability arising out of this Agreement shall exceed the total fees paid or payable by the School to Insight Education during the academic session in which the liability arose.",
      },
    },
    {
      id: "term-and-termination",
      number: "10",
      title: "Term, Renewal, and Termination",
      content: [
        "This Agreement shall commence on the Effective Date and shall continue for [PLACEHOLDER: Agreement Term / Academic Sessions Covered] unless terminated earlier in accordance with this Section.",
        "Either party may terminate this Agreement for material breach if such breach remains uncured for thirty (30) days following receipt of detailed written notice.",
        "Upon termination or expiration, Insight Education shall fulfill pending approved Work Orders, settle outstanding invoices, and return or securely delete digital school rosters in accordance with the DPA.",
      ],
    },
    {
      id: "dispute-resolution-jurisdiction",
      number: "11",
      title: "Governing Law and Arbitration",
      content: [
        "This Agreement shall be governed by, construed, and enforced in accordance with the laws of the Republic of India.",
        "Any dispute, controversy, or claim arising out of or relating to this Agreement shall be referred to and finally resolved by arbitration in Kolkata, West Bengal, in accordance with the Arbitration and Conciliation Act, 1996. The arbitration tribunal shall consist of a sole arbitrator mutually appointed by the parties. The language of arbitration shall be English.",
        "Subject to arbitration, the courts situated in Kolkata, West Bengal shall have exclusive jurisdiction over any legal proceedings arising out of this Agreement.",
      ],
    },
    {
      id: "execution-block",
      number: "12",
      title: "Execution and Signatures",
      lead: "IN WITNESS WHEREOF, the parties hereto have caused this Master Services Agreement to be executed by their duly authorized representatives.",
      content: [
        "For Insight Education:",
        "Signature: __________________________",
        "Name: [PLACEHOLDER: Authorized Signatory - Insight Education]",
        "Title: Authorized Representative",
        "Date: __________________________",
        "",
        "For Educational Institution:",
        "Signature: __________________________",
        "Name: [PLACEHOLDER: Authorized Signatory - School Representative]",
        "Title: Principal / Administrator / Trustee",
        "Institution: [PLACEHOLDER: Institution Full Legal Name & Society / Trust]",
        "Date: __________________________",
      ],
    },
  ],
  annexures: [
    {
      id: "annexure-a-pricing",
      title: "Annexure A: Product Specifications & Indicative Rate Schedule",
      description: "Subject to specific volume tiers established in individual Work Orders",
      content: [
        "The following specifications and standard unit rate structures apply to institutional orders under this Agreement:",
      ],
      items: [
        { label: "Standard Student PVC Card (CR80, 30 Mil, High-Gloss Finish)", value: "[PLACEHOLDER: Unit Rate per card, e.g., ₹25 – ₹45 depending on order volume]" },
        { label: "Faculty / Staff ID Card (CR80, High-Definition Re-transfer / Matte)", value: "[PLACEHOLDER: Unit Rate per staff card, e.g., ₹35 – ₹60]" },
        { label: "Custom Satin Lanyard (16mm / 20mm with Multi-color Sublimation)", value: "[PLACEHOLDER: Unit Rate per lanyard, e.g., ₹18 – ₹32]" },
        { label: "Rigid Plastic / Acrylic ID Card Holder (Horizontal / Vertical)", value: "[PLACEHOLDER: Unit Rate per holder, e.g., ₹8 – ₹15]" },
        { label: "Standard Production SLA (From Proof Sign-Off to Dispatch)", value: "7 to 10 Business Days (Off-peak) / 12 to 14 Business Days (Peak Season)" },
      ],
    },
  ],
};
