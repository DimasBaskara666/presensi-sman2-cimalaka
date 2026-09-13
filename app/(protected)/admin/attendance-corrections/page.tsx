import Link from "next/link";
import { requireCurrentPerson } from "@/lib/auth/require-person";
import {
  isAttendanceRecordId,
  parseAttendanceCorrectionSearch,
} from "@/lib/attendance/admin-operations-model";
import {
  loadAttendanceCorrectionRecord,
  loadAttendanceCorrectionSearch,
} from "@/lib/attendance/admin-operations";
import { getSchoolDate } from "@/lib/attendance/teacher-attendance-model";
import {
  formatAttendanceHistoryDate,
  formatAttendanceHistoryTime,
} from "@/lib/attendance/history-model";
import { correctAttendanceAction } from "./actions";

export const dynamic = "force-dynamic";

type AttendanceCorrectionsPageProps = {
  searchParams: Promise<{
    date?: string | string[];
    class?: string | string[];
    student?: string | string[];
    record?: string | string[];
    status?: string | string[];
    error?: string | string[];
  }>;
};

function single(value: string | string[] | undefined): string | undefined {
  return typeof value === "string" ? value : undefined;
}

function recordUrl(input: {
  date: string;
  className: string;
  studentQuery: string;
  recordId: string;
}): string {
  const params = new URLSearchParams({ date: input.date, record: input.recordId });
  if (input.className) params.set("class", input.className);
  if (input.studentQuery) params.set("student", input.studentQuery);
  return `/admin/attendance-corrections?${params.toString()}`;
}

const errorMessages: Record<string, string> = {
  invalid_record: "Catatan presensi yang dipilih tidak valid.",
  record_not_found: "Catatan presensi tidak ditemukan atau tidak dapat diakses.",
  invalid_correction: "Isi koreksi belum lengkap atau format waktunya tidak valid.",
  correction_rejected: "Koreksi ditolak oleh aturan validasi presensi sekolah.",
};

const absenceLabels: Record<string, string> = {
  sick: "Sakit",
  permission: "Izin",
  absent: "Alfa",
  dispensation: "Dispensasi",
};

export default async function AttendanceCorrectionsPage({ searchParams }: AttendanceCorrectionsPageProps) {
  await requireCurrentPerson({ allowedRoles: ["admin"] });
  const params = await searchParams;
  const parsed = parseAttendanceCorrectionSearch({
    date: single(params.date),
    className: single(params.class),
    studentQuery: single(params.student),
  }, getSchoolDate());
  const filter = parsed.filter;
  const view = parsed.ok ? await loadAttendanceCorrectionSearch(filter) : null;
  const recordId = single(params.record);
  const selected = isAttendanceRecordId(recordId)
    ? await loadAttendanceCorrectionRecord(recordId.trim())
    : null;
  const error = single(params.error);

  return (
    <div className="admin-corrections-page">
      <header className="page-header">
        <div>
          <p className="eyebrow">Operasional Koreksi Manual</p>
          <h1>Koreksi Presensi Siswa</h1>
          <p className="muted">
            Cari catatan presensi, periksa riwayat kehadiran, dan lakukan penyesuaian dengan catatan audit resmi.
          </p>
        </div>
        <Link className="button button-secondary" href="/admin">
          Kembali ke Ringkasan
        </Link>
      </header>

      {single(params.status) === "corrected" ? (
        <p className="alert alert-success" role="status">
          Koreksi presensi berhasil disimpan dan riwayat audit telah diperbarui.
        </p>
      ) : null}
      {!parsed.ok ? <p className="alert alert-error" role="alert">{parsed.error}</p> : null}
      {recordId && !isAttendanceRecordId(recordId) ? (
        <p className="alert alert-error" role="alert">{errorMessages.invalid_record}</p>
      ) : null}
      {recordId && isAttendanceRecordId(recordId) && !selected ? (
        <p className="alert alert-error" role="alert">{errorMessages.record_not_found}</p>
      ) : null}
      {error ? (
        <p className="alert alert-error" role="alert">{errorMessages[error] ?? "Koreksi tidak dapat disimpan."}</p>
      ) : null}

      {/* Filter Section Card */}
      <section className="card history-filter-card" aria-labelledby="correction-search-title">
        <div>
          <h2 id="correction-search-title">Cari Catatan Presensi</h2>
          <p className="muted">Pilih tanggal, lalu persempit berdasarkan kelas atau ID/nama siswa.</p>
        </div>
        <form className="history-filter-form" method="get">
          <div className="field">
            <label htmlFor="correction-date">Tanggal Presensi</label>
            <input id="correction-date" name="date" type="date" defaultValue={filter.date} required />
          </div>
          <div className="field">
            <label htmlFor="correction-class">Rombongan Belajar (Kelas)</label>
            <select id="correction-class" name="class" defaultValue={filter.className}>
              <option value="">Semua Kelas</option>
              {view?.classes.map((className) => (
                <option key={className} value={className}>
                  Kelas {className}
                </option>
              ))}
            </select>
          </div>
          <div className="field">
            <label htmlFor="correction-student">Cari NIS atau Nama Siswa</label>
            <input
              id="correction-student"
              name="student"
              type="search"
              maxLength={100}
              defaultValue={filter.studentQuery}
              placeholder="Contoh: S001 atau Nama Siswa"
            />
          </div>
          <div className="history-filter-actions">
            <button className="button button-primary" type="submit">
              Cari Catatan
            </button>
            <Link className="button button-secondary" href="/admin/attendance-corrections">
              Hari Ini
            </Link>
          </div>
        </form>
      </section>

      {/* Master-Detail Workspace (DESIGN.md Section 12.8) */}
      <div className="corrections-workspace">
        {/* Left Column: Master Search Results List */}
        <div className="corrections-master-column">
          {view ? (
            <section className="card" aria-labelledby="correction-results-title">
              <div className="history-results-heading">
                <div>
                  <p className="eyebrow">Daftar Catatan Presensi</p>
                  <h2 id="correction-results-title">{formatAttendanceHistoryDate(filter.date)}</h2>
                  <p className="muted">
                    <strong className="tnum">{view.matchedCount}</strong> catatan ditemukan
                    {view.truncated ? " (menampilkan 100 catatan pertama)" : ""}.
                  </p>
                </div>
              </div>

              {view.rows.length ? (
                <div className="history-record-list">
                  {view.rows.map((row) => {
                    const isRowSelected = row.id === recordId;
                    return (
                      <article
                        className={`history-record-card${isRowSelected ? " is-selected" : ""}`}
                        key={row.id}
                      >
                        <div className="history-record-heading">
                          <div className="history-student-cell">
                            <div className="avatar-circle avatar-sm" aria-hidden="true">
                              {row.studentName.slice(0, 1).toUpperCase()}
                            </div>
                            <div className="history-student-meta">
                              <strong>{row.studentName}</strong>
                              <span className="history-student-id tnum">
                                {row.studentLoginId} · Kelas {row.className}
                              </span>
                            </div>
                          </div>
                          <span className="status-badge status-active">{row.status}</span>
                        </div>

                        <dl className="history-record-details">
                          <div>
                            <dt>Jam Masuk</dt>
                            <dd className="tnum">{formatAttendanceHistoryTime(row.checkInAt) || "-"}</dd>
                          </div>
                          <div>
                            <dt>Jam Pulang</dt>
                            <dd className="tnum">{formatAttendanceHistoryTime(row.checkOutAt) || "-"}</dd>
                          </div>
                          <div>
                            <dt>Keterangan</dt>
                            <dd>{row.absenceReason}</dd>
                          </div>
                          <div>
                            <dt>Metode</dt>
                            <dd>{row.method}</dd>
                          </div>
                        </dl>

                        <Link
                          className={`button button-small ${isRowSelected ? "button-primary" : "button-secondary"}`}
                          href={recordUrl({
                            date: filter.date,
                            className: filter.className,
                            studentQuery: filter.studentQuery,
                            recordId: row.id,
                          })}
                          aria-label={`Pilih presensi ${row.studentName} untuk dikoreksi`}
                        >
                          {isRowSelected ? "Sedang Dipilih" : "Pilih untuk Dikoreksi"}
                        </Link>
                      </article>
                    );
                  })}
                </div>
              ) : (
                <p className="empty-state">Tidak ada catatan presensi untuk pencarian ini.</p>
              )}
            </section>
          ) : null}
        </div>

        {/* Right Column: Detail Editor Panel */}
        <div className="corrections-detail-column">
          {selected ? (
            <section className="card" aria-labelledby="selected-correction-title">
              <div className="section-heading">
                <p className="eyebrow">Formulir Koreksi Presensi</p>
                <h2 id="selected-correction-title">{selected.studentName}</h2>
                <p className="muted">
                  NIS: <strong className="tnum">{selected.studentLoginId}</strong> · Kelas {selected.className} · Tanggal {formatAttendanceHistoryDate(selected.date)}
                </p>
              </div>

              <div className="selected-correction-summary">
                <dl className="history-record-details">
                  <div>
                    <dt>Status Saat Ini</dt>
                    <dd><strong>{selected.status}</strong></dd>
                  </div>
                  <div>
                    <dt>Metode Pencatatan</dt>
                    <dd>{selected.method}</dd>
                  </div>
                  <div>
                    <dt>Jam Masuk Tercatat</dt>
                    <dd className="tnum">{formatAttendanceHistoryTime(selected.checkInAt) || "-"}</dd>
                  </div>
                  <div>
                    <dt>Jam Pulang Tercatat</dt>
                    <dd className="tnum">{formatAttendanceHistoryTime(selected.checkOutAt) || "-"}</dd>
                  </div>
                  <div>
                    <dt>Keterangan</dt>
                    <dd>{selected.absenceReason}</dd>
                  </div>
                </dl>
              </div>

              <p className="form-hint">
                Data sebelum dan sesudah koreksi dicatat otomatis ke dalam audit sistem.
              </p>

              <div className="correction-form-options">
                <details className="reset-panel" open>
                  <summary>Koreksi sebagai Hadir</summary>
                  <form className="form-stack compact-form" action={correctAttendanceAction}>
                    <input type="hidden" name="record_id" value={selected.id} />
                    <input type="hidden" name="mode" value="presence" />
                    <div className="field">
                      <label htmlFor="correction-check-in">Jam Masuk (Format Jam:Menit:Detik)</label>
                      <input
                        id="correction-check-in"
                        name="check_in_time"
                        type="time"
                        step="1"
                        defaultValue={selected.checkInTimeInput}
                        required
                      />
                    </div>
                    <div className="field">
                      <label htmlFor="correction-check-out">Jam Pulang (Opsional)</label>
                      <input
                        id="correction-check-out"
                        name="check_out_time"
                        type="time"
                        step="1"
                        defaultValue={selected.checkOutTimeInput}
                      />
                    </div>
                    <div className="field">
                      <label htmlFor="presence-reason">Alasan Koreksi Resmi</label>
                      <input
                        id="presence-reason"
                        name="reason"
                        type="text"
                        maxLength={500}
                        placeholder="Contoh: Siswa hadir mengikuti upacara bendera..."
                        required
                      />
                    </div>
                    <button className="button button-primary" type="submit">
                      Simpan Sebagai Hadir
                    </button>
                  </form>
                </details>

                <details className="reset-panel">
                  <summary>Koreksi sebagai Tidak Hadir (Izin / Sakit / Alfa / Dispensasi)</summary>
                  <form className="form-stack compact-form" action={correctAttendanceAction}>
                    <input type="hidden" name="record_id" value={selected.id} />
                    <input type="hidden" name="mode" value="absence" />
                    <div className="field">
                      <label htmlFor="correction-absence">Kategori Ketidakhadiran</label>
                      <select
                        id="correction-absence"
                        name="absence_category"
                        defaultValue={selected.absenceCategory ?? "sick"}
                        required
                      >
                        {Object.entries(absenceLabels).map(([value, label]) => (
                          <option key={value} value={value}>
                            {label}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div className="field">
                      <label htmlFor="correction-note">Catatan Keterangan Singkat (Opsional)</label>
                      <input
                        id="correction-note"
                        name="absence_note"
                        type="text"
                        maxLength={500}
                        defaultValue={selected.absenceNote ?? ""}
                        placeholder="Contoh: Surat dokter nomor 123..."
                      />
                    </div>
                    <div className="field">
                      <label htmlFor="absence-reason">Alasan Koreksi Resmi</label>
                      <input
                        id="absence-reason"
                        name="reason"
                        type="text"
                        maxLength={500}
                        placeholder="Contoh: Surat izin orang tua diterima wali kelas..."
                        required
                      />
                    </div>
                    <button className="button button-primary" type="submit">
                      Simpan Sebagai Tidak Hadir
                    </button>
                  </form>
                </details>
              </div>
            </section>
          ) : (
            <div className="card empty-selection-card">
              <div className="empty-selection-body">
                <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                  <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
                </svg>
                <h3>Pilih Catatan untuk Dikoreksi</h3>
                <p className="muted">
                  Pilih salah satu catatan siswa dari daftar di samping untuk meninjau data saat ini dan melakukan koreksi presensi.
                </p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
