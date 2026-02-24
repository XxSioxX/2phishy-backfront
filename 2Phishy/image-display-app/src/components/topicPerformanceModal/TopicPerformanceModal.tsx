import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import './topicPerformanceModal.scss';

interface TopicPerformanceModalProps {
  isOpen: boolean;
  onClose: () => void;
  topicData: any[];
}

const TopicPerformanceModal: React.FC<TopicPerformanceModalProps> = ({ isOpen, onClose, topicData }) => {
  if (!isOpen || !topicData) return null;

  // Calculate summary statistics
  const totalTopics = topicData.length;
  const averageScore = topicData.length > 0
    ? Math.round(topicData.reduce((sum, topic) => sum + topic.score, 0) / topicData.length)
    : 0;
  const lowestScore = topicData.length > 0
    ? Math.min(...topicData.map(topic => topic.score))
    : 0;
  const highestScore = topicData.length > 0
    ? Math.max(...topicData.map(topic => topic.score))
    : 0;

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2>Topic Performance Details</h2>
          <button
            className="close-btn"
            onClick={onClose}
            aria-label="Close modal"
          >
            ✕
          </button>
        </div>

        <div className="modal-body">
          {/* Summary Statistics */}
          <div className="summary-stats">
            <div className="stat-card">
              <div className="stat-label">Total Topics</div>
              <div className="stat-value">{totalTopics}</div>
            </div>
            <div className="stat-card">
              <div className="stat-label">Average Score</div>
              <div className="stat-value">{averageScore}%</div>
            </div>
            <div className="stat-card">
              <div className="stat-label">Lowest Score</div>
              <div className="stat-value">{lowestScore}%</div>
            </div>
            <div className="stat-card">
              <div className="stat-label">Highest Score</div>
              <div className="stat-value">{highestScore}%</div>
            </div>
          </div>

          {/* Enlarged Chart */}
          <div className="chart-container">
            <h3>Topic Performance Overview</h3>
            <ResponsiveContainer width="100%" height={400}>
              <BarChart
                data={topicData}
                margin={{
                  top: 20,
                  right: 30,
                  left: 20,
                  bottom: 60,
                }}
              >
                <CartesianGrid strokeDasharray="3 3" stroke="#444" />
                <XAxis
                  dataKey="name"
                  stroke="#999"
                  angle={-45}
                  textAnchor="end"
                  height={80}
                  interval={0}
                />
                <YAxis stroke="#999" domain={[0, 100]} />
                <Tooltip
                  contentStyle={{
                    background: '#222',
                    border: '1px solid #444',
                    borderRadius: '4px',
                  }}
                  formatter={(value) => [`${value}%`, 'Score']}
                  labelStyle={{ color: '#fff' }}
                />
                <Bar dataKey="score" fill="#FFA500" />
              </BarChart>
            </ResponsiveContainer>
          </div>

          {/* Topic Details */}
          <div className="topic-details">
            <h3>Topic Breakdown</h3>
            <div className="topics-list">
              {topicData
                .sort((a, b) => a.score - b.score) // Sort by lowest score first
                .map((topic, index) => (
                <div key={topic.name} className="topic-item">
                  <div className="topic-header">
                    <span className="topic-rank">#{index + 1}</span>
                    <span className="topic-name">{topic.name}</span>
                    <span className="topic-score">{topic.score}%</span>
                  </div>
                  <div className="topic-bar">
                    <div
                      className="topic-bar-fill"
                      style={{
                        width: `${topic.score}%`,
                        backgroundColor: topic.score < 50 ? '#ff6b6b' :
                                       topic.score < 70 ? '#ffa500' : '#4ecdc4'
                      }}
                    ></div>
                  </div>
                  <div className="topic-insight">
                    {topic.score < 50 && "Needs significant improvement"}
                    {topic.score >= 50 && topic.score < 70 && "Needs some improvement"}
                    {topic.score >= 70 && "Good performance"}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="modal-footer">
          <button className="btn-close" onClick={onClose}>
            Close
          </button>
        </div>
      </div>
    </div>
  );
};

export default TopicPerformanceModal;
