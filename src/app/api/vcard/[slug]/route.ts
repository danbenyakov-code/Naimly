import { getPublicCard } from "@/lib/data";
import { buildVCard, vCardHeaders } from "@/lib/vcard";
import { safeSrc } from "@/lib/safe-url";

/**
 * הורדת כרטיס איש קשר. הקובץ נבנה משדות שבעל הכרטיס הגדיר במפורש —
 * שדה שלא מולא אינו נכנס לקובץ, ולכן לא נחשף מידע שלא נבחר לפרסום.
 */
export async function GET(_request: Request, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const card = await getPublicCard(slug);
  if (!card) return new Response("Not found", { status: 404 });

  const contact = card.vcard;
  const photo = contact.includePhoto ? safeSrc(card.logoUrl || card.avatarUrl) : "";

  const body = buildVCard({
    firstName: contact.firstName,
    lastName: contact.lastName,
    displayName: contact.fullName || card.ownerName,
    organization: contact.organization || card.businessName,
    title: contact.title || card.roleTitle,
    mobile: contact.phone || card.phone,
    phone: contact.phoneSecondary,
    email: contact.email || card.email,
    website: contact.website || card.website,
    address: card.cardAddress,
    note: contact.note || card.bio,
    photoUrl: photo || undefined,
  });

  return new Response(body, { headers: vCardHeaders(card.slug) });
}
