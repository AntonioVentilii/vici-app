/**
 * Mockable countdown surface for the World Cup kickoff chip rendered in
 * the public landing hero. Single field today (`daysToKickoff`) so the
 * chip can render against a static fixture; once a real source of truth
 * lands (live engine clock, scheduler, or `WORLD_CUP_2026.kickoffAt_ms`
 * derivation), swap this module's value without touching consumers.
 *
 * Set `daysToKickoff` to `null` to hide the chip entirely.
 */
export interface WorldCupKickoff {
	readonly daysToKickoff: number | null;
}

export const WORLD_CUP_KICKOFF: WorldCupKickoff = {
	daysToKickoff: 47
};
