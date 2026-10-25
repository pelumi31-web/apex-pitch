import {
  ChallengeScenario,
  CosmeticItem,
  DailyObjective,
  FormationName,
  HairStyle,
  PlayerAttributes,
  PlayerData,
  PositionCode,
  TeamData,
  TrainingDrill,
} from '../types/game';

/**
 * Transparent, position-weighted formula to calculate a player's Overall (OVR) rating
 * from their individual technical, physical, and mental attributes.
 */
export function calculateOverallRating(
  position: PositionCode,
  attrs: PlayerAttributes
): number {
  let weighted = 0;
  switch (position) {
    case 'GK':
      weighted =
        attrs.gkReflexes * 0.38 +
        attrs.gkPositioning * 0.32 +
        attrs.gkHandling * 0.2 +
        attrs.jumping * 0.05 +
        attrs.passing * 0.05;
      break;
    case 'CB':
      weighted =
        attrs.tackling * 0.3 +
        attrs.marking * 0.28 +
        attrs.strength * 0.16 +
        attrs.jumping * 0.1 +
        attrs.pace * 0.08 +
        attrs.passing * 0.08;
      break;
    case 'LB':
    case 'RB':
      weighted =
        attrs.pace * 0.22 +
        attrs.acceleration * 0.16 +
        attrs.tackling * 0.22 +
        attrs.marking * 0.16 +
        attrs.stamina * 0.12 +
        attrs.passing * 0.12;
      break;
    case 'CDM':
      weighted =
        attrs.tackling * 0.24 +
        attrs.marking * 0.2 +
        attrs.passing * 0.2 +
        attrs.vision * 0.12 +
        attrs.strength * 0.12 +
        attrs.stamina * 0.12;
      break;
    case 'CM':
      weighted =
        attrs.passing * 0.26 +
        attrs.vision * 0.2 +
        attrs.ballControl * 0.18 +
        attrs.dribbling * 0.12 +
        attrs.stamina * 0.12 +
        attrs.tackling * 0.12;
      break;
    case 'CAM':
      weighted =
        attrs.passing * 0.24 +
        attrs.vision * 0.24 +
        attrs.dribbling * 0.2 +
        attrs.ballControl * 0.16 +
        attrs.shooting * 0.1 +
        attrs.agility * 0.06;
      break;
    case 'LW':
    case 'RW':
      weighted =
        attrs.pace * 0.24 +
        attrs.acceleration * 0.2 +
        attrs.dribbling * 0.24 +
        attrs.ballControl * 0.14 +
        attrs.shooting * 0.1 +
        attrs.passing * 0.08;
      break;
    case 'ST':
      weighted =
        attrs.finishing * 0.32 +
        attrs.shooting * 0.24 +
        attrs.pace * 0.14 +
        attrs.dribbling * 0.12 +
        attrs.strength * 0.1 +
        attrs.jumping * 0.08;
      break;
  }
  return Math.min(99, Math.max(50, Math.round(weighted)));
}

export interface FormationSlot {
  role: PositionCode;
  label: string;
  // Normalized pitch coordinates for Left-to-Right team (-1 to 0 on X, -0.85 to +0.85 on Z)
  normX: number;
  normZ: number;
}

export const FORMATIONS: Record<FormationName, FormationSlot[]> = {
  '4-3-3': [
    { role: 'GK', label: 'GK', normX: -0.92, normZ: 0 },
    { role: 'LB', label: 'LB', normX: -0.64, normZ: -0.68 },
    { role: 'CB', label: 'LCB', normX: -0.68, normZ: -0.24 },
    { role: 'CB', label: 'RCB', normX: -0.68, normZ: 0.24 },
    { role: 'RB', label: 'RB', normX: -0.64, normZ: 0.68 },
    { role: 'CDM', label: 'CDM', normX: -0.44, normZ: 0 },
    { role: 'CM', label: 'LCM', normX: -0.32, normZ: -0.36 },
    { role: 'CM', label: 'RCM', normX: -0.32, normZ: 0.36 },
    { role: 'LW', label: 'LW', normX: -0.14, normZ: -0.64 },
    { role: 'ST', label: 'ST', normX: -0.1, normZ: 0 },
    { role: 'RW', label: 'RW', normX: -0.14, normZ: 0.64 },
  ],
  '4-4-2': [
    { role: 'GK', label: 'GK', normX: -0.92, normZ: 0 },
    { role: 'LB', label: 'LB', normX: -0.65, normZ: -0.68 },
    { role: 'CB', label: 'LCB', normX: -0.68, normZ: -0.24 },
    { role: 'CB', label: 'RCB', normX: -0.68, normZ: 0.24 },
    { role: 'RB', label: 'RB', normX: -0.65, normZ: 0.68 },
    { role: 'LW', label: 'LM', normX: -0.36, normZ: -0.66 },
    { role: 'CM', label: 'LCM', normX: -0.4, normZ: -0.22 },
    { role: 'CM', label: 'RCM', normX: -0.4, normZ: 0.22 },
    { role: 'RW', label: 'RM', normX: -0.36, normZ: 0.66 },
    { role: 'ST', label: 'LST', normX: -0.12, normZ: -0.22 },
    { role: 'ST', label: 'RST', normX: -0.12, normZ: 0.22 },
  ],
  '4-2-3-1': [
    { role: 'GK', label: 'GK', normX: -0.92, normZ: 0 },
    { role: 'LB', label: 'LB', normX: -0.65, normZ: -0.68 },
    { role: 'CB', label: 'LCB', normX: -0.68, normZ: -0.24 },
    { role: 'CB', label: 'RCB', normX: -0.68, normZ: 0.24 },
    { role: 'RB', label: 'RB', normX: -0.65, normZ: 0.68 },
    { role: 'CDM', label: 'LCDM', normX: -0.46, normZ: -0.24 },
    { role: 'CDM', label: 'RCDM', normX: -0.46, normZ: 0.24 },
    { role: 'LW', label: 'LAM', normX: -0.24, normZ: -0.58 },
    { role: 'CAM', label: 'CAM', normX: -0.24, normZ: 0 },
    { role: 'RW', label: 'RAM', normX: -0.24, normZ: 0.58 },
    { role: 'ST', label: 'ST', normX: -0.09, normZ: 0 },
  ],
  '3-5-2': [
    { role: 'GK', label: 'GK', normX: -0.92, normZ: 0 },
    { role: 'CB', label: 'LCB', normX: -0.68, normZ: -0.42 },
    { role: 'CB', label: 'CCB', normX: -0.7, normZ: 0 },
    { role: 'CB', label: 'RCB', normX: -0.68, normZ: 0.42 },
    { role: 'LW', label: 'LWB', normX: -0.42, normZ: -0.72 },
    { role: 'CDM', label: 'CDM', normX: -0.48, normZ: 0 },
    { role: 'CM', label: 'LCM', normX: -0.32, normZ: -0.28 },
    { role: 'CM', label: 'RCM', normX: -0.32, normZ: 0.28 },
    { role: 'RW', label: 'RWB', normX: -0.42, normZ: 0.72 },
    { role: 'ST', label: 'LST', normX: -0.12, normZ: -0.24 },
    { role: 'ST', label: 'RST', normX: -0.12, normZ: 0.24 },
  ],
};

const SKIN_TONES = ['#f5d0b5', '#e2b28f', '#c68b59', '#8d5524', '#5c3818', '#f1c27d'];
const HAIR_COLORS = ['#18181b', '#27272a', '#451a03', '#78350f', '#d97706', '#a16207'];
const HAIR_STYLES: HairStyle[] = ['short', 'fade', 'afro', 'bun', 'buzz', 'curls'];
const BOOT_COLORS = ['#10b981', '#f59e0b', '#38bdf8', '#f43f5e', '#ffffff', '#a855f7'];
const NATIONALITIES = [
  'England',
  'Brazil',
  'France',
  'Spain',
  'Germany',
  'Argentina',
  'Nigeria',
  'Japan',
  'Portugal',
  'Netherlands',
  'Italy',
  'Senegal',
];

function createPlayer(
  id: string,
  name: string,
  position: PositionCode,
  shirtNumber: number,
  baseQuality: number,
  seed: number
): PlayerData {
  const jitter = (offset: number) => ((seed * 17 + offset * 31) % 13) - 6;
  const clamp = (val: number) => Math.min(96, Math.max(45, Math.round(val)));

  const isGK = position === 'GK';
  const isDef = ['CB', 'LB', 'RB', 'CDM'].includes(position);
  const isMid = ['CM', 'CAM', 'CDM'].includes(position);
  const isAtt = ['LW', 'RW', 'ST', 'CAM'].includes(position);

  const attributes: PlayerAttributes = {
    pace: clamp(baseQuality + (isAtt || position === 'LB' || position === 'RB' ? 6 : -3) + jitter(1)),
    acceleration: clamp(baseQuality + (isAtt ? 7 : -2) + jitter(2)),
    shooting: clamp(isGK ? 35 : baseQuality + (isAtt ? 8 : isMid ? 2 : -14) + jitter(3)),
    finishing: clamp(isGK ? 30 : baseQuality + (position === 'ST' ? 10 : isAtt ? 6 : -16) + jitter(4)),
    passing: clamp(baseQuality + (isMid ? 8 : isAtt ? 2 : -4) + jitter(5)),
    vision: clamp(baseQuality + (isMid ? 9 : isAtt ? 3 : -6) + jitter(6)),
    dribbling: clamp(isGK ? 40 : baseQuality + (isAtt ? 8 : isMid ? 4 : -8) + jitter(7)),
    ballControl: clamp(baseQuality + (isMid || isAtt ? 6 : -3) + jitter(8)),
    tackling: clamp(isGK ? 35 : baseQuality + (isDef ? 10 : isMid ? 2 : -20) + jitter(9)),
    marking: clamp(isGK ? 35 : baseQuality + (isDef ? 9 : isMid ? 1 : -22) + jitter(10)),
    strength: clamp(baseQuality + (position === 'CB' || position === 'ST' ? 7 : -2) + jitter(11)),
    jumping: clamp(baseQuality + (position === 'CB' || isGK ? 8 : 0) + jitter(12)),
    stamina: clamp(baseQuality + (isMid ? 7 : 2) + jitter(13)),
    agility: clamp(baseQuality + (isAtt ? 7 : 0) + jitter(14)),
    gkReflexes: clamp(isGK ? baseQuality + 8 + jitter(15) : 25),
    gkPositioning: clamp(isGK ? baseQuality + 7 + jitter(16) : 25),
    gkHandling: clamp(isGK ? baseQuality + 6 + jitter(17) : 25),
  };

  const overall = calculateOverallRating(position, attributes);
  const heightCm =
    position === 'GK' || position === 'CB'
      ? 186 + (seed % 10)
      : position === 'LW' || position === 'RW'
      ? 173 + (seed % 9)
      : 178 + (seed % 10);

  const playStylePool = [
    'Playmaker',
    'Speedster',
    'Clinical Finisher',
    'Ball Winner',
    'Aerial Threat',
    'Engine',
    'Acrobatic',
  ];

  return {
    id,
    name,
    age: 19 + (seed % 14),
    nationality: NATIONALITIES[seed % NATIONALITIES.length],
    primaryPosition: position,
    secondaryPositions: position === 'ST' ? ['LW', 'RW'] : position === 'CM' ? ['CDM', 'CAM'] : [position],
    preferredFoot: seed % 4 === 0 ? 'Left' : 'Right',
    shirtNumber,
    skillMoves: isAtt ? 4 + (seed % 2) : isMid ? 3 + (seed % 2) : 2,
    weakFoot: 3 + (seed % 3),
    playStyleTags: [playStylePool[seed % playStylePool.length]],
    attributes,
    overall,
    fitness: 100,
    xp: 0,
    level: 1,
    marketValue: Math.round((overall - 55) * 1.4 * 1000000),
    weeklyWage: Math.round((overall - 50) * 3200),
    contractYears: 2 + (seed % 3),
    appearance: {
      skinColor: SKIN_TONES[seed % SKIN_TONES.length],
      hairColor: HAIR_COLORS[(seed * 3) % HAIR_COLORS.length],
      hairStyle: HAIR_STYLES[(seed * 5) % HAIR_STYLES.length],
      bootColor: BOOT_COLORS[(seed * 7) % BOOT_COLORS.length],
      heightCm,
      build: position === 'CB' || position === 'ST' ? (seed % 2 === 0 ? 'stocky' : 'athletic') : 'lean',
      accessory: seed % 5 === 0 ? 'wristband' : 'none',
    },
  };
}

interface ClubSeed {
  id: string;
  name: string;
  shortName: string;
  city: string;
  stadiumName: string;
  baseQuality: number;
  prestige: number;
  budget: number;
  formation: FormationName;
  homeKit: TeamData['homeKit'];
  awayKit: TeamData['awayKit'];
  rosterNames: string[];
}

const CLUB_SEEDS: ClubSeed[] = [
  {
    id: 'apex_united',
    name: 'Apex Athletic FC',
    shortName: 'APX',
    city: 'London',
    stadiumName: 'Apex Arena',
    baseQuality: 83,
    prestige: 5,
    budget: 85000000,
    formation: '4-3-3',
    homeKit: {
      primaryColor: '#e11d48',
      secondaryColor: '#ffffff',
      shortsColor: '#0f172a',
      socksColor: '#e11d48',
      gkColor: '#10b981',
      pattern: 'stripes',
    },
    awayKit: {
      primaryColor: '#f8fafc',
      secondaryColor: '#e11d48',
      shortsColor: '#e11d48',
      socksColor: '#f8fafc',
      gkColor: '#f59e0b',
      pattern: 'solid',
    },
    rosterNames: [
      'D. Costa-Silva',
      'M. Vance',
      'K. Koulibaly-Ndiaye',
      'R. Lindqvist',
      'T. Hakimi-Zayd',
      'J. Bellingham-Cole',
      'L. Modric-Vuk',
      'E. Valderama',
      'V. Sterling-Kerr',
      'M. Silva-Santos',
      'B. Saka-Mensah',
      'A. Ramsdale-Hart',
      'C. Romero-Paz',
      'F. Camavinga-Lo',
      'G. Martinelli-Luz',
      'O. Watkins-Reid',
    ],
  },
  {
    id: 'nova_madrid',
    name: 'Real Nova CF',
    shortName: 'RNC',
    city: 'Madrid',
    stadiumName: 'Crown Olympic',
    baseQuality: 84,
    prestige: 5,
    budget: 92000000,
    formation: '4-3-3',
    homeKit: {
      primaryColor: '#f8fafc',
      secondaryColor: '#eab308',
      shortsColor: '#f8fafc',
      socksColor: '#f8fafc',
      gkColor: '#06b6d4',
      pattern: 'solid',
    },
    awayKit: {
      primaryColor: '#1e1b4b',
      secondaryColor: '#eab308',
      shortsColor: '#1e1b4b',
      socksColor: '#eab308',
      gkColor: '#10b981',
      pattern: 'sash',
    },
    rosterNames: [
      'T. Courtois-Val',
      'F. Mendy-Diallo',
      'A. Rudiger-Kroos',
      'E. Militao-Rocha',
      'D. Carvajal-Sol',
      'A. Tchouameni-Ba',
      'F. Valverde-Rios',
      'L. Pedri-Torres',
      'V. Junior-Lopes',
      'K. Mbappe-Laroche',
      'R. Goes-Alves',
      'A. Lunin-Koval',
      'N. Fernandez-Cid',
      'E. Diaz-Moreno',
      'A. Guler-Yilmaz',
      'J. Mato-Perez',
    ],
  },
  {
    id: 'metro_city',
    name: 'Metro Bluezens',
    shortName: 'MBC',
    city: 'Manchester',
    stadiumName: 'Harbor Lights Stadium',
    baseQuality: 84,
    prestige: 5,
    budget: 90000000,
    formation: '4-2-3-1',
    homeKit: {
      primaryColor: '#38bdf8',
      secondaryColor: '#ffffff',
      shortsColor: '#ffffff',
      socksColor: '#38bdf8',
      gkColor: '#f43f5e',
      pattern: 'solid',
    },
    awayKit: {
      primaryColor: '#0f172a',
      secondaryColor: '#38bdf8',
      shortsColor: '#0f172a',
      socksColor: '#38bdf8',
      gkColor: '#eab308',
      pattern: 'stripes',
    },
    rosterNames: [
      'E. Moraes-Lima',
      'J. Gvardiol-Kovac',
      'R. Dias-Monteiro',
      'M. Akanji-Frei',
      'K. Walker-Grant',
      'R. Hernandez-Casc',
      'B. Silva-Mota',
      'J. Doku-Bakayoko',
      'K. DeBruyne-Vos',
      'P. Foden-Shaw',
      'E. Haaland-Berg',
      'S. Ortega-Moreno',
      'N. Ake-VanDijk',
      'M. Kovacic-Mod',
      'J. Grealish-Keane',
      'J. Alvarez-Cruz',
    ],
  },
  {
    id: 'bavaria_fc',
    name: 'Bavaria Munchen SV',
    shortName: 'BAV',
    city: 'Munich',
    stadiumName: 'Apex Arena',
    baseQuality: 82,
    prestige: 5,
    budget: 78000000,
    formation: '4-2-3-1',
    homeKit: {
      primaryColor: '#dc2626',
      secondaryColor: '#ffffff',
      shortsColor: '#dc2626',
      socksColor: '#dc2626',
      gkColor: '#22c55e',
      pattern: 'hoops',
    },
    awayKit: {
      primaryColor: '#18181b',
      secondaryColor: '#f59e0b',
      shortsColor: '#18181b',
      socksColor: '#18181b',
      gkColor: '#38bdf8',
      pattern: 'solid',
    },
    rosterNames: [
      'M. Neuer-Vogel',
      'A. Davies-Boateng',
      'M. DeLigt-Bakker',
      'D. Upamecano-Sy',
      'J. Kimmich-Beck',
      'L. Goretzka-Wolf',
      'K. Laimer-Haas',
      'L. Sane-Richter',
      'J. Musiala-Brandt',
      'K. Coman-Moreau',
      'H. Kane-Sterling',
      'S. Ulreich-Koch',
      'M. Kim-Jae',
      'R. Guerreiro-Paz',
      'T. Muller-Gerd',
      'M. Tel-Diaby',
    ],
  },
  {
    id: 'milano_nerazzurri',
    name: 'Internazionale Milano',
    shortName: 'INT',
    city: 'Milan',
    stadiumName: 'Crown Olympic',
    baseQuality: 81,
    prestige: 4,
    budget: 65000000,
    formation: '3-5-2',
    homeKit: {
      primaryColor: '#1d4ed8',
      secondaryColor: '#090d16',
      shortsColor: '#090d16',
      socksColor: '#1d4ed8',
      gkColor: '#f59e0b',
      pattern: 'stripes',
    },
    awayKit: {
      primaryColor: '#ffffff',
      secondaryColor: '#1d4ed8',
      shortsColor: '#ffffff',
      socksColor: '#1d4ed8',
      gkColor: '#10b981',
      pattern: 'sash',
    },
    rosterNames: [
      'Y. Sommer-Frei',
      'A. Bastoni-Rossi',
      'F. Acerbi-Conti',
      'B. Pavard-Laurent',
      'F. Dimarco-Galli',
      'H. Calhanoglu-Oz',
      'N. Barella-Fiore',
      'H. Mkhitaryan-Yan',
      'D. Dumfries-Berg',
      'L. Martinez-Sosa',
      'M. Thuram-Ulien',
      'E. Audero-Moro',
      'S. DeVrij-Koeman',
      'D. Frattesi-Riva',
      'C. Augusto-Neto',
      'M. Arnautovic-Ilic',
    ],
  },
  {
    id: 'paris_lumi',
    name: 'Paris Lumiere SG',
    shortName: 'PSG',
    city: 'Paris',
    stadiumName: 'Harbor Lights Stadium',
    baseQuality: 81,
    prestige: 4,
    budget: 82000000,
    formation: '4-3-3',
    homeKit: {
      primaryColor: '#1e3a8a',
      secondaryColor: '#ef4444',
      shortsColor: '#1e3a8a',
      socksColor: '#1e3a8a',
      gkColor: '#eab308',
      pattern: 'stripes',
    },
    awayKit: {
      primaryColor: '#f8fafc',
      secondaryColor: '#1e3a8a',
      shortsColor: '#f8fafc',
      socksColor: '#f8fafc',
      gkColor: '#10b981',
      pattern: 'solid',
    },
    rosterNames: [
      'G. Donnarumma-Re',
      'N. Mendes-Costa',
      'M. Correa-Aoas',
      'L. Hernandez-Paz',
      'A. Hakimi-Mouad',
      'V. Ferreira-Pinto',
      'W. Zaire-Emery',
      'F. Ruiz-Pena',
      'B. Barcola-Doue',
      'G. Ramos-Neves',
      'O. Dembele-Toure',
      'K. Navas-Soto',
      'M. Skriniar-Vuk',
      'K. Lee-In',
      'M. Asensio-Gil',
      'R. Kolo-Muani',
    ],
  },
  {
    id: 'rio_flamenco',
    name: 'Atlético Guanabara',
    shortName: 'ATG',
    city: 'Rio de Janeiro',
    stadiumName: 'Crown Olympic',
    baseQuality: 78,
    prestige: 4,
    budget: 45000000,
    formation: '4-4-2',
    homeKit: {
      primaryColor: '#facc15',
      secondaryColor: '#16a34a',
      shortsColor: '#1d4ed8',
      socksColor: '#ffffff',
      gkColor: '#ec4899',
      pattern: 'solid',
    },
    awayKit: {
      primaryColor: '#16a34a',
      secondaryColor: '#facc15',
      shortsColor: '#ffffff',
      socksColor: '#16a34a',
      gkColor: '#38bdf8',
      pattern: 'hoops',
    },
    rosterNames: [
      'A. Rossi-Mendes',
      'A. Sandro-Lobo',
      'L. Pereira-Dantas',
      'F. Bruno-Rocha',
      'G. Varela-Suarez',
      'E. Pulgar-Vidal',
      'N. DeLaCruz-Paz',
      'G. Arrascaeta-Luz',
      'G. Plata-Caicedo',
      'P. Guilherme-Gol',
      'G. Barbosa-Reis',
      'M. Cunha-Brito',
      'D. Luiz-Moreira',
      'A. Allan-Souza',
      'E. Cebolinha-dias',
      'B. Henrique-Silva',
    ],
  },
  {
    id: 'tokyo_cyber',
    name: 'Neo Tokyo Strikers',
    shortName: 'NTS',
    city: 'Tokyo',
    stadiumName: 'Metro Concrete Cage',
    baseQuality: 77,
    prestige: 3,
    budget: 40000000,
    formation: '4-3-3',
    homeKit: {
      primaryColor: '#7c3aed',
      secondaryColor: '#22d3ee',
      shortsColor: '#090d16',
      socksColor: '#7c3aed',
      gkColor: '#f59e0b',
      pattern: 'sash',
    },
    awayKit: {
      primaryColor: '#22d3ee',
      secondaryColor: '#7c3aed',
      shortsColor: '#090d16',
      socksColor: '#22d3ee',
      gkColor: '#f43f5e',
      pattern: 'solid',
    },
    rosterNames: [
      'Z. Suzuki-Ken',
      'Y. Nagatomo-Sho',
      'T. Tomiyasu-Ren',
      'K. Itakura-Haru',
      'Y. Sugawara-Kai',
      'W. Endo-Riku',
      'H. Morita-Sora',
      'T. Kubo-Shin',
      'K. Mitoma-Kaoru',
      'A. Ueda-Daizen',
      'R. Doan-Takumi',
      'K. Osako-Yu',
      'H. Ito-Hiroki',
      'R. Hatate-Reo',
      'D. Kamada-Jun',
      'K. Furuhashi-Go',
    ],
  },
];

const STARTER_NUMBERS = [1, 3, 4, 5, 2, 6, 8, 10, 11, 9, 7];
const SUB_POSITIONS: PositionCode[] = ['GK', 'CB', 'CM', 'LW', 'ST'];
const SUB_NUMBERS = [13, 15, 16, 17, 19];

export const INITIAL_TEAMS: TeamData[] = CLUB_SEEDS.map((club, clubIdx) => {
  const slots = FORMATIONS[club.formation];
  const starters: PlayerData[] = slots.map((slot, idx) =>
    createPlayer(
      `${club.id}_p${idx + 1}`,
      club.rosterNames[idx] || `Player ${idx + 1}`,
      slot.role,
      STARTER_NUMBERS[idx],
      club.baseQuality,
      clubIdx * 20 + idx + 1
    )
  );

  const substitutes: PlayerData[] = SUB_POSITIONS.map((pos, idx) =>
    createPlayer(
      `${club.id}_sub${idx + 1}`,
      club.rosterNames[11 + idx] || `Sub ${idx + 1}`,
      pos,
      SUB_NUMBERS[idx],
      club.baseQuality - 3,
      clubIdx * 20 + 12 + idx
    )
  );

  return {
    id: club.id,
    name: club.name,
    shortName: club.shortName,
    city: club.city,
    stadiumName: club.stadiumName,
    homeKit: club.homeKit,
    awayKit: club.awayKit,
    prestige: club.prestige,
    budget: club.budget,
    starters,
    substitutes,
    tactics: {
      formation: club.formation,
      mentality: 'Balanced',
      pressingIntensity: 60,
      defensiveLineHeight: 55,
      passingStyle: 'Mixed',
      width: 60,
      tempo: 65,
      captainId: starters[2].id,
      penaltyTakerId: starters[9].id,
      freeKickTakerId: starters[7].id,
      cornerTakerId: starters[8].id,
    },
  };
});

export const TRAINING_DRILLS: TrainingDrill[] = [
  {
    id: 'drill_shooting',
    title: 'Clinical Top-Corner Finishing',
    category: 'Shooting',
    description:
      'Receive service at the edge of the box and beat the goalkeeper to rack up points before the timer runs out.',
    targetScore: 300,
    durationSeconds: 60,
    rewardXp: 150,
    rewardCoins: 120,
  },
  {
    id: 'drill_passing',
    title: 'Tiki-Taka Precision Passing',
    category: 'Passing',
    description:
      'Chain rapid ground passes and through-balls between moving midfield teammates without losing possession.',
    targetScore: 400,
    durationSeconds: 60,
    rewardXp: 140,
    rewardCoins: 110,
  },
  {
    id: 'drill_dribbling',
    title: 'Close-Control Slalom & Burst',
    category: 'Dribbling',
    description:
      'Use skill moves and sprint bursts to weave past pressing defenders and finish into the net.',
    targetScore: 350,
    durationSeconds: 60,
    rewardXp: 160,
    rewardCoins: 130,
  },
  {
    id: 'drill_defending',
    title: 'High-Press Ball Recovery',
    category: 'Defending',
    description:
      'Close down attacking waves, time clean standing tackles, and intercept passes before opponents shoot.',
    targetScore: 250,
    durationSeconds: 60,
    rewardXp: 150,
    rewardCoins: 125,
  },
];

export const CHALLENGE_SCENARIOS: ChallengeScenario[] = [
  {
    id: 'chal_hattrick',
    title: '01. Blitz Attack',
    subtitle: 'Score 3 Goals in a Single Match',
    difficulty: 'Semi-Pro',
    description: 'Overwhelm the opposition defense and score at least 3 goals before the final whistle.',
    initialHomeGoals: 0,
    initialAwayGoals: 0,
    startMinute: 0,
    winConditionType: 'SCORE_GOALS',
    targetValue: 3,
    rewardCoins: 250,
    rewardXp: 300,
  },
  {
    id: 'chal_comeback',
    title: '02. Miracle at the Bridge',
    subtitle: 'Win After Conceding First (0 - 2 Down at 55\')',
    difficulty: 'Professional',
    description:
      'Your squad trails 0-2 early in the second half. Mount a legendary comeback and win in regulation time.',
    initialHomeGoals: 0,
    initialAwayGoals: 2,
    startMinute: 55,
    winConditionType: 'COMEBACK_WIN',
    targetValue: 1,
    rewardCoins: 450,
    rewardXp: 500,
  },
  {
    id: 'chal_longrange',
    title: '03. Screamer From Distance',
    subtitle: 'Score From Outside the Penalty Box & Win',
    difficulty: 'Professional',
    description:
      'Unleash a thunderbolt from outside the 18-yard box (>16.5m from goal) and secure the victory.',
    initialHomeGoals: 0,
    initialAwayGoals: 0,
    startMinute: 45,
    winConditionType: 'OUTSIDE_BOX_GOAL',
    targetValue: 1,
    rewardCoins: 400,
    rewardXp: 420,
  },
  {
    id: 'chal_passing_master',
    title: '04. Symphony of Possession',
    subtitle: 'Complete 15 Passes & Win the Match',
    difficulty: 'Semi-Pro',
    description: 'Control the midfield tempo with at least 15 completed passes and finish ahead on the scoreboard.',
    initialHomeGoals: 0,
    initialAwayGoals: 0,
    startMinute: 0,
    winConditionType: 'PASS_SEQUENCE',
    targetValue: 15,
    rewardCoins: 300,
    rewardXp: 350,
  },
  {
    id: 'chal_park_the_bus',
    title: '05. Fortress Defense',
    subtitle: 'Protect a 1-0 Lead From the 65th Minute',
    difficulty: 'World Class',
    description:
      'Hold off relentless World Class attacking pressure for the final 25 minutes without conceding an equalizer.',
    initialHomeGoals: 1,
    initialAwayGoals: 0,
    startMinute: 65,
    winConditionType: 'DEFEND_LEAD',
    targetValue: 1,
    rewardCoins: 500,
    rewardXp: 550,
  },
];

export const DEFAULT_DAILY_OBJECTIVES: DailyObjective[] = [
  {
    id: 'daily_goals_5',
    title: 'Golden Boot Warmup',
    description: 'Score 5 goals across any match mode today.',
    metric: 'goals',
    target: 5,
    progress: 0,
    rewardCoins: 200,
    rewardXp: 250,
    claimed: false,
  },
  {
    id: 'daily_wins_2',
    title: 'Clean Victory Streak',
    description: 'Win 2 completed matches in Quick Match, Career, or Tournament.',
    metric: 'wins',
    target: 2,
    progress: 0,
    rewardCoins: 250,
    rewardXp: 300,
    claimed: false,
  },
  {
    id: 'daily_tackles_8',
    title: 'Midfield Enforcer',
    description: 'Execute 8 successful tackles or interceptions.',
    metric: 'tackles',
    target: 8,
    progress: 0,
    rewardCoins: 180,
    rewardXp: 200,
    claimed: false,
  },
  {
    id: 'daily_passes_25',
    title: 'Metronome Distribution',
    description: 'Complete 25 accurate passes to teammates.',
    metric: 'passes',
    target: 25,
    progress: 0,
    rewardCoins: 180,
    rewardXp: 220,
    claimed: false,
  },
  {
    id: 'daily_outside_box',
    title: 'Long-Range Specialist',
    description: 'Score 1 goal from outside the penalty box.',
    metric: 'outsideBoxGoals',
    target: 1,
    progress: 0,
    rewardCoins: 300,
    rewardXp: 350,
    claimed: false,
  },
];

export const COSMETIC_STORE_ITEMS: CosmeticItem[] = [
  {
    id: 'ball_classic_white',
    name: 'Pro Match White & Gold',
    category: 'Ball',
    priceCoins: 0,
    previewColor: '#ffffff',
    accentColor: '#eab308',
    description: 'Official championship thermal-bonded match ball.',
    unlocked: true,
  },
  {
    id: 'ball_winter_volt',
    name: 'Hi-Vis Winter Volt',
    category: 'Ball',
    priceCoins: 350,
    previewColor: '#ccff00',
    accentColor: '#0f172a',
    description: 'High-contrast neon volt match ball engineered for night fixtures.',
    unlocked: false,
  },
  {
    id: 'ball_crimson_flare',
    name: 'Final Flare Crimson',
    category: 'Ball',
    priceCoins: 500,
    previewColor: '#f43f5e',
    accentColor: '#ffffff',
    description: 'Commemorative knockout final match ball with metallic crimson panels.',
    unlocked: false,
  },
  {
    id: 'ball_cyber_aqua',
    name: 'Street Pulse Aqua',
    category: 'Ball',
    priceCoins: 450,
    previewColor: '#06b6d4',
    accentColor: '#1e1b4b',
    description: 'Low-rebound textured street football designed for concrete cages.',
    unlocked: false,
  },
  {
    id: 'kit_royal_gold',
    name: 'Centenary Black & Gold Kit',
    category: 'Kit',
    priceCoins: 600,
    previewColor: '#18181b',
    accentColor: '#eab308',
    description: 'Cosmetic club kit trim unlocked with earned match coins (no stat boost).',
    unlocked: false,
  },
  {
    id: 'boots_emerald_phantom',
    name: 'Emerald Velocity Boots',
    category: 'Boots',
    priceCoins: 400,
    previewColor: '#10b981',
    accentColor: '#ffffff',
    description: 'Lightweight carbon-plate cosmetic boots for your squad.',
    unlocked: false,
  },
];
