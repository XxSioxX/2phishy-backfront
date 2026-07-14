export interface User {
  id?: number; // Keep for backward compatibility
  userid?: string; // Primary ID field (UUID from backend) - optional for creation
  username: string;
  email: string;
  password?: string;
  created_at?: string;
  last_login?: string | null;
  last_seen?: string | null;
  account_status?: "active" | "inactive" | "suspended";
  role?: "student" | "admin" | "super-admin";
  privacy_policy_accepted?: boolean;
  privacy_policy_accepted_at?: string | null;
  thesis_consent_accepted?: boolean;
  thesis_consent_accepted_at?: string | null;
  consent_version?: string | null;
  avatar_url?: string | null;
}

export interface SystemSettings {
  system_name: string;
  institution_name: string;
  logo_url: string;
  login_subtitle: string;
  register_subtitle: string;
  privacy_summary: string;
  consent_text: string;
  updated_at?: string | null;
  updated_by?: string | null;
}

export type SystemContentType = "knowledge_base" | "question_base" | "initial_assessment";

export interface SystemContentRecord {
  content_type: SystemContentType;
  label: string;
  data: any;
  source: "default" | "draft" | "published" | string;
  draft_version: number;
  published_version: number;
  has_draft: boolean;
  updated_at?: string | null;
  updated_by?: string | null;
}

export interface Report {
  id: string;
  message: string;
  status: "High" | "Mid" | "Low";
  date: string;
  type: "Bug" | "Exploit" | "Behavior";
  user_id?: string;
  username?: string;
  studentId?: string;
  user_role?: "student" | "admin" | "super-admin";
}

export interface ReportWithResolved extends Report {
  resolved?: boolean;
}

export interface Announcement {
  isPublished: boolean;
  isScheduled: boolean;
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
