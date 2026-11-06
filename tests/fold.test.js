import { describe, expect, test } from 'bun:test'
import { charBucket, codeBucket, fold, hanIn, inScope, isHan, isRareKana, pinyinDigits } from '../src/fold.js'

describe('fold', () => {
  test('drops tone marks and case on Latin', () => {
    expect(fold('Zhōng')).toBe('zhong')
    expect(fold('tự')).toBe('tu')
  })
  test('folds katakana to hiragana, keeping voicing', () => {
    expect(fold('ユタヘヘミ')).toBe('ゆたへへみ')
    expect(fold('ガ')).toBe('が')
  })
  test('widens nothing and keeps Hangul whole', () => {
    expect(fold('ＡＢＣ１')).toBe('abc1')
    expect(fold('자')).toBe('자')
  })
  test('turns IPA into plain letters', () => {
    expect(fold('lʊŋ4')).toBe('lung4')
    expect(fold('tsʰɔŋ')).toBe('tshong')
    expect(fold('tsɿ')).toBe('tsi')
  })
  test('ignores spaces, hyphens and the marks of literary and colloquial readings', () => {
    expect(fold('a b-c')).toBe('abc')
    expect(fold('tsi33=')).toBe('tsi33')
    expect(fold('*liong')).toBe('liong')
  })
  test('keeps the dot that separates radical from strokes', () => {
    expect(fold('85.6')).not.toBe(fold('8.56'))
  })
})

describe('pinyinDigits', () => {
  test('moves the tone to a digit', () => {
    expect(pinyinDigits('zhōng')).toBe('zhong1')
    expect(pinyinDigits('lǜ')).toBe('lv4')
    expect(pinyinDigits('ma')).toBe('ma5')
  })
})

describe('characters', () => {
  test('Han includes the extensions and leaves out siniform scripts', () => {
    expect(isHan('字')).toBe(true)
    expect(isHan('𡨸')).toBe(true)
    expect(isHan('\u{17000}')).toBe(false) // Tangut
    expect(isHan('\u{18E01}')).toBe(false) // Jurchen
    expect(hanIn('a字𡨸b')).toEqual(['字', '𡨸'])
  })
})

describe('scope', () => {
  test('takes Han, kana, hentaigana and Nüshu, and leaves out siniform scripts', () => {
    for (const char of ['字', '𡨸', 'あ', 'ア', '\u{1B002}', '\u{1B170}']) expect(inScope(char)).toBe(true)
    for (const char of ['\u{17000}', '\u{18E01}', '\u{18B00}', 'a', '한']) expect(inScope(char)).toBe(false)
  })
  test('takes characters newer than the runtime knows', () => {
    expect(isHan('\u{2B81E}')).toBe(true)
    expect(inScope('\u{1B127}')).toBe(true)
    expect(inScope('\u{1B168}')).toBe(true)
  })
  test('tells the supplement kana from modern kana', () => {
    expect(isRareKana('\u{1B002}')).toBe(true)
    expect(isRareKana('あ')).toBe(false)
  })
  test('a run of kana is not read as characters, and Nüshu is', () => {
    expect(hanIn('ユタ')).toEqual([])
    expect(hanIn('\u{1B170}字')).toEqual(['\u{1B170}', '字'])
  })
})

describe('buckets', () => {
  test('a code and every longer code starting the same share a file', () => {
    expect(codeBucket('zhong')).toBe(codeBucket('zh'))
    expect(codeBucket('zhong1')).toBe(codeBucket('zhang'))
  })
  test('a character files by its code point', () => {
    expect(charBucket('字')).toBe('5b')
  })
})
