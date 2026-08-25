import Link from "next/link";
import { logoutAction } from "@/app/logout-action";
import { hasCapability } from "@/lib/auth/permissions";
import { requireCurrentPerson } from "@/lib/auth/require-person";

export const dynamic = "force-dynamic";

const roleLabels = {
  admin: "Administrator",
  teacher: "Guru",
  student: "Siswa",
} as const;

export default async function ProtectedLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  const person = await requireCurrentPerson();

  return (
    <div className="shell">
      <aside className="sidebar">
        <div className="sidebar-brand">
          <div className="brand-mark" aria-hidden="true">P</div>
          <span>Presensi Sekolah</span>
        </div>

        <nav className="nav-list" aria-label="Navigasi utama">
          <Link className="nav-link" href="/dashboard">Ringkasan</Link>
          {hasCapability(person.role, "access_admin") ? (
            <>
              <Link className="nav-link" href="/admin">Administrasi</Link>
              <Link className="nav-link" href="/admin/attendance-qr">QR presensi</Link>
            </>
          ) : null}
          {hasCapability(person.role, "access_teacher_operations") ? (
            <Link className="nav-link" href="/teacher">Operasional guru</Link>
          ) : null}
          {hasCapability(person.role, "read_own_attendance") ? (
            <>
              <Link className="nav-link" href="/student">Akun siswa</Link>
              <Link className="nav-link" href="/student/scan">Scan QR</Link>
            </>
          ) : null}
          {hasCapability(person.role, "read_all_attendance") || hasCapability(person.role, "read_own_attendance") ? (
            <Link className="nav-link" href="/attendance/history">Riwayat presensi</Link>
          ) : null}
          <Link className="nav-link" href="/change-password">Ubah kata sandi</Link>
        </nav>

        <div className="sidebar-footer">
          <p><strong>{person.fullName}</strong></p>
          <p className="muted">{person.loginId} · {roleLabels[person.role]}</p>
          <form action={logoutAction}>
            <button className="button button-quiet" type="submit">Keluar</button>
          </form>
        </div>
      </aside>
      <main className="content">{children}</main>
    </div>
  );
}
