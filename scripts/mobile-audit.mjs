/**
 * ביקורת מובייל סטטית על ה-JSX: מאתרת דפוסים שמייצרים גלילה אופקית,
 * יעדי מגע קטנים מדי, וטבלאות/רשתות שלא מקבלות טיפול בנייד.
 *
 * הרצה: node scripts/mobile-audit.mjs
 */
import fs from "node:fs";
import path from "node:path";

const roots = ["src"];
const findings = [];

function walk(dir) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(full);
    else if (/\.(tsx|ts)$/.test(entry.name)) inspect(full);
  }
}

const add = (file, line, rule, detail) => findings.push({ file, line, rule, detail });

function inspect(file) {
  const source = fs.readFileSync(file, "utf8");
  const lines = source.split("\n");

  lines.forEach((line, index) => {
    const lineNo = index + 1;

    // 1. רוחב מינימלי קבוע ללא מיכל גולל — דוחף את כל העמוד בנייד.
    const minWidths = line.match(/min-w-\[(\d+)px\]/g) || [];
    for (const match of minWidths) {
      const px = Number(match.match(/(\d+)/)[1]);
      // מיכל האב עשוי להיות בשורה קודמת, ולכן בודקים חלון של שורות אחורה.
      const scope = lines.slice(Math.max(0, index - 4), index + 1).join(" ");
      if (px > 380 && !scope.includes("overflow-x-auto") && !scope.includes("table-scroll")) {
        add(file, lineNo, "min-width ללא גלילה", `${match} — צריך מיכל overflow-x-auto`);
      }
    }

    // 2. רוחב קבוע גדול.
    const fixed = line.match(/(?<![-\w])w-\[(\d{3,})px\]/g) || [];
    for (const match of fixed) {
      const px = Number(match.match(/(\d+)/)[1]);
      if (px > 380 && !line.includes("max-w-full") && !line.includes("sm:w-[") && !line.includes("hidden")) {
        add(file, lineNo, "רוחב קבוע", `${match} — עלול לחרוג ממסך צר`);
      }
    }

    // 3. גריד עם עמודות קבועות בלי breakpoint.
    const gridCols = line.match(/(?<!(sm|md|lg|xl|2xl):)grid-cols-\[[^\]]+\]/g) || [];
    for (const match of gridCols) {
      if (/\d{3,}px/.test(match) && !/minmax\(0/.test(match)) {
        add(file, lineNo, "גריד קבוע ללא breakpoint", `${match}`);
      }
    }

    // 4. טבלה בלי מיכל גולל.
    if (/<table\b/.test(line) && !line.includes("overflow-x-auto") && !line.includes("table-scroll")) {
      const context = lines.slice(Math.max(0, index - 3), index + 1).join(" ");
      if (!context.includes("overflow-x-auto") && !context.includes("table-scroll")) {
        add(file, lineNo, "טבלה ללא גלילה", "<table> ללא מיכל overflow-x-auto");
      }
    }

    // 5. יעדי מגע: כפתור אייקון עם h-8/h-9 ובלי min-h.
    const smallTargets = line.match(/className="[^"]*\bh-([1-9])\b[^"]*"/g) || [];
    for (const match of smallTargets) {
      if (/<button|<a\s/.test(line) && !/min-h-1[0-9]|min-h-\[4[4-9]px\]/.test(line)) {
        const size = Number(match.match(/\bh-([1-9])\b/)[1]);
        if (size < 10) add(file, lineNo, "יעד מגע קטן", `h-${size} (=${size * 4}px) על אלמנט לחיץ — מומלץ 44px ומעלה`);
        break;
      }
    }

    // 6. טקסט זעיר.
    if (/text-\[(?:[0-9]|10)px\]/.test(line)) {
      add(file, lineNo, "טקסט זעיר", (line.match(/text-\[\d+px\]/) || [""])[0]);
    }

    // 7. מודל/פופאפ בלי גלילה פנימית.
    if (/fixed inset-0/.test(line) && /grid place-items-center|flex items-center/.test(line)) {
      const block = lines.slice(index, index + 8).join(" ");
      if (!block.includes("overflow-y-auto") && !block.includes("max-h-")) {
        add(file, lineNo, "מודל ללא גלילה", "חלון קופץ עלול לחרוג ממסך נמוך");
      }
    }
  });
}

roots.forEach(walk);

const byRule = new Map();
for (const finding of findings) {
  if (!byRule.has(finding.rule)) byRule.set(finding.rule, []);
  byRule.get(finding.rule).push(finding);
}

console.log("\n=== ביקורת מובייל ===\n");
if (!findings.length) {
  console.log("לא נמצאו ממצאים.\n");
} else {
  for (const [rule, items] of byRule) {
    console.log(`${rule} (${items.length}):`);
    for (const item of items) {
      console.log(`  ${item.file}:${item.line}  ${item.detail}`);
    }
    console.log("");
  }
}
console.log(`סה״כ ממצאים: ${findings.length}`);
process.exit(0);
