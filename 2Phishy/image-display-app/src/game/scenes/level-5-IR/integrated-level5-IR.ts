import { BaseIntegratedLevel } from '../core/BaseIntegratedLevel';
import { LEVEL_CONFIGS } from '../core/LevelConfigurations';

export class SELevel extends BaseIntegratedLevel {
  constructor() {
    super(LEVEL_CONFIGS.SE);
  }
}
