import { redirect } from "next/navigation";

// שחזור הסיסמה מתבצע במסך המאוחד: קוד אימות ואחריו סיסמה חדשה.
// הכתובת נשמרת כדי שקישורים ישנים ומיילים קיימים ימשיכו לעבוד.
export default function ResetPasswordPage() {
  redirect("/login?mode=forgot");
}
