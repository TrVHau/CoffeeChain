/* generated using openapi-typescript-codegen -- do not edit */
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
export type TransferRequest = {
    /**
     * ID of the batch to transfer
     */
    batchId: string;
    toMSP: TransferRequest.toMSP;
};
export namespace TransferRequest {
    export enum toMSP {
        ORG2MSP = 'Org2MSP',
    }
}

