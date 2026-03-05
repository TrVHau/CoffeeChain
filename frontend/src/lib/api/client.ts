// TODO Week 2: Implement đầy đủ axios client với JWT interceptor
// Xem docs/plans/unit5-weekly-plan.md — Tuần 2

import axios from 'axios';

export const apiClient = axios.create({
  baseURL: process.env.NEXT_PUBLIC_API_BASE_URL ?? 'http://localhost:8080',
  headers: { 'Content-Type': 'application/json' },
});

// TODO Week 2: Request interceptor — đính kèm Authorization: Bearer <token>
// apiClient.interceptors.request.use(config => { ... });

// TODO Week 2: Response interceptor — xử lý 401 (clear auth + redirect /login)
// apiClient.interceptors.response.use(res => res, error => { ... });
