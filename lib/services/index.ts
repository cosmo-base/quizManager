import type { DataMode } from "@/lib/types"
import { mockBackend } from "./mock-adapter"
import { liveBackend } from "./live-adapter"
import type { QuizBackend } from "./types"

export function getBackend(mode: DataMode): QuizBackend {
  return mode === "demo" ? mockBackend : liveBackend
}

export { NotConnectedError } from "./types"
export type { QuizBackend, InsightRequest } from "./types"
