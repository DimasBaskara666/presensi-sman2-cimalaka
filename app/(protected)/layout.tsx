/**
 * Presensi SMAN 2 Cimalaka
 * © 2026 Dimas Bratakusumah
 * Institut Teknologi Nasional Bandung
 */

import { requireCurrentPerson } from "@/lib/auth/require-person";
import { ResponsiveShell } from "./responsive-shell";

export const dynamic = "force-dynamic";

export default async function ProtectedLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  const person = await requireCurrentPerson();

  return (
    <ResponsiveShell person={person}>
      {children}
    </ResponsiveShell>
  );
}
