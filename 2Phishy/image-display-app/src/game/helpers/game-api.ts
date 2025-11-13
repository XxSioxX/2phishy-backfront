// src/services/game-api.ts
import {User} from "../../types";

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
    console.log('Sending to /game/initassess/:', payload);

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

  async getUserProgress(userid: string) {
    console.log('Fetching user progress for:', userid);

    const response = await fetch(`${this.baseUrl}/data`, {
      method: 'POST',
      mode: 'cors',
      headers: this.getHeaders(),
      body: JSON.stringify({
        userid: userid,
        collectionName: 'initial_assessments'
    }),
    });

    if (!response.ok) {
      const err = await response.text();
      console.error('getUserProgress error:', err);
      throw new Error(`Failed to get user progress: ${err}`);
    }

    return await response.json();
  }

  async getUserQuestionMap(payload: {
    userid: string;
    collectionName?: string;
    topic: string;
  }) {
    const { userid, topic, collectionName = 'initial_assessments' } = payload;

    console.log('Sending to /game/generate/qlist:', payload);

    const response = await fetch('${this.baseUrl}/game/generate/qlist', {
      method: 'POST',
      mode: 'cors',
      headers: this.getHeaders(),
      body: JSON.stringify({ userid, topic, collectionName }),
    })

    if(!response.ok) {
      const err = await response.text();
      console.error('Failed getting question map:', err);
      throw new Error(`Failed to get question map: ${err}`);
    }

    return await response.json();
  }
}



export const gameAPI = new GameAPI();