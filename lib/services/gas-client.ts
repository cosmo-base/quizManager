// GAS Web アプリへの送信。通信契約は gas-contract.ts。
// - URL はビルド時に NEXT_PUBLIC_GAS_URL で渡す（秘密ではない。アクセス制御は GAS 側のセッション・ID トークンの検証）
// - Content-Type: text/plain で送る。application/json だと CORS の事前確認が起き、GAS は応答できない
import type { GasAction, GasResponse, GasSession } from "./gas-contract"
import { NotConnectedError } from "./types"

// リポジトリ変数に貼り付けた値の前後の改行・空白で壊れないよう trim する
export const GAS_URL = (process.env.NEXT_PUBLIC_GAS_URL ?? "").trim()

let token: string | null = null
let onAuthExpired: (() => void) | null = null

/** ログインを保持する（GAS が出したセッション。古い GAS なら Google の ID トークン）。保存は google-auth.tsx */
export function setGasToken(next: string | null) {
  token = next
}

/** GAS がログインを受け付けなかったとき（期限切れ）に呼ぶ（google-auth.tsx がログイン画面に戻す） */
export function setAuthExpiredHandler(fn: (() => void) | null) {
  onAuthExpired = fn
}

/** GAS に送る欄：セッションなら { session }、ID トークンなら { idToken } */
function credentialField(): Record<string, string> {
  if (!token) return {}
  return token.startsWith("s1.") ? { session: token } : { idToken: token }
}

export class GasError extends Error {
  constructor(
    public readonly outcome: "failed" | "unknown",
    message: string,
    public readonly reason?: "not_allowed" | "auth",
  ) {
    super(message)
    this.name = "GasError"
  }
}

export async function callGas<T>(action: GasAction, payload: unknown, operation: string): Promise<T> {
  if (!GAS_URL) throw new NotConnectedError(operation, "GAS Web アプリの URL（NEXT_PUBLIC_GAS_URL）が未設定です")
  if (!token) throw new GasError("failed", "Google でログインしてください")

  let res: Response
  try {
    res = await fetch(GAS_URL, {
      method: "POST",
      headers: { "Content-Type": "text/plain;charset=utf-8" },
      body: JSON.stringify({ action, ...credentialField(), payload }),
    })
  } catch {
    // 送信後に切れた可能性があり、GAS 側で処理されたかは分からない
    throw new GasError("unknown", "GAS との通信が途中で切れました。ネットワークを確かめてください（GAS で処理されたかは分かりません）")
  }
  if (!res.ok) throw new GasError("unknown", `GAS が正しく応答しませんでした（HTTP ${res.status}）。少し待ってからやり直してください。続くときは GAS のデプロイを確認してください`)

  let body: GasResponse<T>
  try {
    body = (await res.json()) as GasResponse<T>
  } catch {
    // GAS のエラー画面やログイン画面（HTML）が返ってきたとき
    throw new GasError("unknown", "GAS から想定外の応答が返りました。GAS を新しいバージョンでデプロイしたか、デプロイの URL が変わっていないか確認してください（GAS で処理されたかは分かりません）")
  }
  if (!body.ok) {
    if (body.reason === "auth") onAuthExpired?.()
    throw new GasError(body.outcome, body.error, body.reason)
  }
  return body.data
}

/**
 * ログインを始める：Google の ID トークンかポータルの引換券を渡し、7日もつセッションをもらう。
 * 古い GAS（startSession が無い）なら null（ID トークンをそのまま使う）
 */
export async function startGasSession(cred: { idToken: string } | { ticket: string }): Promise<GasSession | null> {
  if (!GAS_URL) throw new NotConnectedError("ログイン", "GAS Web アプリの URL（NEXT_PUBLIC_GAS_URL）が未設定です")
  let body: GasResponse<GasSession>
  try {
    const res = await fetch(GAS_URL, {
      method: "POST",
      headers: { "Content-Type": "text/plain;charset=utf-8" },
      body: JSON.stringify({ action: "startSession", ...cred, payload: {} }),
    })
    body = (await res.json()) as GasResponse<GasSession>
  } catch {
    throw new GasError("unknown", "GAS に接続できませんでした。ネットワークを確かめてください")
  }
  if (body.ok) return body.data
  if (body.error.startsWith("未対応の操作です")) return null
  throw new GasError(body.outcome, body.error, body.reason)
}
