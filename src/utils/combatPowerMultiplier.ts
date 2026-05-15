export interface CombatPowerMultiplierTier {
  id: 'tier-1' | 'tier-2' | 'tier-3' | 'tier-4';
  minimumCombatPower: number;
  label: string;
  multiplier: number;
}

export const COMBAT_POWER_MULTIPLIER_TIERS: CombatPowerMultiplierTier[] = [
  { id: 'tier-1', minimumCombatPower: 150000, label: '150,000+', multiplier: 3.0 },
  { id: 'tier-2', minimumCombatPower: 130000, label: '130,000-149,999', multiplier: 2.5 },
  { id: 'tier-3', minimumCombatPower: 110000, label: '110,000-129,999', multiplier: 2.0 },
  { id: 'tier-4', minimumCombatPower: 0, label: '109,999 and below', multiplier: 1.0 },
];

export const getCombatPowerMultiplier = (combatPower: number): number => {
  const normalizedCombatPower = Number.isFinite(combatPower) ? combatPower : 0;
  const matchedTier = COMBAT_POWER_MULTIPLIER_TIERS.find(
    (tier) => normalizedCombatPower >= tier.minimumCombatPower
  );

  return matchedTier?.multiplier ?? 1.0;
};