/**
 * Application-level error codes surfaced by the API and translated into
 * human-readable frontend messages. These are distinct from the contract's
 * own gl.vm.UserError messages, which arrive as raw revert reasons and are
 * mapped separately in apps/web/lib/contractErrors.ts.
 */
export const API_ERROR_CODES = [
  'INVALID_PROPERTY_DATA',
  'INVALID_UNIT',
  'INVALID_AUTHORITY_TYPE',
  'INVALID_EVIDENCE_URL',
  'EVIDENCE_UNAVAILABLE',
  'EVIDENCE_FETCH_FAILED',
  'EVIDENCE_OUTPUT_INVALID',
  'INSUFFICIENT_BOND',
  'CLAIM_NOT_FOUND',
  'CLAIM_NOT_ACTIVE',
  'CLAIM_ALREADY_SETTLED',
  'CLAIM_ALREADY_REVOKED',
  'CLAIM_EXPIRED',
  'CHALLENGE_WINDOW_CLOSED',
  'CHALLENGE_ALREADY_EXISTS',
  'CHALLENGE_NOT_FOUND',
  'UNAUTHORIZED',
  'INVALID_STATE_TRANSITION',
  'NETWORK_UNAVAILABLE',
  'TRANSACTION_REJECTED',
  'TRANSACTION_FAILED',
  'RATE_LIMITED',
  'VALIDATION_ERROR',
  'NOT_FOUND',
  'INTERNAL_ERROR',
] as const;
export type ApiErrorCode = (typeof API_ERROR_CODES)[number];

export const API_ERROR_MESSAGES: Record<ApiErrorCode, string> = {
  INVALID_PROPERTY_DATA: 'The property details provided are invalid or incomplete.',
  INVALID_UNIT: 'The unit identifier could not be understood.',
  INVALID_AUTHORITY_TYPE: 'Please select a valid authority type.',
  INVALID_EVIDENCE_URL: 'The evidence URL must be a valid, publicly accessible address.',
  EVIDENCE_UNAVAILABLE: 'The evidence page could not be reached at this time.',
  EVIDENCE_FETCH_FAILED: 'We were unable to retrieve the evidence page. You can try again.',
  EVIDENCE_OUTPUT_INVALID:
    'Validators could not reach a clear determination from the evidence provided. This claim has been routed to review rather than approved automatically.',
  INSUFFICIENT_BOND: 'The bond amount does not meet the protocol minimum.',
  CLAIM_NOT_FOUND: 'No claim was found with that identifier.',
  CLAIM_NOT_ACTIVE: 'This claim is not in a state that allows this action.',
  CLAIM_ALREADY_SETTLED: 'This claim has already been settled.',
  CLAIM_ALREADY_REVOKED: 'This claim has already been revoked.',
  CLAIM_EXPIRED: 'This claim has expired and is no longer currently verified.',
  CHALLENGE_WINDOW_CLOSED: 'The challenge window for this claim has closed.',
  CHALLENGE_ALREADY_EXISTS: 'This claim already has an open challenge.',
  CHALLENGE_NOT_FOUND: 'No challenge was found with that identifier.',
  UNAUTHORIZED: 'You are not authorized to perform this action.',
  INVALID_STATE_TRANSITION: 'This action is not valid for the claim in its current state.',
  NETWORK_UNAVAILABLE: 'The GenLayer network is temporarily unavailable. Please try again shortly.',
  TRANSACTION_REJECTED: 'The transaction was rejected in your wallet.',
  TRANSACTION_FAILED: 'The transaction failed to complete. No funds were moved.',
  RATE_LIMITED: 'Too many requests. Please wait a moment and try again.',
  VALIDATION_ERROR: 'Some of the information provided is invalid.',
  NOT_FOUND: 'The requested resource was not found.',
  INTERNAL_ERROR: 'Something went wrong on our end. Please try again.',
};

export class ApiError extends Error {
  public readonly code: ApiErrorCode;
  public readonly httpStatus: number;
  public readonly details?: unknown;

  constructor(code: ApiErrorCode, httpStatus = 400, details?: unknown) {
    super(API_ERROR_MESSAGES[code]);
    this.name = 'ApiError';
    this.code = code;
    this.httpStatus = httpStatus;
    this.details = details;
  }
}
