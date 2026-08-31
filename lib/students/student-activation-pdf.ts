import PDFDocument from "pdfkit";
import { compareClassNames, type BulkActivationSlip } from "./student-activation-model";

export type StudentActivationPdfInput = {
  slips: BulkActivationSlip[];
  activationUrl: string;
  generatedAt: Date;
  filteredClass?: string;
};

const MARGIN = 36;
const SLIP_HEIGHT = 118;
const SLIP_GAP = 12;
const FOOTER_SPACE = 25;

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
    }).format(date).replace(".", ":");
  } catch {
    return isoDateString;
  }
}

function drawClassHeader(
  doc: PDFKit.PDFDocument,
  className: string,
  classTotal: number,
  generatedAt: Date,
  continuation: boolean,
): number {
  const contentWidth = doc.page.width - MARGIN * 2;
  doc.fillColor("#126b51").font("Helvetica-Bold").fontSize(continuation ? 11 : 14)
    .text("SMAN 2 Cimalaka - Slip Aktivasi Akun Siswa", MARGIN, MARGIN, { width: contentWidth });

  let y = MARGIN + (continuation ? 16 : 22);
  doc.fillColor("#17231f").font("Helvetica").fontSize(8.5)
    .text(`Kelas: ${safeText(className)}${continuation ? " (Lanjutan)" : ""}`, MARGIN, y);

  doc.text(`Dibuat: ${generatedTimestamp(generatedAt)} WIB`, MARGIN + contentWidth / 2, y, {
    width: contentWidth / 2,
    align: "right",
  });

  y += 12;
  doc.text(`Total Siswa di Kelas Ini: ${classTotal}`, MARGIN, y);
  y += 14;

  return y;
}

function drawSlip(
  doc: PDFKit.PDFDocument,
  slip: BulkActivationSlip,
  activationUrl: string,
  y: number,
  contentWidth: number,
): void {
  doc.save()
    .rect(MARGIN, y, contentWidth, SLIP_HEIGHT)
    .fillAndStroke("#ffffff", "#d9e4df")
    .restore();

  doc.save()
    .rect(MARGIN, y, contentWidth, 16)
    .fill("#f2f8f5")
    .restore();

  doc.fillColor("#126b51").font("Helvetica-Bold").fontSize(7)
    .text("SMAN 2 CIMALAKA  •  SLIP AKTIVASI AKUN SISWA RESMI", MARGIN + 8, y + 5);

  doc.save()
    .strokeColor("#e2ebe7")
    .lineWidth(0.5)
    .moveTo(MARGIN, y + 16)
    .lineTo(MARGIN + contentWidth, y + 16)
    .stroke()
    .restore();

  const leftX = MARGIN + 8;
  doc.fillColor("#17231f").font("Helvetica-Bold").fontSize(9)
    .text(safeText(slip.fullName), leftX, y + 22, { width: 290, ellipsis: true });

  doc.fillColor("#60706a").font("Helvetica").fontSize(8)
    .text("NIS: ", leftX, y + 36, { continued: true })
    .fillColor("#17231f").font("Helvetica-Bold")
    .text(safeText(slip.loginId), { continued: true })
    .fillColor("#60706a").font("Helvetica")
    .text("   |   Kelas: ", { continued: true })
    .fillColor("#17231f").font("Helvetica-Bold")
    .text(safeText(slip.className));

  doc.fillColor("#60706a").font("Helvetica").fontSize(7.5)
    .text("Tautan Aktivasi: ", leftX, y + 49, { continued: true })
    .fillColor("#126b51").font("Helvetica-Bold")
    .text(safeText(activationUrl), { width: 290, ellipsis: true });

  const codeBoxX = MARGIN + 310;
  const codeBoxY = y + 20;
  const codeBoxWidth = contentWidth - 318;
  const codeBoxHeight = 44;

  doc.save()
    .roundedRect(codeBoxX, codeBoxY, codeBoxWidth, codeBoxHeight, 3)
    .fillAndStroke("#eef6f3", "#126b51")
    .restore();

  doc.fillColor("#126b51").font("Helvetica-Bold").fontSize(6.5)
    .text("KODE AKTIVASI (SATU KALI PAKAI)", codeBoxX, codeBoxY + 4, {
      width: codeBoxWidth,
      align: "center",
    });

  doc.fillColor("#17231f").font("Courier-Bold").fontSize(9.5)
    .text(safeText(slip.activationCode), codeBoxX, codeBoxY + 14, {
      width: codeBoxWidth,
      align: "center",
    });

  doc.fillColor("#60706a").font("Helvetica").fontSize(6)
    .text(`Berlaku s.d. ${formatExpiryDate(slip.expiresAt)} WIB`, codeBoxX, codeBoxY + 30, {
      width: codeBoxWidth,
      align: "center",
    });

  const instructionY = y + 70;
  const instructionHeight = SLIP_HEIGHT - 70;
  doc.save()
    .rect(MARGIN, instructionY, contentWidth, instructionHeight)
    .fill("#fafcfb")
    .restore();

  doc.save()
    .strokeColor("#e2ebe7")
    .lineWidth(0.5)
    .moveTo(MARGIN, instructionY)
    .lineTo(MARGIN + contentWidth, instructionY)
    .stroke()
    .restore();

  doc.fillColor("#60706a").font("Helvetica").fontSize(6.8)
    .text(
      "Petunjuk Aktivasi: 1. Buka tautan aktivasi di peramban  •  2. Masukkan NIS dan Kode Aktivasi di atas  •  3. Buat kata sandi baru (minimal 10 karakter)  •  4. Gunakan NIS dan kata sandi baru tersebut untuk masuk ke sistem presensi.",
      MARGIN + 8,
      instructionY + 5,
      { width: contentWidth - 16, lineGap: 1 },
    );
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
      const contentWidth = doc.page.width - MARGIN * 2;
      drawClassHeader(doc, input.filteredClass ?? "Semua Kelas", 0, input.generatedAt, false);
      doc.fillColor("#60706a").font("Helvetica").fontSize(10)
        .text("Tidak ada data slip aktivasi untuk kelas yang dipilih.", MARGIN, MARGIN + 80, {
          width: contentWidth,
          align: "center",
        });
    } else {
      for (const className of sortedClasses) {
        const classSlips = classMap.get(className)!;
        let isContinuation = false;

        doc.addPage();
        const contentWidth = doc.page.width - MARGIN * 2;
        const pageBottomLimit = doc.page.height - MARGIN - FOOTER_SPACE;
        let currentY = drawClassHeader(doc, className, classSlips.length, input.generatedAt, isContinuation);

        for (let i = 0; i < classSlips.length; i += 1) {
          const slip = classSlips[i];
          if (currentY + SLIP_HEIGHT > pageBottomLimit) {
            doc.addPage();
            isContinuation = true;
            currentY = drawClassHeader(doc, className, classSlips.length, input.generatedAt, isContinuation);
          }

          drawSlip(doc, slip, input.activationUrl, currentY, contentWidth);
          currentY += SLIP_HEIGHT + SLIP_GAP;
        }
      }
    }

    const range = doc.bufferedPageRange();
    for (let index = range.start; index < range.start + range.count; index += 1) {
      doc.switchToPage(index);
      const contentWidth = doc.page.width - MARGIN * 2;
      doc.fillColor("#60706a").font("Helvetica").fontSize(7)
        .text(
          `Sistem Presensi SMAN 2 Cimalaka | Halaman ${index - range.start + 1} dari ${range.count}`,
          MARGIN,
          doc.page.height - MARGIN - 10,
          { width: contentWidth, align: "center", lineBreak: false },
        );
    }

    doc.end();
  });
}
