/* generated using openapi-typescript-codegen -- do not edit */
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
import type { AddEvidenceRequest } from '../models/AddEvidenceRequest';
import type { BatchView } from '../models/BatchView';
import type { CreateRoastBatchRequest } from '../models/CreateRoastBatchRequest';
import type { TransferRequest } from '../models/TransferRequest';
import type { CancelablePromise } from '../core/CancelablePromise';
import { OpenAPI } from '../core/OpenAPI';
import { request as __request } from '../core/request';
export class RoasterService {
    /**
     * Create roast batch
     * @param requestBody
     * @returns BatchView Created batch from ledger
     * @throws ApiError
     */
    public static postApiRoast(
        requestBody: CreateRoastBatchRequest,
    ): CancelablePromise<BatchView> {
        return __request(OpenAPI, {
            method: 'POST',
            url: '/api/roast',
            body: requestBody,
            mediaType: 'application/json',
            errors: {
                401: `Missing or invalid JWT`,
                403: `Authenticated but insufficient role`,
            },
        });
    }
    /**
     * Add IPFS evidence to a roast batch
     * @param id Internal batch UUID on the ledger
     * @param requestBody
     * @returns BatchView Updated batch
     * @throws ApiError
     */
    public static postApiRoastEvidence(
        id: string,
        requestBody: AddEvidenceRequest,
    ): CancelablePromise<BatchView> {
        return __request(OpenAPI, {
            method: 'POST',
            url: '/api/roast/{id}/evidence',
            path: {
                'id': id,
            },
            body: requestBody,
            mediaType: 'application/json',
            errors: {
                401: `Missing or invalid JWT`,
            },
        });
    }
    /**
     * Request transfer of roast batch to Org2 (body: { batchId, toMSP })
     * @param requestBody
     * @returns BatchView Batch with TRANSFER_PENDING status
     * @throws ApiError
     */
    public static postApiTransferRequest(
        requestBody: TransferRequest,
    ): CancelablePromise<BatchView> {
        return __request(OpenAPI, {
            method: 'POST',
            url: '/api/transfer/request',
            body: requestBody,
            mediaType: 'application/json',
            errors: {
                401: `Missing or invalid JWT`,
            },
        });
    }
}
