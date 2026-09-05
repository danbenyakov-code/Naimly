import { getPublicCard } from "@/lib/data";

// CR/LF ותווי בקרה מאפשרים להזריק שדות vCard נוספים לקובץ שנשמר במכשיר,
// ולכן הם מוסרים לפני ההמלטה של התווים המיוחדים של הפורמט.
function escapeVCard(value: string) {
  return Array.from(String(value ?? ""))
    .filter((char) => {
      const code = char.codePointAt(0)!;
      return code >= 32 && code !== 127;
    })
    .join("")
    .replace(/\\/g, "\\\\")
    .replace(/,/g, "\\,")
    .replace(/;/g, "\\;")
    .slice(0, 500);
}

export async function GET(_request: Request, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const card = await getPublicCard(slug);
  if (!card) return new Response("Not found", { status: 404 });
  const contact = card.vcard;
  const body = [
    "BEGIN:VCARD",
    "VERSION:3.0",
    `FN:${escapeVCard(contact.fullName || card.ownerName)}`,
    `ORG:${escapeVCard(contact.organization || card.businessName)}`,
    `TITLE:${escapeVCard(contact.title || card.roleTitle)}`,
    `TEL;TYPE=CELL:${escapeVCard(contact.phone || card.phone)}`,
    `EMAIL:${escapeVCard(contact.email || card.email)}`,
    `URL:${escapeVCard(contact.website || card.website)}`,
    `ADR;TYPE=WORK:;;${escapeVCard(contact.address || card.address)};;;;`,
    `NOTE:${escapeVCard(contact.note || card.bio)}`,
    "END:VCARD",
  ].join("\r\n");
  const fileName = card.slug.replace(/[^a-z0-9-]/g, "") || "contact";
  return new Response(body, {
    headers: {
      "content-type": "text/vcard; charset=utf-8",
      "content-disposition": `attachment; filename="${fileName}.vcf"`,
      "cache-control": "public, max-age=300",
    },
  });
}
