import Link from "next/link";
import { requireCurrentPerson } from "@/lib/auth/require-person";
import { listTeachers } from "@/lib/auth/teacher-management";
import {
  createTeacherAction,
  resetTeacherPasswordAction,
  setTeacherActiveAction,
} from "./actions";

export const dynamic = "force-dynamic";

type TeacherManagementPageProps = {
  searchParams: Promise<{ error?: string; status?: string }>;
};

const statusMessages: Record<string, string> = {
  created: "Akun guru berhasil dibuat.",
  activated: "Akun guru berhasil diaktifkan.",
  deactivated: "Akun guru berhasil dinonaktifkan.",
  password_reset: "Kata sandi guru berhasil diatur ulang.",
};

const errorMessages: Record<string, string> = {
  invalid_login_id: "Login ID tidak valid.",
  invalid_full_name: "Nama lengkap wajib diisi.",
  invalid_password: "Kata sandi wajib diisi.",
  password_mismatch: "Konfirmasi kata sandi tidak sama.",
  login_id_in_use: "Login ID sudah digunakan.",
  auth_identity_exists: "Identitas Auth untuk Login ID tersebut sudah ada dan tidak dapat ditautkan otomatis.",
  teacher_not_found: "Akun guru tidak ditemukan.",
  invalid_status: "Status akun tidak valid.",
  auth_create_failed: "Supabase Auth menolak pembuatan akun guru.",
  password_reset_failed: "Kata sandi guru tidak dapat diatur ulang.",
  teacher_status_failed: "Status akun guru tidak dapat diperbarui.",
  service_error: "Layanan pengelolaan guru belum tersedia.",
};

const dateFormatter = new Intl.DateTimeFormat("id-ID", {
  dateStyle: "medium",
  timeZone: "Asia/Jakarta",
});

export default async function TeacherManagementPage({
  searchParams,
}: TeacherManagementPageProps) {
  await requireCurrentPerson({ allowedRoles: ["admin"] });
  const teachers = await listTeachers();
  const { error, status } = await searchParams;

  return (
    <>
      <header className="page-header">
        <div>
          <p className="eyebrow">Khusus administrator</p>
          <h1>Pengelolaan Guru</h1>
          <p className="muted">Buat akun, atur status, dan reset kata sandi guru.</p>
        </div>
        <Link className="button button-secondary" href="/admin">Kembali</Link>
      </header>

      {status && statusMessages[status] ? (
        <p className="alert alert-success" role="status">{statusMessages[status]}</p>
      ) : null}
      {error ? (
        <p className="alert alert-error" role="alert">
          {errorMessages[error] ?? "Permintaan pengelolaan guru tidak dapat diproses."}
        </p>
      ) : null}

      <div className="teacher-layout">
        <section className="card" aria-labelledby="create-teacher-title">
          <h2 id="create-teacher-title">Tambah Guru</h2>
          <p className="muted">Email internal dibuat otomatis dan tidak ditampilkan.</p>

          <form action={createTeacherAction} className="form-stack">
            <div className="field">
              <label htmlFor="teacher_login_id">Login ID</label>
              <input
                id="teacher_login_id"
                name="login_id"
                type="text"
                autoCapitalize="characters"
                autoComplete="off"
                required
              />
            </div>
            <div className="field">
              <label htmlFor="teacher_full_name">Nama lengkap</label>
              <input id="teacher_full_name" name="full_name" type="text" autoComplete="name" required />
            </div>
            <div className="field">
              <label htmlFor="teacher_password">Kata sandi awal</label>
              <input id="teacher_password" name="password" type="password" autoComplete="new-password" required />
            </div>
            <div className="field">
              <label htmlFor="teacher_confirm_password">Konfirmasi kata sandi</label>
              <input id="teacher_confirm_password" name="confirm_password" type="password" autoComplete="new-password" required />
            </div>
            <button className="button button-primary" type="submit">Buat akun guru</button>
          </form>
        </section>

        <section className="card" aria-labelledby="teacher-list-title">
          <h2 id="teacher-list-title">Daftar Guru</h2>
          <p className="muted">{teachers.length} akun guru terdaftar.</p>

          {teachers.length === 0 ? (
            <p className="empty-state">Belum ada akun guru.</p>
          ) : (
            <div className="teacher-list">
              {teachers.map((teacher) => (
                <article className="teacher-row" key={teacher.id}>
                  <div className="teacher-identity">
                    <div>
                      <strong>{teacher.loginId}</strong>
                      <p>{teacher.fullName}</p>
                    </div>
                    <span className={`status-badge ${teacher.isActive ? "status-active" : "status-inactive"}`}>
                      {teacher.isActive ? "Aktif" : "Nonaktif"}
                    </span>
                  </div>
                  <p className="teacher-created">Dibuat {dateFormatter.format(new Date(teacher.createdAt))}</p>

                  <div className="teacher-actions">
                    <form action={setTeacherActiveAction}>
                      <input name="teacher_id" type="hidden" value={teacher.id} />
                      <input name="is_active" type="hidden" value={teacher.isActive ? "false" : "true"} />
                      <button className="button button-secondary" type="submit">
                        {teacher.isActive ? "Nonaktifkan" : "Aktifkan"}
                      </button>
                    </form>

                    <details className="reset-panel">
                      <summary>Reset kata sandi</summary>
                      <form action={resetTeacherPasswordAction} className="form-stack compact-form">
                        <input name="teacher_id" type="hidden" value={teacher.id} />
                        <div className="field">
                          <label htmlFor={`reset-password-${teacher.id}`}>Kata sandi baru</label>
                          <input
                            id={`reset-password-${teacher.id}`}
                            name="new_password"
                            type="password"
                            autoComplete="new-password"
                            required
                          />
                        </div>
                        <div className="field">
                          <label htmlFor={`reset-confirm-${teacher.id}`}>Konfirmasi kata sandi</label>
                          <input
                            id={`reset-confirm-${teacher.id}`}
                            name="confirm_password"
                            type="password"
                            autoComplete="new-password"
                            required
                          />
                        </div>
                        <button className="button button-primary" type="submit">Simpan kata sandi baru</button>
                      </form>
                    </details>
                  </div>
                </article>
              ))}
            </div>
          )}
        </section>
      </div>
    </>
  );
}
