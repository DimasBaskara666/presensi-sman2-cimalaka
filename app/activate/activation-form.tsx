"use client";

import { useActionState } from "react";
import {
  activateStudentAction,
  type ActivateStudentActionState,
} from "./actions";

const initialState: ActivateStudentActionState = { error: null };

const errorMessages: Record<Exclude<ActivateStudentActionState["error"], null>, string> = {
  generic: "Aktivasi tidak dapat diproses. Periksa kembali data aktivasi Anda atau hubungi administrator.",
  password_mismatch: "Konfirmasi kata sandi tidak sama.",
  too_short: "Kata sandi harus terdiri dari minimal 10 karakter.",
  letter_required: "Kata sandi harus memiliki setidaknya satu huruf.",
  number_required: "Kata sandi harus memiliki setidaknya satu angka.",
  matches_login_id: "Kata sandi tidak boleh sama dengan ID siswa.",
  valid: "",
};

export function ActivationForm() {
  const [state, formAction, pending] = useActionState(activateStudentAction, initialState);

  return (
    <form action={formAction} className="form-stack">
      {state.error ? <p className="alert alert-error" role="alert">{errorMessages[state.error]}</p> : null}

      <div className="field">
        <label htmlFor="login_id">ID siswa</label>
        <input
          id="login_id"
          name="login_id"
          type="text"
          autoComplete="username"
          autoCapitalize="characters"
          maxLength={64}
          required
        />
      </div>
      <div className="field">
        <label htmlFor="activation_code">Kode aktivasi</label>
        <input
          id="activation_code"
          name="activation_code"
          type="text"
          autoComplete="one-time-code"
          autoCapitalize="characters"
          maxLength={16}
          placeholder="Contoh: 7K9P-4X2M"
          required
        />
      </div>
      <div className="field">
        <label htmlFor="password">Kata sandi baru</label>
        <input
          id="password"
          name="password"
          type="password"
          autoComplete="new-password"
          minLength={10}
          required
        />
      </div>
      <div className="field">
        <label htmlFor="confirm_password">Ulangi kata sandi baru</label>
        <input
          id="confirm_password"
          name="confirm_password"
          type="password"
          autoComplete="new-password"
          minLength={10}
          required
        />
      </div>
      <p className="form-hint">Minimal 10 karakter dengan sedikitnya satu huruf dan satu angka.</p>
      <button className="button button-primary" type="submit" disabled={pending}>
        {pending ? "Mengaktifkan…" : "Aktifkan akun"}
      </button>
    </form>
  );
}
