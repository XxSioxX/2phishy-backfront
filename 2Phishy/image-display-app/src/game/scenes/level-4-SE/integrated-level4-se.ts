import { BaseIntegratedLevel } from '../core/BaseIntegratedLevel';
import { LEVEL_CONFIGS } from '../core/LevelConfigurations';
import { DialogueManager } from '../../helpers/DialogueManager';
import { DialogueUI } from '../ui/DialogueUI';
import { SocialEngineer } from '../../classes/socialEngineer';
import { gameAPI } from '../../helpers/game-api';
import { AudioManager, SFX } from '../../audio';
export class SELevel extends BaseIntegratedLevel {
  private socialEngineers!: Phaser.Physics.Arcade.Group;
  private suspicion = 0;
  private suspicionContainer?: Phaser.GameObjects.Container;
  private suspicionFill?: Phaser.GameObjects.Rectangle;
  private suspicionText?: Phaser.GameObjects.Text;
  private pressureContainer?: Phaser.GameObjects.Container;
  private pressureTimer?: Phaser.Time.TimerEvent;
  private usedScenarioIds = new Set<string>();

  private readonly maxSuspicion = 100;
  private readonly suspicionAggressionThreshold = 55;
  private readonly nearbyAggressionRadius = 270;
  private readonly aggressionDurationMs = 9000;

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
    this.createSuspicionMeter();

    if (this.backendLevelCompleted || this.questions.length === 0) {
      console.log('SE level already complete or has no remaining questions; skipping NPC respawn.');
      return;
    }

    // Spawn NPCs
    this.createNPCAnimations();
    this.initNPCLayer();
    this.spawnDecoyNPCs();

    // SINGLE event listener
    this.events.on('SE_DIALOGUE_START', ({ npc, strategy }) => {
      if (this.inAssessment) {
        npc.deferInteraction?.();
        return;
      }

      this.inAssessment = true;
      AudioManager.playSfx(this, SFX.NPC_DIALOGUE_START);
      this.startPressureMoment(npc, strategy);

      console.log('npc: ', npc, 'strategy: ', strategy);
      let scenario;

      try {
        scenario = this.dialogueManager.getScenarioByStrategyExcluding(
          strategy,
          this.usedScenarioIds
        );
        this.usedScenarioIds.add(scenario.id);
      } catch (error) {
        console.error('Unable to start SE dialogue', error);
        this.stopPressureMoment();
        npc.finishInteraction();
        this.inAssessment = false;
        this.player.unlockMovement();
        return;
      }

      this.dialogueUI.start(scenario, async (result) => {
        this.stopPressureMoment();
        npc.finishInteraction();
        this.inAssessment = false;

        await this.processOutcome(result, npc);
      });


    });

    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.pressureTimer?.destroy();
      this.suspicionContainer?.destroy(true);
      this.pressureContainer?.destroy(true);
    });
  }

  update(): void {
    super.update();
    this.layoutSuspicionMeter();
  }

  private async processOutcome(result?: any, npc?: SocialEngineer): Promise<void> {
    if (!result) return;

    const isSuccess = result.outcome === 'success';
    this.recordGameplayMetric(
      isSuccess ? 'dialogue_successes' : 'dialogue_failures'
    );

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

    if (isSuccess) {
      AudioManager.playSfx(this, SFX.DIALOGUE_SUCCESS);
      this.adjustSuspicion(-8);
      return;
    }

    AudioManager.playSfx(this, SFX.DIALOGUE_FAIL);
    this.adjustSuspicion(22);

    if (this.suspicion >= this.suspicionAggressionThreshold) {
      this.agitateNearbyNPCs(npc);
    }
  }

  public isInteractionBusy(): boolean {
    return this.inAssessment;
  }

  protected onQuestionAnswered(result: any): void {
    if (result?.is_correct) {
      this.adjustSuspicion(-5);
      return;
    }

    this.adjustSuspicion(15);
    if (this.suspicion >= this.suspicionAggressionThreshold) {
      this.agitateNearbyNPCs();
    }
  }

  private createSuspicionMeter(): void {
    const bg = this.add.rectangle(0, 0, 188, 34, 0x081018, 0.86)
      .setStrokeStyle(2, 0x7de3ff, 0.72);
    this.suspicionFill = this.add.rectangle(-82, 8, 1, 8, 0x67ef8d, 1)
      .setOrigin(0, 0.5);
    this.suspicionText = this.add.text(0, -7, 'Suspicion 0%', {
      fontSize: '13px',
      color: '#ffffff',
      fontStyle: 'bold',
      align: 'center',
    }).setOrigin(0.5);

    this.suspicionContainer = this.add.container(0, 0, [
      bg,
      this.suspicionFill,
      this.suspicionText,
    ])
      .setScrollFactor(0)
      .setDepth(10004)
      .setScale(1 / this.cameras.main.zoom);

    this.updateSuspicionMeter();
    this.layoutSuspicionMeter();
  }

  private layoutSuspicionMeter(): void {
    if (!this.suspicionContainer) return;

    this.suspicionContainer
      .setPosition(this.cameras.main.width - 124, 34)
      .setScale(1 / this.cameras.main.zoom);
  }

  private adjustSuspicion(amount: number): void {
    const previous = this.suspicion;
    this.suspicion = Phaser.Math.Clamp(
      this.suspicion + amount,
      0,
      this.maxSuspicion
    );
    if (amount > 0) {
      AudioManager.playSfx(this, SFX.SUSPICION_INCREASE);
    } else if (amount < 0) {
      AudioManager.playSfx(this, SFX.SUSPICION_DECREASE);
    }
    if (
      previous < this.suspicionAggressionThreshold &&
      this.suspicion >= this.suspicionAggressionThreshold
    ) {
      AudioManager.playSfx(this, SFX.SUSPICION_THRESHOLD);
    }
    this.updateSuspicionMeter();
  }

  private updateSuspicionMeter(): void {
    if (!this.suspicionFill || !this.suspicionText) return;

    const ratio = this.suspicion / this.maxSuspicion;
    const color =
      this.suspicion >= this.suspicionAggressionThreshold
        ? 0xff7676
        : this.suspicion >= 28
          ? 0xffcc66
          : 0x67ef8d;

    this.suspicionFill
      .setFillStyle(color, 1)
      .setSize(Math.max(1, ratio * 164), 8);
    this.suspicionText
      .setText(`Suspicion ${Math.round(this.suspicion)}%`)
      .setColor(
        this.suspicion >= this.suspicionAggressionThreshold
          ? '#ffb4b4'
          : '#ffffff'
      );
  }

  private startPressureMoment(npc: SocialEngineer, strategy: string): void {
    const pressureNpc =
      strategy === 'urgency' ||
      (typeof npc.isDecoy === 'function' && npc.isDecoy());

    if (!pressureNpc) return;

    this.stopPressureMoment();
    AudioManager.playSfx(this, SFX.PRESSURE_START);

    const cam = this.cameras.main;
    const bg = this.add.rectangle(0, 0, 230, 28, 0x140b12, 0.88)
      .setStrokeStyle(2, 0xffcc66, 0.78);
    const fill = this.add.rectangle(-104, 8, 208, 6, 0xffcc66, 1)
      .setOrigin(0, 0.5);
    const label = this.add.text(0, -5, 'Pressure tactic active', {
      fontSize: '12px',
      color: '#ffe5a3',
      fontStyle: 'bold',
    }).setOrigin(0.5);

    this.pressureContainer = this.add.container(
      cam.width / 2,
      88,
      [bg, fill, label]
    )
      .setScrollFactor(0)
      .setDepth(10005)
      .setScale(1 / cam.zoom);

    this.tweens.add({
      targets: fill,
      width: 1,
      duration: 8000,
      ease: 'Linear',
    });

    this.pressureTimer = this.time.delayedCall(8000, () => {
      AudioManager.playSfx(this, SFX.PRESSURE_TIMEOUT);
      this.adjustSuspicion(12);
      this.agitateNearbyNPCs(npc);
      this.stopPressureMoment();
    });
  }

  private stopPressureMoment(): void {
    this.pressureTimer?.destroy();
    this.pressureTimer = undefined;
    this.pressureContainer?.destroy(true);
    this.pressureContainer = undefined;
  }

  private agitateNearbyNPCs(sourceNpc?: SocialEngineer): void {
    if (!this.socialEngineers || !this.player) return;

    this.socialEngineers.children.each(child => {
      const npc = child as SocialEngineer;
      if (!npc.active || npc === sourceNpc) return true;

      const distance = Phaser.Math.Distance.Between(
        npc.x,
        npc.y,
        this.player.x,
        this.player.y
      );

      if (distance <= this.nearbyAggressionRadius) {
        AudioManager.playSfx(this, SFX.NPC_AGGRESSIVE);
        npc.setAggressive(this.aggressionDurationMs);
      }

      return true;
    });
  }

  protected initKnowledge(): void {
    const allPoints = this.map.filterObjects(
      'KnowledgePoints',
      obj => obj.name === 'KnowledgePoint'
    ) ?? [];
    const selectedPoints = this.selectSpreadOutPoints(
      allPoints,
      this.knowledgeList.length
    );

    this.knowledgePoints = selectedPoints.map((pt, index) => {
      const sprite = this.physics.add
        .sprite(pt.x ?? 0, pt.y ?? 0, 'tiles_spr', 627)
        .setScale(1.5);

      sprite.setImmovable(true);
      sprite.body.allowGravity = false;

      const knowledge = this.knowledgeList[index];
      const point = [sprite] as any;
      point.isOpen = false;
      point.isAnimating = false;
      point.wasTouching = false;
      point.knowledge = {
        knowledge_id: knowledge.knowledge_id,
        question_id: knowledge.question_id,
        knowledge_content: knowledge.knowledge_content,
        subtopic: knowledge.subtopic,
        subtopic_key: knowledge.subtopic_key,
      };

      return point;
    });
  }

  private selectSpreadOutPoints(points: any[], count: number): any[] {
    if (count <= 0) return [];

    const ordered = [...points].sort((a, b) => {
      const ay = Number(a.y ?? 0);
      const by = Number(b.y ?? 0);
      if (ay !== by) return ay - by;

      return Number(a.x ?? 0) - Number(b.x ?? 0);
    });

    if (count >= ordered.length) return ordered;
    if (count === 1) return [ordered[Math.floor(ordered.length / 2)]];

    const selected: any[] = [];
    const used = new Set<number>();
    const maxIndex = ordered.length - 1;

    for (let i = 0; i < count; i += 1) {
      let index = Math.round((i * maxIndex) / (count - 1));

      while (used.has(index) && index < maxIndex) index += 1;
      while (used.has(index) && index > 0) index -= 1;

      used.add(index);
      selected.push(ordered[index]);
    }

    return selected;
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

  private spawnDecoyNPCs(): void {
    const npcLayer = this.map.getObjectLayer('NPCPoints');
    const sourcePoints = npcLayer?.objects
      .filter(obj => obj.name === 'NPCPoint') ?? [];

    if (sourcePoints.length === 0) return;

    const decoyCount = Math.min(2, sourcePoints.length);
    const selected = Phaser.Utils.Array.Shuffle([...sourcePoints]).slice(0, decoyCount);

    selected.forEach((point, index) => {
      const angle = Phaser.Math.DegToRad(50 + index * 135);
      const distance = 82;
      const x = Phaser.Math.Clamp(
        Number(point.x ?? this.player.x) + Math.cos(angle) * distance,
        32,
        this.map.widthInPixels - 32
      );
      const y = Phaser.Math.Clamp(
        Number(point.y ?? this.player.y) + Math.sin(angle) * distance,
        32,
        this.map.heightInPixels - 32
      );
      const npc = this.spawnSocialEngineer(
        x,
        y,
        index % 2 === 0 ? 'urgency' : 'phishing'
      );

      npc.setDecoy(true);
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
  ): SocialEngineer {
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
    return npc;
  }

  private getRandomStrategies(): string {
    const strategies = ['phishing', 'baiting', 'impersonation', 'urgency'];
    return Phaser.Utils.Array.GetRandom(strategies);
  }

}
