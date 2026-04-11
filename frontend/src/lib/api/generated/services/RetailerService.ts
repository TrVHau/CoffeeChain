/* generated using openapi-typescript-codegen -- do not edit */
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
import type { BatchView } from '../models/BatchView';
import type { UpdateStatusRequest } from '../models/UpdateStatusRequest';
import type { CancelablePromise } from '../core/CancelablePromise';
import { OpenAPI } from '../core/OpenAPI';
import { request as __request } from '../core/request';
export class RetailerService {
    /**
     * Update batch status (IN_STOCK or SOLD)
     * @param id Internal batch UUID on the ledger
     * @param requestBody
     * @returns BatchView Updated batch
     * @throws ApiError
     */
    public static patchApiRetailStatus(
        id: string,
        requestBody: UpdateStatusRequest,
    ): CancelablePromise<BatchView> {
        return __request(OpenAPI, {
            method: 'PATCH',
            url: '/api/retail/{id}/status',
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
}
