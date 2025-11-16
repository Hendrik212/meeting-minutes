import { useState, useEffect } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { Button } from '@/components/ui/button';
import { Users, Loader2, CheckCircle2, AlertCircle } from 'lucide-react';
import { toast } from 'sonner';

interface DiarizationButtonProps {
  meetingId: string;
  audioPath: string;
  onComplete?: () => void;
  onStatusChange?: (status: string) => void;
}

interface DiarizationStatus {
  status: string;
  num_speakers?: number;
  created_at: string;
  updated_at: string;
  error?: string;
}

export function DiarizationButton({
  meetingId,
  audioPath,
  onComplete,
  onStatusChange
}: DiarizationButtonProps) {
  const [isProcessing, setIsProcessing] = useState(false);
  const [status, setStatus] = useState<string>('not_started');
  const [numSpeakers, setNumSpeakers] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // Check initial status
    checkStatus();
  }, [meetingId]);

  useEffect(() => {
    let interval: NodeJS.Timeout | null = null;

    if (isProcessing) {
      // Poll for status updates while processing
      interval = setInterval(checkStatus, 2000);
    }

    return () => {
      if (interval) clearInterval(interval);
    };
  }, [isProcessing, meetingId]);

  const checkStatus = async () => {
    try {
      const statusData = await invoke<DiarizationStatus>('get_diarization_status', { meetingId });

      setStatus(statusData.status);
      setNumSpeakers(statusData.num_speakers || null);
      onStatusChange?.(statusData.status);

      if (statusData.status === 'completed') {
        setIsProcessing(false);
        setError(null);
        toast.success(`Speaker identification complete! Found ${statusData.num_speakers} speaker(s)`);
        onComplete?.();
      } else if (statusData.status === 'failed') {
        setIsProcessing(false);
        setError(statusData.error || 'Unknown error');
        toast.error(`Speaker identification failed: ${statusData.error || 'Unknown error'}`);
      } else if (statusData.status === 'processing') {
        setIsProcessing(true);
      }
    } catch (error) {
      // Silently handle "not started" status
      if (status !== 'not_started') {
        console.error('Error checking status:', error);
      }
    }
  };

  const startDiarization = async () => {
    try {
      setIsProcessing(true);
      setError(null);

      await invoke('start_diarization', {
        meetingId,
        audioPath,
        numSpeakers: null,
        minSpeakers: 2,
        maxSpeakers: 10
      });

      toast.success('Speaker identification started');
    } catch (error) {
      console.error('Failed to start diarization:', error);
      setIsProcessing(false);
      setError(String(error));
      toast.error('Failed to start speaker identification');
    }
  };

  const getButtonContent = () => {
    if (status === 'completed') {
      return (
        <>
          <CheckCircle2 className="h-4 w-4" />
          Speakers Identified ({numSpeakers})
        </>
      );
    }

    if (status === 'failed') {
      return (
        <>
          <AlertCircle className="h-4 w-4" />
          Identification Failed
        </>
      );
    }

    if (isProcessing || status === 'processing') {
      return (
        <>
          <Loader2 className="h-4 w-4 animate-spin" />
          Identifying Speakers...
        </>
      );
    }

    return (
      <>
        <Users className="h-4 w-4" />
        Identify Speakers
      </>
    );
  };

  const getButtonVariant = () => {
    if (status === 'completed') return 'default';
    if (status === 'failed') return 'destructive';
    return 'outline';
  };

  const isDisabled = isProcessing || status === 'processing';

  return (
    <div className="space-y-2">
      <Button
        onClick={startDiarization}
        disabled={isDisabled}
        variant={getButtonVariant()}
        className="flex items-center gap-2"
      >
        {getButtonContent()}
      </Button>

      {error && (
        <p className="text-sm text-red-600">
          Error: {error}
        </p>
      )}

      {status === 'processing' && (
        <p className="text-sm text-muted-foreground">
          This may take a few minutes depending on meeting length...
        </p>
      )}
    </div>
  );
}
