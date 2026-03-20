import nodemailer from "nodemailer";

export async function sendReportEmail({ recipients, subject, text, pdfBuffer, fileName }) {
  const transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: Number(process.env.SMTP_PORT || 587),
    secure: String(process.env.SMTP_SECURE || "false") === "true",
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS
    }
  });

  await transporter.sendMail({
    from: process.env.SMTP_FROM,
    to: recipients.join(","),
    subject,
    text,
    attachments: [
      {
        filename: fileName,
        content: pdfBuffer,
        contentType: "application/pdf"
      }
    ]
  });
}
