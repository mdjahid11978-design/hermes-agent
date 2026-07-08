/**
 * Runtime plugin loader — plugins as CODE, not registry edits, loaded after
 * build time. The pipeline every non-bundled plugin takes:
 *
 *   source (plain ESM js) -> [integrity check] -> bare-specifier rewrite
 *   (`@hermes/plugin-sdk` / `react*` -> live shim blobs, see sdk/runtime.ts)
 *   -> blob `import()` -> validate default HermesPlugin -> register(ctx)
 *
 * Loading the same plugin id again disposes the previous registrations first
 * (agent rewrites a plugin file -> clean reload). Failures toast + log; a
 * broken plugin can never take the app down.
 *
 * Sources today: the in-repo runtime example (`?raw`, proves the pipeline)
 * and `<hermes home>/desktop-plugins/<name>/plugin.js` on disk — the door the
 * agent writes through. Remote (https + allowlist) rides the same
 * `loadRuntimePlugin(source, { integrity })` seam when it lands.
 */

import { getStatus } from '@/hermes'
import { installPluginSdk, sdkImportMap } from '@/sdk/runtime'
import { notifyError } from '@/store/notifications'

import { createPluginContext, type HermesPlugin } from './plugin'
import { dropPlugin, pluginActive, type PluginKind, publishPlugin } from './plugins-store'

interface LoadOptions {
  /** Absolute plugin.js path (disk plugins) — recorded for reveal/inventory. */
  file?: string
  /** `sha256-<base64>` — verified against the source before evaluation. */
  integrity?: string
  /** Inventory bucket; the disk door is the default runtime source. */
  kind?: PluginKind
}

/** Live runtime plugins: id -> disposers (unload/reload support). */
const loaded = new Map<string, (() => void)[]>()

const rewriteSpecifiers = (source: string): string =>
  Object.entries(sdkImportMap()).reduce(
    (out, [specifier, url]) => out.replaceAll(`"${specifier}"`, `"${url}"`).replaceAll(`'${specifier}'`, `'${url}'`),
    source
  )

async function verifyIntegrity(source: string, integrity: string): Promise<boolean> {
  const [algo, expected] = integrity.split('-', 2)

  if (algo !== 'sha256' || !expected) {
    return false
  }

  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(source))
  const actual = btoa(String.fromCharCode(...new Uint8Array(digest)))

  return actual === expected
}

export function unloadRuntimePlugin(id: string): void {
  loaded.get(id)?.forEach(dispose => dispose())
  loaded.delete(id)
}

/** Evaluate + register one runtime plugin. Returns its id, or null on failure. */
export async function loadRuntimePlugin(source: string, origin: string, options: LoadOptions = {}): Promise<null | string> {
  installPluginSdk()

  try {
    if (options.integrity && !(await verifyIntegrity(source, options.integrity))) {
      throw new Error(`integrity check failed for ${origin}`)
    }

    const url = URL.createObjectURL(new Blob([rewriteSpecifiers(source)], { type: 'text/javascript' }))

    let mod: { default?: HermesPlugin }

    try {
      mod = await import(/* @vite-ignore */ url)
    } finally {
      URL.revokeObjectURL(url)
    }

    const plugin = mod.default

    if (!plugin?.id || typeof plugin.register !== 'function') {
      throw new Error(`${origin} has no valid default HermesPlugin export`)
    }

    const record = {
      id: plugin.id,
      name: plugin.name ?? plugin.id,
      kind: options.kind ?? 'disk',
      file: options.file
    }

    const activate = () => {
      // Reload = dispose the previous incarnation, then register fresh.
      unloadRuntimePlugin(plugin.id)
      const disposers: (() => void)[] = []
      plugin.register(createPluginContext(plugin.id, dispose => disposers.push(dispose)))
      loaded.set(plugin.id, disposers)
      publishPlugin({ ...record, status: 'loaded' })
    }

    publishPlugin({ ...record, status: 'disabled' }, { activate, deactivate: () => unloadRuntimePlugin(plugin.id) })

    // A disabled plugin still inventories (settings shows it, toggle
    // reactivates via the handle above) — it just never registers.
    if (pluginActive(plugin.id, plugin.defaultEnabled ?? true)) {
      activate()
    }

    return plugin.id
  } catch (error) {
    console.error(`[plugins] runtime load failed (${origin})`, error)
    notifyError(error, `Plugin "${origin}" failed to load`)
    publishPlugin({
      id: origin,
      name: origin,
      kind: options.kind ?? 'disk',
      file: options.file,
      status: 'error',
      error: error instanceof Error ? error.message : String(error)
    })

    return null
  }
}

// ---------------------------------------------------------------------------
// The on-disk plugin door: `<hermes home>/desktop-plugins/<name>/plugin.js`
// (agent- or user-written). SELF-MAINTAINING — no reload ceremony:
//  - each plugin.js is fs-watched (the preview watcher IPC, debounced in
//    main): saving the file hot-reloads the plugin in place;
//  - a slow visible-tab poll of the directory picks up new folders (load +
//    watch) and removed ones (unload + unwatch).
// Panes land via placement adoption and STAY where the user drags them —
// the tree treats not-yet-loaded pane ids as hidden, so boot and reload are
// collapse -> appear, never a placeholder flash.
// ---------------------------------------------------------------------------

const DISK_POLL_MS = 5_000

interface DiskPlugin {
  file: string
  /** Loaded plugin id (null while broken — kept so a fixing save reloads). */
  id: null | string
  watchId: null | string
}

const disk = new Map<string, DiskPlugin>()
let watching = false

async function loadDiskPlugin(name: string, file: string): Promise<void> {
  const desktop = window.hermesDesktop!
  const entry = disk.get(name)

  try {
    const { text } = await desktop.readFileText(file)
    const id = await loadRuntimePlugin(text, name, { file })

    if (entry) {
      entry.id = id ?? entry.id
    }

    // A fixing save under a different plugin id — drop the folder-named
    // error record so the inventory shows one row, not a ghost.
    if (id && id !== name) {
      dropPlugin(name)
    }
  } catch {
    // File vanished mid-read — the next scan reconciles.
  }
}

async function scanDiskPlugins(): Promise<void> {
  const desktop = window.hermesDesktop

  if (!desktop) {
    return
  }

  try {
    const { hermes_home } = await getStatus()
    const { entries } = await desktop.readDir(`${hermes_home}/desktop-plugins`)
    const seen = new Set<string>()

    for (const dir of entries.filter(e => e.isDirectory)) {
      seen.add(dir.name)

      if (disk.has(dir.name)) {
        continue
      }

      const file = `${dir.path}/plugin.js`

      try {
        await desktop.readFileText(file)
      } catch {
        continue // No plugin.js (yet) — not a plugin folder.
      }

      const record: DiskPlugin = { file, id: null, watchId: null }
      disk.set(dir.name, record)
      await loadDiskPlugin(dir.name, file)

      try {
        record.watchId = (await desktop.watchPreviewFile(file)).id
      } catch {
        // Unwatchable — the poll still reconciles new folders; edits need a
        // manual "Reload desktop plugins".
      }
    }

    // Folder deleted -> plugin gone, cleanly (inventory row included).
    for (const [name, record] of disk) {
      if (seen.has(name)) {
        continue
      }

      if (record.id) {
        unloadRuntimePlugin(record.id)
        dropPlugin(record.id)
      }

      dropPlugin(name)

      if (record.watchId) {
        void desktop.stopPreviewFileWatch(record.watchId)
      }

      disk.delete(name)
    }
  } catch {
    // No desktop-plugins dir (or no gateway yet) — nothing to reconcile.
  }
}

/** Manual rescan (the ⌘K "Reload desktop plugins" fallback). */
export const discoverRuntimePlugins = scanDiskPlugins

/** Start the self-maintaining disk door: initial scan, per-file hot reload,
 *  slow folder reconciliation while the window is visible. Idempotent. */
export function watchRuntimePlugins(): void {
  const desktop = window.hermesDesktop

  if (watching || !desktop) {
    return
  }

  watching = true

  desktop.onPreviewFileChanged(({ id }) => {
    for (const [name, record] of disk) {
      if (record.watchId === id) {
        void loadDiskPlugin(name, record.file)

        return
      }
    }
  })

  void scanDiskPlugins()
  window.setInterval(() => {
    if (document.visibilityState === 'visible') {
      void scanDiskPlugins()
    }
  }, DISK_POLL_MS)
}
