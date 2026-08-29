import Link from "next/link";
import { requireCurrentPerson } from "@/lib/auth/require-person";
import { loadSharedAttendanceQrSession } from "@/lib/attendance/shared-qr-session";
import { SharedQrManager } from "@/app/(protected)/admin/attendance-qr/qr-manager";

export const dynamic = "force-dynamic";

export default async function TeacherAttendanceQrPage() {
  await requireCurrentPerson({ allowedRoles: ["teacher"] });
  const initialState = await loadSharedAttendanceQrSession();

  return (
    <div className="admin-qr-page">
      <header className="page-header">
        <div>
          <p className="eyebrow">Guru · sesi sekolah bersama</p>
          <h1>QR Presensi Siswa</h1>
          <p className="muted">Mulai, tampilkan, atau hentikan sesi QR sekolah yang sama dengan tampilan Admin dan Guru lain.</p>
        </div>
        <Link className="button button-secondary print-hidden" href="/teacher">Kembali</Link>
      </header>
      <SharedQrManager initialState={initialState} />
    </div>
  );
}
