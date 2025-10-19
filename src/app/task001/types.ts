import type { Span } from "./highlight";

export type Result = {
  tp: Span[];
  fp: Span[];
  fn: Span[];
};
