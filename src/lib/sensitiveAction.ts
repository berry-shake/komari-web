export class SensitiveActionError extends Error {
  status: number;

  constructor(message: string, status: number) {
    super(message);
    this.status = status;
  }
}

// Keep verification codes out of URLs, browser history and access logs.
export async function sensitiveRequest(
  path: string,
  options: RequestInit = {},
  code = "",
): Promise<Response> {
  const headers = new Headers(options.headers);
  if (code) headers.set("X-2FA-Code", code);
  const response = await fetch(path, {
    ...options,
    headers,
    credentials: "same-origin",
    cache: "no-store",
  });
  if (!response.ok) {
    const data = await response.json().catch(() => ({}));
    throw new SensitiveActionError(
      data.message || `HTTP error! status: ${response.status}`,
      response.status,
    );
  }
  return response;
}

export function generateAPIKey(): string {
  return "komari-" + Array.from(crypto.getRandomValues(new Uint8Array(32)),
    (byte) => byte.toString(16).padStart(2, "0")).join("");
}

export async function downloadBackup(code: string): Promise<void> {
  const response = await sensitiveRequest("/api/admin/download/backup", {}, code);
  const url = URL.createObjectURL(await response.blob());
  const link = document.createElement("a");
  link.href = url;
  link.download = `komari-backup-${new Date().toISOString().replace(/[:.]/g, "-")}.zip`;
  document.body.appendChild(link);
  link.click();
  link.remove();
  // Allow the browser to start the download before releasing the object URL.
  window.setTimeout(() => URL.revokeObjectURL(url), 60_000);
}
