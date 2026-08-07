'use client';

import { useState } from 'react';
import { ImageIcon } from 'lucide-react';
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
  const [imageFailed, setImageFailed] = useState(false);
  const isHttps = /^https:\/\//.test(draft.trim());

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
      setImageFailed(false);
      onSave(trimmed);
    } catch {
      setError('Enter a valid HTTPS image URL.');
    }
  };

  return <div className="space-y-2">
    <Label className="text-xs text-muted-foreground">{label}</Label>
    <Input
      value={draft}
      onChange={(event) => {
        setDraft(event.target.value);
        setError('');
      }}
      onBlur={save}
      placeholder="https://images.example.com/brand-cover.jpg"
      className="text-sm"
      inputMode="url"
    />
    {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
    {!error && isHttps && (
      <figure className="aspect-[3/1] overflow-hidden rounded-xl border bg-muted/30">
        {imageFailed ? (
          <div className="flex size-full items-center justify-center gap-2 text-sm text-muted-foreground">
            <ImageIcon className="size-4" /> Preview unavailable
          </div>
        ) : (
          <img src={draft.trim()} alt={`${label} preview`} className="size-full object-cover" onError={() => setImageFailed(true)} />
        )}
      </figure>
    )}
  </div>;
}
