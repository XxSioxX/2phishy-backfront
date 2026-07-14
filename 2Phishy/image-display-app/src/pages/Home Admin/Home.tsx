import { useState, useEffect, useRef } from "react"
import BarChartBox from "../../components/barChartBox/BarChartBox"
import ChartBox from "../../components/chartBox/ChartBox"
import TopBox from "../../components/topBox/TopBox"
import PieChartBox from "../../components/pieChartBox/PieChartBox"
import WeeklyUserModal from "../../components/weeklyUserModal/WeeklyUserModal"
import TopicPerformanceModal from "../../components/topicPerformanceModal/TopicPerformanceModal"
import LevelSkillBox from "../../components/levelSkillBox/LevelSkillBox"
import "./home.scss"
import { api } from "../../services/api"
import { useAuth } from "../../contexts/AuthContext"
import { initializeWeeklyStats, cacheWeeklyStats, WeeklyUserStats } from "../../utils/weeklyUserStats"

const emptyUserPerformanceCategories = [
    { name: "Excellent (80-100%)", value: 0, color: "#4CAF50" },
    { name: "Good (60-79%)", value: 0, color: "#FFB74D" },
    { name: "Needs Improvement", value: 0, color: "#E57373" },
];

const Home = () => {
    const { user, isAuthenticated } = useAuth();
    const userRole = user?.role;
    const [userStats, setUserStats] = useState<any>(null);
    const [activeParticipantsData, setActiveParticipantsData] = useState<any>(null);
    const [newUsersData, setNewUsersData] = useState<any>(null);
    const [topicPerformanceData, setTopicPerformanceData] = useState<any[]>([]);
    const [userPerformanceCategoriesData, setUserPerformanceCategoriesData] = useState<any[]>([]);
    const [levelSkillPerformanceData, setLevelSkillPerformanceData] = useState<any>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [showWeeklyModal, setShowWeeklyModal] = useState(false);
    const [showTopicModal, setShowTopicModal] = useState(false);
    const [weeklyStats, setWeeklyStats] = useState<WeeklyUserStats | null>(null);
    const dashboardFetchInFlightRef = useRef(false);

    useEffect(() => {
        let cancelled = false;

        const fetchDashboardData = async () => {
            if (!isAuthenticated || (userRole !== 'admin' && userRole !== 'super-admin')) {
                setLoading(false);
                return;
            }

            if (dashboardFetchInFlightRef.current) return;
            dashboardFetchInFlightRef.current = true;

            try {
                setLoading(true);
                setError(null);

                // Fetch all dashboard data in parallel
                const [userStatsData, activeParticipantsData, newUsersData, users, topicPerformance, userPerformanceCategories, levelSkillPerformance] = await Promise.all([
                    api.getUserStats(),
                    api.getActiveParticipantsOverTime('week'), // Default to weekly view for active participants
                    api.getNewUsersOverTime('week'), // Default to weekly view for new users
                    api.getUsers(), // Get all users for weekly stats
                    api.getTopicPerformance().catch((err) => {
                        console.warn('Failed to fetch topic performance data:', err);
                        return [];
                    }), // Get topic performance data
                    api.getUserPerformanceCategories().catch((err) => {
                        console.warn('Failed to fetch user performance categories:', err);
                        return emptyUserPerformanceCategories;
                    }), // Get overall student performance categories
                    api.getLevelSkillPerformance().catch((err) => {
                        console.warn('Failed to fetch level skill performance:', err);
                        return null;
                    })
                ]);

                if (cancelled) return;

                setUserStats(userStatsData);
                setActiveParticipantsData(activeParticipantsData);
                setNewUsersData(newUsersData);
                setTopicPerformanceData(topicPerformance);
                setUserPerformanceCategoriesData(userPerformanceCategories);
                setLevelSkillPerformanceData(levelSkillPerformance);

                // Initialize weekly stats from users data
                const stats = initializeWeeklyStats(users);
                setWeeklyStats(stats);
                cacheWeeklyStats(stats);

            } catch (err) {
                if (cancelled) return;
                console.error('Failed to fetch dashboard data:', err);
                setError(err instanceof Error ? err.message : 'Failed to load dashboard data');
            } finally {
                dashboardFetchInFlightRef.current = false;
                if (!cancelled) {
                    setLoading(false);
                }
            }
        };

        fetchDashboardData();
        return () => {
            cancelled = true;
        };
    }, [isAuthenticated, userRole]);

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

    // Create User Topics chart data from topic performance
    const barChartBoxUserTopics = {
        title: "User Topics (Areas Needing Improvement)",
        color: "#FFA500",
        dataKey: "score",
        chartData: topicPerformanceData.length > 0 ? topicPerformanceData.map(topic => ({
            name: topic.name,
            score: topic.score
        })) : [
            {name: "Safe Browsing", score: 0},
            {name: "Password Security", score: 0},
            {name: "Malware", score: 0},
            {name: "Social Engineering", score: 0},
            {name: "Incident Response", score: 0},
        ]
    };

    const pieChartBoxUserPerformance = {
        title: "User Performance Categories",
        icon: "/person4.svg",
        data: userPerformanceCategoriesData.length > 0 ? userPerformanceCategoriesData : emptyUserPerformanceCategories,
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

    if (!isAuthenticated || !user || (userRole !== 'admin' && userRole !== 'super-admin')) {
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
        <WeeklyUserModal
            isOpen={showWeeklyModal}
            onClose={() => setShowWeeklyModal(false)}
            weeklyStats={weeklyStats}
        />
        <TopicPerformanceModal
            isOpen={showTopicModal}
            onClose={() => setShowTopicModal(false)}
            topicData={topicPerformanceData}
        />
            <div className="box box1">
                <TopBox/>
            </div>
            <div className="box box2">
                <ChartBox 
                    {...chartBoxUser}
                    onViewAll={() => setShowWeeklyModal(true)}
                />
            </div>
            <div className="box box3"><LevelSkillBox data={levelSkillPerformanceData}/></div>
            <div className="box box4"><PieChartBox {...pieChartBoxUserPerformance}/></div>
            <div className="box box5"><ChartBox {...chartBoxActiveParticipants}/></div>
            <div className="box box6"><BarChartBox {...barChartBoxUserTopics} onViewAll={() => setShowTopicModal(true)}/></div>
        </div>
    )
}

export default Home
