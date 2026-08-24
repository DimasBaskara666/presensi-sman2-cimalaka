export const STUDENT_IMPORT_MAX_FILE_BYTES = 5 * 1024 * 1024;
export const STUDENT_IMPORT_MAX_ROWS = 2000;

export type StudentIdType = "nis" | "nisn";

export type StudentColumnMapping = {
  idColumn: number;
  fullNameColumn: number;
  classColumn: number;
  idType: StudentIdType;
};

export type WorkbookHeader = {
  column: number;
  label: string;
};

export type WorkbookInspection = {
  fileHash: string;
  headers: WorkbookHeader[];
  totalRows: number;
};

export type StudentImportIssue = {
  severity: "error" | "warning";
  code: string;
  message: string;
  rowNumber?: number;
  loginId?: string;
};

export type ParsedStudentRow = {
  rowNumber: number;
  loginId: string;
  fullName: string;
  className: string;
  nis: string | null;
  nisn: string | null;
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
};

export type StudentImportSummary = {
  insertedCount: number;
  updatedCount: number;
  unchangedCount: number;
};

