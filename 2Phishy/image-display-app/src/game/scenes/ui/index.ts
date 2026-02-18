import {Player} from "../../classes/player.ts";

export class UIScene extends Phaser.Scene {
  private player!: Player;
  private questionText!: Phaser.GameObjects.Text;
  private totalQuestions = 0;


  constructor() {
    super({ key: 'ui-scene' });

  }

  create(data: { player: Player, showControls: boolean }) {
    this.player = data.player;

    this.createQuestionUI();

    if (data.showControls) {
      this.createMobileControls();
    }

    this.registerQuestionEvents();
    this.input.addPointer(2);

    this.cameras.main.setScroll(0, 0);
    this.cameras.main.setZoom(1);
    this.cameras.main.setBackgroundColor('rgba(0,0,0,0)');


  }

  private registerQuestionEvents() {
    const initHandler = (total: number, answered: number) => {
      this.totalQuestions = total;
      this.updateQuestionUI(answered);
    };

    const updateHandler = (total: number, answered: number) => {
      this.totalQuestions = total;
      this.updateQuestionUI(answered);
    };


    this.game.events.on('questions:init', initHandler);
    this.game.events.on('questions:update', updateHandler);

    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.game.events.off('questions:init', initHandler);
      this.game.events.off('questions:update', updateHandler);
    });
  }



  private createMobileControls(): void {
    const radius = 70;
    const thumbRadius = 35;

    const baseX = 140;
    const baseY = this.cameras.main.height - 160;

    const base = this.add.circle(baseX, baseY, radius, 0x222222, 0.4)
      .setScrollFactor(0)
      .setDepth(10000);

    const thumb = this.add.circle(baseX, baseY, thumbRadius, 0xffffff, 0.8)
      .setScrollFactor(0)
      .setDepth(10001);

    let activePointer: Phaser.Input.Pointer | null = null;

    this.input.on('pointerdown', (pointer: Phaser.Input.Pointer) => {

      // only activate if touch started near joystick
      const dist = Phaser.Math.Distance.Between(pointer.x, pointer.y, baseX, baseY);

      if (dist <= radius * 1.5) {
        activePointer = pointer;
        this.updateJoystick(pointer, baseX, baseY, radius, thumb);
      }
    });

    this.input.on('pointermove', (pointer: Phaser.Input.Pointer) => {
      if (!activePointer) return;
      if (pointer.id !== activePointer.id) return;

      this.updateJoystick(pointer, baseX, baseY, radius, thumb);
    });

    this.input.on('pointerup', (pointer: Phaser.Input.Pointer) => {
      if (!activePointer) return;
      if (pointer.id !== activePointer.id) return;

      activePointer = null;

      thumb.setPosition(baseX, baseY);

      this.player.moveLeft = false;
      this.player.moveRight = false;
      this.player.moveUp = false;
      this.player.moveDown = false;
    });
  }



  private updateJoystick(
    pointer: Phaser.Input.Pointer,
    baseX: number,
    baseY: number,
    maxDistance: number,
    thumb: Phaser.GameObjects.Arc
  ) {
    let dx = pointer.x - baseX;
    let dy = pointer.y - baseY;

    const distance = Math.sqrt(dx * dx + dy * dy);

    if (distance > maxDistance) {
      const angle = Math.atan2(dy, dx);
      dx = Math.cos(angle) * maxDistance;
      dy = Math.sin(angle) * maxDistance;
    }

    thumb.setPosition(baseX + dx, baseY + dy);

    let normX = dx / maxDistance;
    let normY = dy / maxDistance;

    const deadzone = 0.15;

    const threshold = 0.3;

    this.player.moveLeft = normX < -threshold;
    this.player.moveRight = normX > threshold;
    this.player.moveUp = normY < -threshold;
    this.player.moveDown = normY > threshold;


  }


  private createQuestionUI() {
    const container = this.add.container(220, 50)
      .setScrollFactor(0)
      .setDepth(10000);

    this.questionText = this.add.text(
      0,
      0,
      '',
      {
        fontSize: '22px',
        color: '#ffffff',
        fontStyle: 'bold'
      }
    ).setOrigin(0.5);

    const paddingX = 30;
    const paddingY = 18;

    const bg = this.add.rectangle(
      0,
      0,
      this.questionText.width + paddingX,
      this.questionText.height + paddingY,
      0x111111,
      0.9
    )
    .setStrokeStyle(3, 0xffffff)
    .setOrigin(0.5);

    container.add([bg, this.questionText]);

    // Store background for resizing later
    (this.questionText as any)._bg = bg;
  }

  private updateQuestionUI(answered: number) {
  const remaining = this.totalQuestions - answered;

  this.questionText.setText(
    `Questions Remaining: ${remaining}`
  );

  const bg = (this.questionText as any)._bg;

  const paddingX = 30;
  const paddingY = 18;

  bg.setSize(
    this.questionText.width + paddingX,
    this.questionText.height + paddingY
  );
}






}
