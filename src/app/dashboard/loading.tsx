export default function Loading() {
  return <main className="min-h-screen bg-[#f4f6fa] p-5" aria-busy="true" aria-label="טוען"><div className="mx-auto max-w-6xl animate-pulse"><div className="h-16 rounded-2xl bg-white" /><div className="mt-8 h-10 w-72 rounded-xl bg-[#e4e8ef]" /><div className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">{Array.from({ length: 4 }).map((_, index) => <div key={index} className="h-36 rounded-2xl bg-white" />)}</div><div className="mt-5 h-80 rounded-2xl bg-white" /></div></main>;
}
