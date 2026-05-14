import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { hashPassword } from '@/lib/crypto';

// POST /api/auth/register - Register a new user
export async function POST(request: NextRequest) {
  try {
    let body;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
    }

    const { email, password, name } = body;

    // Manual validation
    if (!email || typeof email !== 'string' || !email.includes('@')) {
      return NextResponse.json(
        { error: 'Please enter a valid email address' },
        { status: 400 }
      );
    }

    if (!password || typeof password !== 'string' || password.length < 6) {
      return NextResponse.json(
        { error: 'Password must be at least 6 characters' },
        { status: 400 }
      );
    }

    if (name && typeof name === 'string' && name.length > 100) {
      return NextResponse.json(
        { error: 'Name must be less than 100 characters' },
        { status: 400 }
      );
    }

    const normalizedEmail = email.trim().toLowerCase();

    // Check if user already exists
    const existingUser = await db.user.findUnique({
      where: { email: normalizedEmail },
    });
    if (existingUser) {
      return NextResponse.json(
        { error: 'An account with this email already exists' },
        { status: 409 }
      );
    }

    // Create user with hashed password
    const hashedPassword = hashPassword(password);
    const user = await db.user.create({
      data: {
        email: normalizedEmail,
        password: hashedPassword,
        name: (name && typeof name === 'string') ? name.trim() : '',
      },
    });

    console.log('[REGISTER] User created:', normalizedEmail);

    return NextResponse.json({
      id: user.id,
      email: user.email,
      name: user.name,
    }, { status: 201 });
  } catch (error) {
    console.error('[REGISTER] Error:', error);
    return NextResponse.json({ error: 'Failed to register user' }, { status: 500 });
  }
}
