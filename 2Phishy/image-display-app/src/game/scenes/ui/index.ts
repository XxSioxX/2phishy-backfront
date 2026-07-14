import { Player } from "../../classes/player";
import { TOUCH_EVENTS } from "../../consts";
import { AudioManager, SFX } from "../../audio";
import type { AudioVolumeKind } from "../../audio";

type UISceneData = {
  player: Player;
  showControls?: boolean;
  showQuestionUI?: boolean;
};

type TouchButton = {
  container: Phaser.GameObjects.Container;
  hit: Phaser.GameObjects.Arc;
  label: Phaser.GameObjects.Text;
};

type Direction = 'up' | 'down' | 'left' | 'right';

const DPAD_IDLE_FILL = { color: 0x0b121a, alpha: 0.74 };
const DPAD_ACTIVE_FILL = { color: 0x1d4f61, alpha: 0.92 };
const ACTION_IDLE_FILL = { color: 0x0b121a, alpha: 0.82 };
const ACTION_ACTIVE_FILL = { color: 0x1d4f61, alpha: 0.96 };

export class UIScene extends Phaser.Scene {
  private player!: Player;
  private questionText?: Phaser.GameObjects.Text;
  private questionBackground?: Phaser.GameObjects.Rectangle;
  private questionContainer?: Phaser.GameObjects.Container;
  private totalQuestions = 0;
  private healthContainer?: Phaser.GameObjects.Container;
  private healthIcons: Phaser.GameObjects.Sprite[] = [];
  private controlsContainer?: Phaser.GameObjects.Container;
  private dpadButtons: Partial<Record<Direction, TouchButton>> = {};
  private dpadDragZone?: Phaser.GameObjects.Zone;
  private activeDirectionPointers = new Map<number, Direction>();
  private activeDpadPointerId?: number;
  private dpadButtonRadius = 28;
  private dpadCenterX = 0;
  private dpadCenterY = 0;
  private dpadDeadZoneRadius = 16;
  private buttonRadius = 42;
  private blockButton?: TouchButton;
  private interactButton?: TouchButton;
  private continueButton?: TouchButton;
  private controlsEnabled = false;
  private preventCanvasTouchDefault?: (event: TouchEvent) => void;
  private movementTutorialContainer?: Phaser.GameObjects.Container;
  private movementTutorialShown = false;
  private pauseButton?: Phaser.GameObjects.Container;
  private settingsContainer?: Phaser.GameObjects.Container;
  private pausedSceneKeys: string[] = [];
  private settingsOpen = false;
  private readonly handleWindowBlur = (): void => {
    this.clearDirectionalMovement();
  };
  private readonly handleVisibilityChange = (): void => {
    if (document.hidden) this.clearDirectionalMovement();
  };
  private readonly handleDomTouchEnd = (event: TouchEvent): void => {
    if (event.touches.length === 0) this.clearDirectionalMovement();
  };

  constructor() {
    super({ key: 'ui-scene' });
  }

  create(data: UISceneData): void {
    this.player = data.player;
    this.controlsEnabled = data.showControls === true;

    this.cameras.main.setScroll(0, 0);
    this.cameras.main.setZoom(1);
    this.cameras.main.setBackgroundColor('rgba(0,0,0,0)');

    if (data.showQuestionUI !== false) {
      this.createQuestionUI();
      this.registerQuestionEvents();
    }

    this.registerHealthEvents();
    this.createPauseButton();
    this.registerPauseInput();

    if (this.controlsEnabled) {
      this.input.addPointer(4);
      this.createTouchControls();
    }

    const movementTutorialHandler = () => this.showMovementTutorial();
    this.game.events.on('movement-tutorial:show', movementTutorialHandler);

    this.scale.on(Phaser.Scale.Events.RESIZE, this.handleResize, this);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.game.events.off('movement-tutorial:show', movementTutorialHandler);
      this.scale.off(Phaser.Scale.Events.RESIZE, this.handleResize, this);
      this.movementTutorialContainer?.destroy(true);
      this.closeSettingsMenu(false);
      this.player?.clearTouchMovement();
    });

    this.layoutUI();
  }

  private registerQuestionEvents(): void {
    const initHandler = (total: number, answered: number) => {
      this.totalQuestions = total;
      this.updateQuestionUI(answered);
    };

    const updateHandler = (total: number, answered: number) => {
      this.totalQuestions = total;
      this.updateQuestionUI(answered);
    };

    this.game.events.on('questions:init', initHandler);
    this.game.events.on('questions:update', updateHandler);

    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.game.events.off('questions:init', initHandler);
      this.game.events.off('questions:update', updateHandler);
    });
  }

  private registerHealthEvents(): void {
    const initHandler = (current: number, max: number) => {
      this.createHealthUI(max);
      this.updateHealthUI(current);
    };

    const updateHandler = (current: number) => {
      this.updateHealthUI(current);
    };

    const hideHandler = () => {
      this.healthContainer?.destroy(true);
      this.healthContainer = undefined;
      this.healthIcons = [];
    };

    this.game.events.on('health:init', initHandler);
    this.game.events.on('health:update', updateHandler);
    this.game.events.on('health:hide', hideHandler);

    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.game.events.off('health:init', initHandler);
      this.game.events.off('health:update', updateHandler);
      this.game.events.off('health:hide', hideHandler);
    });
  }

  private createPauseButton(): void {
    this.pauseButton?.destroy(true);

    this.pauseButton = this.add.container(0, 0)
      .setScrollFactor(0)
      .setDepth(10020);

    const hit = this.add.rectangle(0, 0, 92, 38, 0x07111c, 0.88)
      .setStrokeStyle(2, 0x7de3ff, 0.86)
      .setInteractive({ useHandCursor: true });
    const label = this.add.text(0, 0, 'MENU', {
      fontFamily: 'Arial, Helvetica, sans-serif',
      fontSize: '14px',
      color: '#ffffff',
      fontStyle: 'bold',
      align: 'center',
    }).setOrigin(0.5);

    hit.on('pointerdown', () => {
      AudioManager.playSfx(this, SFX.UI_CLICK);
      this.toggleSettingsMenu();
    });
    hit.on('pointerover', () => hit.setFillStyle(0x123040, 0.94));
    hit.on('pointerout', () => hit.setFillStyle(0x07111c, 0.88));

    this.pauseButton.add([hit, label]);
  }

  private registerPauseInput(): void {
    const escapeHandler = (event: KeyboardEvent) => {
      if (this.shouldIgnorePauseKey(event)) return;

      event.preventDefault();
      if (!this.settingsOpen) AudioManager.playSfx(this, SFX.UI_CLICK);
      this.toggleSettingsMenu();
    };

    this.input.keyboard?.on('keydown-ESC', escapeHandler);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.input.keyboard?.off('keydown-ESC', escapeHandler);
    });
  }

  private shouldIgnorePauseKey(event: KeyboardEvent): boolean {
    const target = event.target as HTMLElement | null;
    if (!target) return false;

    const tagName = target.tagName.toLowerCase();
    return (
      tagName === 'input' ||
      tagName === 'textarea' ||
      tagName === 'select' ||
      target.isContentEditable
    );
  }

  private createTouchControls(): void {
    this.controlsContainer?.destroy(true);

    this.controlsContainer = this.add.container(0, 0)
      .setScrollFactor(0)
      .setDepth(10000);

    this.dpadButtons = {
      up: this.createDirectionButton('^', 'up'),
      down: this.createDirectionButton('v', 'down'),
      left: this.createDirectionButton('<', 'left'),
      right: this.createDirectionButton('>', 'right'),
    };
    this.createDpadDragZone();

    this.blockButton = this.createTouchButton('BLOCK', () => {
      this.player.triggerBlock();
    });
    this.interactButton = this.createTouchButton('ACT', () => {
      this.game.events.emit(TOUCH_EVENTS.interact);
    });
    this.continueButton = this.createTouchButton('NEXT', () => {
      this.game.events.emit(TOUCH_EVENTS.continue);
    });

    this.input.on('pointerup', this.handleDirectionalPointerRelease, this);
    this.input.on('pointermove', this.handleDpadPointerMove, this);
    this.input.on('pointerupoutside', this.handleDirectionalPointerRelease, this);
    this.input.on('pointercancel', this.handleDirectionalPointerRelease, this);
    this.input.on('gameout', this.handleGameOut, this);
    this.installCanvasTouchGuards();

    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.input.off('pointerup', this.handleDirectionalPointerRelease, this);
      this.input.off('pointermove', this.handleDpadPointerMove, this);
      this.input.off('pointerupoutside', this.handleDirectionalPointerRelease, this);
      this.input.off('pointercancel', this.handleDirectionalPointerRelease, this);
      this.input.off('gameout', this.handleGameOut, this);
      this.uninstallCanvasTouchGuards();
      this.clearDirectionalMovement();
    });
  }

  private createDirectionButton(
    label: string,
    direction: Direction
  ): TouchButton {
    const container = this.add.container(0, 0)
      .setScrollFactor(0)
      .setDepth(10005);
    const hit = this.add.circle(0, 0, 28, DPAD_IDLE_FILL.color, DPAD_IDLE_FILL.alpha)
      .setStrokeStyle(2, 0x7de3ff, 0.82);
    const labelText = this.add.text(0, 0, label, {
      fontSize: '18px',
      color: '#ffffff',
      fontStyle: 'bold',
      align: 'center',
    }).setOrigin(0.5);
    const touchZone = this.add.circle(0, 0, 44, 0xffffff, 0.001)
      .setData('direction', direction);

    container.add([hit, labelText, touchZone]);
    this.controlsContainer?.add(container);

    return {
      container,
      hit,
      label: labelText,
    };
  }

  private createDpadDragZone(): void {
    this.dpadDragZone?.destroy();

    this.dpadDragZone = this.add.zone(0, 0, 1, 1)
      .setOrigin(0.5)
      .setScrollFactor(0)
      .setDepth(10008)
      .setInteractive({ useHandCursor: true });

    this.dpadDragZone.on('pointerdown', (pointer: Phaser.Input.Pointer) => {
      this.activeDpadPointerId = pointer.id;
      this.updateDpadPointerDirection(pointer);
    });
    this.dpadDragZone.on('pointermove', (pointer: Phaser.Input.Pointer) => {
      if (this.activeDpadPointerId === pointer.id) {
        this.updateDpadPointerDirection(pointer);
      }
    });
    this.dpadDragZone.on('pointerup', this.handleDirectionalPointerRelease, this);
    this.dpadDragZone.on('pointerupoutside', this.handleDirectionalPointerRelease, this);
    this.dpadDragZone.on('pointercancel', this.handleDirectionalPointerRelease, this);
  }

  private createTouchButton(
    label: string,
    onPress: () => void
  ): TouchButton {
    const container = this.add.container(0, 0)
      .setScrollFactor(0)
      .setDepth(10005);
    const hit = this.add.circle(0, 0, 42, ACTION_IDLE_FILL.color, ACTION_IDLE_FILL.alpha)
      .setStrokeStyle(3, 0x7de3ff, 0.88);
    const labelText = this.add.text(0, 0, label, {
      fontSize: label.length > 4 ? '11px' : '14px',
      color: '#ffffff',
      fontStyle: 'bold',
      align: 'center',
    }).setOrigin(0.5);
    const touchZone = this.add.circle(0, 0, 54, 0xffffff, 0.001)
      .setInteractive({ useHandCursor: true });

    const press = () => {
      AudioManager.playSfx(
        this,
        label === 'ACT' ? SFX.INTERACT_CONFIRM : SFX.UI_CLICK
      );
      hit.setFillStyle(ACTION_ACTIVE_FILL.color, ACTION_ACTIVE_FILL.alpha);
      this.tweens.add({
        targets: container,
        scale: container.scale * 0.94,
        duration: 55,
        yoyo: true,
      });
      onPress();
    };
    const release = () => {
      hit.setFillStyle(ACTION_IDLE_FILL.color, ACTION_IDLE_FILL.alpha);
    };

    touchZone.on('pointerdown', press);
    touchZone.on('pointerup', release);
    touchZone.on('pointerout', release);
    touchZone.on('pointerupoutside', release);
    touchZone.on('pointercancel', release);

    container.add([hit, labelText, touchZone]);
    this.controlsContainer?.add(container);

    return {
      container,
      hit,
      label: labelText,
    };
  }

  private toggleSettingsMenu(): void {
    if (this.settingsOpen) {
      this.closeSettingsMenu();
      return;
    }

    this.openSettingsMenu();
  }

  private openSettingsMenu(): void {
    if (this.settingsOpen) return;

    this.settingsOpen = true;
    this.clearDirectionalMovement();
    this.pauseGameplayScenes();
    this.movementTutorialContainer?.destroy(true);
    this.movementTutorialContainer = undefined;

    const width = this.cameras.main.width;
    const height = this.cameras.main.height;
    const panelWidth = Math.min(520, Math.max(300, width - 40));
    const panelHeight = Math.min(390, Math.max(330, height - 40));
    const panelX = width / 2;
    const panelY = height / 2;
    const top = panelY - panelHeight / 2;
    const bottom = panelY + panelHeight / 2;

    const container = this.add.container(0, 0)
      .setScrollFactor(0)
      .setDepth(20000);

    const blocker = this.add.rectangle(width / 2, height / 2, width, height, 0x000000, 0.54)
      .setInteractive({ useHandCursor: false });
    const panel = this.add.rectangle(panelX, panelY, panelWidth, panelHeight, 0x07111c, 0.97)
      .setStrokeStyle(3, 0x7de3ff, 0.9);
    const title = this.add.text(panelX, top + 42, 'Paused', {
      fontFamily: 'Arial, Helvetica, sans-serif',
      fontSize: '26px',
      color: '#ffffff',
      fontStyle: 'bold',
      align: 'center',
    }).setOrigin(0.5).setResolution(2);
    const hint = this.add.text(panelX, top + 80, 'Adjust game audio', {
      fontFamily: 'Arial, Helvetica, sans-serif',
      fontSize: '14px',
      color: '#b7c7d6',
      align: 'center',
    }).setOrigin(0.5).setResolution(2);

    const closeButton = this.createSettingsActionButton(
      panelX + panelWidth / 2 - 34,
      top + 30,
      34,
      30,
      'X',
      () => this.closeSettingsMenu()
    );
    const resumeButton = this.createSettingsActionButton(
      panelX,
      bottom - 40,
      Math.min(220, panelWidth - 72),
      44,
      'Resume',
      () => this.closeSettingsMenu()
    );

    container.add([blocker, panel, title, hint]);
    this.createVolumeRow(container, panelX, top + 122, panelWidth, 'Master', 'master');
    this.createVolumeRow(container, panelX, top + 192, panelWidth, 'Music', 'music');
    this.createVolumeRow(container, panelX, top + 262, panelWidth, 'Sound Effects', 'sfx');
    container.add([...closeButton, ...resumeButton]);

    this.settingsContainer = container;
    container.setAlpha(0);
    this.tweens.add({
      targets: container,
      alpha: 1,
      duration: 120,
      ease: 'Sine.easeOut',
    });
  }

  private closeSettingsMenu(playSound = true): void {
    if (!this.settingsOpen) return;

    this.settingsOpen = false;
    if (playSound) AudioManager.playSfx(this, SFX.POPUP_CLOSE);

    this.settingsContainer?.destroy(true);
    this.settingsContainer = undefined;
    this.resumePausedScenes();
  }

  private createVolumeRow(
    container: Phaser.GameObjects.Container,
    panelX: number,
    rowY: number,
    panelWidth: number,
    label: string,
    kind: AudioVolumeKind
  ): void {
    const settings = AudioManager.getVolumeSettings();
    const left = panelX - panelWidth / 2 + 36;
    const right = panelX + panelWidth / 2 - 36;
    const trackWidth = Math.max(150, panelWidth - 104);
    const trackX = panelX;
    const trackY = rowY + 28;
    const trackLeft = trackX - trackWidth / 2;

    const labelText = this.add.text(left, rowY, label, {
      fontFamily: 'Arial, Helvetica, sans-serif',
      fontSize: '15px',
      color: '#ffffff',
      fontStyle: 'bold',
    }).setOrigin(0, 0.5).setResolution(2);
    const valueText = this.add.text(right, rowY, this.formatVolume(settings[kind]), {
      fontFamily: 'Arial, Helvetica, sans-serif',
      fontSize: '14px',
      color: '#b7c7d6',
      align: 'right',
    }).setOrigin(1, 0.5).setResolution(2);
    const track = this.add.rectangle(trackX, trackY, trackWidth, 8, 0x162838, 1)
      .setInteractive(
        new Phaser.Geom.Rectangle(-trackWidth / 2, -13, trackWidth, 26),
        Phaser.Geom.Rectangle.Contains
      );
    const fill = this.add.rectangle(trackLeft, trackY, trackWidth, 8, 0x7de3ff, 1)
      .setOrigin(0, 0.5)
      .setScale(settings[kind], 1);
    const knob = this.add.circle(trackLeft + trackWidth * settings[kind], trackY, 11, 0xffffff, 1)
      .setStrokeStyle(2, 0x7de3ff, 1)
      .setInteractive({ useHandCursor: true });

    const sync = (value: number) => {
      const clamped = Phaser.Math.Clamp(value, 0, 1);
      fill.setScale(clamped, 1);
      knob.setPosition(trackLeft + trackWidth * clamped, trackY);
      valueText.setText(this.formatVolume(clamped));
    };
    const updateFromPointer = (pointer: Phaser.Input.Pointer) => {
      const value = (pointer.x - trackLeft) / trackWidth;
      const clamped = Phaser.Math.Clamp(value, 0, 1);
      AudioManager.setVolume(kind, clamped);
      sync(clamped);
    };
    const updateWhileDragging = (pointer: Phaser.Input.Pointer) => {
      if (pointer.isDown) updateFromPointer(pointer);
    };

    track.on('pointerdown', updateFromPointer);
    track.on('pointermove', updateWhileDragging);
    knob.on('pointerdown', updateFromPointer);
    knob.on('pointermove', updateWhileDragging);
    knob.on('pointerup', () => AudioManager.playSfx(this, SFX.UI_CLICK));

    container.add([labelText, valueText, track, fill, knob]);
  }

  private createSettingsActionButton(
    x: number,
    y: number,
    width: number,
    height: number,
    label: string,
    onPress: () => void
  ): Phaser.GameObjects.GameObject[] {
    const hit = this.add.rectangle(x, y, width, height, 0x0e2330, 0.96)
      .setStrokeStyle(2, 0x7de3ff, 0.86)
      .setInteractive({ useHandCursor: true });
    const text = this.add.text(x, y, label, {
      fontFamily: 'Arial, Helvetica, sans-serif',
      fontSize: label.length > 1 ? '16px' : '15px',
      color: '#ffffff',
      fontStyle: 'bold',
      align: 'center',
    }).setOrigin(0.5).setResolution(2);

    hit.on('pointerdown', onPress);
    hit.on('pointerover', () => hit.setFillStyle(0x1c4658, 0.98));
    hit.on('pointerout', () => hit.setFillStyle(0x0e2330, 0.96));

    return [hit, text];
  }

  private pauseGameplayScenes(): void {
    this.pausedSceneKeys = this.scene.manager
      .getScenes<Phaser.Scene[]>(true)
      .filter(scene => scene.scene.key !== this.scene.key)
      .map(scene => scene.scene.key);

    this.pausedSceneKeys.forEach(sceneKey => {
      this.scene.pause(sceneKey);
    });
  }

  private resumePausedScenes(): void {
    this.pausedSceneKeys.forEach(sceneKey => {
      const scene = this.scene.get(sceneKey);
      if (scene?.scene.isPaused()) {
        this.scene.resume(sceneKey);
      }
    });
    this.pausedSceneKeys = [];
  }

  private formatVolume(value: number): string {
    return `${Math.round(value * 100)}%`;
  }

  private activateDirectionPointer(
    pointer: Phaser.Input.Pointer,
    direction: Direction
  ): void {
    this.dismissMovementTutorial();
    this.activeDirectionPointers.set(pointer.id, direction);
    this.updateDpadButtonStates();
    this.updateDirectionalMovement();
  }

  private handleDirectionalPointerRelease(pointer: Phaser.Input.Pointer): void {
    if (this.activeDpadPointerId === pointer.id) {
      this.activeDpadPointerId = undefined;
    }

    if (!this.activeDirectionPointers.delete(pointer.id)) return;

    this.updateDpadButtonStates();
    this.updateDirectionalMovement();
  }

  private handleDpadPointerMove(pointer: Phaser.Input.Pointer): void {
    if (this.activeDpadPointerId !== pointer.id) return;

    this.updateDpadPointerDirection(pointer);
  }

  private updateDpadPointerDirection(pointer: Phaser.Input.Pointer): void {
    this.dismissMovementTutorial();

    const dx = pointer.x - this.dpadCenterX;
    const dy = pointer.y - this.dpadCenterY;

    if (Math.hypot(dx, dy) < this.dpadDeadZoneRadius) {
      this.activeDirectionPointers.delete(pointer.id);
      this.updateDpadButtonStates();
      this.updateDirectionalMovement();
      return;
    }

    const direction: Direction = Math.abs(dx) > Math.abs(dy)
      ? dx > 0 ? 'right' : 'left'
      : dy > 0 ? 'down' : 'up';

    this.activeDirectionPointers.set(pointer.id, direction);
    this.updateDpadButtonStates();
    this.updateDirectionalMovement();
  }

  private updateDpadButtonStates(): void {
    const activeDirections = new Set(this.activeDirectionPointers.values());

    Object.entries(this.dpadButtons).forEach(([direction, button]) => {
      if (!button) return;

      const isActive = activeDirections.has(direction as Direction);
      const fill = isActive ? DPAD_ACTIVE_FILL : DPAD_IDLE_FILL;
      button.hit.setFillStyle(fill.color, fill.alpha);
    });
  }

  private handleGameOut(): void {
    if (this.activeDirectionPointers.size === 0) {
      this.clearDirectionalMovement();
    }
  }

  private updateDirectionalMovement(): void {
    let x = 0;
    let y = 0;

    this.activeDirectionPointers.forEach(direction => {
      if (direction === 'left') x -= 1;
      if (direction === 'right') x += 1;
      if (direction === 'up') y -= 1;
      if (direction === 'down') y += 1;
    });

    this.player.setTouchMovement(
      Phaser.Math.Clamp(x, -1, 1),
      Phaser.Math.Clamp(y, -1, 1)
    );
  }

  private clearDirectionalMovement(): void {
    this.activeDpadPointerId = undefined;
    this.activeDirectionPointers.clear();
    this.player.clearTouchMovement();
    this.updateDpadButtonStates();
  }

  private installCanvasTouchGuards(): void {
    if (this.preventCanvasTouchDefault) return;

    this.preventCanvasTouchDefault = event => {
      event.preventDefault();
    };

    this.game.canvas.addEventListener(
      'touchstart',
      this.preventCanvasTouchDefault,
      { passive: false }
    );
    this.game.canvas.addEventListener(
      'touchmove',
      this.preventCanvasTouchDefault,
      { passive: false }
    );
    this.game.canvas.addEventListener(
      'touchend',
      this.preventCanvasTouchDefault,
      { passive: false }
    );
    this.game.canvas.addEventListener(
      'touchcancel',
      this.preventCanvasTouchDefault,
      { passive: false }
    );
    window.addEventListener('touchend', this.handleDomTouchEnd, { passive: true });
    window.addEventListener('touchcancel', this.handleDomTouchEnd, { passive: true });
    window.addEventListener('blur', this.handleWindowBlur);
    window.addEventListener('pagehide', this.handleWindowBlur);
    document.addEventListener('visibilitychange', this.handleVisibilityChange);
  }

  private uninstallCanvasTouchGuards(): void {
    if (!this.preventCanvasTouchDefault) return;

    this.game.canvas.removeEventListener(
      'touchstart',
      this.preventCanvasTouchDefault
    );
    this.game.canvas.removeEventListener(
      'touchmove',
      this.preventCanvasTouchDefault
    );
    this.game.canvas.removeEventListener(
      'touchend',
      this.preventCanvasTouchDefault
    );
    this.game.canvas.removeEventListener(
      'touchcancel',
      this.preventCanvasTouchDefault
    );
    window.removeEventListener('touchend', this.handleDomTouchEnd);
    window.removeEventListener('touchcancel', this.handleDomTouchEnd);
    window.removeEventListener('blur', this.handleWindowBlur);
    window.removeEventListener('pagehide', this.handleWindowBlur);
    document.removeEventListener('visibilitychange', this.handleVisibilityChange);
    this.preventCanvasTouchDefault = undefined;
  }

  private showMovementTutorial(): void {
    if (this.movementTutorialShown || this.hasSeenMovementTutorial()) return;
    AudioManager.playSfx(this, SFX.MOVEMENT_TUTORIAL_OPEN);

    this.movementTutorialShown = true;
    this.movementTutorialContainer?.destroy(true);

    const width = this.cameras.main.width;
    const height = this.cameras.main.height;
    const container = this.add.container(0, 0)
      .setScrollFactor(0)
      .setDepth(10003)
      .setAlpha(0);

    if (this.controlsEnabled) {
      const centerX = width * 0.18;
      const centerY = height * 0.74;
      const keyGap = this.dpadButtonRadius * 1.55;
      const keys = [
        { label: '^', x: 0, y: -keyGap },
        { label: '<', x: -keyGap, y: 0 },
        { label: 'v', x: 0, y: 0 },
        { label: '>', x: keyGap, y: 0 },
      ];
      const keyObjects = keys.flatMap(key => {
        const button = this.add.circle(centerX + key.x, centerY + key.y, this.dpadButtonRadius, 0x0b1822, 0.72)
          .setStrokeStyle(2, 0x7de3ff, 0.72);
        const label = this.add.text(button.x, button.y, key.label, {
          fontSize: '16px',
          color: '#ffffff',
          fontStyle: 'bold',
        }).setOrigin(0.5);
        return [button, label];
      });
      const text = this.add.text(centerX, centerY - keyGap - this.dpadButtonRadius - 22, 'Tap buttons to move', {
        fontSize: '13px',
        color: '#dff8ff',
        fontStyle: 'bold',
        align: 'center',
      }).setOrigin(0.5);

      container.add([...keyObjects, text]);
      this.tweens.add({
        targets: keyObjects,
        scale: { from: 0.92, to: 1.08 },
        alpha: { from: 0.35, to: 0.85 },
        duration: 850,
        yoyo: true,
        repeat: -1,
        ease: 'Sine.easeInOut',
      });
    } else {
      const centerX = width * 0.5;
      const centerY = height - 94;
      const keys = [
        { label: 'W', x: 0, y: -34 },
        { label: 'A', x: -38, y: 4 },
        { label: 'S', x: 0, y: 4 },
        { label: 'D', x: 38, y: 4 },
      ];
      const keyObjects = keys.flatMap(key => {
        const box = this.add.rectangle(centerX + key.x, centerY + key.y, 30, 28, 0x0b1822, 0.72)
          .setStrokeStyle(1, 0x7de3ff, 0.72);
        const label = this.add.text(box.x, box.y, key.label, {
          fontSize: '15px',
          color: '#ffffff',
          fontStyle: 'bold',
        }).setOrigin(0.5);
        return [box, label];
      });
      const text = this.add.text(centerX, centerY + 46, 'Use WASD or arrow keys to move', {
        fontSize: '14px',
        color: '#dff8ff',
        fontStyle: 'bold',
      }).setOrigin(0.5);

      container.add([...keyObjects, text]);
      this.tweens.add({
        targets: keyObjects,
        alpha: { from: 0.45, to: 1 },
        duration: 700,
        yoyo: true,
        repeat: -1,
        ease: 'Sine.easeInOut',
      });

      const keyboardHandler = (event: KeyboardEvent) => {
        if (['w', 'a', 's', 'd', 'arrowup', 'arrowdown', 'arrowleft', 'arrowright'].includes(event.key.toLowerCase())) {
          this.input.keyboard?.off('keydown', keyboardHandler);
          this.dismissMovementTutorial();
        }
      };
      this.input.keyboard?.on('keydown', keyboardHandler);
      container.once(Phaser.GameObjects.Events.DESTROY, () => {
        this.input.keyboard?.off('keydown', keyboardHandler);
      });
    }

    this.movementTutorialContainer = container;
    this.tweens.add({
      targets: container,
      alpha: 1,
      duration: 220,
      ease: 'Sine.easeOut',
    });
    this.time.delayedCall(8500, () => this.dismissMovementTutorial());
  }

  private dismissMovementTutorial(): void {
    if (!this.movementTutorialContainer) return;

    this.markMovementTutorialSeen();
    const container = this.movementTutorialContainer;
    this.movementTutorialContainer = undefined;
    this.tweens.killTweensOf(container.list);
    this.tweens.add({
      targets: container,
      alpha: 0,
      duration: 180,
      onComplete: () => container.destroy(true),
    });
  }

  private hasSeenMovementTutorial(): boolean {
    try {
      return localStorage.getItem(this.getMovementTutorialKey()) === '1';
    } catch {
      return false;
    }
  }

  private markMovementTutorialSeen(): void {
    try {
      localStorage.setItem(this.getMovementTutorialKey(), '1');
    } catch {
      // Local storage can fail in restricted browser modes; the hint will just show again.
    }
  }

  private getMovementTutorialKey(): string {
    const userId = (window as any).userData?.userId ?? 'guest';
    return `phishy:movement-tutorial-seen:${userId}`;
  }

  private createQuestionUI(): void {
    this.questionContainer = this.add.container(0, 0)
      .setScrollFactor(0)
      .setDepth(10000);

    this.questionText = this.add.text(0, 0, '', {
      fontFamily: 'Arial, Helvetica, sans-serif',
      fontSize: '19px',
      color: '#ffffff',
      fontStyle: 'bold',
      align: 'center',
    }).setOrigin(0.5);

    this.questionText.setResolution(2);

    this.questionBackground = this.add.rectangle(0, 0, 120, 50, 0x07111c, 0.9)
      .setStrokeStyle(2, 0xf2f8ff)
      .setOrigin(0.5);

    this.questionContainer.add([this.questionBackground, this.questionText]);
  }

  private updateQuestionUI(answered: number): void {
    if (!this.questionText || !this.questionBackground) return;

    const remaining = this.totalQuestions - answered;

    this.questionText.setText(`Questions Remaining: ${remaining}`);

    const paddingX = 46;
    const paddingY = 24;
    this.questionBackground.setSize(
      Math.max(280, this.questionText.width + paddingX),
      Math.max(52, this.questionText.height + paddingY)
    );
  }

  private createHealthUI(maxHealth: number): void {
    const heartCount = Math.ceil(maxHealth / 2);

    this.healthContainer?.destroy(true);

    this.healthContainer = this.add.container(0, 0)
      .setScrollFactor(0)
      .setDepth(10002);

    const bg = this.add.rectangle(0, 0, 148, 42, 0x111111, 0.9)
      .setStrokeStyle(3, 0xffffff)
      .setOrigin(0.5);

    const label = this.add.text(-48, 0, 'HP', {
      fontSize: '18px',
      color: '#ffffff',
      fontStyle: 'bold',
    }).setOrigin(0.5);

    this.healthIcons = Array.from({ length: heartCount }).map((_, index) => {
      return this.add.sprite(-8 + index * 28, 0, 'tiles_spr', 530)
        .setScale(1.4);
    });

    this.healthContainer.add([bg, label, ...this.healthIcons]);
    this.layoutUI();
  }

  private updateHealthUI(currentHealth: number): void {
    this.healthIcons.forEach((heart, index) => {
      const heartHealth = currentHealth - index * 2;

      if (heartHealth >= 2) {
        heart.setFrame(530);
        return;
      }

      if (heartHealth === 1) {
        heart.setFrame(531);
        return;
      }

      heart.setFrame(532);
    });
  }

  private handleResize(): void {
    this.layoutUI();
    this.updateDpadButtonStates();
    this.updateDirectionalMovement();

    if (this.settingsOpen) {
      this.closeSettingsMenu(false);
      this.openSettingsMenu();
    }
  }

  private layoutUI(): void {
    const width = this.cameras.main.width;
    const topMargin = this.toLogicalSize(18, 36);
    const leftMargin = this.toLogicalSize(18, 34);
    const rightMargin = this.toLogicalSize(18, 34);

    this.questionContainer?.setPosition(width / 2, topMargin + 28);
    this.healthContainer?.setPosition(leftMargin + 74, topMargin + 88);
    this.pauseButton?.setPosition(width - rightMargin - 46, topMargin + 20);

    if (!this.controlsEnabled) return;

    this.layoutTouchControls();
  }

  private layoutTouchControls(): void {
    const width = this.cameras.main.width;
    const height = this.cameras.main.height;
    const isViewportLandscape = window.innerWidth > window.innerHeight;
    const sideMargin = this.toLogicalSize(
      isViewportLandscape ? 18 : 24,
      isViewportLandscape ? 34 : 46
    );
    const centerY = height * 0.5;

    this.dpadButtonRadius = this.toLogicalSize(20, isViewportLandscape ? 28 : 26);
    this.buttonRadius = this.toLogicalSize(26, isViewportLandscape ? 34 : 32);

    const dpadScale = this.dpadButtonRadius / 28;
    const dpadGap = this.dpadButtonRadius * (isViewportLandscape ? 2.12 : 1.75);
    const dpadHitRadius = 44 * dpadScale;
    const dpadX = sideMargin + dpadHitRadius + dpadGap;
    const dpadY = height - sideMargin - dpadHitRadius;
    const dpadZoneWidth = dpadGap * 2 + dpadHitRadius * 2;
    const dpadZoneHeight = dpadGap + dpadHitRadius * 2;
    const dpadZoneY = dpadY - dpadGap / 2;

    this.dpadCenterX = dpadX;
    this.dpadCenterY = dpadY - dpadGap * 0.35;
    this.dpadDeadZoneRadius = this.dpadButtonRadius * 0.42;

    this.dpadDragZone
      ?.setPosition(dpadX, dpadZoneY)
      .setSize(dpadZoneWidth, dpadZoneHeight)
      .setInteractive(
        new Phaser.Geom.Rectangle(
          -dpadZoneWidth / 2,
          -dpadZoneHeight / 2,
          dpadZoneWidth,
          dpadZoneHeight
        ),
        Phaser.Geom.Rectangle.Contains
      );

    this.dpadButtons.up?.container
      .setPosition(dpadX, dpadY - dpadGap)
      .setScale(dpadScale);
    this.dpadButtons.down?.container
      .setPosition(dpadX, dpadY)
      .setScale(dpadScale);
    this.dpadButtons.left?.container
      .setPosition(dpadX - dpadGap, dpadY)
      .setScale(dpadScale);
    this.dpadButtons.right?.container
      .setPosition(dpadX + dpadGap, dpadY)
      .setScale(dpadScale);

    const buttonScale = this.buttonRadius / 42;
    const actionHitRadius = 54 * buttonScale;
    const blockX = width - sideMargin - actionHitRadius;
    const spacing = this.buttonRadius * (isViewportLandscape ? 2.24 : 2.45);
    const firstY = Phaser.Math.Clamp(
      centerY - spacing,
      actionHitRadius + this.toLogicalSize(8, 18),
      height - spacing * 2 - actionHitRadius - sideMargin
    );

    this.blockButton?.container
      .setPosition(blockX, firstY + spacing * 2)
      .setScale(buttonScale);
    this.interactButton?.container
      .setPosition(blockX, firstY + spacing)
      .setScale(buttonScale);
    this.continueButton?.container
      .setPosition(blockX, firstY)
      .setScale(buttonScale * 0.92);
  }

  private toLogicalSize(cssPixels: number, minimumLogical: number): number {
    const bounds = this.game.canvas.getBoundingClientRect();
    const gameWidth = this.scale.gameSize.width;
    const scale = bounds.width > 0 && gameWidth > 0
      ? bounds.width / gameWidth
      : 1;

    return Math.max(minimumLogical, cssPixels / Math.max(scale, 0.25));
  }
}
