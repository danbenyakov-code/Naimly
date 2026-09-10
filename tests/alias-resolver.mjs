import { pathToFileURL } from "node:url";
import path from "node:path";

/**
 * מפענח את alias ה-`@/` של הפרויקט (מוגדר ב-tsconfig) עבור מריץ הבדיקות
 * של Node, שאינו קורא tsconfig. מאפשר לבדוק מודולים שמייבאים זה את זה
 * בלי לשנות את קוד המערכת לצורך הבדיקות.
 */
const srcRoot = pathToFileURL(path.join(process.cwd(), "src") + path.sep).href;

export function resolve(specifier, context, nextResolve) {
  if (specifier.startsWith("@/")) {
    const rest = specifier.slice(2);
    const hasExtension = /\.(ts|tsx|mts|js|mjs|json)$/.test(rest);
    return nextResolve(srcRoot + rest + (hasExtension ? "" : ".ts"), context);
  }
  return nextResolve(specifier, context);
}
