const MAX_WEIGHT_KG = 100_000; // 100 tấn
const MIN_WEIGHT_KG = 0.001;   // 1 gram

export function normalizeWeightInput(value: string): string {
  return value.trim().replace(',', '.');
}

export function isValidWeightInput(value: string): boolean {
  const normalized = normalizeWeightInput(value);
  if (!/^\d+(\.\d+)?$/.test(normalized)) return false;
  const num = parseFloat(normalized);
  return num >= MIN_WEIGHT_KG && num <= MAX_WEIGHT_KG;
}

export function getWeightValidationError(value: string, label = 'Khối lượng'): string | null {
  const normalized = normalizeWeightInput(value);
  if (!normalized) {
    return `${label} không được để trống.`;
  }
  if (!/^\d+(\.\d+)?$/.test(normalized)) {
    return `${label} chỉ chấp nhận số nguyên hoặc số thập phân (không nhập chữ).`;
  }
  const num = parseFloat(normalized);
  if (num < MIN_WEIGHT_KG) {
    return `${label} phải lớn hơn 0.`;
  }
  if (num > MAX_WEIGHT_KG) {
    return `${label} không được vượt quá ${MAX_WEIGHT_KG.toLocaleString('vi-VN')} kg.`;
  }
  return null;
}

const MAX_ROAST_DURATION = 600; // 10 giờ
const MIN_ROAST_DURATION = 1;

export function getDurationValidationError(value: string, label = 'Thời gian'): string | null {
  const normalized = value.trim();
  if (!normalized) {
    return `${label} không được để trống.`;
  }
  if (!/^\d+$/.test(normalized)) {
    return `${label} chỉ chấp nhận số nguyên dương (phút).`;
  }
  const num = parseInt(normalized, 10);
  if (num < MIN_ROAST_DURATION) {
    return `${label} phải ít nhất ${MIN_ROAST_DURATION} phút.`;
  }
  if (num > MAX_ROAST_DURATION) {
    return `${label} không được vượt quá ${MAX_ROAST_DURATION} phút.`;
  }
  return null;
}

