import React from "react";

interface OverallScoreRingProps {
  score: number;
}

const OverallScoreRing: React.FC<OverallScoreRingProps> = ({ score }) => {
  const normalizedScore = Math.max(0, Math.min(100, Number.isFinite(score) ? score : 0));

  return (
    <div className="overall-score-card">
      <p className="overall-label">Overall Knowledge Score</p>
      <div
        className="overall-score-ring"
        style={{
          background: `conic-gradient(#4da3ff ${normalizedScore * 3.6}deg, rgba(255, 255, 255, 0.12) 0deg)`,
        }}
      >
        <div className="ring-inner">
          <span className="ring-value">{normalizedScore}%</span>
        </div>
      </div>
    </div>
  );
};

export default OverallScoreRing;