import { describe, expect, test } from 'bun:test'
import { classificationOf, NORTHERN_MANDARIN, readingTree, varietyTree } from '../app/lib/classification.js'

/** @param {number} n @param {string} short @param {string} atlas @param {string} order */
const variety = (n, short, atlas, order) => ({ n, short, name: short, atlas, order, version: '', region: '', place: '', at: '', source: '', refs: '', author: '', chars: 0 })

const MANDARIN = [
  variety(0, '普通話', '現代標準漢語', 'AX'),
  variety(1, '北京', '北京官話－京承片－京師小片', 'BAAA'),
  variety(2, '瀋陽', '東北官話－吉瀋片', 'BBA'),
]
const WU = variety(3, '蘇州', '吳語－太湖片－蘇嘉湖小片', 'DAB')

describe('classification', () => {
  test('puts the standard language and the northern families under one branch', () => {
    expect(classificationOf(MANDARIN[0])).toEqual(['官話', NORTHERN_MANDARIN, '現代標準漢語'])
    expect(classificationOf(MANDARIN[1])).toEqual(['官話', NORTHERN_MANDARIN, '北京官話', '京承片', '京師小片'])
    expect(classificationOf(MANDARIN[2])).toEqual(['官話', NORTHERN_MANDARIN, '東北官話', '吉瀋片'])
  })
  test('puts the other Mandarin families under 官話', () => {
    expect(classificationOf(variety(4, '廣州', '西南官話－桂柳片', 'BH'))).toEqual(['官話', '西南官話', '桂柳片'])
    expect(classificationOf(variety(5, '太原', '晉語－并州片', 'CA'))).toEqual(['晉語', '并州片'])
  })
  test('leaves a variety without a branch unclassified', () => {
    expect(classificationOf(variety(6, '未詳', '', ''))).toEqual([])
  })
  test('keeps an unclassified 官話 branch under 官話', () => {
    expect(classificationOf(variety(7, '官話', '官話', 'B'))).toEqual(['官話'])
    expect(classificationOf(variety(8, '島', '官話－方言島', 'B'))).toEqual(['官話', '方言島'])
  })
})

describe('reading tree', () => {
  test('keeps one order whichever reading comes first', () => {
    const readings = [{ n: 0, forms: ['pu'] }, { n: 1, forms: ['pəʔ'] }, { n: 3, forms: ['zəu'] }]
    const tree = readingTree([...MANDARIN, WU], readings, '', '未分類')
    expect(tree.map(node => node.name)).toEqual(['官話', '吳語'])
    expect(tree[0].children[0].children.map(node => node.name)).toEqual(['現代標準漢語', '北京官話'])
    const reversed = readingTree([...MANDARIN, WU], [...readings].reverse(), '', '未分類')
    expect(reversed).toEqual(tree)
  })
  test('keeps that order when a character lacks the first family', () => {
    const tree = readingTree([...MANDARIN, WU], [{ n: 2, forms: ['ɕy'] }, { n: 3, forms: ['zəu'] }], '', '未分類')
    expect(tree[0].children[0].children.map(node => node.name)).toEqual(['東北官話'])
    expect(tree.map(node => node.name)).toEqual(['官話', '吳語'])
  })
  test('sorts the readings inside a branch by the atlas', () => {
    const tianjin = variety(8, '天津', '北京官話－京承片－京師小片', 'BAAB')
    const tree = readingTree([...MANDARIN, tianjin], [{ n: 8, forms: ['tʰian'] }, { n: 1, forms: ['pəʔ'] }], '', '未分類')
    const city = tree[0].children[0].children[0].children[0].children[0]
    expect(city.rows.map(row => row.name)).toEqual(['北京', '天津'])
  })
  test('keeps a matching reading and leaves out the rest', () => {
    const readings = [{ n: 0, forms: ['pu'] }, { n: 3, forms: ['zəu'] }]
    const tree = readingTree([...MANDARIN, WU], readings, '蘇州', '未分類')
    expect(tree.map(node => node.name)).toEqual(['吳語'])
    expect(tree[0].count).toBe(1)
  })
  test('files a variety with no branch under the fallback', () => {
    const tree = readingTree([variety(7, '未詳', '', '')], [{ n: 7, forms: ['x'] }], '', '未分類')
    expect(tree.map(node => node.name)).toEqual(['未分類'])
    expect(tree[0].rows[0].forms).toEqual(['x'])
  })
  test('places a branch by its commonest code, not an outlier', () => {
    const varieties = [
      variety(10, '十堰', '鄂北片', 'BHAA'),
      variety(11, '武漢', '鄂中片', 'BHAA'),
      variety(12, '荊州', '鄂中片', 'BHAB'),
      variety(13, '宜昌', '鄂中片', 'BHAB'),
    ]
    const readings = varieties.map(variety => ({ n: variety.n, forms: ['x'] }))
    const tree = readingTree(varieties, readings, '', '未分類')
    expect(tree.map(node => node.name)).toEqual(['鄂北片', '鄂中片'])
  })
  test('puts a dialect island after the branch that shares its outlier code', () => {
    const varieties = [
      variety(20, '祁陽', '道江小片', 'GEB'),
      variety(21, '景洪', '方言島', 'GEB'),
      variety(22, '儀隴', '方言島', 'GED'),
      variety(23, '開江', '方言島', 'GED'),
      variety(24, '安岳', '方言島', 'GED'),
    ]
    const readings = varieties.map(variety => ({ n: variety.n, forms: ['x'] }))
    const tree = readingTree(varieties, readings, '', '未分類')
    expect(tree.map(node => node.name)).toEqual(['道江小片', '方言島'])
  })
})

describe('variety tree', () => {
  test('lists every variety in the same branches as the readings', () => {
    const tree = varietyTree([...MANDARIN, WU], '', '未分類')
    expect(tree.map(node => node.name)).toEqual(['官話', '吳語'])
    expect(tree[0].count).toBe(3)
    const north = tree[0].children[0]
    expect(north.name).toBe(NORTHERN_MANDARIN)
    expect(north.children.map(node => node.name)).toEqual(['現代標準漢語', '北京官話', '東北官話'])
    expect(north.children[0].items.map(variety => variety.name)).toEqual(['普通話'])
  })
  test('keeps only matching varieties and their branches', () => {
    const tree = varietyTree([...MANDARIN, WU], '蘇州', '未分類')
    expect(tree.map(node => node.name)).toEqual(['吳語'])
    expect(tree[0].count).toBe(1)
    const lake = tree[0].children[0]
    expect(lake.items).toEqual([])
    expect(lake.children[0].items.map(variety => variety.name)).toEqual(['蘇州'])
  })
  test('sorts varieties inside a branch by the atlas', () => {
    const tianjin = variety(8, '天津', '北京官話－京承片－京師小片', 'BAAB')
    const tree = varietyTree([...MANDARIN, tianjin], '', '未分類')
    const city = tree[0].children[0].children[1].children[0].children[0]
    expect(city.items.map(variety => variety.name)).toEqual(['北京', '天津'])
  })
  test('finds the varieties under a branch label the page shows', () => {
    const page = varietyTree([...MANDARIN, WU], NORTHERN_MANDARIN, '未分類')
    expect(page.map(node => node.name)).toEqual(['官話'])
    expect(page[0].count).toBe(3)
    const readings = MANDARIN.map(variety => ({ n: variety.n, forms: ['x'] }))
    const card = readingTree(MANDARIN, readings, NORTHERN_MANDARIN, '未分類')
    expect(card.map(node => node.name)).toEqual(['官話'])
    expect(card[0].count).toBe(3)
  })
  test('keeps direct varieties at a branch that also has children', () => {
    const direct = variety(30, '官話點', '官話', 'B')
    const tree = varietyTree([...MANDARIN, direct], '', '未分類')
    const root = tree[0]
    expect(root.items.map(variety => variety.name)).toEqual(['官話點'])
    expect(root.count).toBe(4)
  })
  test('counts a variety without a branch under the fallback', () => {
    const tree = varietyTree([variety(31, '未詳', '', '')], '', '未分類')
    expect(tree[0].name).toBe('未分類')
    expect(tree[0].count).toBe(1)
    expect(tree[0].items[0].name).toBe('未詳')
  })
})
