'use client';

import { useCallback, useState } from 'react';
import { Play, Pause, Square, Mic } from 'lucide-react';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import Analytics from '@/lib/analytics';
import { isTauri, platformInvoke } from '@/lib/platform';

interface RecordingControlsProps {
  isRecording: boolean;
  onStartRecording: () => void;
  onStopRecording: () => void;
  selectedDevices?: {
    micDevice: string | null;
    systemDevice: string | null;
  };
  onDeviceChange?: (devices: { micDevice: string | null; systemDevice: string | null }) => void;
  disabled?: boolean;
  barHeights?: string[];
}

export const RecordingControls: React.FC<RecordingControlsProps> = ({
  isRecording,
  onStartRecording,
  onStopRecording,
  selectedDevices,
  onDeviceChange,
  disabled = false,
  barHeights = ['58%', '76%', '58%'],
}) => {
  const [isStarting, setIsStarting] = useState(false);
  const [isStopping, setIsStopping] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [isPausing, setIsPausing] = useState(false);
  const [isResuming, setIsResuming] = useState(false);

  const handleStartRecording = useCallback(async () => {
    if (isStarting || disabled) return;

    setIsStarting(true);
    try {
      Analytics.trackButtonClick('start_recording', 'recording_controls');
      await onStartRecording();
    } catch (error) {
      console.error('Failed to start recording:', error);
    } finally {
      setIsStarting(false);
    }
  }, [isStarting, disabled, onStartRecording]);

  const handleStopRecording = useCallback(async () => {
    if (!isRecording || isStopping) return;

    setIsStopping(true);
    try {
      Analytics.trackButtonClick('stop_recording', 'recording_controls');
      await onStopRecording();
    } catch (error) {
      console.error('Failed to stop recording:', error);
    } finally {
      setIsStopping(false);
    }
  }, [isRecording, isStopping, onStopRecording]);

  const handlePauseRecording = useCallback(async () => {
    if (!isRecording || isPaused || isPausing || !isTauri()) return;

    setIsPausing(true);
    try {
      Analytics.trackButtonClick('pause_recording', 'recording_controls');
      await platformInvoke('pause_recording');
      setIsPaused(true);
      console.log('Recording paused successfully');
    } catch (error) {
      console.error('Failed to pause recording:', error);
    } finally {
      setIsPausing(false);
    }
  }, [isRecording, isPaused, isPausing]);

  const handleResumeRecording = useCallback(async () => {
    if (!isRecording || !isPaused || isResuming || !isTauri()) return;

    setIsResuming(true);
    try {
      Analytics.trackButtonClick('resume_recording', 'recording_controls');
      await platformInvoke('resume_recording');
      setIsPaused(false);
      console.log('Recording resumed successfully');
    } catch (error) {
      console.error('Failed to resume recording:', error);
    } finally {
      setIsResuming(false);
    }
  }, [isRecording, isPaused, isResuming]);

  return (
    <TooltipProvider>
      <div className="flex flex-col space-y-2">
        <div className="flex items-center space-x-2 bg-white rounded-full shadow-lg px-4 py-2">
          {!isRecording ? (
            // Start recording button
            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  onClick={handleStartRecording}
                  disabled={isStarting || disabled}
                  className={`w-12 h-12 flex items-center justify-center ${
                    isStarting || disabled ? 'bg-gray-400' : 'bg-red-500 hover:bg-red-600'
                  } rounded-full text-white transition-colors relative`}
                >
                  {isStarting ? (
                    <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
                  ) : (
                    <Mic size={20} />
                  )}
                </button>
              </TooltipTrigger>
              <TooltipContent>
                <p>Start recording</p>
              </TooltipContent>
            </Tooltip>
          ) : (
            // Recording controls (pause/resume + stop)
            <>
              {/* Pause/Resume button - only show in Tauri */}
              {isTauri() && (
                <Tooltip>
                  <TooltipTrigger asChild>
                    <button
                      onClick={() => {
                        if (isPaused) {
                          handleResumeRecording();
                        } else {
                          handlePauseRecording();
                        }
                      }}
                      disabled={isPausing || isResuming || isStopping}
                      className={`w-10 h-10 flex items-center justify-center ${
                        isPausing || isResuming || isStopping
                          ? 'bg-gray-200 border-2 border-gray-300 text-gray-400'
                          : 'bg-white border-2 border-gray-300 text-gray-600 hover:border-gray-400 hover:bg-gray-50'
                      } rounded-full transition-colors relative`}
                    >
                      {isPaused ? <Play size={16} /> : <Pause size={16} />}
                      {(isPausing || isResuming) && (
                        <div className="absolute -top-8 text-gray-600 font-medium text-xs">
                          {isPausing ? 'Pausing...' : 'Resuming...'}
                        </div>
                      )}
                    </button>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>{isPaused ? 'Resume recording' : 'Pause recording'}</p>
                  </TooltipContent>
                </Tooltip>
              )}

              {/* Stop button */}
              <Tooltip>
                <TooltipTrigger asChild>
                  <button
                    onClick={handleStopRecording}
                    disabled={isStopping || isPausing || isResuming}
                    className={`w-10 h-10 flex items-center justify-center ${
                      isStopping || isPausing || isResuming ? 'bg-gray-400' : 'bg-red-500 hover:bg-red-600'
                    } rounded-full text-white transition-colors relative`}
                  >
                    <Square size={16} />
                    {isStopping && (
                      <div className="absolute -top-8 text-gray-600 font-medium text-xs">
                        Stopping...
                      </div>
                    )}
                  </button>
                </TooltipTrigger>
                <TooltipContent>
                  <p>Stop recording</p>
                </TooltipContent>
              </Tooltip>

              {/* Animation bars */}
              <div className="flex items-center space-x-1 mx-4">
                {barHeights.map((height, index) => (
                  <div
                    key={index}
                    className={`w-1 rounded-full transition-all duration-200 ${
                      isPaused ? 'bg-orange-500' : 'bg-red-500'
                    }`}
                    style={{
                      height: isRecording && !isPaused ? height : '4px',
                      opacity: isPaused ? 0.6 : 1,
                    }}
                  />
                ))}
              </div>
            </>
          )}
        </div>

        {/* Status messages */}
        {!isTauri() && isRecording && (
          <div className="text-xs text-gray-600 text-center">
            Recording via browser (pause/resume available in desktop app)
          </div>
        )}
      </div>
    </TooltipProvider>
  );
};
