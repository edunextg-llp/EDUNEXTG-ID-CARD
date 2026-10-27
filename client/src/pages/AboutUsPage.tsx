import { useEffect } from "react";
import PublicLayout from "@/components/PublicLayout";
import {
  ShieldCheck,
  PenSquare,
  Settings,
  Handshake,
  School,
  Users,
  PackageCheck,
  Award,
  Clock,
  Truck,
} from "lucide-react";
import { useRevealOnScroll } from "@/hooks/useRevealOnScroll";
import StatItem from "@/components/StatItem";
import LogoMarquee from "@/components/LogoMarquee";

const WHY_FEATURES = [
  { icon: ShieldCheck, title: "Quality Products" },
  { icon: PenSquare, title: "Custom Design" },
  { icon: Settings, title: "Professional Finishing" },
  { icon: Handshake, title: "Complete ID Card Solutions" },
] as const;

const STATS = [
  { icon: School, target: 500, suffix: "+", label: "Schools & Colleges" },
  { icon: Users, target: 1000, suffix: "+", label: "Happy Clients" },
  { icon: PackageCheck, target: 100, suffix: "+", label: "Orders Completed" },
  { icon: Award, target: 10, suffix: "+", label: "Years in Business" },
] as const;

const ORIGINAL_CLIENT_LOGOS = Array.from({ length: 11 }, (_, i) => {
  const n = String(i + 1).padStart(2, "0");
  return { src: `/home/client-${n}.webp`, alt: `Partner school logo ${i + 1}`, featured: i === 5 };
});

const EXTRA_CLIENT_LOGOS = Array.from({ length: 22 }, (_, i) => {
  const n = String(i + 1).padStart(2, "0");
  return { src: `/home/client-extra-${n}.webp`, alt: `Client institution logo ${i + 12}`, featured: false };
});

const CLIENT_LOGOS = [...ORIGINAL_CLIENT_LOGOS, ...EXTRA_CLIENT_LOGOS];

export default function AboutUsPage() {
  const storyReveal = useRevealOnScroll<HTMLElement>();
  const whyReveal = useRevealOnScroll<HTMLElement>();
  const statsReveal = useRevealOnScroll<HTMLElement>();
  const clientsReveal = useRevealOnScroll<HTMLElement>();

  useEffect(() => {
    document.title = "About Us · Insight Education ID Card Solutions";
    window.scrollTo({ top: 0, behavior: "instant" });
  }, []);

  return (
    <PublicLayout activePath="/about-us">
      {/* ════════════ HERO BANNER ════════════ */}
      <section className="lp-page-banner">
        <div className="lp-container">
          <div className="lp-page-banner-content">
            <span className="lp-page-badge">WHO WE ARE</span>
            <h1 className="font-heading">About Insight Education</h1>
          </div>
        </div>
      </section>

      {/* ════════════ MISSION & STORY ════════════ */}
      <section
        className={`lp-about-story-section lp-reveal-on-scroll ${storyReveal.revealed ? "is-revealed" : ""}`}
        ref={storyReveal.ref}
      >
        <div className="lp-container">
          <div className="lp-about-story-grid">
            <div className="lp-about-story-text">
              <span className="highlight-green font-bold text-sm tracking-wider uppercase">Our Journey &amp; Mission</span>
              <h2 className="font-heading text-3xl font-bold mt-2 mb-4 text-[#1b4a7c]">
                Crafting Reliable Campus Identities for Over a Decade
              </h2>
              <p className="text-[#555] leading-relaxed mb-4">
                Insight Education was established with a clear mission: to simplify, elevate, and modernize student and faculty identification systems. We recognize that an ID card represents school pride, campus security, and institutional belonging.
              </p>

              <div className="lp-about-highlights-grid lp-stagger-grid">
                <div className="lp-about-highlight-box">
                  <Award size={24} className="text-[#00894d] mb-2" />
                  <h4 className="font-bold text-sm text-[#1d5a2e]">ISO 9001:2015</h4>
                </div>
                <div className="lp-about-highlight-box">
                  <Truck size={24} className="text-[#00894d] mb-2" />
                  <h4 className="font-bold text-sm text-[#1d5a2e]">Pan-India Logistics</h4>
                </div>
                <div className="lp-about-highlight-box">
                  <Clock size={24} className="text-[#00894d] mb-2" />
                  <h4 className="font-bold text-sm text-[#1d5a2e]">Rapid Turnaround</h4>
                </div>
              </div>
            </div>

            <div className="lp-about-story-image">
              <div className="lp-about-img-frame">
                <img
                  src="/home/hero-products.webp"
                  alt="Insight Education identity showcase"
                  className="rounded-2xl shadow-xl w-full object-cover"
                  loading="lazy"
                  width={600}
                  height={450}
                />
                <div className="lp-about-experience-pill">
                  <span className="text-2xl font-black text-[#00894d]">5+</span>
                  <span className="text-xs font-semibold leading-tight text-[#333]">Years of Institutional Trust</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ════════════ WHY CHOOSE US ════════════ */}
      <section
        className={`lp-why-choose lp-reveal-on-scroll ${whyReveal.revealed ? "is-revealed" : ""}`}
        ref={whyReveal.ref}
      >
        <div className="lp-container">
          <div className="lp-why-inner">
            <div className="lp-why-left">
              <h2 className="font-heading">
                Why Choose
                <br />
                Insight Education?
              </h2>
              <div className="lp-why-underline" />
            </div>
            <div className="lp-why-features lp-stagger-grid">
              {WHY_FEATURES.map((f) => (
                <div key={f.title} className="lp-why-feature">
                  <div className="lp-why-icon">
                    <f.icon size={26} />
                  </div>
                  <h4>{f.title}</h4>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ════════════ STATS ════════════ */}
      <section
        className={`lp-stats lp-reveal-on-scroll ${statsReveal.revealed ? "is-revealed" : ""}`}
        ref={statsReveal.ref}
      >
        <div className="lp-container">
          <div className="lp-stats-panel lp-stagger-grid">
            {STATS.map((s) => (
              <StatItem
                key={s.label}
                icon={s.icon}
                target={s.target}
                suffix={s.suffix}
                label={s.label}
              />
            ))}
          </div>
        </div>
      </section>

      {/* ════════════ OUR CLIENTS ════════════ */}
      <section
        className={`lp-clients py-12 lp-reveal-on-scroll ${clientsReveal.revealed ? "is-revealed" : ""}`}
        ref={clientsReveal.ref}
      >
        <div className="lp-container">
          <div className="lp-section-title">
            <span className="line" />
            <h2 className="font-heading">Our Trusted Partners</h2>
            <span className="line" />
          </div>

          <LogoMarquee logos={CLIENT_LOGOS} singleRow />
        </div>
      </section>
    </PublicLayout>
  );
}
