"use client";

import { useState } from "react";
import { useFormStatus } from "react-dom";
import { loginAction } from "./actions";

type RoleOption = "student" | "teacher";

const roleConfigs: Record<RoleOption, { label: string; placeholder: string; name: string }> = {
  student: {
    name: "Siswa",
    label: "Nomor Induk Siswa (NIS)",
    placeholder: "Masukkan nomor induk siswa...",
  },
  teacher: {
    name: "Guru",
    label: "ID Masuk Guru",
    placeholder: "Masukkan ID resmi guru...",
  },
};

function SubmitButton() {
  const { pending } = useFormStatus();

  return (
    <button className="button button-primary button-full" type="submit" disabled={pending}>
      {pending ? (
        <>
          <span className="spinner" aria-hidden="true" />
          <span>Memverifikasi...</span>
        </>
      ) : (
        <>
          <span>Masuk ke Sistem</span>
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
            <line x1="5" y1="12" x2="19" y2="12" />
            <polyline points="12 5 19 12 12 19" />
          </svg>
        </>
      )}
    </button>
  );
}

export function LoginForm() {
  const [selectedRole, setSelectedRole] = useState<RoleOption>("student");
  const [showPassword, setShowPassword] = useState(false);

  const config = roleConfigs[selectedRole];

  return (
    <form action={loginAction} className="form-stack">
      {/* Role Selection Tabs: Siswa & Guru */}
      <div>
        <span id="role-selector-label" className="sr-only">
          Pilih Peran Akun
        </span>
        <div
          role="tablist"
          aria-labelledby="role-selector-label"
          className="role-tabs"
        >
          {(["student", "teacher"] as const).map((role) => (
            <button
              key={role}
              type="button"
              role="tab"
              aria-selected={selectedRole === role}
              className={`role-tab${selectedRole === role ? " active" : ""}`}
              onClick={() => setSelectedRole(role)}
            >
              {roleConfigs[role].name}
            </button>
          ))}
        </div>
      </div>

      {/* Login ID Input */}
      <div className="field">
        <label htmlFor="login_id">{config.label}</label>
        <input
          id="login_id"
          name="login_id"
          type="text"
          autoComplete="username"
          autoCapitalize="characters"
          placeholder={config.placeholder}
          required
        />
      </div>

      {/* Password Input */}
      <div className="field">
        <label htmlFor="password">Kata Sandi</label>
        <div className="input-action-wrapper">
          <input
            id="password"
            name="password"
            type={showPassword ? "text" : "password"}
            autoComplete="current-password"
            placeholder="Masukkan kata sandi akun..."
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

      {/* Static Password Help Note */}
      <p className="auth-help-text">
        Lupa kata sandi? Siswa dapat menghubungi Wali Kelas atau Guru BK di sekolah. Guru dan Admin dapat menghubungi Bagian Tata Usaha.
      </p>

      <SubmitButton />
    </form>
  );
}
