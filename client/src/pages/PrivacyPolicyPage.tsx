import { useEffect } from "react";
import PublicLayout from "@/components/PublicLayout";
import LegalDocumentView from "@/components/LegalDocumentView";
import { privacyPolicyData } from "@/legal-docs/privacyPolicyData";

export default function PrivacyPolicyPage() {
  useEffect(() => {
    document.title = "Privacy Policy · Insight Education ID Card Solutions";
    window.scrollTo(0, 0);
  }, []);

  return (
    <PublicLayout activePath="/privacy-policy">
      {/* ════════════ PAGE BANNER ════════════ */}
      <section className="lp-page-banner">
        <div className="lp-container">
          <div className="lp-page-banner-content">
            <span className="lp-page-badge">LEGAL &amp; COMPLIANCE</span>
            <h1 className="font-heading">Privacy Policy</h1>
            <p>
              Information handling, data fiduciaries, student minor protections under the DPDP Act 2023, and security practices of Insight Education.
            </p>
          </div>
        </div>
      </section>

      {/* ════════════ DOCUMENT CONTENT ════════════ */}
      <section className="py-12 bg-white dark:bg-slate-950">
        <div className="lp-container max-w-6xl mx-auto px-4 sm:px-6">
          <LegalDocumentView document={privacyPolicyData} />
        </div>
      </section>
    </PublicLayout>
  );
}
