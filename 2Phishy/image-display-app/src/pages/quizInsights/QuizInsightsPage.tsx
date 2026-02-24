import { useState, useEffect } from "react";
import { useAuth } from "../../contexts/AuthContext";
import { api } from "../../services/api";
import { formatDatePH } from "../../utils/dateUtils";
import "./QuizInsightsPage.scss";

interface QuizInsight {
  username: string;
  score: number;
  level: number;
  date: string | null;
}

const QuizInsightsPage = () => {
  const { user, isAuthenticated } = useAuth();
  const [quizInsights, setQuizInsights] = useState<QuizInsight[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

 
  const fetchQuizInsights = async () => {
    
    if (!user || (user.role !== 'admin' && user.role !== 'super-admin')) {
      console.log('Access denied: User is not admin or super-admin');
      return;
    }

    setLoading(true);
    setError(null);
    try {
      
      const insights = await (api as unknown as { getQuizInsights: () => Promise<QuizInsight[]> }).getQuizInsights();
      setQuizInsights(insights);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to fetch quiz insights");
      console.error("Error fetching quiz insights:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    
    if (isAuthenticated && user && (user.role === 'admin' || user.role === 'super-admin')) {
      fetchQuizInsights();
    }
  }, [isAuthenticated, user]);

  
  if (!isAuthenticated || !user) {
    return <div>Loading...</div>;
  }

  
  if (user.role !== 'admin' && user.role !== 'super-admin') {
    return null;
  }

  if (loading) {
    return (
      <div className="quiz-insights-page">
        <div className="loading">Loading quiz insights...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="quiz-insights-page">
        <div className="error">
          <h2>Error</h2>
          <p>{error}</p>
          <button onClick={fetchQuizInsights}>Retry</button>
        </div>
      </div>
    );
  }

  return (
    <div className="quiz-insights-page">
      <div className="header">
        <h2>Quiz Insights</h2>
        <button onClick={fetchQuizInsights} className="refresh-btn">
          Refresh
        </button>
      </div>

      {quizInsights.length === 0 ? (
        <div className="no-data">
          <p>No quiz insights data available</p>
        </div>
      ) : (
        <table className="quiz-insights-table">
          <thead>
            <tr>
              <th>Username</th>
              <th>Score</th>
              <th>Level</th>
              <th>Date</th>
            </tr>
          </thead>
          <tbody>
            {quizInsights.map((row, index) => (
              <tr key={row.username + index}>
                <td>{row.username}</td>
                <td className="score">{row.score}</td>
                <td>LEVEL {row.level}</td>
                <td>{row.date ? formatDatePH(row.date, false) : '-'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
};

export default QuizInsightsPage;
