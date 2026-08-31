import { getCurrentPerson } from "@/lib/auth/current-person";
import {
  prepareBulkStudentActivations,
} from "@/lib/students/student-activation-bulk";
import {
  generateStudentActivationPdf,
} from "@/lib/students/student-activation-pdf";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

function textResponse(message: string, status: number): Response {
  return new Response(message, {
    status,
    headers: { "Content-Type": "text/plain; charset=utf-8", "Cache-Control": "no-store" },
  });
}

export async function GET(request: Request): Promise<Response> {
  const person = await getCurrentPerson();
  if (!person || person.role !== "admin") {
    return textResponse("Akses ditolak. Hanya Administrator yang dapat mengunduh slip aktivasi.", 403);
  }

  const url = new URL(request.url);
  const rawClass = url.searchParams.get("class")?.trim() || undefined;
  const mode = url.searchParams.get("mode")?.trim() || "missing";
  const regenerateAll = mode === "all";

  try {
    const slips = await prepareBulkStudentActivations({
      className: rawClass,
      regenerateAll,
    });

    const appOrigin = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
    const activationUrl = `${appOrigin.replace(/\/$/, "")}/activate`;

    const pdf = await generateStudentActivationPdf({
      slips,
      activationUrl,
      generatedAt: new Date(),
      filteredClass: rawClass,
    });

    const safeClassPart = rawClass ? `kelas-${rawClass.replace(/[^a-zA-Z0-9.-]/g, "_")}` : "semua-kelas";
    const fileName = `slip-aktivasi-siswa-${safeClassPart}.pdf`;

    return new Response(new Uint8Array(pdf), {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="${fileName}"`,
        "Content-Length": String(pdf.length),
        "Cache-Control": "private, no-store, max-age=0",
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch {
    return textResponse("Gagal membuat slip aktivasi siswa. Silakan coba kembali.", 500);
  }
}
