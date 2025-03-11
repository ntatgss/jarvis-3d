import { NextRequest, NextResponse } from 'next/server';
import Lmnt from 'lmnt-node';

// Set a longer timeout for the API request (60 seconds)
export const maxDuration = 60; // This sets the Vercel Edge Function timeout to 60 seconds

export async function POST(request: NextRequest) {
  try {
    const { text, voice = 'lily' } = await request.json();

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

    // Initialize LMNT client with a longer timeout
    const lmnt = new Lmnt({ 
      apiKey,
      timeout: 30000 // 30 seconds timeout
    });

    // Use the non-streaming API
    const response = await lmnt.speech.generate({
      text,
      voice,
      format: 'mp3'
    });

    // Get the audio data as an array buffer
    const audioBuffer = await response.arrayBuffer();

    // Return the audio data with appropriate headers for better mobile compatibility
    return new Response(audioBuffer, {
      headers: {
        'Content-Type': 'audio/mpeg',
        'Content-Length': audioBuffer.byteLength.toString(),
        'Cache-Control': 'no-cache, no-store, must-revalidate',
        'Pragma': 'no-cache',
        'Expires': '0',
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