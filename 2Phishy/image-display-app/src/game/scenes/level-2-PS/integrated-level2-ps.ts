import { BaseIntegratedLevel } from '../core/BaseIntegratedLevel';
import { LEVEL_CONFIGS } from '../core/LevelConfigurations';

export class PSLevel extends BaseIntegratedLevel {
  constructor() {
    super(LEVEL_CONFIGS.PS);
  }
}
