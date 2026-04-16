export function normalizeWeightInput(value: string): string {
  return value.trim().replace(',', '.');
}

export function isValidWeightInput(value: string): boolean {
  const normalized = normalizeWeightInput(value);
  return /^\d+(\.\d+)?$/.test(normalized);
}

export function getWeightValidationError(value: string, label = 'Khối lượng'): string | null {
  const normalized = normalizeWeightInput(value);
  if (!normalized) {
    return `${label} không được để trống.`;
  }
  if (!isValidWeightInput(normalized)) {
    return `${label} chỉ chấp nhận số nguyên hoặc số thập phân.`;
  }
  return null;
}
