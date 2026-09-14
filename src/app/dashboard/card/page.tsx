import { CardBuilderV2 } from "@/components/dashboard/card-builder-v2";
import { CardSwitcher } from "@/components/dashboard/card-switcher";
import { brand } from "@/lib/config";
import { getDashboardCard, getUserCards, getViewer } from "@/lib/data";
import { planLimits, planName, resolveAccess } from "@/lib/plan-access";

export default async function CardBuilderPage({
  searchParams,
}: {
  searchParams: Promise<{ tour?: string; preview?: string; card?: string }>;
}) {
  const query = await searchParams;
  const viewer = await getViewer();
  if (!viewer) return null;

  /*
   * REQ-011: הכרטיס הנערך נקבע לפי ה-URL. getDashboardCard מסנן לפי
   * user_id, ולכן מזהה של כרטיס אחר פשוט אינו נמצא ונופל לכרטיס הראשי
   * — ולא חושף דבר.
   */
  const [card, cards] = await Promise.all([getDashboardCard(viewer, query.card), getUserCards(viewer)]);
  const access = resolveAccess(viewer);
  const limits = planLimits(access.plan);

  return (
    <>
      <CardSwitcher
        cards={cards}
        activeId={card.id}
        maxCards={limits.cards}
        planName={planName(access.plan)}
        canAdd={limits.cards > 1 && !access.locked}
        demo={viewer.demo}
      />
      <CardBuilderV2
        initialCard={card}
        demo={viewer.demo}
        siteUrl={brand.siteUrl}
        planId={access.plan}
        accountEmail={viewer.email}
        onboardingSeenAt={viewer.onboardingSeenAt}
        locked={access.locked}
        lockReason={access.reason}
        trialActive={access.trial.active}
        forceTour={query.tour === "1"}
        initialPreviewMode={query.preview === "desktop" ? "desktop" : "mobile"}
      />
    </>
  );
}
