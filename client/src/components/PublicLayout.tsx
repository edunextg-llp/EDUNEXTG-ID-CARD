import { useState, useEffect } from "react";
import { Link, useLocation } from "wouter";
import {
  ShieldCheck,
  LockKeyhole,
  Menu,
  X,
  MapPin,
  Phone,
  Mail,
  Clock,
} from "lucide-react";
import { prefetchRoute } from "@/lib/prefetchRoute";

export const PUBLIC_NAV_LINKS = [
  { label: "Home", href: "/" },
  { label: "About Us", href: "/about-us" },
  { label: "Products", href: "/products" },
  { label: "Contact Us", href: "/contact-us" },
] as const;

interface PublicLayoutProps {
  children: React.ReactNode;
  activePath?: string;
}

export default function PublicLayout({ children, activePath }: PublicLayoutProps) {
  const [location] = useLocation();
  const currentPath = activePath || location;
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);

  // 1. Scroll to top on route change
  useEffect(() => {
    window.scrollTo({ top: 0, behavior: "instant" });
  }, [currentPath]);

  // 2. Track window scroll for sticky header shrinkage and soft shadow
  useEffect(() => {
    const handleScroll = () => {
      setScrolled(window.scrollY > 20);
    };
    handleScroll();
    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  // 3. Body scroll lock when mobile drawer is open
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

  // Close mobile drawer on desktop resize
  useEffect(() => {
    const handleResize = () => {
      if (window.innerWidth >= 768) setMobileMenuOpen(false);
    };
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  return (
    <div className="landing-root">
      {/* ════════════ HEADER ════════════ */}
      <header
        className={`lp-header ${scrolled ? "scrolled" : ""}`}
        role="banner"
      >
        <div className="lp-header-inner">
          <Link
            href="/"
            onMouseEnter={() => prefetchRoute("/")}
            onTouchStart={() => prefetchRoute("/")}
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
          </Link>

          {/* Desktop nav */}
          <nav aria-label="Main navigation">
            <ul className="lp-nav">
              {PUBLIC_NAV_LINKS.map((link) => (
                <li key={link.href}>
                  <Link
                    href={link.href}
                    className={
                      currentPath === link.href ||
                      (link.href !== "/" && currentPath.startsWith(link.href))
                        ? "active"
                        : ""
                    }
                    onMouseEnter={() => prefetchRoute(link.href)}
                    onTouchStart={() => prefetchRoute(link.href)}
                  >
                    {link.label}
                  </Link>
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

        {/* Mobile nav drawer with smooth slide/fade and link click auto-close */}
        <nav
          className={`lp-mobile-nav ${mobileMenuOpen ? "open" : ""}`}
          aria-label="Mobile navigation"
        >
          {PUBLIC_NAV_LINKS.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className={
                currentPath === link.href ||
                (link.href !== "/" && currentPath.startsWith(link.href))
                  ? "active"
                  : ""
              }
              onClick={() => setMobileMenuOpen(false)}
              onTouchStart={() => prefetchRoute(link.href)}
            >
              {link.label}
            </Link>
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

      {/* ════════════ MAIN CONTENT (with page route transition) ════════════ */}
      <main className="lp-page-route-transition" key={currentPath}>
        {children}
      </main>

      {/* ════════════ FOOTER (Expanded) ════════════ */}
      <footer className="lp-footer" role="contentinfo">
        <div className="lp-container">
          <div className="lp-footer-grid">
            {/* Column 1: About Us / Brand */}
            <div className="lp-footer-col">
              <Link
                href="/"
                onMouseEnter={() => prefetchRoute("/")}
                onTouchStart={() => prefetchRoute("/")}
              >
                <img
                  src="/insight-education-logo.png"
                  alt="Insight Education logo"
                  className="lp-footer-logo"
                  width={140}
                  height={56}
                  loading="lazy"
                />
              </Link>
              <p className="lp-footer-brand-desc">
                Insight Education is a trusted manufacturer and supplier of institutional identity solutions,
                providing premium ID cards, custom lanyards, holders, and accessories across 500+ institutions.
              </p>
              <div className="lp-footer-badge">
                <ShieldCheck size={16} />
                <span>Quality Guaranteed &amp; Verified</span>
              </div>
            </div>

            {/* Column 2: Quick Navigation */}
            <div className="lp-footer-col">
              <h4 className="lp-footer-col-title">Quick Navigation</h4>
              <ul className="lp-footer-nav-list">
                <li>
                  <Link
                    href="/"
                    onMouseEnter={() => prefetchRoute("/")}
                    onTouchStart={() => prefetchRoute("/")}
                  >
                    Home
                  </Link>
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
              © {new Date().getFullYear()} Insight Education Solutions. All rights reserved.
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
