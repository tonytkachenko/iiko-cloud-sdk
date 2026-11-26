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

/** The documented 200 payload; `void` when the spec describes an empty one. */
export type ResponseOf<P extends Path> =
  PostOp<P> extends { responses: { 200: infer R } }
    ? [Json<R>] extends [never]
      ? void
      : Json<R>
    : unknown;

export interface CallOptions {
  signal?: AbortSignal;
  /** Server-side timeout for this call, in seconds. Defaults to the client option. */
  timeoutSec?: number;
}

/**
 * Arguments of a path-typed call. The body stays optional here so a caller can omit
 * an all-optional body and send no payload; generated methods enforce required bodies.
 */
export type CallArgs<P extends Path> = [body?: RequestOf<P>, options?: CallOptions];
