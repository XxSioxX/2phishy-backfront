export {}; // Ensures the file is treated as a module
import Phaser from 'phaser';

declare global {
  interface Window {
    sizeChanged: () => void;
    game: Phaser.Game;
  }
}

export interface ObjectPoint {
  x: number;
  y: number;
  id: string;
  name: string;
}

export interface AssessmentResult {
  question_id: string;
  user_answer: string;
  correct_answer: string;
  is_correct: boolean;
  topic: string;
  subcategory: string;
  timestamp: Date;
}

export interface AssessmentSession {
  id: string;
  session_id: string;
  user_id: string;
  topic: string;
  start_time: string;
  end_time?: string;
  total_score: number;
  total_questions: number;
  completed: boolean;
  created_at: string;
  updated_at: string;
  results?: AssessmentResult[];
}