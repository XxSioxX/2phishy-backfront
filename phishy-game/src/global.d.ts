export {}; // Ensures the file is treated as a module
import Phaser from 'phaser';

declare global {
  interface Window {
    sizeChanged: () => void;
    game: Phaser.Game;
  }
}
