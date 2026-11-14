import { describe, expect, test } from 'bun:test'
import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { parseXiaoheLiangfen } from '../scripts/sources/xiaohe-liangfen.mjs'

describe('parseXiaoheLiangfen', () => {
  test('keeps two, four and six letter codes and a character with two codes', () => {
    const rows = parseXiaoheLiangfen('ujho 𡼷\r\nuv 氵\r\nabcdef 𠀀\r\nabcd 𠀁\r\nefgh 𠀁\r\n')
    expect(rows).toEqual([['ujho', '𡼷'], ['uv', '氵'], ['abcdef', '𠀀'], ['abcd', '𠀁'], ['efgh', '𠀁']])
  })
  test('drops other lengths, stray words and plane 16 components', () => {
    const rows = parseXiaoheLiangfen('which 𮊗\nmci 𲨏\nTRUE 𦧬\nabcd \u{10C7B9}\nabcd 𠀂\nno code')
    expect(rows).toEqual([['abcd', '𠀂']])
  })
})

const FILE = join(import.meta.dirname, '..', 'cache', 'xiaohe-liangfen', '两分百度码表.txt')
describe.skipIf(!existsSync(FILE))('the pinned table', () => {
  test.each([['ujho', '𡼷'], ['mmgc', '𡨟'], ['ccmm', '𬞻']])('%s gives %s', (code, char) => {
    expect(parseXiaoheLiangfen(readFileSync(FILE, 'utf8'))).toContainEqual([code, char])
  })
})
