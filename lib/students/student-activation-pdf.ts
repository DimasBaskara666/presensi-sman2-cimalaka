import PDFDocument from "pdfkit";
import { compareClassNames, type BulkActivationSlip } from "./student-activation-model";

export type StudentActivationPdfInput = {
  slips: BulkActivationSlip[];
  activationUrl: string;
  generatedAt: Date;
  filteredClass?: string;
};

type TableColumn = {
  label: string;
  width: number;
  align?: "left" | "center" | "right";
  isCode?: boolean;
  value: (row: BulkActivationSlip, index: number) => string;
};

const MARGIN = 36;
const TABLE_HEADER_HEIGHT = 23;
const TABLE_ROW_HEIGHT = 24;
const FOOTER_SPACE = 28;

function safeText(value: string): string {
  return Array.from(value, (character) => {
    const code = character.charCodeAt(0);
    return code < 32 || code === 127 ? " " : character;
  }).join("").replace(/\s+/g, " ").trim();
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

function formatExpiryDate(isoDateString: string): string {
  try {
    const date = new Date(isoDateString);
    if (Number.isNaN(date.getTime())) return isoDateString;
    return new Intl.DateTimeFormat("id-ID", {
      timeZone: "Asia/Jakarta",
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      hourCycle: "h23",
    }).format(date).replace(".", ":") + " WIB";
  } catch {
    return isoDateString;
  }
}

function columns(contentWidth: number, input: StudentActivationPdfInput): TableColumn[] {
  const fixedWidth = 28 + 68 + 175 + 50 + 215 + 95;
  return [
    { label: "No", width: 28, align: "center", value: (_, index) => String(index + 1) },
    { label: "ID / NIS", width: 68, value: (row) => row.loginId },
    { label: "Nama Siswa", width: 175, value: (row) => row.fullName },
    { label: "Kelas", width: 50, align: "center", value: (row) => row.className },
    { label: "Kode Aktivasi", width: 215, isCode: true, value: (row) => row.activationCode },
    { label: "Masa Berlaku", width: 95, value: (row) => formatExpiryDate(row.expiresAt) },
    { label: "Tautan Aktivasi", width: contentWidth - fixedWidth, value: () => input.activationUrl },
  ];
}

function drawDocumentHeader(
  doc: PDFKit.PDFDocument,
  input: StudentActivationPdfInput,
  className: string,
  classTotal: number,
  continuation: boolean,
): number {
  const contentWidth = doc.page.width - MARGIN * 2;
  doc.fillColor("#126b51").font("Helvetica-Bold").fontSize(continuation ? 12 : 17)
    .text("SMAN 2 Cimalaka - Slip Aktivasi Akun Siswa", MARGIN, MARGIN, { width: contentWidth });
  let y = MARGIN + (continuation ? 20 : 27);
  doc.fillColor("#17231f").font("Helvetica").fontSize(8.5)
    .text(`Kelas: Kelas ${safeText(className)}${continuation ? " (Lanjutan)" : ""}`, MARGIN, y);
  y += 13;
  doc.text(`Tautan Aktivasi: ${safeText(input.activationUrl)}`, MARGIN, y);
  if (!continuation) {
    doc.text(`Dibuat: ${generatedTimestamp(input.generatedAt)} WIB`, MARGIN + contentWidth / 2, y - 13, {
      width: contentWidth / 2,
      align: "right",
    });
    doc.text(`Jumlah data: ${classTotal} siswa`, MARGIN + contentWidth / 2, y, {
      width: contentWidth / 2,
      align: "right",
    });
    y += 13;
    doc.fillColor("#60706a").font("Helvetica").fontSize(7.5)
      .text(
        "Petunjuk: 1. Buka tautan aktivasi  |  2. Masukkan NIS & kode aktivasi  |  3. Buat kata sandi mandiri (min. 10 karakter)",
        MARGIN,
        y,
        { width: contentWidth },
      );
  }
  return y + 18;
}

function drawTableHeader(doc: PDFKit.PDFDocument, tableColumns: TableColumn[], y: number): number {
  let x = MARGIN;
  doc.save().rect(MARGIN, y, doc.page.width - MARGIN * 2, TABLE_HEADER_HEIGHT).fill("#126b51").restore();
  doc.fillColor("#ffffff").font("Helvetica-Bold").fontSize(7);
  for (const column of tableColumns) {
    doc.text(column.label, x + 4, y + 6, {
      width: column.width - 8,
      height: TABLE_HEADER_HEIGHT - 8,
      ellipsis: true,
      lineBreak: false,
      align: column.align ?? "left",
    });
    x += column.width;
  }
  return y + TABLE_HEADER_HEIGHT;
}

function drawRow(
  doc: PDFKit.PDFDocument,
  tableColumns: TableColumn[],
  slip: BulkActivationSlip,
  index: number,
  y: number,
  alternate: boolean,
): number {
  if (alternate) {
    doc.save().rect(MARGIN, y, doc.page.width - MARGIN * 2, TABLE_ROW_HEIGHT).fill("#eef6f3").restore();
  }
  doc.save().rect(MARGIN, y, doc.page.width - MARGIN * 2, TABLE_ROW_HEIGHT).strokeColor("#d9e4df").lineWidth(0.35).stroke().restore();
  let x = MARGIN;
  for (const column of tableColumns) {
    if (column.isCode) {
      doc.fillColor("#17231f").font("Courier-Bold").fontSize(7.2);
    } else {
      doc.fillColor("#17231f").font("Helvetica").fontSize(6.8);
    }
    doc.text(safeText(column.value(slip, index)) || "-", x + 4, y + 5, {
      width: column.width - 8,
      height: TABLE_ROW_HEIGHT - 8,
      ellipsis: true,
      lineBreak: false,
      align: column.align ?? "left",
    });
    x += column.width;
  }
  return y + TABLE_ROW_HEIGHT;
}

export async function generateStudentActivationPdf(
  input: StudentActivationPdfInput,
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
        Title: "Slip Aktivasi Akun Siswa - SMAN 2 Cimalaka",
        Author: "Sistem Presensi Sekolah",
        Subject: input.filteredClass
          ? `Slip Aktivasi Akun Siswa Kelas ${input.filteredClass}`
          : "Slip Aktivasi Akun Siswa Semua Kelas",
      },
    });

    const chunks: Buffer[] = [];
    doc.on("data", (chunk: Buffer) => chunks.push(chunk));
    doc.on("error", reject);
    doc.on("end", () => resolve(Buffer.concat(chunks)));

    const classMap = new Map<string, BulkActivationSlip[]>();
    for (const slip of input.slips) {
      const className = slip.className.trim() || "Tanpa Kelas";
      let list = classMap.get(className);
      if (!list) {
        list = [];
        classMap.set(className, list);
      }
      list.push(slip);
    }

    const sortedClasses = Array.from(classMap.keys()).sort(compareClassNames);

    if (sortedClasses.length === 0) {
      doc.addPage();
      const tableColumns = columns(doc.page.width - MARGIN * 2, input);
      const headerBottom = drawDocumentHeader(doc, input, input.filteredClass ?? "Semua Kelas", 0, false);
      const tableHeaderBottom = drawTableHeader(doc, tableColumns, headerBottom);
      doc.fillColor("#60706a").font("Helvetica").fontSize(11)
        .text("Tidak ada data slip aktivasi untuk filter yang dipilih.", MARGIN, tableHeaderBottom + 24, {
          width: doc.page.width - MARGIN * 2,
          align: "center",
        });
    } else {
      for (const className of sortedClasses) {
        const classSlips = classMap.get(className)!;

        const addClassPage = (continuation: boolean) => {
          doc.addPage();
          const tableColumns = columns(doc.page.width - MARGIN * 2, input);
          const headerBottom = drawDocumentHeader(doc, input, className, classSlips.length, continuation);
          return { tableColumns, y: drawTableHeader(doc, tableColumns, headerBottom) };
        };

        let page = addClassPage(false);

        classSlips.forEach((slip, index) => {
          const pageBottom = doc.page.height - MARGIN - FOOTER_SPACE;
          if (page.y + TABLE_ROW_HEIGHT > pageBottom) {
            page = addClassPage(true);
          }
          page.y = drawRow(doc, page.tableColumns, slip, index, page.y, index % 2 === 1);
        });
      }
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
