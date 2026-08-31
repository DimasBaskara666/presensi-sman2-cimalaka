import ExcelJS from "exceljs";

type SyntheticWorkbookOptions = {
  headers: string[];
  rows: ExcelJS.CellValue[][];
  numberFormats?: Array<{ row: number; column: number; format: string }>;
  addSecondWorksheet?: boolean;
  classHeader?: string;
};

export type SyntheticSheetConfig = {
  name: string;
  titleRows?: string[];
  classHeader?: string;
  headers?: string[];
  rows: ExcelJS.CellValue[][];
  numberFormats?: Array<{ row: number; column: number; format: string }>;
  subsections?: Array<{
    classHeader: string;
    headers?: string[];
    rows: ExcelJS.CellValue[][];
  }>;
};

export async function syntheticStudentWorkbook(
  options: SyntheticWorkbookOptions,
): Promise<Buffer> {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = "Synthetic PKM Student Import Test";
  workbook.subject = "Synthetic development data only";
  const worksheet = workbook.addWorksheet("Synthetic Students");
  if (options.classHeader) {
    worksheet.addRow([options.classHeader]);
  }
  worksheet.addRow(options.headers);
  for (const row of options.rows) worksheet.addRow(row);
  for (const item of options.numberFormats ?? []) {
    worksheet.getRow(item.row).getCell(item.column).numFmt = item.format;
  }
  if (options.addSecondWorksheet) {
    const second = workbook.addWorksheet("Unexpected Sheet");
    second.addRow(["Unexpected Data Without Headers"]);
  }
  return Buffer.from(await workbook.xlsx.writeBuffer());
}

export async function syntheticMultiSheetWorkbook(
  sheets: SyntheticSheetConfig[],
): Promise<Buffer> {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = "Synthetic PKM Student Import Test";
  workbook.subject = "Synthetic development data only";

  for (const sheetConfig of sheets) {
    const worksheet = workbook.addWorksheet(sheetConfig.name);
    for (const title of sheetConfig.titleRows ?? ["DAFTAR HADIR PESERTA DIDIK", "SMAN 2 CIMALAKA"]) {
      worksheet.addRow([title]);
    }
    if (sheetConfig.classHeader) {
      worksheet.addRow([sheetConfig.classHeader]);
    }
    const headers = sheetConfig.headers ?? ["No", "NIS", "NAMA LENGKAP", "L/P", "1", "2", "3", "4", "5"];
    worksheet.addRow(headers);
    for (const row of sheetConfig.rows) {
      worksheet.addRow(row);
    }
    for (const item of sheetConfig.numberFormats ?? []) {
      worksheet.getRow(item.row).getCell(item.column).numFmt = item.format;
    }
    if (sheetConfig.subsections) {
      for (const section of sheetConfig.subsections) {
        worksheet.addRow([]);
        worksheet.addRow([section.classHeader]);
        worksheet.addRow(section.headers ?? headers);
        for (const row of section.rows) {
          worksheet.addRow(row);
        }
      }
    }
  }

  return Buffer.from(await workbook.xlsx.writeBuffer());
}

export function syntheticRows(count: number): ExcelJS.CellValue[][] {
  return Array.from({ length: count }, (_, index) => [
    `SYN${String(index + 1).padStart(5, "0")}`,
    `Synthetic Student ${index + 1}`,
    `SYN-${(index % 3) + 1}`,
  ]);
}
