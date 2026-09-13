/**
 * Presensi SMAN 2 Cimalaka
 * © 2026 Dimas Bratakusumah
 * Institut Teknologi Nasional Bandung
 */

import { existsSync } from "node:fs";
import { join } from "node:path";
import PDFDocument from "pdfkit";
import { compareClassNames, type BulkActivationSlip } from "./student-activation-model";

const LOGO_PATH = join(process.cwd(), "public", "logo", "logo-color.png");

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

function columns(contentWidth: number): TableColumn[] {
  const fixedWidth = 24 + 65 + 215 + 40 + 95;
  return [
    { label: "No", width: 24, align: "center", value: (_, index) => String(index + 1) },
    { label: "ID / NIS", width: 65, value: (row) => row.loginId },
    { label: "Nama Siswa", width: 215, value: (row) => row.fullName },
    { label: "Kelas", width: 40, align: "center", value: (row) => row.className },
    { label: "Kode Aktivasi", width: 95, align: "center", isCode: true, value: (row) => row.activationCode },
    { label: "Masa Berlaku", width: contentWidth - fixedWidth, value: (row) => formatExpiryDate(row.expiresAt) },
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
  let hasLogo = false;
  try {
    hasLogo = existsSync(LOGO_PATH);
  } catch {
    hasLogo = false;
  }

  if (continuation) {
    const logoWidth = 20;
    const logoHeight = 27;
    let textX = MARGIN;
    let textWidth = contentWidth;

    if (hasLogo) {
      try {
        doc.image(LOGO_PATH, MARGIN, MARGIN, { width: logoWidth, height: logoHeight });
        textX = MARGIN + logoWidth + 8;
        textWidth = contentWidth - (logoWidth + 8);
      } catch {
        // Fallback without logo if image load fails
      }
    }

    doc.fillColor("#0369a1").font("Helvetica-Bold").fontSize(11)
      .text("SMAN 2 Cimalaka - Slip Aktivasi Akun Siswa", textX, MARGIN, { width: textWidth });
    const y = MARGIN + 14;
    doc.fillColor("#0f172a").font("Helvetica").fontSize(8)
      .text(`Kelas: Kelas ${safeText(className)} (Lanjutan)`, textX, y);
    doc.text(`Tautan: ${safeText(input.activationUrl)}`, textX, y, {
      width: textWidth,
      align: "right",
    });
    return y + 16;
  }

  const logoWidth = 30;
  const logoHeight = 40;
  let textX = MARGIN;
  let textWidth = contentWidth;

  if (hasLogo) {
    try {
      doc.image(LOGO_PATH, MARGIN, MARGIN, { width: logoWidth, height: logoHeight });
      textX = MARGIN + logoWidth + 10;
      textWidth = contentWidth - (logoWidth + 10);
    } catch {
      // Fallback without logo if image load fails
    }
  }

  doc.fillColor("#0369a1").font("Helvetica-Bold").fontSize(13)
    .text("SMAN 2 Cimalaka - Slip Aktivasi Akun Siswa", textX, MARGIN, { width: textWidth });

  let y = MARGIN + 16;
  doc.fillColor("#0f172a").font("Helvetica").fontSize(8.2)
    .text(`Kelas: Kelas ${safeText(className)}`, textX, y);
  doc.text(`Dibuat: ${generatedTimestamp(input.generatedAt)} WIB`, textX, y, {
    width: textWidth,
    align: "right",
  });

  y += 12;
  doc.text(`Jumlah data: ${classTotal} siswa`, textX, y);

  y = Math.max(y + 14, MARGIN + logoHeight + 6);
  doc.text(`Tautan Aktivasi: ${safeText(input.activationUrl)}`, MARGIN, y, { width: contentWidth });

  y += 12;
  doc.fillColor("#60706a").font("Helvetica").fontSize(7.2)
    .text(
      "Petunjuk: 1. Buka tautan aktivasi  |  2. Masukkan NIS & kode aktivasi  |  3. Buat kata sandi mandiri (min. 10 karakter)",
      MARGIN,
      y,
      { width: contentWidth },
    );

  return y + 15;
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
    doc.save().rect(MARGIN, y, doc.page.width - MARGIN * 2, TABLE_ROW_HEIGHT).fill("#f8fafc").restore();
  }
  doc.save().rect(MARGIN, y, doc.page.width - MARGIN * 2, TABLE_ROW_HEIGHT).strokeColor("#e2e8f0").lineWidth(0.35).stroke().restore();
  let x = MARGIN;
  for (const column of tableColumns) {
    if (column.isCode) {
      doc.fillColor("#0f172a").font("Courier-Bold").fontSize(8.5);
    } else {
      doc.fillColor("#0f172a").font("Helvetica").fontSize(7);
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
      layout: "portrait",
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
      const tableColumns = columns(doc.page.width - MARGIN * 2);
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
          const tableColumns = columns(doc.page.width - MARGIN * 2);
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
          `Sistem Presensi Sekolah | Halaman ${index - range.start + 1} dari ${range.count} | Presensi SMAN 2 Cimalaka · © 2026 Dimas Bratakusumah`,
          MARGIN,
          doc.page.height - MARGIN - 12,
          { width: doc.page.width - MARGIN * 2, align: "center", lineBreak: false },
        );
    }

    doc.end();
  });
}
