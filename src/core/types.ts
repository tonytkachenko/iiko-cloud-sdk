import type { paths } from "../generated/schema.js";

/** Every path that has a POST operation. iikoCloud is POST-only apart from one deprecated GET. */
export type Path = {
  [P in keyof paths]: paths[P] extends { post: object } ? P : never;
}[keyof paths];

type PostOp<P extends Path> = paths[P] extends { post: infer O } ? O : never;
type Json<T> = T extends { content: { "application/json": infer B } } ? B : never;

/** The JSON body an operation accepts; `undefined` when it takes none. */
export type RequestOf<P extends Path> =
  PostOp<P> extends { requestBody?: infer R }
    ? [Json<NonNullable<R>>] extends [never]
      ? undefined
      : Json<NonNullable<R>>
    : undefined;

/** Response keys are numeric in the generated schema, so `${K}` normalises both forms. */
type SuccessKey<K> = K extends number | string
  ? `${K}` extends `2${string}`
    ? true
    : false
  : false;

/** Every documented 2xx response of an operation. */
type Success<R> = {
  [K in keyof R]: SuccessKey<K> extends true ? R[K] : never;
}[keyof R];

type ResponseBody<R> = [Success<R>] extends [never]
  ? unknown
  : [Json<Success<R>>] extends [never]
    ? void
    : Json<Success<R>>;

/** The documented 2xx payload; `void` when the spec describes an empty one. */
export type ResponseOf<P extends Path> =
  PostOp<P> extends { responses: infer R } ? ResponseBody<R> : unknown;

export interface CallOptions {
  signal?: AbortSignal;
  /** Server-side timeout for this call, in seconds. Defaults to the client option. */
  timeoutSec?: number;
}

type BodyArgs<P extends Path> = [RequestOf<P>] extends [undefined]
  ? [body?: undefined, options?: CallOptions]
  : {} extends RequestOf<P>
    ? [body?: RequestOf<P>, options?: CallOptions]
    : [body: RequestOf<P>, options?: CallOptions];

/**
 * Arguments of a path-typed call. A body is required when its schema has a required
 * field, and optional otherwise; generated methods enforce the same rule.
 */
export type CallArgs<P extends Path> = BodyArgs<P>;
