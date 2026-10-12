import { useEffect } from "react";
import PublicLayout from "@/components/PublicLayout";
import LegalDocumentView from "@/components/LegalDocumentView";
import { schoolServiceAgreementData } from "@/legal-docs/schoolServiceAgreementData";

export default function SchoolServiceAgreementPage() {
  useEffect(() => {
    document.title = "School Service Agreement (MSA) · Insight Education";
    window.scrollTo(0, 0);
  }, []);

  return (
    <PublicLayout activePath="/legal/school-service-agreement">
      {/* ════════════ PAGE BANNER ════════════ */}
      <section className="lp-page-banner">
        <div className="lp-container">
          <div className="lp-page-banner-content">
            <span className="lp-page-badge">INSTITUTIONAL CONTRACT</span>
            <h1 className="font-heading">School Service Agreement (MSA)</h1>
            <p>
              Master services agreement and institutional terms between Insight Education and educational institutions for student and staff ID card management and manufacturing.
            </p>
          </div>
        </div>
      </section>

      {/* ════════════ DOCUMENT CONTENT ════════════ */}
      <section className="py-12 bg-white dark:bg-slate-950">
        <div className="lp-container max-w-6xl mx-auto px-4 sm:px-6">
          <LegalDocumentView document={schoolServiceAgreementData} />
        </div>
      </section>
    </PublicLayout>
  );
}
