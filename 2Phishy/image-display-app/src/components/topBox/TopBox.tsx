import "./topBox.scss";
import { useState, useEffect } from "react";
import { api } from "../../services/api";
import { TopScore } from "../../types/data";
import type { User } from "../../types";
import { generateAvatarUrl } from "../../utils/avatarUtils";
import { parseBackendDate } from "../../utils/dateUtils";

const TopBox: React.FC = () => {
    const [userScores, setUserScores] = useState<(TopScore & { last_seen?: string | null; user: User })[]>([]);
    const [loading, setLoading] = useState(true);

    // Check if user is online
    const isOnline = (user: User): boolean => {
        const lastSeen = parseBackendDate(user.last_seen);
        if (!lastSeen) return false;
        return new Date().getTime() - lastSeen.getTime() < 10 * 60 * 1000;
    };

    useEffect(() => {
        const fetchUserScores = async () => {
            try {
                const users = await api.getUsers();
                const topScoresData = await api.getTopScores();
                const scoreMap = new Map(
                    topScoresData.map((item: any) => [
                        item.user_id,
                        item.overall_knowledge_score
                    ])
                );
                const userScoreObjects = users.map((user: User) => {
                    const score = scoreMap.get(user.userid || user.id?.toString() || "") || 0;
                    return {
                        id: 0,
                        Img: "",
                        username: user.username,
                        email: user.email,
                        score: score,
                        scoreString: score.toString(),
                        last_seen: user.last_seen,
                        user: user
                    };
                });
                const sortedUsers = userScoreObjects
                    .sort((a, b) => b.score - a.score)
                    .slice(0, 7)
                    .map((item, index) => ({
                        ...item,
                        id: index + 1,
                        score: item.scoreString
                    }));
                setUserScores(sortedUsers);
            } catch (error) {
                console.error('Failed to fetch user scores:', error);
                setUserScores([]);
            } finally {
                setLoading(false);
            }
        };
        fetchUserScores();
        const intervalId = setInterval(fetchUserScores, 5000);
        return () => clearInterval(intervalId);
    }, []);

    if (loading) {
        return (
            <div className="topBox">
                <h1>Overall User Scores</h1>
                <div className="list">
                    <div style={{ textAlign: 'center', padding: '20px' }}>
                        Loading...
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="topBox">
            <h1>User Scores</h1>
            <div className="list">
                {userScores.map((user) => (
                    <div className="listItem" key={user.id}>
                        <div className="user">
                            <div className="profile-container">
                                <img 
                                    src={generateAvatarUrl(user.username, 48)}
                                    alt={`${user.username}'s avatar`}
                                    className="user-avatar"
                                />
                                <span
                                    className={`status-dot ${isOnline(user.user) ? 'online' : 'offline'}`}
                                ></span>
                            </div>
                            <div className="userTexts">
                                <span className="username">{user.username}</span>
                                <span className="email">{user.email}</span>
                            </div>
                        </div>
                        <span className="score">PTS {user.score}</span>
                    </div>
                ))}
            </div>
        </div>
    );
};

export default TopBox;
