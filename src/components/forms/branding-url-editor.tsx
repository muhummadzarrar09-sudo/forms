'use client';

import { useEffect, useState } from 'react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

export function BrandingUrlEditor({
  label,
  value,
  onSave,
}: {
  label: string;
  value: string;
  onSave: (value: string) => void;
}) {
  const [draft, setDraft] = useState(value);
  const [error, setError] = useState('');

  useEffect(() => setDraft(value), [value]);

  const save = () => {
    const trimmed = draft.trim();
    if (!trimmed) {
      setError('');
      onSave('');
      return;
    }
    try {
      if (new URL(trimmed).protocol !== 'https:') throw new Error('unsafe protocol');
      setError('');
      onSave(trimmed);
    } catch {
      setError('Enter a valid HTTPS image URL.');
    }
  };

  return <div className="space-y-1.5">
    <Label className="text-xs text-muted-foreground">{label}</Label>
    <Input
      value={draft}
      onChange={(event) => setDraft(event.target.value)}
      onBlur={save}
      placeholder="https://images.example.com/brand-cover.jpg"
      className="h-8 text-xs"
      inputMode="url"
    />
    {error && <p role="alert" className="text-xs text-destructive">{error}</p>}
  </div>;
}
