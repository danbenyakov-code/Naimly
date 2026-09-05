"use client";

export default function GlobalError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return <html lang="he" dir="rtl"><body><main style={{ minHeight: "100vh", display: "grid", placeItems: "center", padding: 24, fontFamily: "Arial, sans-serif", background: "#f4f6fa", color: "#0b1020" }}><div style={{ maxWidth: 520, textAlign: "center", background: "white", border: "1px solid #dfe5ef", borderRadius: 24, padding: 32 }}><h1>לא הצלחנו לטעון את המערכת</h1><p>אפשר לנסות לרענן את המסך. אם התקלה חוזרת, מומלץ לפנות לתמיכה.</p><button type="button" onClick={reset} style={{ border: 0, borderRadius: 12, background: "#6d4aff", color: "white", fontWeight: 700, padding: "12px 20px", cursor: "pointer" }}>ניסיון נוסף</button></div></main></body></html>;
}
