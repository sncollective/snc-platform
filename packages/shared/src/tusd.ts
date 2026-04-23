// ── Public Types ──

/** Hook event types enabled in the tusd configuration. */
export type TusdHookType =
  | "pre-create"
  | "post-create"
  | "post-receive"
  | "pre-finish"
  | "post-finish"
  | "pre-terminate"
  | "post-terminate";

/** Top-level hook request body sent by tusd to the HTTP hook endpoint. */
export interface TusdHookRequest {
  readonly Type: TusdHookType;
  readonly Event: TusdHookEvent;
}

export interface TusdHookEvent {
  readonly Upload: TusdUpload;
  readonly HTTPRequest: TusdHTTPRequest;
}

export interface TusdUpload {
  /** Unique upload identifier (URI-safe string). */
  readonly ID: string;
  /** Total upload size in bytes. 0 if deferred. */
  readonly Size: number;
  /** True if size was not known at creation time. */
  readonly SizeIsDeferred: boolean;
  /** Number of bytes received so far. */
  readonly Offset: number;
  /**
   * Client-defined metadata from the Upload-Metadata header.
   * Uppy maps `name` to `filename` and `type` to `filetype` automatically.
   * Custom fields: `purpose`, `resourceId`.
   */
  readonly MetaData: Record<string, string>;
  /** True if this is a partial upload (concatenation extension). */
  readonly IsPartial: boolean;
  /** True if this is a final concatenated upload. */
  readonly IsFinal: boolean;
  /** Upload IDs of partial uploads (if IsFinal is true). */
  readonly PartialUploads: readonly string[] | null;
  /** Backend-specific storage details. */
  readonly Storage: TusdStorageS3 | TusdStorageFile;
}

/** Storage details when tusd uses the S3 backend. */
export interface TusdStorageS3 {
  readonly Type: "s3store";
  readonly Bucket: string;
  readonly Key: string;
}

/** Storage details when tusd uses the local filestore backend. */
export interface TusdStorageFile {
  readonly Type: "filestore";
  readonly Path: string;
  readonly InfoPath: string;
}

export interface TusdHTTPRequest {
  readonly Method: string;
  readonly URI: string;
  readonly RemoteAddr: string;
  /**
   * HTTP headers from the original client request.
   * Values are string arrays (HTTP allows repeated headers).
   * Only includes headers listed in `-hooks-http-forward-headers`.
   */
  readonly Header: Record<string, readonly string[]>;
}

/**
 * Response body returned to tusd from the hook endpoint.
 * All fields are optional. Only include what you need.
 */
export interface TusdHookResponse {
  /** Override the HTTP response sent to the tus client. */
  readonly HTTPResponse?: TusdHTTPResponse;
  /** Reject the upload (pre-create only). */
  readonly RejectUpload?: boolean;
  /** Modify upload info before creation (pre-create only). */
  readonly ChangeFileInfo?: TusdChangeFileInfo;
}

export interface TusdHTTPResponse {
  readonly StatusCode: number;
  readonly Body: string;
  readonly Header: Record<string, string>;
}

export interface TusdChangeFileInfo {
  /** Override or add metadata. */
  readonly MetaData?: Record<string, string>;
}
