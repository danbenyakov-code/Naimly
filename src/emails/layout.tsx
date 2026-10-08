import type { ReactNode } from "react";
import { Body, Button, Column, Container, Head, Hr, Html, Img, Link, Preview, Row, Section, Text } from "react-email";
import { brand } from "@/lib/config";
import { common, type CardStats } from "@/emails/copy";

/**
 * מעטפת לכל המיילים.
 *
 * Gmail מסיר את <html> ואת <body>, ולכן הכיוון והיישור מוגדרים גם על כל
 * אלמנט פנימי (dir + text-align inline). זה מה ששורד את החיתוך.
 */

export const colors = {
  ink: "#0b1020",
  text: "#334155",
  muted: "#68758a",
  brand: "#6d4aff",
  page: "#f4f6fa",
  soft: "#f6f7fb",
  line: "#e7eaf1",
  green: "#0a9b81",
};

const font = "Arial, Helvetica, sans-serif";
const rtl = { direction: "rtl" as const, textAlign: "right" as const };

/** קישורי ההסרה. נוכחותם הופכת מייל ל"לא קריטי": קריטי לעולם אינו מקבל אותם. */
export type UnsubscribeLinks = { unsubscribeUrl: string; preferencesUrl: string };

export function EmailLayout({ preview, children, unsubscribe }: { preview: string; children: ReactNode; unsubscribe?: UnsubscribeLinks }) {
  return (
    <Html lang="he" dir="rtl">
      <Head>
        <meta name="color-scheme" content="light" />
        <meta name="supported-color-schemes" content="light" />
      </Head>
      <Preview>{preview}</Preview>
      <Body dir="rtl" style={{ margin: 0, padding: 0, backgroundColor: colors.page, fontFamily: font, ...rtl }}>
        <Container dir="rtl" style={{ maxWidth: 560, width: "100%", padding: "24px 12px", ...rtl }}>
          <Section dir="rtl" style={{ backgroundColor: colors.ink, borderRadius: "18px 18px 0 0", padding: "18px 24px", ...rtl }}>
            <Row dir="rtl">
              <Column dir="rtl" style={{ width: 44, verticalAlign: "middle" }}>
                <Img src={`${brand.siteUrl}/email/logo.png`} width="36" height="36" alt="" style={{ borderRadius: 10, display: "block" }} />
              </Column>
              <Column dir="rtl" style={{ verticalAlign: "middle", ...rtl }}>
                <Text style={{ margin: 0, color: "#ffffff", fontSize: 20, fontWeight: 800, letterSpacing: "0.5px", ...rtl }}>{brand.name}</Text>
                <Text style={{ margin: 0, color: "#9fb0c8", fontSize: 12, ...rtl }}>{common.brandTagline}</Text>
              </Column>
            </Row>
          </Section>
          <Section dir="rtl" style={{ backgroundColor: "#ffffff", borderRadius: "0 0 18px 18px", padding: "26px 24px", ...rtl }}>
            {children}
          </Section>
          <Section dir="rtl" style={{ padding: "18px 8px 0", textAlign: "center" }}>
            <Text style={{ margin: 0, fontSize: 12, lineHeight: "20px", color: "#8b96a8", textAlign: "center" }}>
              {unsubscribe ? common.marketingFooter : common.serviceFooter}
            </Text>
            {unsubscribe && (
              <Text style={{ margin: "6px 0 0", fontSize: 12, lineHeight: "20px", color: "#8b96a8", textAlign: "center" }}>
                <Link href={unsubscribe.unsubscribeUrl} style={{ color: "#8b96a8", textDecoration: "underline" }}>{common.unsubscribe}</Link>
                {"  ·  "}
                <Link href={unsubscribe.preferencesUrl} style={{ color: "#8b96a8", textDecoration: "underline" }}>{common.managePreferences}</Link>
              </Text>
            )}
            <Text style={{ margin: "6px 0 0", fontSize: 12, color: "#8b96a8", textAlign: "center" }}>
              <Link href={brand.siteUrl} style={{ color: colors.brand }}>{brand.siteUrl.replace(/^https?:\/\//, "")}</Link>
            </Text>
          </Section>
        </Container>
      </Body>
    </Html>
  );
}

export function Heading({ children }: { children: ReactNode }) {
  return <Text style={{ margin: "0 0 14px", fontSize: 22, lineHeight: "30px", fontWeight: 800, color: colors.ink, ...rtl }}>{children}</Text>;
}

export function Paragraph({ children }: { children: ReactNode }) {
  return <Text style={{ margin: "0 0 12px", fontSize: 16, lineHeight: "26px", color: colors.text, ...rtl }}>{children}</Text>;
}

export function CtaButton({ href, children, color = colors.brand }: { href: string; children: ReactNode; color?: string }) {
  return (
    <Section dir="rtl" style={{ padding: "10px 0 4px", ...rtl }}>
      <Button href={href} style={{ backgroundColor: color, color: "#ffffff", borderRadius: 12, padding: "14px 26px", fontSize: 16, fontWeight: 700, textDecoration: "none", display: "inline-block" }}>
        {children}
      </Button>
    </Section>
  );
}

export function Divider() {
  return <Hr style={{ borderColor: colors.line, margin: "20px 0" }} />;
}

/** שלוש קוביות מספרים: צפיות, לחיצות, פניות. */
export function StatsRow({ stats }: { stats: CardStats }) {
  const items: Array<[string, number]> = [
    [common.statsLabels.views, stats.views],
    [common.statsLabels.clicks, stats.clicks],
    [common.statsLabels.leads, stats.leads],
  ];
  return (
    <Section dir="rtl" style={{ margin: "6px 0 16px" }}>
      <Row dir="rtl">
        {items.map(([label, value]) => (
          <Column key={label} dir="rtl" style={{ width: "33%", padding: "0 4px" }}>
            <Section style={{ backgroundColor: colors.soft, borderRadius: 14, padding: "14px 6px", textAlign: "center" }}>
              <Text style={{ margin: 0, fontSize: 26, lineHeight: "32px", fontWeight: 800, color: colors.ink, textAlign: "center" }}>{value.toLocaleString("he-IL")}</Text>
              <Text style={{ margin: 0, fontSize: 13, color: colors.muted, textAlign: "center" }}>{label}</Text>
            </Section>
          </Column>
        ))}
      </Row>
    </Section>
  );
}
