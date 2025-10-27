import { Text } from './text';

export enum ScoreOperations {
  INCREASE,
  DECREASE,
  SET_VALUE,
}

export class Score extends Text {
  private scoreValue = 0;

  constructor(scene: Phaser.Scene, x: number, y: number, initScore = 0) {
    super(scene, x, y, `Score: ${initScore}`, {
      fontSize: '16px',
      color: '#000',
    });
    this.scoreValue = initScore;
  }

  public changeValue(operation: ScoreOperations, value: number): number {
    switch (operation) {
      case ScoreOperations.INCREASE:
        this.scoreValue += value;
        break;
      case ScoreOperations.DECREASE:
        this.scoreValue -= value;
        break;
      case ScoreOperations.SET_VALUE:
        this.scoreValue = value;
        break;
    }
    this.updateScoreText();
    return this.scoreValue;
  }

  public getValue(): number {
    return this.scoreValue;
  }

  private updateScoreText(): void {
    this.setText(`Score: ${this.scoreValue}`);
  }
}
