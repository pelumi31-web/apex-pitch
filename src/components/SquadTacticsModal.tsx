import React, { useState } from 'react';
import { ArrowLeftRight, Check, Shield, Sliders, Users, X } from 'lucide-react';
import { FORMATIONS } from '../data/database';
import { FormationName, PlayerData, TeamData } from '../types/game';

interface SquadTacticsModalProps {
  team: TeamData;
  onSaveTeam: (updatedTeam: TeamData) => void;
  onClose: () => void;
}

export const SquadTacticsModal: React.FC<SquadTacticsModalProps> = ({
  team,
  onSaveTeam,
  onClose,
}) => {
  const [draftTeam, setDraftTeam] = useState<TeamData>(() => JSON.parse(JSON.stringify(team)));
  const [selectedSlot, setSelectedSlot] = useState<{
    list: 'starters' | 'substitutes';
    index: number;
  } | null>(null);

  const slots = FORMATIONS[draftTeam.tactics.formation] || FORMATIONS['4-3-3'];

  const handlePlayerClick = (list: 'starters' | 'substitutes', index: number) => {
    if (!selectedSlot) {
      setSelectedSlot({ list, index });
      return;
    }

    if (selectedSlot.list === list && selectedSlot.index === index) {
      setSelectedSlot(null);
      return;
    }

    const next = JSON.parse(JSON.stringify(draftTeam)) as TeamData;
    const pA: PlayerData = next[selectedSlot.list][selectedSlot.index];
    const pB: PlayerData = next[list][index];

    next[selectedSlot.list][selectedSlot.index] = pB;
    next[list][index] = pA;

    setDraftTeam(next);
    setSelectedSlot(null);
  };

  const avgOverall = Math.round(
    draftTeam.starters.reduce((sum, p) => sum + p.overall, 0) / draftTeam.starters.length
  );

  return (
    <div className="absolute inset-0 z-50 flex items-center justify-center bg-[#070b12]/92 p-2 sm:p-5">
      <div className="scrollable-panel flex max-h-[94%] w-full max-w-6xl flex-col border border-white/15 bg-[#0f172a] shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-white/10 px-6 py-4">
          <div className="flex items-center gap-3">
            <Shield className="h-6 w-6 text-emerald-400" />
            <div>
              <h2 className="font-display text-2xl font-bold tracking-wide text-white uppercase">
                Squad Management & Tactical Board — {draftTeam.name}
              </h2>
              <p className="text-xs text-slate-400">
                Team Overall {avgOverall} · Formation {draftTeam.tactics.formation} · Click any two
                players to swap positions or make substitutions
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => {
                onSaveTeam(draftTeam);
                onClose();
              }}
              className="flex items-center gap-1.5 bg-emerald-500 px-4 py-2 text-xs font-bold text-slate-950 uppercase hover:bg-emerald-400"
            >
              <Check className="h-4 w-4" />
              <span>Save Squad & Tactics</span>
            </button>
            <button
              type="button"
              onClick={onClose}
              aria-label="Close Squad Editor"
              className="border border-white/15 bg-slate-800 p-2 text-slate-300 hover:bg-slate-700"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>

        {/* Main 3-Column Body */}
        <div className="grid grid-cols-1 gap-6 p-6 lg:grid-cols-12">
          {/* LEFT: Visual 2D Pitch Formation Board (5 cols) */}
          <div className="flex flex-col gap-3 lg:col-span-5">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold tracking-wider text-slate-300 uppercase">
                Formation Shape
              </span>
              <div className="flex items-center gap-1">
                {(['4-3-3', '4-4-2', '4-2-3-1', '3-5-2'] as FormationName[]).map((fmt) => (
                  <button
                    key={fmt}
                    type="button"
                    onClick={() =>
                      setDraftTeam({
                        ...draftTeam,
                        tactics: { ...draftTeam.tactics, formation: fmt },
                      })
                    }
                    className={`px-2.5 py-1 font-mono-tabular text-xs font-semibold transition-colors ${
                      draftTeam.tactics.formation === fmt
                        ? 'bg-emerald-500 text-slate-950'
                        : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
                    }`}
                  >
                    {fmt}
                  </button>
                ))}
              </div>
            </div>

            {/* Interactive Formation Pitch Graphic */}
            <div className="relative h-80 w-full border-2 border-white/20 bg-[#134e2a] shadow-inner">
              {/* Pitch markings */}
              <div className="absolute inset-x-0 top-1/2 h-px bg-white/25" />
              <div className="absolute top-1/2 left-1/2 h-16 w-16 -translate-x-1/2 -translate-y-1/2 rounded-full border border-white/25" />
              <div className="absolute bottom-0 left-1/2 h-12 w-32 -translate-x-1/2 border-t border-x border-white/25" />
              <div className="absolute top-0 left-1/2 h-12 w-32 -translate-x-1/2 border-b border-x border-white/25" />

              {slots.map((slot, idx) => {
                const player = draftTeam.starters[idx];
                if (!player) return null;
                // Map normX (-0.95 to -0.05) to bottom-to-top (88% to 14%)
                const topPct = 12 + ((-slot.normX - 0.05) / 0.9) * 76;
                // Map normZ (-0.8 to +0.8) to left-to-right (12% to 88%)
                const leftPct = 50 + slot.normZ * 46;
                const isSelected =
                  selectedSlot?.list === 'starters' && selectedSlot.index === idx;
                const posMatch =
                  player.primaryPosition === slot.role ||
                  player.secondaryPositions.includes(slot.role);

                return (
                  <button
                    key={player.id}
                    type="button"
                    onClick={() => handlePlayerClick('starters', idx)}
                    style={{ top: `${topPct}%`, left: `${leftPct}%` }}
                    className={`absolute flex -translate-x-1/2 -translate-y-1/2 flex-col items-center transition-transform hover:scale-105 ${
                      isSelected ? 'scale-110 z-20' : 'z-10'
                    }`}
                  >
                    <div
                      style={{
                        backgroundColor: isSelected
                          ? '#10b981'
                          : draftTeam.homeKit.primaryColor,
                      }}
                      className="flex h-9 w-9 items-center justify-center rounded-full border-2 border-white font-mono-tabular text-xs font-bold text-white shadow-md"
                    >
                      {player.overall}
                    </div>
                    <span className="mt-0.5 bg-[#090d16]/90 px-1.5 py-0.2 text-[10px] font-semibold text-white whitespace-nowrap">
                      {slot.label} · {player.name.split(' ').pop()}
                    </span>
                    {!posMatch && (
                      <span className="text-[9px] font-bold text-amber-300">Out of Pos</span>
                    )}
                  </button>
                );
              })}
            </div>
          </div>

          {/* CENTER: Starting XI & Substitutes Roster List (4 cols) */}
          <div className="flex flex-col gap-4 lg:col-span-4">
            <div className="border border-white/10 bg-[#090d16] p-3.5">
              <div className="mb-2 flex items-center justify-between">
                <span className="flex items-center gap-1.5 text-xs font-bold tracking-wider text-white uppercase">
                  <Users className="h-3.5 w-3.5 text-emerald-400" />
                  Starting XI & Bench Swap
                </span>
                {selectedSlot && (
                  <span className="text-[11px] text-emerald-400">Select target player to swap</span>
                )}
              </div>

              <div className="max-h-52 space-y-1 overflow-y-auto pr-1">
                {draftTeam.starters.map((p, idx) => {
                  const slot = slots[idx] || slots[0];
                  const isSel = selectedSlot?.list === 'starters' && selectedSlot.index === idx;
                  return (
                    <button
                      key={p.id}
                      type="button"
                      onClick={() => handlePlayerClick('starters', idx)}
                      className={`flex w-full items-center justify-between px-2.5 py-1.5 text-left text-xs transition-colors ${
                        isSel
                          ? 'border border-emerald-400 bg-emerald-500/20 text-white'
                          : 'bg-slate-900/90 text-slate-200 hover:bg-slate-800'
                      }`}
                    >
                      <div className="flex items-center gap-2 truncate">
                        <span className="w-8 font-mono-tabular font-bold text-emerald-400">
                          {slot.label}
                        </span>
                        <span className="truncate font-medium">{p.name}</span>
                      </div>
                      <div className="flex items-center gap-2 font-mono-tabular text-xs shrink-0">
                        <span className="text-slate-400">PAC {p.attributes.pace}</span>
                        <span className="font-bold text-white">OVR {p.overall}</span>
                      </div>
                    </button>
                  );
                })}
              </div>

              <div className="mt-3 border-t border-white/10 pt-2.5">
                <span className="mb-1.5 block text-[11px] font-bold tracking-wider text-slate-400 uppercase">
                  Substitutes Bench (5)
                </span>
                <div className="space-y-1">
                  {draftTeam.substitutes.map((sub, idx) => {
                    const isSel =
                      selectedSlot?.list === 'substitutes' && selectedSlot.index === idx;
                    return (
                      <button
                        key={sub.id}
                        type="button"
                        onClick={() => handlePlayerClick('substitutes', idx)}
                        className={`flex w-full items-center justify-between px-2.5 py-1.5 text-left text-xs transition-colors ${
                          isSel
                            ? 'border border-emerald-400 bg-emerald-500/20 text-white'
                            : 'bg-slate-900/60 text-slate-300 hover:bg-slate-800'
                        }`}
                      >
                        <div className="flex items-center gap-2 truncate">
                          <span className="w-8 font-mono-tabular font-bold text-amber-400">
                            {sub.primaryPosition}
                          </span>
                          <span className="truncate">{sub.name}</span>
                        </div>
                        <div className="flex items-center gap-1.5 font-mono-tabular shrink-0">
                          <ArrowLeftRight className="h-3 w-3 text-slate-500" />
                          <span className="font-bold text-white">OVR {sub.overall}</span>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>
          </div>

          {/* RIGHT: Team Mentality, Sliders & Set Piece Roles (3 cols) */}
          <div className="flex flex-col gap-4 lg:col-span-3">
            <div className="border border-white/10 bg-[#090d16] p-4">
              <h3 className="mb-3 flex items-center gap-1.5 text-xs font-bold tracking-wider text-white uppercase">
                <Sliders className="h-3.5 w-3.5 text-sky-400" />
                Tactical Instructions
              </h3>

              <div className="space-y-3 text-xs">
                <div>
                  <label className="mb-1 block text-slate-400">Team Mentality</label>
                  <select
                    value={draftTeam.tactics.mentality}
                    onChange={(e) =>
                      setDraftTeam({
                        ...draftTeam,
                        tactics: {
                          ...draftTeam.tactics,
                          mentality: e.target.value as TeamData['tactics']['mentality'],
                        },
                      })
                    }
                    className="w-full border border-white/15 bg-slate-900 px-2.5 py-1.5 text-white"
                  >
                    <option value="Defensive">Defensive (Low Block)</option>
                    <option value="Balanced">Balanced</option>
                    <option value="Attacking">Attacking (High Support)</option>
                    <option value="All-Out Attack">All-Out Attack</option>
                  </select>
                </div>

                <div>
                  <label className="mb-1 block text-slate-400">Build-Up Passing Style</label>
                  <select
                    value={draftTeam.tactics.passingStyle}
                    onChange={(e) =>
                      setDraftTeam({
                        ...draftTeam,
                        tactics: {
                          ...draftTeam.tactics,
                          passingStyle: e.target.value as TeamData['tactics']['passingStyle'],
                        },
                      })
                    }
                    className="w-full border border-white/15 bg-slate-900 px-2.5 py-1.5 text-white"
                  >
                    <option value="Short">Short Possession</option>
                    <option value="Mixed">Mixed Balanced</option>
                    <option value="Direct">Direct Counter-Attack</option>
                  </select>
                </div>

                <div>
                  <div className="flex justify-between text-slate-400">
                    <span>Pressing Intensity</span>
                    <span className="font-mono-tabular text-white">
                      {draftTeam.tactics.pressingIntensity}%
                    </span>
                  </div>
                  <input
                    type="range"
                    min={20}
                    max={100}
                    value={draftTeam.tactics.pressingIntensity}
                    onChange={(e) =>
                      setDraftTeam({
                        ...draftTeam,
                        tactics: {
                          ...draftTeam.tactics,
                          pressingIntensity: Number(e.target.value),
                        },
                      })
                    }
                    className="mt-1 w-full accent-emerald-500"
                  />
                </div>

                <div>
                  <div className="flex justify-between text-slate-400">
                    <span>Defensive Line Height</span>
                    <span className="font-mono-tabular text-white">
                      {draftTeam.tactics.defensiveLineHeight}%
                    </span>
                  </div>
                  <input
                    type="range"
                    min={20}
                    max={100}
                    value={draftTeam.tactics.defensiveLineHeight}
                    onChange={(e) =>
                      setDraftTeam({
                        ...draftTeam,
                        tactics: {
                          ...draftTeam.tactics,
                          defensiveLineHeight: Number(e.target.value),
                        },
                      })
                    }
                    className="mt-1 w-full accent-emerald-500"
                  />
                </div>

                <div>
                  <div className="flex justify-between text-slate-400">
                    <span>Team Width</span>
                    <span className="font-mono-tabular text-white">
                      {draftTeam.tactics.width}%
                    </span>
                  </div>
                  <input
                    type="range"
                    min={20}
                    max={100}
                    value={draftTeam.tactics.width}
                    onChange={(e) =>
                      setDraftTeam({
                        ...draftTeam,
                        tactics: {
                          ...draftTeam.tactics,
                          width: Number(e.target.value),
                        },
                      })
                    }
                    className="mt-1 w-full accent-emerald-500"
                  />
                </div>

                <div className="border-t border-white/10 pt-2.5">
                  <label className="mb-1 block text-slate-400">Club Captain</label>
                  <select
                    value={draftTeam.tactics.captainId}
                    onChange={(e) =>
                      setDraftTeam({
                        ...draftTeam,
                        tactics: { ...draftTeam.tactics, captainId: e.target.value },
                      })
                    }
                    className="w-full border border-white/15 bg-slate-900 px-2.5 py-1.5 text-white"
                  >
                    {draftTeam.starters.map((p) => (
                      <option key={p.id} value={p.id}>
                        #{p.shirtNumber} {p.name} ({p.overall})
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="mb-1 block text-slate-400">Penalty & Free-Kick Taker</label>
                  <select
                    value={draftTeam.tactics.penaltyTakerId}
                    onChange={(e) =>
                      setDraftTeam({
                        ...draftTeam,
                        tactics: {
                          ...draftTeam.tactics,
                          penaltyTakerId: e.target.value,
                          freeKickTakerId: e.target.value,
                        },
                      })
                    }
                    className="w-full border border-white/15 bg-slate-900 px-2.5 py-1.5 text-white"
                  >
                    {draftTeam.starters.map((p) => (
                      <option key={p.id} value={p.id}>
                        #{p.shirtNumber} {p.name} (SHO {p.attributes.shooting})
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
