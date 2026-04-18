// src/services/game-api.ts


export interface AssessmentResult {
  assessment_id: string;
  question_id: string;
  user_answer: string | null;
  correct_answer: string;
  topic: string;
  subcategory: string;
  is_correct: boolean;
  timestamp: Date;
}

const resolveApiBaseUrl = (): string => {
  const fromCraEnv = process.env.REACT_APP_API_BASE_URL;
  const candidate = fromCraEnv || '/api';
  const isBrowser = typeof window !== 'undefined' && typeof window.location !== 'undefined';

  if (isBrowser) {
    const isLocalHost = ['localhost', '127.0.0.1', '0.0.0.0'].includes(window.location.hostname);

    // In deployed environments, always use same-origin /api and rely on reverse proxy routing.
    if (!isLocalHost) {
      return '/api';
    }

    try {
      const candidateUrl = new URL(candidate, window.location.origin);

      if ((candidate.startsWith('http://') || candidate.startsWith('https://')) && candidateUrl.host === window.location.host) {
        return candidateUrl.pathname.replace(/\/+$/, '') || '/api';
      }

      if (window.location.protocol === 'https:' && candidate.startsWith('http://')) {
        return candidate.replace('http://', 'https://').replace(/\/+$/, '');
      }
    } catch {
      // Fall back to the raw value below.
    }
  }

  if (candidate.includes('localhost') && candidate.startsWith('https')) {
    return candidate.replace('https://', 'http://').replace(/\/+$/, '');
  }

  return candidate.replace(/\/+$/, '');
};

class GameAPI {
  private token: string | null = null;
  private readonly baseUrl = `${resolveApiBaseUrl()}/game`;


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
        assessment_id: string;
        question_id: string;
        question_subtopic: string;
        answer: string | null;
        is_correct: boolean;
        timestamp: string;
      }[];
    };
  }) {
    const fixedPayload = {
      userid: payload.userid,
      topic: payload.topic,
      assessment_response: {
        responses: payload.assessment_response.responses.map(r => ({
          assessment_request: {
            assessment_id: r.assessment_id,
            question_id: r.question_id,
            question_subtopic: r.question_subtopic,
          },
          answer: r.answer,
          is_correct: r.is_correct,
          timestamp: r.timestamp,
        })),
      },
    };

    console.log('Sending to /game/initassess/:', fixedPayload);

    const response = await fetch(`${this.baseUrl}/initassess/`, {
      method: 'POST',
      mode: 'cors',
      headers: this.getHeaders(),
      body: JSON.stringify(fixedPayload),
    });

    if (!response.ok) {
      const errJson = await response.json();

      if (errJson.detail) {
        const messages = errJson.detail.map((d: any) =>
          `Validation error at ${d.loc.join(' → ')}`
        );
        throw new Error(messages.join('\n'));
      }

      throw new Error('Failed to start initial assessment');
    }

    return await response.json();
  }

  async getUserProgress(userid: string) {
    console.log('Fetching user progress for:', userid);

    const response = await fetch(`${this.baseUrl}/data`, {
      method: 'POST',
      mode: 'cors',
      headers: this.getHeaders(),
      body: JSON.stringify({ userid }),
    });

    if (!response.ok) {
      const err = await response.text();
      throw new Error(`Failed to get user progress: ${err}`);
    }

    return await response.json();
  }


  async submitAssessmentResult(payload: {
    userid: string;
    question_id: string;
    user_answer: string | null;
    correct_answer: string;
    topic: string;
    subcategory: string;
    is_correct: boolean;
    timestamp: string; // ISO string
  }) {
    console.log('Sending to /game/assessment/submit:', payload);

    const response = await fetch(`${this.baseUrl}/assessment/submit`, {
      method: 'POST',
      mode: 'cors',
      headers: this.getHeaders(),
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      const err = await response.text();
      console.error('❌ submitAssessmentResult error:', err);
      throw new Error(`Failed to submit assessment result: ${err}`);
    }

    return await response.json();
  }

    async submit_question_single(payload: {
      userid: string;
      question_id: string;
      topic: string;

      question_subtopic: string;
      answer:string | null;

      is_correct: boolean;
      timestamp: string;
  }) {
    console.log('Sending to /game/question/submit/single', payload);

    const response = await fetch(`${this.baseUrl}/question/submit/single`, {
      method: 'POST',
      mode: 'cors',
      headers: this.getHeaders(),
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      const err = await response.text();
      console.error('❌ submitAssessmentResult error:', err);
      throw new Error(`Failed to submit assessment result: ${err}`);
    }

    return await response.json();
  }

  async markTopicCompleted(payload: {
    userid: string;
    topic: string;
  }) {
    console.log('Marking topic completed:', payload);

    const response = await fetch(`${this.baseUrl}/progress/complete`, {
      method: 'POST',
      mode: 'cors',
      headers: this.getHeaders(),
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      const err = await response.text();
      console.error('markTopicCompleted error:', err);
      throw new Error(`Failed to mark topic completed: ${err}`);
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

    const response = await fetch(`${this.baseUrl}/generate/qlist`, {
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

  async getUserKnowledgeList(payload:{
    userid: string;
    collectionName?: string;
    topic: string;
  }) {
    const { userid, topic, collectionName = 'initial_assessments' } = payload;

    console.log('Sending to /game/generate/knowledgelist:', payload);

    const response = await fetch(`${this.baseUrl}/generate/knowledgelist`, {
      method: 'POST',
      mode: 'cors',
      headers: this.getHeaders(),
      body: JSON.stringify({ userid, topic, collectionName }),
    })

    if(!response.ok) {
      const err = await response.text();
      console.error('Failed getting knowledge map:', err);
      throw new Error(`Failed to get knowledge map: ${err}`);
    }

    return await response.json();
  }

  async createUserQuestionMap(payload: {
    userid: string;
    collectionName?: string;
    topic: string;
  }) {
    const { userid, topic, collectionName = 'initial_assessments' } = payload;

    console.log('Sending to /game/generate/qlist:', payload);

    const response = await fetch(`${this.baseUrl}/generate/qlist`, {
      method: 'POST',
      mode: 'cors',
      headers: this.getHeaders(),
      body: JSON.stringify({
        userid,
        topic,
        collectionName }),
    })

    if(!response.ok) {
      const err = await response.text();
      console.error('Failed getting question map:', err);
      throw new Error(`Failed to get question map: ${err}`);
    }

   return await response.json();
  }

  async submitSocialEngineering(payload: {
    user_id: string;
    topic: string;
    is_success: boolean;
  }) {
    console.log('Sending to /game/submit/se-submit/:', payload);

    const response = await fetch(`${this.baseUrl}/submit/se-submit/`, {
      method: 'POST',
      mode: 'cors',
      headers: this.getHeaders(),
      body: JSON.stringify({
        user_id: payload.user_id,
        topic: payload.topic,
        is_success: payload.is_success,
        updated_at: new Date().toISOString(),
      }),
    });

    if (!response.ok) {
      const err = await response.text();
      console.error('❌ submitSocialEngineering error:', err);
      throw new Error(`Failed to submit SE result: ${err}`);
    }

    return await response.json();
  }




}



export const gameAPI = new GameAPI();