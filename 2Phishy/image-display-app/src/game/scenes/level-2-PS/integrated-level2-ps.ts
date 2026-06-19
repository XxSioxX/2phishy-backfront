import { BaseIntegratedLevel } from '../core/BaseIntegratedLevel';
import { LEVEL_CONFIGS } from '../core/LevelConfigurations';
import {
  PasswordChallengePopup,
  PasswordEvaluation,
} from '../../helpers/password-challenge-popup';
import { gameAPI } from '../../helpers/game-api';

type BossState = {
  zone: number;
  visual: Phaser.GameObjects.Container;
  blocker: Phaser.GameObjects.Zone;
  animationTimer?: Phaser.Time.TimerEvent;
  completed: boolean;
};

const FINAL_ZONE = 4;
const INTERACTION_DISTANCE = 58;
const SPIKE_CLOSED_FRAME = 356;
const SPIKE_RETRACT_FRAMES = [355, 354, 353];

const COMMON_PASSWORDS = [
  '123456',
  '12345678',
  'password',
  'password1',
  'qwerty',
  'letmein',
  'admin',
  'welcome',
  'iloveyou',
];

const COMPOSITE_BOSS_FRAMES: Record<number, number[][]> = {
  3: [
    [545, 546, 577, 578],
    [547, 548, 579, 580],
    [549, 550, 581, 582],
    [551, 552, 583, 584],
    [553, 554, 585, 586],
  ],
  4: [
    [641, 642, 673, 674],
    [643, 644, 675, 676],
    [645, 646, 677, 678],
    [647, 648, 679, 680],
    [649, 650, 681, 682],
  ],
};

const KNIGHT_VARIANTS = [
  [
    [136, 168],
    [137, 169],
    [138, 170],
    [139, 171],
    [140, 172],
    [141, 173],
    [142, 174],
    [143, 175],
    [144, 176],
  ],

  [
    [200, 232],
    [201, 233],
    [202, 234],
    [203, 235],
    [204, 236],
    [205, 237],
    [206, 238],
    [207, 239],
    [208, 240],
  ],
];

export class PSLevel extends BaseIntegratedLevel {
  private bosses = new Map<number, BossState>();
  private spikeGates = new Map<number, Phaser.Physics.Arcade.Sprite[]>();
  private completedBosses = new Set<number>();
  private challengePasswords = new Map<number, string>();
  private followers: Phaser.GameObjects.Container[] = [];
  private movementHistory: Phaser.Math.Vector2[] = [];
  private interactKey?: Phaser.Input.Keyboard.Key;
  private interactionPrompt?: Phaser.GameObjects.Text;
  private passwordPopup!: PasswordChallengePopup;
  private unlockedZone = 1;

  constructor() {
    super(LEVEL_CONFIGS.PS);
  }

  async create(): Promise<void> {
    this.bosses.clear();
    this.spikeGates.clear();
    this.completedBosses.clear();
    this.challengePasswords.clear();
    this.followers = [];
    this.movementHistory = [];
    this.questionPoints = [];
    this.knowledgePoints = [];
    this.assessmentResults = [];
    this.assessmentCompleted = false;
    this.inAssessment = false;

    await this.loadSavedZoneProgress();
    await super.create();

    this.createAdditionalMapLayers();
    this.passwordPopup = new PasswordChallengePopup(this);
    this.interactKey = this.input.keyboard?.addKey(
      Phaser.Input.Keyboard.KeyCodes.E
    );

    this.initSpikeGates();
    this.initBosses();
    this.restoreCompletedZones();
    this.createInteractionPrompt();

    if (this.allRequiredBossesConquered()) {
      await this.completeAssessment();
    }

    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.passwordPopup.destroy();
      this.interactKey?.removeAllListeners();
      this.bosses.forEach(boss => boss.animationTimer?.destroy());
    });
  }

  update(): void {
    super.update();
    this.updateBossInteraction();
    this.updateFollowers();
  }

  protected async completeAssessment(): Promise<void> {
    const allQuestionsAnswered =
      this.assessmentResults.length >= this.questions.length;
    const allBossesConquered = this.allRequiredBossesConquered();

    if (!allQuestionsAnswered || !allBossesConquered) return;
    await super.completeAssessment();
  }

  protected initAssessment(): void {
    const points = this.map.filterObjects(
      'QuestionPoints',
      object => object.name === 'QuestionPoint'
    ) ?? [];
    const pointsByZone = this.groupPointsByZone(points);
    const assignments: {
      point: any;
      question: any;
      zone: number;
    }[] = [];

    for (let zone = 1; zone <= FINAL_ZONE; zone += 1) {
      const zonePoints = pointsByZone.get(zone) ?? [];
      const zoneQuestions = this.questions
        .map((question, questionIndex) => ({ question, questionIndex }))
        .filter(({ question }) => Number(question.zone) === zone);

      Phaser.Utils.Array.Shuffle(zonePoints);

      zoneQuestions
        .slice(0, zonePoints.length)
        .forEach(({ questionIndex }, index) => {
          assignments.push({
            point: zonePoints[index],
            question: this.questions[questionIndex],
            zone,
          });
        });
    }

    if (assignments.length < this.questions.length) {
      console.warn(
        `Password Security has ${this.questions.length} playable questions but only ${assignments.length} matching zone question points. Trimming to spawned questions.`
      );
    }

    this.questions = assignments.map(assignment => assignment.question);
    this.totalquestions = this.questions.length;

    this.questionPoints = assignments.map((assignment, questionIndex) => {
      const { point, zone } = assignment;
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
      pair.zone = zone;
      return pair;
    });
  }

  protected initKnowledge(): void {
    const points = this.map.filterObjects(
      'KnowledgePoints',
      object => object.name === 'KnowledgePoint'
    ) ?? [];
    const pointsByZone = this.groupPointsByZone(points);
    const questionZoneById = new Map(
      this.questions.map(question => [
        String(question.question_id),
        Number(question.zone),
      ])
    );

    this.knowledgePoints = [];

    for (let zone = 1; zone <= FINAL_ZONE; zone += 1) {
      const zonePoints = pointsByZone.get(zone) ?? [];
      const zoneKnowledge = this.knowledgeList.filter(
        knowledge =>
          questionZoneById.get(String(knowledge.question_id)) === zone
      );

      Phaser.Utils.Array.Shuffle(zonePoints);

      zoneKnowledge
        .slice(0, zonePoints.length)
        .forEach((knowledge, index) => {
          const point = zonePoints[index];
          const sprite = this.physics.add
            .sprite(point.x ?? 0, point.y ?? 0, 'tiles_spr', 627)
            .setScale(1.5);

          sprite.setImmovable(true);
          sprite.body.allowGravity = false;

          const pair = [sprite] as any;
          pair.isOpen = false;
          pair.isAnimating = false;
          pair.wasTouching = false;
          pair.zone = zone;
          pair.knowledge = {
            knowledge_id: knowledge.knowledge_id,
            question_id: knowledge.question_id,
            knowledge_content: knowledge.knowledge_content,
            subtopic: knowledge.subtopic,
            subtopic_key: knowledge.subtopic_key,
          };

          this.knowledgePoints.push(pair);
        });
    }
  }

  private async loadSavedZoneProgress(): Promise<void> {
    try {
      const response = await gameAPI.getUserProgress(this.userData.userId);
      const saved =
        response.data?.progress?.progress?.[this.config.topic];

      this.unlockedZone = saved?.unlocked_zone ?? 1;
      this.currentZone = saved?.current_zone ?? 0;
    } catch (error) {
      console.error('Failed to load Password Security zone progress', error);
      this.unlockedZone = 1;
      this.currentZone = 0;
    }
  }

  private createAdditionalMapLayers(): void {
    this.map.createLayer('Door-walls', this.tileset, 0, 0)?.setDepth(3);
    this.map.createLayer('Pillar', this.tileset, 0, 0)?.setDepth(8);
    this.player.setDepth(6);
  }

  private initSpikeGates(): void {
    const points = this.map.filterObjects(
      'SpikePoints',
      object => object.name === 'SpikePoint'
    );

    points.forEach(point => {
      const zone = this.getZoneNumber(point);
      if (!zone) return;

      const spike = this.physics.add
        .staticSprite(point.x ?? 0, point.y ?? 0, 'tiles_spr', SPIKE_CLOSED_FRAME)
        .setDepth(4);

      this.physics.add.collider(this.player, spike);

      const gate = this.spikeGates.get(zone) ?? [];
      gate.push(spike);
      this.spikeGates.set(zone, gate);
    });
  }

  private initBosses(): void {
    const points = this.map.filterObjects(
      'BossPoints',
      object => object.name === 'BossPoint'
    );

    points.forEach(point => {
      const zone = this.getZoneNumber(point);
      if (!zone) return;

      const x = point.x ?? 0;
      const y = point.y ?? 0;
      const bossVisual = this.createBossVisual(zone, x, y);
      const blocker = this.add.zone(x, y + 4, zone === 1 ? 30 : 42, 36);

      this.physics.add.existing(blocker, true);
      this.physics.add.collider(this.player, blocker);

      this.bosses.set(zone, {
        zone,
        visual: bossVisual.visual,
        blocker,
        animationTimer: bossVisual.animationTimer,
        completed: false,
      });
    });
  }

  private createBossVisual(
    zone: number,
    x: number,
    y: number
  ): {
    visual: Phaser.GameObjects.Container;
    animationTimer?: Phaser.Time.TimerEvent;
  } {
    if (zone <= 2) {
      const isBlue = zone === 1;
      const dragon = this.add
        .sprite(0, 0, 'tiles_spr', isBlue ? 424 : 488)
        .setScale(2);

      const visual = this.add.container(x, y, [dragon]).setDepth(5);

    const movementDistance = zone <= 2 ? 6 : 4;
    const movementSpeed = 900 + zone * 100;

    this.tweens.add({
      targets: visual,
      x: {
        from: x - movementDistance,
        to: x + movementDistance,
      },
      y: {
        from: y,
        to: y - 2,
      },
      duration: movementSpeed,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.easeInOut',
    });

      return { visual };
    }

    const frameSets =
      COMPOSITE_BOSS_FRAMES[zone] ?? COMPOSITE_BOSS_FRAMES[3];
    const positions = [
      { x: -8, y: -8 },
      { x: 8, y: -8 },
      { x: -8, y: 8 },
      { x: 8, y: 8 },
    ];
    const parts = positions.map((position, index) =>
      this.add
        .sprite(position.x, position.y, 'tiles_spr', frameSets[0][index])
        .setOrigin(0.5)
    );
    const visual = this.add
      .container(x, y, parts)
      .setScale(1.5)
      .setDepth(5);

    const movementDistance = zone <= 2 ? 6 : 4;
    const movementSpeed = 900 + zone * 100;

    this.tweens.add({
      targets: visual,
      x: {
        from: x - movementDistance,
        to: x + movementDistance,
      },
      y: {
        from: y,
        to: y - 2,
      },
      duration: movementSpeed,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.easeInOut',
    });

    return { visual };
  }

  private restoreCompletedZones(): void {
    const completedCount = Math.min(
      FINAL_ZONE,
      Math.max(0, this.unlockedZone - 1)
    );

    for (let zone = 1; zone <= completedCount; zone += 1) {
      const boss = this.bosses.get(zone);
      if (boss) {
        boss.completed = true;
        boss.animationTimer?.destroy();
        boss.visual.setVisible(false);
        boss.blocker.destroy();
      }

      this.completedBosses.add(zone);
      this.openSpikeGate(zone, false);
      this.addKnightFollower(false);
    }
  }

  private createInteractionPrompt(): void {
    this.interactionPrompt = this.add
      .text(0, 0, 'Press E to challenge', {
        fontSize: '12px',
        color: '#ffffff',
        backgroundColor: '#111820',
        padding: { x: 6, y: 4 },
      })
      .setOrigin(0.5)
      .setScale(1 / this.cameras.main.zoom)
      .setDepth(100)
      .setVisible(false);
  }

  private updateBossInteraction(): void {
    if (!this.player || this.inAssessment) {
      this.interactionPrompt?.setVisible(false);
      return;
    }

    const boss = this.getCurrentBoss();
    if (!boss || boss.completed) {
      this.interactionPrompt?.setVisible(false);
      return;
    }

    const distance = Phaser.Math.Distance.Between(
      this.player.x,
      this.player.y,
      boss.visual.x,
      boss.visual.y
    );
    const inRange = distance <= INTERACTION_DISTANCE;

    this.interactionPrompt
      ?.setPosition(boss.visual.x, boss.visual.y - 38)
      .setVisible(inRange);

    if (
      inRange &&
      this.interactKey &&
      Phaser.Input.Keyboard.JustDown(this.interactKey)
    ) {
      this.startBossChallenge(boss);
    }
  }

  private startBossChallenge(boss: BossState): void {
    this.inAssessment = true;
    this.player.lockMovement();
    this.interactionPrompt?.setVisible(false);

    const challenge = this.getChallenge(boss.zone);

    this.passwordPopup.show(
      {
        title: challenge.title,
        instructions: challenge.instructions,
        evaluate: challenge.evaluate,
      },
      password => {
        if (boss.zone === FINAL_ZONE) {
          this.startMfaChallenge(boss, password);
          return;
        }

        this.challengePasswords.set(boss.zone, password);
        void this.completeBoss(boss);
      },
      () => {
        this.inAssessment = false;
        this.player.unlockMovement();
      }
    );
  }

  private startMfaChallenge(boss: BossState, password: string): void {
    const correctAnswer = 'Use an authenticator app or security key';

    this.popup.mode = 'learning';
    this.popup.correctAnswer = correctAnswer;
    this.popup.show(
      'The final guardian stole the fictional password. What should protect the account now?',
      [
        'Change one letter in the password',
        correctAnswer,
        'Reuse the password on another account',
        'Share the password with a trusted friend',
      ],
      choice => {
        if (choice === correctAnswer) {
          this.challengePasswords.set(boss.zone, password);
          void this.completeBoss(boss);
          return;
        }

        this.popup.showInfo(
          'The guardian still blocks the path',
          'A password can be exposed even when it is strong. Add a separate authentication factor and try again.',
          () => {
            this.inAssessment = false;
            this.player.unlockMovement();
          }
        );
      }
    );
  }

  private getChallenge(zone: number): {
    title: string;
    instructions: string;
    evaluate: (password: string) => PasswordEvaluation;
  } {
    if (zone === 1) {
      return {
        title: 'Small Dragon: Common Passwords',
        instructions:
          'Create a fictional password with at least 8 characters that is not common or easily guessed.',
        evaluate: password => this.evaluateCommonPasswordChallenge(password),
      };
    }

    if (zone === 2) {
      return {
        title: 'Stone Guardian: Password Length',
        instructions:
          'Create a fictional password or passphrase with at least 16 characters. Numbers and symbols are optional.',
        evaluate: password => this.evaluateLengthChallenge(password),
      };
    }

    if (zone === 3) {
      return {
        title: 'Armored Guardian: Unique Passwords',
        instructions:
          'Create a fictional password with at least 12 characters that is different from every earlier challenge password.',
        evaluate: password => this.evaluateUniqueChallenge(password),
      };
    }

    return {
      title: 'Final Guardian: Layered Security',
      instructions:
        'Create one more strong, unique fictional password. The guardian has one final trick afterward.',
      evaluate: password => this.evaluateFinalChallenge(password),
    };
  }

  private evaluateCommonPasswordChallenge(
    password: string
  ): PasswordEvaluation {
    const normalized = password.trim().toLowerCase();

    if (password.length < 8) {
      return {
        passed: false,
        message: `Too short: ${password.length}/8 characters.`,
      };
    }

    if (this.hasCommonPattern(normalized)) {
      return {
        passed: false,
        message:
          'Avoid common passwords, sequences, repetition, and keyboard mashing. Try unrelated words separated by hyphens.',
      };
    }

    const username = String(this.userData?.username ?? '').toLowerCase();
    if (username.length >= 3 && normalized.includes(username)) {
      return {
        passed: false,
        message: 'Avoid names or personal details that attackers can discover.',
      };
    }

    return {
      passed: true,
      message: 'Accepted: it avoids the most obvious guesses.',
    };
  }

  private evaluateLengthChallenge(password: string): PasswordEvaluation {
    if (password.length < 16) {
      return {
        passed: false,
        message: `Add more length: ${password.length}/16 characters.`,
      };
    }

    if (this.hasCommonPattern(password.trim().toLowerCase())) {
      return {
        passed: false,
        message: 'Length does not rescue a common or predictable password.',
      };
    }

    return {
      passed: true,
      message: 'Accepted: length greatly increases resistance to guessing.',
    };
  }

  private evaluateUniqueChallenge(password: string): PasswordEvaluation {
    if (password.length < 12) {
      return {
        passed: false,
        message: `Use at least 12 characters: ${password.length}/12.`,
      };
    }

    if (this.wasUsedEarlier(password)) {
      return {
        passed: false,
        message: 'That password was already used in an earlier chamber.',
      };
    }

    if (this.hasCommonPattern(password.trim().toLowerCase())) {
      return {
        passed: false,
        message: 'Use a unique password without common patterns.',
      };
    }

    return {
      passed: true,
      message: 'Accepted: a breach of another account will not unlock this one.',
    };
  }

  private evaluateFinalChallenge(password: string): PasswordEvaluation {
    if (password.length < 16) {
      return {
        passed: false,
        message: `Use at least 16 characters: ${password.length}/16.`,
      };
    }

    if (this.wasUsedEarlier(password)) {
      return {
        passed: false,
        message: 'The final password must also be unique.',
      };
    }

    if (this.hasCommonPattern(password.trim().toLowerCase())) {
      return {
        passed: false,
        message: 'The guardian recognized a common or predictable pattern.',
      };
    }

    return {
      passed: true,
      message: 'Password accepted. Now prepare for credential theft.',
    };
  }

  private hasCommonPattern(normalizedPassword: string): boolean {
    const compactPassword = normalizedPassword.replace(/[^a-z0-9]/g, '');

    if (!compactPassword) return true;

    const keyboardPatterns = [
      'qwerty',
      'asdf',
      'asdfgh',
      'zxcv',
      '1234',
      'abcd',
    ];

    const hasKeyboardPattern = keyboardPatterns.some(pattern =>
      compactPassword.includes(pattern)
    );

    const hasLongRepeat =
      /(.)\1{3,}/.test(normalizedPassword) ||
      /(.)\1{3,}/.test(compactPassword);

    const hasSimpleSequence =
      /(0123|1234|2345|3456|4567|5678|6789|abcd)/.test(
        compactPassword
      );

    const uniqueRatio =
      new Set(compactPassword).size / compactPassword.length;

    const looksRepetitive =
      compactPassword.length >= 10 && uniqueRatio < 0.45;

    return (
      COMMON_PASSWORDS.some(common =>
        this.isCommonPasswordVariant(compactPassword, common)
      ) ||
      hasKeyboardPattern ||
      hasLongRepeat ||
      hasSimpleSequence ||
      looksRepetitive
    );
  }

  private isCommonPasswordVariant(
    normalizedPassword: string,
    common: string
  ): boolean {
    if (normalizedPassword === common) return true;

    const suffix = normalizedPassword.slice(common.length);
    if (
      normalizedPassword.startsWith(common) &&
      /^[0-9!@#$%^&*._-]+$/.test(suffix)
    ) {
      return true;
    }

    if (normalizedPassword.length % common.length !== 0) return false;

    return normalizedPassword === common.repeat(
      normalizedPassword.length / common.length
    );
  }

  private wasUsedEarlier(password: string): boolean {
    const normalized = password.trim().toLowerCase();
    return Array.from(this.challengePasswords.values()).some(
      previous => previous.trim().toLowerCase() === normalized
    );
  }

  private async completeBoss(boss: BossState): Promise<void> {
    if (boss.completed) return;

    boss.completed = true;
    this.completedBosses.add(boss.zone);
    boss.animationTimer?.destroy();
    boss.blocker.destroy();

    this.tweens.add({
      targets: boss.visual,
      alpha: 0,
      scale: boss.visual.scale * 1.25,
      duration: 450,
      ease: 'Back.In',
      onComplete: () => boss.visual.setVisible(false),
    });

    this.openSpikeGate(boss.zone, true);
    this.addKnightFollower(true);

    this.currentZone =
      this.getNextBossZone(boss.zone + 1) ?? FINAL_ZONE + 1;
    this.unlockedZone = Math.max(this.unlockedZone, this.currentZone);

    try {
      await gameAPI.updateCurrentZone({
        userid: this.userData.userId,
        topic: this.config.topic,
        current_zone: this.currentZone,
        unlocked_zone: this.unlockedZone,
      });
    } catch (error) {
      console.error('Failed to save Password Security zone progress', error);
    }

    this.inAssessment = false;
    this.player.unlockMovement();

    if (this.allRequiredBossesConquered()) {
      await this.completeAssessment();
    }
  }

  private openSpikeGate(zone: number, animate: boolean): void {
    const gate = this.spikeGates.get(zone);
    if (!gate) return;

    gate.forEach(spike => {
      this.physics.world.disable(spike);

      if (!animate) {
        spike.setFrame(
          SPIKE_RETRACT_FRAMES[SPIKE_RETRACT_FRAMES.length - 1]
        );
        return;
      }

      SPIKE_RETRACT_FRAMES.forEach((frame, index) => {
        this.time.delayedCall(index * 90, () => spike.setFrame(frame));
      });
    });
  }

  private addKnightFollower(animate: boolean): void {
    const index = this.followers.length;
    const frameSets = Phaser.Utils.Array.GetRandom(KNIGHT_VARIANTS);

    const positions = [
      { x: 0, y: -8 },
      { x: 0, y: 8 },
    ];

    const parts = positions.map((position, partIndex) =>
      this.add.sprite(
        position.x,
        position.y,
        'tiles_spr',
        frameSets[0][partIndex]
      )
    );

    const knight = this.add
      .container(
        this.player.x - (index + 1) * 24,
        this.player.y,
        parts
      )
      .setScale(1.3)
      .setDepth(5);

    knight.setData('frameSets', frameSets);
    knight.setData('parts', parts);
    knight.setData('frameIndex', 0);
    knight.setData('lastFrameTime', this.time.now);

    this.followers.push(knight);

    if (animate) {
      knight.setAlpha(0).setScale(0.4);

      this.tweens.add({
        targets: knight,
        alpha: 1,
        scaleX: 1.3,
        scaleY: 1.3,
        duration: 400,
        ease: 'Back.Out',
      });
    }
  }

  private updateFollowers(): void {
    if (!this.player || this.followers.length === 0) return;

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
      this.movementHistory.length = Math.min(this.movementHistory.length, 140);
    }

    this.followers.forEach((knight, index) => {
      const historyIndex = Math.min(
        this.movementHistory.length - 1,
        (index + 1) * 16
      );
      const target = this.movementHistory[historyIndex];
      if (!target) return;



      const oldX = knight.x;
      const distance = Phaser.Math.Distance.Between(
        knight.x,
        knight.y,
        target.x,
        target.y
      );

      const frameSets = knight.getData('frameSets') as number[][];
      const parts = knight.getData('parts') as Phaser.GameObjects.Sprite[];

      if (distance > 3) {
        const currentTime = this.time.now;
        const lastFrameTime =
          (knight.getData('lastFrameTime') as number) ?? 0;

        if (currentTime - lastFrameTime >= 140) {
          const frameIndex =
            ((knight.getData('frameIndex') as number) + 1) %
            frameSets.length;

          parts.forEach((part, partIndex) => {
            part.setFrame(frameSets[frameIndex][partIndex]);
          });

          knight.setData('frameIndex', frameIndex);
          knight.setData('lastFrameTime', currentTime);
        }
      } else if (knight.getData('frameIndex') !== 0) {
        parts.forEach((part, partIndex) => {
          part.setFrame(frameSets[0][partIndex]);
        });

        knight.setData('frameIndex', 0);
      }

      if (distance > 180) {
        knight.setPosition(target.x, target.y);
      } else {
        knight.x = Phaser.Math.Linear(knight.x, target.x, 0.2);
        knight.y = Phaser.Math.Linear(knight.y, target.y, 0.2);
      }

      if (knight.x < oldX - 0.1) {
        knight.scaleX = -Math.abs(knight.scaleX);
      }

      if (knight.x > oldX + 0.1) {
        knight.scaleX = Math.abs(knight.scaleX);
      }
      knight.setDepth(knight.y < this.player.y ? 5 : 7);
    });
  }

  private getCurrentBoss(): BossState | undefined {
    const nextZone = this.getNextBossZone(this.unlockedZone);
    return nextZone ? this.bosses.get(nextZone) : undefined;
  }

  private getNextBossZone(startZone: number): number | undefined {
    return Array.from(this.bosses.keys())
      .sort((a, b) => a - b)
      .find(zone => zone >= startZone && !this.completedBosses.has(zone));
  }

  private allRequiredBossesConquered(): boolean {
    const bossZones = Array.from(this.bosses.keys());

    return (
      bossZones.length === 0 ||
      bossZones.every(zone => this.completedBosses.has(zone))
    );
  }

  private groupPointsByZone(points: any[]): Map<number, any[]> {
    const grouped = new Map<number, any[]>();

    points.forEach(point => {
      const zone = this.getZoneNumber(point);
      if (!zone) return;

      const zonePoints = grouped.get(zone) ?? [];
      zonePoints.push(point);
      grouped.set(zone, zonePoints);
    });

    return grouped;
  }

  private getZoneNumber(object: any): number {
    return this.getObjectNumberProperty(object, 'zone_number');
  }
}
