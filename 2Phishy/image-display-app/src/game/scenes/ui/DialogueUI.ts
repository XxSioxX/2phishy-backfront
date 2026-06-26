import {
  DialogueScenario,
  DialogueNode,
  DialogueResponse,
} from '../../helpers/DialogueManager';
import { TOUCH_EVENTS } from '../../consts';
import { AudioManager, SFX } from '../../audio';
import type { SfxKey } from '../../audio/soundRegistry';

type DialogueUIOptions = {
  continueSfx?: SfxKey;
  typewriter?: boolean;
};

export class DialogueUI {
  private scene: Phaser.Scene;
  private container!: Phaser.GameObjects.Container;
  private currentNode!: DialogueNode;
  private scenario!: DialogueScenario;
  private onComplete!: (result?: any) => void;
  private readonly fontFamily = 'Verdana, Arial, Helvetica, sans-serif';
  private typingEvent?: Phaser.Time.TimerEvent;
  private typingSound?: Phaser.Sound.BaseSound;
  private isTyping = false;
  private readonly continueSfx: SfxKey;
  private readonly useTypewriter: boolean;

  constructor(scene: Phaser.Scene, options: DialogueUIOptions = {}) {
    this.scene = scene;
    this.continueSfx = options.continueSfx ?? SFX.DIALOGUE_CONTINUE;
    this.useTypewriter = options.typewriter ?? false;
  }

  start(scenario: DialogueScenario, onComplete: (result?: any) => void): void {
    this.scenario = scenario;
    this.onComplete = onComplete;

    this.container = this.scene.add.container(0, 0);
    this.container.setDepth(1000);

    const startNode =
      this.scenario.nodes.find(n => n.id === 'start') ??
      this.scenario.nodes[0];

    this.scene.time.delayedCall(0, () => {
      this.showNode(startNode.id);
    });

    this.scene.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.cleanupTyping();
    });
  }

  private showNode(nodeId: string): void {
    this.cleanupTyping();
    this.container.removeAll(true);

    const node = this.scenario.nodes.find(n => n.id === nodeId);
    if (!node) {
      console.error(`Node ${nodeId} not found`);
      return;
    }
    this.currentNode = node;

    this.showMessagePanel();
  }

  private showMessagePanel(): void {
    const fullText = this.currentNode.npc ?? this.currentNode.text ?? '';
    const layout = this.getPanelLayout(fullText, 0.36, 148);
    const { panelWidth, panelHeight, panelX, panelY, padding, textWidth } = layout;

    const panel = this.scene.add
      .rectangle(panelX, panelY, panelWidth, panelHeight, 0x03070d, 0.93)
      .setStrokeStyle(3, 0xf2f8ff)
      .setOrigin(0.5);
    const npcText = this.scene.add.text(
      panelX - panelWidth / 2 + padding,
      panelY - panelHeight / 2 + padding,
      this.useTypewriter ? '' : fullText,
      {
        fontFamily: this.fontFamily,
        fontSize: '20px',
        color: '#ffffff',
        lineSpacing: 7,
        wordWrap: { width: textWidth },
        align: 'left',
      }
    ).setOrigin(0, 0).setResolution(window.devicePixelRatio || 2);

    this.container.add([panel, npcText]);
    if (this.useTypewriter) {
      this.startTyping(npcText, fullText, this.getTypeSpeed());
    }

    const advance = () => {
      if (this.currentNode.responses && this.currentNode.responses.length > 0) {
        this.container.removeAll(true);
        this.showResponsesPanel();
        return;
      }

      const nextNode = this.scenario.nodes.find(
        n => Number(n.id) === Number(this.currentNode.id) + 1
      );

      if (nextNode) {
        this.showNode(nextNode.id);
      } else {
        this.finish();
      }
    };

    if (this.currentNode.end) {
      this.bindContinue([panel, npcText], () => {
        if (this.isTyping) {
          this.finishTyping(npcText, fullText);
          return false;
        }

        this.finish();
        return true;
      });
      return;
    }

    const continueText = this.createContinuePrompt(
      panelX,
      panelY,
      panelWidth,
      panelHeight,
      padding
    );

    this.container.add(continueText);
    this.bindContinue([panel, npcText, continueText], () => {
      if (this.isTyping) {
        this.finishTyping(npcText, fullText);
        return false;
      }

      advance();
      return true;
    });
  }

  private showResponsesPanel(): void {
    const responses = this.currentNode.responses ?? [];
    const responseText = responses.map(res => `> ${res.text}`).join('\n\n');
    const layout = this.getPanelLayout(responseText, 0.48, 190);
    const { panelWidth, panelHeight, panelX, panelY, padding, textWidth } = layout;
    const availableHeight = panelHeight - padding * 2;
    const responseStyle = this.getResponseTextStyle(responseText, textWidth, availableHeight);

    const panel = this.scene.add
      .rectangle(panelX, panelY, panelWidth, panelHeight, 0x03070d, 0.95)
      .setStrokeStyle(3, 0xf2f8ff)
      .setOrigin(0.5);

    this.container.add(panel);

    const textStartX = panelX - panelWidth / 2 + padding;
    let currentY = panelY - panelHeight / 2 + padding;

    responses.forEach((res) => {
      const responseText = this.scene.add.text(
        textStartX,
        currentY,
        '> ' + res.text,
        {
          fontFamily: this.fontFamily,
          fontSize: `${responseStyle.fontSize}px`,
          color: '#66ffe3',
          lineSpacing: responseStyle.lineSpacing,
          wordWrap: { width: textWidth },
          align: 'left',
        }
      )
        .setOrigin(0, 0)
        .setResolution(window.devicePixelRatio || 2)
        .setInteractive({ useHandCursor: true })
        .on('pointerdown', () => this.handleResponse(res))
        .on('pointerover', () => responseText.setColor('#ffffff'))
        .on('pointerout', () => responseText.setColor('#66ffe3'));

      this.container.add(responseText);
      currentY += responseText.height + responseStyle.gap;
    });
  }

  private handleResponse(res: DialogueResponse): void {
    AudioManager.playSfx(this.scene, SFX.DIALOGUE_CHOICE);
    if (res.outcome) {
      this.showConsequence(res);
      return;
    }

    if (res.next) {
      this.showNode(res.next);
    }
  }

  private finish(result?: any): void {
    this.cleanupTyping();
    this.container.destroy();
    this.onComplete(result);
  }

  private showConsequence(res: DialogueResponse): void {
    this.container.removeAll(true);

    const isSuccess = res.outcome === 'success';
    const consequence = this.scenario.consequences?.[res.outcome];
    const message = consequence?.message ?? 'Result recorded.';
    const explanation = consequence?.explanation ?? '';
    const layout = this.getPanelLayout(`${message}\n\n${explanation}`, 0.52, 210);
    const { panelWidth, panelHeight, panelX, panelY, padding, textWidth } = layout;
    const availableHeight = panelHeight - padding * 2 - 34;
    const textScale = this.getConsequenceTextScale(message, explanation, textWidth, availableHeight);

    const panel = this.scene.add
      .rectangle(panelX, panelY, panelWidth, panelHeight, 0x03070d, 0.95)
      .setStrokeStyle(3, isSuccess ? 0x00cc66 : 0xcc3333)
      .setOrigin(0.5);

    const textStartX = panelX - panelWidth / 2 + padding;
    let currentY = panelY - panelHeight / 2 + padding;

    const messageText = this.scene.add.text(
      textStartX,
      currentY,
      message,
      {
        fontFamily: this.fontFamily,
        fontSize: `${textScale.messageFontSize}px`,
        color: '#ffffff',
        lineSpacing: textScale.messageLineSpacing,
        wordWrap: { width: textWidth },
      }
    ).setOrigin(0, 0).setResolution(window.devicePixelRatio || 2);

    currentY += messageText.height + textScale.gap;

    const explanationText = this.scene.add.text(
      textStartX,
      currentY,
      explanation,
      {
        fontFamily: this.fontFamily,
        fontSize: `${textScale.explanationFontSize}px`,
        color: '#cccccc',
        lineSpacing: textScale.explanationLineSpacing,
        wordWrap: { width: textWidth },
      }
    ).setOrigin(0, 0).setResolution(window.devicePixelRatio || 2);

    const continueText = this.createContinuePrompt(
      panelX,
      panelY,
      panelWidth,
      panelHeight,
      padding
    );

    this.container.add([panel, messageText, explanationText, continueText]);
    this.bindContinue([panel, messageText, explanationText, continueText], () => {
      this.finish({
        outcome: res.outcome,
        question_id: res.question_id,
        strategy: this.scenario.strategy,
      });
    });
  }

  private createContinuePrompt(
    panelX: number,
    panelY: number,
    panelWidth: number,
    panelHeight: number,
    padding: number
  ): Phaser.GameObjects.Text {
    const prompt = this.scene.add.text(0, 0, 'Tap or Press SPACE', {
      fontFamily: this.fontFamily,
      fontSize: '15px',
      color: '#c8d1dc',
      align: 'right',
    }).setOrigin(1, 1).setResolution(window.devicePixelRatio || 2);

    prompt.setPosition(
      panelX + panelWidth / 2 - padding,
      panelY + panelHeight / 2 - Math.max(20, padding * 0.7)
    );

    return prompt;
  }

  private getPanelLayout(
    text: string,
    desiredHeightRatio: number,
    minHeight: number
  ): {
    panelWidth: number;
    panelHeight: number;
    panelX: number;
    panelY: number;
    padding: number;
    textWidth: number;
  } {
    const cam = this.scene.cameras.main;
    const panelWidth = Math.max(260, cam.worldView.width - 40);
    const padding = Phaser.Math.Clamp(Math.round(panelWidth * 0.035), 22, 32);
    const textWidth = panelWidth - padding * 2;
    const estimatedLines = Math.max(1, Math.ceil(text.length / Math.max(24, textWidth / 11)));
    const estimatedTextHeight = estimatedLines * 30;
    const maxHeight = Math.max(minHeight, cam.worldView.height - 34);
    const targetHeight = Math.max(
      minHeight,
      cam.worldView.height * desiredHeightRatio,
      estimatedTextHeight + padding * 2 + 30
    );
    const panelHeight = Math.min(maxHeight, targetHeight);
    const panelX = cam.worldView.left + 20 + panelWidth / 2;
    const panelY = cam.worldView.bottom - panelHeight / 2 - 26;

    return {
      panelWidth,
      panelHeight,
      panelX,
      panelY,
      padding,
      textWidth,
    };
  }

  private getResponseTextStyle(
    text: string,
    textWidth: number,
    availableHeight: number
  ): { fontSize: number; lineSpacing: number; gap: number } {
    const estimatedLines = Math.max(1, Math.ceil(text.length / Math.max(24, textWidth / 10)));
    const estimatedAt18 = estimatedLines * 28;

    if (estimatedAt18 <= availableHeight) {
      return { fontSize: 18, lineSpacing: 6, gap: 14 };
    }

    if (estimatedLines * 24 <= availableHeight) {
      return { fontSize: 16, lineSpacing: 4, gap: 10 };
    }

    return { fontSize: 14, lineSpacing: 3, gap: 8 };
  }

  private getConsequenceTextScale(
    message: string,
    explanation: string,
    textWidth: number,
    availableHeight: number
  ): {
    messageFontSize: number;
    explanationFontSize: number;
    messageLineSpacing: number;
    explanationLineSpacing: number;
    gap: number;
  } {
    const estimatedCharsPerLine = Math.max(24, textWidth / 10);
    const estimatedLines =
      Math.ceil(message.length / estimatedCharsPerLine) +
      Math.ceil(explanation.length / estimatedCharsPerLine);

    if (estimatedLines * 28 <= availableHeight) {
      return {
        messageFontSize: 19,
        explanationFontSize: 15,
        messageLineSpacing: 7,
        explanationLineSpacing: 6,
        gap: 15,
      };
    }

    return {
      messageFontSize: 17,
      explanationFontSize: 13,
      messageLineSpacing: 5,
      explanationLineSpacing: 4,
      gap: 10,
    };
  }

  private bindContinue(
    targets: Array<Phaser.GameObjects.Rectangle | Phaser.GameObjects.Text>,
    onContinue: () => boolean | void
  ): void {
    let handled = false;
    let runOnce: () => void;

    const cleanup = () => {
      this.scene.input.keyboard?.off('keydown-SPACE', runOnce);
      this.scene.game.events.off(TOUCH_EVENTS.continue, runOnce);
      targets.forEach(target => target.off('pointerdown', runOnce));
    };

    runOnce = () => {
      if (handled) return;
      handled = true;
      AudioManager.playSfx(this.scene, this.continueSfx);
      const shouldCleanup = onContinue() !== false;
      if (shouldCleanup) {
        cleanup();
      } else {
        handled = false;
      }
    };

    this.scene.input.keyboard?.on('keydown-SPACE', runOnce);
    this.scene.game.events.on(TOUCH_EVENTS.continue, runOnce);

    targets.forEach(target => {
      target.setInteractive({ useHandCursor: true });
      target.on('pointerdown', runOnce);
      target.once(Phaser.GameObjects.Events.DESTROY, cleanup);
    });
  }

  private startTyping(
    text: Phaser.GameObjects.Text,
    fullText: string,
    delay: number
  ): void {
    this.cleanupTyping();

    if (!fullText) {
      text.setText('');
      return;
    }

    let charIndex = 0;
    this.isTyping = true;
    this.typingSound = AudioManager.playSfxInstance(this.scene, SFX.DIALOGUE_TYPING);
    this.typingEvent = this.scene.time.addEvent({
      delay,
      repeat: fullText.length - 1,
      callback: () => {
        charIndex += 1;
        text.setText(fullText.slice(0, charIndex));

        if (charIndex >= fullText.length) {
          this.cleanupTyping();
        }
      },
    });
  }

  private finishTyping(
    text: Phaser.GameObjects.Text,
    fullText: string
  ): void {
    text.setText(fullText);
    this.cleanupTyping();
  }

  private cleanupTyping(): void {
    this.typingEvent?.remove(false);
    this.typingEvent = undefined;
    this.typingSound?.stop();
    this.typingSound?.destroy();
    this.typingSound = undefined;
    this.isTyping = false;
  }

  private getTypeSpeed(): number {
    const speed = Number((this.scenario as any).settings?.typeSpeed);
    return Number.isFinite(speed) && speed > 0 ? speed : 25;
  }
}
