import { Scene } from 'phaser';
import { LEVEL_FLOW } from '../core/LevelFlow';
import { gameAPI, AdminRoleResponse } from '../../helpers/game-api';

type ToolButton = Phaser.GameObjects.Rectangle | Phaser.GameObjects.Text | Phaser.GameObjects.Zone;

const ADMIN_ROLES = ['admin', 'super-admin'];

export class AdminDevToolsScene extends Scene {
  private panel?: Phaser.GameObjects.Container;
  private toggleButton?: Phaser.GameObjects.Container;
  private f10Key?: Phaser.Input.Keyboard.Key;
  private isOpen = false;
  private adminRole?: AdminRoleResponse;
  private panelHitZones: Phaser.GameObjects.Zone[] = [];
  private readonly userData = (window as any).userData;

  constructor() {
    super('admin-devtools-scene');
  }

  async create(): Promise<void> {
    this.cameras.main.setScroll(0, 0);
    this.cameras.main.setZoom(1);
    this.cameras.main.setBackgroundColor('rgba(0,0,0,0)');

    if (!this.hasLocalAdminRole()) {
      this.scene.stop();
      return;
    }

    this.adminRole = await this.verifyAdminRole();

    if (!this.adminRole) {
      this.scene.stop();
      return;
    }

    this.createToggleButton();
    this.createPanel();
    this.panel?.setVisible(false);
    this.time.delayedCall(0, () => {
      this.scene.bringToTop(this.scene.key);
    });

    this.f10Key = this.input.keyboard?.addKey(
      Phaser.Input.Keyboard.KeyCodes.F10
    );
    this.f10Key?.on('down', () => this.togglePanel());

    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.f10Key?.removeAllListeners();
    });
  }

  private hasLocalAdminRole(): boolean {
    const role = String(this.userData?.role ?? '').toLowerCase();
    return ADMIN_ROLES.includes(role);
  }

  private async verifyAdminRole(): Promise<AdminRoleResponse | null> {
    if (!this.userData?.token) return null;

    try {
      gameAPI.setToken(this.userData.token);
      const role = await gameAPI.getAdminRole();

      if (!ADMIN_ROLES.includes(String(role.role).toLowerCase())) {
        return null;
      }

      return role;
    } catch (error) {
      console.warn('Admin dev tools disabled:', error);
      return null;
    }
  }

  private createToggleButton(): void {
    const x = this.scale.width - 86;
    const y = 18;

    const bg = this.add
      .rectangle(0, 0, 68, 28, 0x101820, 0.92)
      .setStrokeStyle(1, 0x48d7ff)
      .setOrigin(0);

    const label = this.add.text(34, 14, 'DEV', {
      fontSize: '13px',
      color: '#dff8ff',
      fontStyle: 'bold',
    }).setOrigin(0.5);

    const hit = this.add
      .zone(0, 0, 68, 28)
      .setOrigin(0)
      .setInteractive({ useHandCursor: true })
      .on('pointerdown', () => this.togglePanel());

    this.toggleButton = this.add
      .container(x, y, [bg, label, hit])
      .setScrollFactor(0)
      .setDepth(50000);
  }

  private createPanel(): void {
    const width = 560;
    const height = 420;
    const x = this.scale.width - width - 28;
    const y = 62;

    const bg = this.add
      .rectangle(0, 0, width, height, 0x0b1118, 0.96)
      .setStrokeStyle(2, 0x48d7ff)
      .setOrigin(0);

    const title = this.add.text(22, 18, 'Admin Dev Tools', {
      fontSize: '20px',
      color: '#ffffff',
      fontStyle: 'bold',
    });

    const subtitle = this.add.text(
      22,
      45,
      `${this.adminRole?.username ?? 'admin'} - F10 toggles this panel`,
      {
        fontSize: '12px',
        color: '#8fb5c6',
      }
    );

    const close = this.createButton(
      width - 80,
      16,
      58,
      28,
      'Close',
      () => this.togglePanel(false)
    );

    const buttons: ToolButton[] = [
      bg,
      title,
      subtitle,
      ...close,
      ...this.createButton(22, 82, 154, 34, 'Main Menu', () => {
        this.jumpToScene('main-menu-scene');
      }),
    ];

    LEVEL_FLOW.forEach((level, index) => {
      const rowY = 136 + index * 50;
      const levelNumber = index + 1;
      const label = `L${levelNumber}: ${this.shortTopic(level.topic)}`;

      buttons.push(
        ...this.createButton(22, rowY, 248, 34, label, () => {
          this.jumpToScene(level.sceneKey, {
            topic: level.topic,
          });
        }),
        ...this.createButton(294, rowY, 244, 34, 'Initial Assessment', () => {
          this.jumpToAssessment(level.topic, level.sceneKey);
        })
      );
    });

    const note = this.add.text(
      22,
      height - 42,
      'These tools only route scenes. They do not grant student progress.',
      {
        fontSize: '12px',
        color: '#7b9aaa',
      }
    );

    buttons.push(note);

    this.panel = this.add
      .container(x, y, buttons)
      .setScrollFactor(0)
      .setDepth(50001);
    this.setPanelInteractive(false);
  }

  private createButton(
    x: number,
    y: number,
    width: number,
    height: number,
    label: string,
    onClick: () => void
  ): ToolButton[] {
    const bg = this.add
      .rectangle(x, y, width, height, 0x172333, 0.96)
      .setStrokeStyle(1, 0x38556b)
      .setOrigin(0);

    const text = this.add.text(x + width / 2, y + height / 2, label, {
      fontSize: '13px',
      color: '#ffffff',
      align: 'center',
    }).setOrigin(0.5);

    const hit = this.add
      .zone(x, y, width, height)
      .setOrigin(0)
      .setInteractive({ useHandCursor: true })
      .on('pointerover', () => bg.setFillStyle(0x24364a, 1))
      .on('pointerout', () => bg.setFillStyle(0x172333, 0.96))
      .on('pointerdown', onClick);

    this.panelHitZones.push(hit);

    return [bg, text, hit];
  }

  private togglePanel(force?: boolean): void {
    this.isOpen = force ?? !this.isOpen;
    this.panel?.setVisible(this.isOpen);
    this.setPanelInteractive(this.isOpen);

    if (this.isOpen) {
      this.scene.bringToTop(this.scene.key);
    } else {
      this.parkDevToolsScene();
      this.focusGameCanvas();
    }
  }

  private setPanelInteractive(enabled: boolean): void {
    this.panelHitZones.forEach(zone => {
      if (enabled) {
        zone.setInteractive({ useHandCursor: true });
      } else {
        zone.disableInteractive();
      }
    });
  }

  private jumpToAssessment(topic: string, nextScene: string): void {
    this.togglePanel(false);
    this.stopManagedScenes();
    this.scene.launch('assessment-scene', {
      topic,
      nextScene,
      skipIntro: true,
    });
    this.afterSceneJump('assessment-scene');
  }

  private jumpToScene(sceneKey: string, data: Record<string, unknown> = {}): void {
    this.togglePanel(false);
    this.stopManagedScenes();
    this.scene.launch(sceneKey, {
      ...data,
      skipIntro: true,
      fromDevTools: true,
    });
    this.afterSceneJump(sceneKey);
  }

  private stopManagedScenes(): void {
    this.scene.stop('ui-scene');
    this.scene.stop('prologue-scene');
    this.scene.stop('credits-scene');
    this.scene.stop('assessment-scene');
    this.scene.stop('main-menu-scene');

    LEVEL_FLOW.forEach(level => {
      this.scene.stop(level.sceneKey);
    });
  }

  private afterSceneJump(sceneKey: string): void {
    [0, 180, 700, 1400].forEach(delay => {
      this.time.delayedCall(delay, () => this.recoverSceneInput(sceneKey));
    });
  }

  private recoverSceneInput(sceneKey: string): void {
    const targetScene = this.scene.get(sceneKey);

    if (targetScene?.scene.isPaused()) {
      this.scene.resume(sceneKey);
    }

    if (this.scene.isActive('ui-scene')) {
      this.scene.bringToTop('ui-scene');
    }

    this.parkDevToolsScene();
    this.focusGameCanvas();
  }

  private parkDevToolsScene(): void {
    if (this.isOpen) {
      this.scene.bringToTop(this.scene.key);
      return;
    }

    if (this.scene.isActive('ui-scene')) {
      this.scene.moveBelow(this.scene.key, 'ui-scene');
      return;
    }

    this.scene.bringToTop(this.scene.key);
  }

  private focusGameCanvas(): void {
    const canvas = this.game.canvas;

    if (!canvas) return;

    canvas.setAttribute('tabindex', '0');

    try {
      canvas.focus({ preventScroll: true });
    } catch {
      canvas.focus();
    }
  }

  private shortTopic(topic: string): string {
    if (topic === 'Safe Browsing Practices') return 'Safe Browsing';
    if (topic === 'Password Security') return 'Passwords';
    if (topic === 'Social Engineering') return 'Social Eng';
    if (topic === 'Incident Response') return 'Incident Resp';
    return topic;
  }
}
