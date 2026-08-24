import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { StudentImportError } from "./student-import";

export type StudentSummary = {
  loginId: string;
  fullName: string;
  className: string;
  idType: "NIS" | "NISN";
  isActive: boolean;
  isActivated: boolean;
  hasActivationCode: boolean;
};

export type StudentActivationSummary = StudentSummary;

export async function listStudents(): Promise<StudentSummary[]> {
  const admin = createAdminClient();
  const pageSize = 1000;
  const students: StudentSummary[] = [];
  for (let from = 0; ; from += pageSize) {
    const { data, error } = await admin
      .from("people")
      .select("login_id, full_name, class_name, nis, nisn, is_active, auth_user_id, claim_code_digest")
      .eq("role", "student")
      .order("login_id")
      .range(from, from + pageSize - 1);
    if (error || !data) throw new StudentImportError("student_list_failed");
    students.push(
      ...data.map((student) => ({
        loginId: student.login_id,
        fullName: student.full_name,
        className: student.class_name ?? "",
        idType: student.nis !== null ? ("NIS" as const) : ("NISN" as const),
        isActive: student.is_active,
        isActivated: student.auth_user_id !== null,
        hasActivationCode: student.claim_code_digest !== null,
      })),
    );
    if (data.length < pageSize) return students;
  }
}

export async function getStudentActivationSummary(
  submittedLoginId: string,
): Promise<StudentActivationSummary | null> {
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("people")
    .select("login_id, full_name, class_name, nis, nisn, is_active, auth_user_id, claim_code_digest")
    .eq("role", "student")
    .eq("login_id", submittedLoginId)
    .maybeSingle();
  if (error) throw new StudentImportError("student_list_failed");
  if (!data) return null;
  return {
    loginId: data.login_id,
    fullName: data.full_name,
    className: data.class_name ?? "",
    idType: data.nis !== null ? "NIS" : "NISN",
    isActive: data.is_active,
    isActivated: data.auth_user_id !== null,
    hasActivationCode: data.claim_code_digest !== null,
  };
}
