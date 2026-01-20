import { Scene, Tilemaps } from 'phaser';
import { Player } from '../../classes/player';
import { gameObjectsToObjectPoints } from '../../helpers/gameobject-to-object-point';
import AssessmentPopup from '../../helpers/assessment-popup';
import { gameAPI, AssessmentResult } from '../../helpers/game-api';

export class SFBLevel extends Scene {
  private player!: Player;
  private questionPoints!: Phaser.GameObjects.Sprite[][];
  private popup!: AssessmentPopup;
  private map!: Tilemaps.Tilemap;
  private tileset!: Tilemaps.Tileset;
  private wallsLayer!: Tilemaps.TilemapLayer;
  private wallsLayer2!: Tilemaps.TilemapLayer;
  private questions: any[] = [];
  private currentQuestionIndex = 0;
  private assessmentResults: AssessmentResult[] = [];
  private currentTopic = 'Safe Browsing Practices';
  private inAssessment = false;
  private userData = (window as any).userData;


  constructor() {
    super('sfb-level-scene');
  }

  async create(): Promise<void> {
    console.log('SFB Level - create()');
    this.initMap();

    this.physics.add.collider(this.player, this.wallsLayer);
    this.physics.add.collider(this.player, this.wallsLayer2);

    this.initCamera();
    this.popup = new AssessmentPopup(this);


    await this.createQuestionMap();
    this.initAssessment();
    this.setupAssessmentCollision();

    console.log(`📚 Loaded ${this.questions.length} questions for topic: ${this.currentTopic}`);
  }

  update(): void {
    this.player.update();
  }


  private initMap(): void {
      this.map = this.make.tilemap({ key: 'SFBlevel' });
      this.tileset = this.map.addTilesetImage('sfb-tileset', 'tiles')!;
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

  private async createQuestionMap(): Promise<void> {
    const response = await gameAPI.getUserQuestionMap({
      userid: this.userData.userId,
      topic: this.currentTopic,
    });


    if (response?.data?.questions?.length > 0) {
      console.log("📘 Using existing backend question_map");
      this.questions = response.data.questions;
      return;
    }

    console.log("🆕 No question_map found, generating...");
    const created = await gameAPI.createUserQuestionMap({
      userid: this.userData.userId,
      topic: this.currentTopic,
    });

    this.questions = created.data.questions;
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

  private async startQuestionAtPoint(pointPair: any, qIndex: number): Promise<void> {
    this.inAssessment = true;
    this.player.freeze();

    const q = this.questions[qIndex];
    this.popup.mode = "learning";
    this.popup.correctAnswer = q.answer;
    this.popup.show(q.question, q.choices, async(choice) => {
      const result = {
        userid: this.userData.userId,
        question_id: q.question_id,
        user_answer: choice,
        correct_answer: q.answer,
        topic: this.currentTopic,
        subcategory: this.inferSubcat(q.question_id),
        is_correct: choice === q.answer,
        timestamp: new Date(),
      };

      this.assessmentResults.push(result);

      const apiPayload = {
        userid: result.userid,
        question_id: result.question_id,
        topic: result.topic,

        question_subtopic: this.inferSubcat(q.question_id),
        answer: result.user_answer,

        is_correct: result.is_correct,
        timestamp: result.timestamp.toISOString(),
      };



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

      // Remove that point so it won't trigger again
      pointPair.forEach((sprite: Phaser.GameObjects.Sprite) => sprite.destroy());

      this.inAssessment = false;
      this.player.unfreeze();

      // If all questions answered → finish
      if (this.assessmentResults.length >= this.questions.length) {
        this.completeAssessment();
      }
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


      console.log("📡 Answer submitted:", result.question_id);
    } catch (error) {
      console.error("❌ Failed to submit answer:", error);
    }
  }

  private async completeAssessment(): Promise<void> {
    const userData = (window as any).userData;
    if (!userData || !userData.token || !userData.userId) {
      console.warn('User not logged in. Results stored locally.');
      this.popup.show('Please log in to save your progress.', ['OK'], () => this.player.unfreeze());
      this.inAssessment = false;
      return;
    }

    const subcatMap: Record<string, string> = {
      SecVsNonSecWeb: 'SECVSNONSEC',
      HttpVsHttps: 'HTTPVSHTTPS',
      BrowserSecBestPrac: 'BROWSERSECBP',
      CommPass: 'COMMPASS',
      PassStren: 'PASSSTREN',
      MultiFact: 'MULTIFACT',
      MalType: 'MALTYPE',
      MalInfect: 'MALINFECT',
      SocEngType: 'SOCENGTYPE',
      SocEngDef: 'SOCENGDEF',
      IRProc: 'IRPROC',
      IRPrep: 'IRPREP',
      IRPost: 'IRPOST',
      PIRPlan: 'PIRPLAN',
    };

    const formattedResponses = this.assessmentResults.map((r) => ({
      question_id: r.question_id,
      question_subtopic: subcatMap[r.subcategory] || r.subcategory.toUpperCase(),
      answer: r.user_answer,
      correct_answer: r.correct_answer,
      topic: r.topic,
      is_correct: r.is_correct,
      timestamp: r.timestamp.toISOString(),
    }));

    const payload = {
      userid: userData.userId,
      topic: this.currentTopic,
      assessment_response: { responses: formattedResponses },
    };

    console.log('📤 Sending payload:', payload);

    try {
      gameAPI.setToken(userData.token);
      const response = await gameAPI.startInitialAssessment(payload);
      console.log('✅ Backend response:', response);
    } catch (error) {
      console.error('❌ Failed to send to backend:', error);
    }

    this.popup.show('Assessment Complete!', ['OK'], () => {
      this.player.unfreeze();
      this.inAssessment = false;
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
    this.cameras.main.setSize(this.game.scale.width, this.game.scale.height);
    this.cameras.main.startFollow(this.player, true, 0.09, 0.09);
    this.cameras.main.setZoom(1.5);
    this.cameras.main.setBounds(0, 0, this.map.widthInPixels, this.map.heightInPixels);
  }

  private inferSubcat(questionId: string): string {
  if (questionId.includes('_svns_')) return 'SECVSNONSEC';
  if (questionId.includes('_https_')) return 'HTTPVSHTTPS';
  if (questionId.includes('_bsbp_')) return 'BROWSERSECBP';
  return 'UNKNOWN';
}

}
