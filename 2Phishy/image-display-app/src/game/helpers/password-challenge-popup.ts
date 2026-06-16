import Phaser from 'phaser';

export type PasswordEvaluation = {
  passed: boolean;
  message: string;
};

type PasswordChallengeConfig = {
  title: string;
  instructions: string;
  evaluate: (password: string) => PasswordEvaluation;
};

export class PasswordChallengePopup {
  private container?: Phaser.GameObjects.Container;
  private keyHandler?: (event: KeyboardEvent) => void;
  private value = '';
  private inputText?: Phaser.GameObjects.Text;
  private feedbackText?: Phaser.GameObjects.Text;
  private submitting = false;

  constructor(private readonly scene: Phaser.Scene) {}

  show(
    config: PasswordChallengeConfig,
    onSuccess: (password: string) => void,
    onCancel: () => void
  ): void {
    if (this.container) return;

    this.value = '';
    this.submitting = false;

    const cam = this.scene.cameras.main;
    const panelWidth = Math.min(620, cam.width - 60);
    const panelHeight = Math.min(400, cam.height - 40);

    const overlay = this.scene.add
      .rectangle(0, 0, cam.width, cam.height, 0x000000, 0.7)
      .setOrigin(0.5);

    const panel = this.scene.add
      .rectangle(0, 0, panelWidth, panelHeight, 0x10131a, 0.98)
      .setStrokeStyle(2, 0x7de3ff);

    const title = this.scene.add
      .text(0, -panelHeight / 2 + 42, config.title, {
        fontSize: '20px',
        color: '#ffffff',
        fontStyle: 'bold',
        align: 'center',
      })
      .setOrigin(0.5);

    const instructions = this.scene.add
      .text(0, -panelHeight / 2 + 90, config.instructions, {
        fontSize: '13px',
        color: '#d8e9ef',
        align: 'center',
        wordWrap: { width: panelWidth - 38 },
      })
      .setOrigin(0.5);

    const warning = this.scene.add
      .text(
        0,
        -panelHeight / 2 + 145,
        'Use a fictional password. Never enter a real password here.',
        {
          fontSize: '11px',
          color: '#ffcc66',
          align: 'center',
        }
      )
      .setOrigin(0.5);

    const inputBackground = this.scene.add
      .rectangle(0, -5, panelWidth - 56, 42, 0x07090d, 1)
      .setStrokeStyle(1, 0xffffff);

    this.inputText = this.scene.add
      .text(-panelWidth / 2 + 42, -5, '', {
        fontSize: '15px',
        color: '#7de3ff',
        fontFamily: 'monospace',
      })
      .setOrigin(0, 0.5);

    this.feedbackText = this.scene.add
      .text(0, 52, 'Type your answer, then press ENTER or Submit.', {
        fontSize: '12px',
        color: '#aab7c4',
        align: 'center',
        wordWrap: { width: panelWidth - 40 },
      })
      .setOrigin(0.5);

    const submitButton = this.scene.add
      .rectangle(-76, panelHeight / 2 - 55, 128, 38, 0x153b45, 1)
      .setStrokeStyle(1, 0x7de3ff)
      .setInteractive({ useHandCursor: true });

    const submitLabel = this.scene.add
      .text(submitButton.x, submitButton.y, 'Submit', {
        fontSize: '14px',
        color: '#ffffff',
      })
      .setOrigin(0.5);

    const cancelButton = this.scene.add
      .rectangle(76, panelHeight / 2 - 55, 128, 38, 0x2b2e36, 1)
      .setStrokeStyle(1, 0xffffff)
      .setInteractive({ useHandCursor: true });

    const cancelLabel = this.scene.add
      .text(cancelButton.x, cancelButton.y, 'Cancel', {
        fontSize: '14px',
        color: '#ffffff',
      })
      .setOrigin(0.5);

    const submit = () => {
      if (this.submitting) return;

      const result = config.evaluate(this.value);
      this.feedbackText?.setText(result.message);
      this.feedbackText?.setColor(result.passed ? '#67ef8d' : '#ff7676');

      if (!result.passed) {
        this.scene.cameras.main.shake(100, 0.002);
        return;
      }

      this.submitting = true;
      const acceptedPassword = this.value;

      this.scene.time.delayedCall(350, () => {
        this.destroy();
        onSuccess(acceptedPassword);
      });
    };

    const cancel = () => {
      if (this.submitting) return;
      this.destroy();
      onCancel();
    };

    submitButton.on('pointerup', submit);
    submitLabel
      .setInteractive({ useHandCursor: true })
      .on('pointerup', submit);
    cancelButton.on('pointerup', cancel);
    cancelLabel
      .setInteractive({ useHandCursor: true })
      .on('pointerup', cancel);

    this.keyHandler = (event: KeyboardEvent) => {
      if (this.submitting) return;

      if (event.key === 'Escape') {
        event.preventDefault();
        cancel();
        return;
      }

      if (event.key === 'Enter') {
        event.preventDefault();
        submit();
        return;
      }

      if (event.key === 'Backspace') {
        event.preventDefault();
        this.value = this.value.slice(0, -1);
        this.refreshInput();
        return;
      }

      if (
        event.key.length === 1 &&
        !event.ctrlKey &&
        !event.metaKey &&
        !event.altKey &&
        this.value.length < 40
      ) {
        event.preventDefault();
        this.value += event.key;
        this.refreshInput();
      }
    };

    this.scene.input.keyboard?.on('keydown', this.keyHandler);

    this.container = this.scene.add.container(
      cam.midPoint.x,
      cam.midPoint.y,
      [
        overlay,
        panel,
        title,
        instructions,
        warning,
        inputBackground,
        this.inputText,
        this.feedbackText,
        submitButton,
        submitLabel,
        cancelButton,
        cancelLabel,
      ]
    );

    this.container
      .setScale(1 / cam.zoom)
      .setDepth(1200)
      .setAlpha(0);

    this.scene.tweens.add({
      targets: this.container,
      alpha: 1,
      duration: 150,
      ease: 'Power2',
    });

    this.refreshInput();
  }

  destroy(): void {
    if (this.keyHandler) {
      this.scene.input.keyboard?.off('keydown', this.keyHandler);
      this.keyHandler = undefined;
    }

    this.container?.destroy();
    this.container = undefined;
    this.inputText = undefined;
    this.feedbackText = undefined;
    this.value = '';
    this.submitting = false;
  }

  private refreshInput(): void {
    this.inputText?.setText(
      this.value ? '*'.repeat(this.value.length) : 'Start typing...'
    );
    this.inputText?.setColor(this.value ? '#7de3ff' : '#667680');
  }
}
