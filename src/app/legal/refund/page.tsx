import type { Metadata } from "next";
import { LegalPage } from "@/components/legal-page";
import { brand } from "@/lib/config";
import { LEGAL_EFFECTIVE_DATE } from "@/lib/legal";
import { RefundBody } from "@/components/legal/documents/refund-body";

export const metadata: Metadata = {
  title: "ביטול והחזרים",
  description: `מדיניות הביטול וההחזרים בשירות ${brand.name}, לפי חוק הגנת הצרכן.`,
  alternates: { canonical: "/legal/refund" },
};

export default function RefundPage() {
  return (
    <LegalPage eyebrow="ביטול עסקה" title="ביטול והחזרים" updated={LEGAL_EFFECTIVE_DATE}>
      <RefundBody />
    </LegalPage>
  );
}