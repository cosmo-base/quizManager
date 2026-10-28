"use client"

// 実APIモードの設定：GAS の実際の値を読み取りで表示する。変更は GAS のスクリプトプロパティで行う
// （キーやトークンを扱うため、画面からは書き換えない）。自動投稿の停止・再開だけはヘッダーから切り替えられる。
import { RefreshCw } from "lucide-react"
import { Button } from "@/components/ui/button"
import { StatusBadge } from "@/components/shared/status-badge"
import { SettingsCard } from "@/components/settings/fields"
import type { Tone } from "@/lib/constants"
import { useQuiz } from "@/lib/store/quiz-store"

interface Row {
  label: string
  value: string
  tone: Tone
  /** 変える場所（スクリプトプロパティのキー）。null は画面や GAS の関数で変えるもの */
  keyName: string | null
  note?: string
}

function Rows({ rows }: { rows: Row[] }) {
  return (
    <ul className="flex flex-col divide-y divide-border rounded-lg border border-border">
      {rows.map((r) => (
        <li key={r.label} className="flex flex-col gap-1 p-3 sm:flex-row sm:items-center sm:justify-between sm:gap-4">
          <div className="flex min-w-0 flex-col gap-0.5">
            <span className="text-sm">{r.label}</span>
            {r.note && <span className="text-xs text-muted-foreground">{r.note}</span>}
          </div>
          <div className="flex shrink-0 flex-wrap items-center gap-2">
            <StatusBadge tone={r.tone} label={r.value} hideIcon />
            {r.keyName && <code className="rounded bg-muted px-1.5 py-0.5 font-mono text-[11px] text-muted-foreground">{r.keyName}</code>}
          </div>
        </li>
      ))}
    </ul>
  )
}

export function LiveSystemSettings() {
  const { state, actions } = useQuiz()
  const { dryRun, discordDryRun, discordConfigured, ai, config, automation, loading } = state.liveStatus

  if (!config || !ai) {
    return (
      <SettingsCard title="動作設定" description="GAS の設定を読み込めていません。">
        <p className="text-sm text-muted-foreground">GAS を最新のコードで「新しいバージョン」としてデプロイし、再読み込みしてください。</p>
      </SettingsCard>
    )
  }

  const [xv, xt] = dryRun === false ? ["本番投稿", "danger" as Tone] : ["ドライラン", "info" as Tone]
  const [dv, dt] = !discordConfigured ? ["未設定", "muted" as Tone] : discordDryRun === false ? ["本番投稿", "danger" as Tone] : ["ドライラン", "info" as Tone]
  const posting: Row[] = [
    { label: "X への投稿", value: xv, tone: xt, keyName: "X_DRY_RUN", note: "false のときだけ実際に投稿します" },
    { label: "Discord への投稿", value: dv, tone: dt, keyName: "DISCORD_DRY_RUN", note: discordConfigured ? "false のときだけ実際に投稿します" : "Bot（DISCORD_BOT_TOKEN・DISCORD_QUIZ_CHANNEL_ID）が未設定です" },
    { label: "実際に投稿するときの 2 つ目の鍵", value: config.allowLivePost ? "許可" : "止めている", tone: config.allowLivePost ? "warning" : "muted", keyName: "ALLOW_LIVE_POST" },
    { label: "Discord への送信経路", value: config.discordRelay ? "Supabase の中継" : "直接", tone: config.discordRelay ? "success" : discordConfigured ? "warning" : "muted", keyName: "DISCORD_RELAY_URL", note: "GAS から直接だと Discord に拒否されるため、中継が必要です" },
    { label: "管理画面に投稿へのリンクを出す", value: config.discordGuild ? "出す" : "出さない", tone: config.discordGuild ? "success" : "muted", keyName: "DISCORD_GUILD_ID" },
  ]
  const auto: Row[] = [
    { label: "毎朝の自動投稿", value: config.automationEnabled ? "稼働中" : "停止中", tone: config.automationEnabled ? "success" : "warning", keyName: "AUTOMATION_ENABLED", note: "ヘッダーの「自動投稿」から停止・再開できます" },
    { label: "予備問題の最低数（媒体ごと）", value: `${config.spareMinStock} 問`, tone: "neutral", keyName: "SPARE_MIN_STOCK", note: "下回ると 21:00 にメールで知らせます" },
    { label: "運営用チャンネルへの通知", value: config.opsWebhook ? "設定済み" : "未設定（メールで代わり）", tone: config.opsWebhook ? "success" : "warning", keyName: "DISCORD_OPS_WEBHOOK_URL", note: "18:00 の確認依頼・権限の申請・AI 自動生成のお知らせ" },
    { label: "通知メール", value: config.notifyEmail ? "設定済み" : "未設定", tone: config.notifyEmail ? "success" : "warning", keyName: "NOTIFY_EMAIL", note: "投稿の失敗・点検の結果・予備の不足など" },
    { label: "Supabase のハートビート", value: config.supabaseHeartbeat ? "設定済み" : "未設定", tone: config.supabaseHeartbeat ? "success" : "warning", keyName: "SUPABASE_URL / SUPABASE_ANON_KEY", note: "06:00 の起動に使う Supabase が止まらないようにします" },
    { label: "自動処理の時刻", value: automation ? "05:45・06:00・06:10・09:00・12:00・18:00・21:00" : "—", tone: "neutral", keyName: null, note: "時刻を変えるときは GAS の Daily.js と Supabase の pg_cron を変えます" },
  ]
  const daily = ai.daily
  const aiRows: Row[] = [
    { label: "Gemini", value: ai.configured ? "接続済み" : "未設定", tone: ai.configured ? "success" : "warning", keyName: "GEMINI_API_KEY" },
    { label: "生成のモデル", value: ai.model, tone: "neutral", keyName: "GEMINI_MODEL" },
    { label: "ファクトチェックのモデル", value: ai.verifyModel, tone: "neutral", keyName: "GEMINI_VERIFY_MODEL" },
    { label: "ファクトチェックで Google 検索", value: ai.search ? "使う" : "使わない（結果は最高でも要確認）", tone: ai.search ? "success" : "muted", keyName: "GEMINI_SEARCH" },
    { label: "今月の使用量（有料枠換算）", value: `約 ${Math.round(ai.monthCostJpy)} 円 / ${ai.budgetJpy} 円`, tone: ai.monthCostJpy >= ai.budgetJpy ? "danger" : "neutral", keyName: "AI_MONTHLY_BUDGET_JPY" },
    ...(ai.dailyCallLimit !== undefined
      ? [{ label: "今日の呼び出し", value: `${ai.callsToday ?? 0} / ${ai.dailyCallLimit} 回`, tone: (ai.callsToday ?? 0) >= ai.dailyCallLimit ? "danger" : "neutral", keyName: "AI_DAILY_CALL_LIMIT", note: "手動・自動を合わせて数えます" } as Row]
      : []),
    ...(daily
      ? [
          { label: "毎朝 9:00 の自動生成", value: daily.enabled ? "有効" : "停止中", tone: daily.enabled ? "success" : "muted", keyName: "AI_DAILY_GENERATION" } as Row,
          { label: "自動生成の目標数・1 日の上限", value: `目標 ${daily.target} 問・1 日 ${daily.max} 問`, tone: "neutral", keyName: "AI_DAILY_TARGET / AI_DAILY_MAX" } as Row,
          { label: "自動生成した下書きのファクトチェック", value: daily.verify ? "かける" : "かけない", tone: "neutral", keyName: "AI_DAILY_VERIFY" } as Row,
        ]
      : []),
  ]

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-info/40 bg-info/10 px-4 py-3 text-sm">
        <p className="leading-relaxed">
          本番の設定は GAS の「プロジェクトの設定 → スクリプト プロパティ」で変えます（キーやトークンを扱うため、この画面からは変えません）。右の灰色の文字が、変えるときのキーです。
        </p>
        <Button size="sm" variant="outline" onClick={() => actions.refreshLive()} disabled={loading}>
          <RefreshCw className={loading ? "animate-spin" : undefined} aria-hidden />
          再読み込み
        </Button>
      </div>
      <div className="grid grid-cols-1 items-start gap-6 xl:grid-cols-2">
        <SettingsCard title="投稿">
          <Rows rows={posting} />
        </SettingsCard>
        <SettingsCard title="自動処理と通知">
          <Rows rows={auto} />
        </SettingsCard>
        <SettingsCard title="AI（Gemini）">
          <Rows rows={aiRows} />
        </SettingsCard>
      </div>
    </div>
  )
}
