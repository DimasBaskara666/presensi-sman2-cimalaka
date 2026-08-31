"use client";

import { useActionState } from "react";
import {
  generateActivationCodeAction,
  type ActivationCodeActionState,
} from "./actions";

const initialState: ActivationCodeActionState = { status: "idle" };

export function ActivationCodeControl({
  loginId,
  hasActivationCode,
}: {
  loginId: string;
  hasActivationCode: boolean;
}) {
  const [state, formAction, pending] = useActionState(generateActivationCodeAction, initialState);

  return (
    <div className="activation-code-panel">
      {hasActivationCode ? (
        <p className="muted" style={{ marginBottom: "1rem", fontSize: "0.9rem" }}>
          Siswa ini sudah memiliki kode aktivasi aktif di database. Jika siswa kehilangan slip atau kode lama kedaluwarsa, Anda dapat membuat ulang kode baru. <strong>Kode lama akan langsung tidak berlaku.</strong>
        </p>
      ) : (
        <p className="muted" style={{ marginBottom: "1rem", fontSize: "0.9rem" }}>
          Siswa ini belum memiliki kode aktivasi. Klik tombol di bawah untuk membuat kode satu kali pakai.
        </p>
      )}

      <form action={formAction}>
        <input type="hidden" name="login_id" value={loginId} />
        <button className="button button-primary" type="submit" disabled={pending}>
          {pending ? "Membuat…" : hasActivationCode ? "Buat Ulang Kode (Reset)" : "Buat Kode Aktivasi"}
        </button>
      </form>

      {state.status === "error" ? <p className="alert alert-error" role="alert">{state.message}</p> : null}
      {state.status === "revealed" ? (
        <section className="activation-code-reveal" aria-live="polite">
          <p className="eyebrow">Tampilkan satu kali</p>
          <p className="activation-code-value"><code>{state.code}</code></p>
          <p>
            Berlaku sampai <strong>{new Date(state.expiresAt).toLocaleString("id-ID")}</strong>.
            Salin atau cetak sekarang. Kode ini tidak dapat ditampilkan kembali setelah halaman dimuat ulang.
          </p>
        </section>
      ) : null}
    </div>
  );
}
