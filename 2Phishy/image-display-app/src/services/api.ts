import { User, TopScore, Report, ChartBoxData } from '../types';

const API_BASE_URL = 'http://localhost:8000';

// Helper function to get auth headers
const getAuthHeaders = () => {
    const token = localStorage.getItem('token');
    return {
        'Content-Type': 'application/json',
        ...(token && { 'Authorization': `Bearer ${token}` })
    };
};

// Helper function to check if user is authenticated
export const isAuthenticated = (): boolean => {
    const token = localStorage.getItem('token');
    return !!token;
};

// Helper function to get current user
export const getCurrentUser = (): any => {
    const userStr = localStorage.getItem('user');
    return userStr ? JSON.parse(userStr) : null;
};

// Helper function to logout
export const logout = (): void => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
};

export const api = {
    // User related endpoints
    async login(username: string, password: string): Promise<{ access_token: string; user: User }> {
        const response = await fetch(`${API_BASE_URL}/users/login`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ username, password }),
        });
        
        if (!response.ok) {
            const errorData = await response.json().catch(() => ({}));
            const errorMessage = errorData.detail || `Login failed with status ${response.status}`;
            throw new Error(errorMessage);
        }
        
        return response.json();
    },

    async register(userData: Omit<User, 'id'>): Promise<User> {
        const response = await fetch(`${API_BASE_URL}/users/register`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(userData),
        });
        
        if (!response.ok) {
            const errorData = await response.json().catch(() => ({}));
            const errorMessage = errorData.detail || `Registration failed with status ${response.status}`;
            throw new Error(errorMessage);
        }
        
        return response.json();
    },

    // User management endpoints
    async getUsers(): Promise<User[]> {
        const response = await fetch(`${API_BASE_URL}/users/`, {
            headers: getAuthHeaders()
        });
        if (!response.ok) {
            throw new Error('Failed to fetch users');
        }
        const data = await response.json();
        return Array.isArray(data) ? data.map((user: any) => ({
            ...user,
            userid: user.userid || user.id,
        })) : [];
    },

    async getUser(userId: string): Promise<User> {
        const response = await fetch(`${API_BASE_URL}/users/${userId}`, {
            headers: getAuthHeaders()
        });
        if (!response.ok) {
            throw new Error('Failed to fetch user');
        }
        const user = await response.json();
        return { ...user, userid: user.userid || user.id };
    },

    async createUser(userData: Omit<User, 'id'>): Promise<User> {
        const response = await fetch(`${API_BASE_URL}/users/`, {
            method: 'POST',
            headers: getAuthHeaders(),
            body: JSON.stringify(userData),
        });
        if (!response.ok) {
            throw new Error('Failed to create user');
        }
        const user = await response.json();
        return { ...user, userid: user.userid || user.id };
    },

    async updateUser(userId: string, userData: Partial<User>): Promise<User> {
        const response = await fetch(`${API_BASE_URL}/users/${userId}`, {
            method: 'PUT',
            headers: getAuthHeaders(),
            body: JSON.stringify(userData),
        });
        if (!response.ok) {
            throw new Error('Failed to update user');
        }
        const user = await response.json();
        return { ...user, userid: user.userid || user.id };
    },

    async deleteUser(userId: string): Promise<void> {
        const response = await fetch(`${API_BASE_URL}/users/${userId}`, {
            method: 'DELETE',
            headers: getAuthHeaders()
        });
        if (!response.ok) {
            throw new Error('Failed to delete user');
        }
    },

    // Data related endpoints
    async getTopScores(): Promise<TopScore[]> {
        const response = await fetch(`${API_BASE_URL}/scores`);
        if (!response.ok) {
            throw new Error('Failed to fetch scores');
        }
        return response.json();
    },

    async getReports(): Promise<Report[]> {
        const response = await fetch(`${API_BASE_URL}/reports`);
        if (!response.ok) {
            throw new Error('Failed to fetch reports');
        }
        return response.json();
    },

    async getChartData(): Promise<ChartBoxData> {
        const response = await fetch(`${API_BASE_URL}/chart-data`);
        if (!response.ok) {
            throw new Error('Failed to fetch chart data');
        }
        return response.json();
    },

    // Dashboard statistics endpoints
    async getUserStats(): Promise<{
        total_users: number;
        active_users: number;
        inactive_users: number;
        suspended_users: number;
        students: number;
        admins: number;
        super_admins: number;
    }> {
        const response = await fetch(`${API_BASE_URL}/admin/stats`, {
            headers: getAuthHeaders()
        });
        if (!response.ok) {
            throw new Error('Failed to fetch user statistics');
        }
        return response.json();
    },

    async getAssessmentStats(): Promise<{
        total_sessions: number;
        average_score: number;
        total_questions: number;
        correct_answers: number;
        topics_completed: string[];
    }> {
        // Get all users first to calculate overall assessment stats
        const users = await this.getUsers();
        const studentUsers = users.filter(user => user.role === 'student');
        
        if (studentUsers.length === 0) {
            return {
                total_sessions: 0,
                average_score: 0,
                total_questions: 0,
                correct_answers: 0,
                topics_completed: []
            };
        }

        // Get assessment stats for all students
        const allStats = await Promise.all(
            studentUsers.map(async (user) => {
                try {
                    const response = await fetch(`${API_BASE_URL}/game/assessment/stats/${user.userid}`, {
                        headers: getAuthHeaders()
                    });
                    if (response.ok) {
                        return await response.json();
                    }
                    return null;
                } catch (error) {
                    console.warn(`Failed to fetch stats for user ${user.userid}:`, error);
                    return null;
                }
            })
        );

        // Aggregate the statistics
        const validStats = allStats.filter(stat => stat !== null);
        
        if (validStats.length === 0) {
            return {
                total_sessions: 0,
                average_score: 0,
                total_questions: 0,
                correct_answers: 0,
                topics_completed: []
            };
        }

        const totalSessions = validStats.reduce((sum, stat) => sum + stat.total_sessions, 0);
        const totalQuestions = validStats.reduce((sum, stat) => sum + stat.total_questions, 0);
        const correctAnswers = validStats.reduce((sum, stat) => sum + stat.correct_answers, 0);
        const averageScore = validStats.reduce((sum, stat) => sum + stat.average_score, 0) / validStats.length;
        
        // Get unique topics completed
        const allTopics = validStats.flatMap(stat => stat.topics_completed);
        const uniqueTopics = [...new Set(allTopics)];

        return {
            total_sessions: totalSessions,
            average_score: Math.round(averageScore * 100) / 100,
            total_questions: totalQuestions,
            correct_answers: correctAnswers,
            topics_completed: uniqueTopics
        };
    },

    async getNewUsersOverTime(period: 'week' | 'month' = 'week'): Promise<Array<{name: string, users: number}>> {
        try {
            // Get all users
            const users = await this.getUsers();
            
            if (users.length === 0) {
                return this.getEmptyUserTimeSeries(period);
            }

            // Group users by registration date
            const groupedUsers = this.groupUsersByPeriod(users, period);
            
            return this.formatUserTimeSeriesData(groupedUsers, period);
        } catch (error) {
            console.error('Failed to fetch new users over time:', error);
            return this.getEmptyUserTimeSeries(period);
        }
    },

    async getActiveParticipantsOverTime(period: 'week' | 'month' = 'week'): Promise<Array<{name: string, active: number}>> {
        try {
            // Get all users
            const users = await this.getUsers();
            
            if (users.length === 0) {
                return this.getEmptyTimeSeries(period);
            }

            // Group users by last online date (using PHT)
            const groupedUsers = this.groupUsersByLastOnline(users, period);
            
            return this.formatTimeSeriesData(groupedUsers, period);
        } catch (error) {
            console.error('Failed to fetch active participants over time:', error);
            return this.getEmptyTimeSeries(period);
        }
    },

    // Helper methods for time series data
    getEmptyTimeSeries(period: 'week' | 'month'): Array<{name: string, active: number}> {
        if (period === 'week') {
            return [
                { name: "Sun", active: 0 },
                { name: "Mon", active: 0 },
                { name: "Tue", active: 0 },
                { name: "Wed", active: 0 },
                { name: "Thu", active: 0 },
                { name: "Fri", active: 0 },
                { name: "Sat", active: 0 }
            ];
        } else {
            return [
                { name: "Jan", active: 0 },
                { name: "Feb", active: 0 },
                { name: "Mar", active: 0 },
                { name: "Apr", active: 0 },
                { name: "May", active: 0 },
                { name: "Jun", active: 0 },
                { name: "Jul", active: 0 },
                { name: "Aug", active: 0 },
                { name: "Sep", active: 0 },
                { name: "Oct", active: 0 },
                { name: "Nov", active: 0 },
                { name: "Dec", active: 0 }
            ];
        }
    },

    groupSessionsByPeriod(sessions: any[], period: 'week' | 'month'): Record<string, Set<string>> {
        const grouped: Record<string, Set<string>> = {};
        
        sessions.forEach(session => {
            if (!session.start_time) return;
            
            const date = new Date(session.start_time);
            let key: string;
            
            if (period === 'week') {
                // Group by day of week
                key = date.toLocaleDateString('en-US', { weekday: 'short' });
            } else {
                // Group by month
                key = date.toLocaleDateString('en-US', { month: 'short' });
            }
            
            if (!grouped[key]) {
                grouped[key] = new Set();
            }
            
            // Add unique user ID to track active participants
            if (session.user_id) {
                grouped[key].add(session.user_id);
            }
        });
        
        return grouped;
    },

    formatTimeSeriesData(groupedSessions: Record<string, Set<string>>, period: 'week' | 'month'): Array<{name: string, active: number}> {
        const timeSeries = this.getEmptyTimeSeries(period);
        
        return timeSeries.map(item => ({
            name: item.name,
            active: groupedSessions[item.name] ? groupedSessions[item.name].size : 0
        }));
    },

    // Helper method to group users by last online date using PHT
    groupUsersByLastOnline(users: any[], period: 'week' | 'month'): Record<string, Set<string>> {
        const grouped: Record<string, Set<string>> = {};
        
        // Get current PHT time
        const now = new Date();
        const phtOffset = 8 * 60; // PHT is UTC+8
        const phtNow = new Date(now.getTime() + (phtOffset * 60 * 1000));
        
        // Calculate time threshold (this week or this month)
        const threshold = new Date(phtNow);
        if (period === 'week') {
            // Start of this week (Sunday)
            const dayOfWeek = phtNow.getDay();
            threshold.setDate(phtNow.getDate() - dayOfWeek);
            threshold.setHours(0, 0, 0, 0);
        } else {
            // Start of this month
            threshold.setDate(1);
            threshold.setHours(0, 0, 0, 0);
        }
        
        users.forEach((user) => {
            // Use last_login if available, otherwise use created_at (for recently created users)
            const lastActivity = user.last_login || user.created_at;
            if (!lastActivity) {
                return;
            }
            
            const lastActivityDate = new Date(lastActivity);
            
            // Convert to PHT
            const phtLastActivity = new Date(lastActivityDate.getTime() + (phtOffset * 60 * 1000));
            
            // Check if user was active within the period
            if (phtLastActivity >= threshold) {
                let key: string;
                
                if (period === 'week') {
                    // Group by day of week
                    key = phtLastActivity.toLocaleDateString('en-US', { weekday: 'short' });
                } else {
                    // Group by month
                    key = phtLastActivity.toLocaleDateString('en-US', { month: 'short' });
                }
                
                if (!grouped[key]) {
                    grouped[key] = new Set();
                }
                
                // Add unique user ID to track active participants
                if (user.userid) {
                    grouped[key].add(user.userid);
                }
            }
        });
        
        return grouped;
    },

    // Helper methods for new user time series data
    getEmptyUserTimeSeries(period: 'week' | 'month'): Array<{name: string, users: number}> {
        if (period === 'week') {
            return [
                { name: "Sun", users: 0 },
                { name: "Mon", users: 0 },
                { name: "Tue", users: 0 },
                { name: "Wed", users: 0 },
                { name: "Thu", users: 0 },
                { name: "Fri", users: 0 },
                { name: "Sat", users: 0 }
            ];
        } else {
            return [
                { name: "Jan", users: 0 },
                { name: "Feb", users: 0 },
                { name: "Mar", users: 0 },
                { name: "Apr", users: 0 },
                { name: "May", users: 0 },
                { name: "Jun", users: 0 },
                { name: "Jul", users: 0 },
                { name: "Aug", users: 0 },
                { name: "Sep", users: 0 },
                { name: "Oct", users: 0 },
                { name: "Nov", users: 0 },
                { name: "Dec", users: 0 }
            ];
        }
    },

    groupUsersByPeriod(users: any[], period: 'week' | 'month'): Record<string, number> {
        const grouped: Record<string, number> = {};
        
        users.forEach(user => {
            if (!user.created_at) return;
            
            const date = new Date(user.created_at);
            let key: string;
            
            if (period === 'week') {
                // Group by day of week
                key = date.toLocaleDateString('en-US', { weekday: 'short' });
            } else {
                // Group by month
                key = date.toLocaleDateString('en-US', { month: 'short' });
            }
            
            if (!grouped[key]) {
                grouped[key] = 0;
            }
            
            grouped[key]++;
        });
        
        return grouped;
    },

    formatUserTimeSeriesData(groupedUsers: Record<string, number>, period: 'week' | 'month'): Array<{name: string, users: number}> {
        const timeSeries = this.getEmptyUserTimeSeries(period);
        
        return timeSeries.map(item => ({
            name: item.name,
            users: groupedUsers[item.name] || 0
        }));
    }
}; 