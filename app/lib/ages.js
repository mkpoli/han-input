// Unicode DerivedAge 18.0.0: the version that first assigned each code point.
// https://www.unicode.org/Public/18.0.0/ucd/DerivedAge.txt
/** @typedef {[number, number, string]} AgeRange */
/** @typedef {{start: number, end: number, count: number}} VersionRange */
/** @typedef {{version: string, count: number, share: number, ranges: VersionRange[]}} VersionRow */

/** @type {Promise<AgeRange[]> | null} */
let pending = null

/** @returns {Promise<AgeRange[]>} */
export function loadAges() {
  return pending ??= fetch('/charsets/unicode-age.json').then(async response => {
    if (!response.ok) throw new Error('Unicode age data unavailable')
    const data = await response.json()
    if (!Array.isArray(data.ranges) || !data.ranges.length) throw new Error('Invalid Unicode age data')
    return /** @type {AgeRange[]} */ (data.ranges)
  }).catch(error => { pending = null; throw error })
}

/** @param {number} point @param {AgeRange[]} ranges @returns {string | null} */
function versionAt(point, ranges) {
  let low = 0
  let high = ranges.length - 1
  while (low <= high) {
    const middle = (low + high) >> 1
    const [start, end, version] = ranges[middle]
    if (point < start) high = middle - 1
    else if (point > end) low = middle + 1
    else return version
  }
  return null
}

/** @param {string} a @param {string} b */
function compareVersions(a, b) {
  const left = a.split('.').map(Number)
  const right = b.split('.').map(Number)
  for (let index = 0; index < Math.max(left.length, right.length); index++) {
    const difference = (left[index] ?? 0) - (right[index] ?? 0)
    if (difference) return difference
  }
  return 0
}

/** The versions that first assigned a set's characters, with the code point runs of each.
 * @param {Set<string>} members @param {AgeRange[]} ranges @returns {VersionRow[]} */
export function versionRows(members, ranges) {
  const ordered = [...ranges].sort((a, b) => a[0] - b[0])
  /** @type {Map<string, number[]>} */
  const points = new Map()
  for (const char of members) {
    const parts = [...char].map(part => part.codePointAt(0) ?? 0)
    // A member made of several code points is assigned only once its last code point is.
    const version = parts.reduce((latest, point) => {
      const found = versionAt(point, ordered)
      return found && (!latest || compareVersions(found, latest) > 0) ? found : latest
    }, /** @type {string | null} */ (null))
    if (!version) continue
    const point = parts[0]
    const list = points.get(version)
    if (list) list.push(point)
    else points.set(version, [point])
  }
  const total = members.size
  return [...points].map(([version, list]) => {
    list.sort((a, b) => a - b)
    /** @type {VersionRange[]} */
    const runs = []
    for (const point of list) {
      const last = runs[runs.length - 1]
      if (last && point === last.end + 1) {
        last.end = point
        last.count++
      } else runs.push({ start: point, end: point, count: 1 })
    }
    return { version, count: list.length, share: total ? list.length / total : 0, ranges: runs }
  }).sort((a, b) => compareVersions(a.version, b.version))
}
