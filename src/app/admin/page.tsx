import { CreditCard, FileBadge2, MessageSquareText, Users } from "lucide-react";
import { getAdminSummary, getViewer } from "@/lib/data";
import { formatCurrency, formatCompact } from "@/lib/utils";

const planLabels = { trial: "התנסות", basic: "בסיסי", pro: "מקצועי", premium: "פרימיום" };

export default async function AdminPage() {
  const viewer = await getViewer();
  if (!viewer) return null;
  const summary = await getAdminSummary(viewer);
  if (!summary) return null;
  const cards = [
    { label: "לקוחות", value: formatCompact(summary.customers), icon: Users, color: "bg-[#efecff] text-[#6d4aff]" },
    { label: "כרטיסים פעילים", value: formatCompact(summary.activeCards), icon: FileBadge2, color: "bg-[#e9fbf7] text-[#08735f]" },
    { label: "הכנסה חודשית", value: formatCurrency(summary.monthlyRevenue), icon: CreditCard, color: "bg-[#fff4e6] text-[#aa6100]" },
    { label: "פניות שנוצרו", value: formatCompact(summary.leads), icon: MessageSquareText, color: "bg-[#fff0f2] text-[#b7293a]" },
  ];
  return <div className="mx-auto max-w-[1260px]"><div><p className="text-sm font-bold text-[#6d4aff]">Admin</p><h1 className="mt-1 text-3xl font-black tracking-[-0.04em]">ניהול המערכת</h1><p className="mt-1 text-sm text-[#718096]">לקוחות, מנויים ופעילות עסקית במקום אחד.</p></div><section className="mt-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">{cards.map(({ label, value, icon: Icon, color }) => <article key={label} className="card-surface p-5"><span className={`grid h-11 w-11 place-items-center rounded-2xl ${color}`}><Icon size={21} /></span><strong className="mt-4 block text-2xl tracking-tight">{value}</strong><span className="text-sm text-[#718096]">{label}</span></article>)}</section><section className="card-surface mt-5 overflow-hidden"><div className="flex items-center justify-between border-b border-[#e2e6ee] p-5"><div><h2 className="font-extrabold">לקוחות אחרונים</h2><p className="text-xs text-[#7d8899]">החשבונות שנפתחו לאחרונה</p></div><span className="rounded-full bg-[#f0edff] px-3 py-1 text-xs font-bold text-[#6d4aff]">{summary.customers} סה״כ</span></div><div className="overflow-x-auto"><table className="w-full min-w-[720px] text-right text-sm"><thead className="bg-[#f8f9fc] text-xs text-[#68758a]"><tr><th className="p-4">לקוח</th><th className="p-4">מסלול</th><th className="p-4">סטטוס</th><th className="p-4">תאריך הצטרפות</th></tr></thead><tbody>{summary.recentCustomers.map((customer) => <tr key={customer.id} className="border-t border-[#edf0f5]"><td className="p-4"><strong className="block">{customer.name}</strong><span className="text-xs text-[#7d8899]">{customer.email}</span></td><td className="p-4"><span className="rounded-full bg-[#f0edff] px-2.5 py-1 text-xs font-bold text-[#5141b6]">{planLabels[customer.plan]}</span></td><td className="p-4"><span className="inline-flex items-center gap-1.5 text-xs font-bold text-[#08735f]"><span className="h-2 w-2 rounded-full bg-[#16bba4]" />{customer.status === "trialing" ? "ניסיון" : "פעיל"}</span></td><td className="p-4 text-[#6e7a8d]">{new Intl.DateTimeFormat("he-IL", { dateStyle: "medium" }).format(new Date(customer.joinedAt))}</td></tr>)}</tbody></table></div></section></div>;
}
