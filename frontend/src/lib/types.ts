/* Subset of AniLibria types we actually use on the frontend */

export type Localized = {
  value: string | null;
  description: string | null;
};

export type LabeledNum = {
  value: number | null;
  description: string | null;
};

export type Poster = {
  src: string | null;
  preview: string | null;
  thumbnail: string | null;
  optimized?: {
    src: string | null;
    preview: string | null;
    thumbnail: string | null;
  };
};

export type Genre = { id: number; name: string; image?: { preview?: string } };

export type Episode = {
  id: string;
  ordinal: number;
  name: string | null;
  name_english: string | null;
  duration: number | null;
  preview: Poster;
  hls_480: string | null;
  hls_720: string | null;
  hls_1080: string | null;
  opening: { start: number | null; stop: number | null };
  ending: { start: number | null; stop: number | null };
};

export type ReleaseSummary = {
  id: number;
  alias: string;
  type: Localized;
  year: number;
  name: { main: string; english: string | null; alternative: string | null };
  season: Localized;
  poster: Poster;
  description?: string | null;
  is_ongoing: boolean;
  age_rating: { value: string; label: string; description: string };
  publish_day?: LabeledNum;
  episodes_total?: number;
  added_in_users_favorites?: number;
  average_duration_of_episode?: number;
  added_in_planned_collection?: number;
  added_in_watched_collection?: number;
  added_in_watching_collection?: number;
  added_in_postponed_collection?: number;
  added_in_abandoned_collection?: number;
  fresh_at?: string;
};

export type Release = ReleaseSummary & {
  genres: Genre[];
  episodes: Episode[];
};

export type CatalogResponse = {
  data: ReleaseSummary[];
  meta: {
    pagination: {
      total: number;
      count: number;
      per_page: number;
      current_page: number;
      total_pages: number;
      links?: { next?: string; prev?: string };
    };
  };
};

export type References = {
  genres: Genre[];
  years: number[];
  types: { value: string; description: string }[];
  age_ratings: { value: string; label: string; description: string }[];
  publish_statuses: { value: string; description: string }[];
  production_statuses: { value: string; description: string }[];
  seasons: { value: string; description: string }[];
  sorting: { value: string; label: string; description: string }[];
};

/* App auth/social types */
export type User = {
  id: number;
  username: string;
  email: string;
  avatar_url: string | null;
  banner_url: string | null;
  bio: string | null;
  history_enabled: boolean;
  last_seen_at: string | null;
  created_at: string;
};

export type PublicUser = Omit<User, "email" | "history_enabled">;

export type Comment = {
  id: number;
  body: string;
  parent_id: number | null;
  created_at: string;
  user: PublicUser;
};

export type Review = {
  id: number;
  title: string;
  body: string;
  score: number;
  created_at: string;
  user: PublicUser;
};

export type RatingSummary = {
  average: number;
  count: number;
  user_score: number | null;
};

/* Dub / voice-over sources (AniLibria + Kodik aggregator) */

export type DubAnilibriaEpisode = {
  ordinal: number;
  name: string | null;
  duration: number | null;
  preview: Poster | null;
  hls_480: string | null;
  hls_720: string | null;
  hls_1080: string | null;
};

export type DubKodikEpisode = {
  ordinal: number;
  iframe: string;
};

export type DubSource =
  | {
      provider: "anilibria";
      studio: string;
      language: "ru";
      kind: "voice";
      episodes_count: number;
      episodes: DubAnilibriaEpisode[];
    }
  | {
      provider: "kodik";
      studio: string;
      language: "ru" | "en" | "ja";
      kind: "voice" | "subtitles";
      quality?: string | null;
      episodes_count: number;
      episodes: DubKodikEpisode[];
    };

export type DubsResponse = {
  release_id: number | null;
  alias: string | null;
  title: string | null;
  title_en: string | null;
  year: number | null;
  sources: DubSource[];
};

/* Lists / favorites */
export type ListStatus =
  | "planned"
  | "watching"
  | "watched"
  | "postponed"
  | "dropped"
  | "favorite";

export const LIST_STATUSES: ListStatus[] = [
  "planned",
  "watching",
  "watched",
  "postponed",
  "dropped",
  "favorite",
];

export const STATUS_LABELS: Record<ListStatus, string> = {
  planned: "Запланировано",
  watching: "Смотрю",
  watched: "Просмотрено",
  postponed: "Отложено",
  dropped: "Брошено",
  favorite: "Избранное",
};

export type ListItem = {
  id: number;
  release_id: number;
  release_alias: string | null;
  release_title: string | null;
  release_title_en: string | null;
  release_year: number | null;
  release_type: string | null;
  release_genres: string[] | null;
  release_poster: string | null;
  release_episodes_total: number | null;
  status: ListStatus;
  note: string | null;
  created_at: string;
  updated_at: string;
};

export type ListStatusCount = { status: ListStatus; count: number };

/* Watch history */
export type HistoryEntry = {
  id: number;
  release_id: number;
  release_alias: string | null;
  release_title: string | null;
  release_poster: string | null;
  episode_ordinal: number;
  episode_name: string | null;
  source_provider: string | null;
  source_studio: string | null;
  watched_at: string;
};

/* Stats */
export type StatsBucket = { label: string; count: number };

export type ProfileStats = {
  total_watched: number;
  total_watching: number;
  total_planned: number;
  total_postponed: number;
  total_dropped: number;
  total_favorite: number;
  by_genre: StatsBucket[];
  by_type: StatsBucket[];
  by_year: StatsBucket[];
};

/* Torrents */
export type Torrent = {
  id: number;
  label: string | null;
  quality: string | null;
  type: string | null;
  codec: string | null;
  size: number | null;
  seeders: number | null;
  leechers: number | null;
  completed_times: number | null;
  magnet: string | null;
  filename: string | null;
  episodes: string | null;
  updated_at: string | null;
  download_url: string | null;
  is_hardsub: boolean | null;
};

export type TorrentsResponse = {
  release_id: number | null;
  alias: string | null;
  torrents: Torrent[];
};
