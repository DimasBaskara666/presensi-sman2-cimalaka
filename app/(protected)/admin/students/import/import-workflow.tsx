"use client";

import { useState, useTransition } from "react";
import {
  confirmStudentImportAction,
  inspectStudentWorkbookAction,
  previewStudentImportAction,
} from "./actions";
import type {
  StudentImportPreview,
  StudentImportSummary,
  WorkbookInspection,
} from "@/lib/students/import-types";

type MappingState = {
  idColumn: string;
  fullNameColumn: string;
  classColumn: string;
  idType: "" | "nis" | "nisn";
};

const EMPTY_MAPPING: MappingState = {
  idColumn: "",
  fullNameColumn: "",
  classColumn: "",
  idType: "",
};

function actionFormData(file: File, mapping?: MappingState, expectedHash?: string): FormData {
  const formData = new FormData();
  formData.set("workbook", file);
  if (mapping) {
    formData.set("id_column", mapping.idColumn);
    formData.set("full_name_column", mapping.fullNameColumn);
    formData.set("class_column", mapping.classColumn);
    formData.set("id_type", mapping.idType);
  }
  if (expectedHash) formData.set("expected_hash", expectedHash);
  return formData;
}

export default function StudentImportWorkflow() {
  const [file, setFile] = useState<File | null>(null);
  const [inspection, setInspection] = useState<WorkbookInspection | null>(null);
  const [mapping, setMapping] = useState<MappingState>(EMPTY_MAPPING);
  const [preview, setPreview] = useState<StudentImportPreview | null>(null);
  const [summary, setSummary] = useState<StudentImportSummary | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const allSheetsHaveClass = Boolean(
    inspection?.worksheets?.length &&
      inspection.worksheets.every((ws) => Boolean(ws.className)),
  );

  const mappingComplete =
    mapping.idType !== "" &&
    Boolean(mapping.idColumn && mapping.fullNameColumn) &&
    mapping.idColumn !== mapping.fullNameColumn &&
    (!mapping.classColumn ||
      (mapping.classColumn !== mapping.idColumn &&
        mapping.classColumn !== mapping.fullNameColumn)) &&
    (allSheetsHaveClass || Boolean(mapping.classColumn));

  const blockingErrors = preview?.issues.filter((issue) => issue.severity === "error") ?? [];
  const warnings = preview?.issues.filter((issue) => issue.severity === "warning") ?? [];

  function resetAfterFileChange(nextFile: File | null) {
    setFile(nextFile);
    setInspection(null);
    setMapping(EMPTY_MAPPING);
    setPreview(null);
    setSummary(null);
    setMessage(null);
  }

  function updateMapping(field: keyof MappingState, value: string) {
    setMapping((current) => ({ ...current, [field]: value } as MappingState));
    setPreview(null);
    setSummary(null);
    setMessage(null);
  }

  function inspect() {
    if (!file) return;
    startTransition(async () => {
      setMessage(null);
      const result = await inspectStudentWorkbookAction(actionFormData(file));
      if (!result.ok) {
        setInspection(null);
        setMessage(result.message);
        return;
      }
      setInspection(result.inspection);

      const headers = result.inspection.headers;
      const idHeader = headers.find((h) => /^(?:nisn|nis|id|school id|kode)/i.test(h.label));
      const nameHeader = headers.find((h) => /^(?:nama|full name|name)/i.test(h.label));
      const classHeader = headers.find((h) => /^(?:class|kelas|rombel)/i.test(h.label));
      const detectedIdType = idHeader && /nisn/i.test(idHeader.label) ? "nisn" : "nis";

      setMapping({
        idColumn: idHeader ? String(idHeader.column) : "",
        fullNameColumn: nameHeader ? String(nameHeader.column) : "",
        classColumn: classHeader ? String(classHeader.column) : "",
        idType: detectedIdType,
      });
    });
  }

  function validate() {
    if (!file || !mappingComplete) return;
    startTransition(async () => {
      setMessage(null);
      const result = await previewStudentImportAction(actionFormData(file, mapping));
      if (!result.ok) {
        setPreview(null);
        setMessage(result.message);
        return;
      }
      setPreview(result.preview);
    });
  }

  function confirmImport() {
    if (!file || !preview || blockingErrors.length > 0) return;
    startTransition(async () => {
      setMessage(null);
      const result = await confirmStudentImportAction(
        actionFormData(file, mapping, preview.fileHash),
      );
      if (!result.ok) {
        setSummary(null);
        setMessage(result.message);
        return;
      }
      setSummary(result.summary);
    });
  }

  function handleConfirmImport() {
    const ok = window.confirm("Lanjutkan impor data siswa ke dalam database sekolah?");
    if (!ok) return;
    confirmImport();
  }

  const actionLabels: Record<string, string> = {
    insert: "Tambah",
    update: "Perbarui",
    unchanged: "Tetap",
  };

  return (
    <div className="import-workflow">
      <section className="card" aria-labelledby="upload-title">
        <p className="step-label">Langkah 1</p>
        <h2 id="upload-title">Pilih buku kerja Excel</h2>
        <p className="muted">
          Mendukung file .xlsx multi-sheet (contoh: KELAS 10, KELAS 11, KELAS 12), maksimal 5 MB dan 2.000 total baris siswa.
        </p>
        <div className="field">
          <label htmlFor="student-workbook">File Excel (.xlsx)</label>
          <input
            id="student-workbook"
            type="file"
            accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
            onChange={(event) => resetAfterFileChange(event.target.files?.[0] ?? null)}
          />
        </div>
        <button className="button button-primary" type="button" disabled={!file || pending} onClick={inspect}>
          {pending ? "Memeriksa…" : "Periksa kolom"}
        </button>
      </section>

      {message ? <p className="alert alert-error" role="alert">{message}</p> : null}

      {inspection ? (
        <section className="card" aria-labelledby="mapping-title">
          <p className="step-label">Langkah 2</p>
          <h2 id="mapping-title">Pemetaan kolom</h2>
          <p className="muted">
            {inspection.totalRows} baris data siswa terdeteksi pada {inspection.worksheets?.length ?? 1} lembar kerja. Belum ada data yang diubah di basis data.
          </p>

          {inspection.worksheets && inspection.worksheets.length > 0 ? (
            <div className="worksheet-summary-list">
              <h3>Lembar kerja terdeteksi ({inspection.worksheets.length})</h3>
              <div className="summary-grid">
                {inspection.worksheets.map((ws) => (
                  <div key={ws.name} className="summary-item">
                    <span>{ws.name}</span>
                    <strong>
                      {ws.className ? `Kelas: ${ws.className}` : "Kelas dari kolom"} ({ws.totalRows} siswa)
                    </strong>
                  </div>
                ))}
              </div>
            </div>
          ) : null}

          <div className="mapping-grid">
            <ColumnSelect
              id="id-column"
              label="Kolom ID Siswa"
              value={mapping.idColumn}
              headers={inspection.headers}
              onChange={(value) => updateMapping("idColumn", value)}
            />
            <ColumnSelect
              id="name-column"
              label="Kolom Nama Lengkap"
              value={mapping.fullNameColumn}
              headers={inspection.headers}
              onChange={(value) => updateMapping("fullNameColumn", value)}
            />
            <div className="field">
              <label htmlFor="class-column">Kolom Kelas</label>
              <select
                id="class-column"
                value={mapping.classColumn}
                onChange={(event) => updateMapping("classColumn", event.target.value)}
              >
                <option value="">
                  {allSheetsHaveClass
                    ? "Diambil otomatis dari judul sheet (contoh: KELAS : ...)"
                    : "Pilih kolom kelas"}
                </option>
                {inspection.headers.map((header) => (
                  <option key={header.column} value={header.column}>
                    Kolom {header.column}: {header.label}
                  </option>
                ))}
              </select>
            </div>
            <div className="field">
              <label htmlFor="id-type">Tipe ID Siswa</label>
              <select
                id="id-type"
                value={mapping.idType}
                onChange={(event) => updateMapping("idType", event.target.value)}
              >
                <option value="">Pilih NIS atau NISN</option>
                <option value="nis">NIS</option>
                <option value="nisn">NISN</option>
              </select>
            </div>
          </div>
          {!mappingComplete && Object.values(mapping).some(Boolean) ? (
            <p className="alert alert-error">
              {allSheetsHaveClass
                ? "Pilih kolom ID Siswa, kolom Nama Lengkap, dan tipe ID."
                : "Pilih kolom ID Siswa, kolom Nama Lengkap, kolom Kelas, dan tipe ID."}
            </p>
          ) : null}
          <button className="button button-primary" type="button" disabled={!mappingComplete || pending} onClick={validate}>
            {pending ? "Memvalidasi…" : "Validasi dan pratinjau"}
          </button>
        </section>
      ) : null}

      {preview ? (
        <section className="card" aria-labelledby="preview-title">
          <p className="step-label">Langkah 3 dan 4</p>
          <h2 id="preview-title">Validasi dan pratinjau</h2>
          <div className="summary-grid">
            <Summary label="Total Baris" value={preview.totalRows} />
            <Summary label="Siswa Baru" value={preview.insertedCount} />
            <Summary label="Pembaruan" value={preview.updatedCount} />
            <Summary label="Tetap" value={preview.unchangedCount} />
            <Summary label="Galat" value={blockingErrors.length} />
            <Summary label="Peringatan" value={warnings.length} />
          </div>

          {preview.worksheets && preview.worksheets.length > 0 ? (
            <div className="worksheet-summary-list">
              <h3>Rincian lembar kerja</h3>
              <div className="summary-grid">
                {preview.worksheets.map((ws) => (
                  <div key={ws.name} className="summary-item">
                    <span>{ws.name}</span>
                    <strong>
                      {ws.className ? `Kelas: ${ws.className}` : "Kelas dari kolom"} &bull; {ws.totalRows} siswa
                    </strong>
                  </div>
                ))}
              </div>
            </div>
          ) : null}

          {blockingErrors.length ? (
            <IssueList title="Galat Kritis (Blokir)" issues={blockingErrors} tone="error" />
          ) : (
            <p className="alert alert-success">Tidak ada galat pemblokir. Data siswa siap untuk diimpor.</p>
          )}
          {warnings.length ? <IssueList title="Peringatan" issues={warnings} tone="warning" /> : null}

          <div className="table-wrap">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Baris</th>
                  <th>ID Siswa</th>
                  <th>Nama Lengkap</th>
                  <th>Kelas</th>
                  <th>Aksi</th>
                </tr>
              </thead>
              <tbody>
                {preview.rows.slice(0, 200).map((row) => (
                  <tr key={`${row.rowNumber}-${row.loginId}`}>
                    <td>{row.rowNumber}</td>
                    <td><strong>{row.loginId}</strong></td>
                    <td>{row.fullName}</td>
                    <td>{row.className}</td>
                    <td>
                      <span className={`status-badge ${row.action === "insert" ? "status-active" : row.action === "update" ? "status-warning" : "status-neutral"}`}>
                        {actionLabels[row.action] ?? row.action}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {preview.rows.length > 200 ? <p className="muted">Menampilkan 200 baris pratinjau pertama.</p> : null}
          <button
            className="button button-primary"
            type="button"
            disabled={blockingErrors.length > 0 || pending || Boolean(summary)}
            onClick={handleConfirmImport}
          >
            {pending ? "Memproses…" : "Konfirmasi Impor Siswa"}
          </button>
          <p className="form-hint">
            Konfirmasi akan memvalidasi ulang file Excel sebelum disimpan secara transaksional ke basis data.
          </p>
        </section>
      ) : null}

      {summary ? (
        <section className="card" aria-labelledby="complete-title">
          <p className="step-label">Selesai</p>
          <h2 id="complete-title">Roster Siswa Berhasil Diimpor</h2>
          <p className="alert alert-success">Proses impor selesai dengan sukses.</p>
          <div className="summary-grid">
            <Summary label="Ditambahkan" value={summary.insertedCount} />
            <Summary label="Diperbarui" value={summary.updatedCount} />
            <Summary label="Tidak Berubah" value={summary.unchangedCount} />
          </div>
        </section>
      ) : null}
    </div>
  );
}

function ColumnSelect({
  id, label, value, headers, onChange,
}: {
  id: string;
  label: string;
  value: string;
  headers: WorkbookInspection["headers"];
  onChange: (value: string) => void;
}) {
  return (
    <div className="field">
      <label htmlFor={id}>{label}</label>
      <select id={id} value={value} onChange={(event) => onChange(event.target.value)}>
        <option value="">Pilih kolom</option>
        {headers.map((header) => (
          <option key={header.column} value={header.column}>Kolom {header.column}: {header.label}</option>
        ))}
      </select>
    </div>
  );
}

function Summary({ label, value }: { label: string; value: number }) {
  return <div className="summary-item"><span>{label}</span><strong>{value}</strong></div>;
}

function translateIssue(issue: StudentImportPreview["issues"][number]): string {
  switch (issue.code) {
    case "school_id_conflict":
      return "NIS/NISN ini sudah ditautkan ke orang lain.";
    case "non_student_login_conflict":
      return "ID Siswa berkonflik dengan login Admin atau Guru yang ada.";
    case "student_identity_type_conflict":
      return "Tipe atau nilai identitas siswa tidak sesuai dengan data sebelumnya.";
    case "existing_student_update":
      return "Nama atau kelas siswa lama akan diperbarui.";
    case "existing_student_missing":
      return "Siswa lama tidak ada dalam buku kerja ini dan tidak akan diubah.";
    default:
      return issue.message;
  }
}

function IssueList({
  title, issues, tone,
}: {
  title: string;
  issues: StudentImportPreview["issues"];
  tone: "error" | "warning";
}) {
  return (
    <div className={`issue-list issue-list-${tone}`}>
      <h3>{title}</h3>
      <ul>
        {issues.slice(0, 100).map((issue, index) => (
          <li key={`${issue.code}-${issue.rowNumber ?? "general"}-${index}`}>
            {issue.worksheetName ? `[${issue.worksheetName}] ` : ""}
            {issue.rowNumber ? `Baris ${issue.rowNumber}: ` : ""}{translateIssue(issue)}
          </li>
        ))}
      </ul>
      {issues.length > 100 ? <p className="form-hint">Menampilkan 100 item pertama.</p> : null}
    </div>
  );
}
