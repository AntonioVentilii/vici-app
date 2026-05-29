/**
 * ICDC-core Engine identifier for the Vici app.
 *
 * The Vici Engine is the first (and only) engine registered on the icdc-core registry
 * for each network, so its ID is always `eng_0`.
 *
 * If the registry is ever reset or another engine is registered before Vici, update this
 * constant (and re-seed role grants) to match the actual engine ID.
 *
 * The engine declares `Creator` + `OracleAdmin` as `allowed_roles`. Role grants are
 * synchronized from the Juno `roles` collection via the `syncRoleToEngine` satellite hook.
 */
export const VICI_ENGINE_ID = 'eng_0';
