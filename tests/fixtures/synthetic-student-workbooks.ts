import ExcelJS from "exceljs";

type SyntheticWorkbookOptions = {
  headers: string[];
  rows: ExcelJS.CellValue[][];
  numberFormats?: Array<{ row: number; column: number; format: string }>;
  addSecondWorksheet?: boolean;
};

export async function syntheticStudentWorkbook(
  options: SyntheticWorkbookOptions,
): Promise<Buffer> {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = "Synthetic PKM Student Import Test";
  workbook.subject = "Synthetic development data only";
  const worksheet = workbook.addWorksheet("Synthetic Students");
  worksheet.addRow(options.headers);
  for (const row of options.rows) worksheet.addRow(row);
  for (const item of options.numberFormats ?? []) {
    worksheet.getRow(item.row).getCell(item.column).numFmt = item.format;
  }
  if (options.addSecondWorksheet) workbook.addWorksheet("Unexpected Sheet");
  return Buffer.from(await workbook.xlsx.writeBuffer());
}

export function syntheticRows(count: number): ExcelJS.CellValue[][] {
  return Array.from({ length: count }, (_, index) => [
    `SYN${String(index + 1).padStart(5, "0")}`,
    `Synthetic Student ${index + 1}`,
    `SYN-${(index % 3) + 1}`,
  ]);
}

