"use client";

import { useRef, useState } from "react";
import { ConfirmDialog } from "@/components/confirm-dialog";

type DeactivateButtonProps = {
  loginId: string;
  studentName?: string;
  isActive: boolean;
  action: (formData: FormData) => Promise<void>;
};

export function StudentToggleButton({
  loginId,
  studentName,
  isActive,
  action,
}: DeactivateButtonProps) {
  const formRef = useRef<HTMLFormElement>(null);
  const [showConfirm, setShowConfirm] = useState(false);

  function handleClick() {
    if (isActive) {
      setShowConfirm(true);
      return;
    }
    formRef.current?.requestSubmit();
  }

  function handleConfirm() {
    setShowConfirm(false);
    formRef.current?.requestSubmit();
  }

  const displayName = studentName ? `${studentName} (${loginId})` : loginId;

  return (
    <>
      <form ref={formRef} action={action}>
        <input name="login_id" type="hidden" value={loginId} />
        <input name="is_active" type="hidden" value={isActive ? "false" : "true"} />
        <button
          className={`button button-small ${isActive ? "button-danger" : "button-secondary"}`}
          type="button"
          aria-label={`${isActive ? "Nonaktifkan" : "Aktifkan"} akun siswa ${displayName}`}
          onClick={handleClick}
        >
          {isActive ? "Nonaktifkan" : "Aktifkan"}
        </button>
      </form>

      {isActive && (
        <ConfirmDialog
          isOpen={showConfirm}
          title="Nonaktifkan Akun Siswa?"
          description={
            <>
              <p>
                Apakah Anda yakin ingin menonaktifkan akun siswa <strong>{displayName}</strong>?
              </p>
              <p style={{ marginTop: "0.5rem" }}>
                Siswa tidak akan dapat masuk ke sistem presensi sampai akun diaktifkan kembali oleh admin.
              </p>
            </>
          }
          confirmLabel="Ya, Nonaktifkan"
          cancelLabel="Batal"
          variant="danger"
          onConfirm={handleConfirm}
          onCancel={() => setShowConfirm(false)}
        />
      )}
    </>
  );
}
