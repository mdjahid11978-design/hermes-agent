import type { BillingResult } from './api'
import type { BillingStateResponse, SubscriptionStateResponse } from './types'

const current = (
  overrides: Partial<NonNullable<SubscriptionStateResponse['current']>> = {}
): NonNullable<SubscriptionStateResponse['current']> => ({
  cancel_at_period_end: false,
  cancellation_effective_at: null,
  cancellation_effective_display: null,
  credits_remaining: '120',
  cycle_ends_at: '2026-07-11T08:14:55.000Z',
  monthly_credits: '220',
  pending_downgrade_at: null,
  pending_downgrade_display: null,
  pending_downgrade_tier_name: null,
  tier_id: 'ultra',
  tier_name: 'Ultra',
  ...overrides
})

export const todayBillingState = {
  auto_reload: {
    enabled: true,
    reload_to_display: '$10',
    reload_to_usd: '10',
    threshold_display: '$5',
    threshold_usd: '5'
  },
  balance_display: '$996.47',
  balance_usd: '996.47',
  can_charge: false,
  card: {
    brand: 'visa',
    last4: '3206',
    masked: 'visa ....3206'
  },
  charge_presets: ['100', '250', '500'],
  charge_presets_display: ['$100', '$250', '$500'],
  cli_billing_enabled: false,
  is_admin: true,
  logged_in: true,
  max_usd: '1000',
  min_usd: '10',
  monthly_cap: {
    is_default_ceiling: true,
    limit_display: '$100',
    limit_usd: '100',
    spent_display: '$10',
    spent_this_month_usd: '10'
  },
  ok: true,
  org_name: 'sid-5',
  portal_url: 'https://portal.nousresearch.com/billing',
  role: 'OWNER',
  usage: {
    available: true,
    has_topup: true,
    plan_name: 'Ultra',
    renews_at: '2026-07-11T08:14:55.000Z',
    renews_display: 'Jul 11',
    status: 'active',
    subscription_remaining_display: '$120',
    topup_remaining_display: '$876.47',
    total_spendable_display: '$996.47'
  }
} satisfies BillingStateResponse

export const todaySubscriptionState = {
  can_change_plan: true,
  context: 'team',
  current: current(),
  is_admin: true,
  logged_in: true,
  ok: true,
  org_id: 'sid-5',
  org_name: 'sid-5',
  portal_url: 'https://portal.nousresearch.com/billing',
  role: 'OWNER',
  tiers: [
    {
      dollars_per_month_display: '$200',
      is_current: true,
      is_enabled: true,
      monthly_credits: '220',
      name: 'Ultra',
      tier_id: 'ultra',
      tier_order: 3
    }
  ],
  usage: todayBillingState.usage
} satisfies SubscriptionStateResponse

export const postTrainBillingState = {
  ...todayBillingState,
  auto_reload: {
    enabled: false,
    reload_to_display: '$100',
    reload_to_usd: '100',
    threshold_display: '$25',
    threshold_usd: '25'
  },
  balance_display: '$142.50',
  balance_usd: '142.50',
  can_charge: true,
  card: {
    brand: 'visa',
    display: 'Visa ....4242 - the card on your subscription',
    last4: '4242',
    masked: 'visa ....4242',
    needs_repair: false,
    resolved_via: 'subPin'
  },
  charge_presets: ['25', '50', '100'],
  charge_presets_display: ['$25', '$50', '$100'],
  cli_billing_enabled: true,
  monthly_cap: {
    is_default_ceiling: false,
    limit_display: '$1,000',
    limit_usd: '1000',
    spent_display: '$180',
    spent_this_month_usd: '180'
  },
  org_name: 'Acme Research',
  usage: {
    available: true,
    has_topup: true,
    plan_bar: {
      fill_fraction: 0.4,
      kind: 'plan',
      pct_used: 60,
      remaining_display: '$40',
      spent_display: '$60',
      total_display: '$100'
    },
    plan_name: 'Pro',
    renews_at: '2026-07-31T00:00:00Z',
    renews_display: 'Jul 31',
    status: 'active',
    subscription_remaining_display: '$40',
    topup_bar: {
      fill_fraction: 0.75,
      kind: 'topup',
      pct_used: 25,
      remaining_display: '$75',
      spent_display: '$25',
      total_display: '$100'
    },
    topup_remaining_display: '$75',
    total_spendable_display: '$115'
  }
} satisfies BillingStateResponse

export const postTrainSubscriptionState = {
  ...todaySubscriptionState,
  current: current({
    credits_remaining: '40',
    cycle_ends_at: '2026-07-31T00:00:00Z',
    monthly_credits: '100',
    tier_id: 'pro',
    tier_name: 'Pro'
  }),
  org_id: 'org_123',
  org_name: 'Acme Research',
  tiers: [
    {
      dollars_per_month_display: '$20',
      is_current: true,
      is_enabled: true,
      monthly_credits: '100',
      name: 'Pro',
      tier_id: 'pro',
      tier_order: 2
    }
  ],
  usage: postTrainBillingState.usage
} satisfies SubscriptionStateResponse

export const loggedOutBillingState = {
  ...todayBillingState,
  auto_reload: null,
  balance_display: '$0.00',
  balance_usd: null,
  can_charge: false,
  card: null,
  charge_presets: [],
  charge_presets_display: [],
  logged_in: false,
  monthly_cap: null,
  org_name: null,
  portal_url: 'https://portal.nousresearch.com/login',
  role: null,
  usage: undefined
} satisfies BillingStateResponse

export const loggedOutSubscriptionState = {
  ...todaySubscriptionState,
  can_change_plan: false,
  current: null,
  is_admin: false,
  logged_in: false,
  org_id: null,
  org_name: null,
  portal_url: 'https://portal.nousresearch.com/login',
  role: null,
  tiers: [],
  usage: undefined
} satisfies SubscriptionStateResponse

export const okBilling = (data: BillingStateResponse): BillingResult<BillingStateResponse> => ({ data, ok: true })

export const okSubscription = (data: SubscriptionStateResponse): BillingResult<SubscriptionStateResponse> => ({
  data,
  ok: true
})

export const endpointUnavailableBilling = {
  ok: false,
  refusal: {
    kind: 'endpoint_unavailable',
    message: 'Billing endpoint returned a non-JSON response.'
  }
} satisfies BillingResult<BillingStateResponse>

export const endpointUnavailableSubscription = {
  ok: false,
  refusal: {
    kind: 'endpoint_unavailable',
    message: 'Subscription endpoint is not available.'
  }
} satisfies BillingResult<SubscriptionStateResponse>
