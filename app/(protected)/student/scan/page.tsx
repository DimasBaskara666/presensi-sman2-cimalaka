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
      <header className="page-header attendance-page-header">
        <div>
          <p className="eyebrow">Presensi siswa</p>
          <h1>Scan QR Presensi</h1>
          <p className="muted">Identitas siswa diambil dari sesi masuk Anda, bukan dari QR.</p>
        </div>
        <span className="role-badge">Siswa</span>
      </header>
      <StudentQrScanner initialToken={initialToken} />
    </div>
  );
}
