// scenes/core/LevelConfig.ts
export interface LevelConfig {
  sceneKey: string;

  topic: string;

  mapKey: string;
  tilesetName: string;

  intro: {
    title: string;
    description: string;
  };

  next: {
    sceneKey: string;
    topic: string;
  };

  inferSubcat: (questionId: string) => string;
}
