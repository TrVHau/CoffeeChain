/**
 * Validation helpers for file uploads.
 */

/** Maximum allowed size for evidence image uploads: 10 MB */
export const MAX_EVIDENCE_FILE_SIZE = 10 * 1024 * 1024; // 10 MB

/** Allowed MIME types for evidence images */
const ALLOWED_EVIDENCE_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];

export interface FileValidationResult {
  ok: boolean;
  error?: string;
}

/**
 * Validates an evidence file before upload.
 * Returns an error message if invalid, or { ok: true } if valid.
 * This must be called BEFORE calling dashboardApi.uploadEvidence().
 */
export function validateEvidenceFile(file: File): FileValidationResult {
  if (!ALLOWED_EVIDENCE_TYPES.includes(file.type)) {
    return {
      ok: false,
      error: `Định dạng ảnh không hợp lệ. Chỉ chấp nhận: JPG, PNG, WebP, GIF.`,
    };
  }

  if (file.size > MAX_EVIDENCE_FILE_SIZE) {
    const sizeMB = (file.size / (1024 * 1024)).toFixed(1);
    return {
      ok: false,
      error: `Ảnh quá lớn (${sizeMB} MB). Giới hạn tối đa là 10 MB.`,
    };
  }

  if (file.size === 0) {
    return {
      ok: false,
      error: 'File ảnh không được rỗng.',
    };
  }

  return { ok: true };
}
