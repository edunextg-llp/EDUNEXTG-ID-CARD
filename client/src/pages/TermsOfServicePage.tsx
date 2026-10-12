import { useEffect } from "react";
import PublicLayout from "@/components/PublicLayout";
import LegalDocumentView from "@/components/LegalDocumentView";
import { termsOfServiceData } from "@/legal-docs/termsOfServiceData";

export default function TermsOfServicePage() {
  useEffect(() => {
    document.title = "Terms of Service · Insight Education ID Card Solutions";
    window.scrollTo(0, 0);
  }, []);

  return (
    <PublicLayout activePath="/terms-of-service">
      {/* ════════════ PAGE BANNER ════════════ */}
      <section className="lp-page-banner">
        <div className="lp-container">
          <div className="lp-page-banner-content">
            <span className="lp-page-badge">LEGAL &amp; COMPLIANCE</span>
            <h1 className="font-heading">Terms of Service</h1>
            <p>
              Conditions governing access to the School ID Card Management Suite, digital proof approvals, order manufacturing, and delivery.
            </p>
          </div>
        </div>
      </section>

      {/* ════════════ DOCUMENT CONTENT ════════════ */}
      <section className="py-12 bg-white dark:bg-slate-950">
        <div className="lp-container max-w-6xl mx-auto px-4 sm:px-6">
          <LegalDocumentView document={termsOfServiceData} />
        </div>
      </section>
    </PublicLayout>
  );
}
