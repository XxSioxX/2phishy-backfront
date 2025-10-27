import Phaser from 'phaser';

export default class AssessmentPopup {
  private scene: Phaser.Scene;
  private container!: Phaser.GameObjects.Container;

  constructor(scene: Phaser.Scene) {
    this.scene = scene;
  }

  show(question: string, choices: string[], onChoice: (choice: string) => void): void {
    if (this.container) return;

    // Use fixed screen coordinates instead of camera coordinates
    const screenWidth = this.scene.scale.width;
    const screenHeight = this.scene.scale.height;
    const cx = screenWidth / 2;
    const cy = screenHeight / 2;

    const panelWidth = 400;
    const panelHeight = 500;

    // Full screen overlay
    const overlay = this.scene.add
      .rectangle(cx, cy, screenWidth, screenHeight, 0x000000, 0.7)
      .setOrigin(0.5)
      .setScrollFactor(0); // Don't scroll with camera

    const panel = this.scene.add
      .rectangle(cx, cy, panelWidth, panelHeight, 0xffffff, 1)
      .setStrokeStyle(3, 0x000000)
      .setScrollFactor(0); // Don't scroll with camera

    // Question text with fixed positioning
    const questionText = this.scene.add
      .text(cx, cy - 180, question, {
        fontSize: '16px',
        color: '#000',
        wordWrap: { width: panelWidth - 40 },
        align: 'center',
      })
      .setOrigin(0.5)
      .setScrollFactor(0) // Don't scroll with camera
      .setResolution(window.devicePixelRatio || 2);

    const buttons: Phaser.GameObjects.Rectangle[] = [];
    const labels: Phaser.GameObjects.Text[] = [];

    // Choices with fixed positioning
    choices.forEach((choice, i) => {
      const y = cy - 80 + i * 80;

      const btn = this.scene.add
        .rectangle(cx, y, 320, 50, 0xdddddd)
        .setStrokeStyle(2, 0x000000)
        .setInteractive({ useHandCursor: true })
        .setScrollFactor(0); // Don't scroll with camera

      const label = this.scene.add
        .text(btn.x, btn.y, choice, {
          fontSize: '14px',
          color: '#000',
          wordWrap: { width: 300 },
          align: 'center',
        })
        .setOrigin(0.5)
        .setScrollFactor(0) // Don't scroll with camera
        .setResolution(window.devicePixelRatio || 2);

      // Resize button to fit multi-line text
      btn.height = Math.max(50, label.height + 20);

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
    this.container.setDepth(10000); // Very high depth to ensure it's on top
    this.container.setScrollFactor(0); // Don't scroll with camera
  }

  destroy(): void {
    if (this.container) {
      this.container.destroy();
      this.container = undefined!;
    }
  }
}
