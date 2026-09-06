import { NextResponse } from "next/server";
import { z } from "zod";
import { contactTopicIds, topicLabel, topicPriority } from "@/lib/contact";
import { brand } from "@/lib/config";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { isSupabaseAdminConfigured } from "@/lib/supabase/env";
import { clientIp, rateLimit, tooManyRequests } from "@/lib/rate-limit";
import { getViewer } from "@/lib/data";

const schema = z.object({
  topic: z.enum(contactTopicIds),
  name: z.string().min(2, "יש להזין שם מלא").max(80),
  email: z.string().email("כתובת האימייל אינה תקינה").max(160),
  phone: z.string().max(30).optional(),
  message: z.string().min(10, "יש לפרט לפחות 10 תווים").max(2000),
  // מלכודת ספאם: שדה מוסתר שרק בוט ימלא. מתקבל בסכמה ונבדק בקוד,
  // כדי שהתשובה תיראה תקינה ולא תסגיר מה חסם אותו.
  company: z.string().max(200).optional(),
});

export async function POST(request: Request) {
  const ip = await clientIp();
  const limited = rateLimit(`contact:${ip}`, 5, 900);
  if (!limited.ok) return tooManyRequests(limited, "נשלחו יותר מדי פניות מהמכשיר הזה. נסו שוב בעוד מספר דקות.");

  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    return NextResponse.json(
      { error: issue?.message || "הפרטים אינם תקינים", field: issue?.path?.[0] },
      { status: 400 },
    );
  }

  // בוט שמילא את המלכודת מקבל תשובה תקינה, כדי לא ללמד אותו מה נחסם.
  if (parsed.data.company) return NextResponse.json({ ok: true });

  const viewer = await getViewer().catch(() => null);
  const record = {
    topic: parsed.data.topic,
    topic_label: topicLabel(parsed.data.topic),
    priority: topicPriority(parsed.data.topic),
    name: parsed.data.name,
    email: parsed.data.email,
    phone: parsed.data.phone || "",
    message: parsed.data.message,
    user_id: viewer && !viewer.demo ? viewer.id : null,
    status: "new" as const,
  };

  if (!isSupabaseAdminConfigured) {
    // ללא מסד נתונים הפנייה לא נשמרת — אומרים את זה במפורש במקום להעמיד פנים.
    return NextResponse.json({ ok: true, demo: true, fallbackEmail: brand.supportEmail });
  }

  const admin = createSupabaseAdminClient();
  if (!admin) return NextResponse.json({ error: "השירות אינו זמין כרגע" }, { status: 503 });

  const { error } = await admin.from("contact_messages").insert(record);
  if (error) return NextResponse.json({ error: "לא הצלחנו לשלוח את הפנייה. אפשר לכתוב לנו במייל." }, { status: 500 });

  return NextResponse.json({ ok: true });
}
