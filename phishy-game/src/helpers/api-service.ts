import { SessionManager } from './session-manager';
import { AssessmentPayload } from './AssessmentManager';

export class ApiService {
  private static baseUrl = 'http://127.0.0.1:8000/';
  private session = SessionManager.getInstance();

  async submitInitialAssessment(payload: AssessmentPayload) {
    return this.request('game/initassess/', 'POST', payload);
  }

  async submitPostAssessment(payload: AssessmentPayload) {
    return this.request('/postassess/', 'POST', payload);
  }

  async getUserProgress(userid: string) {
    return this.request(`/progress/${userid}`, 'GET');
  }

  private async request(endpoint: string, method: string, body?: any) {
    const token = this.session.getToken();
    if (!token) throw new Error('No valid session');

    const res = await fetch(`${ApiService.baseUrl}${endpoint}`, {
      method,
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: body ? JSON.stringify(body) : undefined,
    });

    if (!res.ok) {
      const msg = await res.text();
      throw new Error(`API Error ${res.status}: ${msg}`);
    }

    return res.json();
  }
}
