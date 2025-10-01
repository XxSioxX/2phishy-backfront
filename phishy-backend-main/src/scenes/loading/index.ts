import { Scene, GameObjects } from 'phaser';

export class LoadingScene extends Scene {
  private king!: GameObjects.Sprite;
  constructor() {
    super('loading-scene');
  }
  preload(): void {
    this.load.baseURL = 'assets/';
    // key: 'king'
    // path from baseURL to file: 'sprites/king.png'
    this.load.image('king', 'sprites/king.png');

    this.load.atlas('a-king', 'spritesheets/a-king.png', 'spritesheets/a-king_atlas.json');
    const image = new Image();
    image.src = 'assets/tilemaps/tiles/dungeon-16-16.png';
    image.onload = () => console.log('✅ Image loaded:', image.src);
    image.onerror = () => console.error('❌ Failed to load:', image.src);

    this.load.image({
      key: 'tiles',
      url: 'tilemaps/tiles/dungeon-16-16.png',
    });

    this.load.tilemapTiledJSON('dungeon', 'tilemaps/json/dungeon.tmj');

    this.load.spritesheet('tiles_spr', 'tilemaps/tiles/dungeon-16-16.png', {
      frameWidth: 16,
      frameHeight: 16,
    });
  }
  create(): void {
    console.log('Loading scene was created');
    this.scene.start('level-1-scene');
    console.log('loading/index.ts (create)', this.textures.exists('tiles'));
    this.scene.start('ui-scene');
  }
}
