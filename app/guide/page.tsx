"use client"

// 使い方：本番（正本の Sheets・GAS）での毎日の運用と、困ったときの対処。仕組みを変えたら、ここも直すこと。
import Link from "next/link"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { PageHeader } from "@/components/shared/page-header"

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">{title}</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-3 text-sm leading-relaxed">{children}</CardContent>
    </Card>
  )
}

function Steps({ items }: { items: React.ReactNode[] }) {
  return (
    <ol className="flex flex-col gap-2">
      {items.map((it, i) => (
        <li key={i} className="flex gap-3">
          <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-semibold text-primary">{i + 1}</span>
          <div className="min-w-0 pt-0.5">{it}</div>
        </li>
      ))}
    </ol>
  )
}

function Table({ head, rows }: { head: string[]; rows: React.ReactNode[][] }) {
  return (
    <div className="overflow-x-auto rounded-md border">
      <table className="w-full text-sm">
        <thead className="bg-muted/50">
          <tr>
            {head.map((h) => (
              <th key={h} className="px-3 py-2 text-left font-medium whitespace-nowrap">
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => (
            <tr key={i} className="border-t align-top">
              {r.map((c, j) => (
                <td key={j} className={j === 0 ? "px-3 py-2 font-medium whitespace-nowrap" : "px-3 py-2"}>
                  {c}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

const A = ({ href, children }: { href: string; children: React.ReactNode }) => (
  <Link href={href} className="text-primary underline-offset-2 hover:underline">
    {children}
  </Link>
)
const K = ({ children }: { children: React.ReactNode }) => <code className="rounded bg-muted px-1 py-0.5 font-mono text-xs">{children}</code>

export default function GuidePage() {
  return (
    <div className="flex flex-col gap-6">
      <PageHeader title="使い方" description="毎日宇宙クイズの運用の流れと、困ったときの対処です。正本は Google Sheets で、投稿や自動処理は GAS が行います。" />
      <Tabs defaultValue="daily" className="flex flex-col gap-4">
        <TabsList className="w-full justify-start overflow-x-auto">
          <TabsTrigger value="daily">毎日の流れ</TabsTrigger>
          <TabsTrigger value="create">問題を作る</TabsTrigger>
          <TabsTrigger value="review">確認・承認</TabsTrigger>
          <TabsTrigger value="post">出題日と投稿</TabsTrigger>
          <TabsTrigger value="trouble">困ったとき</TabsTrigger>
          <TabsTrigger value="roles">権限と設定</TabsTrigger>
        </TabsList>

        <TabsContent value="daily" className="flex flex-col gap-4">
          <Section title="人がやること（毎日）">
            <Steps
              items={[
                <>
                  <A href="/">ホーム</A>の「要対応」と、ヘッダーの通知（ベル）を見る。投稿の失敗・成否不明、予備の不足、差し戻しなどが出ます。
                </>,
                <>
                  <A href="/reviews">確認・承認</A>で下書きを「再検証」し、内容を確かめて承認する。出題日を入れれば予約、空欄なら予備になります。
                </>,
                <>
                  <A href="/posts">投稿管理</A>で、明日の分が並んでいるか（21:00 を過ぎていれば「21:00 固定」）を確かめる。予備は媒体ごとに最低数（既定 3 問）を保ちます。
                </>,
                <>
                  投稿の翌朝、<A href="/kpi">KPI</A>で回答数・正答率を見る。気づいたことは <A href="/analytics">AI定性分析</A> にかけて、次の問題づくりに使います。
                </>,
              ]}
            />
            <p className="text-muted-foreground">21:00 までに明日の問題が決まっていなくても、承認済みの予備があれば自動で割り当てられます。予備が 0 問だと、その日は投稿されません。</p>
          </Section>
          <Section title="自動で動くこと（毎日・日本時間）">
            <Table
              head={["時刻", "内容"]}
              rows={[
                ["05:45", "投稿前の点検（今日の問題・認証・設定）。問題があればメールで知らせます"],
                ["06:00", "前日の正解発表（Discord は直前に締め切って集計）→ 今日の問題を投稿。X は投票付き、Discord は 1️⃣2️⃣3️⃣ のリアクションで回答"],
                ["06:10", "06:00 の起動（Supabase）が動かなかったときの予備実行。済んでいれば何もしません"],
                ["09:00", "AI 自動生成。予備・下書きが目標数に足りない分だけ、少ない分類を優先して作り、ファクトチェックまでかけます（下書き止まり。承認は人が行う）"],
                ["12:00", "Supabase のハートビート（無料プランの一時停止を防ぐ）"],
                ["18:00", "明日の確認依頼を運営用チャンネル（未設定ならメール）に送ります"],
                ["21:00", "明日の分を固定。承認済みが 1 問ならそれを、なければ予備から割り当てます。出題済みの問題は予備にしません"],
              ]}
            />
            <p className="text-muted-foreground">
              自動投稿はヘッダーの「自動投稿」から停止・再開できます。止めている間は 06:00 も投稿されません。
            </p>
          </Section>
        </TabsContent>

        <TabsContent value="create" className="flex flex-col gap-4">
          <Section title="問題の作り方（3 通り）">
            <Table
              head={["方法", "場所", "ポイント"]}
              rows={[
                ["AI で作る", <A key="g" href="/generate">AI問題生成</A>, "媒体・数・難易度・分類・テーマを選んで作ります。下書きで保存され、問題文が近く正解も同じ既存の問題は除外されます。1 日の呼び出し回数（既定 25 回）を手動・自動で合わせて数えます"],
                ["手で作る", <A key="q" href="/questions">問題ライブラリ</A>, "「問題を作成」から。難易度・分類・題材もここで付けられます"],
                ["Excel から", <A key="e" href="/questions">問題ライブラリ</A>, "「Excel から登録」。テンプレートをダウンロードして記入するか、手持ちの .xlsx・CSV を選び、見出しの行と列を合わせて取り込みます。1 行ずつ確かめて直せます。媒体「両方」は X 用と Discord 用の 2 問になります。すべて下書きで登録します"],
              ]}
            />
          </Section>
          <Section title="問題のきまり">
            <ul className="list-disc pl-5">
              <li>三択（A・B・C）で、正解は 1 つ。解説は必須です。</li>
              <li>問題文・選択肢・解説・題材に URL を入れない（投稿本文に URL を入れない決まり）。</li>
              <li>X は投票の選択肢が「①」を含めて 25 文字まで。本文（前振り＋問題文＋決まり文句）は 280 まで（全角は 2 と数えるので、前振りと問題文で全角 95 文字ほど）。超えると長文の投稿になって投票が付かないため、承認できません。Discord はメッセージが 2000 文字まで。</li>
              <li>前振り（問題文の前の背景・300 文字まで）は任意。Discord では「そこで今日はこんな問題です。」の前に入ります。</li>
              <li>Discord は問題カード・正解カードの画像が付きます。正解カードの文は「画像用の短い解説」（150 文字まで）、空欄なら解説の冒頭です。問題の画面の「カード画像」で確かめられます。</li>
              <li>難易度（初級・中級・上級）、分類（7 種類）、題材（「木星」など 20 文字まで）は任意。未設定なら、再検証のときに AI が案を出し、「反映」で付けられます。</li>
              <li>保存するたびに新しい版が追記されます。変更点は問題の画面の「バージョン履歴」で見られます。</li>
            </ul>
          </Section>
        </TabsContent>

        <TabsContent value="review" className="flex flex-col gap-4">
          <Section title="確認・承認の流れ">
            <Steps
              items={[
                <>「再検証」で Gemini がファクトチェックします（正解が正しいか・1 つに決まるか・誤答が明確に誤りか・解説が正確か）。今は Google 検索なしのため、結果は最高でも「要確認」です。</>,
                <>懸念点と「類似・関連問題」を見ます。赤い注意（問題文が近く正解も同じ）は同じ問題の可能性、黄色（問題文が近いだけ）は別の問題なら気にしなくて大丈夫です。</>,
                <>問題なければ「承認」。未検証のときは再検証するか、「ファクトチェックなしで承認」から確かめ方を理由に書いて承認します（理由はバージョン履歴のメモに残ります）。検証NG は承認できません。中身を直したら、もう一度再検証が要ります（出題日・難易度・分類・題材だけの変更なら結果は引き継がれます）。</>,
                <>直してほしいときは「差し戻し」、使わないときは「不採用」。どちらも理由を書くと、問題の画面と確認・承認の画面に出ます。</>,
              ]}
            />
          </Section>
        </TabsContent>

        <TabsContent value="post" className="flex flex-col gap-4">
          <Section title="出題日のきまり">
            <ul className="list-disc pl-5">
              <li>出題日を入れて承認 → その日の 06:00 に投稿（予約）。出題日を空欄で承認 → 予備。</li>
              <li>1 日・1 媒体につき 1 問。同じ日に承認済みが 2 問あると、21:00 に固定できず通知が来ます。</li>
              <li>承認済みの問題は、問題の画面の「出題日を設定」で日付を入れたり、予備に戻したりできます。</li>
              <li>再出題は基本的にしません。出題済みの問題に出題日を入れるときは、確認のチェックが要ります。</li>
            </ul>
          </Section>
          <Section title="投稿管理でできること">
            <Table
              head={["状態", "すること"]}
              rows={[
                ["予約済み", "06:00 に自動で投稿されます。「21:00 固定」と出ていれば、その版が投稿されます（固定の後に同じ問題を承認し直したら、承認し直した最新版が投稿されます）"],
                ["失敗", "原因を直して「今すぐ投稿」。手で投稿した場合は「手動投稿を記録」に投稿の URL を入れます"],
                ["成否不明", "投稿先（X・Discord）で投稿があるかを確かめます。あれば「手動投稿を記録」、なければ「今すぐ投稿」。自動では再投稿しません（二重投稿を防ぐため）"],
                ["投稿済み", "翌朝 06:00 に正解発表と結果の取得が自動で行われます。手動なら「正解発表」「結果を取得」。投票がなかった日や、返信で答えてくれた分を数に入れたいときは「結果を手入力」で①②③の数を入れます（入れた数が確定の結果になり、あとで「結果を取得」しても上書きされません）"],
                ["投稿のかたち", "X：問題（①②③の投票）→ 直後にコミュニティーへの誘導をスレッド返信 → 翌朝、問題を引用リポストして正解。Discord：毎朝、前日の問題への返信で正解（正解カード付き）→ 当日の問題（問題カード付き）の 2 通"],
              ]}
            />
          </Section>
        </TabsContent>

        <TabsContent value="trouble" className="flex flex-col gap-4">
          <Section title="よくあること">
            <Table
              head={["こんなとき", "対処"]}
              rows={[
                ["「明日の問題も予備もありません」と通知が来た", "21:00 までに、明日の出題日で問題を承認するか、出題日を空欄にして承認（予備）してください。過ぎた場合は、翌朝 06:00 までに出題日を入れて承認すれば 06:00 に投稿されます"],
                ["「X API のクレジットが不足しています」", "X の開発者ポータルでクレジットを追加し、投稿管理の「今すぐ投稿」でやり直します。投稿・正解発表・結果の取得がすべて止まるので、メールの件名に【至急】が付きます"],
                ["投稿が「成否不明」", "「投稿管理でできること」を参照。投稿先で有無を確かめてから記録します"],
                ["「21:00 に固定した問題が見つかりません／却下された」", "固定後に問題を消したり却下したりすると、06:00 は投稿されません。別の問題を承認して出題日を入れ、正本の post_plan の該当行を消してください"],
                ["予備が最低数を下回った", "下書きを再検証して、出題日を空欄のまま承認します。足りなければ AI 生成か Excel の取り込みで補います"],
                ["AI 生成が「呼び出しの上限」で止まる", "1 日の呼び出し回数（AI_DAILY_CALL_LIMIT）か月の予算（AI_MONTHLY_BUDGET_JPY）に達しています。翌日まで待つか、設定を見直します"],
                ["ログインできない", "Google アカウントが ALLOWED_EMAILS に入っているか確認します。入れたばかりの人は閲覧者なので、設定の「ユーザー・権限」から権限を申請し、管理者が承認します"],
                ["画面の内容が古い", "投稿管理の「正本から再読み込み」か、ブラウザの再読み込みをします"],
              ]}
            />
          </Section>
        </TabsContent>

        <TabsContent value="roles" className="flex flex-col gap-4">
          <Section title="権限">
            <Table
              head={["権限", "できること"]}
              rows={[
                ["管理者", "すべて（権限の付与・申請の承認を含む）"],
                ["編集者", "問題の作成・編集・取り込み、AI 生成、確認依頼、分析"],
                ["承認者", "承認・差し戻し・不採用、出題日の設定、投稿の操作、分析"],
                ["閲覧者", "見るだけ（権限の申請はできます）"],
              ]}
            />
          </Section>
          <Section title="設定の変え方">
            <p>
              本番の設定は GAS の「プロジェクトの設定 → スクリプト プロパティ」で変えます（キーやトークンを扱うため、画面からは変えません）。今の値と、変えるときのキーは <A href="/settings">設定</A> の「動作設定」で見られます。
            </p>
            <ul className="list-disc pl-5">
              <li>
                本番投稿：<K>X_DRY_RUN</K>・<K>DISCORD_DRY_RUN</K> を <K>false</K>、<K>ALLOW_LIVE_POST</K> を許可にしたときだけ実際に投稿します。
              </li>
              <li>
                自動投稿の停止・再開：ヘッダーの「自動投稿」（<K>AUTOMATION_ENABLED</K>）。
              </li>
              <li>
                AI：<K>AI_DAILY_CALL_LIMIT</K>（1 日の呼び出し）、<K>AI_DAILY_TARGET</K>・<K>AI_DAILY_MAX</K>（毎朝の自動生成）、<K>AI_MONTHLY_BUDGET_JPY</K>（月の予算）。
              </li>
              <li>
                GAS のコードを更新したら、Apps Script で「デプロイ → デプロイを管理 → 新しいバージョン」にします。
              </li>
            </ul>
          </Section>
        </TabsContent>
      </Tabs>
    </div>
  )
}
