import "./topBox.scss";
import { useState, useEffect } from "react";
import { api } from "../../services/api";
import { TopScore } from "../../types/data";
import type { User } from "../../types";

const TopBox: React.FC = () => {
    const [userScores, setUserScores] = useState<(TopScore & { last_seen?: string | null; user: User })[]>([]);
    const [loading, setLoading] = useState(true);

    // Check if user is online (last seen within last 10 minutes)
    const isOnline = (user: User): boolean => {
        if (!user.last_seen) return false;
        return new Date().getTime() - new Date(user.last_seen).getTime() < 10 * 60 * 1000;
    };

    useEffect(() => {
        const fetchUserScores = async () => {
            try {
                const users = await api.getUsers();
                const topScoresData = await api.getTopScores();
                
                // Create a map of user_id to score for quick lookup
                const scoreMap = new Map(
                    topScoresData.map((item: any) => [
                        item.user_id,
                        item.overall_knowledge_score
                    ])
                );
                
                // Create user score objects
                const userScoreObjects = users.map((user: User) => {
                    const score = scoreMap.get(user.userid || user.id?.toString() || "") || 0;
                    return {
                        id: 0, // Will be set after sorting
                        Img: "",
                        username: user.username,
                        email: user.email,
                        score: score,
                        scoreString: score.toString(),
                        last_seen: user.last_seen,
                        user: user
                    };
                });

                // Sort by score descending, then take top 7
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

        // Initial fetch
        fetchUserScores();

        // Poll every 5 seconds
        const intervalId = setInterval(fetchUserScores, 5000);

        // Cleanup interval on unmount
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
                                <img src="/profile.svg" alt="" />
                                <span
                                    className="status-dot"
                                    style={{ background: isOnline(user.user) ? 'green' : 'gray' }}
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
