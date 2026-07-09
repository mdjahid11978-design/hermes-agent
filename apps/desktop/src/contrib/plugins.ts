/**
 * Plugin discovery — both delivery modes:
 *
 *  - BUNDLED: every `src/plugins/<name>/plugin.{ts,tsx}` default-exporting a
 *    `HermesPlugin` registers automatically (vite glob — drop a folder in).
 *  - RUNTIME: the in-repo example ships as raw text through the REAL loader
 *    pipeline (rewrite -> shim blobs -> blob import), then the on-disk door
 *    (`<hermes home>/desktop-plugins/<name>/plugin.js`) — the agent's door.
 */

 
import helloRuntimeSource from '../plugins/hello-runtime/plugin.runtime.js?raw'

import { createPluginContext, type HermesPlugin } from './plugin'
import { pluginActive, publishPlugin } from './plugins-store'
import { loadRuntimePlugin, watchRuntimePlugins } from './runtime-loader'

const modules = import.meta.glob<{ default: HermesPlugin }>('../plugins/*/plugin.{ts,tsx}', { eager: true })

// One-shot init guard. Contributions themselves register by id (re-registering
// is idempotent), but the runtime watcher setup below (watchRuntimePlugins, the
// hello-runtime load) must NOT run twice — so discovery is guarded to a single
// pass rather than re-run on HMR.
let loaded = false

export function discoverBundledPlugins(): void {
  if (loaded) {
    return
  }

  loaded = true

  for (const [path, mod] of Object.entries(modules)) {
    const plugin = mod.default

    if (!plugin?.id || typeof plugin.register !== 'function') {
      console.warn(`[plugins] ${path} has no valid default HermesPlugin export — skipped`)

      continue
    }

    // Same inventory + live-toggle contract as runtime plugins: each bundled
    // plugin publishes a record with activate/deactivate handles, and a
    // persisted disable survives boots by skipping registration here.
    const record = { id: plugin.id, name: plugin.name ?? plugin.id, kind: 'bundled' as const }
    let disposers: (() => void)[] = []

    const activate = () => {
      disposers.forEach(dispose => dispose())
      disposers = []

      try {
        plugin.register(createPluginContext(plugin.id, dispose => disposers.push(dispose)))
        publishPlugin({ ...record, status: 'loaded' })
      } catch (error) {
        console.error(`[plugins] ${plugin.id} failed to register`, error)
        publishPlugin({ ...record, status: 'error', error: error instanceof Error ? error.message : String(error) })
      }
    }

    const deactivate = () => {
      disposers.forEach(dispose => dispose())
      disposers = []
    }

    publishPlugin({ ...record, status: 'disabled' }, { activate, deactivate })

    if (pluginActive(plugin.id, plugin.defaultEnabled ?? true)) {
      activate()
    }
  }

  // The runtime pipeline, dogfooded on every boot + the SELF-MAINTAINING
  // disk door (fs-watched hot reloads, slow folder reconciliation).
  void loadRuntimePlugin(helloRuntimeSource, 'hello-runtime', { kind: 'runtime' })
  watchRuntimePlugins()
}
