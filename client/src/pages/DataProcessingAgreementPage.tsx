import { useEffect } from "react";
import PublicLayout from "@/components/PublicLayout";
import LegalDocumentView from "@/components/LegalDocumentView";
import { dataProcessingAgreementData } from "@/legal-docs/dataProcessingAgreementData";

export default function DataProcessingAgreementPage() {
  useEffect(() => {
    document.title = "Data Processing Agreement (DPA) · Insight Education";
    window.scrollTo(0, 0);
  }, []);

  return (
    <PublicLayout activePath="/legal/data-processing-agreement">
      {/* ════════════ PAGE BANNER ════════════ */}
      <section className="lp-page-banner">
        <div className="lp-container">
          <div className="lp-page-banner-content">
            <span className="lp-page-badge">DATA PROTECTION &amp; DPDP ACT</span>
            <h1 className="font-heading">Data Processing Agreement (DPA)</h1>
            <p>
              Data processor terms, security safeguards, student minor data provisions, and DPDP Act 2023 compliance for educational institutions.
            </p>
          </div>
        </div>
      </section>

      {/* ════════════ DOCUMENT CONTENT ════════════ */}
      <section className="py-12 bg-white dark:bg-slate-950">
        <div className="lp-container max-w-6xl mx-auto px-4 sm:px-6">
          <LegalDocumentView document={dataProcessingAgreementData} />
        </div>
      </section>
    </PublicLayout>
  );
}
