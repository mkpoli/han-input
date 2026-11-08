// Script conversion shared by the meaning index and the search box.
import { hanIn } from './fold.js'

/** The OpenCC direction both sides use: generic traditional to simplified. */
export const SIMPLIFIED = /** @type {const} */ ({ from: 't', to: 'cn' })

/** Whether a word contains a Han character, including plane 2 and 3. @param {string} text */
export const hasHan = text => hanIn(text).length > 0
