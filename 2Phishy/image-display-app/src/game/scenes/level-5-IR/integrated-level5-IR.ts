import { BaseIntegratedLevel } from '../core/BaseIntegratedLevel';
import { LEVEL_CONFIGS } from '../core/LevelConfigurations';
import {
  PasswordChallengePopup,
  PasswordEvaluation,
} from '../../helpers/password-challenge-popup';
import { AssessmentResult, gameAPI } from '../../helpers/game-api';
import { DialogueManager } from '../../helpers/DialogueManager';
import { DialogueUI } from '../ui/DialogueUI';

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
  disabled: boolean;
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

type BossReportQuestion = {
  question: string;
  choices: string[];
  answer: string;
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
    fragmentDialogue: 'The third memory is unstable. This shard anchors your respawn here. Survive the malware and reach the angel to eradicate the threat.',
    lockedMessage: 'The eradication seal is still active. The malware must be disabled first.',
    releasedMessage: 'Eradication is restored. The responder can remove the active threat.',
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

const BOSS_FRAME_SETS = makeFramePairs(737, 769, 16);
const ANGEL_FRAMES = makeRange(759, 766);
const MALWARE_FRAMES = [
  makeRange(375, 382),
  makeRange(439, 446),
  makeRange(503, 510),
];

const BOSS_REPORT_QUESTIONS: BossReportQuestion[] = [
  {
    question: 'The report begins with identification. What should be recorded first?',
    choices: [
      'The first signs, affected system, and suspected source',
      'Only the final fix',
      'A guess about who caused it',
      'Nothing until every system is restored',
    ],
    answer: 'The first signs, affected system, and suspected source',
  },
  {
    question: 'Before recovery, what response action keeps the incident from spreading?',
    choices: [
      'Contain the affected account or device',
      'Delete every log file',
      'Share the password with the team',
      'Reconnect everything to test it',
    ],
    answer: 'Contain the affected account or device',
  },
  {
    question: 'What does eradication focus on?',
    choices: [
      'Removing the root cause and active threat',
      'Making the report sound shorter',
      'Ignoring suspicious files',
      'Restoring backups before isolating anything',
    ],
    answer: 'Removing the root cause and active threat',
  },
  {
    question: 'What belongs in the final lessons-learned section?',
    choices: [
      'What happened, what was done, and how to prevent a repeat',
      'Only who should be blamed',
      'A copy of the attacker message only',
      'A note to never investigate again',
    ],
    answer: 'What happened, what was done, and how to prevent a repeat',
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

export class IRLevel extends BaseIntegratedLevel {
  private doors = new Map<number, DoorState[]>();
  private fragments = new Map<number, FragmentState>();
  private spikeGates = new Map<number, Phaser.Physics.Arcade.Sprite[]>();
  private spikeTriggers = new Map<number, SpikeTriggerState>();
  private wizards = new Map<number, WizardState>();
  private minions = new Map<number, MinionState>();
  private psBosses: PSBossState[] = [];
  private witnesses: WitnessState[] = [];
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
  private bossGatePoint?: Phaser.Math.Vector2;
  private doorWallsLayer?: Phaser.Tilemaps.TilemapLayer;
  private lever?: Phaser.Physics.Arcade.Sprite;
  private energyGraphics?: Phaser.GameObjects.Graphics;
  private interactionPrompt?: Phaser.GameObjects.Text;
  private interactKey?: Phaser.Input.Keyboard.Key;
  private passwordPopup!: PasswordChallengePopup;
  private playerHealth = MAX_PLAYER_HEALTH;
  private zoneThreeRespawnActive = false;
  private minionSealingStarted = false;
  private bossReady = false;
  private bossReportComplete = false;
  private leverReady = false;
  private finalShutdownComplete = false;

  constructor() {
    super(LEVEL_CONFIGS.IR);
  }

  async create(): Promise<void> {
    this.resetState();

    await super.create();

    this.createAdditionalMapLayers();
    this.passwordPopup = new PasswordChallengePopup(this);
    this.interactKey = this.input.keyboard?.addKey(
      Phaser.Input.Keyboard.KeyCodes.E
    );

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
    this.createInteractionPrompt();
    this.createSystemHealthUI();
    this.completeMissingRoomContent();

    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.passwordPopup.destroy();
      this.interactKey?.removeAllListeners();
      this.animationTimers.forEach(timer => timer.destroy());
      this.game.events.emit('health:hide');
    });
  }

  update(): void {
    super.update();
    this.updateFollowers();
    this.updateMalwareThreats();
    this.updateEnergyLines();
    this.updateInteractionPrompt();
  }

  protected initAssessment(): void {
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

    this.questionPoints = orderedPoints
      .slice(0, questionCount)
      .map((point, questionIndex) => {
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
        return pair;
      });
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
    if (
      this.questions.length > 0 &&
      this.assessmentResults.length >= this.questions.length
    ) {
      this.markRoomChallengeComplete(1);
    }
  }

  protected async completeAssessment(): Promise<void> {
    if (!this.finalShutdownComplete) return;
    await super.completeAssessment();
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
    this.interactKey = undefined;
    this.playerHealth = MAX_PLAYER_HEALTH;
    this.zoneThreeRespawnActive = false;
    this.minionSealingStarted = false;
    this.bossReady = false;
    this.bossReportComplete = false;
    this.leverReady = false;
    this.finalShutdownComplete = false;
    this.questionPoints = [];
    this.knowledgePoints = [];
    this.assessmentResults = [];
    this.assessmentCompleted = false;
    this.inAssessment = false;
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
    this.player.setDepth(8);
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
        7
      );

      wizard.visual.setAlpha(0.72);
      this.setContainerTint(wizard.visual, 0x6f7a86);
      this.tweens.add({
        targets: wizard.visual,
        y: wizard.visual.y - 4,
        duration: 1000,
        yoyo: true,
        repeat: -1,
        ease: 'Sine.easeInOut',
      });

      this.wizards.set(zone, {
        zone,
        visual: wizard.visual,
        parts: wizard.parts,
        frameSets,
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
      const frameSets = index % 2 === 0
        ? makeFramePairs(641, 673, 5)
        : makeFramePairs(545, 577, 5);
      const boss = this.createCompositeActor(
        point.x ?? 0,
        point.y ?? 0,
        frameSets,
        1.45,
        7
      );

      this.createPulseAura(boss.visual.x, boss.visual.y + 4, 20, 0xffd166, 0.18);

      this.psBosses.push({
        index,
        sprite: boss.visual,
        completed: false,
      });
    });
  }

  private initWitnesses(): void {
    const points = this.map.filterObjects(
      'NPCPoints',
      object => object.name === 'NPCPoint'
    ) ?? [];

    points.forEach((point, index) => {
      const frameSets = WITNESS_FRAME_SETS[index % WITNESS_FRAME_SETS.length];
      const witness = this.createCompositeActor(
        point.x ?? 0,
        point.y ?? 0,
        frameSets,
        1.25,
        7
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
        .setDepth(7);
      const aura = this.add
        .circle(sprite.x, sprite.y + 5, 15, 0xff3333, 0.18)
        .setStrokeStyle(1, 0xff7777, 0.42)
        .setDepth(6);

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
        disabled: false,
      });
    });

    if (angelPoint) {
      const angel = this.physics.add
        .sprite(angelPoint.x ?? 0, angelPoint.y ?? 0, 'tiles_spr', ANGEL_FRAMES[0])
        .setScale(1.45)
        .setDepth(7);

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
      const boss = this.createCompositeActor(
        bossPoint.x ?? 0,
        bossPoint.y ?? 0,
        BOSS_FRAME_SETS,
        2.1,
        8
      );

      this.bossVisual = boss.visual;
      this.bossAura = this.createPulseAura(
        boss.visual.x,
        boss.visual.y + 6,
        42,
        0xff3333,
        0.2
      );
      this.bossBlocker = this.add.zone(boss.visual.x, boss.visual.y + 8, 56, 58);
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
        .setDepth(7);
      const aura = this.add
        .circle(sprite.x, sprite.y + 4, 16, 0xff2222, 0.2)
        .setStrokeStyle(1, 0xffaaaa, 0.45)
        .setDepth(6);

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
      .setDepth(7)
      .setAlpha(0.5)
      .setTint(0x7a7a7a);

    lever.setImmovable(true);
    this.disableSpriteGravity(lever);
    this.lever = lever;
  }

  private createInteractionPrompt(): void {
    this.interactionPrompt = this.add
      .text(0, 0, 'Press E', {
        fontSize: '12px',
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

    if (
      this.interactKey &&
      Phaser.Input.Keyboard.JustDown(this.interactKey)
    ) {
      interactable.action();
    }
  }

  private findNearestInteractable(): Interactable | undefined {
    const candidates: Interactable[] = [];

    this.fragments.forEach(fragment => {
      if (fragment.opened) return;
      candidates.push({
        x: fragment.sprite.x,
        y: fragment.sprite.y,
        prompt: 'Press E to read fragment',
        action: () => this.openMemoryFragment(fragment.zone),
      });
    });

    this.spikeTriggers.forEach(trigger => {
      if (trigger.completed) return;
      candidates.push({
        x: trigger.sprite.x,
        y: trigger.sprite.y,
        prompt: trigger.active
          ? 'Press E to release responder'
          : 'Press E to inspect seal',
        action: () => this.handleSpikeTrigger(trigger.zone),
      });
    });

    this.psBosses.forEach(boss => {
      if (boss.completed) return;
      candidates.push({
        x: boss.sprite.x,
        y: boss.sprite.y,
        prompt: 'Press E to contain account',
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
        prompt: 'Press E to cleanse malware',
        action: () => this.startAngelChallenge(),
      });
    }

    this.witnesses.forEach(witness => {
      if (witness.completed) return;
      candidates.push({
        x: witness.visual.x,
        y: witness.visual.y,
        prompt: 'Press E to interview witness',
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
        prompt: 'Press E to inspect core gate',
        action: () => this.inspectBossGate(),
      });
    }

    if (this.bossReady && !this.bossReportComplete) {
      const reportPoint = this.bossVisual ?? this.bossGatePoint;
      if (reportPoint) {
      candidates.push({
        x: reportPoint.x,
        y: reportPoint.y,
        prompt: 'Press E to complete report',
        action: () => this.startBossReport(),
      });
      }
    }

    if (this.lever && !this.finalShutdownComplete) {
      candidates.push({
        x: this.lever.x,
        y: this.lever.y,
        prompt: this.leverReady
          ? 'Press E to shut down core'
          : 'Press E to inspect lever',
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
      this.showInfo('Responder Seal', details.lockedMessage);
      return;
    }

    trigger.completed = true;
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
    this.player.lockMovement();
    this.interactionPrompt?.setVisible(false);

    const challenge = this.getPSChallenge(boss.index);

    this.passwordPopup.show(
      {
        title: challenge.title,
        instructions: challenge.instructions,
        evaluate: challenge.evaluate,
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
    this.tweens.add({
      targets: boss.sprite,
      alpha: 0,
      scale: boss.sprite.scale * 1.2,
      duration: 380,
      ease: 'Back.In',
      onComplete: () => boss.sprite.setVisible(false),
    });

    this.inAssessment = false;
    this.player.unlockMovement();

    if (this.psBosses.every(item => item.completed)) {
      this.markRoomChallengeComplete(2);
    }
  }

  private startAngelChallenge(): void {
    if (this.roomChallengesComplete.has(3)) return;

    const correctAnswer = 'Isolate the infected systems and remove the malware';

    this.inAssessment = true;
    this.player.lockMovement();
    this.interactionPrompt?.setVisible(false);
    this.popup.mode = 'learning';
    this.popup.correctAnswer = correctAnswer;
    this.popup.show(
      'The malware is still active. What should the responder do before recovery?',
      [
        'Restore backups while the malware keeps running',
        correctAnswer,
        'Delete every log immediately',
        'Reconnect the device to test if it spreads',
      ],
      choice => {
        if (choice === correctAnswer) {
          this.disableMalwareThreats();
          this.markRoomChallengeComplete(3);
        } else {
          this.damagePlayer(this.malwareThreats[0]?.sprite, 2);
        }

        this.inAssessment = false;
        this.player.unlockMovement();
      }
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
    const challenge = challenges[witness.index % challenges.length];

    this.inAssessment = true;
    this.player.lockMovement();
    this.interactionPrompt?.setVisible(false);
    this.popup.mode = 'learning';
    this.popup.correctAnswer = challenge.answer;
    this.popup.show(challenge.question, challenge.choices, choice => {
      if (choice === challenge.answer) {
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
          this.markRoomChallengeComplete(4);
        }
      } else {
        this.cameras.main.shake(180, 0.004);
      }

      this.inAssessment = false;
      this.player.unlockMovement();
    });
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
  }

  private startBossReport(): void {
    if (!this.bossReady || this.bossReportComplete) return;

    this.showDialogue('ir_boss_truth', () => {
      this.startBossReportQuestion(0);
    });
  }

  private startBossReportQuestion(index: number): void {
    const question = BOSS_REPORT_QUESTIONS[index];

    if (!question) {
      this.completeBossReport();
      return;
    }

    this.inAssessment = true;
    this.player.lockMovement();
    this.popup.mode = 'learning';
    this.popup.correctAnswer = question.answer;
    this.popup.show(question.question, question.choices, choice => {
      if (choice === question.answer) {
        this.startBossReportQuestion(index + 1);
        return;
      }

      this.showInfo(
        'Report Rejected',
        'The incident report must follow the response process. Review the evidence and try this section again.',
        () => this.startBossReportQuestion(index)
      );
    });
  }

  private completeBossReport(): void {
    this.bossReportComplete = true;
    this.leverReady = true;
    this.inAssessment = false;
    this.player.unlockMovement();

    this.bossBlocker?.destroy();
    this.openDoorByZone(FINAL_EXIT_ZONE);

    if (!this.lever) {
      this.showInfo(
        'Report Accepted',
        'The report is complete. No shutdown lever was found, so the reconstruction is closing automatically.',
        () => {
          this.finalShutdownComplete = true;
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
      this.showInfo(
        'Lever Locked',
        'The shutdown lever will not respond until the incident report is complete.'
      );
      return;
    }

    if (!this.lever || this.finalShutdownComplete) return;

    this.finalShutdownComplete = true;
    this.lever.setFrame(LEVER_ON_FRAME);
    this.tweens.killTweensOf(this.lever);
    this.lever.setScale(1.55);
    this.cameras.main.shake(420, 0.008);
    this.flashShutdownEffects();

    this.showDialogue('ir_ending', () => {
      void this.completeAssessment();
    });
  }

  private markRoomChallengeComplete(zone: number): void {
    if (this.roomChallengesComplete.has(zone)) return;

    this.roomChallengesComplete.add(zone);
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
    this.roomRespondersReleased.add(zone);
    this.clearContainerTint(wizard.visual);
    wizard.visual.setAlpha(1);

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

  private startMinionSealing(): void {
    if (this.minionSealingStarted || !this.allRespondersReleased()) return;

    this.minionSealingStarted = true;
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
    this.openDoorByZone(BOSS_GATE_ZONE);
    this.inAssessment = false;
    this.player.unlockMovement();

    this.showInfo(
      'Core Gate Open',
      'The responders have neutralized the four incident blockers. The core is ready for the final report.'
    );
  }

  private openDoorByZone(zone: number): void {
    const doors = this.doors.get(zone);
    if (!doors) return;

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
        wizard.visual.setPosition(target.x, target.y);
      } else {
        wizard.visual.x = Phaser.Math.Linear(wizard.visual.x, target.x, 0.18);
        wizard.visual.y = Phaser.Math.Linear(wizard.visual.y, target.y, 0.18);
      }

      if (wizard.visual.x < oldX - 0.1) {
        wizard.visual.scaleX = -Math.abs(wizard.visual.scaleX);
      }

      if (wizard.visual.x > oldX + 0.1) {
        wizard.visual.scaleX = Math.abs(wizard.visual.scaleX);
      }

      wizard.visual.setDepth(wizard.visual.y < this.player.y ? 6 : 9);
    });
  }

  private updateMalwareThreats(): void {
    if (this.inAssessment) {
      this.malwareThreats.forEach(threat => threat.sprite.setVelocity(0));
      return;
    }

    this.malwareThreats.forEach(threat => {
      if (threat.disabled || !threat.sprite.active) return;

      const distanceToPlayer = Phaser.Math.Distance.Between(
        threat.sprite.x,
        threat.sprite.y,
        this.player.x,
        this.player.y
      );

      if (
        distanceToPlayer < 150 &&
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
    if (this.inAssessment || threat.disabled) return;

    const now = this.time.now;
    const lastHitAt = Number(threat.sprite.getData('lastHitAt') ?? 0);
    if (now - lastHitAt < 1300) return;

    threat.sprite.setData('lastHitAt', now);
    this.damagePlayer(threat.sprite, MALWARE_TOUCH_DAMAGE);
    this.knockPlayerAwayFrom(threat.sprite);

    if (this.playerHealth <= 0) {
      this.respawnPlayerAtZoneThree();
    }
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
      threat.disabled = true;
      threat.sprite.setVelocity(0);
      threat.sprite.disableBody(false, false);
      this.tweens.killTweensOf([threat.sprite, threat.aura]);
      this.tweens.add({
        targets: [threat.sprite, threat.aura],
        alpha: 0,
        scale: 0.3,
        duration: 360,
        ease: 'Back.In',
        onComplete: () => {
          threat.sprite.destroy();
          threat.aura.destroy();
        },
      });
    });
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
    onComplete?: () => void
  ): void {
    const dialogueData = this.cache.json.get('general_dialogues');

    this.dialogueManager = new DialogueManager(dialogueData);
    this.dialogueUI = new DialogueUI(this);

    this.inAssessment = true;
    this.player.lockMovement();
    this.interactionPrompt?.setVisible(false);

    try {
      const scenario = this.dialogueManager.getScenarioById(scenarioId);

      this.dialogueUI.start(scenario, () => {
        this.inAssessment = false;
        this.player.unlockMovement();
        onComplete?.();
      });
    } catch (error) {
      console.error(error);
      this.inAssessment = false;
      this.player.unlockMovement();
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
