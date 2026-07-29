'use client';

import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { CheckCircle2, ExternalLink } from 'lucide-react';

type Destination = { spreadsheetId: string; sheetName: string; active: boolean; lastSyncedAt: string | null; lastError: string };

export function GoogleSheetsCard({ formId }: { formId: string }) {
  const [connected, setConnected] = useState(false);
  const [destination, setDestination] = useState<Destination | null>(null);
  const [spreadsheetId, setSpreadsheetId] = useState('');
  const [sheetName, setSheetName] = useState('Responses');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const load = async () => {
    const response = await fetch(`/api/forms/${encodeURIComponent(formId)}/integrations/google`);
    if (!response.ok) return;
    const data = await response.json() as { connected: boolean; destination: Destination | null };
    setConnected(data.connected); setDestination(data.destination);
    if (data.destination) { setSpreadsheetId(data.destination.spreadsheetId); setSheetName(data.destination.sheetName); }
  };
  useEffect(() => { void load(); }, [formId]);
  const save = async (active = destination?.active ?? true) => {
    setSaving(true); setError('');
    try {
      const response = await fetch(`/api/forms/${encodeURIComponent(formId)}/integrations/google`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ spreadsheetId, sheetName, active }) });
      const body = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(body.error || 'Could not save Google Sheets destination');
      setDestination(body);
    } catch (reason) { setError(reason instanceof Error ? reason.message : 'Could not save destination'); }
    finally { setSaving(false); }
  };
  const remove = async () => { await fetch(`/api/forms/${encodeURIComponent(formId)}/integrations/google`, { method: 'DELETE' }); setDestination(null); };
  const test = async () => {
    setSaving(true); setError('');
    try { const response = await fetch(`/api/forms/${encodeURIComponent(formId)}/integrations/google/test`, { method: 'POST' }); const body = await response.json().catch(() => ({})); if (!response.ok) throw new Error(body.error || 'Test failed'); await load(); }
    catch (reason) { setError(reason instanceof Error ? reason.message : 'Test failed'); }
    finally { setSaving(false); }
  };
  const disconnectGoogle = async () => {
    if (!window.confirm('Disconnect Google for all of your forms? This removes all Google Sheets destinations.')) return;
    setSaving(true); setError('');
    try { const response = await fetch('/api/integrations/google/disconnect', { method: 'DELETE' }); if (!response.ok) throw new Error('Could not disconnect Google'); setConnected(false); setDestination(null); }
    catch (reason) { setError(reason instanceof Error ? reason.message : 'Could not disconnect Google'); }
    finally { setSaving(false); }
  };
  return <Card className="border-emerald-500/20 bg-emerald-500/[0.03]">
    <CardHeader className="pb-3"><CardTitle className="flex items-center gap-2 text-base"><span className="grid size-6 place-items-center rounded bg-emerald-600 text-xs font-bold text-white">S</span>Google Sheets {connected && <CheckCircle2 className="size-4 text-emerald-600" />}</CardTitle></CardHeader>
    <CardContent className="space-y-3">
      {!connected ? <div className="flex items-center justify-between gap-3"><p className="text-sm text-muted-foreground">Connect a Google account to sync new responses automatically.</p><Button asChild size="sm"><a href="/api/integrations/google/connect">Connect Google <ExternalLink className="ml-1 size-3" /></a></Button></div> : <>
        <div className="grid gap-3 sm:grid-cols-2"><div className="space-y-1"><Label className="text-xs">Spreadsheet ID</Label><Input value={spreadsheetId} onChange={(e) => setSpreadsheetId(e.target.value)} placeholder="Google Sheet ID" /></div><div className="space-y-1"><Label className="text-xs">Worksheet tab</Label><Input value={sheetName} onChange={(e) => setSheetName(e.target.value)} placeholder="Responses" /></div></div>
        <div className="flex flex-wrap items-center gap-3"><Button size="sm" onClick={() => save()} disabled={saving || !spreadsheetId || !sheetName}>{saving ? 'Verifying…' : destination ? 'Update destination' : 'Save destination'}</Button>{destination && <><div className="flex items-center gap-2 text-sm"><Switch checked={destination.active} onCheckedChange={(active) => save(active)} disabled={saving} /> Auto-sync new responses</div><Button variant="outline" size="sm" onClick={test} disabled={saving}>Test row</Button><Button variant="ghost" size="sm" onClick={remove}>Disconnect form</Button></>}</div>
        {destination?.lastSyncedAt && <p className="text-xs text-muted-foreground">Last synced {new Date(destination.lastSyncedAt).toLocaleString()}</p>}
        {destination?.lastError && <p role="alert" className="text-xs text-destructive">Last sync error: {destination.lastError}</p>}
        <Button variant="link" size="sm" className="h-auto px-0 text-xs text-muted-foreground" onClick={disconnectGoogle} disabled={saving}>Disconnect Google account</Button>
        {error && <p role="alert" className="text-xs text-destructive">{error}</p>}
      </>}
    </CardContent>
  </Card>;
}
