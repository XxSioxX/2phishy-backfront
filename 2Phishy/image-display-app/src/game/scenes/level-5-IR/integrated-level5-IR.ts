import { BaseIntegratedLevel } from '../core/BaseIntegratedLevel';
import { LEVEL_CONFIGS } from '../core/LevelConfigurations';

export class IRLevel extends BaseIntegratedLevel {
  constructor() {
    super(LEVEL_CONFIGS.IR);
  }
}
