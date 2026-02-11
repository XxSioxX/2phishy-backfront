
import {Tilemaps } from 'phaser';
import {LevelConfig} from "./LevelConfig";
import AssessmentPopup from "../../helpers/assessment-popup";
import {AssessmentResult, gameAPI} from "../../helpers/game-api";
import {Player} from "../../classes/player";
import {gameObjectsToObjectPoints} from "../../helpers/gameobject-to-object-point";

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

    protected questions: any[] = [];
    protected assessmentResults: AssessmentResult[] = [];

    protected inAssessment = false;
    protected assessmentCompleted = false;
    protected userData = (window as any).userData;

    protected readonly config: LevelConfig;

    constructor(config: LevelConfig) {
        super(config.sceneKey);
        this.config = config;
      }


    async create(): Promise<void> {
        console.log(`${this.scene.key} - create()`);

        this.initMap();

        this.physics.add.collider(this.player, this.wallsLayer);
        this.physics.add.collider(this.player, this.wallsLayer2);

        this.initCamera();

        this.popup = new AssessmentPopup(this);


        await this.createQuestionMap();
        this.game.events.emit(
          'questions:init',
          this.questions.length
        );


        this.initAssessment();
        this.setupAssessmentCollision();

        this.player.initQuestions(this.totalquestions, this.questions.length)

        const knowledgeResponse = await gameAPI.getUserKnowledgeList({
          userid: this.userData.userId,
          topic: this.config.topic,

        });

        console.log(knowledgeResponse);

        this.knowledgeList = knowledgeResponse.data.knowledge;

        this.createKnowledgeAnimations();
        this.initKnowledge();
        this.setupKnowledgeCollision();



        this.showLevelIntroBanner(
          this.config.intro.title,
          this.config.intro.description
        );



    }


    update(): void {
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


    private initMap(): void {
        this.map = this.make.tilemap({ key: this.config.mapKey });
        this.tileset = this.map.addTilesetImage(
          this.config.tilesetName,
          'tiles'
        )!;

        this.map.createLayer('Floor', this.tileset, 0, 0)!;
        this.wallsLayer = this.map.createLayer('Walls', this.tileset, 0, 0)!;
        this.wallsLayer2 = this.map.createLayer('Walls-second', this.tileset, 0, 0)!;
        this.wallsLayer.setCollisionByProperty({ collides: true });
        this.wallsLayer2.setCollisionByProperty({ collides: true });

        // Set physics world bounds to match the tilemap
        this.physics.world.setBounds(0, 0, this.map.widthInPixels, this.map.heightInPixels);

        // Create player and prevent leaving the world
        this.player = new Player(this, 100, 100);
        this.player.bodyRef().setCollideWorldBounds(true);
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
        this.cameras.main.startFollow(this.player, true, 0.09, 0.09);
        this.cameras.main.setZoom(2);
        this.cameras.main.setBounds(0, 0, this.map.widthInPixels, this.map.heightInPixels);
    }


    private async createQuestionMap(): Promise<void> {
        const response = await gameAPI.getUserQuestionMap({
          userid: this.userData.userId,
          topic: this.config.topic,

        });


        if (response?.data?.questions?.length > 0) {
          console.log("📘 Using existing backend question_map");
          this.questions = response.data.questions;
          this.totalquestions = response.data.questionsTotal;
          return;
        }


        console.log("🆕 No question_map found, generating...");
        const created = await gameAPI.createUserQuestionMap({
          userid: this.userData.userId,
          topic: this.config.topic,

        });


        this.questions = created.data.questions;
        this.totalquestions = created.data.totalquestions;
    }

    private initAssessment(): void {
      const allPoints = gameObjectsToObjectPoints(
        this.map.filterObjects('QuestionPoints', obj => obj.name === 'QuestionPoint') || []
      );

      Phaser.Utils.Array.Shuffle(allPoints);

      const selectedPoints = allPoints.slice(0, this.questions.length);

      this.questionPoints = selectedPoints.map((pt, index) => {
        const bottom = this.physics.add.sprite(pt.x, pt.y, 'tiles_spr', 340).setScale(1.5);
        const top = this.physics.add.sprite(pt.x, pt.y - 16, 'tiles_spr', 308).setScale(1.5);

        // bind question index to each sprite pair
        const pair = [bottom, top] as any;
        pair.questionIndex = index;

        return pair;
      });
    }

    private setupAssessmentCollision(): void {
        this.questionPoints.forEach((pointPair: any) => {
          this.physics.add.overlap(this.player, pointPair, () => {
            if (this.inAssessment) return;

            const qIndex = pointPair.questionIndex;
            this.startQuestionAtPoint(pointPair, qIndex);
          });
        });
      }

    private async startQuestionAtPoint(
        pointPair: any,
        qIndex: number
      ): Promise<void> {
        this.inAssessment = true;

        const q = this.questions[qIndex];

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

          // ✅ store answer ONCE
          this.assessmentResults.push(result);


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

            console.log("📡 Single question submitted");
          } catch (err) {
            console.error("❌ Failed to submit single question", err);
          }

          // remove question trigger
          pointPair.forEach((sprite: Phaser.GameObjects.Sprite) =>
            sprite.destroy()
          );

          this.inAssessment = false;


          if (this.assessmentResults.length >= this.questions.length) {
            this.completeAssessment();
          }
          this.player.setRemainingQuestions(this.assessmentResults.length);
        });
      }
    private async submitAnswer(result: AssessmentResult): Promise<void> {
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
    private async completeAssessment(): Promise<void> {
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

        this.popup.show('Level Complete!', ['Continue'], () => {
          this.player.unfreeze();
          this.inAssessment = false;

          this.scene.start('assessment-scene', {
              topic: this.config.next.topic,
              nextScene: this.config.next.sceneKey,
            });

        });
    }

    // KNOWLEDGE SYSTEM

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

    private initKnowledge(): void {
        const allPoints = gameObjectsToObjectPoints(
        this.map.filterObjects('KnowledgePoints', obj => obj.name === 'KnowledgePoint') || []
        );

        // 🎲 Randomize spawn LOCATIONS
        Phaser.Utils.Array.Shuffle(allPoints);

        // 🔢 Spawn exactly as many as needed
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

        const cam = this.cameras.main;
        const centerX = cam.width / 2;
        const centerY = cam.height / 2;

        const overlay = this.add.rectangle(
          centerX,
          centerY,
          cam.width,
          cam.height,
          0x000000,
          0.65
        )
          .setScrollFactor(0)
          .setDepth(1000);

        const container = this.add.container(centerX, centerY - 40)
          .setScrollFactor(0)
          .setDepth(1001)
          .setAlpha(0);

        const titleText = this.add.text(0, -40, title, {
          fontSize: '26px',
          color: '#ffffff',
          fontStyle: 'bold',
          align: 'center',
        }).setOrigin(0.5);

        const descText = this.add.text(0, 10, description, {
          fontSize: '14px',
          color: '#dddddd',
          align: 'center',
          wordWrap: { width: cam.width * 0.7 },
        }).setOrigin(0.5);

        const continueText = this.add.text(0, 60, 'Press SPACE to continue', {
          fontSize: '12px',
          color: '#aaaaaa',
          align: 'center',
        }).setOrigin(0.5);

        container.add([titleText, descText, continueText]);

        // entrance animation
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
            },
          });
        };

        spaceKey?.once('down', closeBanner);

    }

    protected inferSubcat(questionId: string): string {
      return this.config.inferSubcat(questionId);
    }

}
