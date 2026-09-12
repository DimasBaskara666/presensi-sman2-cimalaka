"use client";

import { useRef } from "react";

type TeacherToggleButtonProps = {
  teacherId: string;
  teacherName?: string;
  isActive: boolean;
  action: (formData: FormData) => Promise<void>;
};

export function TeacherToggleButton({ teacherId, teacherName, isActive, action }: TeacherToggleButtonProps) {
  const formRef = useRef<HTMLFormElement>(null);

  function handleClick() {
    if (isActive) {
      const ok = window.confirm(
        `Nonaktifkan akun guru ini?\n\nGuru tidak akan dapat masuk ke sistem presensi sampai diaktifkan kembali.`
      );
      if (!ok) return;
    }
    formRef.current?.requestSubmit();
  }

  return (
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
  );
}
