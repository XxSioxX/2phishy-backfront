import { Scene } from "phaser";
import { DialogueRunner } from "../../helpers/DialogueRunner";

export class PrologueScene extends Scene {
  private nextScene!: string;
  private topic!: string;

  constructor() {
    super("prologue-scene");
  }

  init(data: { topic: string; nextScene: string }) {
    this.topic = data.topic;
    this.nextScene = data.nextScene;
  }

  create() {
    const data = this.cache.json.get("general_dialogues");

    const config = data.scenarios.find(
      (s: any) => s.id === "prologue_intro"
    );

    const runner = new DialogueRunner(this, config);

    runner.start(() => {
      // After prologue finishes → go to assessment
      this.scene.start("assessment-scene", {
        topic: this.topic,
        nextScene: this.nextScene
      });
    });
  }
}