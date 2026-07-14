import { useState, useEffect, useMemo, useCallback } from "react";
import { useAuth } from "../../contexts/AuthContext";
import { api } from "../../services/api";
import { formatDatePH } from "../../utils/dateUtils";
import { getAvatarUrl } from "../../utils/avatarUtils";
import "./QuizInsightsPage.scss";

interface QuizInsight {
  username: string;
  topic: string;
  correct_answers: number;
  total_questions: number;
  score: number;
  date: string | null;
  avatar_url: string;
}

type SortField = "username" | "topic" | "score" | "date";
type SortDir = "asc" | "desc";

const TOPIC_ICONS: Record<string, string> = {
  "Safe Browsing Practices": "🌐",
  "Password Security": "🔐",
  "Malware": "🛡️",
  "Social Engineering": "🎭",
  "Incident Response": "🚨",
};

const scoreClass = (pct: number): string => {
  if (pct >= 70) return "high";
  if (pct >= 40) return "mid";
  return "low";
};

const scoreLabel = (pct: number): string => {
  if (pct >= 70) return "Good";
  if (pct >= 40) return "Average";
  return "Needs Work";
};

const QuizInsightsPage = () => {
  const { user, isAuthenticated } = useAuth();
  const [quizInsights, setQuizInsights] = useState<QuizInsight[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [search, setSearch] = useState("");
  const [filterTopic, setFilterTopic] = useState("all");
  const [sortField, setSortField] = useState<SortField>("date");
  const [sortDir, setSortDir] = useState<SortDir>("desc");
  const [displayLimit, setDisplayLimit] = useState<number | "all">(10);

  const fetchQuizInsights = useCallback(async () => {
    if (!user || (user.role !== "admin" && user.role !== "super-admin")) return;
    setLoading(true);
    setError(null);
    try {
      const insights = await api.getQuizInsights();
      setQuizInsights(insights);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to fetch quiz insights");
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    if (isAuthenticated && user && (user.role === "admin" || user.role === "super-admin")) {
      fetchQuizInsights();
    }
  }, [fetchQuizInsights, isAuthenticated, user]);

  const topicOptions = useMemo(() => {
    const set = new Set(quizInsights.map((r) => r.topic));
    return Array.from(set).sort();
  }, [quizInsights]);

  const rows = useMemo(() => {
    const q = search.trim().toLowerCase();
    let filtered = quizInsights;

    if (q) {
      filtered = filtered.filter(
        (r) =>
          r.username.toLowerCase().includes(q) ||
          r.topic.toLowerCase().includes(q)
      );
    }
    if (filterTopic !== "all") {
      filtered = filtered.filter((r) => r.topic === filterTopic);
    }

    return [...filtered].sort((a, b) => {
      let cmp = 0;
      if (sortField === "username") cmp = a.username.localeCompare(b.username);
      else if (sortField === "topic") cmp = a.topic.localeCompare(b.topic);
      else if (sortField === "score") cmp = a.score - b.score;
      else {
        const da = a.date ?? "";
        const db2 = b.date ?? "";
        cmp = da < db2 ? -1 : da > db2 ? 1 : 0;
      }
      return sortDir === "asc" ? cmp : -cmp;
    });
  }, [quizInsights, search, filterTopic, sortField, sortDir]);

  // Summary stats
  const stats = useMemo(() => {
    if (rows.length === 0) return null;
    const avgScore = rows.reduce((s, r) => s + r.score, 0) / rows.length;
    const uniqueUsers = new Set(rows.map((r) => r.username)).size;
    const uniqueTopics = new Set(rows.map((r) => r.topic)).size;
    return {
      total: rows.length,
      avgScore: Math.round(avgScore),
      uniqueUsers,
      uniqueTopics,
    };
  }, [rows]);

  const displayedRows = useMemo(() => {
    if (displayLimit === "all") return rows;
    return rows.slice(0, displayLimit);
  }, [rows, displayLimit]);

  const handleSort = (field: SortField) => {
    if (sortField === field) setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    else { setSortField(field); setSortDir(field === "date" ? "desc" : "asc"); }
  };

  const SortIcon = ({ field }: { field: SortField }) => {
    if (sortField !== field) return <span className="sort-icon inactive">↕</span>;
    return <span className="sort-icon active">{sortDir === "asc" ? "↑" : "↓"}</span>;
  };

  if (!isAuthenticated || !user) return <div className="quiz-insights-page"><div className="loading">Loading...</div></div>;
  if (user.role !== "admin" && user.role !== "super-admin") return null;

  if (loading) return (
    <div className="quiz-insights-page">
      <div className="qi-loading-state">
        <div className="qi-spinner" />
        <p>Loading quiz data...</p>
      </div>
    </div>
  );

  if (error) return (
    <div className="quiz-insights-page">
      <div className="qi-error-state">
        <span className="qi-error-icon">⚠</span>
        <h3>Failed to load data</h3>
        <p>{error}</p>
        <button onClick={fetchQuizInsights} className="qi-btn">Retry</button>
      </div>
    </div>
  );

  return (
    <div className="quiz-insights-page">
      <div className="qi-header">
        <div className="qi-header-left">
          <h1 className="qi-title">Quiz Insights</h1>
          <p className="qi-subtitle">Monitor quiz performance across all users</p>
        </div>
        <button onClick={fetchQuizInsights} className="qi-btn qi-btn-refresh">
          ↻ Refresh
        </button>
      </div>
      {stats && (
        <div className="qi-stats-row">
          <div className="qi-stat-card">
            <span className="qi-stat-value">{stats.total}</span>
            <span className="qi-stat-label">Total Attempts</span>
          </div>
          <div className="qi-stat-card">
            <span className="qi-stat-value">{stats.uniqueUsers}</span>
            <span className="qi-stat-label">Unique Users</span>
          </div>
          <div className="qi-stat-card">
            <span className="qi-stat-value">{stats.uniqueTopics}</span>
            <span className="qi-stat-label">Topics Covered</span>
          </div>
          <div className={`qi-stat-card qi-stat-score ${scoreClass(stats.avgScore)}`}>
            <span className="qi-stat-value">{stats.avgScore}%</span>
            <span className="qi-stat-label">Avg Score</span>
          </div>
        </div>
      )}
      <div className="qi-toolbar">
        <div className="qi-search-wrap">
          <span className="qi-search-icon">🔍</span>
          <input
            type="text"
            className="qi-search"
            placeholder="Search by user or topic..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          {search && (
            <button className="qi-clear-btn" onClick={() => setSearch("")}>×</button>
          )}
        </div>

        <select
          className="qi-topic-filter"
          value={filterTopic}
          onChange={(e) => setFilterTopic(e.target.value)}
        >
          <option value="all">All Topics</option>
          {topicOptions.map((t) => (
            <option key={t} value={t}>{t}</option>
          ))}
        </select>

        <select
          className="qi-limit-filter"
          value={displayLimit}
          onChange={(e) => setDisplayLimit(e.target.value === "all" ? "all" : Number(e.target.value))}
        >
          <option value={5}>Show 5</option>
          <option value={10}>Show 10</option>
          <option value={20}>Show 20</option>
          <option value="all">Show All</option>
        </select>
      </div>
      <div className="qi-table-card">
        {rows.length === 0 ? (
          <div className="qi-empty">
            <span className="qi-empty-icon">📋</span>
            <p>{quizInsights.length === 0 ? "No quiz data available yet." : "No results match your filter."}</p>
          </div>
        ) : (
          <>
            <div className="qi-table-meta">
              Showing <strong>{displayedRows.length}</strong> of <strong>{rows.length}</strong> filtered records
              {rows.length !== quizInsights.length && (
                <> from <strong>{quizInsights.length}</strong> total</>
              )}
            </div>
            <div className="qi-table-scroll">
              <table className="qi-table">
                <thead>
                  <tr>
                    <th className="sortable" onClick={() => handleSort("username")}>
                      User <SortIcon field="username" />
                    </th>
                    <th className="sortable" onClick={() => handleSort("topic")}>
                      Topic <SortIcon field="topic" />
                    </th>
                    <th>Correct / Total</th>
                    <th className="sortable" onClick={() => handleSort("score")}>
                      Score <SortIcon field="score" />
                    </th>
                    <th className="sortable" onClick={() => handleSort("date")}>
                      Date <SortIcon field="date" />
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {displayedRows.map((row, i) => {
                    const cls = scoreClass(row.score);
                    const icon = TOPIC_ICONS[row.topic] ?? "📊";
                    return (
                      <tr key={`${row.username}-${row.topic}-${i}`}>
                        <td className="td-user">
                          <img src={getAvatarUrl(row.username, row.avatar_url, 40)} alt={row.username} className="user-avatar" />
                          <span>{row.username}</span>
                        </td>
                        <td className="td-topic">
                          <span className="topic-icon">{icon}</span>
                          {row.topic}
                        </td>
                        <td className="td-correct">
                          <span className={`correct-badge ${cls}`}>
                            {row.correct_answers} / {row.total_questions}
                          </span>
                        </td>
                        <td className="td-score">
                          <div className="score-cell">
                            <div className="score-bar-track">
                              <div
                                className={`score-bar-fill ${cls}`}
                                style={{ width: `${row.score}%` }}
                              />
                            </div>
                            <span className={`score-value ${cls}`}>{row.score}%</span>
                            <span className={`score-label-badge ${cls}`}>{scoreLabel(row.score)}</span>
                          </div>
                        </td>
                        <td className="td-date">
                          {row.date ? formatDatePH(row.date, false) : <span className="no-date">—</span>}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </>
        )}
      </div>
    </div>
  );
};

export default QuizInsightsPage;
