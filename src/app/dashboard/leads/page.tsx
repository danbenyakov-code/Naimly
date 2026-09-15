import { LeadsTable } from "@/components/dashboard/leads-table";
import { LeadExportButton } from "@/components/dashboard/lead-export-button";
import { getLeads, getUserCards, getViewer } from "@/lib/data";
import { effectiveMaxCards, planName, resolveAccess } from "@/lib/plan-access";
import { BackButton } from "@/components/ui/back-button";
import { CardSwitcher } from "@/components/dashboard/card-switcher";

export default async function LeadsPage({ searchParams }: { searchParams: Promise<{ card?: string }> }) {
  const viewer = await getViewer();
  if (!viewer) return null;
  const params = await searchParams;
  const [leads, cards] = await Promise.all([getLeads(viewer, params.card), getUserCards(viewer)]);
  const access = resolveAccess(viewer);
  const maxCards = effectiveMaxCards(viewer);
  return (
    <div className="mx-auto max-w-[1260px]">
      {/* REQ-011: מעבר בין כרטיסים בכל מסך, לא רק בעורך. */}
      <CardSwitcher
        cards={cards}
        activeId={params.card || cards[0]?.id || ""}
        maxCards={maxCards}
        planName={planName(access.plan)}
        canAdd={maxCards > cards.length && !access.locked}
        canBuy={!access.locked}
        demo={viewer.demo}
        basePath="/dashboard/leads"
      />
      <div className="mb-6 flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
        <div>
          {/* REQ-017: הכפתור מעל הכותרת, בצד ימין, בכל מסך פנימי. */}
          <BackButton fallback="/dashboard" ariaLabel="חזרה מפניות מהכרטיס למסך הקודם" className="mb-3" />
          <p className="text-sm font-bold text-[#6d4aff]">ניהול לידים</p>
          <h1 className="mt-1 text-3xl font-black tracking-[-0.04em]">פניות מהכרטיס</h1>
          <p className="mt-1 text-sm text-[#718096]">כל הפניות שהושארו בטופס, כולל סטטוס ופעולות מהירות.</p>
        </div>
        <LeadExportButton unlocked={resolveAccess(viewer).features.leadExport} plan={resolveAccess(viewer).plan} />
      </div>
      <LeadsTable initialLeads={leads} />
    </div>
  );
}
