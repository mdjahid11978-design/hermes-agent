/**
 * @hermes/plugin-sdk — THE plugin language. The vscode-module model: plugin
 * authors import exactly one module and get everything — they never touch
 * `@/…` internals (lint-fenced) and never need codebase access.
 *
 * Two delivery modes, one surface:
 *  - bundled (`src/plugins/<name>/`): the import resolves here via alias;
 *  - runtime-fetched (plugin host, next phase): the loader injects this same
 *    object as `window.__HERMES_PLUGIN_SDK__` and maps the import to it, so a
 *    published plugin builds against the types with the SDK marked external.
 *
 * Capability tiers (WoW-style):
 *  - `host.state.*` — READONLY app state (nanostore atoms; `.get()` or
 *    subscribe; `useValue` in React).
 *  - `host.*` actions — curated, safe verbs (toast, haptic).
 *  - `host.request` — the gateway JSON-RPC door; the plugin's real power,
 *    and the future seam for per-plugin capability grants.
 *  - `ui.*` — the design language, so plugin UI looks native by default.
 */

import { atom, type ReadableAtom } from 'nanostores'

import { $narrowViewport } from '@/components/pane-shell/tree/store'
import { onGatewayEvent } from '@/contrib/events'
import { getLogs, getStatus } from '@/hermes'
import { $gateway } from '@/store/gateway'
import { notify, notifyError } from '@/store/notifications'
import { $activeGatewayProfile } from '@/store/profile'
import { $activeSessionId, $currentCwd, $currentModel, $gatewayState } from '@/store/session'
import { runGatewayRestart } from '@/store/system-actions'

// -- state: readonly views over the app's live atoms -------------------------

const readonlyAtom = <T>(atomLike: ReadableAtom<T>): ReadableAtom<T> => atomLike

/** Window geometry + the app's responsive posture, one readonly rect. */
export interface ViewportRect {
  width: number
  height: number
  /** Below the app's sidebar-collapse breakpoint (rails become overlays). */
  narrow: boolean
}

const readViewport = (): ViewportRect => ({
  width: typeof window === 'undefined' ? 0 : window.innerWidth,
  height: typeof window === 'undefined' ? 0 : window.innerHeight,
  narrow: $narrowViewport.get()
})

const $viewport = atom<ViewportRect>(readViewport())

if (typeof window !== 'undefined') {
  const refresh = () => $viewport.set(readViewport())
  window.addEventListener('resize', refresh)
  $narrowViewport.listen(refresh)
}

export const host = {
  state: {
    /** Runtime id of the active chat session (null on a fresh draft). */
    activeSessionId: readonlyAtom<null | string>($activeSessionId),
    /** Active workspace cwd ('' when detached). */
    cwd: readonlyAtom<string>($currentCwd),
    /** Gateway socket state: 'idle' | 'connecting' | 'open' | …. */
    gateway: readonlyAtom<string>($gatewayState),
    /** Current main model slug. */
    model: readonlyAtom<string>($currentModel),
    /** Profile the live gateway is routed to. */
    profile: readonlyAtom<string>($activeGatewayProfile),
    /** Window geometry ({ width, height, narrow }). */
    viewport: readonlyAtom<ViewportRect>($viewport)
  },

  /** Toast into the app's notification stack. */
  notify,
  notifyError,

  // NOTE: every host door is async-safe — wrapped so a sync throw from an
  // internal helper (e.g. no desktop bridge in a plain browser) becomes a
  // rejection a plugin's .catch() sees, never an error-boundary crash.

  /** Tail an app log file (`agent` / `errors` / `gateway` / `gui` / …). */
  logs: async (...args: Parameters<typeof getLogs>) => getLogs(...args),

  /** Navigate the app router (hash routes, e.g. '/command-center?section=system'). */
  navigate: (path: string) => {
    window.location.hash = path.startsWith('#') ? path : `#${path}`
  },

  /** HEAR the gateway stream (message deltas, session lifecycle, tool
   *  activity, …) by event type — `'*'` for everything. Returns a disposer.
   *  Listeners are isolated; a throw can't affect app dispatch. */
  onEvent: onGatewayEvent,

  /** Restart the backend gateway (progress surfaces in the core statusbar). */
  restartGateway: async () => runGatewayRestart(),

  /** One-shot system status snapshot (platforms, versions, …). */
  status: async () => getStatus(),

  /** Gateway JSON-RPC — sessions, config, skills, cron, kanban, everything
   *  the app itself uses. Lazy: resolves the LIVE socket per call. */
  request: async <T>(method: string, params: Record<string, unknown> = {}): Promise<T> => {
    const gateway = $gateway.get()

    if (!gateway) {
      throw new Error('Hermes gateway unavailable')
    }

    return gateway.request<T>(method, params)
  }
}

// -- react bridge -------------------------------------------------------------

// Every contribution surface, plugin-reachable: register keybinds, palette
// commands, routes, themes, panes, composer extensions, and bar items with
// the same area ids + payload types core uses.
export { COMPOSER_AREAS, type ComposerAttachmentProvider, type ComposerMiddleware } from '@/app/chat/composer/contrib'

// -- ui: the design language --------------------------------------------------

export { PALETTE_AREA, type PaletteContribution } from '@/app/command-palette/contrib'
export { type RouteContribution, ROUTES_AREA, SIDEBAR_NAV_AREA, type SidebarNavContribution } from '@/app/routes'
export type { StatusbarItem } from '@/app/shell/statusbar-controls'

export type { TitlebarTool } from '@/app/shell/titlebar-controls'
export { StatusDot, type StatusTone } from '@/components/status-dot'
export { Badge } from '@/components/ui/badge'
export { Button } from '@/components/ui/button'
export { Checkbox } from '@/components/ui/checkbox'
export { Codicon } from '@/components/ui/codicon'
export { ConfirmDialog } from '@/components/ui/confirm-dialog'
export {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuTrigger
} from '@/components/ui/context-menu'
export { CopyButton } from '@/components/ui/copy-button'
export { DecodeText } from '@/components/ui/decode-text'
export {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger
} from '@/components/ui/dialog'
export {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger
} from '@/components/ui/dropdown-menu'
export { EmptyState } from '@/components/ui/empty-state'
export { ErrorState } from '@/components/ui/error-state'
export { GlyphSpinner } from '@/components/ui/glyph-spinner'
export { Input } from '@/components/ui/input'
export { Kbd, KbdGroup } from '@/components/ui/kbd'
export { LogView } from '@/components/ui/log-view'
export { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
export { ScrollArea } from '@/components/ui/scroll-area'
export { SearchField } from '@/components/ui/search-field'
export { SegmentedControl } from '@/components/ui/segmented-control'
export { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
export { Separator } from '@/components/ui/separator'
export { Skeleton } from '@/components/ui/skeleton'
export { Switch } from '@/components/ui/switch'
export { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
export { Textarea } from '@/components/ui/textarea'
export { Tip, Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'
export type { GatewayEventListener } from '@/contrib/events'

// -- contracts ----------------------------------------------------------------

export type { HermesPlugin, PluginContext, PluginContribution, PluginRestOptions, PluginStorage } from '@/contrib/plugin'
export type { Contribution } from '@/contrib/types'
/** Localized copy — plugins reuse the app's strings (and stay translatable). */
export { useI18n } from '@/i18n'
export { triggerHaptic as haptic } from '@/lib/haptics'
/** The app's lucide icon set (RefreshCw, LayoutDashboard, Activity, …). */
export * as icons from '@/lib/icons'
export { type KeybindContribution, KEYBINDS_AREA } from '@/lib/keybinds/actions'

export const PANES_AREA = 'panes'
export const STATUSBAR_AREAS = { left: 'statusBar.left', right: 'statusBar.right' } as const
export const TITLEBAR_AREAS = { center: 'titleBar.center', left: 'titleBar.left', right: 'titleBar.right' } as const

/** The app's own gateway-readiness evaluation (setup.status +
 *  setup.runtime_check, reconciled) — pass `host.request`. Don't hand-roll
 *  readiness from raw RPC shapes. */
export { evaluateRuntimeReadiness, type RuntimeReadinessResult } from '@/lib/runtime-readiness'
export { cn } from '@/lib/utils'
export { THEMES_AREA } from '@/themes/user-themes'
export type { RpcEvent, StatusResponse } from '@/types/hermes'
/** Subscribe a component to a `host.state` atom. */
export { useStore as useValue } from '@nanostores/react'
/** Plugin-local reactive state (share between a trigger and its panel, poll
 *  loops, cross-component signals) — the same primitive `host.state` uses. */
export { atom, computed } from 'nanostores'
