export function cn(...values: Array<string | false | null | undefined>) {
  return values.filter(Boolean).join(" ");
}

export function initials(name: string) {
  return name.split(/\s+/).filter(Boolean).slice(0, 2).map((part) => part[0]).join("");
}

export function normalizePhone(value: string) {
  return value.replace(/[^\d+]/g, "");
}

export function whatsappUrl(value: string, message?: string) {
  const phone = value.replace(/\D/g, "");
  const query = message ? `?text=${encodeURIComponent(message)}` : "";
  return `https://wa.me/${phone}${query}`;
}

export function formatCurrency(value: number) {
  return new Intl.NumberFormat("he-IL", { style: "currency", currency: "ILS", maximumFractionDigits: 0 }).format(value);
}

export function formatCompact(value: number) {
  return new Intl.NumberFormat("he-IL", { notation: "compact", maximumFractionDigits: 1 }).format(value);
}
