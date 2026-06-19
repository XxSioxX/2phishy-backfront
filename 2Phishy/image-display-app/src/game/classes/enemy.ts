import { Scene } from 'phaser';
import { Actor } from './actor';
import { Player } from './player';

export class Enemy extends Actor {
  protected target: Player;
  protected AGGRESSOR_RADIUS = 200;

  constructor(
    scene: Scene,
    x: number,
    y: number,
    texture: string,
    target: Player,
    frame?: string | number,
  ) {
    super(scene, x, y, texture, frame);
    this.target = target;
  }

  protected moveTowardTarget(): void {
    if (!this.target?.active) {
      this.getBody().setVelocity(0);
      return;
    }

    const dist = Phaser.Math.Distance.Between(
      this.x,
      this.y,
      this.target.x,
      this.target.y
    );


    if (dist < this.AGGRESSOR_RADIUS) {

      const angle = Phaser.Math.Angle.Between(
        this.x,
        this.y,
        this.target.x,
        this.target.y
      );

      const speed = 80;

      this.getBody().setVelocity(
        Math.cos(angle) * speed,
        Math.sin(angle) * speed
      );

    } else {
      this.getBody().setVelocity(0);
    }
  }

  preUpdate(_time: number, _delta: number): void {
    this.moveTowardTarget();
  }
}
