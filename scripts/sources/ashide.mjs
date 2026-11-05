// 葦手入力: kanji split into shapes drawn from katakana, by 中山春明 (Haruakira Nakayama).
import { readFileSync } from 'node:fs'
import { fetchOnce } from '../lib.mjs'

/** @returns {Promise<import('../lib.mjs').Method[]>} */
export async function ashideMethods() {
  const path = await fetchOnce('https://ashide.otodo.net/files/050/ashide050.txt', 'ashide050.txt')
  const text = new TextDecoder('utf-16le').decode(readFileSync(path))
  /** @type {[string, string][]} */
  const rows = []
  const toKatakana = (/** @type {string} */ s) => s.replace(/[ぁ-ゖ]/g, c => String.fromCharCode(c.charCodeAt(0) + 0x60))
  for (const line of text.split(/\r?\n/)) {
    if (!line || line.startsWith('!') || line.startsWith('﻿!')) continue
    const [code, char] = line.split('\t')
    if (code && char) rows.push([toKatakana(code), char])
  }
  return [{
    id: 'ashide', family: 'shape', keys: 'ア–ン',
    names: { en: 'Ashide', zh: '葦手', ja: '葦手入力', ko: '아시데' },
    source: {
      name: '葦手入力 第5版, ashide050.txt',
      url: 'https://ashide.otodo.net/files/index.html',
      licence: 'None stated for version 5. The 2018 development repository github.com/haruakira/Ashide is GPL-3.0',
      attribution: '中山春明 (Haruakira Nakayama), 2021-12-10',
      version: '5.0',
    },
    entries: rows,
  }]
}
