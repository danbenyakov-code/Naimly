import type { Metadata } from "next";
import { LegalPage } from "@/components/legal-page";
import { brand } from "@/lib/config";
import { LEGAL_EFFECTIVE_DATE } from "@/lib/legal";
import { AcceptableUseBody } from "@/components/legal/documents/acceptable-use-body";

export const metadata: Metadata = {
  title: "מדיניות שימוש מותר",
  description: `התוכן וההתנהגות האסורים בשירות ${brand.name}, והצעדים הננקטים בהפרה.`,
  alternates: { canonical: "/legal/acceptable-use" },
};

export default function AcceptableUsePage() {
  return (
    <LegalPage eyebrow="כללי שימוש" title="מדיניות שימוש מותר" updated={LEGAL_EFFECTIVE_DATE}>
      <AcceptableUseBody />
    </LegalPage>
  );
}