// How a typed code meets a stored one. The build and the browser share this file, so a code is
// always filed under the form a query will be folded to.

const LATIN_WITH_MARK = /\p{Script=Latin}\p{M}*/gu
const IGNORED = /[\s\-_'’ʼ`·・*=+~]/g

/**
 * Lower case, half width, no tone marks on Latin, hiragana for katakana, no spaces or hyphens. IPA
 * becomes its nearest plain letters, so a dialect reading can be typed on an ordinary keyboard.
 * @param {string} text
 */
export function fold(text) {
  return text.normalize('NFKC').toLowerCase()
    .replace(IPA_LETTERS, letter => IPA[/** @type {keyof typeof IPA} */ (letter)])
    .replace(LATIN_WITH_MARK, part => part.normalize('NFD').replace(/\p{M}/gu, ''))
    .replace(/[ァ-ヶ]/g, kana => String.fromCharCode(kana.charCodeAt(0) - 0x60))
    .replace(IGNORED, '')
}

const IPA = { 'ŋ': 'ng', 'ɲ': 'ny', 'ɐ': 'a', 'ɑ': 'a', 'ᴀ': 'a', 'ɒ': 'o', 'ɔ': 'o', 'ɛ': 'e', 'ə': 'e', 'ɜ': 'e', 'ɤ': 'e', 'æ': 'a', 'ɪ': 'i', 'ɨ': 'i', 'ʉ': 'u', 'ʊ': 'u', 'ɯ': 'u', 'ʏ': 'y', 'ø': 'o', 'œ': 'o', 'ɵ': 'o', 'ʰ': 'h', 'ʃ': 'sh', 'ʂ': 'sh', 'ʒ': 'zh', 'ʐ': 'r', 'ɕ': 'x', 'ʑ': 'z', 'ɿ': 'i', 'ʅ': 'i', 'ʮ': 'y', 'ʯ': 'y', 'ɦ': 'h', 'ɡ': 'g', 'ʔ': 'q', 'ː': '' }
const IPA_LETTERS = new RegExp(`[${Object.keys(IPA).join('')}]`, 'gu')

const TONE_MARKS = { '̄': '1', '́': '2', '̌': '3', '̀': '4' }

/** `zhōng` as `zhong1`, `lǜ` as `lv4`, so a tone can be typed as a digit. @param {string} syllable */
export function pinyinDigits(syllable) {
  const parts = syllable.normalize('NFD').toLowerCase()
  const tone = [...parts].map(c => TONE_MARKS[/** @type {keyof typeof TONE_MARKS} */ (c)]).find(Boolean) ?? '5'
  return parts.replace(/ü/g, 'v').replace(/\p{M}/gu, '') + tone
}

// The runtime's Unicode tables lag the data's: Bun 1.3 and Node both reject U+2B81E and U+1B127. Planes 2
// and 3 hold only Han and these blocks only kana, so the code points themselves say what a character is.
const HAN = '\\p{Script=Han}\\u{20000}-\\u{3FFFD}'
const KANA = '\\p{Script=Hiragana}\\p{Script=Katakana}\\u{1AFF0}-\\u{1B16F}'
const NUSHU = '\\p{Script=Nushu}'

/** Whether a string is exactly one Han character. @param {string} text */
export const isHan = text => new RegExp(`^[${HAN}]$`, 'u').test(text)

/**
 * Whether a string is one character of a script this site covers: Han with its extended forms, and the
 * kana and Nüshu derived from it. Siniform scripts such as Tangut, Jurchen and Khitan are out.
 * @param {string} text
 */
export const inScope = text => new RegExp(`^[${HAN}${KANA}${NUSHU}]$`, 'u').test(text)

/** Whether a string is one hentaigana, archaic or other kana of the supplement blocks. @param {string} text */
export const isRareKana = text => /^[\u{1AFF0}-\u{1B16F}]$/u.test(text)

/** The Han and Nüshu characters of a string, in order. Kana stays out: a run of it is a code or a reading. @param {string} text @returns {string[]} */
export const hanIn = text => text.match(new RegExp(`[${HAN}${NUSHU}]`, 'gu')) ?? []

const BUCKETS = 4096

/** FNV-1a over the code units. @param {string} text */
function hash(text) {
  let value = 0x811c9dc5
  for (let i = 0; i < text.length; i++) {
    value ^= text.charCodeAt(i)
    value = Math.imul(value, 0x01000193)
  }
  return value >>> 0
}

/** The file under `c/` holding every code that starts with this folded text's first two characters. @param {string} folded */
export function codeBucket(folded) {
  return (hash([...folded].slice(0, 2).join('')) % BUCKETS).toString(16).padStart(3, '0')
}

/** The file under `x/` holding every code of a character. @param {string} char */
export const charBucket = char => ((char.codePointAt(0) ?? 0) >> 8).toString(16)

/** The file under `m/` holding a meaning word. @param {string} word */
export const wordBucket = word => (hash(word) % 1024).toString(16).padStart(3, '0')

/** The file under `p/` holding the characters a part appears in. @param {string} part */
export const partBucket = part => ((part.codePointAt(0) ?? 0) >> 8).toString(16)

/** The file under `g/` holding the characters written with a run of parts. @param {string} run */
export const runBucket = run => (hash(run) % BUCKETS).toString(16).padStart(3, '0')
