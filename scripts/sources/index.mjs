// Every table beyond Unihan. Add a source here.
import { ashideMethods } from './ashide.mjs'
import { rimeMethod } from './rime.mjs'

export async function allMethods() {
  return [
    ...await ashideMethods(),
    await rimeMethod({ repo: 'rime/rime-cangjie', file: ['cangjie5.base.dict.yaml', 'cangjie5.extended.dict.yaml'], id: 'cangjie5', en: 'Cangjie 5', zh: '倉頡五代', licence: 'GPL, as the dictionary header states; repository LGPL-3.0', keys: 'a–z' }),
    await rimeMethod({ repo: 'rime/rime-wubi', file: 'wubi86.dict.yaml', id: 'wubi86', en: 'Wubi 86', zh: '五筆字型 86', licence: 'LGPL-3.0', keys: 'a–y' }),
  ]
}
