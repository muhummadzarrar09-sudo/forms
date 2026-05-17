import { ImageResponse } from 'next/og';
import { NextRequest } from 'next/server';
import { db } from '@/lib/db';

export const runtime = 'nodejs';

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const slug = searchParams.get('slug');

  if (!slug) {
    return new Response('Missing slug', { status: 400 });
  }

  const form = await db.form.findUnique({
    where: { slug },
    select: {
      title: true,
      welcomeTitle: true,
      welcomeMessage: true,
      metaTitle: true,
      metaDescription: true,
      buttonColor: true,
      backgroundColor: true,
      textColor: true,
      _count: { select: { questions: true } },
    },
  });

  if (!form) {
    return new Response('Form not found', { status: 404 });
  }

  const title = form.metaTitle?.trim() || form.welcomeTitle?.trim() || form.title;
  const subtitle =
    form.metaDescription?.trim() ||
    form.welcomeMessage?.trim() ||
    `${form._count.questions} question${form._count.questions !== 1 ? 's' : ''}`;

  const bg = form.backgroundColor || '#FFFFFF';
  const accent = form.buttonColor || '#1A1A1A';
  const text = form.textColor || '#333333';
  const questionCount = form._count.questions;

  // Detect if dark background
  const isDark = isColorDark(bg);
  const subtitleColor = isDark
    ? `${text}99`
    : `${text}88`;

  return new ImageResponse(
    (
      <div
        style={{
          width: '1200px',
          height: '630px',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'center',
          alignItems: 'flex-start',
          padding: '80px 100px',
          backgroundColor: bg,
          position: 'relative',
          overflow: 'hidden',
        }}
      >
        {/* Background accent blob */}
        <div
          style={{
            position: 'absolute',
            top: '-120px',
            right: '-120px',
            width: '500px',
            height: '500px',
            borderRadius: '50%',
            backgroundColor: accent,
            opacity: 0.12,
          }}
        />
        <div
          style={{
            position: 'absolute',
            bottom: '-80px',
            left: '-80px',
            width: '300px',
            height: '300px',
            borderRadius: '50%',
            backgroundColor: accent,
            opacity: 0.08,
          }}
        />

        {/* Pill badge */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            backgroundColor: accent,
            color: '#fff',
            padding: '8px 20px',
            borderRadius: '999px',
            fontSize: '18px',
            fontWeight: 600,
            marginBottom: '32px',
            letterSpacing: '-0.01em',
          }}
        >
          <span>📋</span>
          <span>{questionCount} question{questionCount !== 1 ? 's' : ''}</span>
        </div>

        {/* Title */}
        <div
          style={{
            fontSize: title.length > 50 ? '52px' : '64px',
            fontWeight: 800,
            color: text,
            lineHeight: 1.1,
            letterSpacing: '-0.03em',
            maxWidth: '900px',
            marginBottom: '24px',
          }}
        >
          {title}
        </div>

        {/* Subtitle */}
        {subtitle && (
          <div
            style={{
              fontSize: '26px',
              color: subtitleColor,
              maxWidth: '800px',
              lineHeight: 1.4,
              fontWeight: 400,
            }}
          >
            {subtitle.length > 120 ? subtitle.slice(0, 120) + '…' : subtitle}
          </div>
        )}

        {/* Bottom bar */}
        <div
          style={{
            position: 'absolute',
            bottom: '48px',
            left: '100px',
            right: '100px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}
        >
          <div
            style={{
              fontSize: '20px',
              color: subtitleColor,
              fontWeight: 500,
            }}
          >
            Powered by Forms
          </div>
          {/* CTA pill */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              backgroundColor: accent,
              color: '#fff',
              padding: '10px 24px',
              borderRadius: '999px',
              fontSize: '20px',
              fontWeight: 600,
            }}
          >
            Fill out →
          </div>
        </div>

        {/* Left accent bar */}
        <div
          style={{
            position: 'absolute',
            left: '0',
            top: '0',
            bottom: '0',
            width: '8px',
            backgroundColor: accent,
          }}
        />
      </div>
    ),
    {
      width: 1200,
      height: 630,
    }
  );
}

function isColorDark(hex: string): boolean {
  const h = hex.replace('#', '');
  if (h.length !== 6) return false;
  const r = parseInt(h.slice(0, 2), 16);
  const g = parseInt(h.slice(2, 4), 16);
  const b = parseInt(h.slice(4, 6), 16);
  // Perceived luminance
  return (r * 299 + g * 587 + b * 114) / 1000 < 128;
}
