import { BaseIntegratedLevel } from '../core/BaseIntegratedLevel';
import { LEVEL_CONFIGS } from '../core/LevelConfigurations';
import {
  PasswordChallengePopup,
  PasswordEvaluation,
} from '../../helpers/password-challenge-popup';
import { AssessmentResult, gameAPI } from '../../helpers/game-api';
import { DialogueManager } from '../../helpers/DialogueManager';
import { DialogueUI } from '../ui/DialogueUI';
import { TOUCH_EVENTS } from '../../consts';
import { AudioManager, MUSIC, SFX } from '../../audio';

type DoorState = {
  zone: number;
  sprites: Phaser.Physics.Arcade.Sprite[];
  opened: boolean;
};

type FragmentState = {
  zone: number;
  sprite: Phaser.Physics.Arcade.Sprite;
  opened: boolean;
};

type SpikeTriggerState = {
  zone: number;
  sprite: Phaser.Physics.Arcade.Sprite;
  aura: Phaser.GameObjects.Arc;
  active: boolean;
  completed: boolean;
  sparks: Phaser.GameObjects.Arc[];
};

type WizardState = {
  zone: number;
  visual: Phaser.GameObjects.Container;
  parts: Phaser.GameObjects.Sprite[];
  frameSets: number[][];
  homeX: number;
  homeY: number;
  targetX: number;
  targetY: number;
  nextMoveAt: number;
  freed: boolean;
  sealed: boolean;
  timer?: Phaser.Time.TimerEvent;
};

type MinionState = {
  number: number;
  sprite: Phaser.GameObjects.Sprite;
  aura: Phaser.GameObjects.Arc;
  sealed: boolean;
  timer?: Phaser.Time.TimerEvent;
};

type PSBossState = {
  index: number;
  sprite: Phaser.GameObjects.Container;
  homeX: number;
  homeY: number;
  targetX: number;
  targetY: number;
  nextMoveAt: number;
  completed: boolean;
};

type MalwareThreat = {
  sprite: Phaser.Physics.Arcade.Sprite;
  aura: Phaser.GameObjects.Arc;
  homeX: number;
  homeY: number;
  targetX: number;
  targetY: number;
  nextDecisionAt: number;
  stunnedUntil: number;
  disabled: boolean;
  quarantined: boolean;
  quarantineEffects?: Phaser.GameObjects.GameObject[];
};

type WitnessState = {
  index: number;
  visual: Phaser.GameObjects.Container;
  completed: boolean;
  timer?: Phaser.Time.TimerEvent;
};

type Interactable = {
  x: number;
  y: number;
  prompt: string;
  action: () => void;
};

type ReportPhase = {
  key: string;
  label: string;
  prompt: string;
  choices: string[];
  answer: string;
  responderClue: string;
  feedbackCorrect: string;
  feedbackWrong: string;
};

type ReportBossOverlay = {
  element: HTMLDivElement;
  removeListeners: () => void;
};

const ROOM_ZONES = [1, 2, 3, 4];
const BOSS_GATE_ZONE = 5;
const FINAL_EXIT_ZONE = 6;
const INTERACTION_DISTANCE = 54;
const BOSS_GATE_DISTANCE = 84;

const MEMORY_FRAGMENT_FRAME = 469;
const SPIKE_TRIGGER_FRAME = 658;
const SPIKE_CLOSED_FRAME = 356;
const SPIKE_RETRACT_FRAMES = [355, 354, 353];
const LEVER_OFF_FRAME = 389;
const LEVER_ON_FRAME = 390;
const MAX_PLAYER_HEALTH = 6;
const MALWARE_TOUCH_DAMAGE = 1;
const MALWARE_ATTACK_COOLDOWN = 2200;
const MALWARE_BLOCK_STUN_DURATION = 1400;
const MALWARE_QUARANTINE_DURATION = 9000;
const MALWARE_ROOM_RADIUS = 176;
const MAX_EXTRA_WITNESSES = 3;
const ROOM_PATROL_RADIUS = 18;
const WIZARD_PATROL_SPEED = 0.018;
const PASSWORD_BOSS_PATROL_SPEED = 0.016;
const MAIN_BOSS_PATROL_SPEED = 0.008;
const MAIN_BOSS_PATROL_RADIUS = 14;
const ACTOR_DEPTH = 2;

const IR_PROGRESS_METRICS = {
  passwordRoomComplete: 'ir_password_room_complete',
  coreDoorOpened: 'ir_core_door_opened',
  bossReportComplete: 'ir_boss_report_complete',
  bossReportPhaseIndex: 'ir_boss_report_phase_index',
  bossReportPhase: (phaseKey: string) => `ir_boss_report_phase_${phaseKey}`,
  roomComplete: (zone: number) => `ir_room_${zone}_complete`,
  roomReleased: (zone: number) => `ir_room_${zone}_released`,
};

const DOOR_CLOSED = { topL: 450, topR: 451, botL: 482, botR: 483 };
const DOOR_OPEN = { topL: 453, topR: 454, botL: 485, botR: 486 };

const ROOM_DETAILS: Record<number, {
  title: string;
  fragmentDialogue: string;
  lockedMessage: string;
  releasedMessage: string;
}> = {
  1: {
    title: 'Identify Fragment',
    fragmentDialogue: 'The first memory points to the source. Read the evidence, answer every marker, then release the Identify responder.',
    lockedMessage: 'The skull seal is quiet. The evidence in this room is not complete yet.',
    releasedMessage: 'Identify is restored. The responder can now trace the incident source.',
  },
  2: {
    title: 'Contain Fragment',
    fragmentDialogue: 'The second memory holds the breached account. Contain it by proving the replacement passwords are strong and fictional.',
    lockedMessage: 'The containment seal is still locked. Defeat both password guardians first.',
    releasedMessage: 'Containment is restored. The responder can block further account misuse.',
  },
  3: {
    title: 'Eradicate Fragment',
    fragmentDialogue: 'The third memory is unstable. This shard anchors your respawn here. Block the malware and reach the scanner angel to quarantine the threat.',
    lockedMessage: 'The eradication seal is still active. The malware must be quarantined first.',
    releasedMessage: 'Eradication is restored. The responder can remove the isolated threat.',
  },
  4: {
    title: 'Recover Fragment',
    fragmentDialogue: 'The fourth memory contains witness logs. Interview each witness, choose the safe response, then recover the final responder.',
    lockedMessage: 'The recovery seal still listens for witness reports. Finish every interview first.',
    releasedMessage: 'Recovery is restored. The responder can bring the system back safely.',
  },
};

const WIZARD_FRAME_SETS: Record<number, number[][]> = {
  1: makeFramePairs(264, 296, 9),
  2: makeFramePairs(328, 360, 9),
  3: makeFramePairs(264, 296, 9),
  4: makeFramePairs(328, 360, 9),
};

const WITNESS_FRAME_SETS = [
  makeFramePairs(8, 40, 9),
  makeFramePairs(72, 104, 9),
];

const PS_BOSS_DRAGON_FRAMES = [424, 488];
const BOSS_FRAME_SETS = makeFrameQuads(737, 738, 769, 770, 8);
const ANGEL_FRAMES = makeRange(759, 766);
const MALWARE_FRAMES = [
  makeRange(375, 382),
  makeRange(439, 446),
  makeRange(503, 510),
];

const REPORT_PHASES: ReportPhase[] = [
  {
    key: 'identify',
    label: 'Identify',
    prompt: 'What should be confirmed first when an incident is detected?',
    choices: [
      'Identify the suspicious activity or affected system',
      'Delete all system logs',
      'Ignore the warning',
      'Immediately restore backups',
    ],
    answer: 'Identify the suspicious activity or affected system',
    responderClue: 'Identify responder: Start with evidence. Name what happened, where it happened, and what may have caused it.',
    feedbackCorrect: 'Incident source identified. Report section repaired.',
    feedbackWrong: 'Incorrect. The report still lacks proper identification.',
  },
  {
    key: 'contain',
    label: 'Contain',
    prompt: 'What should be done immediately to prevent the incident from spreading?',
    choices: [
      'Disconnect or isolate the affected device',
      'Share the password with others',
      'Keep using the infected device',
      'Delete the report',
    ],
    answer: 'Disconnect or isolate the affected device',
    responderClue: 'Contain responder: Stop the spread before trying to restore anything.',
    feedbackCorrect: 'Threat contained. Report section repaired.',
    feedbackWrong: 'Incorrect. Containment must prevent further spread.',
  },
  {
    key: 'eradicate',
    label: 'Eradicate',
    prompt: 'After containment, what should be done to remove the threat?',
    choices: [
      'Quarantine or remove the malware/cause of compromise',
      'Open more suspicious files',
      'Disable all security tools permanently',
      'Post the incident online',
    ],
    answer: 'Quarantine or remove the malware/cause of compromise',
    responderClue: 'Eradicate responder: The cause has to be removed, not ignored or hidden.',
    feedbackCorrect: 'Threat eradicated. Report section repaired.',
    feedbackWrong: 'Incorrect. Eradication means removing the cause of compromise.',
  },
  {
    key: 'recover',
    label: 'Recover',
    prompt: 'What should be done after the threat has been removed?',
    choices: [
      'Restore safe data/systems and verify normal operation',
      'Reuse the compromised password',
      'Delete backups',
      'Skip verification',
    ],
    answer: 'Restore safe data/systems and verify normal operation',
    responderClue: 'Recover responder: Bring systems back only after the threat is gone, then verify they are safe.',
    feedbackCorrect: 'Recovery verified. Report section repaired.',
    feedbackWrong: 'Incorrect. Recovery requires safe restoration and verification.',
  },
  {
    key: 'lessons',
    label: 'Lessons Learned',
    prompt: 'What should be done after the incident is resolved?',
    choices: [
      'Document the incident and update prevention steps',
      'Forget the incident happened',
      'Delete all evidence',
      'Disable future reports',
    ],
    answer: 'Document the incident and update prevention steps',
    responderClue: 'Recovered responders: Close the loop. Document the incident so it is harder to repeat.',
    feedbackCorrect: 'Lessons documented. Final report completed.',
    feedbackWrong: 'Incorrect. Post-incident review is needed to prevent recurrence.',
  },
];

function makeRange(start: number, end: number): number[] {
  const frames: number[] = [];

  for (let frame = start; frame <= end; frame += 1) {
    frames.push(frame);
  }

  return frames;
}

function makeFramePairs(
  topStart: number,
  bottomStart: number,
  count: number
): number[][] {
  return Array.from({ length: count }, (_, index) => [
    topStart + index,
    bottomStart + index,
  ]);
}

function makeFrameQuads(
  topLeftStart: number,
  topRightStart: number,
  bottomLeftStart: number,
  bottomRightStart: number,
  count: number
): number[][] {
  return Array.from({ length: count }, (_, index) => {
    const frameOffset = index * 2;
    return [
      topLeftStart + frameOffset,
      topRightStart + frameOffset,
      bottomLeftStart + frameOffset,
      bottomRightStart + frameOffset,
    ];
  });
}

export class IRLevel extends BaseIntegratedLevel {
  private doors = new Map<number, DoorState[]>();
  private fragments = new Map<number, FragmentState>();
  private spikeGates = new Map<number, Phaser.Physics.Arcade.Sprite[]>();
  private spikeTriggers = new Map<number, SpikeTriggerState>();
  private wizards = new Map<number, WizardState>();
  private minions = new Map<number, MinionState>();
  private psBosses: PSBossState[] = [];
  private witnesses: WitnessState[] = [];
  private witnessSpawnPoints: any[] = [];
  private malwareThreats: MalwareThreat[] = [];
  private roomChallengesComplete = new Set<number>();
  private roomRespondersReleased = new Set<number>();
  private challengePasswords = new Map<number, string>();
  private movementHistory: Phaser.Math.Vector2[] = [];
  private ambientEffects: Phaser.GameObjects.GameObject[] = [];
  private animationTimers: Phaser.Time.TimerEvent[] = [];
  private bossVisual?: Phaser.GameObjects.Container;
  private bossAura?: Phaser.GameObjects.Arc;
  private bossBlocker?: Phaser.GameObjects.Zone;
  private bossPatrol?: {
    homeX: number;
    homeY: number;
    targetX: number;
    targetY: number;
    nextMoveAt: number;
  };
  private bossGatePoint?: Phaser.Math.Vector2;
  private doorWallsLayer?: Phaser.Tilemaps.TilemapLayer;
  private lever?: Phaser.Physics.Arcade.Sprite;
  private energyGraphics?: Phaser.GameObjects.Graphics;
  private interactionPrompt?: Phaser.GameObjects.Text;
  private reportBossOverlay?: ReportBossOverlay;
  private reportOverlaySuspendedInputs: Array<{
    scene: Phaser.Scene;
    enabled: boolean;
  }> = [];
  private interactKey?: Phaser.Input.Keyboard.Key;
  private passwordPopup!: PasswordChallengePopup;
  private playerHealth = MAX_PLAYER_HEALTH;
  private zoneThreeRespawnActive = false;
  private minionSealingStarted = false;
  private bossReady = false;
  private bossReportComplete = false;
  private leverReady = false;
  private finalShutdownComplete = false;
  private reportBossStarted = false;
  private currentReportPhaseIndex = 0;
  private reportAwaitingContinue = false;
  private reportFeedback = '';
  private touchInteractRequested = false;
  private extraWitnessesSpawned = 0;
  private unlockedZone = 1;
  private savedProgressMetrics: Record<string, number> = {};
  private roomOneQuestionIds = new Set<string>();
  private roomOneAnsweredQuestionIds = new Set<string>();
  private usedWitnessQuestionKeys = new Set<string>();
  private completedReportPhaseKeys = new Set<string>();

  constructor() {
    super(LEVEL_CONFIGS.IR);
  }

  async create(): Promise<void> {
    this.resetState();
    await this.loadSavedLevelProgress();

    await super.create();

    this.createAdditionalMapLayers();
    this.passwordPopup = new PasswordChallengePopup(this);
    this.interactKey = this.input.keyboard?.addKey(
      Phaser.Input.Keyboard.KeyCodes.E
    );
    this.game.events.on(TOUCH_EVENTS.interact, this.handleTouchInteract, this);

    this.initDoors();
    this.initSpikeGates();
    this.initMemoryFragments();
    this.initSpikeTriggers();
    this.initWizards();
    this.initPSBosses();
    this.initWitnesses();
    this.initMalwareRoom();
    this.initBossRoom();
    this.initLever();
    this.applySavedLevelProgress();
    this.createInteractionPrompt();
    this.createSystemHealthUI();
    this.completeMissingRoomContent();

    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.passwordPopup.destroy();
      this.interactKey?.removeAllListeners();
      this.game.events.off(TOUCH_EVENTS.interact, this.handleTouchInteract, this);
      this.animationTimers.forEach(timer => timer.destroy());
      this.malwareThreats.forEach(threat => {
        this.tweens.killTweensOf([
          threat.sprite,
          threat.aura,
          ...(threat.quarantineEffects ?? []),
        ]);
      });
      this.destroyReportBossOverlay();
      this.game.events.emit('health:hide');
    });
  }

  update(): void {
    this.updateInteractionPrompt();
    super.update();
    this.updateRoomPatrols();
    this.updateFollowers();
    this.updateMalwareThreats();
    this.updateEnergyLines();
    this.updateActorDepths();
  }

  protected initAssessment(): void {
    this.questions = this.dedupeQuestionsById(this.questions);

    const points = this.map.filterObjects(
      'QuestionPoints',
      object => object.name === 'QuestionPoint'
    ) ?? [];
    const zoneOnePoints = points.filter(point => this.getZoneNumber(point) === 1);
    const overflowPoints = points.filter(point => !this.getZoneNumber(point));
    const orderedPoints = [...zoneOnePoints, ...overflowPoints];
    const questionCount = Math.min(this.questions.length, orderedPoints.length);

    if (questionCount < this.questions.length) {
      console.warn(
        `IR level has ${this.questions.length} questions but only ${orderedPoints.length} question points. Trimming to placed points.`
      );
    }

    this.questions = this.questions.slice(0, questionCount);
    this.totalquestions = questionCount;
    this.roomOneQuestionIds.clear();
    this.roomOneAnsweredQuestionIds.clear();

    this.questionPoints = orderedPoints
      .slice(0, questionCount)
      .map((point, questionIndex) => {
        const question = this.questions[questionIndex];
        const pointZone = this.getZoneNumber(point);
        const qpbottom = this.physics.add
          .sprite(point.x ?? 0, point.y ?? 0, 'tiles_spr', 340)
          .setScale(1.5);
        const qptop = this.physics.add
          .sprite(point.x ?? 0, (point.y ?? 0) - 16, 'tiles_spr', 308)
          .setScale(1.5);

        qpbottom.once('destroy', () => this.tweens.killTweensOf(qpbottom));
        qptop.once('destroy', () => this.tweens.killTweensOf(qptop));

        this.tweens.add({
          targets: [qpbottom, qptop],
          y: '-=4',
          duration: 900,
          yoyo: true,
          repeat: -1,
          ease: 'Sine.easeInOut',
        });
        this.tweens.add({
          targets: [qpbottom, qptop],
          alpha: 0.7,
          duration: 800,
          yoyo: true,
          repeat: -1,
          ease: 'Sine.easeInOut',
        });

        const pair = [qpbottom, qptop] as any;
        pair.questionIndex = questionIndex;
        pair.zone = pointZone;
        pair.questionId = question?.question_id;

        if (pointZone === 1 && question?.question_id) {
          this.roomOneQuestionIds.add(String(question.question_id));
        }

        return pair;
      });

    if (this.roomOneQuestionIds.size === 0 && this.questions.length > 0) {
      this.questions.forEach(question => {
        if (question?.question_id) {
          this.roomOneQuestionIds.add(String(question.question_id));
        }
      });
    }
  }

  protected initKnowledge(): void {
    const points = this.map.filterObjects(
      'KnowledgePoints',
      object => object.name === 'KnowledgePoint'
    ) ?? [];
    const zoneOnePoints = points.filter(point => this.getZoneNumber(point) === 1);
    const overflowPoints = points.filter(point => !this.getZoneNumber(point));
    const orderedPoints = [...zoneOnePoints, ...overflowPoints];

    this.knowledgePoints = orderedPoints
      .slice(0, this.knowledgeList.length)
      .map((point, index) => {
        const sprite = this.physics.add
          .sprite(point.x ?? 0, point.y ?? 0, 'tiles_spr', 627)
          .setScale(1.5);

        sprite.setImmovable(true);
        this.disableSpriteGravity(sprite);

        const pair = [sprite] as any;
        const knowledge = this.knowledgeList[index];

        pair.isOpen = false;
        pair.isAnimating = false;
        pair.wasTouching = false;
        pair.knowledge = {
          knowledge_id: knowledge.knowledge_id,
          question_id: knowledge.question_id,
          knowledge_content: knowledge.knowledge_content,
          subtopic: knowledge.subtopic,
          subtopic_key: knowledge.subtopic_key,
        };

        return pair;
      });
  }

  protected onQuestionAnswered(
    _result: AssessmentResult,
    _context: any
  ): void {
    const questionId = String(_result?.question_id ?? '');
    if (this.roomOneQuestionIds.has(questionId)) {
      this.roomOneAnsweredQuestionIds.add(questionId);
    }

    if (
      this.roomOneQuestionIds.size > 0 &&
      this.roomOneAnsweredQuestionIds.size >= this.roomOneQuestionIds.size
    ) {
      if (!this.roomChallengesComplete.has(1)) {
        this.recordGameplayMetric('rooms_completed');
      }
      this.markRoomChallengeComplete(1);
    }
  }

  protected async completeAssessment(): Promise<void> {
    if (!this.finalShutdownComplete) return;
    await super.completeAssessment();
  }

  protected shouldUpdateKnowledgeInteractionPrompt(): boolean {
    return false;
  }

  private resetState(): void {
    this.doors.clear();
    this.fragments.clear();
    this.spikeGates.clear();
    this.spikeTriggers.clear();
    this.wizards.clear();
    this.minions.clear();
    this.psBosses = [];
    this.witnesses = [];
    this.witnessSpawnPoints = [];
    this.malwareThreats = [];
    this.roomChallengesComplete.clear();
    this.roomRespondersReleased.clear();
    this.challengePasswords.clear();
    this.movementHistory = [];
    this.ambientEffects = [];
    this.animationTimers = [];
    this.bossVisual = undefined;
    this.bossAura = undefined;
    this.bossBlocker = undefined;
    this.bossGatePoint = undefined;
    this.doorWallsLayer = undefined;
    this.lever = undefined;
    this.energyGraphics = undefined;
    this.interactionPrompt = undefined;
    this.reportBossOverlay = undefined;
    this.interactKey = undefined;
    this.playerHealth = MAX_PLAYER_HEALTH;
    this.zoneThreeRespawnActive = false;
    this.minionSealingStarted = false;
    this.bossReady = false;
    this.bossReportComplete = false;
    this.bossPatrol = undefined;
    this.leverReady = false;
    this.finalShutdownComplete = false;
    this.reportBossStarted = false;
    this.currentReportPhaseIndex = 0;
    this.reportAwaitingContinue = false;
    this.reportFeedback = '';
    this.questionPoints = [];
    this.knowledgePoints = [];
    this.assessmentResults = [];
    this.assessmentCompleted = false;
    this.inAssessment = false;
    this.extraWitnessesSpawned = 0;
    this.unlockedZone = 1;
    this.savedProgressMetrics = {};
    this.roomOneQuestionIds.clear();
    this.roomOneAnsweredQuestionIds.clear();
    this.usedWitnessQuestionKeys.clear();
    this.completedReportPhaseKeys.clear();
  }

  private createAdditionalMapLayers(): void {
    this.doorWallsLayer = this.map.createLayer(
      'Door-walls',
      this.tileset,
      0,
      0
    ) ?? undefined;
    this.doorWallsLayer?.setDepth(3);
    this.doorWallsLayer?.setCollisionByExclusion([-1]);
    this.map.createLayer('Pillar', this.tileset, 0, 0)?.setDepth(9);
    this.player.setDepth(ACTOR_DEPTH);
  }

  private initDoors(): void {
    const doorObjects = this.map.filterObjects(
      'Door-correct',
      object => object.name === 'DoorCorrectPoint'
    ) ?? [];

    doorObjects.forEach(object => {
      const zone = this.getZoneNumber(object);
      if (!zone) return;

      const door = this.spawnDoor(object, zone);
      const zoneDoors = this.doors.get(zone) ?? [];
      zoneDoors.push(door);
      this.doors.set(zone, zoneDoors);

      if (zone === BOSS_GATE_ZONE) {
        this.bossGatePoint = new Phaser.Math.Vector2(
          object.x ?? 0,
          object.y ?? 0
        );
      }
    });
  }

  private spawnDoor(object: any, zone: number): DoorState {
    const x = object.x ?? 0;
    const y = object.y ?? 0;

    const botL = this.physics.add.staticSprite(
      x - 8,
      y,
      'tiles_spr',
      DOOR_CLOSED.botL
    ).setDepth(4);
    const botR = this.physics.add.staticSprite(
      x + 8,
      y,
      'tiles_spr',
      DOOR_CLOSED.botR
    ).setDepth(4);
    const topL = this.physics.add.staticSprite(
      x - 8,
      y - 16,
      'tiles_spr',
      DOOR_CLOSED.topL
    ).setDepth(6);
    const topR = this.physics.add.staticSprite(
      x + 8,
      y - 16,
      'tiles_spr',
      DOOR_CLOSED.topR
    ).setDepth(6);

    this.physics.add.collider(this.player, botL);
    this.physics.add.collider(this.player, botR);

    const sprites = [botL, botR, topL, topR];

    this.tweens.add({
      targets: sprites,
      alpha: 0.68,
      duration: 700,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.easeInOut',
    });

    return {
      zone,
      sprites,
      opened: false,
    };
  }

  private initSpikeGates(): void {
    const points = this.map.filterObjects(
      'SpikePoints',
      object => object.name === 'SpikePoint'
    ) ?? [];

    points.forEach(point => {
      const zone = this.getZoneNumber(point);
      if (!zone) return;

      const spike = this.physics.add
        .staticSprite(point.x ?? 0, point.y ?? 0, 'tiles_spr', SPIKE_CLOSED_FRAME)
        .setDepth(5);

      this.physics.add.collider(this.player, spike);

      const gate = this.spikeGates.get(zone) ?? [];
      gate.push(spike);
      this.spikeGates.set(zone, gate);
    });
  }

  private initMemoryFragments(): void {
    const points = this.map.filterObjects(
      'MemoryFragmentPoints',
      object => object.name === 'MemoryFragmentPoint'
    ) ?? [];

    points.forEach(point => {
      const zone = this.getZoneNumber(point);
      if (!ROOM_ZONES.includes(zone)) return;

      const x = point.x ?? 0;
      const y = point.y ?? 0;
      const sprite = this.physics.add
        .sprite(x, y, 'tiles_spr', MEMORY_FRAGMENT_FRAME)
        .setScale(1.35)
        .setDepth(6);

      sprite.setImmovable(true);
      this.disableSpriteGravity(sprite);

      this.tweens.add({
        targets: sprite,
        y: sprite.y - 5,
        duration: 900,
        yoyo: true,
        repeat: -1,
        ease: 'Sine.easeInOut',
      });

      this.fragments.set(zone, {
        zone,
        sprite,
        opened: false,
      });
    });
  }

  private initSpikeTriggers(): void {
    const points = this.map.filterObjects(
      'SpikeTriggerPoints',
      object => object.name === 'SpikeTriggerPoint'
    ) ?? [];

    points.forEach(point => {
      const zone = this.getZoneNumber(point);
      if (!ROOM_ZONES.includes(zone)) return;

      const x = point.x ?? 0;
      const y = point.y ?? 0;
      const aura = this.add
        .circle(x, y, 16, 0xffd166, 0.1)
        .setStrokeStyle(2, 0xfff0a8, 0.35)
        .setDepth(5);
      const sprite = this.physics.add
        .sprite(x, y, 'tiles_spr', SPIKE_TRIGGER_FRAME)
        .setScale(1.55)
        .setDepth(6)
        .setAlpha(0.68)
        .setTint(0x6b6f7a);

      sprite.setImmovable(true);
      this.disableSpriteGravity(sprite);

      this.tweens.add({
        targets: sprite,
        scale: { from: 1.45, to: 1.65 },
        alpha: { from: 0.5, to: 0.85 },
        duration: 850,
        yoyo: true,
        repeat: -1,
        ease: 'Sine.easeInOut',
      });
      this.tweens.add({
        targets: aura,
        scale: { from: 0.75, to: 1.45 },
        alpha: { from: 0.08, to: 0.22 },
        duration: 900,
        yoyo: true,
        repeat: -1,
        ease: 'Sine.easeInOut',
      });

      this.spikeTriggers.set(zone, {
        zone,
        sprite,
        aura,
        active: false,
        completed: false,
        sparks: [],
      });
    });
  }

  private initWizards(): void {
    const points = this.map.filterObjects(
      'Wizard',
      object => object.name === 'WizardPoint'
    ) ?? [];

    points.forEach(point => {
      const zone = this.getZoneNumber(point);
      const frameSets = WIZARD_FRAME_SETS[zone];
      if (!frameSets) return;

      const wizard = this.createCompositeActor(
        point.x ?? 0,
        point.y ?? 0,
        frameSets,
        1.35,
        ACTOR_DEPTH
      );

      wizard.visual.setAlpha(0.76);
      wizard.visual.setVisible(true);
      this.setContainerTint(wizard.visual, 0x6f7a86);

      this.wizards.set(zone, {
        zone,
        visual: wizard.visual,
        parts: wizard.parts,
        frameSets,
        homeX: wizard.visual.x,
        homeY: wizard.visual.y,
        targetX: wizard.visual.x,
        targetY: wizard.visual.y,
        nextMoveAt: 0,
        freed: false,
        sealed: false,
        timer: wizard.timer,
      });
    });
  }

  private initPSBosses(): void {
    const points = this.map.filterObjects(
      'PSBossPoints',
      object => object.name === 'BossPoint'
    ) ?? [];

    points.forEach((point, index) => {
      const boss = this.createDragonBossActor(
        point.x ?? 0,
        point.y ?? 0,
        PS_BOSS_DRAGON_FRAMES[index % PS_BOSS_DRAGON_FRAMES.length],
        2,
        ACTOR_DEPTH
      );

      this.psBosses.push({
        index,
        sprite: boss.visual,
        homeX: boss.visual.x,
        homeY: boss.visual.y,
        targetX: boss.visual.x,
        targetY: boss.visual.y,
        nextMoveAt: 0,
        completed: false,
      });
    });
  }

  private initWitnesses(): void {
    const points = this.map.filterObjects(
      'NPCPoints',
      object => object.name === 'NPCPoint'
    ) ?? [];
    this.witnessSpawnPoints = points;

    points.forEach((point, index) => {
      const frameSets = WITNESS_FRAME_SETS[index % WITNESS_FRAME_SETS.length];
      const witness = this.createCompositeActor(
        point.x ?? 0,
        point.y ?? 0,
        frameSets,
        1.25,
        ACTOR_DEPTH
      );

      this.witnesses.push({
        index,
        visual: witness.visual,
        completed: false,
        timer: witness.timer,
      });
    });
  }

  private initMalwareRoom(): void {
    const points = this.map.filterObjects(
      'MalwareAngel',
      object => object.name === 'MalwarePoint'
    ) ?? [];
    const angelPoint = this.map.filterObjects(
      'MalwareAngel',
      object => object.name === 'MalwareAngelPoint'
    )?.[0];

    points.forEach((point, index) => {
      const frameSet = MALWARE_FRAMES[index % MALWARE_FRAMES.length];
      const sprite = this.physics.add
        .sprite(point.x ?? 0, point.y ?? 0, 'tiles_spr', frameSet[0])
        .setScale(1.35)
        .setDepth(ACTOR_DEPTH);
      const aura = this.add
        .circle(sprite.x, sprite.y + 5, 15, 0xff3333, 0.18)
        .setStrokeStyle(1, 0xff7777, 0.42)
        .setDepth(ACTOR_DEPTH - 0.1);

      sprite.setData('frames', frameSet);
      sprite.setData('frameIndex', 0);
      sprite.setData('lastHitAt', 0);
      sprite.setCollideWorldBounds(true);
      this.physics.add.collider(sprite, this.wallsLayer);
      this.physics.add.collider(sprite, this.wallsLayer2);
      if (this.doorWallsLayer) {
        this.physics.add.collider(sprite, this.doorWallsLayer);
      }
      this.getDoorBlockers().forEach(blocker => {
        this.physics.add.collider(sprite, blocker);
      });
      this.physics.add.overlap(this.player, sprite, () => {
        const threat = this.malwareThreats.find(item => item.sprite === sprite);
        if (threat) this.handleMalwareHit(threat);
      });

      const timer = this.time.addEvent({
        delay: 145,
        loop: true,
        callback: () => {
          if (!sprite.active) return;
          if (sprite.getData('quarantined') === true) return;

          const nextIndex =
            ((sprite.getData('frameIndex') as number) + 1) % frameSet.length;
          sprite.setData('frameIndex', nextIndex);
          sprite.setFrame(frameSet[nextIndex]);
        },
      });

      this.animationTimers.push(timer);
      this.tweens.add({
        targets: aura,
        scale: { from: 0.85, to: 1.25 },
        alpha: { from: 0.1, to: 0.36 },
        duration: 620,
        yoyo: true,
        repeat: -1,
        ease: 'Sine.easeInOut',
      });

      this.malwareThreats.push({
        sprite,
        aura,
        homeX: sprite.x,
        homeY: sprite.y,
        targetX: sprite.x,
        targetY: sprite.y,
        nextDecisionAt: 0,
        stunnedUntil: 0,
        disabled: false,
        quarantined: false,
      });
    });

    if (angelPoint) {
      const angel = this.physics.add
        .sprite(angelPoint.x ?? 0, angelPoint.y ?? 0, 'tiles_spr', ANGEL_FRAMES[0])
        .setScale(1.45)
        .setDepth(ACTOR_DEPTH);

      angel.setName('MalwareAngelActor');
      angel.setImmovable(true);
      this.disableSpriteGravity(angel);
      angel.setData('frameIndex', 0);

      const timer = this.time.addEvent({
        delay: 140,
        loop: true,
        callback: () => {
          const nextIndex =
            ((angel.getData('frameIndex') as number) + 1) % ANGEL_FRAMES.length;
          angel.setData('frameIndex', nextIndex);
          angel.setFrame(ANGEL_FRAMES[nextIndex]);
        },
      });
      this.animationTimers.push(timer);

      this.createPulseAura(angel.x, angel.y + 4, 22, 0x93f7ff, 0.16);
      this.ambientEffects.push(angel);
    }
  }

  private initBossRoom(): void {
    const bossPoint = this.map.filterObjects(
      'MainBossSpawn',
      object => object.name === 'BossPoint'
    )?.[0];

    if (bossPoint) {
      const boss = this.createFourPartBossActor(
        bossPoint.x ?? 0,
        bossPoint.y ?? 0,
        BOSS_FRAME_SETS,
        2.1,
        ACTOR_DEPTH
      );

      this.bossVisual = boss.visual;
      this.bossPatrol = {
        homeX: boss.visual.x,
        homeY: boss.visual.y,
        targetX: boss.visual.x,
        targetY: boss.visual.y,
        nextMoveAt: 0,
      };
      this.bossAura = this.createPulseAura(
        boss.visual.x,
        boss.visual.y + 16,
        54,
        0xff3333,
        0.2
      );
      this.bossAura.setDepth(ACTOR_DEPTH - 0.1);
      this.bossBlocker = this.add.zone(boss.visual.x, boss.visual.y + 16, 76, 132);
      this.physics.add.existing(this.bossBlocker, true);
      this.physics.add.collider(this.player, this.bossBlocker);
    }

    this.initBossMinions();
    this.initBossEffects();
    this.energyGraphics = this.add.graphics().setDepth(5);
  }

  private initBossMinions(): void {
    const points = this.map.filterObjects(
      'BossMinion',
      object => object.name === 'BossMinionPoint'
    ) ?? [];

    points.forEach(point => {
      const number = Number(
        this.getProperty(point, 'minion_number') ?? 0
      );
      if (!number) return;

      const frames = number % 2 === 0
        ? makeRange(695, 702)
        : makeRange(631, 638);
      const sprite = this.add
        .sprite(point.x ?? 0, point.y ?? 0, 'tiles_spr', frames[0])
        .setScale(1.45)
        .setDepth(ACTOR_DEPTH);
      const aura = this.add
        .circle(sprite.x, sprite.y + 4, 16, 0xff2222, 0.2)
        .setStrokeStyle(1, 0xffaaaa, 0.45)
        .setDepth(ACTOR_DEPTH - 0.1);

      sprite.setData('frameIndex', 0);

      const timer = this.time.addEvent({
        delay: 145,
        loop: true,
        callback: () => {
          if (!sprite.active) return;
          const nextIndex =
            ((sprite.getData('frameIndex') as number) + 1) % frames.length;
          sprite.setData('frameIndex', nextIndex);
          sprite.setFrame(frames[nextIndex]);
        },
      });
      this.animationTimers.push(timer);

      this.tweens.add({
        targets: [sprite, aura],
        y: '-=3',
        duration: 850 + number * 80,
        yoyo: true,
        repeat: -1,
        ease: 'Sine.easeInOut',
      });
      this.tweens.add({
        targets: aura,
        scale: { from: 0.9, to: 1.35 },
        alpha: { from: 0.12, to: 0.38 },
        duration: 740,
        yoyo: true,
        repeat: -1,
        ease: 'Sine.easeInOut',
      });

      this.minions.set(number, {
        number,
        sprite,
        aura,
        sealed: false,
        timer,
      });
    });
  }

  private initBossEffects(): void {
    const points = this.map.filterObjects(
      'BossEffectPoints',
      object => object.name === 'BossEffectPoint'
    ) ?? [];

    points.forEach((point, index) => {
      const spark = this.add
        .circle(point.x ?? 0, point.y ?? 0, 2, 0xff784d, 0.85)
        .setDepth(5);

      this.tweens.add({
        targets: spark,
        y: spark.y - Phaser.Math.Between(6, 14),
        scale: { from: 0.7, to: 1.9 },
        alpha: { from: 0.15, to: 0.9 },
        duration: 650 + index * 70,
        delay: index * 90,
        yoyo: true,
        repeat: -1,
        ease: 'Sine.easeInOut',
      });

      this.ambientEffects.push(spark);
    });
  }

  private initLever(): void {
    const point = this.map.filterObjects(
      'ShutDownLeverPoint',
      object => object.name === 'ShutDownLever'
    )?.[0];

    if (!point) return;

    const lever = this.physics.add
      .sprite(point.x ?? 0, point.y ?? 0, 'tiles_spr', LEVER_OFF_FRAME)
      .setScale(1.5)
      .setDepth(ACTOR_DEPTH)
      .setAlpha(0.5)
      .setTint(0x7a7a7a);

    lever.setImmovable(true);
    this.disableSpriteGravity(lever);
    this.lever = lever;
  }

  private createInteractionPrompt(): void {
    this.interactionPrompt = this.add
      .text(0, 0, 'Press E / ACT', {
        fontFamily: 'Verdana, Arial, Helvetica, sans-serif',
        fontSize: '13px',
        color: '#ffffff',
        backgroundColor: '#111820',
        padding: { x: 6, y: 4 },
      })
      .setOrigin(0.5)
      .setScale(1 / this.cameras.main.zoom)
      .setDepth(200)
      .setVisible(false);
  }

  private updateInteractionPrompt(): void {
    const touchInteract = this.consumeTouchInteractRequest();

    if (!this.player || this.inAssessment) {
      this.interactionPrompt?.setVisible(false);
      return;
    }

    if (
      this.allRespondersReleased() &&
      !this.minionSealingStarted &&
      this.playerNearBossGate(210)
    ) {
      this.startMinionSealing();
    }

    const interactable = this.findNearestInteractable();

    if (!interactable) {
      this.interactionPrompt?.setVisible(false);
      return;
    }

    this.interactionPrompt
      ?.setText(interactable.prompt)
      .setPosition(interactable.x, interactable.y - 34)
      .setVisible(true);

    if (touchInteract || (
      this.interactKey &&
      Phaser.Input.Keyboard.JustDown(this.interactKey)
    )) {
      interactable.action();
    }
  }

  private handleTouchInteract(): void {
    this.touchInteractRequested = true;
  }

  private consumeTouchInteractRequest(): boolean {
    const requested = this.touchInteractRequested;
    this.touchInteractRequested = false;
    return requested;
  }

  private findNearestInteractable(): Interactable | undefined {
    const candidates: Interactable[] = [];

    this.knowledgePoints.forEach((point: any) => {
      if (point.isOpen || point.isAnimating) return;
      const sprite = point[0] as Phaser.GameObjects.Sprite | undefined;
      if (!sprite?.active) return;

      candidates.push({
        x: sprite.x,
        y: sprite.y,
        prompt: 'Press E / ACT to open chest',
        action: () => this.openKnowledgeChest(point),
      });
    });

    this.questionPoints.forEach((pointPair: any) => {
      const sprite = pointPair[0] as Phaser.GameObjects.Sprite | undefined;
      const questionIndex = pointPair.questionIndex;

      if (
        pointPair.taskDone ||
        !sprite?.active ||
        this.questions[questionIndex] === undefined
      ) {
        return;
      }

      candidates.push({
        x: sprite.x,
        y: sprite.y,
        prompt: 'Press E / ACT to answer question',
        action: () => this.startQuestionAtPoint(
          pointPair,
          this.getQuestionInteractContext(pointPair)
        ),
      });
    });

    this.fragments.forEach(fragment => {
      if (fragment.opened) return;
      candidates.push({
        x: fragment.sprite.x,
        y: fragment.sprite.y,
        prompt: 'Press E / ACT to read fragment',
        action: () => this.openMemoryFragment(fragment.zone),
      });
    });

    this.spikeTriggers.forEach(trigger => {
      if (trigger.completed) return;
      candidates.push({
        x: trigger.sprite.x,
        y: trigger.sprite.y,
        prompt: trigger.active
          ? 'Press E / ACT to release responder'
          : 'Press E / ACT to inspect seal',
        action: () => this.handleSpikeTrigger(trigger.zone),
      });
    });

    this.psBosses.forEach(boss => {
      if (boss.completed) return;
      candidates.push({
        x: boss.sprite.x,
        y: boss.sprite.y,
        prompt: 'Press E / ACT to contain account',
        action: () => this.startPSBossChallenge(boss),
      });
    });

    const angel = this.ambientEffects.find(
      object => object instanceof Phaser.GameObjects.Sprite &&
        object.name === 'MalwareAngelActor'
    ) as Phaser.GameObjects.Sprite | undefined;

    if (angel && !this.roomChallengesComplete.has(3)) {
      candidates.push({
        x: angel.x,
        y: angel.y,
        prompt: 'Press E / ACT to activate scanner',
        action: () => this.startAngelChallenge(),
      });
    }

    this.witnesses.forEach(witness => {
      if (witness.completed) return;
      candidates.push({
        x: witness.visual.x,
        y: witness.visual.y,
        prompt: 'Press E / ACT to interview witness',
        action: () => this.startWitnessChallenge(witness),
      });
    });

    if (
      this.bossGatePoint &&
      !this.bossReady &&
      !this.minionSealingStarted
    ) {
      candidates.push({
        x: this.bossGatePoint.x,
        y: this.bossGatePoint.y,
        prompt: 'Press E / ACT to inspect core gate',
        action: () => this.inspectBossGate(),
      });
    }

    if (this.bossReady && !this.bossReportComplete) {
      const reportPoint = this.bossVisual ?? this.bossGatePoint;
      if (reportPoint) {
      candidates.push({
        x: reportPoint.x,
        y: reportPoint.y,
        prompt: 'Press E / ACT to complete report',
        action: () => this.startBossReport(),
      });
      }
    }

    if (this.lever && !this.finalShutdownComplete) {
      candidates.push({
        x: this.lever.x,
        y: this.lever.y,
        prompt: this.leverReady
          ? 'Press E / ACT to shut down core'
          : 'Press E / ACT to inspect lever',
        action: () => this.handleLeverInteraction(),
      });
    }

    return candidates
      .map(candidate => ({
        candidate,
        distance: Phaser.Math.Distance.Between(
          this.player.x,
          this.player.y,
          candidate.x,
          candidate.y
        ),
      }))
      .filter(item => {
        const range = item.candidate.prompt.includes('core gate')
          ? BOSS_GATE_DISTANCE
          : INTERACTION_DISTANCE;
        return item.distance <= range;
      })
      .sort((a, b) => a.distance - b.distance)[0]?.candidate;
  }

  private openMemoryFragment(zone: number): void {
    const fragment = this.fragments.get(zone);
    if (!fragment || fragment.opened) return;

    fragment.opened = true;
    AudioManager.playSfx(this, SFX.MEMORY_FRAGMENT_OPEN);
    this.tweens.killTweensOf(fragment.sprite);
    fragment.sprite.setTint(0x8cf7ff).setAlpha(1);

    if (zone === 3) {
      this.zoneThreeRespawnActive = true;
      this.currentZone = 3;
      void this.saveCurrentZone(3, 3);
    }

    const details = ROOM_DETAILS[zone];
    this.showInfo(details.title, details.fragmentDialogue, () => {
      this.openDoorByZone(zone);
    });
  }

  private handleSpikeTrigger(zone: number): void {
    const trigger = this.spikeTriggers.get(zone);
    if (!trigger || trigger.completed) return;

    if (!trigger.active) {
      const details = ROOM_DETAILS[zone];
      AudioManager.playSfx(this, SFX.RESPONDER_SEAL_LOCKED);
      this.showInfo('Responder Seal', details.lockedMessage);
      return;
    }

    trigger.completed = true;
    AudioManager.playSfx(this, SFX.RESPONDER_SEAL_ACTIVATE);
    this.tweens.killTweensOf([trigger.sprite, trigger.aura]);
    trigger.aura.destroy();
    trigger.sparks.forEach(spark => spark.destroy());
    trigger.sparks = [];
    trigger.sprite.setTint(0x8cff9a).setAlpha(1).setScale(1.55);

    this.openSpikeGate(zone, true);
    const hasWizard = this.wizards.has(zone);
    this.releaseWizard(zone);
    if (!hasWizard) {
      this.roomRespondersReleased.add(zone);
    }
  }

  private startPSBossChallenge(boss: PSBossState): void {
    if (boss.completed) return;

    this.inAssessment = true;
    AudioManager.playSfx(this, SFX.PASSWORD_BOSS_START);
    this.player.lockMovement();
    this.interactionPrompt?.setVisible(false);

    const challenge = this.getPSChallenge(boss.index);

    this.passwordPopup.show(
      {
        title: challenge.title,
        instructions: challenge.instructions,
        evaluate: challenge.evaluate,
        onAttempt: result => {
          this.recordGameplayMetric('password_attempts');
          this.recordGameplayMetric(
            result.passed ? 'password_successes' : 'password_failures'
          );
        },
      },
      password => {
        this.challengePasswords.set(boss.index, password);
        this.completePSBoss(boss);
      },
      () => {
        this.inAssessment = false;
        this.player.unlockMovement();
      }
    );
  }

  private completePSBoss(boss: PSBossState): void {
    boss.completed = true;
    AudioManager.playSfx(this, SFX.PASSWORD_BOSS_COMPLETE);
    this.recordGameplayMetric('password_bosses_completed');
    this.tweens.add({
      targets: boss.sprite,
      alpha: 0,
      scaleX: Math.abs(boss.sprite.scaleX) * 1.2,
      scaleY: Math.abs(boss.sprite.scaleY) * 1.2,
      duration: 380,
      ease: 'Back.In',
      onComplete: () => boss.sprite.destroy(),
    });

    this.inAssessment = false;
    this.player.unlockMovement();

    if (this.psBosses.every(item => item.completed)) {
      if (!this.roomChallengesComplete.has(2)) {
        this.recordGameplayMetric('rooms_completed');
      }
      this.markRoomChallengeComplete(2);
      this.saveIncidentProgress(2, {
        [IR_PROGRESS_METRICS.passwordRoomComplete]: 1,
        [IR_PROGRESS_METRICS.roomComplete(2)]: 1,
      });
    }
  }

  private startAngelChallenge(): void {
    if (this.roomChallengesComplete.has(3)) return;

    this.recordGameplayMetric('malware_quarantined');
    AudioManager.playSfx(this, SFX.MALWARE_SCANNER_ACTIVATE);
    if (!this.roomChallengesComplete.has(3)) {
      this.recordGameplayMetric('rooms_completed');
    }
    this.disableMalwareThreats();
    this.markRoomChallengeComplete(3);
    this.saveIncidentProgress(3, {
      [IR_PROGRESS_METRICS.roomComplete(3)]: 1,
    });
    this.showInfo(
      'Virus Scanner',
      'The scanner temporarily quarantines the malware. Move while the threats are frozen and isolated.'
    );
  }

  private startWitnessChallenge(witness: WitnessState): void {
    if (witness.completed) return;

    const challenges = [
      {
        question: 'A witness says the alert started after a suspicious link. What should the report record?',
        answer: 'The suspicious link as the likely initial evidence',
        choices: [
          'The suspicious link as the likely initial evidence',
          'That no investigation is needed',
          'Only that the computer was slow',
          'A deleted copy of the browser history',
        ],
      },
      {
        question: 'A witness admits they reused a password. What recovery action matters most?',
        answer: 'Change exposed passwords and add a second factor',
        choices: [
          'Use the same password on fewer sites',
          'Change exposed passwords and add a second factor',
          'Write the password on a note',
          'Ignore it after the malware is gone',
        ],
      },
      {
        question: 'A witness received an urgent fake admin request. What should the report recommend?',
        answer: 'Verify requests through trusted channels',
        choices: [
          'Trust urgent requests faster next time',
          'Verify requests through trusted channels',
          'Forward credentials to the requester',
          'Delete the message without telling anyone',
        ],
      },
    ];
    const challenge = this.pickWitnessChallenge(challenges, witness.index);

    this.inAssessment = true;
    this.player.lockMovement();
    this.interactionPrompt?.setVisible(false);
    this.popup.mode = 'learning';
    this.popup.correctAnswer = challenge.answer;
    this.popup.show(challenge.question, challenge.choices, choice => {
      if (choice === challenge.answer) {
        this.recordGameplayMetric('witness_correct');
        AudioManager.playSfx(this, SFX.WITNESS_CORRECT);
        witness.completed = true;
        this.setContainerTint(witness.visual, 0x8cff9a);
        this.tweens.add({
          targets: witness.visual,
          alpha: 0.65,
          scaleX: witness.visual.scaleX * 0.92,
          scaleY: witness.visual.scaleY * 0.92,
          duration: 260,
          yoyo: true,
          ease: 'Sine.easeOut',
        });

        if (this.witnesses.every(item => item.completed)) {
          if (!this.roomChallengesComplete.has(4)) {
            this.recordGameplayMetric('rooms_completed');
          }
          this.markRoomChallengeComplete(4);
          this.saveIncidentProgress(4, {
            [IR_PROGRESS_METRICS.roomComplete(4)]: 1,
          });
        }
      } else {
        this.recordGameplayMetric('witness_wrong');
        AudioManager.playSfx(this, SFX.WITNESS_WRONG);
        this.spawnExtraWitness();
        this.cameras.main.shake(180, 0.004);
      }

      this.inAssessment = false;
      this.player.unlockMovement();
    });
  }

  private spawnExtraWitness(): void {
    if (this.extraWitnessesSpawned >= MAX_EXTRA_WITNESSES) return;
    if (this.roomChallengesComplete.has(4)) return;

    const index = this.witnesses.length;
    const sourcePoint = this.witnessSpawnPoints[
      this.extraWitnessesSpawned % Math.max(1, this.witnessSpawnPoints.length)
    ];
    const angle = Phaser.Math.DegToRad(55 + this.extraWitnessesSpawned * 95);
    const distance = 58 + this.extraWitnessesSpawned * 18;
    const baseX = Number(sourcePoint?.x ?? this.player.x);
    const baseY = Number(sourcePoint?.y ?? this.player.y);
    const x = Phaser.Math.Clamp(
      baseX + Math.cos(angle) * distance,
      32,
      this.map.widthInPixels - 32
    );
    const y = Phaser.Math.Clamp(
      baseY + Math.sin(angle) * distance,
      32,
      this.map.heightInPixels - 32
    );
    const frameSets = WITNESS_FRAME_SETS[index % WITNESS_FRAME_SETS.length];
    const witness = this.createCompositeActor(x, y, frameSets, 1.18, ACTOR_DEPTH);

    this.extraWitnessesSpawned += 1;
    AudioManager.playSfx(this, SFX.EXTRA_WITNESS_SPAWN);
    this.setContainerTint(witness.visual, 0xffd166);
    this.tweens.add({
      targets: witness.visual,
      scaleX: witness.visual.scaleX * 1.08,
      scaleY: witness.visual.scaleY * 1.08,
      duration: 180,
      yoyo: true,
      ease: 'Sine.easeOut',
    });

    this.witnesses.push({
      index,
      visual: witness.visual,
      completed: false,
      timer: witness.timer,
    });
  }

  private pickWitnessChallenge<T extends { question: string }>(
    challenges: T[],
    index: number
  ): T {
    const unused = challenges.filter(
      challenge => !this.usedWitnessQuestionKeys.has(challenge.question)
    );
    const pool = unused.length > 0 ? unused : challenges;
    const challenge = pool[index % pool.length];
    this.usedWitnessQuestionKeys.add(challenge.question);
    return challenge;
  }

  private inspectBossGate(): void {
    if (this.allRespondersReleased()) {
      this.startMinionSealing();
      return;
    }

    this.showInfo(
      'Core Gate Locked',
      'The incident core is protected by four unresolved response phases. Free every responder first: Identify, Contain, Eradicate, and Recover.'
    );
    AudioManager.playSfx(this, SFX.CORE_GATE_LOCKED);
  }

  private startBossReport(): void {
    if (!this.bossReady || this.bossReportComplete) return;

    AudioManager.playMusic(this, MUSIC.BOSS_OR_FINAL);
    AudioManager.playSfx(this, SFX.BOSS_REPORT_START);
    this.reportBossStarted = true;

    if (this.currentReportPhaseIndex > 0) {
      this.openReportBossOverlay();
      return;
    }

    this.showDialogue(
      'ir_boss_truth',
      () => this.openReportBossOverlay(),
      { unlockOnComplete: false }
    );
  }

  private openReportBossOverlay(): void {
    if (this.bossReportComplete) return;

    this.scene.bringToTop(this.scene.key);
    this.suspendReportBlockingInputs();
    this.inAssessment = true;
    this.player.lockMovement();
    this.interactionPrompt?.setVisible(false);
    this.reportAwaitingContinue = false;
    this.reportFeedback = '';
    this.createOrUpdateReportBossOverlay();
  }

  private createOrUpdateReportBossOverlay(): void {
    this.destroyReportBossOverlay(false);
    this.scene.bringToTop(this.scene.key);

    const phase = REPORT_PHASES[this.currentReportPhaseIndex];

    if (!phase) {
      this.completeBossReport();
      return;
    }

    const progress = this.getReportProgress();
    this.reportBossOverlay = this.createReportBossDomOverlay(phase, progress);
    this.highlightReportResponder();
  }

  private createReportChoiceButton(
    x: number,
    y: number,
    width: number,
    height: number,
    label: string,
    onSelect: () => void
  ): Phaser.GameObjects.Container {
    const background = this.add
      .rectangle(0, 0, width, height, 0x1d2b34, 1)
      .setOrigin(0, 0)
      .setStrokeStyle(1, 0x5deeff, 0.45);
    const text = this.add
      .text(12, Math.max(7, height / 2 - 8), label, {
        fontFamily: 'Verdana, Arial, Helvetica, sans-serif',
        fontSize: width < 420 ? '10px' : '11px',
        color: '#effcff',
        wordWrap: { width: width - 24 },
      })
      .setOrigin(0, 0);
    const touchHeight = Math.max(44, height);
    const touchOffsetY = (height - touchHeight) / 2;
    const touchZone = this.add
      .zone(0, touchOffsetY, width, touchHeight)
      .setOrigin(0, 0)
      .setInteractive(
        new Phaser.Geom.Rectangle(0, 0, width, touchHeight),
        Phaser.Geom.Rectangle.Contains
      );
    const button = this.add
      .container(x, y, [background, text, touchZone])
      .setSize(width, height);

    const setHover = () => {
      background.setFillStyle(0x25404a, 1);
      background.setStrokeStyle(1, 0x9dffff, 0.85);
    };
    const clearHover = () => {
      background.setFillStyle(0x1d2b34, 1);
      background.setStrokeStyle(1, 0x5deeff, 0.45);
    };
    let selected = false;
    const select = (
      _pointer?: Phaser.Input.Pointer,
      _localX?: number,
      _localY?: number,
      event?: Phaser.Types.Input.EventData
    ) => {
      event?.stopPropagation();

      if (selected || !button.active || !button.visible) return;

      selected = true;
      setHover();
      onSelect();
    };

    touchZone.on('pointerover', setHover);
    touchZone.on('pointerout', clearHover);
    touchZone.on('pointerdown', select);
    touchZone.on('pointerup', select);

    return button;
  }

  private createReportBossDomOverlay(
    phase: ReportPhase,
    progress: number
  ): ReportBossOverlay {
    type DomReportAction = {
      element: HTMLButtonElement;
      press: (event: Event) => void;
    };

    const overlay = document.createElement('div');
    overlay.className = 'phishy-ir-report-overlay';
    overlay.style.position = 'fixed';
    overlay.style.zIndex = '2147483647';
    overlay.style.display = 'flex';
    overlay.style.alignItems = 'center';
    overlay.style.justifyContent = 'center';
    overlay.style.padding = '16px';
    overlay.style.background = 'rgba(2, 6, 10, 0.34)';
    overlay.style.boxSizing = 'border-box';
    overlay.style.pointerEvents = 'auto';
    overlay.style.touchAction = 'manipulation';
    overlay.style.userSelect = 'none';
    overlay.style.webkitUserSelect = 'none';

    const panel = document.createElement('div');
    panel.style.width = 'min(680px, calc(100% - 18px))';
    panel.style.maxHeight = 'calc(100% - 18px)';
    panel.style.overflowY = 'auto';
    panel.style.boxSizing = 'border-box';
    panel.style.padding = '18px 22px';
    panel.style.border = '2px solid rgba(117, 247, 255, 0.86)';
    panel.style.background = 'rgba(17, 24, 32, 0.98)';
    panel.style.color = '#effcff';
    panel.style.fontFamily = 'Verdana, Arial, Helvetica, sans-serif';
    panel.style.boxShadow = '0 18px 42px rgba(0, 0, 0, 0.52)';
    panel.style.touchAction = 'manipulation';
    overlay.appendChild(panel);

    const title = document.createElement('div');
    title.textContent = 'CORRUPTED INCIDENT REPORT';
    title.style.fontSize = '18px';
    title.style.fontWeight = '700';
    title.style.letterSpacing = '0';
    panel.appendChild(title);

    const subtitle = document.createElement('div');
    subtitle.textContent = 'Reconstruct the response sequence to stabilize the core.';
    subtitle.style.marginTop = '4px';
    subtitle.style.fontSize = '12px';
    subtitle.style.color = '#a9cbd1';
    panel.appendChild(subtitle);

    const progressTrack = document.createElement('div');
    progressTrack.style.height = '10px';
    progressTrack.style.marginTop = '12px';
    progressTrack.style.background = '#26323a';
    progressTrack.style.overflow = 'hidden';
    panel.appendChild(progressTrack);

    const progressFill = document.createElement('div');
    progressFill.style.width = `${Math.round(progress * 100)}%`;
    progressFill.style.height = '100%';
    progressFill.style.background = '#5deeff';
    progressTrack.appendChild(progressFill);

    const progressText = document.createElement('div');
    progressText.textContent = `Report Resolved: ${Math.round(progress * 100)}%`;
    progressText.style.marginTop = '8px';
    progressText.style.fontSize = '12px';
    progressText.style.color = '#d7fbff';
    panel.appendChild(progressText);

    const checklist = document.createElement('div');
    checklist.style.marginTop = '10px';
    checklist.style.fontSize = '12px';
    checklist.style.lineHeight = '1.4';
    REPORT_PHASES.forEach((item, index) => {
      const completed = this.completedReportPhaseKeys.has(item.key);
      const active = index === this.currentReportPhaseIndex;
      const row = document.createElement('div');
      row.textContent = `${completed ? '[x]' : active ? '[>]' : '[ ]'} ${item.label}`;
      row.style.color = completed ? '#9dffb3' : active ? '#ffffff' : '#8ba4aa';
      row.style.fontWeight = active ? '700' : '400';
      checklist.appendChild(row);
    });
    panel.appendChild(checklist);

    const phaseTitle = document.createElement('div');
    phaseTitle.textContent = `Phase ${this.currentReportPhaseIndex + 1}: ${phase.label}`;
    phaseTitle.style.marginTop = '18px';
    phaseTitle.style.fontSize = '15px';
    phaseTitle.style.fontWeight = '700';
    panel.appendChild(phaseTitle);

    const prompt = document.createElement('div');
    prompt.textContent = phase.prompt;
    prompt.style.marginTop = '6px';
    prompt.style.fontSize = '13px';
    prompt.style.lineHeight = '1.35';
    panel.appendChild(prompt);

    const clue = document.createElement('div');
    clue.textContent = phase.responderClue;
    clue.style.marginTop = '16px';
    clue.style.fontSize = '12px';
    clue.style.lineHeight = '1.35';
    clue.style.color = '#b7f7c9';
    panel.appendChild(clue);

    const choices = document.createElement('div');
    choices.style.display = 'grid';
    choices.style.gap = '8px';
    choices.style.marginTop = '12px';
    panel.appendChild(choices);

    const domActions: DomReportAction[] = [];
    const addButton = (label: string, onPress: () => void) => {
      const button = document.createElement('button');
      button.type = 'button';
      button.textContent = label;
      button.style.width = '100%';
      button.style.minHeight = '44px';
      button.style.padding = '10px 12px';
      button.style.border = '1px solid rgba(93, 238, 255, 0.58)';
      button.style.borderRadius = '0';
      button.style.background = '#1d2b34';
      button.style.color = '#effcff';
      button.style.fontFamily = 'Verdana, Arial, Helvetica, sans-serif';
      button.style.fontSize = '12px';
      button.style.textAlign = 'left';
      button.style.cursor = 'pointer';
      button.style.touchAction = 'manipulation';
      button.style.pointerEvents = 'auto';
      button.style.setProperty('-webkit-tap-highlight-color', 'rgba(93, 238, 255, 0.24)');

      let selected = false;
      const press = (event: Event) => {
        event.preventDefault();
        event.stopPropagation();
        event.stopImmediatePropagation?.();

        if (selected) return;

        selected = true;
        button.style.background = '#25404a';
        button.style.borderColor = 'rgba(157, 255, 255, 0.92)';
        onPress();
      };

      button.addEventListener('pointerdown', press, { capture: true });
      button.addEventListener('touchstart', press, { capture: true, passive: false });
      button.addEventListener('mousedown', press, { capture: true });
      button.addEventListener('click', press, { capture: true });
      domActions.push({ element: button, press });
      choices.appendChild(button);
    };

    if (this.reportAwaitingContinue) {
      addButton(
        this.currentReportPhaseIndex >= REPORT_PHASES.length
          ? 'Finalize Report'
          : 'Continue Reconstruction',
        () => this.continueReportBoss()
      );
    } else {
      phase.choices.forEach(choice => {
        addButton(choice, () => this.handleReportChoice(choice));
      });
    }

    if (this.reportFeedback) {
      const feedback = document.createElement('div');
      feedback.textContent = this.reportFeedback;
      feedback.style.marginTop = '12px';
      feedback.style.fontSize = '12px';
      feedback.style.color = this.reportAwaitingContinue ? '#9dffb3' : '#ffd2d2';
      feedback.style.lineHeight = '1.35';
      panel.appendChild(feedback);
    }

    const syncToCanvas = () => {
      const rect = this.game.canvas.getBoundingClientRect();
      overlay.style.left = `${rect.left}px`;
      overlay.style.top = `${rect.top}px`;
      overlay.style.width = `${rect.width}px`;
      overlay.style.height = `${rect.height}px`;
    };
    const pressFromPoint = (event: Event, clientX: number, clientY: number) => {
      const action = domActions.find(({ element }) => {
        const rect = element.getBoundingClientRect();

        return (
          clientX >= rect.left &&
          clientX <= rect.right &&
          clientY >= rect.top &&
          clientY <= rect.bottom
        );
      });

      if (!action) return;

      action.press(event);
    };
    const capturePointerPress = (event: PointerEvent | MouseEvent) => {
      pressFromPoint(event, event.clientX, event.clientY);
    };
    const captureTouchPress = (event: TouchEvent) => {
      const touch = event.changedTouches[0] ?? event.touches[0];

      if (!touch) return;

      pressFromPoint(event, touch.clientX, touch.clientY);
    };

    syncToCanvas();
    window.addEventListener('resize', syncToCanvas);
    window.addEventListener('orientationchange', syncToCanvas);
    document.addEventListener('pointerdown', capturePointerPress, true);
    document.addEventListener('mousedown', capturePointerPress, true);
    document.addEventListener('click', capturePointerPress, true);
    document.addEventListener('touchstart', captureTouchPress, {
      capture: true,
      passive: false,
    });
    document.body.appendChild(overlay);

    return {
      element: overlay,
      removeListeners: () => {
        window.removeEventListener('resize', syncToCanvas);
        window.removeEventListener('orientationchange', syncToCanvas);
        document.removeEventListener('pointerdown', capturePointerPress, true);
        document.removeEventListener('mousedown', capturePointerPress, true);
        document.removeEventListener('click', capturePointerPress, true);
        document.removeEventListener('touchstart', captureTouchPress, true);
      },
    };
  }

  private handleReportChoice(choice: string): void {
    const phase = REPORT_PHASES[this.currentReportPhaseIndex];

    if (!phase) {
      this.completeBossReport();
      return;
    }

    if (choice === phase.answer) {
      this.recordGameplayMetric('report_answers_correct');
      AudioManager.playSfx(this, SFX.REPORT_ANSWER_CORRECT);
      this.completedReportPhaseKeys.add(phase.key);
      this.currentReportPhaseIndex += 1;
      this.reportAwaitingContinue = true;
      this.reportFeedback = phase.feedbackCorrect;
      this.saveReportBossProgress();
      this.repairCoreVisual();
      this.createOrUpdateReportBossOverlay();
      return;
    }

    this.recordGameplayMetric('report_retries');
    AudioManager.playSfx(this, SFX.REPORT_REJECTED);
    this.reportAwaitingContinue = false;
    this.reportFeedback = phase.feedbackWrong;
    this.createOrUpdateReportBossOverlay();
  }

  private continueReportBoss(): void {
    this.reportAwaitingContinue = false;
    this.reportFeedback = '';

    if (this.currentReportPhaseIndex >= REPORT_PHASES.length) {
      this.completeBossReport();
      return;
    }

    this.createOrUpdateReportBossOverlay();
  }

  private saveReportBossProgress(): void {
    const phaseMetrics = Object.fromEntries(
      Array.from(this.completedReportPhaseKeys).map(phaseKey => [
        IR_PROGRESS_METRICS.bossReportPhase(phaseKey),
        1,
      ])
    );

    this.saveIncidentProgress(BOSS_GATE_ZONE, {
      ...phaseMetrics,
      [IR_PROGRESS_METRICS.bossReportPhaseIndex]: this.currentReportPhaseIndex,
    });
  }

  private getReportProgress(): number {
    return Phaser.Math.Clamp(
      this.completedReportPhaseKeys.size / REPORT_PHASES.length,
      0,
      1
    );
  }

  private repairCoreVisual(animate = true): void {
    const progress = this.getReportProgress();
    const alpha = 1 - progress * 0.55;

    this.bossVisual?.setAlpha(alpha);
    this.bossAura
      ?.setFillStyle(0x5deeff, 0.12 + progress * 0.18)
      .setStrokeStyle(2, 0xbffcff, 0.35 + progress * 0.35);

    if (animate) {
      this.cameras.main.shake(120, 0.003 + progress * 0.003);
    }
  }

  private highlightReportResponder(): void {
    this.wizards.forEach((wizard, zone) => {
      if (!wizard.freed || wizard.sealed) return;

      if (zone === this.currentReportPhaseIndex + 1) {
        this.setContainerTint(wizard.visual, 0xb7f7c9);
        return;
      }

      this.clearContainerTint(wizard.visual);
    });
  }

  private destroyReportBossOverlay(restoreInputs = true): void {
    this.reportBossOverlay?.removeListeners();
    this.reportBossOverlay?.element.remove();
    this.reportBossOverlay = undefined;

    if (restoreInputs) {
      this.restoreReportBlockingInputs();
      this.restoreGameplayUiLayer();
    }
  }

  private suspendReportBlockingInputs(): void {
    if (this.reportOverlaySuspendedInputs.length > 0) return;

    ['ui-scene', 'admin-devtools-scene'].forEach(sceneKey => {
      const scene = this.scene.get(sceneKey);

      if (!scene || scene === this || !scene.scene.isActive()) return;

      this.reportOverlaySuspendedInputs.push({
        scene,
        enabled: scene.input.enabled,
      });
      scene.input.enabled = false;
    });

    this.scene.bringToTop(this.scene.key);
  }

  private restoreReportBlockingInputs(): void {
    this.reportOverlaySuspendedInputs.forEach(({ scene, enabled }) => {
      if (scene.scene.isActive()) {
        scene.input.enabled = enabled;
      }
    });
    this.reportOverlaySuspendedInputs = [];
  }

  private restoreGameplayUiLayer(): void {
    if (this.scene.isActive('ui-scene')) {
      this.scene.bringToTop('ui-scene');
    }
  }

  private completeBossReport(): void {
    this.bossReportComplete = true;
    this.destroyReportBossOverlay();
    AudioManager.playSfx(this, SFX.REPORT_ACCEPTED);
    this.recordGameplayMetric('report_completed');
    this.leverReady = true;
    this.inAssessment = false;
    this.player.unlockMovement();

    this.bossBlocker?.destroy();
    this.openDoorByZone(FINAL_EXIT_ZONE);
    this.saveIncidentProgress(FINAL_EXIT_ZONE, {
      [IR_PROGRESS_METRICS.bossReportComplete]: 1,
    });

    if (!this.lever) {
      this.showInfo(
        'Report Accepted',
        'The report is complete. No shutdown lever was found, so the reconstruction is closing automatically.',
        () => {
          this.finalShutdownComplete = true;
          this.recordGameplayMetric('final_shutdown');
          void this.completeAssessment();
        }
      );
      return;
    }

    this.lever?.clearTint().setAlpha(1);
    this.tweens.add({
      targets: this.lever,
      scale: { from: 1.35, to: 1.65 },
      duration: 720,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.easeInOut',
    });

    this.tweens.add({
      targets: [this.bossVisual, this.bossAura].filter(Boolean),
      alpha: 0.45,
      duration: 450,
      yoyo: true,
      repeat: 2,
    });

    this.showInfo(
      'Report Accepted',
      'The core has exposed the shutdown lever. Close the incident to leave the reconstruction.'
    );
  }

  private handleLeverInteraction(): void {
    if (!this.leverReady) {
      AudioManager.playSfx(this, SFX.LEVER_LOCKED);
      this.showInfo(
        'Lever Locked',
        'The shutdown lever will not respond until the incident report is complete.'
      );
      return;
    }

    if (!this.lever || this.finalShutdownComplete) return;

    this.finalShutdownComplete = true;
    this.recordGameplayMetric('final_shutdown');
    AudioManager.playSfx(this, SFX.LEVER_PULL);
    AudioManager.playSfx(this, SFX.FINAL_SHUTDOWN);
    this.lever.setFrame(LEVER_ON_FRAME);
    this.tweens.killTweensOf(this.lever);
    this.lever.setScale(1.55);
    this.cameras.main.shake(420, 0.008);
    this.flashShutdownEffects();
    this.inAssessment = true;
    this.player.lockMovement();
    this.interactionPrompt?.setVisible(false);

    this.cameras.main.once(Phaser.Cameras.Scene2D.Events.FADE_OUT_COMPLETE, () => {
      this.cameras.main.fadeIn(520, 0, 0, 0);
      this.showFinalCutscene();
    });
    this.cameras.main.fadeOut(720, 0, 0, 0);
  }

  private showFinalCutscene(): void {
    AudioManager.playSfx(this, SFX.ENDING_START);
    this.showDialogue(
      'ir_ending',
      () => void this.finishFinalStorySequence(),
      { unlockOnComplete: false }
    );
  }

  private async finishFinalStorySequence(): Promise<void> {
    await this.completeAssessment();
    this.scene.stop('ui-scene');

    this.cameras.main.once(Phaser.Cameras.Scene2D.Events.FADE_OUT_COMPLETE, () => {
      this.scene.start('credits-scene');
    });
    this.cameras.main.fadeOut(900, 0, 0, 0);
  }

  private markRoomChallengeComplete(zone: number): void {
    if (this.roomChallengesComplete.has(zone)) return;

    this.roomChallengesComplete.add(zone);
    this.saveIncidentProgress(zone, {
      [IR_PROGRESS_METRICS.roomComplete(zone)]: 1,
    });
    AudioManager.playSfx(this, SFX.RESPONDER_SEAL_ACTIVATE);
    const trigger = this.spikeTriggers.get(zone);
    if (!trigger) return;

    trigger.active = true;
    this.tweens.killTweensOf([trigger.sprite, trigger.aura]);
    trigger.sprite.clearTint().setAlpha(1).setScale(1.6);
    trigger.aura
      .setFillStyle(0x8cf7ff, 0.16)
      .setStrokeStyle(2, 0xd9ffff, 0.5)
      .setAlpha(0.55)
      .setScale(1);
    this.tweens.add({
      targets: trigger.sprite,
      scale: { from: 1.55, to: 1.9 },
      alpha: { from: 0.75, to: 1 },
      duration: 620,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.easeInOut',
    });
    this.tweens.add({
      targets: trigger.aura,
      scale: { from: 0.95, to: 1.65 },
      alpha: { from: 0.18, to: 0.45 },
      duration: 680,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.easeInOut',
    });

    for (let index = 0; index < 3; index += 1) {
      const spark = this.add
        .circle(trigger.sprite.x, trigger.sprite.y, 2, 0xa8f7ff, 0.9)
        .setDepth(trigger.sprite.depth + 1);
      trigger.sparks.push(spark);

      this.tweens.addCounter({
        from: (Math.PI * 2 * index) / 3,
        to: (Math.PI * 2 * index) / 3 + Math.PI * 2,
        duration: 1150 + index * 90,
        repeat: -1,
        ease: 'Linear',
        onUpdate: tween => {
          const angle = tween.getValue() ?? 0;
          spark.setPosition(
            trigger.sprite.x + Math.cos(angle) * 16,
            trigger.sprite.y + Math.sin(angle) * 11
          );
        },
      });
    }
  }

  private openSpikeGate(zone: number, animate: boolean): void {
    const gate = this.spikeGates.get(zone);
    if (!gate) return;
    if (animate) AudioManager.playSfx(this, SFX.SPIKE_GATE_RETRACT);

    gate.forEach(spike => {
      this.physics.world.disable(spike);

      if (!animate) {
        spike.setFrame(SPIKE_RETRACT_FRAMES[SPIKE_RETRACT_FRAMES.length - 1]);
        return;
      }

      SPIKE_RETRACT_FRAMES.forEach((frame, index) => {
        this.time.delayedCall(index * 90, () => spike.setFrame(frame));
      });
    });
  }

  private releaseWizard(zone: number): void {
    const wizard = this.wizards.get(zone);
    if (!wizard || wizard.freed) return;

    wizard.freed = true;
    AudioManager.playSfx(this, SFX.RESPONDER_RELEASED);
    this.recordGameplayMetric('responders_released');
    this.roomRespondersReleased.add(zone);
    this.saveIncidentProgress(Math.min(zone + 1, BOSS_GATE_ZONE), {
      [IR_PROGRESS_METRICS.roomReleased(zone)]: 1,
    });
    this.tweens.killTweensOf(wizard.visual);
    const releasePoint = this.getWizardReleasePoint(zone);
    wizard.visual.setPosition(releasePoint.x, releasePoint.y);
    this.clearContainerTint(wizard.visual);
    wizard.visual.setVisible(true).setAlpha(1);

    this.tweens.add({
      targets: wizard.visual,
      scaleX: 1.55,
      scaleY: 1.55,
      duration: 180,
      yoyo: true,
      ease: 'Back.Out',
    });

    this.showInfo(
      'Responder Released',
      ROOM_DETAILS[zone].releasedMessage
    );
  }

  private getWizardReleasePoint(zone: number): Phaser.Math.Vector2 {
    const trigger = this.spikeTriggers.get(zone);

    if (trigger) {
      return this.resolveNearestWalkablePoint(
        trigger.sprite.x,
        trigger.sprite.y - 28
      );
    }

    if (this.player) {
      return this.resolveNearestWalkablePoint(
        this.player.x - 28,
        this.player.y
      );
    }

    return new Phaser.Math.Vector2(0, 0);
  }

  private startMinionSealing(): void {
    if (this.minionSealingStarted || !this.allRespondersReleased()) return;

    this.minionSealingStarted = true;
    AudioManager.playSfx(this, SFX.MINION_SEALING_START);
    this.inAssessment = true;
    this.player.lockMovement();
    this.interactionPrompt?.setVisible(false);

    let completed = 0;

    ROOM_ZONES.forEach(zone => {
      const wizard = this.wizards.get(zone);
      const minion = this.minions.get(zone);

      if (!wizard || !minion) {
        completed += 1;
        return;
      }

      this.tweens.killTweensOf(wizard.visual);
      this.tweens.add({
        targets: wizard.visual,
        x: minion.sprite.x,
        y: minion.sprite.y - 34,
        scaleX: 1.45,
        scaleY: 1.45,
        duration: 850 + zone * 110,
        ease: 'Sine.easeInOut',
        onComplete: () => {
          this.sealMinion(wizard, minion);
          completed += 1;

          if (completed >= ROOM_ZONES.length) {
            this.finishMinionSealing();
          }
        },
      });
    });

    if (completed >= ROOM_ZONES.length) {
      this.finishMinionSealing();
    }
  }

  private sealMinion(wizard: WizardState, minion: MinionState): void {
    if (minion.sealed) return;

    minion.sealed = true;
    AudioManager.playSfx(this, SFX.MINION_SEALED);
    wizard.sealed = true;
    minion.timer?.destroy();
    this.tweens.killTweensOf([minion.sprite, minion.aura]);

    this.cameras.main.shake(160, 0.004);
    minion.sprite.setTint(0x7ae8ff);
    minion.aura.setFillStyle(0x7ae8ff, 0.2);
    minion.aura.setStrokeStyle(1, 0xd8fbff, 0.7);

    this.tweens.add({
      targets: [minion.sprite, minion.aura],
      alpha: 0.42,
      scale: 0.75,
      duration: 420,
      ease: 'Back.InOut',
    });
    this.tweens.add({
      targets: wizard.visual,
      y: wizard.visual.y - 8,
      duration: 520,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.easeInOut',
    });
  }

  private finishMinionSealing(): void {
    this.bossReady = true;
    AudioManager.playSfx(this, SFX.CORE_GATE_OPEN);
    this.openDoorByZone(BOSS_GATE_ZONE);
    this.saveIncidentProgress(BOSS_GATE_ZONE, {
      [IR_PROGRESS_METRICS.coreDoorOpened]: 1,
    });
    this.inAssessment = false;
    this.player.unlockMovement();

    this.showInfo(
      'Core Gate Open',
      'The responders have neutralized the four incident blockers. The core is ready for the final report.'
    );
  }

  private openDoorByZone(zone: number, silent = false): void {
    const doors = this.doors.get(zone);
    if (!doors) return;
    if (!silent) AudioManager.playSfx(this, SFX.DOOR_OPEN);

    doors.forEach(door => {
      if (door.opened) return;
      door.opened = true;
      door.sprites.forEach(sprite => {
        this.tweens.killTweensOf(sprite);
        this.physics.world.disable(sprite);
        sprite.setAlpha(1);

        const frame = Number(sprite.frame.name);

        if (frame === DOOR_CLOSED.topL) {
          sprite.setFrame(DOOR_OPEN.topL).setDepth(3);
        }

        if (frame === DOOR_CLOSED.topR) {
          sprite.setFrame(DOOR_OPEN.topR).setDepth(3);
        }

        if (frame === DOOR_CLOSED.botL) {
          sprite.setFrame(DOOR_OPEN.botL).setDepth(1);
        }

        if (frame === DOOR_CLOSED.botR) {
          sprite.setFrame(DOOR_OPEN.botR).setDepth(1);
        }
      });
    });
  }

  private updateFollowers(): void {
    const followingWizards = Array.from(this.wizards.values()).filter(
      wizard => wizard.freed && !wizard.sealed
    );

    if (!this.player || followingWizards.length === 0) return;

    const latest = this.movementHistory[0];
    if (
      !latest ||
      Phaser.Math.Distance.Between(
        latest.x,
        latest.y,
        this.player.x,
        this.player.y
      ) >= 2
    ) {
      this.movementHistory.unshift(
        new Phaser.Math.Vector2(this.player.x, this.player.y)
      );
      this.movementHistory.length = Math.min(this.movementHistory.length, 150);
    }

    followingWizards.forEach((wizard, index) => {
      const historyIndex = Math.min(
        this.movementHistory.length - 1,
        (index + 1) * 18
      );
      const target = this.movementHistory[historyIndex];
      if (!target) return;

      const oldX = wizard.visual.x;
      const distance = Phaser.Math.Distance.Between(
        wizard.visual.x,
        wizard.visual.y,
        target.x,
        target.y
      );

      if (distance > 180) {
        const safeTarget = this.resolveNearestWalkablePoint(target.x, target.y);
        wizard.visual.setPosition(safeTarget.x, safeTarget.y);
      } else {
        this.moveFollowerToward(wizard.visual, target, 0.18);
      }

      if (wizard.visual.x < oldX - 0.1) {
        wizard.visual.scaleX = -Math.abs(wizard.visual.scaleX);
      }

      if (wizard.visual.x > oldX + 0.1) {
        wizard.visual.scaleX = Math.abs(wizard.visual.scaleX);
      }

      wizard.visual.setDepth(ACTOR_DEPTH);
    });
  }

  private updateRoomPatrols(): void {
    const now = this.time.now;

    this.wizards.forEach(wizard => {
      if (wizard.freed || wizard.sealed) return;
      this.updatePatrolActor(
        wizard.visual,
        wizard,
        WIZARD_PATROL_SPEED,
        now
      );
    });

    this.psBosses.forEach(boss => {
      if (boss.completed) return;
      this.updatePatrolActor(
        boss.sprite,
        boss,
        PASSWORD_BOSS_PATROL_SPEED,
        now
      );
    });

    if (this.bossVisual && this.bossPatrol && !this.bossReportComplete) {
      this.updatePatrolActor(
        this.bossVisual,
        this.bossPatrol,
        MAIN_BOSS_PATROL_SPEED,
        now,
        MAIN_BOSS_PATROL_RADIUS
      );
      this.bossAura?.setPosition(this.bossVisual.x, this.bossVisual.y + 16);
      this.bossBlocker?.setPosition(this.bossVisual.x, this.bossVisual.y + 16);
    }
  }

  private updatePatrolActor(
    visual: Phaser.GameObjects.Container,
    patrol: {
      homeX: number;
      homeY: number;
      targetX: number;
      targetY: number;
      nextMoveAt: number;
    },
    speed: number,
    now: number,
    radius = ROOM_PATROL_RADIUS
  ): void {
    if (
      now >= patrol.nextMoveAt ||
      Phaser.Math.Distance.Between(
        visual.x,
        visual.y,
        patrol.targetX,
        patrol.targetY
      ) <= 3
    ) {
      const target = this.pickPatrolTarget(patrol.homeX, patrol.homeY, radius);
      patrol.targetX = target.x;
      patrol.targetY = target.y;
      patrol.nextMoveAt = now + Phaser.Math.Between(1100, 2200);
    }

    const oldX = visual.x;
    this.moveFollowerToward(
      visual,
      new Phaser.Math.Vector2(patrol.targetX, patrol.targetY),
      speed
    );

    if (visual.x < oldX - 0.1) {
      visual.scaleX = -Math.abs(visual.scaleX);
    } else if (visual.x > oldX + 0.1) {
      visual.scaleX = Math.abs(visual.scaleX);
    }
  }

  private pickPatrolTarget(
    x: number,
    y: number,
    radius = ROOM_PATROL_RADIUS
  ): Phaser.Math.Vector2 {
    for (let attempt = 0; attempt < 8; attempt += 1) {
      const angle = Phaser.Math.FloatBetween(0, Math.PI * 2);
      const distance = Phaser.Math.Between(10, radius);
      const targetX = x + Math.cos(angle) * distance;
      const targetY = y + Math.sin(angle) * distance;

      if (this.isEntityWalkable(targetX, targetY)) {
        return new Phaser.Math.Vector2(targetX, targetY);
      }
    }

    return this.resolveNearestWalkablePoint(x, y);
  }

  private updateActorDepths(): void {
    this.player?.setDepth(ACTOR_DEPTH);
    this.wizards.forEach(wizard => wizard.visual.setDepth(ACTOR_DEPTH));
    this.psBosses.forEach(boss => {
      if (!boss.completed && boss.sprite.active) boss.sprite.setDepth(ACTOR_DEPTH);
    });
    this.witnesses.forEach(witness => witness.visual.setDepth(ACTOR_DEPTH));
    this.malwareThreats.forEach(threat => {
      threat.sprite.setDepth(ACTOR_DEPTH);
      threat.aura.setDepth(ACTOR_DEPTH - 0.1);
    });
    this.minions.forEach(minion => {
      minion.sprite.setDepth(ACTOR_DEPTH);
      minion.aura.setDepth(ACTOR_DEPTH - 0.1);
    });
    this.bossVisual?.setDepth(ACTOR_DEPTH);
    this.bossAura?.setDepth(ACTOR_DEPTH - 0.1);
    this.lever?.setDepth(ACTOR_DEPTH);
  }

  private moveFollowerToward(
    visual: Phaser.GameObjects.Container,
    target: Phaser.Math.Vector2,
    amount: number
  ): void {
    const nextX = Phaser.Math.Linear(visual.x, target.x, amount);
    const nextY = Phaser.Math.Linear(visual.y, target.y, amount);

    if (this.isEntityWalkable(nextX, nextY)) {
      visual.setPosition(nextX, nextY);
      return;
    }

    if (this.isEntityWalkable(nextX, visual.y)) {
      visual.x = nextX;
    }

    if (this.isEntityWalkable(visual.x, nextY)) {
      visual.y = nextY;
    }
  }

  private resolveNearestWalkablePoint(x: number, y: number): Phaser.Math.Vector2 {
    if (this.isEntityWalkable(x, y)) {
      return new Phaser.Math.Vector2(x, y);
    }

    const offsets = [
      [0, 0],
      [0, 16],
      [0, -16],
      [-16, 0],
      [16, 0],
      [-16, 16],
      [16, 16],
      [-16, -16],
      [16, -16],
      [0, 32],
      [0, -32],
      [-32, 0],
      [32, 0],
    ];

    for (const [dx, dy] of offsets) {
      const candidateX = x + dx;
      const candidateY = y + dy;
      if (this.isEntityWalkable(candidateX, candidateY)) {
        return new Phaser.Math.Vector2(candidateX, candidateY);
      }
    }

    return new Phaser.Math.Vector2(this.player.x, this.player.y);
  }

  private isEntityWalkable(x: number, y: number): boolean {
    const samples = [
      [0, 0],
      [-10, 0],
      [10, 0],
      [0, -8],
      [0, 8],
    ];

    return samples.every(([dx, dy]) => this.isPointWalkable(x + dx, y + dy));
  }

  private isPointWalkable(x: number, y: number): boolean {
    const bounds = this.physics.world.bounds;
    if (x < bounds.left || x > bounds.right || y < bounds.top || y > bounds.bottom) {
      return false;
    }

    const floorTile = this.getTileAtWorld('Floor', x, y);
    if (!floorTile) return false;

    return ![
      this.wallsLayer,
      this.wallsLayer2,
    ].some(layer => this.tileBlocksAt(layer, x, y));
  }

  private getTileAtWorld(
    layerName: string,
    x: number,
    y: number
  ): Phaser.Tilemaps.Tile | null {
    const layer = this.map.getLayer(layerName)?.tilemapLayer as
      | Phaser.Tilemaps.TilemapLayer
      | undefined;

    return layer?.getTileAtWorldXY(x, y, false) ?? null;
  }

  private tileBlocksAt(
    layer: Phaser.Tilemaps.TilemapLayer | undefined,
    x: number,
    y: number
  ): boolean {
    const tile = layer?.getTileAtWorldXY(x, y, false);
    return Boolean(tile?.collides);
  }

  private updateMalwareThreats(): void {
    if (this.inAssessment) {
      this.malwareThreats.forEach(threat => threat.sprite.setVelocity(0));
      return;
    }

    this.malwareThreats.forEach(threat => {
      if (threat.disabled || !threat.sprite.active) return;

      if (threat.quarantined || threat.stunnedUntil > this.time.now) {
        threat.sprite.setVelocity(0, 0);
        threat.aura.setPosition(threat.sprite.x, threat.sprite.y + 5);
        this.updateQuarantineEffects(threat);
        return;
      }

      const distanceToPlayer = Phaser.Math.Distance.Between(
        threat.sprite.x,
        threat.sprite.y,
        this.player.x,
        this.player.y
      );

      if (
        distanceToPlayer < 150 &&
        this.isInsideMalwareRoom(threat, this.player.x, this.player.y) &&
        this.canMalwareSeePlayer(threat.sprite)
      ) {
        this.physics.moveToObject(threat.sprite, this.player, 62);
      } else {
        if (this.time.now >= threat.nextDecisionAt) {
          const angle = Phaser.Math.FloatBetween(0, Math.PI * 2);
          const radius = Phaser.Math.Between(18, 66);
          threat.targetX = threat.homeX + Math.cos(angle) * radius;
          threat.targetY = threat.homeY + Math.sin(angle) * radius;
          threat.nextDecisionAt = this.time.now + Phaser.Math.Between(700, 1300);
        }

        this.physics.moveTo(
          threat.sprite,
          threat.targetX,
          threat.targetY,
          38
        );
      }

      threat.aura.setPosition(threat.sprite.x, threat.sprite.y + 5);
      this.keepMalwareInsideRoom(threat);
      const body = threat.sprite.body as Phaser.Physics.Arcade.Body | null;
      if (body) {
        threat.sprite.setFlipX(body.velocity.x < 0);
      }
    });
  }

  private updateEnergyLines(): void {
    if (!this.energyGraphics || !this.bossVisual) return;

    this.energyGraphics.clear();

    const pulse = 0.28 + Math.sin(this.time.now / 180) * 0.12;
    this.minions.forEach(minion => {
      if (minion.sealed) return;

      this.energyGraphics?.lineStyle(2, 0xff3838, pulse);
      this.energyGraphics?.lineBetween(
        minion.sprite.x,
        minion.sprite.y,
        this.bossVisual?.x ?? minion.sprite.x,
        this.bossVisual?.y ?? minion.sprite.y
      );
    });
  }

  private handleMalwareHit(threat: MalwareThreat): void {
    if (this.inAssessment || threat.disabled || threat.quarantined) return;

    const now = this.time.now;
    const lastHitAt = Number(threat.sprite.getData('lastHitAt') ?? 0);
    if (now - lastHitAt < MALWARE_ATTACK_COOLDOWN) return;

    threat.sprite.setData('lastHitAt', now);

    if (this.player.isBlocking()) {
      this.blockMalwareHit(threat);
      return;
    }

    this.recordGameplayMetric('malware_hits');
    AudioManager.playSfx(this, SFX.MALWARE_HIT_PLAYER);
    AudioManager.playSfx(this, SFX.PLAYER_HIT);
    this.damagePlayer(threat.sprite, MALWARE_TOUCH_DAMAGE);
    this.knockPlayerAwayFrom(threat.sprite);

    if (this.playerHealth <= 0) {
      this.respawnPlayerAtZoneThree();
    }
  }

  private blockMalwareHit(threat: MalwareThreat): void {
    if (threat.quarantined) return;

    threat.stunnedUntil = this.time.now + MALWARE_BLOCK_STUN_DURATION;
    AudioManager.playSfx(this, SFX.MALWARE_BLOCKED);
    threat.sprite.setVelocity(0, 0);
    threat.sprite.setTint(0x9df7ff);
    threat.aura.setFillStyle(0x79f7ff, 0.32);
    this.recordGameplayMetric('malware_blocks');

    this.tweens.add({
      targets: threat.sprite,
      alpha: 0.45,
      duration: 80,
      yoyo: true,
      repeat: 5,
    });

    this.time.delayedCall(MALWARE_BLOCK_STUN_DURATION, () => {
      if (!threat.sprite.active || threat.disabled || threat.quarantined) return;

      threat.sprite.clearTint();
      threat.aura.setFillStyle(0xff3333, 0.18);
    });
  }

  private canMalwareSeePlayer(
    sprite: Phaser.Physics.Arcade.Sprite
  ): boolean {
    const line = new Phaser.Geom.Line(
      sprite.x,
      sprite.y,
      this.player.x,
      this.player.y
    );

    if (this.lineHitsBlockingTile(line)) return false;
    return !this.lineHitsClosedDoor(line);
  }

  private lineHitsBlockingTile(line: Phaser.Geom.Line): boolean {
    const distance = Phaser.Geom.Line.Length(line);
    const steps = Math.max(1, Math.ceil(distance / 8));
    const layers = [
      this.wallsLayer,
      this.wallsLayer2,
      this.doorWallsLayer,
    ].filter(Boolean) as Phaser.Tilemaps.TilemapLayer[];

    for (let step = 1; step < steps; step += 1) {
      const t = step / steps;
      const x = Phaser.Math.Linear(line.x1, line.x2, t);
      const y = Phaser.Math.Linear(line.y1, line.y2, t);

      if (
        layers.some(layer => {
          const tile = layer.getTileAtWorldXY(x, y);
          if (!tile || tile.index < 0) return false;

          return (
            tile.collides ||
            tile.properties?.collides === true ||
            layer === this.doorWallsLayer
          );
        })
      ) {
        return true;
      }
    }

    return false;
  }

  private lineHitsClosedDoor(line: Phaser.Geom.Line): boolean {
    return this.getDoorBlockers().some(blocker => {
      const body = blocker.body as Phaser.Physics.Arcade.StaticBody | null;
      if (!blocker.active || !body?.enable) return false;

      return Phaser.Geom.Intersects.LineToRectangle(
        line,
        blocker.getBounds()
      );
    });
  }

  private getDoorBlockers(): Phaser.Physics.Arcade.Sprite[] {
    return Array.from(this.doors.values())
      .flat()
      .filter(door => !door.opened)
      .flatMap(door => door.sprites.slice(0, 2));
  }

  private damagePlayer(
    target?: Phaser.GameObjects.Sprite,
    amount = 1
  ): void {
    this.recordGameplayMetric('incident_damage_taken', amount);
    this.playerHealth = Math.max(0, this.playerHealth - amount);
    this.updateHealthUI();

    target?.setTint(0xff3333);
    this.time.delayedCall(220, () => {
      if (target?.active) target.clearTint();
    });

    this.cameras.main.shake(160, 0.006);
  }

  private knockPlayerAwayFrom(source: Phaser.GameObjects.Sprite): void {
    const angle = Phaser.Math.Angle.Between(
      source.x,
      source.y,
      this.player.x,
      this.player.y
    );

    this.player.lockMovement();
    this.player.bodyRef().setVelocity(
      Math.cos(angle) * 170,
      Math.sin(angle) * 170
    );

    this.time.delayedCall(170, () => {
      if (!this.inAssessment) {
        this.player.unlockMovement();
      }
    });
  }

  private respawnPlayerAtZoneThree(): void {
    this.inAssessment = true;
    AudioManager.playSfx(this, SFX.PLAYER_RESPAWN);
    this.player.lockMovement();
    this.playerHealth = MAX_PLAYER_HEALTH;
    this.updateHealthUI();
    this.cameras.main.fadeOut(220, 0, 0, 0);

    this.time.delayedCall(260, () => {
      const spawn = this.getRespawnPoint(3);
      this.player.setPosition(spawn.x, spawn.y - 4);
      this.player.bodyRef().setVelocity(0, 0);
      this.cameras.main.fadeIn(260, 0, 0, 0);
      this.inAssessment = false;
      this.player.unlockMovement();
    });
  }

  private disableMalwareThreats(): void {
    this.malwareThreats.forEach(threat => {
      if (threat.disabled || threat.quarantined) return;

      threat.quarantined = true;
      AudioManager.playSfx(this, SFX.MALWARE_QUARANTINE_ACTIVATE);
      threat.sprite.setVelocity(0);
      this.tweens.killTweensOf([threat.sprite, threat.aura]);
      threat.sprite.stop();
      threat.sprite.setData('quarantined', true);
      threat.sprite.setTint(0x7df7ff);
      threat.sprite.disableBody(false, false);

      const ring = this.add
        .circle(threat.sprite.x, threat.sprite.y + 2, 18, 0x6beeff, 0.08)
        .setStrokeStyle(2, 0x9df7ff, 0.72)
        .setDepth(threat.sprite.depth + 1);
      const label = this.add
        .text(threat.sprite.x, threat.sprite.y - 24, 'QUARANTINED', {
          fontSize: '9px',
          color: '#bffcff',
          fontStyle: 'bold',
        })
        .setOrigin(0.5)
        .setDepth(threat.sprite.depth + 2);

      threat.quarantineEffects = [ring, label];
      threat.aura
        .setPosition(threat.sprite.x, threat.sprite.y + 5)
        .setFillStyle(0x59e7ff, 0.32)
        .setStrokeStyle(2, 0xbffcff, 0.58)
        .setAlpha(1)
        .setScale(1);

      this.tweens.add({
        targets: [threat.sprite, threat.aura, ring],
        alpha: { from: 0.58, to: 1 },
        duration: 110,
        yoyo: true,
        repeat: -1,
      });
      this.tweens.add({
        targets: ring,
        scale: { from: 0.9, to: 1.28 },
        duration: 680,
        yoyo: true,
        repeat: -1,
        ease: 'Sine.easeInOut',
      });

      this.time.delayedCall(MALWARE_QUARANTINE_DURATION, () => {
        this.releaseMalwareThreat(threat);
      });
    });
  }

  private releaseMalwareThreat(threat: MalwareThreat): void {
    if (!threat.sprite.active || threat.disabled || !threat.quarantined) return;

    threat.quarantined = false;
    threat.stunnedUntil = 0;
    threat.sprite.setData('quarantined', false);
    threat.sprite.clearTint();
    threat.sprite.enableBody(false, threat.sprite.x, threat.sprite.y, true, true);
    threat.aura
      .setPosition(threat.sprite.x, threat.sprite.y + 5)
      .setFillStyle(0xff3333, 0.18)
      .setStrokeStyle(1, 0xff7777, 0.42)
      .setAlpha(0.24)
      .setScale(1);
    this.tweens.killTweensOf([
      threat.sprite,
      threat.aura,
      ...(threat.quarantineEffects ?? []),
    ]);
    threat.quarantineEffects?.forEach(effect => effect.destroy());
    threat.quarantineEffects = undefined;

    this.tweens.add({
      targets: threat.aura,
      scale: { from: 0.85, to: 1.25 },
      alpha: { from: 0.1, to: 0.36 },
      duration: 620,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.easeInOut',
    });
  }

  private updateQuarantineEffects(threat: MalwareThreat): void {
    const [ring, label] = threat.quarantineEffects ?? [];
    if (ring instanceof Phaser.GameObjects.Arc) {
      ring.setPosition(threat.sprite.x, threat.sprite.y + 2);
    }
    if (label instanceof Phaser.GameObjects.Text) {
      label.setPosition(threat.sprite.x, threat.sprite.y - 24);
    }
  }

  private isInsideMalwareRoom(
    threat: MalwareThreat,
    x: number,
    y: number
  ): boolean {
    return Phaser.Math.Distance.Between(threat.homeX, threat.homeY, x, y) <= MALWARE_ROOM_RADIUS;
  }

  private keepMalwareInsideRoom(threat: MalwareThreat): void {
    if (this.isInsideMalwareRoom(threat, threat.sprite.x, threat.sprite.y)) return;

    threat.targetX = threat.homeX;
    threat.targetY = threat.homeY;
    this.physics.moveTo(threat.sprite, threat.homeX, threat.homeY, 55);
  }

  private getPSChallenge(index: number): {
    title: string;
    instructions: string;
    evaluate: (password: string) => PasswordEvaluation;
  } {
    if (index === 0) {
      return {
        title: 'Containment Guardian',
        instructions: 'Create a fictional replacement password with at least 12 characters and no common pattern.',
        evaluate: password => this.evaluateContainmentPassword(password),
      };
    }

    return {
      title: 'Account Recovery Guardian',
      instructions: 'Create a different fictional password with at least 14 characters for the recovered account.',
      evaluate: password => this.evaluateRecoveryPassword(password),
    };
  }

  private evaluateContainmentPassword(password: string): PasswordEvaluation {
    if (password.length < 12) {
      return {
        passed: false,
        message: `Use at least 12 characters: ${password.length}/12.`,
      };
    }

    if (this.hasCommonPattern(password)) {
      return {
        passed: false,
        message: 'Avoid common passwords, sequences, repetition, and keyboard patterns.',
      };
    }

    return {
      passed: true,
      message: 'Accepted: the compromised account can be contained.',
    };
  }

  private evaluateRecoveryPassword(password: string): PasswordEvaluation {
    if (password.length < 14) {
      return {
        passed: false,
        message: `Use at least 14 characters: ${password.length}/14.`,
      };
    }

    if (this.hasCommonPattern(password)) {
      return {
        passed: false,
        message: 'The recovered account still needs an unpredictable password.',
      };
    }

    const normalized = password.trim().toLowerCase();
    const reused = Array.from(this.challengePasswords.values()).some(
      previous => previous.trim().toLowerCase() === normalized
    );

    if (reused) {
      return {
        passed: false,
        message: 'Recovery needs a different password from containment.',
      };
    }

    return {
      passed: true,
      message: 'Accepted: the recovered account has a separate credential.',
    };
  }

  private hasCommonPattern(password: string): boolean {
    const normalized = password.trim().toLowerCase();
    const compact = normalized.replace(/[^a-z0-9]/g, '');

    if (!compact) return true;

    const obvious = [
      'password',
      'password1',
      'qwerty',
      'asdf',
      '1234',
      'abcd',
      'letmein',
      'welcome',
    ];

    return (
      obvious.some(pattern => compact.includes(pattern)) ||
      /(.)\1{3,}/.test(compact) ||
      /(0123|1234|2345|3456|4567|abcd)/.test(compact) ||
      (compact.length >= 10 && new Set(compact).size / compact.length < 0.45)
    );
  }

  private createCompositeActor(
    x: number,
    y: number,
    frameSets: number[][],
    scale: number,
    depth: number
  ): {
    visual: Phaser.GameObjects.Container;
    parts: Phaser.GameObjects.Sprite[];
    timer: Phaser.Time.TimerEvent;
  } {
    const aura = this.add
      .circle(0, 4, 14, 0xffffff, 0.1)
      .setStrokeStyle(1, 0xffffff, 0.28);
    const top = this.add.sprite(0, -8, 'tiles_spr', frameSets[0][0]);
    const bottom = this.add.sprite(0, 8, 'tiles_spr', frameSets[0][1]);
    const visual = this.add
      .container(x, y, [aura, top, bottom])
      .setScale(scale)
      .setDepth(depth);
    const parts = [top, bottom];

    visual.setData('frameIndex', 0);

    const timer = this.time.addEvent({
      delay: 150,
      loop: true,
      callback: () => {
        if (!visual.active) return;
        const nextIndex =
          ((visual.getData('frameIndex') as number) + 1) % frameSets.length;
        visual.setData('frameIndex', nextIndex);
        parts.forEach((part, partIndex) => {
          part.setFrame(frameSets[nextIndex][partIndex]);
        });
      },
    });

    this.animationTimers.push(timer);
    this.tweens.add({
      targets: aura,
      scale: { from: 0.85, to: 1.28 },
      alpha: { from: 0.08, to: 0.24 },
      duration: 780,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.easeInOut',
    });

    return {
      visual,
      parts,
      timer,
    };
  }

  private createDragonBossActor(
    x: number,
    y: number,
    frame: number,
    scale: number,
    depth: number
  ): {
    visual: Phaser.GameObjects.Container;
    parts: Phaser.GameObjects.Sprite[];
  } {
    const aura = this.add
      .circle(0, 4, 14, 0xffd166, 0.12)
      .setStrokeStyle(1, 0xfff0a8, 0.3);
    const dragon = this.add
      .sprite(0, 0, 'tiles_spr', frame)
      .setOrigin(0.5);
    const visual = this.add
      .container(x, y, [aura, dragon])
      .setScale(scale)
      .setDepth(depth);

    this.tweens.add({
      targets: aura,
      scale: { from: 0.85, to: 1.28 },
      alpha: { from: 0.08, to: 0.24 },
      duration: 780,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.easeInOut',
    });

    return {
      visual,
      parts: [dragon],
    };
  }

  private createFourPartBossActor(
    x: number,
    y: number,
    frameSets: number[][],
    scale: number,
    depth: number
  ): {
    visual: Phaser.GameObjects.Container;
    parts: Phaser.GameObjects.Sprite[];
    timer: Phaser.Time.TimerEvent;
  } {
    const topLeft = this.add.sprite(-8, -8, 'tiles_spr', frameSets[0][0]);
    const topRight = this.add.sprite(8, -8, 'tiles_spr', frameSets[0][1]);
    const bottomLeft = this.add.sprite(-8, 8, 'tiles_spr', frameSets[0][2]);
    const bottomRight = this.add.sprite(8, 8, 'tiles_spr', frameSets[0][3]);
    const visual = this.add
      .container(x, y, [topLeft, topRight, bottomLeft, bottomRight])
      .setScale(scale)
      .setDepth(depth);
    const parts = [topLeft, topRight, bottomLeft, bottomRight];

    visual.setData('frameIndex', 0);

    const timer = this.time.addEvent({
      delay: 150,
      loop: true,
      callback: () => {
        if (!visual.active) return;
        const nextIndex =
          ((visual.getData('frameIndex') as number) + 1) % frameSets.length;
        visual.setData('frameIndex', nextIndex);
        parts.forEach((part, partIndex) => {
          part.setFrame(frameSets[nextIndex][partIndex]);
        });
      },
    });

    this.animationTimers.push(timer);

    return {
      visual,
      parts,
      timer,
    };
  }

  private createPulseAura(
    x: number,
    y: number,
    radius: number,
    color: number,
    alpha: number
  ): Phaser.GameObjects.Arc {
    const aura = this.add
      .circle(x, y, radius, color, alpha)
      .setStrokeStyle(2, color, alpha + 0.18)
      .setDepth(4);

    this.tweens.add({
      targets: aura,
      scale: { from: 0.82, to: 1.18 },
      alpha: { from: alpha * 0.55, to: alpha + 0.22 },
      duration: 900,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.easeInOut',
    });

    return aura;
  }

  private setContainerTint(
    container: Phaser.GameObjects.Container,
    color: number
  ): void {
    container.list.forEach(child => {
      if (child instanceof Phaser.GameObjects.Sprite) {
        child.setTint(color);
      }
    });
  }

  private clearContainerTint(
    container: Phaser.GameObjects.Container
  ): void {
    container.list.forEach(child => {
      if (child instanceof Phaser.GameObjects.Sprite) {
        child.clearTint();
      }
    });
  }

  private disableSpriteGravity(sprite: Phaser.Physics.Arcade.Sprite): void {
    const body = sprite.body as Phaser.Physics.Arcade.Body | null;
    body?.setAllowGravity(false);
  }

  private flashShutdownEffects(): void {
    const burstPoints = [
      ...(this.lever ? [this.lever] : []),
      ...Array.from(this.minions.values()).map(minion => minion.sprite),
      ...(this.bossVisual ? [this.bossVisual] : []),
    ];

    burstPoints.forEach(point => {
      const burst = this.add
        .circle(point.x, point.y, 8, 0xffffff, 0.75)
        .setDepth(20);

      this.tweens.add({
        targets: burst,
        scale: 4,
        alpha: 0,
        duration: 520,
        ease: 'Quad.easeOut',
        onComplete: () => burst.destroy(),
      });
    });

    this.tweens.add({
      targets: [
        this.bossVisual,
        this.bossAura,
        ...Array.from(this.minions.values()).flatMap(minion => [
          minion.sprite,
          minion.aura,
        ]),
        ...this.ambientEffects,
      ].filter(Boolean),
      alpha: 0,
      duration: 900,
      ease: 'Sine.easeInOut',
    });
  }

  private showInfo(
    title: string,
    content: string,
    onClose?: () => void
  ): void {
    this.inAssessment = true;
    this.player.lockMovement();
    this.interactionPrompt?.setVisible(false);

    this.popup.showInfo(title, content, () => {
      this.inAssessment = false;
      this.player.unlockMovement();
      onClose?.();
    });
  }

  private showDialogue(
    scenarioId: string,
    onComplete?: () => void,
    options: { unlockOnComplete?: boolean } = {}
  ): void {
    const dialogueData = this.cache.json.get('general_dialogues');

    this.dialogueManager = new DialogueManager(dialogueData);
    this.dialogueUI = new DialogueUI(this, {
      continueSfx: scenarioId === 'ir_ending' ? SFX.UI_CLICK : undefined,
      typewriter: scenarioId === 'ir_ending',
    });

    this.inAssessment = true;
    this.player.lockMovement();
    this.interactionPrompt?.setVisible(false);

    try {
      const scenario = this.dialogueManager.getScenarioById(scenarioId);

      this.dialogueUI.start(scenario, () => {
        if (options.unlockOnComplete !== false) {
          this.inAssessment = false;
          this.player.unlockMovement();
        }
        onComplete?.();
      });
    } catch (error) {
      console.error(error);
      if (options.unlockOnComplete !== false) {
        this.inAssessment = false;
        this.player.unlockMovement();
      }
      onComplete?.();
    }
  }

  private allRespondersReleased(): boolean {
    return ROOM_ZONES.every(zone => this.roomRespondersReleased.has(zone));
  }

  private playerNearBossGate(distance: number): boolean {
    if (!this.bossGatePoint) return false;

    return Phaser.Math.Distance.Between(
      this.player.x,
      this.player.y,
      this.bossGatePoint.x,
      this.bossGatePoint.y
    ) <= distance;
  }

  private getRespawnPoint(zone: number): { x: number; y: number } {
    const spawn = this.map.filterObjects(
      'SpawnPoint',
      object =>
        object.name === 'SpawnPoint' &&
        this.getZoneNumber(object) === zone
    )?.[0];

    if (!spawn || !this.zoneThreeRespawnActive) {
      return { x: this.player.x, y: this.player.y };
    }

    return {
      x: spawn.x ?? this.player.x,
      y: spawn.y ?? this.player.y,
    };
  }

  private async loadSavedLevelProgress(): Promise<void> {
    try {
      gameAPI.setToken(this.userData.token);
      const response = await gameAPI.getUserProgress(this.userData.userId);
      const saved = response.data?.progress?.progress?.[this.config.topic];
      const metrics = saved?.gameplay?.metrics ?? {};

      this.currentZone = Number(saved?.current_zone ?? 0);
      this.unlockedZone = Number(saved?.unlocked_zone ?? 1);
      this.savedProgressMetrics = Object.fromEntries(
        Object.entries(metrics).map(([key, value]) => [key, Number(value)])
      );
    } catch (error) {
      console.error('Failed to load Incident Response progress', error);
      this.currentZone = 0;
      this.unlockedZone = 1;
      this.savedProgressMetrics = {};
    }
  }

  private applySavedLevelProgress(): void {
    ROOM_ZONES.forEach(zone => {
      if (
        this.hasSavedMetric(IR_PROGRESS_METRICS.roomReleased(zone)) ||
        this.unlockedZone > zone
      ) {
        this.restoreRoomAsReleased(zone);
        return;
      }

      if (this.hasSavedMetric(IR_PROGRESS_METRICS.roomComplete(zone))) {
        this.restoreRoomChallengeComplete(zone);
      }
    });

    if (
      this.hasSavedMetric(IR_PROGRESS_METRICS.passwordRoomComplete) ||
      this.unlockedZone > 2
    ) {
      this.restorePasswordRoomComplete();
    }

    if (
      this.hasSavedMetric(IR_PROGRESS_METRICS.coreDoorOpened) ||
      this.unlockedZone >= BOSS_GATE_ZONE
    ) {
      this.restoreCoreDoorOpened();
    }

    this.restoreReportBossProgress();

    if (
      this.hasSavedMetric(IR_PROGRESS_METRICS.bossReportComplete) ||
      this.unlockedZone >= FINAL_EXIT_ZONE
    ) {
      this.restoreBossReportComplete();
    }
  }

  private restoreRoomChallengeComplete(zone: number): void {
    this.roomChallengesComplete.add(zone);
    this.restoreFragmentOpened(zone);
    this.openDoorByZone(zone, true);

    const trigger = this.spikeTriggers.get(zone);
    if (trigger) {
      trigger.active = true;
      this.tweens.killTweensOf([trigger.sprite, trigger.aura]);
      trigger.sprite.clearTint().setAlpha(1).setScale(1.6);
      trigger.aura
        .setFillStyle(0x8cf7ff, 0.16)
        .setStrokeStyle(2, 0xd9ffff, 0.5)
        .setAlpha(0.55)
        .setScale(1);
    }

    if (zone === 1) {
      this.destroyRestoredQuestionPoints();
    }
    if (zone === 2) {
      this.restorePasswordRoomComplete();
    }
    if (zone === 4) {
      this.witnesses.forEach(witness => {
        witness.completed = true;
        this.setContainerTint(witness.visual, 0x8cff9a);
      });
    }
  }

  private restoreRoomAsReleased(zone: number): void {
    this.restoreRoomChallengeComplete(zone);
    this.roomRespondersReleased.add(zone);
    this.openSpikeGate(zone, false);

    const trigger = this.spikeTriggers.get(zone);
    if (trigger) {
      trigger.completed = true;
      trigger.sprite.setTint(0x8cff9a).setAlpha(1).setScale(1.55);
      trigger.aura.setVisible(false);
      trigger.sparks.forEach(spark => spark.destroy());
      trigger.sparks = [];
    }

    const wizard = this.wizards.get(zone);
    if (!wizard) return;

    wizard.freed = true;
    wizard.sealed = false;
    this.tweens.killTweensOf(wizard.visual);
    const releasePoint = this.getWizardReleasePoint(zone);
    wizard.visual.setPosition(releasePoint.x, releasePoint.y);
    this.clearContainerTint(wizard.visual);
    wizard.visual.setVisible(true).setAlpha(1).setDepth(ACTOR_DEPTH);
  }

  private restorePasswordRoomComplete(): void {
    this.roomChallengesComplete.add(2);
    this.psBosses.forEach(boss => {
      boss.completed = true;
      this.tweens.killTweensOf(boss.sprite);
      boss.sprite.destroy();
    });
  }

  private restoreCoreDoorOpened(): void {
    ROOM_ZONES.forEach(zone => this.restoreRoomAsReleased(zone));
    this.minionSealingStarted = true;
    this.bossReady = true;
    this.openDoorByZone(BOSS_GATE_ZONE, true);

    this.minions.forEach(minion => {
      minion.sealed = true;
      minion.timer?.destroy();
      this.tweens.killTweensOf([minion.sprite, minion.aura]);
      minion.sprite.setTint(0x8cff9a).setAlpha(0.42);
      minion.aura.setVisible(false);
    });
  }

  private restoreBossReportComplete(): void {
    this.restoreCoreDoorOpened();
    REPORT_PHASES.forEach(phase => {
      this.completedReportPhaseKeys.add(phase.key);
    });
    this.currentReportPhaseIndex = REPORT_PHASES.length;
    this.bossReportComplete = true;
    this.leverReady = true;
    this.bossBlocker?.destroy();
    this.openDoorByZone(FINAL_EXIT_ZONE, true);
    this.lever?.clearTint().setAlpha(1);
    this.bossVisual?.setAlpha(0.45);
    this.bossAura?.setAlpha(0.35);
  }

  private restoreReportBossProgress(): void {
    REPORT_PHASES.forEach(phase => {
      if (this.hasSavedMetric(IR_PROGRESS_METRICS.bossReportPhase(phase.key))) {
        this.completedReportPhaseKeys.add(phase.key);
      }
    });

    const savedPhaseIndex = Number(
      this.savedProgressMetrics[IR_PROGRESS_METRICS.bossReportPhaseIndex] ?? 0
    );
    this.currentReportPhaseIndex = Phaser.Math.Clamp(
      Math.max(savedPhaseIndex, this.completedReportPhaseKeys.size),
      0,
      REPORT_PHASES.length
    );
    this.repairCoreVisual(false);
  }

  private restoreFragmentOpened(zone: number): void {
    const fragment = this.fragments.get(zone);
    if (!fragment) return;

    fragment.opened = true;
    this.tweens.killTweensOf(fragment.sprite);
    fragment.sprite.setTint(0x8cf7ff).setAlpha(1);
  }

  private destroyRestoredQuestionPoints(): void {
    this.questionPoints.forEach((pointPair: any) => {
      pointPair.forEach?.((sprite: Phaser.GameObjects.Sprite) => {
        sprite.destroy();
      });
    });
    this.questionPoints = [];
  }

  private hasSavedMetric(metric: string): boolean {
    return Number(this.savedProgressMetrics[metric] ?? 0) > 0;
  }

  private saveIncidentProgress(
    milestoneZone: number,
    metrics: Record<string, number> = {}
  ): void {
    const nextZone = Math.max(this.currentZone || 0, milestoneZone);
    const nextUnlocked = Math.max(this.unlockedZone || 1, milestoneZone);

    this.currentZone = nextZone;
    this.unlockedZone = nextUnlocked;
    void this.saveCurrentZone(nextZone, nextUnlocked);

    Object.entries(metrics).forEach(([metric, amount]) => {
      this.recordGameplayMetric(metric, amount, 'set');
      this.savedProgressMetrics[metric] = amount;
    });
  }

  private async saveCurrentZone(
    currentZone: number,
    unlockedZone: number
  ): Promise<void> {
    try {
      gameAPI.setToken(this.userData.token);
      await gameAPI.updateCurrentZone({
        userid: this.userData.userId,
        topic: this.config.topic,
        current_zone: currentZone,
        unlocked_zone: unlockedZone,
      });
    } catch (error) {
      console.error('Failed to save Incident Response zone progress', error);
    }
  }

  private completeMissingRoomContent(): void {
    ROOM_ZONES.forEach(zone => {
      if (!this.fragments.has(zone)) {
        console.warn(`IR room ${zone} has no memory fragment; opening room door.`);
        this.openDoorByZone(zone);
      }

      if (!this.spikeTriggers.has(zone)) {
        console.warn(`IR room ${zone} has no responder seal; marking responder released.`);
        this.roomRespondersReleased.add(zone);
        this.openSpikeGate(zone, false);
      }
    });

    if (this.questions.length === 0) {
      console.warn('IR room 1 has no playable questions; activating responder seal.');
      this.markRoomChallengeComplete(1);
    }

    if (this.psBosses.length === 0) {
      console.warn('IR room 2 has no password bosses; activating responder seal.');
      this.markRoomChallengeComplete(2);
    }

    if (!this.hasMalwareAngel()) {
      console.warn('IR room 3 has no malware angel; activating responder seal.');
      this.disableMalwareThreats();
      this.markRoomChallengeComplete(3);
    }

    if (this.witnesses.length === 0) {
      console.warn('IR room 4 has no witnesses; activating responder seal.');
      this.markRoomChallengeComplete(4);
    }
  }

  private hasMalwareAngel(): boolean {
    return this.ambientEffects.some(
      object => object instanceof Phaser.GameObjects.Sprite &&
        object.name === 'MalwareAngelActor'
    );
  }

  private createSystemHealthUI(): void {
    const emitHealth = () => {
      this.game.events.emit('health:init', this.playerHealth, MAX_PLAYER_HEALTH);
    };

    if (this.scene.isActive('ui-scene')) {
      emitHealth();
      return;
    }

    const uiScene = this.scene.get('ui-scene');
    uiScene.events.once(Phaser.Scenes.Events.CREATE, emitHealth);
  }

  private updateHealthUI(): void {
    this.game.events.emit('health:update', this.playerHealth);
  }

  private getZoneNumber(object: any): number {
    return this.getObjectNumberProperty(object, 'zone_number');
  }

  private getProperty(object: any, name: string): unknown {
    return this.getObjectProperty(object, name);
  }
}
