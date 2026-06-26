import Phaser from 'phaser';

export const SFX = {
  UI_CLICK: 'sfx.ui.click',
  UI_HOVER: 'sfx.ui.hover',
  POPUP_OPEN: 'sfx.popup.open',
  POPUP_CLOSE: 'sfx.popup.close',
  QUESTION_OPEN: 'sfx.question.open',
  ANSWER_CORRECT: 'sfx.answer.correct',
  ANSWER_WRONG: 'sfx.answer.wrong',
  LEVEL_INTRO: 'sfx.level.intro',
  LEVEL_COMPLETE: 'sfx.level.complete',
  NEXT_LEVEL_PORTAL: 'sfx.next_level.portal',
  ERROR_BLOCKED: 'sfx.error.blocked',

  PLAYER_BLOCK: 'sfx.player.block',
  PLAYER_HIT: 'sfx.player.hit',
  PLAYER_RESPAWN: 'sfx.player.respawn',
  INTERACT_CONFIRM: 'sfx.interact.confirm',
  MOVEMENT_TUTORIAL_OPEN: 'sfx.movement_tutorial.open',

  KNOWLEDGE_OPEN: 'sfx.knowledge.open',
  KNOWLEDGE_STUDIED: 'sfx.knowledge.studied',
  KNOWLEDGE_CLOSE: 'sfx.knowledge.close',

  DOOR_OPEN: 'sfx.door.open',
  DOOR_CLOSE: 'sfx.door.close',
  TRAP_CHEST_OPEN: 'sfx.trap_chest.open',
  TRAP_TRIGGER: 'sfx.trap.trigger',
  ZONE_RESET: 'sfx.zone.reset',
  MALICIOUS_LINK_HIT: 'sfx.malicious_link.hit',

  GUARDIAN_CHALLENGE_START: 'sfx.guardian.challenge_start',
  PASSWORD_TYPE: 'sfx.password.type',
  PASSWORD_SUBMIT: 'sfx.password.submit',
  PASSWORD_SUCCESS: 'sfx.password.success',
  PASSWORD_FAIL: 'sfx.password.fail',
  PASSWORD_RECALL_SUCCESS: 'sfx.password.recall_success',
  PASSWORD_RECALL_FAIL: 'sfx.password.recall_fail',
  PASSWORD_MEMORY_RESET: 'sfx.password.memory_reset',
  MFA_CORRECT: 'sfx.mfa.correct',
  MFA_WRONG: 'sfx.mfa.wrong',
  SPIKE_GATE_OPEN: 'sfx.spike_gate.open',
  KNIGHT_PROTECT: 'sfx.knight.protect',
  GUARDIAN_DEFEATED: 'sfx.guardian.defeated',
  FOLLOWER_JOIN: 'sfx.follower.join',

  MALWARE_SPAWN: 'sfx.malware.spawn',
  MALWARE_ALERT: 'sfx.malware.alert',
  MALWARE_HIT_PLAYER: 'sfx.malware.hit_player',
  MALWARE_BLOCKED: 'sfx.malware.blocked',
  MALWARE_CLEAN_SUCCESS: 'sfx.malware.clean_success',
  MALWARE_CLEAN_FAIL: 'sfx.malware.clean_fail',
  MALWARE_QUARANTINE_ACTIVATE: 'sfx.malware.quarantine_activate',
  MALWARE_QUARANTINE_LOOP: 'sfx.malware.quarantine_loop',
  MALWARE_QUARANTINE_RELEASE: 'sfx.malware.quarantine_release',
  SYSTEM_RESET: 'sfx.system.reset',

  NPC_DIALOGUE_START: 'sfx.npc.dialogue_start',
  DIALOGUE_TYPING: 'sfx.dialogue.typing',
  DIALOGUE_CONTINUE: 'sfx.dialogue.continue',
  DIALOGUE_CHOICE: 'sfx.dialogue.choice',
  DIALOGUE_SUCCESS: 'sfx.dialogue.success',
  DIALOGUE_FAIL: 'sfx.dialogue.fail',
  SUSPICION_INCREASE: 'sfx.suspicion.increase',
  SUSPICION_DECREASE: 'sfx.suspicion.decrease',
  SUSPICION_THRESHOLD: 'sfx.suspicion.threshold',
  PRESSURE_START: 'sfx.pressure.start',
  PRESSURE_TIMEOUT: 'sfx.pressure.timeout',
  NPC_AGGRESSIVE: 'sfx.npc.aggressive',

  MEMORY_FRAGMENT_OPEN: 'sfx.memory_fragment.open',
  RESPONDER_SEAL_LOCKED: 'sfx.responder_seal.locked',
  RESPONDER_SEAL_ACTIVATE: 'sfx.responder_seal.activate',
  SPIKE_GATE_RETRACT: 'sfx.spike_gate.retract',
  RESPONDER_RELEASED: 'sfx.responder.released',
  PASSWORD_BOSS_START: 'sfx.password_boss.start',
  PASSWORD_BOSS_COMPLETE: 'sfx.password_boss.complete',
  MALWARE_SCANNER_ACTIVATE: 'sfx.malware_scanner.activate',
  WITNESS_CORRECT: 'sfx.witness.correct',
  WITNESS_WRONG: 'sfx.witness.wrong',
  EXTRA_WITNESS_SPAWN: 'sfx.extra_witness.spawn',
  CORE_GATE_LOCKED: 'sfx.core_gate.locked',
  MINION_SEALING_START: 'sfx.minion_sealing.start',
  MINION_SEALED: 'sfx.minion.sealed',
  CORE_GATE_OPEN: 'sfx.core_gate.open',
  BOSS_REPORT_START: 'sfx.boss_report.start',
  REPORT_ANSWER_CORRECT: 'sfx.report.answer_correct',
  REPORT_REJECTED: 'sfx.report.rejected',
  REPORT_ACCEPTED: 'sfx.report.accepted',
  LEVER_LOCKED: 'sfx.lever.locked',
  LEVER_PULL: 'sfx.lever.pull',
  FINAL_SHUTDOWN: 'sfx.final_shutdown',
  ENDING_START: 'sfx.ending.start',
} as const;

export const MUSIC = {
  MAIN_MENU: 'music.main_menu',
  LEVEL_1_SAFE_BROWSING: 'music.level_1_safe_browsing',
  LEVEL_2_PASSWORD_SECURITY: 'music.level_2_password_security',
  LEVEL_3_MALWARE: 'music.level_3_malware',
  LEVEL_4_SOCIAL_ENGINEERING: 'music.level_4_social_engineering',
  LEVEL_5_INCIDENT_RESPONSE: 'music.level_5_incident_response',
  BOSS_OR_FINAL: 'music.boss_or_final',
  LEVEL_COMPLETE: 'music.level_complete',
} as const;

export type SfxKey = typeof SFX[keyof typeof SFX];
export type MusicKey = typeof MUSIC[keyof typeof MUSIC];
export type AudioKey = SfxKey | MusicKey;

type AudioRoute = {
  src?: string | string[];
  volume?: number;
  loop?: boolean;
};

const route = (src?: string | string[], volume = 1, loop = false): AudioRoute => ({
  src,
  volume,
  loop,
});

// Files live under public/phaser-assets/audio-assets.
export const AUDIO_ROUTES: Record<AudioKey, AudioRoute> = {
  [SFX.UI_CLICK]: route('audio-assets/select_2.wav', 0.55),
  [SFX.UI_HOVER]: route('audio-assets/sci_fi_hover.wav', 0.25),
  [SFX.POPUP_OPEN]: route('audio-assets/UI Message Appear 01.wav', 0.55),
  [SFX.POPUP_CLOSE]: route('audio-assets/UIBeep_Lock On_05.wav', 0.45),
  [SFX.QUESTION_OPEN]: route('audio-assets/OPEN_CASE_02.wav', 0.55),
  [SFX.ANSWER_CORRECT]: route('audio-assets/sci_fi_confirm.wav', 0.7),
  [SFX.ANSWER_WRONG]: route('audio-assets/Error Triplet-5.wav', 0.7),
  [SFX.LEVEL_INTRO]: route('audio-assets/music_box_chime_quick.wav', 0.65),
  [SFX.LEVEL_COMPLETE]: route('audio-assets/vibraphone_level_complete.wav', 0.8),
  [SFX.NEXT_LEVEL_PORTAL]: route('audio-assets/music_box_level_complete.wav', 0.7),
  [SFX.ERROR_BLOCKED]: route('audio-assets/Error Triplet-5.wav', 0.55),

  [SFX.PLAYER_BLOCK]: route('audio-assets/swipe.wav', 0.65),
  [SFX.PLAYER_HIT]: route('audio-assets/PUNCH_DESIGNED_HEAVY_74.wav', 0.7),
  [SFX.PLAYER_RESPAWN]: route('audio-assets/Arcane Beacon.wav', 0.65),
  [SFX.INTERACT_CONFIRM]: route('audio-assets/sci_fi_confirm.wav', 0.55),
  [SFX.MOVEMENT_TUTORIAL_OPEN]: route('audio-assets/sci_fi_hover.wav', 0.45),

  [SFX.KNOWLEDGE_OPEN]: route('audio-assets/8-bit-rusty-chest-opening-xxtqtns5.wav', 0.65),
  [SFX.KNOWLEDGE_STUDIED]: route('audio-assets/FUI Ping Triplet Echo.wav', 0.45),
  [SFX.KNOWLEDGE_CLOSE]: route('audio-assets/freesound_community-chest-slam-85122.mp3', 0.45),

  [SFX.DOOR_OPEN]: route('audio-assets/door_open.wav', 0.75),
  [SFX.DOOR_CLOSE]: route('audio-assets/door_close.wav', 0.7),
  [SFX.TRAP_CHEST_OPEN]: route('audio-assets/8-bit-rusty-chest-opening-xxtqtns5.wav', 0.8),
  [SFX.TRAP_TRIGGER]: route('audio-assets/Retro Jump StereoUP Simple 01.wav', 0.85),
  [SFX.ZONE_RESET]: route('audio-assets/Old Terminal Popup Appear Low.wav', 0.7),
  [SFX.MALICIOUS_LINK_HIT]: route('audio-assets/horror_sting.wav', 0.8),

  [SFX.GUARDIAN_CHALLENGE_START]: route('audio-assets/Retro Cinematic Short 02.wav', 0.65),
  [SFX.PASSWORD_TYPE]: route('audio-assets/Laptop_Keystroke_82.wav', 0.25),
  [SFX.PASSWORD_SUBMIT]: route('audio-assets/select_2.wav', 0.55),
  [SFX.PASSWORD_SUCCESS]: route('audio-assets/FUI Ping Triplet Echo.wav', 0.75),
  [SFX.PASSWORD_FAIL]: route('audio-assets/Error Triplet-5.wav', 0.75),
  [SFX.PASSWORD_RECALL_SUCCESS]: route('audio-assets/Big Egg collect 1.wav', 0.75),
  [SFX.PASSWORD_RECALL_FAIL]: route('audio-assets/Error Triplet-5.wav', 0.75),
  [SFX.PASSWORD_MEMORY_RESET]: route('audio-assets/Old Terminal Popup Appear Low.wav', 0.65),
  [SFX.MFA_CORRECT]: route('audio-assets/Big Egg collect 1.wav', 0.75),
  [SFX.MFA_WRONG]: route('audio-assets/Error Triplet-5.wav', 0.75),
  [SFX.SPIKE_GATE_OPEN]: route('audio-assets/Rotate Stone 03.wav', 0.75),
  [SFX.KNIGHT_PROTECT]: route('audio-assets/Dagger Slash 01.wav', 0.8),
  [SFX.GUARDIAN_DEFEATED]: route('audio-assets/synth_confirmation.wav', 0.8),
  [SFX.FOLLOWER_JOIN]: route('audio-assets/match_synth_3.wav', 0.65),

  [SFX.MALWARE_SPAWN]: route('audio-assets/Old Terminal Computing-3.wav', 0.55),
  [SFX.MALWARE_ALERT]: route('audio-assets/Old Terminal Alarm Loop.wav', 0.6),
  [SFX.MALWARE_HIT_PLAYER]: route('audio-assets/PUNCH_PERCUSSIVE_HEAVY_09.wav', 0.8),
  [SFX.MALWARE_BLOCKED]: route('audio-assets/HIT_SHORT_04.wav', 0.75),
  [SFX.MALWARE_CLEAN_SUCCESS]: route('audio-assets/Big Egg collect 1.wav', 0.75),
  [SFX.MALWARE_CLEAN_FAIL]: route('audio-assets/Error Triplet-5.wav', 0.75),
  [SFX.MALWARE_QUARANTINE_ACTIVATE]: route('audio-assets/Static Glitch Short.wav', 0.85),
  [SFX.MALWARE_QUARANTINE_LOOP]: route('audio-assets/LOOP_01.wav', 0.35, true),
  [SFX.MALWARE_QUARANTINE_RELEASE]: route('audio-assets/Future Hologram Turn Off_02.wav', 0.6),
  [SFX.SYSTEM_RESET]: route('audio-assets/High-Tech Gadget Activate.wav', 0.75),

  [SFX.NPC_DIALOGUE_START]: route('audio-assets/UI Message Appear 01.wav', 0.55),
  [SFX.DIALOGUE_TYPING]: route('audio-assets/Laptop_Typing Short_04.wav', 0.32, true),
  [SFX.DIALOGUE_CONTINUE]: route('audio-assets/select_2.wav', 0.35),
  [SFX.DIALOGUE_CHOICE]: route('audio-assets/select_2.wav', 0.5),
  [SFX.DIALOGUE_SUCCESS]: route('audio-assets/FUI Ping Triplet Echo.wav', 0.65),
  [SFX.DIALOGUE_FAIL]: route('audio-assets/Error Triplet-5.wav', 0.7),
  [SFX.SUSPICION_INCREASE]: route('audio-assets/horror_sting.wav', 0.55),
  [SFX.SUSPICION_DECREASE]: route('audio-assets/steel_drums_chime_quick.wav', 0.45),
  [SFX.SUSPICION_THRESHOLD]: route('audio-assets/FUI Holographic Interaction Radiate.wav', 0.7),
  [SFX.PRESSURE_START]: route('audio-assets/AMBIENCE_HEARTBEAT_LOOP.wav', 0.65),
  [SFX.PRESSURE_TIMEOUT]: route('audio-assets/match_synth_1.wav', 0.7),
  [SFX.NPC_AGGRESSIVE]: route('audio-assets/horror_sting.wav', 0.65),

  [SFX.MEMORY_FRAGMENT_OPEN]: route('audio-assets/music_box_mystery.wav', 0.65),
  [SFX.RESPONDER_SEAL_LOCKED]: route('audio-assets/Error Triplet-5.wav', 0.55),
  [SFX.RESPONDER_SEAL_ACTIVATE]: route('audio-assets/FUI Ping Triplet Echo.wav', 0.75),
  [SFX.SPIKE_GATE_RETRACT]: route('audio-assets/Rotate Stone 03.wav', 0.75),
  [SFX.RESPONDER_RELEASED]: route('audio-assets/music_box_chime_positive.wav', 0.8),
  [SFX.PASSWORD_BOSS_START]: route('audio-assets/Long_Distorted_fx.wav', 0.65),
  [SFX.PASSWORD_BOSS_COMPLETE]: route('audio-assets/vibraphone_chime_positive.wav', 0.8),
  [SFX.MALWARE_SCANNER_ACTIVATE]: route('audio-assets/FUI Holographic Interaction Radiate.wav', 0.85),
  [SFX.WITNESS_CORRECT]: route('audio-assets/FUI Ping Triplet Echo.wav', 0.65),
  [SFX.WITNESS_WRONG]: route('audio-assets/Error Triplet-5.wav', 0.7),
  [SFX.EXTRA_WITNESS_SPAWN]: route('audio-assets/horror_sting.wav', 0.65),
  [SFX.CORE_GATE_LOCKED]: route('audio-assets/Error Triplet-5.wav', 0.6),
  [SFX.MINION_SEALING_START]: route('audio-assets/Static Glitch Short.wav', 0.75),
  [SFX.MINION_SEALED]: route('audio-assets/Big Egg collect 1.wav', 0.75),
  [SFX.CORE_GATE_OPEN]: route('audio-assets/Dramatic_Theme.wav', 0.8),
  [SFX.BOSS_REPORT_START]: route('audio-assets/FUI Ping Triplet Echo.wav', 0.65),
  [SFX.REPORT_ANSWER_CORRECT]: route('audio-assets/FUI Ping Triplet Echo.wav', 0.65),
  [SFX.REPORT_REJECTED]: route('audio-assets/Error Triplet-5.wav', 0.75),
  [SFX.REPORT_ACCEPTED]: route('audio-assets/FUI Ping Triplet Echo.wav', 0.8),
  [SFX.LEVER_LOCKED]: route('audio-assets/Error Triplet-5.wav', 0.55),
  [SFX.LEVER_PULL]: route('audio-assets/BUTTON_STOP_02.wav', 0.85),
  [SFX.FINAL_SHUTDOWN]: route('audio-assets/Retro Charge Off StereoUP 02.wav', 0.9),
  [SFX.ENDING_START]: route('audio-assets/Just_A_Passenger_Of_Chaos.wav', 0.75),

  [MUSIC.MAIN_MENU]: route('audio-assets/Piano Pack - Track 02.wav', 0.35, true),
  [MUSIC.LEVEL_1_SAFE_BROWSING]: route('audio-assets/Piano Pack - Track 06.wav', 0.32, true),
  [MUSIC.LEVEL_2_PASSWORD_SECURITY]: route('audio-assets/Piano Pack - Track 03.wav', 0.32, true),
  [MUSIC.LEVEL_3_MALWARE]: route('audio-assets/Piano Pack - Track 09.wav', 0.32, true),
  [MUSIC.LEVEL_4_SOCIAL_ENGINEERING]: route('audio-assets/Piano Pack - Track 01.wav', 0.32, true),
  [MUSIC.LEVEL_5_INCIDENT_RESPONSE]: route('audio-assets/Piano Pack - Track 04.wav', 0.32, true),
  [MUSIC.BOSS_OR_FINAL]: route('audio-assets/Boss_Battle_Sequence.wav', 0.36, true),
  [MUSIC.LEVEL_COMPLETE]: route('audio-assets/vibraphone_level_complete.wav', 0.38, true),
};

export const LEVEL_MUSIC_BY_TOPIC: Record<string, MusicKey> = {
  'Safe Browsing Practices': MUSIC.LEVEL_1_SAFE_BROWSING,
  'Password Security': MUSIC.LEVEL_2_PASSWORD_SECURITY,
  Malware: MUSIC.LEVEL_3_MALWARE,
  'Social Engineering': MUSIC.LEVEL_4_SOCIAL_ENGINEERING,
  'Incident Response': MUSIC.LEVEL_5_INCIDENT_RESPONSE,
};

export function loadAudioAssets(scene: Phaser.Scene): void {
  Object.entries(AUDIO_ROUTES).forEach(([key, config]) => {
    if (!config.src) return;
    scene.load.audio(key, config.src);
  });
}

export function getAudioRoute(key: AudioKey): AudioRoute {
  return AUDIO_ROUTES[key];
}
