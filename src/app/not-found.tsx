import Link from "next/link";
import { Logo } from "@/components/logo";

export default function NotFound() {
  return <main className="grid min-h-screen place-items-center bg-[#f4f6fa] p-4"><div className="card-surface w-full max-w-lg p-8 text-center"><div className="flex justify-center"><Logo /></div><p className="mt-8 text-6xl font-black text-[#6d4aff]">404</p><h1 className="mt-3 text-2xl font-black">העמוד או הכרטיס לא נמצאו</h1><p className="mt-2 text-[#68758a]">ייתכן שהכתובת השתנתה או שהכרטיס עדיין לא פורסם.</p><Link href="/" className="button-primary mt-6">חזרה לדף הבית</Link></div></main>;
}
