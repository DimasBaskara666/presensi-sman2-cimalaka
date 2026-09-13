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
  load_failed: "Pengaturan saat ini tidak dapat dibaca. Silakan muat ulang halaman.",
  update_rejected: "Perubahan ditolak oleh aturan validasi pengaturan presensi.",
};

export default async function AttendanceSettingsPage({ searchParams }: AttendanceSettingsPageProps) {
  await requireCurrentPerson({ allowedRoles: ["admin"] });
  const settings = await loadAdminAttendanceSettings();
  const params = await searchParams;
  const error = single(params.error);
  const status = single(params.status);

  return (
    <div className="admin-settings-page">
      <header className="page-header">
        <div>
          <p className="eyebrow">Konfigurasi Jadwal Sekolah</p>
          <h1>Pengaturan Jam Presensi</h1>
          <p className="muted">
            Atur jadwal kedatangan resmi, batas toleransi keterlambatan, dan jam kepulangan siswa.
          </p>
        </div>
        <Link className="button button-secondary" href="/admin">
          Kembali ke Ringkasan
        </Link>
      </header>

      {status === "updated" ? (
        <p className="alert alert-success" role="status">
          Pengaturan jam presensi berhasil diperbarui dan diterapkan ke sistem.
        </p>
      ) : null}
      {error ? (
        <p className="alert alert-error" role="alert">
          {errorMessages[error] ?? "Pengaturan tidak dapat disimpan. Periksa kembali nilai yang diisi."}
        </p>
      ) : null}

      {/* Visual Timeline Bar (DESIGN.md Section 12.7) */}
      <section className="card" aria-labelledby="timeline-heading">
        <div className="section-heading">
          <h2 id="timeline-heading">Garis Waktu Kebijakan Presensi Harian</h2>
          <p className="muted">
            Zona waktu operasional: <strong>{settings.timezone}</strong>. Batas tepat waktu saat ini adalah pukul{" "}
            <strong className="tnum">{timeInputValue(settings.onTimeCutoff)} WIB</strong>.
          </p>
        </div>

        <div className="attendance-timeline">
          <div className="timeline-segment timeline-seg-prep">
            <span className="timeline-badge">06:00 - {timeInputValue(settings.officialStartTime)}</span>
            <strong>Persiapan Gerbang</strong>
            <span className="timeline-desc">Gerbang sekolah dibuka untuk kedatangan siswa</span>
          </div>

          <div className="timeline-segment timeline-seg-ontime">
            <span className="timeline-badge">Mulai {timeInputValue(settings.officialStartTime)} WIB</span>
            <strong>Hadir Tepat Waktu</strong>
            <span className="timeline-desc">Presensi masuk dicatat sebagai Hadir Tepat Waktu</span>
          </div>

          <div className="timeline-segment timeline-seg-late">
            <span className="timeline-badge">Toleransi +{settings.lateToleranceMinutes} Menit</span>
            <strong>Tercatat Terlambat</strong>
            <span className="timeline-desc">
              Hingga {timeInputValue(settings.onTimeCutoff)} WIB dicatat Terlambat
            </span>
          </div>

          <div className="timeline-segment timeline-seg-checkout">
            <span className="timeline-badge">Senin-Kamis: {timeInputValue(settings.mondayThursdayCheckoutMinimum)} WIB</span>
            <strong>Presensi Pulang</strong>
            <span className="timeline-desc">Khusus hari Jumat mulai {timeInputValue(settings.fridayCheckoutMinimum)} WIB</span>
          </div>
        </div>
      </section>

      {/* Operational Settings Form */}
      <section className="card narrow" aria-labelledby="attendance-settings-title">
        <div className="section-heading">
          <h2 id="attendance-settings-title">Formulir Pengaturan Waktu</h2>
          <p className="muted">Ubah parameter jam resmi kehadiran dan kepulangan di bawah ini.</p>
        </div>

        <form className="form-stack" action={updateAttendanceSettingsAction}>
          <div className="field">
            <label htmlFor="official-start-time">Jam Masuk Resmi Sekolah</label>
            <input
              id="official-start-time"
              name="official_start_time"
              type="time"
              step="60"
              defaultValue={timeInputValue(settings.officialStartTime)}
              required
            />
            <span className="form-hint">Format 24 jam (contoh: 06:30 untuk jam setengah tujuh pagi).</span>
          </div>

          <div className="field">
            <label htmlFor="late-tolerance">Batas Toleransi Keterlambatan (Menit)</label>
            <input
              id="late-tolerance"
              name="late_tolerance_minutes"
              type="number"
              min="0"
              max="1440"
              step="1"
              defaultValue={settings.lateToleranceMinutes}
              required
            />
            <span className="form-hint">
              Siswa yang memindai setelah jam masuk sampai batas toleransi akan ditandai Terlambat.
            </span>
          </div>

          <div className="field">
            <label htmlFor="weekday-checkout">Jam Minimum Presensi Pulang (Senin - Kamis)</label>
            <input
              id="weekday-checkout"
              name="monday_thursday_checkout_minimum"
              type="time"
              step="60"
              defaultValue={timeInputValue(settings.mondayThursdayCheckoutMinimum)}
              required
            />
            <span className="form-hint">Siswa baru dapat mencatat presensi kepulangan setelah jam ini.</span>
          </div>

          <div className="field">
            <label htmlFor="friday-checkout">Jam Minimum Presensi Pulang (Khusus Hari Jumat)</label>
            <input
              id="friday-checkout"
              name="friday_checkout_minimum"
              type="time"
              step="60"
              defaultValue={timeInputValue(settings.fridayCheckoutMinimum)}
              required
            />
            <span className="form-hint">Disesuaikan dengan jadwal kegiatan ibadah sholat Jumat.</span>
          </div>

          <button className="button button-primary" type="submit">
            Simpan Pengaturan Jadwal
          </button>
        </form>
      </section>
    </div>
  );
}
