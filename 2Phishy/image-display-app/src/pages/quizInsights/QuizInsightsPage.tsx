import { quizInsightsMockData } from "../../data";
import "./QuizInsightsPage.scss";

const QuizInsightsPage = () => {
  return (
    <div className="quiz-insights-page">
      <h2>Quiz Insights</h2>
      <table className="quiz-insights-table">
        <thead>
          <tr>
            <th>User</th>
            <th>Quiz Name</th>
            <th>Score</th>
            <th>Attempts</th>
            <th>Last Attempt</th>
          </tr>
        </thead>
        <tbody>
          {quizInsightsMockData.map((row, idx) => (
            <tr key={idx}>
              <td>{row.user}</td>
              <td>{row.quiz}</td>
              <td>{row.score}</td>
              <td>{row.attempts}</td>
              <td>{row.lastAttempt}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};

export default QuizInsightsPage; 