import Phaser, { Game, Types } from 'phaser';
import { LoadingScene } from './scenes';
import { IntegratedLevel1 } from './scenes/level-1';

type GameConfigExtended = Types.Core.GameConfig & {
  winScore: number;
  userData?: {
    userId: string;
    username: string;
    token: string;
  };
};

// Global interface for user data
declare global {
  interface Window {
    game: Game;
    sizeChanged: () => void;
    userData?: {
      userId: string;
      username: string;
      token: string;
    };
  }
}

export const createPhaserGame = (parentElement: HTMLElement, userData?: any): Game => {
  console.log('Creating Phaser game with fixed 800x600 ratio');
  console.log('Parent element:', parentElement);

  const gameConfig: GameConfigExtended = {
    title: 'Phishy Assessment Game',
    type: Phaser.AUTO,
    parent: parentElement,
    backgroundColor: '#000000',
    scale: {
      mode: Phaser.Scale.FIT,
      autoCenter: Phaser.Scale.CENTER_BOTH,
      width: 800,   // base width
      height: 600,  // base height
    },
    physics: {
      default: 'arcade',
      arcade: {
        debug: false,
      },
    },
    render: {
      pixelArt: true,
    },
    canvasStyle: `display: block; margin: auto;`,
    autoFocus: true,
    input: {
      keyboard: true,
      mouse: true,
      touch: true,
    },
    audio: {
      disableWebAudio: false,
    },
    scene: [LoadingScene, IntegratedLevel1],
    winScore: 40,
    userData: userData,
  };

  // Store user data globally for access by scenes
  if (userData) {
    window.userData = userData;
  }

  // Simplified resize handler
  window.sizeChanged = () => {
    if (window.game && window.game.isBooted) {
      // With FIT mode, Phaser handles the scaling automatically
      // Just ensure the canvas stays centered
      if (window.game.canvas) {
        window.game.canvas.style.display = 'block';
        window.game.canvas.style.margin = 'auto';
      }
    }
  };

  window.onresize = () => window.sizeChanged();

  const game = new Game(gameConfig);
  window.game = game;
  
  return game;
};

