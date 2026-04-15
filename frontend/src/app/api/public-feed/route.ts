import { NextResponse } from 'next/server';

const BACKEND_BASE_URL = process.env.API_BASE_URL ?? 'http://backend:8080';

export async function GET() {
  try {
    const response = await fetch(`${BACKEND_BASE_URL}/api/public-feed`, { cache: 'no-store' });
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }
    return NextResponse.json(await response.json());
  } catch (error) {
    return NextResponse.json(
      { message: error instanceof Error ? error.message : 'Không thể tải dữ liệu công khai.' },
      { status: 502 },
    );
  }
}
