import type { Metadata } from "next";
import { LegalPage } from "@/components/legal-page";
import { brand } from "@/lib/config";
import { LEGAL_EFFECTIVE_DATE } from "@/lib/legal";
import { TermsBody } from "@/components/legal/documents/terms-body";

export const metadata: Metadata = {
  title: "תנאי שימוש ומנוי",
  description: `תנאי השימוש והמנוי המחייבים בשירות ${brand.name}.`,
  alternates: { canonical: "/legal/terms" },
};

export default function TermsPage() {
  return (
    <LegalPage eyebrow="הסכם מחייב" title="תנאי שימוש ומנוי" updated={LEGAL_EFFECTIVE_DATE}>
      <TermsBody />
    </LegalPage>
  );
}