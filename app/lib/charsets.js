// Character-set membership is a scalar glyph mapping, independent of the search corpus.
/** @typedef {{total:number, filled:number, mapped:number}} Positions */
/** @typedef {{id:string, group:string, label:string, names:{en:string,zh?:string,hans?:string,ja?:string,ko?:string}, chars:number, total:number, encoded?:number, unencoded?:number, positions?:Positions, codes?:string, records?:{file:string, count:number, glyphs:number}, recordsNote?:boolean, columns?:number, source:{name:string,url:string,dataUrl?:string,note?:string,noteKey?:string,records?:string,version?:string,licence?:string,attribution?:string}}} Charset */
/** @typedef {{id:string, document:string, title:string, source:string, date:string, url:string, status?:string}} ProposalDocument */
/** @typedef {{serial?:string|null, sequence?:string, source?:string|null, document:string, page?:number, glyph?:string, sprite?:{sheet:string, symbol:string}, status?:string, mappedUnicode?:string, mappedCharacter?:string, unifiedWith?:string, mappingKind?:string, mappingEvidence?:string, evidenceUrls?:string[], kind?:'ids', ids?:string}} ProposalRecord */
/** @typedef {{title:string, complete:boolean, scope:string, documents:ProposalDocument[], records:ProposalRecord[]}} ProposalRecords */

/** @type {Promise<Charset[]> | null} */
let catalogue = null
/** @returns {Promise<Charset[]>} */
export function loadCharsets() {
  return catalogue ??= fetch('/charsets/index.json').then(async response => {
    if (!response.ok) throw new Error('Character sets unavailable')
    const data = await response.json()
    if (!Array.isArray(data) || !data.length || data.some(row => !row.id || !row.names)) throw new Error('Invalid character-set catalogue')
    return data
  }).catch(error => { catalogue = null; throw error })
}

/** @type {Map<string, Promise<Set<string>>>} */
const held = new Map()
/** @param {string} id @returns {Promise<Set<string>>} */
export function loadCharset(id) {
  let pending = held.get(id)
  if (!pending) {
    pending = (async () => {
      const entry = (await loadCharsets()).find(set => set.id === id)
      if (!entry) throw new Error('Unknown character set')
      const response = await fetch(`/charsets/${encodeURIComponent(id)}.txt`)
      if (!response.ok || (response.headers.get('content-type') ?? '').includes('text/html')) throw new Error('Character set unavailable')
      // One member per line: a member is a scalar or, for archaic Hangul, a jamo sequence.
      const members = new Set((await response.text()).split('\n').filter(Boolean))
      if (members.size !== entry.chars) throw new Error('Incomplete character set')
      return members
    })().catch(error => { held.delete(id); throw error })
    held.set(id, pending)
  }
  return pending
}

/** @param {string} id */
export async function browseCharset(id) { return [...await loadCharset(id)] }

const collator = new Intl.Collator('en', { numeric: true })
/** Code order across mixed systems: code points first, then the source's own numbering. @param {string} a @param {string} b */
export function compareCodes(a, b) {
  if (a.startsWith('U+') && b.startsWith('U+')) {
    const left = parseInt(a.slice(2), 16)
    const right = parseInt(b.slice(2), 16)
    if (Number.isFinite(left) && Number.isFinite(right) && left !== right) return left - right
  }
  return collator.compare(a, b)
}

/** The counts a coverage dial divides: a designed code table counts positions, a source list counts
 * characters. `filled - mapped` positions hold a character still outside Unicode, and the rest of
 * the design is unassigned.
 * @param {Positions | null | undefined} positions @param {number} encoded @param {number} unencoded
 * @returns {{positioned: boolean, total: number, inUnicode: number, unencoded: number, unassigned: number}} */
export function coverageParts(positions, encoded, unencoded) {
  if (!positions?.total) return { positioned: false, total: encoded + unencoded, inUnicode: encoded, unencoded, unassigned: 0 }
  const inUnicode = positions.mapped
  const unencodedPositions = positions.filled - positions.mapped
  return { positioned: true, total: positions.total, inUnicode, unencoded: unencodedPositions, unassigned: positions.total - positions.filled }
}

/** A private-use slot stands for a glyph without an assigned scalar. @param {string} char */
export function isPrivateUse(char) {
  const cp = char.codePointAt(0) ?? 0
  return cp >= 0xE000 && cp <= 0xF8FF || cp >= 0xF0000 && cp <= 0xFFFFD || cp >= 0x100000 && cp <= 0x10FFFD
}

/** @type {Map<string, Promise<Map<string, string>>>} */
const coded = new Map()
/** The code each member carries in its own set, in source row order. @param {string} id @returns {Promise<Map<string, string>>} */
export function loadCharsetCodes(id) {
  let pending = coded.get(id)
  if (!pending) {
    pending = (async () => {
      const entry = (await loadCharsets()).find(set => set.id === id)
      if (!entry?.codes) return new Map()
      const response = await fetch(entry.codes)
      if (response.status === 404) return new Map()
      if (!response.ok || (response.headers.get('content-type') ?? '').includes('text/html')) throw new Error('Character-set codes unavailable')
      /** @type {Map<string, string>} */
      const codes = new Map()
      for (const line of (await response.text()).split('\n')) {
        const at = line.indexOf('\t')
        if (at < 0) continue
        const char = line.slice(0, at)
        if (char && !codes.has(char)) codes.set(char, line.slice(at + 1))
      }
      return codes
    })().catch(error => { coded.delete(id); throw error })
    coded.set(id, pending)
  }
  return pending
}

/** Characters listed by both sets, counted once. A private-use slot matches only the same slot.
 * @param {Set<string>} a @param {Set<string>} b */
export function sharedCharacters(a, b) {
  let shared = 0
  for (const char of a) if (b.has(char)) shared++
  return shared
}

/** @param {import('./search.js').Answer} answer @param {Set<string>} membership @returns {import('./search.js').Answer} */
export function filterAnswer(answer, membership) {
  const keep = (/** @type {string[]} */ chars) => chars.filter(char => membership.has(char))
  const literal = [...answer.clue.text]
  const isLiteral = answer.clue.kind === 'code' && literal.length > 0 && literal.every(char => membership.has(char))
  return {
    ...answer,
    clue: isLiteral ? { ...answer.clue, kind: 'text' } : answer.clue,
    chars: [...new Set([...keep(answer.chars), ...(isLiteral ? literal : [])])],
    meaning: keep(answer.meaning), parts: keep(answer.parts),
    hits: answer.hits.map(hit => ({ ...hit, chars: keep(hit.chars) })).filter(hit => hit.chars.length),
    readings: answer.readings.map(hit => ({ ...hit, chars: keep(hit.chars) })).filter(hit => hit.chars.length),
  }
}

/** @type {Map<string, Promise<ProposalRecords>>} */
const proposals = new Map()
/** The printed records behind a set, with the glyph images that some documents carry.
 * @param {string} id @returns {Promise<ProposalRecords>} */
export function loadRecords(id) {
  let pending = proposals.get(id)
  if (!pending) {
    pending = (async () => {
      const entry = (await loadCharsets()).find(set => set.id === id)
      if (!entry?.records) throw new Error('No records for this character set')
      const response = await fetch(entry.records.file)
      if (!response.ok || (response.headers.get('content-type') ?? '').includes('text/html')) throw new Error('Character-set records unavailable')
      /** @type {ProposalRecords} */
      const data = await response.json()
      if (!Array.isArray(data.records) || data.records.length !== entry.records.count) throw new Error('Incomplete character-set records')
      return data
    })().catch(error => { proposals.delete(id); throw error })
    proposals.set(id, pending)
  }
  return pending
}
