-- VXP economy: server-fired award ledger plus the referral redemption
-- record the payout path settles against.

-- One row per server-fired VXP payout. The (user, award_type, award_key)
-- unique index IS the idempotency mechanism: a duplicate trigger collides
-- instead of double-crediting, exactly like the recipient/type/key doc-key
-- scheme the awards previously relied on. Amounts are VXP base units
-- (4 decimals) in numeric, never floats.
--
-- Status lifecycle is forward-only: pending -> paid | failed. A pending row
-- with no transfer yet is the record-only mode (VXP_TREASURY_DISABLED=1);
-- the reconciliation job pays those later.
create table if not exists vxp_awards (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references users (id) on delete cascade,
  award_type text not null check (award_type in (
    'onboarding',
    'streak',
    'calibration',
    'referral',
    'worlds_podium',
    'tournament_prize',
    'achievement',
    'comeback',
    'flow_milestone',
    'flow_overtime',
    'league_founder'
  )),
  award_key text not null,
  amount_base_units numeric not null check (amount_base_units > 0),
  status text not null default 'pending' check (status in ('pending', 'paid', 'failed')),
  earned_at_ms bigint not null,
  paid_at_ms bigint,
  block_index text,
  error_message text,
  created_at timestamptz not null default now(),
  unique (user_id, award_type, award_key)
);

-- Rolling-window caps (flow overtime, calibration) count a user's awards of
-- one type by creation time; reconciliation scans by status.
create index if not exists vxp_awards_user_type_created_idx
  on vxp_awards (user_id, award_type, created_at desc);

create index if not exists vxp_awards_status_idx
  on vxp_awards (status)
  where status = 'pending';

-- Referral redemptions: one row per referee, written at redeem time (the
-- redeem endpoint itself lands with the account phase; the payout path here
-- settles whatever rows exist). within_referrer_cap is null until the first
-- settlement pass decides the referrer's diminishing-curve slot, then
-- immutable, so a later redemption can never retroactively change an earlier
-- row's tier.
create table if not exists referrals (
  referee_user_id uuid primary key references users (id) on delete cascade,
  referrer_user_id uuid not null references users (id) on delete cascade,
  code text not null,
  redeemed_at_ms bigint not null,
  within_referrer_cap boolean,
  created_at timestamptz not null default now(),
  check (referee_user_id <> referrer_user_id)
);

create index if not exists referrals_referrer_idx
  on referrals (referrer_user_id, redeemed_at_ms);
