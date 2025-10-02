// Game API service for communicating with the backend
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

class GameAPI {
  private baseUrl: string;
  private token: string | null;

  constructor() {
    this.baseUrl = 'http://localhost:8000';
    this.token = null;
  }

  // Set authentication token
  setToken(token: string): void {
    this.token = token;
  }

  // Get authentication headers
  private getAuthHeaders(): HeadersInit {
    const headers: HeadersInit = {
      'Content-Type': 'application/json',
    };
    
    if (this.token) {
      headers['Authorization'] = `Bearer ${this.token}`;
      console.log('Using token:', this.token.substring(0, 20) + '...');
    } else {
      console.warn('No authentication token available');
    }
    
    return headers;
  }

  // Start a new assessment session
  async startAssessmentSession(topic: string): Promise<AssessmentSession> {
    const requestBody = {
      topic,
      start_time: new Date().toISOString()
    };
    
    console.log('Starting assessment session with:', requestBody);
    console.log('Auth headers:', this.getAuthHeaders());
    
    // Retry logic for connection issues
    let lastError: Error | null = null;
    for (let attempt = 1; attempt <= 3; attempt++) {
      try {
        console.log(`Attempt ${attempt} to start assessment session...`);
        
        const response = await fetch(`${this.baseUrl}/game/assessment/start`, {
          method: 'POST',
          headers: this.getAuthHeaders(),
          body: JSON.stringify(requestBody)
        });

        if (!response.ok) {
          const errorText = await response.text();
          console.error('API Error Response:', errorText);
          throw new Error(`Failed to start assessment session: ${response.statusText} - ${errorText}`);
        }

        const result = await response.json();
        console.log('Assessment session started successfully:', result);
        return result;
        
      } catch (error) {
        lastError = error as Error;
        console.warn(`Attempt ${attempt} failed:`, error);
        
        if (attempt < 3) {
          // Wait before retrying (exponential backoff)
          const delay = Math.pow(2, attempt) * 1000; // 2s, 4s
          console.log(`Retrying in ${delay}ms...`);
          await new Promise(resolve => setTimeout(resolve, delay));
        }
      }
    }
    
    throw lastError || new Error('Failed to start assessment session after 3 attempts');
  }

  // Submit an assessment result
  async submitAssessmentResult(sessionId: string, result: AssessmentResult): Promise<void> {
    // Retry logic for connection issues
    let lastError: Error | null = null;
    for (let attempt = 1; attempt <= 3; attempt++) {
      try {
        const response = await fetch(`${this.baseUrl}/game/assessment/result?session_id=${sessionId}`, {
          method: 'POST',
          headers: this.getAuthHeaders(),
          body: JSON.stringify({
            question_id: result.question_id,
            user_answer: result.user_answer,
            correct_answer: result.correct_answer,
            is_correct: result.is_correct,
            topic: result.topic,
            subcategory: result.subcategory,
            timestamp: result.timestamp.toISOString()
          })
        });

        if (!response.ok) {
          throw new Error(`Failed to submit assessment result: ${response.statusText}`);
        }
        
        return; // Success, exit retry loop
        
      } catch (error) {
        lastError = error as Error;
        console.warn(`Attempt ${attempt} to submit result failed:`, error);
        
        if (attempt < 3) {
          const delay = Math.pow(2, attempt) * 1000;
          await new Promise(resolve => setTimeout(resolve, delay));
        }
      }
    }
    
    throw lastError || new Error('Failed to submit assessment result after 3 attempts');
  }

  // End assessment session
  async endAssessmentSession(sessionId: string, totalScore: number, totalQuestions: number): Promise<AssessmentSession> {
    // Retry logic for connection issues
    let lastError: Error | null = null;
    for (let attempt = 1; attempt <= 3; attempt++) {
      try {
        const response = await fetch(`${this.baseUrl}/game/assessment/end?session_id=${sessionId}`, {
          method: 'POST',
          headers: this.getAuthHeaders(),
          body: JSON.stringify({
            end_time: new Date().toISOString(),
            total_score: totalScore,
            total_questions: totalQuestions
          })
        });

        if (!response.ok) {
          throw new Error(`Failed to end assessment session: ${response.statusText}`);
        }

        return response.json();
        
      } catch (error) {
        lastError = error as Error;
        console.warn(`Attempt ${attempt} to end session failed:`, error);
        
        if (attempt < 3) {
          const delay = Math.pow(2, attempt) * 1000;
          await new Promise(resolve => setTimeout(resolve, delay));
        }
      }
    }
    
    throw lastError || new Error('Failed to end assessment session after 3 attempts');
  }

  // Get user's assessment history
  async getUserAssessmentHistory(userId: string): Promise<AssessmentSession[]> {
    const response = await fetch(`${this.baseUrl}/game/assessment/history/${userId}`, {
      headers: this.getAuthHeaders()
    });

    if (!response.ok) {
      throw new Error(`Failed to fetch assessment history: ${response.statusText}`);
    }

    return response.json();
  }

  // Get assessment statistics
  async getAssessmentStats(userId: string): Promise<any> {
    const response = await fetch(`${this.baseUrl}/game/assessment/stats/${userId}`, {
      headers: this.getAuthHeaders()
    });

    if (!response.ok) {
      throw new Error(`Failed to fetch assessment stats: ${response.statusText}`);
    }

    return response.json();
  }
}

// Export singleton instance
export const gameAPI = new GameAPI();
