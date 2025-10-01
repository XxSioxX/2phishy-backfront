import { GameObjects, Scene, Tilemaps } from 'phaser';
import { Player } from '../../classes/player';
import { gameObjectsToObjectPoints } from '../../helpers/gameobject-to-object-point';
import { Enemy } from '../../classes/enemy';

export class Level1 extends Scene {
  private king!: GameObjects.Sprite;
  private player!: Player;
  private chests!: Phaser.GameObjects.Sprite[];
  private enemies!: Enemy[];

  private map!: Tilemaps.Tilemap;
  private tileset!: Tilemaps.Tileset;
  private wallsLayer!: Tilemaps.TilemapLayer;
  private groundLayer!: Tilemaps.TilemapLayer;

  constructor() {
    super('level-1-scene');
  }
  create(): void {
    console.log('level 1 (create): level-1');
    this.initMap();
    this.player = new Player(this, 100, 100);

    this.physics.add.collider(this.player, this.wallsLayer);
    this.setupChestCollisions();
    this.initCamera();
    this.initEnemies();
  }
  update(): void {
    this.player.update();
  }
  private initMap(): void {
    // Check if tilemap exists before creating
    if (!this.cache.tilemap.exists('dungeon')) {
      throw new Error("Tilemap 'dungeon' was not preloaded correctly");
    }

    this.map = this.make.tilemap({ key: 'dungeon', tileWidth: 16, tileHeight: 16 });

    // More detailed logging
    console.log('Tilemap data:', this.map.tilesets);

    // Safer tileset addition
    const tilesetName = this.map.tilesets.find((t) => t.name === 'dungeon');
    if (!tilesetName) {
      throw new Error(
        `No tileset found with name 'dungeon'. Available tilesets: ${this.map.tilesets.map((t) => t.name)}`,
      );
    }

    this.tileset = this.map.addTilesetImage('dungeon', 'tiles')!;
    if (!this.tileset) {
      throw new Error('Failed to add tileset. Check tileset and texture keys.');
    }

    // Safer layer creation
    const groundLayer = this.map.getLayer('Ground');
    const wallsLayer = this.map.getLayer('Walls');

    if (!groundLayer || !wallsLayer) {
      throw new Error(`Layer not found. Available layers: ${this.map.layers.map((l) => l.name)}`);
    }

    this.groundLayer = this.map.createLayer('Ground', this.tileset, 0, 0)!;
    this.wallsLayer = this.map.createLayer('Walls', this.tileset, 0, 0)!;
    this.wallsLayer.setCollisionByProperty({ collides: true });

    this.initChests();
  }
  private initChests(): void {
    const chestPoints = gameObjectsToObjectPoints(
      this.map.filterObjects('Chests', (obj) => obj.name === 'ChestPoint')!,
    );
    console.log('Chests:', chestPoints);

    this.chests = chestPoints.map((chestPoint) =>
      this.physics.add.sprite(chestPoint.x, chestPoint.y, 'tiles_spr', 595).setScale(1.5),
    );
  }
  private setupChestCollisions(): void {
    this.chests.forEach((chest) => {
      this.physics.add.overlap(this.player, chest, (obj1, obj2) => {
        obj2.destroy();
        this.cameras.main.flash();
      });
    });
  }

  private showDebugWalls(): void {
    const debugGraphics = this.add.graphics().setAlpha(0.7);
    this.wallsLayer.renderDebug(debugGraphics, {
      tileColor: null,
      collidingTileColor: new Phaser.Display.Color(243, 234, 48, 255),
    });
  }

  private initCamera(): void {
    this.cameras.main.setSize(this.game.scale.width, this.game.scale.height);
    this.cameras.main.startFollow(this.player, true, 0.09, 0.09);
    this.cameras.main.setZoom(2);
  }

  private initEnemies(): void {
    const enemiesPoints = gameObjectsToObjectPoints(
      this.map.filterObjects('Enemies', (obj) => obj.name === 'EnemyPoint')!,
    )!;
    this.enemies = enemiesPoints.map((enemyPoint) =>
      new Enemy(this, enemyPoint.x, enemyPoint.y, 'tiles_spr', this.player, 503)
        .setName(enemyPoint.id.toString())
        .setScale(1.5),
    );
    this.physics.add.collider(this.enemies, this.wallsLayer);
    this.physics.add.collider(this.enemies, this.enemies);
    this.physics.add.collider(this.player, this.enemies, (obj1, obj2) => {
      (obj1 as Player).getDamage(1);
    });
  }
}
