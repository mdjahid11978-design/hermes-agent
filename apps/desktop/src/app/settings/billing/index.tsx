import { Button } from '@/components/ui/button'
import { BarChart3, ExternalLink } from '@/lib/icons'
import { cn } from '@/lib/utils'

import { ListRow, Pill, SectionHeading, SettingsContent } from '../primitives'

import {
  type BillingAccountRowView,
  type BillingNoticeView,
  type BillingUsageRowView,
  deriveBillingView,
  EMPTY_BILLING_VALUE,
  useBillingState,
  useSubscriptionState
} from './use-billing-state'

const FEATURE_BILLING_INVOICES = false

function openExternal(url?: string) {
  if (!url) {
    return
  }

  void window.hermesDesktop?.openExternal?.(url)
}

function SummaryCard({ label, value, tone }: { label: string; tone?: 'muted' | 'primary'; value: string }) {
  const pill = tone && value !== EMPTY_BILLING_VALUE

  return (
    <div className="min-w-0">
      <div className="text-[length:var(--conversation-caption-font-size)] text-(--ui-text-tertiary)">{label}</div>
      <div className="mt-1 flex min-w-0 items-center gap-2 text-lg font-semibold text-foreground">
        {pill ? <Pill tone={tone}>{value}</Pill> : <span className="truncate">{value}</span>}
      </div>
    </div>
  )
}

function NoticeCard({ notice }: { notice: BillingNoticeView }) {
  return (
    <div className="mb-5 rounded-lg border border-border/70 bg-muted/20 p-4">
      <div className="text-[length:var(--conversation-text-font-size)] font-medium text-foreground">{notice.title}</div>
      <div className="mt-1 text-[length:var(--conversation-caption-font-size)] leading-(--conversation-caption-line-height) text-(--ui-text-tertiary)">
        {notice.message}
      </div>
      {notice.action && (
        <Button
          className="mt-3"
          onClick={() => openExternal(notice.action?.url)}
          size="sm"
          type="button"
          variant="outline"
        >
          {notice.action.label}
          <ExternalLink className="size-3.5" />
        </Button>
      )}
    </div>
  )
}

function RowValue({ row }: { row: BillingAccountRowView }) {
  return (
    <div className="flex min-w-0 flex-wrap items-center justify-start gap-2 @2xl:justify-end">
      {row.value && (
        <span className="min-w-0 truncate text-[length:var(--conversation-text-font-size)] font-medium text-foreground">
          {row.value}
        </span>
      )}
      {row.pill && <Pill tone={row.pill.tone}>{row.pill.label}</Pill>}
      {row.secondaryPill && <Pill>{row.secondaryPill}</Pill>}
      {row.chips?.map(chip => (
        <Button disabled={chip.disabled} key={chip.label} size="sm" type="button" variant="outline">
          {chip.label}
        </Button>
      ))}
      {row.action && (
        <Button
          disabled={row.action.disabled}
          onClick={row.action.disabled ? undefined : () => openExternal(row.action?.url)}
          size="sm"
          type="button"
          variant="outline"
        >
          {row.action.label}
          {!row.action.disabled && row.action.url && <ExternalLink className="size-3.5" />}
        </Button>
      )}
    </div>
  )
}

function AccountRow({ row }: { row: BillingAccountRowView }) {
  return (
    <ListRow
      action={<RowValue row={row} />}
      below={
        row.caption ? (
          <div className="mt-1 text-[length:var(--conversation-caption-font-size)] text-(--ui-text-tertiary)">
            {row.caption}
          </div>
        ) : undefined
      }
      description={row.description}
      key={row.id}
      title={row.title}
    />
  )
}

function UsageBar({ bar }: { bar: NonNullable<BillingUsageRowView['bar']> }) {
  return (
    <div
      aria-label={bar.label}
      aria-valuemax={100}
      aria-valuemin={0}
      aria-valuenow={Math.round(bar.value * 100)}
      className="h-[5px] w-full overflow-hidden rounded-full bg-muted"
      role="progressbar"
    >
      <div
        className={cn('h-full rounded-full', bar.tone === 'subscription' ? 'bg-primary' : 'bg-muted-foreground/45')}
        style={{ width: `${Math.round(bar.value * 100)}%` }}
      />
    </div>
  )
}

function UsageRow({ row }: { row: BillingUsageRowView }) {
  return (
    <div className="py-3">
      <div className="flex min-w-0 items-start justify-between gap-4">
        <div className="min-w-0">
          <div className="text-[length:var(--conversation-text-font-size)] font-medium text-foreground">
            {row.title}
          </div>
          <div className="mt-1 text-[length:var(--conversation-caption-font-size)] text-(--ui-text-tertiary)">
            {row.caption}
          </div>
        </div>
        <div className="shrink-0 text-right text-[length:var(--conversation-text-font-size)] font-medium text-foreground">
          {row.value}
        </div>
      </div>
      {row.bar && (
        <div className="mt-2">
          <UsageBar bar={row.bar} />
        </div>
      )}
    </div>
  )
}

export function BillingSettings() {
  const billingState = useBillingState()
  const subscriptionState = useSubscriptionState()
  const view = deriveBillingView(billingState.data, subscriptionState.data)

  return (
    <SettingsContent>
      <SectionHeading icon={BarChart3} title="Billing" />

      <div className="@container mb-5">
        <div className="grid gap-3 rounded-lg border border-border/70 bg-muted/20 p-4 @2xl:grid-cols-3">
          {view.summary.map(item => (
            <SummaryCard key={item.label} label={item.label} tone={item.tone} value={item.value} />
          ))}
        </div>
      </div>

      {view.notice && <NoticeCard notice={view.notice} />}

      {view.accountRows.length > 0 && (
        <>
          <SectionHeading icon={BarChart3} title="Account" />
          {view.accountRows.map(row => (
            <AccountRow key={row.id} row={row} />
          ))}
        </>
      )}

      {view.usageRows.length > 0 && (
        <>
          <SectionHeading icon={BarChart3} title="Usage" />
          {view.usageRows.map(row => (
            <UsageRow key={row.id} row={row} />
          ))}
        </>
      )}

      {
        // no endpoint yet — NAS capability-board gap
        FEATURE_BILLING_INVOICES ? <SectionHeading icon={BarChart3} title="Invoices" /> : null
      }
    </SettingsContent>
  )
}
