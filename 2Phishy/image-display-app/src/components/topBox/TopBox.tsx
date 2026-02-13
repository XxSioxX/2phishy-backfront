import "./topBox.scss";
import { useState, useEffect } from "react";
import { api } from "../../services/api";
import { useAuth } from "../../contexts/AuthContext";
import { TopScore } from "../../types/data";
import type { User } from "../../types";

const TopBox: React.FC = () => {
    const { user: currentUser } = useAuth();
    const [userScores, setUserScores] = useState<(TopScore & { last_login?: string | null; isOnline?: boolean })[]>([]);
    const [loading, setLoading] = useState(true);

    // Check if user is online (last login within last 10 minutes, or is the current user)
    const isUserOnline = (userToCheck?: any, lastLogin?: string | null): boolean => {
        // Current user is always online if logged in
        if (currentUser && userToCheck && (userToCheck.id === currentUser.userid || userToCheck.userid === currentUser.userid)) {
            return true;
        }
        
        if (!lastLogin) return false;
        try {
            const lastLoginTime = new Date(lastLogin).getTime();
            const currentTime = new Date().getTime();
            const tenMinutesMs = 10 * 60 * 1000;
            return (currentTime - lastLoginTime) < tenMinutesMs;
        } catch {
            return false;
        }
    };

    useEffect(() => {
        const fetchUserScores = async () => {
            try {
                const users = await api.getUsers();
                // Sort users by created_at descending (newest first)
                const sortedUsers = users
                    .sort((a: User, b: User) => {
                        const dateA = a.created_at ? new Date(a.created_at).getTime() : 0;
                        const dateB = b.created_at ? new Date(b.created_at).getTime() : 0;
                        return dateB - dateA;
                    })
                    .slice(0, 7) // Limit to 7 users like the mock data
                    .map((user: User, index: number) => ({
                        id: index + 1,
                        Img: "",
                        username: user.username,
                        email: user.email,
                        score: "NULL",
                        last_login: user.last_login,
                        isOnline: isUserOnline(user, user.last_login)
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
                {userScores.map((user) => (
                    <div className="listItem" key={user.id}>
                        <div className="user">
                            <div className="profile-container">
                                <img src="/profile.svg" alt="" />
                                <span className={`status-dot ${user.isOnline ? 'online' : 'offline'}`}></span>
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