import { redirect } from "next/navigation";
import { getCurrentPerson } from "@/lib/auth/current-person";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  const person = await getCurrentPerson();
  redirect(person ? "/dashboard" : "/login");
}
