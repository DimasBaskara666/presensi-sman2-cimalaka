import Link from "next/link";
import { requireCurrentPerson } from "@/lib/auth/require-person";
import { getSchoolDate } from "@/lib/attendance/teacher-attendance-model";
import {
  formatAttendanceHistoryDate,
  formatAttendanceHistoryTime,
  normalizeAttendanceHistoryFilterForRole,
  parseAttendanceHistoryFilter,
  parseAttendanceHistoryPage,
  type AttendanceHistoryFilter,
} from "@/lib/attendance/history-model";
import {
  loadAttendanceHistoryClasses,
  loadAttendanceHistoryPage,
  type AttendanceHistoryPage as AttendanceHistoryView,
} from "@/lib/attendance/history-query";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

type AttendanceHistoryPageProps = {
  searchParams: Promise<{
    start?: string | string[];
    end?: string | string[];
    class?: string | string[];
    page?: string | string[];
  }>;
};

const roleLabels = {
  admin: "Administrator",
  teacher: "Guru",
  student: "Siswa",
} as const;

function single(value: string | string[] | undefined): string | undefined {
  return typeof value === "string" ? value : undefined;
}

function filterParams(filter: AttendanceHistoryFilter, page?: number): string {
  const params = new URLSearchParams({ start: filter.startDate, end: filter.endDate });
  if (filter.className) params.set("class", filter.className);
  if (page && page > 1) params.set("page", String(page));
  return params.toString();
}

function statusClass(status: string): string {
  if (status === "Tepat Waktu") return "on-time";
  if (status === "Terlambat") return "late";
  if (status === "Sakit") return "sick";
  if (status === "Izin") return "permission";
  if (status === "Alfa") return "absent";
  if (status === "Dispensasi") return "dispensation";
  return "unknown";
}

export default async function AttendanceHistoryPage({ searchParams }: AttendanceHistoryPageProps) {
  const person = await requireCurrentPerson({ allowedRoles: ["admin", "teacher", "student"] });
  const params = await searchParams;
  const schoolToday = getSchoolDate();
  const parsed = parseAttendanceHistoryFilter({
    start: single(params.start),
    end: single(params.end),
    className: single(params.class),
  }, schoolToday);
  const page = parseAttendanceHistoryPage(single(params.page));
  const filter = normalizeAttendanceHistoryFilterForRole(parsed.filter, person.role);
  const supabase = await createClient();
  const classes = await loadAttendanceHistoryClasses(supabase, person);
  let view: AttendanceHistoryView | null = null;
  if (parsed.ok) view = await loadAttendanceHistoryPage(supabase, person, filter, page);

  const classOptions = filter.className && !classes.includes(filter.className)
    ? [filter.className, ...classes]
    : classes;
  const startRow = view && view.total > 0 ? (view.page - 1) * view.pageSize + 1 : 0;
  const endRow = view ? Math.min(view.page * view.pageSize, view.total) : 0;
  const pdfUrl = `/attendance/history/pdf?${filterParams(filter)}`;

  return (
    <div className="history-page">
      <header className="page-header history-page-header">
        <div>
          <p className="eyebrow">Riwayat presensi</p>
          <h1>Laporan Kehadiran</h1>
          <p className="muted">Data identitas berasal dari snapshot saat presensi dicatat.</p>
        </div>
        <span className="role-badge">{roleLabels[person.role]}</span>
      </header>

      <section className="card history-filter-card" aria-labelledby="history-filter-title">
        <div>
          <h2 id="history-filter-title">Filter laporan</h2>
          <p className="muted">Maksimal 31 hari per permintaan.</p>
        </div>
        <form className="history-filter-form" method="get">
          <div className="field">
            <label htmlFor="history-start">Tanggal mulai</label>
            <input id="history-start" name="start" type="date" defaultValue={filter.startDate} required />
          </div>
          <div className="field">
            <label htmlFor="history-end">Tanggal akhir</label>
            <input id="history-end" name="end" type="date" defaultValue={filter.endDate} required />
          </div>
          {person.role !== "student" ? (
            <div className="field">
              <label htmlFor="history-class">Kelas</label>
              <select id="history-class" name="class" defaultValue={filter.className ?? ""}>
                <option value="">Semua kelas</option>
                {classOptions.map((className) => <option key={className} value={className}>{className}</option>)}
              </select>
            </div>
          ) : null}
          <div className="history-filter-actions">
            <button className="button button-primary" type="submit">Tampilkan</button>
            <Link className="button button-quiet" href="/attendance/history">Hari ini</Link>
          </div>
        </form>
      </section>

      {!parsed.ok ? <p className="alert alert-error" role="alert">{parsed.error}</p> : null}

      {view ? (
        <>
          <div className="history-results-heading">
            <div>
              <p className="eyebrow">{filter.className ? `Kelas ${filter.className}` : person.role === "student" ? "Data Anda" : "Semua kelas"}</p>
              <h2>{formatAttendanceHistoryDate(filter.startDate)}{filter.startDate !== filter.endDate ? ` - ${formatAttendanceHistoryDate(filter.endDate)}` : ""}</h2>
              <p className="muted">Menampilkan {startRow}-{endRow} dari {view.total} catatan.</p>
            </div>
            <a className="button button-secondary history-pdf-button" href={pdfUrl}>Unduh PDF</a>
          </div>

          {view.rows.length > 0 ? (
            <div className="history-record-list">
              {view.rows.map((row) => (
                <article className="history-record-card" key={row.id}>
                  <div className="history-record-heading">
                    <div>
                      <p className="history-record-date">{formatAttendanceHistoryDate(row.date)}</p>
                      <h3>{row.studentName}</h3>
                      <p className="muted">{row.studentLoginId} · Kelas {row.className}</p>
                    </div>
                    <span className={`history-status history-status-${statusClass(row.status)}`}>{row.status}</span>
                  </div>
                  <dl className="history-record-details">
                    <div><dt>Masuk</dt><dd>{formatAttendanceHistoryTime(row.checkInAt)}</dd></div>
                    <div><dt>Pulang</dt><dd>{formatAttendanceHistoryTime(row.checkOutAt)}</dd></div>
                    <div><dt>Alasan</dt><dd>{row.absenceReason}</dd></div>
                    <div><dt>Metode</dt><dd>{row.method}</dd></div>
                  </dl>
                </article>
              ))}
            </div>
          ) : (
            <p className="empty-state history-empty-state">Tidak ada data presensi untuk filter yang dipilih.</p>
          )}

          {view.totalPages > 1 ? (
            <nav className="history-pagination" aria-label="Halaman riwayat presensi">
              {view.page > 1 ? (
                <Link className="button button-secondary" href={`/attendance/history?${filterParams(filter, view.page - 1)}`}>Sebelumnya</Link>
              ) : <span />}
              <span>Halaman {view.page} dari {view.totalPages}</span>
              {view.page < view.totalPages ? (
                <Link className="button button-secondary" href={`/attendance/history?${filterParams(filter, view.page + 1)}`}>Berikutnya</Link>
              ) : <span />}
            </nav>
          ) : null}
        </>
      ) : null}
    </div>
  );
}

