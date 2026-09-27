import type { MetadataRoute } from "next";
import { brand } from "@/lib/config";
import { getPublishedSlugs } from "@/lib/data";

type Route = { path: string; priority: number; changeFrequency: "weekly" | "monthly" | "yearly" };

const routes: Route[] = [
  { path: "", priority: 1, changeFrequency: "weekly" },
  { path: "/pricing", priority: 0.9, changeFrequency: "monthly" },
  { path: "/contact", priority: 0.7, changeFrequency: "monthly" },
  { path: "/accessibility", priority: 0.3, changeFrequency: "yearly" },
  { path: "/legal/terms", priority: 0.3, changeFrequency: "yearly" },
  { path: "/legal/privacy", priority: 0.3, changeFrequency: "yearly" },
  { path: "/legal/refund", priority: 0.3, changeFrequency: "yearly" },
  { path: "/legal/cookies", priority: 0.2, changeFrequency: "yearly" },
  { path: "/legal/acceptable-use", priority: 0.2, changeFrequency: "yearly" },
];

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const cards = await getPublishedSlugs();
  return [
    ...routes.map((route) => ({ url: `${brand.siteUrl}${route.path}`, lastModified: new Date(), changeFrequency: route.changeFrequency, priority: route.priority })),
    ...cards.map((card) => ({ url: `${brand.siteUrl}/${card.slug}`, lastModified: new Date(card.updatedAt), changeFrequency: "monthly" as const, priority: 0.6 })),
  ];
}
