import { useState, useEffect } from "react";
import { useAuth } from "../../contexts/AuthContext";
import { api } from "../../services/api";
import { formatDatePH } from "../../utils/dateUtils";
import "./QuizInsightsPage.scss";

interface QuizInsight {
  id?: string;
  userid?: string;
  username: string;
  score: null; // TODO: Add score when backend supports it
  lastAttempt: string | null;
}

const QuizInsightsPage = () => {
  const { user, isAuthenticated } = useAuth();
  const [quizInsights, setQuizInsights] = useState<QuizInsight[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Fetch quiz insights from backend
  const fetchQuizInsights = async () => {
    // Double-check: only proceed if user is admin or super-admin
    if (!user || (user.role !== 'admin' && user.role !== 'super-admin')) {
      console.log('Access denied: User is not admin or super-admin');
      return;
    }

    setLoading(true);
    setError(null);
    try {
      // Fetch all users and format for quiz insights
      const users = await api.getUsers();
      const formattedInsights: QuizInsight[] = users.map(u => ({
        id: u.userid || u.id?.toString(),
        userid: u.userid,
        username: u.username,
        score: null, // TODO: Add score when backend implements quiz scoring
        lastAttempt: u.last_login || null
      }));
      // Sort by lastAttempt from new to old
      formattedInsights.sort((a, b) => {
        if (!a.lastAttempt) return 1;
        if (!b.lastAttempt) return -1;
        return new Date(b.lastAttempt).getTime() - new Date(a.lastAttempt).getTime();
      });
      setQuizInsights(formattedInsights);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to fetch quiz insights");
      console.error("Error fetching quiz insights:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    // Only fetch if user is authenticated, loaded, and is admin or super-admin
    if (isAuthenticated && user && (user.role === 'admin' || user.role === 'super-admin')) {
      fetchQuizInsights();
    }
  }, [isAuthenticated, user]);

  // Show loading while user data is being loaded
  if (!isAuthenticated || !user) {
    return <div>Loading...</div>;
  }

  // Don't render anything if user is not admin or super-admin
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
              <th>Last Attempt</th>
            </tr>
          </thead>
          <tbody>
            {quizInsights.map((row) => (
              <tr key={row.id || row.username}>
                <td>{row.username}</td>
                <td className="score">{row.score}</td>
                <td>{row.lastAttempt ? formatDatePH(row.lastAttempt, false) : '-'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
};

export default QuizInsightsPage; 