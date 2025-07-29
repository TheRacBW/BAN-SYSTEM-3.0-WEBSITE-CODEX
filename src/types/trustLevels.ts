// Trust Level System Types and Constants

export type TrustLevel = 0 | 0.5 | 1 | 2 | 3;

export interface TrustLevelConfig {
  level: TrustLevel;
  label: string;
  color: string;
  description: string;
  icon: string;
}

export const TRUST_LEVEL_CONFIGS: TrustLevelConfig[] = [
  {
    level: 0,
    label: "New",
    color: "badge-neutral",
    description: "Limited access, manual approval required.",
    icon: "🕵️‍♂️"
  },
  {
    level: 0.5,
    label: "Discord Verified",
    color: "badge-info",
    description: "Discord account verified and linked.",
    icon: "🔗"
  },
  {
    level: 1,
    label: "Paid Tracker Verified",
    color: "badge-warning",
    description: "Has paid tracker access and premium features.",
    icon: "💎"
  },
  {
    level: 2,
    label: "Trusted",
    color: "badge-success",
    description: "Can submit and edit content, auto-approval enabled.",
    icon: "🤝"
  },
  {
    level: 3,
    label: "Moderator",
    color: "badge-primary",
    description: "Can moderate users and submissions.",
    icon: "🛡️"
  }
];

export const TRUST_LEVEL_NAMES: Record<TrustLevel, string> = {
  0: "New",
  0.5: "Discord Verified",
  1: "Paid Tracker Verified",
  2: "Trusted",
  3: "Moderator"
};

export const TRUST_LEVEL_COLORS: Record<TrustLevel, string> = {
  0: "badge-neutral",
  0.5: "badge-info",
  1: "badge-warning",
  2: "badge-success",
  3: "badge-primary"
};

export const TRUST_LEVEL_ICONS: Record<TrustLevel, string> = {
  0: "🕵️‍♂️",
  0.5: "🔗",
  1: "💎",
  2: "🤝",
  3: "🛡️"
};

// Helper function to get trust level configuration
export function getTrustLevelConfig(level: TrustLevel): TrustLevelConfig {
  return TRUST_LEVEL_CONFIGS.find(config => config.level === level) || TRUST_LEVEL_CONFIGS[0];
}

// Helper function to get trust level badge info
export function getTrustLevelBadge(trustLevel: number) {
  const level = trustLevel as TrustLevel;
  return {
    name: TRUST_LEVEL_NAMES[level] || "New",
    color: TRUST_LEVEL_COLORS[level] || "badge-neutral"
  };
}