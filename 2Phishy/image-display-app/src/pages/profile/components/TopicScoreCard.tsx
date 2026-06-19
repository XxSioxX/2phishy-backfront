import React from "react";

interface TopicScoreCardProps {
  topic: string;
  score: number;
}

const TOPIC_ICONS: Record<string, string> = {
  "Safe Browsing Practices": "🌐",
  "Password Security": "🔐",
  Malware: "🛡️",
  "Social Engineering": "🎭",
  "Incident Response": "🚨",
};

const getScoreClass = (score: number): string => {
  if (score <= 39) return "low";
  if (score <= 69) return "mid";
  return "high";
};

const TopicScoreCard: React.FC<TopicScoreCardProps> = ({ topic, score }) => {
  const normalizedScore = Math.max(0, Math.min(100, Number.isFinite(score) ? score : 0));
  const scoreClass = getScoreClass(normalizedScore);
  const icon = TOPIC_ICONS[topic] || "📊";

  return (
    <article className="topic-score-card">
      <div className="topic-card-header">
        <span className="topic-icon" aria-hidden="true">{icon}</span>
        <h4 className="topic-title">{topic}</h4>
      </div>
      <div className="topic-score-row">
        <span className="topic-score-value">{normalizedScore}%</span>
      </div>
      <div className="topic-progress-track" role="progressbar" aria-valuenow={normalizedScore} aria-valuemin={0} aria-valuemax={100}>
        <div className={`topic-progress-fill ${scoreClass}`} style={{ width: `${normalizedScore}%` }} />
      </div>
    </article>
  );
};

export default TopicScoreCard;