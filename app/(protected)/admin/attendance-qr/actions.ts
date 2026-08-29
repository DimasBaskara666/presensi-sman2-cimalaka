"use server";

import { revalidatePath } from "next/cache";
import {
  loadSharedAttendanceQrSession,
  startSharedAttendanceQrSession,
  stopSharedAttendanceQrSession,
  type SharedQrSessionView,
} from "@/lib/attendance/shared-qr-session";
import { requireCurrentPerson } from "@/lib/auth/require-person";

export type AttendanceQrSessionActionResult = SharedQrSessionView;

function revalidateQrDisplays() {
  revalidatePath("/admin/attendance-qr");
  revalidatePath("/teacher/attendance-qr");
}

export async function startAttendanceQrSessionAction(): Promise<AttendanceQrSessionActionResult> {
  await requireCurrentPerson({ allowedRoles: ["admin", "teacher"] });
  const result = await startSharedAttendanceQrSession();
  if (result.ok) revalidateQrDisplays();
  return result;
}

export async function refreshAttendanceQrSessionAction(): Promise<AttendanceQrSessionActionResult> {
  await requireCurrentPerson({ allowedRoles: ["admin", "teacher"] });
  return loadSharedAttendanceQrSession();
}

export async function stopAttendanceQrSessionAction(): Promise<AttendanceQrSessionActionResult> {
  await requireCurrentPerson({ allowedRoles: ["admin", "teacher"] });
  const result = await stopSharedAttendanceQrSession();
  if (result.ok) revalidateQrDisplays();
  return result;
}
