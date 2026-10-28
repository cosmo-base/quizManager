// 本番のビルド（GAS の URL と Google ログインのクライアント ID がある）か。本番ではデモモードを出さない。
// サーバー側の部品からも読めるよう、"use client" のモジュールを経由せずビルド時の値を直接読む（前後の改行は無視）
export const LIVE_AVAILABLE = !!(process.env.NEXT_PUBLIC_GAS_URL ?? "").trim() && !!(process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID ?? "").trim()
