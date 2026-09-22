import ExcelJS from "exceljs";
import { getLeads, getViewer } from "@/lib/data";
import { requiredPlanForFeature, planName, resolveAccess } from "@/lib/plan-access";

/**
 * ייצוא לידים כ-XLSX ולא CSV.
 *
 * CSV אצל לקוחות ישראלים נפתח לרוב ב-Excel עם קידוד שגוי או יישור
 * שמאל שמפרק את הטבלה, ואין בו עיצוב כלל. XLSX אמיתי שולט בכיוון
 * הגיליון וביישור, ומגדיר טבלה אמיתית (לא רק תאים צבועים) עם פסים
 * לסירוגין וכפתורי סינון שגם Excel וגם Google Sheets מזהים ככאלה.
 */

// תווי בקרה מנוקים כהיגיינה בסיסית. הסיכון של הזרקת נוסחה (=/+/-/@)
// שרלוונטי ל-CSV אינו חל כאן: תא XLSX מוצהר כמחרוזת במפורש בקובץ
// עצמו, ולכן לא מתפרש כנוסחה גם אם מתחיל באחד התווים האלה.
function safeCell(value: string) {
  return Array.from(String(value ?? "")).filter((char) => char.codePointAt(0)! >= 32 || char === "\n").join("");
}

const columns = [
  { name: "שם", width: 22 },
  { name: "טלפון", width: 16 },
  { name: "אימייל", width: 26 },
  { name: "הודעה", width: 45 },
  { name: "סטטוס", width: 14 },
  { name: "תאריך", width: 20 },
];

export async function GET() {
  const viewer = await getViewer();
  if (!viewer) return new Response("Unauthorized", { status: 401 });
  const access = resolveAccess(viewer);
  if (!access.features.leadExport) {
    return new Response(`ייצוא לידים זמין במסלול ${planName(requiredPlanForFeature("leadExport"))}`, { status: 403 });
  }
  const leads = await getLeads(viewer);

  const workbook = new ExcelJS.Workbook();
  workbook.creator = "NAIMLY";
  workbook.created = new Date();

  const sheet = workbook.addWorksheet("לידים", {
    views: [{ rightToLeft: true, state: "frozen", ySplit: 1 }],
  });

  columns.forEach((column, index) => { sheet.getColumn(index + 1).width = column.width; });

  const rows = leads.map((lead) => [
    safeCell(lead.name),
    safeCell(lead.phone),
    safeCell(lead.email),
    safeCell(lead.message),
    safeCell(lead.status),
    safeCell(lead.createdAt),
  ]);

  // addTable כשאין שורות כלל זורק — טבלה בלי גוף אינה חוקית ב-XLSX,
  // ולכן כותרת ריקה כשאין לידים נכתבת ידנית במקום.
  if (rows.length > 0) {
    sheet.addTable({
      name: "Leads",
      ref: "A1",
      headerRow: true,
      style: { theme: "TableStyleMedium2", showRowStripes: true },
      columns: columns.map((column) => ({ name: column.name, filterButton: true })),
      rows,
    });
  } else {
    sheet.addRow(columns.map((column) => column.name));
  }

  sheet.getRow(1).font = { bold: true, color: { argb: "FFFFFFFF" } };
  sheet.getRow(1).fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF6D4AFF" } };
  sheet.getRow(1).height = 22;

  sheet.eachRow((row, index) => {
    row.alignment = { horizontal: "right", vertical: "middle", wrapText: index > 1 };
  });

  const buffer = await workbook.xlsx.writeBuffer();

  return new Response(buffer, {
    headers: {
      "content-type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "content-disposition": `attachment; filename="leads-${new Date().toISOString().slice(0, 10)}.xlsx"`,
      "cache-control": "private, no-store",
    },
  });
}
