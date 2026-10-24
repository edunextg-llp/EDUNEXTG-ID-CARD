import { useEffect } from "react";
import { Link } from "wouter";
import PublicLayout from "@/components/PublicLayout";
import { Home, FileQuestion } from "lucide-react";

export default function NotFoundPage() {
  useEffect(() => {
    document.title = "404 - Page Not Found · Insight Education";
    window.scrollTo({ top: 0, behavior: "instant" });
  }, []);

  return (
    <PublicLayout>
      <section className="min-h-[60vh] flex items-center justify-center py-20 px-4 bg-[#ffffff]">
        <div className="max-w-md w-full text-center space-y-6">
          <div className="inline-flex items-center justify-center w-20 h-20 rounded-3xl bg-[rgba(11,106,162,0.1)] text-[#0b6aa2]">
            <FileQuestion size={40} />
          </div>

          <div>
            <span className="lp-page-badge" style={{ background: "rgba(11,106,162,0.1)", color: "#0b6aa2", borderColor: "rgba(11,106,162,0.2)" }}>
              404 ERROR
            </span>
            <h1 className="text-3xl sm:text-4xl font-bold font-heading text-[#1b4a7c] mt-2">
              Page Not Found
            </h1>
            <p className="mt-3 text-sm text-[#666] leading-relaxed">
              The page you are looking for does not exist or may have been moved.
            </p>
          </div>

          <div className="pt-2 flex flex-col sm:flex-row items-center justify-center gap-3">
            <Link
              href="/"
              className="lp-portal-btn w-full sm:w-auto justify-center"
              style={{ minHeight: "44px" }}
            >
              <Home size={16} /> Return to Home
            </Link>
            <Link
              href="/contact-us"
              className="lp-contact-cta-btn secondary w-full sm:w-auto text-center"
              style={{ minHeight: "44px", display: "inline-flex", alignItems: "center", justifyContent: "center" }}
            >
              Contact Support
            </Link>
          </div>
        </div>
      </section>
    </PublicLayout>
  );
}
