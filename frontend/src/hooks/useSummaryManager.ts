/**
 * Summary Manager Hook
 *
 * Handles AI summary generation, polling, and state management
 * Works in both Tauri and web environments
 */

import { useState, useCallback, useRef, useEffect } from 'react';
import { apiClient } from '@/lib/apiClient';
import type { Summary, SummaryResponse } from '@/types';
import { toast } from 'sonner';
import Analytics from '@/lib/analytics';

export type SummaryStatus = 'idle' | 'processing' | 'summarizing' | 'regenerating' | 'completed' | 'error';

export interface UseSummaryManagerReturn {
  // State
  summaryStatus: SummaryStatus;
  aiSummary: Summary | null;
  summaryResponse: SummaryResponse | null;
  summaryError: string | null;
  isProcessing: boolean;

  // Actions
  generateSummary: (
    transcriptText: string,
    meetingId: string,
    provider: string,
    model: string,
    customPrompt?: string
  ) => Promise<void>;
  regenerateSummary: (
    transcriptText: string,
    meetingId: string,
    provider: string,
    model: string,
    customPrompt?: string
  ) => Promise<void>;
  clearSummary: () => void;
  saveSummary: (meetingId: string) => Promise<void>;
}

export function useSummaryManager(): UseSummaryManagerReturn {
  const [summaryStatus, setSummaryStatus] = useState<SummaryStatus>('idle');
  const [aiSummary, setAiSummary] = useState<Summary | null>(null);
  const [summaryResponse, setSummaryResponse] = useState<SummaryResponse | null>(null);
  const [summaryError, setSummaryError] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);

  // Ref for polling interval
  const pollIntervalRef = useRef<NodeJS.Timeout | null>(null);

  /**
   * Stop any active polling
   */
  const stopPolling = useCallback(() => {
    if (pollIntervalRef.current) {
      clearInterval(pollIntervalRef.current);
      pollIntervalRef.current = null;
    }
  }, []);

  /**
   * Poll for summary status
   */
  const pollSummaryStatus = useCallback(async (
    meetingId: string,
    onComplete: (summary: Summary | null) => void
  ) => {
    let pollCount = 0;
    const MAX_POLLS = 120; // 10 minutes at 5-second intervals

    console.log(`📊 Starting summary polling for meeting ${meetingId}`);

    const poll = async () => {
      pollCount++;

      // Timeout safety
      if (pollCount >= MAX_POLLS) {
        console.warn(`⏱️ Summary polling timeout for ${meetingId}`);
        stopPolling();
        setSummaryStatus('error');
        setSummaryError('Summary generation timed out after 10 minutes. Please try again.');
        toast.error('Summary generation timed out');
        return;
      }

      try {
        const result = await apiClient.getSummaryStatus(meetingId);

        console.log(`📊 Polling update for ${meetingId}:`, result.status);

        // Update status
        if (result.status === 'completed') {
          console.log(`✅ Summary completed for ${meetingId}`);
          setSummaryStatus('completed');
          setSummaryResponse(result);

          if (result.summary) {
            setAiSummary(result.summary);
          }

          stopPolling();
          onComplete(result.summary);
        } else if (result.status === 'error' || result.status === 'failed') {
          console.error(`❌ Summary failed for ${meetingId}:`, result.error);
          setSummaryStatus('error');
          setSummaryError(result.error || 'Summary generation failed');
          toast.error(result.error || 'Summary generation failed');
          stopPolling();
          onComplete(null);
        } else if (result.status === 'processing' || result.status === 'summarizing') {
          setSummaryStatus(result.status);
        }
      } catch (error) {
        console.error(`❌ Polling error for ${meetingId}:`, error);
        setSummaryStatus('error');
        setSummaryError(error instanceof Error ? error.message : 'Unknown error');
        toast.error('Error checking summary status');
        stopPolling();
        onComplete(null);
      }
    };

    // Start polling
    pollIntervalRef.current = setInterval(poll, 5000);

    // Initial poll
    poll();
  }, [stopPolling]);

  /**
   * Generate summary
   */
  const generateSummary = useCallback(async (
    transcriptText: string,
    meetingId: string,
    provider: string,
    model: string,
    customPrompt?: string
  ) => {
    try {
      setIsProcessing(true);
      setSummaryStatus('processing');
      setSummaryError(null);

      // Validate transcript
      if (!transcriptText || !transcriptText.trim()) {
        throw new Error('No transcript available to summarize');
      }

      console.log('🚀 Generating summary...');

      // Start summary generation
      const result = await apiClient.generateSummary(
        transcriptText,
        provider,
        model,
        meetingId,
        customPrompt || 'Generate a summary of the meeting transcript.'
      );

      console.log('📊 Summary generation started, process ID:', result.process_id);

      // Track analytics
      Analytics.trackSummaryGenerated(meetingId, provider, model);

      // Start polling for status
      await pollSummaryStatus(meetingId, (summary) => {
        if (summary) {
          console.log('✅ Summary generation completed successfully');
          toast.success('Summary generated successfully');
        }
        setIsProcessing(false);
      });

    } catch (error) {
      console.error('Error generating summary:', error);
      setSummaryStatus('error');
      setSummaryError(error instanceof Error ? error.message : 'Failed to generate summary');
      toast.error(error instanceof Error ? error.message : 'Failed to generate summary');
      setIsProcessing(false);
    }
  }, [pollSummaryStatus]);

  /**
   * Regenerate summary with new prompt
   */
  const regenerateSummary = useCallback(async (
    transcriptText: string,
    meetingId: string,
    provider: string,
    model: string,
    customPrompt?: string
  ) => {
    setSummaryStatus('regenerating');
    await generateSummary(transcriptText, meetingId, provider, model, customPrompt);
  }, [generateSummary]);

  /**
   * Clear summary state
   */
  const clearSummary = useCallback(() => {
    stopPolling();
    setSummaryStatus('idle');
    setAiSummary(null);
    setSummaryResponse(null);
    setSummaryError(null);
    setIsProcessing(false);
  }, [stopPolling]);

  /**
   * Save summary to meeting
   */
  const saveSummary = useCallback(async (meetingId: string) => {
    if (!aiSummary) {
      toast.error('No summary to save');
      return;
    }

    try {
      await apiClient.saveMeetingSummary(meetingId, aiSummary);
      toast.success('Summary saved successfully');
    } catch (error) {
      console.error('Error saving summary:', error);
      toast.error('Failed to save summary');
    }
  }, [aiSummary]);

  /**
   * Cleanup on unmount
   */
  useEffect(() => {
    return () => {
      stopPolling();
    };
  }, [stopPolling]);

  return {
    // State
    summaryStatus,
    aiSummary,
    summaryResponse,
    summaryError,
    isProcessing,

    // Actions
    generateSummary,
    regenerateSummary,
    clearSummary,
    saveSummary
  };
}
