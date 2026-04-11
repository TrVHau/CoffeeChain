/* generated using openapi-typescript-codegen -- do not edit */
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
import type { BatchView } from '../models/BatchView';
import type { CreateHarvestBatchRequest } from '../models/CreateHarvestBatchRequest';
import type { RecordFarmActivityRequest } from '../models/RecordFarmActivityRequest';
import type { UpdateStatusRequest } from '../models/UpdateStatusRequest';
import type { CancelablePromise } from '../core/CancelablePromise';
import { OpenAPI } from '../core/OpenAPI';
import { request as __request } from '../core/request';
export class FarmerService {
    /**
     * Create harvest batch
     * @param requestBody
     * @returns BatchView Created batch from ledger
     * @throws ApiError
     */
    public static postApiHarvest(
        requestBody: CreateHarvestBatchRequest,
    ): CancelablePromise<BatchView> {
        return __request(OpenAPI, {
            method: 'POST',
            url: '/api/harvest',
            body: requestBody,
            mediaType: 'application/json',
            errors: {
                401: `Missing or invalid JWT`,
                403: `Authenticated but insufficient role`,
            },
        });
    }
    /**
     * Record farm activity on a harvest batch
     * @param id Internal batch UUID on the ledger
     * @param requestBody
     * @returns BatchView Updated batch
     * @throws ApiError
     */
    public static postApiHarvestActivity(
        id: string,
        requestBody: RecordFarmActivityRequest,
    ): CancelablePromise<BatchView> {
        return __request(OpenAPI, {
            method: 'POST',
            url: '/api/harvest/{id}/activity',
            path: {
                'id': id,
            },
            body: requestBody,
            mediaType: 'application/json',
            errors: {
                401: `Missing or invalid JWT`,
                403: `Authenticated but insufficient role`,
            },
        });
    }
    /**
     * Update harvest batch status
     * @param id Internal batch UUID on the ledger
     * @param requestBody
     * @returns BatchView Updated batch
     * @throws ApiError
     */
    public static patchApiHarvestStatus(
        id: string,
        requestBody: UpdateStatusRequest,
    ): CancelablePromise<BatchView> {
        return __request(OpenAPI, {
            method: 'PATCH',
            url: '/api/harvest/{id}/status',
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
