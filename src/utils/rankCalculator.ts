// Utility to calculate correct ranks based on combat power
interface MemberWithCombatPower {
  id?: string;
  rank: number;
  name: string;
  combatPower: number;
  [key: string]: unknown;
}

/**
 * Calculate the correct rank for a member based on combat power comparison
 * with a list of members. Rank 1 = highest combat power.
 */
export const calculateRankByCombatPower = (
  member: MemberWithCombatPower,
  allMembers: MemberWithCombatPower[]
): number => {
  const sortedByPower = [...allMembers]
    .sort((a, b) => b.combatPower - a.combatPower)
    .map((m) => m.id);

  const position = sortedByPower.indexOf(member.id || '');
  return position >= 0 ? position + 1 : member.rank;
};

/**
 * Recalculate ranks for all members based on their combat power
 */
export const recalculateAllRanks = (
  members: MemberWithCombatPower[]
): MemberWithCombatPower[] => {
  const sortedByPower = [...members].sort((a, b) => b.combatPower - a.combatPower);

  return sortedByPower.map((member, index) => ({
    ...member,
    rank: index + 1,
  }));
};
