import Phaser from "phaser";

export class DialogueRunner {
  private scene: Phaser.Scene;
  private config: any;
  private lines: string[];
  private currentIndex = 0;
  private textObj!: Phaser.GameObjects.Text;
  private spaceKey!: Phaser.Input.Keyboard.Key;
  private isTyping = false;
  private typingEvent?: Phaser.Time.TimerEvent;
  private continueIndicator!: Phaser.GameObjects.Text;
  private indicatorTween!: Phaser.Tweens.Tween;

  constructor(scene: Phaser.Scene, config: any) {
    this.scene = scene;
    this.config = config;

    // Convert nodes → lines
    if (config.nodes) {
      this.lines = config.nodes.map((n: any) => n.text);
    } else {
      this.lines = config.lines || [];
    }
  }

  start(onComplete?: () => void) {

    this.scene.input.keyboard?.addCapture(
      Phaser.Input.Keyboard.KeyCodes.SPACE
    );

    const { width, height } = this.scene.scale;

    if (this.config.settings.background) {
      this.scene.cameras.main.setBackgroundColor(
        this.config.settings.background
      );
    }

    this.textObj = this.scene.add.text(width / 2, height / 2, "", {
      fontSize: `${this.config.settings.fontSize}px`,
      color: this.config.settings.textColor,
      align: "center",
      wordWrap: { width: width * 0.8 }
    })
    .setOrigin(0.5)
    .setScrollFactor(0);

    this.spaceKey = this.scene.input.keyboard!.addKey(
      Phaser.Input.Keyboard.KeyCodes.SPACE
    );

    this.spaceKey.on("down", () => {
      if (this.isTyping) {

        if (this.typingEvent) {
          this.typingEvent.remove(false);
          this.typingEvent = undefined;
        }

        this.textObj.setText(this.lines[this.currentIndex]);
        this.isTyping = false;

        this.continueIndicator.setAlpha(1);
        this.indicatorTween.resume();

      } else {
        this.next(onComplete);
      }
    });

    this.continueIndicator = this.scene.add.text(
      width / 2,
      height / 2 + 70,
      "▼",
      {
        fontSize: "22px",
        color: "#aaaaaa"
      }
    )
    .setOrigin(0.5)
    .setScrollFactor(0)
    .setAlpha(0);

    this.indicatorTween = this.scene.tweens.add({
      targets: this.continueIndicator,
      alpha: { from: 0.2, to: 1 },
      duration: 500,
      yoyo: true,
      repeat: -1,
      paused: true
    });

    this.scene.tweens.add({
      targets: this.continueIndicator,
      y: "+=6",
      duration: 600,
      yoyo: true,
      repeat: -1,
      ease: "Sine.easeInOut",
      paused: true
    });

    this.typeLine();
  }

  private typeLine() {
    this.continueIndicator.setAlpha(0);
    this.indicatorTween.pause();
    const fullText = this.lines[this.currentIndex];

    if (this.typingEvent) {
      this.typingEvent.remove(false);
    }

    this.isTyping = true;
    let charIndex = 0;

    this.textObj.setText("");

    this.typingEvent = this.scene.time.addEvent({
      delay: this.config.settings.typeSpeed,
      repeat: fullText.length - 1,
      callback: () => {
        this.textObj.text += fullText[charIndex++];

      if (charIndex >= fullText.length) {
        this.isTyping = false;
        this.typingEvent = undefined;

        this.continueIndicator.setAlpha(1);
        this.indicatorTween.resume();
      }
      }
    });
  }

  private next(onComplete?: () => void) {
    this.currentIndex++;

    if (this.currentIndex >= this.lines.length) {
      // Dialogue finished
      if (onComplete) {
        onComplete();
      }
      return;
    }

    this.typeLine();
  }
}