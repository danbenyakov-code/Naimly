import type { MetadataRoute } from "next";
import { brand } from "@/lib/config";
import { getPublishedSlugs } from "@/lib/data";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const routes = ["", "/pricing", "/legal/privacy", "/legal/terms", "/legal/cookies", "/accessibility"];
  const cards = await getPublishedSlugs();
  return [
    ...routes.map((route) => ({ url: `${brand.siteUrl}${route}`, lastModified: new Date(), changeFrequency: (route === "" ? "weekly" : "monthly") as "weekly" | "monthly", priority: route === "" ? 1 : 0.6 })),
    ...cards.map((card) => ({ url: `${brand.siteUrl}/${card.slug}`, lastModified: new Date(card.updatedAt), changeFrequency: "monthly" as const, priority: 0.8 })),
  ];
}
