export interface LegalSection {
  id: string;
  number?: string;
  title: string;
  lead?: string;
  content?: string[];
  subsections?: {
    id: string;
    number?: string;
    title: string;
    content?: string[];
    bullets?: string[];
  }[];
  bullets?: string[];
  callout?: {
    type: "info" | "warning" | "note";
    title?: string;
    text: string;
  };
}

export interface LegalPlaceholder {
  key: string;
  description: string;
  defaultValue?: string;
}

export interface LegalAnnexure {
  id: string;
  title: string;
  description?: string;
  content: string[];
  items?: { label: string; value: string }[];
}

export interface LegalDocument {
  id: string;
  title: string;
  shortTitle: string;
  category: "Public Policy" | "Institutional Agreement" | "Data Protection";
  version: string;
  effectiveDate: string;
  lastUpdated: string;
  summary: string;
  applicableLaw: string;
  jurisdiction: string;
  routePath: string;
  sourceReference: string;
  sections: LegalSection[];
  placeholders: LegalPlaceholder[];
  annexures?: LegalAnnexure[];
}
