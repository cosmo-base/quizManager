// GAS Web アプリへの送信。通信契約は gas-contract.ts。
// - URL はビルド時に NEXT_PUBLIC_GAS_URL で渡す（秘密ではない。アクセス制御は GAS 側の ID トークン検証）
// - Content-Type: text/plain で送る。application/json だと CORS の事前確認が起き、GAS は応答できない
import type { GasAction, GasResponse } from "./gas-contract"
import { NotConnectedError } from "./types"

// リポジトリ変数に貼り付けた値の前後の改行・空白で壊れないよう trim する
export const GAS_URL = (process.env.NEXT_PUBLIC_GAS_URL ?? "").trim()

let idToken: string | null = null

/** Google ログインで得た ID トークンを保持する（メモリのみ。再読み込みで消える） */
export function setGasIdToken(token: string | null) {
  idToken = token
}

export class GasError extends Error {
  constructor(public readonly outcome: "failed" | "unknown", message: string) {
    super(message)
    this.name = "GasError"
  }
}

export async function callGas<T>(action: GasAction, payload: unknown, operation: string): Promise<T> {
  if (!GAS_URL) throw new NotConnectedError(operation, "GAS Web アプリの URL（NEXT_PUBLIC_GAS_URL）が未設定です")
  if (!idToken) throw new GasError("failed", "Google でログインしてください")

  let res: Response
  try {
    res = await fetch(GAS_URL, {
      method: "POST",
      headers: { "Content-Type": "text/plain;charset=utf-8" },
      body: JSON.stringify({ action, idToken, payload }),
    })
  } catch {
    // 送信後に切れた可能性があり、GAS 側で処理されたかは分からない
    throw new GasError("unknown", "GAS との通信が途中で失敗しました（処理されたかは不明です）")
  }
  if (!res.ok) throw new GasError("unknown", `GAS が HTTP ${res.status} を返しました`)

  const body = (await res.json()) as GasResponse<T>
  if (!body.ok) throw new GasError(body.outcome, body.error)
  return body.data
}
