import { BaseIntegratedLevel } from '../core/BaseIntegratedLevel';
import { LEVEL_CONFIGS } from '../core/LevelConfigurations';

export class MLevel extends BaseIntegratedLevel {
  constructor() {
    super(LEVEL_CONFIGS.M);
  }
}
