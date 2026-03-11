import { BaseIntegratedLevel } from '../core/BaseIntegratedLevel';
import { LEVEL_CONFIGS } from '../core/LevelConfigurations';
import {Player} from "../../classes/player.ts";

export class SFBLevel extends BaseIntegratedLevel {
  private currentZone = 0;
  private correctDoors: Phaser.GameObjects.Sprite[][] = [];
  private wrongDoors: Phaser.GameObjects.Sprite[][] = [];
  private trapChests: Phaser.GameObjects.Sprite[] = [];
  private currentCheckpoint = 0;
  private spawnedPlatforms: Phaser.GameObjects.Sprite[] = [];


  constructor() {
    super(LEVEL_CONFIGS.SFB);
  }

  async create() {

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

      const answered = this.assessmentResults.length;

      if (answered === 1) this.openDoor(this.correctDoors[0]);
      if (answered === 3) this.openDoor(this.correctDoors[1]);
      if (answered === 7) this.openDoor(this.correctDoors[2]);


  }

  private initDoors() {

    const correctDoorObjects = this.map.filterObjects(
      'Door-correct',
      obj => obj.name === 'DoorCorrectPoint'
    );

    const wrongDoorObjects = this.map.filterObjects(
      'Door-wrong',
      obj => obj.name === 'DoorWrongPoint'
    );

    correctDoorObjects.forEach(obj => {
      const door = this.spawnDoor(obj, true);
      this.correctDoors.push(door);
    });

    wrongDoorObjects.forEach(obj => {
      const door = this.spawnDoor(obj, false);
      this.wrongDoors.push(door);
    });

  }

  private openDoor(door: Phaser.GameObjects.Sprite[]) {

    door.forEach(sprite => {

      this.tweens.killTweensOf(sprite);

      if (sprite.body) sprite.body.enable = false;

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
      obj => obj.name === 'TrapChest'
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

        this.popup.showInfo(
          "Trap!",
          "That was a malicious link!",
          () => {
            console.log("Player damaged");
          }
        );

      });

      this.trapChests.push(chest);

    });

  }

  private spawnDoor(obj: any, isCorrect: boolean) {

    const x = obj.x;
    const y = obj.y;

    const frames = isCorrect
      ? { topL: 450, topR: 451, botL: 482, botR: 483 }
      : { topL: 453, topR: 454, botL: 485, botR: 486 };

    const botL = this.physics.add.staticSprite(x - 8, y, 'tiles_spr', frames.botL).setScale(1.5);
    const botR = this.physics.add.staticSprite(x + 8, y, 'tiles_spr', frames.botR).setScale(1.5);

    const topL = this.physics.add.staticSprite(x - 8, y - 16, 'tiles_spr', frames.topL).setScale(1.5);
    const topR = this.physics.add.staticSprite(x + 8, y - 16, 'tiles_spr', frames.topR).setScale(1.5);

    const door = [botL, botR, topL, topR];

    /* glowing lock indicator */

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



  protected spawnPlayerOnSpawnPoint(zone: number = 0): void {

      const spawnObjects = this.map.filterObjects(
          'SpawnPoint',
          obj => obj.name === 'SpawnPoint'
      );

      const getZone = (obj: any) =>
          obj.properties?.find((p: any) => p.name === "zone_number")?.value;

      const spawn = spawnObjects.find(obj => getZone(obj) === zone);

      if (!spawn) {
          console.warn("Spawn not found for zone:", zone);
          return;
      }

      const spawnX = spawn.x;
      const spawnY = spawn.y;

      const existingPlatform = this.spawnedPlatforms.find(
          p => p.x === spawnX && p.y === spawnY
      );

      if (!existingPlatform) {

          const platform = this.add
              .sprite(spawnX, spawnY, 'tiles_spr', 386)
              .setScale(1.5)
              .setDepth(0);

          this.spawnedPlatforms.push(platform);

      }

      if (!this.player) {

          this.player = new Player(this, spawnX, spawnY - 4);

          this.player.bodyRef().setCollideWorldBounds(true);

          this.physics.add.collider(this.player, this.wallsLayer);
          this.physics.add.collider(this.player, this.wallsLayer2);

      } else {

          this.player.setPosition(spawnX, spawnY - 4);

      }

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

}