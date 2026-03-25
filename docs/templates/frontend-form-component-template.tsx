'use client';

/**
 * TEMPLATE: Form Component
 *
 * Copy khi tạo form tạo mới / update batch.
 *
 * Checklist:
 * [ ] Named export (không default export)
 * [ ] Props interface khai báo rõ ràng
 * [ ] State riêng cho form values
 * [ ] Loading state trong khi submit
 * [ ] Error message hiển thị cho user
 * [ ] onSuccess callback để parent biết kết quả
 * [ ] KHÔNG gọi API trực tiếp — nhận onSubmit prop hoặc dùng custom hook
 */

import React, { useState } from 'react';
import type { CreateHarvestBatchRequest } from '@/lib/api/generated';

// ── Props ─────────────────────────────────────────────────────────────────────
interface HarvestBatchFormProps {
  onSubmit: (data: CreateHarvestBatchRequest) => Promise<void>;
  onCancel?: () => void;
}

// ── Types local ───────────────────────────────────────────────────────────────
interface FormState {
  publicCode:    string;
  farmLocation:  string;
  harvestDate:   string;
  coffeeVariety: string;
  weightKg:      string;   // string vì input value luôn string
}

const INITIAL_STATE: FormState = {
  publicCode:    '',
  farmLocation:  '',
  harvestDate:   '',
  coffeeVariety: '',
  weightKg:      '',
};

// ── Component ─────────────────────────────────────────────────────────────────
export function HarvestBatchForm({ onSubmit, onCancel }: HarvestBatchFormProps) {

  const [form, setForm]       = useState<FormState>(INITIAL_STATE);
  const [loading, setLoading] = useState(false);
  const [error, setError]     = useState<string | null>(null);

  // ── Field change handler (generic, tránh lặp) ─────────────────────────────
  function handleChange(e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) {
    const { name, value } = e.target;
    setForm(prev => ({ ...prev, [name]: value }));
    setError(null);   // clear error khi user bắt đầu sửa
  }

  // ── Validation ────────────────────────────────────────────────────────────
  function validate(): string | null {
    if (!form.publicCode.trim())    return 'Mã công khai không được để trống';
    if (!form.farmLocation.trim())  return 'Vị trí vườn không được để trống';
    if (!form.harvestDate)          return 'Ngày thu hoạch không được để trống';
    if (!form.coffeeVariety.trim()) return 'Giống cà phê không được để trống';
    const weight = parseFloat(form.weightKg);
    if (isNaN(weight) || weight <= 0) return 'Trọng lượng phải là số dương';
    return null;
  }

  // ── Submit ────────────────────────────────────────────────────────────────
  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    const validationError = validate();
    if (validationError) {
      setError(validationError);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      await onSubmit({
        publicCode:    form.publicCode.trim(),
        farmLocation:  form.farmLocation.trim(),
        harvestDate:   form.harvestDate,
        coffeeVariety: form.coffeeVariety.trim(),
        weightKg:      parseFloat(form.weightKg),
      });
      setForm(INITIAL_STATE);   // reset sau khi thành công
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Tạo batch thất bại';
      setError(message);
    } finally {
      setLoading(false);
    }
  }

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <form onSubmit={handleSubmit} className="batch-form">
      <h2>Tạo HarvestBatch Mới</h2>

      {error && (
        <div className="form-error" role="alert">
          ❌ {error}
        </div>
      )}

      <div className="form-field">
        <label htmlFor="publicCode">Mã công khai *</label>
        <input
          id="publicCode"
          name="publicCode"
          value={form.publicCode}
          onChange={handleChange}
          placeholder="VD: FARM-20260302-001"
          disabled={loading}
          required
        />
      </div>

      <div className="form-field">
        <label htmlFor="farmLocation">Vị trí vườn *</label>
        <input
          id="farmLocation"
          name="farmLocation"
          value={form.farmLocation}
          onChange={handleChange}
          placeholder="VD: Cầu Đất, Đà Lạt"
          disabled={loading}
          required
        />
      </div>

      <div className="form-field">
        <label htmlFor="harvestDate">Ngày thu hoạch *</label>
        <input
          id="harvestDate"
          name="harvestDate"
          type="date"
          value={form.harvestDate}
          onChange={handleChange}
          disabled={loading}
          required
        />
      </div>

      <div className="form-field">
        <label htmlFor="coffeeVariety">Giống cà phê *</label>
        <input
          id="coffeeVariety"
          name="coffeeVariety"
          value={form.coffeeVariety}
          onChange={handleChange}
          placeholder="VD: Arabica Bourbon"
          disabled={loading}
          required
        />
      </div>

      <div className="form-field">
        <label htmlFor="weightKg">Trọng lượng (kg) *</label>
        <input
          id="weightKg"
          name="weightKg"
          type="number"
          min="0"
          step="0.1"
          value={form.weightKg}
          onChange={handleChange}
          placeholder="VD: 500"
          disabled={loading}
          required
        />
      </div>

      <div className="form-actions">
        <button type="submit" disabled={loading}>
          {loading ? '⏳ Đang xử lý...' : '✅ Tạo Batch'}
        </button>
        {onCancel && (
          <button type="button" onClick={onCancel} disabled={loading}>
            Hủy
          </button>
        )}
      </div>
    </form>
  );
}
