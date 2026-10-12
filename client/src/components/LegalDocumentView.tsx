import React, { useState, useId } from "react";
import type { LegalDocument, LegalSection } from "@/legal-docs/types";
import {
  FileText,
  Printer,
  ShieldCheck,
  Scale,
  Calendar,
  AlertTriangle,
  Info,
  ChevronRight,
  AlertCircle,
  ExternalLink,
} from "lucide-react";
import { Link } from "wouter";

interface LegalDocumentViewProps {
  document: LegalDocument;
  showAdminHeader?: boolean;
  onOpenStandalone?: () => void;
}

export default function LegalDocumentView({
  document: doc,
  showAdminHeader = false,
  onOpenStandalone,
}: LegalDocumentViewProps) {
  const [highlightPlaceholders, setHighlightPlaceholders] = useState(true);
  const baseId = useId();

  const handlePrint = () => {
    window.print();
  };

  const renderWithPlaceholders = (text: string) => {
    if (!highlightPlaceholders) return text;
    // Replace [PLACEHOLDER: ...] with visually distinct badge
    const parts = text.split(/(\[PLACEHOLDER:[^\]]+\])/g);
    return parts.map((part, index) => {
      if (part.startsWith("[PLACEHOLDER:") && part.endsWith("]")) {
        return (
          <span
            key={`${baseId}-ph-${index}`}
            className="inline-flex items-center px-2 py-0.5 mx-0.5 rounded-md text-[12px] font-mono font-medium bg-amber-100 text-amber-900 border border-amber-300 dark:bg-amber-950/70 dark:text-amber-200 dark:border-amber-800 select-all"
            title="Action required: Replace this placeholder with specific business or institution data"
          >
            {part}
          </span>
        );
      }
      return part;
    });
  };

  return (
    <div className="legal-doc-container">
      {/* ── Action Toolbar ── */}
      <div className="flex flex-wrap items-center justify-between gap-3 p-4 mb-8 rounded-xl bg-slate-50 border border-slate-200 dark:bg-slate-900/60 dark:border-slate-800 shadow-xs print:hidden">
        <div className="flex flex-wrap items-center gap-2">
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800">
            <ShieldCheck className="w-3.5 h-3.5" />
            {doc.category}
          </span>
          <span className="text-xs text-slate-500 dark:text-slate-400">
            Version {doc.version} · Updated {doc.lastUpdated}
          </span>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => setHighlightPlaceholders((prev) => !prev)}
            className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg transition-colors border ${
              highlightPlaceholders
                ? "bg-amber-50 text-amber-800 border-amber-300 dark:bg-amber-950/50 dark:text-amber-300 dark:border-amber-700"
                : "bg-white text-slate-600 border-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-700 hover:bg-slate-50"
            }`}
            title="Toggle yellow highlight for placeholders requiring input"
          >
            <AlertCircle className="w-3.5 h-3.5" />
            {highlightPlaceholders ? "Placeholders Highlighted" : "Highlight Placeholders"}
            {doc.placeholders.length > 0 && (
              <span className="ml-1 px-1.5 py-0.2 rounded-full text-[10px] bg-amber-200 dark:bg-amber-900 font-bold">
                {doc.placeholders.length}
              </span>
            )}
          </button>

          <button
            type="button"
            onClick={handlePrint}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg bg-emerald-600 text-white hover:bg-emerald-700 transition-colors shadow-xs"
          >
            <Printer className="w-3.5 h-3.5" />
            Print
          </button>

          {onOpenStandalone && (
            <button
              type="button"
              onClick={onOpenStandalone}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg bg-slate-900 text-white dark:bg-slate-100 dark:text-slate-900 hover:opacity-90 transition-opacity"
            >
              <ExternalLink className="w-3.5 h-3.5" />
              Standalone View
            </button>
          )}
        </div>
      </div>

      {/* ── Document Metadata Box ── */}
      <div className="p-5 mb-8 rounded-xl bg-emerald-50/60 border border-emerald-200/80 dark:bg-emerald-950/20 dark:border-emerald-900/40">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs">
          <div>
            <span className="font-semibold text-emerald-900 dark:text-emerald-300 block mb-0.5">
              Governing Jurisdiction
            </span>
            <span className="text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
              <Scale className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
              {doc.jurisdiction}
            </span>
          </div>

          <div>
            <span className="font-semibold text-emerald-900 dark:text-emerald-300 block mb-0.5">
              Applicable Statute
            </span>
            <span className="text-slate-700 dark:text-slate-300 leading-relaxed">
              {doc.applicableLaw}
            </span>
          </div>

          <div>
            <span className="font-semibold text-emerald-900 dark:text-emerald-300 block mb-0.5">
              Source & Licensing
            </span>
            <span className="text-slate-700 dark:text-slate-300 leading-relaxed">
              Adapted from <span className="font-medium">General Legal</span> (CC0 1.0 Universal) for Insight Education.
            </span>
          </div>
        </div>

        {/* Document Executive Summary */}
        <p className="mt-4 pt-3 border-t border-emerald-200/60 dark:border-emerald-900/40 text-xs text-slate-700 dark:text-slate-300 leading-relaxed">
          <strong className="text-emerald-900 dark:text-emerald-200">Executive Summary: </strong>
          {renderWithPlaceholders(doc.summary)}
        </p>
      </div>

      {/* ── Placeholders Guide Notice ── */}
      {doc.placeholders.length > 0 && highlightPlaceholders && (
        <div className="mb-8 p-4 rounded-xl border border-amber-200 bg-amber-50/70 dark:bg-amber-950/20 dark:border-amber-900/40 print:hidden">
          <div className="flex items-start gap-3">
            <AlertTriangle className="w-4 h-4 text-amber-600 dark:text-amber-400 mt-0.5 shrink-0" />
            <div className="space-y-1">
              <h4 className="text-xs font-bold uppercase tracking-wider text-amber-900 dark:text-amber-200">
                Action Required: Customization Placeholders ({doc.placeholders.length})
              </h4>
              <p className="text-xs text-amber-800/90 dark:text-amber-300/90 leading-relaxed">
                The following specific items are bracketed with <code className="font-mono text-[11px] bg-amber-100 dark:bg-amber-900/60 px-1 py-0.5 rounded">[PLACEHOLDER: ...]</code> and require actual business or institutional values before executing binding contracts:
              </p>
              <ul className="mt-2 grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1">
                {doc.placeholders.map((ph, idx) => (
                  <li
                    key={`${baseId}-ph-item-${idx}`}
                    className="text-[11px] bg-white dark:bg-slate-900/60 p-2 rounded border border-amber-200 dark:border-amber-900/40"
                  >
                    <span className="font-mono font-semibold text-amber-900 dark:text-amber-300 block">
                      {ph.key}
                    </span>
                    <span className="text-slate-600 dark:text-slate-400 block mt-0.5">
                      {ph.description}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      )}

      {/* ── Layout: Navigation Sidebar + Document Body ── */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        {/* Table of Contents (Sticky on Desktop) */}
        <aside className="lg:col-span-4 print:hidden">
          <div className="sticky top-24 p-4 rounded-xl bg-slate-50 border border-slate-200 dark:bg-slate-900/50 dark:border-slate-800">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-3 flex items-center gap-1.5">
              <FileText className="w-3.5 h-3.5 text-emerald-600" />
              Table of Contents
            </h3>
            <nav className="space-y-1 max-h-[70vh] overflow-y-auto pr-1 text-xs">
              {doc.sections.map((section) => (
                <a
                  key={section.id}
                  href={`#${section.id}`}
                  className="flex items-start gap-2 p-1.5 rounded-lg text-slate-700 hover:text-emerald-700 hover:bg-emerald-50/70 dark:text-slate-300 dark:hover:text-emerald-300 dark:hover:bg-emerald-950/40 transition-colors group"
                >
                  <span className="font-mono text-[11px] font-semibold text-slate-400 group-hover:text-emerald-600 shrink-0 mt-0.5">
                    {section.number || "•"}
                  </span>
                  <span className="line-clamp-1">{section.title}</span>
                </a>
              ))}
              {doc.annexures && doc.annexures.length > 0 && (
                <>
                  <div className="pt-2 pb-1 border-t border-slate-200 dark:border-slate-800 my-1 font-semibold text-[11px] text-slate-400 uppercase">
                    Schedules &amp; Annexures
                  </div>
                  {doc.annexures.map((ann) => (
                    <a
                      key={ann.id}
                      href={`#${ann.id}`}
                      className="flex items-start gap-2 p-1.5 rounded-lg text-slate-700 hover:text-emerald-700 hover:bg-emerald-50/70 dark:text-slate-300 dark:hover:text-emerald-300 dark:hover:bg-emerald-950/40 transition-colors"
                    >
                      <ChevronRight className="w-3 h-3 text-emerald-600 shrink-0 mt-0.5" />
                      <span className="line-clamp-1">{ann.title}</span>
                    </a>
                  ))}
                </>
              )}
            </nav>
          </div>
        </aside>

        {/* Main Document Content */}
        <div className="lg:col-span-8 space-y-10 legal-document-prose">
          {doc.sections.map((section) => (
            <section
              key={section.id}
              id={section.id}
              className="scroll-mt-24 pb-8 border-b border-slate-200 dark:border-slate-800 last:border-b-0"
            >
              <div className="flex items-baseline gap-2.5 mb-3">
                {section.number && (
                  <span className="text-base font-bold font-mono text-emerald-700 dark:text-emerald-400">
                    {section.number}.
                  </span>
                )}
                <h2 className="text-lg sm:text-xl font-bold tracking-tight text-slate-900 dark:text-white">
                  {section.title}
                </h2>
              </div>

              {section.lead && (
                <p className="text-sm font-medium text-slate-700 dark:text-slate-300 italic mb-3 leading-relaxed">
                  {renderWithPlaceholders(section.lead)}
                </p>
              )}

              {section.content && section.content.length > 0 && (
                <div className="space-y-3 text-sm text-slate-600 dark:text-slate-300 leading-relaxed">
                  {section.content.map((p, pIdx) => (
                    <p key={`${section.id}-p-${pIdx}`}>{renderWithPlaceholders(p)}</p>
                  ))}
                </div>
              )}

              {section.callout && (
                <div
                  className={`my-4 p-4 rounded-xl border text-xs leading-relaxed flex items-start gap-3 ${
                    section.callout.type === "warning"
                      ? "bg-amber-50/80 border-amber-200 text-amber-900 dark:bg-amber-950/30 dark:border-amber-800 dark:text-amber-200"
                      : section.callout.type === "info"
                      ? "bg-blue-50/80 border-blue-200 text-blue-900 dark:bg-blue-950/30 dark:border-blue-800 dark:text-blue-200"
                      : "bg-emerald-50/80 border-emerald-200 text-emerald-900 dark:bg-emerald-950/30 dark:border-emerald-800 dark:text-emerald-200"
                  }`}
                >
                  {section.callout.type === "warning" ? (
                    <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0 text-amber-600" />
                  ) : section.callout.type === "info" ? (
                    <Info className="w-4 h-4 mt-0.5 shrink-0 text-blue-600" />
                  ) : (
                    <ShieldCheck className="w-4 h-4 mt-0.5 shrink-0 text-emerald-600" />
                  )}
                  <div>
                    {section.callout.title && (
                      <span className="font-bold block mb-1">{section.callout.title}</span>
                    )}
                    <span>{renderWithPlaceholders(section.callout.text)}</span>
                  </div>
                </div>
              )}

              {section.bullets && section.bullets.length > 0 && (
                <ul className="mt-3 space-y-2 text-sm text-slate-600 dark:text-slate-300 list-disc list-outside pl-5 leading-relaxed">
                  {section.bullets.map((bullet, bIdx) => (
                    <li key={`${section.id}-b-${bIdx}`}>{renderWithPlaceholders(bullet)}</li>
                  ))}
                </ul>
              )}

              {section.subsections && section.subsections.length > 0 && (
                <div className="mt-6 space-y-6 pl-2 sm:pl-4 border-l-2 border-slate-200 dark:border-slate-800">
                  {section.subsections.map((sub) => (
                    <div key={sub.id} id={sub.id} className="scroll-mt-24 space-y-2">
                      <h3 className="text-sm sm:text-base font-semibold text-slate-800 dark:text-slate-200 flex items-baseline gap-2">
                        {sub.number && (
                          <span className="text-xs font-mono font-bold text-emerald-600 dark:text-emerald-400">
                            {sub.number}
                          </span>
                        )}
                        <span>{sub.title}</span>
                      </h3>
                      {sub.content &&
                        sub.content.map((sp, spIdx) => (
                          <p key={`${sub.id}-sp-${spIdx}`} className="text-xs sm:text-sm text-slate-600 dark:text-slate-400 leading-relaxed">
                            {renderWithPlaceholders(sp)}
                          </p>
                        ))}
                      {sub.bullets && sub.bullets.length > 0 && (
                        <ul className="space-y-1.5 text-xs sm:text-sm text-slate-600 dark:text-slate-400 list-disc list-outside pl-5 leading-relaxed">
                          {sub.bullets.map((sb, sbIdx) => (
                            <li key={`${sub.id}-sb-${sbIdx}`}>{renderWithPlaceholders(sb)}</li>
                          ))}
                        </ul>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </section>
          ))}

          {/* Annexures / Schedules */}
          {doc.annexures && doc.annexures.length > 0 && (
            <div className="pt-6 space-y-8">
              {doc.annexures.map((ann) => (
                <section
                  key={ann.id}
                  id={ann.id}
                  className="p-6 rounded-2xl bg-slate-50 border border-slate-200 dark:bg-slate-900/60 dark:border-slate-800"
                >
                  <h3 className="text-base sm:text-lg font-bold text-slate-900 dark:text-white mb-2">
                    {ann.title}
                  </h3>
                  {ann.description && (
                    <p className="text-xs text-slate-500 dark:text-slate-400 italic mb-4">
                      {ann.description}
                    </p>
                  )}
                  {ann.content.map((ac, acIdx) => (
                    <p key={`${ann.id}-ac-${acIdx}`} className="text-xs sm:text-sm text-slate-600 dark:text-slate-300 mb-4">
                      {renderWithPlaceholders(ac)}
                    </p>
                  ))}
                  {ann.items && ann.items.length > 0 && (
                    <div className="overflow-x-auto mt-4 rounded-xl border border-slate-200 dark:border-slate-800">
                      <table className="w-full text-left text-xs">
                        <thead className="bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-semibold uppercase tracking-wider">
                          <tr>
                            <th className="py-2.5 px-4 border-b border-slate-200 dark:border-slate-700">Item / Provision</th>
                            <th className="py-2.5 px-4 border-b border-slate-200 dark:border-slate-700">Contractual Value / Standard</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-200 dark:divide-slate-800 bg-white dark:bg-slate-900">
                          {ann.items.map((item, iIdx) => (
                            <tr key={`${ann.id}-item-${iIdx}`} className="hover:bg-slate-50 dark:hover:bg-slate-800/40">
                              <td className="py-2.5 px-4 font-medium text-slate-800 dark:text-slate-200 align-top">
                                {item.label}
                              </td>
                              <td className="py-2.5 px-4 text-slate-600 dark:text-slate-400 font-mono text-[11px] align-top">
                                {renderWithPlaceholders(item.value)}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </section>
              ))}
            </div>
          )}

          {/* Document Sign-off Footer */}
          <div className="p-6 rounded-2xl bg-slate-100 border border-slate-200 dark:bg-slate-900/80 dark:border-slate-800 text-center space-y-2">
            <p className="text-xs text-slate-600 dark:text-slate-400">
              Insight Education · AF-333, Rabindrapally, Talbagan, P.O. Prafulla Kanan, Kolkata-700101, India
            </p>
            <p className="text-[11px] text-slate-500 dark:text-slate-500">
              For legal inquiries, contracts, or institutional verification:{" "}
              <a href="mailto:insiteducation@gmail.com" className="text-emerald-600 hover:underline">
                insiteducation@gmail.com
              </a>{" "}
              · Phone:{" "}
              <a href="tel:+918100879809" className="text-emerald-600 hover:underline">
                +91 81008 79809
              </a>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
