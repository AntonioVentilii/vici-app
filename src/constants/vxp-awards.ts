typescript
export const VXP_AWARDS = {
  // Tournament prize awards have been removed to prevent accidental minting.
  // The intended economy requires a proportional split of the league's bout pot
  // (stakes already committed by participants) rather than fixed mints from the
  // satellite treasury. This is a cross-repo design issue between vici-app and
  // icdc-core. See economy-parity audit notes alongside #536 / #539.
  // When the pot-split mechanism is implemented in icdc-core, the tournament
  // prize definitions should be added back here with the appropriate structure.
} as const;

export type VxpAwardType = 
  | 'prediction_correct'
  | 'prediction_incorrect'
  | 'streak_bonus'
  | 'referral_bonus'
  | 'daily_login'
  | 'achievement_unlock'
  | 'league_promotion'
  | 'league_demotion'
  | 'community_contribution'
  | 'content_creation'
  | 'moderation_reward'
  | 'early_adopter_bonus'
  | 'seasonal_event'
  | 'social_share'
  | 'feedback_reward'
  | 'bug_report'
  | 'onboarding_complete'
  | 'profile_completion'
  | 'first_prediction'
  | 'perfect_round'
  | 'comeback_award'
  | 'consistency_bonus'
  | 'accuracy_milestone'
  | 'volume_milestone'
  | 'league_champion'
  | 'tournament_participation'
  | 'tournament_placement'
  | 'special_event'
  | 'system_correction'
  | 'admin_adjustment';

export interface VxpAwardConfig {
  type: VxpAwardType;
  amount: number;
  description: string;
  cooldown?: number;
  maxPerDay?: number;
  maxPerWeek?: number;
  maxPerMonth?: number;
  requiresVerification?: boolean;
  enabled: boolean;
}

export const VXP_AWARD_CONFIGS: Record<VxpAwardType, VxpAwardConfig> = {
  prediction_correct: {
    type: 'prediction_correct',
    amount: 10,
    description: 'Awarded for correctly predicting a bout outcome',
    cooldown: 0,
    maxPerDay: 50,
    enabled: true,
  },
  prediction_incorrect: {
    type: 'prediction_incorrect',
    amount: 2,
    description: 'Consolation award for incorrect prediction',
    cooldown: 0,
    maxPerDay: 50,
    enabled: true,
  },
  streak_bonus: {
    type: 'streak_bonus',
    amount: 25,
    description: 'Bonus for maintaining a prediction streak',
    cooldown: 0,
    maxPerDay: 5,
    enabled: true,
  },
  referral_bonus: {
    type: 'referral_bonus',
    amount: 100,
    description: 'Awarded for successful user referral',
    cooldown: 0,
    maxPerDay: 10,
    maxPerWeek: 50,
    maxPerMonth: 200,
    enabled: true,
  },
  daily_login: {
    type: 'daily_login',
    amount: 5,
    description: 'Daily login reward',
    cooldown: 86400,
    maxPerDay: 1,
    enabled: true,
  },
  achievement_unlock: {
    type: 'achievement_unlock',
    amount: 50,
    description: 'Awarded for unlocking an achievement',
    cooldown: 0,
    maxPerDay: 10,
    enabled: true,
  },
  league_promotion: {
    type: 'league_promotion',
    amount: 200,
    description: 'Awarded for promotion to a higher league',
    cooldown: 0,
    maxPerDay: 1,
    enabled: true,
  },
  league_demotion: {
    type: 'league_demotion',
    amount: 0,
    description: 'No award for demotion',
    cooldown: 0,
    enabled: true,
  },
  community_contribution: {
    type: 'community_contribution',
    amount: 75,
    description: 'Awarded for valuable community contributions',
    cooldown: 0,
    maxPerDay: 5,
    maxPerWeek: 20,
    requiresVerification: true,
    enabled: true,
  },
  content_creation: {
    type: 'content_creation',
    amount: 150,
    description: 'Awarded for creating quality content',
    cooldown: 0,
    maxPerDay: 3,
    maxPerWeek: 10,
    requiresVerification: true,
    enabled: true,
  },
  moderation_reward: {
    type: 'moderation_reward',
    amount: 50,
    description: 'Awarded for moderation activities',
    cooldown: 0,
    maxPerDay: 10,
    maxPerWeek: 50,
    requiresVerification: true,
    enabled: true,
  },
  early_adopter_bonus: {
    type: 'early_adopter_bonus',
    amount: 500,
    description: 'One-time bonus for early platform adopters',
    cooldown: 0,
    maxPerDay: 1,
    maxPerWeek: 1,
    maxPerMonth: 1,
    enabled: true,
  },
  seasonal_event: {
    type: 'seasonal_event',
    amount: 100,
    description: 'Awarded during special seasonal events',
    cooldown: 0,
    maxPerDay: 5,
    maxPerWeek: 20,
    enabled: true,
  },
  social_share: {
    type: 'social_share',
    amount: 15,
    description: 'Awarded for sharing on social media',
    cooldown: 86400,
    maxPerDay: 3,
    enabled: true,
  },
  feedback_reward: {
    type: 'feedback_reward',
    amount: 25,
    description: 'Awarded for providing constructive feedback',
    cooldown: 0,
    maxPerDay: 2,
    maxPerWeek: 5,
    requiresVerification: true,
    enabled: true,
  },
  bug_report: {
    type: 'bug_report',
    amount: 100,
    description: 'Awarded for reporting confirmed bugs',
    cooldown: 0,
    maxPerDay: 3,
    maxPerWeek: 10,
    requiresVerification: true,
    enabled: true,
  },
  onboarding_complete: {
    type: 'onboarding_complete',
    amount: 50,
    description: 'Awarded for completing the onboarding process',
    cooldown: 0,
    maxPerDay: 1,
    enabled: true,
  },
  profile_completion: {
    type: 'profile_completion',
    amount: 25,
    description: 'Awarded for completing profile setup',
    cooldown: 0,
    maxPerDay: 1,
    enabled: true,
  },
  first_prediction: {
    type: 'first_prediction',
    amount: 20,
    description: 'Awarded for making the first prediction',
    cooldown: 0,
    maxPerDay: 1,
    enabled: true,
  },
  perfect_round: {
    type: 'perfect_round',
    amount: 200,
    description: 'Awarded for predicting all outcomes in a round correctly',
    cooldown: 0,
    maxPerDay: 3,
    enabled: true,
  },
  comeback_award: {
    type: 'comeback_award',
    amount: 75,
    description: 'Awarded for significant improvement after a losing streak',
    cooldown: 0,
    maxPerDay: 1,
    maxPerWeek: 3,
    enabled: true,
  },
  consistency_bonus: {
    type: 'consistency_bonus',
    amount: 50,
    description: 'Bonus for consistent daily participation',
    cooldown: 0,
    maxPerDay: 1,
    maxPerWeek: 7,
    enabled: true,
  },
  accuracy_milestone: {
    type: 'accuracy_milestone',
    amount: 100,
    description: 'Awarded for reaching accuracy milestones',
    cooldown: 0,
    maxPerDay: 1,
    maxPerWeek: 3,
    enabled: true,
  },
  volume_milestone: {
    type: 'volume_milestone',
    amount: 75,
    description: 'Awarded for reaching prediction volume milestones',
    cooldown: 0,
    maxPerDay: 1,
    maxPerWeek: 3,
    enabled: true,
  },
  league_champion: {
    type: 'league_champion',
    amount: 500,
    description: 'Awarded for winning a league season',
    cooldown: 0,
    maxPerDay: 1,
    maxPerWeek: 1,
    maxPerMonth: 1,
    enabled: true,
  },
  tournament_participation: {
    type: 'tournament_participation',
    amount: 25,
    description: 'Awarded for participating in a tournament',
    cooldown: 0,
    maxPerDay: 3,
    enabled: true,
  },
  tournament_placement: {
    type: 'tournament_placement',
    amount: 0,
    description: 'Tournament placement awards are disabled pending pot-split implementation',
    cooldown: 0,
    enabled: false,
  },
  special_event: {
    type: 'special_event',
    amount: 250,
    description: 'Awarded during special platform events',
    cooldown: 0,
    maxPerDay: 2,
    maxPerWeek: 5,
    enabled: true,
  },
  system_correction: {
    type: 'system_correction',
    amount: 0,
    description: 'System correction adjustment',
    cooldown: 0,
    requiresVerification: true,
    enabled: true,
  },
  admin_adjustment: {
    type: 'admin_adjustment',
    amount: 0,
    description: 'Manual admin adjustment',
    cooldown: 0,
    requiresVerification: true,
    enabled: true,
  },
};