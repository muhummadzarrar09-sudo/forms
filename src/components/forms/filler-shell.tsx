'use client';

import { useEffect, useMemo } from 'react';
import { motion } from 'framer-motion';
import type { Form, FormTheme } from '@/types/form';
import { CONFETTI_COLORS, STAR_COLORS } from '@/lib/constants';

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
  return useMemo(() => form ? {
    backgroundColor: form.backgroundColor,
    textColor: form.textColor,
    buttonColor: form.buttonColor,
    buttonTextColor: form.buttonTextColor,
    fontFamily: form.fontFamily,
  } : {
    backgroundColor: '#FFFFFF',
    textColor: '#333333',
    buttonColor: '#1A1A1A',
    buttonTextColor: '#FFFFFF',
    fontFamily: 'sans',
  }, [form]);
}

/** Shared celebratory layer. It is mounted only after successful completion. */
export function FillerConfetti() {
  const particles = useMemo(() => Array.from({ length: 35 }, (_, index) => {
    const isStar = index < 6;
    return {
      id: index,
      x: Math.random() * 100,
      delay: Math.random() * 0.3,
      duration: 2 + Math.random() * 2,
      color: isStar ? STAR_COLORS[Math.floor(Math.random() * STAR_COLORS.length)] : CONFETTI_COLORS[Math.floor(Math.random() * CONFETTI_COLORS.length)],
      size: isStar ? 8 + Math.random() * 8 : 4 + Math.random() * 6,
      rotation: Math.random() * 360,
      drift: (Math.random() - 0.5) * 40,
      isCircle: !isStar && Math.random() > 0.5,
      isStar,
    };
  }), []);

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
