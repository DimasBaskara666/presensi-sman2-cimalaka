import Link from "next/link";
import { requireCurrentPerson } from "@/lib/auth/require-person";
import { loadSharedAttendanceQrSession } from "@/lib/attendance/shared-qr-session";
import { SharedQrManager } from "./qr-manager";

export const dynamic = "force-dynamic";

export default async function AdminAttendanceQrPage() {
  await requireCurrentPerson({ allowedRoles: ["admin"] });
  const initialState = await loadSharedAttendanceQrSession();

  return (
    <div className="admin-qr-page">
      <header className="page-header">
        <div>
          <p className="eyebrow">Sesi Presensi Sekolah Bersama</p>
          <h1>QR Presensi Siswa</h1>
          <p className="muted">Kelola sesi kode QR sekolah bersama untuk ditampilkan pada layar monitor atau proyektor.</p>
        </div>
        <Link className="button button-secondary print-hidden" href="/admin">Kembali ke Ringkasan</Link>
      </header>
      <SharedQrManager initialState={initialState} />
    </div>
  );
}
