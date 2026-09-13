"use client";

import { useState } from "react";
import { ConfirmDialog } from "@/components/confirm-dialog";

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

  function handleConfirmReset() {
    setShowRegenerateConfirm(false);
    const link = document.createElement("a");
    link.href = regenerateAllUrl;
    link.download = "";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }

  return (
    <div className="bulk-activation-panel">
      <div className="field">
        <label htmlFor="bulk-class-select">Pilih Lingkup Rombongan Belajar (Kelas):</label>
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

        <button
          type="button"
          className="button button-secondary"
          onClick={() => setShowRegenerateConfirm(true)}
        >
          Reset &amp; Cetak Ulang {selectedClass ? `Kelas ${selectedClass}` : "Semua Kelas"}
        </button>
      </div>

      <ConfirmDialog
        isOpen={showRegenerateConfirm}
        title="Reset &amp; Cetak Ulang Kode Aktivasi?"
        description={
          <>
            <p>
              Kode aktivasi lama untuk siswa yang belum aktif di{" "}
              <strong>{selectedClass ? `Kelas ${selectedClass}` : "seluruh sekolah"}</strong> akan hangus dan digantikan kode baru.
            </p>
            <p style={{ marginTop: "0.5rem" }}>
              Slip aktivasi PDF format A4 Portrait siap potong akan diunduh secara otomatis. Lanjutkan proses pembuatan ulang kode?
            </p>
          </>
        }
        confirmLabel="Ya, Reset &amp; Unduh Slip"
        cancelLabel="Batal"
        variant="danger"
        onConfirm={handleConfirmReset}
        onCancel={() => setShowRegenerateConfirm(false)}
      />

      <p className="form-hint">
        {selectedClass
          ? `Operasi hanya berlaku untuk siswa di Kelas ${selectedClass}.`
          : `Operasi default hanya akan membuat kode untuk ${needsCodeCount} siswa yang belum memiliki kode aktif.`}
      </p>
    </div>
  );
}
