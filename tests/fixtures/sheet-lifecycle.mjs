import { mount, unmount } from 'svelte'
import App from '../../app/App.svelte'
import '../../app/app.css'

/** @type {ReturnType<typeof mount> | undefined} */
let app
Reflect.set(window, 'mountSheetFixture', () => {
  if (app) throw new Error('Already mounted')
  app = mount(App, { target: /** @type {HTMLElement} */ (document.getElementById('app')) })
})
Reflect.set(window, 'unmountSheetFixture', async () => {
  if (!app) throw new Error('Not mounted')
  await unmount(app)
  app = undefined
})
Reflect.get(window, 'mountSheetFixture')()
