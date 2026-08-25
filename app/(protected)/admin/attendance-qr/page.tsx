import Link from "next/link";
import { requireCurrentPerson } from "@/lib/auth/require-person";
import { createClient } from "@/lib/supabase/server";
import { AdminQrManager } from "./qr-manager";

export const dynamic = "force-dynamic";

export default async function AdminAttendanceQrPage() {
  await requireCurrentPerson({ allowedRoles: ["admin"] });
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("qr_tokens")
    .select("created_at, expires_at, is_active")
    .eq("token_type", "attendance")
    .eq("is_active", true)
    .maybeSingle();
  if (error) throw new Error("Active QR metadata could not be loaded.");

  const active = data ? {
    createdAt: data.created_at,
    expiresAt: data.expires_at,
  } : null;

  return (
    <div className="admin-qr-page">
      <header className="page-header">
        <div>
          <p className="eyebrow">Administrator only</p>
          <h1>QR Presensi Siswa</h1>
          <p className="muted">Satu QR singkat untuk check-in atau check-out; aturan waktu tetap ditentukan PostgreSQL.</p>
        </div>
        <Link className="button button-secondary print-hidden" href="/admin">Kembali</Link>
      </header>
      <AdminQrManager initialActive={active} />
    </div>
  );
}
