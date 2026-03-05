import {
  DialogueScenario,
  DialogueNode,
  DialogueResponse
} from '../../helpers/DialogueManager';

export class DialogueUI {
  private scene: Phaser.Scene;
  private container!: Phaser.GameObjects.Container;
  private currentNode!: DialogueNode;
  private scenario!: DialogueScenario;
  private onComplete!: (result?: any) => void;

  constructor(scene: Phaser.Scene) {
    this.scene = scene;
  }

  start(scenario: DialogueScenario, onComplete: (result?: any) => void): void {
    this.scenario = scenario;
    this.onComplete = onComplete;

    this.container = this.scene.add.container(0, 0);
    this.container.setDepth(1000);

    const startNode =
      this.scenario.nodes.find(n => n.id === 'start') ??
      this.scenario.nodes[0];

    // wait 1 frame so camera + UI stabilizes
    this.scene.time.delayedCall(0, () => {
      this.showNode(startNode.id);
    });
  }

  private showNode(nodeId: string): void {
    this.container.removeAll(true);

    const node = this.scenario.nodes.find(n => n.id === nodeId);
    if (!node) {
      console.error(`Node ${nodeId} not found`);
      return;
    }
    this.currentNode = node;

    this.showMessagePanel();
  }

  // =============================
  // PHASE 1 – MESSAGE PANEL
  // =============================
  private showMessagePanel(): void {
    const cam = this.scene.cameras.main;

    const panelWidth = cam.worldView.width - 40;
    const panelHeight = cam.worldView.height * 0.35;

    const panelX = cam.worldView.left + 20 + panelWidth / 2;
    const panelY = cam.worldView.bottom - panelHeight / 2 - 10;

    const padding = 20;

    const panel = this.scene.add
      .rectangle(panelX, panelY, panelWidth, panelHeight, 0x000000, 0.9)
      .setStrokeStyle(2, 0xffffff)
      .setOrigin(0.5);

    const textStartX = panelX - panelWidth / 2 + padding;
    const textStartY = panelY - panelHeight / 2 + padding;

    const dialogueText = this.currentNode.npc ?? this.currentNode.text ?? "";

    const npcText = this.scene.add.text(
      textStartX,
      textStartY,
      dialogueText,
      {
        fontSize: '16px',
        color: '#ffffff',
        wordWrap: { width: panelWidth - padding * 2 },
        align: 'left'
      }
    ).setOrigin(0, 0);

    this.container.add([panel, npcText]);

    // If node ends here
    if (this.currentNode.end) {
      this.scene.input.keyboard.once('keydown-SPACE', () => {
        this.finish();
      });
      return;
    }

    // "Press SPACE" indicator
    const continueText = this.scene.add.text(
      panelX + panelWidth / 2 - 120,
      panelY + panelHeight / 2 - 25,
      '▼ Press SPACE',
      {
        fontSize: '14px',
        color: '#aaaaaa'
      }
    ).setOrigin(0, 0);

    this.container.add(continueText);

    // Wait for SPACE to continue dialogue
    this.scene.input.keyboard.once('keydown-SPACE', () => {

      // Branching dialogue (SE level)
      if (this.currentNode.responses && this.currentNode.responses.length > 0) {
        this.container.removeAll(true);
        this.showResponsesPanel();
        return;
      }

      // Linear dialogue (assessment / monologue)
      const nextNode = this.scenario.nodes.find(
        n => Number(n.id) === Number(this.currentNode.id) + 1
      );

      if (nextNode) {
        this.showNode(nextNode.id);
      } else {
        this.finish();
      }

    });
  }

  // =============================
  // PHASE 2 – RESPONSE PANEL
  // =============================
  private showResponsesPanel(): void {
    const cam = this.scene.cameras.main;

    const panelWidth = cam.worldView.width - 40;
    const panelHeight = cam.worldView.height * 0.30;

    const panelX = cam.worldView.left + 20 + panelWidth / 2;
    const panelY = cam.worldView.bottom - panelHeight / 2 - 10;

    const padding = 20;

    const panel = this.scene.add
      .rectangle(panelX, panelY, panelWidth, panelHeight, 0x000000, 0.95)
      .setStrokeStyle(2, 0xffffff)
      .setOrigin(0.5);

    this.container.add(panel);

    const textStartX = panelX - panelWidth / 2 + padding;
    let currentY = panelY - panelHeight / 2 + padding;

    this.currentNode.responses?.forEach((res) => {

      const responseText = this.scene.add.text(
        textStartX,
        currentY,
        '> ' + res.text,
        {
          fontSize: '16px',
          color: '#00ffcc',
          wordWrap: { width: panelWidth - padding * 2 },
          align: 'left'
        }
      )
      .setOrigin(0, 0)
      .setInteractive({ useHandCursor: true })
      .on('pointerdown', () => this.handleResponse(res))
      .on('pointerover', () => responseText.setColor('#ffffff'))
      .on('pointerout', () => responseText.setColor('#00ffcc'));

      this.container.add(responseText);

      currentY += responseText.height + 15;
    });
  }


  // =============================
  // BRANCHING LOGIC
  // =============================
  private handleResponse(res: DialogueResponse): void {
    if (res.outcome) {
      this.showConsequence(res);
      const result = {
        outcome: res.outcome,
        question_id: res.question_id
      };

      return;
    }

    if (res.next) {
      this.showNode(res.next);
    }
  }

  private finish(result?: any): void {
    this.container.destroy();
    this.onComplete(result);
  }

  // =============================
  // PHASE 3 – CONSEQUENCE PANEL
  // =============================
  private showConsequence(res: DialogueResponse): void {
    this.container.removeAll(true);

    const cam = this.scene.cameras.main;

    const panelWidth = cam.worldView.width - 40;
    const panelHeight = cam.worldView.height * 0.35;

    const panelX = cam.worldView.left + 20 + panelWidth / 2;
    const panelY = cam.worldView.bottom - panelHeight / 2 - 10;

    const padding = 20;

    const isSuccess = res.outcome === 'success';

    const panel = this.scene.add
      .rectangle(panelX, panelY, panelWidth, panelHeight, 0x000000, 0.95)
      .setStrokeStyle(3, isSuccess ? 0x00cc66 : 0xcc3333)
      .setOrigin(0.5);

    const consequence = this.scenario.consequences?.[res.outcome];

    const message = consequence?.message ?? 'Result recorded.';
    const explanation = consequence?.explanation ?? '';

    const textStartX = panelX - panelWidth / 2 + padding;
    let currentY = panelY - panelHeight / 2 + padding;

    const messageText = this.scene.add.text(
      textStartX,
      currentY,
      message,
      {
        fontSize: '18px',
        color: '#ffffff',
        wordWrap: { width: panelWidth - padding * 2 }
      }
    ).setOrigin(0, 0);

    currentY += messageText.height + 15;

    const explanationText = this.scene.add.text(
      textStartX,
      currentY,
      explanation,
      {
        fontSize: '14px',
        color: '#cccccc',
        wordWrap: { width: panelWidth - padding * 2 }
      }
    ).setOrigin(0, 0);

    this.container.add([panel, messageText, explanationText]);

    const continueText = this.scene.add.text(
      panelX + panelWidth / 2 - 140,
      panelY + panelHeight / 2 - 25,
      '▼ Press SPACE',
      {
        fontSize: '14px',
        color: '#aaaaaa'
      }
    ).setOrigin(0, 0);

    this.container.add(continueText);

    this.scene.input.keyboard.once('keydown-SPACE', () => {
      const result = {
        outcome: res.outcome,
        question_id: res.question_id,
        strategy: this.scenario.strategy
      };

      this.finish(result);
    });
  }

}
