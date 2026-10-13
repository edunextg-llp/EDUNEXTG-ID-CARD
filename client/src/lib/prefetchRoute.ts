/**
 * Helper to prefetch lazy route component chunks on link hover or touchstart
 */
const routePreloaders: Record<string, () => Promise<unknown>> = {
  "/": () => import("@/pages/Landing"),
  "/about-us": () => import("@/pages/AboutUsPage"),
  "/products": () => import("@/pages/ProductsPage"),
  "/contact-us": () => import("@/pages/ContactUsPage"),
  "/privacy": () => import("@/pages/PrivacyPolicyPage"),
  "/login": () => import("@/pages/Login"),
};

const preloadedRoutes = new Set<string>();

export function prefetchRoute(href: string): void {
  if (!href) return;
  const normalized = href.split("?")[0].split("#")[0];
  if (preloadedRoutes.has(normalized)) return;

  const loader = routePreloaders[normalized];
  if (loader) {
    preloadedRoutes.add(normalized);
    loader().catch(() => {
      preloadedRoutes.delete(normalized);
    });
  }
}
