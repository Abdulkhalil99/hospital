export interface ApiResponse<T> {
  success: boolean;
  data?:   T;
  error?:  ApiError;
  meta?:   ResponseMeta;
}

export interface ApiError {
  code:     string;
  message:  string;
  details?: unknown[];
}

export interface ResponseMeta {
  requestId:   string;
  timestamp:   string;
  pagination?: Pagination;
}

export interface Pagination {
  page:       number;
  limit:      number;
  total:      number;
  totalPages: number;
}

export interface PaginatedResponse<T> extends ApiResponse<T[]> {
  meta: ResponseMeta & { pagination: Pagination };
}
