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
  type WorksheetInspection,
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

export function extractClassFromRow(row: ExcelJS.Row): string | null {
  if (isTableHeaderRow(row)) return null;

  for (let col = 1; col <= row.cellCount; col += 1) {
    const cell = row.getCell(col);
    if (!hasCellValue(cell)) continue;
    if (isFormulaCell(cell)) return null;

    const text = cell.text.trim();

    // Pattern A: "KELAS : 12.1", "KELAS: 12.1", "Kelas : 10.1", "ROMBEL : 11.2", "KELAS 12.1", "CLASS : 10.1"
    const match = text.match(/^(?:KELAS(?:\s*\/\s*ROMBEL)?|ROMBEL|CLASS)\s*(?:[:=-]\s*|\s+)(.+)$/i);
    if (match && match[1].trim()) {
      return match[1].trim();
    }

    // Pattern B: Cell is just "KELAS" or "KELAS :" or "KELAS:", and next cell has the value
    if (/^(?:KELAS(?:\s*\/\s*ROMBEL)?|ROMBEL|CLASS)\s*[:=-]?$/i.test(text)) {
      for (let nextCol = col + 1; nextCol <= row.cellCount; nextCol += 1) {
        const nextCell = row.getCell(nextCol);
        if (hasCellValue(nextCell)) {
          if (isFormulaCell(nextCell)) return null;
          const nextText = nextCell.text.trim().replace(/^[:=-]\s*/, "");
          if (nextText) return nextText;
        }
      }
    }
  }
  return null;
}

function isTableHeaderRow(row: ExcelJS.Row): boolean {
  if (!isMeaningfulRow(row)) return false;
  let idOrNoCount = 0;
  let nameCount = 0;
  let otherHeaderCount = 0;

  for (let col = 1; col <= row.cellCount; col += 1) {
    const cell = row.getCell(col);
    if (!hasCellValue(cell)) continue;
    const text = cell.text.trim().toUpperCase();
    if (
      text === "NIS" ||
      text === "NISN" ||
      text === "ID" ||
      text === "SCHOOL ID" ||
      text === "KODE" ||
      text === "KODE SEKOLAH" ||
      text === "NO. INDUK" ||
      text === "NOMOR INDUK" ||
      text === "NO" ||
      text === "NO."
    ) {
      idOrNoCount += 1;
    } else if (
      text === "NAMA" ||
      text === "NAMA LENGKAP" ||
      text === "NAMA PESERTA" ||
      text === "NAMA SISWA" ||
      text === "NAMA PESERTA DIDIK" ||
      text === "FULL NAME" ||
      text === "NAME"
    ) {
      nameCount += 1;
    } else if (
      text === "L/P" ||
      text === "JK" ||
      text === "JENIS KELAMIN" ||
      text === "CLASS" ||
      text === "KELAS" ||
      text === "ROMBEL" ||
      text === "GROUP" ||
      text === "CATATAN" ||
      text === "KETERANGAN"
    ) {
      otherHeaderCount += 1;
    }
  }

  return (idOrNoCount > 0 && nameCount > 0) || (idOrNoCount + nameCount + otherHeaderCount >= 2);
}

function isSectionFooterRow(row: ExcelJS.Row): boolean {
  for (let col = 1; col <= row.cellCount; col += 1) {
    const cell = row.getCell(col);
    if (!hasCellValue(cell)) continue;
    const text = cell.text.trim().toLowerCase();
    if (
      text.includes("wali kelas") ||
      text.includes("kepala sekolah") ||
      text.includes("mengetahui") ||
      text.startsWith("nip") ||
      text.startsWith("sumedang,") ||
      text.includes("pemerintah daerah") ||
      text.includes("dinas pendidikan") ||
      text.includes("cabang dinas") ||
      text.includes("sma negeri 2") ||
      text.includes("jalan margamukti") ||
      text.includes("website :") ||
      text.includes("daftar hadir siswa")
    ) {
      return true;
    }
  }
  return false;
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

type ParsedSheetData = {
  worksheet: ExcelJS.Worksheet;
  headers: WorkbookHeader[];
  detectedClasses: string[];
  dataRows: Array<{
    row: ExcelJS.Row;
    sectionClass: string | null;
  }>;
};

function parseWorksheetStructure(worksheet: ExcelJS.Worksheet): ParsedSheetData {
  const detectedClasses: string[] = [];
  let currentClass: string | null = null;
  let activeHeaders: WorkbookHeader[] = [];
  let firstHeaderRowNumber = 0;
  const dataRows: Array<{ row: ExcelJS.Row; sectionClass: string | null }> = [];

  let primaryHeaderRowNumber = 0;
  for (let rowNumber = 1; rowNumber <= worksheet.rowCount; rowNumber += 1) {
    const row = worksheet.getRow(rowNumber);
    if (!isMeaningfulRow(row)) continue;
    if (extractClassFromRow(row)) continue;
    if (isTableHeaderRow(row)) {
      primaryHeaderRowNumber = rowNumber;
      break;
    }
  }

  if (primaryHeaderRowNumber === 0) {
    for (let rowNumber = 1; rowNumber <= worksheet.rowCount; rowNumber += 1) {
      const row = worksheet.getRow(rowNumber);
      if (!isMeaningfulRow(row)) continue;
      if (extractClassFromRow(row)) continue;
      primaryHeaderRowNumber = rowNumber;
      break;
    }
  }

  if (primaryHeaderRowNumber === 0) {
    throw new StudentWorkbookError(
      "invalid_worksheet",
      `Worksheet "${worksheet.name}" does not contain a valid header row.`,
    );
  }

  for (let rowNumber = 1; rowNumber <= worksheet.rowCount; rowNumber += 1) {
    const row = worksheet.getRow(rowNumber);
    if (!isMeaningfulRow(row)) continue;

    const classFromRow = extractClassFromRow(row);
    if (classFromRow) {
      currentClass = classFromRow;
      if (!detectedClasses.includes(currentClass)) {
        detectedClasses.push(currentClass);
      }
      continue;
    }

    if (rowNumber === primaryHeaderRowNumber || (rowNumber > primaryHeaderRowNumber && isTableHeaderRow(row))) {
      activeHeaders = worksheetHeaders(row);
      if (firstHeaderRowNumber === 0) firstHeaderRowNumber = rowNumber;
      continue;
    }

    if (isSectionFooterRow(row)) {
      currentClass = null;
      continue;
    }

    if (rowNumber < primaryHeaderRowNumber) {
      continue;
    }

    if (activeHeaders.length > 0 && rowNumber > firstHeaderRowNumber) {
      // Must have some content in ID/Name column or row numbering
      const c1 = row.getCell(1).text.trim();
      const c2 = row.getCell(2).text.trim();
      const c3 = row.getCell(3).text.trim();
      if (c1 || c2 || c3) {
        dataRows.push({ row, sectionClass: currentClass });
      }
    }
  }

  if (activeHeaders.length === 0) {
    throw new StudentWorkbookError(
      "invalid_worksheet",
      `Worksheet "${worksheet.name}" does not contain a valid header row.`,
    );
  }

  if (dataRows.length === 0) {
    throw new StudentWorkbookError(
      "invalid_worksheet",
      `Worksheet "${worksheet.name}" does not contain Student rows.`,
    );
  }

  return {
    worksheet,
    headers: activeHeaders,
    detectedClasses,
    dataRows,
  };
}

async function loadWorkbook(buffer: Buffer): Promise<ExcelJS.Workbook> {
  const workbook = new ExcelJS.Workbook();
  try {
    await workbook.xlsx.load(buffer as unknown as ExcelJS.Buffer);
  } catch {
    throw new StudentWorkbookError("invalid_workbook", "The file is not a readable .xlsx workbook.");
  }

  if (workbook.worksheets.length === 0) {
    throw new StudentWorkbookError("no_worksheet", "The workbook does not contain a worksheet.");
  }

  return workbook;
}

function fileHash(buffer: Buffer): string {
  return createHash("sha256").update(buffer).digest("hex");
}

export async function inspectStudentWorkbook(buffer: Buffer): Promise<WorkbookInspection> {
  const workbook = await loadWorkbook(buffer);
  const worksheetInspections: WorksheetInspection[] = [];
  const allHeaders: WorkbookHeader[] = [];
  const headerLabels = new Set<string>();
  let totalRows = 0;

  for (const worksheet of workbook.worksheets) {
    const sheetData = parseWorksheetStructure(worksheet);
    totalRows += sheetData.dataRows.length;

    if (totalRows > STUDENT_IMPORT_MAX_ROWS) {
      throw new StudentWorkbookError(
        "row_limit",
        `The workbook exceeds the ${STUDENT_IMPORT_MAX_ROWS}-row limit.`,
      );
    }

    worksheetInspections.push({
      name: worksheet.name,
      className: sheetData.detectedClasses.join(", ") || null,
      totalRows: sheetData.dataRows.length,
      headers: sheetData.headers,
    });

    for (const header of sheetData.headers) {
      if (!headerLabels.has(header.label)) {
        headerLabels.add(header.label);
        allHeaders.push(header);
      }
    }
  }

  if (totalRows === 0) {
    throw new StudentWorkbookError("no_students", "The workbook does not contain Student rows.");
  }

  return {
    fileHash: fileHash(buffer),
    headers: allHeaders.length > 0 ? allHeaders : worksheetInspections[0].headers,
    totalRows,
    worksheets: worksheetInspections,
  };
}

function requiredText(
  cell: ExcelJS.Cell,
  fieldName: string,
  rowNumber: number,
  issues: StudentImportIssue[],
  worksheetName?: string,
): string | null {
  if (isFormulaCell(cell)) {
    issues.push({
      severity: "error",
      code: "formula_value",
      rowNumber,
      worksheetName,
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
      worksheetName,
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
  worksheetName?: string,
): string | null {
  if (isFormulaCell(cell)) {
    issues.push({
      severity: "error",
      code: "formula_value",
      rowNumber,
      worksheetName,
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
        worksheetName,
        message: "Student ID must be stored as Text in Excel.",
      });
      return null;
    }
    const numberFormat = (cell.numFmt ?? "").trim().split(";")[0];
    if (/^0+$/.test(numberFormat)) {
      return String(cell.value).padStart(numberFormat.length, "0");
    }
    if (cell.value < 10000) {
      issues.push({
        severity: "error",
        code: "unsafe_numeric_id",
        rowNumber,
        worksheetName,
        message: "Numeric Student ID has no recoverable zero-padding; format the column as Text.",
      });
      return null;
    }
    return String(cell.value);
  }

  const value = cell.text.trim();
  if (!value) {
    issues.push({
      severity: "error",
      code: "missing_student_id",
      rowNumber,
      worksheetName,
      message: "Student ID is required.",
    });
    return null;
  }
  return value;
}

function validateMapping(headers: WorkbookHeader[], mapping: StudentColumnMapping): void {
  const selected = [mapping.idColumn, mapping.fullNameColumn];
  if (mapping.classColumn && mapping.classColumn > 0) {
    selected.push(mapping.classColumn);
  }
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
  const workbook = await loadWorkbook(buffer);
  const worksheetInspections: WorksheetInspection[] = [];
  const allHeaders: WorkbookHeader[] = [];
  const headerLabels = new Set<string>();
  const parsedSheets: ParsedSheetData[] = [];
  let totalDataRowCount = 0;

  for (const worksheet of workbook.worksheets) {
    const sheetData = parseWorksheetStructure(worksheet);
    totalDataRowCount += sheetData.dataRows.length;

    if (totalDataRowCount > STUDENT_IMPORT_MAX_ROWS) {
      throw new StudentWorkbookError(
        "row_limit",
        `The workbook exceeds the ${STUDENT_IMPORT_MAX_ROWS}-row limit.`,
      );
    }

    parsedSheets.push(sheetData);
    worksheetInspections.push({
      name: worksheet.name,
      className: sheetData.detectedClasses.join(", ") || null,
      totalRows: sheetData.dataRows.length,
      headers: sheetData.headers,
    });

    for (const header of sheetData.headers) {
      if (!headerLabels.has(header.label)) {
        headerLabels.add(header.label);
        allHeaders.push(header);
      }
    }
  }

  const consolidatedHeaders = allHeaders.length > 0 ? allHeaders : worksheetInspections[0].headers;
  validateMapping(consolidatedHeaders, mapping);

  const issues: StudentImportIssue[] = [];
  const selectedColumns = new Set([mapping.idColumn, mapping.fullNameColumn]);
  if (mapping.classColumn && mapping.classColumn > 0) {
    selectedColumns.add(mapping.classColumn);
  }

  for (const header of consolidatedHeaders) {
    if (!selectedColumns.has(header.column)) {
      issues.push({
        severity: "warning",
        code: "extra_column",
        message: `Extra column “${header.label}” will be ignored.`,
      });
    }
  }

  const rows: ParsedStudentRow[] = [];
  let globalRowNumber = 1;

  for (const sheetData of parsedSheets) {
    for (const { row, sectionClass } of sheetData.dataRows) {
      const idSource = studentIdText(
        row.getCell(mapping.idColumn),
        row.number,
        issues,
        sheetData.worksheet.name,
      );
      const fullName = requiredText(
        row.getCell(mapping.fullNameColumn),
        "Full Name",
        row.number,
        issues,
        sheetData.worksheet.name,
      );

      let className: string | null = null;
      if (sectionClass) {
        className = sectionClass;
      } else if (mapping.classColumn && mapping.classColumn > 0) {
        className = requiredText(
          row.getCell(mapping.classColumn),
          "Class",
          row.number,
          issues,
          sheetData.worksheet.name,
        );
      } else {
        issues.push({
          severity: "error",
          code: "missing_class",
          rowNumber: row.number,
          worksheetName: sheetData.worksheet.name,
          message: `Class information is missing for row ${row.number} in worksheet "${sheetData.worksheet.name}".`,
        });
      }

      if (!idSource || !fullName || !className) continue;

      let loginId: string;
      try {
        loginId = normalizeLoginId(idSource);
      } catch {
        issues.push({
          severity: "error",
          code: "invalid_student_id",
          rowNumber: row.number,
          worksheetName: sheetData.worksheet.name,
          message: "Student ID contains unsupported characters.",
        });
        continue;
      }

      rows.push({
        rowNumber: globalRowNumber,
        loginId,
        fullName,
        className,
        nis: mapping.idType === "nis" ? loginId : null,
        nisn: mapping.idType === "nisn" ? loginId : null,
        worksheetName: sheetData.worksheet.name,
      });
      globalRowNumber += 1;
    }
  }

  const firstRowById = new Map<string, { rowNumber: number; worksheetName?: string }>();
  for (const row of rows) {
    const existing = firstRowById.get(row.loginId);
    if (existing) {
      const location = existing.worksheetName && existing.worksheetName !== row.worksheetName
        ? `row ${existing.rowNumber} (${existing.worksheetName})`
        : `row ${existing.rowNumber}`;
      issues.push({
        severity: "error",
        code: "duplicate_student_id",
        rowNumber: row.rowNumber,
        loginId: row.loginId,
        worksheetName: row.worksheetName,
        message: `Student ID duplicates ${location}.`,
      });
    } else {
      firstRowById.set(row.loginId, {
        rowNumber: row.rowNumber,
        worksheetName: row.worksheetName,
      });
    }
  }

  return {
    inspection: {
      fileHash: fileHash(buffer),
      headers: consolidatedHeaders,
      totalRows: rows.length,
      worksheets: worksheetInspections,
    },
    rows,
    issues,
  };
}
