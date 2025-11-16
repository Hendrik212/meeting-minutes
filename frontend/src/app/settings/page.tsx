'use client';

import React, { useState, useEffect } from 'react';
import { ArrowLeft, Settings2, Mic, Database as DatabaseIcon, SparkleIcon } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { isTauri, platformInvoke } from '@/lib/platform';
import { TranscriptSettings, TranscriptModelProps } from '@/components/TranscriptSettings';
import { RecordingSettings } from '@/components/RecordingSettings';
import { PreferenceSettings } from '@/components/PreferenceSettings';
import { SummaryModelSettings } from '@/components/SummaryModelSettings';
import { LanguageSelection } from '@/components/LanguageSelection';
import * as recordingAdapter from '@/lib/recordingAdapter';

// Backend API URL - must be full URL for web browser
const BACKEND_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5167';

type SettingsTab = 'general' | 'recording' | 'Transcriptionmodels' | 'summaryModels';

export default function SettingsPage() {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<SettingsTab>('general');
  const [transcriptModelConfig, setTranscriptModelConfig] = useState<TranscriptModelProps>({
    provider: 'localWhisper',
    model: 'large-v3',
    apiKey: null,
    diarization: 0
  });
  const [selectedLanguage, setSelectedLanguage] = useState<string>('auto');

  const tabs = [
    { id: 'general' as const, label: 'General', icon: <Settings2 className="w-4 h-4" /> },
    { id: 'recording' as const, label: 'Recordings', icon: <Mic className="w-4 h-4" /> },
    { id: 'Transcriptionmodels' as const, label: 'Transcription', icon: <DatabaseIcon className="w-4 h-4" /> },
    { id: 'summaryModels' as const, label: 'Summary', icon: <SparkleIcon className="w-4 h-4" /> }
  ];

  // Load saved transcript configuration on mount
  useEffect(() => {
    const loadTranscriptConfig = async () => {
      try {
        let config: any;

        if (isTauri()) {
          // Desktop: Use Tauri command (proxies to backend)
          config = await platformInvoke('api_get_transcript_config');
        } else {
          // Web: Call backend API directly
          const response = await fetch(`${BACKEND_URL}/get-transcript-config`);
          if (response.ok) {
            config = await response.json();
          }
        }

        if (config) {
          console.log('Loaded saved transcript config:', config);
          setTranscriptModelConfig({
            provider: config.provider || 'localWhisper',
            model: config.model || 'large-v3',
            apiKey: config.apiKey || null,
            diarization: config.diarization || 0
          });
        }
      } catch (error) {
        console.error('Failed to load transcript config:', error);
      }
    };
    loadTranscriptConfig();
  }, []);

  // Load saved language preference on mount
  useEffect(() => {
    const loadLanguagePreference = async () => {
      try {
        const language = await recordingAdapter.getLanguagePreference();
        setSelectedLanguage(language);
        console.log('Loaded saved language preference:', language);
      } catch (error) {
        console.error('Failed to load language preference:', error);
        setSelectedLanguage('auto'); // Default to auto-detect
      }
    };
    loadLanguagePreference();
  }, []);

  // Handle configuration save
  const handleSaveConfig = async (config: TranscriptModelProps) => {
    try {
      console.log('[SettingsPage] Saving transcript config:', config);

      if (isTauri()) {
        // Desktop: Use Tauri command (proxies to backend)
        await platformInvoke('api_save_transcript_config', {
          provider: config.provider,
          model: config.model,
          apiKey: config.apiKey,
          diarization: config.diarization || 0
        });
      } else {
        // Web: Call backend API directly
        const response = await fetch(`${BACKEND_URL}/save-transcript-config`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            provider: config.provider,
            model: config.model,
            apiKey: config.apiKey,
            diarization: config.diarization || 0
          })
        });

        if (!response.ok) {
          throw new Error('Failed to save transcript config');
        }
      }

      console.log('[SettingsPage] ✅ Successfully saved transcript config');
    } catch (error) {
      console.error('[SettingsPage] ❌ Failed to save transcript config:', error);
    }
  };

  return (
    <div className="h-screen bg-gray-50 flex flex-col">
      {/* Fixed Header */}
      <div className="sticky top-0 z-10 bg-gray-50 border-b border-gray-200">
        <div className="max-w-6xl mx-auto px-8 py-6">
          <div className="flex items-center gap-4">
            <button
              onClick={() => router.back()}
              className="flex items-center gap-2 text-gray-600 hover:text-gray-900 transition-colors"
            >
              <ArrowLeft className="w-5 h-5" />
              <span>Back</span>
            </button>
            <h1 className="text-3xl font-bold">Settings</h1>
          </div>
        </div>
      </div>

      {/* Scrollable Content */}
      <div className="flex-1 overflow-y-auto">
        <div className="max-w-6xl mx-auto p-8 pt-6">
          {/* Tabs */}
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
            <div className="flex border-b border-gray-200 overflow-x-auto">
              {tabs.map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`flex items-center gap-2 px-6 py-4 text-sm font-medium transition-colors whitespace-nowrap ${activeTab === tab.id
                      ? 'border-b-2 border-blue-600 text-blue-600 bg-blue-50'
                      : 'text-gray-600 hover:text-gray-900 hover:bg-gray-50'
                    }`}
                >
                  {tab.icon}
                  {tab.label}
                </button>
              ))}
            </div>

            {/* Tab Content */}
            <div className="p-6">
              {activeTab === 'general' && <PreferenceSettings />}
              {activeTab === 'recording' && <RecordingSettings />}
              {activeTab === 'Transcriptionmodels' && (
                <div className="space-y-6">
                  <div>
                    <h3 className="text-lg font-semibold mb-4">Transcription Language</h3>
                    <LanguageSelection
                      selectedLanguage={selectedLanguage}
                      onLanguageChange={setSelectedLanguage}
                      provider={transcriptModelConfig.provider}
                    />
                  </div>

                  <div className="border-t pt-6">
                    <h3 className="text-lg font-semibold mb-4">Transcription Model</h3>
                    <TranscriptSettings
                      transcriptModelConfig={transcriptModelConfig}
                      setTranscriptModelConfig={setTranscriptModelConfig}
                      // onSave={handleSaveConfig}
                    />
                  </div>
                </div>
              )}
              {activeTab === 'summaryModels' && <SummaryModelSettings />}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
