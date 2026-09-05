"use client";

import { useState } from "react";
import { Mail, MessageCircle, Phone } from "lucide-react";
import type { LeadRecord } from "@/lib/data";
import { whatsappUrl } from "@/lib/utils";

const statusLabels = { new: "חדש", contacted: "בטיפול", closed: "נסגר" };

export function LeadsTable({ initialLeads }: { initialLeads: LeadRecord[] }) {
  const [leads, setLeads] = useState(initialLeads);
  const [error, setError] = useState("");

  async function changeStatus(id: string, status: LeadRecord["status"]) {
    const previous = leads;
    setLeads((items) => items.map((item) => item.id === id ? { ...item, status } : item));
    const response = await fetch(`/api/leads/${id}`, { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify({ status }) });
    if (!response.ok) { setLeads(previous); setError("לא הצלחנו לעדכן את הסטטוס"); }
  }

  if (!leads.length) return <div className="card-surface grid min-h-64 place-items-center p-6 text-center"><div><MessageCircle size={34} className="mx-auto text-[#8b7ff1]" /><h2 className="mt-3 text-xl font-extrabold">עדיין אין פניות</h2><p className="mt-1 text-sm text-[#718096]">כשתתקבל פנייה מטופס הכרטיס היא תופיע כאן.</p></div></div>;

  return (
    <div className="card-surface overflow-hidden">
      {error && <p role="alert" className="border-b border-[#f0bdc3] bg-[#fff2f4] p-3 text-sm text-[#a32031]">{error}</p>}
      <div className="table-scroll hidden md:block"><table className="w-full min-w-[820px] text-right text-sm"><thead className="border-b border-[#e2e6ee] bg-[#f8f9fc] text-xs text-[#68758a]"><tr><th className="p-4">לקוח</th><th className="p-4">הודעה</th><th className="p-4">התקבלה</th><th className="p-4">סטטוס</th><th className="p-4">יצירת קשר</th></tr></thead><tbody>{leads.map((lead) => <tr key={lead.id} className="border-b border-[#edf0f5] last:border-0"><td className="p-4"><strong className="block">{lead.name}</strong><span dir="ltr" className="text-xs text-[#7d8899]">{lead.phone}</span></td><td className="max-w-md p-4 text-[#58667c]">{lead.message}</td><td className="p-4 text-xs text-[#7d8899]">{new Intl.DateTimeFormat("he-IL", { dateStyle: "short", timeStyle: "short" }).format(new Date(lead.createdAt))}</td><td className="p-4"><select className="field-select min-h-11 py-1 text-xs" value={lead.status} onChange={(e) => changeStatus(lead.id, e.target.value as LeadRecord["status"])}>{Object.entries(statusLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></td><td className="p-4"><div className="flex gap-1"><a className="grid h-11 w-11 place-items-center rounded-lg bg-[#e9fbf7] text-[#08735f]" href={whatsappUrl(lead.phone)} aria-label={`WhatsApp אל ${lead.name}`}><MessageCircle size={16} /></a><a className="grid h-11 w-11 place-items-center rounded-lg bg-[#f1efff] text-[#6d4aff]" href={`tel:${lead.phone}`} aria-label={`חיוג אל ${lead.name}`}><Phone size={16} /></a>{lead.email && <a className="grid h-11 w-11 place-items-center rounded-lg bg-[#f3f5f8] text-[#53627a]" href={`mailto:${lead.email}`} aria-label={`אימייל אל ${lead.name}`}><Mail size={16} /></a>}</div></td></tr>)}</tbody></table></div>
      <div className="grid gap-3 p-3 md:hidden">{leads.map((lead) => <article key={lead.id} className="rounded-2xl border border-[#e1e6ee] p-4"><div className="flex items-start justify-between gap-3"><div><strong>{lead.name}</strong><p dir="ltr" className="text-right text-xs text-[#7d8899]">{lead.phone}</p></div><select className="field-select min-h-9 w-28 py-1 text-xs" value={lead.status} onChange={(e) => changeStatus(lead.id, e.target.value as LeadRecord["status"])}>{Object.entries(statusLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></div><p className="mt-3 text-sm leading-6 text-[#58667c]">{lead.message}</p><div className="mt-4 flex gap-2"><a className="button-secondary min-h-10 flex-1 py-1 text-xs" href={whatsappUrl(lead.phone)}><MessageCircle size={15} />WhatsApp</a><a className="button-secondary min-h-10 flex-1 py-1 text-xs" href={`tel:${lead.phone}`}><Phone size={15} />חיוג</a></div></article>)}</div>
    </div>
  );
}
