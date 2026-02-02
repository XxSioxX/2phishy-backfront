import "./topBox.scss";
import { useState, useEffect } from "react";
import { api } from "../../services/api";
import { TopScore } from "../../types/data";

const TopBox: React.FC = () => {
    const [userScores, setUserScores] = useState<TopScore[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchUserScores = async () => {
            try {
                const users = await api.getUsers();
                // Sort users by created_at descending (newest first)
                const sortedUsers = users
                    .sort((a, b) => {
                        const dateA = a.created_at ? new Date(a.created_at).getTime() : 0;
                        const dateB = b.created_at ? new Date(b.created_at).getTime() : 0;
                        return dateB - dateA;
                    })
                    .slice(0, 7) // Limit to 7 users like the mock data
                    .map((user, index) => ({
                        id: index + 1,
                        Img: "",
                        username: user.username,
                        email: user.email,
                        score: "NULL"
                    }));
                setUserScores(sortedUsers);
            } catch (error) {
                console.error('Failed to fetch user scores:', error);
                // Fallback to empty array
                setUserScores([]);
            } finally {
                setLoading(false);
            }
        };

        fetchUserScores();
    }, []);

    if (loading) {
        return (
            <div className="topBox">
                <h1>User Scores</h1>
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
                {userScores.map((user: TopScore) => (
                    <div className="listItem" key={user.id}>
                        <div className="user">
                            <img src="/profile.svg" alt="" />
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