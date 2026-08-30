import { publicEnv } from './env';

/**
 * Thin fetch wrapper for the backend's read-only index API. The backend
 * DB row shape does NOT match ClaimRecord/ChallengeRecord (different
 * column names, some fields not stored at all -- e.g. no
 * street_address/city on `claims`, address lives on the separate
 * `properties` table) -- treating it as if it did was a real bug that
 * silently rendered blank address/bond fields on the dashboard. This
 * module is used only to discover *which* claim/challenge IDs belong to
 * a wallet; the actual claim/challenge content always comes from
 * genlayerClient's direct contract reads (see useWalletClaims /
 * useWalletChallenges), which are guaranteed to match ClaimRecord /
 * ChallengeRecord because that's what they're generated from.
 */
class ApiClientError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
    this.name = 'ApiClientError';
  }
}

async function apiFetch<T>(path: string): Promise<T> {
  const response = await fetch(`${publicEnv.NEXT_PUBLIC_API_URL}${path}`);
  if (!response.ok) {
    const body = await response.json().catch(() => ({}));
    throw new ApiClientError(response.status, body?.error?.message ?? `Request failed: ${response.status}`);
  }
  const body = await response.json();
  return body.data as T;
}

export interface Pagination {
  page: number;
  pageSize: number;
  total: number;
}

async function apiFetchPaginated<T>(path: string): Promise<{ data: T; pagination: Pagination }> {
  const response = await fetch(`${publicEnv.NEXT_PUBLIC_API_URL}${path}`);
  if (!response.ok) {
    const body = await response.json().catch(() => ({}));
    throw new ApiClientError(response.status, body?.error?.message ?? `Request failed: ${response.status}`);
  }
  const body = await response.json();
  return { data: body.data as T, pagination: body.pagination as Pagination };
}

export async function getClaimIdsByWallet(address: string): Promise<string[]> {
  const rows = await apiFetch<{ claim_id: string | number }[]>(`/api/v1/wallets/${address}/claims`);
  return rows.map((row) => String(row.claim_id));
}

export async function getChallengeIdsByWallet(address: string): Promise<string[]> {
  const rows = await apiFetch<{ challenge_id: string | number }[]>(`/api/v1/wallets/${address}/challenges`);
  return rows.map((row) => String(row.challenge_id));
}

export interface PropertySearchResult {
  property_key: string;
  city: string;
  state_or_region: string;
  display_address: string | null;
  active_claim_count: number;
  latest_claim_status: string | null;
}

export interface PropertySearchParams {
  q?: string;
  city?: string;
  stateOrRegion?: string;
  page?: number;
  pageSize?: number;
}

export function searchProperties(
  params: PropertySearchParams,
): Promise<{ data: PropertySearchResult[]; pagination: Pagination }> {
  const search = new URLSearchParams();
  if (params.q) search.set('q', params.q);
  if (params.city) search.set('city', params.city);
  if (params.stateOrRegion) search.set('stateOrRegion', params.stateOrRegion);
  if (params.page) search.set('page', String(params.page));
  if (params.pageSize) search.set('pageSize', String(params.pageSize));
  return apiFetchPaginated<PropertySearchResult[]>(`/api/v1/properties/search?${search.toString()}`);
}

export interface ChallengeableClaim {
  claim_id: string;
  claimant_name: string;
  authority_type: string;
  status: string;
  verified_at: string | null;
  verification_expires_at: string | null;
  challenge_window_ends_at: string | null;
  display_address: string | null;
  city: string;
  state_or_region: string;
}

const CHALLENGEABLE_PAGE_SIZE = 12;

export function getChallengeableClaims(
  page: number,
): Promise<{ data: ChallengeableClaim[]; pagination: Pagination }> {
  return apiFetchPaginated<ChallengeableClaim[]>(
    `/api/v1/claims/challengeable?page=${page}&pageSize=${CHALLENGEABLE_PAGE_SIZE}`,
  );
}
