import month01 from '../assets/monthly/month-01.svg'
import month02 from '../assets/monthly/month-02.svg'
import month03 from '../assets/monthly/month-03.svg'
import month04 from '../assets/monthly/month-04.svg'
import month05 from '../assets/monthly/month-05.svg'
import month06 from '../assets/monthly/month-06.svg'
import month07 from '../assets/monthly/month-07.svg'
import month08 from '../assets/monthly/month-08.svg'
import month09 from '../assets/monthly/month-09.svg'
import month10 from '../assets/monthly/month-10.svg'
import month11 from '../assets/monthly/month-11.svg'
import month12 from '../assets/monthly/month-12.svg'

/**
 * 月ごとのイラストと控えめな差し色。
 *
 * SVGは import して使う（ルート絶対パスを書かない）ため、
 * Vite のアセット処理で GitHub Pages の base 配下でも正しく解決される。
 *
 * ここで扱うのは「装飾の色」だけで、次には一切影響させない。
 *   - 土曜日の水色 / 日曜日のピンク / 平日の白背景
 *   - 予定文字の色、表の罫線の基本色
 *   - 警告・エラーの意味色、印刷時の予定文字色
 */
export type MonthTheme = {
  /** 月別イラスト（装飾。読み上げ対象にしない） */
  illustration: string
  /** 見出しや主要ボタンに使う控えめなアクセント（1色） */
  accent: string
  /** ごく薄い背景に使う補助色（1色） */
  accentSoft: string
  /** 枠線に使う中間色 */
  accentBorder: string
}

/** 月番号（1〜12）→ テーマ */
export const monthThemes: Record<number, MonthTheme> = {
  // 1月：雪・梅 → 青灰色
  1: { illustration: month01, accent: '#56778c', accentSoft: '#eef3f6', accentBorder: '#c6d7e0' },
  // 2月：冬・梅 → 淡い紫
  2: { illustration: month02, accent: '#6f6693', accentSoft: '#f1eff6', accentBorder: '#cfcadf' },
  // 3月：春の始まり → 薄い桜色
  3: { illustration: month03, accent: '#8f7080', accentSoft: '#f7f0f2', accentBorder: '#dfcdd4' },
  // 4月：桜・若葉 → 桜色
  4: { illustration: month04, accent: '#a86f85', accentSoft: '#f9f0f3', accentBorder: '#e6ccd5' },
  // 5月：新緑 → 青緑
  5: { illustration: month05, accent: '#3f7d79', accentSoft: '#ecf4f3', accentBorder: '#bcd8d5' },
  // 6月：あじさい → 青紫
  6: { illustration: month06, accent: '#5b6099', accentSoft: '#eff0f7', accentBorder: '#c9cbe2' },
  // 7月：七夕・夏夜 → 藍色
  7: { illustration: month07, accent: '#3f4f7d', accentSoft: '#eef0f6', accentBorder: '#c5cbdd' },
  // 8月：ひまわり・夏空 → 水色
  8: { illustration: month08, accent: '#2f7fa8', accentSoft: '#eaf4f9', accentBorder: '#bcd9e6' },
  // 9月：月・すすき → 落ち着いた金色
  9: { illustration: month09, accent: '#8a6f35', accentSoft: '#f6f1e6', accentBorder: '#ddd0b4' },
  // 10月：紅葉 → 淡い橙
  10: { illustration: month10, accent: '#9a5a34', accentSoft: '#f8efe9', accentBorder: '#e3cbbc' },
  // 11月：いちょう → 黄土色
  11: { illustration: month11, accent: '#7f6533', accentSoft: '#f6f1e4', accentBorder: '#ddd2b3' },
  // 12月：雪・冬 → 冷たい水色
  12: { illustration: month12, accent: '#41748f', accentSoft: '#ecf3f6', accentBorder: '#c2d8e2' },
}

/** 月番号が範囲外でも必ずテーマを返す */
export function getMonthTheme(month: number): MonthTheme {
  return monthThemes[month] ?? monthThemes[1]
}
