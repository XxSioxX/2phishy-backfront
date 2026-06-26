import Phaser from 'phaser';
import { AudioManager, SFX } from '../audio';

export type PasswordEvaluation = {
  passed: boolean;
  message: string;
};

type PasswordChallengeConfig = {
  title: string;
  instructions: string;
  evaluate: (password: string) => PasswordEvaluation;
  onAttempt?: (result: PasswordEvaluation, password: string) => PasswordEvaluation | void;
  showStrengthMeter?: boolean;
};

export class PasswordChallengePopup {
  private container?: Phaser.GameObjects.Container;
  private keyHandler?: (event: KeyboardEvent) => void;
  private value = '';
  private inputText?: Phaser.GameObjects.Text;
  private feedbackText?: Phaser.GameObjects.Text;
  private strengthFill?: Phaser.GameObjects.Rectangle;
  private strengthText?: Phaser.GameObjects.Text;
  private strengthFillMaxWidth = 0;
  private submitting = false;
  private htmlInput?: HTMLInputElement;
  private htmlInputKeyHandler?: (event: KeyboardEvent) => void;
  private syncNativeInputPosition?: () => void;

  constructor(private readonly scene: Phaser.Scene) {}

  show(
    config: PasswordChallengeConfig,
    onSuccess: (password: string) => void,
    onCancel: () => void
  ): void {
    if (this.container) return;
    AudioManager.playSfx(this.scene, SFX.GUARDIAN_CHALLENGE_START);

    this.value = '';
    this.submitting = false;

    const cam = this.scene.cameras.main;
    const panelWidth = Math.min(620, cam.width - 60);
    const panelHeight = Math.min(440, cam.height - 40);
    const showStrengthMeter = config.showStrengthMeter !== false;
    const fontFamily = 'Verdana, Arial, Helvetica, sans-serif';

    const overlay = this.scene.add
      .rectangle(0, 0, cam.width, cam.height, 0x000000, 0.7)
      .setOrigin(0.5);

    const panel = this.scene.add
      .rectangle(0, 0, panelWidth, panelHeight, 0x10131a, 0.98)
      .setStrokeStyle(2, 0x7de3ff);

    const title = this.scene.add
      .text(0, -panelHeight / 2 + 42, config.title, {
        fontFamily,
        fontSize: '20px',
        color: '#ffffff',
        fontStyle: 'bold',
        align: 'center',
      })
      .setOrigin(0.5);

    const instructions = this.scene.add
      .text(0, -panelHeight / 2 + 90, config.instructions, {
        fontFamily,
        fontSize: '14px',
        color: '#d8e9ef',
        align: 'center',
        wordWrap: { width: panelWidth - 38 },
        lineSpacing: 5,
      })
      .setOrigin(0.5);

    const warning = this.scene.add
      .text(
        0,
        -panelHeight / 2 + 145,
        'Use a fictional password. Never enter a real password here.',
        {
          fontFamily,
          fontSize: '12px',
          color: '#ffcc66',
          align: 'center',
        }
      )
      .setOrigin(0.5);

    const inputBackground = this.scene.add
      .rectangle(0, -5, panelWidth - 56, 42, 0x07090d, 1)
      .setStrokeStyle(1, 0xffffff)
      .setInteractive({ useHandCursor: true });

    this.inputText = this.scene.add
      .text(-panelWidth / 2 + 42, -5, '', {
        fontSize: '15px',
        color: '#7de3ff',
        fontFamily: 'monospace',
      })
      .setOrigin(0, 0.5);

    this.strengthFillMaxWidth = panelWidth - 92;
    const strengthBg = this.scene.add
      .rectangle(0, 29, this.strengthFillMaxWidth, 10, 0x222b35, 1)
      .setStrokeStyle(1, 0x3a5364);

    this.strengthFill = this.scene.add
      .rectangle(-this.strengthFillMaxWidth / 2, 29, 1, 10, 0xff7676, 1)
      .setOrigin(0, 0.5);

    this.strengthText = this.scene.add
      .text(0, 47, 'Strength: Empty', {
        fontFamily,
        fontSize: '12px',
        color: '#aab7c4',
        align: 'center',
      })
      .setOrigin(0.5);

    if (!showStrengthMeter) {
      strengthBg.setVisible(false);
      this.strengthFill.setVisible(false);
      this.strengthText.setVisible(false);
    }

    this.feedbackText = this.scene.add
      .text(0, showStrengthMeter ? 76 : 52, 'Type your answer, then press ENTER or Submit.', {
        fontFamily,
        fontSize: '13px',
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
        fontFamily,
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
        fontFamily,
        fontSize: '14px',
        color: '#ffffff',
      })
      .setOrigin(0.5);

    const submit = () => {
      if (this.submitting) return;
      AudioManager.playSfx(this.scene, SFX.PASSWORD_SUBMIT);

      const result = config.evaluate(this.value);
      const override = config.onAttempt?.(result, this.value);
      const effectiveResult = override ?? result;
      this.feedbackText?.setText(effectiveResult.message);
      this.feedbackText?.setColor(effectiveResult.passed ? '#67ef8d' : '#ff7676');
      AudioManager.playSfx(
        this.scene,
        effectiveResult.passed ? SFX.PASSWORD_SUCCESS : SFX.PASSWORD_FAIL
      );

      if (!effectiveResult.passed) {
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
      AudioManager.playSfx(this.scene, SFX.UI_CLICK);
      this.destroy();
      onCancel();
    };

    const focusInput = () => {
      if (!this.htmlInput) return;

      this.htmlInput.value = this.value;
      this.htmlInput.focus({ preventScroll: true });
    };

    submitButton.on('pointerup', submit);
    submitLabel
      .setInteractive({ useHandCursor: true })
      .on('pointerup', submit);
    cancelButton.on('pointerup', cancel);
    cancelLabel
      .setInteractive({ useHandCursor: true })
      .on('pointerup', cancel);
    inputBackground.on('pointerup', focusInput);
    this.inputText
      .setInteractive({ useHandCursor: true })
      .on('pointerup', focusInput);

    this.keyHandler = (event: KeyboardEvent) => {
      if (this.submitting) return;
      if (this.htmlInput === document.activeElement) return;

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
        AudioManager.playSfx(this.scene, SFX.PASSWORD_TYPE);
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
        AudioManager.playSfx(this.scene, SFX.PASSWORD_TYPE);
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
        strengthBg,
        this.strengthFill,
        this.strengthText,
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

    this.attachNativeInput(inputBackground, submit, cancel);
    this.refreshInput();
  }

  destroy(): void {
    if (this.container) {
      AudioManager.playSfx(this.scene, SFX.POPUP_CLOSE);
    }
    this.detachNativeInput();

    if (this.keyHandler) {
      this.scene.input.keyboard?.off('keydown', this.keyHandler);
      this.keyHandler = undefined;
    }

    this.container?.destroy();
    this.container = undefined;
    this.inputText = undefined;
    this.feedbackText = undefined;
    this.strengthFill = undefined;
    this.strengthText = undefined;
    this.strengthFillMaxWidth = 0;
    this.value = '';
    this.submitting = false;
  }

  private attachNativeInput(
    inputBackground: Phaser.GameObjects.Rectangle,
    submit: () => void,
    cancel: () => void
  ): void {
    this.detachNativeInput();

    const input = document.createElement('input');
    input.type = 'text';
    input.inputMode = 'text';
    input.autocomplete = 'off';
    input.autocapitalize = 'off';
    input.spellcheck = false;
    input.maxLength = 40;
    input.setAttribute('aria-label', 'Fictional password challenge answer');
    input.style.position = 'fixed';
    input.style.zIndex = '10000';
    input.style.border = '0';
    input.style.outline = '0';
    input.style.margin = '0';
    input.style.padding = '0 12px';
    input.style.background = 'transparent';
    input.style.color = 'transparent';
    input.style.caretColor = '#7de3ff';
    input.style.opacity = '0.01';
    input.style.fontSize = '16px';
    input.style.fontFamily = 'monospace';
    input.style.boxSizing = 'border-box';

    input.addEventListener('input', () => {
      this.value = input.value.slice(0, 40);

      if (input.value !== this.value) {
        input.value = this.value;
      }

      this.refreshInput();
    });

    this.htmlInputKeyHandler = (event: KeyboardEvent) => {
      event.stopPropagation();

      if (event.key === 'Enter') {
        event.preventDefault();
        submit();
        return;
      }

      if (event.key === 'Escape') {
        event.preventDefault();
        cancel();
      }
    };
    input.addEventListener('keydown', this.htmlInputKeyHandler);

    this.htmlInput = input;
    document.body.appendChild(input);

    this.syncNativeInputPosition = () => {
      if (!this.container || !this.htmlInput) return;

      const canvasBounds = this.scene.game.canvas.getBoundingClientRect();
      const gameSize = this.scene.scale.gameSize;
      const scaleX = canvasBounds.width / gameSize.width;
      const scaleY = canvasBounds.height / gameSize.height;
      const containerScale = this.container.scaleX;
      const logicalLeft =
        this.container.x +
        (inputBackground.x - inputBackground.width / 2) * containerScale;
      const logicalTop =
        this.container.y +
        (inputBackground.y - inputBackground.height / 2) * containerScale;
      const logicalWidth = inputBackground.width * containerScale;
      const logicalHeight = inputBackground.height * containerScale;

      this.htmlInput.style.left = `${canvasBounds.left + logicalLeft * scaleX}px`;
      this.htmlInput.style.top = `${canvasBounds.top + logicalTop * scaleY}px`;
      this.htmlInput.style.width = `${logicalWidth * scaleX}px`;
      this.htmlInput.style.height = `${logicalHeight * scaleY}px`;
    };

    this.scene.scale.on(
      Phaser.Scale.Events.RESIZE,
      this.syncNativeInputPosition
    );
    window.addEventListener('resize', this.syncNativeInputPosition);
    this.scene.time.delayedCall(0, this.syncNativeInputPosition);
  }

  private detachNativeInput(): void {
    if (this.syncNativeInputPosition) {
      this.scene.scale.off(
        Phaser.Scale.Events.RESIZE,
        this.syncNativeInputPosition
      );
      window.removeEventListener('resize', this.syncNativeInputPosition);
      this.syncNativeInputPosition = undefined;
    }

    if (this.htmlInput && this.htmlInputKeyHandler) {
      this.htmlInput.removeEventListener('keydown', this.htmlInputKeyHandler);
    }

    this.htmlInput?.remove();
    this.htmlInput = undefined;
    this.htmlInputKeyHandler = undefined;
  }

  private refreshInput(): void {
    this.inputText?.setText(
      this.value ? '*'.repeat(this.value.length) : 'Start typing...'
    );
    this.inputText?.setColor(this.value ? '#7de3ff' : '#667680');
    this.refreshStrengthMeter();
  }

  private refreshStrengthMeter(): void {
    if (!this.strengthFill || !this.strengthText) return;

    const strength = this.evaluateStrength(this.value);
    this.strengthFill
      .setFillStyle(strength.color, 1)
      .setSize(Math.max(1, strength.ratio * this.strengthFillMaxWidth), 10);
    this.strengthText
      .setText(`Strength: ${strength.label}`)
      .setColor(strength.textColor);
  }

  private evaluateStrength(password: string): {
    ratio: number;
    label: string;
    color: number;
    textColor: string;
  } {
    if (!password) {
      return { ratio: 0.03, label: 'Empty', color: 0x394854, textColor: '#aab7c4' };
    }

    let score = 0;
    if (password.length >= 8) score += 1;
    if (password.length >= 12) score += 1;
    if (password.length >= 16) score += 1;
    if (/[a-z]/.test(password) && /[A-Z]/.test(password)) score += 1;
    if (/\d/.test(password)) score += 1;
    if (/[^A-Za-z0-9]/.test(password)) score += 1;
    if (new Set(password.toLowerCase()).size >= Math.min(8, password.length)) score += 1;

    if (score <= 2) {
      return { ratio: 0.25, label: 'Weak', color: 0xff7676, textColor: '#ff9a9a' };
    }
    if (score <= 4) {
      return { ratio: 0.52, label: 'Fair', color: 0xffcc66, textColor: '#ffd98f' };
    }
    if (score <= 6) {
      return { ratio: 0.78, label: 'Strong', color: 0x7de3ff, textColor: '#8fe9ff' };
    }

    return { ratio: 1, label: 'Excellent', color: 0x67ef8d, textColor: '#8cffaa' };
  }
}
