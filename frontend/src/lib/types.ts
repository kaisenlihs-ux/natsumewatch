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
  bio: string | null;
  created_at: string;
};

export type PublicUser = Omit<User, "email">;

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
