'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { motion } from 'framer-motion';
import type { Transcript } from '@/types';
import { EditableTitle } from '@/components/EditableTitle';
import { TranscriptView } from '@/components/TranscriptView';
import { RecordingControls } from '@/components/RecordingControls';
import { AISummary } from '@/components/AISummary';
import { DeviceSelection } from '@/components/DeviceSelection';
import { useSidebar } from '@/components/Sidebar/SidebarProvider';
import { TranscriptSettings, TranscriptModelProps } from '@/components/TranscriptSettings';
import { LanguageSelection } from '@/components/LanguageSelection';
import { PermissionWarning } from '@/components/PermissionWarning';
import { PreferenceSettings } from '@/components/PreferenceSettings';
import { usePermissionCheck } from '@/hooks/usePermissionCheck';
import { useRecordingState } from '@/contexts/RecordingStateContext';
import { useNavigation } from '@/hooks/useNavigation';
import { useRouter } from 'next/navigation';
import Analytics from '@/lib/analytics';
import { showRecordingNotification } from '@/lib/recordingNotification';
import { Button } from '@/components/ui/button';
import { Copy, Settings } from 'lucide-react';
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
  const [transcriptModelConfig, setTranscriptModelConfig] = useState<TranscriptModelProps>({
    provider: 'parakeet',
    model: 'parakeet-tdt-0.6b-v3-int8',
    apiKey: null
  });
  const [models, setModels] = useState<OllamaModel[]>([]);
  const [showModelSettings, setShowModelSettings] = useState(false);
  const [showDeviceSettings, setShowDeviceSettings] = useState(false);
  const [showModelSelector, setShowModelSelector] = useState(false);
  const [modelSelectorMessage, setModelSelectorMessage] = useState('');
  const [showLanguageSettings, setShowLanguageSettings] = useState(false);
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

  // Handle transcript configuration save
  const handleSaveTranscriptConfig = async (config: TranscriptModelProps) => {
    if (!isTauri()) return; // Only available in Tauri

    try {
      console.log('Saving transcript config:', config);
      await platformInvoke('api_save_transcript_config', {
        provider: config.provider,
        model: config.model,
        apiKey: config.apiKey
      });
      console.log('Successfully saved transcript config');
    } catch (error) {
      console.error('Failed to save transcript config:', error);
      toast.error('Failed to save transcript configuration');
    }
  };

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

              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowDeviceSettings(true)}
              >
                <Settings className="h-4 w-4 mr-2" />
                Settings
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

      {/* Settings Modals */}
      {showDeviceSettings && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl p-6 max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-2xl font-bold">Settings</h2>
              <button
                onClick={() => setShowDeviceSettings(false)}
                className="text-gray-500 hover:text-gray-700"
              >
                ✕
              </button>
            </div>

            <div className="space-y-6">
              {/* Device Selection */}
              <div>
                <h3 className="text-lg font-semibold mb-4">Audio Devices</h3>
                <DeviceSelection
                  selectedDevices={recording.selectedDevices}
                  onDeviceChange={recording.setSelectedDevices}
                  disabled={effectiveIsRecording}
                />
              </div>

              {/* Language Selection */}
              <div>
                <h3 className="text-lg font-semibold mb-4">Language</h3>
                <LanguageSelection
                  selectedLanguage={recording.selectedLanguage}
                  onLanguageChange={recording.setSelectedLanguage}
                  disabled={effectiveIsRecording}
                  provider={transcriptModelConfig.provider}
                />
              </div>

              {/* Transcript Settings */}
              <div>
                <h3 className="text-lg font-semibold mb-4">Transcript Model</h3>
                <TranscriptSettings
                  transcriptModelConfig={transcriptModelConfig}
                  setTranscriptModelConfig={setTranscriptModelConfig}
                  onModelSelect={() => {
                    // Optional: handle model selection completion
                  }}
                />
              </div>

              {/* Preference Settings */}
              <div>
                <h3 className="text-lg font-semibold mb-4">Preferences</h3>
                <PreferenceSettings />
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
