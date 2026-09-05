import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { PublicCardClient } from "@/components/card/public-card-client";
import { ThirdPartyTracking } from "@/components/card/third-party-tracking";
import { brand } from "@/lib/config";
import { getPublicCard } from "@/lib/data";
import { safeSrc } from "@/lib/safe-url";

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const card = await getPublicCard(slug);
  if (!card) notFound();
  const title = card.seoTitle || `${card.ownerName} — ${card.roleTitle}`;
  const description = card.seoDescription || card.bio;
  const socialImage = safeSrc(card.socialImageUrl);
  const images = socialImage ? [{ url: socialImage, width: 1200, height: 630, alt: `כרטיס דיגיטלי של ${card.businessName}` }] : undefined;
  return { title, description, alternates: { canonical: `/${card.slug}` }, robots: { index: card.allowIndexing, follow: card.allowIndexing }, openGraph: { title, description, type: "profile", locale: "he_IL", url: `/${card.slug}`, images }, twitter: { card: images ? "summary_large_image" : "summary", title, description, images: images?.map((image) => image.url) } };
}

export default async function PublicCardPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const card = await getPublicCard(slug);
  if (!card) notFound();
  const mainEntity = {
    "@type": "Organization",
    name: card.businessName,
    founder: card.ownerName ? { "@type": "Person", name: card.ownerName, jobTitle: card.roleTitle || undefined } : undefined,
    description: card.seoDescription || card.bio,
    url: `${brand.siteUrl}/${card.slug}`,
    telephone: card.phone || undefined,
    email: card.email || undefined,
    areaServed: card.areaServed || undefined,
    address: card.address ? { "@type": "PostalAddress", streetAddress: card.address } : undefined,
    sameAs: card.socialLinks.map((link) => safeSrc(link.url)).filter(Boolean),
  };
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "ProfilePage",
    name: card.seoTitle || `${card.ownerName} — ${card.roleTitle}`,
    description: card.seoDescription || card.bio,
    url: `${brand.siteUrl}/${card.slug}`,
    mainEntity,
  };
  return <><script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd).replace(/</g, "\\u003c") }} /><ThirdPartyTracking settings={card.tracking} /><PublicCardClient card={card} /></>;
}
