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

  const mappingComplete =
    mapping.idType !== "" &&
    Boolean(mapping.idColumn && mapping.fullNameColumn && mapping.classColumn) &&
    new Set([mapping.idColumn, mapping.fullNameColumn, mapping.classColumn]).size === 3;
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

  return (
    <div className="import-workflow">
      <section className="card" aria-labelledby="upload-title">
        <p className="step-label">Step 1</p>
        <h2 id="upload-title">Choose workbook</h2>
        <p className="muted">One .xlsx worksheet, maximum 5 MB and 2,000 Student rows.</p>
        <div className="field">
          <label htmlFor="student-workbook">Excel workbook</label>
          <input
            id="student-workbook"
            type="file"
            accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
            onChange={(event) => resetAfterFileChange(event.target.files?.[0] ?? null)}
          />
        </div>
        <button className="button button-primary" type="button" disabled={!file || pending} onClick={inspect}>
          Inspect columns
        </button>
      </section>

      {message ? <p className="alert alert-error" role="alert">{message}</p> : null}

      {inspection ? (
        <section className="card" aria-labelledby="mapping-title">
          <p className="step-label">Step 2</p>
          <h2 id="mapping-title">Map columns</h2>
          <p className="muted">{inspection.totalRows} meaningful Student rows detected. No database write has occurred.</p>
          <div className="mapping-grid">
            <ColumnSelect
              id="id-column"
              label="Student ID column"
              value={mapping.idColumn}
              headers={inspection.headers}
              onChange={(value) => updateMapping("idColumn", value)}
            />
            <ColumnSelect
              id="name-column"
              label="Full Name column"
              value={mapping.fullNameColumn}
              headers={inspection.headers}
              onChange={(value) => updateMapping("fullNameColumn", value)}
            />
            <ColumnSelect
              id="class-column"
              label="Class column"
              value={mapping.classColumn}
              headers={inspection.headers}
              onChange={(value) => updateMapping("classColumn", value)}
            />
            <div className="field">
              <label htmlFor="id-type">Student ID type</label>
              <select
                id="id-type"
                value={mapping.idType}
                onChange={(event) => updateMapping("idType", event.target.value)}
              >
                <option value="">Choose NIS or NISN</option>
                <option value="nis">NIS</option>
                <option value="nisn">NISN</option>
              </select>
            </div>
          </div>
          {!mappingComplete && Object.values(mapping).some(Boolean) ? (
            <p className="alert alert-error">Choose three different columns and one ID type.</p>
          ) : null}
          <button className="button button-primary" type="button" disabled={!mappingComplete || pending} onClick={validate}>
            Validate and preview
          </button>
        </section>
      ) : null}

      {preview ? (
        <section className="card" aria-labelledby="preview-title">
          <p className="step-label">Steps 3–4</p>
          <h2 id="preview-title">Validation and preview</h2>
          <div className="summary-grid">
            <Summary label="Rows" value={preview.totalRows} />
            <Summary label="New" value={preview.insertedCount} />
            <Summary label="Updates" value={preview.updatedCount} />
            <Summary label="Unchanged" value={preview.unchangedCount} />
            <Summary label="Errors" value={blockingErrors.length} />
            <Summary label="Warnings" value={warnings.length} />
          </div>

          {blockingErrors.length ? (
            <IssueList title="Blocking errors" issues={blockingErrors} tone="error" />
          ) : (
            <p className="alert alert-success">No blocking errors. The roster is ready to import.</p>
          )}
          {warnings.length ? <IssueList title="Warnings" issues={warnings} tone="warning" /> : null}

          <div className="table-wrap">
            <table className="data-table">
              <thead><tr><th>Row</th><th>ID</th><th>Name</th><th>Class</th><th>Action</th></tr></thead>
              <tbody>
                {preview.rows.slice(0, 200).map((row) => (
                  <tr key={`${row.rowNumber}-${row.loginId}`}>
                    <td>{row.rowNumber}</td><td>{row.loginId}</td><td>{row.fullName}</td>
                    <td>{row.className}</td><td>{row.action}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {preview.rows.length > 200 ? <p className="muted">Showing the first 200 preview rows.</p> : null}
          <button
            className="button button-primary"
            type="button"
            disabled={blockingErrors.length > 0 || pending || Boolean(summary)}
            onClick={confirmImport}
          >
            Confirm Student import
          </button>
          <p className="muted">Confirmation reparses and revalidates the workbook before one transactional database write.</p>
        </section>
      ) : null}

      {summary ? (
        <section className="card" aria-labelledby="complete-title">
          <p className="step-label">Complete</p>
          <h2 id="complete-title">Student roster imported</h2>
          <p className="alert alert-success">The transaction completed successfully.</p>
          <div className="summary-grid">
            <Summary label="Inserted" value={summary.insertedCount} />
            <Summary label="Updated" value={summary.updatedCount} />
            <Summary label="Unchanged" value={summary.unchangedCount} />
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
        <option value="">Choose column</option>
        {headers.map((header) => (
          <option key={header.column} value={header.column}>Column {header.column}: {header.label}</option>
        ))}
      </select>
    </div>
  );
}

function Summary({ label, value }: { label: string; value: number }) {
  return <div className="summary-item"><span>{label}</span><strong>{value}</strong></div>;
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
            {issue.rowNumber ? `Row ${issue.rowNumber}: ` : ""}{issue.message}
          </li>
        ))}
      </ul>
      {issues.length > 100 ? <p>Showing the first 100 items.</p> : null}
    </div>
  );
}
