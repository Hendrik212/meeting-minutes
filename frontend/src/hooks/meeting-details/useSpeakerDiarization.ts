import { useState, useEffect, useCallback } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { toast } from 'sonner';

interface Speaker {
  id: string;
  speaker_label: string;
  custom_name?: string;
  created_at: string;
}

interface DiarizationStatus {
  status: string;
  num_speakers?: number;
  created_at: string;
  updated_at: string;
  error?: string;
}

interface UseSpeakerDiarizationProps {
  meetingId: string;
}

export function useSpeakerDiarization({ meetingId }: UseSpeakerDiarizationProps) {
  const [speakers, setSpeakers] = useState<Speaker[]>([]);
  const [diarizationStatus, setDiarizationStatus] = useState<string>('not_started');
  const [isProcessing, setIsProcessing] = useState(false);
  const [audioPath, setAudioPath] = useState<string>('');

  // Load audio path for the meeting
  const loadAudioPath = useCallback(async () => {
    try {
      const folderPath = await invoke<string>('get_meeting_folder_path', { meetingId });
      const path = `${folderPath}/recording.wav`;
      setAudioPath(path);
      console.log('🎤 Audio path loaded:', path);
    } catch (error) {
      console.error('Failed to load audio path:', error);
    }
  }, [meetingId]);

  // Check diarization status
  const checkStatus = useCallback(async () => {
    try {
      const status = await invoke<DiarizationStatus>('get_diarization_status', { meetingId });
      setDiarizationStatus(status.status);

      if (status.status === 'processing') {
        setIsProcessing(true);
      } else if (status.status === 'completed') {
        setIsProcessing(false);
        loadSpeakers();
      } else if (status.status === 'failed') {
        setIsProcessing(false);
      }
    } catch (error) {
      // Status not found - not started yet
      setDiarizationStatus('not_started');
    }
  }, [meetingId]);

  // Load speakers for the meeting
  const loadSpeakers = useCallback(async () => {
    try {
      const speakerData = await invoke<Speaker[]>('get_speakers', { meetingId });
      setSpeakers(speakerData);
    } catch (error) {
      console.error('Failed to load speakers:', error);
    }
  }, [meetingId]);

  // Initialize
  useEffect(() => {
    loadAudioPath();
    checkStatus();
    loadSpeakers();
  }, [loadAudioPath, checkStatus, loadSpeakers]);

  // Refresh speakers when status changes to completed
  const handleDiarizationComplete = useCallback(() => {
    loadSpeakers();
    checkStatus();
  }, [loadSpeakers, checkStatus]);

  const handleStatusChange = useCallback((status: string) => {
    setDiarizationStatus(status);
    if (status === 'completed') {
      loadSpeakers();
    }
  }, [loadSpeakers]);

  return {
    speakers,
    diarizationStatus,
    isProcessing,
    audioPath,
    refreshSpeakers: loadSpeakers,
    handleDiarizationComplete,
    handleStatusChange,
  };
}
