/**
 * File validation rules enforced at the API boundary.
 * Never trust client-reported MIME types — check magic bytes.
 */

const MAGIC_BYTES: Array<{ mime: string; bytes: number[]; offset?: number }> = [
  { mime: "application/pdf", bytes: [0x25, 0x50, 0x44, 0x46] }, // %PDF
  { mime: "image/jpeg", bytes: [0xff, 0xd8, 0xff] },
  { mime: "image/png", bytes: [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a] },
];

export function detectMimeType(buffer: Buffer): string | null {
  for (const sig of MAGIC_BYTES) {
    const offset = sig.offset ?? 0;
    const match = sig.bytes.every((b, i) => buffer[offset + i] === b);
    if (match) return sig.mime;
  }
  return null;
}

export const ALLOWED_MIME_TYPES = new Set([
  "application/pdf",
  "image/jpeg",
  "image/png",
]);

export const MAX_FILE_SIZE_BYTES = 10 * 1024 * 1024; // 10 MB

export type ValidationResult =
  | { ok: true; mimeType: string }
  | { ok: false; error: string };

export function validateUploadedFile(buffer: Buffer, declaredName: string): ValidationResult {
  if (buffer.length === 0) {
    return { ok: false, error: "الملف فارغ" };
  }
  if (buffer.length > MAX_FILE_SIZE_BYTES) {
    return { ok: false, error: "حجم الملف يتجاوز الحد المسموح (10 ميغابايت)" };
  }

  const detectedMime = detectMimeType(buffer);
  if (!detectedMime) {
    return { ok: false, error: "نوع الملف غير مدعوم. المقبول: PDF، JPEG، PNG" };
  }
  if (!ALLOWED_MIME_TYPES.has(detectedMime)) {
    return { ok: false, error: "نوع الملف غير مدعوم. المقبول: PDF، JPEG، PNG" };
  }

  return { ok: true, mimeType: detectedMime };
}

const MIME_TO_EXT: Record<string, string> = {
  "application/pdf": "pdf",
  "image/jpeg": "jpg",
  "image/png": "png",
};

export function mimeToExtension(mime: string): string {
  return MIME_TO_EXT[mime] ?? "bin";
}
