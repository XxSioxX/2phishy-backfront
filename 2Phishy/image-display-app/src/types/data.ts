export interface TopScore {
    id: number;
    Img: string;
    username: string;
    email: string;
    score: string;
}

export interface ChartData {
    name: string;
    [key: string]: number | string;
}

export interface ChartBoxData {
    color: string;
    icon: string;
    title: string;
    number: string | number;
    dataKey: string;
    percentage: number;
    chartData: Array<{
        name: string;
        [key: string]: number | string;
    }>;
}

export interface BarChartData {
    title: string;
    color: string;
    dataKey: string;
    chartData: ChartData[];
}

export interface Report {
    id: string;
    message: string;
    status: "High" | "Mid" | "Low";
    date: string;
    type: "Bug" | "Exploit" | "Behavior";
} 