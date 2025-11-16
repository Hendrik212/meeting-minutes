/**
 * Transcript Manager Hook
 *
 * Handles transcript storage, real-time updates, and persistence
 * Works in both Tauri (via events) and web (via WebSocket)
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { isTauri, platformListen } from '@/lib/platform';
import { apiClient } from '@/lib/apiClient';
import type { Transcript, TranscriptUpdate } from '@/types';
import { toast } from 'sonner';

export interface UseTranscriptManagerReturn {
  // State
  transcripts: Transcript[];
  isSavingTranscript: boolean;

  // Actions
  addTranscript: (transcript: Transcript) => void;
  clearTranscripts: () => void;
  saveTranscripts: (meetingTitle: string, meetingId?: string) => Promise<{ success: boolean; meetingId?: string }>;
  loadTranscripts: (meetingId: string) => Promise<void>;

  // Real-time updates
  startListeningForTranscripts: (meetingId?: string) => Promise<() => void>;
}

export function useTranscriptManager(
  serverAddress?: string
): UseTranscriptManagerReturn {
  const [transcripts, setTranscripts] = useState<Transcript[]>([]);
  const [isSavingTranscript, setIsSavingTranscript] = useState(false);

  // WebSocket ref for web environment
  const wsRef = useRef<WebSocket | null>(null);

  // Ref to avoid stale closures
  const transcriptsRef = useRef<Transcript[]>(transcripts);

  useEffect(() => {
    transcriptsRef.current = transcripts;
  }, [transcripts]);

  /**
   * Add a transcript to the list
   */
  const addTranscript = useCallback((transcript: Transcript) => {
    setTranscripts(prev => [...prev, transcript]);
  }, []);

  /**
   * Clear all transcripts
   */
  const clearTranscripts = useCallback(() => {
    setTranscripts([]);
  }, []);

  /**
   * Save transcripts to backend
   */
  const saveTranscripts = useCallback(async (
    meetingTitle: string,
    meetingId?: string
  ): Promise<{ success: boolean; meetingId?: string }> => {
    try {
      setIsSavingTranscript(true);

      // Save via apiClient (works in both Tauri and web)
      const result = await apiClient.saveTranscript(
        meetingTitle,
        transcriptsRef.current,
        meetingId
      );

      toast.success('Transcripts saved successfully');

      return {
        success: true,
        meetingId: result.meeting_id || meetingId
      };
    } catch (error) {
      console.error('Error saving transcripts:', error);
      toast.error('Failed to save transcripts');
      return { success: false };
    } finally {
      setIsSavingTranscript(false);
    }
  }, []);

  /**
   * Load transcripts from backend
   */
  const loadTranscripts = useCallback(async (meetingId: string) => {
    try {
      const meeting = await apiClient.getMeeting(meetingId);
      if (meeting && meeting.transcripts) {
        setTranscripts(meeting.transcripts);
      }
    } catch (error) {
      console.error('Error loading transcripts:', error);
      toast.error('Failed to load transcripts');
    }
  }, []);

  /**
   * Start listening for real-time transcript updates
   *
   * In Tauri: Uses Tauri events
   * In Web: Uses WebSocket connection
   */
  const startListeningForTranscripts = useCallback(async (
    meetingId?: string
  ): Promise<() => void> => {
    if (isTauri()) {
      // Tauri: Use event listener
      const unlisten = await platformListen<TranscriptUpdate>(
        'transcript-update',
        (payload) => {
          console.log('Received transcript update:', payload);

          const newTranscript: Transcript = {
            id: payload.id || `transcript-${Date.now()}`,
            text: payload.text,
            timestamp: payload.timestamp || new Date().toISOString(),
            audio_start_time: payload.audio_start_time,
            audio_end_time: payload.audio_end_time,
            duration: payload.duration
          };

          setTranscripts(prev => [...prev, newTranscript]);
        }
      );

      return unlisten;
    } else {
      // Web: Use WebSocket
      const wsUrl = serverAddress
        ? `${serverAddress.replace('http', 'ws')}/ws/transcripts${meetingId ? `/${meetingId}` : ''}`
        : `ws://localhost:5167/ws/transcripts${meetingId ? `/${meetingId}` : ''}`;

      console.log('Connecting to WebSocket:', wsUrl);

      const ws = new WebSocket(wsUrl);

      ws.onopen = () => {
        console.log('WebSocket connected for transcripts');
      };

      ws.onmessage = (event) => {
        try {
          const payload: TranscriptUpdate = JSON.parse(event.data);
          console.log('Received transcript via WebSocket:', payload);

          const newTranscript: Transcript = {
            id: payload.id || `transcript-${Date.now()}`,
            text: payload.text,
            timestamp: payload.timestamp || new Date().toISOString(),
            audio_start_time: payload.audio_start_time,
            audio_end_time: payload.audio_end_time,
            duration: payload.duration
          };

          setTranscripts(prev => [...prev, newTranscript]);
        } catch (error) {
          console.error('Error parsing WebSocket message:', error);
        }
      };

      ws.onerror = (error) => {
        console.error('WebSocket error:', error);
        toast.error('Connection error: Transcripts may not update in real-time');
      };

      ws.onclose = () => {
        console.log('WebSocket disconnected');
      };

      wsRef.current = ws;

      // Return cleanup function
      return () => {
        if (ws.readyState === WebSocket.OPEN || ws.readyState === WebSocket.CONNECTING) {
          ws.close();
        }
      };
    }
  }, [serverAddress]);

  /**
   * Cleanup WebSocket on unmount
   */
  useEffect(() => {
    return () => {
      if (wsRef.current) {
        wsRef.current.close();
        wsRef.current = null;
      }
    };
  }, []);

  return {
    // State
    transcripts,
    isSavingTranscript,

    // Actions
    addTranscript,
    clearTranscripts,
    saveTranscripts,
    loadTranscripts,

    // Real-time updates
    startListeningForTranscripts
  };
}
