'use client';

import { useEffect, useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import type { Form, FormTheme } from '@/types/form';
import { deriveFormTheme } from '@/lib/form-theme';
import { CONFETTI_COLORS } from '@/lib/constants';

export function useFillerKeyboardNavigation(onNext: () => void, onBack: () => void): void {
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      const isTextInput = target?.tagName === 'INPUT' || target?.tagName === 'TEXTAREA';

      if (event.key === 'Enter' && !event.ctrlKey && !event.metaKey && !isTextInput) {
        event.preventDefault();
        onNext();
      }
      if (event.key === 'Backspace' && !isTextInput) {
        event.preventDefault();
        onBack();
      }
      if (event.altKey && event.key === 'ArrowLeft') {
        event.preventDefault();
        onBack();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onNext, onBack]);
}

export function useFillerTheme(form: Form | null): FormTheme {
  return useMemo(() => deriveFormTheme(form), [form]);
}

export function FillerWelcomeMeta({ questionCount, color }: { questionCount: number; color: string }) {
  if (questionCount === 0) return null;
  const minutes = Math.max(1, Math.ceil(questionCount / 8));
  return <p className="text-sm" style={{ color }} aria-label={`${questionCount} questions, about ${minutes} minute${minutes === 1 ? '' : 's'}`}>
    {questionCount} question{questionCount === 1 ? '' : 's'} · about {minutes} min
  </p>;
}

/** Compact brand mark retained while respondents move beyond the welcome screen. */
export function FillerHeaderLogo({ form, theme }: { form: Form; theme: FormTheme }) {
  const [failed, setFailed] = useState(false);
  if (!form.logoUrl || failed) return null;
  return <div
    className="absolute left-4 top-4 z-20 rounded-lg px-2 py-1.5"
    style={{ backgroundColor: theme.controlSurfaceColor }}
  >
    <img
      src={form.logoUrl}
      alt={`${form.title} logo`}
      className="max-h-8 max-w-32 object-contain object-left"
      onError={() => setFailed(true)}
    />
  </div>;
}

/** Shared public-form branding shown on the welcome screen. Failed remote image
 * loads disappear gracefully rather than leaving a broken image icon. */
export function FillerWelcomeBranding({ form, theme }: { form: Form; theme: FormTheme }) {
  const [logoFailed, setLogoFailed] = useState(false);
  const [coverFailed, setCoverFailed] = useState(false);
  const logoUrl = form.logoUrl && !logoFailed ? form.logoUrl : null;
  const coverUrl = form.coverUrl && !coverFailed ? form.coverUrl : null;
  if (!logoUrl && !coverUrl) return null;

  return <div className="space-y-4">
    {coverUrl && (
      <figure
        className="aspect-[3/1] overflow-hidden rounded-xl border shadow-[var(--shadow-1)]"
        style={{ borderColor: theme.fieldBorderColor, backgroundColor: theme.controlSurfaceColor }}
      >
        <img src={coverUrl} alt="" className="size-full object-cover" onError={() => setCoverFailed(true)} />
      </figure>
    )}
    {logoUrl && (
      <div className="w-fit max-w-52 rounded-lg px-3 py-2" style={{ backgroundColor: theme.controlSurfaceColor }}>
        <img src={logoUrl} alt={`${form.title} logo`} className="max-h-12 max-w-44 object-contain object-left" onError={() => setLogoFailed(true)} />
      </div>
    )}
  </div>;
}

/** Shared celebratory layer. It is mounted only after successful completion. */
export function FillerConfetti({ colors }: { colors?: string[] }) {
  const palette = useMemo(() => colors?.filter(Boolean).length ? colors.filter(Boolean) : CONFETTI_COLORS, [colors]);
  const particles = useMemo(() => Array.from({ length: 35 }, (_, index) => {
    const isStar = index < 6;
    return {
      id: index,
      x: Math.random() * 100,
      delay: Math.random() * 0.3,
      duration: 2 + Math.random() * 2,
      color: isStar ? palette[Math.floor(Math.random() * palette.length)] : palette[Math.floor(Math.random() * palette.length)],
      size: isStar ? 8 + Math.random() * 8 : 4 + Math.random() * 6,
      rotation: Math.random() * 360,
      drift: (Math.random() - 0.5) * 40,
      isCircle: !isStar && Math.random() > 0.5,
      isStar,
    };
  }), [palette]);

  return (
    <div className="absolute inset-0 z-30 overflow-hidden pointer-events-none" aria-hidden="true">
      {particles.map((particle) => (
        <motion.div
          key={particle.id}
          initial={{ x: `${particle.x}vw`, y: '-5vh', rotate: 0, opacity: 1 }}
          animate={{ y: '105vh', x: `calc(${particle.x}vw + ${particle.drift}px)`, rotate: particle.rotation + 720, opacity: [1, 1, 0.5, 0] }}
          transition={{ duration: particle.duration, delay: particle.delay, ease: [0.25, 0.46, 0.45, 0.94] }}
          className="absolute"
          style={{ width: particle.size, height: particle.size }}
        >
          {particle.isStar ? (
            <svg viewBox="0 0 24 24" width="100%" height="100%" style={{ filter: `drop-shadow(0 0 3px ${particle.color})` }}>
              <path d="M12 2l2.4 7.4H22l-6.2 4.5 2.4 7.4L12 16.8l-6.2 4.5 2.4-7.4L2 9.4h7.6z" fill={particle.color} />
            </svg>
          ) : <div className={particle.isCircle ? 'rounded-full' : 'rounded-sm'} style={{ width: '100%', height: '100%', backgroundColor: particle.color }} />}
        </motion.div>
      ))}
    </div>
  );
}
