import { BaseIntegratedLevel } from '../core/BaseIntegratedLevel';
import { LEVEL_CONFIGS } from '../core/LevelConfigurations';
import {Player} from "../../classes/player.ts";
import {Tilemaps} from "phaser";
import {gameAPI} from "../../helpers/game-api.ts";

export class SFBLevel extends BaseIntegratedLevel {
  private currentZone = 1;
  private correctDoors: Record<number, Phaser.GameObjects.Sprite[]> = {};
  private wrongDoors: Record<number, Phaser.GameObjects.Sprite[]> = {};
  private trapChests: Phaser.GameObjects.Sprite[] = [];
  private currentCheckpoint = 0;
  private spawnedPlatforms: Phaser.GameObjects.Sprite[] = [];
  private doorWallsLayer!:Tilemaps.TilemapLayer;


  constructor() {
    super(LEVEL_CONFIGS.SFB);
  }

  async create() {
    const progress = await gameAPI.getUserProgress(this.userData.userId);
    const savedZone = progress.data?.progress?.progress?.[this.config.topic]?.current_zone ?? 1;
    this.currentZone = savedZone;
    await super.create();




    this.createTrapAnimations();
    this.initDoors();
    this.initTrapChests();

  }

  protected initAssessment(): void {

    this.questionPoints = [];

    const zones = this.distributeQuestionsByZone();

    const allPoints = this.map.filterObjects(
      'QuestionPoints',
      obj => obj.name === 'QuestionPoint'
    );

    const getZone = (obj: any) =>
      obj.properties?.find((p: any) => p.name === "zone_number")?.value;

    const zone1Points = allPoints.filter(p => getZone(p) === 1);
    const zone2Points = allPoints.filter(p => getZone(p) === 2);
    const zone3Points = allPoints.filter(p => getZone(p) === 3);

    this.spawnZoneQuestions(zone1Points, zones.zone1, 0);
    this.spawnZoneQuestions(zone2Points, zones.zone2, 2);
    this.spawnZoneQuestions(zone3Points, zones.zone3, 6);

  }

  private distributeQuestionsByZone() {

    const zone1Max = 2;
    const zone2Max = 4;

    const zone1 = this.questions.slice(0, zone1Max);

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
  }

  private distributeKnowledgeByZone() {

    const zone1Max = 2;
    const zone2Max = 4;

    const zone1 = this.knowledgeList.slice(0, zone1Max);

    const zone2 = this.knowledgeList.slice(
      zone1Max,
      zone1Max + zone2Max
    );

    const zone3 = this.knowledgeList.slice(
      zone1Max + zone2Max
    );

    return { zone1, zone2, zone3 };

  }

  private spawnZoneQuestions(points: any[], questions: any[], offset: number) {

    Phaser.Utils.Array.Shuffle(points);

    const selected = points.slice(0, questions.length);

    selected.forEach((pt, index) => {

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

      pair.questionIndex = offset + index;

      this.questionPoints.push(pair);

    });
  }

  protected async startQuestionAtPoint(
    pointPair: any,
    qIndex: number
  ): Promise<void> {

    await super.startQuestionAtPoint(pointPair, qIndex);

      const lastResult = this.assessmentResults[this.assessmentResults.length - 1];
      const isCorrect = lastResult.is_correct;
      const zoneIndex = this.getZoneIndexFromQuestion(qIndex);

      if (isCorrect) {

        const newZone = zoneIndex + 1;
        this.currentZone = newZone;

        this.openDoor(this.correctDoors[zoneIndex + 1]);

        gameAPI.updateCurrentZone({
          userid: this.userData.userId,
          topic: this.config.topic,
          current_zone: newZone
        }).catch(console.error);

        } else {

        this.openDoor(this.wrongDoors[zoneIndex + 1]);

      }
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

      const getZone = (obj: any) =>
        obj.properties?.find((p: any) => p.name === "zone_number")?.value;

      const zone = Number(getZone(obj));
      const door = this.spawnDoor(obj, true);

      door.forEach(sprite => {
        sprite.setAlpha(1);
        if (sprite.body) sprite.body.enable = true;
      });

      this.correctDoors[zone] = door;
    });

    wrongDoorObjects.forEach(obj => {

      const getZone = (obj: any) =>
        obj.properties?.find((p: any) => p.name === "zone_number")?.value;

      const zone = Number(getZone(obj));
      const door = this.spawnDoor(obj, false);

      door.forEach(sprite => {
        sprite.setAlpha(1);
        if (sprite.body) sprite.body.enable = true;
      });

      this.wrongDoors[zone] = door;
    });

  }

  private openDoor(door: Phaser.GameObjects.Sprite[]) {

    const OPEN = { topL: 453, topR: 454, botL: 485, botR: 486 };

    door.forEach(sprite => {

      this.tweens.killTweensOf(sprite);

      this.physics.world.disable(sprite);

      const frame = sprite.frame.name;

      if (frame === 450) sprite.setFrame(OPEN.topL);
      if (frame === 451) sprite.setFrame(OPEN.topR);
      if (frame === 482) sprite.setFrame(OPEN.botL);
      if (frame === 483) sprite.setFrame(OPEN.botR);

      this.tweens.add({
        targets: sprite,
        y: sprite.y - 32,
        duration: 350,
        ease: 'Quad.easeOut'
      });

    });
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

      const chest = this.physics.add
        .sprite(obj.x, obj.y, 'tiles_spr', 659)
        .setScale(1.5);

      chest.setImmovable(true);
      chest.body.allowGravity = false;

      let triggered = false;

      this.physics.add.overlap(this.player, chest, () => {

        if (triggered) return;
        triggered = true;

        chest.play('trap_open');

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

            // 👇 TELEPORT HERE
            this.teleportToZone(this.currentZone);

            this.player.unlockMovement();
          }
        );

      });

      this.trapChests.push(chest);

    });

  }

  private spawnDoor(obj: any, isCorrect: boolean) {

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

  protected initKnowledge(): void {

    const allPoints = this.map.filterObjects(
      'KnowledgePoints',
      obj => obj.name === 'KnowledgePoint'
    );

    const getZone = (obj: any) =>
      obj.properties?.find((p: any) => p.name === "zone_number")?.value;

    const zones = {
      1: [],
      2: [],
      3: []
    };

    allPoints.forEach(p => {
      const z = getZone(p);
      if (zones[z]) zones[z].push(p);
    });

    const knowledgeZones = this.distributeKnowledgeByZone();

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

    spawnKnowledge(zones[1], knowledgeZones.zone1);
    spawnKnowledge(zones[2], knowledgeZones.zone2);
    spawnKnowledge(zones[3], knowledgeZones.zone3);

  }

  private teleportToZone(zone: number) {

    const spawnObjects = this.map.filterObjects('SpawnPoint', () => true);

    const getZone = (obj: any) =>
      obj.properties?.find((p: any) => p.name === "zone_number")?.value;

    const spawn = spawnObjects.find(obj => Number(getZone(obj)) === zone);

    if (!spawn) {
      console.warn("No spawn for zone:", zone);
      return;
    }

    this.player.setPosition(spawn.x, spawn.y - 4);
  }

}