/* generated using openapi-typescript-codegen -- do not edit */
/* istanbul ignore file */
/* tslint:disable */
/* eslint-disable */
export type UpdateStatusRequest = {
    newStatus: UpdateStatusRequest.newStatus;
};
export namespace UpdateStatusRequest {
    export enum newStatus {
        CREATED = 'CREATED',
        IN_PROCESS = 'IN_PROCESS',
        COMPLETED = 'COMPLETED',
        TRANSFER_PENDING = 'TRANSFER_PENDING',
        TRANSFERRED = 'TRANSFERRED',
        IN_STOCK = 'IN_STOCK',
        SOLD = 'SOLD',
    }
}

