import { CtaButton, EmailLayout, Heading, Paragraph, StatsRow, type UnsubscribeLinks } from "@/emails/layout";
import { trialCopy, type TrialEmailInput } from "@/emails/copy";

export type TrialEmailKind = "trial_ending_3d" | "trial_ending_1d" | "trial_ended";

export function trialEmailContent(kind: TrialEmailKind, input: TrialEmailInput) {
  if (kind === "trial_ended") return trialCopy.ended(input);
  if (kind === "trial_ending_1d") return trialCopy.lastDay(input);
  return trialCopy.ending(input);
}

/** מיילי סיום הניסיון: 3 ימים לפני, יום לפני, וביום הסיום. */
export function TrialEmail({ kind, input, ctaUrl, buildUrl, unsubscribe }: {
  kind: TrialEmailKind;
  input: TrialEmailInput;
  /** עמוד המחירים. */
  ctaUrl: string;
  /** בונה הכרטיס, למי שעוד לא בנה. */
  buildUrl: string;
  unsubscribe: UnsubscribeLinks;
}) {
  const content = trialEmailContent(kind, input);
  // מי שלא בנה כרטיס לפני הסיום נשלח לבונה. אחרי הסיום, בכל מקרה לבחירת מסלול.
  const href = !input.hasCard && kind !== "trial_ended" ? buildUrl : ctaUrl;
  return (
    <EmailLayout preview={content.preview} unsubscribe={unsubscribe}>
      <Heading>{content.heading}</Heading>
      {content.paragraphs.map((paragraph) => <Paragraph key={paragraph}>{paragraph}</Paragraph>)}
      {content.showStats && <StatsRow stats={input.stats} />}
      {"after" in content && content.after && <Paragraph>{content.after}</Paragraph>}
      <CtaButton href={href}>{content.cta}</CtaButton>
      {href === ctaUrl && <Paragraph><span style={{ fontSize: 13, color: "#68758a" }}>{trialCopy.priceNote}</span></Paragraph>}
    </EmailLayout>
  );
}
