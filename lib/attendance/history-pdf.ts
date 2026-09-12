import PDFDocument from "pdfkit";
import type { AppRole } from "@/lib/auth/types";
import {
  formatAttendanceHistoryDate,
  formatAttendanceHistoryTime,
  type AttendanceHistoryFilter,
  type AttendanceHistoryRow,
} from "./history-model";

type AttendanceHistoryPdfInput = {
  rows: AttendanceHistoryRow[];
  filter: AttendanceHistoryFilter;
  generatedAt: Date;
  viewerRole: AppRole;
};

type TableColumn = {
  label: string;
  width: number;
  value: (row: AttendanceHistoryRow) => string;
};

const MARGIN = 36;
const TABLE_HEADER_HEIGHT = 23;
const TABLE_ROW_HEIGHT = 26;
const FOOTER_SPACE = 28;

function safeText(value: string): string {
  return Array.from(value, (character) => {
    const code = character.charCodeAt(0);
    return code < 32 || code === 127 ? " " : character;
  }).join("").replace(/\s+/g, " ").trim();
}

function reportPeriod(filter: AttendanceHistoryFilter): string {
  const start = formatAttendanceHistoryDate(filter.startDate);
  const end = formatAttendanceHistoryDate(filter.endDate);
  return start === end ? start : `${start} - ${end}`;
}

function generatedTimestamp(value: Date): string {
  return new Intl.DateTimeFormat("id-ID", {
    timeZone: "Asia/Jakarta",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23",
  }).format(value).replace(".", ":").replace(".", ":");
}

function classScope(filter: AttendanceHistoryFilter, role: AppRole): string {
  if (role === "student") return "Data siswa sendiri";
  return filter.className ? `Kelas ${safeText(filter.className)}` : "Semua kelas";
}

function columns(contentWidth: number): TableColumn[] {
  const fixedWidth = 58 + 65 + 140 + 55 + 50 + 50 + 70 + 190;
  return [
    { label: "Tanggal", width: 58, value: (row) => formatAttendanceHistoryDate(row.date) },
    { label: "ID Siswa", width: 65, value: (row) => row.studentLoginId },
    { label: "Nama Siswa", width: 140, value: (row) => row.studentName },
    { label: "Kelas", width: 55, value: (row) => row.className },
    { label: "Masuk", width: 50, value: (row) => formatAttendanceHistoryTime(row.checkInAt).replace(" WIB", "") },
    { label: "Pulang", width: 50, value: (row) => formatAttendanceHistoryTime(row.checkOutAt).replace(" WIB", "") },
    { label: "Status", width: 70, value: (row) => row.status },
    { label: "Alasan Absen", width: 190, value: (row) => row.absenceReason },
    { label: "Metode", width: contentWidth - fixedWidth, value: (row) => row.method },
  ];
}

function drawDocumentHeader(
  doc: PDFKit.PDFDocument,
  input: AttendanceHistoryPdfInput,
  continuation: boolean,
): number {
  const contentWidth = doc.page.width - MARGIN * 2;
  doc.fillColor("#0369a1").font("Helvetica-Bold").fontSize(continuation ? 12 : 17)
    .text("SMAN 2 Cimalaka - Laporan Presensi Siswa", MARGIN, MARGIN, { width: contentWidth });
  let y = MARGIN + (continuation ? 20 : 27);
  doc.fillColor("#0f172a").font("Helvetica").fontSize(8.5)
    .text(`Periode: ${reportPeriod(input.filter)}`, MARGIN, y);
  y += 13;
  doc.text(`Filter: ${classScope(input.filter, input.viewerRole)}`, MARGIN, y);
  if (!continuation) {
    doc.text(`Dibuat: ${generatedTimestamp(input.generatedAt)} WIB`, MARGIN + contentWidth / 2, y - 13, {
      width: contentWidth / 2,
      align: "right",
    });
    doc.text(`Jumlah data: ${input.rows.length}`, MARGIN + contentWidth / 2, y, {
      width: contentWidth / 2,
      align: "right",
    });
  }
  return y + 19;
}

function drawTableHeader(doc: PDFKit.PDFDocument, tableColumns: TableColumn[], y: number): number {
  let x = MARGIN;
  doc.save().rect(MARGIN, y, doc.page.width - MARGIN * 2, TABLE_HEADER_HEIGHT).fill("#0369a1").restore();
  doc.fillColor("#ffffff").font("Helvetica-Bold").fontSize(7);
  for (const column of tableColumns) {
    doc.text(column.label, x + 4, y + 6, {
      width: column.width - 8,
      height: TABLE_HEADER_HEIGHT - 8,
      ellipsis: true,
      lineBreak: false,
    });
    x += column.width;
  }
  return y + TABLE_HEADER_HEIGHT;
}

function drawRow(
  doc: PDFKit.PDFDocument,
  tableColumns: TableColumn[],
  row: AttendanceHistoryRow,
  y: number,
  alternate: boolean,
): number {
  if (alternate) {
    doc.save().rect(MARGIN, y, doc.page.width - MARGIN * 2, TABLE_ROW_HEIGHT).fill("#f8fafc").restore();
  }
  doc.save().rect(MARGIN, y, doc.page.width - MARGIN * 2, TABLE_ROW_HEIGHT).strokeColor("#e2e8f0").lineWidth(0.35).stroke().restore();
  let x = MARGIN;
  doc.fillColor("#0f172a").font("Helvetica").fontSize(6.8);
  for (const column of tableColumns) {
    doc.text(safeText(column.value(row)) || "-", x + 4, y + 5, {
      width: column.width - 8,
      height: TABLE_ROW_HEIGHT - 8,
      ellipsis: true,
      lineGap: 0.5,
    });
    x += column.width;
  }
  return y + TABLE_ROW_HEIGHT;
}

export async function generateAttendanceHistoryPdf(
  input: AttendanceHistoryPdfInput,
): Promise<Buffer> {
  return new Promise<Buffer>((resolve, reject) => {
    const doc = new PDFDocument({
      autoFirstPage: false,
      bufferPages: true,
      compress: false,
      size: "A4",
      layout: "landscape",
      margins: { top: MARGIN, right: MARGIN, bottom: MARGIN, left: MARGIN },
      info: {
        Title: "Laporan Presensi Siswa - SMAN 2 Cimalaka",
        Author: "Sistem Presensi Sekolah",
        Subject: `Laporan presensi ${reportPeriod(input.filter)} - ${classScope(input.filter, input.viewerRole)}`,
      },
    });
    const chunks: Buffer[] = [];
    doc.on("data", (chunk: Buffer) => chunks.push(chunk));
    doc.on("error", reject);
    doc.on("end", () => resolve(Buffer.concat(chunks)));

    const addReportPage = (continuation: boolean) => {
      doc.addPage();
      const tableColumns = columns(doc.page.width - MARGIN * 2);
      const headerBottom = drawDocumentHeader(doc, input, continuation);
      return { tableColumns, y: drawTableHeader(doc, tableColumns, headerBottom) };
    };

    let page = addReportPage(false);
    if (input.rows.length === 0) {
      doc.fillColor("#60706a").font("Helvetica").fontSize(11)
        .text("Tidak ada data presensi untuk filter yang dipilih.", MARGIN, page.y + 24, {
          width: doc.page.width - MARGIN * 2,
          align: "center",
        });
    } else {
      input.rows.forEach((row, index) => {
        const pageBottom = doc.page.height - MARGIN - FOOTER_SPACE;
        if (page.y + TABLE_ROW_HEIGHT > pageBottom) page = addReportPage(true);
        page.y = drawRow(doc, page.tableColumns, row, page.y, index % 2 === 1);
      });
    }

    const range = doc.bufferedPageRange();
    for (let index = range.start; index < range.start + range.count; index += 1) {
      doc.switchToPage(index);
      doc.fillColor("#60706a").font("Helvetica").fontSize(7)
        .text(
          `Sistem Presensi Sekolah | Halaman ${index - range.start + 1} dari ${range.count}`,
          MARGIN,
          doc.page.height - MARGIN - 12,
          { width: doc.page.width - MARGIN * 2, align: "center", lineBreak: false },
        );
    }
    doc.end();
  });
}
