export interface ApiEnvelope<T> {
  isSuccess: boolean;
  code: string;
  message: string;
  result: T;
}

export type ApiErrorPayload = {
  isSuccess?: false;
  code?: string;
  message?: string;
  result?: unknown;
};
