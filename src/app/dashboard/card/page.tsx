import { CardBuilderV2 } from "@/components/dashboard/card-builder-v2";
import { CardSwitcher } from "@/components/dashboard/card-switcher";
import { brand } from "@/lib/config";
import { getDashboardCard, getUserCards, getViewer } from "@/lib/data";
import { effectiveMaxCards, planName, resolveAccess } from "@/lib/plan-access";

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
  const maxCards = effectiveMaxCards(viewer);

  return (
    <>
      <CardSwitcher
        cards={cards}
        activeId={card.id}
        maxCards={maxCards}
        planName={planName(access.plan)}
        canAdd={maxCards > cards.length && !access.locked}
        canBuy={!access.locked}
        demo={viewer.demo}
      />
      {/*
        * NEW-007 · סיבת השורש: CardBuilderV2 מחזיק `useState(initialCard)`,
        * ו-useState מתעלם מה-prop אחרי ההרכבה הראשונה. בהחלפת כרטיס
        * הרכיב נשאר עם הנתונים הקודמים — והשמירה שלחה את מזהה הכרטיס
        * הישן, כלומר עריכת כרטיס ב׳ הייתה נכתבת לכרטיס א׳.
        *
        * key לפי מזהה הכרטיס מאלץ הרכבה מחדש, ואיתה מתאפסים גם דגל
        * ה-dirty וטיימר השמירה האוטומטית — שאחרת היו חוצים כרטיסים.
        */}
      <CardBuilderV2
        key={card.id}
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
