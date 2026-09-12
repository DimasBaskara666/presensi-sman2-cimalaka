"use client";

import { useState } from "react";

type BulkActivationControlProps = {
  classes: string[];
  needsCodeCount: number;
};

export function BulkActivationControl({
  classes,
  needsCodeCount,
}: BulkActivationControlProps) {
  const [selectedClass, setSelectedClass] = useState<string>("");
  const [showRegenerateConfirm, setShowRegenerateConfirm] = useState(false);

  const missingUrl = `/admin/students/activation-bulk/pdf?class=${encodeURIComponent(selectedClass)}&mode=missing`;
  const regenerateAllUrl = `/admin/students/activation-bulk/pdf?class=${encodeURIComponent(selectedClass)}&mode=all`;

  return (
    <div className="bulk-activation-panel">
      <div className="field">
        <label htmlFor="bulk-class-select">Pilih Lingkup Kelas:</label>
        <select
          id="bulk-class-select"
          value={selectedClass}
          onChange={(e) => {
            setSelectedClass(e.target.value);
            setShowRegenerateConfirm(false);
          }}
          className="select-input"
        >
          <option value="">Semua Kelas (Seluruh Siswa)</option>
          {classes.map((cls) => (
            <option key={cls} value={cls}>
              Kelas {cls}
            </option>
          ))}
        </select>
      </div>

      <div className="page-actions bulk-actions">
        <a
          href={missingUrl}
          className="button button-primary"
          download
        >
          Generate &amp; Unduh Slip (Hanya yang Belum Punya Kode)
        </a>

        {!showRegenerateConfirm ? (
          <button
            type="button"
            className="button button-secondary"
            onClick={() => setShowRegenerateConfirm(true)}
          >
            Generate Ulang Semua {selectedClass ? `Kelas ${selectedClass}` : "Siswa"} (Reset)
          </button>
        ) : (
          <div className="alert alert-warning bulk-confirm-alert">
            <span>
              <strong>Konfirmasi:</strong> Kode lama untuk siswa yang belum aktif akan hangus. Lanjutkan cetak ulang?
            </span>
            <a
              href={regenerateAllUrl}
              className="button button-danger"
              download
              onClick={() => setShowRegenerateConfirm(false)}
            >
              Ya, Generate Ulang &amp; Unduh
            </a>
            <button
              type="button"
              className="button button-secondary"
              onClick={() => setShowRegenerateConfirm(false)}
            >
              Batal
            </button>
          </div>
        )}
      </div>

      <p className="form-hint">
        {selectedClass
          ? `Operasi hanya berlaku untuk siswa di Kelas ${selectedClass}.`
          : `Operasi default hanya akan membuat kode untuk ${needsCodeCount} siswa yang belum memiliki kode aktif.`}
      </p>
    </div>
  );
}
