import { createElement } from "react";
import type { SupabaseClient } from "@supabase/supabase-js";
import { brand } from "@/lib/config";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { loadPreferences, sendNonCriticalEmail } from "@/lib/marketing-mail";
import { decideTrialEmail, decideWeeklyReport, firstName, isIsraelSunday, weekKey } from "@/lib/lifecycle-emails";
import { toNumber, type UserOverviewRow } from "@/lib/user-control";
import { TrialEmail, trialEmailContent, type TrialEmailKind } from "@/emails/trial-email";
import { WeeklyReportEmail, WeeklyTipsEmail } from "@/emails/weekly-report";
import { weeklyCopy, type WeeklyStats } from "@/emails/copy";

const DAY = 86400000;
const LIFECYCLE_KEYS = ["trial_ending_3d", "trial_ending_1d", "trial_ended", "weekly_report", "weekly_tips"];

export type LifecycleEntry = {
  userId: string;
  email: string;
  type: TrialEmailKind | "weekly_report" | "weekly_tips";
  status: "sent" | "dry_run" | "skipped" | "failed";
  detail?: string;
};

export type LifecycleReport = { ranAt: string; dryRun: boolean; weekly: boolean; entries: LifecycleEntry[] };

type StatsRow = { views: number | string; clicks: number | string; whatsapp: number | string; phone: number | string; navigation: number | string; contact_save: number | string; leads: number | string };

async function cardStats(admin: SupabaseClient, userId: string, since: number, until: number): Promise<WeeklyStats> {
  const { data } = await admin.rpc("user_card_stats", { target_user: userId, since: new Date(since).toISOString(), until: new Date(until).toISOString() });
  const row = ((data || []) as StatsRow[])[0];
  return {
    views: toNumber(row?.views),
    clicks: toNumber(row?.clicks),
    leads: toNumber(row?.leads),
    whatsapp: toNumber(row?.whatsapp),
    phone: toNumber(row?.phone),
    navigation: toNumber(row?.navigation),
    contactSave: toNumber(row?.contact_save),
  };
}

const utm = (campaign: string) => `utm_source=email&utm_medium=lifecycle&utm_campaign=${campaign}`;

/**
 * הרצה אחת: מיילי סיום ניסיון בכל יום, ודוח שבועי בימי ראשון.
 *
 * dryRun מחשב הכל (כולל הנתונים) ולא שולח ולא רושם. כך אפשר לראות מראש
 * מי יקבל מה, לפני שמפעילים את השליחה האמיתית.
 */
export async function runLifecycleEmails(options: { dryRun: boolean; now?: number; forceWeekly?: boolean }): Promise<LifecycleReport> {
  const now = options.now ?? Date.now();
  const weekly = options.forceWeekly || isIsraelSunday(now);
  const report: LifecycleReport = { ranAt: new Date(now).toISOString(), dryRun: options.dryRun, weekly, entries: [] };

  const admin = createSupabaseAdminClient();
  if (!admin) throw new Error("שירות הנתונים אינו זמין");

  const { data: overview, error } = await admin.rpc("admin_users_overview");
  if (error) throw new Error(`admin_users_overview: ${error.message}`);
  const rows = (overview || []) as UserOverviewRow[];

  // מה כבר נשלח לכל משתמש, מהיומן: זה מה שמונע כפילויות.
  const { data: sentRows } = await admin
    .from("user_events")
    .select("user_id,metadata")
    .eq("event_type", "email_sent")
    .in("metadata->>email", LIFECYCLE_KEYS);
  const sentKeys = new Map<string, Set<string>>();
  const sentWeeks = new Map<string, Set<string>>();
  for (const row of (sentRows || []) as Array<{ user_id: string; metadata: Record<string, unknown> }>) {
    const key = String(row.metadata?.email || "");
    if (!sentKeys.has(row.user_id)) sentKeys.set(row.user_id, new Set());
    sentKeys.get(row.user_id)!.add(key);
    if ((key === "weekly_report" || key === "weekly_tips") && typeof row.metadata?.week === "string") {
      if (!sentWeeks.has(row.user_id)) sentWeeks.set(row.user_id, new Set());
      sentWeeks.get(row.user_id)!.add(row.metadata.week);
    }
  }

  const preferences = await loadPreferences(admin, rows.map((row) => row.user_id));
  const pricingUrl = `${brand.siteUrl}/pricing`;
  const buildUrl = `${brand.siteUrl}/dashboard/card`;

  // ── מיילי סיום ניסיון ────────────────────────────────────────────────────
  for (const row of rows) {
    const decision = decideTrialEmail(row, sentKeys.get(row.user_id) || new Set(), now);
    if (!decision.kind) continue;
    const kind = decision.kind;
    const prefs = preferences.get(row.user_id);
    if (prefs && !prefs.trial_reminders) {
      report.entries.push({ userId: row.user_id, email: row.email || "", type: kind, status: "skipped", detail: "opted_out" });
      continue;
    }

    const since = Date.parse(row.trial_started_at!);
    const stats = await cardStats(admin, row.user_id, since, now);
    const input = {
      name: firstName(row.full_name),
      businessName: (row.primary_business_name || "").trim(),
      daysLeft: decision.daysLeft,
      hasCard: toNumber(row.card_count) > 0,
      stats,
    };
    const content = trialEmailContent(kind, input);

    if (options.dryRun) {
      report.entries.push({ userId: row.user_id, email: row.email || "", type: kind, status: "dry_run", detail: content.subject });
      continue;
    }

    const result = await sendNonCriticalEmail(admin, {
      userId: row.user_id,
      to: row.email!,
      category: "trial_reminders",
      emailKey: kind,
      subject: content.subject,
      preferences: prefs,
      metadata: { views: stats.views, clicks: stats.clicks, leads: stats.leads, has_card: input.hasCard },
      build: (links) => createElement(TrialEmail, {
        kind,
        input,
        ctaUrl: `${pricingUrl}?${utm(kind)}`,
        buildUrl: `${buildUrl}?${utm(kind)}`,
        unsubscribe: links,
      }),
    });
    report.entries.push({ userId: row.user_id, email: row.email || "", type: kind, status: result.sent ? "sent" : "failed", detail: result.sent ? content.subject : result.reason });
  }

  // ── דוח שבועי (ימי ראשון) ────────────────────────────────────────────────
  if (weekly) {
    const week = weekKey(now);
    for (const row of rows) {
      const decision = decideWeeklyReport(row, sentWeeks.get(row.user_id) || new Set(), now);
      if (!decision.send) continue;
      const prefs = preferences.get(row.user_id);
      const thisWeek = await cardStats(admin, row.user_id, now - 7 * DAY, now);
      const type = thisWeek.views === 0 ? "weekly_tips" : "weekly_report";
      if (prefs && !prefs.weekly_report) {
        report.entries.push({ userId: row.user_id, email: row.email || "", type, status: "skipped", detail: "opted_out" });
        continue;
      }
      const name = firstName(row.full_name);
      const subject = type === "weekly_tips" ? weeklyCopy.tips({ name }).subject : weeklyCopy.report({ name, thisWeek, lastWeek: thisWeek }).subject;

      if (options.dryRun) {
        report.entries.push({ userId: row.user_id, email: row.email || "", type, status: "dry_run", detail: subject });
        continue;
      }

      const lastWeek = type === "weekly_report" ? await cardStats(admin, row.user_id, now - 14 * DAY, now - 7 * DAY) : thisWeek;
      const result = await sendNonCriticalEmail(admin, {
        userId: row.user_id,
        to: row.email!,
        category: "weekly_report",
        emailKey: type,
        subject,
        preferences: prefs,
        metadata: { week, views: thisWeek.views, clicks: thisWeek.clicks, leads: thisWeek.leads },
        build: (links) => type === "weekly_tips"
          ? createElement(WeeklyTipsEmail, { name, ctaUrl: `${brand.siteUrl}/dashboard/card?${utm("weekly_tips")}`, unsubscribe: links })
          : createElement(WeeklyReportEmail, { name, thisWeek, lastWeek, ctaUrl: `${brand.siteUrl}/dashboard/analytics?${utm("weekly_report")}`, unsubscribe: links }),
      });
      report.entries.push({ userId: row.user_id, email: row.email || "", type, status: result.sent ? "sent" : "failed", detail: result.sent ? subject : result.reason });
    }
  }

  return report;
}
