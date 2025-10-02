// Note: This class is not currently used in the assessment game but kept for future use
// All imports are intentionally kept for when this class is used

import { Math, Scene } from 'phaser';
import { Actor } from './actor';
import { Player } from './player';

export class Enemy extends Actor {
  private target: Player;
  private AGRESSOR_RADIUS = 100;
  private attackHandler: () => void;

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
    this.attackHandler = () => {
      if (
        Math.Distance.BetweenPoints(
          { x: this.x, y: this.y },
          { x: this.target.x, y: this.target.y },
        ) < this.AGRESSOR_RADIUS
      ) {
        this.getBody().setVelocityX(
          (this.target.x - this.x) * 0.5,
        );
        this.getBody().setVelocityY(
          (this.target.y - this.y) * 0.5,
        );
      } else {
        this.getBody().setVelocity(0);
      }
    };
  }

  public setTarget(target: Player): void {
    this.target = target;
  }

  preUpdate(): void {
    this.attackHandler();
  }
}