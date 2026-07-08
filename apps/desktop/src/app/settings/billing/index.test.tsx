import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import {
  loggedOutBillingState,
  loggedOutSubscriptionState,
  okBilling,
  okSubscription,
  postTrainBillingState,
  postTrainSubscriptionState,
  todayBillingState,
  todaySubscriptionState
} from './fixtures.test-util'

import { BillingSettings } from './index'

const apiMocks = vi.hoisted(() => ({
  charge: vi.fn(),
  chargeStatus: vi.fn(),
  fetchBillingState: vi.fn(),
  fetchSubscriptionState: vi.fn(),
  openExternal: vi.fn(),
  stepUp: vi.fn(),
  updateAutoReload: vi.fn()
}))

vi.mock('./api', () => ({
  useBillingApi: () => ({
    charge: apiMocks.charge,
    chargeStatus: apiMocks.chargeStatus,
    fetchBillingState: apiMocks.fetchBillingState,
    fetchSubscriptionState: apiMocks.fetchSubscriptionState,
    stepUp: apiMocks.stepUp,
    updateAutoReload: apiMocks.updateAutoReload
  })
}))

function renderBilling() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })

  render(
    <QueryClientProvider client={client}>
      <BillingSettings />
    </QueryClientProvider>
  )

  return client
}

beforeEach(() => {
  apiMocks.fetchBillingState.mockResolvedValue(okBilling(todayBillingState))
  apiMocks.fetchSubscriptionState.mockResolvedValue(okSubscription(todaySubscriptionState))
  Object.defineProperty(window, 'hermesDesktop', {
    configurable: true,
    value: {
      openExternal: apiMocks.openExternal
    }
  })
})

afterEach(() => {
  cleanup()
  vi.clearAllMocks()
})

describe('BillingSettings', () => {
  it('renders the deployed-today payload with buy controls hidden and usage rows visible', async () => {
    renderBilling()

    expect(await screen.findByText('$996.47')).toBeTruthy()
    expect(screen.getByText('Ultra · $200/mo')).toBeTruthy()
    expect(screen.getByText('Visa •••• 3206')).toBeTruthy()
    expect(
      screen.getByText('Terminal billing is off for this account — an admin must enable it on the portal.')
    ).toBeTruthy()
    expect(screen.queryByRole('button', { name: '$100' })).toBeNull()
    expect(screen.getByText('Refill $10 when balance falls below $5')).toBeTruthy()
    expect(screen.getByText('$120 of $220 left')).toBeTruthy()
    expect(screen.getByText('$876.47')).toBeTruthy()
    expect(screen.getByText('$10 of $100 used')).toBeTruthy()
    expect(screen.getByText('Default ceiling')).toBeTruthy()
  })

  it('renders the post-train payload with disabled preset chips and card provenance', async () => {
    apiMocks.fetchBillingState.mockResolvedValue(okBilling(postTrainBillingState))
    apiMocks.fetchSubscriptionState.mockResolvedValue(okSubscription(postTrainSubscriptionState))

    renderBilling()

    expect(await screen.findByText('$142.50')).toBeTruthy()
    expect(screen.getByText('Visa •••• 4242 - subscription card')).toBeTruthy()
    expect(screen.getByRole('button', { name: '$25' }).hasAttribute('disabled')).toBe(true)
    expect(screen.getByRole('button', { name: '$50' }).hasAttribute('disabled')).toBe(true)
    expect(screen.getByRole('button', { name: '$100' }).hasAttribute('disabled')).toBe(true)
    expect(screen.getByRole('button', { name: /^Buy$/ }).hasAttribute('disabled')).toBe(true)
  })

  it('renders logged-out as a connect card without normal account rows', async () => {
    apiMocks.fetchBillingState.mockResolvedValue(okBilling(loggedOutBillingState))
    apiMocks.fetchSubscriptionState.mockResolvedValue(okSubscription(loggedOutSubscriptionState))

    renderBilling()

    expect(await screen.findByText('Connect your Nous account')).toBeTruthy()
    expect(screen.getByText('Run /portal in the TUI or open the Nous portal to connect your account.')).toBeTruthy()
    expect(screen.queryByText('Payment method')).toBeNull()
    expect(screen.queryByText('Usage')).toBeNull()
  })
})
