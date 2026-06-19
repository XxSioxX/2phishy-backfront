import { BaseIntegratedLevel } from '../core/BaseIntegratedLevel';
import { LEVEL_CONFIGS } from '../core/LevelConfigurations';

type MalwareKind = 'trojan' | 'worm' | 'virus' | 'spyware';
type TaskSource = 'question' | 'malware';

type MalwareData = {
  anim: string;
  frames: number[];
  color: number;
};

type TaskAssignment = {
  point: any;
  questionIndex: number;
  source: TaskSource;
};

type SpawnedMalware = {
  sprite: Phaser.Physics.Arcade.Sprite;
  aura: Phaser.GameObjects.Arc;
  kind: MalwareKind;
  homeX: number;
  homeY: number;
  targetX: number;
  targetY: number;
  nextDecisionAt: number;
  retreatUntil: number;
  speed: number;
  alertRadius: number;
  wanderRadius: number;
};

const HEART_COUNT = 3;
const HEART_UNITS = 2;
const MAX_PLAYER_HEALTH = HEART_COUNT * HEART_UNITS;
const MALWARE_TOUCH_DAMAGE = 1;
const WRONG_ANSWER_DAMAGE = 2;
const CORRECT_ANSWER_HEAL = 2;

const DOOR_CLOSED = { topL: 450, topR: 451, botL: 482, botR: 483 };
const DOOR_OPEN = { topL: 453, topR: 454, botL: 485, botR: 486 };

const MALWARE_KINDS: MalwareKind[] = [
  'trojan',
  'worm',
  'virus',
  'spyware',
];

const MALWARE_DATA: Record<MalwareKind, MalwareData> = {
  trojan: {
    anim: 'malware-trojan',
    frames: [375, 376, 377, 378, 379, 380, 381, 382],
    color: 0xdcc7a1,
  },

  worm: {
    anim: 'malware-worm',
    frames: [439, 440, 441, 442, 443, 444, 445, 446],
    color: 0x4cc96f,
  },

  virus: {
    anim: 'malware-virus',
    frames: [503, 504, 505, 506, 507, 508, 509, 510],
    color: 0xff4d57,
  },

  spyware: {
    anim: 'malware-spyware',
    frames: [567, 568, 569, 570],
    color: 0xc13bcf,
  },
};

export class MLevel extends BaseIntegratedLevel {
  private playerHealth = MAX_PLAYER_HEALTH;
  private requiredTaskCount = 0;
  private usedMalwarePointKeys = new Set<string>();
  private roamingMalware: SpawnedMalware[] = [];
  private correctDoors: Phaser.GameObjects.Sprite[][] = [];
  private doorWallsLayer?: Phaser.Tilemaps.TilemapLayer;
  private malwareSprites: Phaser.Physics.Arcade.Sprite[] = [];
  private malwareDoorBlockers: Phaser.Physics.Arcade.Sprite[] = [];
  private doorOpened = false;

  constructor() {
    super(LEVEL_CONFIGS.M);
  }

  async create(): Promise<void> {
    this.playerHealth = MAX_PLAYER_HEALTH;
    this.requiredTaskCount = 0;
    this.usedMalwarePointKeys.clear();
    this.roamingMalware = [];
    this.correctDoors = [];
    this.malwareSprites = [];
    this.malwareDoorBlockers = [];
    this.doorOpened = false;
    this.createMalwareAnimations();

    await super.create();

    this.createAdditionalMapLayers();
    this.createSystemHealthUI();
    this.initCorrectDoors();
    this.initRoamingMalware();

    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.game.events.emit('health:hide');
      this.roamingMalware.forEach(malware => {
        this.tweens.killTweensOf([malware.sprite, malware.aura]);
        malware.sprite.body?.stop();
      });
    });
  }

  update(): void {
    super.update();
    this.updateRoamingMalware();
  }

  protected initAssessment(): void {
    const questionPoints = this.map.filterObjects(
      'QuestionPoints',
      obj => obj.name === 'QuestionPoint'
    ) ?? [];

    const malwarePoints = this.map.filterObjects(
      'MalwarePoints',
      obj => obj.name === 'MalwarePoint'
    ) ?? [];

    Phaser.Utils.Array.Shuffle(questionPoints);
    Phaser.Utils.Array.Shuffle(malwarePoints);

    const assignments = this.createTaskAssignments(
      questionPoints,
      malwarePoints
    );

    if (assignments.length < this.questions.length) {
      console.warn(
        `Malware has ${this.questions.length} playable questions but only ${assignments.length} task points. Trimming to spawned tasks.`
      );
    }

    this.questions = assignments.map(
      assignment => this.questions[assignment.questionIndex]
    );
    assignments.forEach((assignment, index) => {
      assignment.questionIndex = index;
    });

    this.requiredTaskCount = assignments.length;
    this.totalquestions = assignments.length;

    this.questionPoints = assignments.map(assignment => {
      if (assignment.source === 'malware') {
        return this.spawnMalwareTask(assignment);
      }

      return this.spawnQuestionTask(assignment);
    });
  }

  protected async startQuestionAtPoint(
    pointPair: any,
    qIndex: number
  ): Promise<void> {

    if (pointPair.taskDone) return;

    this.inAssessment = true;
    this.player.lockMovement();

    this.tweens.add({
      targets: pointPair,
      scale: 1.7,
      duration: 120,
      yoyo: true,
      ease: 'Quad.easeOut'
    });

    const q = this.questions[qIndex];

    this.popup.mode = "learning";
    this.popup.correctAnswer = q.answer;

    this.popup.show(q.question, q.choices, async (choice) => {

      const result = {
        userid: this.userData.userId,
        question_id: q.question_id,
        user_answer: choice,
        correct_answer: q.answer,
        topic: this.config.topic,

        subcategory: this.inferSubcat(q.question_id),
        is_correct: choice === q.answer,
        timestamp: new Date(),
      } as any;

      pointPair.taskDone = true;
      this.assessmentResults.push(result);
      this.onQuestionAnswered(result, qIndex);

      if (pointPair.taskSource === 'malware') {
        this.cleanMalware(pointPair, result.is_correct);
      } else {
        this.cleanQuestionMarker(pointPair, result.is_correct);
      }

      if (result.is_correct) {
        this.healPlayer(CORRECT_ANSWER_HEAL);
      } else {
        this.damagePlayer(pointPair[0], WRONG_ANSWER_DAMAGE);
      }

      try {
        await this.submitAnswer({
          question_id: result.question_id,
          user_answer: result.user_answer,
          correct_answer: result.correct_answer,
          topic: result.topic,
          subcategory: result.subcategory,
          is_correct: result.is_correct,
          timestamp: result.timestamp,
        } as any);

        console.log("Malware question submitted");

      } catch (err) {

        console.error("Failed to submit Malware question", err);

      }

      const finish = () => {
        this.inAssessment = false;
        this.player.unlockMovement();

        if (this.assessmentResults.length >= this.requiredTaskCount) {
          void this.completeAssessment();
        }

        this.game.events.emit(
          'questions:update',
          this.totalquestions,
          this.assessmentResults.length
        );
      };

      if (this.playerHealth <= 0) {
        this.showSystemReset(finish);
        return;
      }

      finish();
    });
  }

  protected async completeAssessment(): Promise<void> {
    if (this.assessmentCompleted) return;
    if (this.assessmentResults.length < this.requiredTaskCount) return;

    await super.completeAssessment();
    this.openCorrectDoors();
  }

  private createTaskAssignments(
    questionPoints: any[],
    malwarePoints: any[]
  ): TaskAssignment[] {
    const taskCount = Math.min(
      this.questions.length,
      questionPoints.length + malwarePoints.length
    );
    const assignments: TaskAssignment[] = [];

    for (let index = 0; index < taskCount; index += 1) {
      if (index < questionPoints.length) {
        assignments.push({
          point: questionPoints[index],
          questionIndex: index,
          source: 'question',
        });
        continue;
      }

      const malwarePoint = malwarePoints[index - questionPoints.length];
      this.usedMalwarePointKeys.add(this.getPointKey(malwarePoint));

      assignments.push({
        point: malwarePoint,
        questionIndex: index,
        source: 'malware',
      });
    }

    return assignments;
  }

  private spawnQuestionTask(assignment: TaskAssignment): any {
    const x = assignment.point.x ?? 0;
    const y = assignment.point.y ?? 0;

    const bottom = this.physics.add
      .sprite(x, y, 'tiles_spr', 340)
      .setScale(1.5);

    const top = this.physics.add
      .sprite(x, y - 16, 'tiles_spr', 308)
      .setScale(1.5);

    [bottom, top].forEach(sprite => {
      sprite.once('destroy', () => this.tweens.killTweensOf(sprite));
    });

    this.tweens.add({
      targets: [bottom, top],
      y: '-=4',
      duration: 900,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.easeInOut'
    });

    this.tweens.add({
      targets: [bottom, top],
      alpha: 0.7,
      duration: 800,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.easeInOut'
    });

    const pair = [bottom, top] as any;
    pair.questionIndex = assignment.questionIndex;
    pair.taskSource = 'question';
    pair.taskDone = false;

    return pair;
  }

  private spawnMalwareTask(assignment: TaskAssignment): any {
    const kind = this.getRandomMalwareKind(assignment.questionIndex);
    const malware = this.spawnMalwareSprite(
      assignment.point.x ?? 0,
      assignment.point.y ?? 0,
      kind
    );

    this.startMalwarePulse(malware);

    const pair = [malware.sprite] as any;
    pair.questionIndex = assignment.questionIndex;
    pair.taskSource = 'malware';
    pair.taskDone = false;
    pair.aura = malware.aura;

    return pair;
  }

  private initRoamingMalware(): void {
    const malwarePoints = this.map.filterObjects(
      'MalwarePoints',
      obj => obj.name === 'MalwarePoint'
    ) ?? [];

    malwarePoints.forEach((point, index) => {
      if (this.usedMalwarePointKeys.has(this.getPointKey(point))) return;

      const kind = this.getRandomMalwareKind(index);
      const malware = this.spawnMalwareSprite(
        point.x ?? 0,
        point.y ?? 0,
        kind
      );

      this.startMalwarePulse(malware);
      this.roamingMalware.push(malware);

      this.physics.add.overlap(this.player, malware.sprite, () => {
        this.handleRoamingMalwareHit(malware);
      });
    });
  }

  private createMalwareAnimations(): void {
    Object.values(MALWARE_DATA).forEach(data => {
      if (this.anims.exists(data.anim)) return;

      this.anims.create({
        key: data.anim,
        frames: data.frames.map(frame => ({
          key: 'tiles_spr',
          frame,
        })),
        frameRate: 8,
        repeat: -1,
      });
    });
  }

  private getRandomMalwareKind(index: number): MalwareKind {
    return MALWARE_KINDS[index % MALWARE_KINDS.length];
  }

  private spawnMalwareSprite(
    x: number,
    y: number,
    kind: MalwareKind
  ): SpawnedMalware {
    const data = MALWARE_DATA[kind];

    const aura = this.add
      .circle(x, y + 5, 11, data.color, 0.28)
      .setDepth(1);

    const sprite = this.physics.add
      .sprite(x, y - 4, 'tiles_spr', data.frames[0])
      .setScale(1.55)
      .setDepth(4);

    sprite.setImmovable(true);
    sprite.body.allowGravity = false;
    sprite.body.setSize(12, 12);
    sprite.setCollideWorldBounds(true);
    sprite.play(data.anim);
    sprite.setData('lastHitAt', 0);

    this.physics.add.collider(sprite, this.wallsLayer);
    this.physics.add.collider(sprite, this.wallsLayer2);
    this.addDoorCollidersForMalware(sprite);

    sprite.once('destroy', () => this.tweens.killTweensOf(sprite));
    aura.once('destroy', () => this.tweens.killTweensOf(aura));
    this.malwareSprites.push(sprite);

    return {
      sprite,
      aura,
      kind,
      homeX: x,
      homeY: y - 4,
      targetX: x,
      targetY: y - 4,
      nextDecisionAt: 0,
      retreatUntil: 0,
      ...this.getMalwareMovement(kind),
    };
  }

  private startMalwarePulse(malware: SpawnedMalware): void {
    this.tweens.add({
      targets: malware.aura,
      alpha: 0.08,
      scale: 1.25,
      duration: 700,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.easeInOut',
    });
  }

  private updateRoamingMalware(): void {
    if (!this.player || this.inAssessment || this.assessmentCompleted) {
      this.roamingMalware.forEach(malware => {
        const body = malware.sprite.body as Phaser.Physics.Arcade.Body | null;
        body?.stop();
      });
      return;
    }

    this.roamingMalware.forEach(malware => {
      if (!malware.sprite.active) return;

      const now = this.time.now;
      const distanceToPlayer = Phaser.Math.Distance.Between(
        malware.sprite.x,
        malware.sprite.y,
        this.player.x,
        this.player.y
      );
      const distanceFromHome = Phaser.Math.Distance.Between(
        malware.sprite.x,
        malware.sprite.y,
        malware.homeX,
        malware.homeY
      );

      if (malware.retreatUntil > now) {
        this.setRetreatTarget(malware);
      } else if (distanceFromHome > malware.wanderRadius * 1.55) {
        malware.targetX = malware.homeX;
        malware.targetY = malware.homeY;
      } else if (
        distanceToPlayer <= malware.alertRadius &&
        this.canMalwareSeePlayer(malware.sprite)
      ) {
        this.setAlertTarget(malware, distanceToPlayer);
      } else if (now >= malware.nextDecisionAt) {
        this.setWanderTarget(malware);
      }

      this.moveMalwareTowardTarget(malware);
      malware.aura.setPosition(malware.sprite.x, malware.sprite.y + 5);
    });
  }

  private setAlertTarget(
    malware: SpawnedMalware,
    distanceToPlayer: number
  ): void {
    if (malware.kind === 'spyware') {
      const angle = Phaser.Math.Angle.Between(
        this.player.x,
        this.player.y,
        malware.sprite.x,
        malware.sprite.y
      );

      malware.targetX = malware.sprite.x + Math.cos(angle) * 48;
      malware.targetY = malware.sprite.y + Math.sin(angle) * 48;
      malware.nextDecisionAt = this.time.now + 260;
      return;
    }

    if (malware.kind === 'trojan' && distanceToPlayer > 72) {
      this.setWanderTarget(malware, 520);
      return;
    }

    const weave =
      malware.kind === 'worm'
        ? Math.sin(this.time.now / 230 + malware.homeX) * 34
        : 0;

    malware.targetX = this.player.x + weave;
    malware.targetY = this.player.y - weave * 0.35;
    malware.nextDecisionAt = this.time.now + 180;
  }

  private setRetreatTarget(malware: SpawnedMalware): void {
    const angle = Phaser.Math.Angle.Between(
      this.player.x,
      this.player.y,
      malware.sprite.x,
      malware.sprite.y
    );

    malware.targetX = malware.sprite.x + Math.cos(angle) * 64;
    malware.targetY = malware.sprite.y + Math.sin(angle) * 64;
  }

  private setWanderTarget(
    malware: SpawnedMalware,
    duration = Phaser.Math.Between(700, 1400)
  ): void {
    const angle = Phaser.Math.FloatBetween(0, Math.PI * 2);
    const radius = Phaser.Math.Between(18, malware.wanderRadius);

    malware.targetX = malware.homeX + Math.cos(angle) * radius;
    malware.targetY = malware.homeY + Math.sin(angle) * radius;
    malware.nextDecisionAt = this.time.now + duration;
  }

  private moveMalwareTowardTarget(malware: SpawnedMalware): void {
    const distanceToTarget = Phaser.Math.Distance.Between(
      malware.sprite.x,
      malware.sprite.y,
      malware.targetX,
      malware.targetY
    );

    if (distanceToTarget < 6) {
      malware.sprite.setVelocity(0, 0);
      return;
    }

    this.physics.moveTo(
      malware.sprite,
      malware.targetX,
      malware.targetY,
      malware.speed
    );

    const body = malware.sprite.body as Phaser.Physics.Arcade.Body | null;
    const velocityX = body?.velocity.x ?? 0;
    if (Math.abs(velocityX) > 2) {
      malware.sprite.setFlipX(velocityX < 0);
    }
  }

  private getMalwareMovement(kind: MalwareKind): {
    speed: number;
    alertRadius: number;
    wanderRadius: number;
  } {
    if (kind === 'virus') {
      return { speed: 58, alertRadius: 128, wanderRadius: 62 };
    }

    if (kind === 'worm') {
      return { speed: 46, alertRadius: 116, wanderRadius: 86 };
    }

    if (kind === 'spyware') {
      return { speed: 52, alertRadius: 120, wanderRadius: 74 };
    }

    return { speed: 42, alertRadius: 96, wanderRadius: 54 };
  }

  private handleRoamingMalwareHit(
    malware: SpawnedMalware
  ): void {
    if (this.inAssessment || this.assessmentCompleted) return;

    const now = this.time.now;
    const sprite = malware.sprite;
    const lastHitAt = Number(sprite.getData('lastHitAt') ?? 0);

    if (now - lastHitAt < 1800) return;

    sprite.setData('lastHitAt', now);
    malware.retreatUntil = now + 900;
    this.damagePlayer(sprite, MALWARE_TOUCH_DAMAGE);
    this.knockPlayerAwayFrom(sprite);

    this.tweens.add({
      targets: sprite,
      alpha: 0.35,
      duration: 90,
      yoyo: true,
      repeat: 3,
    });

    if (this.playerHealth <= 0) {
      this.inAssessment = true;
      this.player.lockMovement();

      this.showSystemReset(() => {
        this.inAssessment = false;
        this.player.unlockMovement();
      });
    }
  }

  private cleanQuestionMarker(pointPair: any, correct: boolean): void {
    const sprites = pointPair as Phaser.Physics.Arcade.Sprite[];

    sprites.forEach(sprite => {
      sprite.disableBody(false, false);
      sprite.setTint(correct ? 0x80ff9a : 0xff5b5b);
      this.tweens.killTweensOf(sprite);
    });

    this.tweens.add({
      targets: sprites,
      alpha: 0,
      scale: 0.3,
      duration: 320,
      ease: 'Back.In',
      onComplete: () => {
        sprites.forEach(sprite => sprite.destroy());
      },
    });
  }

  private cleanMalware(pointPair: any, correct: boolean): void {
    const malware = pointPair[0] as Phaser.Physics.Arcade.Sprite;
    const aura = pointPair.aura as Phaser.GameObjects.Arc | undefined;

    malware.disableBody(false, false);
    malware.stop();
    malware.setTint(correct ? 0x80ff9a : 0xff5b5b);

    this.tweens.killTweensOf(malware);
    if (aura) this.tweens.killTweensOf(aura);

    this.tweens.add({
      targets: aura ? [malware, aura] : [malware],
      alpha: 0,
      scale: 0.3,
      duration: 320,
      ease: 'Back.In',
      onComplete: () => {
        malware.destroy();
        aura?.destroy();
      },
    });
  }

  private damagePlayer(
    target?: Phaser.GameObjects.Sprite,
    amount = 1
  ): void {
    this.playerHealth = Math.max(0, this.playerHealth - amount);
    this.updateHealthUI();

    target?.setTint(0xff3333);
    this.time.delayedCall(260, () => {
      if (target?.active) {
        target.clearTint();
      }
    });
    this.cameras.main.shake(180, 0.006);
  }

  private healPlayer(amount = 1): void {
    const nextHealth = Math.min(
      MAX_PLAYER_HEALTH,
      this.playerHealth + amount
    );

    if (nextHealth === this.playerHealth) return;

    this.playerHealth = nextHealth;
    this.updateHealthUI();

    this.player.setTint(0x8cff9a);
    this.time.delayedCall(220, () => {
      if (this.player.active) {
        this.player.clearTint();
      }
    });
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

    this.time.delayedCall(180, () => {
      if (!this.inAssessment) {
        this.player.unlockMovement();
      }
    });
  }

  private showSystemReset(onClose: () => void): void {
    this.popup.showInfo(
      "Quarantine Reset",
      "Health dropped too low. Restoring protection before you continue.",
      () => {
        this.playerHealth = MAX_PLAYER_HEALTH;
        this.updateHealthUI();
        onClose();
      }
    );
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
    this.map.createLayer('Pillar', this.tileset, 0, 0)?.setDepth(8);
    this.player.setDepth(5);

    this.malwareSprites.forEach(sprite => this.addDoorCollidersForMalware(sprite));
  }

  private initCorrectDoors(): void {
    const correctDoorObjects = this.map.filterObjects(
      'Door-correct',
      obj => obj.name === 'DoorCorrectPoint'
    ) ?? [];

    this.correctDoors = correctDoorObjects.map(obj => this.spawnDoor(obj));
  }

  private spawnDoor(obj: any): Phaser.GameObjects.Sprite[] {
    const x = obj.x ?? 0;
    const y = obj.y ?? 0;

    const botL = this.physics.add.staticSprite(
      x - 8,
      y,
      'tiles_spr',
      DOOR_CLOSED.botL
    )
      .setScale(1)
      .setDepth(4);

    const botR = this.physics.add.staticSprite(
      x + 8,
      y,
      'tiles_spr',
      DOOR_CLOSED.botR
    )
      .setScale(1)
      .setDepth(4);

    const topL = this.physics.add.staticSprite(
      x - 8,
      y - 16,
      'tiles_spr',
      DOOR_CLOSED.topL
    )
      .setScale(1)
      .setDepth(6);

    const topR = this.physics.add.staticSprite(
      x + 8,
      y - 16,
      'tiles_spr',
      DOOR_CLOSED.topR
    )
      .setScale(1)
      .setDepth(6);

    this.physics.add.collider(this.player, botL);
    this.physics.add.collider(this.player, botR);

    const door = [botL, botR, topL, topR];
    this.malwareDoorBlockers.push(botL, botR);
    this.malwareSprites.forEach(malware => {
      this.physics.add.collider(malware, botL);
      this.physics.add.collider(malware, botR);
    });

    this.tweens.add({
      targets: door,
      alpha: 0.65,
      duration: 650,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.easeInOut'
    });

    return door;
  }

  private openCorrectDoors(): void {
    if (this.doorOpened) return;

    this.correctDoors.forEach(door => this.openDoor(door));
    this.doorOpened = true;
  }

  private openDoor(door: Phaser.GameObjects.Sprite[]): void {
    door.forEach(sprite => {
      this.tweens.killTweensOf(sprite);
      this.physics.world.disable(sprite);

      const frame = Number(sprite.frame.name);

      if (frame === DOOR_CLOSED.topL) {
        sprite.setFrame(DOOR_OPEN.topL);
        sprite.setDepth(3);
      }

      if (frame === DOOR_CLOSED.topR) {
        sprite.setFrame(DOOR_OPEN.topR);
        sprite.setDepth(3);
      }

      if (frame === DOOR_CLOSED.botL) {
        sprite.setFrame(DOOR_OPEN.botL);
        sprite.setDepth(1);
      }

      if (frame === DOOR_CLOSED.botR) {
        sprite.setFrame(DOOR_OPEN.botR);
        sprite.setDepth(1);
      }
    });

    this.player.setDepth(2);
  }

  private addDoorCollidersForMalware(
    sprite: Phaser.Physics.Arcade.Sprite
  ): void {
    if (this.doorWallsLayer) {
      this.physics.add.collider(sprite, this.doorWallsLayer);
    }

    this.malwareDoorBlockers.forEach(blocker => {
      if (blocker.active) {
        this.physics.add.collider(sprite, blocker);
      }
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
    return this.malwareDoorBlockers.some(blocker => {
      const body = blocker.body as Phaser.Physics.Arcade.StaticBody | null;
      if (!blocker.active || !body?.enable) return false;

      return Phaser.Geom.Intersects.LineToRectangle(
        line,
        blocker.getBounds()
      );
    });
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

  private getPointKey(point: any): string {
    const x = Math.round((point.x ?? 0) * 10);
    const y = Math.round((point.y ?? 0) * 10);

    return `${x}:${y}`;
  }
}
