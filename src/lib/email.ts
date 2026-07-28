/**
 * Email notification utility.
 * Uses nodemailer with SMTP. If SMTP_HOST is not set, all functions are no-ops.
 */

import nodemailer from 'nodemailer';

function getTransporter() {
  const host = process.env.SMTP_HOST;
  if (!host) return null;

  return nodemailer.createTransport({
    host,
    port: Number(process.env.SMTP_PORT || '587'),
    secure: Number(process.env.SMTP_PORT || '587') === 465,
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS,
    },
  });
}

export async function sendPasswordResetEmail(ownerEmail: string, resetUrl: string): Promise<boolean> {
  try {
    const transporter = getTransporter();
    if (!transporter) return false;
    await transporter.sendMail({
      from: process.env.SMTP_USER || 'noreply@forms.app',
      to: ownerEmail,
      subject: 'Reset your Forms password',
      text: `A password reset was requested for your Forms account.\n\nReset your password: ${resetUrl}\n\nThis link expires in one hour. If you did not request this, you can ignore this email.`,
    });
    return true;
  } catch (error) {
    console.error('Failed to send password reset email:', error);
    return false;
  }
}

export async function sendNewResponseNotification(
  formTitle: string,
  ownerEmail: string,
  responseCount: number
) {
  try {
    const transporter = getTransporter();
    if (!transporter) return; // SMTP not configured, skip silently

    await transporter.sendMail({
      from: process.env.SMTP_USER || 'noreply@forms.app',
      to: ownerEmail,
      subject: `New response on "${formTitle}"`,
      text: `You have received a new response on your form "${formTitle}".\n\nTotal responses: ${responseCount}\n\nView your responses in the Forms dashboard.`,
    });
  } catch (error) {
    console.error('Failed to send email notification:', error);
    // Never fail a response submission because email failed
  }
}
