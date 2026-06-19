import Phaser from 'phaser';

export default class AssessmentPopup {
  private scene: Phaser.Scene;
  private container?: Phaser.GameObjects.Container;
  public mode: 'assessment' | 'learning' = 'learning';
  public correctAnswer = '';

  constructor(scene: Phaser.Scene) {
    this.scene = scene;
  }

  show(
    question: string,
    choices: string[],
    onChoice: (choice: string) => void
  ): void {
    if (this.container) return;

    const cam = this.scene.cameras.main;
    const panelWidth = Math.min(720, cam.width - 72);
    const contentWidth = panelWidth - 72;

    const questionText = this.scene.add
      .text(0, 0, question, {
        fontSize: '22px',
        color: '#ffffff',
        fontStyle: 'bold',
        wordWrap: { width: contentWidth, useAdvancedWrap: true },
        align: 'center',
      })
      .setOrigin(0.5, 0)
      .setResolution(window.devicePixelRatio || 2);

    const buttonObjects: {
      btn: Phaser.GameObjects.Rectangle;
      label: Phaser.GameObjects.Text;
      value: string;
    }[] = [];

    choices.forEach(choice => {
      const label = this.scene.add
        .text(0, 0, choice, {
          fontSize: '17px',
          color: '#d8f8f2',
          wordWrap: {
            width: contentWidth - 30,
            useAdvancedWrap: true,
          },
          align: 'center',
        })
        .setOrigin(0.5)
        .setResolution(window.devicePixelRatio || 2);

      const btn = this.scene.add
        .rectangle(
          0,
          0,
          contentWidth,
          Math.max(56, label.height + 22),
          0x17212b,
          1
        )
        .setStrokeStyle(1, 0x527282)
        .setInteractive({ useHandCursor: true });

      const selectChoice = () => {
        if (this.mode === 'assessment') {
          this.destroy();
          onChoice(choice);
          return;
        }

        buttonObjects.forEach(object => {
          object.btn.disableInteractive();
          object.label.disableInteractive();
        });
        btn.setFillStyle(
          choice === this.correctAnswer ? 0x4caf50 : 0xf44336
        );

        buttonObjects
          .find(object => object.value === this.correctAnswer)
          ?.btn.setFillStyle(0x4caf50);

        this.scene.time.delayedCall(1000, () => {
          this.destroy();
          onChoice(choice);
        });
      };

      btn.on('pointerover', () => {
        btn.setFillStyle(0x223746);
        btn.setStrokeStyle(1, 0x7de3ff);
        label.setColor('#ffffff');
      });
      btn.on('pointerout', () => {
        btn.setFillStyle(0x17212b);
        btn.setStrokeStyle(1, 0x527282);
        label.setColor('#d8f8f2');
      });
      btn.on('pointerup', selectChoice);
      label
        .setInteractive({ useHandCursor: true })
        .on('pointerup', selectChoice);

      buttonObjects.push({ btn, label, value: choice });
    });

    const choicesHeight = buttonObjects.reduce(
      (height, object) => height + object.btn.height,
      0
    );
    const panelHeight = Math.min(
      cam.height - 40,
      Math.max(
        420,
        questionText.height +
          choicesHeight +
          Math.max(0, choices.length - 1) * 12 +
          118
      )
    );
    const top = -panelHeight / 2 + 42;
    questionText.setPosition(0, top);

    let currentY = top + questionText.height + 28;
    buttonObjects.forEach(object => {
      object.btn.setPosition(0, currentY + object.btn.height / 2);
      object.label.setPosition(object.btn.x, object.btn.y);
      currentY += object.btn.height + 12;
    });

    const overlay = this.scene.add.rectangle(
      0,
      0,
      cam.width,
      cam.height,
      0x000000,
      0.74
    );
    const panel = this.scene.add
      .rectangle(0, 0, panelWidth, panelHeight, 0x0d141c, 0.98)
      .setStrokeStyle(2, 0x7de3ff);
    const header = this.scene.add.rectangle(
      0,
      -panelHeight / 2 + 4,
      panelWidth - 8,
      6,
      0x39c6d8,
      1
    );

    this.container = this.scene.add.container(
      cam.midPoint.x,
      cam.midPoint.y,
      [
        overlay,
        panel,
        header,
        questionText,
        ...buttonObjects.map(object => object.btn),
        ...buttonObjects.map(object => object.label),
      ]
    );

    this.prepareContainer(cam, 1000);
  }

  destroy(): void {
    this.container?.destroy();
    this.container = undefined;
  }

  showInfo(title: string, content: string, onClose?: () => void): void {
    if (this.container) return;

    const cam = this.scene.cameras.main;
    const panelWidth = Math.min(700, cam.width - 60);
    const contentWidth = panelWidth - 72;

    const titleText = this.scene.add
      .text(0, 0, title, {
        fontSize: '24px',
        color: '#ffffff',
        fontStyle: 'bold',
        align: 'center',
      })
      .setOrigin(0.5, 0)
      .setResolution(window.devicePixelRatio || 2);

    const bodyText = this.scene.add
      .text(0, 0, content, {
        fontSize: '18px',
        color: '#ffffff',
        wordWrap: { width: contentWidth, useAdvancedWrap: true },
        align: 'center',
      })
      .setOrigin(0.5, 0)
      .setResolution(window.devicePixelRatio || 2);

    const panelHeight = Math.min(
      cam.height - 40,
      Math.max(330, titleText.height + bodyText.height + 170)
    );
    const top = -panelHeight / 2 + 32;
    titleText.setPosition(0, top);
    bodyText.setPosition(0, top + titleText.height + 34);

    const okY = panelHeight / 2 - 45;
    const okBtn = this.scene.add
      .rectangle(0, okY, 130, 38, 0x111111)
      .setStrokeStyle(1, 0xffffff)
      .setInteractive({ useHandCursor: true });
    const okText = this.scene.add
      .text(0, okY, 'OK', {
        fontSize: '16px',
        color: '#00ffcc',
      })
      .setOrigin(0.5)
      .setResolution(window.devicePixelRatio || 2);

    okBtn.on('pointerdown', () => {
      this.destroy();
      onClose?.();
    });
    okBtn.on('pointerover', () => okText.setColor('#ffffff'));
    okBtn.on('pointerout', () => okText.setColor('#00ffcc'));

    const overlay = this.scene.add.rectangle(
      0,
      0,
      cam.width,
      cam.height,
      0x000000,
      0.74
    );
    const panel = this.scene.add
      .rectangle(0, 0, panelWidth, panelHeight, 0x05080c, 0.97)
      .setStrokeStyle(2, 0xffffff);

    this.container = this.scene.add.container(
      cam.midPoint.x,
      cam.midPoint.y,
      [overlay, panel, titleText, bodyText, okBtn, okText]
    );

    this.prepareContainer(cam, 1000);
  }

  private prepareContainer(cam: Phaser.Cameras.Scene2D.Camera, depth: number) {
    this.container
      ?.setScale(1 / cam.zoom)
      .setDepth(depth)
      .setAlpha(0);

    this.scene.tweens.add({
      targets: this.container,
      alpha: 1,
      duration: 150,
      ease: 'Power2',
    });
  }
}
