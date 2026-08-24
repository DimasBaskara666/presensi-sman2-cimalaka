import { createHash } from "node:crypto";
import ExcelJS from "exceljs";
import { normalizeLoginId } from "@/lib/auth/login-id";
import {
  STUDENT_IMPORT_MAX_FILE_BYTES,
  STUDENT_IMPORT_MAX_ROWS,
  type ParsedStudentRow,
  type StudentColumnMapping,
  type StudentImportIssue,
  type WorkbookHeader,
  type WorkbookInspection,
} from "./import-types";

export type ParsedWorkbook = {
  inspection: WorkbookInspection;
  rows: ParsedStudentRow[];
  issues: StudentImportIssue[];
};

export class StudentWorkbookError extends Error {
  constructor(readonly code: string, message: string) {
    super(message);
    this.name = "StudentWorkbookError";
  }
}

export function validateStudentWorkbookUpload(fileName: string, fileSize: number): void {
  if (!fileName.toLowerCase().endsWith(".xlsx")) {
    throw new StudentWorkbookError("invalid_extension", "Only .xlsx workbooks are supported.");
  }
  if (!Number.isFinite(fileSize) || fileSize <= 0) {
    throw new StudentWorkbookError("missing_file", "Choose an .xlsx workbook.");
  }
  if (fileSize > STUDENT_IMPORT_MAX_FILE_BYTES) {
    throw new StudentWorkbookError("file_limit", "The workbook exceeds the 5 MB file limit.");
  }
}

function hasCellValue(cell: ExcelJS.Cell): boolean {
  return cell.value !== null && cell.value !== undefined && cell.text.trim() !== "";
}

function isMeaningfulRow(row: ExcelJS.Row): boolean {
  let meaningful = false;
  row.eachCell({ includeEmpty: false }, (cell) => {
    if (hasCellValue(cell)) meaningful = true;
  });
  return meaningful;
}

function isFormulaCell(cell: ExcelJS.Cell): boolean {
  if (cell.type === ExcelJS.ValueType.Formula) return true;
  return typeof cell.value === "object" && cell.value !== null && "formula" in cell.value;
}

function headerText(cell: ExcelJS.Cell, column: number): string {
  if (isFormulaCell(cell)) {
    throw new StudentWorkbookError(
      "formula_header",
      `Header column ${column} cannot contain a formula.`,
    );
  }
  const label = cell.text.trim();
  return label || `Column ${column}`;
}

function findHeaderRow(worksheet: ExcelJS.Worksheet): ExcelJS.Row {
  for (let rowNumber = 1; rowNumber <= worksheet.rowCount; rowNumber += 1) {
    const row = worksheet.getRow(rowNumber);
    if (isMeaningfulRow(row)) return row;
  }
  throw new StudentWorkbookError("no_header", "The worksheet does not contain a header row.");
}

function meaningfulDataRows(worksheet: ExcelJS.Worksheet, headerRowNumber: number): ExcelJS.Row[] {
  const rows: ExcelJS.Row[] = [];
  for (let rowNumber = headerRowNumber + 1; rowNumber <= worksheet.rowCount; rowNumber += 1) {
    const row = worksheet.getRow(rowNumber);
    if (!isMeaningfulRow(row)) continue;
    rows.push(row);
    if (rows.length > STUDENT_IMPORT_MAX_ROWS) {
      throw new StudentWorkbookError(
        "row_limit",
        `The workbook exceeds the ${STUDENT_IMPORT_MAX_ROWS}-row limit.`,
      );
    }
  }
  return rows;
}

async function loadWorkbook(buffer: Buffer): Promise<{
  workbook: ExcelJS.Workbook;
  worksheet: ExcelJS.Worksheet;
  headerRow: ExcelJS.Row;
  dataRows: ExcelJS.Row[];
}> {
  const workbook = new ExcelJS.Workbook();
  try {
    await workbook.xlsx.load(buffer as unknown as ExcelJS.Buffer);
  } catch {
    throw new StudentWorkbookError("invalid_workbook", "The file is not a readable .xlsx workbook.");
  }

  if (workbook.worksheets.length === 0) {
    throw new StudentWorkbookError("no_worksheet", "The workbook does not contain a worksheet.");
  }
  if (workbook.worksheets.length !== 1) {
    throw new StudentWorkbookError("worksheet_limit", "The workbook must contain exactly one worksheet.");
  }

  const worksheet = workbook.worksheets[0];
  const headerRow = findHeaderRow(worksheet);
  const dataRows = meaningfulDataRows(worksheet, headerRow.number);
  if (dataRows.length === 0) {
    throw new StudentWorkbookError("no_students", "The worksheet does not contain Student rows.");
  }
  return { workbook, worksheet, headerRow, dataRows };
}

function worksheetHeaders(headerRow: ExcelJS.Row): WorkbookHeader[] {
  const headers: WorkbookHeader[] = [];
  for (let column = 1; column <= headerRow.cellCount; column += 1) {
    const cell = headerRow.getCell(column);
    if (!hasCellValue(cell)) continue;
    headers.push({ column, label: headerText(cell, column) });
  }
  if (headers.length === 0) {
    throw new StudentWorkbookError("no_headers", "No usable columns were found.");
  }
  return headers;
}

function fileHash(buffer: Buffer): string {
  return createHash("sha256").update(buffer).digest("hex");
}

export async function inspectStudentWorkbook(buffer: Buffer): Promise<WorkbookInspection> {
  const { headerRow, dataRows } = await loadWorkbook(buffer);
  return {
    fileHash: fileHash(buffer),
    headers: worksheetHeaders(headerRow),
    totalRows: dataRows.length,
  };
}

function requiredText(
  cell: ExcelJS.Cell,
  fieldName: string,
  rowNumber: number,
  issues: StudentImportIssue[],
): string | null {
  if (isFormulaCell(cell)) {
    issues.push({
      severity: "error",
      code: "formula_value",
      rowNumber,
      message: `${fieldName} cannot contain a formula.`,
    });
    return null;
  }
  const value = cell.text.trim();
  if (!value) {
    issues.push({
      severity: "error",
      code: "missing_required_value",
      rowNumber,
      message: `${fieldName} is required.`,
    });
    return null;
  }
  return value;
}

function studentIdText(
  cell: ExcelJS.Cell,
  rowNumber: number,
  issues: StudentImportIssue[],
): string | null {
  if (isFormulaCell(cell)) {
    issues.push({
      severity: "error",
      code: "formula_value",
      rowNumber,
      message: "Student ID cannot contain a formula.",
    });
    return null;
  }

  if (typeof cell.value === "number") {
    if (!Number.isSafeInteger(cell.value) || cell.value < 0) {
      issues.push({
        severity: "error",
        code: "unsafe_numeric_id",
        rowNumber,
        message: "Student ID must be stored as Text in Excel.",
      });
      return null;
    }
    const numberFormat = (cell.numFmt ?? "").trim().split(";")[0];
    if (!/^0+$/.test(numberFormat)) {
      issues.push({
        severity: "error",
        code: "unsafe_numeric_id",
        rowNumber,
        message: "Numeric Student ID has no recoverable zero-padding; format the column as Text.",
      });
      return null;
    }
    return String(cell.value).padStart(numberFormat.length, "0");
  }

  const value = cell.text.trim();
  if (!value) {
    issues.push({
      severity: "error",
      code: "missing_student_id",
      rowNumber,
      message: "Student ID is required.",
    });
    return null;
  }
  return value;
}

function validateMapping(headers: WorkbookHeader[], mapping: StudentColumnMapping): void {
  const selected = [mapping.idColumn, mapping.fullNameColumn, mapping.classColumn];
  if (selected.some((column) => !Number.isInteger(column) || column < 1)) {
    throw new StudentWorkbookError("invalid_mapping", "All required columns must be selected.");
  }
  if (new Set(selected).size !== selected.length) {
    throw new StudentWorkbookError("duplicate_mapping", "Each required field must use a different column.");
  }
  const available = new Set(headers.map((header) => header.column));
  if (selected.some((column) => !available.has(column))) {
    throw new StudentWorkbookError("missing_mapped_column", "A selected column is not present in the workbook.");
  }
  if (mapping.idType !== "nis" && mapping.idType !== "nisn") {
    throw new StudentWorkbookError("invalid_id_type", "Choose NIS or NISN.");
  }
}

export async function parseStudentWorkbook(
  buffer: Buffer,
  mapping: StudentColumnMapping,
): Promise<ParsedWorkbook> {
  const { headerRow, dataRows } = await loadWorkbook(buffer);
  const headers = worksheetHeaders(headerRow);
  validateMapping(headers, mapping);

  const issues: StudentImportIssue[] = [];
  const selectedColumns = new Set([mapping.idColumn, mapping.fullNameColumn, mapping.classColumn]);
  for (const header of headers) {
    if (!selectedColumns.has(header.column)) {
      issues.push({
        severity: "warning",
        code: "extra_column",
        message: `Extra column “${header.label}” will be ignored.`,
      });
    }
  }

  const rows: ParsedStudentRow[] = [];
  for (const row of dataRows) {
    const idSource = studentIdText(row.getCell(mapping.idColumn), row.number, issues);
    const fullName = requiredText(
      row.getCell(mapping.fullNameColumn),
      "Full Name",
      row.number,
      issues,
    );
    const className = requiredText(
      row.getCell(mapping.classColumn),
      "Class",
      row.number,
      issues,
    );
    if (!idSource || !fullName || !className) continue;

    let loginId: string;
    try {
      loginId = normalizeLoginId(idSource);
    } catch {
      issues.push({
        severity: "error",
        code: "invalid_student_id",
        rowNumber: row.number,
        message: "Student ID contains unsupported characters.",
      });
      continue;
    }

    rows.push({
      rowNumber: row.number,
      loginId,
      fullName,
      className,
      nis: mapping.idType === "nis" ? loginId : null,
      nisn: mapping.idType === "nisn" ? loginId : null,
    });
  }

  const firstRowById = new Map<string, number>();
  for (const row of rows) {
    const firstRow = firstRowById.get(row.loginId);
    if (firstRow) {
      issues.push({
        severity: "error",
        code: "duplicate_student_id",
        rowNumber: row.rowNumber,
        loginId: row.loginId,
        message: `Student ID duplicates row ${firstRow}.`,
      });
    } else {
      firstRowById.set(row.loginId, row.rowNumber);
    }
  }

  return {
    inspection: {
      fileHash: fileHash(buffer),
      headers,
      totalRows: dataRows.length,
    },
    rows,
    issues,
  };
}
