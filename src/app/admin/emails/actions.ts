"use server";

import { getViewer } from "@/lib/data";
import { send } from "@/lib/email";
import { previewIds, renderPreview, type PreviewId } from "@/emails/previews";

/** מייל בדיקה של תבנית, לכתובת של המנהל עצמו בלבד. לא נרשם ביומן. */
export async function sendTestEmailAction(id: PreviewId): Promise<{ ok: boolean; message: string }> {
  const viewer = await getViewer();
  if (!viewer || viewer.role !== "admin" || viewer.demo) return { ok: false, message: "אין הרשאה" };
  if (!previewIds.includes(id)) return { ok: false, message: "תבנית לא מוכרת" };

  const preview = await renderPreview(id);
  const result = await send({ to: viewer.email, subject: `[בדיקה] ${preview.subject}`, html: preview.html, text: preview.text });
  return result.sent
    ? { ok: true, message: `נשלח אל ${viewer.email} (דרך ${result.via})` }
    : { ok: false, message: `השליחה נכשלה: ${result.reason}${"detail" in result && result.detail ? `, ${result.detail}` : ""}` };
}
