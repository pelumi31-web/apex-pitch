import React, { useEffect, useRef, useState } from 'react';
import { ControlInputState } from '../engine/MatchEngine';

interface VirtualControlsProps {
  userHasPossession: boolean;
  shotPowerCharge: number;
  deadzone: number;
  buttonScale: number;
  isManagerMode: boolean;
  onInputChange: (partial: Partial<ControlInputState>) => void;
  onPass: () => void;
  onThroughBall: () => void;
  onShootStart: () => void;
  onShootRelease: () => void;
  onSkillMove: () => void;
  onTackle: (isSlide: boolean) => void;
  onSwitchPlayer: () => void;
}

export const VirtualControls: React.FC<VirtualControlsProps> = ({
  userHasPossession,
  shotPowerCharge,
  deadzone,
  buttonScale,
  isManagerMode,
  onInputChange,
  onPass,
  onThroughBall,
  onShootStart,
  onShootRelease,
  onSkillMove,
  onTackle,
  onSwitchPlayer,
}) => {
  const joystickRef = useRef<HTMLDivElement | null>(null);
  const [knobOffset, setKnobOffset] = useState({ x: 0, y: 0 });
  const [isDraggingStick, setIsDraggingStick] = useState(false);
  const [isSprinting, setIsSprinting] = useState(false);

  const keysPressed = useRef<Set<string>>(new Set());

  // Desktop Keyboard Controls (WASD / Arrows + Space/J/K/L/Shift/Q/E)
  useEffect(() => {
    if (isManagerMode) return;

    const syncKeyboardVector = () => {
      const k = keysPressed.current;
      let mx = 0;
      let mz = 0;
      if (k.has('KeyA') || k.has('ArrowLeft')) mx -= 1;
      if (k.has('KeyD') || k.has('ArrowRight')) mx += 1;
      if (k.has('KeyW') || k.has('ArrowUp')) mz -= 1;
      if (k.has('KeyS') || k.has('ArrowDown')) mz += 1;

      const len = Math.hypot(mx, mz);
      if (len > 1) {
        mx /= len;
        mz /= len;
      }
      onInputChange({
        moveX: mx,
        moveZ: mz,
        sprint: k.has('ShiftLeft') || k.has('ShiftRight'),
      });
      setIsSprinting(k.has('ShiftLeft') || k.has('ShiftRight'));
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      if (['INPUT', 'TEXTAREA', 'SELECT'].includes((e.target as HTMLElement)?.tagName)) return;

      if (
        [
          'KeyW',
          'KeyA',
          'KeyS',
          'KeyD',
          'ArrowUp',
          'ArrowDown',
          'ArrowLeft',
          'ArrowRight',
          'Space',
        ].includes(e.code)
      ) {
        e.preventDefault();
      }

      const wasDown = keysPressed.current.has(e.code);
      keysPressed.current.add(e.code);
      syncKeyboardVector();

      if (!wasDown) {
        if (e.code === 'KeyJ' || e.code === 'KeyX') {
          onPass();
        } else if (e.code === 'KeyK' || e.code === 'KeyW' && e.shiftKey) {
          if (e.code === 'KeyK') onThroughBall();
        } else if (e.code === 'Space' || e.code === 'KeyL') {
          if (userHasPossession) {
            onShootStart();
          } else {
            onTackle(true);
          }
        } else if (e.code === 'KeyQ' || e.code === 'Tab') {
          e.preventDefault();
          onSwitchPlayer();
        } else if (e.code === 'KeyE' || e.code === 'KeyC') {
          if (userHasPossession) {
            onSkillMove();
          } else {
            onTackle(false);
          }
        }
      }
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      keysPressed.current.delete(e.code);
      syncKeyboardVector();

      if (e.code === 'Space' || e.code === 'KeyL') {
        if (userHasPossession) {
          onShootRelease();
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, [
    isManagerMode,
    userHasPossession,
    onInputChange,
    onPass,
    onThroughBall,
    onShootStart,
    onShootRelease,
    onSkillMove,
    onTackle,
    onSwitchPlayer,
  ]);

  if (isManagerMode) {
    return null;
  }

  const maxRadius = 48;

  const updateStickFromPoint = (clientX: number, clientY: number) => {
    if (!joystickRef.current) return;
    const rect = joystickRef.current.getBoundingClientRect();
    const centerX = rect.left + rect.width / 2;
    const centerY = rect.top + rect.height / 2;
    let dx = clientX - centerX;
    let dy = clientY - centerY;
    const dist = Math.hypot(dx, dy);

    if (dist > maxRadius) {
      dx = (dx / dist) * maxRadius;
      dy = (dy / dist) * maxRadius;
    }

    setKnobOffset({ x: dx, y: dy });

    const normX = dx / maxRadius;
    const normZ = dy / maxRadius;
    const mag = Math.hypot(normX, normZ);

    if (mag < deadzone) {
      onInputChange({ moveX: 0, moveZ: 0 });
    } else {
      onInputChange({ moveX: normX, moveZ: normZ });
    }
  };

  const handleStickPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.currentTarget.setPointerCapture(e.pointerId);
    setIsDraggingStick(true);
    updateStickFromPoint(e.clientX, e.clientY);
  };

  const handleStickPointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!isDraggingStick) return;
    updateStickFromPoint(e.clientX, e.clientY);
  };

  const handleStickPointerUp = (e: React.PointerEvent<HTMLDivElement>) => {
    if (e.currentTarget.hasPointerCapture(e.pointerId)) {
      e.currentTarget.releasePointerCapture(e.pointerId);
    }
    setIsDraggingStick(false);
    setKnobOffset({ x: 0, y: 0 });
    onInputChange({ moveX: 0, moveZ: 0 });
  };

  const scaleStyle = { transform: `scale(${buttonScale})` };

  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-0 z-20 flex items-end justify-between px-4 pb-4 sm:px-8 sm:pb-6">
      {/* LEFT SIDE: Responsive Virtual Joystick + Desktop Hint */}
      <div className="flex flex-col items-start gap-2">
        <div
          ref={joystickRef}
          style={scaleStyle}
          onPointerDown={handleStickPointerDown}
          onPointerMove={handleStickPointerMove}
          onPointerUp={handleStickPointerUp}
          onPointerCancel={handleStickPointerUp}
          className="pointer-events-auto relative flex h-32 w-32 cursor-pointer items-center justify-center rounded-full border-2 border-white/25 bg-[#090d16]/80 shadow-xl"
          aria-label="Movement Virtual Joystick"
        >
          {/* Crosshair guide lines */}
          <div className="h-full w-px bg-white/10" />
          <div className="absolute h-px w-full bg-white/10" />

          {/* Movable thumb knob */}
          <div
            style={{
              transform: `translate3d(${knobOffset.x}px, ${knobOffset.y}px, 0)`,
            }}
            className="h-14 w-14 rounded-full border-2 border-emerald-400 bg-emerald-500/85 shadow-lg transition-transform duration-75"
          />
        </div>
        <div className="hidden text-[11px] font-medium text-slate-300/80 md:block">
          WASD / Arrows: Move · Shift: Sprint · J: Pass · K: Through · Space: Shoot/Slide · Q: Switch
        </div>
      </div>

      {/* RIGHT SIDE: Contextual Football Action Cluster */}
      <div
        style={scaleStyle}
        className="pointer-events-auto relative grid grid-cols-3 gap-2.5 sm:gap-3"
      >
        {/* Top-Left: THROUGH BALL (Attacking) or SWITCH PLAYER (Defending) */}
        {userHasPossession ? (
          <button
            type="button"
            onPointerDown={(e) => {
              e.preventDefault();
              onThroughBall();
            }}
            className="flex h-15 w-15 flex-col items-center justify-center rounded-full border-2 border-amber-400/80 bg-[#0f172a]/90 text-amber-300 shadow-lg active:scale-95 sm:h-16 sm:w-16"
          >
            <span className="font-display text-sm font-bold tracking-wider uppercase whitespace-nowrap">
              THROUGH
            </span>
            <span className="text-[10px] text-slate-400">K</span>
          </button>
        ) : (
          <button
            type="button"
            onPointerDown={(e) => {
              e.preventDefault();
              onSwitchPlayer();
            }}
            className="flex h-15 w-15 flex-col items-center justify-center rounded-full border-2 border-sky-400/80 bg-[#0f172a]/90 text-sky-300 shadow-lg active:scale-95 sm:h-16 sm:w-16"
          >
            <span className="font-display text-sm font-bold tracking-wider uppercase whitespace-nowrap">
              SWITCH
            </span>
            <span className="text-[10px] text-slate-400">Q</span>
          </button>
        )}

        {/* Top-Center: SHOOT (Attacking) or SLIDE TACKLE (Defending) */}
        {userHasPossession ? (
          <button
            type="button"
            onPointerDown={(e) => {
              e.preventDefault();
              onShootStart();
            }}
            onPointerUp={(e) => {
              e.preventDefault();
              onShootRelease();
            }}
            onPointerLeave={() => {
              if (shotPowerCharge > 0) onShootRelease();
            }}
            className="relative flex h-16 w-16 flex-col items-center justify-center overflow-hidden rounded-full border-2 border-rose-500 bg-rose-600/90 text-white shadow-xl active:scale-95 sm:h-18 sm:w-18"
          >
            {shotPowerCharge > 0 && (
              <div
                style={{ height: `${Math.round(shotPowerCharge * 100)}%` }}
                className="pointer-events-none absolute inset-x-0 bottom-0 bg-amber-400/45"
              />
            )}
            <span className="relative z-10 font-display text-base font-bold tracking-wider uppercase whitespace-nowrap">
              SHOOT
            </span>
            <span className="relative z-10 text-[10px] text-rose-100">SPACE</span>
          </button>
        ) : (
          <button
            type="button"
            onPointerDown={(e) => {
              e.preventDefault();
              onTackle(true);
            }}
            className="flex h-16 w-16 flex-col items-center justify-center rounded-full border-2 border-rose-500 bg-rose-700/90 text-white shadow-xl active:scale-95 sm:h-18 sm:w-18"
          >
            <span className="font-display text-base font-bold tracking-wider uppercase whitespace-nowrap">
              SLIDE
            </span>
            <span className="text-[10px] text-rose-100">SPACE</span>
          </button>
        )}

        {/* Top-Right: SPRINT (Hold) */}
        <button
          type="button"
          onPointerDown={(e) => {
            e.preventDefault();
            setIsSprinting(true);
            onInputChange({ sprint: true });
          }}
          onPointerUp={(e) => {
            e.preventDefault();
            setIsSprinting(false);
            onInputChange({ sprint: false });
          }}
          onPointerLeave={() => {
            if (isSprinting) {
              setIsSprinting(false);
              onInputChange({ sprint: false });
            }
          }}
          className={`flex h-15 w-15 flex-col items-center justify-center rounded-full border-2 shadow-lg active:scale-95 sm:h-16 sm:w-16 ${
            isSprinting
              ? 'border-emerald-300 bg-emerald-500 text-slate-950'
              : 'border-emerald-500/80 bg-[#0f172a]/90 text-emerald-400'
          }`}
        >
          <span className="font-display text-sm font-bold tracking-wider uppercase whitespace-nowrap">
            SPRINT
          </span>
          <span className="text-[10px] opacity-80">SHIFT</span>
        </button>

        {/* Bottom-Left: PASS (Attacking) or PRESS / CONTAIN (Defending) */}
        <button
          type="button"
          onPointerDown={(e) => {
            e.preventDefault();
            onPass();
          }}
          className="flex h-15 w-15 flex-col items-center justify-center rounded-full border-2 border-emerald-400 bg-emerald-600/90 text-white shadow-lg active:scale-95 sm:h-16 sm:w-16"
        >
          <span className="font-display text-sm font-bold tracking-wider uppercase whitespace-nowrap">
            {userHasPossession ? 'PASS' : 'PRESS'}
          </span>
          <span className="text-[10px] text-emerald-100">J</span>
        </button>

        {/* Bottom-Center: SKILL MOVE (Attacking) or STAND TACKLE (Defending) */}
        <button
          type="button"
          onPointerDown={(e) => {
            e.preventDefault();
            if (userHasPossession) {
              onSkillMove();
            } else {
              onTackle(false);
            }
          }}
          className="flex h-15 w-15 flex-col items-center justify-center rounded-full border-2 border-purple-400/80 bg-[#0f172a]/90 text-purple-300 shadow-lg active:scale-95 sm:h-16 sm:w-16"
        >
          <span className="font-display text-sm font-bold tracking-wider uppercase whitespace-nowrap">
            {userHasPossession ? 'SKILL' : 'TACKLE'}
          </span>
          <span className="text-[10px] text-slate-400">E</span>
        </button>

        {/* Bottom-Right: Dedicated Quick Switch Player */}
        <button
          type="button"
          onPointerDown={(e) => {
            e.preventDefault();
            onSwitchPlayer();
          }}
          className="flex h-15 w-15 flex-col items-center justify-center rounded-full border-2 border-slate-500/80 bg-[#0f172a]/90 text-slate-200 shadow-lg active:scale-95 sm:h-16 sm:w-16"
        >
          <span className="font-display text-sm font-bold tracking-wider uppercase whitespace-nowrap">
            PLAYER
          </span>
          <span className="text-[10px] text-slate-400">Q</span>
        </button>
      </div>
    </div>
  );
};
