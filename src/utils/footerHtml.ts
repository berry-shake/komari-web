import DOMPurify from "dompurify";

// The footer is rich text, not a script/template execution surface.
export function sanitizeFooterHtml(html: string): string {
  return DOMPurify.sanitize(html, {
    USE_PROFILES: { html: true },
    FORBID_TAGS: ["style", "form", "input", "button"],
    FORBID_ATTR: ["style"],
  });
}
