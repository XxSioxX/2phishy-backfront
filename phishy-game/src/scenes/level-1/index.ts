import { GameObjects, Scene, Tilemaps } from 'phaser';
import { Player } from '../../classes/player';
import { gameObjectsToObjectPoints } from '../../helpers/gameobject-to-object-point';
import { Enemy } from '../../classes/enemy';
import AssessmentPopup from '../../helpers/assessment-popup';
import {AssessmentManager} from "../../helpers/AssessmentManager";
import {SessionManager} from "../../helpers/session-manager";
import {ApiService} from "../../helpers/api-service";

export class Level1 extends Scene {
  private king!: GameObjects.Sprite;
  private player!: Player;
  private assessmentpoints!: Phaser.GameObjects.Sprite[][];
  private enemies!: Enemy[];
  private popup!: AssessmentPopup;
  private map!: Tilemaps.Tilemap;
  private tileset!: Tilemaps.Tileset;
  private wallsLayer!: Tilemaps.TilemapLayer;
  private groundLayer!: Tilemaps.TilemapLayer;
  private currentPopup?: Phaser.GameObjects.Container;
  private popupActive = false;
  private assessmentManager!: AssessmentManager;
  private questions: any[] = [];
  private currentQuestionIndex = 0;
  private session = SessionManager.getInstance(); // ✅ handles token + user
  private api = new ApiService(); // 🆕 added: will handle API calls

  constructor() {
    super('level-1-scene');
  }
  create(): void {
    console.log('level 1 (create): level-1');

    this.initMap();
    this.player = new Player(this, 100, 100);
    this.physics.add.collider(this.player, this.wallsLayer);
    this.initAssessment();
    this.setupAssessmentCollision();
    this.initCamera();
    this.popup = new AssessmentPopup(this);
    const data = this.cache.json.get('assessmentData');
    const topic = data.find((t: any) => t.topic === 'Safe Browsing Practices');
    this.questions = topic.initial_assessment;

    // verify sesssion
    const currentSession = this.session.getSession();
    if (!currentSession) {
      console.error('No user session found. Redirecting to login scene.');
      this.scene.start('login-scene');
      return;
    }

    console.log('Current player:', currentSession.userid);

    // initialize assess manager with userid
    this.assessmentManager = new AssessmentManager(currentSession.userid, topic.topic);
  }
  update(): void {
    this.player.update();
    if (this.currentPopup) {
      const cam = this.cameras.main;
      this.currentPopup.setPosition(cam.midPoint.x, cam.midPoint.y);
    }
  }

  private initMap(): void {
    console.log('initMap running');
    this.map = this.make.tilemap({ key: 'assessmentlevel' });
    console.log('textures in cache:', Object.keys(this.textures.list));
    console.log('Tilemap data:', this.map.tilesets);

    this.tileset = this.map.addTilesetImage('d-16-16', 'tiles')!;

    if (!this.tileset) {
      throw new Error('Failed to add tileset. Check tileset and texture keys.');
    }
    this.groundLayer = this.map.createLayer('Ground', this.tileset, 0, 0)!;
    this.wallsLayer = this.map.createLayer('Walls', this.tileset, 0, 0)!;

    this.wallsLayer.setCollisionByProperty({ collides: true });
  }

  private initAssessment(): void {
    const AssessmentPoints = gameObjectsToObjectPoints(
      this.map.filterObjects('AssessmentWaypoint', (obj) => obj.name === 'AssessmentPoint')!,
    );
    console.log('Assessment Point:', AssessmentPoints);

    this.assessmentpoints = AssessmentPoints.map((chestPoint) => {
      // bottom part at the actual point
      const bottom = this.physics.add
        .sprite(chestPoint.x, chestPoint.y, 'tiles_spr', 341)
        .setScale(1.5);

      // top part stacked above
      const top = this.physics.add
        .sprite(chestPoint.x, chestPoint.y - 16, 'tiles_spr', 309)
        .setScale(1.5);

      return [bottom, top]; // keep them as a pair
    });
  }

  private async showNextQuestion(): Promise<void> {
    if (this.currentQuestionIndex >= this.questions.length) {
      // 🆕 all questions complete — build payload
      const payload = this.assessmentManager.getPayload();
      console.log('Final Payload:', payload);

      // 🆕 submit to backend via centralized ApiService
      try {
        const result = await this.api.submitInitialAssessment(payload);
        console.log('Assessment submitted successfully:', result);
      } catch (error) {
        console.error('Failed to submit assessment:', error);
      }

      this.popup.show('All questions complete!', ['Done'], () => {
        this.player.unfreeze();
      });
      return;
    }

    // Current question
    const q = this.questions[this.currentQuestionIndex];

    this.popup.show(q.question, q.choices, (choice) => {
      // ✅ record answer in AssessmentManager
      this.assessmentManager.recordAnswer(q.question_id, q.subcat, choice);

      console.log(
        `Q${this.currentQuestionIndex + 1}: ${choice === q.answer ? '✅ Correct' : '❌ Incorrect'}`,
      );

      this.currentQuestionIndex++;
      this.showNextQuestion();
    });
  }

  private setupAssessmentCollision(): void {
    this.assessmentpoints.forEach((assessmentpoint) => {
      this.physics.add.overlap(this.player, assessmentpoint, () => {
        if (!this.popupActive) {
          this.player.freeze();
          this.showNextQuestion();
          this.popupActive = true;
        }
      });
    });
  }

  private showDebugWalls(): void {
    const debugGraphics = this.add.graphics().setAlpha(0.7);
    this.wallsLayer.renderDebug(debugGraphics, {
      tileColor: null,
      collidingTileColor: new Phaser.Display.Color(243, 234, 48, 255),
    });
  }

  private initCamera(): void {
    this.cameras.main.setSize(this.game.scale.width, this.game.scale.height);
    this.cameras.main.startFollow(this.player, true, 0.09, 0.09);
    this.cameras.main.setZoom(2);
  }

  private initEnemies(): void {
    const enemiesPoints = gameObjectsToObjectPoints(
      this.map.filterObjects('Enemies', (obj) => obj.name === 'EnemyPoint')!,
    )!;
    this.enemies = enemiesPoints.map((enemyPoint) =>
      new Enemy(this, enemyPoint.x, enemyPoint.y, 'tiles_spr', this.player, 503)
        .setName(enemyPoint.id.toString())
        .setScale(1.5),
    );
    this.physics.add.collider(this.enemies, this.wallsLayer);
    this.physics.add.collider(this.enemies, this.enemies);
    this.physics.add.collider(this.player, this.enemies, (obj1, obj2) => {
      (obj1 as Player).getDamage(1);
    });
  }
}
