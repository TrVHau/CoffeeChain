/* generated using openapi-typescript-codegen -- do not edit */
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
import type { BatchResponse } from './BatchResponse';
import type { FarmActivityItem } from './FarmActivityItem';
import type { LedgerRefItem } from './LedgerRefItem';
export type TraceResponse = {
    batch?: BatchResponse;
    parentChain?: Array<BatchResponse>;
    farmActivities?: Array<FarmActivityItem>;
    ledgerRefs?: Array<LedgerRefItem>;
};

