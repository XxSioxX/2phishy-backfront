export interface User {
  id?: number; // Keep for backward compatibility
  userid?: string; // Primary ID field (UUID from backend) - optional for creation
  username: string;
  email: string;
  password?: string;
  created_at?: string;
  last_login?: string | null;
  account_status?: "active" | "inactive" | "suspended";
  role?: "student" | "admin" | "super-admin";
}

export interface Report {
  id: string;
  message: string;
  status: "High" | "Mid" | "Low";
  date: string;
  type: "Bug" | "Exploit" | "Behavior";
  user_id?: string;
  username?: string;
  user_role?: "student" | "admin" | "super-admin";
}

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
  number: string;
  dataKey: string;
  percentage: number;
  chartData: ChartData[];
}

export interface BarChartData {
  title: string;
  color: string;
  dataKey: string;
  chartData: ChartData[];
} 