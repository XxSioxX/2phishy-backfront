import { Scene } from 'phaser';
import { gameAPI } from '../../helpers/game-api';
import AssessmentPopup from "../../helpers/assessment-popup";


export class MainMenuScene extends Scene {
  private playButton!: Phaser.GameObjects.Text;
  private loadingText!: Phaser.GameObjects.Text;
  private userData = (window as any).userData;
  private popup!: AssessmentPopup;


  constructor() {
    super('main-menu-scene');
  }

  create(): void {
    this.popup = new AssessmentPopup(this);


    this.add.text(400, 150, '2Phishy', { fontSize: '48px', color: '#00ffcc' }).setOrigin(0.5);

    this.playButton = this.add.text(400, 300, '▶ Play Game', {
      fontSize: '32px',
      color: '#ffffff',
      backgroundColor: '#0077aa',
      padding: { x: 20, y: 10 },
    })
      .setOrigin(0.5)
      .setInteractive({ useHandCursor: true })
      .on('pointerdown', () => this.handlePlayClick());

    this.loadingText = this.add.text(400, 400, '', { fontSize: '16px', color: '#cccccc' }).setOrigin(0.5);
  }

  private async handlePlayClick() {
    this.playButton.disableInteractive();
    this.loadingText.setText('Loading your progress...');

    const userData = (window as any).userData;

    try {
      if (!userData?.token || !userData?.userId) {
        this.startInitialAssessment();
        return;
      }

      gameAPI.setToken(userData.token);
      const response = await gameAPI.getUserProgress(userData.userId);

      console.log(response);

      if (!response?.success || !response.data) {
        this.startInitialAssessment();
        return;
      }

      const initial = response.data.initial_assessments?.assessments;
      const progress = response.data.progress?.progress;
;

      const sfbAssessment = initial?.['Safe Browsing Practices'];
      const sfbProgress = progress?.['Safe Browsing Practices'];

      const psAssessment = initial?.['Password Security'];
      const psProgress = progress?.['Password Security'];

      const mAssessment = initial?.['Malware'];
      const mProgress = progress?.['Malware'];

      // 1️⃣ Safe Browsing assessment not done
      if (!sfbAssessment?.assessment_completed) {
        this.startInitialAssessment();
        return;
      }

      // 2️⃣ Safe Browsing level not done
      if (!sfbProgress?.level_completed) {
        this.scene.start('sfb-level-scene');
        return;
      }

      // 3️⃣ Password Security assessment not done
      if (!psAssessment?.assessment_completed) {
        this.scene.start('assessment-scene', {
          topic: 'Password Security',
          nextScene: 'ps-level-scene',
        });
        return;
      }

      // 4️⃣ Password Security level not done
      if (!psProgress?.level_completed) {
        this.scene.start('ps-level-scene');
        return;
      }

      if (!mAssessment?.assessment_completed) {
        this.scene.start('assessment-scene', {
          topic: 'Malware',
          nextScene: 'm-level-scene',
        });
        return;
      }

      // 4️⃣ Password Security level not done
      if (!mProgress?.level_completed) {
        this.scene.start('m-level-scene');
        return;
      }

      // 5️⃣ Everything done (future-proof)
      this.popup.show(
        'All levels completed!',
        ['OK'],
        () => this.playButton.setInteractive()
      );

    } catch (error) {
      console.error('❌ Failed to fetch progress:', error);
      this.startInitialAssessment();
    }
  }



  private startInitialAssessment() {
    this.loadingText.setText('Starting new game...');
    this.playButton.setInteractive();

    this.scene.start('assessment-scene', {
      topic: 'Safe Browsing Practices',
      nextScene: 'sfb-level-scene',
    });
  }

}
