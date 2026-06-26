import Phaser from 'phaser';
import { AudioManager, SFX } from '../audio';

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
    onChoice: (choice: string) => void,
    options?: {
      hint?: string;
    }
  ): void {
    if (this.container) return;
    AudioManager.playSfx(this.scene, SFX.QUESTION_OPEN);

    const cam = this.scene.cameras.main;
    const panelWidth = Math.min(760, cam.width - 72);
    const contentWidth = panelWidth - 88;
    const rememberedHint = options?.hint?.trim();
    const fontFamily = 'Verdana, Arial, Helvetica, sans-serif';

    const questionText = this.scene.add
      .text(0, 0, question, {
        fontFamily,
        fontSize: '21px',
        color: '#ffffff',
        fontStyle: 'bold',
        wordWrap: { width: contentWidth, useAdvancedWrap: true },
        align: 'center',
        lineSpacing: 7,
      })
      .setOrigin(0.5, 0)
      .setResolution(window.devicePixelRatio || 2);

    const hintText = rememberedHint
      ? this.scene.add
        .text(0, 0, `Remembered clue: ${rememberedHint}`, {
          fontFamily,
          fontSize: '13px',
          color: '#9deeff',
          wordWrap: { width: contentWidth, useAdvancedWrap: true },
          align: 'center',
          lineSpacing: 5,
        })
        .setOrigin(0.5, 0)
        .setResolution(window.devicePixelRatio || 2)
      : undefined;

    const buttonObjects: {
      btn: Phaser.GameObjects.Rectangle;
      label: Phaser.GameObjects.Text;
      value: string;
    }[] = [];

    choices.forEach(choice => {
      const label = this.scene.add
        .text(0, 0, choice, {
          fontFamily,
          fontSize: '16px',
          color: '#f2fbff',
          wordWrap: {
            width: contentWidth - 44,
            useAdvancedWrap: true,
          },
          align: 'center',
          lineSpacing: 5,
        })
        .setOrigin(0.5)
        .setResolution(window.devicePixelRatio || 2);

      const btn = this.scene.add
        .rectangle(
          0,
          0,
          contentWidth,
          Math.max(66, label.height + 38),
          0x141f29,
          1
        )
        .setStrokeStyle(1, 0x5d7f91)
        .setInteractive({ useHandCursor: true });

      const selectChoice = () => {
        AudioManager.playSfx(
          this.scene,
          choice === this.correctAnswer || this.mode === 'assessment'
            ? SFX.ANSWER_CORRECT
            : SFX.ANSWER_WRONG
        );

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
        AudioManager.playSfx(this.scene, SFX.UI_HOVER);
        btn.setFillStyle(0x223746);
        btn.setStrokeStyle(1, 0x7de3ff);
        label.setColor('#ffffff');
      });
      btn.on('pointerout', () => {
        btn.setFillStyle(0x141f29);
        btn.setStrokeStyle(1, 0x5d7f91);
        label.setColor('#f2fbff');
      });
      btn.on('pointerup', selectChoice);
      label
        .setInteractive({ useHandCursor: true })
        .on('pointerup', selectChoice);

      buttonObjects.push({ btn, label, value: choice });
    });

    const maxPanelHeight = Math.max(300, cam.height - 56);
    const layoutOptions = [
      { question: 21, choice: 16, questionLine: 7, choiceLine: 5, minButton: 66, buttonPad: 38, choiceGap: 12, titleGap: hintText ? 22 : 30, hintGap: hintText ? 28 : 0 },
      { question: 18, choice: 14, questionLine: 4, choiceLine: 3, minButton: 52, buttonPad: 26, choiceGap: 8, titleGap: hintText ? 14 : 20, hintGap: hintText ? 16 : 0 },
      { question: 16, choice: 13, questionLine: 3, choiceLine: 2, minButton: 46, buttonPad: 20, choiceGap: 6, titleGap: hintText ? 10 : 15, hintGap: hintText ? 10 : 0 },
      { question: 14, choice: 12, questionLine: 2, choiceLine: 1, minButton: 40, buttonPad: 16, choiceGap: 5, titleGap: hintText ? 8 : 12, hintGap: hintText ? 8 : 0 },
    ];
    let choiceGap = 12;
    let titleGap = hintText ? 22 : 30;
    let hintGap = hintText ? 28 : 0;
    let contentHeight = 0;

    for (const option of layoutOptions) {
      questionText.setFontSize(option.question);
      questionText.setLineSpacing(option.questionLine);
      hintText?.setFontSize(Math.max(11, option.choice - 2));
      hintText?.setLineSpacing(Math.max(1, option.choiceLine));
      buttonObjects.forEach(object => {
        object.label.setFontSize(option.choice);
        object.label.setLineSpacing(option.choiceLine);
        object.btn.setSize(
          contentWidth,
          Math.max(option.minButton, object.label.height + option.buttonPad)
        );
      });

      choiceGap = option.choiceGap;
      titleGap = option.titleGap;
      hintGap = option.hintGap;
      const choicesHeight = buttonObjects.reduce(
        (height, object) => height + object.btn.height,
        0
      );
      contentHeight =
        questionText.height +
        titleGap +
        (hintText ? hintText.height : 0) +
        hintGap +
        choicesHeight +
        Math.max(0, choices.length - 1) * choiceGap;

      if (contentHeight <= maxPanelHeight - 92) break;
    }

    const panelHeight = Math.min(
      maxPanelHeight,
      Math.max(330, contentHeight + 92)
    );
    const availableContentHeight = panelHeight - 78;
    const contentScale = Math.min(1, availableContentHeight / Math.max(1, contentHeight));
    const top = -contentHeight / 2;
    questionText.setPosition(0, top);

    let currentY = top + questionText.height + titleGap;
    if (hintText) {
      hintText.setPosition(0, currentY);
      currentY += hintText.height + hintGap;
    }

    buttonObjects.forEach(object => {
      object.btn.setPosition(0, currentY + object.btn.height / 2);
      object.label.setPosition(object.btn.x, object.btn.y);
      currentY += object.btn.height + choiceGap;
    });

    const contentContainer = this.scene.add.container(0, 0, [
      questionText,
      ...(hintText ? [hintText] : []),
      ...buttonObjects.map(object => object.btn),
      ...buttonObjects.map(object => object.label),
    ]);
    contentContainer.setScale(contentScale);

    const overlay = this.scene.add.rectangle(
      0,
      0,
      cam.width,
      cam.height,
      0x000000,
      0.78
    );
    const panel = this.scene.add
      .rectangle(0, 0, panelWidth, panelHeight, 0x0d151d, 0.98)
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
        contentContainer,
      ]
    );

    this.prepareContainer(cam, 1000);
  }

  destroy(): void {
    if (this.container) {
      AudioManager.playSfx(this.scene, SFX.POPUP_CLOSE);
    }
    this.container?.destroy();
    this.container = undefined;
  }

  showInfo(title: string, content: string, onClose?: () => void): void {
    if (this.container) return;
    AudioManager.playSfx(this.scene, SFX.POPUP_OPEN);

    const cam = this.scene.cameras.main;
    const panelWidth = Math.min(700, cam.width - 60);
    const contentWidth = panelWidth - 72;

    const titleText = this.scene.add
      .text(0, 0, title, {
        fontFamily: 'Verdana, Arial, Helvetica, sans-serif',
        fontSize: '24px',
        color: '#ffffff',
        fontStyle: 'bold',
        align: 'center',
      })
      .setOrigin(0.5, 0)
      .setResolution(window.devicePixelRatio || 2);

    const bodyText = this.scene.add
      .text(0, 0, content, {
        fontFamily: 'Verdana, Arial, Helvetica, sans-serif',
        fontSize: '19px',
        color: '#ffffff',
        wordWrap: { width: contentWidth, useAdvancedWrap: true },
        align: 'center',
        lineSpacing: 7,
      })
      .setOrigin(0.5, 0)
      .setResolution(window.devicePixelRatio || 2);

    let panelHeight = Math.min(
      cam.height - 40,
      Math.max(330, titleText.height + bodyText.height + 170)
    );

    if (titleText.height + bodyText.height + 170 > cam.height - 40) {
      titleText.setFontSize(21);
      bodyText.setFontSize(16);
      bodyText.setLineSpacing(4);
      panelHeight = Math.min(
        cam.height - 40,
        Math.max(300, titleText.height + bodyText.height + 148)
      );
    }

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
        fontFamily: 'Verdana, Arial, Helvetica, sans-serif',
        fontSize: '16px',
        color: '#00ffcc',
      })
      .setOrigin(0.5)
      .setResolution(window.devicePixelRatio || 2);

    okBtn.on('pointerdown', () => {
      AudioManager.playSfx(this.scene, SFX.UI_CLICK);
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
