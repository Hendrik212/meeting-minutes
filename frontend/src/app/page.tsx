'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { motion } from 'framer-motion';
import type { Transcript } from '@/types';
import { EditableTitle } from '@/components/EditableTitle';
import { TranscriptView } from '@/components/TranscriptView';
import { RecordingControls } from '@/components/RecordingControls';
import { AISummary } from '@/components/AISummary';
import { useSidebar } from '@/components/Sidebar/SidebarProvider';
import { PermissionWarning } from '@/components/PermissionWarning';
import { usePermissionCheck } from '@/hooks/usePermissionCheck';
import { useRecordingState } from '@/contexts/RecordingStateContext';
import { useNavigation } from '@/hooks/useNavigation';
import { useRouter } from 'next/navigation';
import Analytics from '@/lib/analytics';
import { showRecordingNotification } from '@/lib/recordingNotification';
import { Button } from '@/components/ui/button';
import { Copy } from 'lucide-react';
import { toast } from 'sonner';

// Import custom hooks
import { useRecordingManager } from '@/hooks/useRecordingManager';
import { useTranscriptManager } from '@/hooks/useTranscriptManager';
import { useSummaryManager } from '@/hooks/useSummaryManager';
import { useModelConfig } from '@/hooks/useModelConfig';

// Import platform detection
import { isTauri, platformInvoke } from '@/lib/platform';

interface OllamaModel {
  name: string;
  id: string;
  size: string;
  modified: string;
}

export default function Home() {
  // ============================================================================
  // CUSTOM HOOKS - Replaces 200+ lines of state and logic
  // ============================================================================

  // Recording management (devices, preferences, start/stop)
  const recording = useRecordingManager();

  // Transcript management (storage, real-time updates via events/WebSocket)
  const { serverAddress } = useSidebar();
  const transcript = useTranscriptManager(serverAddress);

  // Summary management (generation, polling, status)
  const summary = useSummaryManager();

  // Model configuration management (LLM and Whisper models)
  const { modelConfig, updateModelConfig } = useModelConfig({
    provider: 'ollama',
    model: 'llama3.2:latest',
    whisperModel: 'large-v3'
  });

  // ============================================================================
  // LOCAL UI STATE
  // ============================================================================

  const [showSummary, setShowSummary] = useState(false);
  const [meetingTitle, setMeetingTitle] = useState('+ New Call');
  const [isEditingTitle, setIsEditingTitle] = useState(false);
  const [customPrompt, setCustomPrompt] = useState('');
  const [models, setModels] = useState<OllamaModel[]>([]);
  const [showConfidenceIndicator, setShowConfidenceIndicator] = useState<boolean>(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('showConfidenceIndicator');
      return saved !== null ? saved === 'true' : true;
    }
    return true;
  });

  // Permission check hook
  const { hasMicrophone, hasSystemAudio, isChecking: isCheckingPermissions, checkPermissions } = usePermissionCheck();

  // Recording state context - provides backend-synced state
  const recordingState = useRecordingState();

  // Sidebar context
  const {
    setCurrentMeeting,
    setMeetings,
    meetings,
    isMeetingActive,
    setIsMeetingActive,
    setIsRecording: setSidebarIsRecording,
    isCollapsed: sidebarCollapsed,
    refetchMeetings
  } = useSidebar();

  const handleNavigation = useNavigation('', '');
  const router = useRouter();

  // Auto-scroll refs
  const isUserAtBottomRef = useRef<boolean>(true);
  const transcriptContainerRef = useRef<HTMLDivElement>(null);
  const transcriptsRef = useRef<Transcript[]>(transcript.transcripts);

  // ============================================================================
  // EFFECTS
  // ============================================================================

  // Keep transcripts ref updated
  useEffect(() => {
    transcriptsRef.current = transcript.transcripts;
  }, [transcript.transcripts]);

  // Smart auto-scroll: Track user scroll position
  useEffect(() => {
    const handleScroll = () => {
      const container = transcriptContainerRef.current;
      if (!container) return;

      const { scrollTop, scrollHeight, clientHeight } = container;
      const isAtBottom = scrollTop + clientHeight >= scrollHeight - 10;
      isUserAtBottomRef.current = isAtBottom;
    };

    const container = transcriptContainerRef.current;
    if (container) {
      container.addEventListener('scroll', handleScroll);
      return () => container.removeEventListener('scroll', handleScroll);
    }
  }, []);

  // Auto-scroll when transcripts change (only if user is at bottom)
  useEffect(() => {
    if (isUserAtBottomRef.current && transcriptContainerRef.current) {
      const scrollTimeout = setTimeout(() => {
        const container = transcriptContainerRef.current;
        if (container) {
          container.scrollTo({
            top: container.scrollHeight,
            behavior: 'smooth'
          });
        }
      }, 150);

      return () => clearTimeout(scrollTimeout);
    }
  }, [transcript.transcripts]);

  // Load Ollama models if using Ollama provider
  useEffect(() => {
    if (modelConfig.provider === 'ollama') {
      loadOllamaModels();
    }
  }, [modelConfig.provider]);

  // Set up transcript listener when component mounts
  useEffect(() => {
    let cleanup: (() => void) | undefined;

    const setupListener = async () => {
      cleanup = await transcript.startListeningForTranscripts();
    };

    setupListener();

    return () => {
      if (cleanup) cleanup();
    };
  }, [transcript.startListeningForTranscripts]);

  // Sync sidebar recording state
  useEffect(() => {
    setSidebarIsRecording(recording.isRecording);
  }, [recording.isRecording, setSidebarIsRecording]);

  // Sync meeting active state
  useEffect(() => {
    if (recording.isRecording) {
      setIsMeetingActive(true);
    }
  }, [recording.isRecording, setIsMeetingActive]);

  // ============================================================================
  // HANDLERS
  // ============================================================================

  // Load Ollama models
  const loadOllamaModels = async () => {
    if (!isTauri()) return; // Only available in Tauri

    try {
      const result = await platformInvoke<OllamaModel[]>('list_ollama_models', {});
      setModels(result || []);
    } catch (error) {
      console.error('Failed to load Ollama models:', error);
    }
  };

  // Handle recording start
  const handleRecordingStart = async () => {
    try {
      console.log('Starting recording...');

      // Generate meeting title
      const now = new Date();
      const day = String(now.getDate()).padStart(2, '0');
      const month = String(now.getMonth() + 1).padStart(2, '0');
      const year = String(now.getFullYear()).slice(-2);
      const hours = String(now.getHours()).padStart(2, '0');
      const minutes = String(now.getMinutes()).padStart(2, '0');
      const seconds = String(now.getSeconds()).padStart(2, '0');
      const generatedTitle = `Meeting ${day}_${month}_${year}_${hours}_${minutes}_${seconds}`;

      setMeetingTitle(generatedTitle);
      transcript.clearTranscripts();
      setIsMeetingActive(true);

      // Start recording using hook
      await recording.startRecording(generatedTitle);

      Analytics.trackButtonClick('start_recording', 'home_page');
      await showRecordingNotification();
    } catch (error) {
      console.error('Failed to start recording:', error);
      toast.error('Failed to start recording');
      Analytics.trackButtonClick('start_recording_error', 'home_page');
    }
  };

  // Handle recording stop
  const handleRecordingStop = async () => {
    try {
      console.log('Stopping recording...');

      // Stop recording using hook
      await recording.stopRecording();

      // Show summary button if we have transcripts
      if (transcript.transcripts.length > 0) {
        setShowSummary(true);
      }

      Analytics.trackButtonClick('stop_recording', 'home_page');
    } catch (error) {
      console.error('Failed to stop recording:', error);
      toast.error('Failed to stop recording');
    }
  };

  // Handle summary generation
  const handleGenerateSummary = useCallback(async () => {
    if (!transcript.transcripts.length) {
      toast.info('No transcript available to summarize');
      return;
    }

    try {
      // Combine transcripts into text
      const transcriptText = transcript.transcripts
        .map(t => t.text)
        .join(' ');

      // Get or create meeting ID
      let meetingId = '';
      if (isMeetingActive && meetings.length > 0) {
        const currentMeeting = meetings.find(m => m.title === meetingTitle);
        meetingId = currentMeeting?.id || '';
      }

      // If no meeting ID, save transcripts first
      if (!meetingId) {
        const result = await transcript.saveTranscripts(meetingTitle);
        if (result.success && result.meetingId) {
          meetingId = result.meetingId;
        }
      }

      // Generate summary using hook
      await summary.generateSummary(
        transcriptText,
        meetingId,
        modelConfig.provider,
        modelConfig.model,
        customPrompt || 'Generate a comprehensive summary of this meeting.'
      );

    } catch (error) {
      console.error('Failed to generate summary:', error);
      toast.error('Failed to generate summary');
    }
  }, [transcript.transcripts, meetingTitle, isMeetingActive, meetings, modelConfig, customPrompt]);

  // Handle regenerate summary
  const handleRegenerateSummary = useCallback(async () => {
    if (!transcript.transcripts.length) {
      toast.info('No transcript available');
      return;
    }

    try {
      const transcriptText = transcript.transcripts.map(t => t.text).join(' ');

      let meetingId = '';
      if (isMeetingActive && meetings.length > 0) {
        const currentMeeting = meetings.find(m => m.title === meetingTitle);
        meetingId = currentMeeting?.id || '';
      }

      await summary.regenerateSummary(
        transcriptText,
        meetingId,
        modelConfig.provider,
        modelConfig.model,
        customPrompt || 'Generate a comprehensive summary of this meeting.'
      );

    } catch (error) {
      console.error('Failed to regenerate summary:', error);
      toast.error('Failed to regenerate summary');
    }
  }, [transcript.transcripts, meetingTitle, isMeetingActive, meetings, modelConfig, customPrompt]);

  // Handle save transcript
  const handleSaveTranscript = async () => {
    if (!transcript.transcripts.length) {
      toast.info('No transcript to save');
      return;
    }

    try {
      const result = await transcript.saveTranscripts(meetingTitle);

      if (result.success) {
        // Refresh meetings list
        await refetchMeetings();

        // Update current meeting
        if (result.meetingId) {
          setCurrentMeeting({
            id: result.meetingId,
            title: meetingTitle
          });
        }
      }
    } catch (error) {
      console.error('Failed to save transcript:', error);
    }
  };

  // Handle copy transcript
  const handleCopyTranscript = useCallback(async () => {
    const formattedTranscript = transcript.transcripts
      .map(t => t.text)
      .join('\n\n');

    if (!formattedTranscript.trim()) {
      toast.info('No transcript to copy');
      return;
    }

    try {
      await navigator.clipboard.writeText(formattedTranscript);
      toast.success('Transcript copied to clipboard');
    } catch (error) {
      console.error('Failed to copy transcript:', error);
      toast.error('Failed to copy transcript');
    }
  }, [transcript.transcripts]);

  // Handle confidence indicator toggle
  const handleConfidenceToggle = (checked: boolean) => {
    setShowConfidenceIndicator(checked);
    if (typeof window !== 'undefined') {
      localStorage.setItem('showConfidenceIndicator', checked.toString());
    }
    window.dispatchEvent(new CustomEvent('confidenceIndicatorChanged', { detail: checked }));
  };

  // ============================================================================
  // COMPUTED VALUES
  // ============================================================================

  const modelOptions = {
    ollama: models.map(model => model.name),
    claude: ['claude-3-5-sonnet-latest'],
    groq: ['llama-3.3-70b-versatile'],
    openrouter: [],
  };

  const isSummaryLoading = summary.summaryStatus === 'processing' ||
                           summary.summaryStatus === 'summarizing' ||
                           summary.summaryStatus === 'regenerating';

  const effectiveIsRecording = recording.isRecording;

  // ============================================================================
  // RENDER
  // ============================================================================

  return (
    <div className="flex h-screen bg-gray-50">
      {/* Main Content */}
      <div className={`flex-1 flex flex-col transition-all duration-300 ${sidebarCollapsed ? 'ml-0' : 'ml-0'}`}>

        {/* Header */}
        <div className="bg-white border-b border-gray-200 px-6 py-4">
          <div className="flex items-center justify-between">
            <EditableTitle
              title={meetingTitle}
              onChange={setMeetingTitle}
              isEditing={isEditingTitle}
              onStartEditing={() => setIsEditingTitle(true)}
              onFinishEditing={() => setIsEditingTitle(false)}
            />

            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={handleCopyTranscript}
                disabled={transcript.transcripts.length === 0}
              >
                <Copy className="h-4 w-4 mr-2" />
                Copy Transcript
              </Button>
            </div>
          </div>
        </div>

        {/* Permission Warning */}
        {(!hasMicrophone || !hasSystemAudio) && !isCheckingPermissions && (
          <PermissionWarning
            hasMicrophone={hasMicrophone}
            hasSystemAudio={hasSystemAudio}
            onRecheck={checkPermissions}
          />
        )}

        {/* Main Content Area */}
        <div className="flex-1 flex overflow-hidden">
          {/* Transcript Area */}
          <div className="flex-1 flex flex-col overflow-hidden">
            <div
              ref={transcriptContainerRef}
              className="flex-1 overflow-y-auto px-6 py-4"
            >
              {transcript.transcripts.length === 0 ? (
                <div className="flex items-center justify-center h-full text-gray-500">
                  <p>Start recording to see transcripts appear here...</p>
                </div>
              ) : (
                <TranscriptView
                  transcripts={transcript.transcripts}
                />
              )}
            </div>

            {/* Recording Controls */}
            <div className="border-t border-gray-200 bg-white p-6">
              <RecordingControls
                isRecording={effectiveIsRecording}
                onStartRecording={handleRecordingStart}
                onStopRecording={handleRecordingStop}
                selectedDevices={recording.selectedDevices}
                onDeviceChange={recording.setSelectedDevices}
                disabled={false}
              />
            </div>
          </div>

          {/* Summary Sidebar */}
          {showSummary && (
            <div className="w-96 border-l border-gray-200 bg-white overflow-y-auto">
              <AISummary
                summary={summary.aiSummary}
                status={summary.summaryStatus}
                error={summary.summaryError}
                onSummaryChange={(newSummary) => {
                  // Update summary state when changed in the component
                  summary.setAiSummary(newSummary);
                }}
                onRegenerateSummary={handleRegenerateSummary}
              />
            </div>
          )}
        </div>
      </div>

    </div>
  );
}
