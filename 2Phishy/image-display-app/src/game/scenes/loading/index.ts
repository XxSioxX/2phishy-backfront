import { Scene } from 'phaser';

export class LoadingScene extends Scene {
  constructor() {
    super('loading-scene');
  }
  preload(): void {
    this.load.baseURL = 'phaser-assets/';
    this.load.json('assessmentData', 'initial_assessment.json');
    this.load.image('king', 'sprites/king.png');
    this.load.atlas('a-king', 'spritesheets/a-king.png', 'spritesheets/a-king_atlas.json');

    // Load the tileset image
    this.load.image('tiles', 'tilemaps/tiles/dungeon-16-16.png');

    // Load the tilemap JSON
    this.load.tilemapTiledJSON('assessmentlevel', 'tilemaps/tilesets/assessment-level.tmj');

    this.load.spritesheet('tiles_spr', 'tilemaps/tiles/dungeon-16-16.png', {
      frameWidth: 16,
      frameHeight: 16,
    });
    // Add error handling
    this.load.on('fileerror', (key: string) => {
      console.error('Failed to load asset:', key);
    });

    // Wait for loading to complete
    this.load.on('complete', () => {
      console.log('All assets loaded successfully');
    });
  }
  create(): void {
    console.log('Loading scene was created');
    // Stop this scene first, then start the main scene
    this.scene.stop('loading-scene');
    this.scene.start('integrated-level-1-scene');
    console.log('loading/index.ts (create)', this.textures.exists('tiles'));
  }
}
