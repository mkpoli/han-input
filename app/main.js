// Han Input: find a Chinese character through whatever way in the reader has, then go on to the
// sites that say more about it.
import { mount } from 'svelte'
import App from './App.svelte'
import './app.css'

mount(App, { target: /** @type {HTMLElement} */ (document.getElementById('app')) })
