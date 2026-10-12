import { useEffect, useState, useCallback } from "react";
import { Link } from "wouter";
import {
  ShieldCheck,
  PenSquare,
  Settings,
  Handshake,
  School,
  Users,
  PackageCheck,
  ChevronLeft,
  ChevronRight,
  Menu,
  X,
  LockKeyhole,
  ArrowRight,
  MapPin,
  Phone,
  Mail,
  Clock,
} from "lucide-react";

/* ───────────────────────────────────────────
   Nav links
   ─────────────────────────────────────────── */
const NAV_LINKS = [
  { label: "Home", href: "/" },
  { label: "About Us", href: "/about-us" },
  { label: "Products", href: "/products" },
  { label: "Contact Us", href: "/contact-us" },
] as const;

/* ───────────────────────────────────────────
   Client logos (all partner school & institution logos)
   ─────────────────────────────────────────── */
const ORIGINAL_CLIENT_LOGOS = Array.from({ length: 11 }, (_, i) => {
  const n = String(i + 1).padStart(2, "0");
  return { src: `/home/client-${n}.jpg`, alt: `Client school logo ${i + 1}`, featured: i === 5 };
});

const EXTRA_CLIENT_LOGOS = Array.from({ length: 22 }, (_, i) => {
  const n = String(i + 1).padStart(2, "0");
  return { src: `/home/client-extra-${n}.webp`, alt: `Client institution logo ${i + 12}`, featured: false };
});

const CLIENT_LOGOS = [...ORIGINAL_CLIENT_LOGOS, ...EXTRA_CLIENT_LOGOS];

/* ───────────────────────────────────────────
   Product cards data
   ─────────────────────────────────────────── */
const PRODUCT_CARDS = [
  {
    title: "ID CARDS",
    subtitle: "School, College & Institutional ID Cards",
    image: "/home/product-idcards.jpg",
  },
  {
    title: "LANYARDS / RIBBONS",
    subtitle: "Custom Printed & Plain Lanyards",
    image: "/home/product-lanyards.jpg",
  },
  {
    title: "ID CARD HOLDERS",
    subtitle: "Different Styles & Sizes",
    image: "/home/product-holders.jpg",
  },
  {
    title: "CLAMPS & HOOKS",
    subtitle: "Metal Hooks, Plastic Clamps & Attachments",
    image: "/home/product-clips.jpg",
  },
] as const;

/* ───────────────────────────────────────────
   Why-choose features
   ─────────────────────────────────────────── */
const WHY_FEATURES = [
  { icon: ShieldCheck, title: "Quality Products", desc: "Durable and reliable products." },
  { icon: PenSquare, title: "Custom Design", desc: "Your logo, your style, your identity." },
  { icon: Settings, title: "Professional Finishing", desc: "Complete ID card professional look." },
  { icon: Handshake, title: "Complete ID Card Solutions", desc: "From card to lanyard, we provide everything." },
] as const;

/* ───────────────────────────────────────────
   Stats data
   ─────────────────────────────────────────── */
const STATS = [
  { icon: School, value: "500+", label: "Schools" },
  { icon: Users, value: "1000+", label: "Happy Clients" },
  { icon: PackageCheck, value: "100+", label: "Orders Completed" },
  { icon: ShieldCheck, value: "Best", label: "Quality" },
] as const;

/* ───────────────────────────────────────────
   Hero Carousel Slides data
   ─────────────────────────────────────────── */
const HERO_SLIDES = [
  {
    tagline: "IDENTITY  |  SECURITY  |  PROFESSIONALISM",
    title: (
      <>
        Complete ID Card &amp;
        <br />
        Lanyard Solutions
      </>
    ),
    desc: "Quality ID Cards, Lanyards, Holders & Accessories for Schools, Colleges, Institutions & Organizations.",
    image: "/home/hero-products.jpg",
    alt: "ID cards, lanyards, holders and clamps displayed together",
    ctaText: "Explore Our Products",
    ctaHref: "#products",
    isExternalOrRoute: false,
  },
  {
    tagline: "MANUFACTURING  |  PRECISION  |  DURABILITY",
    title: (
      <>
        Custom Printed Cards
        <br />
        &amp; Institutional Ribbons
      </>
    ),
    desc: "High-definition PVC thermal printing, premium satin lanyards, and custom corporate branding.",
    image: "/home/banner-products.jpg",
    alt: "Institutional banners and product accessories",
    ctaText: "View All Products",
    ctaHref: "/products",
    isExternalOrRoute: true,
  },
  {
    tagline: "RELIABILITY  |  BULK CAPACITY  |  SPEED",
    title: (
      <>
        End-to-End Solutions
        <br />
        For 500+ Schools
      </>
    ),
    desc: "Seamless ordering, instant school data integration, fast dispatch, and dedicated institutional support.",
    image: "/home/product-lanyards.jpg",
    alt: "Premium custom printed lanyards showcase",
    ctaText: "Contact Our Team",
    ctaHref: "/contact-us",
    isExternalOrRoute: true,
  },
] as const;

/* ═══════════════════════════════════════════
   Landing Component
   ═══════════════════════════════════════════ */
export default function Landing() {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [activeSection, setActiveSection] = useState("home");
  const [currentSlide, setCurrentSlide] = useState(0);
  const [isPaused, setIsPaused] = useState(false);

  /* ── Auto-slide carousel rotation (every 3s) ── */
  useEffect(() => {
    if (isPaused) return;
    const timer = setInterval(() => {
      setCurrentSlide((prev) => (prev + 1) % HERO_SLIDES.length);
    }, 3000);
    return () => clearInterval(timer);
  }, [isPaused]);

  const nextSlide = useCallback(() => {
    setCurrentSlide((prev) => (prev + 1) % HERO_SLIDES.length);
  }, []);

  const prevSlide = useCallback(() => {
    setCurrentSlide((prev) => (prev - 1 + HERO_SLIDES.length) % HERO_SLIDES.length);
  }, []);

  /* ── Set document title ── */
  useEffect(() => {
    const prev = document.title;
    document.title = "Insight Education · ID Cards & Lanyard Solutions";
    return () => {
      document.title = prev;
    };
  }, []);

  /* ── Close mobile menu on resize ── */
  useEffect(() => {
    const onResize = () => {
      if (window.innerWidth >= 768) setMobileMenuOpen(false);
    };
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  /* ── Smooth-scroll click handler for anchors ── */
  const handleNavClick = useCallback(
    (e: React.MouseEvent<HTMLAnchorElement>, href: string) => {
      e.preventDefault();
      setMobileMenuOpen(false);
      const id = href.replace("#", "");
      const el = document.getElementById(id);
      if (el) {
        el.scrollIntoView({ behavior: "smooth", block: "start" });
      }
      setActiveSection(id);
    },
    [],
  );

  return (
    <div className="landing-root">
      {/* ════════════ HEADER ════════════ */}
      <header className="lp-header" role="banner">
        <div className="lp-header-inner">
          <a href="#home" onClick={(e) => handleNavClick(e, "#home")}>
            <img
              src="/insight-education-logo.png"
              alt="Insight Education logo"
              className="lp-logo"
              width={160}
              height={64}
            />
          </a>

          {/* Desktop nav */}
          <nav aria-label="Main navigation">
            <ul className="lp-nav">
              {NAV_LINKS.map((link) => (
                <li key={link.href}>
                  {link.href === "/" ? (
                    <a
                      href="#home"
                      className={activeSection === "home" ? "active" : ""}
                      onClick={(e) => handleNavClick(e, "#home")}
                    >
                      {link.label}
                    </a>
                  ) : (
                    <Link
                      href={link.href}
                      className={activeSection === link.href.replace("/", "") ? "active" : ""}
                    >
                      {link.label}
                    </Link>
                  )}
                </li>
              ))}
            </ul>
          </nav>

          <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
            {/* Login button */}
            <a href="/login" className="lp-portal-btn">
              <LockKeyhole size={16} />
              Login
            </a>

            {/* Hamburger (mobile) */}
            <button
              className="lp-hamburger"
              onClick={() => setMobileMenuOpen((v) => !v)}
              aria-label={mobileMenuOpen ? "Close menu" : "Open menu"}
              aria-expanded={mobileMenuOpen}
            >
              {mobileMenuOpen ? <X size={24} /> : <Menu size={24} />}
            </button>
          </div>
        </div>

        {/* Mobile nav drawer */}
        <nav
          className={`lp-mobile-nav ${mobileMenuOpen ? "open" : ""}`}
          aria-label="Mobile navigation"
        >
          {NAV_LINKS.map((link) => (
            link.href === "/" ? (
              <a
                key={link.href}
                href="#home"
                className={activeSection === "home" ? "active" : ""}
                onClick={(e) => handleNavClick(e, "#home")}
              >
                {link.label}
              </a>
            ) : (
              <Link
                key={link.href}
                href={link.href}
                className={activeSection === link.href.replace("/", "") ? "active" : ""}
                onClick={() => setMobileMenuOpen(false)}
              >
                {link.label}
              </Link>
            )
          ))}
          <a href="/login" className="lp-portal-btn" style={{ alignSelf: "flex-start", marginTop: 8 }}>
            <LockKeyhole size={16} />
            Login
          </a>
        </nav>
      </header>

      <main>
        {/* ════════════ HERO CAROUSEL ════════════ */}
        <section
          id="home"
          className="lp-hero lp-hero-carousel"
          onMouseEnter={() => setIsPaused(true)}
          onMouseLeave={() => setIsPaused(false)}
          aria-roledescription="carousel"
          aria-label="Highlighted Products and Solutions"
        >
          {HERO_SLIDES.map((slide, idx) => {
            const isActive = idx === currentSlide;
            return (
              <div
                key={idx}
                className={`lp-hero-slide ${isActive ? "active" : ""}`}
                aria-hidden={!isActive}
              >
                <div className="lp-hero-content">
                  <p className="lp-hero-tagline">{slide.tagline}</p>
                  <h1 className="font-heading">{slide.title}</h1>
                  <p className="lp-hero-desc">{slide.desc}</p>
                  {slide.isExternalOrRoute ? (
                    <Link href={slide.ctaHref} className="lp-hero-cta">
                      {slide.ctaText} <ArrowRight size={18} />
                    </Link>
                  ) : (
                    <a
                      href={slide.ctaHref}
                      className="lp-hero-cta"
                      onClick={(e) => handleNavClick(e, slide.ctaHref)}
                    >
                      {slide.ctaText} <ArrowRight size={18} />
                    </a>
                  )}
                </div>
                <div className="lp-hero-image">
                  <img
                    src={slide.image}
                    alt={slide.alt}
                    width={988}
                    height={380}
                    loading={idx === 0 ? "eager" : "lazy"}
                  />
                </div>
              </div>
            );
          })}

          {/* Carousel Arrows */}
          <button
            type="button"
            className="lp-carousel-arrow lp-carousel-prev"
            onClick={prevSlide}
            aria-label="Previous slide"
          >
            <ChevronLeft size={22} />
          </button>
          <button
            type="button"
            className="lp-carousel-arrow lp-carousel-next"
            onClick={nextSlide}
            aria-label="Next slide"
          >
            <ChevronRight size={22} />
          </button>

          {/* Carousel Indicators / Dots */}
          <div className="lp-carousel-dots" role="tablist" aria-label="Hero carousel pagination">
            {HERO_SLIDES.map((_, idx) => (
              <button
                key={idx}
                type="button"
                className={`lp-carousel-dot ${idx === currentSlide ? "active" : ""}`}
                onClick={() => setCurrentSlide(idx)}
                aria-label={`Go to slide ${idx + 1}`}
                role="tab"
                aria-selected={idx === currentSlide}
              />
            ))}
          </div>
        </section>

        {/* ════════════ OUR CLIENTS ════════════ */}
        <section className="lp-clients">
          <div className="lp-container">
            <div className="lp-section-title">
              <span className="line" />
              <h2 className="font-heading">Our Clients</h2>
              <span className="line" />
            </div>

            {/* Infinite looping horizontal scrollable client logos (no scroll bar) */}
            <div className="lp-clients-marquee" tabIndex={0} role="region" aria-label="Our Clients list">
              <div className="lp-marquee-track">
                {[...CLIENT_LOGOS, ...CLIENT_LOGOS].map((logo, i) => (
                  <img
                    key={i}
                    src={logo.src}
                    alt={logo.alt}
                    className={logo.featured ? "featured" : ""}
                    loading="lazy"
                    width={logo.featured ? 72 : 50}
                    height={logo.featured ? 72 : 50}
                  />
                ))}
              </div>
            </div>
          </div>
        </section>

        {/* ════════════ PRODUCTS ════════════ */}
        <section id="products" className="lp-products">
          <div className="lp-container">
            <div className="lp-products-grid">
              {PRODUCT_CARDS.map((card) => (
                <div key={card.title} className="lp-product-card">
                  <img
                    src={card.image}
                    alt={card.title}
                    className="card-img"
                    loading="lazy"
                    width={280}
                    height={200}
                  />
                  <div className="card-body">
                    <h3>{card.title}</h3>
                    <p>{card.subtitle}</p>
                    <div className="card-body-footer">
                      <Link href="/contact-us" className="lp-arrow-btn" aria-label={`Inquire about ${card.title}`}>
                        <ChevronRight size={18} />
                      </Link>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ════════════ ABOUT US / WHY CHOOSE ════════════ */}
        <section id="about" className="lp-why-choose">
          <div className="lp-container">
            <div className="lp-why-inner">
              <div className="lp-why-left">
                <h2 className="font-heading">
                  Why Choose
                  <br />
                  Insight Education?
                </h2>
                <p>We deliver reliable, high-quality and customized ID card solutions to meet your every need</p>
                <div className="lp-why-underline" />
              </div>
              <div className="lp-why-features">
                {WHY_FEATURES.map((f) => (
                  <div key={f.title} className="lp-why-feature">
                    <div className="lp-why-icon">
                      <f.icon size={26} />
                    </div>
                    <h4>{f.title}</h4>
                    <p>{f.desc}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>

        {/* ════════════ STATS ════════════ */}
        <section className="lp-stats">
          <div className="lp-container">
            <div className="lp-stats-panel">
              {STATS.map((s) => (
                <div key={s.label} className="lp-stat-item">
                  <s.icon size={52} className="lp-stat-icon" />
                  <div className="lp-stat-text">
                    <h3>{s.value}</h3>
                    <p>{s.label}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ════════════ CUSTOM REQUIREMENT BANNER ════════════ */}
        <section className="lp-banner-section">
          <div className="lp-container">
            <div className="lp-banner-row">
              <div className="lp-custom-banner">
                <div className="lp-custom-banner-text">
                  <h3 className="font-heading">
                    Designed According to
                    <br />
                    <span className="highlight-green">Your Requirement</span>
                  </h3>
                  <p>
                    Choose your card design, holder, ribbon, colour, clamp and finishing according to your
                    institution's requirements.
                  </p>
                  <Link href="/contact-us" className="lp-banner-cta">
                    Get Customized Now <ArrowRight size={16} />
                  </Link>
                </div>
                <div className="lp-banner-image">
                  <img
                    src="/home/banner-products.jpg"
                    alt="Custom ID card products showcase"
                    loading="lazy"
                    width={500}
                    height={280}
                  />
                </div>
              </div>
            </div>
          </div>
        </section>
      </main>

      {/* ════════════ FOOTER (Expanded) ════════════ */}
      <footer className="lp-footer" role="contentinfo">
        <div className="lp-container">
          <div className="lp-footer-grid">
            {/* Column 1: About Us / Brand */}
            <div className="lp-footer-col">
              <a href="#home" onClick={(e) => handleNavClick(e, "#home")}>
                <img
                  src="/insight-education-logo.png"
                  alt="Insight Education logo"
                  className="lp-footer-logo"
                  width={140}
                  height={56}
                  loading="lazy"
                />
              </a>
              <p className="lp-footer-brand-desc">
                Insight Education is a trusted manufacturer and supplier of institutional identity solutions,
                providing premium ID cards, custom lanyards, holders, and accessories across 500+ institutions.
              </p>
              <div className="lp-footer-badge">
                <ShieldCheck size={16} />
                <span>Quality Guaranteed &amp; Verified</span>
              </div>
            </div>

            {/* Column 2: Quick Links (About Us, Products, Notice, Contact Us) */}
            <div className="lp-footer-col">
              <h4 className="lp-footer-col-title">Quick Navigation</h4>
              <ul className="lp-footer-nav-list">
                <li>
                  <a href="#home" onClick={(e) => handleNavClick(e, "#home")}>
                    Home
                  </a>
                </li>
                <li>
                  <Link href="/about-us">About Us</Link>
                </li>
                <li>
                  <Link href="/products">Products</Link>
                </li>
                <li>
                  <Link href="/contact-us">Contact Us</Link>
                </li>
                <li>
                  <a href="/login" className="lp-footer-login-link">
                    <LockKeyhole size={13} />
                    School Portal Login
                  </a>
                </li>
              </ul>
            </div>

            {/* Column 3: Products */}
            <div className="lp-footer-col">
              <h4 className="lp-footer-col-title">Our Products</h4>
              <ul className="lp-footer-nav-list">
                <li>
                  <Link href="/products">Institutional &amp; School ID Cards</Link>
                </li>
                <li>
                  <Link href="/products">Custom Printed &amp; Plain Lanyards</Link>
                </li>
                <li>
                  <Link href="/products">Durable ID Card Holders</Link>
                </li>
                <li>
                  <Link href="/products">Metal Hooks &amp; Retractable Yoyos</Link>
                </li>
                <li>
                  <Link href="/contact-us">Customized Institutional Packages</Link>
                </li>
              </ul>
            </div>

            {/* Column 4: Contact Us */}
            <div className="lp-footer-col">
              <h4 className="lp-footer-col-title">Contact Us</h4>
              <div className="lp-footer-contact-details">
                <div className="lp-footer-contact-row">
                  <MapPin size={18} className="lp-footer-icon" />
                  <span>AF-333, Rabindrapally, Talbagan, P.O. Prafulla Kanan, Kolkata-700101</span>
                </div>
                <div className="lp-footer-contact-row">
                  <Phone size={18} className="lp-footer-icon" />
                  <a href="tel:+918100879809">+91 81008 79809</a>
                </div>
                <div className="lp-footer-contact-row">
                  <Mail size={18} className="lp-footer-icon" />
                  <a href="mailto:insiteducation@gmail.com">insiteducation@gmail.com</a>
                </div>
                <div className="lp-footer-contact-row">
                  <Clock size={18} className="lp-footer-icon" />
                  <span>Mon – Sat: 9:30 AM – 6:30 PM</span>
                </div>
              </div>
            </div>
          </div>

          {/* Bottom Bar */}
          <div className="lp-footer-bottom">
            <span className="lp-footer-copy">
              © {new Date().getFullYear()} Insight Education. All rights reserved.
            </span>
          </div>
        </div>
      </footer>
    </div>
  );
}

