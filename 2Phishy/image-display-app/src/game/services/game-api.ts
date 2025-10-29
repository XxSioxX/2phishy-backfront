// src/services/game-api.ts
export interface AssessmentResult {
  question_id: string;
  user_answer: string | null;
  correct_answer: string;
  topic: string;
  subcategory: string;
  is_correct: boolean;
  timestamp: Date;
}

class GameAPI {
  private token: string | null = null;
  private readonly baseUrl = 'http://localhost:8000/game'; // ✅ space removed

  setToken(token: string) {
    this.token = token;
  }

  private getHeaders() {
    return {
      'Content-Type': 'application/json',
      ...(this.token ? { Authorization: `Bearer ${this.token}` } : {}),
    };
  }

  async startInitialAssessment(payload: {
    userid: string;
    topic: string;
    assessment_response: {
      responses: {
        question_id: string;
        question_subtopic: string;
        answer: string | null;
      }[];
    };
  }) {
    console.log('🛰  Sending to /game/initassess/:', payload);

    const response = await fetch(`${this.baseUrl}/initassess/`, {
      method: 'POST',
      mode: 'cors',              // ✅ enable CORS
      headers: this.getHeaders(),
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      const err = await response.text();
      console.error('❌ startInitialAssessment error:', err);
      throw new Error(`Failed to start initial assessment: ${err}`);
    }
    return await response.json();
  }
}

export const gameAPI = new GameAPI();