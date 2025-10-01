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
    }
}; 