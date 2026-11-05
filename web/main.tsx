import '../src/renderer/src/assets/main.css'

import { start } from '../src/renderer/src/bootstrap'
import { createDataApi, type DataApi } from '../src/renderer/src/data/core'
import { localPersistence } from '../src/renderer/src/data/localPersistence'

// Browser build of the same app. There is no Electron main process here, so this device's data
// layer is the browser one (localStorage) instead of SQLite over IPC.
document.documentElement.classList.add('web')

let local: Promise<DataApi> | undefined
start(() => (local ??= createDataApi(localPersistence(window.localStorage))))
