export interface DialogueScenario {
  id: string;
  strategy: string;
  description?: string;
  nodes: DialogueNode[];
  consequences: {
    [key: string]: {
      message: string;
      explanation: string;
    };
  };
}


export interface DialogueNode {
  id: string;
  npc: string;
  responses?: DialogueResponse[];
  end?: boolean;
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

  getScenario(strategy: string): DialogueScenario {
    const pool = this.scenarios.filter(s => s.strategy === strategy);

    if (pool.length === 0) {
      throw new Error(`No dialogue scenarios for strategy: ${strategy}`);
    }

    return Phaser.Utils.Array.GetRandom(pool);
  }

}
