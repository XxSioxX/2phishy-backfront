import { Scene } from 'phaser';
import { gameAPI } from '../../helpers/game-api';
import AssessmentPopup from '../../helpers/assessment-popup';
import { LEVEL_FLOW } from '../core/LevelFlow';
import { AudioManager, MUSIC, SFX } from '../../audio';

export class MainMenuScene extends Scene {
  private playButton!: Phaser.GameObjects.Text;
  private loadingText!: Phaser.GameObjects.Text;
  private popup!: AssessmentPopup;
  private userData = (window as any).userData;

  constructor() {
    super('main-menu-scene');
  }

  create(): void {
    AudioManager.playMusic(this, MUSIC.MAIN_MENU);
    const centerX = this.cameras.main.width / 2;
    const centerY = this.cameras.main.height / 2;

    this.popup = new AssessmentPopup(this);

    this.add
      .text(centerX, centerY - 150, '2Phishy', { fontSize: '48px', color: '#00ffcc' })
      .setOrigin(0.5);

    this.playButton = this.add
      .text(centerX, centerY, '▶ Play Game', {
        fontSize: '32px',
        color: '#ffffff',
        backgroundColor: '#0077aa',
        padding: { x: 20, y: 10 },
      })
      .setOrigin(0.5)
      .setInteractive({ useHandCursor: true })
      .on('pointerdown', () => this.handlePlayClick());

    this.loadingText = this.add
      .text(centerX, centerY + 100, '', { fontSize: '16px', color: '#cccccc' })
      .setOrigin(0.5);
  }

  private async handlePlayClick() {
    AudioManager.playSfx(this, SFX.UI_CLICK);
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

      const firstLevel = LEVEL_FLOW[0];
      const firstAssessment = initial[firstLevel.topic];

      if (!firstAssessment?.assessment_completed) {
        this.scene.start("prologue-scene", {
          topic: firstLevel.topic,
          nextScene: firstLevel.sceneKey
        });
        return;
      }

      for (const level of LEVEL_FLOW) {
        const assessment = initial[level.topic];
        const levelProgress = progress[level.topic];

        if (!assessment?.assessment_completed) {
          this.scene.start('assessment-scene', {
            topic: level.topic,
            nextScene: level.sceneKey,
          });
          return;
        }

        if (!levelProgress?.level_completed) {
          this.scene.start(level.sceneKey);
          return;
        }
      }

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
