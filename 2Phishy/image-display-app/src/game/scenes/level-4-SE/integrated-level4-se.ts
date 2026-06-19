import { BaseIntegratedLevel } from '../core/BaseIntegratedLevel';
import { LEVEL_CONFIGS } from '../core/LevelConfigurations';
import { DialogueManager } from '../../helpers/DialogueManager';
import { DialogueUI } from '../ui/DialogueUI';
import { SocialEngineer } from '../../classes/socialEngineer';
import { gameAPI } from '../../helpers/game-api';
export class SELevel extends BaseIntegratedLevel {
  private socialEngineers!: Phaser.Physics.Arcade.Group;

  constructor() {
    super(LEVEL_CONFIGS.SE);
  }
  async create(): Promise<void> {
    await super.create();

    if (!this.player) return;

    // Init systems
    this.socialEngineers = this.physics.add.group();
    this.physics.add.collider(this.socialEngineers, this.wallsLayer);
    this.physics.add.collider(this.socialEngineers, this.wallsLayer2);


    const dialogueData = this.cache.json.get('se-dialogues');

    if (!dialogueData || !Array.isArray(dialogueData.scenarios)) {
      console.error('SE dialogues NOT loaded correctly', dialogueData);
      return;
    } else {
      console.log(
        `SE dialogues loaded (${dialogueData.scenarios.length} scenarios)`
      );
    }

    this.dialogueManager = new DialogueManager(dialogueData);

    console.log('se-dialogues from cache:', dialogueData);
    console.log('scenarios:', dialogueData?.scenarios);
    console.log('number of scenarios:', dialogueData?.scenarios?.length);

    this.dialogueUI = new DialogueUI(this);

    // Spawn NPCs
    this.createNPCAnimations();
    this.initNPCLayer();

    // SINGLE event listener
    this.events.on('SE_DIALOGUE_START', ({ npc, strategy }) => {
      this.inAssessment = true;

      console.log('npc: ', npc, 'strategy: ', strategy);
      let scenario;

      try {
        scenario = this.dialogueManager.getScenarioByStrategy(strategy);
      } catch (error) {
        console.error('Unable to start SE dialogue', error);
        npc.finishInteraction();
        this.inAssessment = false;
        this.player.unlockMovement();
        return;
      }

      this.dialogueUI.start(scenario, async (result) => {
        npc.finishInteraction();
        this.inAssessment = false;

        await this.processOutcome(result);
      });


    });
  }

  private async processOutcome(result?: any): Promise<void> {
    if (!result) return;

    const isSuccess = result.outcome === 'success';

    try {
      gameAPI.setToken(this.userData.token);

      const response = await gameAPI.submitSocialEngineering({
        user_id: this.userData.userId,
        topic: this.config.topic,
        is_success: isSuccess,
      });

      console.log("SE grade updated:", response);

      const updatedGrade = response.data?.updated_grade;
      const trustLevel = response.data?.trust_level;

      console.log("Updated Grade:", updatedGrade);
      console.log("Trust Level:", trustLevel);

    } catch (err) {
      console.error(" Failed to submit SE result:", err);
    }

    if (result.question_id) {
      console.log("Trigger follow-up question:", result.question_id);
    }
  }





  private initNPCLayer(): void {
    const npcLayer = this.map.getObjectLayer('NPCPoints');

    if (!npcLayer) {
      throw new Error('NPCPoints layer not found');
    }

    npcLayer.objects.forEach(obj => {
      if (obj.name !== 'NPCPoint') return;

      const x = obj.x ?? 0;
      const y = obj.y ?? 0;

      const strategy =
        obj.properties?.find(p => p.name === 'strategy')?.value as string | undefined;

      this.spawnSocialEngineer(x, y, strategy);
    });
  }

  private createNPCAnimations(): void {
    if (!this.anims.exists('npc-walk')) {
      this.anims.create({
        key: 'npc-walk',
        frames: this.anims.generateFrameNumbers('tiles_spr', {
          start: 360,
          end: 368
        }),
        frameRate: 10,
        repeat: -1
      });
    }

    if (!this.anims.exists('npc-idle')) {
      this.anims.create({
        key: 'npc-idle',
        frames: [{ key: 'tiles_spr', frame: 360 }],
        frameRate: 1,
        repeat: -1
      });
    }

    if (!this.anims.exists('npc-jump')) {
      this.anims.create({
        key: 'npc-jump',
        frames: this.anims.generateFrameNumbers('tiles_spr', {
          start: 365,
          end: 368
        }),
        frameRate: 12,
        repeat: 0
      });
    }
  }


  private spawnSocialEngineer(
    x: number,
    y: number,
    strategy?: string
  ): void {
    const npc = new SocialEngineer(
      this,
      x,
      y,
      'tiles_spr',
      this.player,
      strategy ?? this.getRandomStrategies(),
      360
    );

    this.socialEngineers.add(npc);
  }

  private getRandomStrategies(): string {
    const strategies = ['phishing', 'baiting', 'impersonation', 'urgency'];
    return Phaser.Utils.Array.GetRandom(strategies);
  }

}
