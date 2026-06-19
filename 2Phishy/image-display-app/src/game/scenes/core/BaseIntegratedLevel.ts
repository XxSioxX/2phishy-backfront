
import {Tilemaps } from 'phaser';
import {LevelConfig} from "./LevelConfig";
import AssessmentPopup from "../../helpers/assessment-popup";
import {AssessmentResult, gameAPI} from "../../helpers/game-api";
import {Player} from "../../classes/player";
import {gameObjectsToObjectPoints} from "../../helpers/gameobject-to-object-point";
import { DialogueManager } from "../../helpers/DialogueManager";
import { DialogueUI } from "../ui/DialogueUI";


export abstract class BaseIntegratedLevel extends Phaser.Scene {
    protected player!: Player;
    protected questionPoints!: Phaser.GameObjects.Sprite[][];
    protected totalquestions = 0;

    protected knowledgeList: any[] = [];
    protected knowledgePoints: any[] = [];

    protected popup!: AssessmentPopup;
    protected map!: Tilemaps.Tilemap;
    protected tileset!: Tilemaps.Tileset;
    protected wallsLayer!: Tilemaps.TilemapLayer;
    protected wallsLayer2!: Tilemaps.TilemapLayer;
    protected platform?: Tilemaps.TilemapLayer;

    protected questions: any[] = [];
    protected assessmentResults: AssessmentResult[] = [];
    protected backendQuestionMapTotal = 0;
    protected backendLevelCompleted = false;

    protected inAssessment = false;
    protected assessmentCompleted = false;
    protected userData = (window as any).userData;

    protected readonly config: LevelConfig;

    protected dialogueManager!: DialogueManager;
    protected dialogueUI!: DialogueUI;

    private exitMessageShown = false;
    private exitPlatforms: Phaser.GameObjects.Sprite[] = [];

    private exitActivated = false;
    private exitTransitioning = false;
    private completeWhenReady = false;
    protected currentZone = 0;

    constructor(config: LevelConfig) {
        super(config.sceneKey);
        this.config = config;
    }

    async create(): Promise<void> {
        console.log(`${this.scene.key} - create()`);
        this.initMap();
        this.popup = new AssessmentPopup(this);
        await this.createQuestionMap();

        if (await this.redirectToInitialAssessmentIfNeeded()) return;

        this.initAssessment();
        this.spawnPlayerOnSpawnPoint(this.currentZone);
        this.initNextLevelPlatforms();
        this.initCamera();
        this.setupAssessmentCollision();
        await this.setKnowledgeList();
        this.createKnowledgeAnimations();
        this.initKnowledge();
        this.setupKnowledgeCollision();
        await this.introDialogue();
        this.initUI();

        if (this.completeWhenReady || this.questions.length === 0) {
          this.game.events.emit(
            'questions:update',
            this.totalquestions,
            this.assessmentResults.length
          );
          await this.handleNoPlayableQuestionsReady();
        }
    }

    async setKnowledgeList(): Promise<void> {
        try {
          const knowledgeResponse = await gameAPI.getUserKnowledgeList({
            userid: this.userData.userId,
            topic: this.config.topic,
          });

          this.knowledgeList = Array.isArray(knowledgeResponse.data?.knowledge)
            ? knowledgeResponse.data.knowledge
            : [];
        } catch (error) {
          console.error(
            `Failed to load knowledge list for ${this.config.topic}`,
            error
          );
          this.knowledgeList = [];
        }
    }

    async introDialogue(): Promise<void> {
        let hasSeenIntro = false;

        try {
          const progressResponse = await gameAPI.getUserProgress(this.userData.userId);
          const topicProgress =
            progressResponse.data?.progress?.progress?.[this.config.topic];
          hasSeenIntro = topicProgress?.intro_seen === true;
        } catch (error) {
          console.error(
            `Failed to load intro progress for ${this.config.topic}`,
            error
          );
        }

        if (!hasSeenIntro) {
          const showIntroAndSave = async () => {
            this.showLevelIntroBanner(
              this.config.intro.title,
              this.config.intro.description
            );

            try {
              await gameAPI.markIntroSeen({
                userid: this.userData.userId,
                topic: this.config.topic
              });
            } catch (error) {
              console.error(
                `Failed to save intro progress for ${this.config.topic}`,
                error
              );
            }
          };

          if (this.config.intro.dialogueId) {
            this.startIntroDialogue(
              this.config.intro.dialogueId,
              showIntroAndSave
            );
          } else {
            await showIntroAndSave();
          }
        } else {

          this.showLevelIntroBanner(
            this.config.intro.title,
            this.config.intro.description
          );

        }
    }

    update(): void {

        if (!this.player) return;

        if (!this.inAssessment) {
            this.player.update();
        } else {
            this.player.bodyRef().setVelocity(0);
        }

        this.knowledgePoints.forEach((point: any) => {
            const sprite = point[0];

            const touching = this.physics.overlap(this.player, sprite);

            if (point.isOpen && !point.isAnimating && !touching && point.wasTouching) {
                point.isAnimating = true;

                sprite.play('knowledge_close');

                sprite.once('animationcomplete-knowledge_close', () => {
                    sprite.setFrame(627);
                    point.isOpen = false;
                    point.isAnimating = false;
                });
            }

            point.wasTouching = touching;
        });
    }

    private initUI(): void {
        this.scene.launch('ui-scene', {
          player: this.player,
          showControls: this.sys.game.device.input.touch
        });
        this.scene.bringToTop('ui-scene');


        const uiScene = this.scene.get('ui-scene') as Phaser.Scene;

        uiScene.events.once('create', () => {
            const total = this.totalquestions;
            const answered = this.assessmentResults.length;

            this.game.events.emit('questions:init', total, answered);
        });
        this.game.events.on('blur', () => {
          this.player.forceStopAllInput();
        });
        this.input.on('gameout', () => {
          this.player.forceStopAllInput();
        });
    }

    private initMap(): void {
        this.map = this.make.tilemap({ key: this.config.mapKey });
        this.tileset = this.map.addTilesetImage(
          this.config.tilesetName,
          'tiles'
        )!;

        this.map.createLayer('Floor', this.tileset, 0, 0)!;
        this.wallsLayer = this.map.createLayer('Walls', this.tileset, 0, 0)!;
        this.wallsLayer2 = this.map.createLayer('Walls-second', this.tileset, 0, 0)!;
        if (this.map.layers.some(layer => layer.name === 'Platform')) {
          this.platform = this.map.createLayer('Platform', this.tileset, 0, 0) ?? undefined;
        }
        this.wallsLayer.setCollisionByProperty({ collides: true });
        this.wallsLayer2.setCollisionByProperty({ collides: true });

        this.physics.world.setBounds(0, 0, this.map.widthInPixels, this.map.heightInPixels);
        console.log("Tile Layers:", this.map.layers.map(l => l.name));
        console.log("Object Layers:", this.map.objects.map(o => o.name));
    }

    protected spawnPlayerOnSpawnPoint(zone?: number): void {

        const { x: spawnX, y: spawnY } =
            this.getSpawnPoint(zone);

        const platform = this.add
            .sprite(spawnX, spawnY, 'tiles_spr', 386)
            .setScale(1.5)
            .setDepth(0);

        this.tweens.add({
            targets: platform,
            alpha: 0.6,
            duration: 150,
            yoyo: true,
            repeat: 3
        });

        // create player
        this.player = new Player(this, spawnX, spawnY - 4);

        this.player.bodyRef().setCollideWorldBounds(true);
        this.physics.add.collider(this.player, this.wallsLayer);
        this.physics.add.collider(this.player, this.wallsLayer2);

        // lock movement during spawn
        this.player.lockMovement();

        // start invisible
        this.player.setAlpha(0);
        this.player.setScale(0.8);

        // ✨ particle poof
        const particles = this.add.particles(spawnX, spawnY - 8, 'tiles_spr', {
            frame: 629,
            speed: { min: -40, max: 40 },
            angle: { min: 0, max: 360 },
            scale: { start: 0.4, end: 0 },
            alpha: { start: 1, end: 0 },
            lifespan: 500,
            quantity: 20,
            gravityY: 0
        });

        // stop emitter after burst
        this.time.delayedCall(200, () => {
            particles.stop();

            this.time.delayedCall(500, () => {
                particles.destroy();
            });
        });
        // ✨ player materialize animation
        this.tweens.add({
            targets: this.player,
            y: this.player.y - 10,
            alpha: 1,
            scale: 1,
            duration: 500,
            ease: 'Back.Out',
            onComplete: () => {
                this.player.unlockMovement();
            }
        });

        console.log("Spawn coords:", spawnX, spawnY);
        console.log("Player created:", this.player);

    }

    protected getSpawnPoint(zone?: number) {

        const spawnLayer = this.map.getObjectLayer('SpawnPoint');
        const spawnObjects = spawnLayer?.objects || [];

        let spawn;

        if (zone !== undefined) {
            spawn = spawnObjects.find(
                obj => this.getObjectNumberProperty(obj, 'zone_number') === zone
            );
        }

        if (!spawn) {
            spawn = spawnObjects[0];
        }

        return {
            x: spawn?.x ?? 100,
            y: spawn?.y ?? 100
        };
    }

    private initNextLevelPlatforms(): void {
      const exitObjects = this.map.filterObjects(
        'NextLevelPlatform',
        obj => obj.name === 'NextLevel'
      );

      exitObjects.forEach(obj => {
        const platform = this.physics.add
          .sprite(obj.x, obj.y, 'tiles_spr', 388)
          .setScale(1.5)
          .setVisible(false);

        platform.setImmovable(true);
        platform.body.allowGravity = false;
        platform.body.enable = false;

        this.exitPlatforms.push(platform);

        this.physics.add.overlap(this.player, platform, () => {
          if (!this.assessmentCompleted || this.exitTransitioning) return;

          void this.startNextLevel();
        });
      });
    }

    private async startNextLevel(): Promise<void> {
      this.exitTransitioning = true;
      this.player.lockMovement();
      this.scene.stop('ui-scene');

      const nextLevel = this.config.next;
      const directStart = () => {
        this.scene.start(nextLevel.sceneKey, {
          topic: nextLevel.topic
        });
      };

      if (nextLevel.sceneKey === this.scene.key) {
        directStart();
        return;
      }

      const needsAssessment = await this.needsInitialAssessment(
        nextLevel.topic
      );

      if (!needsAssessment) {
        directStart();
        return;
      }

      this.scene.start('assessment-scene', {
        topic: nextLevel.topic,
        nextScene: nextLevel.sceneKey
      });
    }

    private async needsInitialAssessment(topic: string): Promise<boolean> {
      if (!this.userData?.token || !this.userData?.userId) {
        return true;
      }

      try {
        gameAPI.setToken(this.userData.token);
        const response = await gameAPI.getUserProgress(this.userData.userId);
        const assessment =
          response.data?.initial_assessments?.assessments?.[topic];

        return assessment?.assessment_completed !== true;
      } catch (error) {
        console.error('Failed to check next topic assessment', error);
        return true;
      }
    }

    private async redirectToInitialAssessmentIfNeeded(): Promise<boolean> {
      if (this.questions.length > 0) return false;

      const needsAssessment = await this.needsInitialAssessment(
        this.config.topic
      );

      if (!needsAssessment) {
        const reason = this.backendLevelCompleted
          ? 'level is already marked complete'
          : this.backendQuestionMapTotal > 0
            ? 'all mapped questions are already resolved or filtered out'
            : 'no valid question map could be generated';

        console.warn(
          `No playable questions for ${this.config.topic} (${reason}); allowing level flow to continue.`
        );
        this.completeWhenReady = true;
        return false;
      }

      console.warn(
        `Missing initial assessment for ${this.config.topic}; opening assessment scene.`
      );

      this.scene.start('assessment-scene', {
        topic: this.config.topic,
        nextScene: this.scene.key
      });

      return true;
    }

    private showDebugWalls(): void {
        const debugGraphics = this.add.graphics().setAlpha(0.7);
        this.wallsLayer.renderDebug(debugGraphics, {
          tileColor: null,
          collidingTileColor: new Phaser.Display.Color(243, 234, 48, 255),
        });
        this.wallsLayer2.renderDebug(debugGraphics, {
          tileColor: null,
          collidingTileColor: new Phaser.Display.Color(243, 234, 48, 255),
        });
      }
    private initCamera(): void {

        if (!this.player) {
            console.error("Player not initialized before camera setup");
            return;
        }

        this.cameras.main.startFollow(this.player, true, 0.09, 0.09);
        this.cameras.main.setZoom(2);
        this.cameras.main.setBounds(
            0,
            0,
            this.map.widthInPixels,
            this.map.heightInPixels
        );
    }


    private async createQuestionMap(): Promise<void> {
        const response = await gameAPI.getUserQuestionMap({
          userid: this.userData.userId,
          topic: this.config.topic,

        });

        this.setQuestionMapMetadata(response?.data);

        if (response?.data?.questions?.length > 0) {
          const validQuestions = this.filterQuestionsForTopic(
            response.data.questions
          );

          if (validQuestions.length === response.data.questions.length) {
            console.log("Using existing backend question_map");
            this.questions = validQuestions;
            this.totalquestions = validQuestions.length;
            return;
          }

          console.warn(
            `Ignoring ${response.data.questions.length - validQuestions.length} question(s) that do not belong to ${this.config.topic}.`
          );

          if (validQuestions.length > 0) {
            this.questions = validQuestions;
            this.totalquestions = validQuestions.length;
            return;
          }
        }


        console.log("No valid question_map found, generating...");
        const created = await gameAPI.createUserQuestionMap({
          userid: this.userData.userId,
          topic: this.config.topic,

        });

        this.setQuestionMapMetadata(created?.data);

        this.questions = this.filterQuestionsForTopic(
          created.data.questions ?? []
        );
        this.totalquestions = this.questions.length;
    }

    private setQuestionMapMetadata(data: any): void {
        this.backendQuestionMapTotal = this.toFiniteNumber(
          data?.questionMapTotal ??
          data?.allQuestionsTotal ??
          data?.questionsTotal ??
          data?.questions?.length ??
          0
        );
        this.backendLevelCompleted = data?.levelCompleted === true;
    }

    private toFiniteNumber(value: unknown): number {
        const parsed = Number(value);
        return Number.isFinite(parsed) ? parsed : 0;
    }

    private filterQuestionsForTopic(questions: any[]): any[] {
        return questions.filter(question => {
          if (!this.isPlayableQuestion(question)) {
            console.warn(
              `Ignoring malformed question for ${this.config.topic}:`,
              question
            );
            return false;
          }

          const subcat = this.inferSubcat(String(question.question_id ?? ''));

          if (subcat !== 'UNKNOWN') {
            return true;
          }

          console.warn(
            `Question ${question.question_id} does not match topic ${this.config.topic}.`
          );

          return false;
        });
    }

    private isPlayableQuestion(question: any): boolean {
        return Boolean(
          question &&
          typeof question.question_id === 'string' &&
          question.question_id.trim() &&
          typeof question.question === 'string' &&
          question.question.trim() &&
          Array.isArray(question.choices) &&
          question.choices.length > 0 &&
          typeof question.answer === 'string' &&
          question.answer.trim()
        );
    }

    protected initAssessment(): void {
      const allPoints = gameObjectsToObjectPoints(
        this.map.filterObjects('QuestionPoints', obj => obj.name === 'QuestionPoint') || []
      );

      Phaser.Utils.Array.Shuffle(allPoints);

      const selectedPoints = allPoints.slice(0, this.questions.length);

      if (selectedPoints.length < this.questions.length) {
        console.warn(
          `${this.config.topic} has ${this.questions.length} playable questions but only ${selectedPoints.length} question points. Trimming to placed points.`
        );
        this.questions = this.questions.slice(0, selectedPoints.length);
        this.totalquestions = this.questions.length;
      }

      this.questionPoints = selectedPoints.map((pt, index) => {
        const qpbottom = this.physics.add.sprite(pt.x, pt.y, 'tiles_spr', 340).setScale(1.5);
        const qptop = this.physics.add.sprite(pt.x, pt.y - 16, 'tiles_spr', 308).setScale(1.5);

        qpbottom.once('destroy', () => this.tweens.killTweensOf(qpbottom));
        qptop.once('destroy', () => this.tweens.killTweensOf(qptop));

        this.tweens.add({
          targets: [qpbottom, qptop],
          y: '-=4',
          duration: 900,
          yoyo: true,
          repeat: -1,
          ease: 'Sine.easeInOut'
        });
        this.tweens.add({
          targets: [qpbottom, qptop],
          alpha: 0.7,
          duration: 800,
          yoyo: true,
          repeat: -1,
          ease: 'Sine.easeInOut'
        });
        // bind question index to each sprite pair
        const pair = [qpbottom, qptop] as any;
        pair.questionIndex = index;

        return pair;
      });
    }

    protected  setupAssessmentCollision(): void {
        this.questionPoints.forEach((pointPair: any) => {
          this.physics.add.overlap(this.player, pointPair, () => {
            if (this.inAssessment) return;

            const qIndex = pointPair.questionIndex;
            this.startQuestionAtPoint(pointPair, qIndex);
          });
        });
      }
    protected onQuestionAnswered(result: AssessmentResult, context: any): void {}
    protected async startQuestionAtPoint(
        pointPair: any,
        qIndex: number
      ): Promise<void> {
        this.inAssessment = true;
        this.player.lockMovement();

        this.tweens.add({
          targets: pointPair,
          scale: 1.7,
          duration: 120,
          yoyo: true,
          ease: 'Quad.easeOut'
        });

        const q = this.questions[qIndex];
        if (!q) {
            console.warn(
              `No question data for point ${qIndex} in ${this.config.topic}; removing stale marker.`
            );
            pointPair.forEach((sprite: Phaser.GameObjects.Sprite) =>
              sprite.destroy()
            );
            this.inAssessment = false;
            this.player.unlockMovement();
            return;
        }

        this.popup.mode = "learning";
        this.popup.correctAnswer = q.answer;

        this.popup.show(q.question, q.choices, async (choice) => {
            const result = {
                userid: this.userData.userId,
                question_id: q.question_id,
                user_answer: choice,
                correct_answer: q.answer,
                topic: this.config.topic,

                subcategory: this.inferSubcat(q.question_id),
                is_correct: choice === q.answer,
                timestamp: new Date(),
            };

            this.assessmentResults.push(result);
            this.onQuestionAnswered(result, qIndex);

            try {
                await this.submitAnswer({
                  question_id: result.question_id,
                  user_answer: result.user_answer,
                  correct_answer: result.correct_answer,
                  topic: result.topic,
                  subcategory: result.subcategory,
                  is_correct: result.is_correct,
                  timestamp: result.timestamp,
                });

                console.log("ðŸ“¡ Single question submitted");
            } catch (err) {
            console.error("âŒ Failed to submit single question", err);
            }

            // remove question trigger
            pointPair.forEach((sprite: Phaser.GameObjects.Sprite) =>
            sprite.destroy()
            );

            this.inAssessment = false;
            this.player.unlockMovement();


            if (this.assessmentResults.length >= this.questions.length) {
                this.completeAssessment();
            }
            const total = this.totalquestions;
            const answered = this.assessmentResults.length;

            this.game.events.emit('questions:update', total, answered);


        });
      }
    protected  async submitAnswer(result: AssessmentResult): Promise<void> {
        const userData = (window as any).userData;
        if (!userData) return;

        try {
          gameAPI.setToken(userData.token);

          await gameAPI.submit_question_single({
            userid: userData.userId,
            question_id: result.question_id,
            topic: result.topic,

            question_subtopic: result.subcategory,
            answer: result.user_answer,

            is_correct: result.is_correct,
            timestamp: result.timestamp.toISOString(),
          });

          console.log("Answer submitted:", result.question_id);
        } catch (error) {
          console.error("Failed to submit answer:", error);
        }
    }
    protected  async completeAssessment(): Promise<void> {
        if (this.assessmentCompleted) return;
        this.assessmentCompleted = true;

        try {
            gameAPI.setToken(this.userData.token);

            await gameAPI.markTopicCompleted({
                userid: this.userData.userId,
                topic: this.config.topic,
            });

            console.log('Topic marked as completed');

        } catch (err) {
            console.error('Failed to mark topic completed', err);
        }

        if (!this.exitActivated) {
            this.exitPlatforms.forEach(platform => {
              platform
                .setFrame(388)
                .setVisible(true)
                .setAlpha(1);

              if (platform.body) {
                (platform.body as Phaser.Physics.Arcade.Body).enable = true;
              }

              // Sine pulsing
              this.tweens.add({
                targets: platform,
                scale: { from: 1.4, to: 1.8 },
                alpha: { from: 0.7, to: 1 },
                duration: 650,
                yoyo: true,
                repeat: -1,
                ease: 'Sine.easeInOut'
              });

              // Orbiting spark circles
              for (let index = 0; index < 8; index++) {
                const angle = (Math.PI * 2 * index) / 8;

                const spark = this.add
                  .circle(
                    platform.x + Math.cos(angle) * 22,
                    platform.y + Math.sin(angle) * 22,
                    2,
                    0xffe066
                  )
                  .setDepth(platform.depth + 1);

                this.tweens.add({
                  targets: spark,
                  angle: 360,
                  alpha: { from: 1, to: 0.25 },
                  scale: { from: 0.8, to: 1.8 },
                  duration: 900 + index * 80,
                  yoyo: true,
                  repeat: -1,
                  ease: 'Sine.easeInOut'
                });

                this.tweens.addCounter({
                  from: angle,
                  to: angle + Math.PI * 2,
                  duration: 1800,
                  repeat: -1,
                  ease: 'Linear',
                  onUpdate: tween => {
                    const value = tween.getValue();

                    spark.setPosition(
                      platform.x + Math.cos(value) * 22,
                      platform.y + Math.sin(value) * 22
                    );
                  }
                });
              }
            });

          this.exitActivated = true;
        }

        /*
        this.player.lockMovement();
        this.inAssessment = true;

        this.popup.show('Level Complete!', ['Continue'], () => {

          this.inAssessment = false;
          this.player.unlockMovement();

        });*/
    }

    private createKnowledgeAnimations(): void {
        if (this.anims.exists('knowledge_open')) return;

        this.anims.create({
          key: 'knowledge_open',
          frames: [
            { key: 'tiles_spr', frame: 627 },
            { key: 'tiles_spr', frame: 628 },
            { key: 'tiles_spr', frame: 629 },
          ],
          frameRate: 8,
          repeat: 0,
        });

        this.anims.create({
          key: 'knowledge_close',
          frames: [
            { key: 'tiles_spr', frame: 629 },
            { key: 'tiles_spr', frame: 628 },
            { key: 'tiles_spr', frame: 627 },
          ],
          frameRate: 8,
          repeat: 0,
        });
    }

    protected initKnowledge(): void {
        const allPoints = gameObjectsToObjectPoints(
        this.map.filterObjects('KnowledgePoints', obj => obj.name === 'KnowledgePoint') || []
        );


        Phaser.Utils.Array.Shuffle(allPoints);


        const selectedPoints = allPoints.slice(0, this.knowledgeList.length);

        this.knowledgePoints = selectedPoints.map((pt, index) => {
            const sprite = this.physics.add
            .sprite(pt.x, pt.y, 'tiles_spr', 627)
            .setScale(1.5);

            sprite.setImmovable(true);
            sprite.body.allowGravity = false;

            const point = [sprite] as any;
            point.isOpen = false;
            point.isAnimating = false;

            // ✅ DIRECT 1:1 binding (no randomness here)
            const knowledge = this.knowledgeList[index];

            point.knowledge = {
            knowledge_id: knowledge.knowledge_id,
            question_id: knowledge.question_id,
            knowledge_content: knowledge.knowledge_content,
            subtopic: knowledge.subtopic,
            subtopic_key: knowledge.subtopic_key,
            };

            point.wasTouching = false;
            return point;
        });
    }
    private setupKnowledgeCollision(): void {
        this.knowledgePoints.forEach((point: any) => {

            const sprite = point[0];

            this.physics.add.overlap(this.player, sprite, () => {

            if (point.isOpen || point.isAnimating) return;

            this.inAssessment = true;
            this.player.lockMovement();

            point.isAnimating = true;

            // ✨ feedback
            this.tweens.add({
              targets: sprite,
              scale: 1.65,
              duration: 90,
              yoyo: true,
              ease: 'Sine.easeOut',
            });

            this.tweens.add({
              targets: sprite,
              y: sprite.y - 4,
              duration: 120,
              yoyo: true,
              ease: 'Quad.easeOut',
            });

            sprite.play('knowledge_open');

            sprite.once('animationcomplete-knowledge_open', () => {
              sprite.setFrame(629);
              point.isOpen = true;
              point.isAnimating = false;

              this.popup.showInfo(
                "Knowledge",
                point.knowledge.knowledge_content,
                () => {
                      this.inAssessment = false;
                      this.player.unlockMovement();
                    }
                );

            });

            });
        });

    }

    // UI Helper
    private showLevelIntroBanner(
      title: string,
      description: string
    ): void {

      this.inAssessment = true;
      this.player.lockMovement();

      const cam = this.cameras.main;
      const centerX = cam.width / 2;
      const centerY = cam.height / 2;
      const zoom = cam.zoom;

      const overlay = this.add.rectangle(
        centerX,
        centerY,
        cam.width,
        cam.height,
        0x000000,
        0.65
      )
      .setScrollFactor(0)
      .setDepth(1000)
      .setScale(1 / zoom);

      const bannerWidth = 760; // slightly bigger
      const padding = 80;

      const container = this.add.container(centerX, centerY)
        .setScrollFactor(0)
        .setDepth(1001)
        .setAlpha(0)
        .setScale(1 / zoom);

      const titleText = this.add.text(0, -70, title, {
        fontSize: '32px',   // compensate for zoom
        color: '#ffffff',
        fontStyle: 'bold',
        align: 'center',
        wordWrap: { width: bannerWidth - padding }
      }).setOrigin(0.5);

      const descText = this.add.text(0, 0, description, {
        fontSize: '22px',   // compensate
        color: '#dddddd',
        align: 'center',
        wordWrap: { width: bannerWidth - padding }
      }).setOrigin(0.5);

      const continueText = this.add.text(0, 110, 'Tap or Press SPACE to continue', {
        fontSize: '18px',
        color: '#aaaaaa',
        align: 'center',
      }).setOrigin(0.5);

      const top = titleText.y - titleText.height / 2;
      const bottom = continueText.y + continueText.height / 2;
      const panelHeight = bottom - top + 80;

      const panel = this.add.rectangle(
        0,
        (top + bottom) / 2,
        bannerWidth,
        panelHeight,
        0x111111,
        0.95
      )
      .setStrokeStyle(4, 0xffffff)
      .setOrigin(0.5);

      container.add([panel, titleText, descText, continueText]);

      container.y -= 40;

      this.tweens.add({
        targets: container,
        y: centerY,
        alpha: 1,
        duration: 400,
        ease: 'Back.Out',
      });

      this.tweens.add({
        targets: continueText,
        alpha: 0.3,
        duration: 700,
        yoyo: true,
        repeat: -1,
        ease: 'Sine.easeInOut',
      });

      const spaceKey = this.input.keyboard?.addKey(
        Phaser.Input.Keyboard.KeyCodes.SPACE
      );

        const closeBanner = () => {
            spaceKey?.removeAllListeners();

            this.tweens.add({
              targets: [container, overlay],
              alpha: 0,
              duration: 300,
              onComplete: () => {
                container.destroy();
                overlay.destroy();
                this.inAssessment = false;
                this.player.unlockMovement();
              },
            });
        };

        overlay.setInteractive();
        container.setSize(bannerWidth, panelHeight);
        container.setInteractive();

        overlay.once('pointerdown', closeBanner);
        container.once('pointerdown', closeBanner);

        spaceKey?.once('down', closeBanner);
    }

    protected inferSubcat(questionId: string): string {
      return this.config.inferSubcat(questionId);
    }

    protected getObjectProperty(object: any, names: string | string[]): unknown {
      const wantedNames = (Array.isArray(names) ? names : [names])
        .map(name => this.normalizeObjectPropertyName(name));

      return object?.properties?.find((property: any) =>
        wantedNames.includes(
          this.normalizeObjectPropertyName(String(property.name ?? ''))
        )
      )?.value;
    }

    protected getObjectNumberProperty(
      object: any,
      names: string | string[],
      fallback = 0
    ): number {
      const value = this.getObjectProperty(object, names);
      const parsed = Number(value);
      return Number.isFinite(parsed) ? parsed : fallback;
    }

    protected async handleNoPlayableQuestionsReady(): Promise<void> {
      await this.completeAssessment();
    }

    private normalizeObjectPropertyName(name: string): string {
      return name.trim().replace(/:+$/, '');
    }

    protected startIntroDialogue(
      scenarioId: string,
      onComplete?: () => void
    ): void {

        const dialogueData = this.cache.json.get("general_dialogues");

        this.dialogueManager = new DialogueManager(dialogueData);
        this.dialogueUI = new DialogueUI(this);

        const scenario = this.dialogueManager.getScenarioById(scenarioId);

        this.player.lockMovement();
        this.inAssessment = true;

        this.dialogueUI.start(scenario, () => {
          this.player.unlockMovement();
          this.inAssessment = false;

          if (onComplete) {
            onComplete();
          }
        });

        // skip first line bug bandaid
        this.time.delayedCall(50, () => {
            this.input.keyboard.emit("keydown-SPACE");
        });

    }

}
