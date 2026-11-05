/* eslint-disable @typescript-eslint/no-require-imports -- electron-builder loads this hook as CommonJS */
// electron-builder leaves the app with a broken signature when no Developer ID is available: the
// binaries are signed but the bundle itself is not, which Apple Silicon Macs report as "damaged".
// Re-signing the whole bundle ad hoc (free, no account needed) makes the signature consistent.
const { execFileSync } = require('node:child_process')
const path = require('node:path')

exports.default = async function afterPack(context) {
  if (context.electronPlatformName !== 'darwin') return
  const appPath = path.join(context.appOutDir, `${context.packager.appInfo.productFilename}.app`)
  execFileSync('codesign', ['--force', '--deep', '--sign', '-', appPath], { stdio: 'inherit' })
  execFileSync('codesign', ['--verify', '--deep', '--strict', appPath], { stdio: 'inherit' })
}
