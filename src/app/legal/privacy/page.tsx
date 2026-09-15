import type { Metadata } from "next";
import { LegalPage } from "@/components/legal-page";
import { brand } from "@/lib/config";
import { LEGAL_EFFECTIVE_DATE } from "@/lib/legal";
import { PrivacyBody } from "@/components/legal/documents/privacy-body";

export const metadata: Metadata = {
  title: "מדיניות פרטיות",
  description: `כיצד ${brand.name} אוספת, מעבדת ושומרת מידע אישי.`,
  alternates: { canonical: "/legal/privacy" },
};

export default function PrivacyPage() {
  return (
    <LegalPage eyebrow="פרטיות ושקיפות" title="מדיניות פרטיות" updated={LEGAL_EFFECTIVE_DATE}>
      <PrivacyBody />
    </LegalPage>
  );
}