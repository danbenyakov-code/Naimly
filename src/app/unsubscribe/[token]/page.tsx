import type { Metadata } from "next";
import { Logo } from "@/components/logo";
import { UnsubscribeConfirm } from "@/components/email/unsubscribe-confirm";

export const metadata: Metadata = { title: "הסרה מרשימת התפוצה", robots: { index: false, follow: false } };

export default async function UnsubscribePage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  return (
    <main className="grid min-h-screen place-items-center bg-[radial-gradient(circle_at_50%_0%,rgba(109,74,255,.12),transparent_45%),#f6f7fb] px-4 py-10">
      <div className="w-full max-w-md">
        <div className="mb-6 flex justify-center"><Logo /></div>
        <UnsubscribeConfirm token={token} />
      </div>
    </main>
  );
}
