import { NextRequest } from 'next/server';
import Lmnt from 'lmnt-node';
import { 
  LMNT_TIMEOUT, 
  LMNT_CACHE_SIZE, 
  LMNT_CACHE_EXPIRATION,
  DEFAULT_LMNT_VOICE
} from '../../utils/config';

// Set a longer timeout for the API request (60 seconds)
export const maxDuration = 60; // This sets the Vercel Edge Function timeout to 60 seconds

// Define types for our cache
interface CacheEntry {
  audioBuffer: ArrayBuffer;
  timestamp: number;
}

// Simple in-memory cache for responses
const responseCache = new Map<string, CacheEntry>();

// Clean up old cache entries
function cleanupCache() {
  const now = Date.now();
  for (const [key, value] of responseCache.entries()) {
    if (now - value.timestamp > LMNT_CACHE_EXPIRATION) {
      responseCache.delete(key);
    }
  }
}

// Generate a cache key from text and voice
function generateCacheKey(text: string, voice: string): string {
  return `${voice}:${text}`;
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const text = body.text as string;
    const voice = (body.voice as string) || DEFAULT_LMNT_VOICE;

    if (!text) {
      return new Response(JSON.stringify({ error: 'Text is required' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    const apiKey = process.env.LMNT_API_KEY;
    if (!apiKey) {
      return new Response(JSON.stringify({ error: 'LMNT API key not configured' }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // Check cache for existing response
    const cacheKey = generateCacheKey(text, voice);
    if (responseCache.has(cacheKey)) {
      const cachedData = responseCache.get(cacheKey);
      if (cachedData) {
        console.log("Cache hit! Returning cached LMNT audio");
        return new Response(cachedData.audioBuffer, {
          headers: {
            'Content-Type': 'audio/mpeg',
            'Content-Length': cachedData.audioBuffer.byteLength.toString(),
            'Cache-Control': 'public, max-age=1800', // 30 minutes
            'Access-Control-Allow-Origin': '*'
          },
        });
      }
    }

    // Clean up old cache entries periodically
    if (responseCache.size > LMNT_CACHE_SIZE / 2) {
      cleanupCache();
    }

    // Initialize LMNT client with a longer timeout
    const lmnt = new Lmnt({ 
      apiKey,
      timeout: LMNT_TIMEOUT
    });

    // Use the non-streaming API
    const response = await lmnt.speech.generate({
      text,
      voice,
      format: 'mp3'
    });

    // Get the audio data as an array buffer
    const audioBuffer = await response.arrayBuffer();

    // Cache the response
    if (responseCache.size >= LMNT_CACHE_SIZE) {
      // Remove oldest entry if cache is full
      const oldestKey = responseCache.keys().next().value;
      if (oldestKey) {
        responseCache.delete(oldestKey);
      }
    }
    
    responseCache.set(cacheKey, {
      audioBuffer,
      timestamp: Date.now()
    });

    // Return the audio data with appropriate headers for better mobile compatibility
    return new Response(audioBuffer, {
      headers: {
        'Content-Type': 'audio/mpeg',
        'Content-Length': audioBuffer.byteLength.toString(),
        'Cache-Control': 'public, max-age=1800', // 30 minutes
        'Access-Control-Allow-Origin': '*'
      },
    });
  } catch (error) {
    console.error('LMNT API error:', error);
    return new Response(JSON.stringify({ error: 'Failed to generate speech' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
} 