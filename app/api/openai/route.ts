import { NextRequest, NextResponse } from 'next/server';
import OpenAI from "openai";
import { ChatCompletionMessageParam } from "openai/resources/chat/completions";
import { JARVIS_SYSTEM_PROMPT } from '../../utils/systemPrompt';
import { 
  API_TIMEOUT, 
  OPENAI_CACHE_SIZE, 
  OPENAI_CACHE_EXPIRATION,
  PRIMARY_MODEL,
  FALLBACK_MODEL,
  MAX_TOKENS,
  TEMPERATURE,
  ENABLE_PARALLEL_REQUESTS
} from '../../utils/config';

// Set a longer timeout for the API request (60 seconds)
export const maxDuration = 60; // This sets the Vercel Edge Function timeout to 60 seconds

// Define types for our cache
interface CacheEntry {
  response: any;
  timestamp: number;
}

interface ApiMessage {
  role: string;
  content: any;
}

// Simple in-memory cache for responses
const responseCache = new Map<string, CacheEntry>();

// Clean up old cache entries
function cleanupCache() {
  const now = Date.now();
  for (const [key, value] of responseCache.entries()) {
    if (now - value.timestamp > OPENAI_CACHE_EXPIRATION) {
      responseCache.delete(key);
    }
  }
}

// Generate a cache key from messages
function generateCacheKey(messages: ApiMessage[]): string {
  return JSON.stringify(messages.map(msg => ({
    role: msg.role || 'user',
    content: typeof msg.content === 'string' ? msg.content : 
      (Array.isArray(msg.content) && msg.content[0] && msg.content[0].text) ? 
        msg.content[0].text : JSON.stringify(msg.content)
  })));
}

// Extract text from OpenAI response
function extractResponseText(data: any): string {
  if (!data || !data.choices || !data.choices[0]) {
    return "Sorry, I did not receive a proper response.";
  }
  
  const choice = data.choices[0];
  
  if (choice.message && choice.message.content) {
    // Standard format (gpt-3.5-turbo, gpt-4)
    return choice.message.content;
  } 
  
  if (choice.message === null && choice.content) {
    // o3-mini format where content might be directly on the choice
    const content = choice.content;
    if (Array.isArray(content) && content[0] && content[0].text) {
      return content[0].text;
    } 
    if (typeof content === "string") {
      return content;
    }
  }
  
  return "Sorry, I could not understand the response format.";
}

export async function POST(req: NextRequest) {
  try {
    // Accept either a single prompt or a full conversation history
    const { prompt, messages } = await req.json();
    
    // Check if at least one input method is provided
    if (!prompt && !messages) {
      return NextResponse.json(
        { error: 'Either prompt or messages array is required' },
        { status: 400 }
      );
    }

    // Initialize the OpenAI client with a longer timeout
    const openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
      timeout: API_TIMEOUT,
    });

    // Prepare messages array for OpenAI API
    let apiMessages: ApiMessage[] = [];
    
    // If there's a single prompt, convert it to a messages array
    if (prompt) {
      apiMessages = [
        {
          role: 'developer',
          content: [{ type: 'text', text: JARVIS_SYSTEM_PROMPT }]
        },
        {
          role: 'user',
          content: [{ type: 'text', text: prompt }]
        }
      ];
    } 
    // Otherwise, use the provided messages array
    else if (messages && Array.isArray(messages)) {
      // Format messages for o3-mini (nested content structure)
      apiMessages = messages.map(msg => {
        // Convert system role to developer for o3-mini
        const role = msg.role === 'system' ? 'developer' : msg.role;
        return {
          role,
          content: [{ type: 'text', text: msg.content }]
        };
      });
      
      // Only add system message if none exists (avoid duplication)
      // This is now just a fallback in case the client forgets to include a system message
      if (!messages.some(msg => msg.role === 'system')) {
        console.log("No system message found, adding default system prompt");
        apiMessages.unshift({
          role: 'developer',
          content: [{ type: 'text', text: JARVIS_SYSTEM_PROMPT }]
        });
      }
    }

    // Check cache for existing response
    const cacheKey = generateCacheKey(apiMessages);
    if (responseCache.has(cacheKey)) {
      const cachedData = responseCache.get(cacheKey);
      if (cachedData && Date.now() - cachedData.timestamp < OPENAI_CACHE_EXPIRATION) {
        console.log("Cache hit! Returning cached response");
        return NextResponse.json(cachedData.response);
      }
    }

    // Clean up old cache entries periodically
    if (responseCache.size > OPENAI_CACHE_SIZE / 2) {
      cleanupCache();
    }

    let completion;
    
    if (ENABLE_PARALLEL_REQUESTS) {
      // Try both models in parallel for faster response
      try {
        // Start both requests in parallel
        const gpt4Promise = openai.chat.completions.create({
          model: PRIMARY_MODEL,
          messages: apiMessages as any, // Type assertion needed for nested content format
          response_format: { type: "text" },
          max_tokens: MAX_TOKENS,
        }).catch(err => {
          console.log(`${PRIMARY_MODEL} request failed:`, err);
          return null;
        });
        
        const gpt35Promise = openai.chat.completions.create({
          model: FALLBACK_MODEL,
          messages: apiMessages.map(msg => {
            // Convert developer role back to system for standard models
            const role = msg.role === 'developer' ? 'system' : (msg.role || 'user');
            // Extract the text from the nested content
            const content = Array.isArray(msg.content) && msg.content[0] && typeof msg.content[0] === 'object' && 'text' in msg.content[0] 
              ? msg.content[0].text 
              : '';
            return { role, content } as ChatCompletionMessageParam;
          }),
          max_tokens: MAX_TOKENS,
          temperature: TEMPERATURE,
        }).catch(err => {
          console.log(`${FALLBACK_MODEL} request failed:`, err);
          return null;
        });
        
        // Use Promise.allSettled to get results from both models
        const [gpt4Result, gpt35Result] = await Promise.allSettled([gpt4Promise, gpt35Promise]);
        
        // Check which one succeeded first
        if (gpt4Result.status === 'fulfilled' && gpt4Result.value) {
          completion = gpt4Result.value;
          console.log(`Using ${PRIMARY_MODEL} response`);
        } else if (gpt35Result.status === 'fulfilled' && gpt35Result.value) {
          completion = gpt35Result.value;
          console.log(`Using ${FALLBACK_MODEL} response`);
        } else {
          throw new Error("Both model requests failed");
        }
      } catch (error) {
        console.error("Error with parallel model requests:", error);
        throw error; // Let the outer catch handle this
      }
    } else {
      // Sequential fallback approach
      try {
        // Try primary model first
        completion = await openai.chat.completions.create({
          model: PRIMARY_MODEL,
          messages: apiMessages as any,
          response_format: { type: "text" },
          max_tokens: MAX_TOKENS,
        });
        console.log(`Using ${PRIMARY_MODEL} response`);
      } catch (error) {
        console.error(`Error with ${PRIMARY_MODEL}, falling back to ${FALLBACK_MODEL}:`, error);
        
        // Format messages for standard models
        const standardMessages: ChatCompletionMessageParam[] = apiMessages.map(msg => {
          const role = msg.role === 'developer' ? 'system' : (msg.role || 'user');
          const content = Array.isArray(msg.content) && msg.content[0] && typeof msg.content[0] === 'object' && 'text' in msg.content[0] 
            ? msg.content[0].text 
            : '';
          return { role, content } as ChatCompletionMessageParam;
        });
        
        // Fall back to secondary model
        completion = await openai.chat.completions.create({
          model: FALLBACK_MODEL,
          messages: standardMessages,
          max_tokens: MAX_TOKENS,
          temperature: TEMPERATURE,
        });
        console.log(`Using ${FALLBACK_MODEL} response`);
      }
    }
    
    // Cache the successful response
    if (responseCache.size >= OPENAI_CACHE_SIZE) {
      // Remove oldest entry if cache is full
      const oldestKey = responseCache.keys().next().value;
      if (oldestKey) {
        responseCache.delete(oldestKey);
      }
    }
    
    responseCache.set(cacheKey, {
      response: completion,
      timestamp: Date.now()
    });
    
    return NextResponse.json(completion);
  } catch (error) {
    console.error('Error processing request:', error);
    return NextResponse.json(
      { error: 'Failed to process request' },
      { status: 500 }
    );
  }
} 