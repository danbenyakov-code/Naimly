import type { MetadataRoute } from "next";
import { brand } from "@/lib/config";

export default function manifest(): MetadataRoute.Manifest {
  return { name: `${brand.name} — ${brand.hebrewName}`, short_name: brand.name, description: "מערכת ישראלית שהופכת היכרות לליד באמצעות כרטיס דיגיטלי חכם.", start_url: "/", display: "standalone", background_color: "#f7f8fc", theme_color: "#0b1020", lang: "he", dir: "rtl", icons: [{ src: "/icon.svg", sizes: "any", type: "image/svg+xml" }] };
}
