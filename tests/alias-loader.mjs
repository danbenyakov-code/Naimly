import { register } from "node:module";

// רושם את פותר ה-alias לפני טעינת קבצי הבדיקה.
// import.meta.url הוא כבר URL — אין להמיר אותו שוב.
register("./alias-resolver.mjs", import.meta.url);
