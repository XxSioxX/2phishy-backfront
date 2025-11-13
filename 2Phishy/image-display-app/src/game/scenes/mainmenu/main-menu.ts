import { Scene } from 'phaser';
import { gameAPI } from '../../helpers/game-api';
import AssessmentPopup from "../../helpers/assessment-popup";
import {Player} from "../../classes/player";
import {IntegratedLevel1} from "../level1";

export class MainMenuScene extends Scene {
  private playButton!: Phaser.GameObjects.Text;
  private loadingText!: Phaser.GameObjects.Text;
  private userData = (window as any).userData;
  private popup!: AssessmentPopup;
  private player!: Player;

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
    let progress = null;
    const userData = (window as any).userData;
    try {
      if (userData?.token && userData?.userId) {
        gameAPI.setToken(userData.token);
        progress = await gameAPI.getUserProgress(userData.userId);
        console.log('📊 User progress:', progress);
      } else {
        console.warn('⚠️ User not logged in. Starting new game.');
      }


    if (progress && progress.success) {
      console.log('Received response, checking progress');


        const hasProgression = progress?.data && Object.prototype.hasOwnProperty.call(progress.data, 'progression' )
        if (hasProgression) {

        } else {
          console.log('No progress yet, starting with level 1')
          this.loadingText.setText('Continuing');
          this.playButton.setInteractive();
          this.scene.start('sfb-level-scene');
        }
      } else {
        this.loadingText.setText('No user progress yet, starting new game');
        this.playButton.setInteractive();
        this.scene.start('integrated-level-1-scene');
      }

    } catch (error) {
      console.error(' Failed to fetch progress:', error);
      this.loadingText.setText('No user progress yet, starting new game');
      this.playButton.setInteractive();
      this.scene.start('integrated-level-1-scene');
    }
  }

  private async checkUserProgress(){
    try {
      if (!this.userData || !this.userData.token || !this.userData.userId) {
        console.warn('User not logged in. Results stored locally.');
        this.popup.show(
          'Please log in to save your progress.',
          ['OK'],
          () => this.player.unfreeze()
        );
        return;
      }
      const response = await gameAPI.getUserProgress(this.userData.userId);
      if (!response?.data) {
        console.warn('User has no data, starting SFB initial assessment');
        this.scene.start('integrated-level-1-scene');
        return;
      }

      const progressData = response.data;
      const assessments = progressData.assessments || {};
      const safeBrowsing = assessments['Safe Browsing Practices'];

      if (!safeBrowsing) {
        console.warn('No Safe Browsing record, starting new assessment');
        this.scene.start('integrated-level-1-scene');
        return;
      }

      const questionMap = safeBrowsing.question_map;
      if (Array.isArray(questionMap) && questionMap.length > 0) {
        console.log('Safe Browsing question map:', questionMap);
        this.scene.start('sfb-level-scene');
      } else {
        console.warn(' No question map content, initializing SFB content');
        await gameAPI.getUserQuestionMap({
          userid: this.userData.userId,
          topic: "Safe Browsing Practices"});
        this.scene.start('sfb-level-scene');
      }
    } catch (error) {
      console.error(error);
    }
  }
}
