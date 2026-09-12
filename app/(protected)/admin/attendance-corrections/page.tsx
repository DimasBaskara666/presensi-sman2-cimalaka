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
  correction_rejected: "Koreksi ditolak oleh aturan presensi PostgreSQL.",
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
    <div className="history-page">
      <header className="page-header">
        <div>
          <p className="eyebrow">Khusus administrator</p>
          <h1>Koreksi Presensi</h1>
          <p className="muted">Cari catatan, tinjau keadaan sekarang, lalu simpan koreksi dengan alasan audit.</p>
        </div>
        <Link className="button button-secondary" href="/admin">Kembali</Link>
      </header>

      {single(params.status) === "corrected" ? (
        <p className="alert alert-success" role="status">Koreksi tersimpan dan riwayat audit diperbarui.</p>
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

      <section className="card history-filter-card" aria-labelledby="correction-search-title">
        <div>
          <h2 id="correction-search-title">Cari catatan</h2>
          <p className="muted">Pilih tanggal, lalu persempit berdasarkan kelas atau ID/nama Siswa.</p>
        </div>
        <form className="history-filter-form" method="get">
          <div className="field">
            <label htmlFor="correction-date">Tanggal</label>
            <input id="correction-date" name="date" type="date" defaultValue={filter.date} required />
          </div>
          <div className="field">
            <label htmlFor="correction-class">Kelas</label>
            <select id="correction-class" name="class" defaultValue={filter.className}>
              <option value="">Semua kelas</option>
              {view?.classes.map((className) => <option key={className} value={className}>{className}</option>)}
            </select>
          </div>
          <div className="field">
            <label htmlFor="correction-student">ID atau nama Siswa</label>
            <input id="correction-student" name="student" type="search" maxLength={100} defaultValue={filter.studentQuery} placeholder="Contoh: S001" />
          </div>
          <div className="history-filter-actions">
            <button className="button button-primary" type="submit">Cari</button>
            <Link className="button button-quiet" href="/admin/attendance-corrections">Hari ini</Link>
          </div>
        </form>
      </section>

      {view ? (
        <section aria-labelledby="correction-results-title">
          <div className="history-results-heading">
            <div>
              <p className="eyebrow">Hasil pencarian</p>
              <h2 id="correction-results-title">{formatAttendanceHistoryDate(filter.date)}</h2>
              <p className="muted">{view.matchedCount} catatan ditemukan{view.truncated ? "; tampilkan 100 pertama" : ""}.</p>
            </div>
          </div>
          {view.rows.length ? (
            <div className="history-record-list">
              {view.rows.map((row) => (
                <article className="history-record-card" key={row.id}>
                  <div className="history-record-heading">
                    <div>
                      <h3>{row.studentName}</h3>
                      <p className="muted">{row.studentLoginId} · Kelas {row.className}</p>
                    </div>
                    <span className="status-badge status-active">{row.status}</span>
                  </div>
                  <dl className="history-record-details">
                    <div><dt>Masuk</dt><dd>{formatAttendanceHistoryTime(row.checkInAt)}</dd></div>
                    <div><dt>Pulang</dt><dd>{formatAttendanceHistoryTime(row.checkOutAt)}</dd></div>
                    <div><dt>Alasan</dt><dd>{row.absenceReason}</dd></div>
                    <div><dt>Metode</dt><dd>{row.method}</dd></div>
                  </dl>
                  <Link className="button button-secondary" href={recordUrl({
                    date: filter.date,
                    className: filter.className,
                    studentQuery: filter.studentQuery,
                    recordId: row.id,
                  })}>Pilih untuk dikoreksi</Link>
                </article>
              ))}
            </div>
          ) : (
            <p className="empty-state">Tidak ada catatan presensi untuk pencarian ini.</p>
          )}
        </section>
      ) : null}

      {selected ? (
        <section className="card narrow" aria-labelledby="selected-correction-title">
          <p className="eyebrow">Catatan terpilih</p>
          <h2 id="selected-correction-title">{selected.studentName}</h2>
          <p className="muted">
            {selected.studentLoginId} · Kelas {selected.className} · {formatAttendanceHistoryDate(selected.date)}
          </p>
          <dl className="history-record-details">
            <div><dt>Status sekarang</dt><dd>{selected.status}</dd></div>
            <div><dt>Metode</dt><dd>{selected.method}</dd></div>
            <div><dt>Masuk</dt><dd>{formatAttendanceHistoryTime(selected.checkInAt)}</dd></div>
            <div><dt>Pulang</dt><dd>{formatAttendanceHistoryTime(selected.checkOutAt)}</dd></div>
            <div><dt>Alasan ketidakhadiran</dt><dd>{selected.absenceReason}</dd></div>
          </dl>
          <p className="form-hint">Identitas Siswa dan snapshot tidak dapat diubah. Data sebelum dan sesudah koreksi dicatat otomatis.</p>

          <details className="reset-panel">
            <summary>Koreksi sebagai hadir</summary>
            <form className="form-stack compact-form" action={correctAttendanceAction}>
              <input type="hidden" name="record_id" value={selected.id} />
              <input type="hidden" name="mode" value="presence" />
              <div className="field">
                <label htmlFor="correction-check-in">Jam masuk</label>
                <input id="correction-check-in" name="check_in_time" type="time" step="1" defaultValue={selected.checkInTimeInput} required />
              </div>
              <div className="field">
                <label htmlFor="correction-check-out">Jam pulang (opsional)</label>
                <input id="correction-check-out" name="check_out_time" type="time" step="1" defaultValue={selected.checkOutTimeInput} />
              </div>
              <div className="field">
                <label htmlFor="presence-reason">Alasan koreksi</label>
                <input id="presence-reason" name="reason" type="text" maxLength={500} required />
              </div>
              <button className="button button-primary" type="submit">Simpan sebagai hadir</button>
            </form>
          </details>

          <details className="reset-panel">
            <summary>Koreksi sebagai tidak hadir</summary>
            <form className="form-stack compact-form" action={correctAttendanceAction}>
              <input type="hidden" name="record_id" value={selected.id} />
              <input type="hidden" name="mode" value="absence" />
              <div className="field">
                <label htmlFor="correction-absence">Status</label>
                <select id="correction-absence" name="absence_category" defaultValue={selected.absenceCategory ?? "sick"} required>
                  {Object.entries(absenceLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
                </select>
              </div>
              <div className="field">
                <label htmlFor="correction-note">Catatan singkat (opsional)</label>
                <input id="correction-note" name="absence_note" type="text" maxLength={500} defaultValue={selected.absenceNote ?? ""} />
              </div>
              <div className="field">
                <label htmlFor="absence-reason">Alasan koreksi</label>
                <input id="absence-reason" name="reason" type="text" maxLength={500} required />
              </div>
              <button className="button button-primary" type="submit">Simpan sebagai tidak hadir</button>
            </form>
          </details>
        </section>
      ) : null}
    </div>
  );
}
