"use client";

import { useState } from "react";
import { useFormStatus } from "react-dom";
import { changePasswordAction } from "./actions";

type ChangePasswordFormProps = {
  role: "admin" | "teacher" | "student";
  loginId: string;
};

function SubmitButton() {
  const { pending } = useFormStatus();

  return (
    <button className="button button-primary button-full" type="submit" disabled={pending}>
      {pending ? (
        <>
          <span className="spinner" aria-hidden="true" />
          <span>Menyimpan Kata Sandi...</span>
        </>
      ) : (
        <>
          <span>Simpan Kata Sandi</span>
          <svg
            width="18"
            height="18"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.2"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            <polyline points="20 6 9 17 4 12" />
          </svg>
        </>
      )}
    </button>
  );
}

export function ChangePasswordForm({ role, loginId }: ChangePasswordFormProps) {
  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  const isStudent = role === "student";

  // Criteria validation for student accounts
  const isMinLength = newPassword.length >= 10;
  const hasLetterAndNumber = /[A-Za-z]/.test(newPassword) && /[0-9]/.test(newPassword);
  const notLoginId = loginId.trim().length > 0 && newPassword.toUpperCase() !== loginId.trim().toUpperCase();
  const isMatching = confirmPassword.length > 0 && newPassword === confirmPassword;

  return (
    <form action={changePasswordAction} className="form-stack">
      {/* Current Password Field */}
      <div className="field">
        <label htmlFor="current_password">Kata Sandi Saat Ini</label>
        <div className="input-action-wrapper">
          <input
            id="current_password"
            name="current_password"
            type={showCurrentPassword ? "text" : "password"}
            autoComplete="current-password"
            placeholder="Masukkan kata sandi aktif..."
            required
          />
          <button
            type="button"
            className="input-action-btn"
            onClick={() => setShowCurrentPassword((prev) => !prev)}
            aria-label={showCurrentPassword ? "Sembunyikan kata sandi saat ini" : "Tampilkan kata sandi saat ini"}
          >
            {showCurrentPassword ? (
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

      {/* New Password Field */}
      <div className="field">
        <label htmlFor="new_password">Kata Sandi Baru</label>
        <div className="input-action-wrapper">
          <input
            id="new_password"
            name="new_password"
            type={showNewPassword ? "text" : "password"}
            autoComplete="new-password"
            minLength={isStudent ? 10 : undefined}
            placeholder="Masukkan kata sandi baru..."
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
            required
          />
          <button
            type="button"
            className="input-action-btn"
            onClick={() => setShowNewPassword((prev) => !prev)}
            aria-label={showNewPassword ? "Sembunyikan kata sandi baru" : "Tampilkan kata sandi baru"}
          >
            {showNewPassword ? (
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

      {/* Confirm Password Field */}
      <div className="field">
        <label htmlFor="confirm_password">Ulangi Kata Sandi Baru</label>
        <div className="input-action-wrapper">
          <input
            id="confirm_password"
            name="confirm_password"
            type={showConfirmPassword ? "text" : "password"}
            autoComplete="new-password"
            minLength={isStudent ? 10 : undefined}
            placeholder="Ketik ulang kata sandi baru..."
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            required
          />
          <button
            type="button"
            className="input-action-btn"
            onClick={() => setShowConfirmPassword((prev) => !prev)}
            aria-label={showConfirmPassword ? "Sembunyikan konfirmasi kata sandi" : "Tampilkan konfirmasi kata sandi"}
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

      {/* Student Password Criteria Checklist */}
      {isStudent ? (
        <div className="password-criteria-box" aria-live="polite">
          <p className="password-criteria-header">Syarat Kata Sandi Akun Siswa:</p>
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
      ) : null}

      <SubmitButton />
    </form>
  );
}
