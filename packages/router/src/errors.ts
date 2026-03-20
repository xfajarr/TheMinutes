export type RoutingErrorCode =
  | "NO_PROVIDERS"        // all candidates filtered out
  | "INVALID_STRATEGY"    // unknown strategy string
  | "INVALID_CONSTRAINTS"; // constraint values are invalid

export class RoutingError extends Error {
  constructor(
    public readonly code: RoutingErrorCode,
    message: string
  ) {
    super(message);
    this.name = "RoutingError";
  }
}
