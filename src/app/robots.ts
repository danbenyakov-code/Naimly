import type { MetadataRoute } from "next";
import { brand } from "@/lib/config";

export default function robots(): MetadataRoute.Robots {
  return { rules: [{ userAgent: "*", allow: "/", disallow: ["/dashboard/", "/admin/", "/checkout/", "/api/", "/login", "/signup", "/forgot-password", "/reset-password", "/auth/"] }], sitemap: `${brand.siteUrl}/sitemap.xml`, host: brand.siteUrl };
}
