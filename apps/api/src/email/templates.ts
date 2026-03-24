import { type StudioInquiry, STUDIO_SERVICE_LABELS } from "@snc/shared";

// ── Private Helpers ──

const escapeHtml = (str: string): string =>
  str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");

// ── Public API ──

/** Format a studio inquiry into subject, HTML, and plain-text email parts. */
export const formatInquiryEmail = (
  inquiry: StudioInquiry,
): { subject: string; html: string; text: string } => {
  const serviceLabel = STUDIO_SERVICE_LABELS[inquiry.service];
  const subject = `Studio Inquiry: ${serviceLabel} — ${inquiry.name}`;
  const text = [
    `Name: ${inquiry.name}`,
    `Email: ${inquiry.email}`,
    `Service: ${serviceLabel}`,
    ``,
    `Message:`,
    inquiry.message,
  ].join("\n");
  const html = `<h2>Studio Inquiry</h2>
<p><strong>Name:</strong> ${escapeHtml(inquiry.name)}</p>
<p><strong>Email:</strong> <a href="mailto:${escapeHtml(inquiry.email)}">${escapeHtml(inquiry.email)}</a></p>
<p><strong>Service:</strong> ${escapeHtml(serviceLabel)}</p>
<h3>Message</h3>
<p>${escapeHtml(inquiry.message).replace(/\n/g, "<br>")}</p>`;
  return { subject, html, text };
};
