import {Enemy} from "./enemy";
import {Player} from "./player";
import {Scene} from "phaser";

export class SocialEngineer extends Enemy {

  private strategy: string;

  private spawnX: number;
  private spawnY: number;
  private detectionRadius = 200;
  private engageRadius = 32;
  private state: 'idle' | 'chasing' | 'returning' | 'talking' = 'idle';


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

  preUpdate(time: number, delta: number): void {
    super.preUpdate(time, delta);

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

    const speed = 80;

    switch (this.state) {

      case 'idle':

        this.setVelocity(0);

        if (distToPlayer < this.detectionRadius) {
          this.state = 'chasing';
        }

        break;

      case 'chasing':

        if (distToPlayer > this.detectionRadius) {
          this.state = 'returning';
          break;
        }

        if (distToPlayer <= this.engageRadius) {

          this.state = 'talking';
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
          this.state = 'idle';
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
}

