import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import ExcelJS from "exceljs";
import {
  inspectStudentWorkbook,
  parseStudentWorkbook,
  StudentWorkbookError,
  validateStudentWorkbookUpload,
} from "../lib/students/excel-parser";
import {
  STUDENT_IMPORT_MAX_FILE_BYTES,
  STUDENT_IMPORT_MAX_ROWS,
  type StudentColumnMapping,
} from "../lib/students/import-types";
import {
  syntheticMultiSheetWorkbook,
  syntheticRows,
  syntheticStudentWorkbook,
} from "./fixtures/synthetic-student-workbooks";

const nisMapping: StudentColumnMapping = {
  idColumn: 2,
  fullNameColumn: 3,
  classColumn: 4,
  idType: "nis",
};

test("inspects arbitrary headers without assuming school column names", async () => {
  const workbook = await syntheticStudentWorkbook({
    headers: ["No", "Kode Sekolah", "Nama Peserta", "Rombel", "Catatan"],
    rows: [[1, "001234", "Synthetic Alpha", "X-SYN-1", "ignored"]],
  });
  const inspection = await inspectStudentWorkbook(workbook);
  assert.equal(inspection.totalRows, 1);
  assert.deepEqual(inspection.headers.map((header) => header.label), [
    "No", "Kode Sekolah", "Nama Peserta", "Rombel", "Catatan",
  ]);
});

test("maps NIS and preserves leading zeroes from text", async () => {
  const workbook = await syntheticStudentWorkbook({
    headers: ["No", "School ID", "Full Name", "Class"],
    rows: [[1, "001234", "Synthetic Alpha", "X-SYN-1"]],
  });
  const parsed = await parseStudentWorkbook(workbook, nisMapping);
  assert.equal(parsed.rows[0].loginId, "001234");
  assert.equal(parsed.rows[0].nis, "001234");
  assert.equal(parsed.rows[0].nisn, null);
});

test("maps NISN without populating NIS", async () => {
  const workbook = await syntheticStudentWorkbook({
    headers: ["ID", "Name", "Group"],
    rows: [["000567", "Synthetic Beta", "XI-SYN-2"]],
  });
  const parsed = await parseStudentWorkbook(workbook, {
    idColumn: 1,
    fullNameColumn: 2,
    classColumn: 3,
    idType: "nisn",
  });
  assert.equal(parsed.rows[0].loginId, "000567");
  assert.equal(parsed.rows[0].nis, null);
  assert.equal(parsed.rows[0].nisn, "000567");
});

test("reconstructs a numeric ID only when zero-padding is explicit", async () => {
  const workbook = await syntheticStudentWorkbook({
    headers: ["No", "ID", "Name", "Class"],
    rows: [[1, 1234, "Synthetic Gamma", "XII-SYN-3"]],
    numberFormats: [{ row: 2, column: 2, format: "000000" }],
  });
  const parsed = await parseStudentWorkbook(workbook, nisMapping);
  assert.equal(parsed.rows[0].loginId, "001234");
  assert.equal(parsed.issues.some((issue) => issue.severity === "error"), false);
});

test("rejects a plain numeric ID whose leading zeroes cannot be verified", async () => {
  const workbook = await syntheticStudentWorkbook({
    headers: ["No", "ID", "Name", "Class"],
    rows: [[1, 1234, "Synthetic Delta", "X-SYN-1"]],
  });
  const parsed = await parseStudentWorkbook(workbook, nisMapping);
  assert.equal(parsed.rows.length, 0);
  assert.ok(parsed.issues.some((issue) => issue.code === "unsafe_numeric_id"));
});

test("detects duplicate normalized IDs and missing required values", async () => {
  const workbook = await syntheticStudentWorkbook({
    headers: ["No", "ID", "Name", "Class"],
    rows: [
      [1, " syn001 ", "Synthetic One", "X-SYN-1"],
      [2, "SYN001", "Synthetic Duplicate", "X-SYN-1"],
      [3, "SYN003", "", "X-SYN-2"],
      [4, "", "Synthetic Missing ID", "X-SYN-2"],
      [5, "SYN005", "Synthetic Missing Class", ""],
    ],
  });
  const parsed = await parseStudentWorkbook(workbook, nisMapping);
  assert.ok(parsed.issues.some((issue) => issue.code === "duplicate_student_id"));
  assert.equal(
    parsed.issues.filter((issue) => issue.code === "missing_required_value").length,
    2,
  );
  assert.ok(parsed.issues.some((issue) => issue.code === "missing_student_id"));
});

test("warns about extra columns without rejecting the workbook", async () => {
  const workbook = await syntheticStudentWorkbook({
    headers: ["No", "ID", "Name", "Class", "Extra"],
    rows: [[1, "SYN001", "Synthetic One", "X-SYN-1", "ignored"]],
  });
  const parsed = await parseStudentWorkbook(workbook, nisMapping);
  assert.ok(parsed.issues.some((issue) => issue.code === "extra_column"));
  assert.equal(parsed.issues.some((issue) => issue.severity === "error"), false);
});

test("rejects formula values in required fields", async () => {
  const workbook = await syntheticStudentWorkbook({
    headers: ["No", "ID", "Name", "Class"],
    rows: [[1, { formula: "1+1", result: "SYN002" }, "Synthetic Formula", "X-SYN-1"]],
  });
  const parsed = await parseStudentWorkbook(workbook, nisMapping);
  assert.equal(parsed.rows.length, 0);
  assert.ok(parsed.issues.some((issue) => issue.code === "formula_value"));
});

test("rejects duplicate column mapping", async () => {
  const workbook = await syntheticStudentWorkbook({
    headers: ["ID", "Name", "Class"],
    rows: [["SYN001", "Synthetic One", "X-SYN-1"]],
  });
  await assert.rejects(
    parseStudentWorkbook(workbook, {
      idColumn: 1,
      fullNameColumn: 1,
      classColumn: 3,
      idType: "nis",
    }),
    (error: unknown) => error instanceof StudentWorkbookError && error.code === "duplicate_mapping",
  );
});

test("accepts multiple supported worksheets and processes KELAS 10, KELAS 11, and KELAS 12", async () => {
  const multiWorkbook = await syntheticMultiSheetWorkbook([
    {
      name: "KELAS 10",
      classHeader: "KELAS : 10.1",
      headers: ["No", "NIS", "NAMA LENGKAP", "L/P", "1", "2", "3"],
      rows: [
        [1, "001001", "Student Ten One", "L", "H", "H", "H"],
        [2, "001002", "Student Ten Two", "P", "H", "S", "H"],
      ],
    },
    {
      name: "KELAS 11",
      classHeader: "KELAS : 11.1",
      headers: ["No", "NIS", "NAMA LENGKAP", "L/P", "1", "2", "3"],
      rows: [
        [1, "001101", "Student Eleven One", "L", "H", "H", "H"],
      ],
    },
    {
      name: "KELAS 12",
      classHeader: "KELAS : 12.1",
      headers: ["No", "NIS", "NAMA LENGKAP", "L/P", "1", "2", "3"],
      rows: [
        [1, "001201", "Student Twelve One", "P", "H", "H", "H"],
        [2, "001202", "Student Twelve Two", "L", "H", "A", "H"],
      ],
    },
  ]);

  const inspection = await inspectStudentWorkbook(multiWorkbook);
  assert.equal(inspection.totalRows, 5);
  assert.equal(inspection.worksheets?.length, 3);
  assert.deepEqual(
    inspection.worksheets?.map((ws) => ({ name: ws.name, className: ws.className, totalRows: ws.totalRows })),
    [
      { name: "KELAS 10", className: "10.1", totalRows: 2 },
      { name: "KELAS 11", className: "11.1", totalRows: 1 },
      { name: "KELAS 12", className: "12.1", totalRows: 2 },
    ],
  );

  const parsed = await parseStudentWorkbook(multiWorkbook, {
    idColumn: 2,
    fullNameColumn: 3,
    idType: "nis",
  });

  assert.equal(parsed.rows.length, 5);
  assert.deepEqual(parsed.rows.map((r) => ({ loginId: r.loginId, fullName: r.fullName, className: r.className })), [
    { loginId: "001001", fullName: "Student Ten One", className: "10.1" },
    { loginId: "001002", fullName: "Student Ten Two", className: "10.1" },
    { loginId: "001101", fullName: "Student Eleven One", className: "11.1" },
    { loginId: "001201", fullName: "Student Twelve One", className: "12.1" },
    { loginId: "001202", fullName: "Student Twelve Two", className: "12.1" },
  ]);

  // Attendance and row numbering columns are ignored as warnings
  const extraWarnings = parsed.issues.filter((i) => i.code === "extra_column");
  assert.ok(extraWarnings.length > 0);
  assert.equal(parsed.issues.some((i) => i.severity === "error"), false);
});

test("associates students with nearest class section within multi-section worksheet", async () => {
  const multiSectionWorkbook = await syntheticMultiSheetWorkbook([
    {
      name: "KELAS 12",
      classHeader: "KELAS : 12.1",
      headers: ["No", "NIS", "NAMA LENGKAP", "L/P", "1", "2"],
      rows: [
        [1, "001211", "Student Section One", "L", "H", "H"],
      ],
      subsections: [
        {
          classHeader: "KELAS : 12.2",
          headers: ["No", "NIS", "NAMA LENGKAP", "L/P", "1", "2"],
          rows: [
            [1, "001221", "Student Section Two", "P", "H", "H"],
          ],
        },
      ],
    },
  ]);

  const parsed = await parseStudentWorkbook(multiSectionWorkbook, {
    idColumn: 2,
    fullNameColumn: 3,
    idType: "nis",
  });

  assert.equal(parsed.rows.length, 2);
  assert.equal(parsed.rows[0].className, "12.1");
  assert.equal(parsed.rows[0].loginId, "001211");
  assert.equal(parsed.rows[1].className, "12.2");
  assert.equal(parsed.rows[1].loginId, "001221");
});

test("rejects duplicate student IDs across different worksheets", async () => {
  const duplicateWorkbook = await syntheticMultiSheetWorkbook([
    {
      name: "KELAS 10",
      classHeader: "KELAS : 10.1",
      rows: [[1, "009999", "Student Duplicate One", "L"]],
    },
    {
      name: "KELAS 11",
      classHeader: "KELAS : 11.1",
      rows: [[1, "009999", "Student Duplicate Two", "P"]],
    },
  ]);

  const parsed = await parseStudentWorkbook(duplicateWorkbook, {
    idColumn: 2,
    fullNameColumn: 3,
    idType: "nis",
  });

  assert.ok(
    parsed.issues.some((i) => i.code === "duplicate_student_id" && i.loginId === "009999"),
  );
});

test("rejects missing class information when worksheet has no class header and no class column", async () => {
  const noClassWorkbook = await syntheticMultiSheetWorkbook([
    {
      name: "KELAS NO HEADER",
      headers: ["No", "NIS", "NAMA LENGKAP", "L/P"],
      rows: [[1, "001001", "Student No Class", "L"]],
    },
  ]);

  const parsed = await parseStudentWorkbook(noClassWorkbook, {
    idColumn: 2,
    fullNameColumn: 3,
    idType: "nis",
  });

  assert.ok(
    parsed.issues.some((i) => i.code === "missing_class"),
  );
});

test("rejects invalid worksheet with clear error identifying the worksheet", async () => {
  const invalidWorkbook = await syntheticStudentWorkbook({
    headers: ["ID", "Name", "Class"],
    rows: [["SYN001", "Synthetic One", "X-SYN-1"]],
    addSecondWorksheet: true,
  });

  await assert.rejects(
    inspectStudentWorkbook(invalidWorkbook),
    (error: unknown) =>
      error instanceof StudentWorkbookError &&
      error.code === "invalid_worksheet" &&
      error.message.includes("Unexpected Sheet"),
  );
});

test("enforces extension, file-size, and total row limits across all worksheets", async () => {
  assert.throws(
    () => validateStudentWorkbookUpload("students.xls", 100),
    (error: unknown) => error instanceof StudentWorkbookError && error.code === "invalid_extension",
  );
  assert.throws(
    () => validateStudentWorkbookUpload("students.xlsx", STUDENT_IMPORT_MAX_FILE_BYTES + 1),
    (error: unknown) => error instanceof StudentWorkbookError && error.code === "file_limit",
  );

  const rowLimitWorkbook = await syntheticMultiSheetWorkbook([
    {
      name: "KELAS 10",
      classHeader: "KELAS : 10.1",
      rows: syntheticRows(STUDENT_IMPORT_MAX_ROWS - 500).map((r, i) => [i + 1, r[0], r[1], "L"]),
    },
    {
      name: "KELAS 11",
      classHeader: "KELAS : 11.1",
      rows: syntheticRows(501).map((r, i) => [i + 1, `B${r[0]}`, r[1], "P"]),
    },
  ]);

  await assert.rejects(
    inspectStudentWorkbook(rowLimitWorkbook),
    (error: unknown) => error instanceof StudentWorkbookError && error.code === "row_limit",
  );
});

test("rejects malformed workbook bytes", async () => {
  await assert.rejects(
    inspectStudentWorkbook(Buffer.from("synthetic but not an xlsx workbook")),
    (error: unknown) => error instanceof StudentWorkbookError && error.code === "invalid_workbook",
  );
});

test("Student import remains Admin-only, server-only, and Auth-link preserving", async () => {
  const actions = await readFile(
    new URL("../app/(protected)/admin/students/import/actions.ts", import.meta.url),
    "utf8",
  );
  const workflow = await readFile(
    new URL("../app/(protected)/admin/students/import/import-workflow.tsx", import.meta.url),
    "utf8",
  );
  const service = await readFile(new URL("../lib/students/student-import.ts", import.meta.url), "utf8");
  const migration = await readFile(
    new URL("../supabase/migrations/20260825000000_student_import.sql", import.meta.url),
    "utf8",
  );
  assert.equal((actions.match(/requireCurrentPerson\(\{ allowedRoles: \["admin"\] \}\)/g) ?? []).length, 3);
  assert.match(service, /^import "server-only";/);
  assert.doesNotMatch(workflow, /exceljs|SUPABASE_SERVICE_ROLE_KEY|auth_user_id|claim_code_digest/);
  assert.doesNotMatch(service, /createUser|updateUserById|password|deleteUser/);
  assert.match(migration, /update public\.people as p[\s\S]*full_name[\s\S]*class_name/);
  assert.doesNotMatch(
    migration.match(/update public\.people as p[\s\S]*?;/)?.[0] ?? "",
    /auth_user_id|claimed_at|claim_code_digest|is_active/,
  );
  assert.match(migration, /revoke all on function public\.import_student_roster\(jsonb\) from authenticated/);
  assert.doesNotMatch(migration, /and role = 'student'/);
});

test("ExcelJS is imported only by server-reached parser and synthetic tests", async () => {
  const clientSource = await readFile(
    new URL("../app/(protected)/admin/students/import/import-workflow.tsx", import.meta.url),
    "utf8",
  );
  const parserSource = await readFile(
    new URL("../lib/students/excel-parser.ts", import.meta.url),
    "utf8",
  );
  assert.doesNotMatch(clientSource, /from "exceljs"/);
  assert.match(parserSource, /from "exceljs"/);
  assert.match(parserSource, /node:crypto/);
  assert.equal(ExcelJS.ValueType.Formula > 0, true);
});
