// IRG G-source codes name the Chinese publications and institutions whose characters were
// submitted as evidence. A code is a source, not an encoding: GCH is Cihai, not a code page.
// The definitions and the edition behind each code are in UAX #38, kIRG_GSource.
// https://www.unicode.org/reports/tr38/#kIRG_GSource

/** @typedef {{ en: string, zh: string, hans?: string, ja?: string, ko?: string }} SourceNames */
/** @typedef {{ names: SourceNames, note?: Record<string, string>}} GSource */

/** @type {Record<string, GSource>} */
export const G_SOURCES = {
  GCH: {
    names: { en: 'Cihai', zh: '辭海', hans: '辞海', ja: '辞海', ko: '사해' },
    note: {
      en: 'A large comprehensive dictionary. The IRG source is the 1999 popular edition, Shanghai Lexicographical Publishing House.',
      zh: '大型綜合辭書；IRG採用1999年版普及本（上海辭書出版社）。',
      hans: '大型综合性辞书；IRG采用1999年版普及本（上海辞书出版社）。',
      ja: '大型総合辞書。IRGは1999年版普及本（上海辞書出版社）を使用。',
      ko: '대형 종합 사전. IRG는 1999년 보급판(상하이사서출판사)을 사용한다.',
    },
  },
  GCYY: {
    names: {
      en: 'Chinese Academy of Surveying and Mapping',
      zh: '中國測繪科學研究院用字',
      hans: '中国测绘科学研究院用字',
      ja: '中国測絵科学研究院用字',
      ko: '중국측회과학연구원용자',
    },
    note: {
      en: 'Characters used by the Chinese Academy of Surveying and Mapping, founded in 1959 and now under the Ministry of Natural Resources.',
      zh: '中國測繪科學研究院用字；該院1959年成立，現隸屬自然資源部。',
      hans: '中国测绘科学研究院用字；该院1959年成立，现隶属自然资源部。',
      ja: '中国測絵科学研究院の用字。同院は1959年設立、現在は自然資源部所属。',
      ko: '중국측회과학연구원용자. 1959년 설립되어 현재 자연자원부에 속한다.',
    },
  },
  GBK: {
    names: { en: 'Encyclopedia of China', zh: '中國大百科全書', hans: '中国大百科全书', ja: '中国大百科全書', ko: '중국대백과전서' },
    note: {
      en: 'Characters used in the Encyclopedia of China. The code is not the GBK encoding.',
      zh: '《中國大百科全書》用字；與GBK編碼無關。',
      hans: '《中国大百科全书》用字；与GBK编码无关。',
      ja: '『中国大百科全書』の用字。GBK符号化方式とは無関係。',
      ko: '《중국대백과전서》용자. GBK 인코딩과는 무관하다.',
    },
  },
  GJZ: {
    names: { en: 'Commercial Press', zh: '商務印書館用字', hans: '商务印书馆用字', ja: '商務印書館用字', ko: '상무인서관용자' },
    note: {
      en: 'Characters used by the Commercial Press, founded in Shanghai in 1897 and based in Beijing since 1954.',
      zh: '商務印書館用字；該館1897年創於上海，1954年遷北京。',
      hans: '商务印书馆用字；该馆1897年创于上海，1954年迁北京。',
      ja: '商務印書館の用字。1897年に上海で創立、1954年に北京へ移転。',
      ko: '상무인서관용자. 1897년 상하이에서 창립되어 1954년 베이징으로 이전했다.',
    },
  },
  GZFY: {
    names: { en: 'Hanyu Fangyan Dacidian', zh: '漢語方言大詞典', hans: '汉语方言大词典', ja: '漢語方言大詞典', ko: '한어방언대사전' },
    note: {
      en: 'Characters used in the Hanyu Fangyan Dacidian, a dictionary of Chinese dialects.',
      zh: '《漢語方言大詞典》用字。',
      hans: '《汉语方言大词典》用字。',
    },
  },
  GH: {
    names: {
      en: 'GB/T 15564-1995 (Hong Kong teletext)',
      zh: 'GB/T 15564-1995（香港子集）',
      hans: 'GB/T 15564-1995（香港子集）',
      ja: 'GB/T 15564-1995（香港子集）',
      ko: 'GB/T 15564-1995(홍콩 부분집합)',
    },
    note: {
      en: 'Hong Kong subset of the Han character set for teletext broadcasting.',
      zh: '圖文電視廣播用漢字（香港子集）。',
      hans: '图文电视广播用汉字（香港子集）。',
    },
  },
  GKX: {
    names: { en: 'Kangxi Dictionary', zh: '康熙字典', hans: '康熙字典', ja: '康熙字典', ko: '강희자전' },
    note: {
      en: 'Characters in the 1958 Kangxi Dictionary edition and its supplement.',
      zh: '《康熙字典》1958年版及補遺用字。',
      hans: '《康熙字典》1958年版及补遗用字。',
    },
  },
}

/** GCH appears as GCH-0515.02 in Unihan and as G_CH102999 in IRG evidence lists. */
const ALIASES = /** @type {Record<string, string>} */ ({
  GCH: 'GCH', CH: 'GCH',
  GCYY: 'GCYY', CYY: 'GCYY',
  GBK: 'GBK', BK: 'GBK',
  GJZ: 'GJZ',
  GZFY: 'GZFY', ZFY: 'GZFY',
  GH: 'GH',
  GKX: 'GKX', KX: 'GKX', K: 'GKX',
})

/**
 * The G source a code belongs to, or null when the code is not a known G source.
 * @param {string} code
 * @returns {GSource | null}
 */
export function gSourceOf(code) {
  const upper = code.toUpperCase()
  const body = upper.startsWith('G_') || upper.startsWith('G-') ? upper.slice(2) : upper
  const letters = body.match(/^[A-Z]+/)?.[0] ?? ''
  const key = ALIASES[letters]
  return key ? G_SOURCES[key] ?? null : null
}

/**
 * A source note in the reader's language. Japanese and Korean fall back to English when the
 * source has no note of its own; Chinese locales fall back to the other script.
 * @param {GSource} source
 * @param {string} locale
 * @returns {string}
 */
export function noteOf(source, locale) {
  if (!source.note) return ''
  const key = locale === 'zh-Hant' ? 'zh' : locale
  const fallback = locale === 'ja' || locale === 'ko'
    ? source.note.en
    : source.note.hans ?? source.note.zh ?? source.note.en
  return source.note[key] ?? fallback ?? ''
}
