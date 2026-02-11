import { Actor } from './actor';
import { Text } from './text';
import { Input } from 'phaser';
import { EVENTS_NAME, GameStatus } from '../consts';

export class Player extends Actor {
  private keyW: Phaser.Input.Keyboard.Key;
  private keyA: Phaser.Input.Keyboard.Key;
  private keyS: Phaser.Input.Keyboard.Key;
  private keyD: Phaser.Input.Keyboard.Key;
  private keySpace!: Input.Keyboard.Key;
  private frozen = false;
  private questionValue!: Text;
  private totalQuestions = 0;
  private remainingQuestions = 0;

  constructor(scene: Phaser.Scene, x: number, y: number) {
    super(scene, x, y, 'king');
    // KEYS
    if (!this.scene.input.keyboard) {
      throw new Error('Keyboard input is not available!');
    }
    this.keyW =
      this.scene.input.keyboard?.addKey('W') ?? ({ isDown: false } as Phaser.Input.Keyboard.Key);
    this.keyA =
      this.scene.input.keyboard?.addKey('A') ?? ({ isDown: false } as Phaser.Input.Keyboard.Key);
    this.keyS =
      this.scene.input.keyboard?.addKey('S') ?? ({ isDown: false } as Phaser.Input.Keyboard.Key);
    this.keyD =
      this.scene.input.keyboard?.addKey('D') ?? ({ isDown: false } as Phaser.Input.Keyboard.Key);

    // Attack
    this.keySpace = this.scene.input.keyboard.addKey(32);
    this.keySpace.on('down', () => {
      this.anims.play('attack', true);
      this.scene.game.events.emit(EVENTS_NAME.attack);
    });

    // PHYSICS
    this.getBody().setSize(30, 30);
    this.getBody().setOffset(8, 0);
    //this.hpValue = new Text(this.scene, this.x, this.y - this.height, this.hp.toString())
    //  .setFontSize(12)
    //  .setOrigin(0.8, 0.5);
    this.questionValue = new Text(
      this.scene,
      this.x,
      this.y - this.height - 4, // slightly above HP
      ''
    )
      .setFontSize(12)
      .setOrigin(0.5, 1);


    // Running
    this.initAnimations();
    this.on('destroy', () => {
      this.keySpace.removeAllListeners();
    });
  }
  update(): void {
    if (!this.body) return;

    if (this.frozen) {
      this.getBody().setVelocity(0);
      return; // skip input/movement
    }

    this.getBody().setVelocity(0);

    if (this.keyW?.isDown) {
      this.body.velocity.y = -110;
      !this.anims.isPlaying && this.anims.play('run', true);
    }
    if (this.keyA?.isDown) {
      this.body.velocity.x = -110;
      this.checkFlip();
      this.getBody().setOffset(48, 15);
      !this.anims.isPlaying && this.anims.play('run', true);
    }
    if (this.keyS?.isDown) {
      this.body.velocity.y = 110;
      !this.anims.isPlaying && this.anims.play('run', true);
    }
    if (this.keyD?.isDown) {
      this.body.velocity.x = 110;
      this.checkFlip();
      this.getBody().setOffset(15, 15);
      !this.anims.isPlaying && this.anims.play('run', true);
    }

    //this.hpValue.setPosition(this.x, this.y - this.height * 0.4);
    //this.hpValue.setOrigin(0.8, 0.5);

    this.questionValue.setPosition(
      this.body.x + this.body.width / 2,
      this.body.y - 2
    );



  }

  public initQuestions(totalquestions: number, totalunanswered: number): void {
    this.totalQuestions = totalquestions;
    this.remainingQuestions = totalquestions - totalunanswered;
    this.updateQuestionText();
  }

  public setRemainingQuestions(value: number): void {
    if (this.remainingQuestions === value) return;
    this.remainingQuestions = value;
    this.updateQuestionText();
  }

  private updateQuestionText(): void {

    this.questionValue.setText(
      `(${this.remainingQuestions}/${this.totalQuestions})`
    );
  }



  public getDamage(value?: number): void {
    super.getDamage(value);

    if (this.hp <= 0) {
      this.scene.game.events.emit(EVENTS_NAME.gameEnd, GameStatus.LOSE);
    }
  }
  public freeze(): void {
    this.frozen = true;
    const body = this.getBody();
    body.setVelocity(0);
    body.setAcceleration(0);
    body.stop();

    body.moves = false;
  }

  public unfreeze(): void {
    this.frozen = false;
    this.getBody().moves = true;
  }

  private initAnimations(): void {
    this.scene.anims.create({
      key: 'run',
      frames: this.scene.anims.generateFrameNames('a-king', {
        prefix: 'run-',
        end: 7,
      }),
      frameRate: 8,
    });
    this.scene.anims.create({
      key: 'attack',
      frames: this.scene.anims.generateFrameNames('a-king', {
        prefix: 'attack-',
        end: 2,
      }),
      frameRate: 8,
    });
  }

  private checkFlip(): void {
    if (this.body && this.body.velocity.x < 0) {
      this.scaleX = -1;
    } else if (this.body && this.body.velocity.x > 0) {
      this.scaleX = 1;
    }
  }

  public bodyRef(): Phaser.Physics.Arcade.Body {
    return this.getBody();
}

}
