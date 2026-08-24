"use server";

import { revalidatePath } from "next/cache";
import { requireCurrentPerson } from "@/lib/auth/require-person";
import {
  inspectStudentWorkbook,
  parseStudentWorkbook,
  StudentWorkbookError,
  validateStudentWorkbookUpload,
} from "@/lib/students/excel-parser";
import {
  type StudentColumnMapping,
  type StudentImportPreview,
  type StudentImportSummary,
  type WorkbookInspection,
} from "@/lib/students/import-types";
import {
  analyzeStudentImport,
  importStudentRoster,
  StudentImportError,
} from "@/lib/students/student-import";

export type InspectionActionResult =
  | { ok: true; inspection: WorkbookInspection }
  | { ok: false; message: string };

export type PreviewActionResult =
  | { ok: true; preview: StudentImportPreview }
  | { ok: false; message: string };

export type ConfirmActionResult =
  | { ok: true; summary: StudentImportSummary }
  | { ok: false; message: string };

function safeMessage(error: unknown): string {
  if (error instanceof StudentWorkbookError) return error.message;
  if (error instanceof StudentImportError) {
    return "Student data could not be processed. No roster changes were made.";
  }
  return "The workbook could not be processed. No roster changes were made.";
}

function workbookFile(formData: FormData): File {
  const value = formData.get("workbook");
  if (!(value instanceof File) || value.size === 0) {
    throw new StudentWorkbookError("missing_file", "Choose an .xlsx workbook.");
  }
  validateStudentWorkbookUpload(value.name, value.size);
  return value;
}

async function workbookBuffer(formData: FormData): Promise<Buffer> {
  const file = workbookFile(formData);
  return Buffer.from(await file.arrayBuffer());
}

function mappingFrom(formData: FormData): StudentColumnMapping {
  const idType = String(formData.get("id_type") ?? "");
  if (idType !== "nis" && idType !== "nisn") {
    throw new StudentWorkbookError("invalid_id_type", "Choose whether the Student ID is NIS or NISN.");
  }
  return {
    idColumn: Number(formData.get("id_column")),
    fullNameColumn: Number(formData.get("full_name_column")),
    classColumn: Number(formData.get("class_column")),
    idType,
  };
}

export async function inspectStudentWorkbookAction(
  formData: FormData,
): Promise<InspectionActionResult> {
  await requireCurrentPerson({ allowedRoles: ["admin"] });
  try {
    const inspection = await inspectStudentWorkbook(await workbookBuffer(formData));
    return { ok: true, inspection };
  } catch (error) {
    return { ok: false, message: safeMessage(error) };
  }
}

export async function previewStudentImportAction(
  formData: FormData,
): Promise<PreviewActionResult> {
  await requireCurrentPerson({ allowedRoles: ["admin"] });
  try {
    const parsed = await parseStudentWorkbook(await workbookBuffer(formData), mappingFrom(formData));
    const preview = await analyzeStudentImport(
      parsed.inspection.fileHash,
      parsed.inspection.totalRows,
      parsed.rows,
      parsed.issues,
    );
    return { ok: true, preview };
  } catch (error) {
    return { ok: false, message: safeMessage(error) };
  }
}

export async function confirmStudentImportAction(
  formData: FormData,
): Promise<ConfirmActionResult> {
  await requireCurrentPerson({ allowedRoles: ["admin"] });
  try {
    const expectedHash = String(formData.get("expected_hash") ?? "");
    if (!/^[a-f0-9]{64}$/.test(expectedHash)) {
      throw new StudentWorkbookError("missing_preview", "Validate this workbook before importing it.");
    }
    const parsed = await parseStudentWorkbook(await workbookBuffer(formData), mappingFrom(formData));
    if (parsed.inspection.fileHash !== expectedHash) {
      throw new StudentWorkbookError(
        "workbook_changed",
        "The selected workbook changed after preview. Validate it again.",
      );
    }
    const preview = await analyzeStudentImport(
      parsed.inspection.fileHash,
      parsed.inspection.totalRows,
      parsed.rows,
      parsed.issues,
    );
    if (preview.issues.some((issue) => issue.severity === "error")) {
      throw new StudentWorkbookError(
        "validation_changed",
        "Blocking validation errors exist. No Student data was imported.",
      );
    }
    const summary = await importStudentRoster(parsed.rows);
    revalidatePath("/admin/students");
    return { ok: true, summary };
  } catch (error) {
    return { ok: false, message: safeMessage(error) };
  }
}
