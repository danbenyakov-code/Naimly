import { redirect } from "next/navigation";

/** המסך עבר ל-/admin/payments (הרחבת תהליך הרכישה). נשאר כהפניה בלבד לתאימות לאחור. */
export default function ApprovalsRedirectPage() {
  redirect("/admin/payments");
}
