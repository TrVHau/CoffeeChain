/* generated using openapi-typescript-codegen -- do not edit */
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
import type { BatchResponse } from '../models/BatchResponse';
import type { CancelablePromise } from '../core/CancelablePromise';
import { OpenAPI } from '../core/OpenAPI';
import { request as __request } from '../core/request';
export class QueryService {
    /**
     * List batches with optional filters
     * @param type
     * @param status
     * @param ownerMsp
     * @returns BatchResponse List of batches
     * @throws ApiError
     */
    public static getApiBatches(
        type?: 'HARVEST' | 'PROCESSED' | 'ROAST' | 'PACKAGED',
        status?: 'CREATED' | 'IN_PROCESS' | 'COMPLETED' | 'TRANSFER_PENDING' | 'TRANSFERRED' | 'IN_STOCK' | 'SOLD',
        ownerMsp?: 'Org1MSP' | 'Org2MSP',
    ): CancelablePromise<Array<BatchResponse>> {
        return __request(OpenAPI, {
            method: 'GET',
            url: '/api/batches',
            query: {
                'type': type,
                'status': status,
                'ownerMSP': ownerMsp,
            },
            errors: {
                401: `Missing or invalid JWT`,
            },
        });
    }
    /**
     * Get single batch by ID (PostgreSQL or Fabric ledger)
     * @param id Internal batch UUID on the ledger
     * @param source Pass `chain` to read directly from the Fabric ledger
     * @returns BatchResponse Batch detail
     * @throws ApiError
     */
    public static getApiBatch(
        id: string,
        source?: 'chain',
    ): CancelablePromise<BatchResponse> {
        return __request(OpenAPI, {
            method: 'GET',
            url: '/api/batch/{id}',
            path: {
                'id': id,
            },
            query: {
                'source': source,
            },
            errors: {
                401: `Missing or invalid JWT`,
                404: `Resource not found`,
            },
        });
    }
}
