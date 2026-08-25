import Link from "next/link";
import { requireCurrentPerson } from "@/lib/auth/require-person";
import { timeInputValue } from "@/lib/attendance/admin-operations-model";
import { loadAdminAttendanceSettings } from "@/lib/attendance/admin-operations";
import { updateAttendanceSettingsAction } from "./actions";

export const dynamic = "force-dynamic";

type AttendanceSettingsPageProps = {
  searchParams: Promise<{
    status?: string | string[];
    error?: string | string[];
  }>;
};

function single(value: string | string[] | undefined): string | undefined {
  return typeof value === "string" ? value : undefined;
}

const errorMessages: Record<string, string> = {
  invalid_settings: "Periksa kembali format dan urutan waktu yang dimasukkan.",
  load_failed: "Pengaturan saat ini tidak dapat dibaca. Coba lagi.",
  update_rejected: "Perubahan ditolak oleh aturan pengaturan presensi.",
};

export default async function AttendanceSettingsPage({ searchParams }: AttendanceSettingsPageProps) {
  await requireCurrentPerson({ allowedRoles: ["admin"] });
  const settings = await loadAdminAttendanceSettings();
  const params = await searchParams;
  const error = single(params.error);
  const status = single(params.status);

  return (
    <div className="history-page">
      <header className="page-header">
        <div>
          <p className="eyebrow">Administrator only</p>
          <h1>Pengaturan Presensi</h1>
          <p className="muted">Atur jadwal yang dipakai PostgreSQL untuk validasi presensi.</p>
        </div>
        <Link className="button button-secondary" href="/admin">Kembali</Link>
      </header>

      {status === "updated" ? (
        <p className="alert alert-success" role="status">Pengaturan presensi berhasil disimpan.</p>
      ) : null}
      {error ? (
        <p className="alert alert-error" role="alert">{errorMessages[error] ?? "Pengaturan tidak dapat disimpan."}</p>
      ) : null}

      <section className="card narrow" aria-labelledby="attendance-settings-title">
        <h2 id="attendance-settings-title">Jadwal aktif</h2>
        <p className="muted">
          Zona waktu: <strong>{settings.timezone}</strong>. Batas tepat waktu saat ini {timeInputValue(settings.onTimeCutoff)}.
        </p>
        <form className="form-stack" action={updateAttendanceSettingsAction}>
          <div className="field">
            <label htmlFor="official-start-time">Jam masuk</label>
            <input id="official-start-time" name="official_start_time" type="time" step="60" defaultValue={timeInputValue(settings.officialStartTime)} required />
          </div>
          <div className="field">
            <label htmlFor="late-tolerance">Toleransi terlambat (menit)</label>
            <input id="late-tolerance" name="late_tolerance_minutes" type="number" min="0" max="1440" step="1" defaultValue={settings.lateToleranceMinutes} required />
            <span className="form-hint">Batas tepat waktu dihitung dari jam masuk ditambah toleransi.</span>
          </div>
          <div className="field">
            <label htmlFor="weekday-checkout">Minimum pulang Senin-Kamis</label>
            <input id="weekday-checkout" name="monday_thursday_checkout_minimum" type="time" step="60" defaultValue={timeInputValue(settings.mondayThursdayCheckoutMinimum)} required />
          </div>
          <div className="field">
            <label htmlFor="friday-checkout">Minimum pulang Jumat</label>
            <input id="friday-checkout" name="friday_checkout_minimum" type="time" step="60" defaultValue={timeInputValue(settings.fridayCheckoutMinimum)} required />
          </div>
          <button className="button button-primary" type="submit">Simpan pengaturan</button>
        </form>
      </section>
    </div>
  );
}
