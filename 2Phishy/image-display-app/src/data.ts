export const topScores = [
    {
        id: 1,
        Img: "",
        username: "Andre Perez",
        email: "mavp061203@gmail.com",
        score: "1000",
    },
    {
        id: 2,
        Img: "",
        username: "Jahnreil Amarillento",
        email: "JahnReil@gmail.com",
        score: "900",
    },
    {
        id: 3,
        Img: "",
        username: "Elijah Tam-Od",
        email: "Elijah@gmail.com",
        score: "800",
    },
    {
        id: 4,
        Img: "",
        username: "Heso Yam",
        email: "hesoyam@gmail.com",
        score: "700",
    },
    {
        id: 5,
        Img: "",
        username: "Leni Penk",
        email: "leni@gmail.com",
        score: "600",
    },
    {
        id: 6,
        Img: "",
        username: "Baby Marcos",
        email: "marcos@gmail.com",
        score: "500",
    },
    {
        id: 7,
        Img: "",
        username: "Ninoy Aquino",
        email: "ninoy@gmail.com",
        score: "400",
    },
];

// chartBoxUser and chartBoxActiveParticipants are now dynamically generated in Home.tsx
// using real data from the backend API

export const barChartBoxVisit = {
    title: "Total Visit",
    color: "#FFA500",
    dataKey: "visit",
    chartData: [
        {
            name: "Sun",
            visit: 100,
        },
        {
            name: "Mon",
            visit: 300,
        },
        {
            name: "Tue",
            visit: 500,
        },
        {
            name: "Wed",
            visit: 200,
        },
        {
            name: "Thu",
            visit: 385,
        },
        {
            name: "Fri",
            visit: 426,
        },
        {
            name: "Sat",
            visit: 233,
        },
    ]
};

export const chartBoxQuizRate = {
    color: "#FF8042",
    icon: "/quiz.svg",
    title: "Quiz Completion Rate",
    number: "85%",
    dataKey: "rate",
    percentage: 85,
    chartData: [
        {name: "Sun", rate: 75},
        {name: "Mon", rate: 82},
        {name: "Tue", rate: 88},
        {name: "Wed", rate: 85},
        {name: "Thu", rate: 90},
        {name: "Fri", rate: 87},
        {name: "Sat", rate: 83},
    ],
};

// Function to get reports from localStorage
export const getReportsFromStorage = () => {
  try {
    console.log('getReportsFromStorage called');
    // Get student reports from localStorage
    const storedReports = localStorage.getItem('studentReports');
    console.log('Raw stored reports:', storedReports);
    const studentReports = storedReports ? JSON.parse(storedReports) : [];
    console.log('Parsed student reports:', studentReports);
    
    // Convert student reports to the main Report format
    const convertedStudentReports = studentReports.map((report: any) => ({
      id: report.id,
      message: report.message,
      status: report.status as "High" | "Mid" | "Low",
      date: report.date,
      type: report.type as "Bug" | "Exploit" | "Behavior",
      user_id: report.user_id,
      username: "testuser", // For now, assume all student reports are from testuser
      user_role: "student" as const
    }));
    
    console.log('Converted reports:', convertedStudentReports);
    return convertedStudentReports;
  } catch (error) {
    console.error("Error loading reports from localStorage:", error);
    return [];
  }
};

// Keep empty array for backward compatibility
export const reports: any[] = [];

export const quizInsightsMockData = [
  { user: "Alice", quiz: "Math Basics", score: 85, attempts: 2, lastAttempt: "2024-06-01" },
  { user: "Bob", quiz: "Science 101", score: 92, attempts: 1, lastAttempt: "2024-06-02" },
  { user: "Charlie", quiz: "History Facts", score: 78, attempts: 3, lastAttempt: "2024-05-30" },
];

export interface PostMockData {
  title: string;
  category: string;
  status: string;
  date: string;
}

export const postsMockData: PostMockData[] = [
  { title: "How to Detect Spoofed URLs", category: "Tip", status: "Published", date: "July 15" },
  { title: "Leaderboard Reset This Friday", category: "Announcement", status: "Published", date: "July 21" },
  { title: "New Quiz on Social Engineering", category: "Update", status: "Draft", date: "—" },
]; 