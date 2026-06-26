import { Actor } from './actor';
import { Text } from './text';
import { Input } from 'phaser';
import { EVENTS_NAME, GameStatus } from '../consts';
import { AudioManager, SFX } from '../audio';

export class Player extends Actor {
  private keyW: Phaser.Input.Keyboard.Key;
  private keyA: Phaser.Input.Keyboard.Key;
  private keyS: Phaser.Input.Keyboard.Key;
  private keyD: Phaser.Input.Keyboard.Key;
  private keyShift: Phaser.Input.Keyboard.Key;
  private keySpace!: Input.Keyboard.Key;
  private frozen = false;
  private questionValue!: Text;
  private totalQuestions = 0;
  private remainingQuestions = 0;
  private movementLocked = false;
  private readonly walkSpeed = 110;
  private readonly sprintSpeed = 170;
  private touchMoveX = 0;
  private touchMoveY = 0;
  private touchSprint = false;
  private blockActiveUntil = 0;
  private blockCooldownUntil = 0;
  private blockShield?: Phaser.GameObjects.Arc;
  private readonly blockDuration = 950;
  private readonly blockCooldown = 1650;
  private readonly handlePointerBlock = (pointer: Phaser.Input.Pointer): void => {
    const event = pointer.event as PointerEvent | MouseEvent | TouchEvent | undefined;
    const pointerType = 'pointerType' in (event ?? {}) ? (event as PointerEvent).pointerType : 'mouse';
    const button = 'button' in (event ?? {}) ? (event as MouseEvent | PointerEvent).button : 0;

    if (pointerType !== 'mouse' || button !== 0) return;
    this.triggerBlock();
  };

  public moveUp = false;
  public moveDown = false;
  public moveLeft = false;
  public moveRight = false;


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
    this.keyShift = this.scene.input.keyboard.addKey(
      Input.Keyboard.KeyCodes.SHIFT
    );

    // Block
    this.scene.input.keyboard.addCapture(Phaser.Input.Keyboard.KeyCodes.SPACE);
    this.keySpace = this.scene.input.keyboard.addKey(
      Phaser.Input.Keyboard.KeyCodes.SPACE
    );
    this.keySpace.on('down', () => {
      this.triggerBlock();
    });
    this.scene.input.on('pointerdown', this.handlePointerBlock);

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
      this.scene.input.off('pointerdown', this.handlePointerBlock);
    });
  }
  update(): void {
    if (!this.body) return;

    if (this.frozen || this.movementLocked) {

      this.getBody().setVelocity(0);
      return;
    }

    const keyX =
      (this.keyD?.isDown || this.moveRight ? 1 : 0) -
      (this.keyA?.isDown || this.moveLeft ? 1 : 0);
    const keyY =
      (this.keyS?.isDown || this.moveDown ? 1 : 0) -
      (this.keyW?.isDown || this.moveUp ? 1 : 0);

    const moveX = Phaser.Math.Clamp(keyX + this.touchMoveX, -1, 1);
    const moveY = Phaser.Math.Clamp(keyY + this.touchMoveY, -1, 1);
    const magnitude = Math.hypot(moveX, moveY);

    if (magnitude <= 0.01) {
      this.getBody().setVelocity(0);
      return;
    }

    const speed = this.keyShift.isDown || this.touchSprint
      ? this.sprintSpeed
      : this.walkSpeed;
    const normalizedMagnitude = Math.max(1, magnitude);
    const velocityX = (moveX / normalizedMagnitude) * speed;
    const velocityY = (moveY / normalizedMagnitude) * speed;

    this.getBody().setVelocity(velocityX, velocityY);
    !this.anims.isPlaying && this.anims.play('run', true);

    if (velocityX < 0) {
      this.checkFlip();
      this.getBody().setOffset(48, 15);
    }

    if (velocityX > 0) {
      this.checkFlip();
      this.getBody().setOffset(15, 15);
    }
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
      key: 'block',
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
  public lockMovement() {
    this.movementLocked = true;
    this.forceStopAllInput();
  }

  public unlockMovement() {
    this.movementLocked = false;
  }

  public setTouchMovement(x: number, y: number, sprint = false): void {
    this.touchMoveX = Phaser.Math.Clamp(x, -1, 1);
    this.touchMoveY = Phaser.Math.Clamp(y, -1, 1);
    this.touchSprint = sprint;
  }

  public clearTouchMovement(): void {
    this.touchMoveX = 0;
    this.touchMoveY = 0;
    this.touchSprint = false;
  }

  public triggerBlock(): void {
    if (this.frozen || this.movementLocked) return;
    if (this.scene.time.now < this.blockCooldownUntil) return;

    const now = this.scene.time.now;
    this.blockActiveUntil = now + this.blockDuration;
    this.blockCooldownUntil = now + this.blockCooldown;

    this.anims.play('block', true);
    AudioManager.playSfx(this.scene, SFX.PLAYER_BLOCK);
    this.showBlockShield();
    this.scene.game.events.emit(EVENTS_NAME.block);
  }

  public isBlocking(): boolean {
    return this.scene.time.now <= this.blockActiveUntil;
  }

  private showBlockShield(): void {
    this.blockShield?.destroy();
    this.setTint(0x9df7ff);

    const shield = this.scene.add
      .circle(this.x, this.y + 3, 28, 0x8cf7ff, 0.18)
      .setStrokeStyle(2, 0xcfffff, 0.7)
      .setDepth(this.depth + 1);

    this.blockShield = shield;

    const followEvent = Phaser.Scenes.Events.UPDATE;
    const followShield = () => {
      if (!shield.active) return;
      shield.setPosition(this.x, this.y + 3);
    };

    this.scene.events.on(followEvent, followShield);
    shield.once('destroy', () => {
      this.scene.events.off(followEvent, followShield);
      if (this.active) this.clearTint();
      if (this.blockShield === shield) {
        this.blockShield = undefined;
      }
    });

    this.scene.tweens.add({
      targets: shield,
      alpha: 0,
      scale: 1.45,
      duration: this.blockDuration,
      ease: 'Quad.easeOut',
      onComplete: () => shield.destroy(),
    });
  }

  public forceStopAllInput() {
    this.moveUp = false;
    this.moveDown = false;
    this.moveLeft = false;
    this.moveRight = false;
    this.clearTouchMovement();

    if (this.body) {
      this.getBody().setVelocity(0);
    }
  }
}
