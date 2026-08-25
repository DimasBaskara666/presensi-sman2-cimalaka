import "server-only";
import { normalizeLoginId } from "@/lib/auth/login-id";
import { evaluateStudentPassword } from "@/lib/auth/password-policy";
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

export type StudentAdministrationErrorCode =
  | "invalid_password"
  | "student_lookup_failed"
  | "student_not_found"
  | "student_not_activated"
  | "student_status_failed"
  | "password_reset_failed";

export class StudentAdministrationError extends Error {
  constructor(readonly code: StudentAdministrationErrorCode) {
    super(`Student administration failed (${code}).`);
    this.name = "StudentAdministrationError";
  }
}

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

export async function setStudentActive(
  submittedLoginId: string,
  isActive: boolean,
): Promise<void> {
  const loginId = normalizeLoginId(submittedLoginId);
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("people")
    .update({ is_active: isActive })
    .eq("login_id", loginId)
    .eq("role", "student")
    .select("id")
    .maybeSingle();
  if (error) throw new StudentAdministrationError("student_status_failed");
  if (!data) throw new StudentAdministrationError("student_not_found");
}

export async function resetStudentPassword(
  submittedLoginId: string,
  password: string,
): Promise<void> {
  const loginId = normalizeLoginId(submittedLoginId);
  if (evaluateStudentPassword(password, loginId) !== "valid") {
    throw new StudentAdministrationError("invalid_password");
  }

  const admin = createAdminClient();
  const { data: student, error: lookupError } = await admin
    .from("people")
    .select("auth_user_id, role")
    .eq("login_id", loginId)
    .eq("role", "student")
    .maybeSingle();
  if (lookupError) throw new StudentAdministrationError("student_lookup_failed");
  if (!student) throw new StudentAdministrationError("student_not_found");
  if (!student.auth_user_id || student.role !== "student") {
    throw new StudentAdministrationError("student_not_activated");
  }

  const { error } = await admin.auth.admin.updateUserById(student.auth_user_id, {
    password,
  });
  if (error) throw new StudentAdministrationError("password_reset_failed");
}
