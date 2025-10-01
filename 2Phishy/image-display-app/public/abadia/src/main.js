// main.js
import * as Phaser from 'phaser';
import BootScene from './scenes/BootScene.js';
import PreloadScene from './scenes/PreloadScene.js';
import GameScene from './scenes/GameScene.js';
import ScrollScene from './scenes/ScrollScene.js';
import EndScene from './scenes/EndScene.js';

const config = {
  type: Phaser.AUTO,
  pixelart: true,
  scale: {
    mode: Phaser.Scale.NONE,
    parent: 'gameContainer',
    width: 320,
    height: 200,
    zoom: 2
  },
  fps: {
    target: 60,
    forceSetTimeOut: true
  },
  scene: [
    BootScene,
    PreloadScene,
    ScrollScene,
    GameScene,
    EndScene
  ]
};

const game = new Phaser.Game(config);