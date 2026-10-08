import { Column, Row, Section, Text } from "react-email";
import { colors, CtaButton, EmailLayout, Heading, Paragraph, StatsRow, type UnsubscribeLinks } from "@/emails/layout";
import { weeklyCopy, type WeeklyStats } from "@/emails/copy";

const rtl = { direction: "rtl" as const, textAlign: "right" as const };

function change(current: number, previous: number) {
  const diff = current - previous;
  if (diff === 0) return { text: "ללא שינוי", color: colors.muted };
  return diff > 0 ? { text: `+${diff}`, color: colors.green } : { text: `${diff}`, color: "#b7293a" };
}

/** דוח שבועי למי שקיבל צפיות השבוע. */
export function WeeklyReportEmail({ name, thisWeek, lastWeek, ctaUrl, unsubscribe }: {
  name: string;
  thisWeek: WeeklyStats;
  lastWeek: WeeklyStats;
  ctaUrl: string;
  unsubscribe: UnsubscribeLinks;
}) {
  const copy = weeklyCopy.report({ name, thisWeek, lastWeek });
  const actions: Array<[string, number]> = [
    [copy.actions.whatsapp, thisWeek.whatsapp],
    [copy.actions.phone, thisWeek.phone],
    [copy.actions.navigation, thisWeek.navigation],
    [copy.actions.contactSave, thisWeek.contactSave],
  ];
  const comparisons: Array<[string, number, number]> = [
    ["צפיות", thisWeek.views, lastWeek.views],
    ["לחיצות", thisWeek.clicks, lastWeek.clicks],
    ["פניות", thisWeek.leads, lastWeek.leads],
  ];
  return (
    <EmailLayout preview={copy.preview} unsubscribe={unsubscribe}>
      <Heading>{copy.heading}</Heading>
      <Paragraph>{copy.intro}</Paragraph>
      <StatsRow stats={thisWeek} />

      <Text style={{ margin: "8px 0 6px", fontSize: 15, fontWeight: 800, color: colors.ink, ...rtl }}>{copy.actionsTitle}</Text>
      {actions.map(([label, value]) => (
        <Row key={label} dir="rtl" style={{ borderBottom: `1px solid ${colors.line}` }}>
          <Column dir="rtl" style={{ padding: "8px 0", fontSize: 15, color: colors.text, ...rtl }}>{label}</Column>
          <Column dir="rtl" style={{ padding: "8px 0", fontSize: 15, fontWeight: 800, color: colors.ink, textAlign: "left", width: 60 }}>{value}</Column>
        </Row>
      ))}

      <Text style={{ margin: "18px 0 6px", fontSize: 15, fontWeight: 800, color: colors.ink, ...rtl }}>{copy.comparison}</Text>
      <Section dir="rtl" style={{ backgroundColor: colors.soft, borderRadius: 14, padding: "6px 14px" }}>
        {comparisons.map(([label, current, previous]) => {
          const delta = change(current, previous);
          return (
            <Row key={label} dir="rtl">
              <Column dir="rtl" style={{ padding: "6px 0", fontSize: 14, color: colors.text, ...rtl }}>{label}: {current} (שבוע קודם: {previous})</Column>
              <Column dir="rtl" style={{ padding: "6px 0", fontSize: 14, fontWeight: 800, color: delta.color, textAlign: "left", width: 90 }}>{delta.text}</Column>
            </Row>
          );
        })}
      </Section>

      <CtaButton href={ctaUrl}>{copy.cta}</CtaButton>
    </EmailLayout>
  );
}

/** כשלא היו צפיות השבוע: במקום דוח של אפסים, 3 טיפים להפצה. */
export function WeeklyTipsEmail({ name, ctaUrl, unsubscribe }: { name: string; ctaUrl: string; unsubscribe: UnsubscribeLinks }) {
  const copy = weeklyCopy.tips({ name });
  return (
    <EmailLayout preview={copy.preview} unsubscribe={unsubscribe}>
      <Heading>{copy.heading}</Heading>
      <Paragraph>{copy.intro}</Paragraph>
      {copy.tips.map((tip, index) => (
        <Section key={tip.title} dir="rtl" style={{ backgroundColor: colors.soft, borderRadius: 14, padding: "12px 16px", margin: "0 0 10px", ...rtl }}>
          <Text style={{ margin: 0, fontSize: 16, fontWeight: 800, color: colors.ink, ...rtl }}>{index + 1}. {tip.title}</Text>
          <Text style={{ margin: "4px 0 0", fontSize: 15, lineHeight: "24px", color: colors.text, ...rtl }}>{tip.body}</Text>
        </Section>
      ))}
      <CtaButton href={ctaUrl}>{copy.cta}</CtaButton>
    </EmailLayout>
  );
}
