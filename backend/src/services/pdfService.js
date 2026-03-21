import PDFDocument from "pdfkit";
import dayjs from "dayjs";

const PRIORITY_COLORS = {
  kritisch: "#b42318",
  mittel: "#8a6200",
  niedrig: "#177245"
};

export function buildReportPdf({ report, checks, defects }) {
  return new Promise((resolve, reject) => {
    try {
      const doc = new PDFDocument({ margin: 40, size: "A4", bufferPages: true });
      const chunks = [];

      doc.on("data", (chunk) => chunks.push(chunk));
      doc.on("end", () => resolve(Buffer.concat(chunks)));

      doc.fontSize(20).text("Feuerwehr Checkliste Bericht", { align: "left" });
      doc.moveDown(0.5);

      doc.fontSize(11).text(`Datum: ${dayjs(report.created_at).format("DD.MM.YYYY HH:mm")}`);
      doc.text(`Fahrzeug: ${report.vehicle_name}`);
      doc.text(`Prüfer: ${report.username}`);
      doc.moveDown();

      doc.fontSize(14).text("Checkliste", { underline: true });
      doc.moveDown(0.5);

      checks.forEach((c, index) => {
        doc
          .fontSize(10)
          .text(`${index + 1}. ${c.item_label}`, { continued: true })
          .text(`  [${c.status === "ok" ? "OK" : "Defekt"}]`);

        if (c.comment_text) {
          doc.fillColor("#555555").text(`   Kommentar: ${c.comment_text}`).fillColor("#000000");
        }
      });

      doc.moveDown();
      doc.fontSize(14).text("Mängel", { underline: true });
      doc.moveDown(0.5);

      if (defects.length === 0) {
        doc.fontSize(10).text("Keine Mängel erfasst.");
      } else {
        defects.forEach((d, index) => {
          const priorityColor = PRIORITY_COLORS[d.priority] || "#000000";
          doc
            .fontSize(10)
            .fillColor(priorityColor)
            .text(`${index + 1}. ${d.item_label}`, { continued: true })
            .text(`  | Priorität: ${d.priority}`)
            .fillColor("#000000")
            .text(`   Beschreibung: ${d.description_text}`)
            .text(`   Zeit: ${dayjs(d.timestamp).format("DD.MM.YYYY HH:mm")}`)
            .text(`   Erfasst von: ${d.username}`)
            .moveDown(0.4);
        });
      }

      doc.moveDown(2);
      doc.text("Unterschrift:");
      doc.moveDown(0.8);
      doc.text("________________________________________");

      // Add page numbers to all pages.
      const totalPages = doc.bufferedPageRange().count;
      for (let i = 0; i < totalPages; i++) {
        doc.switchToPage(i);
        doc
          .fontSize(9)
          .fillColor("#888888")
          .text(
            `Seite ${i + 1} von ${totalPages}`,
            doc.page.margins.left,
            doc.page.height - doc.page.margins.bottom - 12,
            { align: "right", width: doc.page.width - doc.page.margins.left - doc.page.margins.right }
          );
      }

      doc.end();
    } catch (error) {
      reject(error);
    }
  });
}
