import { Scene, Tilemaps } from 'phaser';
import { Player } from '../../classes/player';
import { gameObjectsToObjectPoints } from '../../helpers/gameobject-to-object-point';
import AssessmentPopup from '../../helpers/assessment-popup';
import { gameAPI, AssessmentResult } from '../../helpers/game-api';
import { DialogueManager } from "../../helpers/DialogueManager";
import { DialogueUI } from "../ui/DialogueUI";

export class AssessmentLevel extends Scene {
  private player!: Player;
  private assessmentPoints!: Phaser.GameObjects.Sprite[][];
  private popup!: AssessmentPopup;
  private map!: Tilemaps.Tilemap;
  private tileset!: Tilemaps.Tileset;
  private wallsLayer!: Tilemaps.TilemapLayer;
  private questions: any[] = [];
  private currentQuestionIndex = 0;
  private assessmentResults: AssessmentResult[] = [];
  private currentTopic!: string;
  private inAssessment = false;
  private nextScene!: string;

  private dialogueManager!: DialogueManager;
  private dialogueUI!: DialogueUI;

  constructor() {
    super('assessment-scene');
  }

  create(): void {
    console.log('Assessment Level Create');
    this.currentQuestionIndex = 0;
    this.assessmentResults = [];
    this.inAssessment = false;


    this.initMap();

    this.player = new Player(this, 100, 100);
    this.physics.add.collider(this.player, this.wallsLayer);

    this.initAssessment();
    this.setupAssessmentCollision();
    this.initCamera();

    this.popup = new AssessmentPopup(this);
    this.popup.mode = "assessment";


    const data = this.cache.json.get('assessmentData') || [];
    const topicData = (data as any[]).find(
      (t: any) => t.topic === this.currentTopic
    );

    this.questions = topicData?.initial_assessment || [];
    console.log('questions:', this.questions);

    console.log(`Loaded ${this.questions.length} questions for topic: ${this.currentTopic}`);

    this.player.freeze();
    this.inAssessment = true;

    this.cameras.main.fadeIn(1000, 0, 0, 0);

    const dialogueData = this.cache.json.get("general_dialogues");

    this.dialogueManager = new DialogueManager(dialogueData);
    this.dialogueUI = new DialogueUI(this);

    const scenario = this.dialogueManager.getScenarioById("assessment_arrival");

    this.dialogueUI.start(scenario, () => {
      this.player.unfreeze();
      this.inAssessment = false;
    });

    this.time.delayedCall(50, () =>
      this.input.keyboard.emit('keydown-SPACE')
    );
  }

  init(data: { topic: string; nextScene: string }) {
    if (!data?.topic || !data?.nextScene) {
      throw new Error('AssessmentLevel requires topic and nextScene');
    }

    this.currentTopic = data.topic;
    this.nextScene = data.nextScene;
  }


  update(): void {
    this.player.update();
  }

  private initMap(): void {
    this.map = this.make.tilemap({ key: 'assessmentlevel' });
    this.tileset = this.map.addTilesetImage('d-16-16', 'tiles')!;
    this.map.createLayer('Ground', this.tileset, 0, 0)!;
    this.wallsLayer = this.map.createLayer('Walls', this.tileset, 0, 0)!;
    this.wallsLayer.setCollisionByProperty({ collides: true });
  }

  private initAssessment(): void {
    const points = gameObjectsToObjectPoints(
      this.map.filterObjects('AssessmentWaypoint', (obj) => obj.name === 'AssessmentPoint') || []
    );
  
    this.assessmentPoints = points.map((pt) => {
      const bottom = this.physics.add.sprite(pt.x, pt.y, 'tiles_spr', 341).setScale(1.5);
      const top = this.physics.add.sprite(pt.x, pt.y - 16, 'tiles_spr', 309).setScale(1.5);
      return [bottom, top];
    });
  }

  private setupAssessmentCollision(): void {
    this.assessmentPoints.forEach((ap) => {
      this.physics.add.overlap(this.player, ap, () => {
        if (this.inAssessment) return;
        this.inAssessment = true;
        this.player.freeze();
        this.showNextQuestion();
      });
    });
  }

  private async showNextQuestion(): Promise<void> {
    if (this.currentQuestionIndex >= this.questions.length) {
        console.log('Assessment complete');
        this.completeAssessment();
        return;
      }
    const q = this.questions[this.currentQuestionIndex];
    this.popup.correctAnswer = q.answer;
    this.popup.show(q.question, q.choices, async (choice) => {
      const result: AssessmentResult = {
        assessment_id: q.assessment_id,
        question_id: q.question_id,
        user_answer: choice,
        correct_answer: q.answer,
        topic: this.currentTopic,
        subcategory: q.subcat,
        is_correct: choice === q.answer,
        timestamp: new Date(),
      };

      this.assessmentResults.push(result);
      this.currentQuestionIndex++;
      this.showNextQuestion();
    });
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
      MalInfect: 'MALINFOSYM',
      SocEngType: 'SOCENGTYPE',
      SocEngDef: 'SOCENGDEF',
      IRProc: 'IRPROC',
      IRPrep: 'IRPREP',
      IRPost: 'IRPOST',
      PIRPlan: 'PIRPLAN'
    };

    const formattedResponses = this.assessmentResults.map((r) => ({
      assessment_id: r.assessment_id,
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
      assessment_response: { responses: formattedResponses }
    }
    console.log('Sending payload:', payload);

    try {
      gameAPI.setToken(userData.token);
      const response = await gameAPI.startInitialAssessment(payload);
      console.log('✅ Backend response:', response);
    } catch (error) {
      console.error('Failed to send to backend:', error);
    }

    this.popup.show('Assessment Complete!', ['Proceed'], () => {
            this.scene.start(this.nextScene, {
        topic: this.currentTopic,
      });

      this.player.unfreeze();
      this.inAssessment = false;
    });
  }

    private initCamera(): void {
        this.cameras.main.startFollow(this.player, true, 0.09, 0.09);
        this.cameras.main.setZoom(2);
        this.cameras.main.setBounds(0, 0, this.map.widthInPixels, this.map.heightInPixels);
    }
}
