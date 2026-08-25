"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireCurrentPerson } from "@/lib/auth/require-person";
import {
  isAttendanceRecordId,
  parseAttendanceCorrectionMutation,
} from "@/lib/attendance/admin-operations-model";
import { createClient } from "@/lib/supabase/server";

function correctionUrl(recordId: string, date: string, value: string): string {
  const params = new URLSearchParams({ date, record: recordId });
  const [name, content] = value.split("=");
  params.set(name, content);
  return `/admin/attendance-corrections?${params.toString()}`;
}

export async function correctAttendanceAction(formData: FormData) {
  await requireCurrentPerson({ allowedRoles: ["admin"] });
  const recordId = String(formData.get("record_id") ?? "").trim();
  if (!isAttendanceRecordId(recordId)) {
    redirect("/admin/attendance-corrections?error=invalid_record");
  }

  const supabase = await createClient();
  const existing = await supabase
    .from("attendance_daily")
    .select("id, student_id, attendance_date")
    .eq("id", recordId)
    .maybeSingle();
  if (existing.error || !existing.data) {
    redirect("/admin/attendance-corrections?error=record_not_found");
  }

  const parsed = parseAttendanceCorrectionMutation({
    recordId: existing.data.id,
    attendanceDate: existing.data.attendance_date,
    mode: formData.get("mode"),
    checkInTime: formData.get("check_in_time"),
    checkOutTime: formData.get("check_out_time"),
    absenceCategory: formData.get("absence_category"),
    absenceNote: formData.get("absence_note"),
    reason: formData.get("reason"),
  });
  if (!parsed.ok) {
    redirect(correctionUrl(recordId, existing.data.attendance_date, "error=invalid_correction"));
  }

  const value = parsed.value;
  const { data, error } = await supabase.rpc("correct_attendance", {
    p_student_id: existing.data.student_id,
    p_attendance_date: existing.data.attendance_date,
    p_check_in_at: value.checkInAt,
    p_check_out_at: value.checkOutAt,
    p_absence_category: value.absenceCategory,
    p_absence_note: value.absenceNote,
    p_reason: value.reason,
  });
  if (error || data !== recordId) {
    redirect(correctionUrl(recordId, existing.data.attendance_date, "error=correction_rejected"));
  }

  revalidatePath("/admin/attendance-corrections");
  revalidatePath("/attendance/history");
  redirect(correctionUrl(recordId, existing.data.attendance_date, "status=corrected"));
}
