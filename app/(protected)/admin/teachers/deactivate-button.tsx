"use client";

import { useRef, useState } from "react";
import { ConfirmDialog } from "@/components/confirm-dialog";

type TeacherToggleButtonProps = {
  teacherId: string;
  teacherName?: string;
  isActive: boolean;
  action: (formData: FormData) => Promise<void>;
};

export function TeacherToggleButton({ teacherId, teacherName, isActive, action }: TeacherToggleButtonProps) {
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

  const displayName = teacherName ? teacherName : teacherId;

  return (
    <>
      <form ref={formRef} action={action}>
        <input name="teacher_id" type="hidden" value={teacherId} />
        <input name="is_active" type="hidden" value={isActive ? "false" : "true"} />
        <button
          className={`button ${isActive ? "button-danger" : "button-secondary"}`}
          type="button"
          aria-label={`${isActive ? "Nonaktifkan" : "Aktifkan"} akun guru${teacherName ? ` ${teacherName}` : ""}`}
          onClick={handleClick}
        >
          {isActive ? "Nonaktifkan" : "Aktifkan"}
        </button>
      </form>

      {isActive && (
        <ConfirmDialog
          isOpen={showConfirm}
          title="Nonaktifkan Akun Guru?"
          description={
            <>
              <p>
                Apakah Anda yakin ingin menonaktifkan akun guru <strong>{displayName}</strong>?
              </p>
              <p style={{ marginTop: "0.5rem" }}>
                Guru tidak akan dapat masuk ke sistem presensi sampai akun diaktifkan kembali oleh admin.
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
