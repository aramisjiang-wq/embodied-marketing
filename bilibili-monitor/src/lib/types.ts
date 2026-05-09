export interface Brand {
  id: number;
  mid: string;
  name: string;
  is_self?: number;
  created_at: string;
  updated_at: string;
}

export interface Video {
  id: number;
  bvid: string;
  brand_id: number;
  title: string | null;
  pub_ts: number | null;
  pub_date: string | null;
  created_at: string;
}

export interface VideoStat {
  id: number;
  video_id: number;
  stat_date: string;
  view: number;
  like: number;
  coin: number;
  favorite: number;
  reply: number;
  danmaku: number;
  share: number;
  created_at: string;
}

export interface BrandStat {
  id: number;
  brand_id: number;
  stat_date: string;
  follower: number;
  following: number;
  created_at: string;
}

export interface BrandWithStats extends Brand {
  follower: number;
  following: number;
  video_count: number;
  total_views: number;
  last_update: string | null;
  videos?: VideoWithStats[];
  monthly_stats?: MonthlyStat[];
}

export interface MonthlyStat {
  month: string;
  video_count: number;
  total_views: number;
  total_likes: number;
  total_favorites: number;
}

export interface VideoWithStats extends Video {
  view: number;
  like: number;
  coin: number;
  favorite: number;
  reply: number;
}

export interface BrandPeriodStat {
  period: string;
  brand_id: number;
  brand_name: string;
  is_self?: number;
  video_count: number;
  total_views: number;
  total_likes?: number;
}

export interface VideoWithBrand {
  bvid: string;
  title: string | null;
  pub_date: string | null;
  brand_name: string;
  brand_id: number;
}
