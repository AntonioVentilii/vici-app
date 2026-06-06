# Vici market maker (liquidity service)

Vici markets are priced by the **icdc-core `clearing` CLOB** (central limit
order book), not by an LMSR curve. A market created via `registry.add_series`
has **no orders and therefore no price** until someone posts liquidity. The
**`vici-maker`** service is that someone.

> **`vici-maker` lives in its own repo:**
> [`../vici-maker`](https://github.com/AntonioVentilii/vici-maker) — a Bun +
> Elysia service on Fly.io, the same operational pattern as
> [`vici-courier`](https://github.com/AntonioVentilii/vici-courier). This page
> records only what the **vici-app / icdc-core / VXP-minter** side must provide;
> the service's own design + setup live in that repo's `README.md` /
> `FUNDING.md`.

## What it is

An off-chain bot that holds its **own IC identity** and **VXP collateral**, and
on a timer:

1. discovers open **binary `ViciXp` markets created by the Vici engine
   (`engine_id = eng_0`)** via `registry.list_series_with`;
2. reads each order book (`clearing.list_orders`);
3. prices each market with the **ported V1.5 LMSR brain** (`market-engine.js`)
   — a fair value + a per-market depth — and sizes a two-sided limit-order
   ladder so deeper (tournament-long) lines move slower than near-term dailies;
4. reconciles its resting orders (`clearing.submit_limit_order` /
   `cancel_limit_order`), bounded by its available ViciXp margin.

It is **passive**: resting limit orders only, no market orders, no manufactured
volume. The prototype's synthetic "crowd" is intentionally not reproduced.

## What this side must provide (the funding chain)

Each order blocks **VXP collateral** in the clearing **`ViciXp`** domain. For
the maker to always have VXP to quote with:

```
vxp_minter ──auto-rebalance timer──▶ maker's VXP ledger account
                                            │  vici-maker: approve + deposit_collateral
                                            ▼
                                   clearing ViciXp collateral ──▶ order margin
```

1. **VXP minter** (`../vici-points/src/minter`) — register the maker's principal
   as a reserve with `allow_auto_rebalance = true` (`add_reserve`). The minter's
   timer (`services/timer.rs`) then keeps that ledger account topped to
   `target_balance` whenever it dips below `min_balance` — the "always funded"
   mechanism. Identical call to
   [`scripts/init/init.vxp-treasury.sh`](../scripts/init/init.vxp-treasury.sh),
   different account.

2. **icdc-core / clearing** — VXP must be a collateral asset with `ViciXp` in
   `allowed_balance_domains` and `is_enabled = true` (`register_icrc_asset` /
   `update_collateral_asset`). Target markets must be `Open` trading access (or
   the maker principal added to their registry groups). The maker deposits its
   own collateral at runtime — no admin deposit needed.

3. **vici-app** — **no code change required to run it.** The maker reads no
   `app_config` doc and the satellite neither mints to nor manages it. Markets
   are already created in the ViciXp domain under `eng_0`
   (`src/lib/services/market.services.ts`). _Optional:_ expose per-series
   editorial opening priors so cold markets open at consensus instead of 0.5
   (today the maker takes these via a `PRIORS_JSON` env map).

The exact `dfx` commands and tuning are in
[`vici-maker/FUNDING.md`](https://github.com/AntonioVentilii/vici-maker/blob/main/FUNDING.md).

## Why a separate off-chain service

- It must **custody a signing key** and act as a trading principal — a Juno
  satellite can't safely hold one (node operators can read canister state), same
  reasoning as `vici-courier`.
- It runs a **wall-clock loop**; Juno has no scheduler primitive.
- It is **economically isolated** — a bug can only lose the maker's own VXP,
  never user funds or mint authority.

See also: [`engine-integration.md`](./engine-integration.md) (how Vici registers
as `eng_0` and how market creation is gated).
