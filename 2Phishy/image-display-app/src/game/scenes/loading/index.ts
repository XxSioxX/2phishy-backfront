import { Scene } from 'phaser';
import {MainMenuScene} from "../mainmenu";
import {SFBLevel} from "../level-1-SFB";
import {PSLevel} from "../level-2-PS";
import {MLevel} from "../level-3-M";
import {SELevel} from "../level-4-SE";
import {IRLevel} from "../level-5-IR";
import {PrologueScene} from "../dialogues/prologue.ts";
import { AdminDevToolsScene } from "../admin-devtools";

export class LoadingScene extends Scene {
  constructor() {
    super('loading-scene');
  }
  preload(): void {
    this.load.baseURL = 'phaser-assets/';
    this.load.json('assessmentData', 'initial_assessment.json');
    this.load.json('se-dialogues', 'se-level_dialogues.json')
    this.load.json('general_dialogues', 'general_dialogues.json');

    this.load.image('king', 'sprites/king.png');
    this.load.atlas('a-king', 'spritesheets/a-king.png', 'spritesheets/a-king_atlas.json');

    // Load the tileset image
    this.load.image('tiles', 'tilemaps/tiles/dungeon-16-16.png');

    // Load the tilemap JSON
    this.load.tilemapTiledJSON('assessmentlevel', 'tilemaps/tilesets/assessment-level.tmj');
    this.load.tilemapTiledJSON('SFBlevel', 'tilemaps/tilesets/SFB-level-1-ver4.tmj');
    this.load.tilemapTiledJSON('PSlevel', 'tilemaps/tilesets/PS-level-2-ver2.tmj');
    this.load.tilemapTiledJSON('Mlevel', 'tilemaps/tilesets/M-level-3-ver2.tmj');
    this.load.tilemapTiledJSON('SElevel', 'tilemaps/tilesets/SE-level-4-ver1.tmj');
    this.load.tilemapTiledJSON('IRlevel', 'tilemaps/tilesets/IR-level-5-ver2.tmj');

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

        console.log(this.cache.json.getKeys());

  }
  create(): void {
    console.log('Loading scene was created');
    this.scene.add("prologue-scene", PrologueScene);
    this.scene.add('main-menu-scene', MainMenuScene);
    this.scene.add('sfb-level-scene', SFBLevel);
    this.scene.add('ps-level-scene', PSLevel);
    this.scene.add('m-level-scene', MLevel);
    this.scene.add('se-level-scene', SELevel);
    this.scene.add('ir-level-scene', IRLevel);
    this.scene.add('admin-devtools-scene', AdminDevToolsScene);

    this.scene.start('main-menu-scene');

    if (this.shouldLaunchAdminDevTools()) {
      this.scene.launch('admin-devtools-scene');
      this.scene.bringToTop('admin-devtools-scene');
    }

    console.log('loading/index.ts (create)', this.textures.exists('tiles'));
  }

  private shouldLaunchAdminDevTools(): boolean {
    const role = String((window as any).userData?.role ?? '').toLowerCase();
    return role === 'admin' || role === 'super-admin';
  }
}
