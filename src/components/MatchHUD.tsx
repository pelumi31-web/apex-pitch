import React from 'react';
import { Camera, Pause, Play, RefreshCw, Shield, Users, Zap } from 'lucide-react';
import { MatchHUDState } from '../engine/MatchEngine';
import {
  CameraPreset,
  MatchSettings,
  PlayerData,
  TeamData,
  UserSettings,
} from '../types/game';

interface MatchHUDProps {
  hudState: MatchHUDState;
  homeTeam: TeamData;
  awayTeam: TeamData;
  matchSettings: MatchSettings;
  userSettings: UserSettings;
  cameraPreset: CameraPreset;
  isPaused: boolean;
  onTogglePause: () => void;
  onChangeCamera: (preset: CameraPreset) => void;
  onSkipCelebration: () => void;
  onOpenTacticsModal: () => void;
  onRestartMatch: () => void;
  onQuitToMenu: () => void;
  onSubstitute: (starterId: string, subData: PlayerData) => void;
  onQuickMentalityChange: (mentality: TeamData['tactics']['mentality']) => void;
}

const CAMERA_PRESETS: CameraPreset[] = ['Broadcast', 'Tactical', 'Follow', 'Action'];

export const MatchHUD: React.FC<MatchHUDProps> = ({
  hudState,
  homeTeam,
  awayTeam,
  matchSettings,
  userSettings,
  cameraPreset,
  isPaused,
  onTogglePause,
  onChangeCamera,
  onSkipCelebration,
  onOpenTacticsModal,
  onRestartMatch,
  onQuitToMenu,
  onSubstitute,
  onQuickMentalityChange,
}) => {
  const [selectedStarterForSub, setSelectedStarterForSub] = React.useState<string | null>(null);

  const nextCamera = () => {
    const idx = CAMERA_PRESETS.indexOf(cameraPreset);
    onChangeCamera(CAMERA_PRESETS[(idx + 1) % CAMERA_PRESETS.length]);
  };

  const formattedClock =
    matchSettings.mode === 'training'
      ? `00:${String(hudState.trainingTimeRemaining).padStart(2, '0')}`
      : `${String(hudState.matchMinute).padStart(2, '0')}:00`;

  return (
    <div className="pointer-events-none fixed inset-0 z-10 flex flex-col justify-between p-3 sm:p-5">
      {/* TOP BAR: Broadcast Scoreboard & Tactical Camera / Pause Actions */}
      <div className="flex items-start justify-between gap-4">
        {/* Broadcast Scoreboard Strip */}
        <div className="pointer-events-auto flex items-center border border-white/15 bg-[#090d16]/92 px-3 py-1.5 shadow-xl">
          <div className="flex items-center gap-2 pr-3">
            <span
              style={{ backgroundColor: homeTeam.homeKit.primaryColor }}
              className="h-3.5 w-1.5"
            />
            <span className="font-display text-base font-bold tracking-wider text-white uppercase sm:text-lg">
              {homeTeam.shortName}
            </span>
          </div>

          <div className="bg-slate-800/90 px-3 py-0.5 font-mono-tabular text-lg font-bold text-emerald-400 sm:text-xl">
            {hudState.homeScore} - {hudState.awayScore}
          </div>

          <div className="flex items-center gap-2 pl-3">
            <span className="font-display text-base font-bold tracking-wider text-white uppercase sm:text-lg">
              {awayTeam.shortName}
            </span>
            <span
              style={{ backgroundColor: awayTeam.homeKit.primaryColor }}
              className="h-3.5 w-1.5"
            />
          </div>

          <div className="ml-3 border-l border-white/15 pl-3 font-mono-tabular text-sm font-semibold text-amber-300">
            {formattedClock}
            {hudState.matchMinute >= 45 && matchSettings.mode !== 'training' && (
              <span className="ml-1 text-xs text-slate-400">+{hudState.stoppageMinutes}'</span>
            )}
          </div>

          {matchSettings.mode === 'training' && (
            <div className="ml-3 border-l border-white/15 pl-3 font-mono-tabular text-xs text-sky-300">
              SCORE: {hudState.trainingScore} / {hudState.trainingTargetScore}
            </div>
          )}

          {matchSettings.mode === 'challenge' && hudState.challengeStatusText && (
            <div className="ml-3 hidden border-l border-white/15 pl-3 text-xs font-medium text-amber-300 md:block">
              {hudState.challengeStatusText}
            </div>
          )}
        </div>

        {/* Top-Right Action Controls (Camera Switch, Tactics, Pause) */}
        <div className="pointer-events-auto flex items-center gap-2">
          <button
            type="button"
            onClick={nextCamera}
            className="flex items-center gap-1.5 border border-white/15 bg-[#090d16]/90 px-3 py-2 text-xs font-semibold text-slate-200 hover:bg-slate-800 whitespace-nowrap"
          >
            <Camera className="h-3.5 w-3.5 text-sky-400" />
            <span>{cameraPreset} Cam</span>
          </button>

          <button
            type="button"
            onClick={onOpenTacticsModal}
            className="flex items-center gap-1.5 border border-white/15 bg-[#090d16]/90 px-3 py-2 text-xs font-semibold text-slate-200 hover:bg-slate-800 whitespace-nowrap"
          >
            <Users className="h-3.5 w-3.5 text-emerald-400" />
            <span className="hidden sm:inline">Squad & Tactics</span>
          </button>

          <button
            type="button"
            onClick={onTogglePause}
            aria-label={isPaused ? 'Resume Match' : 'Pause Match'}
            className="flex items-center gap-1.5 border border-white/15 bg-[#090d16]/90 px-3 py-2 text-xs font-semibold text-white hover:bg-slate-800 whitespace-nowrap"
          >
            {isPaused ? <Play className="h-3.5 w-3.5 text-emerald-400" /> : <Pause className="h-3.5 w-3.5" />}
            <span>{isPaused ? 'Resume' : 'Pause'}</span>
          </button>
        </div>
      </div>

      {/* CENTER EVENT BANNER (Goal / Offside / Card / Half-Time) */}
      {hudState.bannerAlert && (
        <div className="pointer-events-auto my-auto flex flex-col items-center justify-center">
          <div className="border-y-2 border-emerald-400 bg-[#090d16]/95 px-8 py-3 text-center shadow-2xl">
            <p className="font-display text-2xl font-bold tracking-widest text-white uppercase sm:text-4xl">
              {hudState.bannerAlert}
            </p>
            {hudState.phase === 'GOAL_CELEBRATION' && (
              <button
                type="button"
                onClick={onSkipCelebration}
                className="mt-2 bg-emerald-500 px-4 py-1 text-xs font-bold text-slate-950 uppercase hover:bg-emerald-400"
              >
                Skip Celebration →
              </button>
            )}
          </div>
        </div>
      )}

      {/* BOTTOM-CENTER: Pitch Radar Minimap, Controlled Player Telemetry, and Manager Bar */}
      <div className="mx-auto flex flex-col items-center gap-2 pb-1">
        {/* Manager Mode Live Tactical Mentality Switcher */}
        {matchSettings.mode === 'manager' && (
          <div className="pointer-events-auto flex items-center gap-1.5 border border-white/15 bg-[#090d16]/92 px-3 py-1.5">
            <span className="mr-2 text-xs font-semibold text-slate-400">LIVE MENTALITY:</span>
            {(['Defensive', 'Balanced', 'Attacking', 'All-Out Attack'] as const).map((m) => (
              <button
                key={m}
                type="button"
                onClick={() => onQuickMentalityChange(m)}
                className={`px-2.5 py-1 text-xs font-semibold whitespace-nowrap transition-colors ${
                  homeTeam.tactics.mentality === m
                    ? 'bg-emerald-500 text-slate-950'
                    : 'bg-slate-800/80 text-slate-300 hover:text-white'
                }`}
              >
                {m}
              </button>
            ))}
          </div>
        )}

        {/* 2D Pitch Radar Minimap */}
        {userSettings.showRadar && (
          <div className="relative h-20 w-36 border border-white/20 bg-[#0b2919]/90 shadow-lg sm:h-24 sm:w-44">
            {/* Pitch center line & circle */}
            <div className="absolute inset-y-0 left-1/2 w-px bg-white/20" />
            <div className="absolute top-1/2 left-1/2 h-6 w-6 -translate-x-1/2 -translate-y-1/2 rounded-full border border-white/20" />

            {/* Player Dots */}
            {hudState.radarDots.map((dot) => {
              const leftPct = Math.min(96, Math.max(4, (dot.x + 1) * 50));
              const topPct = Math.min(94, Math.max(6, (dot.z + 1) * 50));
              return (
                <div
                  key={dot.id}
                  style={{ left: `${leftPct}%`, top: `${topPct}%` }}
                  className={`absolute h-2 w-2 -translate-x-1/2 -translate-y-1/2 rounded-full ${
                    dot.team === 'home'
                      ? dot.isControlled
                        ? 'h-2.5 w-2.5 border border-white bg-emerald-400'
                        : 'bg-emerald-500'
                      : 'bg-rose-500'
                  }`}
                />
              );
            })}

            {/* Ball Dot */}
            <div
              style={{
                left: `${Math.min(97, Math.max(3, (hudState.ballRadar.x + 1) * 50))}%`,
                top: `${Math.min(95, Math.max(5, (hudState.ballRadar.z + 1) * 50))}%`,
              }}
              className="absolute h-2 w-2 -translate-x-1/2 -translate-y-1/2 rounded-full bg-amber-300 shadow"
            />
          </div>
        )}

        {/* Active Player Info & Live Commentary Bar */}
        <div className="flex items-center gap-3 border border-white/15 bg-[#090d16]/90 px-3.5 py-1 text-xs text-slate-200">
          <span className="font-mono-tabular font-bold text-emerald-400">
            #{hudState.controlledPlayerNumber}
          </span>
          <span className="font-semibold whitespace-nowrap">{hudState.controlledPlayerName}</span>
          <span aria-hidden="true" className="text-slate-600">
            ·
          </span>
          <div className="flex items-center gap-1.5">
            <Zap className="h-3 w-3 text-amber-400" />
            <div className="h-2 w-14 bg-slate-800">
              <div
                style={{ width: `${hudState.controlledPlayerStamina}%` }}
                className={`h-full ${
                  hudState.controlledPlayerStamina > 45
                    ? 'bg-emerald-400'
                    : hudState.controlledPlayerStamina > 20
                    ? 'bg-amber-400'
                    : 'bg-rose-500'
                }`}
              />
            </div>
          </div>
          <span aria-hidden="true" className="hidden text-slate-600 sm:inline">
            ·
          </span>
          <span className="hidden max-w-xs truncate text-slate-300 sm:inline">
            {hudState.lastCommentary}
          </span>
        </div>
      </div>

      {/* PAUSE MENU & IN-MATCH SUBSTITUTIONS OVERLAY */}
      {isPaused && (
        <div className="pointer-events-auto fixed inset-0 z-40 flex items-center justify-center bg-[#070b12]/90 p-4">
          <div className="scrollable-panel max-h-[90vh] w-full max-w-3xl border border-white/15 bg-[#0f172a] p-6 shadow-2xl">
            <div className="flex items-center justify-between border-b border-white/10 pb-4">
              <div>
                <h2 className="font-display text-2xl font-bold tracking-wide text-white uppercase">
                  Match Paused — {homeTeam.name} vs {awayTeam.name}
                </h2>
                <p className="text-xs text-slate-400">
                  Minute {hudState.matchMinute}' · Possession {hudState.homePossessionPct}% -{' '}
                  {100 - hudState.homePossessionPct}% · Shots {hudState.stats.homeShots} -{' '}
                  {hudState.stats.awayShots}
                </p>
              </div>
              <div className="font-mono-tabular text-2xl font-bold text-emerald-400">
                {hudState.homeScore} - {hudState.awayScore}
              </div>
            </div>

            {/* In-Match Quick Substitutions */}
            <div className="mt-5 grid grid-cols-1 gap-4 md:grid-cols-2">
              <div className="border border-white/10 bg-[#090d16] p-3.5">
                <h3 className="mb-2 text-xs font-bold tracking-wider text-slate-300 uppercase">
                  1. Select On-Pitch Starter to Replace
                </h3>
                <div className="max-h-48 space-y-1 overflow-y-auto pr-1">
                  {homeTeam.starters.map((p) => (
                    <button
                      key={p.id}
                      type="button"
                      onClick={() => setSelectedStarterForSub(p.id)}
                      className={`flex w-full items-center justify-between px-2.5 py-1.5 text-left text-xs transition-colors ${
                        selectedStarterForSub === p.id
                          ? 'bg-emerald-500/25 text-emerald-300 border border-emerald-500/50'
                          : 'bg-slate-900/80 text-slate-200 hover:bg-slate-800'
                      }`}
                    >
                      <span>
                        <strong className="font-mono-tabular mr-1.5 text-slate-400">
                          {p.primaryPosition}
                        </strong>
                        {p.name}
                      </span>
                      <span className="font-mono-tabular text-slate-400">OVR {p.overall}</span>
                    </button>
                  ))}
                </div>
              </div>

              <div className="border border-white/10 bg-[#090d16] p-3.5">
                <h3 className="mb-2 text-xs font-bold tracking-wider text-slate-300 uppercase">
                  2. Click Substitute to Bring On
                </h3>
                <div className="max-h-48 space-y-1 overflow-y-auto pr-1">
                  {homeTeam.substitutes.map((sub) => (
                    <button
                      key={sub.id}
                      type="button"
                      disabled={!selectedStarterForSub}
                      onClick={() => {
                        if (selectedStarterForSub) {
                          onSubstitute(selectedStarterForSub, sub);
                          setSelectedStarterForSub(null);
                        }
                      }}
                      className={`flex w-full items-center justify-between px-2.5 py-1.5 text-left text-xs transition-colors ${
                        selectedStarterForSub
                          ? 'bg-slate-900/90 text-white hover:bg-emerald-600/30 cursor-pointer'
                          : 'bg-slate-900/40 text-slate-500 cursor-not-allowed'
                      }`}
                    >
                      <span>
                        <strong className="font-mono-tabular mr-1.5 text-emerald-400">
                          {sub.primaryPosition}
                        </strong>
                        {sub.name}
                      </span>
                      <span className="font-mono-tabular text-emerald-400">
                        OVR {sub.overall} · Sub In
                      </span>
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Pause Action Buttons */}
            <div className="mt-6 flex flex-wrap items-center justify-between gap-3 border-t border-white/10 pt-4">
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={onTogglePause}
                  className="flex items-center gap-2 bg-emerald-500 px-5 py-2.5 text-xs font-bold text-slate-950 uppercase hover:bg-emerald-400"
                >
                  <Play className="h-4 w-4" />
                  <span>Resume Match</span>
                </button>
                <button
                  type="button"
                  onClick={onOpenTacticsModal}
                  className="flex items-center gap-2 border border-white/15 bg-slate-800 px-4 py-2.5 text-xs font-semibold text-white hover:bg-slate-700"
                >
                  <Shield className="h-4 w-4 text-sky-400" />
                  <span>Edit Formation & Tactics</span>
                </button>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={onRestartMatch}
                  className="flex items-center gap-2 border border-white/15 bg-slate-800 px-4 py-2.5 text-xs font-semibold text-amber-300 hover:bg-slate-700"
                >
                  <RefreshCw className="h-4 w-4" />
                  <span>Restart Match</span>
                </button>
                <button
                  type="button"
                  onClick={onQuitToMenu}
                  className="border border-rose-500/40 bg-rose-950/60 px-4 py-2.5 text-xs font-semibold text-rose-200 hover:bg-rose-900"
                >
                  Exit to Main Menu
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
