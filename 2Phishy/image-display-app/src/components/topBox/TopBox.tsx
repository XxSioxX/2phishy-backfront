import "./topBox.scss";
import { useState, useEffect, useRef } from "react";
import { api } from "../../services/api";
import { TopScore } from "../../types/data";
import type { User } from "../../types";
import { getAvatarUrl } from "../../utils/avatarUtils";
import { parseBackendDate } from "../../utils/dateUtils";

const TopBox: React.FC = () => {
    const [userScores, setUserScores] = useState<(TopScore & { last_seen?: string | null; user: User })[]>([]);
    const [loading, setLoading] = useState(true);
    const [onlineStatus, setOnlineStatus] = useState<Record<string, boolean>>({});
    const fetchInFlightRef = useRef(false);

    // Check if user is online
    const isOnline = (user: User): boolean => {
        const userId = user.userid || user.id?.toString();
        if (userId && onlineStatus[userId] !== undefined) {
            return onlineStatus[userId];
        }

        const lastSeen = parseBackendDate(user.last_seen);
        if (!lastSeen) return false;
        return new Date().getTime() - lastSeen.getTime() < 10 * 60 * 1000;
    };

    useEffect(() => {
        let cancelled = false;

        const fetchUserScores = async () => {
            if (fetchInFlightRef.current) return;
            fetchInFlightRef.current = true;

            try {
                const [users, topScoresData, statuses] = await Promise.all([
                    api.getUsers(),
                    api.getTopScores(),
                    api.getOnlineStatus().catch((err) => {
                        console.warn('Falling back to last_seen presence:', err);
                        return {};
                    }),
                ]);
                if (cancelled) return;

                setOnlineStatus(statuses);
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
                if (cancelled) return;
                console.error('Failed to fetch user scores:', error);
                setUserScores([]);
            } finally {
                fetchInFlightRef.current = false;
                if (!cancelled) {
                    setLoading(false);
                }
            }
        };
        fetchUserScores();
        const intervalId = setInterval(fetchUserScores, 30000);
        return () => {
            cancelled = true;
            clearInterval(intervalId);
        };
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
                                    src={getAvatarUrl(user.username, user.user.avatar_url || undefined, 48)}
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
