import Link from "next/link";
import { requireCurrentPerson } from "@/lib/auth/require-person";
import { listStudents } from "@/lib/students/student-management";
import { resetStudentPasswordAction, setStudentActiveAction } from "./actions";
import { StudentToggleButton } from "./deactivate-button";

export const dynamic = "force-dynamic";

const PAGE_SIZE = 50;

type StudentPageProps = {
  searchParams: Promise<{ query?: string; class?: string; error?: string; status?: string; page?: string }>;
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
  const currentPage = Math.max(1, parseInt(params.page ?? "1", 10));

  const classes = [...new Set(students.map((s) => s.className).filter(Boolean))].sort();
  const filtered = students.filter((student) => {
    const matchesQuery =
      !query ||
      student.loginId.toLowerCase().includes(query) ||
      student.fullName.toLowerCase().includes(query);
    return matchesQuery && (!classFilter || student.className === classFilter);
  });

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const page = Math.min(currentPage, totalPages);
  const paginated = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  function pageUrl(p: number) {
    const sp = new URLSearchParams();
    if (params.query) sp.set("query", params.query);
    if (params.class) sp.set("class", params.class);
    sp.set("page", String(p));
    return `/admin/students?${sp}`;
  }

  return (
    <>
      <header className="page-header">
        <div>
          <p className="eyebrow">Khusus administrator</p>
          <h1>Kelola Siswa</h1>
          <p className="muted">Kelola roster, aktivasi, status akses, dan pemulihan kata sandi siswa.</p>
        </div>
        <div className="page-actions">
          <Link className="button button-primary" href="/admin/students/activation-bulk">Distribusi Slip Aktivasi</Link>
          <Link className="button button-secondary" href="/admin/students/import">Impor Siswa</Link>
          <Link className="button button-secondary" href="/admin">Kembali</Link>
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
            <label htmlFor="student-query">ID atau nama siswa</label>
            <input id="student-query" name="query" defaultValue={params.query ?? ""} type="search" />
          </div>
          <div className="field">
            <label htmlFor="student-class">Kelas</label>
            <select id="student-class" name="class" defaultValue={classFilter}>
              <option value="">Semua kelas</option>
              {classes.map((className) => <option key={className} value={className}>{className}</option>)}
            </select>
          </div>
          <button className="button button-secondary" type="submit">Filter</button>
        </form>

        <p className="muted">
          Menampilkan {paginated.length} dari {filtered.length} siswa
          {filtered.length !== students.length ? ` (total ${students.length})` : ""}.
        </p>

        <div className="table-wrap">
          <table className="data-table">
            <thead>
              <tr>
                <th>ID Siswa</th>
                <th>Tipe</th>
                <th>Nama Lengkap</th>
                <th>Kelas</th>
                <th>Status</th>
                <th>Aktivasi</th>
                <th>Aksi</th>
              </tr>
            </thead>
            <tbody>
              {paginated.map((student) => (
                <tr key={student.loginId}>
                  <td><strong>{student.loginId}</strong></td>
                  <td>{student.idType}</td>
                  <td>{student.fullName}</td>
                  <td>{student.className}</td>
                  <td>
                    <span className={`status-badge ${student.isActive ? "status-active" : "status-inactive"}`}>
                      {student.isActive ? "Aktif" : "Nonaktif"}
                    </span>
                  </td>
                  <td>
                    {student.isActivated
                      ? "Sudah aktivasi"
                      : student.hasActivationCode
                        ? "Kode tersedia"
                        : "Perlu kode"}
                  </td>
                  <td>
                    <div className="teacher-actions">
                      <Link
                        className="button button-secondary button-small"
                        href={`/admin/students/${encodeURIComponent(student.loginId)}/activation`}
                      >
                        Aktivasi
                      </Link>
                      <StudentToggleButton
                        loginId={student.loginId}
                        isActive={student.isActive}
                        action={setStudentActiveAction}
                      />
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

        {paginated.length === 0 ? (
          <p className="empty-state">
            {filtered.length === 0
              ? "Tidak ada siswa yang sesuai dengan filter ini."
              : "Tidak ada data pada halaman ini."}
          </p>
        ) : null}

        {totalPages > 1 ? (
          <div className="pagination">
            <span className="pagination-info">
              Halaman {page} dari {totalPages}
            </span>
            <div className="pagination-controls">
              {page > 1 ? (
                <Link className="button button-secondary button-small" href={pageUrl(page - 1)}>
                  &larr; Sebelumnya
                </Link>
              ) : null}
              {Array.from({ length: totalPages }, (_, i) => i + 1)
                .filter((p) => p === 1 || p === totalPages || Math.abs(p - page) <= 1)
                .reduce<(number | "...")[]>((acc, p, idx, arr) => {
                  if (idx > 0 && p - (arr[idx - 1] as number) > 1) {
                    acc.push("...");
                  }
                  acc.push(p);
                  return acc;
                }, [])
                .map((item, idx) =>
                  item === "..." ? (
                    <span key={`dots-${idx}`} className="pagination-ellipsis">&hellip;</span>
                  ) : (
                    <Link
                      key={item}
                      className={`button button-small ${item === page ? "button-primary" : "button-secondary"}`}
                      href={pageUrl(item)}
                    >
                      {item}
                    </Link>
                  )
                )}
              {page < totalPages ? (
                <Link className="button button-secondary button-small" href={pageUrl(page + 1)}>
                  Berikutnya &rarr;
                </Link>
              ) : null}
            </div>
          </div>
        ) : null}
      </section>
    </>
  );
}
