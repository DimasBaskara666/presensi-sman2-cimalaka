import { redirect } from "next/navigation";
import { requireCurrentPerson } from "@/lib/auth/require-person";

export default async function DashboardPage() {
  const person = await requireCurrentPerson();

  if (person.role === "student") {
    redirect("/student");
  }

  if (person.role === "teacher") {
    redirect("/teacher");
  }

  redirect("/admin");
}
