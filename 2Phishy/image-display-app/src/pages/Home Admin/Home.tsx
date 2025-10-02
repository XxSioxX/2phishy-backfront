
import { useState, useEffect } from "react"
import BarChartBox from "../../components/barChartBox/BarChartBox"
import ChartBox from "../../components/chartBox/ChartBox"
import TopBox from "../../components/topBox/TopBox"
import PieChartBox from "../../components/pieChartBox/PieChartBox"
import { barChartBoxVisit, chartBoxQuizRate } from "../../data"
import "./home.scss"
import BigChartBox from "../../components/bigChartBox/BigChartBox"
import { api } from "../../services/api"
import { useAuth } from "../../contexts/AuthContext"

const Home = () => {
    const { user, isAuthenticated } = useAuth();
    const [userStats, setUserStats] = useState<any>(null);
    const [activeParticipantsData, setActiveParticipantsData] = useState<any>(null);
    const [newUsersData, setNewUsersData] = useState<any>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        const fetchDashboardData = async () => {
            if (!isAuthenticated || !user || (user.role !== 'admin' && user.role !== 'super-admin')) {
                setLoading(false);
                return;
            }

            try {
                setLoading(true);
                setError(null);

                // Fetch all dashboard data in parallel
                const [userStatsData, activeParticipantsData, newUsersData] = await Promise.all([
                    api.getUserStats(),
                    api.getActiveParticipantsOverTime('week'), // Default to weekly view for active participants
                    api.getNewUsersOverTime('week') // Default to weekly view for new users
                ]);

                setUserStats(userStatsData);
                setActiveParticipantsData(activeParticipantsData);
                setNewUsersData(newUsersData);

            } catch (err) {
                console.error('Failed to fetch dashboard data:', err);
                setError(err instanceof Error ? err.message : 'Failed to load dashboard data');
            } finally {
                setLoading(false);
            }
        };

        fetchDashboardData();
    }, [isAuthenticated, user]);

    // Create dynamic chart data based on real data
    const chartBoxUser = {
        color: "#8884d8",
        icon: "/person4.svg",
        title: "Total Users",
        number: userStats?.total_users?.toString() || "0",
        dataKey: "users",
        percentage: newUsersData ? newUsersData.reduce((sum: number, day: any) => sum + day.users, 0) : 0, // Show total new users this week
        chartData: newUsersData || [
            {name: "Sun", users: 0},
            {name: "Mon", users: 0},
            {name: "Tue", users: 0},
            {name: "Wed", users: 0},
            {name: "Thu", users: 0},
            {name: "Fri", users: 0},
            {name: "Sat", users: 0},
        ],
    };

    // Calculate active participants percentage
    const totalActiveThisWeek = activeParticipantsData ? activeParticipantsData.reduce((sum: number, day: any) => sum + day.active, 0) : 0;
    const totalUsers = userStats?.total_users || 0;
    const activePercentage = totalUsers > 0 ? Math.round((totalActiveThisWeek / totalUsers) * 100) : 0;

    const chartBoxActiveParticipants = {
        color: "#00C49F",
        icon: "/calendar.svg",
        title: "Active Participants Over Time",
        number: totalActiveThisWeek.toString(),
        dataKey: "active",
        percentage: activePercentage,
        chartData: activeParticipantsData || [
            { name: "Sun", active: 0 },
            { name: "Mon", active: 0 },
            { name: "Tue", active: 0 },
            { name: "Wed", active: 0 },
            { name: "Thu", active: 0 },
            { name: "Fri", active: 0 },
            { name: "Sat", active: 0 },
        ],
    };

    if (loading) {
        return (
            <div className="home">
                <div style={{ 
                    display: 'flex', 
                    justifyContent: 'center', 
                    alignItems: 'center', 
                    height: '100%',
                    fontSize: '18px',
                    color: '#666'
                }}>
                    Loading dashboard data...
                </div>
            </div>
        );
    }

    if (error) {
        return (
            <div className="home">
                <div style={{ 
                    display: 'flex', 
                    justifyContent: 'center', 
                    alignItems: 'center', 
                    height: '100%',
                    fontSize: '18px',
                    color: '#e74c3c'
                }}>
                    Error: {error}
                </div>
            </div>
        );
    }

    if (!isAuthenticated || !user || (user.role !== 'admin' && user.role !== 'super-admin')) {
        return (
            <div className="home">
                <div style={{ 
                    display: 'flex', 
                    justifyContent: 'center', 
                    alignItems: 'center', 
                    height: '100%',
                    fontSize: '18px',
                    color: '#e74c3c'
                }}>
                    Access denied. Admin privileges required.
                </div>
            </div>
        );
    }

    return(
        <div className="home">
            <div className="box box1">
                <TopBox/>
            </div>
            <div className="box box2"><ChartBox {...chartBoxUser}/></div>
            <div className="box box3"><ChartBox {...chartBoxQuizRate}/></div>
            <div className="box box4"><PieChartBox/></div>
            <div className="box box5"><ChartBox {...chartBoxActiveParticipants}/></div>
            <div className="box box6"><BarChartBox {...barChartBoxVisit}/> </div>
            <div className="box box7"><BigChartBox /></div>
        </div>
    )
}

export default Home