import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import type {
  ParsedStudentRow,
  StudentImportIssue,
  StudentImportPreview,
  StudentImportSummary,
  StudentPreviewRow,
} from "./import-types";

type ExistingPerson = {
  login_id: string;
  full_name: string;
  role: "admin" | "teacher" | "student";
  nis: string | null;
  nisn: string | null;
  class_name: string | null;
  is_active: boolean;
  auth_user_id: string | null;
};

export class StudentImportError extends Error {
  constructor(readonly code: string) {
    super(`Student import failed (${code}).`);
    this.name = "StudentImportError";
  }
}

async function loadAllPeople(): Promise<ExistingPerson[]> {
  const admin = createAdminClient();
  const pageSize = 1000;
  const people: ExistingPerson[] = [];
  for (let from = 0; ; from += pageSize) {
    const { data, error } = await admin
      .from("people")
      .select("login_id, full_name, role, nis, nisn, class_name, is_active, auth_user_id")
      .order("login_id")
      .range(from, from + pageSize - 1);
    if (error || !data) throw new StudentImportError("people_lookup_failed");
    people.push(...(data as ExistingPerson[]));
    if (data.length < pageSize) return people;
  }
}

function identityMatches(person: ExistingPerson, row: ParsedStudentRow): boolean {
  if (row.nis !== null) return person.nis === row.nis;
  return person.nisn === row.nisn;
}

export async function analyzeStudentImport(
  fileHash: string,
  totalRows: number,
  rows: ParsedStudentRow[],
  parserIssues: StudentImportIssue[],
): Promise<StudentImportPreview> {
  const people = await loadAllPeople();
  const byLoginId = new Map(people.map((person) => [person.login_id, person]));
  const byNis = new Map(
    people.filter((person) => person.nis !== null).map((person) => [person.nis as string, person]),
  );
  const byNisn = new Map(
    people.filter((person) => person.nisn !== null).map((person) => [person.nisn as string, person]),
  );
  const issues = [...parserIssues];
  const previewRows: StudentPreviewRow[] = [];

  for (const row of rows) {
    const existing = byLoginId.get(row.loginId);
    const identityOwner = row.nis !== null ? byNis.get(row.nis) : byNisn.get(row.nisn as string);

    if (identityOwner && identityOwner.login_id !== row.loginId) {
      issues.push({
        severity: "error",
        code: "school_id_conflict",
        rowNumber: row.rowNumber,
        loginId: row.loginId,
        message: "This NIS/NISN is already linked to another person.",
      });
    }

    if (existing && existing.role !== "student") {
      issues.push({
        severity: "error",
        code: "non_student_login_conflict",
        rowNumber: row.rowNumber,
        loginId: row.loginId,
        message: "Student ID conflicts with an existing Admin or Teacher login.",
      });
    }

    if (existing?.role === "student" && !identityMatches(existing, row)) {
      issues.push({
        severity: "error",
        code: "student_identity_type_conflict",
        rowNumber: row.rowNumber,
        loginId: row.loginId,
        message: "Existing Student identity type or value does not match this import.",
      });
    }

    let action: StudentPreviewRow["action"] = "insert";
    if (existing?.role === "student") {
      action =
        existing.full_name === row.fullName && existing.class_name === row.className
          ? "unchanged"
          : "update";
      if (action === "update") {
        issues.push({
          severity: "warning",
          code: "existing_student_update",
          rowNumber: row.rowNumber,
          loginId: row.loginId,
          message: "Existing Student name or class will be updated.",
        });
      }
    }

    previewRows.push({
      ...row,
      action,
      isActive: existing?.role === "student" ? existing.is_active : true,
      isActivated: existing?.role === "student" ? Boolean(existing.auth_user_id) : false,
    });
  }

  const importedIds = new Set(rows.map((row) => row.loginId));
  for (const person of people) {
    if (person.role === "student" && !importedIds.has(person.login_id)) {
      issues.push({
        severity: "warning",
        code: "existing_student_missing",
        loginId: person.login_id,
        message: "Existing Student is absent from this workbook and will remain unchanged.",
      });
    }
  }

  return {
    fileHash,
    totalRows,
    insertedCount: previewRows.filter((row) => row.action === "insert").length,
    updatedCount: previewRows.filter((row) => row.action === "update").length,
    unchangedCount: previewRows.filter((row) => row.action === "unchanged").length,
    rows: previewRows,
    issues,
  };
}

export async function importStudentRoster(
  rows: ParsedStudentRow[],
): Promise<StudentImportSummary> {
  const admin = createAdminClient();
  const payload = rows.map(({ loginId, fullName, className, nis, nisn }) => ({
    login_id: loginId,
    full_name: fullName,
    class_name: className,
    nis,
    nisn,
  }));
  const { data, error } = await admin.rpc("import_student_roster", {
    p_students: payload,
  });
  if (error || !Array.isArray(data) || data.length !== 1) {
    throw new StudentImportError("transaction_failed");
  }
  const result = data[0] as Record<string, unknown>;
  if (
    typeof result.inserted_count !== "number" ||
    typeof result.updated_count !== "number" ||
    typeof result.unchanged_count !== "number"
  ) {
    throw new StudentImportError("invalid_transaction_result");
  }
  return {
    insertedCount: result.inserted_count,
    updatedCount: result.updated_count,
    unchangedCount: result.unchanged_count,
  };
}

