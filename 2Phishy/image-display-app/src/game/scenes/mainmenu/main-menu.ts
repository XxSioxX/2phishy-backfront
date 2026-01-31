import { Scene } from 'phaser';
import { gameAPI } from '../../helpers/game-api';
import AssessmentPopup from '../../helpers/assessment-popup';
import { LEVEL_FLOW } from '../core/LevelFlow';

export class MainMenuScene extends Scene {
  private playButton!: Phaser.GameObjects.Text;
  private loadingText!: Phaser.GameObjects.Text;
  private popup!: AssessmentPopup;
  private userData = (window as any).userData;

  constructor() {
    super('main-menu-scene');
  }

  create(): void {
    this.popup = new AssessmentPopup(this);

    this.add
      .text(400, 150, '2Phishy', { fontSize: '48px', color: '#00ffcc' })
      .setOrigin(0.5);

    this.playButton = this.add
      .text(400, 300, '▶ Play Game', {
        fontSize: '32px',
        color: '#ffffff',
        backgroundColor: '#0077aa',
        padding: { x: 20, y: 10 },
      })
      .setOrigin(0.5)
      .setInteractive({ useHandCursor: true })
      .on('pointerdown', () => this.handlePlayClick());

    this.loadingText = this.add
      .text(400, 400, '', { fontSize: '16px', color: '#cccccc' })
      .setOrigin(0.5);
  }

  private async handlePlayClick() {
    this.playButton.disableInteractive();
    this.loadingText.setText('Loading your progress...');

    try {
      if (!this.userData?.token || !this.userData?.userId) {
        this.startInitialAssessment(LEVEL_FLOW[0]);
        return;
      }

      gameAPI.setToken(this.userData.token);
      const response = await gameAPI.getUserProgress(this.userData.userId);

      if (!response?.success || !response.data) {
        this.startInitialAssessment(LEVEL_FLOW[0]);
        return;
      }

      const initial = response.data.initial_assessments?.assessments ?? {};
      const progress = response.data.progress?.progress ?? {};

      for (const level of LEVEL_FLOW) {
        const assessment = initial[level.topic];
        const levelProgress = progress[level.topic];

        // 1️⃣ Initial assessment not done
        if (!assessment?.assessment_completed) {
          this.scene.start('assessment-scene', {
            topic: level.topic,
            nextScene: level.sceneKey,
          });
          return;
        }

        // 2️⃣ Level not completed
        if (!levelProgress?.level_completed) {
          this.scene.start(level.sceneKey);
          return;
        }
      }

      // 🎉 All levels completed
      this.popup.show(
        'All levels completed!',
        ['OK'],
        () => this.playButton.setInteractive()
      );

    } catch (error) {
      console.error('❌ Failed to fetch progress:', error);
      this.startInitialAssessment(LEVEL_FLOW[0]);
    }
  }

  private startInitialAssessment(levelConfig: { topic: string; sceneKey: string }) {
    this.loadingText.setText('Starting new game...');
    this.playButton.setInteractive();

    this.scene.start('assessment-scene', {
      topic: levelConfig.topic,
      nextScene: levelConfig.sceneKey,
    });
  }
}
