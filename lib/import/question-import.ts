// Excel・CSV の表 → 登録する問題。見出しの行と列の割り当ては画面で調整できる（初期値は見出しの名前から推測する）。
// 媒体が「両方」の行は、X 用と Discord 用の 2 問として登録する（それぞれ別の ID・別の出題日になる）。
import { strToU8, zipSync } from "fflate"
import type { ImportQuestionInput } from "@/lib/services/gas-contract"
import type { ChoiceLabel, Platform } from "@/lib/types"
import { CHOICE_LABELS, normalizeQuestionText, questionError } from "@/lib/question-validate"

export type ImportPlatform = Exclude<Platform, "instagram"> | "both"

export const FIELDS = [
  { key: "text", label: "問題文", required: true, aliases: ["問題文", "問題", "設問", "クイズ", "question", "q"] },
  { key: "choiceA", label: "選択肢A", required: true, aliases: ["選択肢a", "選択肢1", "選択肢①", "選択肢ア", "答え1", "答え①", "回答1", "回答①", "a", "1", "①", "ア", "選択肢", "choicea", "choice1", "option1"] },
  { key: "choiceB", label: "選択肢B", required: true, aliases: ["選択肢b", "選択肢2", "選択肢②", "選択肢イ", "答え2", "答え②", "回答2", "回答②", "b", "2", "②", "イ", "choiceb", "choice2", "option2"] },
  { key: "choiceC", label: "選択肢C", required: true, aliases: ["選択肢c", "選択肢3", "選択肢③", "選択肢ウ", "答え3", "答え③", "回答3", "回答③", "c", "3", "③", "ウ", "choicec", "choice3", "option3"] },
  { key: "answer", label: "正解", required: true, aliases: ["正解", "答え", "解答", "正答", "answer", "correct"] },
  { key: "explanation", label: "解説", required: true, aliases: ["解説", "説明", "解説文", "explanation"] },
  { key: "platform", label: "媒体", required: false, aliases: ["媒体", "投稿先", "platform", "sns"] },
  { key: "plannedDate", label: "出題日", required: false, aliases: ["出題日", "投稿日", "日付", "予定日", "出題予定日", "投稿予定日", "配信日", "date"] },
  { key: "note", label: "メモ", required: false, aliases: ["メモ", "備考", "note", "memo", "出典", "カテゴリ", "テーマ"] },
] as const

export type FieldKey = (typeof FIELDS)[number]["key"]
/** 項目 → 列番号（0 始まり）。null はその項目を使わない */
export type ColumnMap = Record<FieldKey, number | null>

const norm = (s: string) => s.normalize("NFKC").replace(/[\s:：・_\-()（）【】\[\]]/g, "").toLowerCase()

/** 見出しの名前から列の割り当てを推測する（同じ列を 2 つの項目に使わない） */
export function guessColumns(header: string[]): ColumnMap {
  const map = Object.fromEntries(FIELDS.map((f) => [f.key, null])) as ColumnMap
  const used = new Set<number>()
  const cells = header.map(norm)
  // 完全一致 → 前方一致（「問題文（120字以内）」など）→ 部分一致（「11月の投稿日」など）の順に当てる
  const matchers: ((c: string, a: string) => boolean)[] = [(c, a) => c === a, (c, a) => a.length > 1 && c.startsWith(a), (c, a) => a.length > 1 && c.includes(a)]
  for (const match of matchers) {
    for (const f of FIELDS) {
      if (map[f.key] !== null) continue
      const i = cells.findIndex((c, idx) => !used.has(idx) && c !== "" && f.aliases.some((a) => match(c, norm(a))))
      if (i >= 0) {
        map[f.key] = i
        used.add(i)
      }
    }
  }
  return map
}

/** 見出しの行（1 始まり）を推測する：最初の 10 行で見出しの名前に一番多く当たる行。当たらなければ最初の空でない行 */
export function guessHeaderRow(rows: string[][]): number {
  let best = 0
  let bestScore = 0
  rows.slice(0, 10).forEach((r, i) => {
    const score = Object.values(guessColumns(r)).filter((v) => v !== null).length
    if (score > bestScore) {
      best = i + 1
      bestScore = score
    }
  })
  if (bestScore >= 2) return best
  const first = rows.findIndex((r) => r.some((c) => c.trim()))
  return first >= 0 ? first + 1 : 1
}

/** 列の割り当てに見出しがないとき（見出し行なし）の初期値：A 列から順に */
export function sequentialColumns(): ColumnMap {
  return Object.fromEntries(FIELDS.map((f, i) => [f.key, f.required ? i : null])) as ColumnMap
}

// ---------------------------------------------------------------------------
// 値の読み替え
// ---------------------------------------------------------------------------

/** 正解の列：A/B/C、1/2/3、①②③、「選択肢B」、または正解の選択肢そのものの文字 */
export function parseAnswer(raw: string, choices: string[]): ChoiceLabel | null {
  const v = norm(raw).replace(/^選択肢/, "")
  const byKey: Record<string, ChoiceLabel> = { a: "A", b: "B", c: "C", "1": "A", "2": "B", "3": "C", "①": "A", "②": "B", "③": "C", "1️⃣": "A", "2️⃣": "B", "3️⃣": "C" }
  if (byKey[v]) return byKey[v]
  const i = choices.findIndex((c) => c.trim() && norm(c) === norm(raw))
  return i >= 0 ? CHOICE_LABELS[i] : null
}

/** 媒体の列：空なら既定の媒体 */
export function parsePlatform(raw: string, fallback: ImportPlatform): ImportPlatform | null {
  const v = norm(raw)
  if (!v) return fallback
  if (["両方", "both", "all", "全部", "すべて", "xdiscord", "discordx", "x&discord", "x/discord", "x,discord", "x、discord"].includes(v)) return "both"
  if (["x", "twitter", "ツイッター", "エックス"].includes(v)) return "x"
  if (["discord", "ディスコード", "dc"].includes(v)) return "discord"
  return null
}

const pad = (n: number) => String(n).padStart(2, "0")

/** 出題日の列：Excel の日付（シリアル値）、2026/10/29・2026-10-29・2026年10月29日 など → yyyy-MM-dd */
export function parseDate(raw: string): { value: string | null; error?: string } {
  const v = raw.normalize("NFKC").trim()
  if (!v) return { value: null }
  // Excel の日付は 1899-12-30 からの日数（時刻は小数部）
  if (/^\d{5}(\.\d+)?$/.test(v)) {
    const d = new Date(Date.UTC(1899, 11, 30) + Math.floor(Number(v)) * 86400000)
    return { value: `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}` }
  }
  const m = v.match(/^(\d{4})\s*[-/.年]\s*(\d{1,2})\s*[-/.月]\s*(\d{1,2})\s*日?(\s.*)?$/)
  if (m) {
    const [y, mo, d] = [Number(m[1]), Number(m[2]), Number(m[3])]
    const dt = new Date(Date.UTC(y, mo - 1, d))
    if (dt.getUTCMonth() === mo - 1 && dt.getUTCDate() === d) return { value: `${y}-${pad(mo)}-${pad(d)}` }
  }
  return { value: null, error: `出題日「${raw}」を日付として読めません（2026/11/01 の形にしてください）` }
}

// ---------------------------------------------------------------------------
// 取り込む行
// ---------------------------------------------------------------------------

export interface ImportRow {
  /** Excel の行番号（1 始まり） */
  rowNo: number
  text: string
  choices: string[]
  /** 読み替えられなかったときは null（画面で選び直す） */
  answer: ChoiceLabel | null
  answerRaw: string
  explanation: string
  platform: ImportPlatform | null
  platformRaw: string
  plannedDate: string
  dateError?: string
  note: string
  /** 画面で外した行は登録しない */
  include: boolean
}

export function buildRows(rows: string[][], headerRow: number, columns: ColumnMap, fallbackPlatform: ImportPlatform): ImportRow[] {
  const cell = (r: string[], key: FieldKey) => {
    const i = columns[key]
    return i === null ? "" : String(r[i] ?? "").trim()
  }
  const out: ImportRow[] = []
  rows.forEach((r, idx) => {
    const rowNo = idx + 1
    if (rowNo <= headerRow) return
    if (!r.some((c) => String(c).trim())) return
    const choices = [cell(r, "choiceA"), cell(r, "choiceB"), cell(r, "choiceC")]
    const answerRaw = cell(r, "answer")
    const platformRaw = cell(r, "platform")
    const date = parseDate(cell(r, "plannedDate"))
    out.push({
      rowNo,
      text: cell(r, "text"),
      choices,
      answer: parseAnswer(answerRaw, choices),
      answerRaw,
      explanation: cell(r, "explanation"),
      platform: parsePlatform(platformRaw, fallbackPlatform),
      platformRaw,
      plannedDate: date.value ?? "",
      dateError: date.error,
      note: cell(r, "note"),
      include: true,
    })
  })
  return out
}

export const targetPlatforms = (p: ImportPlatform): Exclude<Platform, "instagram">[] => (p === "both" ? ["x", "discord"] : [p])

/** 行の問題（なければ null）。重複は existing（媒体:正規化した問題文）と、ファイル内のほかの行を見る */
export function rowError(row: ImportRow, existing: Set<string>, others: ImportRow[]): string | null {
  if (row.platform === null) return `媒体「${row.platformRaw}」が読めません（X・Discord・両方のどれか）`
  if (row.answer === null) return row.answerRaw ? `正解「${row.answerRaw}」が読めません（A・B・C のどれか）` : "正解がありません"
  if (row.dateError) return row.dateError
  for (const p of targetPlatforms(row.platform)) {
    const e = questionError({ text: row.text, choices: row.choices, answer: row.answer, explanation: row.explanation }, p)
    if (e) return (row.platform === "both" ? `${p === "x" ? "X" : "Discord"} 用：` : "") + e
    const key = `${p}:${normalizeQuestionText(row.text)}`
    if (existing.has(key)) return `${p === "x" ? "X" : "Discord"} に同じ問題文の問題がすでにあります`
    const dup = others.find((o) => o !== row && o.include && o.platform && targetPlatforms(o.platform).includes(p) && `${p}:${normalizeQuestionText(o.text)}` === key)
    if (dup && dup.rowNo < row.rowNo) return `${dup.rowNo} 行目と同じ問題文です`
  }
  return null
}

/** 登録する問題（「両方」は X 用・Discord 用の 2 つ） */
export function toImportInputs(row: ImportRow, fileName: string): ImportQuestionInput[] {
  if (!row.platform || !row.answer) return []
  const answer = row.answer
  return targetPlatforms(row.platform).map((p) => ({
    ref: `${row.rowNo}:${p}`,
    text: row.text,
    choices: CHOICE_LABELS.map((label, i) => ({ label, text: row.choices[i] })),
    answer,
    explanation: row.explanation,
    platform: p,
    plannedDate: row.plannedDate || null,
    note: [`Excel から登録（${fileName} ${row.rowNo} 行目）`, row.note].filter(Boolean).join(" / "),
  }))
}

// ---------------------------------------------------------------------------
// テンプレート（.xlsx）
// ---------------------------------------------------------------------------

const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;")

const TEMPLATE_ROWS = [
  ["媒体", "問題文", "選択肢A", "選択肢B", "選択肢C", "正解", "解説", "出題日", "メモ"],
  ["X", "太陽系で一番大きな惑星はどれでしょう？", "土星", "木星", "海王星", "B", "木星の直径は地球の約11倍で、太陽系最大の惑星です。", "", "例：X 用"],
  ["両方", "月の表面で、暗く見える平らな部分を何と呼ぶでしょう？", "海", "陸", "谷", "A", "月の「海」は、玄武岩の溶岩が広がってできた平らな低地です。", "", "例：X と Discord の両方に登録"],
]

/** 取り込み用のテンプレートを .xlsx で作る（文字はすべてインライン文字列） */
export function buildTemplateXlsx(): Uint8Array {
  const col = (i: number) => String.fromCharCode(65 + i)
  const rowsXml = TEMPLATE_ROWS.map(
    (r, ri) =>
      `<row r="${ri + 1}">${r.map((v, ci) => (v ? `<c r="${col(ci)}${ri + 1}" t="inlineStr"${ri === 0 ? ' s="1"' : ""}><is><t>${esc(v)}</t></is></c>` : "")).join("")}</row>`,
  ).join("")
  const widths = [8, 50, 16, 16, 16, 6, 50, 12, 24]
  const sheet = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheetViews><sheetView workbookViewId="0"><pane ySplit="1" topLeftCell="A2" activePane="bottomLeft" state="frozen"/></sheetView></sheetViews><cols>${widths.map((w, i) => `<col min="${i + 1}" max="${i + 1}" width="${w}" customWidth="1"/>`).join("")}</cols><sheetData>${rowsXml}</sheetData></worksheet>`
  const styles = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><fonts count="2"><font><sz val="11"/><name val="Calibri"/></font><font><b/><sz val="11"/><name val="Calibri"/></font></fonts><fills count="2"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill></fills><borders count="1"><border/></borders><cellStyleXfs count="1"><xf/></cellStyleXfs><cellXfs count="2"><xf/><xf fontId="1" applyFont="1"/></cellXfs></styleSheet>`
  return zipSync({
    "[Content_Types].xml": strToU8(
      `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/><Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/></Types>`,
    ),
    "_rels/.rels": strToU8(
      `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>`,
    ),
    "xl/workbook.xml": strToU8(
      `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets><sheet name="問題" sheetId="1" r:id="rId1"/></sheets></workbook>`,
    ),
    "xl/_rels/workbook.xml.rels": strToU8(
      `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/><Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/></Relationships>`,
    ),
    "xl/worksheets/sheet1.xml": strToU8(sheet),
    "xl/styles.xml": strToU8(styles),
  })
}
