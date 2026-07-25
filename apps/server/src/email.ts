import nodemailer from 'nodemailer';
import { config } from './config.js';

let transporter: nodemailer.Transporter | null = null;

function getTransporter(): nodemailer.Transporter | null {
  if (!config.smtp.enabled) return null;
  if (!transporter) {
    transporter = nodemailer.createTransport({
      host: config.smtp.host,
      port: config.smtp.port,
      secure: config.smtp.secure,
      auth: {
        user: config.smtp.user,
        pass: config.smtp.pass,
      },
    });
  }
  return transporter;
}

export function smtpConfigured(): boolean {
  return config.smtp.enabled;
}

export async function sendDevDownloadEmail(
  to: string,
  label: string,
  downloadUrl: string,
): Promise<boolean> {
  const transport = getTransporter();
  if (!transport) return false;

  const minutes = Math.round(config.devDownloadTokenTtlMs / 60_000);
  await transport.sendMail({
    from: config.smtp.from,
    to,
    subject: `Chat2Chat — ${label} download link`,
    text: [
      `Your one-time download link for ${label}:`,
      downloadUrl,
      '',
      `This link expires in ${minutes} minutes and works once.`,
      'If you did not request this, you can ignore this email.',
    ].join('\n'),
    html: [
      `<p>Your one-time download link for <strong>${label}</strong>:</p>`,
      `<p><a href="${downloadUrl}" style="word-break:break-all">${downloadUrl}</a></p>`,
      `<p style="color:#666">Expires in ${minutes} minutes · single use only.</p>`,
      '<p style="color:#666">If you did not request this, you can ignore this email.</p>',
    ].join(''),
  });
  return true;
}
