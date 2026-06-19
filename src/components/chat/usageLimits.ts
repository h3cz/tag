export type TagUsageTier = "anon" | "free" | "pro";

export const TAG_HOSTED_DAILY_LIMITS: Record<TagUsageTier, { msg: number; premium: number }> = {
  anon: { msg: 3, premium: 0 },
  free: { msg: 10, premium: 0 },
  pro: { msg: 50, premium: 100 },
};

export function getHostedDailyLimit(tier: TagUsageTier): number {
  return TAG_HOSTED_DAILY_LIMITS[tier].msg;
}

export function getPremiumDailyLimit(tier: TagUsageTier): number {
  return TAG_HOSTED_DAILY_LIMITS[tier].premium;
}
