
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
    protected platform!: Tilemaps.TilemapLayer;

    protected questions: any[] = [];
    protected assessmentResults: AssessmentResult[] = [];

    protected inAssessment = false;
    protected assessmentCompleted = false;
    protected userData = (window as any).userData;

    protected readonly config: LevelConfig;

    protected dialogueManager!: DialogueManager;
    protected dialogueUI!: DialogueUI;

    private exitMessageShown = false;
    private exitPlatforms: Phaser.GameObjects.Sprite[] = [];

    private exitActivated = false;

    constructor(config: LevelConfig) {
        super(config.sceneKey);
        this.config = config;
      }

    async create(): Promise<void> {
        console.log(`${this.scene.key} - create()`);

        this.initMap();


        this.popup = new AssessmentPopup(this);

        await this.createQuestionMap();
        this.initAssessment();
        this.spawnPlayerOnSpawnPoint(0);
        this.initNextLevelPlatforms();

        this.initCamera();
        this.setupAssessmentCollision();

        const knowledgeResponse = await gameAPI.getUserKnowledgeList({
          userid: this.userData.userId,
          topic: this.config.topic,

        });

        console.log(knowledgeResponse);

        this.knowledgeList = knowledgeResponse.data.knowledge;

        this.createKnowledgeAnimations();
        this.initKnowledge();
        this.setupKnowledgeCollision();

        this.startIntroDialogue(this.config.intro.dialogueId, () => {
          this.showLevelIntroBanner(
            this.config.intro.title,
            this.config.intro.description
          );
        });

        this.initUI();
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
        this.platform = this.map.createLayer('Platform', this.tileset, 0, 0)!;
        this.wallsLayer.setCollisionByProperty({ collides: true });
        this.wallsLayer2.setCollisionByProperty({ collides: true });

        this.physics.world.setBounds(0, 0, this.map.widthInPixels, this.map.heightInPixels);
        console.log(this.map.layers.map(l => l.name));
    }

    private spawnPlayerOnSpawnPoint(zone?: number): void {

        const spawnObjects = this.map.filterObjects(
            'SpawnPoint',
            obj => obj.name === 'PlayerSpawn'
        );

        let spawnX = 100;
        let spawnY = 100;

        if (spawnObjects.length > 0) {
            spawnX = spawnObjects[0].x;
            spawnY = spawnObjects[0].y;
        }

        // spawn platform
        const platform = this.add
            .sprite(spawnX, spawnY, 'tiles_spr', 386)
            .setScale(1.5)
            .setDepth(0);

        // ✨ platform glow pulse
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
        const particles = this.add.particles('tiles_spr');

        const emitter = particles.createEmitter({
            frame: 629,
            x: spawnX,
            y: spawnY - 8,
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
            emitter.stop();

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

    }

    private initNextLevelPlatforms(): void {

        const exitObjects = this.map.filterObjects(
            'NextLevelPlatform',
            obj => obj.name === 'NextLevelPlatform'
        );

        exitObjects.forEach(obj => {

            const platform = this.physics.add
              .sprite(obj.x, obj.y, 'tiles_spr', 388)
              .setScale(1.5);
            this.exitPlatforms.push(platform);
            platform.setImmovable(true);
            platform.body.allowGravity = false;


            this.physics.add.overlap(this.player, platform, () => {

                if (!this.assessmentCompleted) {

                    if (!this.exitMessageShown) {

                        this.exitMessageShown = true;

                        this.popup.showInfo("Locked", "Complete all questions first.", () => {
                            this.exitMessageShown = false;
                        });

                    }

                    return;
                }

                this.player.lockMovement();

                this.scene.stop('ui-scene');

                this.scene.start(this.config.next.sceneKey, {
                    topic: this.config.next.topic
                });

            });

        });

        this.tweens.add({
          targets: platform,
          alpha: 0.7,
          duration: 700,
          yoyo: true,
          repeat: -1,
          ease: 'Sine.easeInOut'
        });
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
          console.log("Using existing backend question_map");
          this.questions = response.data.questions;
          this.totalquestions = response.data.questionsTotal;
          return;
        }


        console.log("No question_map found, generating...");
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
        this.player.lockMovement();

        this.tweens.add({
          targets: pointPair,
          scale: 1.7,
          duration: 120,
          yoyo: true,
          ease: 'Quad.easeOut'
        });

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
            this.player.unlockMovement();


            if (this.assessmentResults.length >= this.questions.length) {
                this.completeAssessment();
            }
            const total = this.totalquestions;
            const answered = this.assessmentResults.length;

            this.game.events.emit('questions:update', total, answered);


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

        if (!this.exitActivated) {

          this.exitPlatforms.forEach(platform => {

            this.tweens.add({
              targets: platform,
              scale: 1.6,
              duration: 600,
              yoyo: true,
              repeat: -1,
              ease: 'Sine.easeInOut'
            });

          });

          this.exitActivated = true;
        }

        this.player.lockMovement();
        this.inAssessment = true;

        this.popup.show('Level Complete!', ['Continue'], () => {

          this.inAssessment = false;
          this.player.unlockMovement();

        });
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

    private initKnowledge(): void {
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
