export type Character = {
  characterId: string;
  characterName: string;
  jobName: string;
  combatPower: number;
};

export type Boss = {
  bossId: string;
  bossName: string;
  difficulty: string;
  requiredCombatPower: number | null;
  crystalPrice: number;
};

export type WeeklyBossClear = {
  weeklyBossClearId: string;
  weekKey: string;
  characterId: string;
  bossId: string;
  clearedAt: string;
  isCleared: boolean;
};
