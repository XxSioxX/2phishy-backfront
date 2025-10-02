import { Physics, Scene } from 'phaser';

export class Actor extends Physics.Arcade.Sprite {
  protected hp = 100;

  constructor(scene: Scene, x: number, y: number, texture: string, frame?: string | number) {
    super(scene, x, y, texture, frame);

    // ADD TO SCENE
    scene.add.existing(this);
    scene.physics.add.existing(this);

    // PHYSICS MODEL
    this.getBody().setCollideWorldBounds(true);
  }

  public getDamage(value?: number): void {
    this.scene.tweens.add({
      targets: this,
      duration: 100,
      repeat: 3,
      yoyo: true,
      alpha: 0.5,
      onStart: () => {
        if (value) {
          this.hp = this.hp - value;
        }
      },
    });
  }

  public getHPValue(): number {
    return this.hp;
  }

  protected getBody(): Physics.Arcade.Body {
    return this.body as Physics.Arcade.Body;
  }
}
