import { Scene } from 'phaser';
import { WIN_SCORE } from '../../consts';

export class UIScene extends Scene {
  constructor() {
    super('ui-scene');
  }

  create(): void {
    console.log('UI Scene created');
    this.initListeners();
  }

  private initListeners(): void {
    // Listen for chest loot event
    this.game.events.on('chest-loot', (score: number) => {
      console.log(`Chest looted! Score: ${score}`);
      if (score >= WIN_SCORE) {
        console.log('Player wins!');
        // Handle win logic here
      }
    });
  }
}
