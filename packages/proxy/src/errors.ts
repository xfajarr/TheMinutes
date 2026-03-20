export type ProxyErrorCode =
  | "ALL_PROVIDERS_FAILED"   // every candidate in the routing decision failed
  | "PAYMENT_FAILED"         // mppx could not complete the 402 flow
  | "TIMEOUT";               // provider did not respond within deadline

export class ProxyError extends Error {
  constructor(
    public readonly code: ProxyErrorCode,
    message: string
  ) {
    super(message);
    this.name = "ProxyError";
  }
}
