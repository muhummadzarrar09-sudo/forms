'use client';

import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { CheckCircle2, ExternalLink, Table2 } from 'lucide-react';

type SyncEvent = { id: string; responseId: string; status: string; attempts: number; lastError: string; updatedAt: string };
type Destination = { id: string; spreadsheetId: string; sheetName: string; active: boolean; lastSyncedAt: string | null; lastError: string; _count?: { events: number }; events?: SyncEvent[] };

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
    setConnected(data.connected);
    setDestination(data.destination);
    if (data.destination) {
      setSpreadsheetId(data.destination.spreadsheetId);
      setSheetName(data.destination.sheetName);
    }
  };

  useEffect(() => {
    const timer = window.setTimeout(() => { void load(); }, 0);
    return () => window.clearTimeout(timer);
  }, [formId]);

  const save = async (active = destination?.active ?? true) => {
    setSaving(true);
    setError('');
    try {
      const response = await fetch(`/api/forms/${encodeURIComponent(formId)}/integrations/google`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ spreadsheetId, sheetName, active }),
      });
      const body = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(body.error || 'Could not save Google Sheets destination');
      setDestination(body);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Could not save destination');
    } finally {
      setSaving(false);
    }
  };

  const remove = async () => {
    await fetch(`/api/forms/${encodeURIComponent(formId)}/integrations/google`, { method: 'DELETE' });
    setDestination(null);
  };

  const test = async () => {
    setSaving(true);
    setError('');
    try {
      const response = await fetch(`/api/forms/${encodeURIComponent(formId)}/integrations/google/test`, { method: 'POST' });
      const body = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(body.error || 'Test failed');
      await load();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Test failed');
    } finally {
      setSaving(false);
    }
  };

  const retry = async (eventId?: string) => {
    setSaving(true);
    setError('');
    try {
      const response = await fetch(`/api/forms/${encodeURIComponent(formId)}/integrations/google/retry`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(eventId ? { eventId } : { all: true }),
      });
      if (!response.ok) throw new Error('Could not queue retry');
      await load();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Could not queue retry');
    } finally {
      setSaving(false);
    }
  };

  const disconnectGoogle = async () => {
    if (!window.confirm('Disconnect Google for all of your forms? This removes all Google Sheets destinations.')) return;
    setSaving(true);
    setError('');
    try {
      const response = await fetch('/api/integrations/google/disconnect', { method: 'DELETE' });
      if (!response.ok) throw new Error('Could not disconnect Google');
      setConnected(false);
      setDestination(null);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Could not disconnect Google');
    } finally {
      setSaving(false);
    }
  };

  const failedEvents = destination?.events?.filter((event) => event.status === 'failed') || [];

  return (
    <Card className="border-success/20 bg-success/10 shadow-none">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          <span className="grid size-10 place-items-center rounded-lg bg-success text-success-foreground">
            <Table2 className="size-5" aria-hidden="true" />
          </span>
          <span className="flex-1">Google Sheets</span>
          {connected && <CheckCircle2 className="size-5 text-success" aria-label="Google connected" />}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {!connected ? (
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-sm text-muted-foreground">Connect a Google account to sync new responses automatically.</p>
            <Button asChild size="sm" className="min-h-11 shrink-0">
              <a href="/api/integrations/google/connect">Connect Google <ExternalLink className="size-4" /></a>
            </Button>
          </div>
        ) : (
          <>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label className="text-xs">Spreadsheet ID</Label>
                <Input value={spreadsheetId} onChange={(e) => setSpreadsheetId(e.target.value)} placeholder="Google Sheet ID" />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Worksheet tab</Label>
                <Input value={sheetName} onChange={(e) => setSheetName(e.target.value)} placeholder="Responses" />
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <Button size="sm" onClick={() => save()} disabled={saving || !spreadsheetId || !sheetName} className="min-h-11">
                {saving ? 'Verifying…' : destination ? 'Update destination' : 'Save destination'}
              </Button>
              {destination && (
                <>
                  <Label className="flex min-h-11 items-center gap-2 text-sm text-foreground">
                    <Switch checked={destination.active} onCheckedChange={(active) => save(active)} disabled={saving} />
                    Auto-sync new responses
                  </Label>
                  <Button variant="outline" size="sm" onClick={test} disabled={saving} className="min-h-11">Test row</Button>
                  <Button variant="ghost" size="sm" onClick={remove} className="min-h-11">Disconnect form</Button>
                </>
              )}
            </div>
            {destination && <p className="text-xs text-muted-foreground">{destination._count?.events ?? 0} pending sync{destination._count?.events === 1 ? '' : 's'}</p>}
            {failedEvents.length > 0 && (
              <div className="space-y-2 rounded-lg border border-destructive/25 bg-destructive/10 p-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="text-sm font-medium text-destructive">{failedEvents.length} sync issue{failedEvents.length === 1 ? '' : 's'}</p>
                  <Button variant="outline" size="sm" onClick={() => retry()} disabled={saving} className="min-h-10 border-destructive/30 text-destructive hover:bg-destructive/10">Retry failed syncs</Button>
                </div>
                {failedEvents.map((event) => (
                  <div key={event.id} className="flex flex-wrap items-center justify-between gap-2 rounded-md bg-card p-2 text-sm">
                    <span className="min-w-0 flex-1 break-words text-destructive">Response {event.responseId}: {event.lastError || 'Failed'}</span>
                    <Button variant="ghost" size="sm" onClick={() => retry(event.id)} disabled={saving} className="min-h-10 text-destructive">Retry</Button>
                  </div>
                ))}
              </div>
            )}
            {destination?.lastSyncedAt && <p className="text-xs text-muted-foreground">Last synced {new Date(destination.lastSyncedAt).toLocaleString()}</p>}
            {destination?.lastError && <p role="alert" className="text-sm text-destructive">Last sync error: {destination.lastError}</p>}
            <Button variant="link" size="sm" className="min-h-10 px-0 text-sm text-muted-foreground" onClick={disconnectGoogle} disabled={saving}>Disconnect Google account</Button>
            {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
          </>
        )}
      </CardContent>
    </Card>
  );
}
