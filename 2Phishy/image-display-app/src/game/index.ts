import Phaser, { Game, Types } from 'phaser';
import { LoadingScene, IntegratedLevel1, UIScene, SFBLevel, MainMenuScene } from './scenes';
import { WIN_SCORE } from './consts';

type GameConfigExtended = Types.Core.GameConfig & {
  winScore: number;
};

const gameConfig: GameConfigExtended = {
  title: 'Phaser game tutorial',
  type: Phaser.WEBGL,
  parent: 'game',
  backgroundColor: '#351f1b',
  scale: {
    mode: Phaser.Scale.NONE,
    width: window.innerWidth,
    height: window.innerHeight,
  },
  physics: {
    default: 'arcade',
    arcade: {
      debug: false,
    },
  },
  render: {
    antialiasGL: false,
    pixelArt: true,
  },
  callbacks: {
    postBoot: () => {
      window.sizeChanged();
    },
  },
  canvasStyle: `display: block; width: 100%; height: 100%;`,
  autoFocus: true,
  audio: {
    disableWebAudio: false,
  },
scene: [
  MainMenuScene,
  LoadingScene,
  UIScene,
  IntegratedLevel1,
  SFBLevel
],

  winScore: WIN_SCORE,
};

window.sizeChanged = () => {
  if (window.game.isBooted) {
    setTimeout(() => {
      window.game.scale.resize(window.innerWidth, window.innerHeight);
      window.game.canvas.setAttribute(
        'style',
        `display: block; width: ${window.innerWidth}px; height: ${window.innerHeight}px;`,
      );
    }, 100);
  }
};
window.onresize = () => window.sizeChanged();

window.game = new Game(gameConfig);
export { gameConfig };
