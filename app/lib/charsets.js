// Character-set membership is a scalar glyph mapping, independent of the search corpus.
/** @typedef {{id:string, group:string, label:string, names:{en:string,zh?:string,hans?:string,ja?:string,ko?:string}, chars:number, total:number, encoded?:number, unencoded?:number, records?:{file:string, count:number, glyphs:number}, source:{name:string,url:string,note?:string,records?:string,version?:string,licence?:string,attribution?:string}}} Charset */
/** @typedef {{id:string, document:string, title:string, source:string, date:string, url:string, status?:string}} ProposalDocument */
/** @typedef {{serial?:string|null, source?:string|null, document:string, page?:number, glyph?:string, status?:string, mappedUnicode?:string, mappedCharacter?:string, mappingKind?:string, mappingEvidence?:string, evidenceUrls?:string[], kind?:'ids'}} ProposalRecord */
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
      const members = new Set([...(await response.text())])
      if (members.size !== entry.chars) throw new Error('Incomplete character set')
      return members
    })().catch(error => { held.delete(id); throw error })
    held.set(id, pending)
  }
  return pending
}

/** @param {string} id */
export async function browseCharset(id) { return [...await loadCharset(id)] }

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
