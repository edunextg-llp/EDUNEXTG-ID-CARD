import { useEffect, useState, useCallback, useRef } from "react";
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
import { prefetchRoute } from "@/lib/prefetchRoute";
import { useRevealOnScroll } from "@/hooks/useRevealOnScroll";

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
    subtitle: "Durable Holders in Multiple Sizes",
    image: "/home/product-holders.jpg",
  },
  {
    title: "CLAMPS & HOOKS",
    subtitle: "Clips, Hooks & Yoyos for Daily Use",
    image: "/home/product-clips.jpg",
  },
] as const;

/* ───────────────────────────────────────────
   Why choose us features
   ─────────────────────────────────────────── */
const WHY_FEATURES = [
  { icon: ShieldCheck, title: "Quality Products", desc: "Durable and reliable ID cards and accessories." },
  { icon: PenSquare, title: "Custom Design", desc: "Design cards tailored to your school's identity." },
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
   Hero Carousel Images
   ─────────────────────────────────────────── */
const HERO_IMAGES = [
  {
    image: "/home/carousel-slide-1.jpg",
    alt: "ID cards, holders, lanyards, clips and clamps displayed together",
  },
  {
    image: "/home/carousel-slide-2.jpg",
    alt: "Custom school ID cards, printed lanyards and holders",
  },
  {
    image: "/home/carousel-slide-3.jpg",
    alt: "Institutional custom printed ribbons and identity cards",
  },
] as const;

/* ═══════════════════════════════════════════
   Landing Component
   ═══════════════════════════════════════════ */
export default function Landing() {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [activeSection, setActiveSection] = useState("home");
  const [currentSlide, setCurrentSlide] = useState(0);
  const [scrolled, setScrolled] = useState(false);

  // Reveal-on-scroll section hooks
  const clientsReveal = useRevealOnScroll<HTMLElement>();
  const productsReveal = useRevealOnScroll<HTMLElement>();
  const whyReveal = useRevealOnScroll<HTMLElement>();
  const statsReveal = useRevealOnScroll<HTMLElement>();
  const bannerReveal = useRevealOnScroll<HTMLElement>();

  // Touch swipe support for Hero Carousel
  const touchStartXRef = useRef<number | null>(null);

  /* ── Auto-slide carousel rotation (every 3s, continuous without hover pause) ── */
  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentSlide((prev) => (prev + 1) % HERO_IMAGES.length);
    }, 3000);
    return () => clearInterval(timer);
  }, []);

  const nextSlide = useCallback(() => {
    setCurrentSlide((prev) => (prev + 1) % HERO_IMAGES.length);
  }, []);

  const prevSlide = useCallback(() => {
    setCurrentSlide((prev) => (prev - 1 + HERO_IMAGES.length) % HERO_IMAGES.length);
  }, []);

  // Touch handlers for carousel swipe
  const handleTouchStart = (e: React.TouchEvent) => {
    touchStartXRef.current = e.touches[0].clientX;
  };

  const handleTouchEnd = (e: React.TouchEvent) => {
    if (touchStartXRef.current === null) return;
    const touchEndX = e.changedTouches[0].clientX;
    const diff = touchStartXRef.current - touchEndX;
    if (diff > 45) {
      nextSlide();
    } else if (diff < -45) {
      prevSlide();
    }
    touchStartXRef.current = null;
  };

  /* ── Track scroll for sticky header shrinkage ── */
  useEffect(() => {
    const handleScroll = () => {
      setScrolled(window.scrollY > 20);
    };
    handleScroll();
    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  /* ── Set document title & scroll to top ── */
  useEffect(() => {
    const prev = document.title;
    document.title = "Insight Education · ID Cards & Lanyard Solutions";
    window.scrollTo({ top: 0, behavior: "instant" });
    return () => {
      document.title = prev;
    };
  }, []);

  /* ── Body scroll lock when mobile menu is open ── */
  useEffect(() => {
    if (mobileMenuOpen) {
      const scrollY = window.scrollY;
      document.body.style.overflow = "hidden";
      document.body.style.touchAction = "none";
      return () => {
        document.body.style.overflow = "";
        document.body.style.touchAction = "";
        window.scrollTo(0, scrollY);
      };
    }
  }, [mobileMenuOpen]);

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
      <header
        className={`lp-header ${scrolled ? "scrolled" : ""}`}
        role="banner"
      >
        <div className="lp-header-inner">
          <a
            href="#home"
            onClick={(e) => handleNavClick(e, "#home")}
            className="lp-logo-link"
          >
            <img
              src="/insight-education-logo.png"
              alt="Insight Education logo"
              className="lp-logo"
              width={160}
              height={64}
              fetchPriority="high"
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
                      onMouseEnter={() => prefetchRoute(link.href)}
                      onTouchStart={() => prefetchRoute(link.href)}
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
            <a
              href="/login"
              className="lp-portal-btn"
              onMouseEnter={() => prefetchRoute("/login")}
              onTouchStart={() => prefetchRoute("/login")}
            >
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

        {/* Mobile backdrop overlay */}
        <div
          className={`lp-mobile-backdrop ${mobileMenuOpen ? "open" : ""}`}
          onClick={() => setMobileMenuOpen(false)}
          aria-hidden={!mobileMenuOpen}
        />

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
                onTouchStart={() => prefetchRoute(link.href)}
              >
                {link.label}
              </Link>
            )
          ))}
          <a
            href="/login"
            className="lp-portal-btn"
            style={{ alignSelf: "flex-start", marginTop: 8 }}
            onClick={() => setMobileMenuOpen(false)}
            onTouchStart={() => prefetchRoute("/login")}
          >
            <LockKeyhole size={16} />
            Login
          </a>
        </nav>
      </header>

      <main>
        {/* ════════════ FULL-WIDTH HERO CAROUSEL ════════════ */}
        <section
          id="home"
          className="lp-hero lp-hero-full-bg"
          onTouchStart={handleTouchStart}
          onTouchEnd={handleTouchEnd}
        >
          {/* Full-width carousel background with crossfade */}
          <div className="lp-hero-full-carousel" aria-roledescription="carousel">
            {HERO_IMAGES.map((item, idx) => {
              const isActive = idx === currentSlide;
              return (
                <div
                  key={idx}
                  className={`lp-hero-full-slide ${isActive ? "active" : ""}`}
                  aria-hidden={!isActive}
                >
                  <img
                    src={item.image}
                    alt={item.alt}
                    width={1920}
                    height={500}
                    loading={idx === 0 ? "eager" : "lazy"}
                    fetchPriority={idx === 0 ? "high" : "auto"}
                    className="lp-hero-full-img"
                  />
                </div>
              );
            })}
          </div>

          {/* Hero text placed in the left space with no box */}
          <div className="lp-hero-content">
            <p className="lp-hero-tagline">IDENTITY &nbsp;|&nbsp; SECURITY &nbsp;|&nbsp; PROFESSIONALISM</p>
            <h1 className="font-heading">
              Complete ID Card &amp;
              <br />
              Lanyard Solutions
            </h1>
            <p className="lp-hero-desc">
              Quality ID Cards, Lanyards, Holders &amp; Accessories for Schools, Colleges, Institutions &amp;
              Organizations.
            </p>
            <a
              href="#products"
              className="lp-hero-cta"
              onClick={(e) => handleNavClick(e, "#products")}
            >
              Explore Our Products <ArrowRight size={18} />
            </a>
          </div>

          {/* Carousel Controls */}
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

          <div className="lp-carousel-dots" role="tablist" aria-label="Hero carousel pagination">
            {HERO_IMAGES.map((_, idx) => (
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
        <section
          className={`lp-clients lp-reveal-on-scroll ${clientsReveal.revealed ? "is-revealed" : ""}`}
          ref={clientsReveal.ref}
        >
          <div className="lp-container">
            <div className="lp-section-title">
              <span className="line" />
              <h2 className="font-heading">Our Clients</h2>
              <span className="line" />
            </div>

            {/* Infinite looping horizontal scrollable client logos */}
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
        <section
          id="products"
          className={`lp-products lp-reveal-on-scroll ${productsReveal.revealed ? "is-revealed" : ""}`}
          ref={productsReveal.ref}
        >
          <div className="lp-container">
            <div className="lp-products-grid lp-stagger-grid">
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
                      <Link
                        href="/contact-us"
                        className="lp-arrow-btn"
                        aria-label={`Inquire about ${card.title}`}
                        onMouseEnter={() => prefetchRoute("/contact-us")}
                        onTouchStart={() => prefetchRoute("/contact-us")}
                      >
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
        <section
          id="about"
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
                <p>We deliver reliable, high-quality and customized ID card solutions to meet your every need</p>
                <div className="lp-why-underline" />
              </div>
              <div className="lp-why-features lp-stagger-grid">
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
        <section
          className={`lp-stats lp-reveal-on-scroll ${statsReveal.revealed ? "is-revealed" : ""}`}
          ref={statsReveal.ref}
        >
          <div className="lp-container">
            <div className="lp-stats-panel lp-stagger-grid">
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
        <section
          className={`lp-banner-section lp-reveal-on-scroll ${bannerReveal.revealed ? "is-revealed" : ""}`}
          ref={bannerReveal.ref}
        >
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
                  <Link
                    href="/contact-us"
                    className="lp-banner-cta"
                    onMouseEnter={() => prefetchRoute("/contact-us")}
                    onTouchStart={() => prefetchRoute("/contact-us")}
                  >
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

            {/* Column 2: Quick Links */}
            <div className="lp-footer-col">
              <h4 className="lp-footer-col-title">Quick Navigation</h4>
              <ul className="lp-footer-nav-list">
                <li>
                  <a href="#home" onClick={(e) => handleNavClick(e, "#home")}>
                    Home
                  </a>
                </li>
                <li>
                  <Link
                    href="/about-us"
                    onMouseEnter={() => prefetchRoute("/about-us")}
                    onTouchStart={() => prefetchRoute("/about-us")}
                  >
                    About Us
                  </Link>
                </li>
                <li>
                  <Link
                    href="/products"
                    onMouseEnter={() => prefetchRoute("/products")}
                    onTouchStart={() => prefetchRoute("/products")}
                  >
                    Products
                  </Link>
                </li>
                <li>
                  <Link
                    href="/contact-us"
                    onMouseEnter={() => prefetchRoute("/contact-us")}
                    onTouchStart={() => prefetchRoute("/contact-us")}
                  >
                    Contact Us
                  </Link>
                </li>
                <li>
                  <Link
                    href="/privacy"
                    onMouseEnter={() => prefetchRoute("/privacy")}
                    onTouchStart={() => prefetchRoute("/privacy")}
                  >
                    Privacy Policy
                  </Link>
                </li>
                <li>
                  <a
                    href="/login"
                    className="lp-footer-login-link"
                    onMouseEnter={() => prefetchRoute("/login")}
                    onTouchStart={() => prefetchRoute("/login")}
                  >
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
                  <Link
                    href="/products"
                    onMouseEnter={() => prefetchRoute("/products")}
                    onTouchStart={() => prefetchRoute("/products")}
                  >
                    Institutional &amp; School ID Cards
                  </Link>
                </li>
                <li>
                  <Link
                    href="/products"
                    onMouseEnter={() => prefetchRoute("/products")}
                    onTouchStart={() => prefetchRoute("/products")}
                  >
                    Custom Printed &amp; Plain Lanyards
                  </Link>
                </li>
                <li>
                  <Link
                    href="/products"
                    onMouseEnter={() => prefetchRoute("/products")}
                    onTouchStart={() => prefetchRoute("/products")}
                  >
                    Durable ID Card Holders
                  </Link>
                </li>
                <li>
                  <Link
                    href="/products"
                    onMouseEnter={() => prefetchRoute("/products")}
                    onTouchStart={() => prefetchRoute("/products")}
                  >
                    Metal Hooks &amp; Retractable Yoyos
                  </Link>
                </li>
                <li>
                  <Link
                    href="/contact-us"
                    onMouseEnter={() => prefetchRoute("/contact-us")}
                    onTouchStart={() => prefetchRoute("/contact-us")}
                  >
                    Customized Institutional Packages
                  </Link>
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
            <div className="flex items-center gap-4 text-xs text-[#888]">
              <Link
                href="/privacy"
                className="hover:underline"
                onMouseEnter={() => prefetchRoute("/privacy")}
              >
                Privacy Policy
              </Link>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
