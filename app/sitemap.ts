import type { MetadataRoute } from "next";
import { getAllCategories } from "@/modules/catalog/categories";
import { getAllProducts } from "@/modules/catalog/products";

const SITE = "https://fusiongadgets.in";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const now = new Date();
  const staticRoutes = [
    "",
    "/shop",
    "/categories",
    "/offers",
    "/about",
    "/contact",
    "/shipping",
    "/returns",
    "/privacy",
    "/terms",
    "/search",
  ].map((p) => ({
    url: `${SITE}/${p.replace(/^\//, "")}`.replace(/\/$/, "") || SITE,
    lastModified: now,
    changeFrequency: "weekly" as const,
    priority: p === "" ? 1 : 0.7,
  }));

  const [categories, products] = await Promise.all([
    getAllCategories(),
    getAllProducts(),
  ]);

  const categoryRoutes = categories.map((c) => ({
    url: `${SITE}/categories/${c.slug}`,
    lastModified: now,
    changeFrequency: "weekly" as const,
    priority: 0.8,
  }));

  const productRoutes = products.map((p) => ({
    url: `${SITE}/product/${p.slug}`,
    lastModified: now,
    changeFrequency: "weekly" as const,
    priority: 0.7,
  }));

  return [...staticRoutes, ...categoryRoutes, ...productRoutes];
}
