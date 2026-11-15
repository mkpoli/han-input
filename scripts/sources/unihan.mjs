// Unihan 18.0: every field a reader could search a character by.
import { createReadStream, readdirSync } from 'node:fs'
import { createInterface } from 'node:readline'
import { execFileSync } from 'node:child_process'
import { join } from 'node:path'
import { CACHE, fetchOnce } from '../lib.mjs'

const SOURCE = (/** @type {string} */ field) => ({
  name: `Unihan 18.0.0, ${field}`,
  url: 'https://www.unicode.org/Public/18.0.0/ucd/Unihan.zip',
  licence: 'Unicode-3.0',
  attribution: 'Copyright Unicode, Inc.',
  version: '18.0.0',
})

const words = (/** @type {string} */ v) => v.split(/\s+/).filter(Boolean)
/** kHanyuPinyin and its kin: `10019.020:tiàn,diàn location:reading`. */
const afterColon = (/** @type {string} */ v) => v.split(/\s+/).flatMap(part => (part.split(':')[1] ?? '').split(',')).filter(Boolean)
const lower = (/** @type {string} */ v) => words(v).map(w => w.toLowerCase())

/** @type {[string, string, import('../lib.mjs').Family, string, string, (v: string) => string[], string?, string?][]} id, field, family, English, 漢字 name, reader, tone, what it names */
const FIELDS = [
  // Readings of today
  ['mandarin', 'kMandarin', 'reading', 'Hanyu Pinyin', '漢語拼音', words, 'pinyin'],
  ['hanyu-pinyin', 'kHanyuPinyin', 'reading', 'Pinyin in Hanyu Da Zidian', '《漢語大字典》拼音', afterColon, 'pinyin'],
  ['xiandai', 'kXHC1983', 'reading', 'Pinyin in Xiandai Hanyu Cidian', '《現代漢語詞典》拼音', afterColon, 'pinyin'],
  ['tghz', 'kTGHZ2013', 'reading', 'Pinyin in Tongyong Guifan Hanzi Zidian', '《通用規範漢字字典》拼音', afterColon, 'pinyin'],
  ['pinlu', 'kHanyuPinlu', 'reading', 'Pinyin in Xiandai Hanyu Pinlu Cidian', '《現代漢語頻率詞典》拼音', v => words(v).map(w => w.replace(/\(.*$/, '')), 'pinyin'],
  ['cantonese', 'kCantonese', 'reading', 'Cantonese (Jyutping)', '粵拼', words],
  ['smszd', 'kSMSZD2003Readings', 'reading', 'Cantonese in Shang Wu Xin Zidian', '《商務新字典》粵音', v => words(v).flatMap(w => (w.split('粵')[1] ?? '').split(',')).filter(Boolean)],
  ['japanese', 'kJapanese', 'reading', 'Japanese readings in kana', '日本語讀音（假名）', words],
  ['japanese-on', 'kJapaneseOn', 'reading', "Japanese on'yomi in romaji", '音讀（羅馬字）', lower],
  ['japanese-kun', 'kJapaneseKun', 'reading', "Japanese kun'yomi in romaji", '訓讀（羅馬字）', lower],
  ['hangul', 'kHangul', 'reading', 'Korean in Hangul', '韓語（諺文）', v => words(v).map(w => w.split(':')[0])],
  ['korean', 'kKorean', 'reading', 'Korean in Yale', '韓語（耶魯）', lower],
  ['vietnamese', 'kVietnamese', 'reading', 'Sino-Vietnamese', '越南漢字音', words],
  ['zhuang', 'kZhuang', 'reading', 'Standard Zhuang', '壯語', words],
  // Old sounds
  ['tang', 'kTang', 'historical', 'Tang reading (Stimson, T’ang Poetic Vocabulary)', '唐代音', words],
  ['fanqie', 'kFanqie', 'historical', 'Fanqie', '反切', words],
  // Shape
  ['cangjie-unihan', 'kCangjie', 'shape', 'Cangjie (Unihan)', '倉頡（Unihan）', lower],
  ['four-corner', 'kFourCornerCode', 'shape', 'Four-Corner', '四角號碼', v => words(v).flatMap(w => [w, w.replace('.', '')])],
  ['strange', 'kStrange', 'shape', 'Strange characters', '怪字分類', words],
  ['strokes', 'kTotalStrokes', 'shape', 'Total strokes', '總筆畫數', words],
  ['radical', 'kRSUnicode', 'index', 'Radical and residual strokes', '部首餘筆', words],
  ['phonetic', 'kPhonetic', 'index', 'Casey phonetic series', 'Casey 諧聲系列', words],
  // Dictionary positions
  ['kangxi', 'kKangXi', 'index', 'Kangxi Dictionary position', '《康熙字典》位置', words],
  ['hanyu-position', 'kHanYu', 'index', 'Hanyu Da Zidian position', '《漢語大字典》位置', words],
  ['morohashi', 'kMorohashi', 'index', 'Morohashi Dai Kan-Wa Jiten number', '《大漢和辭典》編號', words],
  ['sbgy', 'kSBGY', 'index', 'Song Ben Guangyun position', '《宋本廣韻》位置', words],
  ['daejaweon', 'kDaeJaweon', 'index', 'Dae Jaweon position', '《大字源》位置', words],
  ['cihai', 'kCihaiT', 'index', 'Cihai position', '《辭海》位置', words],
  ['nelson', 'kNelson', 'index', 'Nelson number', 'Nelson 編號', words],
  ['matthews', 'kMatthews', 'index', 'Mathews number', 'Mathews 編號', words],
  ['gsr', 'kGSR', 'index', 'Grammata Serica Recensa', '《漢文典》編號', words],
  ['karlgren', 'kKarlgren', 'index', 'Karlgren number', '高本漢《分析字典》編號', words],
  ['meyer-wempe', 'kMeyerWempe', 'index', 'Meyer–Wempe number', 'Meyer–Wempe 編號', words],
  ['fenn', 'kFennIndex', 'index', 'Fenn number', 'Fenn 編號', words],
  ['cowles', 'kCowles', 'index', 'Cowles number', 'Cowles 編號', words],
  ['lau', 'kLau', 'index', 'Lau number', 'Lau 編號', words],
  ['cheung-bauer', 'kCheungBauerIndex', 'index', 'Cheung & Bauer position', 'Cheung & Bauer 位置', words],
  // Encodings
  ['big5', 'kBigFive', 'encoding', 'Big5', '大五碼', lower],
  ['gb0', 'kGB0', 'encoding', 'GB 2312 quwei', 'GB 2312 區位碼', words],
  ['gb1', 'kGB1', 'encoding', 'GB 12345 quwei', 'GB 12345 區位碼', words],
  ['gb3', 'kGB3', 'encoding', 'GB 7589 quwei', 'GB 7589 區位碼', words],
  ['gb5', 'kGB5', 'encoding', 'GB 7590 quwei', 'GB 7590 區位碼', words],
  ['gb7', 'kGB7', 'encoding', 'GB 8565.2 row-cell', 'GB 8565.2 區位碼', words],
  ['gb8', 'kGB8', 'encoding', 'GB 8565 quwei', 'GB 8565 區位碼', words],
  ['jis0', 'kJis0', 'encoding', 'JIS X 0208 kuten', 'JIS X 0208 區點', words],
  ['jis1', 'kJis1', 'encoding', 'JIS X 0212 kuten', 'JIS X 0212 區點', words],
  ['jis0213', 'kJIS0213', 'encoding', 'JIS X 0213 men-ku-ten', 'JIS X 0213 面區點', words],
  ['ibm-japan', 'kIBMJapan', 'encoding', 'IBM Japan code', 'IBM 日本語碼', lower],
  ['cns1986', 'kCNS1986', 'encoding', 'CNS 11643-1986', 'CNS 11643-1986', lower],
  ['cns1992', 'kCNS1992', 'encoding', 'CNS 11643-1992', 'CNS 11643-1992', lower],
  ['cccii', 'kCCCII', 'encoding', 'CCCII', '中文資訊交換碼', lower],
  ['eacc', 'kEACC', 'encoding', 'EACC', '東亞字元集', lower],
  ['xerox', 'kXerox', 'encoding', 'Xerox', 'Xerox 碼', words],
  ['telegraph-mainland', 'kMainlandTelegraph', 'encoding', 'Chinese telegraph code (mainland)', '標準電碼（大陸）', words],
  ['telegraph-taiwan', 'kTaiwanTelegraph', 'encoding', 'Chinese telegraph code (Taiwan)', '標準電碼（臺灣）', words],
  ['mojijoho', 'kMojiJoho', 'encoding', 'MJ Moji Joho number', '文字情報基盤 MJ 編號', words],
  ['irg-g', 'kIRG_GSource', 'encoding', 'IRG source, China', 'IRG 來源（中國）', lower],
  ['irg-t', 'kIRG_TSource', 'encoding', 'IRG source, Taiwan', 'IRG 來源（臺灣）', lower],
  ['irg-j', 'kIRG_JSource', 'encoding', 'IRG source, Japan', 'IRG 來源（日本）', lower],
  ['irg-k', 'kIRG_KSource', 'encoding', 'IRG source, South Korea', 'IRG 來源（韓國）', lower],
  ['irg-kp', 'kIRG_KPSource', 'encoding', 'IRG source, North Korea', 'IRG 來源（朝鮮）', lower],
  ['irg-h', 'kIRG_HSource', 'encoding', 'IRG source, Hong Kong', 'IRG 來源（香港）', lower],
  ['irg-v', 'kIRG_VSource', 'encoding', 'IRG source, Vietnam', 'IRG 來源（越南）', lower],
  ['irg-m', 'kIRG_MSource', 'encoding', 'IRG source, Macao', 'IRG 來源（澳門）', lower],
  ['irg-s', 'kIRG_SSource', 'encoding', 'IRG source, SAT', 'IRG 來源（SAT）', lower],
  ['irg-uk', 'kIRG_UKSource', 'encoding', 'IRG source, United Kingdom', 'IRG 來源（英國）', lower],
  ['irg-u', 'kIRG_USource', 'encoding', 'IRG source, UTC', 'IRG 來源（UTC）', lower],
]

async function unpack() {
  const zip = await fetchOnce('https://www.unicode.org/Public/18.0.0/ucd/Unihan.zip', 'Unihan.zip')
  const dir = join(CACHE, 'unihan')
  execFileSync('unzip', ['-qo', zip, '-d', dir])
  return dir
}

/** Every field of every character. @returns {Promise<Map<string, Map<string, string>>>} field to character to value */
export async function readUnihan() {
  const dir = await unpack()
  /** @type {Map<string, Map<string, string>>} */
  const fields = new Map()
  for (const name of readdirSync(dir)) {
    for await (const line of createInterface({ input: createReadStream(join(dir, name)) })) {
      if (!line.startsWith('U+')) continue
      const [cp, field, value] = line.split('\t')
      const char = String.fromCodePoint(parseInt(cp.slice(2), 16))
      if (!fields.has(field)) fields.set(field, new Map())
      ;/** @type {Map<string, string>} */ (fields.get(field)).set(char, value)
    }
  }
  return fields
}

/** @param {Map<string, Map<string, string>>} fields @returns {import('../lib.mjs').Method[]} */
export function unihanMethods(fields) {
  return FIELDS.filter(([, field]) => fields.has(field)).map(([id, field, family, en, zh, read, tone]) => ({
    id, family, names: { en, zh }, source: SOURCE(field),
    tone: /** @type {'pinyin' | undefined} */ (tone),
    entries: (function* () {
      for (const [char, value] of /** @type {Map<string, string>} */ (fields.get(field))) {
        for (const code of read(value)) if (code) yield /** @type {[string, string]} */ ([code, char])
      }
    })(),
  }))
}

const UNIHAN_BLOCK = (/** @type {number} */ cp) =>
  cp >= 0x4E00 && cp <= 0x9FFF ? 40 : cp >= 0x3400 && cp <= 0x4DBF ? 50 : 60

/** Position given to a character the corpus lacks; it sorts after every listed one. */
export const UNLISTED = 99_999

/**
 * How common a character is, for ordering candidates, low first, as one number:
 * `tier * 1e7 + corpus position * 100 + strokes`. The tier is school grade, then the core sets, then
 * the block. Within a tier the character commoner in classical texts comes first (position 1 is the
 * commonest; a character the corpus lacks takes UNLISTED), then the one with fewer strokes.
 * @param {Map<string, Map<string, string>>} fields @param {Map<string, number>} positions character to corpus position
 */
export function rankChars(fields, positions) {
  const get = (/** @type {string} */ f, /** @type {string} */ c) => fields.get(f)?.get(c)
  /** @type {[string, number, number, string][]} */
  const rows = []
  for (const [char, rs] of /** @type {Map<string, string>} */ (fields.get('kRSUnicode'))) {
    const grade = Number(get('kGradeLevel', char) ?? 0)
    const strokes = Number((get('kTotalStrokes', char) ?? '0').split(' ')[0])
    const tier = grade ? grade
      : get('kJoyoKanji', char) || get('kIICore', char) ? 10
      : get('kJinmeiyoKanji', char) || get('kKoreanEducationHanja', char) ? 20
      : get('kUnihanCore2020', char) ? 30
      : UNIHAN_BLOCK(char.codePointAt(0) ?? 0)
    rows.push([char, tier * 1e7 + Math.min(positions.get(char) ?? UNLISTED, UNLISTED) * 100 + Math.min(strokes, 99), strokes, rs.split(' ')[0]])
  }
  return rows
}
