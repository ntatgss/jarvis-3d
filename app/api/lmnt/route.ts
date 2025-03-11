import { NextRequest, NextResponse } from 'next/server';
import Lmnt from 'lmnt-node';

export async function POST(request: NextRequest) {
  try {
    const { text, voice = 'lily' } = await request.json();

    if (!text) {
      return NextResponse.json({ error: 'Text is required' }, { status: 400 });
    }

    const apiKey = process.env.LMNT_API_KEY;
    if (!apiKey) {
      return NextResponse.json({ error: 'LMNT API key not configured' }, { status: 500 });
    }

    const lmnt = new Lmnt({ apiKey });
    const response = await lmnt.speech.generate({
      text,
      voice,
      format: 'mp3'
    });

    // Get the audio data as an array buffer
    const audioBuffer = await response.arrayBuffer();

    // Return the audio data with appropriate headers
    return new NextResponse(audioBuffer, {
      headers: {
        'Content-Type': 'audio/mpeg',
        'Content-Length': audioBuffer.byteLength.toString(),
      },
    });
  } catch (error) {
    console.error('LMNT API error:', error);
    return NextResponse.json(
      { error: 'Failed to generate speech' },
      { status: 500 }
    );
  }
} 