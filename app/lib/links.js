// The sites that say more about a character. This site finds it; the entry lives with them. Most of
// them cover Han alone, and `every` marks those that also have kana and Nüshu.
const cp = (/** @type {string} */ char) => (char.codePointAt(0) ?? 0).toString(16)
const e = encodeURIComponent

/** @type {{ key: string, name: string, kind: 'all' | 'dict' | 'sound' | 'shape', url: (char: string) => string, deep: boolean, every?: boolean }[]} */
export const LINKS = [
  { key: 'zitools', name: '字統網 zi.tools', kind: 'all', deep: true, url: c => `https://zi.tools/zi/${e(c)}` },
  { key: 'zdic', name: '漢典 zdic', kind: 'dict', deep: true, url: c => `https://www.zdic.net/hans/${e(c)}` },
  { key: 'yedict', name: '新葉典 yedict', kind: 'dict', deep: true, url: c => `http://www.yedict.com/z/U${cp(c).toUpperCase().padStart(5, '0')}` },
  { key: 'wikt-en', every: true, name: 'Wiktionary (en)', kind: 'dict', deep: true, url: c => `https://en.wiktionary.org/wiki/${e(c)}` },
  { key: 'wikt-zh', every: true, name: '維基詞典 (zh)', kind: 'dict', deep: true, url: c => `https://zh.wiktionary.org/wiki/${e(c)}` },
  { key: 'wikt-ja', every: true, name: 'ウィクショナリー (ja)', kind: 'dict', deep: true, url: c => `https://ja.wiktionary.org/wiki/${e(c)}` },
  { key: 'yindian', name: '音典 Yindian', kind: 'sound', deep: true, url: c => `https://nk2028.shn.hk/yindian/?q=${e(c)}` },
  { key: 'ytenx', name: '韻典網 ytenx', kind: 'sound', deep: true, url: c => `https://ytenx.org/zim?dzih=${e(c)}` },
  { key: 'qieyun', name: '切韻音系查詢 nk2028', kind: 'sound', deep: true, url: c => `https://nk2028.shn.hk/qieyun/#/?q=${e(c)}` },
  { key: 'webyuntu', name: 'Web韻圖', kind: 'sound', deep: false, url: () => 'https://suzukish.sakura.ne.jp/search/inkyo/index.php' },
  { key: 'kaom', name: '古音小鏡 kaom', kind: 'sound', deep: false, url: () => 'http://www.kaom.net/' },
  { key: 'glyphatlas', name: 'Glyph Atlas', kind: 'shape', deep: true, url: c => `https://glyphatlas.org/?q=${e(c)}` },
  { key: 'rare', name: '珍字集覽 Rare Character Compendium', kind: 'shape', deep: true, url: c => `https://rare.glyphatlas.org/?q=${e(c)}` },
  { key: 'ids', name: 'IDS Workshop', kind: 'shape', deep: true, url: c => `https://ids.mkpo.li/${e(c)}` },
  { key: 'glyphwiki', name: 'GlyphWiki', kind: 'shape', deep: true, url: c => `https://glyphwiki.org/wiki/u${cp(c)}` },
  { key: 'chise', name: 'CHISE', kind: 'shape', deep: true, url: c => `https://www.chise.org/est/view/character/${e(c)}` },
  { key: 'unicode', name: 'Unicode', kind: 'all', deep: true, every: true, url: c => `https://util.unicode.org/UnicodeJsps/character.jsp?a=${cp(c).toUpperCase()}` },
  { key: 'unihan', name: 'Unihan', kind: 'all', deep: true, url: c => `https://www.unicode.org/cgi-bin/GetUnihanData.pl?codepoint=${cp(c).toUpperCase()}` },
]
