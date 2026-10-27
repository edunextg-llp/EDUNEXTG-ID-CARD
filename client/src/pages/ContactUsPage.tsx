import { useEffect } from "react";
import { Link } from "wouter";
import PublicLayout from "@/components/PublicLayout";
import {
  Phone,
  Mail,
  MapPin,
  ArrowRight,
  ShieldCheck,
} from "lucide-react";
import { prefetchRoute } from "@/lib/prefetchRoute";
import { useRevealOnScroll } from "@/hooks/useRevealOnScroll";
import FaqAccordion from "@/components/FaqAccordion";
import { InteractiveHoverButton } from "@/components/ui/interactive-hover-button";

export default function ContactUsPage() {
  const contactReveal = useRevealOnScroll<HTMLElement>();
  const faqReveal = useRevealOnScroll<HTMLElement>();

  useEffect(() => {
    document.title = "Contact Us · Insight Education ID Card Solutions";
    window.scrollTo({ top: 0, behavior: "instant" });
  }, []);

  return (
    <PublicLayout activePath="/contact-us">
      {/* ════════════ PAGE BANNER ════════════ */}
      <section className="lp-page-banner">
        <div className="lp-container">
          <div className="lp-page-banner-content">
            <span className="lp-page-badge">DIRECT CONTACT</span>
            <h1 className="font-heading">Contact Our Institutional Team</h1>
          </div>
        </div>
      </section>

      {/* ════════════ CONTACT CARDS & FORM SECTION ════════════ */}
      <section
        className={`lp-contact-section py-12 lp-reveal-on-scroll ${contactReveal.revealed ? "is-revealed" : ""}`}
        ref={contactReveal.ref}
      >
        <div className="lp-container">
          <div className="lp-contact-direct-wrap">
            <div className="lp-contact-direct-grid lp-stagger-grid">
              {/* Phone & WhatsApp */}
              <div className="lp-contact-card">
                <div className="lp-contact-icon-box">
                  <Phone size={24} />
                </div>
                <div>
                  <h4>Phone &amp; WhatsApp Support</h4>
                  <p className="lp-contact-main-text">+91 81008 79809</p>
                  <div className="lp-contact-action-bar">
                    <a href="tel:+918100879809" className="lp-contact-cta-btn">
                      Call Support
                    </a>
                    <a
                      href="https://wa.me/918100879809?text=Hello%20Insight%20Education,%20we%20are%20inquiring%20about%20school%20ID%20cards"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="lp-contact-cta-btn secondary"
                    >
                      WhatsApp Us
                    </a>
                  </div>
                </div>
              </div>

              {/* Email */}
              <div className="lp-contact-card">
                <div className="lp-contact-icon-box">
                  <Mail size={24} />
                </div>
                <div>
                  <h4>Official Email Inquiries</h4>
                  <p className="lp-contact-main-text">insiteducation@gmail.com</p>
                  <div className="lp-contact-action-bar">
                    <a href="mailto:insiteducation@gmail.com?subject=School%20ID%20Card%20Inquiry" className="lp-contact-cta-btn">
                      Send Email
                    </a>
                  </div>
                </div>
              </div>

              {/* Head Office */}
              <div className="lp-contact-card">
                <div className="lp-contact-icon-box">
                  <MapPin size={24} />
                </div>
                <div>
                  <h4>Head Office</h4>
                  <p className="lp-contact-main-text">
                    AF-333, Rabindrapally, Talbagan, P.O. Prafulla Kanan, Kolkata-700101, India.
                  </p>
                </div>
              </div>

              {/* Quality Guarantee */}
              <div className="lp-contact-card">
                <div className="lp-contact-icon-box">
                  <ShieldCheck size={24} />
                </div>
                <div>
                  <h4>100% Quality &amp; Accuracy Guarantee</h4>
                  <p className="lp-contact-main-text">Thermal &amp; Re-transfer High Def Finishing</p>
                </div>
              </div>
            </div>

            {/* Portal Action Banner */}
            <div className="lp-contact-portal-banner">
              <div>
                <h3>Already a Partner School or Registered Admin?</h3>
              </div>
              <Link
                href="/login"
                onMouseEnter={() => prefetchRoute("/login")}
                onTouchStart={() => prefetchRoute("/login")}
                className="inline-flex shrink-0 items-center"
              >
                <InteractiveHoverButton
                  text="School Portal Login"
                  className="min-w-52 h-12 text-sm bg-white text-slate-900 border-white/60 shadow-lg hover:text-white"
                />
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* ════════════ FAQ ACCORDION SECTION ════════════ */}
      <section
        className={`lp-reveal-on-scroll ${faqReveal.revealed ? "is-revealed" : ""}`}
        ref={faqReveal.ref}
      >
        <FaqAccordion />
      </section>
    </PublicLayout>
  );
}
