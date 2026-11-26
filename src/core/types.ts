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
}

/** Arguments of a path-typed call: no body when the operation takes none. */
export type CallArgs<P extends Path> = [RequestOf<P>] extends [undefined]
  ? [body?: undefined, options?: CallOptions]
  : [body: RequestOf<P>, options?: CallOptions];
