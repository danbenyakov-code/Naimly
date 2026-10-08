"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { ArrowDown, ArrowUp, Download, ExternalLink, Search } from "lucide-react";
import {
  eventLabel,
  formatDateTime,
  funnelStageLabel,
  funnelStages,
  planStateLabel,
  type ControlUser,
  type FunnelStage,
  type PlanState,
} from "@/lib/user-control";
import { StageBadge, PlanStateBadge } from "@/components/admin/user-control-badges";

type SortKey =
  | "name" | "email" | "signedUpAt" | "lastSeenAt" | "emailVerified" | "planState" | "trialDaysLeft"
  | "published" | "views" | "clicks" | "leads" | "stage" | "lastActivityAt";

const stageOrder = Object.fromEntries(funnelStages.map((stage, index) => [stage.id, index])) as Record<FunnelStage, number>;

function sortValue(user: ControlUser, key: SortKey): number | string {
  switch (key) {
    case "name": return `${user.name} ${user.businessName}`;
    case "email": return user.email;
    case "signedUpAt": return new Date(user.signedUpAt).getTime() || 0;
    case "lastSeenAt": return user.lastSeenAt ? new Date(user.lastSeenAt).getTime() : 0;
    case "emailVerified": return user.emailVerified ? 1 : 0;
    case "planState": return planStateLabel[user.planState];
    case "trialDaysLeft": return user.trialDaysLeft ?? 9999;
    case "published": return user.published ? 2 : user.cardCount > 0 ? 1 : 0;
    case "views": return user.views;
    case "clicks": return user.clicks;
    case "leads": return user.leads;
    case "stage": return stageOrder[user.stage];
    case "lastActivityAt": return user.lastActivityAt ? new Date(user.lastActivityAt).getTime() : 0;
  }
}

function csvCell(value: string | number) {
  const text = String(value ?? "");
  return /[",\n\r]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

function exportCsv(users: ControlUser[], siteUrl: string) {
  const header = ["שם", "שם העסק", "אימייל", "טלפון", "תאריך הרשמה", "כניסה אחרונה", "אימת מייל", "מסלול", "סטטוס", "ימים לסיום ניסיון", "יש כרטיס", "מפורסם", "קישור לכרטיס", "צפיות", "לחיצות", "פניות", "שלב במשפך", "פעילות אחרונה", "תאריך פעילות אחרונה"];
  const lines = users.map((user) => [
    user.name, user.businessName, user.email, user.phone, formatDateTime(user.signedUpAt), formatDateTime(user.lastSeenAt),
    user.emailVerified ? "כן" : "לא", user.plan, planStateLabel[user.planState], user.trialDaysLeft ?? "",
    user.cardCount > 0 ? "כן" : "לא", user.published ? "כן" : "לא", user.cardSlug ? `${siteUrl}/${user.cardSlug}` : "",
    user.views, user.clicks, user.leads, funnelStageLabel[user.stage], eventLabel(user.lastActivityType), formatDateTime(user.lastActivityAt),
  ].map(csvCell).join(","));
  // BOM: בלעדיו Excel פותח את העברית כג'יבריש.
  const blob = new Blob(["﻿" + [header.join(","), ...lines].join("\r\n")], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `naimly-users-${new Date().toISOString().slice(0, 10)}.csv`;
  link.click();
  URL.revokeObjectURL(url);
}

function DaysLeft({ days }: { days: number | null }) {
  if (days === null) return <span className="text-[#a0a9b8]">-</span>;
  return <span className={days <= 3 ? "font-extrabold text-[#c42b3f]" : "font-bold text-[#334155]"}>{days}</span>;
}

function CardCell({ user }: { user: ControlUser }) {
  if (user.cardCount === 0) return <span className="text-[#a0a9b8]">אין כרטיס</span>;
  return (
    <span className="inline-flex flex-wrap items-center gap-1.5">
      <span className={user.published ? "font-bold text-[#08735f]" : "font-bold text-[#aa6100]"}>{user.published ? "מפורסם" : "טיוטה"}</span>
      {user.cardSlug && user.published && (
        <a href={`/${user.cardSlug}`} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-0.5 text-xs font-bold text-[#6d4aff] hover:underline" aria-label={`פתיחת הכרטיס ${user.cardSlug} בלשונית חדשה`}>
          /{user.cardSlug}<ExternalLink size={12} aria-hidden="true" />
        </a>
      )}
    </span>
  );
}

export function UsersControl({ users, siteUrl }: { users: ControlUser[]; siteUrl: string }) {
  const [query, setQuery] = useState("");
  const [stage, setStage] = useState<FunnelStage | "">("");
  const [state, setState] = useState<PlanState | "">("");
  const [sort, setSort] = useState<{ key: SortKey; dir: "asc" | "desc" }>({ key: "signedUpAt", dir: "desc" });

  const visible = useMemo(() => {
    const needle = query.trim().toLowerCase();
    const filtered = users.filter((user) => {
      if (stage && user.stage !== stage) return false;
      if (state && user.planState !== state) return false;
      if (!needle) return true;
      return [user.name, user.businessName, user.email, user.phone, user.cardSlug || ""].some((value) => value.toLowerCase().includes(needle));
    });
    const factor = sort.dir === "asc" ? 1 : -1;
    return [...filtered].sort((a, b) => {
      const left = sortValue(a, sort.key);
      const right = sortValue(b, sort.key);
      if (typeof left === "string" && typeof right === "string") return left.localeCompare(right, "he") * factor;
      return ((left as number) - (right as number)) * factor;
    });
  }, [users, query, stage, state, sort]);

  const stageCounts = useMemo(() => {
    const counts = new Map<FunnelStage, number>();
    users.forEach((user) => counts.set(user.stage, (counts.get(user.stage) || 0) + 1));
    return counts;
  }, [users]);

  function toggleSort(key: SortKey) {
    setSort((current) => (current.key === key ? { key, dir: current.dir === "asc" ? "desc" : "asc" } : { key, dir: "desc" }));
  }

  function header(label: string, sortKey: SortKey) {
    const active = sort.key === sortKey;
    return (
      <th key={sortKey} scope="col" className="p-3 font-bold" aria-sort={active ? (sort.dir === "asc" ? "ascending" : "descending") : "none"}>
        <button type="button" onClick={() => toggleSort(sortKey)} className="inline-flex items-center gap-1 whitespace-nowrap hover:text-[#18243a]">
          {label}
          {active && (sort.dir === "asc" ? <ArrowUp size={12} aria-hidden="true" /> : <ArrowDown size={12} aria-hidden="true" />)}
        </button>
      </th>
    );
  }

  return (
    <section className="card-surface mt-5 overflow-hidden">
      <div className="flex flex-col gap-3 border-b border-[#e2e6ee] p-4 sm:p-5">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
          <label className="relative flex-1">
            <span className="sr-only">חיפוש לפי שם, עסק, אימייל או טלפון</span>
            <Search size={16} className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-[#8b96a8]" aria-hidden="true" />
            <input
              type="search"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="חיפוש לפי שם, עסק, אימייל או טלפון"
              className="min-h-11 w-full rounded-xl border border-[#dfe4ec] bg-white pr-9 pl-3 text-sm outline-none focus:border-[#6d4aff]"
            />
          </label>
          <div className="grid grid-cols-2 gap-3 sm:flex">
            <label className="min-w-0">
              <span className="sr-only">סינון לפי שלב במשפך</span>
              <select value={stage} onChange={(event) => setStage(event.target.value as FunnelStage | "")} className="min-h-11 w-full rounded-xl border border-[#dfe4ec] bg-white px-3 text-sm sm:w-56">
                <option value="">כל השלבים</option>
                {funnelStages.map((item) => <option key={item.id} value={item.id}>{item.label} ({stageCounts.get(item.id) || 0})</option>)}
              </select>
            </label>
            <label className="min-w-0">
              <span className="sr-only">סינון לפי סטטוס מסלול</span>
              <select value={state} onChange={(event) => setState(event.target.value as PlanState | "")} className="min-h-11 w-full rounded-xl border border-[#dfe4ec] bg-white px-3 text-sm sm:w-44">
                <option value="">כל הסטטוסים</option>
                {(Object.keys(planStateLabel) as PlanState[]).map((key) => <option key={key} value={key}>{planStateLabel[key]}</option>)}
              </select>
            </label>
          </div>
          <button type="button" onClick={() => exportCsv(visible, siteUrl)} className="button-secondary min-h-11 shrink-0 gap-2 px-4 text-sm">
            <Download size={16} aria-hidden="true" />
            ייצוא ל־CSV
          </button>
        </div>
        <p className="text-xs text-[#7d8899]" aria-live="polite">מוצגים {visible.length} מתוך {users.length} משתמשים</p>
      </div>

      {/* נייד: כרטיסיות */}
      <ul className="divide-y divide-[#edf0f5] lg:hidden">
        {visible.map((user) => (
          <li key={user.id}>
            <Link href={`/admin/users/${user.id}`} className="block p-4 hover:bg-[#f8f9fc]">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <strong className="block truncate">{user.name}{user.isAdmin && <span className="mr-1.5 text-xs font-bold text-[#6d4aff]">(מנהל)</span>}</strong>
                  {user.businessName && <span className="block truncate text-xs text-[#4a5871]">{user.businessName}</span>}
                  <span className="block truncate text-xs text-[#7d8899]" dir="ltr">{user.email}</span>
                </div>
                <StageBadge stage={user.stage} />
              </div>
              <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1.5 text-xs text-[#5f6d83]">
                <PlanStateBadge state={user.planState} />
                {user.trialDaysLeft !== null && <span>נותרו <DaysLeft days={user.trialDaysLeft} /> ימים</span>}
                <span>{user.views} צפיות · {user.clicks} לחיצות · {user.leads} פניות</span>
              </div>
              <div className="mt-2 text-xs text-[#7d8899]">
                נרשם {formatDateTime(user.signedUpAt)}
                {user.lastActivityAt && <> · אחרון: {eventLabel(user.lastActivityType)} {formatDateTime(user.lastActivityAt)}</>}
              </div>
            </Link>
          </li>
        ))}
      </ul>

      {/* דסקטופ: טבלה */}
      <div className="hidden overflow-x-auto lg:block">
        <table className="w-full min-w-[1500px] text-right text-sm">
          <thead className="bg-[#f8f9fc] text-xs text-[#68758a]">
            <tr>
              {header("שם / עסק", "name")}
              {header("אימייל וטלפון", "email")}
              {header("הרשמה", "signedUpAt")}
              {header("כניסה אחרונה", "lastSeenAt")}
              {header("אימת מייל", "emailVerified")}
              {header("מסלול", "planState")}
              {header("ימים לניסיון", "trialDaysLeft")}
              {header("כרטיס", "published")}
              {header("צפיות", "views")}
              {header("לחיצות", "clicks")}
              {header("פניות", "leads")}
              {header("שלב במשפך", "stage")}
              {header("פעילות אחרונה", "lastActivityAt")}
            </tr>
          </thead>
          <tbody>
            {visible.map((user) => (
              <tr key={user.id} className="border-t border-[#edf0f5] align-top hover:bg-[#fafbfd]">
                <td className="p-3">
                  <Link href={`/admin/users/${user.id}`} className="font-bold text-[#18243a] hover:text-[#6d4aff] hover:underline">{user.name}</Link>
                  {user.isAdmin && <span className="mr-1.5 text-xs font-bold text-[#6d4aff]">(מנהל)</span>}
                  {user.businessName && <span className="block text-xs text-[#4a5871]">{user.businessName}</span>}
                </td>
                <td className="p-3">
                  <span className="block text-xs" dir="ltr">{user.email}</span>
                  {user.phone && <span className="block text-xs text-[#7d8899]" dir="ltr">{user.phone}</span>}
                </td>
                <td className="whitespace-nowrap p-3 text-xs text-[#5f6d83]">{formatDateTime(user.signedUpAt)}</td>
                <td className="whitespace-nowrap p-3 text-xs text-[#5f6d83]">{formatDateTime(user.lastSeenAt) || <span className="text-[#a0a9b8]">-</span>}</td>
                <td className="p-3">{user.emailVerified ? <span className="font-bold text-[#08735f]">כן</span> : <span className="font-bold text-[#c42b3f]">לא</span>}</td>
                <td className="p-3"><span className="block text-xs font-bold">{user.plan}</span><PlanStateBadge state={user.planState} /></td>
                <td className="p-3 text-center"><DaysLeft days={user.trialDaysLeft} /></td>
                <td className="p-3 text-xs"><CardCell user={user} /></td>
                <td className="p-3 text-center font-bold">{user.views}</td>
                <td className="p-3 text-center font-bold">{user.clicks}</td>
                <td className="p-3 text-center font-bold">{user.leads}</td>
                <td className="p-3"><StageBadge stage={user.stage} /></td>
                <td className="p-3 text-xs">
                  {user.lastActivityAt ? <><span className="block font-bold">{eventLabel(user.lastActivityType)}</span><span className="text-[#7d8899]">{formatDateTime(user.lastActivityAt)}</span></> : <span className="text-[#a0a9b8]">-</span>}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {visible.length === 0 && <p className="p-8 text-center text-sm text-[#7d8899]">לא נמצאו משתמשים שמתאימים לחיפוש.</p>}
    </section>
  );
}
