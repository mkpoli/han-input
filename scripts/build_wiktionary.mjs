// Reads Wiktionary into the meaning index: a word of gloss to the characters it describes. Entries
// themselves are not kept. Writes cache/meaning.tsv, and cache/wikt-forms.tsv for readings of
// Vietnamese and Zhuang words written in Han characters.
//   bun scripts/build_wiktionary.mjs /mnt/f/WikiData/Wiktionary
import { spawn } from 'node:child_process'
import { createWriteStream, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { createInterface } from 'node:readline'
import { CACHE } from './lib.mjs'
import { glossWords } from './sources/meaning.mjs'

const ROOT = process.argv[2] ?? '/mnt/f/WikiData/Wiktionary'
const HAN_LANGS = new Set(['zh', 'cmn', 'yue', 'nan', 'hak', 'wuu', 'och', 'ltc', 'lzh', 'ja', 'ojp', 'ko', 'okm', 'vi', 'za', 'mul'])
const TRANSLATED = new Set(['zh', 'cmn', 'yue', 'ja', 'ko', 'vi', 'lzh'])
const ALL_HAN = /^\p{Script=Han}+$/u

/** @type {Map<string, Map<string, number>>} */
const index = new Map()
/** @param {string} word @param {string} han @param {number} weight */
function add(word, han, weight) {
  let scores = index.get(word)
  if (!scores) index.set(word, scores = new Map())
  const each = weight / Math.max(1, [...han].length ** 2)
  for (const char of han) scores.set(char, (scores.get(char) ?? 0) + each)
}

const forms = createWriteStream(join(CACHE, 'wikt-forms.tsv'))

/** @param {string[]} command */
function lines(command) {
  const child = spawn(command[0], command.slice(1), { stdio: ['ignore', 'pipe', 'inherit'] })
  return createInterface({ input: child.stdout })
}

let seen = 0
for await (const line of lines(['zcat', join(ROOT, 'raw-wiktextract-data.jsonl.gz')])) {
  if (++seen % 1_000_000 === 0) console.log(`  ${seen} entries, ${index.size} words`)
  const code = line.match(/"lang_code": "([\w-]+)"/)?.[1]
  if (!code || !(HAN_LANGS.has(code) || (code === 'en' && line.includes('"translations"')))) continue
  /** @type {any} */
  let entry
  try { entry = JSON.parse(line) } catch { continue }
  const word = entry.word ?? ''
  if (code === 'en') {
    for (const translation of entry.translations ?? []) {
      const han = translation.word ?? ''
      if (TRANSLATED.has(translation.lang_code ?? translation.code) && ALL_HAN.test(han)) add(word.toLowerCase(), han, 8)
    }
    continue
  }
  if (code === 'vi' || code === 'za') {
    for (const form of entry.forms ?? []) {
      if (ALL_HAN.test(form.form ?? '') && [...form.form].length === 1 && /^[\p{L} -]+$/u.test(word) && !ALL_HAN.test(word)) forms.write(`${code}\t${word}\t${form.form}\n`)
    }
  }
  if (!ALL_HAN.test(word)) continue
  for (const sense of entry.senses ?? []) {
    for (const gloss of sense.glosses ?? []) {
      for (const token of glossWords(gloss)) add(token, word, 10)
    }
  }
}
forms.end()
console.log(`English edition done: ${index.size} words`)

// The Chinese and Japanese editions, read for their definition lines.
for (const [label, file] of [['zh', 'Chinese/zhwiktionary-20261101-pages-articles.xml.bz2'], ['ja', 'Japanese/jawiktionary-20261101-pages-articles.xml.bz2']]) {
  let title = ''
  let pages = 0
  for await (const line of lines(['bzcat', join(ROOT, file)])) {
    const heading = line.match(/<title>([^<]+)<\/title>/)
    if (heading) { title = heading[1]; pages++; continue }
    if (!line.startsWith('#') || line.startsWith('#*') || line.startsWith('#:') || !ALL_HAN.test(title)) continue
    const text = line.replace(/\{\{[^{}]*\}\}/g, '').replace(/\[\[(?:[^\]|]*\|)?([^\]]*)\]\]/g, '$1').replace(/&[a-z]+;|<[^>]*>|['#*:]/g, '')
    for (const token of glossWords(text)) add(token, title, 6)
  }
  console.log(`${label}: ${pages} pages, ${index.size} words`)
}

const out = []
for (const [word, scores] of index) {
  const top = [...scores].sort((a, b) => b[1] - a[1]).slice(0, 400).map(([char]) => char)
  if (word && word.length <= 40) out.push(`${word}\t${top.join('')}`)
}
writeFileSync(join(CACHE, 'meaning.tsv'), out.join('\n'))
console.log(`done: ${out.length} words`)
