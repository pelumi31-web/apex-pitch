import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  Award,
  Check,
  Compass,
  Flame,
  Play,
  Shield,
  Sliders,
  Target,
  Trophy,
  Users,
  Zap,
} from 'lucide-react';
import { MatchHUD } from './components/MatchHUD';
import {
  CareerDashboard,
  MatchResultsModal,
  ProgressionAndStoreView,
  TournamentBracketView,
} from './components/ModesScreens';
import { SquadTacticsModal } from './components/SquadTacticsModal';
import { VirtualControls } from './components/VirtualControls';
import {
  CHALLENGE_SCENARIOS,
  TRAINING_DRILLS,
  calculateOverallRating,
} from './data/database';
import { ControlInputState, MatchEngine, MatchHUDState } from './engine/MatchEngine';
import { soundEngine } from './services/audio';
import {
  createInitialCareerState,
  createInitialTournamentState,
  loadCareerState,
  loadCosmetics,
  loadDailyObjectives,
  loadTeams,
  loadTournamentState,
  loadUserProfile,
  loadUserSettings,
  saveCareerState,
  saveCosmetics,
  saveDailyObjectives,
  saveTeams,
  saveTournamentState,
  saveUserProfile,
  saveUserSettings,
} from './services/storage';
import {
  CameraPreset,
  CareerState,
  CosmeticItem,
  DailyObjective,
  DifficultyLevel,
  GameMode,
  MatchSettings,
  MatchStats,
  PlayerData,
  TeamData,
  TournamentState,
  UserProfile,
  UserSettings,
} from './types/game';

type HubTab = 'play' | 'career' | 'tournament' | 'training_challenges' | 'club_store';

export default function App() {
  // Persistent State
  const [teams, setTeams] = useState<TeamData[]>(() => loadTeams());
  const [profile, setProfile] = useState<UserProfile>(() => loadUserProfile());
  const [userSettings, setUserSettings] = useState<UserSettings>(() => loadUserSettings());
  const [dailyObjectives, setDailyObjectives] = useState<DailyObjective[]>(() =>
    loadDailyObjectives()
  );
  const [cosmetics, setCosmetics] = useState<CosmeticItem[]>(() => loadCosmetics());
  const [career, setCareer] = useState<CareerState>(() => loadCareerState(loadTeams()));
  const [tournament, setTournament] = useState<TournamentState>(() =>
    loadTournamentState(loadTeams())
  );

  // Navigation & Match Setup State
  const [activeHubTab, setActiveHubTab] = useState<HubTab>('play');
  const [inMatch, setInMatch] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [showSquadModal, setShowSquadModal] = useState(false);

  const [homeTeamId, setHomeTeamId] = useState<string>(teams[0].id);
  const [awayTeamId, setAwayTeamId] = useState<string>(teams[1].id);
  const [matchSettings, setMatchSettings] = useState<MatchSettings>({
    mode: 'quick_match',
    difficulty: 'Professional',
    halfDurationMinutes: 2,
    stadium: 'Apex Arena',
    weather: 'Clear Night',
    homeUseAwayKit: false,
    awayUseAwayKit: false,
  });

  // Active Career or Tournament tie tracking
  const [activeCareerFixtureId, setActiveCareerFixtureId] = useState<string | null>(null);
  const [activeTournamentMatchId, setActiveTournamentMatchId] = useState<string | null>(null);

  // 3D Match Engine & Live HUD State
  const canvasMountRef = useRef<HTMLDivElement | null>(null);
  const engineRef = useRef<MatchEngine | null>(null);
  const [cameraPreset, setCameraPreset] = useState<CameraPreset>(userSettings.defaultCamera);
  const [completedMatchResult, setCompletedMatchResult] = useState<{
    stats: MatchStats;
    challengePassed?: boolean;
    trainingScore?: number;
    earnedCoins: number;
    earnedXp: number;
  } | null>(null);

  const [hudState, setHudState] = useState<MatchHUDState>({
    phase: 'FIRST_HALF',
    setPieceType: 'KICKOFF',
    matchMinute: 0,
    stoppageMinutes: 2,
    homeScore: 0,
    awayScore: 0,
    homePossessionPct: 50,
    controlledPlayerName: teams[0].starters[9].name,
    controlledPlayerNumber: 9,
    controlledPlayerStamina: 100,
    userHasPossession: true,
    ballOwnerTeam: 'home',
    lastCommentary: 'Kickoff ready at Apex Arena!',
    bannerAlert: null,
    shotPowerCharge: 0,
    trainingScore: 0,
    trainingTargetScore: 300,
    trainingTimeRemaining: 60,
    challengeStatusText: '',
    challengeCompleted: null,
    radarDots: [],
    ballRadar: { x: 0, z: 0 },
    stats: {
      homeGoals: 0,
      awayGoals: 0,
      homePossessionFrames: 1,
      awayPossessionFrames: 1,
      homeShots: 0,
      awayShots: 0,
      homeShotsOnTarget: 0,
      awayShotsOnTarget: 0,
      homePassesAttempted: 0,
      homePassesCompleted: 0,
      awayPassesAttempted: 0,
      awayPassesCompleted: 0,
      homeTackles: 0,
      awayTackles: 0,
      homeFouls: 0,
      awayFouls: 0,
      homeYellowCards: 0,
      awayYellowCards: 0,
      homeRedCards: 0,
      awayRedCards: 0,
      homeCorners: 0,
      awayCorners: 0,
      homeOffsides: 0,
      awayOffsides: 0,
      distanceCoveredMeters: 0,
      outsideBoxGoals: 0,
      goalScorers: [],
    },
  });

  // Universal Landscape Viewport State (rotates into landscape automatically on portrait devices)
  const [viewport, setViewport] = useState(() => ({
    w: typeof window !== 'undefined' ? window.innerWidth : 1280,
    h: typeof window !== 'undefined' ? window.innerHeight : 720,
  }));

  useEffect(() => {
    const updateViewport = () => {
      setViewport({
        w: window.innerWidth,
        h: window.innerHeight,
      });
    };
    window.addEventListener('resize', updateViewport);
    window.addEventListener('orientationchange', updateViewport);

    // Attempt native Screen Orientation API lock to landscape where supported
    const screenAny = window.screen as unknown as {
      orientation?: { lock?: (mode: string) => Promise<void> };
    };
    if (screenAny?.orientation?.lock) {
      screenAny.orientation.lock('landscape').catch(() => {
        // Browser requires fullscreen or forces CSS landscape rotation fallback below
      });
    }

    return () => {
      window.removeEventListener('resize', updateViewport);
      window.removeEventListener('orientationchange', updateViewport);
    };
  }, []);

  const isPortraitViewport = viewport.w < viewport.h;
  const landscapeWidth = Math.max(viewport.w, viewport.h);
  const landscapeHeight = Math.min(viewport.w, viewport.h);

  const stageStyle: React.CSSProperties = isPortraitViewport
    ? {
        position: 'fixed',
        top: '50%',
        left: '50%',
        width: `${landscapeWidth}px`,
        height: `${landscapeHeight}px`,
        transform: 'translate(-50%, -50%) rotate(90deg)',
        transformOrigin: 'center center',
      }
    : {
        position: 'fixed',
         inset: 0,
        width: '100vw',
        height: '100vh',
      };

  const homeTeam = teams.find((t) => t.id === homeTeamId) || teams[0];
  const awayTeam =
    teams.find((t) => t.id === awayTeamId && t.id !== homeTeam.id) ||
    teams.find((t) => t.id !== homeTeam.id) ||
    teams[1];

  useEffect(() => {
    soundEngine.updateSettings(userSettings);
  }, [userSettings]);

  // Handle Match Completion & Progression Updates
  const handleMatchComplete = useCallback(
    (stats: MatchStats, challengePassed?: boolean, trainingScore?: number) => {
      const won = stats.homeGoals > stats.awayGoals;
      const drawn = stats.homeGoals === stats.awayGoals;

      let earnedCoins = won ? 180 : drawn ? 90 : 50;
      let earnedXp = won ? 220 : drawn ? 110 : 60;
      earnedCoins += stats.homeGoals * 25;
      earnedXp += stats.homeGoals * 30;

      if (matchSettings.mode === 'challenge' && challengePassed && matchSettings.challengeId) {
        const chal = CHALLENGE_SCENARIOS.find((c) => c.id === matchSettings.challengeId);
        if (chal) {
          earnedCoins += chal.rewardCoins;
          earnedXp += chal.rewardXp;
        }
      } else if (matchSettings.mode === 'training') {
        earnedCoins = Math.round((trainingScore || 0) * 0.35);
        earnedXp = Math.round((trainingScore || 0) * 0.45);
      }

      // 1. Update User Profile
      setProfile((prev) => {
        const nextCompletedChallenges =
          matchSettings.mode === 'challenge' &&
          challengePassed &&
          matchSettings.challengeId &&
          !prev.completedChallengeIds.includes(matchSettings.challengeId)
            ? [...prev.completedChallengeIds, matchSettings.challengeId]
            : prev.completedChallengeIds;

        const nextTrainingScores = { ...prev.trainingHighScores };
        if (matchSettings.mode === 'training' && matchSettings.trainingDrillId) {
          const prevBest = nextTrainingScores[matchSettings.trainingDrillId] || 0;
          if ((trainingScore || 0) > prevBest) {
            nextTrainingScores[matchSettings.trainingDrillId] = trainingScore || 0;
          }
        }

        const totalXp = prev.xp + earnedXp;
        const updated: UserProfile = {
          ...prev,
          coins: prev.coins + earnedCoins,
          xp: totalXp,
          level: Math.max(1, Math.floor(totalXp / 500) + 1),
          matchesPlayed: prev.matchesPlayed + 1,
          matchesWon: prev.matchesWon + (won ? 1 : 0),
          totalGoalsScored: prev.totalGoalsScored + stats.homeGoals,
          completedChallengeIds: nextCompletedChallenges,
          trainingHighScores: nextTrainingScores,
        };
        saveUserProfile(updated);
        return updated;
      });

      // 2. Update Daily Objectives
      setDailyObjectives((prev) => {
        const updated = prev.map((obj) => {
          let add = 0;
          if (obj.metric === 'goals') add = stats.homeGoals;
          else if (obj.metric === 'wins' && won && matchSettings.mode !== 'training') add = 1;
          else if (obj.metric === 'tackles') add = stats.homeTackles;
          else if (obj.metric === 'passes') add = stats.homePassesCompleted;
          else if (obj.metric === 'outsideBoxGoals') add = stats.outsideBoxGoals;
          else if (obj.metric === 'distance') add = Math.round(stats.distanceCoveredMeters);
          return { ...obj, progress: obj.progress + add };
        });
        saveDailyObjectives(updated);
        return updated;
      });

      // 3. Update Career Mode Standings if this was a Career Fixture
      if (
        (matchSettings.mode === 'career' || matchSettings.mode === 'manager') &&
        activeCareerFixtureId
      ) {
        setCareer((prev) => {
          const next = JSON.parse(JSON.stringify(prev)) as CareerState;
          const userFixture = next.fixtures.find((f) => f.id === activeCareerFixtureId);
          if (userFixture && !userFixture.played) {
            const roundToSim = userFixture.round;
            next.fixtures
              .filter((f) => f.round === roundToSim && !f.played)
              .forEach((fix) => {
                if (fix.id === activeCareerFixtureId) {
                  fix.homeGoals =
                    fix.homeTeamId === next.clubId ? stats.homeGoals : stats.awayGoals;
                  fix.awayGoals =
                    fix.awayTeamId === next.clubId ? stats.homeGoals : stats.awayGoals;
                } else {
                  fix.homeGoals = Math.floor(Math.random() * 4);
                  fix.awayGoals = Math.floor(Math.random() * 3);
                }
                fix.played = true;

                const hRow = next.standings.find((s) => s.teamId === fix.homeTeamId);
                const aRow = next.standings.find((s) => s.teamId === fix.awayTeamId);
                if (hRow && aRow) {
                  hRow.played++;
                  aRow.played++;
                  hRow.goalsFor += fix.homeGoals!;
                  hRow.goalsAgainst += fix.awayGoals!;
                  aRow.goalsFor += fix.awayGoals!;
                  aRow.goalsAgainst += fix.homeGoals!;
                  if (fix.homeGoals! > fix.awayGoals!) {
                    hRow.won++;
                    hRow.points += 3;
                    aRow.lost++;
                  } else if (fix.homeGoals! < fix.awayGoals!) {
                    aRow.won++;
                    aRow.points += 3;
                    hRow.lost++;
                  } else {
                    hRow.drawn++;
                    aRow.drawn++;
                    hRow.points += 1;
                    aRow.points += 1;
                  }
                }
              });
            next.currentRound = roundToSim + 1;
            next.budget += won ? 2500000 : 1000000;
          }
          saveCareerState(next);
          return next;
        });
      }

      // 4. Update Tournament Bracket if this was a Tournament Tie
      if (matchSettings.mode === 'tournament' && activeTournamentMatchId) {
        setTournament((prev) => {
          const next = JSON.parse(JSON.stringify(prev)) as TournamentState;
          const currentRoundMatches = next.matches.filter((m) => m.round === next.currentRound);
          currentRoundMatches.forEach((m) => {
            if (m.id === activeTournamentMatchId) {
              const userIsHome = m.homeTeamId === next.userTeamId;
              let hg = userIsHome ? stats.homeGoals : stats.awayGoals;
              let ag = userIsHome ? stats.awayGoals : stats.homeGoals;
              if (hg === ag) {
                hg += 1;
              }
              m.homeGoals = hg;
              m.awayGoals = ag;
              m.winnerTeamId = hg > ag ? m.homeTeamId : m.awayTeamId;
            } else if (!m.winnerTeamId) {
              const hg = Math.floor(Math.random() * 3);
              let ag = Math.floor(Math.random() * 3);
              if (hg === ag) ag += 1;
              m.homeGoals = hg;
              m.awayGoals = ag;
              m.winnerTeamId = hg > ag ? m.homeTeamId : m.awayTeamId;
            }
          });

          const winners = currentRoundMatches
            .map((m) => m.winnerTeamId)
            .filter(Boolean) as string[];

          if (next.currentRound === 'Quarter-Finals' && winners.length === 4) {
            next.currentRound = 'Semi-Finals';
            next.matches.push(
              { id: 'sf_1', round: 'Semi-Finals', homeTeamId: winners[0], awayTeamId: winners[1] },
              { id: 'sf_2', round: 'Semi-Finals', homeTeamId: winners[2], awayTeamId: winners[3] }
            );
          } else if (next.currentRound === 'Semi-Finals' && winners.length === 2) {
            next.currentRound = 'Final';
            next.matches.push({
              id: 'final_1',
              round: 'Final',
              homeTeamId: winners[0],
              awayTeamId: winners[1],
            });
          } else if (next.currentRound === 'Final' && winners.length === 1) {
            next.currentRound = 'Completed';
            next.championTeamId = winners[0];
          }
          saveTournamentState(next);
          return next;
        });
      }

      setCompletedMatchResult({
        stats,
        challengePassed,
        trainingScore,
        earnedCoins,
        earnedXp,
      });
    },
    [matchSettings, activeCareerFixtureId, activeTournamentMatchId]
  );

  // Mount & Unmount Three.js MatchEngine when `inMatch` is active
  useEffect(() => {
    if (!inMatch || !canvasMountRef.current) return;

    const engine = new MatchEngine(
      canvasMountRef.current,
      homeTeam,
      awayTeam,
      matchSettings,
      userSettings,
      profile.equippedBallColor,
      (newHudState) => setHudState(newHudState),
      handleMatchComplete
    );
    engineRef.current = engine;
    setCameraPreset(userSettings.defaultCamera);

    return () => {
      engine.dispose();
      engineRef.current = null;
    };
  }, [inMatch]);

  const startMatchWithConfig = (
    customSettings: Partial<MatchSettings>,
    customHomeId?: string,
    customAwayId?: string
  ) => {
    // Also try locking screen orientation on user gesture
    const screenAny = window.screen as unknown as {
      orientation?: { lock?: (mode: string) => Promise<void> };
    };
    if (screenAny?.orientation?.lock) {
      screenAny.orientation.lock('landscape').catch(() => {});
    }
    if (customHomeId) setHomeTeamId(customHomeId);
    if (customAwayId) setAwayTeamId(customAwayId);
    setMatchSettings((prev) => ({ ...prev, ...customSettings }));
    setCompletedMatchResult(null);
    setIsPaused(false);
    setInMatch(true);
  };

  const handleSaveSquadAndTactics = (updatedTeam: TeamData) => {
    setTeams((prev) => {
      const next = prev.map((t) => (t.id === updatedTeam.id ? updatedTeam : t));
      saveTeams(next);
      return next;
    });
    if (engineRef.current && updatedTeam.id === homeTeam.id) {
      engineRef.current.updateTacticsLive(updatedTeam);
    }
  };

  // Career Mode Simulate Round Handler
  const handleSimulateCareerRound = () => {
    setCareer((prev) => {
      const next = JSON.parse(JSON.stringify(prev)) as CareerState;
      const unplayed = next.fixtures.filter((f) => !f.played);
      if (unplayed.length === 0) {
        // Start next season
        const nextSeasonState = createInitialCareerState(next.clubId, teams);
        nextSeasonState.season = next.season + 1;
        nextSeasonState.budget = next.budget + 15000000;
        nextSeasonState.trophiesWon = next.trophiesWon + 1;
        saveCareerState(nextSeasonState);
        return nextSeasonState;
      }

      const roundToSim = unplayed[0].round;
      next.fixtures
        .filter((f) => f.round === roundToSim && !f.played)
        .forEach((fix) => {
          fix.homeGoals = Math.floor(Math.random() * 4);
          fix.awayGoals = Math.floor(Math.random() * 3);
          fix.played = true;

          const hRow = next.standings.find((s) => s.teamId === fix.homeTeamId);
          const aRow = next.standings.find((s) => s.teamId === fix.awayTeamId);
          if (hRow && aRow) {
            hRow.played++;
            aRow.played++;
            hRow.goalsFor += fix.homeGoals!;
            hRow.goalsAgainst += fix.awayGoals!;
            aRow.goalsFor += fix.awayGoals!;
            aRow.goalsAgainst += fix.homeGoals!;
            if (fix.homeGoals! > fix.awayGoals!) {
              hRow.won++;
              hRow.points += 3;
              aRow.lost++;
            } else if (fix.homeGoals! < fix.awayGoals!) {
              aRow.won++;
              aRow.points += 3;
              hRow.lost++;
            } else {
              hRow.drawn++;
              aRow.drawn++;
              hRow.points += 1;
              aRow.points += 1;
            }
          }
        });
      next.currentRound = roundToSim + 1;
      saveCareerState(next);
      return next;
    });
    soundEngine.playUiClick();
  };

  // Render Live 3D Match Viewport (Always in Landscape on all devices)
  if (inMatch) {
    return (
      <div style={stageStyle} className="overflow-hidden bg-[#070b12]">
        <div className="relative h-full w-full overflow-hidden bg-[#070b12]">
          {/* Isolated Three.js WebGL Mount Container */}
          <div ref={canvasMountRef} className="h-full w-full" />

          {/* Semantic Broadcast HUD Overlay */}
          <MatchHUD
            hudState={hudState}
            homeTeam={homeTeam}
            awayTeam={awayTeam}
            matchSettings={matchSettings}
            userSettings={userSettings}
            cameraPreset={cameraPreset}
            isPaused={isPaused}
            onTogglePause={() => {
              const next = !isPaused;
              setIsPaused(next);
              engineRef.current?.setPaused(next);
            }}
            onChangeCamera={(preset) => {
              setCameraPreset(preset);
              engineRef.current?.setCameraPreset(preset);
            }}
            onSkipCelebration={() => engineRef.current?.skipCelebration()}
            onOpenTacticsModal={() => {
              setIsPaused(true);
              engineRef.current?.setPaused(true);
              setShowSquadModal(true);
            }}
            onRestartMatch={() => {
              setCompletedMatchResult(null);
              setIsPaused(false);
              engineRef.current?.restartMatch();
            }}
            onQuitToMenu={() => {
              setIsPaused(false);
              setInMatch(false);
            }}
            onSubstitute={(starterId, subData) => {
              engineRef.current?.performSubstitution(starterId, subData);
            }}
            onQuickMentalityChange={(mentality) => {
              const updated: TeamData = {
                ...homeTeam,
                tactics: { ...homeTeam.tactics, mentality },
              };
              handleSaveSquadAndTactics(updated);
            }}
          />

          {/* Responsive Mobile Virtual Joystick & Action Buttons + Keyboard Controller */}
          <VirtualControls
            userHasPossession={hudState.userHasPossession}
            shotPowerCharge={hudState.shotPowerCharge}
            deadzone={userSettings.joystickDeadzone}
            buttonScale={userSettings.buttonScale}
            isManagerMode={matchSettings.mode === 'manager'}
            isRotatedPortrait={isPortraitViewport}
            onInputChange={(partial: Partial<ControlInputState>) =>
              engineRef.current?.setControlInput(partial)
            }
            onPass={() => engineRef.current?.triggerPass(false)}
            onThroughBall={() => engineRef.current?.triggerPass(true)}
            onShootStart={() => engineRef.current?.setControlInput({ ChargingShot: true })}
            onShootRelease={() => engineRef.current?.setControlInput({ ChargingShot: false })}
            onSkillMove={() => engineRef.current?.triggerSkillMove()}
            onTackle={(isSlide) => engineRef.current?.triggerTackle(isSlide)}
            onSwitchPlayer={() => engineRef.current?.switchControlledPlayer()}
          />

          {/* In-Match Squad & Formation Modal */}
          {showSquadModal && (
            <SquadTacticsModal
              team={homeTeam}
              onSaveTeam={handleSaveSquadAndTactics}
              onClose={() => setShowSquadModal(false)}
            />
          )}

          {/* Full-Time Results & Match Telemetry Modal */}
          {completedMatchResult && (
            <MatchResultsModal
              stats={completedMatchResult.stats}
              homeTeam={homeTeam}
              awayTeam={awayTeam}
              matchSettings={matchSettings}
              challengePassed={completedMatchResult.challengePassed}
              trainingScore={completedMatchResult.trainingScore}
              earnedCoins={completedMatchResult.earnedCoins}
              earnedXp={completedMatchResult.earnedXp}
              onRematch={() => {
                setCompletedMatchResult(null);
                engineRef.current?.restartMatch();
              }}
              onExitToMenu={() => {
                setCompletedMatchResult(null);
                setInMatch(false);
              }}
            />
          )}
        </div>
      </div>
    );
  }

  // Render Main Menu Hub (Always in Landscape on all devices)
  return (
    <div style={stageStyle} className="overflow-hidden bg-[#070b12]">
      <div className="relative flex h-full w-full flex-col bg-[#070b12] text-slate-100">
      {/* STRICT 3-ZONE TOP BAR CONTRACT */}
      <header className="flex shrink-0 items-center justify-between gap-8 border-b border-white/10 bg-[#090d16] px-6 py-3.5">
        {/* Zone 1: Single text element wordmark */}
        <a
          href="#top"
          onClick={(e) => {
            e.preventDefault();
            setActiveHubTab('play');
          }}
          className="font-display text-2xl font-bold tracking-wider text-white uppercase whitespace-nowrap shrink-0"
        >
          APEX PITCH 26
        </a>

        {/* Zone 2: 5 concise single-line text navigation links */}
        <nav className="flex items-center gap-6 overflow-x-auto text-sm font-medium text-slate-400">
          {(
            [
              ['play', 'Match Lobby'],
              ['career', 'Career Mode'],
              ['tournament', 'Tournament'],
              ['training_challenges', 'Challenges'],
              ['club_store', 'Club & Store'],
            ] as const
          ).map(([tabKey, label]) => (
            <button
              key={tabKey}
              type="button"
              onClick={() => {
                soundEngine.playUiClick();
                setActiveHubTab(tabKey);
              }}
              className={`border-b-2 py-1 transition-colors whitespace-nowrap shrink-0 ${
                activeHubTab === tabKey
                  ? 'border-emerald-400 text-white font-semibold'
                  : 'border-transparent hover:text-slate-200'
              }`}
            >
              {label}
            </button>
          ))}
        </nav>

        {/* Zone 3: 1 primary action */}
        <div className="flex items-center gap-3 shrink-0">
          <button
            type="button"
            onClick={() => {
              soundEngine.playUiClick();
              setActiveCareerFixtureId(null);
              setActiveTournamentMatchId(null);
              startMatchWithConfig({ mode: 'quick_match' });
            }}
            className="bg-emerald-500 px-4 py-2 text-xs font-bold text-slate-950 uppercase transition-colors hover:bg-emerald-400 whitespace-nowrap shrink-0"
          >
            Kickoff Now
          </button>
        </div>
      </header>

      {/* Sub-Header Telemetry Bar (Unboxed metadata with · separators) */}
      <div className="flex shrink-0 flex-wrap items-center justify-between gap-4 border-b border-white/5 bg-[#090d16]/60 px-6 py-2 text-xs text-slate-400">
        <div className="flex flex-wrap items-center gap-2 font-mono-tabular">
          <span className="font-sans font-semibold text-white">{profile.managerName}</span>
          <span aria-hidden="true">·</span>
          <span>Level {profile.level}</span>
          <span aria-hidden="true">·</span>
          <span className="text-amber-300">{profile.coins} Coins</span>
          <span aria-hidden="true">·</span>
          <span className="text-emerald-400">{profile.xp} XP</span>
          <span aria-hidden="true">·</span>
          <span>
            Record: {profile.matchesWon}W / {profile.matchesPlayed}P ({profile.totalGoalsScored}{' '}
            Goals)
          </span>
        </div>

        <button
          type="button"
          onClick={() => setShowSquadModal(true)}
          className="flex items-center gap-1.5 text-xs font-semibold text-emerald-400 hover:text-emerald-300 whitespace-nowrap"
        >
          <Users className="h-3.5 w-3.5" />
          <span>
            Edit {homeTeam.shortName} Squad & Formation ({homeTeam.tactics.formation})
          </span>
        </button>
      </div>

      {/* Scrollable Main Content Workspace */}
      <main className="scrollable-panel flex-1 px-4 py-6 sm:px-8">
        <div className="mx-auto max-w-7xl">
          {/* TAB 1: MATCH LOBBY (Quick Match, Street Football, Manager Sim Setup) */}
          {activeHubTab === 'play' && (
            <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
              {/* Left 7 Cols: Team Selection & Match Configuration */}
              <div className="flex flex-col justify-between border border-white/10 bg-[#0f172a] p-6 lg:col-span-7">
                <div>
                  <span className="text-xs font-bold tracking-wider text-emerald-400 uppercase">
                    Real-Time 3D Football Engine · 11v11 & 5v5 Street
                  </span>
                  <h1 className="mt-1 font-display text-4xl font-bold tracking-wide text-white uppercase">
                    Configure Fixture & Enter Pitch
                  </h1>

                  {/* Mode Selector Tabs */}
                  <div className="mt-5 grid grid-cols-3 gap-2">
                    {(
                      [
                        ['quick_match', '11v11 Quick Match', 'Full Stadium Pitch'],
                        ['street', '5v5 Street Football', 'Compact Concrete Cage'],
                        ['manager', '3D Manager Mode', 'Live Tactical Simulation'],
                      ] as const
                    ).map(([mKey, title, desc]) => (
                      <button
                        key={mKey}
                        type="button"
                        onClick={() =>
                          setMatchSettings((prev) => ({ ...prev, mode: mKey as GameMode }))
                        }
                        className={`border p-3 text-left transition-colors ${
                          matchSettings.mode === mKey
                            ? 'border-emerald-400 bg-emerald-500/15 text-white'
                            : 'border-white/10 bg-[#090d16] text-slate-300 hover:bg-slate-900'
                        }`}
                      >
                        <div className="font-display text-base font-bold uppercase whitespace-nowrap">
                          {title}
                        </div>
                        <div className="text-[11px] text-slate-400 truncate">{desc}</div>
                      </button>
                    ))}
                  </div>

                  {/* Home vs Away Club Selectors */}
                  <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2">
                    {/* Home Club */}
                    <div className="border border-white/10 bg-[#090d16] p-4">
                      <div className="flex items-center justify-between text-xs text-slate-400">
                        <span>HOME CLUB (YOU)</span>
                        <span className="font-mono-tabular font-bold text-emerald-400">
                          OVR{' '}
                          {Math.round(
                            homeTeam.starters.reduce((s, p) => s + p.overall, 0) /
                              homeTeam.starters.length
                          )}
                        </span>
                      </div>

                      <select
                        value={homeTeam.id}
                        onChange={(e) => setHomeTeamId(e.target.value)}
                        className="mt-2 w-full border border-white/15 bg-slate-900 px-3 py-2 font-display text-lg font-bold text-white uppercase"
                      >
                        {teams.map((t) => (
                          <option key={t.id} value={t.id}>
                            {t.name} ({t.shortName})
                          </option>
                        ))}
                      </select>

                      <div className="mt-3 flex items-center justify-between text-xs">
                        <div className="flex items-center gap-2">
                          <span
                            style={{
                              backgroundColor: matchSettings.homeUseAwayKit
                                ? homeTeam.awayKit.primaryColor
                                : homeTeam.homeKit.primaryColor,
                            }}
                            className="h-4 w-4 border border-white/40"
                          />
                          <span className="text-slate-300">
                            {matchSettings.homeUseAwayKit ? 'Away Kit' : 'Home Kit'}
                          </span>
                        </div>
                        <button
                          type="button"
                          onClick={() =>
                            setMatchSettings((prev) => ({
                              ...prev,
                              homeUseAwayKit: !prev.homeUseAwayKit,
                            }))
                          }
                          className="text-emerald-400 underline hover:text-emerald-300"
                        >
                          Switch Kit
                        </button>
                      </div>
                    </div>

                    {/* Away Club */}
                    <div className="border border-white/10 bg-[#090d16] p-4">
                      <div className="flex items-center justify-between text-xs text-slate-400">
                        <span>OPPONENT CLUB (AI)</span>
                        <span className="font-mono-tabular font-bold text-rose-400">
                          OVR{' '}
                          {Math.round(
                            awayTeam.starters.reduce((s, p) => s + p.overall, 0) /
                              awayTeam.starters.length
                          )}
                        </span>
                      </div>

                      <select
                        value={awayTeam.id}
                        onChange={(e) => setAwayTeamId(e.target.value)}
                        className="mt-2 w-full border border-white/15 bg-slate-900 px-3 py-2 font-display text-lg font-bold text-white uppercase"
                      >
                        {teams
                          .filter((t) => t.id !== homeTeam.id)
                          .map((t) => (
                            <option key={t.id} value={t.id}>
                              {t.name} ({t.shortName})
                            </option>
                          ))}
                      </select>

                      <div className="mt-3 flex items-center justify-between text-xs">
                        <div className="flex items-center gap-2">
                          <span
                            style={{
                              backgroundColor: matchSettings.awayUseAwayKit
                                ? awayTeam.awayKit.primaryColor
                                : awayTeam.homeKit.primaryColor,
                            }}
                            className="h-4 w-4 border border-white/40"
                          />
                          <span className="text-slate-300">
                            {matchSettings.awayUseAwayKit ? 'Away Kit' : 'Home Kit'}
                          </span>
                        </div>
                        <button
                          type="button"
                          onClick={() =>
                            setMatchSettings((prev) => ({
                              ...prev,
                              awayUseAwayKit: !prev.awayUseAwayKit,
                            }))
                          }
                          className="text-rose-400 underline hover:text-rose-300"
                        >
                          Switch Kit
                        </button>
                      </div>
                    </div>
                  </div>

                  {/* Match Settings Grid */}
                  <div className="mt-5 grid grid-cols-1 gap-4 text-xs sm:grid-cols-3">
                    <div>
                      <label className="mb-1 block text-slate-400">AI Difficulty</label>
                      <select
                        value={matchSettings.difficulty}
                        onChange={(e) =>
                          setMatchSettings((prev) => ({
                            ...prev,
                            difficulty: e.target.value as DifficultyLevel,
                          }))
                        }
                        className="w-full border border-white/15 bg-[#090d16] px-3 py-2 text-white"
                      >
                        <option value="Amateur">Amateur</option>
                        <option value="Semi-Pro">Semi-Pro</option>
                        <option value="Professional">Professional</option>
                        <option value="World Class">World Class</option>
                      </select>
                    </div>

                    <div>
                      <label className="mb-1 block text-slate-400">Half Duration</label>
                      <select
                        value={matchSettings.halfDurationMinutes}
                        onChange={(e) =>
                          setMatchSettings((prev) => ({
                            ...prev,
                            halfDurationMinutes: Number(e.target.value),
                          }))
                        }
                        className="w-full border border-white/15 bg-[#090d16] px-3 py-2 text-white"
                      >
                        <option value={1}>1 Min Halves (Fast)</option>
                        <option value={2}>2 Min Halves (Standard)</option>
                        <option value={3}>3 Min Halves (Extended)</option>
                        <option value={5}>5 Min Halves (Pro)</option>
                      </select>
                    </div>

                    <div>
                      <label className="mb-1 block text-slate-400">Atmosphere & Lighting</label>
                      <select
                        value={matchSettings.weather}
                        onChange={(e) =>
                          setMatchSettings((prev) => ({
                            ...prev,
                            weather: e.target.value as MatchSettings['weather'],
                          }))
                        }
                        className="w-full border border-white/15 bg-[#090d16] px-3 py-2 text-white"
                      >
                        <option value="Clear Night">Floodlit Clear Night</option>
                        <option value="Sunny Day">Sunny Afternoon</option>
                        <option value="Dusk">Golden Dusk</option>
                      </select>
                    </div>
                  </div>
                </div>

                {/* Primary Launch CTA */}
                <div className="mt-6 flex flex-wrap items-center gap-3 border-t border-white/10 pt-5">
                  <button
                    type="button"
                    onClick={() => {
                      soundEngine.playUiClick();
                      setActiveCareerFixtureId(null);
                      setActiveTournamentMatchId(null);
                      setInMatch(true);
                    }}
                    className="flex flex-1 items-center justify-center gap-2 bg-emerald-500 px-6 py-3.5 font-display text-xl font-bold tracking-wider text-slate-950 uppercase hover:bg-emerald-400 whitespace-nowrap"
                  >
                    <Play className="h-5 w-5" />
                    <span>Start 3D Match ({homeTeam.shortName} vs {awayTeam.shortName})</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setShowSquadModal(true)}
                    className="flex items-center gap-2 border border-white/15 bg-slate-800 px-5 py-3.5 text-xs font-bold text-white uppercase hover:bg-slate-700 whitespace-nowrap"
                  >
                    <Sliders className="h-4 w-4 text-emerald-400" />
                    <span>Squad & Formation</span>
                  </button>
                </div>
              </div>

              {/* Right 5 Cols: Quick Access to Modes, Starting XI Preview & Controls Guide */}
              <div className="flex flex-col justify-between gap-6 lg:col-span-5">
                <div className="border border-white/10 bg-[#0f172a] p-5">
                  <div className="flex items-center justify-between border-b border-white/10 pb-3">
                    <h2 className="font-display text-xl font-bold text-white uppercase">
                      {homeTeam.name} Starting Lineup ({homeTeam.tactics.formation})
                    </h2>
                    <span className="text-xs text-slate-400">{homeTeam.tactics.mentality}</span>
                  </div>

                  <div className="mt-3 grid grid-cols-2 gap-1.5 text-xs">
                    {homeTeam.starters.map((p) => (
                      <div
                        key={p.id}
                        className="flex items-center justify-between bg-[#090d16] px-2.5 py-1.5"
                      >
                        <span className="truncate">
                          <strong className="font-mono-tabular mr-1.5 text-emerald-400">
                            {p.primaryPosition}
                          </strong>
                          {p.name}
                        </span>
                        <span className="font-mono-tabular font-bold text-slate-300">
                          {p.overall}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Controls Reference Card */}
                <div className="border border-white/10 bg-[#0f172a] p-5 text-xs">
                  <h3 className="font-display text-lg font-bold tracking-wide text-white uppercase">
                    Mobile Touch & Desktop Controls
                  </h3>
                  <div className="mt-2.5 space-y-1.5 text-slate-300">
                    <div>
                      <strong className="text-emerald-400">Left Virtual Stick / WASD / Arrows:</strong>{' '}
                      360° Player Dribbling & Positioning
                    </div>
                    <div>
                      <strong className="text-emerald-400">PASS / PRESS (J):</strong> Ground pass to
                      teammate or press ball carrier
                    </div>
                    <div>
                      <strong className="text-amber-300">THROUGH / SWITCH (K / Q):</strong> Thread
                      pass into space or switch defender
                    </div>
                    <div>
                      <strong className="text-rose-400">SHOOT / SLIDE (Hold Space / L):</strong>{' '}
                      Charge shot power bar or lunge slide tackle
                    </div>
                    <div>
                      <strong className="text-purple-300">SKILL / TACKLE (E) & SPRINT (Shift):</strong>{' '}
                      Roulette burst or standing tackle
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* TAB 2: CAREER MODE */}
          {activeHubTab === 'career' && (
            <CareerDashboard
              career={career}
              teams={teams}
              onStartCareerMatch={(fixtureId, asManagerSim) => {
                const fix = career.fixtures.find((f) => f.id === fixtureId);
                if (!fix) return;
                const oppId =
                  fix.homeTeamId === career.clubId ? fix.awayTeamId : fix.homeTeamId;
                setActiveCareerFixtureId(fixtureId);
                setActiveTournamentMatchId(null);
                startMatchWithConfig(
                  { mode: asManagerSim ? 'manager' : 'career' },
                  career.clubId,
                  oppId
                );
              }}
              onSimulateRound={handleSimulateCareerRound}
              onSignPlayer={(player, fromTeamId) => {
                if (career.budget < player.marketValue) return;
                setCareer((prev) => {
                  const next = { ...prev, budget: prev.budget - player.marketValue };
                  saveCareerState(next);
                  return next;
                });
                setTeams((prev) => {
                  const next = JSON.parse(JSON.stringify(prev)) as TeamData[];
                  const userClub = next.find((t) => t.id === career.clubId);
                  const sellerClub = next.find((t) => t.id === fromTeamId);
                  if (userClub && sellerClub) {
                    const replaced = userClub.substitutes[userClub.substitutes.length - 1];
                    userClub.substitutes[userClub.substitutes.length - 1] = player;
                    const sIdx = sellerClub.starters.findIndex((p) => p.id === player.id);
                    if (sIdx !== -1 && replaced) {
                      sellerClub.starters[sIdx] = replaced;
                    }
                  }
                  saveTeams(next);
                  return next;
                });
                soundEngine.playGoalCheer();
              }}
              onTrainSquadFitness={() => {
                if (career.budget < 1500000) return;
                setCareer((prev) => {
                  const next = { ...prev, budget: prev.budget - 1500000 };
                  saveCareerState(next);
                  return next;
                });
                setTeams((prev) => {
                  const next = prev.map((t) => {
                    if (t.id !== career.clubId) return t;
                    return {
                      ...t,
                      starters: t.starters.map((p) => ({
                        ...p,
                        fitness: 100,
                        overall: Math.min(99, p.overall + 1),
                      })),
                    };
                  });
                  saveTeams(next);
                  return next;
                });
                soundEngine.playUiClick();
              }}
              onResetCareer={(newClubId) => {
                const fresh = createInitialCareerState(newClubId, teams);
                setCareer(fresh);
                saveCareerState(fresh);
                setHomeTeamId(newClubId);
              }}
              onOpenSquadModal={() => {
                setHomeTeamId(career.clubId);
                setShowSquadModal(true);
              }}
            />
          )}

          {/* TAB 3: TOURNAMENT MODE */}
          {activeHubTab === 'tournament' && (
            <TournamentBracketView
              tournament={tournament}
              teams={teams}
              onPlayTournamentMatch={(matchId) => {
                const m = tournament.matches.find((x) => x.id === matchId);
                if (!m) return;
                const oppId =
                  m.homeTeamId === tournament.userTeamId ? m.awayTeamId : m.homeTeamId;
                setActiveTournamentMatchId(matchId);
                setActiveCareerFixtureId(null);
                startMatchWithConfig({ mode: 'tournament' }, tournament.userTeamId, oppId);
              }}
              onResetTournament={(userTeamId) => {
                const fresh = createInitialTournamentState(userTeamId, teams);
                setTournament(fresh);
                saveTournamentState(fresh);
              }}
            />
          )}

          {/* TAB 4: TRAINING DRILLS & CHALLENGE SCENARIOS */}
          {activeHubTab === 'training_challenges' && (
            <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
              {/* Left 6 Cols: Interactive 3D Training Drills */}
              <div className="border border-white/10 bg-[#0f172a] p-5 lg:col-span-6">
                <div className="mb-4 flex items-center justify-between">
                  <div>
                    <h2 className="font-display text-2xl font-bold text-white uppercase">
                      Interactive 3D Training Ground
                    </h2>
                    <p className="text-xs text-slate-400">
                      Hone your shooting, passing, dribbling, and pressing on the 3D pitch.
                    </p>
                  </div>
                  <Target className="h-6 w-6 text-sky-400" />
                </div>

                <div className="space-y-3">
                  {TRAINING_DRILLS.map((drill) => {
                    const best = profile.trainingHighScores[drill.id] || 0;
                    return (
                      <div
                        key={drill.id}
                        className="flex flex-col justify-between gap-3 border border-white/10 bg-[#090d16] p-4 sm:flex-row sm:items-center"
                      >
                        <div>
                          <div className="text-xs font-bold text-sky-400 uppercase">
                            {drill.category} Drill · {drill.durationSeconds}s
                          </div>
                          <h3 className="font-display text-xl font-bold text-white uppercase">
                            {drill.title}
                          </h3>
                          <p className="mt-0.5 text-xs text-slate-400">{drill.description}</p>
                          <div className="mt-2 font-mono-tabular text-xs text-slate-300">
                            Target: {drill.targetScore} PTS · Personal Best:{' '}
                            <strong className="text-emerald-400">{best} PTS</strong>
                          </div>
                        </div>

                        <button
                          type="button"
                          onClick={() =>
                            startMatchWithConfig({
                              mode: 'training',
                              trainingDrillId: drill.id,
                            })
                          }
                          className="shrink-0 bg-sky-500 px-4 py-2.5 text-xs font-bold text-slate-950 uppercase hover:bg-sky-400"
                        >
                          Start Drill
                        </button>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Right 6 Cols: Progressive Match Scenarios (Challenge Mode) */}
              <div className="border border-white/10 bg-[#0f172a] p-5 lg:col-span-6">
                <div className="mb-4 flex items-center justify-between">
                  <div>
                    <h2 className="font-display text-2xl font-bold text-white uppercase">
                      Live Scenario Challenge Mode
                    </h2>
                    <p className="text-xs text-slate-400">
                      Drop into high-pressure match moments and complete specific win conditions.
                    </p>
                  </div>
                  <Award className="h-6 w-6 text-amber-400" />
                </div>

                <div className="space-y-3">
                  {CHALLENGE_SCENARIOS.map((chal) => {
                    const completed = profile.completedChallengeIds.includes(chal.id);
                    return (
                      <div
                        key={chal.id}
                        className="flex flex-col justify-between gap-3 border border-white/10 bg-[#090d16] p-4 sm:flex-row sm:items-center"
                      >
                        <div>
                          <div className="flex items-center gap-2 text-xs text-amber-300">
                            <span className="font-bold uppercase">{chal.difficulty}</span>
                            <span aria-hidden="true">·</span>
                            <span>Starts at {chal.startMinute}'</span>
                            {completed && (
                              <>
                                <span aria-hidden="true">·</span>
                                <span className="font-bold text-emerald-400">COMPLETED ✓</span>
                              </>
                            )}
                          </div>
                          <h3 className="font-display text-xl font-bold text-white uppercase">
                            {chal.title} — {chal.subtitle}
                          </h3>
                          <p className="mt-0.5 text-xs text-slate-400">{chal.description}</p>
                          <div className="mt-1.5 text-xs text-slate-400">
                            Reward: +{chal.rewardCoins} Coins · +{chal.rewardXp} XP
                          </div>
                        </div>

                        <button
                          type="button"
                          onClick={() =>
                            startMatchWithConfig({
                              mode: 'challenge',
                              difficulty: chal.difficulty,
                              challengeId: chal.id,
                            })
                          }
                          className="shrink-0 bg-emerald-500 px-4 py-2.5 text-xs font-bold text-slate-950 uppercase hover:bg-emerald-400"
                        >
                          Play Scenario
                        </button>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          )}

          {/* TAB 5: DAILY CHALLENGES, PLAYER ACADEMY, COSMETIC STORE & SETTINGS */}
          {activeHubTab === 'club_store' && (
            <ProgressionAndStoreView
              profile={profile}
              dailyObjectives={dailyObjectives}
              cosmetics={cosmetics}
              userTeam={homeTeam}
              settings={userSettings}
              onClaimDaily={(id) => {
                const targetObj = dailyObjectives.find((o) => o.id === id);
                if (!targetObj || targetObj.claimed || targetObj.progress < targetObj.target)
                  return;
                setDailyObjectives((prev) => {
                  const next = prev.map((o) => (o.id === id ? { ...o, claimed: true } : o));
                  saveDailyObjectives(next);
                  return next;
                });
                setProfile((prev) => {
                  const next = {
                    ...prev,
                    coins: prev.coins + targetObj.rewardCoins,
                    xp: prev.xp + targetObj.rewardXp,
                  };
                  saveUserProfile(next);
                  return next;
                });
                soundEngine.playGoalCheer();
              }}
              onUpgradePlayerAttribute={(playerId, attr, costCoins) => {
                if (profile.coins < costCoins) return;
                setProfile((prev) => {
                  const next = { ...prev, coins: prev.coins - costCoins, xp: prev.xp + 50 };
                  saveUserProfile(next);
                  return next;
                });
                setTeams((prev) => {
                  const next = prev.map((t) => {
                    if (t.id !== homeTeam.id) return t;
                    return {
                      ...t,
                      starters: t.starters.map((p) => {
                        if (p.id !== playerId) return p;
                        const updatedAttrs = {
                          ...p.attributes,
                          [attr]: Math.min(99, p.attributes[attr] + 2),
                        };
                        return {
                          ...p,
                          attributes: updatedAttrs,
                          overall: calculateOverallRating(p.primaryPosition, updatedAttrs),
                        };
                      }),
                    };
                  });
                  saveTeams(next);
                  return next;
                });
                soundEngine.playUiClick();
              }}
              onUnlockOrEquipCosmetic={(item) => {
                if (!item.unlocked) {
                  if (profile.coins < item.priceCoins) return;
                  setProfile((prev) => {
                    const next = {
                      ...prev,
                      coins: prev.coins - item.priceCoins,
                      equippedBallColor:
                        item.category === 'Ball' ? item.previewColor : prev.equippedBallColor,
                    };
                    saveUserProfile(next);
                    return next;
                  });
                  setCosmetics((prev) => {
                    const next = prev.map((c) =>
                      c.id === item.id ? { ...c, unlocked: true } : c
                    );
                    saveCosmetics(next);
                    return next;
                  });
                  soundEngine.playGoalCheer();
                } else if (item.category === 'Ball') {
                  setProfile((prev) => {
                    const next = { ...prev, equippedBallColor: item.previewColor };
                    saveUserProfile(next);
                    return next;
                  });
                  soundEngine.playUiClick();
                }
              }}
              onUpdateSettings={(newSettings) => {
                setUserSettings(newSettings);
                saveUserSettings(newSettings);
              }}
              onUpdateProfileBadge={(style, primary, secondary) => {
                setProfile((prev) => {
                  const next = {
                    ...prev,
                    clubBadgeStyle: style,
                    clubBadgePrimary: primary,
                    clubBadgeSecondary: secondary,
                  };
                  saveUserProfile(next);
                  return next;
                });
              }}
            />
          )}
        </div>
      </main>

      {/* Squad & Formation Modal from Main Hub */}
      {showSquadModal && (
        <SquadTacticsModal
          team={homeTeam}
          onSaveTeam={handleSaveSquadAndTactics}
          onClose={() => setShowSquadModal(false)}
        />
      )}
      </div>
    </div>
  );
}
