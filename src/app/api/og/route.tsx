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

  try {
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
        published: true,
        _count: { select: { questions: true } },
      },
    });

    if (!form || !form.published) {
      return new Response('Not found', { status: 404 });
    }

    const title = form.metaTitle?.trim() || form.welcomeTitle?.trim() || form.title || 'Untitled Form';
    const subtitle =
      form.metaDescription?.trim() ||
      form.welcomeMessage?.trim() ||
      `${form._count.questions} question${form._count.questions !== 1 ? 's' : ''}`;

    const bg = form.backgroundColor || '#FFFFFF';
    const accent = form.buttonColor || '#1A1A1A';
    const text = form.textColor || '#333333';
    const count = form._count.questions;

    // Truncate long strings — satori can crash on very long text
    const safeTitle = title.length > 80 ? title.slice(0, 80) + '…' : title;
    const safeSubtitle = subtitle && subtitle.length > 120 ? subtitle.slice(0, 120) + '…' : subtitle;

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
          }}
        >
          {/* Left accent bar */}
          <div
            style={{
              position: 'absolute',
              left: '0px',
              top: '0px',
              width: '10px',
              height: '630px',
              backgroundColor: accent,
              display: 'flex',
            }}
          />

          {/* Top-right circle blob */}
          <div
            style={{
              position: 'absolute',
              top: '-100px',
              right: '-100px',
              width: '420px',
              height: '420px',
              borderRadius: '50%',
              backgroundColor: accent,
              opacity: 0.1,
              display: 'flex',
            }}
          />

          {/* Question count badge */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              backgroundColor: accent,
              color: '#ffffff',
              padding: '8px 20px',
              borderRadius: '999px',
              fontSize: '20px',
              fontWeight: 600,
              marginBottom: '28px',
            }}
          >
            {count} question{count !== 1 ? 's' : ''}
          </div>

          {/* Title */}
          <div
            style={{
              display: 'flex',
              fontSize: safeTitle.length > 50 ? '52px' : '64px',
              fontWeight: 800,
              color: text,
              lineHeight: 1.1,
              maxWidth: '960px',
              marginBottom: '24px',
            }}
          >
            {safeTitle}
          </div>

          {/* Subtitle */}
          {safeSubtitle ? (
            <div
              style={{
                display: 'flex',
                fontSize: '26px',
                color: text,
                opacity: 0.6,
                maxWidth: '800px',
                lineHeight: 1.4,
                fontWeight: 400,
              }}
            >
              {safeSubtitle}
            </div>
          ) : null}

          {/* Bottom row */}
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
                display: 'flex',
                fontSize: '20px',
                color: text,
                opacity: 0.4,
                fontWeight: 500,
              }}
            >
              Powered by Forms
            </div>

            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                backgroundColor: accent,
                color: '#ffffff',
                padding: '10px 28px',
                borderRadius: '999px',
                fontSize: '20px',
                fontWeight: 600,
              }}
            >
              Fill out →
            </div>
          </div>
        </div>
      ),
      { width: 1200, height: 630 }
    );
  } catch (err) {
    console.error('[OG] Error generating image:', err);
    return new Response('Error generating image', { status: 500 });
  }
}
