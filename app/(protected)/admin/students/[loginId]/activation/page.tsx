import Link from "next/link";
import { notFound } from "next/navigation";
import { normalizeLoginId } from "@/lib/auth/login-id";
import { requireCurrentPerson } from "@/lib/auth/require-person";
import { getStudentActivationSummary } from "@/lib/students/student-management";
import { ActivationCodeControl } from "./activation-code-control";

export const dynamic = "force-dynamic";

export default async function StudentActivationAdminPage({
  params,
}: {
  params: Promise<{ loginId: string }>;
}) {
  await requireCurrentPerson({ allowedRoles: ["admin"] });
  let loginId: string;
  try {
    loginId = normalizeLoginId(decodeURIComponent((await params).loginId));
  } catch {
    notFound();
  }
  const student = await getStudentActivationSummary(loginId);
  if (!student) notFound();

  return (
    <>
      <header className="page-header">
        <div>
          <p className="eyebrow">Distribusi administrator</p>
          <h1>Aktivasi siswa</h1>
          <p className="muted">Kode plaintext hanya ditampilkan pada halaman terpisah ini.</p>
        </div>
        <Link className="button button-secondary" href="/admin/students">Kembali</Link>
      </header>

      <section className="card narrow">
        <ul className="status-list">
          <li><span>ID siswa</span><strong>{student.loginId}</strong></li>
          <li><span>Nama</span><strong>{student.fullName}</strong></li>
          <li><span>Kelas</span><strong>{student.className}</strong></li>
          <li><span>Status</span><strong>{student.isActive ? "Aktif" : "Nonaktif"}</strong></li>
          <li><span>Akun</span><strong>{student.isActivated ? "Sudah diaktivasi" : "Belum diaktivasi"}</strong></li>
        </ul>

        {student.isActivated ? (
          <p className="alert alert-success" role="status">Akun sudah diaktivasi. Kode baru tidak dapat dibuat.</p>
        ) : !student.isActive ? (
          <p className="alert alert-error" role="alert">Siswa nonaktif tidak dapat menerima kode aktivasi.</p>
        ) : (
          <ActivationCodeControl
            loginId={student.loginId}
            hasActivationCode={student.hasActivationCode}
          />
        )}
      </section>
    </>
  );
}
