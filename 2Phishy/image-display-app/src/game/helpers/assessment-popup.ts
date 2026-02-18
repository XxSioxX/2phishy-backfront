import Phaser from 'phaser';


export default class AssessmentPopup {
  private scene: Phaser.Scene;
  private container!: Phaser.GameObjects.Container;
  public mode: "assessment" | "learning" = "learning";
  public correctAnswer: string = "";

  constructor(scene: Phaser.Scene) {
    this.scene = scene;
  }

  show(question: string, choices: string[], onChoice: (choice: string) => void): void {
    if (this.container) return;

    const cam = this.scene.cameras.main;
    const cx = cam.midPoint.x;
    const cy = cam.midPoint.y;

    const panelWidth = 300;
    const panelHeight = 400;

    const overlay = this.scene.add
      .rectangle(cx, cy, cam.width / cam.zoom, cam.height / cam.zoom, 0x000000, 0.5)
      .setOrigin(0.5);

    const panel = this.scene.add
      .rectangle(cx, cy, panelWidth, panelHeight, 0x000000, 0.9)
      .setStrokeStyle(2, 0xffffff);


    const questionText = this.scene.add
      .text(cx, cy - 140, question, {
        fontSize: '16px',
        color: '#ffffff',
        wordWrap: { width: panelWidth - 20 },
        align: 'center',
      })
      .setOrigin(0.5)
      .setResolution(window.devicePixelRatio || 2);

    const buttonObjects: {
      btn: Phaser.GameObjects.Rectangle;
      label: Phaser.GameObjects.Text;
      value: string;
    }[] = [];

    let currentY = cy - 60;

    choices.forEach((choice) => {

      const btn = this.scene.add
        .rectangle(cx, currentY, 220, 40, 0x111111, 1)
        .setStrokeStyle(1, 0xffffff)
        .setInteractive({ useHandCursor: true });


      const label = this.scene.add
        .text(cx, currentY, choice, {
          fontSize: '12px',
          color: '#00ffcc',
          wordWrap: { width: 200, useAdvancedWrap: true },
          align: 'center',
        })
        .setOrigin(0.5)
        .setResolution(window.devicePixelRatio || 2);

      // 🔥 NOW attach hover events (after label exists)
      btn.on('pointerover', () => {
        label.setColor('#ffffff');
      });

      btn.on('pointerout', () => {
        label.setColor('#00ffcc');
      });


      // Make button resize based on text height
      btn.height = label.height + 16;

      // Keep text centered after resizing
      label.setY(btn.y);

      // --- Button click logic ---
      btn.on('pointerdown', () => {

        // --- ASSESSMENT MODE: no highlight, close immediately ---
        if (this.mode === "assessment") {
          this.destroy();
          onChoice(choice);
          return;
        }

        // --- LEARNING MODE: highlight correct/wrong ---
        buttonObjects.forEach(obj => obj.btn.disableInteractive());

        // Highlight the selected button
        if (choice === this.correctAnswer) {
          btn.setFillStyle(0x4CAF50); // green
        } else {
          btn.setFillStyle(0xF44336); // red
        }

        // Highlight the correct answer
        const correctObj = buttonObjects.find(o => o.value === this.correctAnswer);
        if (correctObj) {
          correctObj.btn.setFillStyle(0x4CAF50);
        }

        // Delay closing to let user see highlight
        this.scene.time.delayedCall(1000, () => {
          this.destroy();
          onChoice(choice);
        });
      });

      buttonObjects.push({ btn, label, value: choice });
      currentY += label.height + 25;

    });

    this.container = this.scene.add.container(0, 0, [
      overlay,
      panel,
      questionText,
      ...buttonObjects.map(o => o.btn),
      ...buttonObjects.map(o => o.label),
    ]);

    this.container.setDepth(1000);
    this.container.setAlpha(0);
    this.container.setScrollFactor(0);


    this.scene.tweens.add({
      targets: this.container,
      alpha: 1,
      duration: 150,
      ease: 'Power2'
    });

  }

  destroy(): void {
    if (this.container) {
      this.container.destroy();
      this.container = undefined!;
    }
  }

  showInfo(title: string, content: string, onClose?: () => void): void {
    if (this.container) return;

    const cam = this.scene.cameras.main;
    const cx = cam.midPoint.x;
    const cy = cam.midPoint.y;

    const panelWidth = 300;
    const panelHeight = 300;

    const overlay = this.scene.add
      .rectangle(cx, cy, cam.width / cam.zoom, cam.height / cam.zoom, 0x000000, 0.5)
      .setOrigin(0.5);

    const panel = this.scene.add
      .rectangle(cx, cy, panelWidth, panelHeight, 0x000000, 0.9)
      .setStrokeStyle(2, 0xffffff);


    const titleText = this.scene.add
      .text(cx, cy - 120, title, {
        fontSize: '16px',
        color: '#ffffff',
        fontStyle: 'bold',
        align: 'center',
      })
      .setOrigin(0.5)
      .setResolution(window.devicePixelRatio || 2);

    const bodyText = this.scene.add
      .text(cx, cy - 20, content, {
        fontSize: '13px',
        color: '#ffffff',
        wordWrap: { width: panelWidth - 30 },
        align: 'center',
      })
      .setOrigin(0.5)
      .setResolution(window.devicePixelRatio || 2);

    const okBtn = this.scene.add
      .rectangle(cx, cy + 110, 120, 36, 0x111111)
      .setStrokeStyle(1, 0xffffff)
      .setInteractive({ useHandCursor: true });

    const okText = this.scene.add
      .text(okBtn.x, okBtn.y, 'OK', {
        fontSize: '14px',
        color: '#00ffcc',
      })
      .setOrigin(0.5)
      .setResolution(window.devicePixelRatio || 2);


    okBtn.on('pointerdown', () => {
      this.destroy();
      onClose?.();
    });
    okBtn.on('pointerover', () => {
      okText.setColor('#ffffff');
    });

    okBtn.on('pointerout', () => {
      okText.setColor('#00ffcc');
    });


    this.container = this.scene.add.container(0, 0, [
      overlay,
      panel,
      titleText,
      bodyText,
      okBtn,
      okText,
    ]);

    this.container.setDepth(1000);
    this.container.setAlpha(0);

    this.scene.tweens.add({
      targets: this.container,
      alpha: 1,
      duration: 150,
      ease: 'Power2'
    });

  }

}
