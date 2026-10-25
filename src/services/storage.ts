import {
  COSMETIC_STORE_ITEMS,
  DEFAULT_DAILY_OBJECTIVES,
  INITIAL_TEAMS,
} from '../data/database';
import {
  CareerFixture,
  CareerStanding,
  CareerState,
  CosmeticItem,
  DailyObjective,
  TeamData,
  TournamentState,
  UserProfile,
  UserSettings,
} from '../types/game';

const STORAGE_KEYS = {
  PROFILE: 'apex_pitch_26_profile_v1',
  SETTINGS: 'apex_pitch_26_settings_v1',
  TEAMS: 'apex_pitch_26_teams_v1',
  DAILY: 'apex_pitch_26_daily_v1',
  DAILY_DATE: 'apex_pitch_26_daily_date_v1',
  CAREER: 'apex_pitch_26_career_v1',
  TOURNAMENT: 'apex_pitch_26_tournament_v1',
  COSMETICS: 'apex_pitch_26_cosmetics_v1',
};

export function getTodayUtcDateString(): string {
  const now = new Date();
  return `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, '0')}-${String(
    now.getUTCDate()
  ).padStart(2, '0')}`;
}

export const DEFAULT_USER_SETTINGS: UserSettings = {
  masterVolume: 0.8,
  musicVolume: 0.5,
  crowdVolume: 0.65,
  sfxVolume: 0.85,
  commentaryVolume: 0.8,
  graphicsQuality: 'High',
  defaultCamera: 'Broadcast',
  joystickDeadzone: 0.12,
  controlSensitivity: 1.0,
  buttonScale: 1.0,
  hapticsEnabled: true,
  showRadar: true,
  showPlayerNames: true,
  autoSwitchDefender: true,
};

export const DEFAULT_USER_PROFILE: UserProfile = {
  managerName: 'Alex Mercer',
  clubBadgeStyle: 'shield',
  clubBadgePrimary: '#e11d48',
  clubBadgeSecondary: '#eab308',
  coins: 1250,
  xp: 450,
  level: 2,
  dailyStreak: 1,
  lastActiveDate: getTodayUtcDateString(),
  matchesPlayed: 0,
  matchesWon: 0,
  totalGoalsScored: 0,
  achievementsUnlocked: [],
  trainingHighScores: {},
  completedChallengeIds: [],
  equippedBallColor: '#ffffff',
};

export function loadUserSettings(): UserSettings {
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.SETTINGS);
    if (!raw) return DEFAULT_USER_SETTINGS;
    return { ...DEFAULT_USER_SETTINGS, ...JSON.parse(raw) };
  } catch {
    return DEFAULT_USER_SETTINGS;
  }
}

export function saveUserSettings(settings: UserSettings): void {
  try {
    localStorage.setItem(STORAGE_KEYS.SETTINGS, JSON.stringify(settings));
  } catch {
    // Ignore storage quota errors
  }
}

export function loadUserProfile(): UserProfile {
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.PROFILE);
    if (!raw) return DEFAULT_USER_PROFILE;
    const parsed: UserProfile = { ...DEFAULT_USER_PROFILE, ...JSON.parse(raw) };
    const today = getTodayUtcDateString();
    if (parsed.lastActiveDate !== today) {
      parsed.dailyStreak = Math.max(1, parsed.dailyStreak + 1);
      parsed.lastActiveDate = today;
      saveUserProfile(parsed);
    }
    return parsed;
  } catch {
    return DEFAULT_USER_PROFILE;
  }
}

export function saveUserProfile(profile: UserProfile): void {
  try {
    localStorage.setItem(STORAGE_KEYS.PROFILE, JSON.stringify(profile));
  } catch {
    // Ignore
  }
}

export function loadTeams(): TeamData[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.TEAMS);
    if (!raw) return INITIAL_TEAMS;
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed) && parsed.length === INITIAL_TEAMS.length) {
      return parsed;
    }
    return INITIAL_TEAMS;
  } catch {
    return INITIAL_TEAMS;
  }
}

export function saveTeams(teams: TeamData[]): void {
  try {
    localStorage.setItem(STORAGE_KEYS.TEAMS, JSON.stringify(teams));
  } catch {
    // Ignore
  }
}

export function loadDailyObjectives(): DailyObjective[] {
  try {
    const today = getTodayUtcDateString();
    const savedDate = localStorage.getItem(STORAGE_KEYS.DAILY_DATE);
    const raw = localStorage.getItem(STORAGE_KEYS.DAILY);
    if (savedDate !== today || !raw) {
      localStorage.setItem(STORAGE_KEYS.DAILY_DATE, today);
      localStorage.setItem(STORAGE_KEYS.DAILY, JSON.stringify(DEFAULT_DAILY_OBJECTIVES));
      return DEFAULT_DAILY_OBJECTIVES;
    }
    return JSON.parse(raw);
  } catch {
    return DEFAULT_DAILY_OBJECTIVES;
  }
}

export function saveDailyObjectives(objectives: DailyObjective[]): void {
  try {
    localStorage.setItem(STORAGE_KEYS.DAILY, JSON.stringify(objectives));
  } catch {
    // Ignore
  }
}

export function loadCosmetics(): CosmeticItem[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.COSMETICS);
    if (!raw) return COSMETIC_STORE_ITEMS;
    return JSON.parse(raw);
  } catch {
    return COSMETIC_STORE_ITEMS;
  }
}

export function saveCosmetics(items: CosmeticItem[]): void {
  try {
    localStorage.setItem(STORAGE_KEYS.COSMETICS, JSON.stringify(items));
  } catch {
    // Ignore
  }
}

export function createInitialCareerState(clubId: string, teams: TeamData[]): CareerState {
  const club = teams.find((t) => t.id === clubId) || teams[0];
  const standings: CareerStanding[] = teams.map((t) => ({
    teamId: t.id,
    teamName: t.name,
    played: 0,
    won: 0,
    drawn: 0,
    lost: 0,
    goalsFor: 0,
    goalsAgainst: 0,
    points: 0,
  }));

  // Generate 7-round single round-robin league schedule for 8 clubs
  const teamIds = teams.map((t) => t.id);
  const fixtures: CareerFixture[] = [];
  const n = teamIds.length;
  const rotating = teamIds.slice(1);

  for (let round = 1; round < n; round++) {
    const roundTeams = [teamIds[0], ...rotating];
    for (let i = 0; i < n / 2; i++) {
      const home = round % 2 === 0 ? roundTeams[i] : roundTeams[n - 1 - i];
      const away = round % 2 === 0 ? roundTeams[n - 1 - i] : roundTeams[i];
      fixtures.push({
        id: `s1_r${round}_m${i}`,
        round,
        homeTeamId: home,
        awayTeamId: away,
        played: false,
      });
    }
    rotating.unshift(rotating.pop()!);
  }

  return {
    clubId: club.id,
    season: 1,
    currentRound: 1,
    budget: club.budget,
    standings,
    fixtures,
    transferListedPlayerIds: [],
    seasonObjective: club.prestige >= 5 ? 'Win the League Title (Top 1)' : 'Qualify for Champions Cup (Top 4)',
    trophiesWon: 0,
  };
}

export function loadCareerState(teams: TeamData[]): CareerState {
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.CAREER);
    if (!raw) {
      const initial = createInitialCareerState(teams[0].id, teams);
      saveCareerState(initial);
      return initial;
    }
    return JSON.parse(raw);
  } catch {
    return createInitialCareerState(teams[0].id, teams);
  }
}

export function saveCareerState(state: CareerState): void {
  try {
    localStorage.setItem(STORAGE_KEYS.CAREER, JSON.stringify(state));
  } catch {
    // Ignore
  }
}

export function createInitialTournamentState(userTeamId: string, teams: TeamData[]): TournamentState {
  const ordered = [
    teams.find((t) => t.id === userTeamId) || teams[0],
    ...teams.filter((t) => t.id !== userTeamId),
  ];

  return {
    name: 'Global Champions Knockout Cup',
    userTeamId: ordered[0].id,
    currentRound: 'Quarter-Finals',
    matches: [
      { id: 'qf_1', round: 'Quarter-Finals', homeTeamId: ordered[0].id, awayTeamId: ordered[7].id },
      { id: 'qf_2', round: 'Quarter-Finals', homeTeamId: ordered[3].id, awayTeamId: ordered[4].id },
      { id: 'qf_3', round: 'Quarter-Finals', homeTeamId: ordered[1].id, awayTeamId: ordered[6].id },
      { id: 'qf_4', round: 'Quarter-Finals', homeTeamId: ordered[2].id, awayTeamId: ordered[5].id },
    ],
  };
}

export function loadTournamentState(teams: TeamData[]): TournamentState {
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.TOURNAMENT);
    if (!raw) {
      const init = createInitialTournamentState(teams[0].id, teams);
      saveTournamentState(init);
      return init;
    }
    return JSON.parse(raw);
  } catch {
    return createInitialTournamentState(teams[0].id, teams);
  }
}

export function saveTournamentState(state: TournamentState): void {
  try {
    localStorage.setItem(STORAGE_KEYS.TOURNAMENT, JSON.stringify(state));
  } catch {
    // Ignore
  }
}

/**
 * Future-ready Multiplayer & Backend Service Interfaces.
 * Explicitly documents required server authority and networking contracts
 * without fabricating fake online connections.
 */
export interface MultiplayerRoomState {
  roomId: string;
  hostPlayerId: string;
  guestPlayerId?: string;
  mode: '1v1_Ranked' | '1v1_Friendly' | 'Private_Lobby';
  pingMs: number;
  serverAuthoritativeTick: number;
}

export interface IMultiplayerNetworkService {
  readonly isConnected: boolean;
  readonly statusMessage: string;
  createPrivateRoom(hostTeamId: string): Promise<{ supported: boolean; reason: string }>;
  joinMatchmakingQueue(division: string): Promise<{ supported: boolean; reason: string }>;
}

export const multiplayerServiceStub: IMultiplayerNetworkService = {
  isConnected: false,
  statusMessage:
    'Pending WebSocket / WebRTC Matchmaking Server & Server-Authoritative Physics Relay Integration.',
  async createPrivateRoom() {
    return {
      supported: false,
      reason:
        'Online multiplayer requires a dedicated authoritative WebSocket match server and matchmaking database.',
    };
  },
  async joinMatchmakingQueue() {
    return {
      supported: false,
      reason:
        'Ranked 1v1 matchmaking is architected and ready for backend deployment. Play Local Quick Match, Tournament, or Career Mode against AI now.',
    };
  },
};
