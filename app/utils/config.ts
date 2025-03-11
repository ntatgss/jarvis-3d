/**
 * Application configuration settings
 */

// API timeouts
export const API_TIMEOUT = 60000; // 60 seconds
export const LMNT_TIMEOUT = 30000; // 30 seconds
export const FETCH_TIMEOUT = 15000; // 15 seconds

// Cache settings
export const OPENAI_CACHE_SIZE = 50;
export const OPENAI_CACHE_EXPIRATION = 5 * 60 * 1000; // 5 minutes
export const LMNT_CACHE_SIZE = 30;
export const LMNT_CACHE_EXPIRATION = 30 * 60 * 1000; // 30 minutes

// OpenAI models
export const PRIMARY_MODEL = "gpt-4o";
export const FALLBACK_MODEL = "gpt-3.5-turbo";
export const MAX_TOKENS = 250;
export const TEMPERATURE = 0.7;

// Message limits
export const MAX_RECENT_MESSAGES = 9; // Plus system message = 10 total

// Feature flags
export const ENABLE_PARALLEL_REQUESTS = true;
export const ENABLE_PRELOADING = true;
export const DISABLE_LMNT_ON_MOBILE = true;

// Default voices
export const DEFAULT_VOICE_GENDER = "male";
export const DEFAULT_LMNT_VOICE = "lily";

// Preloading delay
export const PRELOAD_DELAY = 2000; // 2 seconds 