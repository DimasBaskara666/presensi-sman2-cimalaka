import Link from "next/link";
import { requireCurrentPerson } from "@/lib/auth/require-person";
import { StudentQrScanner } from "./qr-scanner";

export const dynamic = "force-dynamic";

type StudentScanPageProps = {
  searchParams: Promise<{ token?: string | string[] }>;
};

export default async function StudentScanPage({ searchParams }: StudentScanPageProps) {
  await requireCurrentPerson({ allowedRoles: ["student"] });
  const params = await searchParams;
  const candidate = typeof params.token === "string" ? params.token : null;
  const initialToken = candidate ? candidate.slice(0, 200) : null;

  return (
    <div className="student-scan-page">
      <header className="page-header student-scan-header">
        <div className="student-scan-header-main">
          <Link href="/student" className="button button-quiet button-small student-back-button" aria-label="Kembali ke Beranda Siswa">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <line x1="19" y1="12" x2="5" y2="12" />
              <polyline points="12 19 5 12 12 5" />
            </svg>
            <span>Kembali</span>
          </Link>
          <div>
            <p className="eyebrow">Kamera Presensi Siswa</p>
            <h1>Pindai QR Presensi</h1>
            <p className="muted">Arahkan kamera ke layar proyektor kelas atau monitor guru.</p>
          </div>
        </div>
        <span className="status-badge status-active">Sesi Siswa Aktif</span>
      </header>
      <StudentQrScanner initialToken={initialToken} />
    </div>
  );
}
