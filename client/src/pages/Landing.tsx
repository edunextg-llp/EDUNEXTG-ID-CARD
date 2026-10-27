import { useEffect, useState, useCallback, useRef } from "react";
import { useSmoothScroll, getLenis } from "@/hooks/useSmoothScroll";
import { Link, useLocation } from "wouter";
import {
  ShieldCheck,
  PenSquare,
  Settings,
  Handshake,
  School,
  Users,
  PackageCheck,
  Award,
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
import LogoMarquee from "@/components/LogoMarquee";
import StatItem from "@/components/StatItem";
import FaqAccordion from "@/components/FaqAccordion";
import { InteractiveHoverButton } from "@/components/ui/interactive-hover-button";

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
  return { src: `/home/client-${n}.webp`, alt: `Client school logo ${i + 1}`, featured: i === 5 };
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
    image: "/home/product-idcards.webp",
  },
  {
    title: "LANYARDS / RIBBONS",
    image: "/home/product-lanyards.webp",
  },
  {
    title: "ID CARD HOLDERS",
    image: "/home/product-holders.webp",
  },
  {
    title: "CLAMPS & HOOKS",
    image: "/home/product-clips.webp",
  },
] as const;

/* ───────────────────────────────────────────
   Why choose us features
   ─────────────────────────────────────────── */
const WHY_FEATURES = [
  { icon: ShieldCheck, title: "Quality Products" },
  { icon: PenSquare, title: "Custom Design" },
  { icon: Settings, title: "Professional Finishing" },
  { icon: Handshake, title: "Complete ID Card Solutions" },
] as const;

/* ───────────────────────────────────────────
   Stats data (Real institutional figures from codebase)
   ─────────────────────────────────────────── */
const STATS = [
  { icon: School, target: 100, suffix: "+", label: "Schools Served" },
  { icon: Users, target: 500, suffix: "+", label: "Happy Clients" },
  { icon: PackageCheck, target: 1000, suffix: "+", label: "Orders Completed" },
  { icon: Award, target: 5, suffix: "+", label: "Years in Business" },
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
    image: "/home/carousel-slide-2.webp",
    alt: "Custom school ID cards, printed lanyards and holders",
  },
  {
    image: "/home/carousel-slide-3.webp",
    alt: "Institutional custom printed ribbons and identity cards",
  },
] as const;

/* ═══════════════════════════════════════════
   Landing Component
   ═══════════════════════════════════════════ */
export default function Landing() {
  const [, navigate] = useLocation();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [activeSection, setActiveSection] = useState("home");
  const [currentSlide, setCurrentSlide] = useState(0);
  const [scrolled, setScrolled] = useState(false);

  // Lenis smooth scrolling for public pages
  useSmoothScroll();

  // Reveal-on-scroll section hooks
  const clientsReveal = useRevealOnScroll<HTMLElement>();
  const productsReveal = useRevealOnScroll<HTMLElement>();
  const whyReveal = useRevealOnScroll<HTMLElement>();
  const statsReveal = useRevealOnScroll<HTMLElement>();

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

  /* ── Set document title & scroll to top (Lenis-aware) ── */
  useEffect(() => {
    const prev = document.title;
    document.title = "Insight Education · ID Cards & Lanyard Solutions";
    const lenis = getLenis();
    if (lenis) {
      lenis.scrollTo(0, { immediate: true });
    } else {
      window.scrollTo(0, 0);
    }
    return () => {
      document.title = prev;
    };
  }, []);

  /* ── Body scroll lock when mobile menu is open (+ Lenis stop/start) ── */
  useEffect(() => {
    if (mobileMenuOpen) {
      const scrollY = window.scrollY;
      document.body.style.overflow = "hidden";
      document.body.style.touchAction = "none";
      getLenis()?.stop();
      return () => {
        document.body.style.overflow = "";
        document.body.style.touchAction = "";
        getLenis()?.start();
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

  /* ── Smooth-scroll click handler for anchors (Lenis-aware) ── */
  const handleNavClick = useCallback(
    (e: React.MouseEvent<HTMLAnchorElement>, href: string) => {
      e.preventDefault();
      setMobileMenuOpen(false);
      const id = href.replace("#", "");
      const el = document.getElementById(id);
      if (el) {
        const lenis = getLenis();
        if (lenis) {
          lenis.scrollTo(el);
        } else {
          el.scrollIntoView({ behavior: "smooth", block: "start" });
        }
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
            {/* Login button with interactive hover effect */}
            <div
              onMouseEnter={() => prefetchRoute("/login")}
              onTouchStart={() => prefetchRoute("/login")}
            >
              <InteractiveHoverButton
                text="Login"
                onClick={() => navigate("/login")}
                className="h-10 min-w-28 px-4 text-xs font-bold border-primary/30 bg-primary/10 text-primary hover:text-primary-foreground shadow-xs"
              />
            </div>

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
          data-lenis-prevent
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
          <div
            style={{ alignSelf: "flex-start", marginTop: 8 }}
            onTouchStart={() => prefetchRoute("/login")}
          >
            <InteractiveHoverButton
              text="Login"
              onClick={() => {
                setMobileMenuOpen(false);
                navigate("/login");
              }}
              className="h-10 min-w-28 px-4 text-xs font-bold border-primary/30 bg-primary/10 text-primary hover:text-primary-foreground shadow-xs"
            />
          </div>
        </nav>
      </header>

      <main>
        {/* ════════════ FULL-WIDTH HERO CAROUSEL ════════════ */}
        <section
          id="home"
          className="lp-hero lp-hero-full-bg"
          style={{ touchAction: "pan-y" }}
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
                  <picture>
                    {item.image.endsWith(".webp") && <source type="image/webp" srcSet={item.image} />}
                    <img
                      src={item.image}
                      alt={item.alt}
                      width={1920}
                      height={500}
                      loading={idx === 0 ? "eager" : "lazy"}
                      fetchPriority={idx === 0 ? "high" : "auto"}
                      className="lp-hero-full-img"
                    />
                  </picture>
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
            <div className="mt-4">
              <InteractiveHoverButton
                text="Explore Our Products"
                className="h-12 min-w-56 text-base bg-white/95 text-slate-900 border-white/50 shadow-xl backdrop-blur-xs hover:text-white"
                onClick={(e) => handleNavClick(e as unknown as React.MouseEvent<HTMLAnchorElement>, "#products")}
              />
            </div>
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

            {/* Infinite looping horizontal continuous dual-row client logos */}
            <LogoMarquee logos={CLIENT_LOGOS} />
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

        {/* ════════════ FREQUENTLY ASKED QUESTIONS ════════════ */}
        <FaqAccordion />
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
                providing premium ID cards, custom lanyards, holders, and accessories across 100+ institutions.
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

            {/* Column 3: Contact Us */}
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
