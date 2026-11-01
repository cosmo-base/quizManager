// 予備問題が「不足」かどうか。先の日まで承認済みで埋まっていれば（SPARE_COVER_DAYS 日以上）、予備が少なくても不足にしない。GAS の Evening.js と同じ規則
export function spareShort(spareCount: number, spareMin: number, coveredDays?: number, coverDays?: number): boolean {
  if (spareCount >= spareMin) return false
  return coveredDays === undefined || coverDays === undefined || coveredDays < coverDays
}
