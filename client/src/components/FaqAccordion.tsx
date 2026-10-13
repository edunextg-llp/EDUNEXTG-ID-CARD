import React, { useState, useId } from "react";
import { ChevronDown } from "lucide-react";

export interface FaqItem {
  id: string;
  question: string;
  answer: string;
}

export const DEFAULT_FAQ_ITEMS: FaqItem[] = [
  {
    id: "turnaround-time",
    question: "What is your turnaround time for ID card printing and dispatch?",
    answer:
      "Standard school ID card orders typically print and dispatch within 3–5 business days following final digital proof approval. For peak academic re-opening periods or urgent requirements, expedited scheduling is available [FILL IN: specific rush turnaround options and cutoff deadlines].",
  },
  {
    id: "minimum-order-quantity",
    question: "What is the minimum order quantity (MOQ) for institutional orders?",
    answer:
      "We cater to institutions of all sizes, with minimum batch orders starting at [FILL IN: minimum order quantity, e.g., 25 or 50 cards]. Supplemental admissions and mid-session re-orders can be processed in smaller counts.",
  },
  {
    id: "photo-requirements",
    question: "What photo specifications and formats do you require?",
    answer:
      "Photographs should be clear passport-style portraits against a plain, light background in JPEG or PNG format (minimum 300 DPI recommended). Images should ideally be named by student roll number, admission number, or unique ID for automated database mapping.",
  },
  {
    id: "bulk-excel-upload",
    question: "Can we submit student and staff records via bulk Excel upload?",
    answer:
      "Yes. Our platform provides a standardized downloadable Excel (.xlsx) template. Administrators can paste student names, classes, roll numbers, blood groups, and guardian emergency contacts for instant bulk upload and automated preview generation.",
  },
  {
    id: "reprints-and-corrections",
    question: "How are mid-year reprints and data corrections managed?",
    answer:
      "Replacements for damaged or lost cards, updated photos, or transfer students can be submitted directly through the portal or via our support team. Batch reprints follow [FILL IN: reprint policy, replacement fee schedule, and turnaround].",
  },
  {
    id: "delivery-areas",
    question: "Which delivery areas and states across India do you serve?",
    answer:
      "We provide pan-India delivery across all states and union territories via reputed logistics partners with real-time tracking [FILL IN: specific regional transit durations and delivery partners].",
  },
];

interface FaqAccordionProps {
  items?: FaqItem[];
  allowMultiple?: boolean;
  className?: string;
  title?: string;
  subtitle?: string;
}

export default function FaqAccordion({
  items = DEFAULT_FAQ_ITEMS,
  allowMultiple = false,
  className = "",
  title = "Frequently Asked Questions",
  subtitle = "Everything school administrators and institutional purchase teams need to know about our identity card solutions.",
}: FaqAccordionProps) {
  const baseId = useId();
  // Store either a single open ID or a set of open IDs
  const [openIds, setOpenIds] = useState<string[]>(["turnaround-time"]);

  const toggleItem = (id: string) => {
    if (allowMultiple) {
      setOpenIds((prev) =>
        prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
      );
    } else {
      setOpenIds((prev) => (prev.includes(id) ? [] : [id]));
    }
  };

  // Structured Data (FAQPage JSON-LD)
  const faqSchema = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: items.map((item) => ({
      "@type": "Question",
      name: item.question,
      acceptedAnswer: {
        "@type": "Answer",
        text: item.answer,
      },
    })),
  };

  return (
    <section className={`lp-faq-section ${className}`} aria-labelledby={`${baseId}-faq-heading`}>
      {/* Schema.org FAQPage JSON-LD */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(faqSchema) }}
      />

      <div className="lp-container">
        <div className="lp-section-title">
          <span className="line" />
          <h2 id={`${baseId}-faq-heading`} className="font-heading">
            {title}
          </h2>
          <span className="line" />
        </div>
        {subtitle && <p className="lp-faq-subtitle">{subtitle}</p>}

        <div className="lp-faq-list" role="presentation">
          {items.map((item, index) => {
            const isOpen = openIds.includes(item.id);
            const questionId = `${baseId}-q-${item.id}`;
            const panelId = `${baseId}-p-${item.id}`;

            return (
              <div key={item.id} className="lp-faq-item">
                <h3>
                  <button
                    type="button"
                    id={questionId}
                    className="lp-faq-trigger"
                    aria-expanded={isOpen}
                    aria-controls={panelId}
                    onClick={() => toggleItem(item.id)}
                  >
                    <span className="lp-faq-question-text">
                      <span className="lp-faq-index font-bold">{String(index + 1).padStart(2, "0")}.</span>
                      {item.question}
                    </span>
                    <ChevronDown
                      size={20}
                      className={`lp-faq-chevron ${isOpen ? "open" : ""}`}
                      aria-hidden="true"
                    />
                  </button>
                </h3>

                <div
                  id={panelId}
                  role="region"
                  aria-labelledby={questionId}
                  data-open={isOpen ? "true" : "false"}
                  className="lp-faq-panel"
                >
                  <div className="lp-faq-content">
                    <p>{item.answer}</p>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
