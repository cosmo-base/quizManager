// 問題詳細は静的書き出し（GitHub Pages）のため、動的ルートではなくクエリで ID を渡す
export const questionHref = (id: string) => `/questions/view?id=${encodeURIComponent(id)}`
