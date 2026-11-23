declare const __API_CONTRACT_HASH__: string;

/**
 * A hash of `api/openapi.json`, computed at build time. It changes exactly when the shape of the
 * API's responses can, so it's the offline cache's buster.
 */
export const apiContractHash: string = __API_CONTRACT_HASH__;
