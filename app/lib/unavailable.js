// Ways in that are known to exist and are not searchable here, each with the reason.

/** @typedef {{ family: string, names: string, reason: 'terms' | 'none', note?: string, url?: string }} Unavailable */

/** @type {Unavailable[]} */
export const UNAVAILABLE = [
  // Tables exist, and their terms do not allow publishing them here.
  { family: 'shape', names: '嘸蝦米 Boshiamy', reason: 'terms', note: 'copyright (c) 行易有限公司', url: 'https://boshiamy.com/' },
  { family: 'shape', names: '萬國蝦米 (uniliu)', reason: 'terms', note: 'Boshiamy-compatible codes' },
  { family: 'shape', names: '中易拼形 (cbs)', reason: 'terms', note: '著作權，專利仍屬戚桐欣先生所有' },
  { family: 'shape', names: '宇浩輸入法 Yuhao', reason: 'terms', note: 'CC BY-NC-ND 4.0', url: 'https://github.com/forfudan/yuhao-ime-release' },
  // No machine-readable table could be found.
  { family: 'direct', names: 'G-Code, 超絶技巧入力, 風 Kaze, す, 百相鍵盤「き」, NIK-Code, にこにこ, phoenix, ラインプット, カンテック, KIS, LTWORD', reason: 'none' },
  { family: 'shape', names: '郭碼, 徐碼, 超強二筆, 超強音形, 超強快碼, 青松二筆, 哲豆音形, 自由二筆, 子來輸入法, 認知碼, 漢碼形音碼, 鴻鐘碼, 六一輸入法, 十易碼, 形筆輸入法, 首尾字型輸入法, 說文輸入系統, 安氏漢字電腦編號, 正易全, 傻瓜碼, 佚筆, 佚拼, S&R 中文筆畫智能, 易行, 偽蝦米, 五筆新世紀版, 中文之星, 全方位倉頡, 蘇式倉頡, 新倉頡, 大新倉頡', reason: 'none' },
  { family: 'reading', names: '聲韻輸入法, 近音檢字法, 粵音檢字法, 真鳥囝輸入法, 開心逍遙筆, 紫光雙拼, 搜狗雙拼, 龍榜雙拼, IBM 注音鍵盤, 精業注音鍵盤', reason: 'none' },
  { family: 'historical', names: '五筆檢字法 (陳立夫), 江山千古, 元亨利貞, 末筆, 漢字母筆排列法, 梅遜字基, 中國字庋擷法, 形位排檢法 (杜定友), 筆數排檢法, 舒式和周厚坤的字盤, 明快打字機上下形全表 (the 36 tables; a 25-entry stub is searchable)', reason: 'none' },
  { family: 'encoding', names: '倚天碼, 內碼輸入法, 文字鏡 Mojikyo, 漢字海', reason: 'none' },
  { family: 'extended', names: '方塊白文, 方塊苗文, 方塊瑤文, 方塊布依字, 侗字, 哈尼字', reason: 'none' },
]
