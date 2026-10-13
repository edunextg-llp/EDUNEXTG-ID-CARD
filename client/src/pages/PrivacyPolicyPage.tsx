import { useEffect } from "react";
import { Link } from "wouter";
import PublicLayout from "@/components/PublicLayout";
import { ShieldCheck, Lock, FileText, CheckCircle2, ArrowRight } from "lucide-react";

export default function PrivacyPolicyPage() {
  useEffect(() => {
    document.title = "Privacy Policy · Insight Education";
    window.scrollTo({ top: 0, behavior: "instant" });
  }, []);

  return (
    <PublicLayout activePath="/privacy">
      {/* ════════════ PAGE BANNER ════════════ */}
      <section className="lp-page-banner">
        <div className="lp-container">
          <div className="lp-page-banner-content">
            <span className="lp-page-badge">INSTITUTIONAL TRUST</span>
            <h1 className="font-heading">Data Privacy &amp; Security Policy</h1>
            <p>
              How Insight Education protects student data, institutional records, and credentials across our physical manufacturing and digital portals.
            </p>
          </div>
        </div>
      </section>

      {/* ════════════ POLICY CONTENT ════════════ */}
      <section className="py-16 bg-[#ffffff]">
        <div className="lp-container">
          <div className="max-w-3xl mx-auto space-y-8 text-[#444] leading-relaxed">
            <div className="rounded-2xl border border-[rgba(0,137,77,0.15)] bg-[#f7faf8] p-6 flex items-start gap-4">
              <div className="p-3 rounded-xl bg-[#00894d]/10 text-[#00894d] shrink-0">
                <ShieldCheck size={28} />
              </div>
              <div>
                <h3 className="font-bold text-lg text-[#1b4a7c] mb-1">Our Core Privacy Commitment</h3>
                <p className="text-sm text-[#555]">
                  Student and school information entrusted to Insight Education is used exclusively for identity card layout generation, data verification, and physical card printing. We never monetize, sell, or share student data with third-party advertisers.
                </p>
              </div>
            </div>

            <div className="space-y-4">
              <h2 className="text-2xl font-bold font-heading text-[#1b4a7c]">1. Information We Collect</h2>
              <p className="text-sm">
                When schools and educational institutions place orders or utilize our school portal, we collect:
              </p>
              <ul className="list-disc pl-6 space-y-2 text-sm text-[#555]">
                <li><strong>Student &amp; Staff Data:</strong> Name, class, section, roll number, date of birth, blood group, guardian contacts, and student photographs necessary for identity badges.</li>
                <li><strong>Institutional Credentials:</strong> School authority contact details, official email address, school logo, affiliation registration, and dispatch address.</li>
                <li><strong>Order &amp; Transaction Details:</strong> Quantities, card design parameters, billing addresses, and payment confirmation receipts.</li>
              </ul>
            </div>

            <div className="space-y-4">
              <h2 className="text-2xl font-bold font-heading text-[#1b4a7c]">2. Data Handling &amp; Security Standards</h2>
              <p className="text-sm">
                We implement industry-standard organizational and technological safeguards:
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-3">
                <div className="p-4 rounded-xl border border-gray-200 bg-white">
                  <div className="flex items-center gap-2 font-bold text-sm text-[#1d5a2e] mb-1">
                    <Lock size={16} /> Role-Based Access
                  </div>
                  <p className="text-xs text-[#666]">Strict access control ensures only authorized printing coordinators inspect production files.</p>
                </div>
                <div className="p-4 rounded-xl border border-gray-200 bg-white">
                  <div className="flex items-center gap-2 font-bold text-sm text-[#1d5a2e] mb-1">
                    <CheckCircle2 size={16} /> Secure Verification
                  </div>
                  <p className="text-xs text-[#666]">Multi-point barcode &amp; photo verification ensures accuracy without exposing databases.</p>
                </div>
              </div>
            </div>

            <div className="space-y-4">
              <h2 className="text-2xl font-bold font-heading text-[#1b4a7c]">3. Data Retention &amp; Disposal</h2>
              <p className="text-sm">
                Upon order completion, dispatch confirmation, and warranty verification, digital batch records can be archived or purged upon written instruction from the school administration.
              </p>
            </div>

            <div className="space-y-4">
              <h2 className="text-2xl font-bold font-heading text-[#1b4a7c]">4. Inquiries Regarding Student Privacy</h2>
              <p className="text-sm">
                If your institution has custom data-processing agreements (DPA) or questions regarding privacy compliance, please reach out to our institutional governance desk:
              </p>
              <div className="p-4 rounded-xl bg-gray-50 border border-gray-200 text-sm">
                <p><strong>Email:</strong> insiteducation@gmail.com</p>
                <p><strong>Phone:</strong> +91 81008 79809</p>
                <p><strong>Address:</strong> AF-333, Rabindrapally, Talbagan, P.O. Prafulla Kanan, Kolkata-700101, India.</p>
              </div>
            </div>

            <div className="pt-6 border-t border-gray-200 flex flex-wrap items-center justify-between gap-4">
              <Link href="/contact-us" className="lp-banner-cta">
                Contact Governance Desk <ArrowRight size={16} />
              </Link>
              <Link href="/" className="text-sm font-semibold text-[#0b6aa2] hover:underline">
                Return to Home
              </Link>
            </div>
          </div>
        </div>
      </section>
    </PublicLayout>
  );
}
