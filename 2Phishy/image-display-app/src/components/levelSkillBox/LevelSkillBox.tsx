import { useMemo, useState } from "react";
import "./levelSkillBox.scss";
import { getAvatarUrl } from "../../utils/avatarUtils";

type SkillUser = {
  userid: string;
  username: string;
  email: string;
  avatar_url?: string;
  score: number | null;
  details?: {
    correct_answers?: number;
    total_questions?: number;
    gameplay?: Record<string, number | string | null>;
  };
};

type SkillCategory = {
  key: string;
  label: string;
  range: string;
  color: string;
  count: number;
  users: SkillUser[];
};

type LevelSkill = {
  topic: string;
  label: string;
  average_score: number;
  users_count: number;
  total_users: number;
  metrics_used: string[];
  info: string;
  categories: SkillCategory[];
};

type LevelSkillData = {
  average_score: number;
  users_count: number;
  total_users: number;
  levels: LevelSkill[];
  metrics_used: string[];
  info: string;
};

type SelectedCategory = {
  level: LevelSkill;
  category: SkillCategory;
};

type LevelSkillBoxProps = {
  data?: LevelSkillData | null;
};

const fallbackData: LevelSkillData = {
  average_score: 0,
  users_count: 0,
  total_users: 0,
  levels: [],
  metrics_used: [],
  info: "Average Level Skill Score combines quiz answers with gameplay mechanics.",
};

const formatScore = (score: number | null | undefined) => {
  if (score === null || score === undefined) return "N/A";
  return `${Math.round(score)}%`;
};

const LevelSkillBox = ({ data }: LevelSkillBoxProps) => {
  const [expanded, setExpanded] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState<SelectedCategory | null>(null);
  const skillData = data ?? fallbackData;

  const visibleLevels = useMemo(
    () => skillData.levels.slice(0, 5),
    [skillData.levels]
  );

  const closeExpanded = () => {
    setSelectedCategory(null);
    setExpanded(false);
  };

  return (
    <div className="levelSkillBox">
      <div className="levelSkillHeader">
        <div>
          <span className="levelSkillTitle">Average Level Skill Score</span>
          <span className="levelSkillSubtitle">{skillData.users_count} scored users</span>
        </div>
        <span className="metricInfo" tabIndex={0} aria-label="Metric information">
          i
          <span className="metricTooltip">{skillData.info}</span>
        </span>
      </div>

      <div className="levelSkillBody">
        <div className="levelSkillScore">{formatScore(skillData.average_score)}</div>
        <div className="levelSkillBars" aria-label="Level score preview">
          {visibleLevels.length === 0 ? (
            <div className="levelSkillEmpty">No gameplay data yet</div>
          ) : (
            visibleLevels.map((level) => (
              <div className="levelSkillBarRow" key={level.topic}>
                <span>{level.label}</span>
                <div className="levelSkillTrack">
                  <div
                    className="levelSkillFill"
                    style={{ width: `${Math.max(0, Math.min(100, level.average_score))}%` }}
                  />
                </div>
                <strong>{formatScore(level.average_score)}</strong>
              </div>
            ))
          )}
        </div>
      </div>

      <button className="levelSkillExpand" type="button" onClick={() => setExpanded(true)}>
        Expand
      </button>

      {expanded && (
        <div className="levelSkillOverlay" role="dialog" aria-modal="true">
          <div className="levelSkillDialog">
            <div className="levelSkillDialogHeader">
              <div>
                <h2>Level Skill Performance</h2>
                <p>{formatScore(skillData.average_score)} average across active level attempts</p>
              </div>
              <button type="button" className="levelSkillClose" onClick={closeExpanded}>
                x
              </button>
            </div>

            <div className="levelSkillLegend">
              {skillData.metrics_used.map((metric) => (
                <span key={metric}>{metric}</span>
              ))}
            </div>

            <div className="levelSkillLevelList">
              {skillData.levels.map((level) => (
                <section className="levelSkillLevel" key={level.topic}>
                  <div className="levelSkillLevelHeader">
                    <div>
                      <h3>{level.label}</h3>
                      <p>
                        {formatScore(level.average_score)} average from {level.users_count} of {level.total_users} users
                      </p>
                    </div>
                    <span className="metricInfo" tabIndex={0} aria-label={`${level.label} metric information`}>
                      i
                      <span className="metricTooltip">
                        {level.info} Metrics: {level.metrics_used.join(", ")}.
                      </span>
                    </span>
                  </div>

                  <div className="levelSkillCategories">
                    {level.categories.map((category) => (
                      <button
                        type="button"
                        className="levelSkillCategory"
                        key={category.key}
                        onClick={() => setSelectedCategory({ level, category })}
                      >
                        <span className="categoryDot" style={{ backgroundColor: category.color }} />
                        <span>
                          <strong>{category.label}</strong>
                          <small>{category.range}</small>
                        </span>
                        <em>{category.count} users</em>
                      </button>
                    ))}
                  </div>
                </section>
              ))}
            </div>
          </div>

          {selectedCategory && (
            <div className="levelSkillUsersWindow" role="dialog" aria-modal="true">
              <div className="levelSkillUsersHeader">
                <div>
                  <h3>{selectedCategory.level.label}</h3>
                  <p>{selectedCategory.category.label} users</p>
                </div>
                <button type="button" onClick={() => setSelectedCategory(null)}>
                  x
                </button>
              </div>

              <div className="levelSkillUsersList">
                {selectedCategory.category.users.length === 0 ? (
                  <div className="levelSkillNoUsers">No users in this category</div>
                ) : (
                  selectedCategory.category.users.map((user) => (
                    <div className="levelSkillUserRow" key={user.userid}>
                      <img src={getAvatarUrl(user.username, user.avatar_url, 40)} alt="" />
                      <div>
                        <strong>{user.username}</strong>
                        <span>{user.email}</span>
                      </div>
                      <em>{formatScore(user.score)}</em>
                    </div>
                  ))
                )}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default LevelSkillBox;
