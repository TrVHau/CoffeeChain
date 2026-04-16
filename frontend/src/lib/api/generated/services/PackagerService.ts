/* generated using openapi-typescript-codegen -- do not edit */
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
import type { BatchView } from '../models/BatchView';
import type { CreatePackagedBatchRequest } from '../models/CreatePackagedBatchRequest';
import type { CancelablePromise } from '../core/CancelablePromise';
import { OpenAPI } from '../core/OpenAPI';
import { request as __request } from '../core/request';
export class PackagerService {
    /**
     * Accept transfer (SBE AND — Org1 + Org2 must endorse)
     * @param id Internal batch UUID on the ledger
     * @returns BatchView Accepted batch
     * @throws ApiError
     */
    public static postApiTransferAccept(
        id: string,
    ): CancelablePromise<BatchView> {
        return __request(OpenAPI, {
            method: 'POST',
            url: '/api/transfer/accept/{id}',
            path: {
                'id': id,
            },
            errors: {
                401: `Missing or invalid JWT`,
                403: `Authenticated but insufficient role`,
            },
        });
    }
    /**
     * Create packaged batch
     * @param requestBody
     * @returns BatchView Created batch from ledger
     * @throws ApiError
     */
    public static postApiPackage(
        requestBody: CreatePackagedBatchRequest,
    ): CancelablePromise<BatchView> {
        return __request(OpenAPI, {
            method: 'POST',
            url: '/api/package',
            body: requestBody,
            mediaType: 'application/json',
            errors: {
                401: `Missing or invalid JWT`,
                403: `Authenticated but insufficient role`,
            },
        });
    }
    /**
     * Get QR code image for a packaged batch
     * @param id Internal batch UUID on the ledger
     * @returns binary PNG QR code image
     * @throws ApiError
     */
    public static getApiPackageQr(
        id: string,
    ): CancelablePromise<Blob> {
        return __request(OpenAPI, {
            method: 'GET',
            url: '/api/package/{id}/qr',
            path: {
                'id': id,
            },
            errors: {
                501: `QrCodeService not yet integrated (Unit-3 pending)`,
            },
        });
    }
}
