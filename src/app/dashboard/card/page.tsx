import { CardBuilderV2 } from "@/components/dashboard/card-builder-v2";
import { brand } from "@/lib/config";
import { getDashboardCard, getViewer } from "@/lib/data";
import { resolveAccess } from "@/lib/plan-access";

export default async function CardBuilderPage({ searchParams }: { searchParams: Promise<{ tour?: string; preview?: string }> }) {
  const query = await searchParams;
  const viewer = await getViewer();
  if (!viewer) return null;
  const card = await getDashboardCard(viewer);
  const access = resolveAccess(viewer);
  return <CardBuilderV2 initialCard={card} demo={viewer.demo} siteUrl={brand.siteUrl} planId={access.plan} locked={access.locked} lockReason={access.reason} trialActive={access.trial.active} forceTour={query.tour === "1"} initialPreviewMode={query.preview === "desktop" ? "desktop" : "mobile"} />;
}
