import { LeadsTable } from "@/components/dashboard/leads-table";
import { LeadExportButton } from "@/components/dashboard/lead-export-button";
import { getLeads, getViewer } from "@/lib/data";
import { resolveAccess } from "@/lib/plan-access";

export default async function LeadsPage() {
  const viewer = await getViewer();
  if (!viewer) return null;
  const leads = await getLeads(viewer);
  return (
    <div className="mx-auto max-w-[1260px]">
      <div className="mb-6 flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
        <div>
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
