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
          <p className="eyebrow">Riwayat & Arsip Kehadiran</p>
          <h1>Laporan Kehadiran</h1>
          <p className="muted">
            Lihat catatan presensi berdasarkan tanggal yang dipilih.
          </p>
        </div>
        <div className="history-header-badges">
          <span className="role-badge">{roleLabels[person.role]}</span>
        </div>
      </header>

      {/* Filter Section Card */}
      <section className="card history-filter-card" aria-labelledby="history-filter-title">
        <div className="history-filter-header">
          <div>
            <h2 id="history-filter-title">Filter Rekapitulasi Presensi</h2>
            <p className="muted">Rentang pencarian maksimal 31 hari per permintaan.</p>
          </div>
        </div>

        <form className="history-filter-form" method="get">
          <div className="field">
            <label htmlFor="history-start">Tanggal Mulai</label>
            <input
              id="history-start"
              name="start"
              type="date"
              defaultValue={filter.startDate}
              required
            />
          </div>

          <div className="field">
            <label htmlFor="history-end">Tanggal Akhir</label>
            <input
              id="history-end"
              name="end"
              type="date"
              defaultValue={filter.endDate}
              required
            />
          </div>

          {person.role !== "student" ? (
            <div className="field">
              <label htmlFor="history-class">Rombongan Belajar</label>
              <select id="history-class" name="class" defaultValue={filter.className ?? ""}>
                <option value="">Semua Kelas</option>
                {classOptions.map((className) => (
                  <option key={className} value={className}>
                    {className}
                  </option>
                ))}
              </select>
            </div>
          ) : null}

          <div className="history-filter-actions">
            <button className="button button-primary" type="submit">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <circle cx="11" cy="11" r="8" />
                <line x1="21" y1="21" x2="16.65" y2="16.65" />
              </svg>
              <span>Tampilkan</span>
            </button>
            <Link className="button button-secondary" href="/attendance/history">
              Hari Ini
            </Link>
          </div>
        </form>
      </section>

      {!parsed.ok ? (
        <div className="alert alert-error" role="alert">
          {parsed.error}
        </div>
      ) : null}

      {view ? (
        <>
          <div className="history-results-heading">
            <div>
              <p className="eyebrow">
                {filter.className ? `Kelas ${filter.className}` : person.role === "student" ? "Data Akun Siswa" : "Semua Rombongan Belajar"}
              </p>
              <h2>
                {formatAttendanceHistoryDate(filter.startDate)}
                {filter.startDate !== filter.endDate ? ` sampai ${formatAttendanceHistoryDate(filter.endDate)}` : ""}
              </h2>
              <p className="muted">
                Menampilkan <strong className="tnum">{startRow} - {endRow}</strong> dari <strong className="tnum">{view.total}</strong> catatan kehadiran.
              </p>
            </div>
            <a
              className="button button-secondary history-pdf-button"
              href={pdfUrl}
              aria-label="Unduh laporan presensi format PDF"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                <polyline points="7 10 12 15 17 10" />
                <line x1="12" y1="15" x2="12" y2="3" />
              </svg>
              <span>Unduh Laporan PDF</span>
            </a>
          </div>

          {view.rows.length > 0 ? (
            <>
              {/* Desktop Data Table */}
              <div className="table-wrap history-table-wrap">
                <table className="data-table history-table">
                  <thead>
                    <tr>
                      <th className="th-date">Tanggal</th>
                      {person.role !== "student" ? <th className="th-student">Siswa</th> : null}
                      {person.role !== "student" ? <th className="th-class">Kelas</th> : null}
                      <th className="th-status">Status</th>
                      <th className="th-time">Jam Masuk</th>
                      <th className="th-time">Jam Pulang</th>
                      <th className="th-reason">Keterangan</th>
                      <th className="th-method">Metode</th>
                    </tr>
                  </thead>
                  <tbody>
                    {view.rows.map((row) => (
                      <tr key={row.id}>
                        <td className="td-date tnum">
                          <strong>{formatAttendanceHistoryDate(row.date)}</strong>
                        </td>
                        {person.role !== "student" ? (
                          <td className="td-student">
                            <div className="history-student-cell">
                              <div className="avatar-circle avatar-sm" aria-hidden="true">
                                {row.studentName.slice(0, 1).toUpperCase()}
                              </div>
                              <div className="history-student-meta">
                                <strong>{row.studentName}</strong>
                                <span className="history-student-id tnum">{row.studentLoginId}</span>
                              </div>
                            </div>
                          </td>
                        ) : null}
                        {person.role !== "student" ? (
                          <td className="td-class">{row.className}</td>
                        ) : null}
                        <td className="td-status">
                          <span className={`history-status history-status-${statusClass(row.status)}`}>
                            {row.status}
                          </span>
                        </td>
                        <td className="td-time tnum">
                          {formatAttendanceHistoryTime(row.checkInAt) ? (
                            <span>{formatAttendanceHistoryTime(row.checkInAt)} WIB</span>
                          ) : (
                            <span className="muted">-</span>
                          )}
                        </td>
                        <td className="td-time tnum">
                          {formatAttendanceHistoryTime(row.checkOutAt) ? (
                            <span>{formatAttendanceHistoryTime(row.checkOutAt)} WIB</span>
                          ) : (
                            <span className="muted">-</span>
                          )}
                        </td>
                        <td className="td-reason">
                          <span className={row.absenceReason === "-" ? "muted" : ""}>
                            {row.absenceReason}
                          </span>
                        </td>
                        <td className="td-method">
                          <span className="history-method-tag">{row.method}</span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Mobile Record Cards */}
              <div className="history-record-list">
                {view.rows.map((row) => (
                  <article className="history-record-card" key={row.id}>
                    <div className="history-record-heading">
                      <div>
                        <p className="history-record-date tnum">{formatAttendanceHistoryDate(row.date)}</p>
                        <h3>{row.studentName}</h3>
                        <p className="muted tnum">{row.studentLoginId} · Kelas {row.className}</p>
                      </div>
                      <span className={`history-status history-status-${statusClass(row.status)}`}>
                        {row.status}
                      </span>
                    </div>
                    <dl className="history-record-details">
                      <div>
                        <dt>Masuk</dt>
                        <dd className="tnum">{formatAttendanceHistoryTime(row.checkInAt) ? `${formatAttendanceHistoryTime(row.checkInAt)} WIB` : "-"}</dd>
                      </div>
                      <div>
                        <dt>Pulang</dt>
                        <dd className="tnum">{formatAttendanceHistoryTime(row.checkOutAt) ? `${formatAttendanceHistoryTime(row.checkOutAt)} WIB` : "-"}</dd>
                      </div>
                      <div>
                        <dt>Alasan</dt>
                        <dd>{row.absenceReason}</dd>
                      </div>
                      <div>
                        <dt>Metode</dt>
                        <dd>{row.method}</dd>
                      </div>
                    </dl>
                  </article>
                ))}
              </div>
            </>
          ) : (
            <div className="card empty-state-card">
              <p className="empty-state history-empty-state">
                Tidak ada data presensi yang tercatat untuk filter tanggal dan kelas yang dipilih.
              </p>
            </div>
          )}

          {view.totalPages > 1 ? (
            <nav className="history-pagination" aria-label="Halaman riwayat presensi">
              {view.page > 1 ? (
                <Link
                  className="button button-secondary button-small"
                  href={`/attendance/history?${filterParams(filter, view.page - 1)}`}
                  aria-label="Ke halaman sebelumnya"
                >
                  Sebelumnya
                </Link>
              ) : (
                <span />
              )}
              <span className="history-pagination-label tnum">
                Halaman {view.page} dari {view.totalPages}
              </span>
              {view.page < view.totalPages ? (
                <Link
                  className="button button-secondary button-small"
                  href={`/attendance/history?${filterParams(filter, view.page + 1)}`}
                  aria-label="Ke halaman berikutnya"
                >
                  Berikutnya
                </Link>
              ) : (
                <span />
              )}
            </nav>
          ) : null}
        </>
      ) : null}
    </div>
  );
}

