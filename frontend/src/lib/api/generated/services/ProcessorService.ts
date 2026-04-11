/* generated using openapi-typescript-codegen -- do not edit */
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
import type { BatchView } from '../models/BatchView';
import type { CreateProcessedBatchRequest } from '../models/CreateProcessedBatchRequest';
import type { UpdateStatusRequest } from '../models/UpdateStatusRequest';
import type { CancelablePromise } from '../core/CancelablePromise';
import { OpenAPI } from '../core/OpenAPI';
import { request as __request } from '../core/request';
export class ProcessorService {
    /**
     * Create processed batch
     * @param requestBody
     * @returns BatchView Created batch from ledger
     * @throws ApiError
     */
    public static postApiProcess(
        requestBody: CreateProcessedBatchRequest,
    ): CancelablePromise<BatchView> {
        return __request(OpenAPI, {
            method: 'POST',
            url: '/api/process',
            body: requestBody,
            mediaType: 'application/json',
            errors: {
                401: `Missing or invalid JWT`,
                403: `Authenticated but insufficient role`,
            },
        });
    }
    /**
     * Update processed batch status
     * @param id Internal batch UUID on the ledger
     * @param requestBody
     * @returns BatchView Updated batch
     * @throws ApiError
     */
    public static patchApiProcessStatus(
        id: string,
        requestBody: UpdateStatusRequest,
    ): CancelablePromise<BatchView> {
        return __request(OpenAPI, {
            method: 'PATCH',
            url: '/api/process/{id}/status',
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
}
