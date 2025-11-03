
export interface UserAnswer {
  question_id: string;
  question_subtopic: string;
  answer: string;
}

export interface AssessmentPayload {
  userid: string;
  topic: string;
  assessment_response: {
    responses: UserAnswer[];
  };
}

export class AssessmentManager {
  private userid: string;
  private topic: string;
  private responses: UserAnswer[] = [];

  constructor(userid: string, topic: string) {
    this.userid = userid;
    this.topic = topic;
  }

  recordAnswer(question_id: string, question_subtopic: string, answer: string) {
    const existing = this.responses.find(r => r.question_id === question_id);
    if (existing) {
      existing.answer = answer; // update if already answered
    } else {
      this.responses.push({ question_id, question_subtopic, answer });
    }
  }

  getPayload(): AssessmentPayload {
    return {
      userid: this.userid,
      topic: this.topic,
      assessment_response: { responses: this.responses },
    };
  }

  reset() {
    this.responses = [];
  }
}
