/**
 * API utilities for making optimized API calls
 */
import { FETCH_TIMEOUT } from './config';

/**
 * Type for API options
 */
export interface ApiOptions {
  timeout?: number;
  headers?: Record<string, string>;
  signal?: AbortSignal;
}

/**
 * Makes a fetch request with timeout
 */
export async function fetchWithTimeout<T>(
  url: string, 
  options: RequestInit & ApiOptions = {}
): Promise<T> {
  const { timeout = FETCH_TIMEOUT, ...fetchOptions } = options;
  
  // Create abort controller for timeout if one wasn't provided
  const controller = options.signal ? null : new AbortController();
  const timeoutId = controller 
    ? setTimeout(() => controller.abort(), timeout) 
    : null;
  
  try {
    const response = await fetch(url, {
      ...fetchOptions,
      signal: options.signal || controller?.signal,
    });
    
    if (!response.ok) {
      throw new Error(`API error: ${response.status}`);
    }
    
    // Check content type to determine how to parse the response
    const contentType = response.headers.get('content-type');
    if (contentType?.includes('application/json')) {
      return await response.json() as T;
    } else if (contentType?.includes('audio/')) {
      return await response.arrayBuffer() as unknown as T;
    } else {
      return await response.text() as unknown as T;
    }
  } finally {
    if (timeoutId) clearTimeout(timeoutId);
  }
}

/**
 * Makes a POST request to the OpenAI API
 */
export async function callOpenAI(messages: any[], options: ApiOptions = {}) {
  return fetchWithTimeout('/api/openai', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...options.headers,
    },
    body: JSON.stringify({ messages }),
    timeout: options.timeout,
    signal: options.signal,
  });
}

/**
 * Makes a POST request to the LMNT API
 */
export async function callLMNT(text: string, voice: string, options: ApiOptions = {}) {
  return fetchWithTimeout<ArrayBuffer>('/api/lmnt', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...options.headers,
    },
    body: JSON.stringify({ text, voice }),
    timeout: options.timeout,
    signal: options.signal,
  });
}

/**
 * Preloads API connections
 */
export async function preloadAPIs(voiceGender: string, isMobile: boolean) {
  try {
    // Warm up the OpenAI API with a simple request
    callOpenAI([
      {
        role: "system",
        content: "You are Jarvis, an AI assistant."
      },
      {
        role: "user",
        content: "Hello"
      }
    ]).catch(err => console.log("Preload OpenAI API error (expected):", err));
    
    // Warm up the LMNT API with a simple request - only on desktop
    if (voiceGender === 'lmnt' && !isMobile) {
      callLMNT("Hello, I am Jarvis.", "lily")
        .catch(err => console.log("Preload LMNT API error (expected):", err));
    }
    
    console.log("API connections preloaded");
  } catch (error) {
    console.log("Preload error (non-critical):", error);
  }
} 