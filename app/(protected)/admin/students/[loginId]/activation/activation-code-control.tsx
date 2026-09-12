"use client";

import { useActionState, useRef, useState } from "react";
import { ConfirmDialog } from "@/components/confirm-dialog";
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
  const [showConfirm, setShowConfirm] = useState(false);
  const formRef = useRef<HTMLFormElement>(null);

  function handleButtonClick() {
    if (hasActivationCode) {
      setShowConfirm(true);
      return;
    }
    formRef.current?.requestSubmit();
  }

  function handleConfirm() {
    setShowConfirm(false);
    formRef.current?.requestSubmit();
  }

  return (
    <div className="activation-code-panel">
      {hasActivationCode ? (
        <p className="muted">
          Siswa ini sudah memiliki kode aktivasi aktif di database. Jika siswa kehilangan slip atau kode lama kedaluwarsa, Anda dapat membuat ulang kode baru. <strong>Kode lama akan langsung tidak berlaku.</strong>
        </p>
      ) : (
        <p className="muted">
          Siswa ini belum memiliki kode aktivasi. Klik tombol di bawah untuk membuat kode satu kali pakai.
        </p>
      )}

      <form ref={formRef} action={formAction}>
        <input type="hidden" name="login_id" value={loginId} />
        <button
          className="button button-primary"
          type="button"
          disabled={pending}
          onClick={handleButtonClick}
        >
          {pending ? "Membuat…" : hasActivationCode ? "Buat Ulang Kode (Reset)" : "Buat Kode Aktivasi"}
        </button>
      </form>

      {hasActivationCode && (
        <ConfirmDialog
          isOpen={showConfirm}
          title="Buat Ulang Kode Aktivasi?"
          description={
            <>
              <p>
                Siswa dengan ID <strong>{loginId}</strong> sudah memiliki kode aktivasi aktif.
              </p>
              <p style={{ marginTop: "0.5rem" }}>
                Kode lama yang belum dipakai akan langsung hangus dan tidak dapat digunakan lagi. Apakah Anda yakin ingin membuat ulang kode aktivasi?
              </p>
            </>
          }
          confirmLabel="Ya, Buat Ulang"
          cancelLabel="Batal"
          variant="danger"
          isPending={pending}
          onConfirm={handleConfirm}
          onCancel={() => setShowConfirm(false)}
        />
      )}

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
