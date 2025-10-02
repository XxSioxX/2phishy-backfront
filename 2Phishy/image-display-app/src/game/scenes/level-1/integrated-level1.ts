import { Scene, Tilemaps } from 'phaser';
import { Player } from '../../classes/player';
import { gameObjectsToObjectPoints } from '../../helpers/gameobject-to-object-point';
// import { Enemy } from '../../classes/enemy';
import AssessmentPopup from '../../helpers/assessment-popup';
import { gameAPI } from '../../services/game-api';
import { AssessmentResult, AssessmentSession } from '../../global';

export class IntegratedLevel1 extends Scene {
  private player!: Player;
  private assessmentpoints!: Phaser.GameObjects.Sprite[][];
  private popup!: AssessmentPopup;
  private map!: Tilemaps.Tilemap;
  private tileset!: Tilemaps.Tileset;
  private wallsLayer!: Tilemaps.TilemapLayer;
  private questions: any[] = [];
  private currentQuestionIndex = 0;
  private assessmentSession: AssessmentSession | null = null;
  private assessmentResults: AssessmentResult[] = [];
  private currentTopic = 'Safe Browsing Practices';

  constructor() {
    super('integrated-level-1-scene');
  }


  create(): void {
    console.log('Integrated Level 1 (create): level-1');

    this.initMap();
    this.player = new Player(this, 100, 100);
    this.physics.add.collider(this.player, this.wallsLayer);
    this.initAssessment();
    this.setupAssessmentCollision();
    this.initCamera();
    this.popup = new AssessmentPopup(this);
    
    // Load assessment data
    const data = this.cache.json.get('assessmentData');
    const topic = data.find((t: any) => t.topic === this.currentTopic);
    this.questions = topic.initial_assessment;

    // Initialize API with user token
    this.initializeAPI();
  }

  private async initializeAPI(): Promise<void> {
    try {
      // Get user data from global window object
      const userData = (window as any).userData;
      console.log('User data from window:', userData);
      
      if (userData && userData.token) {
        console.log('Setting token and starting assessment session...');
        gameAPI.setToken(userData.token);
        
        try {
          // Start assessment session
          this.assessmentSession = await gameAPI.startAssessmentSession(
            this.currentTopic
          );
          
          console.log('Assessment session started:', this.assessmentSession);
        } catch (apiError) {
          console.error('Failed to start assessment session:', apiError);
          console.log('Continuing in offline mode - assessment data will not be saved');
          
          // Create a mock session for offline mode
          this.assessmentSession = {
            id: 'offline-session',
            session_id: 'offline-' + Date.now(),
            user_id: userData.userId,
            topic: this.currentTopic,
            start_time: new Date().toISOString(),
            end_time: undefined,
            total_score: 0,
            total_questions: 0,
            completed: false,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
            results: []
          };
        }
      } else {
        console.warn('No user data found, running in offline mode');
        console.log('Available userData:', userData);
        
        // Create a mock session for offline mode
        this.assessmentSession = {
          id: 'offline-session',
          session_id: 'offline-' + Date.now(),
          user_id: 'anonymous',
          topic: this.currentTopic,
          start_time: new Date().toISOString(),
          end_time: undefined,
          total_score: 0,
          total_questions: 0,
          completed: false,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
          results: []
        };
      }
    } catch (error) {
      console.error('Failed to initialize API:', error);
      console.log('Continuing in offline mode');
    }
  }

  update(): void {
    this.player.update();
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
    this.map.createLayer('Ground', this.tileset, 0, 0)!;
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

  private setupAssessmentCollision(): void {
    this.assessmentpoints.forEach((assessmentpoint) => {
      this.physics.add.overlap(this.player, assessmentpoint, () => {
        this.player.freeze();
        this.showNextQuestion();
      });
    });
  }

  private async showNextQuestion(): Promise<void> {
    if (this.currentQuestionIndex >= this.questions.length) {
      await this.completeAssessment();
      return;
    }

    const q = this.questions[this.currentQuestionIndex];

    this.popup.show(q.question, q.choices, async (choice) => {
      console.log('Player picked:', choice, 'Correct answer:', q.answer);

      // Create assessment result
      const result: AssessmentResult = {
        question_id: q.question_id,
        user_answer: choice,
        correct_answer: q.answer,
        is_correct: choice === q.answer,
        topic: this.currentTopic,
        subcategory: q.subcat,
        timestamp: new Date()
      };

      // Store result locally
      this.assessmentResults.push(result);

      // Submit result to backend if session exists and is not offline
      if (this.assessmentSession && !this.assessmentSession.session_id.startsWith('offline-')) {
        try {
          await gameAPI.submitAssessmentResult(this.assessmentSession.session_id, result);
          console.log('Assessment result submitted:', result);
        } catch (error) {
          console.error('Failed to submit assessment result:', error);
          console.log('Result stored locally, will not be saved to backend');
        }
      } else {
        console.log('Offline mode - result stored locally only');
      }

      this.currentQuestionIndex++;
      this.showNextQuestion();
    });
  }

  private async completeAssessment(): Promise<void> {
    const totalQuestions = this.questions.length;
    const correctAnswers = this.assessmentResults.filter(r => r.is_correct).length;
    const totalScore = Math.round((correctAnswers / totalQuestions) * 100);

    this.popup.show(
      `Assessment Complete!\n\nScore: ${correctAnswers}/${totalQuestions} (${totalScore}%)`,
      ['Done'],
      async () => {
        console.log('Assessment finished!');
        
        // End assessment session if it exists and is not offline
        if (this.assessmentSession && !this.assessmentSession.session_id.startsWith('offline-')) {
          try {
            const completedSession = await gameAPI.endAssessmentSession(
              this.assessmentSession.session_id,
              totalScore,
              totalQuestions
            );
            console.log('Assessment session completed:', completedSession);
          } catch (error) {
            console.error('Failed to end assessment session:', error);
            console.log('Assessment completed locally only');
          }
        } else {
          console.log('Offline mode - assessment completed locally only');
        }

        this.player.unfreeze();
      }
    );
  }


  private initCamera(): void {
    // Camera setup for single unified view
    this.cameras.main.setSize(this.game.scale.width, this.game.scale.height);
    this.cameras.main.startFollow(this.player, true, 0.09, 0.09);
    this.cameras.main.setZoom(1.5); // Reduced zoom for better view
    this.cameras.main.setBounds(0, 0, this.map.widthInPixels, this.map.heightInPixels);
  }

}
