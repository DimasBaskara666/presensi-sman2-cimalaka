"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireCurrentPerson } from "@/lib/auth/require-person";
import { parseAttendanceSettingsMutation } from "@/lib/attendance/admin-operations-model";
import { createClient } from "@/lib/supabase/server";

export async function updateAttendanceSettingsAction(formData: FormData) {
  await requireCurrentPerson({ allowedRoles: ["admin"] });

  const parsed = parseAttendanceSettingsMutation({
    officialStartTime: formData.get("official_start_time"),
    lateToleranceMinutes: formData.get("late_tolerance_minutes"),
    mondayThursdayCheckoutMinimum: formData.get("monday_thursday_checkout_minimum"),
    fridayCheckoutMinimum: formData.get("friday_checkout_minimum"),
  });
  if (!parsed.ok) redirect("/admin/attendance-settings?error=invalid_settings");

  const supabase = await createClient();
  const current = await supabase
    .from("attendance_settings")
    .select("timezone, late_attendance_allowed")
    .eq("id", 1)
    .single();
  if (current.error || !current.data) {
    redirect("/admin/attendance-settings?error=load_failed");
  }

  const value = parsed.value;
  const { data, error } = await supabase.rpc("update_attendance_schedule", {
    p_timezone: current.data.timezone,
    p_official_start_time: value.officialStartTime,
    p_on_time_cutoff: value.onTimeCutoff,
    p_late_attendance_allowed: current.data.late_attendance_allowed,
    p_monday_checkout_minimum: value.mondayThursdayCheckoutMinimum,
    p_tuesday_checkout_minimum: value.mondayThursdayCheckoutMinimum,
    p_wednesday_checkout_minimum: value.mondayThursdayCheckoutMinimum,
    p_thursday_checkout_minimum: value.mondayThursdayCheckoutMinimum,
    p_friday_checkout_minimum: value.fridayCheckoutMinimum,
  });
  if (error || data !== true) {
    redirect("/admin/attendance-settings?error=update_rejected");
  }

  revalidatePath("/admin/attendance-settings");
  redirect("/admin/attendance-settings?status=updated");
}
