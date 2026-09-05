import { NextResponse } from "next/server";
import { getViewer } from "@/lib/data";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { rateLimit, tooManyRequests } from "@/lib/rate-limit";
import { lockMessages, resolveAccess } from "@/lib/plan-access";

type Kind = "image" | "document";

const imageTypes = { "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp" } as const;
const documentTypes = { "application/pdf": "pdf" } as const;

/**
 * file.type מגיע מהדפדפן וניתן לזיוף. בלי בדיקת חתימת הקובץ אפשר להעלות
 * HTML/SVG שיוגש מהדומיין הציבורי של האחסון עם content-type של תמונה.
 */
function detectType(bytes: Uint8Array) {
  const matches = (offset: number, ...signature: number[]) => signature.every((byte, index) => bytes[offset + index] === byte);
  if (matches(0, 0xff, 0xd8, 0xff)) return "image/jpeg";
  if (matches(0, 0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a)) return "image/png";
  // RIFF....WEBP
  if (matches(0, 0x52, 0x49, 0x46, 0x46) && matches(8, 0x57, 0x45, 0x42, 0x50)) return "image/webp";
  if (matches(0, 0x25, 0x50, 0x44, 0x46, 0x2d)) return "application/pdf";
  return "";
}

export async function POST(request: Request) {
  const viewer = await getViewer();
  if (!viewer) return NextResponse.json({ error: "נדרשת התחברות" }, { status: 401 });
  if (viewer.demo) return NextResponse.json({ error: "העלאה לשרת אינה זמינה במצב הדגמה" }, { status: 400 });
  const access = resolveAccess(viewer);
  if (access.locked) return NextResponse.json({ error: lockMessages[access.reason], reason: access.reason, locked: true }, { status: 402 });

  const limited = rateLimit(`upload:${viewer.id}`, 40, 600);
  if (!limited.ok) return tooManyRequests(limited, "הועלו יותר מדי קבצים ברצף. נסו שוב בעוד מספר דקות.");

  const formData = await request.formData().catch(() => null);
  const file = formData?.get("file");
  const kind: Kind = String(formData?.get("kind") || "image") === "document" ? "document" : "image";
  if (!(file instanceof File)) return NextResponse.json({ error: "לא נבחר קובץ" }, { status: 400 });

  const allowedTypes: Record<string, string> = kind === "document" ? documentTypes : imageTypes;
  const maxSize = kind === "document" ? 10 * 1024 * 1024 : 5 * 1024 * 1024;
  if (file.size === 0) return NextResponse.json({ error: "הקובץ ריק" }, { status: 400 });
  if (file.size > maxSize) return NextResponse.json({ error: `הקובץ גדול מדי. המגבלה היא ${kind === "document" ? 10 : 5}MB` }, { status: 400 });

  const bytes = new Uint8Array(await file.arrayBuffer());
  const detected = detectType(bytes);
  const extension = allowedTypes[detected];
  if (!extension) {
    return NextResponse.json({ error: kind === "document" ? "ניתן להעלות קובצי PDF בלבד" : "ניתן להעלות JPG, PNG או WebP בלבד" }, { status: 400 });
  }

  const supabase = await createSupabaseServerClient();
  if (!supabase) return NextResponse.json({ error: "שירות האחסון אינו זמין" }, { status: 503 });

  // הסיומת נגזרת מהחתימה שזוהתה ולא משם הקובץ שהמשתמש שלח.
  const path = `${viewer.id}/${kind}/${crypto.randomUUID()}.${extension}`;
  const { error } = await supabase.storage.from("card-media").upload(path, bytes, {
    contentType: detected,
    cacheControl: "31536000",
    upsert: false,
  });
  if (error) return NextResponse.json({ error: "לא הצלחנו להעלות את הקובץ" }, { status: 500 });

  const { data } = supabase.storage.from("card-media").getPublicUrl(path);
  return NextResponse.json({ url: data.publicUrl, name: file.name.slice(0, 120) });
}
