import { describe, expect, it } from 'vitest'

import {
  endpointUnavailableBilling,
  endpointUnavailableSubscription,
  loggedOutBillingState,
  loggedOutSubscriptionState,
  okBilling,
  okSubscription,
  postTrainBillingState,
  postTrainSubscriptionState,
  todayBillingState,
  todaySubscriptionState
} from './fixtures.test-util'
import { buildManageSubscriptionUrl, deriveBillingView } from './use-billing-state'

describe('deriveBillingView', () => {
  it('derives the deployed-today shape with fail-open disabled charge controls', () => {
    const view = deriveBillingView(okBilling(todayBillingState), okSubscription(todaySubscriptionState))

    expect(view.status).toBe('normal')
    expect(view.summary).toContainEqual({ label: 'Balance', value: '$996.47' })
    expect(view.summary).toContainEqual({ label: 'Plan', value: 'Ultra · $200/mo' })
    const buyCredits = view.accountRows.find(row => row.id === 'buy_credits')

    expect(buyCredits?.description).toBe(
      'Terminal billing is off for this account — an admin must enable it on the portal.'
    )
    expect(buyCredits?.chips).toBeUndefined()
    expect(view.accountRows.find(row => row.id === 'auto_reload')).toMatchObject({
      caption: 'Refill $10 when balance falls below $5',
      pill: { label: 'Enabled', tone: 'primary' }
    })
    expect(view.usageRows.map(row => row.id)).toEqual(['subscription_credits', 'topup_credits', 'monthly_cap'])
  })

  it('derives the post-train shape with card provenance, presets, and denominated usage bars', () => {
    const view = deriveBillingView(okBilling(postTrainBillingState), okSubscription(postTrainSubscriptionState))

    expect(view.status).toBe('normal')
    expect(view.accountRows.find(row => row.id === 'payment_method')?.value).toBe('Visa •••• 4242 - subscription card')
    expect(view.accountRows.find(row => row.id === 'buy_credits')?.chips?.map(chip => chip.label)).toEqual([
      '$25',
      '$50',
      '$100'
    ])
    expect(view.accountRows.find(row => row.id === 'subscription')?.action?.url).toBe(
      'https://portal.nousresearch.com/manage-subscription?org_id=org_123'
    )
    expect(view.usageRows.find(row => row.id === 'subscription_credits')).toMatchObject({
      bar: { value: 0.4 },
      value: '$40 of $100 left'
    })
  })

  it('derives a calm logged-out card with no account or usage rows', () => {
    const view = deriveBillingView(okBilling(loggedOutBillingState), okSubscription(loggedOutSubscriptionState))

    expect(view.status).toBe('logged_out')
    expect(view.summary.map(item => item.value)).toEqual(['—', '—', '—'])
    expect(view.notice).toMatchObject({
      title: 'Connect your Nous account'
    })
    expect(view.accountRows).toEqual([])
    expect(view.usageRows).toEqual([])
  })

  it('derives a refusal notice when billing.state is unavailable', () => {
    const view = deriveBillingView(endpointUnavailableBilling, okSubscription(todaySubscriptionState))

    expect(view.status).toBe('refusal')
    expect(view.summary.map(item => item.value)).toEqual(['—', '—', '—'])
    expect(view.notice).toMatchObject({
      title: 'Billing endpoint unavailable'
    })
    expect(view.accountRows).toEqual([])
  })

  it('keeps subscription unavailable as a row-level degradation when billing.state succeeds', () => {
    const view = deriveBillingView(okBilling(todayBillingState), endpointUnavailableSubscription)
    const subscription = view.accountRows.find(row => row.id === 'subscription')

    expect(view.status).toBe('normal')
    expect(subscription).toMatchObject({
      caption: 'Subscription details are unavailable; opening the portal is still available.',
      value: 'Ultra'
    })
  })
})

describe('buildManageSubscriptionUrl', () => {
  it('mirrors the TUI manage-subscription URL construction', () => {
    expect(
      buildManageSubscriptionUrl({
        org_id: 'org_123',
        portal_url: 'https://portal.nousresearch.com/billing'
      })
    ).toBe('https://portal.nousresearch.com/manage-subscription?org_id=org_123')
  })
})
