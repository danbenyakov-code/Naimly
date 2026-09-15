import type { Metadata } from "next";
import { LegalPage } from "@/components/legal-page";
import { brand } from "@/lib/config";
import { LEGAL_EFFECTIVE_DATE } from "@/lib/legal";
import { CookiesBody } from "@/components/legal/documents/cookies-body";

export const metadata: Metadata = {
  title: "מדיניות עוגיות",
  description: `מדיניות העוגיות והמדידה של ${brand.name}.`,
  alternates: { canonical: "/legal/cookies" },
};

export default function CookiesPage() {
  return (
    <LegalPage eyebrow="שליטה ושקיפות" title="מדיניות עוגיות" updated={LEGAL_EFFECTIVE_DATE}>
      <CookiesBody />
    </LegalPage>
  );
}