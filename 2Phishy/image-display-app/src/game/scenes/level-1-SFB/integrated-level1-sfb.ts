import { BaseIntegratedLevel, LevelInteractable } from '../core/BaseIntegratedLevel';
import { LEVEL_CONFIGS } from '../core/LevelConfigurations';
import {Tilemaps} from "phaser";
import {gameAPI} from "../../helpers/game-api.ts";
import { AudioManager, SFX } from "../../audio";

type TrapChestState = {
  sprite: Phaser.GameObjects.Sprite;
  configuredZone: number | undefined;
  triggered: boolean;
};

export class SFBLevel extends BaseIntegratedLevel {

  private correctDoors: Record<number, Phaser.GameObjects.Sprite[]> = {};
  private wrongDoors: Record<number, Phaser.GameObjects.Sprite[]> = {};
  private trapChests: TrapChestState[] = [];
  private spawnedPlatforms: Phaser.GameObjects.Sprite[] = [];
  private doorWallsLayer!: Tilemaps.TilemapLayer;
  private unlockedZone = 1;
  private allCorrectDoorsOpened = false;

  constructor() {
    super(LEVEL_CONFIGS.SFB);
  }

  async create() {
    const progress = await gameAPI.getUserProgress(this.userData.userId);
    const savedProgress =
        progress.data?.progress?.progress?.[this.config.topic];
    console.log(
        "SAVED PROGRESS",
        savedProgress
    );
    this.unlockedZone =
        savedProgress?.unlocked_zone ?? 1;

    this.currentZone =
        savedProgress?.current_zone ?? 0;

    console.log(
        "ZONE BEFORE SUPER",
        this.currentZone
    );


    await super.create();
    this.initializeZoneProgress();
    this.createTrapAnimations();
    this.initDoors();
    for (let z = 1; z < this.unlockedZone; z++) {

        if (this.correctDoors[z]) {
            this.openDoor(this.correctDoors[z]);
        }

    }
    this.advancePastEmptyZones(this.currentZone || this.unlockedZone || 1);
    this.initTrapChests();

  }

  protected initAssessment(): void {

    this.questionPoints = [];

    const questionList = this.questions;

    const allPoints = this.map.filterObjects(
        'QuestionPoints',
        obj => obj.name === 'QuestionPoint'
    );

    const zone1Points = allPoints.filter(
      p => this.getObjectNumberProperty(p, 'zone_number') === 1
    );
    const zone2Points = allPoints.filter(
      p => this.getObjectNumberProperty(p, 'zone_number') === 2
    );
    const zone3Points = allPoints.filter(
      p => this.getObjectNumberProperty(p, 'zone_number') === 3
    );

    const zone1Questions = questionList.filter(q => Number(q.zone) === 1);
    const zone2Questions = questionList.filter(q => Number(q.zone) === 2);
    const zone3Questions = questionList.filter(q => Number(q.zone) === 3);

    const spawnedQuestions = [
      ...this.spawnZoneQuestions(zone1Points, zone1Questions),
      ...this.spawnZoneQuestions(zone2Points, zone2Questions),
      ...this.spawnZoneQuestions(zone3Points, zone3Questions),
    ];

    if (spawnedQuestions.length < questionList.length) {
      console.warn(
        `SFB has ${questionList.length} playable questions but only ${spawnedQuestions.length} matching zone question points. Trimming to spawned questions.`
      );
    }

    this.questions = spawnedQuestions;
    this.totalquestions = spawnedQuestions.length;
  }


  private distributeKnowledgeByZone() {

    const updatedKnowledgeList = this.knowledgeList.map((knowledge) => {

      const linkedQuestion = this.questions.find(
          q => q.question_id === knowledge.question_id
      );

      if (!linkedQuestion) return undefined;

      return {
        ...knowledge,
        zone: linkedQuestion.zone,
      };
    }).filter(Boolean);

    this.knowledgeList = updatedKnowledgeList;

    return this.knowledgeList;
  }

  private spawnZoneQuestions(points: any[], questions: any[]): any[] {

    Phaser.Utils.Array.Shuffle(points);

    const selected = points.slice(0, questions.length);
    const spawnedQuestions = questions.slice(0, selected.length);

    selected.forEach((pt, index) => {
      const question = spawnedQuestions[index];

      const bottom = this.physics.add
          .sprite(pt.x, pt.y, 'tiles_spr', 340)
          .setScale(1.5);

      const top = this.physics.add
          .sprite(pt.x, pt.y - 16, 'tiles_spr', 308)
          .setScale(1.5);

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

      [bottom, top].forEach(sprite => {
        sprite.once('destroy', () => this.tweens.killTweensOf(sprite));
      });

      const pair = [bottom, top] as any;

      pair.questionData = question;
      pair.zone = Number(question.zone);

      this.questionPoints.push(pair);
    });

    return spawnedQuestions;
  }

  protected onQuestionAnswered(result: any, zone: number): void {

    const progress = this.zoneProgress[zone];
    if (!progress) {
      console.warn(`No SFB zone progress for zone ${zone}; checking completion.`);
      if (this.hasAnsweredEveryQuestionCorrectly()) {
        this.openAllCorrectDoorsAndComplete();
      }
      return;
    }

    // Ignore repeated attempts
    if (progress.answered.has(result.question_id)) {
      return;
    }

    progress.answered.add(result.question_id);

    if (!result.is_correct) {
      progress.failed = true;
    }

    if (this.hasAnsweredEveryQuestionCorrectly()) {
      this.openAllCorrectDoorsAndComplete();
      return;
    }

    const allAnswered =
      progress.answered.size >= progress.total;

    if (!allAnswered) return;

    // ZONE FAILED
    if (progress.failed) {

      console.log(`Zone ${zone} failed`);
      this.recordGameplayMetric('zone_failures');

      this.currentZone = zone;

      this.openDoor(this.wrongDoors[zone]);
    }

    // ZONE CLEARED
    else {

      console.log(`   Zone ${zone} cleared`);
      this.recordGameplayMetric('zones_cleared');

      const newZone = zone + 1;

      this.currentZone = newZone;
      this.unlockedZone = Math.max(this.unlockedZone, newZone);

      this.openDoor(this.correctDoors[zone]);
      const isFinalZone = zone === 3;

      if (isFinalZone) {
        void this.completeAssessment();
        return;
      }

      if (!this.advancePastEmptyZones(newZone)) {
        this.persistCurrentZone();
      }

    }

  }

  private hasAnsweredEveryQuestionCorrectly(): boolean {
    const progressList = Object.values(this.zoneProgress);

    if (progressList.length === 0) {
      return false;
    }

    const total = progressList.reduce((sum, progress) => sum + progress.total, 0);
    const answered = progressList.reduce(
      (sum, progress) => sum + progress.answered.size,
      0
    );

    return (
      total > 0 &&
      answered >= total &&
      progressList.every(progress =>
        !progress.failed && progress.answered.size >= progress.total
      )
    );
  }

  private openAllCorrectDoorsAndComplete(): void {
    if (this.allCorrectDoorsOpened) return;

    this.allCorrectDoorsOpened = true;
    const finalZone = Math.max(
      3,
      ...Object.keys(this.correctDoors).map(Number)
    );

    this.currentZone = finalZone;
    this.unlockedZone = Math.max(this.unlockedZone, finalZone + 1);

    Object.values(this.correctDoors).forEach(door => {
      this.openDoor(door);
    });

    gameAPI.updateCurrentZone({
      userid: this.userData.userId,
      topic: this.config.topic,
      current_zone: this.currentZone,
      unlocked_zone: this.unlockedZone
    }).catch(console.error);

    void this.completeAssessment();
  }

  private advancePastEmptyZones(startZone: number): boolean {
    const highestZone = this.getHighestConfiguredZone();
    let zone = this.normalizeZone(startZone);
    let advanced = false;

    while (zone <= highestZone && !this.zoneHasAvailableQuestionWands(zone)) {
      console.warn(
        `SFB zone ${zone} has no active question wands; opening the next correct door.`
      );

      this.openDoor(this.correctDoors[zone]);
      this.currentZone = zone + 1;
      this.unlockedZone = Math.max(this.unlockedZone, zone + 1);
      advanced = true;
      zone += 1;
    }

    if (!advanced) {
      return false;
    }

    if (zone > highestZone) {
      this.openAllCorrectDoorsAndComplete();
      return true;
    }

    this.persistCurrentZone();
    return true;
  }

  private zoneHasAvailableQuestionWands(zone: number): boolean {
    return this.questionPoints.some((pair: any) => {
      const questionZone = Number(pair.zone ?? pair.questionData?.zone);

      if (questionZone !== zone) {
        return false;
      }

      return pair.some((sprite: Phaser.Physics.Arcade.Sprite) => {
        const bodyEnabled = !sprite.body || sprite.body.enable !== false;

        return sprite.active && sprite.visible && bodyEnabled;
      });
    });
  }

  private getHighestConfiguredZone(): number {
    const zones = [
      3,
      ...Object.keys(this.correctDoors).map(Number),
      ...Object.keys(this.zoneProgress).map(Number),
      ...this.questionPoints.map((pair: any) =>
        Number(pair.zone ?? pair.questionData?.zone)
      ),
    ].filter(zone => Number.isFinite(zone));

    return Math.max(...zones);
  }

  private normalizeZone(zone: number): number {
    const parsedZone = Math.floor(Number(zone));

    return Number.isFinite(parsedZone) && parsedZone > 0
      ? parsedZone
      : 1;
  }

  private persistCurrentZone(): void {
    gameAPI.updateCurrentZone({
      userid: this.userData.userId,
      topic: this.config.topic,
      current_zone: this.currentZone,
      unlocked_zone: this.unlockedZone
    }).catch(console.error);
  }
/*
   protected onQuestionAnswered(result: any, context: any): void {
     console.log("qIndex", context);
     const isCorrect = result.is_correct;

     const question = this.questions[context];
     const zone = question.zone;

     if (isCorrect) {

       const newZone = zone + 1;

       this.currentZone = newZone;

       this.openDoor(this.correctDoors[zone]);

       gameAPI.updateCurrentZone({
         userid: this.userData.userId,
         topic: this.config.topic,
         current_zone: newZone
       }).catch(console.error);

     } else {
       this.openDoor(this.wrongDoors[zone]);
     }
   }*/

  private zoneProgress: Record<number, {
  answered: Set<string>,
  failed: boolean,
  total: number
}> = {};

  protected async startQuestionAtPoint(
    pointPair: any,
    questionData: any
  ): Promise<void> {

    this.inAssessment = true;
    this.player.lockMovement();

    this.tweens.add({
      targets: pointPair,
      scale: 1.7,
      duration: 120,
      yoyo: true,
      ease: 'Quad.easeOut'
    });

    const q = questionData;
    if (!q) {
      console.warn('SFB question marker has no question data; disabling marker.');
      pointPair.forEach((sprite: Phaser.Physics.Arcade.Sprite) => {
        sprite.disableBody(true, true);
      });
      this.inAssessment = false;
      this.player.unlockMovement();
      return;
    }


    this.currentZone = Number(q.zone);
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
      };

      this.assessmentResults.push(result);
      this.recordGameplayMetric('questions_answered');
      this.recordGameplayMetric(
        result.is_correct ? 'correct_answers' : 'wrong_answers'
      );

      this.onQuestionAnswered(result, q.zone);

      try {

        await this.submitAnswer({
          question_id: result.question_id,
          user_answer: result.user_answer,
          correct_answer: result.correct_answer,
          topic: result.topic,
          subcategory: result.subcategory,
          is_correct: result.is_correct,
          timestamp: result.timestamp,
        });

        console.log("📡 Single question submitted");

      } catch (err) {

        console.error("❌ Failed to submit single question", err);

      }

      pointPair.forEach((sprite: Phaser.GameObjects.Sprite) => {
         sprite.disableBody(true, true);
      });

      this.inAssessment = false;
      this.player.unlockMovement();

      const total = this.totalquestions;

      const answered =
          Object.values(this.zoneProgress)
              .reduce((sum, z) => sum + z.answered.size, 0);

      this.game.events.emit('questions:update', total, answered);

    }, {
      hint: this.getQuestionHint(q),
    });
  }

  private initDoors() {

    this.doorWallsLayer = this.map.createLayer('Door-walls', this.tileset, 0, 0);

    const correctDoorObjects = this.map.filterObjects(
      'Door-correct',
      obj => obj.name === 'DoorCorrectPoint'
    );

    const wrongDoorObjects = this.map.filterObjects(
      'Door-wrong',
      obj => obj.name === 'DoorWrongPoint'
    );

    correctDoorObjects.forEach(obj => {

      const zone = this.getObjectNumberProperty(obj, 'zone_number');
      if (!zone) return;
      const door = this.spawnDoor(obj, true);

      door.forEach(sprite => {
        sprite.setAlpha(1);
        if (sprite.body) sprite.body.enable = true;
      });

      this.correctDoors[zone] = door;
    });

    wrongDoorObjects.forEach(obj => {

      const zone = this.getObjectNumberProperty(obj, 'zone_number');
      if (!zone) return;
      const door = this.spawnDoor(obj, false);

      door.forEach(sprite => {
        sprite.setAlpha(1);
        if (sprite.body) sprite.body.enable = true;
      });

      this.wrongDoors[zone] = door;
    });

  }

  private openDoor(door: Phaser.GameObjects.Sprite[]) {
    if (!door) return;
    AudioManager.playSfx(this, SFX.DOOR_OPEN);
    const OPEN = {
      topL: 453,
      topR: 454,
      botL: 485,
      botR: 486
    };

    door.forEach(sprite => {

      this.tweens.killTweensOf(sprite);

      this.physics.world.disable(sprite);

      const frame = sprite.frame.name;

      // TOP HALF
      if (frame === 450) {
        sprite.setFrame(OPEN.topL);
        sprite.setDepth(3);
      }

      if (frame === 451) {
        sprite.setFrame(OPEN.topR);
        sprite.setDepth(3);
      }

      // BOTTOM HALF
      if (frame === 482) {
        sprite.setFrame(OPEN.botL);
        sprite.setDepth(1);
      }

      if (frame === 483) {
        sprite.setFrame(OPEN.botR);
        sprite.setDepth(1);
      }
    });

    this.player.setDepth(2);
  }

  private createTrapAnimations() {

    if (this.anims.exists('trap_open')) return;

    this.anims.create({
      key: 'trap_open',
      frames: [
        { key: 'tiles_spr', frame: 659 },
        { key: 'tiles_spr', frame: 660 },
        { key: 'tiles_spr', frame: 661 }
      ],
      frameRate: 6
    });

  }

  private initTrapChests() {

    const trapObjects = this.map.filterObjects(
      'TrapChest',
      obj => obj.name === 'TrapChestPoint'
    );

    trapObjects.forEach(obj => {
      const configuredZone = this.getObjectNumberProperty(
        obj,
        'zone_number'
      );

      const chest = this.physics.add
        .sprite(obj.x, obj.y, 'tiles_spr', 659)
        .setScale(1.5);

      chest.setImmovable(true);
      chest.body.allowGravity = false;

      const state: TrapChestState = {
        sprite: chest,
        configuredZone,
        triggered: false,
      };


      this.trapChests.push(state);

    });

  }

  protected getAdditionalLevelInteractables(): LevelInteractable[] {
    return this.trapChests
      .filter(chest => !chest.triggered)
      .map(chest => ({
        x: chest.sprite.x,
        y: chest.sprite.y,
        prompt: 'Press E / ACT to open chest',
        action: () => this.triggerTrapChest(chest),
        range: this.interactionDistance,
      }));
  }

  private triggerTrapChest(state: TrapChestState): void {
    if (state.triggered || this.inAssessment) return;

    const chest = state.sprite;
    state.triggered = true;
    this.recordGameplayMetric('trap_hits');
    AudioManager.playSfx(this, SFX.TRAP_TRIGGER);
    AudioManager.playSfx(this, SFX.TRAP_CHEST_OPEN);
    AudioManager.playSfx(this, SFX.MALICIOUS_LINK_HIT);

    chest.play('trap_open');

    this.inAssessment = true;
    this.player.lockMovement();
    this.cameras.main.shake(200, 0.01);

    this.tweens.add({
      targets: this.player,
      alpha: 0,
      duration: 150,
      yoyo: true,
    });

    this.popup.showInfo(
      "Trap!",
      "That was a malicious link!",
      () => {
        const failedZone = this.resolveTrapZone(state.configuredZone);
        this.currentZone = failedZone;

        this.resetZone(failedZone);

        const spawn = this.getSpawnPoint(failedZone);

        gameAPI.updateCurrentZone({
          userid: this.userData.userId,
          topic: this.config.topic,
          current_zone: failedZone,
          unlocked_zone: this.unlockedZone
        }).catch(console.error);

        this.player.bodyRef().stop();
        this.player.setVelocity(0, 0);
        this.player.setPosition(spawn.x, spawn.y - 4);

        chest.anims.stop();
        chest.setFrame(659);

        this.player.setAlpha(0);

        this.tweens.add({
          targets: this.player,
          alpha: 1,
          duration: 250
        });

        this.inAssessment = false;
        this.player.unlockMovement();

        this.time.delayedCall(1000, () => {
          state.triggered = false;
        });
      }
    );
  }

  private spawnDoor(obj: any) {

    const x = obj.x;
    const y = obj.y;

    const CLOSED = { topL: 450, topR: 451, botL: 482, botR: 483 };

    const DEPTH = {
      FLOOR: 0,
      BELOW_PLAYER: 4,
      PLAYER: 5,
      ABOVE_PLAYER: 6,
      UI: 100
    };

    const botL = this.physics.add.staticSprite(x - 8, y, 'tiles_spr', CLOSED.botL)
      .setScale(1)
      .setDepth(DEPTH.BELOW_PLAYER);

    const botR = this.physics.add.staticSprite(x + 8, y, 'tiles_spr', CLOSED.botR)
      .setScale(1)
      .setDepth(DEPTH.BELOW_PLAYER);

    const topL = this.physics.add.staticSprite(x - 8, y - 16, 'tiles_spr', CLOSED.topL)
      .setScale(1)
      .setDepth(DEPTH.ABOVE_PLAYER);

    const topR = this.physics.add.staticSprite(x + 8, y - 16, 'tiles_spr', CLOSED.topR)
      .setScale(1)
      .setDepth(DEPTH.ABOVE_PLAYER);

    this.physics.add.collider(this.player, botL);
    this.physics.add.collider(this.player, botR);

    const door = [botL, botR, topL, topR];

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


  private closeDoor(door: Phaser.GameObjects.Sprite[]) {
      if (!door) return;
      AudioManager.playSfx(this, SFX.DOOR_CLOSE);
      const CLOSED = {
          topL: 450,
          topR: 451,
          botL: 482,
          botR: 483
      };

      door.forEach(sprite => {

          const frame = sprite.frame.name;

          // OPEN TOP
          if (frame === 453) {
              sprite.setFrame(CLOSED.topL);
              sprite.setDepth(6);
          }

          if (frame === 454) {
              sprite.setFrame(CLOSED.topR);
              sprite.setDepth(6);
          }

          // OPEN BOTTOM
          if (frame === 485) {
              sprite.setFrame(CLOSED.botL);
              sprite.setDepth(4);
          }

          if (frame === 486) {
              sprite.setFrame(CLOSED.botR);
              sprite.setDepth(4);
          }

          // re-enable collisions
          this.physics.world.enable(sprite);

          if (sprite.body) {
              sprite.body.enable = true;
          }

      });

      this.tweens.killTweensOf(door);

      this.tweens.add({
          targets: door,
          alpha: 0.65,
          duration: 650,
          yoyo: true,
          repeat: -1,
          ease: 'Sine.easeInOut'
      });

  }

  private resetZone(zone: number) {

      console.log(`Resetting Zone ${zone}`);
      AudioManager.playSfx(this, SFX.ZONE_RESET);

      const progress = this.zoneProgress[zone];
      if (!progress) {
          console.warn(`Cannot reset SFB zone ${zone}; no zone progress exists.`);
          return;
      }

      progress.answered.clear();
      progress.failed = false;

      if (this.wrongDoors[zone]) {
          this.closeDoor(this.wrongDoors[zone]);
      }

      if (this.correctDoors[zone]) {
          this.closeDoor(this.correctDoors[zone]);
      }

      this.questionPoints.forEach((pair: any) => {

          const q = pair.questionData;

          if (q.zone !== zone) return;

          pair.forEach((sprite: Phaser.Physics.Arcade.Sprite) => {

              sprite.enableBody(
                  false,
                  sprite.x,
                  sprite.y,
                  true,
                  true
              );

              sprite.setAlpha(1);

          });

      });

      const answered = Object.values(this.zoneProgress)
        .reduce((sum, zoneProgress) => {
          return sum + zoneProgress.answered.size;
        }, 0);

      this.game.events.emit(
        'questions:update',
        this.totalquestions,
        answered
      );

  }

  private resolveTrapZone(configuredZone: number): number {
    const knownZones = Object.keys(this.zoneProgress)
      .map(Number)
      .filter(zone => Number.isFinite(zone));

    const candidates = [
      configuredZone,
      this.currentZone,
      this.unlockedZone,
      knownZones[0],
      1,
    ];

    return candidates.find(zone => Boolean(this.zoneProgress[zone])) ?? 1;
  }


  protected initKnowledge(): void {
    this.knowledgePoints = [];

    const allPoints = this.map.filterObjects(
      'KnowledgePoints',
      obj => obj.name === 'KnowledgePoint'
    );

    const zones: Record<number, any[]> = {
      1: [],
      2: [],
      3: []
    };

    allPoints.forEach(p => {
      const z = this.getObjectNumberProperty(p, 'zone_number');
      if (zones[z]) zones[z].push(p);
    });

    const knowledgeList = this.distributeKnowledgeByZone();

    const zone1Knowledge = knowledgeList.filter(k => k.zone === 1);
    const zone2Knowledge = knowledgeList.filter(k => k.zone === 2);
    const zone3Knowledge = knowledgeList.filter(k => k.zone === 3);

    const spawnKnowledge = (points: any[], knowledgeList: any[]) => {

      Phaser.Utils.Array.Shuffle(points);

      const selected = points.slice(0, knowledgeList.length);

      selected.forEach((pt, index) => {

        const sprite = this.physics.add
          .sprite(pt.x, pt.y, 'tiles_spr', 627)
          .setScale(1.5);

        sprite.setImmovable(true);
        sprite.body.allowGravity = false;

        const point: any = [sprite];

        point.isOpen = false;
        point.isAnimating = false;

        point.knowledge = knowledgeList[index];

        point.wasTouching = false;

        this.knowledgePoints.push(point);

      });

    };

    spawnKnowledge(zones[1], zone1Knowledge);
    spawnKnowledge(zones[2], zone2Knowledge);
    spawnKnowledge(zones[3], zone3Knowledge);

  }


  protected getQuestionInteractContext(pointPair: any): any {
    return pointPair.questionData;
  }

  private initializeZoneProgress() {

  const grouped: Record<number, any[]> = {};

  this.questions.forEach(q => {

    if (!grouped[q.zone]) {
      grouped[q.zone] = [];
    }

    grouped[q.zone].push(q);

  });

  Object.keys(grouped).forEach(zoneKey => {

    const zone = Number(zoneKey);

    this.zoneProgress[zone] = {
      answered: new Set(),
      failed: false,
      total: grouped[zone].length
    };

  });

}

}


  /*private distributeQuestionsByZone() {

    const zone1Max = 2;
    const zone2Max = 4;

    /* const zone1 = this.questions.slice(0, zone1Max);

    const zone2 = this.questions.slice(
      zone1Max,
      zone1Max + zone2Max
    );

    const zone3 = this.questions.slice(
      zone1Max + zone2Max
    );

    return {
      zone1,
      zone2,
      zone3
    };

    const updatedQuestionList = this.questions.map((question, index) => {

      let zone = 3;

      if (index < zone1Max) {
        zone = 1;
      }
      else if (index < zone1Max + zone2Max) {
        zone = 2;
      }

      return {
        ...question,
        // add zone properties to be tracked
        zone,
        zone_order: index + 1,
      };
    });

    this.questions = updatedQuestionList;
    return this.questions;
  }*/
