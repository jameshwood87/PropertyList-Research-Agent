import { NextResponse } from 'next/server';

export async function GET() {
  try {
    return NextResponse.json({
      status: 'healthy',
      timestamp: new Date().toISOString(),
      environment: 'production',
      service: 'AI Property Research Agent',
      version: '2.0.0'
    });
  } catch (error) {
    return NextResponse.json(
      { 
        status: 'error', 
        error: error.message 
      }, 
      { status: 500 }
    );
  }
} 