// scenes/core/LevelConfigurations.ts
import { LevelConfig } from './LevelConfig';

export const LEVEL_CONFIGS = {
  // =========================
  // LEVEL 1 — SAFE BROWSING
  // =========================
  SFB: {
    sceneKey: 'sfb-level-scene',

    topic: 'Safe Browsing Practices',

    mapKey: 'SFBlevel',
    tilesetName: 'sfb-tileset',

    intro: {
      title: 'Level 1 — Safe Browsing Practices',
      description:
        'Explore the area, open Knowledge Chests, and uncover smart browsing habits.\n' +
        'Approach the Wards to prove what you’ve learned!\n\n' +
        'The number above your character represents the remaining questions you must answer in this level.',
      dialogueId: 'level1_spawn_intro',
    },

    next: {
      sceneKey: 'ps-level-scene',
      topic: 'Password Security',
    },

    inferSubcat: (id: string) => {
      if (id.includes('_svns_')) return 'SECVSNONSEC';
      if (id.includes('_https_')) return 'HTTPVSHTTPS';
      if (id.includes('_bsbp_')) return 'BROWSERSECBP';
      return 'UNKNOWN';
    },
  } satisfies LevelConfig,

  // =========================
  // LEVEL 2 — PASSWORD SECURITY
  // =========================
  PS: {
    sceneKey: 'ps-level-scene',

    topic: 'Password Security',

    mapKey: 'PSlevel',
    tilesetName: 'sfb-tileset',

    intro: {
      title: 'Level 2 — Password Security',
      description:
        'Explore each chamber, learn how passwords are attacked, and test a fictional password against its guardian.\n' +
        'Defeat all four guardians to assemble your knight escort and unlock the next level.',
    },

    next: {
      sceneKey: 'm-level-scene',
      topic: 'Malware',
    },

    inferSubcat: (id: string) => {
      if (id.startsWith('ps_commpass_')) return 'COMMPASS';
      if (id.startsWith('ps_passstren_')) return 'PASSSTREN';
      if (id.startsWith('ps_multifact_')) return 'MULTIFACT';
      return 'UNKNOWN';
    },
  } satisfies LevelConfig,

  // =========================
  // LEVEL 3 — MALWARE
  // =========================
  M: {
    sceneKey: 'm-level-scene',

    topic: 'Malware',

    mapKey: 'Mlevel',
    tilesetName: 'sfb-tileset',

    intro: {
      title: 'Level 3 — Malware',
      description:
        'Discover the different types of malware and how infections spread.\n' +
        'Collect knowledge and prove your skills against the Wards.',
    },

    next: {
      sceneKey: 'se-level-scene',
      topic: 'Social Engineering',
    },

    inferSubcat: (id: string) => {
      if (id.startsWith('mal_types_')) return 'MALTYPE';
      if (id.startsWith('mal_infect_')) return 'MALINFOSYM';
      return 'UNKNOWN';
    },
  } satisfies LevelConfig,

  // =========================
  // LEVEL 4 — SOCIAL ENGINEERING
  // =========================
  SE: {
    sceneKey: 'se-level-scene',

    topic: 'Social Engineering',

    mapKey: 'SElevel',
    tilesetName: 'sfb-tileset',

    intro: {
      title: 'Level 4 — Social Engineering',
      description:
        'Learn how attackers manipulate human behavior to bypass security.\n' +
        'Stay alert, collect knowledge, and challenge the Wards.',
    },

    next: {
      sceneKey: 'ir-level-scene',
      topic: 'Incident Response',
    },

    inferSubcat: (id: string) => {
      if (id.includes('se_types_')) return 'SocEngType';
      if (id.includes('se_defending_')) return 'SocEngDef';
      return 'UNKNOWN';
    },
  } satisfies LevelConfig,

  // =========================
  // LEVEL 5 — INCIDENT RESPONSE
  // =========================
  IR: {
  sceneKey: 'ir-level-scene',

  topic: 'Incident Response',

  mapKey: 'IRlevel',
  tilesetName: 'sfb-tileset',

  intro: {
    title: 'Level 5 — Incident Response',
    description:
      'Learn how to response in the event of an attack or a crash.\n' +
      'Stay alert, collect knowledge, and challenge the Wards.',
  },

  next: {
    sceneKey: 'ir-level-scene',
    topic: 'Incident Response',
  },

  inferSubcat: (id: string) => {
    if (id.includes('ir_steps_')) return 'IRSteps';
    if (id.includes('ir_response_')) return 'IRResponse';
    return 'UNKNOWN';
  },
} satisfies LevelConfig,
};
