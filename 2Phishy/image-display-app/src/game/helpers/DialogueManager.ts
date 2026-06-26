import {Scene} from "phaser";

export interface DialogueScenario {
  id: string;
  strategy?: string;
  description?: string;
  type?: 'branching' | 'linear' | 'cutscene';
  nodes: DialogueNode[];

  consequences?: {
    [key: string]: {
      message: string;
      explanation: string;
    };
  };

  nextScene?: string;
  skippable?: boolean;
}


export interface DialogueNode {
  id: string;
  npc?: string;
  text?: string;
  responses?: DialogueResponse[];
  end?: boolean;

  autoAdvance?: boolean;
  delay?: number;
}

export interface DialogueResponse {
  text: string;
  next?: string;
  outcome?: 'success' | 'fail';
  question_id?: string;
}

export class DialogueManager {
  private scenarios: DialogueScenario[] = [];

  constructor(data: any) {
    this.scenarios = data.scenarios;
  }

  getScenarioByStrategy(strategy: string): DialogueScenario {
    const pool = this.scenarios.filter(s => s.strategy === strategy);

    if (pool.length === 0) {
      throw new Error(`No dialogue scenarios for strategy: ${strategy}`);
    }

    return Phaser.Utils.Array.GetRandom(pool);
  }

  getScenarioByStrategyExcluding(
    strategy: string,
    excludedIds: Set<string>
  ): DialogueScenario {
    const pool = this.scenarios.filter(s => s.strategy === strategy);

    if (pool.length === 0) {
      throw new Error(`No dialogue scenarios for strategy: ${strategy}`);
    }

    const unusedPool = pool.filter(s => !excludedIds.has(s.id));
    return Phaser.Utils.Array.GetRandom(unusedPool.length > 0 ? unusedPool : pool);
  }

  getScenarioById(id: string): DialogueScenario {
    const scenario = this.scenarios.find(s => s.id === id);

    if (!scenario) {
      throw new Error(`Scenario not found: ${id}`);
    }

    return scenario;
  }
}

export class PrologueScene extends Scene {
  private dialogueManager!: DialogueManager;
  private scenario!: DialogueScenario;
  private currentNodeIndex = 0;
  private textObj!: Phaser.GameObjects.Text;

  constructor() {
    super("prologue-scene");
  }

  create() {
    const data = this.cache.json.get("dialogues");
    this.dialogueManager = new DialogueManager(data);

    this.scenario = this.dialogueManager.getScenarioById("prologue_intro");

    this.cameras.main.setBackgroundColor("#000");

    const { width, height } = this.scale;

    this.textObj = this.add.text(width / 2, height / 2, "", {
      fontSize: "28px",
      color: "#ffffff",
      align: "center",
      wordWrap: { width: width * 0.8 }
    }).setOrigin(0.5);

    this.showNode();

    this.input.keyboard.on("keydown-SPACE", () => {
      this.nextNode();
    });
  }

  private showNode() {
    const node = this.scenario.nodes[this.currentNodeIndex];
    this.textObj.setText(node.text ?? "");
  }

  private nextNode() {
    this.currentNodeIndex++;

    if (this.currentNodeIndex >= this.scenario.nodes.length) {
      this.finish();
      return;
    }

    this.showNode();
  }

  private finish() {
    if (this.scenario.nextScene) {
      this.scene.start(this.scenario.nextScene);
    }
  }
}
