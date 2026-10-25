export type PositionCode =
  | 'GK'
  | 'CB'
  | 'LB'
  | 'RB'
  | 'CDM'
  | 'CM'
  | 'CAM'
  | 'LW'
  | 'RW'
  | 'ST';

export type FormationName = '4-3-3' | '4-4-2' | '4-2-3-1' | '3-5-2';

export type HairStyle = 'short' | 'fade' | 'afro' | 'bun' | 'buzz' | 'curls';

export interface PlayerAppearance {
  skinColor: string;
  hairColor: string;
  hairStyle: HairStyle;
  bootColor: string;
  heightCm: number;
  build: 'lean' | 'athletic' | 'stocky';
  accessory?: 'wristband' | 'headband' | 'gloves' | 'none';
}

export interface PlayerAttributes {
  pace: number;
  acceleration: number;
  shooting: number;
  finishing: number;
  passing: number;
  vision: number;
  dribbling: number;
  ballControl: number;
  tackling: number;
  marking: number;
  strength: number;
  jumping: number;
  stamina: number;
  agility: number;
  gkReflexes: number;
  gkPositioning: number;
  gkHandling: number;
}

export interface PlayerData {
  id: string;
  name: string;
  age: number;
  nationality: string;
  primaryPosition: PositionCode;
  secondaryPositions: PositionCode[];
  preferredFoot: 'Right' | 'Left';
  shirtNumber: number;
  skillMoves: number; // 1-5
  weakFoot: number; // 1-5
  playStyleTags: string[];
  attributes: PlayerAttributes;
  overall: number;
  fitness: number; // 0-100
  xp: number;
  level: number;
  marketValue: number;
  weeklyWage: number;
  contractYears: number;
  appearance: PlayerAppearance;
}

export interface KitConfig {
  primaryColor: string;
  secondaryColor: string;
  shortsColor: string;
  socksColor: string;
  gkColor: string;
  pattern: 'solid' | 'stripes' | 'hoops' | 'sash';
}

export interface TacticalConfig {
  formation: FormationName;
  mentality: 'Defensive' | 'Balanced' | 'Attacking' | 'All-Out Attack';
  pressingIntensity: number; // 20 - 100
  defensiveLineHeight: number; // 20 - 100
  passingStyle: 'Short' | 'Mixed' | 'Direct';
  width: number; // 20 - 100
  tempo: number; // 20 - 100
  captainId: string;
  penaltyTakerId: string;
  freeKickTakerId: string;
  cornerTakerId: string;
}

export interface TeamData {
  id: string;
  name: string;
  shortName: string;
  city: string;
  stadiumName: string;
  homeKit: KitConfig;
  awayKit: KitConfig;
  tactics: TacticalConfig;
  starters: PlayerData[]; // 11 players (or 4 in Street mode)
  substitutes: PlayerData[]; // 5 players
  prestige: number; // 1-5
  budget: number;
}

export type GameMode =
  | 'quick_match'
  | 'tournament'
  | 'career'
  | 'manager'
  | 'training'
  | 'challenge'
  | 'street';

export type DifficultyLevel = 'Amateur' | 'Semi-Pro' | 'Professional' | 'World Class';

export type CameraPreset = 'Broadcast' | 'Tactical' | 'Follow' | 'Action';

export type MatchPhase =
  | 'PRE_KICKOFF'
  | 'FIRST_HALF'
  | 'HALFTIME'
  | 'SECOND_HALF'
  | 'EXTRA_TIME'
  | 'PENALTY_SHOOTOUT'
  | 'GOAL_CELEBRATION'
  | 'SET_PIECE'
  | 'FULL_TIME';

export type SetPieceType =
  | 'NONE'
  | 'KICKOFF'
  | 'THROW_IN'
  | 'CORNER_KICK'
  | 'GOAL_KICK'
  | 'FREE_KICK'
  | 'PENALTY';

export interface MatchStats {
  homeGoals: number;
  awayGoals: number;
  homePossessionFrames: number;
  awayPossessionFrames: number;
  homeShots: number;
  awayShots: number;
  homeShotsOnTarget: number;
  awayShotsOnTarget: number;
  homePassesAttempted: number;
  homePassesCompleted: number;
  awayPassesAttempted: number;
  awayPassesCompleted: number;
  homeTackles: number;
  awayTackles: number;
  homeFouls: number;
  awayFouls: number;
  homeYellowCards: number;
  awayYellowCards: number;
  homeRedCards: number;
  awayRedCards: number;
  homeCorners: number;
  awayCorners: number;
  homeOffsides: number;
  awayOffsides: number;
  distanceCoveredMeters: number;
  outsideBoxGoals: number;
  goalScorers: Array<{
    team: 'home' | 'away';
    playerName: string;
    minute: number;
    outsideBox?: boolean;
  }>;
}

export interface MatchSettings {
  mode: GameMode;
  difficulty: DifficultyLevel;
  halfDurationMinutes: number; // Real minutes per half: 1, 2, 3, 5
  stadium: 'Apex Arena' | 'Crown Olympic' | 'Metro Concrete Cage' | 'Harbor Lights Stadium';
  weather: 'Clear Night' | 'Sunny Day' | 'Dusk';
  homeUseAwayKit: boolean;
  awayUseAwayKit: boolean;
  challengeId?: string;
  trainingDrillId?: string;
}

export interface TrainingDrill {
  id: string;
  title: string;
  category: 'Passing' | 'Shooting' | 'Dribbling' | 'Set Pieces' | 'Defending' | 'Goalkeeping';
  description: string;
  targetScore: number;
  durationSeconds: number;
  rewardXp: number;
  rewardCoins: number;
}

export interface ChallengeScenario {
  id: string;
  title: string;
  subtitle: string;
  difficulty: DifficultyLevel;
  description: string;
  initialHomeGoals: number;
  initialAwayGoals: number;
  startMinute: number;
  winConditionType:
    | 'SCORE_GOALS'
    | 'COMEBACK_WIN'
    | 'PASS_SEQUENCE'
    | 'OUTSIDE_BOX_GOAL'
    | 'DEFEND_LEAD'
    | 'LIMITED_SUBS_WIN';
  targetValue: number;
  rewardCoins: number;
  rewardXp: number;
}

export interface DailyObjective {
  id: string;
  title: string;
  description: string;
  metric: 'goals' | 'wins' | 'tackles' | 'passes' | 'outsideBoxGoals' | 'distance';
  target: number;
  progress: number;
  rewardCoins: number;
  rewardXp: number;
  claimed: boolean;
}

export interface CareerStanding {
  teamId: string;
  teamName: string;
  played: number;
  won: number;
  drawn: number;
  lost: number;
  goalsFor: number;
  goalsAgainst: number;
  points: number;
}

export interface CareerFixture {
  id: string;
  round: number;
  homeTeamId: string;
  awayTeamId: string;
  homeGoals?: number;
  awayGoals?: number;
  played: boolean;
}

export interface CareerState {
  clubId: string;
  season: number;
  currentRound: number;
  budget: number;
  standings: CareerStanding[];
  fixtures: CareerFixture[];
  transferListedPlayerIds: string[];
  seasonObjective: string;
  trophiesWon: number;
}

export interface TournamentMatch {
  id: string;
  round: 'Quarter-Finals' | 'Semi-Finals' | 'Final';
  homeTeamId: string;
  awayTeamId: string;
  homeGoals?: number;
  awayGoals?: number;
  winnerTeamId?: string;
}

export interface TournamentState {
  name: string;
  userTeamId: string;
  currentRound: 'Quarter-Finals' | 'Semi-Finals' | 'Final' | 'Completed';
  matches: TournamentMatch[];
  championTeamId?: string;
}

export interface UserSettings {
  masterVolume: number;
  musicVolume: number;
  crowdVolume: number;
  sfxVolume: number;
  commentaryVolume: number;
  graphicsQuality: 'Low' | 'Medium' | 'High';
  defaultCamera: CameraPreset;
  joystickDeadzone: number;
  controlSensitivity: number;
  buttonScale: number;
  hapticsEnabled: boolean;
  showRadar: boolean;
  showPlayerNames: boolean;
  autoSwitchDefender: boolean;
}

export interface CosmeticItem {
  id: string;
  name: string;
  category: 'Kit' | 'Boots' | 'Ball' | 'Stadium Banner';
  priceCoins: number;
  previewColor: string;
  accentColor: string;
  description: string;
  unlocked: boolean;
}

export interface UserProfile {
  managerName: string;
  clubBadgeStyle: 'shield' | 'circle' | 'hexagon' | 'crest';
  clubBadgePrimary: string;
  clubBadgeSecondary: string;
  coins: number;
  xp: number;
  level: number;
  dailyStreak: number;
  lastActiveDate: string;
  matchesPlayed: number;
  matchesWon: number;
  totalGoalsScored: number;
  achievementsUnlocked: string[];
  trainingHighScores: Record<string, number>;
  completedChallengeIds: string[];
  equippedBallColor: string;
}
