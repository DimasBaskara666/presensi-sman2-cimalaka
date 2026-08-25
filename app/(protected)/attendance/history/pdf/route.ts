import { getCurrentPerson } from "@/lib/auth/current-person";
import { getSchoolDate } from "@/lib/attendance/teacher-attendance-model";
import { parseAttendanceHistoryFilter } from "@/lib/attendance/history-model";
import {
  AttendanceHistoryDataError,
  AttendanceReportTooLargeError,
  loadAttendanceReportRows,
} from "@/lib/attendance/history-query";
import { generateAttendanceHistoryPdf } from "@/lib/attendance/history-pdf";
import { createClient } from "@/lib/supabase/server";

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
  if (!person) return textResponse("Silakan masuk untuk mengunduh laporan.", 401);

  const url = new URL(request.url);
  const parsed = parseAttendanceHistoryFilter({
    start: url.searchParams.get("start") ?? undefined,
    end: url.searchParams.get("end") ?? undefined,
    className: url.searchParams.get("class") ?? undefined,
  }, getSchoolDate());
  if (!parsed.ok) return textResponse(parsed.error, 400);

  try {
    const supabase = await createClient();
    const rows = await loadAttendanceReportRows(supabase, person, parsed.filter);
    const pdf = await generateAttendanceHistoryPdf({
      rows,
      filter: parsed.filter,
      generatedAt: new Date(),
      viewerRole: person.role,
    });
    const fileName = `laporan-presensi-${parsed.filter.startDate}-${parsed.filter.endDate}.pdf`;
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
  } catch (error) {
    if (error instanceof AttendanceReportTooLargeError) {
      return textResponse(
        `Laporan berisi ${error.total} baris. Pilih kelas atau rentang tanggal yang lebih pendek.`,
        422,
      );
    }
    if (error instanceof AttendanceHistoryDataError) {
      return textResponse("Data laporan tidak dapat dimuat.", 500);
    }
    return textResponse("PDF tidak dapat dibuat.", 500);
  }
}

