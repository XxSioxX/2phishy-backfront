import Phaser from 'phaser';


export default class AssessmentPopup {
  private scene: Phaser.Scene;
  private container!: Phaser.GameObjects.Container;

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
      .rectangle(cx, cy, panelWidth, panelHeight, 0xffffff, 1)
      .setStrokeStyle(2, 0x000000);

    // ✅ Question text with wrap + high resolution
    const questionText = this.scene.add
      .text(cx, cy - 140, question, {
        fontSize: '14px',
        color: '#000',
        wordWrap: { width: panelWidth - 20 },
        align: 'center',
      })
      .setOrigin(0.5)
      .setResolution(window.devicePixelRatio || 2);

    const buttons: Phaser.GameObjects.Rectangle[] = [];
    const labels: Phaser.GameObjects.Text[] = [];

    choices.forEach((choice, i) => {
      const y = cy - 60 + i * 60;

      const btn = this.scene.add
        .rectangle(cx, y, 220, 40, 0xdddddd)
        .setStrokeStyle(1, 0x000000)
        .setInteractive({ useHandCursor: true });

      const label = this.scene.add
        .text(btn.x, btn.y, choice, {
          fontSize: '12px',
          color: '#000',
          wordWrap: { width: 200 }, // wrap inside the button
          align: 'center',
        })
        .setOrigin(0.5)
        .setResolution(window.devicePixelRatio || 2);

      btn.height = label.height + 10;

      btn.on('pointerdown', () => {
        this.destroy();
        onChoice(choice);
      });

      buttons.push(btn);
      labels.push(label);
    });

    this.container = this.scene.add.container(0, 0, [
      overlay,
      panel,
      questionText,
      ...buttons,
      ...labels,
    ]);
    this.container.setDepth(1000);
  }

  destroy(): void {
    if (this.container) {
      this.container.destroy();
      this.container = undefined!;
    }
  }
}
