"use client";

import { useActionState, useRef, useState } from "react";
import {
  activateStudentAction,
  type ActivateStudentActionState,
} from "./actions";

const initialState: ActivateStudentActionState = { error: null };

const errorMessages: Record<Exclude<ActivateStudentActionState["error"], null>, string> = {
  generic: "Aktivasi tidak dapat diproses. Periksa kembali NIS dan Kode Aktivasi Anda atau hubungi wali kelas.",
  password_mismatch: "Konfirmasi kata sandi tidak sama.",
  too_short: "Kata sandi harus terdiri dari minimal 10 karakter.",
  letter_required: "Kata sandi harus memiliki setidaknya satu huruf.",
  number_required: "Kata sandi harus memiliki setidaknya satu angka.",
  matches_login_id: "Kata sandi tidak boleh sama dengan NIS siswa.",
  valid: "",
};

export function ActivationForm() {
  const [state, formAction, pending] = useActionState(activateStudentAction, initialState);

  const [loginId, setLoginId] = useState("");
  const [part1, setPart1] = useState("");
  const [part2, setPart2] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  const part1Ref = useRef<HTMLInputElement>(null);
  const part2Ref = useRef<HTMLInputElement>(null);

  // Criteria validation
  const isMinLength = password.length >= 10;
  const hasLetterAndNumber = /[A-Za-z]/.test(password) && /[0-9]/.test(password);
  const notLoginId = loginId.trim().length > 0 && password.toUpperCase() !== loginId.trim().toUpperCase();
  const isMatching = confirmPassword.length > 0 && password === confirmPassword;

  function handlePart1Change(e: React.ChangeEvent<HTMLInputElement>) {
    const raw = e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, "");
    if (raw.length <= 4) {
      setPart1(raw);
      if (raw.length === 4) {
        part2Ref.current?.focus();
      }
    } else {
      // Handles pasting 8-char string into part 1
      const p1 = raw.slice(0, 4);
      const p2 = raw.slice(4, 8);
      setPart1(p1);
      setPart2(p2);
      if (p2.length > 0) {
        part2Ref.current?.focus();
      }
    }
  }

  function handlePart2Change(e: React.ChangeEvent<HTMLInputElement>) {
    const raw = e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, "");
    if (raw.length <= 4) {
      setPart2(raw);
    }
  }

  function handlePart2KeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Backspace" && part2 === "") {
      part1Ref.current?.focus();
    }
  }

  function handlePaste(e: React.ClipboardEvent<HTMLInputElement>) {
    const pasted = e.clipboardData.getData("text").toUpperCase().replace(/[^A-Z0-9]/g, "");
    if (pasted.length >= 4) {
      e.preventDefault();
      setPart1(pasted.slice(0, 4));
      setPart2(pasted.slice(4, 8));
      part2Ref.current?.focus();
    }
  }

  const combinedCode = part1 && part2 ? `${part1}-${part2}` : (part1 || part2);

  return (
    <form action={formAction} className="form-stack">
      {state.error ? (
        <p className="alert alert-error" role="alert">
          {errorMessages[state.error]}
        </p>
      ) : null}

      {/* Hidden input to supply normalized activation code to action */}
      <input type="hidden" name="activation_code" value={combinedCode} />

      <div className="field">
        <label htmlFor="login_id">Nomor Induk Siswa (NIS)</label>
        <input
          id="login_id"
          name="login_id"
          type="text"
          autoComplete="username"
          autoCapitalize="characters"
          maxLength={64}
          placeholder="Contoh: 212210045"
          value={loginId}
          onChange={(e) => setLoginId(e.target.value)}
          required
        />
        <p className="form-hint">Masukkan NIS resmi yang terdaftar pada sistem sekolah.</p>
      </div>

      <div className="field">
        <label htmlFor="activation_code_part1">Kode Aktivasi (8 Karakter)</label>
        <div className="segmented-code-wrapper">
          <input
            ref={part1Ref}
            id="activation_code_part1"
            type="text"
            className="segmented-code-part"
            maxLength={8}
            placeholder="XXXX"
            value={part1}
            onChange={handlePart1Change}
            onPaste={handlePaste}
            aria-label="Empat karakter pertama kode aktivasi"
            autoComplete="one-time-code"
            required
          />
          <span className="segmented-code-divider" aria-hidden="true">-</span>
          <input
            ref={part2Ref}
            id="activation_code_part2"
            type="text"
            className="segmented-code-part"
            maxLength={4}
            placeholder="XXXX"
            value={part2}
            onChange={handlePart2Change}
            onKeyDown={handlePart2KeyDown}
            onPaste={handlePaste}
            aria-label="Empat karakter kedua kode aktivasi"
            required
          />
        </div>
        <p className="form-hint">Format: 8 karakter dari slip aktivasi wali kelas (contoh: 7K9P-4X2M).</p>
      </div>

      <div className="field">
        <label htmlFor="password">Kata Sandi Baru</label>
        <div className="input-action-wrapper">
          <input
            id="password"
            name="password"
            type={showPassword ? "text" : "password"}
            autoComplete="new-password"
            minLength={10}
            placeholder="Buat kata sandi baru..."
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />
          <button
            type="button"
            className="input-action-btn"
            onClick={() => setShowPassword((prev) => !prev)}
            aria-label={showPassword ? "Sembunyikan kata sandi" : "Tampilkan kata sandi"}
          >
            {showPassword ? (
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24" />
                <line x1="1" y1="1" x2="23" y2="23" />
              </svg>
            ) : (
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                <circle cx="12" cy="12" r="3" />
              </svg>
            )}
          </button>
        </div>
      </div>

      <div className="field">
        <label htmlFor="confirm_password">Ulangi Kata Sandi Baru</label>
        <div className="input-action-wrapper">
          <input
            id="confirm_password"
            name="confirm_password"
            type={showConfirmPassword ? "text" : "password"}
            autoComplete="new-password"
            minLength={10}
            placeholder="Ketik ulang kata sandi baru..."
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            required
          />
          <button
            type="button"
            className="input-action-btn"
            onClick={() => setShowConfirmPassword((prev) => !prev)}
            aria-label={showConfirmPassword ? "Sembunyikan kata sandi" : "Tampilkan kata sandi"}
          >
            {showConfirmPassword ? (
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24" />
                <line x1="1" y1="1" x2="23" y2="23" />
              </svg>
            ) : (
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                <circle cx="12" cy="12" r="3" />
              </svg>
            )}
          </button>
        </div>
      </div>

      {/* Real-time Password Criteria Checklist */}
      <div className="password-criteria-box" aria-live="polite">
        <p className="password-criteria-header">Syarat Kata Sandi Akun:</p>
        <ul className="password-criteria-list">
          <li className={`password-criterion${isMinLength ? " is-met" : ""}`}>
            <span className="password-criterion-icon" aria-hidden="true">
              {isMinLength ? (
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="20 6 9 17 4 12" />
                </svg>
              ) : (
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <circle cx="12" cy="12" r="9" />
                </svg>
              )}
            </span>
            <span>Minimal 10 karakter</span>
          </li>
          <li className={`password-criterion${hasLetterAndNumber ? " is-met" : ""}`}>
            <span className="password-criterion-icon" aria-hidden="true">
              {hasLetterAndNumber ? (
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="20 6 9 17 4 12" />
                </svg>
              ) : (
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <circle cx="12" cy="12" r="9" />
                </svg>
              )}
            </span>
            <span>Memuat kombinasi huruf dan angka</span>
          </li>
          <li className={`password-criterion${notLoginId ? " is-met" : ""}`}>
            <span className="password-criterion-icon" aria-hidden="true">
              {notLoginId ? (
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="20 6 9 17 4 12" />
                </svg>
              ) : (
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <circle cx="12" cy="12" r="9" />
                </svg>
              )}
            </span>
            <span>Tidak sama dengan NIS siswa</span>
          </li>
          <li className={`password-criterion${isMatching ? " is-met" : ""}`}>
            <span className="password-criterion-icon" aria-hidden="true">
              {isMatching ? (
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="20 6 9 17 4 12" />
                </svg>
              ) : (
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <circle cx="12" cy="12" r="9" />
                </svg>
              )}
            </span>
            <span>Konfirmasi kata sandi cocok</span>
          </li>
        </ul>
      </div>

      {/* Help note */}
      <p className="auth-help-text">
        Jika slip kode aktivasi hilang atau belum diterima, silakan hubungi Wali Kelas Anda di sekolah.
      </p>

      <button className="button button-primary button-full" type="submit" disabled={pending}>
        {pending ? (
          <>
            <span className="spinner" aria-hidden="true" />
            <span>Mengaktifkan Akun...</span>
          </>
        ) : (
          <>
            <span>Aktifkan Akun Saya</span>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
              <circle cx="8.5" cy="7" r="4" />
              <polyline points="17 11 19 13 23 9" />
            </svg>
          </>
        )}
      </button>
    </form>
  );
}
