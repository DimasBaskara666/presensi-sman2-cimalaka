import Link from "next/link";
import { requireCurrentPerson } from "@/lib/auth/require-person";
import StudentImportWorkflow from "./import-workflow";

export const dynamic = "force-dynamic";

export default async function StudentImportPage() {
  await requireCurrentPerson({ allowedRoles: ["admin"] });
  return (
    <>
      <header className="page-header">
        <div>
          <p className="eyebrow">Khusus administrator</p>
          <h1>Impor Siswa</h1>
          <p className="muted">Validasi dan pratinjau roster sekolah sebelum menyimpan data siswa.</p>
        </div>
        <Link className="button button-secondary" href="/admin/students">Kembali ke Kelola Siswa</Link>
      </header>
      <StudentImportWorkflow />
    </>
  );
}

