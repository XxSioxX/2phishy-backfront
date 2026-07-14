import Phaser from "phaser";
import { TOUCH_EVENTS } from "../../consts";
import { AudioManager, SFX } from "../../audio";
import { DialogueRunner } from "../../helpers/DialogueRunner";

type CreditLine = {
  text: string;
  kind?: "title" | "section" | "body" | "spacer";
};

const CREDIT_LINES: CreditLine[] = [
  { text: "2Phishy", kind: "title" },
  { text: "", kind: "spacer" },
  { text: "Created By", kind: "section" },
  { text: "Jahnreil J. Amarillento & Mon Andre V. Perez" },
  { text: "", kind: "spacer" },
  { text: "Game Programming / Phaser Engineering", kind: "section" },
  { text: "Jahnreil J. Amarillento" },
  { text: "", kind: "spacer" },
  { text: "Frontend", kind: "section" },
  { text: "Mon Andre V. Perez" },
  { text: "", kind: "spacer" },
  { text: "Backend / API Engineering", kind: "section" },
  { text: "Jahnreil J. Amarillento" },
  { text: "", kind: "spacer" },
  { text: "Cybersecurity Content", kind: "section" },
  { text: "Jahnreil J. Amarillento & Mon Andre V. Perez" },
  { text: "", kind: "spacer" },
  { text: "Educational Design / Assessment Design", kind: "section" },
  { text: "Jahnreil J. Amarillento & Mon Andre V. Perez" },
  { text: "", kind: "spacer" },
  { text: "Narrative & Dialogue", kind: "section" },
  { text: "Jahnreil J. Amarillento" },
  { text: "", kind: "spacer" },
  { text: "Level Design", kind: "section" },
  { text: "Safe Browsing Practices: Jahnreil J. Amarillento" },
  { text: "Password Security: Jahnreil J. Amarillento & Mon Andre V. Perez" },
  { text: "Malware: Jahnreil J. Amarillento" },
  { text: "Social Engineering: Jahnreil J. Amarillento" },
  { text: "Incident Response: Jahnreil J. Amarillento & Mon Andre V. Perez" },
  { text: "", kind: "spacer" },
  { text: "UI / UX Design", kind: "section" },
  { text: "Mon Andre V. Perez" },
  { text: "", kind: "spacer" },
  { text: "Art / Visual Assets", kind: "section" },
  { text: "Shakuro" },
  { text: "", kind: "spacer" },
  { text: "Audio / Sound Design", kind: "section" },
  { text: "Jahnreil J. Amarillento" },
  { text: "", kind: "spacer" },
  { text: "QA / Playtesting", kind: "section" },
  { text: "Mon Andre V. Perez" },
  { text: "", kind: "spacer" },
  { text: "Deployment / DevOps", kind: "section" },
  { text: "Jahnreil J. Amarillento" },
  { text: "", kind: "spacer" },
  { text: "Research Adviser / Capstone Adviser", kind: "section" },
  { text: "Dr. Mary Jane C. Samonte" },
];

export class CreditsScene extends Phaser.Scene {
  private creditsContainer?: Phaser.GameObjects.Container;
  private skipText?: Phaser.GameObjects.Text;
  private scrollTween?: Phaser.Tweens.Tween;
  private advanceHandler?: () => void;
  private postCreditsStarted = false;

  constructor() {
    super("credits-scene");
  }

  create(): void {
    AudioManager.stopMusic();
    this.cameras.main.setBackgroundColor("#000000");

    const { width, height } = this.scale;

    this.add
      .rectangle(width / 2, height / 2, width, height, 0x000000, 1)
      .setScrollFactor(0);

    const totalHeight = this.createCreditsContent(width, height);
    this.createSkipText(width, height);
    this.bindSkipInput();

    const travelDistance = totalHeight + height + 100;
    const duration = Phaser.Math.Clamp(travelDistance * 18, 28000, 52000);

    this.scrollTween = this.tweens.add({
      targets: this.creditsContainer,
      y: -totalHeight - 60,
      duration,
      ease: "Linear",
      onComplete: () => this.startPostCredits(),
    });
  }

  private createCreditsContent(width: number, height: number): number {
    const maxTextWidth = Math.min(width - 40, 760);
    const content = this.add.container(width / 2, height + 36);
    let y = 0;

    CREDIT_LINES.forEach(line => {
      if (line.kind === "spacer") {
        y += 18;
        return;
      }

      const style = this.getLineStyle(line.kind ?? "body", maxTextWidth);
      const text = this.add
        .text(0, y, line.text, style)
        .setOrigin(0.5, 0)
        .setResolution(window.devicePixelRatio || 2);

      content.add(text);
      y += text.height + this.getLineGap(line.kind ?? "body");
    });

    this.creditsContainer = content;
    return y;
  }

  private getLineStyle(
    kind: Exclude<CreditLine["kind"], "spacer">,
    wordWrapWidth: number
  ): Phaser.Types.GameObjects.Text.TextStyle {
    const base = {
      fontFamily: "Verdana, Arial, Helvetica, sans-serif",
      align: "center",
      wordWrap: { width: wordWrapWidth },
    };

    if (kind === "title") {
      return {
        ...base,
        fontSize: "34px",
        color: "#ffffff",
      };
    }

    if (kind === "section") {
      return {
        ...base,
        fontSize: "18px",
        color: "#8cf7ff",
      };
    }

    return {
      ...base,
      fontSize: "16px",
      color: "#d8e0ea",
      lineSpacing: 4,
    };
  }

  private getLineGap(kind: CreditLine["kind"]): number {
    if (kind === "title") return 18;
    if (kind === "section") return 8;
    return 6;
  }

  private createSkipText(width: number, height: number): void {
    this.skipText = this.add
      .text(width - 22, height - 18, "Skip", {
        fontFamily: "Verdana, Arial, Helvetica, sans-serif",
        fontSize: "15px",
        color: "#7f8fa3",
      })
      .setOrigin(1, 1)
      .setScrollFactor(0)
      .setResolution(window.devicePixelRatio || 2)
      .setInteractive({ useHandCursor: true });
  }

  private bindSkipInput(): void {
    this.input.keyboard?.addCapture(Phaser.Input.Keyboard.KeyCodes.SPACE);
    this.advanceHandler = () => this.startPostCredits(true);

    this.input.keyboard?.on("keydown-SPACE", this.advanceHandler);
    this.input.on("pointerdown", this.advanceHandler);
    this.game.events.on(TOUCH_EVENTS.continue, this.advanceHandler);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => this.cleanupCreditsInput());
  }

  private cleanupCreditsInput(): void {
    if (!this.advanceHandler) return;

    this.input.keyboard?.off("keydown-SPACE", this.advanceHandler);
    this.input.off("pointerdown", this.advanceHandler);
    this.game.events.off(TOUCH_EVENTS.continue, this.advanceHandler);
    this.advanceHandler = undefined;
  }

  private startPostCredits(playSound = false): void {
    if (this.postCreditsStarted) return;

    this.postCreditsStarted = true;
    if (playSound) {
      AudioManager.playSfx(this, SFX.UI_CLICK);
    }
    this.scrollTween?.stop();
    this.cleanupCreditsInput();
    this.creditsContainer?.destroy(true);
    this.skipText?.destroy();

    const dialogueData = this.cache.json.get("general_dialogues");
    const scenario = dialogueData?.scenarios?.find(
      (item: any) => item.id === "ir_final_cutscene"
    );

    if (!scenario) {
      this.scene.start("main-menu-scene");
      return;
    }

    new DialogueRunner(this, scenario).start(() => {
      this.scene.start("main-menu-scene");
    });
  }
}
