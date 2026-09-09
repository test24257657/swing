/** Mirrors app/schemas/envelope.py — every payload is wrapped in this. */
export interface Meta {
  /** Human-readable origin, e.g. "NSE bhavcopy + index feed". */
  source: string;
  /** When the nightly job that produced this data finished (IST). */
  as_of: string | null;
  /** True when the artifacts are behind schedule or a source degraded. */
  stale: boolean;
  job: string | null;
  /** Sources that failed in the last run, so the UI can name what is missing. */
  degraded_sources?: string[];
}

export interface Envelope<T> {
  data: T;
  meta: Meta;
}
