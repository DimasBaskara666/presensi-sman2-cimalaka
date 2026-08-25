import Link from "next/link";
import { requireCurrentPerson } from "@/lib/auth/require-person";
import { listStudents } from "@/lib/students/student-management";
import { resetStudentPasswordAction, setStudentActiveAction } from "./actions";

export const dynamic = "force-dynamic";

type StudentPageProps = {
  searchParams: Promise<{ query?: string; class?: string; error?: string; status?: string }>;
};

const statusMessages: Record<string, string> = {
  activated: "Akses siswa berhasil diaktifkan.",
  deactivated: "Akses siswa berhasil dinonaktifkan.",
  password_reset: "Kata sandi siswa berhasil diatur ulang.",
};

const errorMessages: Record<string, string> = {
  invalid_login_id: "ID siswa tidak valid.",
  invalid_status: "Status akun tidak valid.",
  invalid_password: "Kata sandi harus memenuhi kebijakan kata sandi siswa.",
  password_mismatch: "Konfirmasi kata sandi tidak sama.",
  student_not_found: "Data siswa tidak ditemukan.",
  student_not_activated: "Kata sandi hanya dapat diatur ulang untuk akun yang sudah diaktivasi.",
  student_status_failed: "Status siswa tidak dapat diperbarui.",
  password_reset_failed: "Kata sandi siswa tidak dapat diatur ulang.",
  service_error: "Layanan pengelolaan siswa belum tersedia.",
};

export default async function StudentsPage({ searchParams }: StudentPageProps) {
  await requireCurrentPerson({ allowedRoles: ["admin"] });
  const students = await listStudents();
  const params = await searchParams;
  const query = (params.query ?? "").trim().toLowerCase();
  const classFilter = (params.class ?? "").trim();
  const classes = [...new Set(students.map((student) => student.className).filter(Boolean))].sort();
  const filtered = students.filter((student) => {
    const matchesQuery =
      !query ||
      student.loginId.toLowerCase().includes(query) ||
      student.fullName.toLowerCase().includes(query);
    return matchesQuery && (!classFilter || student.className === classFilter);
  });

  return (
    <>
      <header className="page-header">
        <div>
          <p className="eyebrow">Administrator only</p>
          <h1>Student Management</h1>
          <p className="muted">Kelola roster, aktivasi, status akses, dan pemulihan kata sandi siswa.</p>
        </div>
        <div className="page-actions">
          <Link className="button button-primary" href="/admin/students/import">Import Students</Link>
          <Link className="button button-secondary" href="/admin">Back</Link>
        </div>
      </header>

      {params.status && statusMessages[params.status] ? (
        <p className="alert alert-success" role="status">{statusMessages[params.status]}</p>
      ) : null}
      {params.error ? (
        <p className="alert alert-error" role="alert">
          {errorMessages[params.error] ?? "Permintaan pengelolaan siswa tidak dapat diproses."}
        </p>
      ) : null}

      <section className="card">
        <form className="student-filters" method="get">
          <div className="field">
            <label htmlFor="student-query">Student ID or name</label>
            <input id="student-query" name="query" defaultValue={params.query ?? ""} type="search" />
          </div>
          <div className="field">
            <label htmlFor="student-class">Class</label>
            <select id="student-class" name="class" defaultValue={classFilter}>
              <option value="">All classes</option>
              {classes.map((className) => <option key={className} value={className}>{className}</option>)}
            </select>
          </div>
          <button className="button button-secondary" type="submit">Filter</button>
        </form>

        <p className="muted">Showing {filtered.length} of {students.length} Students.</p>
        <div className="table-wrap">
          <table className="data-table">
            <thead><tr><th>Student ID</th><th>Type</th><th>Name</th><th>Class</th><th>Status</th><th>Activation</th><th>Action</th></tr></thead>
            <tbody>
              {filtered.map((student) => (
                <tr key={student.loginId}>
                  <td><strong>{student.loginId}</strong></td>
                  <td>{student.idType}</td>
                  <td>{student.fullName}</td>
                  <td>{student.className}</td>
                  <td>
                    <span className={`status-badge ${student.isActive ? "status-active" : "status-inactive"}`}>
                      {student.isActive ? "Active" : "Inactive"}
                    </span>
                  </td>
                  <td>{student.isActivated ? "Activated" : student.hasActivationCode ? "Code prepared" : "Code not prepared"}</td>
                  <td>
                    <div className="teacher-actions">
                      <Link
                        className="button button-secondary button-small"
                        href={`/admin/students/${encodeURIComponent(student.loginId)}/activation`}
                      >
                        Aktivasi
                      </Link>
                      <form action={setStudentActiveAction}>
                        <input name="login_id" type="hidden" value={student.loginId} />
                        <input name="is_active" type="hidden" value={student.isActive ? "false" : "true"} />
                        <button className="button button-secondary button-small" type="submit">
                          {student.isActive ? "Nonaktifkan" : "Aktifkan"}
                        </button>
                      </form>
                      {student.isActivated ? (
                        <details className="reset-panel">
                          <summary>Reset kata sandi</summary>
                          <form action={resetStudentPasswordAction} className="form-stack compact-form">
                            <input name="login_id" type="hidden" value={student.loginId} />
                            <div className="field">
                              <label htmlFor={`student-password-${student.loginId}`}>Kata sandi baru</label>
                              <input
                                id={`student-password-${student.loginId}`}
                                name="new_password"
                                type="password"
                                autoComplete="new-password"
                                required
                              />
                            </div>
                            <div className="field">
                              <label htmlFor={`student-confirm-${student.loginId}`}>Konfirmasi kata sandi</label>
                              <input
                                id={`student-confirm-${student.loginId}`}
                                name="confirm_password"
                                type="password"
                                autoComplete="new-password"
                                required
                              />
                            </div>
                            <button className="button button-primary button-small" type="submit">
                              Simpan kata sandi
                            </button>
                          </form>
                        </details>
                      ) : null}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {filtered.length === 0 ? <p className="muted">No Students match this view.</p> : null}
      </section>
    </>
  );
}
