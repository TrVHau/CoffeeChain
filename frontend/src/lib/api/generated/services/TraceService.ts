/* generated using openapi-typescript-codegen -- do not edit */
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
import type { TraceResponse } from '../models/TraceResponse';
import type { CancelablePromise } from '../core/CancelablePromise';
import { OpenAPI } from '../core/OpenAPI';
import { request as __request } from '../core/request';
export class TraceService {
    /**
     * Get full provenance trace by public code (no auth required)
     * @param publicCode
     * @returns TraceResponse Full provenance trace
     * @throws ApiError
     */
    public static getApiTrace(
        publicCode: string,
    ): CancelablePromise<TraceResponse> {
        return __request(OpenAPI, {
            method: 'GET',
            url: '/api/trace/{publicCode}',
            path: {
                'publicCode': publicCode,
            },
            errors: {
                404: `Resource not found`,
            },
        });
    }
    /**
     * Get QR code image by public code (no auth required)
     * @param publicCode
     * @returns binary PNG QR code
     * @throws ApiError
     */
    public static getApiQr(
        publicCode: string,
    ): CancelablePromise<Blob> {
        return __request(OpenAPI, {
            method: 'GET',
            url: '/api/qr/{publicCode}',
            path: {
                'publicCode': publicCode,
            },
            errors: {
                501: `QrCodeService not yet integrated`,
            },
        });
    }
}
