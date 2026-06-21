/* ============================================================
   VICI — Flow Motion Engine (v3 — refined: pools · jitter · economy)
   ------------------------------------------------------------
   Pure JS. A swipe in Flow PLACES a call; it does not resolve one.
   Markets settle on their own dates, elsewhere. So this engine never
   sees a "correct" signal and never moves accuracy or win/loss.
   It rewards the ACT of calling and the discipline of showing up.

   What changed from v2 (ported from the signed-off Flow Motion System v3):
   • Copy is a rotating POOL per slot — never the same line twice running,
     persisted so a daily user gets variation session-to-session.
   • Within-day rhythm beats fire on JITTERED positions (a window, not a
     fixed slot) so the cadence is never memorised.
   • Deflation-safe VXP economy (starter 1,000 · call 50): dopamine ≠
     currency. Daily-ten and early milestones mint NOTHING; VXP is minted
     only at the +5 overtime finish (+25) and rare lifetime milestones
     (50→+50 … 1,000→+500). Growth comes from being right, not showing up.
   • Credit-STACKING: if a milestone coincides with the daily-complete beat,
     BOTH bonuses are credited even though one beat animates.
   • Wildcard — a rare (~1 in 6) variable-ratio surprise carrying a
     non-currency TREAT (sticker / shield / flair), never VXP.
   • Comeback — a distinct, no-shame opener for a user returning after a
     broken streak (input.isComeback), separate from the daily "welcome back".

   recordSwipe({ side, isContrarian, dailyDone, dailyTarget,
                 dailyJustCompleted, dayStreak, firstLeaderboard,
                 wildcards = true, isComeback = false })
     → { bonusXp, beat | null, state }.

   bonusXp is a GENUINE VXP grant, credited by the caller (app.jsx →
   onPredict({ bonus })). Routine swipes pay no VXP.

   beat fields consumed by MotionBeat: { kind, character, copy, duration,
   haptic, badge?, title?, treat?, sub?, count? }.
   ============================================================ */
(function () {
	const STORAGE_KEY = 'vici.motion.state.v3';

	const TIER_RANKS = { NONE: 0, SPARK: 1, EMBER: 2, FLAME: 3, BLAZE: 4, INFERNO: 5 };
	function tierForStreak(s) {
		if (s >= 30) return 'INFERNO';
		if (s >= 15) return 'BLAZE';
		if (s >= 7) return 'FLAME';
		if (s >= 3) return 'EMBER';
		if (s >= 1) return 'SPARK';
		return 'NONE';
	}

	// ── Copy pools. Picked non-repeating via pick(). ──
	const POOLS = {
		'first-call': [
			"You're in!",
			"First call's on the board.",
			"And you're off!",
			'Welcome to the game.'
		],
		'daily-ten': ['Ten! On fire.', 'Ten for ten.', 'Daily ten — done.'],
		'overtime-15': ['Fifteen. Unstoppable.', 'Fifteen. Machine.', 'Overtime, owned.'],
		'ot-enter': ['Greedy. I like it.', 'Round two, then.', 'Hungry today.'],
		'ot-rare': ['Few make it here.', 'Rarefied air.', 'Not many reach this.'],
		'first-yes': ['Bullish!', 'Optimist, eh?', 'Betting on yes.'],
		'first-no': ['Bearish!', 'Skeptic, huh?', 'Betting on no.'],
		'first-contra': ["You don't follow.", 'Against the grain.', "Crowd's wrong, you reckon?"],
		r3: ['Hat trick!', 'Three down.', 'On a roll.'],
		r5: ['Halfway there!', 'Five in.', 'Halfway home.', 'Pacing nicely.'],
		r8: ['Two to go!', 'Almost home.', 'So close.', 'Two left.'],
		'welcome-back': [
			'Welcome back.',
			'Look who’s back.',
			'There you are.',
			'Right on time.',
			'Missed you.'
		],
		comeback: [
			'Knew you’d be back.',
			'The record was waiting.',
			'No grudges — let’s go.',
			'Right where you left off.'
		],
		wildcard: ['Wildcard!', 'Surprise!', 'Plot twist.', 'Didn’t see that?'],
		'streak-reborn': ['Streak reborn.', 'Day 1 — again.', 'Back on the board.']
	};
	const TREATS = ['Rare sticker', 'Streak shield', 'Profile flair', 'Mystery drop'];

	// Lifetime call-volume milestones. VXP minted only from 50 up, in call-units
	// (×50); fires ONCE ever. 1·10·25 are badge/moment-only (no VXP). Oracle owns
	// the ladder from 50; Vici welcomes the very first call.
	const VOLUME = {
		1: {
			bonus: 0,
			character: 'vici',
			copy: 'first-call',
			sub: 'FIRST CALL',
			duration: 1900,
			haptic: [12, 30, 12, 30, 12]
		},
		10: {
			bonus: 50,
			character: 'oracle',
			copy: 'Ten calls in.',
			sub: '10 LIFETIME',
			duration: 1300,
			haptic: [25, 30, 25]
		},
		25: {
			bonus: 0,
			character: 'oracle',
			copy: 'A regular now.',
			sub: '25 LIFETIME',
			duration: 1200,
			haptic: 12
		},
		100: {
			bonus: 100,
			character: 'oracle',
			copy: 'A hundred. Respect.',
			sub: '100 LIFETIME',
			duration: 1700,
			haptic: [12, 30, 12, 30, 12, 30, 60],
			badge: 'CENTURION'
		},
		500: {
			bonus: 250,
			character: 'oracle',
			copy: 'Five hundred.',
			sub: '500 LIFETIME',
			duration: 1500,
			haptic: [25, 30, 25]
		},
		1000: {
			bonus: 500,
			character: 'oracle',
			copy: 'Legend.',
			sub: '1,000 LIFETIME',
			duration: 2000,
			haptic: [40, 30, 40, 30, 80],
			title: 'vici'
		}
	};

	// Within-day rhythm — pacing only, NO bonus. Each soft beat fires somewhere
	// inside its WINDOW (jittered per day), not on a fixed call number.
	const RHYTHM = {
		r3: { window: [2, 4], character: 'vici', pool: 'r3', duration: 700, haptic: 12 },
		r5: { window: [4, 6], character: 'vici', pool: 'r5', duration: 750, haptic: 12 },
		r8: { window: [7, 9], character: 'vici', pool: 'r8', duration: 700, haptic: 12 }
	};
	// Overtime rhythm (calls 11 & 13) — fixed; the +5 is a short, special arc.
	const OT_RHYTHM = {
		11: {
			character: 'trickster',
			pool: 'ot-enter',
			sub: 'OVERTIME',
			duration: 1300,
			haptic: [10, 40, 10]
		},
		13: { character: 'oracle', pool: 'ot-rare', duration: 900, haptic: 12 }
	};

	function defaultState() {
		return {
			lifetime: { calls: 0, yes: 0, no: 0, skips: 0 },
			flags: { firstYes: false, firstNo: false, firstContrarian: false, firstLeaderboard: false },
			dayTier: 'NONE',
			seen: {}, // pool key → last index shown (non-repeat)
			day: { sched: null, last: 0 } // jittered rhythm schedule for the current day
		};
	}

	function load() {
		try {
			const raw = localStorage.getItem(STORAGE_KEY);
			if (!raw) return defaultState();
			const parsed = JSON.parse(raw);
			const d = defaultState();
			return {
				...d,
				...parsed,
				lifetime: { ...d.lifetime, ...(parsed.lifetime || {}) },
				flags: { ...d.flags, ...(parsed.flags || {}) },
				seen: { ...(parsed.seen || {}) },
				day: { ...d.day, ...(parsed.day || {}) }
			};
		} catch (e) {
			return defaultState();
		}
	}
	function save(state) {
		try {
			localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
		} catch (e) {}
	}

	// Pick a pool entry, never repeating the last one shown for that key.
	function pick(state, key) {
		const arr = POOLS[key];
		if (!arr) return key; // allow literal strings (non-pool copy)
		if (arr.length === 1) return arr[0];
		const last = state.seen[key];
		let i;
		do {
			i = Math.floor(Math.random() * arr.length);
		} while (i === last && arr.length > 1);
		state.seen[key] = i;
		return arr[i];
	}

	// Build a jittered rhythm schedule for a fresh day: each rhythm beat lands on
	// a random call within its window, collisions avoided. → { callNo: rhythmKey }.
	function buildSchedule() {
		const out = {},
			used = {};
		['r3', 'r5', 'r8'].forEach((k) => {
			const w = RHYTHM[k].window;
			const opts = [];
			for (let p = w[0]; p <= w[1]; p++) if (!used[p]) opts.push(p);
			const pos = opts.length ? opts[Math.floor(Math.random() * opts.length)] : w[0];
			used[pos] = true;
			out[pos] = k;
		});
		return out;
	}

	// Single-pass priority resolution with credit-stacking.
	function recordSwipe(input) {
		const {
			side,
			isContrarian,
			dailyDone,
			dailyTarget,
			dailyJustCompleted,
			dayStreak,
			firstLeaderboard,
			wildcards = true,
			isComeback = false
		} = input || {};
		const state = load();

		// SKIP — skims past a market; no call placed, no beat, no streak progress.
		if (side === 'SKIP') {
			state.lifetime.skips += 1;
			save(state);
			return { bonusXp: 0, beat: null, state };
		}

		state.lifetime.calls += 1;
		if (side === 'YES') state.lifetime.yes += 1;
		if (side === 'NO') state.lifetime.no += 1;
		// Prefer the app's REAL lifetime count (me.calls) when supplied, so volume
		// milestones fire at the true number — not the engine's local tally.
		const calls = input.lifetimeCalls != null ? input.lifetimeCalls + 1 : state.lifetime.calls;
		const target = dailyTarget || 10;
		const overtime = target >= 15;

		// New day → fresh jittered rhythm schedule. (dailyDone resets to 1 each day.)
		if (dailyDone <= 1 || dailyDone < (state.day.last || 0)) state.day.sched = buildSchedule();
		state.day.last = dailyDone;
		if (!state.day.sched) state.day.sched = buildSchedule();

		let bonusXp = 0; // credit-stacked across all eligible sources
		let beat = null; // only the highest-priority beat animates

		// ── Comeback opener (after a lapse) — owns the first call of the day ──
		if (isComeback && dailyDone === 1) {
			beat = {
				kind: 'comeback',
				character: 'vici',
				copy: pick(state, 'comeback'),
				sub: 'COMEBACK',
				duration: 1700,
				haptic: [12, 30, 12, 30, 12]
			};
		}

		// ── 1. Daily / overtime complete — the streak beat (showing up) ──
		if (dailyJustCompleted) {
			const tier = tierForStreak(dayStreak || 1);
			state.dayTier = tier;
			const ds = dayStreak || 1;
			if (overtime) {
				bonusXp += 25; // the ONLY repeatable mint — the +5 overtime finish
				if (!beat)
					beat = {
						kind: 'overtime-complete',
						character: 'flame',
						tier: tier === 'NONE' ? 'SPARK' : tier,
						copy: pick(state, 'overtime-15'),
						sub: 'OVERTIME COMPLETE',
						bonus: 25,
						duration: 1900,
						haptic: [25, 30, 25, 40, 60]
					};
			} else {
				// regular daily ten — celebration + streak, but NO VXP (deflation-safe)
				if (!beat)
					beat = {
						kind: 'daily-complete',
						character: 'flame',
						tier: tier === 'NONE' ? 'SPARK' : tier,
						copy: isComeback ? pick(state, 'streak-reborn') : pick(state, 'daily-ten'),
						sub: isComeback ? 'STREAK RESTARTED' : 'STREAK +1',
						duration: 1900,
						haptic: [25, 30, 25, 40, 60]
					};
			}
		}

		// ── 2. Lifetime volume milestone — VXP credited even if it coincides ──
		if (VOLUME[calls]) {
			const m = VOLUME[calls];
			bonusXp += m.bonus || 0;
			if (!beat) {
				beat = {
					kind: 'volume-' + calls,
					character: m.character,
					copy: POOLS[m.copy] ? pick(state, m.copy) : m.copy,
					sub: m.sub,
					bonus: m.bonus || 0,
					duration: m.duration,
					haptic: m.haptic,
					badge: m.badge,
					title: m.title,
					count: calls
				};
			}
		}

		// ── 3. Overtime rhythm (calls 11 & 13) ──
		if (!beat && overtime && OT_RHYTHM[dailyDone]) {
			const m = OT_RHYTHM[dailyDone];
			beat = {
				kind: 'ot-' + dailyDone,
				character: m.character,
				copy: pick(state, m.pool),
				sub: m.sub,
				duration: m.duration,
				haptic: m.haptic
			};
		}

		// ── 4. First-position events — a stance taken, not an outcome ──
		// Deferred past call #1 so "first-call" owns the very first swipe.
		if (!beat && calls > 1) {
			if (side === 'YES' && !state.flags.firstYes) {
				state.flags.firstYes = true;
				beat = {
					kind: 'first-yes',
					character: 'vici',
					copy: pick(state, 'first-yes'),
					duration: 900,
					haptic: [12, 30, 12]
				};
			} else if (side === 'NO' && !state.flags.firstNo) {
				state.flags.firstNo = true;
				beat = {
					kind: 'first-no',
					character: 'vici',
					copy: pick(state, 'first-no'),
					duration: 900,
					haptic: [12, 30, 12]
				};
			} else if (isContrarian && !state.flags.firstContrarian) {
				state.flags.firstContrarian = true;
				beat = {
					kind: 'first-contrarian',
					character: 'trickster',
					copy: pick(state, 'first-contra'),
					sub: 'CONTRARIAN',
					badge: 'CONTRARIAN',
					duration: 1100,
					haptic: [10, 40, 10, 40, 10]
				};
			} else if (firstLeaderboard && !state.flags.firstLeaderboard) {
				state.flags.firstLeaderboard = true;
				beat = {
					kind: 'first-leaderboard',
					character: 'oracle',
					copy: 'On the board.',
					duration: 1200,
					haptic: [40, 60, 40]
				};
			}
		}

		// ── 5. Within-day rhythm (jittered) ──
		if (!beat && !overtime && state.day.sched[dailyDone] && dailyDone < target) {
			const key = state.day.sched[dailyDone];
			const m = RHYTHM[key];
			beat = {
				kind: 'daily-' + dailyDone,
				character: m.character,
				copy: pick(state, m.pool),
				duration: m.duration,
				haptic: m.haptic
			};
		}

		// ── 6. Wildcard — rare variable-ratio surprise, non-currency TREAT ──
		if (!beat && wildcards && calls > 1 && Math.random() < 1 / 6) {
			const treat = TREATS[Math.floor(Math.random() * TREATS.length)];
			beat = {
				kind: 'wildcard',
				character: 'trickster',
				copy: pick(state, 'wildcard'),
				treat: treat,
				sub: 'SURPRISE',
				duration: 1250,
				haptic: [10, 40, 10]
			};
		}

		// ── 7. Every-10th lifetime ambient (no copy, just a pop) ──
		if (!beat && calls > 10 && calls % 10 === 0) {
			beat = { kind: 'ambient-10', character: 'vici', copy: null, duration: 360, haptic: 12 };
		}

		save(state);
		return { bonusXp, beat, state };
	}

	function reset() {
		save(defaultState());
	}

	window.MotionEngine = {
		recordSwipe,
		getState: load,
		reset,
		tierForStreak,
		VOLUME,
		POOLS
	};
})();
