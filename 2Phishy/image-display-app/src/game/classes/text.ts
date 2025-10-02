import { GameObjects } from 'phaser';

export class Text extends GameObjects.Text {
  constructor(scene: Phaser.Scene, x: number, y: number, text: string | string[], style?: Phaser.Types.GameObjects.Text.TextStyle) {
    super(scene, x, y, text, style || {});
    this.scene.add.existing(this);
  }
}
