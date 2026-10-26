export type Env = {
  SUPABASE_URL: string;
  SUPABASE_SERVICE_ROLE_KEY: string;
  APP_ORIGIN: string;
  APP_ENV: string;
  PAYMENT_WEBHOOK_SECRET: string;
  AGNES_API_KEY?: string;
  BREVO_API_KEY?: string;
  BREVO_SENDER_EMAIL?: string;
  BREVO_SENDER_NAME?: string;
};

export type Role = "user" | "admin";

export type Profile = {
  id: string;
  email: string;
  password_hash: string;
  display_name: string;
  role: Role;
  plan_code: string;
  plan_expires_at: string | null;
  email_verified_at?: string | null;
  created_at: string;
};

export type Plan = {
  code: string;
  name: string;
  price_cents: number;
  duration_days: number;
  promo: boolean;
  active: boolean;
  image_daily: number;
  chat_daily: number;
  video_daily: number;
  max_image_size: string;
  description: string;
};

export type UsageKind = "image" | "chat" | "video";

export type PublicUser = {
  id: string;
  email: string;
  displayName: string;
  role: Role;
  planCode: string;
  planName: string;
  planExpiresAt: string | null;
  member: boolean;
  maxImageSize: string;
};
