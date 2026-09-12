"use client";

import { useRef } from "react";

type DeactivateButtonProps = {
  loginId: string;
  isActive: boolean;
  action: (formData: FormData) => Promise<void>;
};

export function StudentToggleButton({ loginId, isActive, action }: DeactivateButtonProps) {
  const formRef = useRef<HTMLFormElement>(null);

  function handleClick() {
    if (isActive) {
      const ok = window.confirm(
        `Nonaktifkan akun siswa ${loginId}?\n\nSiswa tidak akan dapat masuk ke sistem presensi sampai diaktifkan kembali.`
      );
      if (!ok) return;
    }
    formRef.current?.requestSubmit();
  }

  return (
    <form ref={formRef} action={action}>
      <input name="login_id" type="hidden" value={loginId} />
      <input name="is_active" type="hidden" value={isActive ? "false" : "true"} />
      <button
        className={`button button-small ${isActive ? "button-danger" : "button-secondary"}`}
        type="button"
        onClick={handleClick}
      >
        {isActive ? "Nonaktifkan" : "Aktifkan"}
      </button>
    </form>
  );
}
