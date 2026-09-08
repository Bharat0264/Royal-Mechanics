import { NextResponse } from 'next/server'; import { getViewer } from '@/lib/auth'; export async function GET(){return NextResponse.json({viewer:await getViewer()});}
