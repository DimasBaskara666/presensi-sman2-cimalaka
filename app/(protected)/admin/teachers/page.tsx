import Link from "next/link";
import { requireCurrentPerson } from "@/lib/auth/require-person";
import { listTeachers } from "@/lib/auth/teacher-management";
import {
  createTeacherAction,
  resetTeacherPasswordAction,
  setTeacherActiveAction,
} from "./actions";
import { TeacherToggleButton } from "./deactivate-button";

export const dynamic = "force-dynamic";

type TeacherManagementPageProps = {
  searchParams: Promise<{ error?: string; status?: string }>;
};

const statusMessages: Record<string, string> = {
  created: "Akun guru baru berhasil dibuat.",
  activated: "Akses akun guru berhasil diaktifkan kembali.",
  deactivated: "Akses akun guru berhasil dinonaktifkan.",
  password_reset: "Kata sandi akun guru berhasil diatur ulang.",
};

const errorMessages: Record<string, string> = {
  invalid_login_id: "Login ID guru tidak valid.",
  invalid_full_name: "Nama lengkap guru wajib diisi.",
  invalid_password: "Kata sandi wajib diisi.",
  password_mismatch: "Konfirmasi kata sandi tidak sama.",
  login_id_in_use: "Login ID sudah digunakan oleh akun lain.",
  auth_identity_exists: "Identitas akun untuk Login ID tersebut sudah ada di sistem.",
  teacher_not_found: "Akun guru tidak ditemukan.",
  invalid_status: "Status akun tidak valid.",
  auth_create_failed: "Sistem autentikasi menolak pembuatan akun guru.",
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
    <div className="admin-teachers-page">
      <header className="page-header">
        <div>
          <p className="eyebrow">Direktori Pengajar</p>
          <h1>Pengelolaan Akun Guru</h1>
          <p className="muted">
            Buat akun guru baru, kelola status keaktifan mengajar, dan reset kata sandi akun guru.
          </p>
        </div>
        <Link className="button button-secondary" href="/admin">
          Kembali ke Ringkasan
        </Link>
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
        {/* Create Teacher Form Card */}
        <section className="card" aria-labelledby="create-teacher-title">
          <div className="section-heading">
            <h2 id="create-teacher-title">Tambah Guru Baru</h2>
            <p className="muted">Lengkapi data untuk mendaftarkan akun pengajar ke sistem presensi.</p>
          </div>

          <form action={createTeacherAction} className="form-stack">
            <div className="field">
              <label htmlFor="teacher_login_id">ID Masuk Guru (NIP / ID)</label>
              <input
                id="teacher_login_id"
                name="login_id"
                type="text"
                autoCapitalize="characters"
                autoComplete="off"
                placeholder="Contoh: G001 atau NIP"
                required
              />
            </div>
            <div className="field">
              <label htmlFor="teacher_full_name">Nama Lengkap &amp; Gelar</label>
              <input
                id="teacher_full_name"
                name="full_name"
                type="text"
                autoComplete="name"
                placeholder="Nama lengkap guru..."
                required
              />
            </div>
            <div className="field">
              <label htmlFor="teacher_password">Kata Sandi Awal</label>
              <input
                id="teacher_password"
                name="password"
                type="password"
                autoComplete="new-password"
                required
              />
            </div>
            <div className="field">
              <label htmlFor="teacher_confirm_password">Konfirmasi Kata Sandi</label>
              <input
                id="teacher_confirm_password"
                name="confirm_password"
                type="password"
                autoComplete="new-password"
                required
              />
            </div>
            <button className="button button-primary" type="submit">
              Buat Akun Guru
            </button>
          </form>
        </section>

        {/* Teacher Directory List Card */}
        <section className="card" aria-labelledby="teacher-list-title">
          <div className="section-heading">
            <h2 id="teacher-list-title">Daftar Akun Guru Terdaftar</h2>
            <p className="muted">
              <strong className="tnum">{teachers.length}</strong> akun guru terdaftar dalam sistem presensi sekolah.
            </p>
          </div>

          {teachers.length === 0 ? (
            <p className="empty-state">Belum ada akun guru yang terdaftar.</p>
          ) : (
            <div className="teacher-list">
              {teachers.map((teacher) => (
                <article className="teacher-row" key={teacher.id}>
                  <div className="history-student-cell">
                    <div className="avatar-circle avatar-sm" aria-hidden="true">
                      {teacher.fullName.slice(0, 1).toUpperCase()}
                    </div>
                    <div className="history-student-meta">
                      <strong>{teacher.fullName}</strong>
                      <span className="history-student-id tnum">ID: {teacher.loginId}</span>
                    </div>
                  </div>

                  <div className="teacher-row-meta">
                    <span className={`status-badge ${teacher.isActive ? "status-active" : "status-inactive"}`}>
                      {teacher.isActive ? "Aktif" : "Nonaktif"}
                    </span>
                    <span className="teacher-created tnum muted">
                      Didaftarkan {dateFormatter.format(new Date(teacher.createdAt))}
                    </span>
                  </div>

                  <div className="teacher-actions">
                    <TeacherToggleButton
                      teacherId={teacher.id}
                      teacherName={teacher.fullName}
                      isActive={teacher.isActive}
                      action={setTeacherActiveAction}
                    />

                    <details className="reset-panel">
                      <summary>Reset sandi</summary>
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
                        <button className="button button-primary button-small" type="submit">
                          Simpan sandi
                        </button>
                      </form>
                    </details>
                  </div>
                </article>
              ))}
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
