import { getLeads, getViewer } from "@/lib/data";
import { requiredPlanForFeature, planName, resolveAccess } from "@/lib/plan-access";

// Excel ו‑Google Sheets מריצים תא שמתחיל ב‑= + - @ כנוסחה. הערכים מגיעים
// מטופס ציבורי, ולכן מקדימים גרש שמנטרל את ההרצה בלי לשנות את מה שנקרא בתא.
function stripControl(value: string) {
  return Array.from(value).filter((char) => char.codePointAt(0)! >= 32 || char === "\n").join("");
}
const formulaPrefix = /^[=+\-@\t\r]/;

function csvCell(value: string) {
  const text = stripControl(String(value ?? ""));
  const guarded = formulaPrefix.test(text) ? `'${text}` : text;
  return `"${guarded.replace(/"/g, '""')}"`;
}

export async function GET() {
  const viewer = await getViewer();
  if (!viewer) return new Response("Unauthorized", { status: 401 });
  const access = resolveAccess(viewer);
  if (!access.features.leadExport) {
    return new Response(`ייצוא לידים זמין במסלול ${planName(requiredPlanForFeature("leadExport"))}`, { status: 403 });
  }
  const leads = await getLeads(viewer);
  const rows = [
    ["שם", "טלפון", "אימייל", "הודעה", "סטטוס", "תאריך"],
    ...leads.map((lead) => [lead.name, lead.phone, lead.email, lead.message, lead.status, lead.createdAt]),
  ];
  const csv = "﻿" + rows.map((row) => row.map(csvCell).join(",")).join("\r\n");
  return new Response(csv, {
    headers: {
      "content-type": "text/csv; charset=utf-8",
      "content-disposition": `attachment; filename="leads-${new Date().toISOString().slice(0, 10)}.csv"`,
      "cache-control": "private, no-store",
    },
  });
}
