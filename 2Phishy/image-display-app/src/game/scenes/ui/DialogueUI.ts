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
  private onComplete!: () => void;

  constructor(scene: Phaser.Scene) {
    this.scene = scene;
  }

  start(scenario: DialogueScenario, onComplete: () => void): void {
    this.scenario = scenario;
    this.onComplete = onComplete;

    this.container = this.scene.add.container(0, 0);
    this.container.setDepth(1000);

    this.showNode('start');
  }

  private showNode(nodeId: string): void {
    this.container.removeAll(true);

    this.currentNode = this.scenario.nodes.find(n => n.id === nodeId)!;

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

    const npcText = this.scene.add.text(
      textStartX,
      textStartY,
      this.currentNode.npc,
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

    // Wait for SPACE to show responses
    this.scene.input.keyboard.once('keydown-SPACE', () => {
      this.container.removeAll(true);
      this.showResponsesPanel();
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
      this.applyOutcome(res);
      this.finish();
      return;
    }

    if (res.next) {
      this.showNode(res.next);
    }
  }

  private applyOutcome(res: DialogueResponse): void {
    this.scene.events.emit('SE_OUTCOME', {
      outcome: res.outcome,
      question_id: res.question_id
    });
  }

  private finish(): void {
    this.container.destroy();
    this.onComplete();
  }
}
