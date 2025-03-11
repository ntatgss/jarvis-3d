import { NextRequest, NextResponse } from 'next/server';
import OpenAI from "openai";
import { ChatCompletionMessageParam } from "openai/resources/chat/completions";

// Define the system prompt for Jarvis
const JARVIS_SYSTEM_PROMPT = `You are Jarvis, an advanced AI assistant with a 3D visual representation.
You were created to assist users with information, answer questions, and provide helpful responses.
When asked about your identity, always remember that you are Jarvis.
Your responses should be helpful, informative, and somewhat concise.
Try to maintain a slightly formal but friendly tone, similar to the Jarvis AI from Iron Man.`;

// Type definition for traditional messages
interface ChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

// Type definitions for o3-mini model format
interface O3Content {
  type: 'text';
  text: string;
}

interface O3Message {
  role: 'developer' | 'user' | 'assistant';
  content: O3Content[];
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
    
    // Initialize the OpenAI client
    const openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
    });
    
    // Prepare messages array for OpenAI API
    let apiMessages: any[] = [];
    
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
      
      // Ensure there's a system message
      if (!messages.some(msg => msg.role === 'system')) {
        apiMessages.unshift({
          role: 'developer',
          content: [{ type: 'text', text: JARVIS_SYSTEM_PROMPT }]
        });
      }
    }
    
    try {
      // Try using o3-mini model first
      const completion = await openai.chat.completions.create({
        model: "gpt-4o",
        messages: apiMessages,
        response_format: {
          type: "text"
        },
        // reasoning_effort: "low"
      });
      
      return NextResponse.json(completion);
    } catch (error) {
      console.error("Error with o3-mini model, falling back to gpt-3.5-turbo:", error);
      
      // Format messages for gpt-3.5-turbo (standard format)
      const standardMessages: ChatCompletionMessageParam[] = apiMessages.map(msg => {
        // Convert developer role back to system for standard models
        const role = msg.role === 'developer' ? 'system' : msg.role;
        // Extract the text from the nested content
        const content = msg.content[0]?.text || '';
        return { role, content } as ChatCompletionMessageParam;
      });
      
      // Fall back to gpt-3.5-turbo
      const fallbackCompletion = await openai.chat.completions.create({
        model: "gpt-4o-mini",
        messages: standardMessages,
        temperature: 0.7,
      });
      
      return NextResponse.json(fallbackCompletion);
    }
  } catch (error) {
    console.error('Error processing request:', error);
    return NextResponse.json(
      { error: 'Failed to process request' },
      { status: 500 }
    );
  }
} 