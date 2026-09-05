"use client";

import { useEffect } from "react";

/**
 * מסמן על ה-body איזה "רהיט" קבוע יש בתחתית המסך במסך הנוכחי, כדי שהכלים
 * הצפים (נגישות/יצירת קשר) יורמו מעליו בנייד ולא יחסמו אותו.
 */
export function AppChrome({ variant }: { variant: "dashboard" | "builder" }) {
  useEffect(() => {
    document.body.dataset.appChrome = variant;
    return () => { delete document.body.dataset.appChrome; };
  }, [variant]);

  return null;
}
