"use client";

import { useState } from 'react';
import { Transcript } from '@/types';
import { TranscriptView } from '@/components/TranscriptView';
import { TranscriptButtonGroup } from './TranscriptButtonGroup';
import { SpeakerList, DiarizationButton } from '@/components/Diarization';
import { ChevronDown, ChevronRight } from 'lucide-react';

interface TranscriptPanelProps {
  transcripts: Transcript[];
  customPrompt: string;
  onPromptChange: (value: string) => void;
  onCopyTranscript: () => void;
  onOpenMeetingFolder: () => Promise<void>;
  isRecording: boolean;
  // Speaker diarization props
  meetingId: string;
  audioPath: string;
  diarizationStatus: string;
  speakers: any[];
  onDiarizationComplete?: () => void;
  onStatusChange?: (status: string) => void;
  onSpeakerUpdate?: () => void;
}

export function TranscriptPanel({
  transcripts,
  customPrompt,
  onPromptChange,
  onCopyTranscript,
  onOpenMeetingFolder,
  isRecording,
  meetingId,
  audioPath,
  diarizationStatus,
  speakers,
  onDiarizationComplete,
  onStatusChange,
  onSpeakerUpdate,
}: TranscriptPanelProps) {
  const [isSpeakerSectionExpanded, setIsSpeakerSectionExpanded] = useState(true);

  const showSpeakers = diarizationStatus === 'completed' || diarizationStatus === 'processing' || speakers.length > 0;

  return (
    <div className="hidden md:flex md:w-1/4 lg:w-1/3 min-w-0 border-r border-gray-200 bg-white flex-col relative shrink-0">
      {/* Title area */}
      <div className="p-4 border-b border-gray-200">
        <TranscriptButtonGroup
          transcriptCount={transcripts?.length || 0}
          onCopyTranscript={onCopyTranscript}
          onOpenMeetingFolder={onOpenMeetingFolder}
        />
      </div>

      {/* Speaker Diarization Section */}
      {!isRecording && transcripts.length > 0 && (
        <div className="border-b border-gray-200 bg-gray-50">
          <div
            className="p-4 cursor-pointer flex items-center justify-between hover:bg-gray-100 transition-colors"
            onClick={() => setIsSpeakerSectionExpanded(!isSpeakerSectionExpanded)}
          >
            <h3 className="font-semibold text-sm text-gray-700">Speaker Identification</h3>
            {isSpeakerSectionExpanded ? (
              <ChevronDown className="h-4 w-4 text-gray-500" />
            ) : (
              <ChevronRight className="h-4 w-4 text-gray-500" />
            )}
          </div>

          {isSpeakerSectionExpanded && (
            <div className="px-4 pb-4 space-y-3">
              <DiarizationButton
                meetingId={meetingId}
                audioPath={audioPath}
                onComplete={onDiarizationComplete}
                onStatusChange={onStatusChange}
              />

              {showSpeakers && (
                <SpeakerList
                  meetingId={meetingId}
                  onSpeakerUpdate={onSpeakerUpdate}
                />
              )}
            </div>
          )}
        </div>
      )}

      {/* Transcript content */}
      <div className="flex-1 overflow-y-auto pb-4">
        <TranscriptView transcripts={transcripts} />
      </div>

      {/* Custom prompt input at bottom of transcript section */}
      {!isRecording && transcripts.length > 0 && (
        <div className="p-1 border-t border-gray-200">
          <textarea
            placeholder="Add context for AI summary. For example people involved, meeting overview, objective etc..."
            className="w-full px-3 py-2 border border-gray-200 rounded-md text-sm focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500 bg-white shadow-sm min-h-[80px] resize-y"
            value={customPrompt}
            onChange={(e) => onPromptChange(e.target.value)}
          />
        </div>
      )}
    </div>
  );
}
