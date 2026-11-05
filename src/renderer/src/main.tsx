import './assets/main.css'

import { start } from './bootstrap'

// window.api is replaced when a cloud account is used, so keep the local one from the preload
const local = window.api
start(() => local)
