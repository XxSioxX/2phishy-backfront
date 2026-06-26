import {Enemy} from "./enemy";
import {Player} from "./player";
import {Scene} from "phaser";

export class SocialEngineer extends Enemy {

  private strategy: string;

  private spawnX: number;
  private spawnY: number;
  private detectionRadius = 200;
  private engageRadius = 32;
  private behaviorState: 'idle' | 'chasing' | 'returning' | 'talking' = 'idle';
  private aggressiveUntil = 0;
  private decoy = false;


  constructor(
    scene: Scene,
    x: number,
    y: number,
    texture: string,
    target: Player,
    strategy: string,
    frame?: number,
  ) {
    super(scene, x, y, texture, target, frame);

    this.spawnX = x;
    this.spawnY = y;
    this.strategy = strategy;

    this.play('npc-idle');
    this.getBody().setCollideWorldBounds(true);
  }

  preUpdate(_time: number, _delta: number): void {
    if (!this.target?.active) {
      this.setVelocity(0);
      return;
    }

    const sceneBusy =
      typeof (this.scene as any).isInteractionBusy === 'function' &&
      (this.scene as any).isInteractionBusy();
    if (sceneBusy && this.behaviorState !== 'talking') {
      this.setVelocity(0);
      this.play('npc-idle', true);
      return;
    }

    const distToPlayer = Phaser.Math.Distance.Between(
      this.x,
      this.y,
      this.target.x,
      this.target.y
    );

    const distToSpawn = Phaser.Math.Distance.Between(
      this.x,
      this.y,
      this.spawnX,
      this.spawnY
    );

    const aggressive = this.scene.time.now < this.aggressiveUntil;
    const speed = aggressive ? 126 : 80;
    const detectionRadius = aggressive ? this.detectionRadius + 90 : this.detectionRadius;

    switch (this.behaviorState) {

      case 'idle':

        this.setVelocity(0);

        if (distToPlayer < detectionRadius) {
          this.behaviorState = 'chasing';
        }

        break;

      case 'chasing':

        if (distToPlayer > detectionRadius) {
          this.behaviorState = 'returning';
          break;
        }

        if (distToPlayer <= this.engageRadius) {

          this.behaviorState = 'talking';
          this.setVelocity(0);

          this.scene.events.emit('SE_DIALOGUE_START', {
            npc: this,
            strategy: this.strategy
          });

          return;
        }


        const angleToPlayer = Phaser.Math.Angle.Between(
          this.x,
          this.y,
          this.target.x,
          this.target.y
        );

        this.setVelocity(
          Math.cos(angleToPlayer) * speed,
          Math.sin(angleToPlayer) * speed
        );

        this.play('npc-walk', true);

        break;

      case 'talking':
        this.setVelocity(0);
        break;


      case 'returning':

        if (distToSpawn <= 5) {
          this.behaviorState = 'idle';
          this.setVelocity(0);
          break;
        }

        const angleToSpawn = Phaser.Math.Angle.Between(
          this.x,
          this.y,
          this.spawnX,
          this.spawnY
        );

        this.setVelocity(
          Math.cos(angleToSpawn) * speed,
          Math.sin(angleToSpawn) * speed
        );

        this.play('npc-walk', true);

        break;
    }
  }

  finishInteraction(): void {
    this.destroy();
  }

  deferInteraction(): void {
    this.behaviorState = 'returning';
    this.setVelocity(0);
  }

  setAggressive(durationMs: number): void {
    this.aggressiveUntil = Math.max(
      this.aggressiveUntil,
      this.scene.time.now + durationMs
    );
    if (this.behaviorState === 'idle') {
      this.behaviorState = 'chasing';
    }
  }

  setDecoy(value = true): void {
    this.decoy = value;
  }

  isDecoy(): boolean {
    return this.decoy;
  }
}

