export interface PaginateOptions {
  page?:  number;
  limit?: number;
}

export interface PaginateResult {
  offset:     number;
  limit:      number;
  page:       number;
  totalPages: (total: number) => number;
}

export function paginate({ page = 1, limit = 20 }: PaginateOptions): PaginateResult {
  const safePage  = Math.max(1, page);
  const safeLimit = Math.min(100, Math.max(1, limit));
  return {
    offset:     (safePage - 1) * safeLimit,
    limit:      safeLimit,
    page:       safePage,
    totalPages: (total: number) => Math.ceil(total / safeLimit),
  };
}
