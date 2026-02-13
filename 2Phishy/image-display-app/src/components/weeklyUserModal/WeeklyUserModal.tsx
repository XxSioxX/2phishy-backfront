import { useState } from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { getWeeklyChartData, getFormattedWeekRange } from '../../utils/weeklyUserStats';
import type { WeeklyUserStats } from '../../utils/weeklyUserStats';
import './weeklyUserModal.scss';

interface WeeklyUserModalProps {
  isOpen: boolean;
  onClose: () => void;
  weeklyStats: WeeklyUserStats | null;
}

const WeeklyUserModal: React.FC<WeeklyUserModalProps> = ({ isOpen, onClose, weeklyStats }) => {
  const [expandedWeek, setExpandedWeek] = useState<string | null>(null);

  if (!isOpen || !weeklyStats) return null;

  const chartData = getWeeklyChartData(weeklyStats.weeks);
  const totalAllTime = weeklyStats.weeks.reduce((sum, week) => sum + week.newUsers, 0);

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2>Weekly New Users Breakdown</h2>
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
              <div className="stat-label">This Week</div>
              <div className="stat-value">{weeklyStats.totalNewUsersThisWeek}</div>
            </div>
            <div className="stat-card">
              <div className="stat-label">Total Users</div>
              <div className="stat-value">{totalAllTime}</div>
            </div>
            <div className="stat-card">
              <div className="stat-label">Weeks Tracked</div>
              <div className="stat-value">{weeklyStats.weeks.length}</div>
            </div>
            {weeklyStats.weeks.length > 0 && (
              <div className="stat-card">
                <div className="stat-label">Avg/Week</div>
                <div className="stat-value">
                  {Math.round(totalAllTime / weeklyStats.weeks.length)}
                </div>
              </div>
            )}
          </div>

          {/* Chart */}
          <div className="chart-container">
            <h3>New Users Over Time</h3>
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#444" />
                <XAxis dataKey="week" stroke="#999" />
                <YAxis stroke="#999" />
                <Tooltip
                  contentStyle={{
                    background: '#222',
                    border: '1px solid #444',
                    borderRadius: '4px',
                  }}
                  formatter={(value) => [value, 'Users']}
                  labelFormatter={(label) => `${label}`}
                />
                <Line
                  type="monotone"
                  dataKey="users"
                  stroke="#4a90e2"
                  strokeWidth={2}
                  dot={{ fill: '#4a90e2', r: 4 }}
                  activeDot={{ r: 6 }}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>

          {/* Weekly Details */}
          <div className="weekly-details">
            <h3>Weekly Breakdown</h3>
            <div className="weeks-list">
              {weeklyStats.weeks.map((week) => (
                <div key={`${week.year}-W${week.week}`} className="week-item">
                  <button
                    className={`week-header ${expandedWeek === `${week.year}-W${week.week}` ? 'expanded' : ''}`}
                    onClick={() =>
                      setExpandedWeek(
                        expandedWeek === `${week.year}-W${week.week}`
                          ? null
                          : `${week.year}-W${week.week}`
                      )
                    }
                  >
                    <span className="week-title">{week.weekNumber}</span>
                    <span className="week-count">{week.newUsers}</span>
                    <span className="expand-icon">
                      {expandedWeek === `${week.year}-W${week.week}` ? '▼' : '▶'}
                    </span>
                  </button>

                  {expandedWeek === `${week.year}-W${week.week}` && (
                    <div className="week-details-content">
                      <div className="detail-row">
                        <span className="detail-label">Date Range</span>
                        <span className="detail-value">
                          {getFormattedWeekRange(week.startDate, week.endDate)}
                        </span>
                      </div>
                      <div className="detail-row">
                        <span className="detail-label">New Users</span>
                        <span className="detail-value">{week.newUsers}</span>
                      </div>
                      <div className="detail-row">
                        <span className="detail-label">Percentage of Total</span>
                        <span className="detail-value">
                          {totalAllTime > 0 ? ((week.newUsers / totalAllTime) * 100).toFixed(1) : 0}%
                        </span>
                      </div>
                    </div>
                  )}
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

export default WeeklyUserModal;
