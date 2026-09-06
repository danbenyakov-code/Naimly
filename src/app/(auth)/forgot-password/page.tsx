import { redirect } from "next/navigation";

// הזרימה אוחדה למסך אחד. הכתובת נשמרת כדי שקישורים ישנים ימשיכו לעבוד.
export default function ForgotPasswordPage() {
  redirect("/login?mode=forgot");
}
