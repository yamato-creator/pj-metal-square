import { GSCQueryData } from './gsc';

export interface TrafficData {
  date: string;
  account_id: string;
  total_users: number;
  new_users: number;
  sessions: number;
  page_views: number;
  source?: string;
  medium?: string;
}

export interface SourceSummary {
  date: string;
  account_id: string;
  source: string;
  medium: string;
  users: number;
}

export interface KeywordSummary {
  date: string;
  account_id: string;
  query: string;
  clicks: number;
  impressions: number;
  position: number;
}

export interface TrafficResponse {
  status: string;
  data: {
    daily: TrafficData[];
    monthly: TrafficData[];
    sources: SourceSummary[];
    keywords: KeywordSummary[];
  };
} 