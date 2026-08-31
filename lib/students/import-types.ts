export const STUDENT_IMPORT_MAX_FILE_BYTES = 5 * 1024 * 1024;
export const STUDENT_IMPORT_MAX_ROWS = 2000;

export type StudentIdType = "nis" | "nisn";

export type StudentColumnMapping = {
  idColumn: number;
  fullNameColumn: number;
  classColumn?: number | null;
  idType: StudentIdType;
};

export type WorkbookHeader = {
  column: number;
  label: string;
};

export type WorksheetInspection = {
  name: string;
  className: string | null;
  totalRows: number;
  headers: WorkbookHeader[];
};

export type WorkbookInspection = {
  fileHash: string;
  headers: WorkbookHeader[];
  totalRows: number;
  worksheets?: WorksheetInspection[];
};

export type StudentImportIssue = {
  severity: "error" | "warning";
  code: string;
  message: string;
  rowNumber?: number;
  loginId?: string;
  worksheetName?: string;
};

export type ParsedStudentRow = {
  rowNumber: number;
  loginId: string;
  fullName: string;
  className: string;
  nis: string | null;
  nisn: string | null;
  worksheetName?: string;
};

export type StudentPreviewRow = ParsedStudentRow & {
  action: "insert" | "update" | "unchanged";
  isActive: boolean;
  isActivated: boolean;
};

export type StudentImportPreview = {
  fileHash: string;
  totalRows: number;
  insertedCount: number;
  updatedCount: number;
  unchangedCount: number;
  rows: StudentPreviewRow[];
  issues: StudentImportIssue[];
  worksheets?: WorksheetInspection[];
};

export type StudentImportSummary = {
  insertedCount: number;
  updatedCount: number;
  unchangedCount: number;
};

