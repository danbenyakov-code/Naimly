import { Column, Row, Section, Text } from "react-email";
import { colors, CtaButton, EmailLayout, Heading, Paragraph } from "@/emails/layout";
import { leadCopy } from "@/emails/copy";

const rtl = { direction: "rtl" as const, textAlign: "right" as const };

/** התראה מיידית לבעל העסק על פנייה מהכרטיס. מייל קריטי: בלי קישורי הסרה. */
export function LeadNotificationEmail({ businessName, lead, whatsappUrl, leadsUrl }: {
  businessName: string;
  lead: { name: string; phone: string; email: string; message: string };
  /** null כשאין לפונה מספר שאפשר לפתוח בוואטסאפ. */
  whatsappUrl: string | null;
  leadsUrl: string;
}) {
  const rows: Array<[string, string, boolean]> = [
    [leadCopy.labels.name, lead.name, false],
    [leadCopy.labels.phone, lead.phone, true],
    [leadCopy.labels.email, lead.email, true],
  ];
  return (
    <EmailLayout preview={leadCopy.preview(lead.name)}>
      <Heading>{leadCopy.heading}</Heading>
      <Paragraph>{leadCopy.intro(businessName)}</Paragraph>
      <Section dir="rtl" style={{ margin: "4px 0 14px" }}>
        {rows.filter(([, value]) => Boolean(value)).map(([label, value, ltr]) => (
          <Row key={label} dir="rtl" style={{ borderBottom: `1px solid ${colors.line}` }}>
            <Column dir="rtl" style={{ width: 80, padding: "9px 0", fontSize: 13, color: colors.muted, ...rtl }}>{label}</Column>
            <Column dir="rtl" style={{ padding: "9px 0", fontSize: 16, fontWeight: 700, color: colors.ink, ...rtl }}>
              {ltr ? <span dir="ltr" style={{ unicodeBidi: "embed" }}>{value}</span> : value}
            </Column>
          </Row>
        ))}
      </Section>
      {lead.message && (
        <Section dir="rtl" style={{ backgroundColor: colors.soft, borderRadius: 12, padding: "12px 14px", margin: "0 0 12px", ...rtl }}>
          <Text style={{ margin: 0, fontSize: 13, color: colors.muted, ...rtl }}>{leadCopy.labels.message}</Text>
          <Text style={{ margin: "4px 0 0", fontSize: 15, lineHeight: "24px", color: colors.text, whiteSpace: "pre-wrap", ...rtl }}>{lead.message}</Text>
        </Section>
      )}
      {whatsappUrl && <CtaButton href={whatsappUrl} color="#16a34a">{leadCopy.replyWhatsapp}</CtaButton>}
      <CtaButton href={leadsUrl} color={whatsappUrl ? colors.ink : colors.brand}>{leadCopy.allLeads}</CtaButton>
    </EmailLayout>
  );
}
