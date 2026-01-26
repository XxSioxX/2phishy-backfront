import { Scene } from 'phaser';
import {MainMenuScene} from "../mainmenu";
import {SFBLevel} from "../level-1-SFB";

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
    this.load.tilemapTiledJSON('SFBlevel', 'tilemaps/tilesets/SFB-level-1-ver3.tmj');

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
    this.scene.add('main-menu-scene', MainMenuScene);
    this.scene.add('sfb-level-scene', SFBLevel);
    this.scene.start('main-menu-scene');
    console.log('loading/index.ts (create)', this.textures.exists('tiles'));
  }
}
