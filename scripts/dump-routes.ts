export interface FlatRouteItem {
  type: "route" | "middleware";
  method?: string;
  path?: string;
  name?: string;
  middlewareCount?: number;
  handlers?: string[];
}

export function flattenRouter(router: any, prefix = ""): FlatRouteItem[] {
  const items: FlatRouteItem[] = [];

  for (const layer of router.stack) {
    if (layer.route) {
      const methods = Object.keys(layer.route.methods)
        .map((m) => m.toUpperCase())
        .join(",");
      const fullPath = (prefix + (layer.route.path || "")).replace(/\/+/g, "/");
      const handlers = layer.route.stack.map((s: any) => s.name || "<anonymous>");
      items.push({
        type: "route",
        method: methods,
        path: fullPath,
        middlewareCount: layer.route.stack.length,
        handlers,
      });
    } else if (layer.name === "router" && layer.handle?.stack) {
      // Extract mount path if mounted with router.use('/prefix', subRouter)
      let mountPath = "";
      if (layer.regexp && layer.regexp.source) {
        const match = layer.regexp.source
          .replace("^\\/", "/")
          .replace(/\\\//g, "/")
          .match(/^(\/[a-zA-Z0-9_\-\/]*)/);
        if (match && match[1] && match[1] !== "/") {
          mountPath = match[1];
        }
      }
      items.push(...flattenRouter(layer.handle, prefix + mountPath));
    } else {
      items.push({
        type: "middleware",
        name: layer.name || "<anonymous>",
      });
    }
  }

  return items;
}
