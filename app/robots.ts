import type { MetadataRoute } from "next";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: ["/cart", "/checkout", "/account", "/orders", "/auth", "/api"],
    },
    sitemap: "https://fusiongadgets.in/sitemap.xml",
    host: "https://fusiongadgets.in",
  };
}
