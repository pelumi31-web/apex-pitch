import React, { useState } from 'react';
import {
  Award,
  Check,
  ChevronRight,
  Compass,
  Flame,
  Globe,
  Play,
  RefreshCw,
  Settings,
  Shield,
  ShoppingBag,
  Sliders,
  Target,
  TrendingUp,
  Trophy,
  Users,
  Zap,
} from 'lucide-react';
import {
  CHALLENGE_SCENARIOS,
  TRAINING_DRILLS,
  calculateOverallRating,
} from '../data/database';
import { multiplayerServiceStub } from '../services/storage';
import {
  CareerState,
  CosmeticItem,
  DailyObjective,
  DifficultyLevel,
  MatchSettings,
  MatchStats,
  PlayerData,
  TeamData,
  TournamentState,
  UserProfile,
  UserSettings,
} from '../types/game';

interface MatchResultsModalProps {
  stats: MatchStats;
  homeTeam: TeamData;
  awayTeam: TeamData;
  matchSettings: MatchSettings;
  challengePassed?: boolean;
  trainingScore?: number;
  earnedCoins: number;
  earnedXp: number;
  onRematch: () => void;
  onExitToMenu: () => void;
}

export const MatchResultsModal: React.FC<MatchResultsModalProps> = ({
  stats,
  homeTeam,
  awayTeam,
  matchSettings,
  challengePassed,
  trainingScore,
  earnedCoins,
  earnedXp,
  onRematch,
  onExitToMenu,
}) => {
  const totalPoss = stats.homePossessionFrames + stats.awayPossessionFrames;
  const homePoss = Math.round((stats.homePossessionFrames / totalPoss) * 100);
  const awayPoss = 100 - homePoss;

  const homePassPct =
    stats.homePassesAttempted > 0
      ? Math.round((stats.homePassesCompleted / stats.homePassesAttempted) * 100)
      : 100;
  const awayPassPct =
    stats.awayPassesAttempted > 0
      ? Math.round((stats.awayPassesCompleted / stats.awayPassesAttempted) * 100)
      : 100;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#070b12]/95 p-4">
      <div className="scrollable-panel max-h-[92vh] w-full max-w-3xl border border-white/15 bg-[#0f172a] p-6 shadow-2xl">
        <div className="border-b border-white/10 pb-4 text-center">
          <p className="text-xs font-bold tracking-widest text-emerald-400 uppercase">
            {matchSettings.mode === 'training'
              ? 'Training Session Complete'
              : matchSettings.mode === 'challenge'
              ? challengePassed
                ? 'Challenge Objective Completed!'
                : 'Challenge Failed — Try Again'
              : 'Full-Time Official Match Report'}
          </p>

          {matchSettings.mode === 'training' ? (
            <div className="mt-3">
              <div className="font-mono-tabular text-4xl font-bold text-white">
                {trainingScore} PTS
              </div>
              <p className="mt-1 text-xs text-slate-400">
                Rewards Earned: +{earnedCoins} Coins · +{earnedXp} XP
              </p>
            </div>
          ) : (
            <div className="mt-3 flex items-center justify-center gap-6">
              <div className="text-right">
                <div className="font-display text-2xl font-bold text-white uppercase sm:text-3xl">
                  {homeTeam.name}
                </div>
                <div className="text-xs text-slate-400">{homeTeam.city}</div>
              </div>

              <div className="border border-white/15 bg-[#090d16] px-5 py-2 font-mono-tabular text-3xl font-bold text-emerald-400 sm:text-4xl">
                {stats.homeGoals} - {stats.awayGoals}
              </div>

              <div className="text-left">
                <div className="font-display text-2xl font-bold text-white uppercase sm:text-3xl">
                  {awayTeam.name}
                </div>
                <div className="text-xs text-slate-400">{awayTeam.city}</div>
              </div>
            </div>
          )}

          {/* Goal Scorers Summary */}
          {stats.goalScorers.length > 0 && (
            <div className="mt-3 flex flex-wrap justify-center gap-x-4 gap-y-1 text-xs text-slate-300">
              {stats.goalScorers.map((g, i) => (
                <span key={i}>
                  {g.playerName} ({g.minute}'{g.outsideBox ? ' Long Range' : ''})
                </span>
              ))}
            </div>
          )}
        </div>

        {/* Match Telemetry Comparison Table */}
        <div className="mt-5 space-y-2.5 text-xs">
          {[
            { label: 'Possession', home: `${homePoss}%`, away: `${awayPoss}%` },
            { label: 'Total Shots', home: stats.homeShots, away: stats.awayShots },
            { label: 'Shots on Target', home: stats.homeShotsOnTarget, away: stats.awayShotsOnTarget },
            { label: 'Passing Accuracy', home: `${homePassPct}%`, away: `${awayPassPct}%` },
            { label: 'Passes Completed', home: stats.homePassesCompleted, away: stats.awayPassesCompleted },
            { label: 'Tackles Won', home: stats.homeTackles, away: stats.awayTackles },
            { label: 'Corners', home: stats.homeCorners, away: stats.awayCorners },
            { label: 'Fouls Committed', home: stats.homeFouls, away: stats.awayFouls },
            { label: 'Offsides', home: stats.homeOffsides, away: stats.awayOffsides },
            {
              label: 'Yellow / Red Cards',
              home: `${stats.homeYellowCards} / ${stats.homeRedCards}`,
              away: `${stats.awayYellowCards} / ${stats.awayRedCards}`,
            },
          ].map((row) => (
            <div
              key={row.label}
              className="grid grid-cols-3 items-center border-b border-white/5 py-1.5"
            >
              <span className="font-mono-tabular font-bold text-emerald-400">{row.home}</span>
              <span className="text-center text-slate-400">{row.label}</span>
              <span className="text-right font-mono-tabular font-bold text-rose-400">
                {row.away}
              </span>
            </div>
          ))}
        </div>

        {/* Rewards & Action Footer */}
        <div className="mt-6 flex flex-wrap items-center justify-between gap-4 border-t border-white/10 pt-4">
          <div className="text-xs text-slate-300">
            Match Rewards: <strong className="text-amber-300">+{earnedCoins} Coins</strong> ·{' '}
            <strong className="text-emerald-400">+{earnedXp} XP</strong>
          </div>

          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={onRematch}
              className="flex items-center gap-2 border border-white/15 bg-slate-800 px-4 py-2.5 text-xs font-semibold text-white hover:bg-slate-700"
            >
              <RefreshCw className="h-4 w-4 text-emerald-400" />
              <span>Play Rematch</span>
            </button>

            <button
              type="button"
              onClick={onExitToMenu}
              className="bg-emerald-500 px-5 py-2.5 text-xs font-bold text-slate-950 uppercase hover:bg-emerald-400"
            >
              Continue to Main Hub
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

interface CareerDashboardProps {
  career: CareerState;
  teams: TeamData[];
  onStartCareerMatch: (fixtureId: string, asManagerSim: boolean) => void;
  onSimulateRound: () => void;
  onSignPlayer: (player: PlayerData, fromTeamId: string) => void;
  onTrainSquadFitness: () => void;
  onResetCareer: (newClubId: string) => void;
  onOpenSquadModal: () => void;
}

export const CareerDashboard: React.FC<CareerDashboardProps> = ({
  career,
  teams,
  onStartCareerMatch,
  onSimulateRound,
  onSignPlayer,
  onTrainSquadFitness,
  onResetCareer,
  onOpenSquadModal,
}) => {
  const userClub = teams.find((t) => t.id === career.clubId) || teams[0];
  const sortedStandings = [...career.standings].sort((a, b) => {
    if (b.points !== a.points) return b.points - a.points;
    const gdB = b.goalsFor - b.goalsAgainst;
    const gdA = a.goalsFor - a.goalsAgainst;
    return gdB - gdA;
  });

  const nextFixture = career.fixtures.find(
    (f) => !f.played && (f.homeTeamId === career.clubId || f.awayTeamId === career.clubId)
  );
  const opponentTeam = nextFixture
    ? teams.find(
        (t) =>
          t.id ===
          (nextFixture.homeTeamId === career.clubId
            ? nextFixture.awayTeamId
            : nextFixture.homeTeamId)
      )
    : null;

  // Transfer market scouting pool from other clubs
  const transferTargets: Array<{ player: PlayerData; team: TeamData }> = [];
  teams.forEach((t) => {
    if (t.id !== career.clubId) {
      transferTargets.push({ player: t.starters[8], team: t });
      transferTargets.push({ player: t.starters[9], team: t });
    }
  });

  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
      {/* Left Column: Next Fixture, Club Budget & Season Actions (5 cols) */}
      <div className="flex flex-col gap-5 lg:col-span-5">
        <div className="border border-white/10 bg-[#0f172a] p-5">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold tracking-wider text-emerald-400 uppercase">
              Season {career.season} · Matchday {career.currentRound}
            </span>
            <span className="font-mono-tabular text-xs text-amber-300">
              Budget: ${(career.budget / 1000000).toFixed(1)}M
            </span>
          </div>

          <h2 className="mt-1 font-display text-3xl font-bold text-white uppercase">
            {userClub.name}
          </h2>
          <p className="text-xs text-slate-400">
            Board Objective: {career.seasonObjective} · Trophies: {career.trophiesWon}
          </p>

          {nextFixture && opponentTeam ? (
            <div className="mt-5 border border-white/10 bg-[#090d16] p-4">
              <div className="text-xs text-slate-400">Next League Fixture</div>
              <div className="mt-2 flex items-center justify-between">
                <span className="font-display text-xl font-bold text-white uppercase">
                  {userClub.shortName}
                </span>
                <span className="text-xs font-bold text-slate-500">VS</span>
                <span className="font-display text-xl font-bold text-rose-400 uppercase">
                  {opponentTeam.name}
                </span>
              </div>

              <div className="mt-4 flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => onStartCareerMatch(nextFixture.id, false)}
                  className="flex flex-1 items-center justify-center gap-1.5 bg-emerald-500 px-4 py-2.5 text-xs font-bold text-slate-950 uppercase hover:bg-emerald-400 whitespace-nowrap"
                >
                  <Play className="h-3.5 w-3.5" />
                  <span>Play 3D Match</span>
                </button>
                <button
                  type="button"
                  onClick={() => onStartCareerMatch(nextFixture.id, true)}
                  className="flex items-center justify-center gap-1.5 border border-sky-400/50 bg-sky-950/60 px-3.5 py-2.5 text-xs font-semibold text-sky-200 hover:bg-sky-900 whitespace-nowrap"
                >
                  <Sliders className="h-3.5 w-3.5" />
                  <span>3D Manager Sim</span>
                </button>
                <button
                  type="button"
                  onClick={onSimulateRound}
                  className="border border-white/15 bg-slate-800 px-3 py-2.5 text-xs font-semibold text-slate-200 hover:bg-slate-700 whitespace-nowrap"
                >
                  Quick Sim
                </button>
              </div>
            </div>
          ) : (
            <div className="mt-5 border border-emerald-500/40 bg-emerald-950/30 p-4">
              <p className="font-display text-xl font-bold text-emerald-300 uppercase">
                Season {career.season} Complete!
              </p>
              <button
                type="button"
                onClick={onSimulateRound}
                className="mt-3 bg-emerald-500 px-4 py-2 text-xs font-bold text-slate-950 uppercase hover:bg-emerald-400"
              >
                Advance to Next Season →
              </button>
            </div>
          )}

          <div className="mt-4 flex flex-wrap gap-2">
            <button
              type="button"
              onClick={onOpenSquadModal}
              className="flex items-center gap-1.5 border border-white/15 bg-slate-800 px-3.5 py-2 text-xs font-semibold text-white hover:bg-slate-700"
            >
              <Users className="h-3.5 w-3.5 text-emerald-400" />
              <span>Lineup & Tactics</span>
            </button>
            <button
              type="button"
              onClick={onTrainSquadFitness}
              className="flex items-center gap-1.5 border border-white/15 bg-slate-800 px-3.5 py-2 text-xs font-semibold text-amber-300 hover:bg-slate-700"
            >
              <Zap className="h-3.5 w-3.5" />
              <span>Recovery & Squad Training ($1.5M)</span>
            </button>
          </div>

          <div className="mt-4 border-t border-white/10 pt-3">
            <label className="mb-1 block text-[11px] text-slate-400">
              Start New Career With Another Club:
            </label>
            <select
              value={career.clubId}
              onChange={(e) => onResetCareer(e.target.value)}
              className="w-full border border-white/15 bg-[#090d16] px-2.5 py-1.5 text-xs text-white"
            >
              {teams.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name} ({t.city}) — Budget ${(t.budget / 1000000).toFixed(0)}M
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Transfer Market Panel */}
        <div className="border border-white/10 bg-[#0f172a] p-5">
          <h3 className="font-display text-lg font-bold tracking-wide text-white uppercase">
            Transfer Market Scouting
          </h3>
          <p className="mb-3 text-xs text-slate-400">
            Sign marquee talent using your club transfer budget.
          </p>
          <div className="max-h-56 space-y-2 overflow-y-auto pr-1">
            {transferTargets.slice(0, 6).map(({ player, team }) => {
              const canAfford = career.budget >= player.marketValue;
              return (
                <div
                  key={player.id}
                  className="flex items-center justify-between border border-white/10 bg-[#090d16] px-3 py-2 text-xs"
                >
                  <div>
                    <div className="font-semibold text-white">
                      <span className="font-mono-tabular mr-1.5 text-emerald-400">
                        {player.primaryPosition}
                      </span>
                      {player.name}
                    </div>
                    <div className="text-[11px] text-slate-400">
                      {team.shortName} · Age {player.age} · OVR {player.overall}
                    </div>
                  </div>
                  <button
                    type="button"
                    disabled={!canAfford}
                    onClick={() => onSignPlayer(player, team.id)}
                    className={`px-3 py-1.5 font-mono-tabular text-xs font-bold whitespace-nowrap ${
                      canAfford
                        ? 'bg-emerald-500 text-slate-950 hover:bg-emerald-400'
                        : 'bg-slate-800 text-slate-500 cursor-not-allowed'
                    }`}
                  >
                    Sign ${(player.marketValue / 1000000).toFixed(1)}M
                  </button>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Right Column: Championship League Standings Table (7 cols) */}
      <div className="border border-white/10 bg-[#0f172a] p-5 lg:col-span-7">
        <div className="mb-4 flex items-center justify-between">
          <div>
            <h3 className="font-display text-2xl font-bold text-white uppercase">
              Premier Division Standings
            </h3>
            <p className="text-xs text-slate-400">
              Top 4 qualify for Continental Cup · Bottom 2 face Relegation Playoff
            </p>
          </div>
          <Trophy className="h-6 w-6 text-amber-400" />
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-b border-white/15 text-slate-400">
                <th className="py-2 pr-2">#</th>
                <th className="py-2">Club</th>
                <th className="py-2 text-center">P</th>
                <th className="py-2 text-center">W</th>
                <th className="py-2 text-center">D</th>
                <th className="py-2 text-center">L</th>
                <th className="py-2 text-center">GF:GA</th>
                <th className="py-2 text-right">PTS</th>
              </tr>
            </thead>
            <tbody className="font-mono-tabular">
              {sortedStandings.map((row, idx) => {
                const isUser = row.teamId === career.clubId;
                return (
                  <tr
                    key={row.teamId}
                    className={`border-b border-white/5 ${
                      isUser ? 'bg-emerald-500/15 font-bold text-white' : 'text-slate-300'
                    }`}
                  >
                    <td className="py-2.5 pr-2 text-slate-400">{idx + 1}</td>
                    <td className="py-2.5 font-sans font-semibold">
                      {row.teamName}
                      {isUser && <span className="ml-2 text-[10px] text-emerald-400">(YOU)</span>}
                    </td>
                    <td className="py-2.5 text-center">{row.played}</td>
                    <td className="py-2.5 text-center">{row.won}</td>
                    <td className="py-2.5 text-center">{row.drawn}</td>
                    <td className="py-2.5 text-center">{row.lost}</td>
                    <td className="py-2.5 text-center">
                      {row.goalsFor}:{row.goalsAgainst}
                    </td>
                    <td className="py-2.5 text-right font-bold text-emerald-400">{row.points}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

interface TournamentBracketViewProps {
  tournament: TournamentState;
  teams: TeamData[];
  onPlayTournamentMatch: (matchId: string) => void;
  onResetTournament: (userTeamId: string) => void;
}

export const TournamentBracketView: React.FC<TournamentBracketViewProps> = ({
  tournament,
  teams,
  onPlayTournamentMatch,
  onResetTournament,
}) => {
  const getTeamName = (id: string) => teams.find((t) => t.id === id)?.name || id;
  const userMatch = tournament.matches.find(
    (m) =>
      !m.winnerTeamId &&
      (m.homeTeamId === tournament.userTeamId || m.awayTeamId === tournament.userTeamId)
  );

  return (
    <div className="border border-white/10 bg-[#0f172a] p-6">
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-white/10 pb-4">
        <div>
          <span className="text-xs font-bold tracking-wider text-amber-400 uppercase">
            Knockout Competition · Current Stage: {tournament.currentRound}
          </span>
          <h2 className="font-display text-3xl font-bold text-white uppercase">
            {tournament.name}
          </h2>
        </div>

        <div className="flex items-center gap-3">
          {userMatch && (
            <button
              type="button"
              onClick={() => onPlayTournamentMatch(userMatch.id)}
              className="flex items-center gap-2 bg-emerald-500 px-5 py-2.5 text-xs font-bold text-slate-950 uppercase hover:bg-emerald-400"
            >
              <Play className="h-4 w-4" />
              <span>Play Next Knockout Tie</span>
            </button>
          )}
          <button
            type="button"
            onClick={() => onResetTournament(tournament.userTeamId)}
            className="border border-white/15 bg-slate-800 px-4 py-2.5 text-xs font-semibold text-slate-200 hover:bg-slate-700"
          >
            New Tournament Draw
          </button>
        </div>
      </div>

      {tournament.championTeamId && (
        <div className="mt-5 flex items-center justify-between border border-amber-400/50 bg-amber-950/30 p-4">
          <div className="flex items-center gap-3">
            <Trophy className="h-8 w-8 text-amber-400" />
            <div>
              <div className="text-xs font-bold text-amber-300 uppercase">
                Tournament Champions Crowned
              </div>
              <div className="font-display text-2xl font-bold text-white uppercase">
                {getTeamName(tournament.championTeamId)}
              </div>
            </div>
          </div>
        </div>
      )}

      <div className="mt-6 grid grid-cols-1 gap-6 md:grid-cols-3">
        {(['Quarter-Finals', 'Semi-Finals', 'Final'] as const).map((roundName) => {
          const roundMatches = tournament.matches.filter((m) => m.round === roundName);
          return (
            <div key={roundName} className="border border-white/10 bg-[#090d16] p-4">
              <h3 className="mb-3 font-display text-lg font-bold tracking-wider text-slate-300 uppercase">
                {roundName}
              </h3>
              {roundMatches.length === 0 ? (
                <p className="text-xs text-slate-500">Awaiting previous round results...</p>
              ) : (
                <div className="space-y-3">
                  {roundMatches.map((m) => {
                    const isUserTie =
                      m.homeTeamId === tournament.userTeamId ||
                      m.awayTeamId === tournament.userTeamId;
                    return (
                      <div
                        key={m.id}
                        className={`border p-3 text-xs ${
                          isUserTie
                            ? 'border-emerald-500/50 bg-emerald-950/20'
                            : 'border-white/10 bg-slate-900/70'
                        }`}
                      >
                        <div className="flex justify-between py-0.5">
                          <span
                            className={
                              m.winnerTeamId === m.homeTeamId ? 'font-bold text-emerald-400' : 'text-white'
                            }
                          >
                            {getTeamName(m.homeTeamId)}
                          </span>
                          <span className="font-mono-tabular font-bold">
                            {m.homeGoals !== undefined ? m.homeGoals : '-'}
                          </span>
                        </div>
                        <div className="flex justify-between py-0.5">
                          <span
                            className={
                              m.winnerTeamId === m.awayTeamId ? 'font-bold text-emerald-400' : 'text-white'
                            }
                          >
                            {getTeamName(m.awayTeamId)}
                          </span>
                          <span className="font-mono-tabular font-bold">
                            {m.awayGoals !== undefined ? m.awayGoals : '-'}
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};

interface ProgressionAndStoreViewProps {
  profile: UserProfile;
  dailyObjectives: DailyObjective[];
  cosmetics: CosmeticItem[];
  userTeam: TeamData;
  settings: UserSettings;
  onClaimDaily: (id: string) => void;
  onUpgradePlayerAttribute: (
    playerId: string,
    attr: keyof PlayerData['attributes'],
    costCoins: number
  ) => void;
  onUnlockOrEquipCosmetic: (item: CosmeticItem) => void;
  onUpdateSettings: (newSettings: UserSettings) => void;
  onUpdateProfileBadge: (
    style: UserProfile['clubBadgeStyle'],
    primary: string,
    secondary: string
  ) => void;
}

export const ProgressionAndStoreView: React.FC<ProgressionAndStoreViewProps> = ({
  profile,
  dailyObjectives,
  cosmetics,
  userTeam,
  settings,
  onClaimDaily,
  onUpgradePlayerAttribute,
  onUnlockOrEquipCosmetic,
  onUpdateSettings,
  onUpdateProfileBadge,
}) => {
  const [selectedPlayerId, setSelectedPlayerId] = useState(userTeam.starters[9].id);
  const [multiplayerNotice, setMultiplayerNotice] = useState<string | null>(null);

  const selectedPlayer =
    userTeam.starters.find((p) => p.id === selectedPlayerId) || userTeam.starters[0];

  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
      {/* Left 6 Cols: Daily Objectives & Player Training Upgrades */}
      <div className="space-y-6 lg:col-span-6">
        {/* Daily Objectives */}
        <div className="border border-white/10 bg-[#0f172a] p-5">
          <div className="mb-3 flex items-center justify-between">
            <div>
              <h3 className="font-display text-2xl font-bold text-white uppercase">
                Daily Challenges & Streak
              </h3>
              <p className="text-xs text-slate-400">
                Active Streak: {profile.dailyStreak} Day(s) · Resets Daily at 00:00 UTC
              </p>
            </div>
            <Flame className="h-6 w-6 text-amber-400" />
          </div>

          <div className="space-y-2.5">
            {dailyObjectives.map((obj) => {
              const pct = Math.min(100, Math.round((obj.progress / obj.target) * 100));
              const canClaim = obj.progress >= obj.target && !obj.claimed;
              return (
                <div
                  key={obj.id}
                  className="border border-white/10 bg-[#090d16] p-3 text-xs"
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="font-semibold text-white">{obj.title}</div>
                      <div className="text-slate-400">{obj.description}</div>
                    </div>
                    {obj.claimed ? (
                      <span className="font-semibold text-emerald-400">Claimed ✓</span>
                    ) : canClaim ? (
                      <button
                        type="button"
                        onClick={() => onClaimDaily(obj.id)}
                        className="bg-amber-400 px-3 py-1.5 font-bold text-slate-950 uppercase hover:bg-amber-300"
                      >
                        Claim +{obj.rewardCoins} Coins
                      </button>
                    ) : (
                      <span className="font-mono-tabular text-slate-400">
                        {obj.progress} / {obj.target}
                      </span>
                    )}
                  </div>
                  <div className="mt-2 h-1.5 w-full bg-slate-800">
                    <div
                      style={{ width: `${pct}%` }}
                      className="h-full bg-emerald-500 transition-all"
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Player Development & Attribute Training */}
        <div className="border border-white/10 bg-[#0f172a] p-5">
          <div className="mb-3 flex items-center justify-between">
            <div>
              <h3 className="font-display text-2xl font-bold text-white uppercase">
                Player Academy & Attribute Development
              </h3>
              <p className="text-xs text-slate-400">
                Train footballers using earned match coins (150 Coins per +2 Attribute Boost)
              </p>
            </div>
            <TrendingUp className="h-6 w-6 text-emerald-400" />
          </div>

          <select
            value={selectedPlayer.id}
            onChange={(e) => setSelectedPlayerId(e.target.value)}
            className="mb-4 w-full border border-white/15 bg-[#090d16] px-3 py-2 text-xs text-white"
          >
            {userTeam.starters.map((p) => (
              <option key={p.id} value={p.id}>
                #{p.shirtNumber} {p.name} ({p.primaryPosition}) — OVR {p.overall}
              </option>
            ))}
          </select>

          <div className="grid grid-cols-2 gap-2.5 text-xs sm:grid-cols-3">
            {(
              [
                ['pace', 'Pace'],
                ['shooting', 'Shooting'],
                ['passing', 'Passing'],
                ['dribbling', 'Dribbling'],
                ['tackling', 'Tackling'],
                ['stamina', 'Stamina'],
              ] as const
            ).map(([attrKey, label]) => {
              const val = selectedPlayer.attributes[attrKey];
              const canUpgrade = profile.coins >= 150 && val < 99;
              return (
                <div
                  key={attrKey}
                  className="flex flex-col justify-between border border-white/10 bg-[#090d16] p-2.5"
                >
                  <div className="flex justify-between">
                    <span className="text-slate-400">{label}</span>
                    <span className="font-mono-tabular font-bold text-white">{val}</span>
                  </div>
                  <button
                    type="button"
                    disabled={!canUpgrade}
                    onClick={() => onUpgradePlayerAttribute(selectedPlayer.id, attrKey, 150)}
                    className={`mt-2 py-1 text-[11px] font-bold uppercase ${
                      canUpgrade
                        ? 'bg-emerald-500 text-slate-950 hover:bg-emerald-400'
                        : 'bg-slate-800 text-slate-500 cursor-not-allowed'
                    }`}
                  >
                    +2 Boost (150c)
                  </button>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Right 6 Cols: Fair Cosmetic Store, Club Crest Customizer, Online Architecture & Settings */}
      <div className="space-y-6 lg:col-span-6">
        {/* Fair Non-Pay-To-Win Cosmetic Store */}
        <div className="border border-white/10 bg-[#0f172a] p-5">
          <div className="mb-3 flex items-center justify-between">
            <div>
              <h3 className="font-display text-2xl font-bold text-white uppercase">
                Club Cosmetic Store (Fair Play — Zero Pay-to-Win)
              </h3>
              <p className="text-xs text-slate-400">
                Unlock match balls, kits, and boots strictly with earned gameplay coins.
              </p>
            </div>
            <ShoppingBag className="h-6 w-6 text-sky-400" />
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            {cosmetics.map((item) => {
              const isEquipped =
                item.category === 'Ball' && profile.equippedBallColor === item.previewColor;
              return (
                <div
                  key={item.id}
                  className="flex flex-col justify-between border border-white/10 bg-[#090d16] p-3 text-xs"
                >
                  <div>
                    <div className="flex items-center gap-2">
                      <span
                        style={{ backgroundColor: item.previewColor }}
                        className="h-4 w-4 rounded-full border border-white/30"
                      />
                      <span className="font-semibold text-white">{item.name}</span>
                    </div>
                    <p className="mt-1 text-[11px] text-slate-400">{item.description}</p>
                  </div>

                  <button
                    type="button"
                    onClick={() => onUnlockOrEquipCosmetic(item)}
                    className={`mt-3 py-1.5 text-xs font-bold uppercase ${
                      isEquipped
                        ? 'border border-emerald-400 bg-emerald-950 text-emerald-300'
                        : item.unlocked
                        ? 'bg-slate-800 text-white hover:bg-slate-700'
                        : profile.coins >= item.priceCoins
                        ? 'bg-amber-400 text-slate-950 hover:bg-amber-300'
                        : 'bg-slate-800 text-slate-500 cursor-not-allowed'
                    }`}
                  >
                    {isEquipped
                      ? 'Equipped ✓'
                      : item.unlocked
                      ? 'Equip Item'
                      : `Unlock (${item.priceCoins} Coins)`}
                  </button>
                </div>
              );
            })}
          </div>
        </div>

        {/* Settings & Audio / Graphics Configuration */}
        <div className="border border-white/10 bg-[#0f172a] p-5">
          <div className="mb-3 flex items-center justify-between">
            <h3 className="font-display text-2xl font-bold text-white uppercase">
              Audio, Graphics & Control Settings
            </h3>
            <Settings className="h-5 w-5 text-slate-400" />
          </div>

          <div className="grid grid-cols-1 gap-4 text-xs sm:grid-cols-2">
            <div>
              <div className="flex justify-between text-slate-400">
                <span>Master Volume</span>
                <span className="font-mono-tabular text-white">
                  {Math.round(settings.masterVolume * 100)}%
                </span>
              </div>
              <input
                type="range"
                min={0}
                max={1}
                step={0.05}
                value={settings.masterVolume}
                onChange={(e) =>
                  onUpdateSettings({ ...settings, masterVolume: Number(e.target.value) })
                }
                className="mt-1 w-full accent-emerald-500"
              />
            </div>

            <div>
              <div className="flex justify-between text-slate-400">
                <span>Stadium Crowd Volume</span>
                <span className="font-mono-tabular text-white">
                  {Math.round(settings.crowdVolume * 100)}%
                </span>
              </div>
              <input
                type="range"
                min={0}
                max={1}
                step={0.05}
                value={settings.crowdVolume}
                onChange={(e) =>
                  onUpdateSettings({ ...settings, crowdVolume: Number(e.target.value) })
                }
                className="mt-1 w-full accent-emerald-500"
              />
            </div>

            <div>
              <label className="mb-1 block text-slate-400">3D Graphics Quality</label>
              <select
                value={settings.graphicsQuality}
                onChange={(e) =>
                  onUpdateSettings({
                    ...settings,
                    graphicsQuality: e.target.value as UserSettings['graphicsQuality'],
                  })
                }
                className="w-full border border-white/15 bg-[#090d16] px-2.5 py-1.5 text-white"
              >
                <option value="Low">Low (Battery Saver / 60FPS Mobile)</option>
                <option value="Medium">Medium (Balanced Shadows)</option>
                <option value="High">High (2048px Shadows & Full Crowd)</option>
              </select>
            </div>

            <div>
              <label className="mb-1 block text-slate-400">Default Match Camera</label>
              <select
                value={settings.defaultCamera}
                onChange={(e) =>
                  onUpdateSettings({
                    ...settings,
                    defaultCamera: e.target.value as UserSettings['defaultCamera'],
                  })
                }
                className="w-full border border-white/15 bg-[#090d16] px-2.5 py-1.5 text-white"
              >
                <option value="Broadcast">Broadcast TV Angle</option>
                <option value="Tactical">Tactical Wide Overhead</option>
                <option value="Follow">Third-Person Player Follow</option>
                <option value="Action">Close Action Camera</option>
              </select>
            </div>
          </div>

          {/* Online Multiplayer Architecture Readiness Card */}
          <div className="mt-4 border border-white/10 bg-[#090d16] p-3.5 text-xs">
            <div className="flex items-center justify-between">
              <span className="font-bold text-sky-400 uppercase">
                Online 1v1 Multiplayer & Cloud Save Status
              </span>
              <Globe className="h-4 w-4 text-sky-400" />
            </div>
            <p className="mt-1 text-slate-400">{multiplayerServiceStub.statusMessage}</p>
            <div className="mt-2 flex gap-2">
              <button
                type="button"
                onClick={async () => {
                  const res = await multiplayerServiceStub.joinMatchmakingQueue('Division 1');
                  setMultiplayerNotice(res.reason);
                }}
                className="border border-white/15 bg-slate-800 px-3 py-1.5 text-xs font-semibold text-white hover:bg-slate-700"
              >
                Test Ranked 1v1 Queue Contract
              </button>
            </div>
            {multiplayerNotice && (
              <p className="mt-2 text-[11px] text-amber-300">{multiplayerNotice}</p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
