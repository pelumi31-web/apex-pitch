import * as THREE from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { CHALLENGE_SCENARIOS, FORMATIONS, TRAINING_DRILLS } from '../data/database';
import { soundEngine } from '../services/audio';
import {
  CameraPreset,
  MatchPhase,
  MatchSettings,
  MatchStats,
  PlayerData,
  PositionCode,
  SetPieceType,
  TeamData,
  UserSettings,
} from '../types/game';
import {
  buildStadiumEnvironment,
  getPitchDimensions,
  PitchDimensions,
} from './PitchBuilder';
import {
  animatePlayerMesh,
  buildPlayerMesh,
  PlayerMeshParts,
} from './PlayerMeshBuilder';

// Pre-allocated vectors to prevent garbage collection in the 60FPS loop
const _vecA = new THREE.Vector3();
const _vecB = new THREE.Vector3();
const _camTargetPos = new THREE.Vector3();
const _camLookAt = new THREE.Vector3();

export interface ActivePlayerEntity {
  id: string;
  team: 'home' | 'away';
  data: PlayerData;
  role: PositionCode;
  slotIndex: number;
  baseNormX: number;
  baseNormZ: number;
  position: THREE.Vector3;
  velocity: THREE.Vector3;
  facingAngle: number;
  stamina: number; // 0 to 100
  actionType: 'idle' | 'kick' | 'tackle' | 'dive_left' | 'dive_right';
  actionTimer: number;
  cooldownTimer: number;
  yellowCards: number;
  redCarded: boolean;
  meshParts: PlayerMeshParts;
}

export interface RadarPlayerDot {
  id: string;
  team: 'home' | 'away';
  x: number; // normalized -1 to 1
  z: number; // normalized -1 to 1
  isControlled: boolean;
  hasBall: boolean;
}

export interface MatchHUDState {
  phase: MatchPhase;
  setPieceType: SetPieceType;
  matchMinute: number;
  stoppageMinutes: number;
  homeScore: number;
  awayScore: number;
  homePossessionPct: number;
  controlledPlayerName: string;
  controlledPlayerNumber: number;
  controlledPlayerStamina: number;
  userHasPossession: boolean;
  ballOwnerTeam: 'home' | 'away' | null;
  lastCommentary: string;
  bannerAlert: string | null;
  shotPowerCharge: number; // 0 to 1
  trainingScore: number;
  trainingTargetScore: number;
  trainingTimeRemaining: number;
  challengeStatusText: string;
  challengeCompleted: boolean | null;
  radarDots: RadarPlayerDot[];
  ballRadar: { x: number; z: number };
  stats: MatchStats;
}

export interface ControlInputState {
  moveX: number; // -1 to 1
  moveZ: number; // -1 to 1
  sprint: boolean;
  ChargingShot: boolean;
}

function createSoccerBallTexture(): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 128;
  const ctx = canvas.getContext('2d')!;
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, 256, 128);

  ctx.fillStyle = '#0f172a';
  const spots = [
    [32, 32],
    [96, 64],
    [160, 28],
    [220, 72],
    [60, 102],
    [188, 100],
  ];
  spots.forEach(([x, y]) => {
    ctx.beginPath();
    ctx.arc(x, y, 16, 0, Math.PI * 2);
    ctx.fill();
  });

  ctx.strokeStyle = '#eab308';
  ctx.lineWidth = 4;
  ctx.beginPath();
  ctx.moveTo(0, 64);
  ctx.lineTo(256, 64);
  ctx.stroke();

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

export class MatchEngine {
  private container: HTMLElement;
  private renderer: THREE.WebGLRenderer;
  private scene: THREE.Scene;
  private camera: THREE.PerspectiveCamera;
  private isSoftwareGl: boolean;
  private frameId = 0;
  private isDisposed = false;
  private isPaused = false;

  private dims: PitchDimensions;
  private homeTeam: TeamData;
  private awayTeam: TeamData;
  private matchSettings: MatchSettings;
  private userSettings: UserSettings;
  private cameraPreset: CameraPreset;

  private players: ActivePlayerEntity[] = [];
  private controlledPlayerId: string = '';

  // Ball state
  private ballMesh: THREE.Mesh;
  private ballShadow: THREE.Mesh;
  private ballTrailRing: THREE.Mesh;
  private ballPosition = new THREE.Vector3(0, 0.24, 0);
  private ballVelocity = new THREE.Vector3(0, 0, 0);
  private ballSpin = 0; // Magnus curve
  private ballOwner: ActivePlayerEntity | null = null;
  private lastTouchTeam: 'home' | 'away' = 'home';
  private lastPasser: ActivePlayerEntity | null = null;
  private potentialOffsideReceiverIds = new Set<string>();

  // Match Progression & Rules
  private phase: MatchPhase = 'PRE_KICKOFF';
  private setPieceType: SetPieceType = 'KICKOFF';
  private kickoffTeam: 'home' | 'away' = 'home';
  private attackDirectionHome: 1 | -1 = 1; // +1 in 1st half (left to right), -1 in 2nd half
  private elapsedRealSeconds = 0;
  private stoppageMinutes = 2;
  private celebrationTimer = 0;
  private bannerAlert: string | null = 'KICKOFF READY';
  private bannerTimer = 2.5;
  private lastCommentary = 'Welcome to live coverage from the stadium!';

  // Shot Charging
  private shotCharge = 0;
  private isChargingShot = false;

  // Training & Challenge State
  private trainingScore = 0;
  private trainingTimeRemaining = 60;
  private trainingTargetGroup: THREE.Group | null = null;
  private trainingTargetPos = new THREE.Vector3(32, 0.1, 0);
  private substitutionsUsedHome = 0;

  private stats: MatchStats = {
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
  };

  private input: ControlInputState = {
    moveX: 0,
    moveZ: 0,
    sprint: false,
    ChargingShot: false,
  };

  private onHUDUpdate: (state: MatchHUDState) => void;
  private onMatchComplete: (stats: MatchStats, challengePassed?: boolean, trainingScore?: number) => void;
  private hudThrottleCounter = 0;

  constructor(
    container: HTMLElement,
    homeTeam: TeamData,
    awayTeam: TeamData,
    matchSettings: MatchSettings,
    userSettings: UserSettings,
    ballColorHex: string,
    onHUDUpdate: (state: MatchHUDState) => void,
    onMatchComplete: (stats: MatchStats, challengePassed?: boolean, trainingScore?: number) => void
  ) {
    this.container = container;
    this.homeTeam = JSON.parse(JSON.stringify(homeTeam));
    this.awayTeam = JSON.parse(JSON.stringify(awayTeam));
    this.matchSettings = matchSettings;
    this.userSettings = userSettings;
    this.cameraPreset = userSettings.defaultCamera;
    this.onHUDUpdate = onHUDUpdate;
    this.onMatchComplete = onMatchComplete;
    this.dims = getPitchDimensions(matchSettings.mode);

    // 1. Detect Software WebGL per Three.js skill instructions
    this.isSoftwareGl = (() => {
      const probeCanvas = document.createElement('canvas');
      const gl = probeCanvas.getContext('webgl2');
      if (!gl) return true;
      const ext = gl.getExtension('WEBGL_debug_renderer_info');
      const param = ext ? ext.UNMASKED_RENDERER_WEBGL : gl.RENDERER;
      const gpu = String(gl.getParameter(param));
      gl.getExtension('WEBGL_lose_context')?.loseContext();
      return /SwiftShader|llvmpipe|softpipe|Software|Basic Render/i.test(gpu);
    })();

    // 2. Initialize WebGLRenderer
    this.renderer = new THREE.WebGLRenderer({
      antialias: !this.isSoftwareGl && userSettings.graphicsQuality !== 'Low',
      powerPreference: 'high-performance',
    });
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.1;
    const maxPixelRatio = userSettings.graphicsQuality === 'Low' ? 1 : 2;
    this.renderer.setPixelRatio(
      this.isSoftwareGl ? 1 : Math.min(window.devicePixelRatio || 1, maxPixelRatio)
    );
    this.renderer.shadowMap.enabled =
      !this.isSoftwareGl && userSettings.graphicsQuality !== 'Low';
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.setSize(container.clientWidth || 1280, container.clientHeight || 720);
    container.appendChild(this.renderer.domElement);

    // 3. Scene & Studio Environment Map
    this.scene = new THREE.Scene();
    const skyColor =
      matchSettings.weather === 'Sunny Day'
        ? 0x1e3a5f
        : matchSettings.weather === 'Dusk'
        ? 0x1e1b4b
        : 0x070b14;
    this.scene.background = new THREE.Color(skyColor);
    this.scene.fog = new THREE.FogExp2(skyColor, 0.0042);

    const pmremGenerator = new THREE.PMREMGenerator(this.renderer);
    this.scene.environment = pmremGenerator.fromScene(new RoomEnvironment(), 0.04).texture;
    pmremGenerator.dispose();

    // 4. Camera Setup
    this.camera = new THREE.PerspectiveCamera(
      44,
      (container.clientWidth || 1280) / (container.clientHeight || 720),
      0.5,
      300
    );
    this.camera.position.set(0, 34, 46);
    this.camera.lookAt(0, 0, 0);

    // 5. Balanced 3-Point Stadium Lighting
    const hemiLight = new THREE.HemisphereLight(0xdbeafe, 0x14532d, 0.85);
    hemiLight.position.set(0, 50, 0);
    this.scene.add(hemiLight);

    const keyLight = new THREE.DirectionalLight(0xfffbeb, 1.65);
    keyLight.position.set(28, 48, 32);
    if (!this.isSoftwareGl && userSettings.graphicsQuality !== 'Low') {
      keyLight.castShadow = true;
      const shadowRes = userSettings.graphicsQuality === 'High' ? 2048 : 1024;
      keyLight.shadow.mapSize.width = shadowRes;
      keyLight.shadow.mapSize.height = shadowRes;
      const d = 56;
      keyLight.shadow.camera.left = -d;
      keyLight.shadow.camera.right = d;
      keyLight.shadow.camera.top = d;
      keyLight.shadow.camera.bottom = -d;
      keyLight.shadow.camera.near = 5;
      keyLight.shadow.camera.far = 130;
      keyLight.shadow.bias = -0.0005;
      keyLight.shadow.normalBias = 0.02;
    }
    this.scene.add(keyLight);

    const rimLight = new THREE.DirectionalLight(0x38bdf8, 0.55);
    rimLight.position.set(-35, 28, -30);
    this.scene.add(rimLight);

    // 6. Build 3D Stadium & Pitch
    const homeKit = matchSettings.homeUseAwayKit ? this.homeTeam.awayKit : this.homeTeam.homeKit;
    const awayKit = matchSettings.awayUseAwayKit ? this.awayTeam.awayKit : this.awayTeam.homeKit;
    const maxAniso = this.renderer.capabilities.getMaxAnisotropy();

    const stadiumGroup = buildStadiumEnvironment(
      this.dims,
      matchSettings,
      maxAniso,
      homeKit.primaryColor,
      awayKit.primaryColor,
      userSettings.graphicsQuality
    );
    this.scene.add(stadiumGroup);

    // 7. Create Controllable 3D Soccer Ball
    const ballTex = createSoccerBallTexture();
    const ballGeo = new THREE.SphereGeometry(0.24, 24, 24);
    const ballMat = new THREE.MeshStandardMaterial({
      map: ballTex,
      color: new THREE.Color(ballColorHex || '#ffffff'),
      roughness: 0.3,
      metalness: 0.1,
    });
    this.ballMesh = new THREE.Mesh(ballGeo, ballMat);
    this.ballMesh.castShadow = true;
    this.ballMesh.position.copy(this.ballPosition);
    this.scene.add(this.ballMesh);

    this.ballShadow = new THREE.Mesh(
      new THREE.CircleGeometry(0.32, 16),
      new THREE.MeshBasicMaterial({
        color: 0x000000,
        transparent: true,
        opacity: 0.5,
        depthWrite: false,
      })
    );
    this.ballShadow.rotation.x = -Math.PI / 2;
    this.ballShadow.position.set(0, 0.025, 0);
    this.scene.add(this.ballShadow);

    this.ballTrailRing = new THREE.Mesh(
      new THREE.RingGeometry(0.3, 0.42, 20),
      new THREE.MeshBasicMaterial({
        color: 0xfacc15,
        side: THREE.DoubleSide,
        transparent: true,
        opacity: 0.65,
        depthWrite: false,
      })
    );
    this.ballTrailRing.rotation.x = -Math.PI / 2;
    this.ballTrailRing.position.set(0, 0.028, 0);
    this.scene.add(this.ballTrailRing);

    // 8. Spawn Both Teams on Pitch
    this.spawnTeams();

    // 9. Configure Mode-Specific Initial State (Challenge / Training)
    this.initializeModeRules();

    // Pre-warm shaders on hardware GPU
    if (!this.isSoftwareGl) {
      this.renderer.compile(this.scene, this.camera);
    }

    window.addEventListener('resize', this.handleResize);
    soundEngine.startCrowdAmbience();
    soundEngine.playWhistle('single');
    this.startLoop();
  }

  private initializeModeRules() {
    if (this.matchSettings.mode === 'challenge' && this.matchSettings.challengeId) {
      const chal = CHALLENGE_SCENARIOS.find((c) => c.id === this.matchSettings.challengeId);
      if (chal) {
        this.stats.homeGoals = chal.initialHomeGoals;
        this.stats.awayGoals = chal.initialAwayGoals;
        const totalMatchRealSecs = this.matchSettings.halfDurationMinutes * 2 * 60;
        this.elapsedRealSeconds = (chal.startMinute / 90) * totalMatchRealSecs;
        this.phase = chal.startMinute >= 45 ? 'SECOND_HALF' : 'FIRST_HALF';
        this.attackDirectionHome = chal.startMinute >= 45 ? -1 : 1;
        this.lastCommentary = `Challenge Started: ${chal.subtitle}`;
        this.showBanner(chal.title.toUpperCase(), 3.0);
      }
    } else if (this.matchSettings.mode === 'training') {
      const drill =
        TRAINING_DRILLS.find((d) => d.id === this.matchSettings.trainingDrillId) ||
        TRAINING_DRILLS[0];
      this.trainingTimeRemaining = drill.durationSeconds;
      this.phase = 'FIRST_HALF';
      this.createTrainingTargetZone();
      this.relocateTrainingTarget();
      this.showBanner(drill.title.toUpperCase(), 3.0);
      this.lastCommentary = drill.description;
    } else {
      this.phase = 'FIRST_HALF';
      this.resetPositionsForKickoff('home');
      this.showBanner('KICKOFF — 1ST HALF', 2.2);
    }
  }

  private createTrainingTargetZone() {
    const group = new THREE.Group();
    const ring = new THREE.Mesh(
      new THREE.RingGeometry(1.6, 2.1, 32),
      new THREE.MeshBasicMaterial({
        color: 0x38bdf8,
        side: THREE.DoubleSide,
        transparent: true,
        opacity: 0.85,
        depthWrite: false,
      })
    );
    ring.rotation.x = -Math.PI / 2;
    ring.position.y = 0.04;
    group.add(ring);

    const pillar = new THREE.Mesh(
      new THREE.CylinderGeometry(1.6, 1.6, 1.8, 24, 1, true),
      new THREE.MeshBasicMaterial({
        color: 0x38bdf8,
        side: THREE.DoubleSide,
        transparent: true,
        opacity: 0.18,
        depthWrite: false,
      })
    );
    pillar.position.y = 0.9;
    group.add(pillar);

    this.trainingTargetGroup = group;
    this.scene.add(group);
  }

  private relocateTrainingTarget() {
    if (!this.trainingTargetGroup) return;
    const drillId = this.matchSettings.trainingDrillId || 'drill_shooting';
    if (drillId === 'drill_shooting') {
      // Target near top/bottom corners of the right goal
      const zSide = (Math.random() > 0.5 ? 1 : -1) * (1.5 + Math.random() * 1.5);
      this.trainingTargetPos.set(this.dims.halfLength - 1.5, 0.05, zSide);
    } else {
      // Target zone on pitch for passing/dribbling
      this.trainingTargetPos.set(
        8 + Math.random() * 26,
        0.05,
        (Math.random() - 0.5) * (this.dims.width * 0.65)
      );
    }
    this.trainingTargetGroup.position.copy(this.trainingTargetPos);
  }

  private spawnTeams() {
    const isStreet = this.matchSettings.mode === 'street';
    const isTraining = this.matchSettings.mode === 'training';
    const homeKit = this.matchSettings.homeUseAwayKit
      ? this.homeTeam.awayKit
      : this.homeTeam.homeKit;
    const awayKit = this.matchSettings.awayUseAwayKit
      ? this.awayTeam.awayKit
      : this.awayTeam.homeKit;

    const homeFormationSlots = FORMATIONS[this.homeTeam.tactics.formation] || FORMATIONS['4-3-3'];
    const awayFormationSlots = FORMATIONS[this.awayTeam.tactics.formation] || FORMATIONS['4-3-3'];

    // In Street Mode, select 5v5 (GK + 4 outfielders); in Training, 6 home vs 3 away defenders + GK
    const homeIndices = isStreet
      ? [0, 2, 6, 8, 9]
      : isTraining
      ? [0, 2, 6, 7, 8, 9, 10]
      : [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
    const awayIndices = isStreet
      ? [0, 2, 6, 8, 9]
      : isTraining
      ? [0, 2, 3, 5]
      : [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10];

    homeIndices.forEach((slotIdx) => {
      const pData = this.homeTeam.starters[slotIdx] || this.homeTeam.starters[0];
      const slot = homeFormationSlots[slotIdx] || homeFormationSlots[0];
      const isGK = slot.role === 'GK';
      const meshParts = buildPlayerMesh(pData, homeKit, isGK, 0x10b981);
      this.scene.add(meshParts.root);

      const entity: ActivePlayerEntity = {
        id: pData.id,
        team: 'home',
        data: pData,
        role: slot.role,
        slotIndex: slotIdx,
        baseNormX: slot.normX,
        baseNormZ: slot.normZ,
        position: new THREE.Vector3(),
        velocity: new THREE.Vector3(),
        facingAngle: Math.PI / 2,
        stamina: pData.fitness || 100,
        actionType: 'idle',
        actionTimer: 0,
        cooldownTimer: 0,
        yellowCards: 0,
        redCarded: false,
        meshParts,
      };
      this.players.push(entity);
    });

    awayIndices.forEach((slotIdx) => {
      const pData = this.awayTeam.starters[slotIdx] || this.awayTeam.starters[0];
      const slot = awayFormationSlots[slotIdx] || awayFormationSlots[0];
      const isGK = slot.role === 'GK';
      const meshParts = buildPlayerMesh(pData, awayKit, isGK, 0xf43f5e);
      this.scene.add(meshParts.root);

      const entity: ActivePlayerEntity = {
        id: pData.id,
        team: 'away',
        data: pData,
        role: slot.role,
        slotIndex: slotIdx,
        baseNormX: slot.normX,
        baseNormZ: slot.normZ,
        position: new THREE.Vector3(),
        velocity: new THREE.Vector3(),
        facingAngle: -Math.PI / 2,
        stamina: pData.fitness || 100,
        actionType: 'idle',
        actionTimer: 0,
        cooldownTimer: 0,
        yellowCards: 0,
        redCarded: false,
        meshParts,
      };
      this.players.push(entity);
    });

    // Default controlled player to Home Striker or Midfielder
    const homeOutfield = this.players.filter((p) => p.team === 'home' && p.role !== 'GK');
    const striker =
      homeOutfield.find((p) => p.role === 'ST') ||
      homeOutfield[homeOutfield.length - 1] ||
      this.players[0];
    this.controlledPlayerId = striker.id;
  }

  public resetPositionsForKickoff(kickoffTeam: 'home' | 'away') {
    this.kickoffTeam = kickoffTeam;
    this.ballOwner = null;
    this.ballPosition.set(0, 0.24, 0);
    this.ballVelocity.set(0, 0, 0);
    this.ballSpin = 0;
    this.potentialOffsideReceiverIds.clear();

    const homeDir = this.attackDirectionHome; // +1 means home is on left (-X) attacking right (+X)

    this.players.forEach((p) => {
      if (p.redCarded) {
        p.position.set(0, -20, 0);
        p.meshParts.root.visible = false;
        return;
      }
      const dir = p.team === 'home' ? homeDir : -homeDir;
      // baseNormX is negative (-0.92 for GK to -0.1 for ST)
      const worldX = p.baseNormX * this.dims.halfLength * dir;
      const worldZ = p.baseNormZ * this.dims.halfWidth * dir;
      p.position.set(worldX, 0, worldZ);
      p.velocity.set(0, 0, 0);
      p.facingAngle = dir > 0 ? Math.PI / 2 : -Math.PI / 2;
      p.meshParts.root.position.copy(p.position);
      p.meshParts.root.rotation.y = p.facingAngle;
    });

    // Place kickoff taker near center spot with possession
    const takerCandidates = this.players.filter(
      (p) => p.team === kickoffTeam && p.role !== 'GK' && !p.redCarded
    );
    const taker =
      takerCandidates.find((p) => p.role === 'ST') ||
      takerCandidates[takerCandidates.length - 1];
    if (taker) {
      taker.position.set(kickoffTeam === 'home' ? -0.6 * homeDir : 0.6 * homeDir, 0, 0);
      taker.meshParts.root.position.copy(taker.position);
      this.ballOwner = taker;
      this.lastTouchTeam = kickoffTeam;
      if (kickoffTeam === 'home') {
        this.controlledPlayerId = taker.id;
      }
    }
  }

  public setControlInput(partial: Partial<ControlInputState>) {
    Object.assign(this.input, partial);
    if (partial.ChargingShot !== undefined) {
      if (partial.ChargingShot && !this.isChargingShot) {
        this.isChargingShot = true;
        this.shotCharge = 0.15;
      } else if (!partial.ChargingShot && this.isChargingShot) {
        this.isChargingShot = false;
        this.triggerShot(this.shotCharge);
        this.shotCharge = 0;
      }
    }
  }

  public setPaused(paused: boolean) {
    this.isPaused = paused;
  }

  public setCameraPreset(preset: CameraPreset) {
    this.cameraPreset = preset;
  }

  public updateTacticsLive(newHomeTeam: TeamData) {
    this.homeTeam.tactics = { ...newHomeTeam.tactics };
    const slots = FORMATIONS[this.homeTeam.tactics.formation] || FORMATIONS['4-3-3'];
    const homePlayers = this.players.filter((p) => p.team === 'home');
    homePlayers.forEach((p, idx) => {
      const slot = slots[idx] || slots[slots.length - 1];
      p.role = slot.role;
      p.baseNormX = slot.normX;
      p.baseNormZ = slot.normZ;
    });
    this.lastCommentary = `Tactical adjustment: ${this.homeTeam.name} shifts to ${this.homeTeam.tactics.formation} (${this.homeTeam.tactics.mentality}).`;
  }

  public performSubstitution(starterId: string, subData: PlayerData): boolean {
    if (
      this.matchSettings.mode === 'challenge' &&
      this.matchSettings.challengeId === 'chal_limited_subs' &&
      this.substitutionsUsedHome >= 1
    ) {
      return false;
    }
    const entity = this.players.find((p) => p.team === 'home' && p.id === starterId);
    if (!entity || entity.redCarded) return false;

    const homeKit = this.matchSettings.homeUseAwayKit
      ? this.homeTeam.awayKit
      : this.homeTeam.homeKit;
    this.scene.remove(entity.meshParts.root);

    const newMesh = buildPlayerMesh(subData, homeKit, entity.role === 'GK', 0x10b981);
    newMesh.root.position.copy(entity.position);
    this.scene.add(newMesh.root);

    entity.id = subData.id;
    entity.data = subData;
    entity.stamina = 100;
    entity.meshParts = newMesh;
    if (this.controlledPlayerId === starterId) {
      this.controlledPlayerId = subData.id;
    }
    this.substitutionsUsedHome++;
    this.showBanner(`SUBSTITUTION: ${subData.name.toUpperCase()} ON`, 2.2);
    this.lastCommentary = `Substitution for ${this.homeTeam.name}: Fresh legs as ${subData.name} enters the pitch!`;
    return true;
  }

  public skipCelebration() {
    if (this.phase === 'GOAL_CELEBRATION') {
      this.celebrationTimer = 0;
      this.phase = this.elapsedRealSeconds >= this.matchSettings.halfDurationMinutes * 60 ? 'SECOND_HALF' : 'FIRST_HALF';
      this.resetPositionsForKickoff(this.kickoffTeam);
      soundEngine.playWhistle('single');
    }
  }

  public restartMatch() {
    this.stats = {
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
    };
    this.elapsedRealSeconds = 0;
    this.trainingScore = 0;
    this.attackDirectionHome = 1;
    this.players.forEach((p) => {
      p.stamina = 100;
      p.yellowCards = 0;
      p.redCarded = false;
      p.meshParts.root.visible = true;
    });
    this.initializeModeRules();
    this.isPaused = false;
    soundEngine.playWhistle('single');
  }

  private getControlledPlayer(): ActivePlayerEntity | undefined {
    return this.players.find((p) => p.id === this.controlledPlayerId && !p.redCarded);
  }

  public switchControlledPlayer() {
    const homeOutfield = this.players.filter(
      (p) => p.team === 'home' && p.role !== 'GK' && !p.redCarded
    );
    if (homeOutfield.length === 0) return;

    // Sort by proximity to ball, pick closest player that isn't currently selected
    const sorted = [...homeOutfield].sort(
      (a, b) => a.position.distanceToSquared(this.ballPosition) - b.position.distanceToSquared(this.ballPosition)
    );
    const next = sorted.find((p) => p.id !== this.controlledPlayerId) || sorted[0];
    this.controlledPlayerId = next.id;
    soundEngine.playUiClick();
  }

  /**
   * Evaluates offside positions at the exact moment a forward pass or through-ball is played.
   */
  private snapshotOffsidePlayers(passer: ActivePlayerEntity) {
    this.potentialOffsideReceiverIds.clear();
    if (this.matchSettings.mode === 'street' || this.matchSettings.mode === 'training') return;

    const attackDir = passer.team === 'home' ? this.attackDirectionHome : -this.attackDirectionHome;
    const opponents = this.players.filter((p) => p.team !== passer.team && !p.redCarded);
    // Sort opponents by deepest X coordinate along attackDir
    const sortedOpponentX = opponents
      .map((o) => o.position.x * attackDir)
      .sort((a, b) => b - a);
    const secondLastDefenderLine =
      sortedOpponentX.length >= 2 ? sortedOpponentX[1] : this.dims.halfLength;
    const ballLine = this.ballPosition.x * attackDir;
    const offsideLine = Math.max(0, secondLastDefenderLine, ballLine);

    this.players.forEach((teammate) => {
      if (
        teammate.team === passer.team &&
        teammate.id !== passer.id &&
        !teammate.redCarded &&
        teammate.position.x * attackDir > offsideLine + 0.65
      ) {
        this.potentialOffsideReceiverIds.add(teammate.id);
      }
    });
  }

  public triggerPass(isThroughBall = false) {
    const ctrl = this.getControlledPlayer();
    const passer =
      this.ballOwner && this.ballOwner.team === 'home'
        ? this.ballOwner
        : ctrl && ctrl.position.distanceTo(this.ballPosition) < 2.3
        ? ctrl
        : null;

    if (!passer) {
      // If defending, pass button acts as contain / press
      this.triggerTackle(false);
      return;
    }

    this.executeTeamPass(passer, isThroughBall, this.input.moveX, this.input.moveZ);
  }

  private executeTeamPass(
    passer: ActivePlayerEntity,
    isThroughBall: boolean,
    aimX: number,
    aimZ: number
  ) {
    const teammates = this.players.filter(
      (p) => p.team === passer.team && p.id !== passer.id && !p.redCarded
    );
    if (teammates.length === 0) return;

    const hasAim = Math.hypot(aimX, aimZ) > 0.2;
    const aimDir = hasAim
      ? _vecA.set(aimX, 0, aimZ).normalize()
      : _vecA.set(Math.sin(passer.facingAngle), 0, Math.cos(passer.facingAngle)).normalize();

    let bestTarget = teammates[0];
    let bestScore = -9999;

    teammates.forEach((tm) => {
      _vecB.subVectors(tm.position, passer.position);
      const dist = _vecB.length();
      if (dist < 2 || dist > 52) return;
      _vecB.normalize();
      const align = _vecB.dot(aimDir);
      const forwardProgress =
        (tm.position.x - passer.position.x) *
        (passer.team === 'home' ? this.attackDirectionHome : -this.attackDirectionHome);
      const score = align * 28 - dist * 0.32 + (isThroughBall ? forwardProgress * 0.45 : 0);
      if (score > bestScore) {
        bestScore = score;
        bestTarget = tm;
      }
    });

    this.snapshotOffsidePlayers(passer);

    // Lead target if through-ball
    const attackDir = passer.team === 'home' ? this.attackDirectionHome : -this.attackDirectionHome;
    const leadOffset = isThroughBall ? 7.5 * attackDir : 1.2 * attackDir;
    const targetX = THREE.MathUtils.clamp(
      bestTarget.position.x + leadOffset,
      -this.dims.halfLength + 2,
      this.dims.halfLength - 2
    );
    const targetZ = THREE.MathUtils.clamp(
      bestTarget.position.z + bestTarget.velocity.z * 0.35,
      -this.dims.halfWidth + 2,
      this.dims.halfWidth - 2
    );

    _vecB.set(targetX - this.ballPosition.x, 0, targetZ - this.ballPosition.z);
    const dist = _vecB.length();
    _vecB.normalize();

    const passPower = THREE.MathUtils.clamp(13 + dist * 0.52, 14, 31);
    this.ballOwner = null;
    this.lastPasser = passer;
    this.lastTouchTeam = passer.team;
    this.ballVelocity.set(
      _vecB.x * passPower,
      isThroughBall && dist > 20 ? 3.4 : 1.1,
      _vecB.z * passPower
    );
    this.ballSpin = 0;

    passer.actionType = 'kick';
    passer.actionTimer = 0.28;
    passer.cooldownTimer = 0.32;

    if (passer.team === 'home') {
      this.stats.homePassesAttempted++;
      this.controlledPlayerId = bestTarget.id;
    } else {
      this.stats.awayPassesAttempted++;
    }

    soundEngine.playKick(0.5);
    this.lastCommentary = isThroughBall
      ? `${passer.data.name} threads an incisive through-ball for ${bestTarget.data.name}!`
      : `${passer.data.name} plays it to ${bestTarget.data.name}.`;
  }

  public triggerShot(chargePower = 0.65) {
    const ctrl = this.getControlledPlayer();
    const shooter =
      this.ballOwner && this.ballOwner.team === 'home'
        ? this.ballOwner
        : ctrl && ctrl.position.distanceTo(this.ballPosition) < 2.4
        ? ctrl
        : null;

    if (!shooter) {
      this.triggerTackle(true);
      return;
    }

    this.executeTeamShot(shooter, chargePower, this.input.moveZ);
  }

  private executeTeamShot(shooter: ActivePlayerEntity, chargePower: number, aimZInput: number) {
    const attackDir = shooter.team === 'home' ? this.attackDirectionHome : -this.attackDirectionHome;
    const goalX = this.dims.halfLength * attackDir;
    const targetZ = THREE.MathUtils.clamp(
      aimZInput * (this.dims.goalWidth * 0.45) + (Math.random() - 0.5) * 1.1,
      -this.dims.goalWidth * 0.48,
      this.dims.goalWidth * 0.48
    );

    _vecB.set(goalX - this.ballPosition.x, 0, targetZ - this.ballPosition.z).normalize();

    const finishingFactor = shooter.data.attributes.shooting / 100;
    const power = THREE.MathUtils.clamp(22 + chargePower * 16 * (0.85 + finishingFactor * 0.25), 22, 39);
    const loft = THREE.MathUtils.clamp(2.2 + chargePower * 5.2, 1.8, 7.2);

    this.ballOwner = null;
    this.lastPasser = null;
    this.lastTouchTeam = shooter.team;
    this.ballVelocity.set(_vecB.x * power, loft, _vecB.z * power);
    this.ballSpin = -aimZInput * 3.2;

    shooter.actionType = 'kick';
    shooter.actionTimer = 0.35;
    shooter.cooldownTimer = 0.4;

    if (shooter.team === 'home') {
      this.stats.homeShots++;
      if (Math.abs(targetZ) < this.dims.goalWidth / 2) {
        this.stats.homeShotsOnTarget++;
      }
    } else {
      this.stats.awayShots++;
      if (Math.abs(targetZ) < this.dims.goalWidth / 2) {
        this.stats.awayShotsOnTarget++;
      }
    }

    soundEngine.playKick(0.95);
    this.lastCommentary = `${shooter.data.name} unleashes a strike toward goal!`;
  }

  public triggerSkillMove() {
    const owner = this.ballOwner;
    if (!owner || owner.team !== 'home') {
      this.switchControlledPlayer();
      return;
    }
    if (owner.cooldownTimer > 0) return;

    // Stepover / Roulette burst ahead
    const angle = owner.facingAngle;
    const burst = 11.5;
    owner.velocity.set(Math.sin(angle) * burst, 0, Math.cos(angle) * burst);
    owner.cooldownTimer = 0.65;
    owner.stamina = Math.max(5, owner.stamina - 3.5);
    soundEngine.playKick(0.35);
    this.lastCommentary = `Dazzling skill move by ${owner.data.name} to create separation!`;
  }

  public triggerTackle(isSlide = false) {
    const ctrl = this.getControlledPlayer();
    if (!ctrl || ctrl.cooldownTimer > 0) return;

    ctrl.actionType = 'tackle';
    ctrl.actionTimer = isSlide ? 0.42 : 0.26;
    ctrl.cooldownTimer = isSlide ? 0.75 : 0.45;

    const lungeSpeed = isSlide ? 12.5 : 8.5;
    ctrl.velocity.set(
      Math.sin(ctrl.facingAngle) * lungeSpeed,
      0,
      Math.cos(ctrl.facingAngle) * lungeSpeed
    );

    const distToBall = ctrl.position.distanceTo(this.ballPosition);
    const reach = isSlide ? 2.65 : 2.1;

    if (distToBall <= reach) {
      // Check if foul occurs on slide tackle from behind opponent
      if (this.ballOwner && this.ballOwner.team !== ctrl.team) {
        const victim = this.ballOwner;
        const foulChance = isSlide ? 0.25 : 0.08;
        if (Math.random() < foulChance && this.matchSettings.mode !== 'street') {
          this.handleFoul(ctrl, victim);
          return;
        }
      }

      // Clean tackle wins possession!
      this.ballOwner = ctrl;
      this.lastTouchTeam = ctrl.team;
      this.lastPasser = null;
      this.stats.homeTackles++;
      if (this.matchSettings.mode === 'training') {
        this.trainingScore += 75;
      }
      soundEngine.playKick(0.55);
      this.lastCommentary = `Superb tackle by ${ctrl.data.name} to win back possession!`;
    }
  }

  private handleFoul(offender: ActivePlayerEntity, victim: ActivePlayerEntity) {
    soundEngine.playWhistle('double');
    if (offender.team === 'home') {
      this.stats.homeFouls++;
    } else {
      this.stats.awayFouls++;
    }

    // Check if inside offender's own penalty box -> Penalty Kick!
    const offenderGoalSide = offender.team === 'home' ? -this.attackDirectionHome : this.attackDirectionHome;
    const inPenaltyBox =
       victim.position.x * offenderGoalSide > this.dims.halfLength - this.dims.penaltyBoxLength &&
      Math.abs(victim.position.z) < this.dims.penaltyBoxWidth / 2;

    // Card decision
    const cardRoll = Math.random();
    if (cardRoll < 0.35) {
      offender.yellowCards++;
      if (offender.team === 'home') this.stats.homeYellowCards++;
      else this.stats.awayYellowCards++;

      if (offender.yellowCards >= 2) {
        offender.redCarded = true;
        if (offender.team === 'home') this.stats.homeRedCards++;
        else this.stats.awayRedCards++;
        this.showBanner(`RED CARD — ${offender.data.name.toUpperCase()}`, 2.5);
      } else {
        this.showBanner(`YELLOW CARD — ${offender.data.name.toUpperCase()}`, 2.2);
      }
    } else {
      this.showBanner(inPenaltyBox ? 'PENALTY KICK AWARDED!' : 'FREE KICK AWARDED', 2.0);
    }

    if (inPenaltyBox) {
      const attackDir = victim.team === 'home' ? this.attackDirectionHome : -this.attackDirectionHome;
      const penSpotX = (this.dims.halfLength - (this.dims.isStreet ? 7.5 : 11)) * attackDir;
      this.ballPosition.set(penSpotX, 0.24, 0);
      victim.position.set(penSpotX - 1.2 * attackDir, 0, 0);
      this.ballOwner = victim;
      this.lastCommentary = `PENALTY! ${offender.data.name} brings down ${victim.data.name} inside the box!`;
    } else {
      this.ballPosition.set(victim.position.x, 0.24, victim.position.z);
      this.ballOwner = victim;
      this.lastCommentary = `Foul called against ${offender.data.name}. Free kick to ${
        victim.team === 'home' ? this.homeTeam.name : this.awayTeam.name
      }.`;
    }
    this.ballVelocity.set(0, 0, 0);
  }

  private showBanner(text: string, duration = 2.0) {
    this.bannerAlert = text;
    this.bannerTimer = duration;
  }

  private startLoop() {
    let lastTime = performance.now();

    const afterDraw = (cb: () => void) => {
      const gl = this.renderer.getContext() as WebGL2RenderingContext;
      const sync = gl.fenceSync ? gl.fenceSync(gl.SYNC_GPU_COMMANDS_COMPLETE, 0) : null;
      if (gl.flush) gl.flush();
      if (!sync) {
        this.frameId = window.setTimeout(cb, 80);
        return;
      }
      const poll = () => {
        if (this.isDisposed) return;
        const state = gl.getSyncParameter(sync, gl.SYNC_STATUS);
        if (state === gl.UNSIGNALED) {
          this.frameId = window.setTimeout(poll, 5);
        } else {
          gl.deleteSync(sync);
          this.frameId = window.setTimeout(cb, 80);
        }
      };
      this.frameId = window.setTimeout(poll, 5);
    };

    const tick = () => {
      if (this.isDisposed) return;
      const now = performance.now();
      const dt = Math.min(0.05, (now - lastTime) / 1000);
      lastTime = now;

      if (!this.isPaused) {
        this.updateSimulation(dt, now / 1000);
      }
      this.updateCamera(dt);
      this.renderer.render(this.scene, this.camera);

      this.hudThrottleCounter++;
      if (this.hudThrottleCounter % 3 === 0) {
        this.emitHUDState();
      }

      if (this.isSoftwareGl) {
        afterDraw(tick);
      } else {
        this.frameId = requestAnimationFrame(tick);
      }
    };

    this.frameId = requestAnimationFrame(tick);
  }

  private updateSimulation(dt: number, elapsedSec: number) {
    if (this.bannerTimer > 0) {
      this.bannerTimer -= dt;
      if (this.bannerTimer <= 0) {
        this.bannerAlert = null;
      }
    }

    if (this.phase === 'FULL_TIME') return;

    if (this.phase === 'GOAL_CELEBRATION') {
      this.celebrationTimer -= dt;
      if (this.celebrationTimer <= 0) {
        this.skipCelebration();
      }
      return;
    }

    // Advance Match Clock or Training Timer
    if (this.matchSettings.mode === 'training') {
      this.trainingTimeRemaining = Math.max(0, this.trainingTimeRemaining - dt);
      if (this.trainingTimeRemaining <= 0) {
        this.phase = 'FULL_TIME';
        soundEngine.playWhistle('fulltime');
        this.onMatchComplete(this.stats, true, this.trainingScore);
        return;
      }
    } else {
      this.elapsedRealSeconds += dt;
      const halfSecs = this.matchSettings.halfDurationMinutes * 60;
      if (this.phase === 'FIRST_HALF' && this.elapsedRealSeconds >= halfSecs) {
        this.phase = 'SECOND_HALF';
        this.attackDirectionHome = -1;
        soundEngine.playWhistle('double');
        this.showBanner('SECOND HALF KICKOFF', 2.5);
        this.lastCommentary = 'Halftime whistle blows! Teams switch ends for the second half.';
        this.resetPositionsForKickoff('away');
        return;
      } else if (this.phase === 'SECOND_HALF' && this.elapsedRealSeconds >= halfSecs * 2) {
        this.phase = 'FULL_TIME';
        soundEngine.playWhistle('fulltime');
        this.showBanner('FULL TIME', 4.0);
        const challengePassed = this.evaluateChallengeSuccess();
        this.onMatchComplete(this.stats, challengePassed, this.trainingScore);
        return;
      }
    }

    // Charge shot power bar if holding shoot
    if (this.isChargingShot) {
      this.shotCharge = Math.min(1.0, this.shotCharge + dt * 1.45);
    }

    // Track possession ratio
    if (this.ballOwner) {
      if (this.ballOwner.team === 'home') this.stats.homePossessionFrames++;
      else this.stats.awayPossessionFrames++;
    }

    // Update Players & AI
    this.updatePlayersAndAI(dt, elapsedSec);

    // Update Ball Physics & Boundary / Goal Detection
    this.updateBallPhysics(dt);
  }

  private updatePlayersAndAI(dt: number, elapsedSec: number) {
    const isManagerMode = this.matchSettings.mode === 'manager';
    const ctrl = this.getControlledPlayer();

    // Auto-switch controlled home defender when away team has ball and auto-switch is enabled
    if (
      !isManagerMode &&
      this.userSettings.autoSwitchDefender &&
      (!this.ballOwner || this.ballOwner.team === 'away')
    ) {
      let closestHome: ActivePlayerEntity | null = null;
      let minDistSq = Infinity;
      this.players.forEach((p) => {
        if (p.team === 'home' && p.role !== 'GK' && !p.redCarded) {
          const dSq = p.position.distanceToSquared(this.ballPosition);
          if (dSq < minDistSq) {
            minDistSq = dSq;
            closestHome = p;
          }
        }
      });
      if (
        closestHome &&
        ctrl &&
        (closestHome as ActivePlayerEntity).id !== ctrl.id &&
        minDistSq + 14 < ctrl.position.distanceToSquared(this.ballPosition)
      ) {
        this.controlledPlayerId = (closestHome as ActivePlayerEntity).id;
      }
    }

    // Difficulty AI speed & reaction scaling (fair, realistic bounds)
    const diffMult =
      this.matchSettings.difficulty === 'Amateur'
        ? 0.84
        : this.matchSettings.difficulty === 'Semi-Pro'
        ? 0.92
        : this.matchSettings.difficulty === 'Professional'
        ? 1.0
        : 1.06;

    // Determine closest chaser per team so teammates maintain shape instead of swarming
    const closestChaserHome = this.findClosestOutfieldPlayer('home');
    const closestChaserAway = this.findClosestOutfieldPlayer('away');

    this.players.forEach((p) => {
      if (p.redCarded) return;

      if (p.actionTimer > 0) {
        p.actionTimer = Math.max(0, p.actionTimer - dt);
        if (p.actionTimer === 0) p.actionType = 'idle';
      }
      if (p.cooldownTimer > 0) {
        p.cooldownTimer = Math.max(0, p.cooldownTimer - dt);
      }

      const isUserControlled = !isManagerMode && p.team === 'home' && p.id === this.controlledPlayerId;
      const baseMaxSpeed = 6.2 + (p.data.attributes.pace / 100) * 3.1;
      const staminaFactor = 0.72 + (p.stamina / 100) * 0.28;

      if (isUserControlled) {
        const moveMag = Math.min(1, Math.hypot(this.input.moveX, this.input.moveZ));
        const isSprinting = this.input.sprint && moveMag > 0.15 && p.stamina > 8;
        const speedLimit = baseMaxSpeed * staminaFactor * (isSprinting ? 1.26 : 1.0);

        if (moveMag > this.userSettings.joystickDeadzone) {
          const targetVx = this.input.moveX * speedLimit;
          const targetVz = this.input.moveZ * speedLimit;
          p.velocity.x = THREE.MathUtils.damp(p.velocity.x, targetVx, 11, dt);
          p.velocity.z = THREE.MathUtils.damp(p.velocity.z, targetVz, 11, dt);
          p.facingAngle = Math.atan2(p.velocity.x, p.velocity.z);

          if (isSprinting) {
            p.stamina = Math.max(0, p.stamina - dt * 3.6);
          } else {
            p.stamina = Math.min(100, p.stamina + dt * 0.8);
          }
        } else {
          p.velocity.x = THREE.MathUtils.damp(p.velocity.x, 0, 12, dt);
          p.velocity.z = THREE.MathUtils.damp(p.velocity.z, 0, 12, dt);
          p.stamina = Math.min(100, p.stamina + dt * 1.8);
        }
      } else {
        // Intelligent Role-Based AI for Teammates and Opponents
        this.computeAIPlayerBehavior(
          p,
          dt,
          baseMaxSpeed * staminaFactor * (p.team === 'away' ? diffMult : 1.0),
          closestChaserHome?.id === p.id || closestChaserAway?.id === p.id
        );
      }

      // Apply velocity & clamp inside stadium apron
      const prevX = p.position.x;
      const prevZ = p.position.z;
      p.position.x = THREE.MathUtils.clamp(
        p.position.x + p.velocity.x * dt,
        -this.dims.halfLength - 2.5,
        this.dims.halfLength + 2.5
      );
      p.position.z = THREE.MathUtils.clamp(
        p.position.z + p.velocity.z * dt,
        -this.dims.halfWidth - 2.5,
        this.dims.halfWidth + 2.5
      );

      if (p.team === 'home') {
        this.stats.distanceCoveredMeters += Math.hypot(p.position.x - prevX, p.position.z - prevZ);
      }

      // Update 3D Mesh Transform & Skeletal Limb Animation
      p.meshParts.root.position.copy(p.position);
      p.meshParts.root.rotation.y = p.facingAngle;

      const currentSpeed = Math.hypot(p.velocity.x, p.velocity.z);
      animatePlayerMesh(
        p.meshParts,
        currentSpeed,
        currentSpeed > baseMaxSpeed * 1.05,
        p.actionType,
        p.actionTimer,
        elapsedSec + p.slotIndex * 0.7,
        p.stamina / 100,
        isUserControlled
      );
    });
  }

  private findClosestOutfieldPlayer(team: 'home' | 'away'): ActivePlayerEntity | null {
    let best: ActivePlayerEntity | null = null;
    let bestDistSq = Infinity;
    this.players.forEach((p) => {
      if (p.team === team && p.role !== 'GK' && !p.redCarded) {
        const dSq = p.position.distanceToSquared(this.ballPosition);
        if (dSq < bestDistSq) {
          bestDistSq = dSq;
          best = p;
        }
      }
    });
    return best;
  }

  private computeAIPlayerBehavior(
    p: ActivePlayerEntity,
    dt: number,
    maxSpeed: number,
    isPrimaryChaser: boolean
  ) {
    const teamConfig = p.team === 'home' ? this.homeTeam.tactics : this.awayTeam.tactics;
    const attackDir = p.team === 'home' ? this.attackDirectionHome : -this.attackDirectionHome;
    const ownGoalX = -this.dims.halfLength * attackDir;
    const oppGoalX = this.dims.halfLength * attackDir;

    // 1. Goalkeeper Specialized AI
    if (p.role === 'GK') {
      const gkHomeX = ownGoalX + 1.8 * attackDir;
      const targetZ = THREE.MathUtils.clamp(
        this.ballPosition.z * 0.42,
        -this.dims.goalWidth * 0.44,
        this.dims.goalWidth * 0.44
      );
      const ballDistToGoal = Math.abs(this.ballPosition.x - ownGoalX);

      // Dive for fast incoming shots near the goal
      if (
        !this.ballOwner &&
        ballDistToGoal < 12 &&
        Math.abs(this.ballVelocity.x) > 10 &&
        Math.sign(this.ballVelocity.x) === -attackDir &&
        p.cooldownTimer <= 0
      ) {
        const predictedZ =
          this.ballPosition.z +
          this.ballVelocity.z * (ballDistToGoal / Math.max(5, Math.abs(this.ballVelocity.x)));
        if (Math.abs(predictedZ) < this.dims.goalWidth * 0.75) {
          p.actionType = predictedZ < p.position.z ? 'dive_left' : 'dive_right';
          p.actionTimer = 0.55;
          p.cooldownTimer = 0.9;
          p.velocity.z = THREE.MathUtils.clamp((predictedZ - p.position.z) * 7, -11, 11);
        }
      }

      // If GK holds ball, distribute after brief pause
      if (this.ballOwner === p && p.cooldownTimer <= 0) {
        this.executeTeamPass(p, false, attackDir, (Math.random() - 0.5) * 0.6);
        return;
      }

      // Rush out if loose ball is inside 6-yard box
      const rushX =
        !this.ballOwner && ballDistToGoal < 7.5 && Math.abs(this.ballPosition.z) < 8
          ? this.ballPosition.x
          : gkHomeX;
      const rushZ =
        !this.ballOwner && ballDistToGoal < 7.5 && Math.abs(this.ballPosition.z) < 8
          ? this.ballPosition.z
          : targetZ;

      _vecA.set(rushX - p.position.x, 0, rushZ - p.position.z);
      const dist = _vecA.length();
      if (dist > 0.25) {
        _vecA.normalize().multiplyScalar(Math.min(maxSpeed, dist * 5));
        p.velocity.lerp(_vecA, dt * 8);
      } else {
        p.velocity.set(0, 0, 0);
      }
      p.facingAngle = Math.atan2(
        this.ballPosition.x - p.position.x,
        this.ballPosition.z - p.position.z
      );
      return;
    }

    // 2. If this AI player currently owns the ball (Away AI or Manager Mode Home AI)
    if (this.ballOwner === p) {
      const distToOppGoal = Math.hypot(oppGoalX - p.position.x, 0 - p.position.z);

      // Shoot if in range
      if (distToOppGoal < 21 && p.cooldownTimer <= 0) {
        const aimZ = (Math.random() - 0.5) * 0.85;
        this.executeTeamShot(p, 0.55 + Math.random() * 0.35, aimZ);
        return;
      }

      // Check if under heavy pressure from an opponent
      const nearestDefender = this.players.find(
        (opp) =>
          opp.team !== p.team &&
          !opp.redCarded &&
          opp.position.distanceToSquared(p.position) < 16
      );

      if (nearestDefender && p.cooldownTimer <= 0 && Math.random() < 0.14) {
        const isThrough = Math.random() < 0.35;
        this.executeTeamPass(p, isThrough, attackDir, (Math.random() - 0.5) * 0.7);
        return;
      }

      // Otherwise dribble toward opponent goal avoiding sidelines
      _vecA.set(oppGoalX - p.position.x, 0, -p.position.z * 0.25).normalize();
      p.velocity.x = THREE.MathUtils.damp(p.velocity.x, _vecA.x * maxSpeed * 1.05, 8, dt);
      p.velocity.z = THREE.MathUtils.damp(p.velocity.z, _vecA.z * maxSpeed * 1.05, 8, dt);
      p.facingAngle = Math.atan2(p.velocity.x, p.velocity.z);
      return;
    }

    // 3. Outfield AI Without Ball: Tactical Positioning vs Pressing
    const teamHasBall = this.ballOwner?.team === p.team;
    const mentalityShift =
      teamConfig.mentality === 'Attacking'
        ? 0.12
        : teamConfig.mentality === 'All-Out Attack'
        ? 0.22
        : teamConfig.mentality === 'Defensive'
        ? -0.12
        : 0;

    if (!teamHasBall && isPrimaryChaser) {
      // Primary presser closes down the ball carrier or loose ball
      _vecA.subVectors(this.ballPosition, p.position);
      const dist = _vecA.length();
      if (dist > 0.3) {
        _vecA.normalize().multiplyScalar(maxSpeed * 1.08);
        p.velocity.x = THREE.MathUtils.damp(p.velocity.x, _vecA.x, 9, dt);
        p.velocity.z = THREE.MathUtils.damp(p.velocity.z, _vecA.z, 9, dt);
        p.facingAngle = Math.atan2(p.velocity.x, p.velocity.z);
      }

      // Attempt AI standing tackle if close to opponent ball carrier
      if (dist < 1.85 && this.ballOwner && this.ballOwner.team !== p.team && p.cooldownTimer <= 0) {
        p.actionType = 'tackle';
        p.actionTimer = 0.25;
        p.cooldownTimer = 0.65;
        if (Math.random() < 0.68) {
          this.ballOwner = p;
          this.lastTouchTeam = p.team;
          p.cooldownTimer = 0.35;
          if (p.team === 'home') this.stats.homeTackles++;
          else this.stats.awayTackles++;
          soundEngine.playKick(0.45);
        }
      }
      return;
    }

    // Calculate Dynamic Tactical Anchor Position
    const ballProgressNorm = (this.ballPosition.x * attackDir) / this.dims.halfLength; // -1 to +1
    const lineHeightShift = ((teamConfig.defensiveLineHeight - 50) / 100) * 0.18;
    const widthScale = 0.75 + (teamConfig.width / 100) * 0.4;

    let targetNormX =
      p.baseNormX +
      ballProgressNorm * 0.38 +
      mentalityShift +
      lineHeightShift +
      (teamHasBall ? 0.18 : -0.06);

    // Attacking runs for wingers/strikers when team is in possession
    if (teamHasBall && ['ST', 'LW', 'RW', 'CAM'].includes(p.role)) {
      targetNormX += 0.16;
    }

    targetNormX = THREE.MathUtils.clamp(targetNormX, -0.86, 0.84);
    const targetNormZ = THREE.MathUtils.clamp(
      p.baseNormZ * widthScale + (this.ballPosition.z / this.dims.halfWidth) * 0.18 * attackDir,
      -0.88,
      0.88
    );

    const anchorX = targetNormX * this.dims.halfLength * attackDir;
    const anchorZ = targetNormZ * this.dims.halfWidth * attackDir;

    _vecA.set(anchorX - p.position.x, 0, anchorZ - p.position.z);
    const distToAnchor = _vecA.length();

    if (distToAnchor > 0.8) {
      const moveSpd = Math.min(maxSpeed * 0.92, distToAnchor * 2.4);
      _vecA.normalize().multiplyScalar(moveSpd);
      p.velocity.x = THREE.MathUtils.damp(p.velocity.x, _vecA.x, 7, dt);
      p.velocity.z = THREE.MathUtils.damp(p.velocity.z, _vecA.z, 7, dt);
      p.facingAngle = Math.atan2(p.velocity.x, p.velocity.z);
    } else {
      p.velocity.x = THREE.MathUtils.damp(p.velocity.x, 0, 8, dt);
      p.velocity.z = THREE.MathUtils.damp(p.velocity.z, 0, 8, dt);
      p.facingAngle = Math.atan2(
        this.ballPosition.x - p.position.x,
        this.ballPosition.z - p.position.z
      );
    }
  }

  private updateBallPhysics(dt: number) {
    if (this.ballOwner) {
      // Dribble attachment slightly ahead of ball owner's feet
      const dribbleDist = 0.72;
      const targetX =
        this.ballOwner.position.x + Math.sin(this.ballOwner.facingAngle) * dribbleDist;
      const targetZ =
        this.ballOwner.position.z + Math.cos(this.ballOwner.facingAngle) * dribbleDist;

      this.ballPosition.x = THREE.MathUtils.lerp(this.ballPosition.x, targetX, 0.45);
      this.ballPosition.z = THREE.MathUtils.lerp(this.ballPosition.z, targetZ, 0.45);
      this.ballPosition.y = 0.24;
      this.ballVelocity.copy(this.ballOwner.velocity);

      // Rotate ball mesh while dribbling
      const spd = this.ballOwner.velocity.length();
      this.ballMesh.rotation.x += spd * dt * 2.6;
      this.ballMesh.rotation.z -= spd * dt * 1.8;

      this.checkTrainingTargetHit();
    } else {
      // Free-flight 3D Ball Physics (Gravity, Magnus Spin, Bounce, Turf Friction)
      this.ballVelocity.y -= 19.6 * dt; // Gravity

      // Magnus lateral curve
      if (Math.abs(this.ballSpin) > 0.05) {
        this.ballVelocity.z += this.ballSpin * dt * 2.5;
        this.ballSpin *= Math.pow(0.4, dt);
      }

      this.ballPosition.addScaledVector(this.ballVelocity, dt);

      // Ground bounce & rolling friction
      if (this.ballPosition.y <= 0.24) {
        this.ballPosition.y = 0.24;
        if (this.ballVelocity.y < -2.0) {
          this.ballVelocity.y = -this.ballVelocity.y * 0.54;
        } else {
          this.ballVelocity.y = 0;
        }
        // Grass friction deceleration
        const friction = Math.pow(0.26, dt);
        this.ballVelocity.x *= friction;
        this.ballVelocity.z *= friction;
      } else {
        // Air drag
        const drag = Math.pow(0.82, dt);
        this.ballVelocity.x *= drag;
        this.ballVelocity.z *= drag;
      }

      // Visual ball rotation
      this.ballMesh.rotation.z -= this.ballVelocity.x * dt * 2.5;
      this.ballMesh.rotation.x += this.ballVelocity.z * dt * 2.5;

      // Check player interception / possession pickup
      this.checkBallPlayerContacts();
      this.checkTrainingTargetHit();
    }

    this.ballMesh.position.copy(this.ballPosition);
    this.ballShadow.position.set(this.ballPosition.x, 0.025, this.ballPosition.z);
    const shadowScale = Math.max(0.4, 1 - (this.ballPosition.y - 0.24) * 0.08);
    this.ballShadow.scale.setScalar(shadowScale);

    this.ballTrailRing.position.set(this.ballPosition.x, 0.028, this.ballPosition.z);

    // Check Goal Line, Post Collisions, and Touchline Restarts
    this.checkPitchBoundariesAndGoals();
  }

  private checkBallPlayerContacts() {
    for (let i = 0; i < this.players.length; i++) {
      const p = this.players[i];
      if (p.redCarded || p.cooldownTimer > 0.15) continue;

      const horizontalDist = Math.hypot(
        p.position.x - this.ballPosition.x,
        p.position.z - this.ballPosition.z
      );
      const maxReachHeight = p.role === 'GK' ? 2.55 : 1.95;
      const reachRadius = p.role === 'GK' ? 1.35 : 0.92;

      if (horizontalDist <= reachRadius && this.ballPosition.y <= maxReachHeight) {
        // Check offside if receiving pass from teammate
        if (
          this.lastPasser &&
          this.lastPasser.team === p.team &&
          this.potentialOffsideReceiverIds.has(p.id)
        ) {
          this.potentialOffsideReceiverIds.clear();
          soundEngine.playWhistle('single');
          if (p.team === 'home') this.stats.homeOffsides++;
          else this.stats.awayOffsides++;
          this.showBanner('OFFSIDE CALLED', 2.2);
          this.lastCommentary = `Flag goes up! ${p.data.name} was caught in an offside position.`;

          // Award indirect free kick to nearest defender
          const opp = this.players.find((o) => o.team !== p.team && !o.redCarded);
          if (opp) {
            this.ballPosition.set(p.position.x, 0.24, p.position.z);
            this.ballVelocity.set(0, 0, 0);
            opp.position.set(p.position.x, 0, p.position.z);
            this.ballOwner = opp;
            this.lastTouchTeam = opp.team;
          }
          return;
        }

        // Check if pass completed
        if (this.lastPasser && this.lastPasser.team === p.team && this.lastPasser.id !== p.id) {
          if (p.team === 'home') {
            this.stats.homePassesCompleted++;
            if (this.matchSettings.mode === 'training') {
              this.trainingScore += 50;
            }
          } else {
            this.stats.awayPassesCompleted++;
          }
        }

        // Goalkeeper parry on scorching shots
        const ballSpeed = this.ballVelocity.length();
        if (p.role === 'GK' && ballSpeed > 24 && Math.random() < 0.4) {
          this.ballVelocity.x = -this.ballVelocity.x * 0.45;
          this.ballVelocity.z += (Math.random() - 0.5) * 10;
          this.ballVelocity.y = 2.5;
          p.cooldownTimer = 0.35;
          this.lastTouchTeam = p.team;
          soundEngine.playKick(0.8);
          this.lastCommentary = `Spectacular reflex parry by ${p.data.name}!`;
          return;
        }

        // Control ball
        this.ballOwner = p;
        this.lastTouchTeam = p.team;
        this.lastPasser = null;
        this.potentialOffsideReceiverIds.clear();
        this.ballVelocity.copy(p.velocity);
        if (p.team === 'home' && p.role !== 'GK') {
          this.controlledPlayerId = p.id;
        }
        soundEngine.playKick(0.25);
        return;
      }
    }
  }

  private checkTrainingTargetHit() {
    if (this.matchSettings.mode !== 'training' || !this.trainingTargetGroup) return;
    const dist = Math.hypot(
      this.ballPosition.x - this.trainingTargetPos.x,
      this.ballPosition.z - this.trainingTargetPos.z
    );
    if (dist < 2.2) {
      this.trainingScore += 100;
      soundEngine.playGoalCheer();
      this.showBanner('+100 DRILL TARGET HIT!', 1.4);
      this.relocateTrainingTarget();
    }
  }

  private checkPitchBoundariesAndGoals() {
    const hl = this.dims.halfLength;
    const hw = this.dims.halfWidth;
    const gwHalf = this.dims.goalWidth / 2;

    // 1. Check Goalpost & Crossbar impacts
    if (Math.abs(Math.abs(this.ballPosition.x) - hl) < 0.35) {
      // Crossbar impact
      if (
        Math.abs(this.ballPosition.z) <= gwHalf + 0.15 &&
        Math.abs(this.ballPosition.y - this.dims.goalHeight) < 0.28
      ) {
        this.ballVelocity.x = -this.ballVelocity.x * 0.65;
        this.ballVelocity.y = Math.abs(this.ballVelocity.y) * 0.6 + 2;
        soundEngine.playPostHit();
        this.lastCommentary = 'Off the crossbar! Inches away from a goal!';
        return;
      }
      // Left/Right Vertical Post impact
      if (
        Math.abs(Math.abs(this.ballPosition.z) - gwHalf) < 0.28 &&
        this.ballPosition.y <= this.dims.goalHeight
      ) {
        this.ballVelocity.x = -this.ballVelocity.x * 0.7;
        this.ballVelocity.z = -this.ballVelocity.z * 0.7;
        soundEngine.playPostHit();
        this.lastCommentary = 'Struck the upright! The woodwork denies the shot!';
        return;
      }
    }

    // 2. Check Valid Goal Scored (ball crosses goal line between posts and under crossbar)
    if (
      Math.abs(this.ballPosition.x) > hl + 0.18 &&
      Math.abs(this.ballPosition.z) < gwHalf &&
      this.ballPosition.y < this.dims.goalHeight
    ) {
      const scoredOnRightGoal = this.ballPosition.x > 0;
      // If Home attacks +1 (Right), scoring on right goal is a Home Goal
      const scoringTeam: 'home' | 'away' =
        (scoredOnRightGoal && this.attackDirectionHome === 1) ||
        (!scoredOnRightGoal && this.attackDirectionHome === -1)
          ? 'home'
          : 'away';

      this.registerGoal(scoringTeam);
      return;
    }

    // 3. Street Football wall bounce vs Standard Association Out-of-Bounds Restarts
    if (this.dims.isStreet) {
      if (Math.abs(this.ballPosition.z) > hw) {
        this.ballPosition.z = Math.sign(this.ballPosition.z) * hw;
        this.ballVelocity.z = -this.ballVelocity.z * 0.75;
        this.ballOwner = null;
        soundEngine.playPostHit();
      }
      if (Math.abs(this.ballPosition.x) > hl) {
        this.ballPosition.x = Math.sign(this.ballPosition.x) * hl;
        this.ballVelocity.x = -this.ballVelocity.x * 0.75;
        this.ballOwner = null;
        soundEngine.playPostHit();
      }
      return;
    }

    // Standard Throw-In (Sidelines Z)
    if (Math.abs(this.ballPosition.z) > hw + 0.25) {
      const restartTeam: 'home' | 'away' = this.lastTouchTeam === 'home' ? 'away' : 'home';
      const clampedX = THREE.MathUtils.clamp(this.ballPosition.x, -hl + 2, hl - 2);
      const clampedZ = Math.sign(this.ballPosition.z) * (hw - 0.5);

      soundEngine.playWhistle('single');
      this.showBanner(`THROW-IN — ${restartTeam === 'home' ? this.homeTeam.shortName : this.awayTeam.shortName}`, 1.6);
      this.assignSetPieceToNearest(restartTeam, clampedX, clampedZ, false);
      return;
    }

    // Goal Kick or Corner Kick (Endlines X)
    if (Math.abs(this.ballPosition.x) > hl + 0.25) {
      const endSign = Math.sign(this.ballPosition.x);
      // Determine which team defends this endline
      const defendingTeam: 'home' | 'away' =
        (endSign === -1 && this.attackDirectionHome === 1) ||
        (endSign === 1 && this.attackDirectionHome === -1)
          ? 'home'
          : 'away';

      if (this.lastTouchTeam === defendingTeam) {
        // Corner Kick for attacking team!
        const attackingTeam: 'home' | 'away' = defendingTeam === 'home' ? 'away' : 'home';
        if (attackingTeam === 'home') this.stats.homeCorners++;
        else this.stats.awayCorners++;

        const cornerX = endSign * (hl - 0.6);
        const cornerZ = (this.ballPosition.z >= 0 ? 1 : -1) * (hw - 0.6);
        soundEngine.playWhistle('single');
        this.showBanner(
          `CORNER KICK — ${attackingTeam === 'home' ? this.homeTeam.shortName : this.awayTeam.shortName}`,
          1.8
        );
        this.lastCommentary = `Corner kick awarded to ${
          attackingTeam === 'home' ? this.homeTeam.name : this.awayTeam.name
        }.`;
        this.assignSetPieceToNearest(attackingTeam, cornerX, cornerZ, false);
      } else {
        // Goal Kick for defending GK!
        const gkX = endSign * (hl - 5.2);
        soundEngine.playWhistle('single');
        this.showBanner(
          `GOAL KICK — ${defendingTeam === 'home' ? this.homeTeam.shortName : this.awayTeam.shortName}`,
          1.8
        );
        this.assignSetPieceToNearest(defendingTeam, gkX, 0, true);
      }
    }
  }

  private assignSetPieceToNearest(
    team: 'home' | 'away',
    x: number,
    z: number,
    preferGK: boolean
  ) {
    this.ballPosition.set(x, 0.24, z);
    this.ballVelocity.set(0, 0, 0);
    this.ballSpin = 0;

    let taker = this.players.find((p) => p.team === team && p.role === 'GK' && preferGK);
    if (!taker) {
      const candidates = this.players.filter(
        (p) => p.team === team && p.role !== 'GK' && !p.redCarded
      );
      candidates.sort(
        (a, b) =>
          Math.hypot(a.position.x - x, a.position.z - z) -
          Math.hypot(b.position.x - x, b.position.z - z)
      );
      taker = candidates[0];
    }

    if (taker) {
      taker.position.set(x, 0, z);
      taker.velocity.set(0, 0, 0);
      taker.cooldownTimer = 0.4;
      this.ballOwner = taker;
      this.lastTouchTeam = team;
      if (team === 'home' && taker.role !== 'GK') {
        this.controlledPlayerId = taker.id;
      }
    }
  }

  private registerGoal(scoringTeam: 'home' | 'away') {
    soundEngine.playWhistle('single');
    soundEngine.playGoalCheer();

    if (this.matchSettings.mode === 'training') {
      this.trainingScore += 150;
      this.showBanner('GOAL! +150 TRAINING PTS', 1.6);
      this.resetPositionsForKickoff('home');
      this.relocateTrainingTarget();
      return;
    }

    const scorerCandidates = this.players.filter((p) => p.team === scoringTeam && !p.redCarded);
    scorerCandidates.sort(
      (a, b) =>
        a.position.distanceToSquared(this.ballPosition) -
        b.position.distanceToSquared(this.ballPosition)
    );
    const scorer = scorerCandidates[0];
    const matchMinute = Math.min(90, Math.max(1, this.getMatchMinute()));

    // Check if shot was from outside the box
    const goalDist = Math.abs(
      (scoringTeam === 'home' ? this.dims.halfLength * this.attackDirectionHome : -this.dims.halfLength * this.attackDirectionHome) -
        (scorer ? scorer.position.x : 0)
    );
    const isOutsideBox = goalDist > this.dims.penaltyBoxLength + 0.5;

    if (scoringTeam === 'home') {
      this.stats.homeGoals++;
      if (isOutsideBox) this.stats.outsideBoxGoals++;
    } else {
      this.stats.awayGoals++;
    }

    this.stats.goalScorers.push({
      team: scoringTeam,
      playerName: scorer ? scorer.data.name : 'Unknown Scorer',
      minute: matchMinute,
      outsideBox: isOutsideBox,
    });

    this.phase = 'GOAL_CELEBRATION';
    this.celebrationTimer = 3.2;
    this.kickoffTeam = scoringTeam === 'home' ? 'away' : 'home';
    this.ballOwner = null;
    this.ballVelocity.set(0, 0, 0);

    const teamLabel = scoringTeam === 'home' ? this.homeTeam.name : this.awayTeam.name;
    this.showBanner(`GOAL! ${teamLabel.toUpperCase()} (${matchMinute}')`, 3.2);
    this.lastCommentary = `GOAL! ${
      scorer ? scorer.data.name : teamLabel
    } finds the back of the net in the ${matchMinute}th minute!`;
  }

  private getMatchMinute(): number {
    const totalRealDuration = this.matchSettings.halfDurationMinutes * 2 * 60;
    return Math.min(90, Math.floor((this.elapsedRealSeconds / totalRealDuration) * 90));
  }

  private evaluateChallengeSuccess(): boolean {
    if (this.matchSettings.mode !== 'challenge' || !this.matchSettings.challengeId) return true;
    const chal = CHALLENGE_SCENARIOS.find((c) => c.id === this.matchSettings.challengeId);
    if (!chal) return true;

    switch (chal.winConditionType) {
      case 'SCORE_GOALS':
        return this.stats.homeGoals >= chal.targetValue;
      case 'COMEBACK_WIN':
      case 'DEFEND_LEAD':
      case 'LIMITED_SUBS_WIN':
        return this.stats.homeGoals > this.stats.awayGoals;
      case 'OUTSIDE_BOX_GOAL':
        return (
          this.stats.outsideBoxGoals >= chal.targetValue &&
          this.stats.homeGoals > this.stats.awayGoals
        );
      case 'PASS_SEQUENCE':
        return (
          this.stats.homePassesCompleted >= chal.targetValue &&
          this.stats.homeGoals > this.stats.awayGoals
        );
    }
  }

  private updateCamera(dt: number) {
    const focusX = THREE.MathUtils.clamp(this.ballPosition.x * 0.72, -32, 32);
    const focusZ = THREE.MathUtils.clamp(this.ballPosition.z * 0.55, -18, 18);

    if (this.cameraPreset === 'Broadcast') {
      _camTargetPos.set(focusX, 30, focusZ + 42);
      _camLookAt.set(focusX, 0.8, focusZ * 0.65);
    } else if (this.cameraPreset === 'Tactical') {
      _camTargetPos.set(focusX * 0.5, 54, focusZ * 0.3 + 24);
      _camLookAt.set(focusX * 0.5, 0, focusZ * 0.3);
    } else if (this.cameraPreset === 'Follow') {
      const ctrl = this.getControlledPlayer();
      const px = ctrl ? ctrl.position.x : this.ballPosition.x;
      const pz = ctrl ? ctrl.position.z : this.ballPosition.z;
      _camTargetPos.set(px - 14 * this.attackDirectionHome, 14, pz + 16);
      _camLookAt.set(this.ballPosition.x, 1.0, this.ballPosition.z);
    } else {
      // Action Close
      _camTargetPos.set(this.ballPosition.x * 0.85, 16, this.ballPosition.z * 0.8 + 23);
      _camLookAt.set(this.ballPosition.x, 0.9, this.ballPosition.z);
    }

    this.camera.position.lerp(_camTargetPos, 1 - Math.exp(-6.5 * dt));
    this.camera.lookAt(_camLookAt);
  }

  private emitHUDState() {
    const ctrl = this.getControlledPlayer();
    const totalFrames = this.stats.homePossessionFrames + this.stats.awayPossessionFrames;
    const homePossessionPct = Math.round((this.stats.homePossessionFrames / totalFrames) * 100);

    let challengeStatusText = '';
    if (this.matchSettings.mode === 'challenge' && this.matchSettings.challengeId) {
      const chal = CHALLENGE_SCENARIOS.find((c) => c.id === this.matchSettings.challengeId);
      if (chal) {
        if (chal.winConditionType === 'SCORE_GOALS') {
          challengeStatusText = `Goals: ${this.stats.homeGoals}/${chal.targetValue}`;
        } else if (chal.winConditionType === 'PASS_SEQUENCE') {
          challengeStatusText = `Passes: ${this.stats.homePassesCompleted}/${chal.targetValue} & Win`;
        } else if (chal.winConditionType === 'OUTSIDE_BOX_GOAL') {
          challengeStatusText = `Outside Box Goals: ${this.stats.outsideBoxGoals}/${chal.targetValue} & Win`;
        } else {
          challengeStatusText = chal.subtitle;
        }
      }
    }

    const radarDots: RadarPlayerDot[] = this.players
      .filter((p) => !p.redCarded)
      .map((p) => ({
        id: p.id,
        team: p.team,
        x: p.position.x / this.dims.halfLength,
        z: p.position.z / this.dims.halfWidth,
        isControlled: p.id === this.controlledPlayerId,
        hasBall: this.ballOwner?.id === p.id,
      }));

    this.onHUDUpdate({
      phase: this.phase,
      setPieceType: this.setPieceType,
      matchMinute: this.getMatchMinute(),
      stoppageMinutes: this.stoppageMinutes,
      homeScore: this.stats.homeGoals,
      awayScore: this.stats.awayGoals,
      homePossessionPct,
      controlledPlayerName: ctrl ? ctrl.data.name : this.homeTeam.shortName,
      controlledPlayerNumber: ctrl ? ctrl.data.shirtNumber : 9,
      controlledPlayerStamina: ctrl ? Math.round(ctrl.stamina) : 100,
      userHasPossession: this.ballOwner?.team === 'home',
      ballOwnerTeam: this.ballOwner ? this.ballOwner.team : null,
      lastCommentary: this.lastCommentary,
      bannerAlert: this.bannerAlert,
      shotPowerCharge: this.shotCharge,
      trainingScore: this.trainingScore,
      trainingTargetScore:
        TRAINING_DRILLS.find((d) => d.id === this.matchSettings.trainingDrillId)?.targetScore || 300,
      trainingTimeRemaining: Math.ceil(this.trainingTimeRemaining),
      challengeStatusText,
      challengeCompleted:
        this.phase === 'FULL_TIME' ? this.evaluateChallengeSuccess() : null,
      radarDots,
      ballRadar: {
        x: this.ballPosition.x / this.dims.halfLength,
        z: this.ballPosition.z / this.dims.halfWidth,
      },
      stats: { ...this.stats },
    });
  }

  private handleResize = () => {
    if (!this.container || this.isDisposed) return;
    const w = this.container.clientWidth || window.innerWidth;
    const h = this.container.clientHeight || window.innerHeight;
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(w, h);
  };

  public dispose() {
    this.isDisposed = true;
    window.removeEventListener('resize', this.handleResize);
    cancelAnimationFrame(this.frameId);
    clearTimeout(this.frameId);
    soundEngine.stopCrowdAmbience();

    this.scene.traverse((obj) => {
      if ((obj as THREE.Mesh).isMesh) {
        const mesh = obj as THREE.Mesh;
        mesh.geometry?.dispose();
        if (Array.isArray(mesh.material)) {
          mesh.material.forEach((m) => m.dispose());
        } else {
          mesh.material?.dispose();
        }
      }
    });

    this.renderer.dispose();
    if (this.renderer.domElement && this.renderer.domElement.parentNode) {
      this.renderer.domElement.parentNode.removeChild(this.renderer.domElement);
    }
  }
}
