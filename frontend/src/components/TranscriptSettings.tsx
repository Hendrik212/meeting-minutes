import { useState, useEffect } from 'react';
import { isTauri, platformInvoke } from '@/lib/platform';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import { Input } from './ui/input';
import { Button } from './ui/button';
import { Label } from './ui/label';
import { Switch } from './ui/switch';
import { Eye, EyeOff, Lock, Unlock } from 'lucide-react';
import { ModelManager } from './WhisperModelManager';
import { ParakeetModelManager } from './ParakeetModelManager';


export interface TranscriptModelProps {
    provider: 'localWhisper' | 'parakeet' | 'deepgram' | 'elevenLabs' | 'groq' | 'openai';
    model: string;
    apiKey?: string | null;
    diarization?: number;
}

export interface TranscriptSettingsProps {
    transcriptModelConfig: TranscriptModelProps;
    setTranscriptModelConfig: (config: TranscriptModelProps) => void;
    onModelSelect?: () => void;
}

export function TranscriptSettings({ transcriptModelConfig, setTranscriptModelConfig, onModelSelect }: TranscriptSettingsProps) {
    const [apiKey, setApiKey] = useState<string | null>(transcriptModelConfig.apiKey || null);
    const [showApiKey, setShowApiKey] = useState<boolean>(false);
    const [isApiKeyLocked, setIsApiKeyLocked] = useState<boolean>(true);
    const [isLockButtonVibrating, setIsLockButtonVibrating] = useState<boolean>(false);
    const [selectedWhisperModel, setSelectedWhisperModel] = useState<string>(transcriptModelConfig.provider === 'localWhisper' ? transcriptModelConfig.model : 'small');
    const [selectedParakeetModel, setSelectedParakeetModel] = useState<string>(transcriptModelConfig.provider === 'parakeet' ? transcriptModelConfig.model : 'parakeet-tdt-0.6b-v3-int8');

    useEffect(() => {
        if (transcriptModelConfig.provider === 'localWhisper' || transcriptModelConfig.provider === 'parakeet') {
            setApiKey(null);
        }
    }, [transcriptModelConfig.provider]);

    const fetchApiKey = async (provider: string) => {
        if (!isTauri()) {
            // API key fetching only available in Tauri
            setApiKey(null);
            return;
        }

        try {
            const data = await platformInvoke<string>('api_get_transcript_api_key', { provider });
            setApiKey(data || '');
        } catch (err) {
            console.error('Error fetching API key:', err);
            setApiKey(null);
        }
    };
    const modelOptions = {
        localWhisper: [selectedWhisperModel],
        parakeet: [selectedParakeetModel],
        deepgram: ['nova-2-phonecall'],
        elevenLabs: ['eleven_multilingual_v2'],
        groq: ['llama-3.3-70b-versatile'],
        openai: ['gpt-4o'],
    };
    const requiresApiKey = transcriptModelConfig.provider === 'deepgram' || transcriptModelConfig.provider === 'elevenLabs' || transcriptModelConfig.provider === 'openai' || transcriptModelConfig.provider === 'groq';

    const handleInputClick = () => {
        if (isApiKeyLocked) {
            setIsLockButtonVibrating(true);
            setTimeout(() => setIsLockButtonVibrating(false), 500);
        }
    };

    const handleWhisperModelSelect = (modelName: string) => {
        setSelectedWhisperModel(modelName);
        if (transcriptModelConfig.provider === 'localWhisper') {
            setTranscriptModelConfig({
                ...transcriptModelConfig,
                model: modelName
            });
            // Close modal after selection
            if (onModelSelect) {
                onModelSelect();
            }
        }
    };

    const handleParakeetModelSelect = (modelName: string) => {
        setSelectedParakeetModel(modelName);
        if (transcriptModelConfig.provider === 'parakeet') {
            setTranscriptModelConfig({
                ...transcriptModelConfig,
                model: modelName
            });
            // Close modal after selection
            if (onModelSelect) {
                onModelSelect();
            }
        }
    };

    return (
        <div className='max-h-[calc(100vh-200px)]'>
            <div>
                {/* <div className="flex justify-between items-center mb-4">
                    <h3 className="text-lg font-semibold text-gray-900">Transcript Settings</h3>
                </div> */}
                <div className="space-y-4 pb-6">
                    <div>
                        <Label className="block text-sm font-medium text-gray-700 mb-1">
                            Transcript Model
                        </Label>
                        <div className="flex space-x-2 mx-1">
                            <Select
                                value={transcriptModelConfig.provider}
                                onValueChange={(value) => {
                                    const provider = value as TranscriptModelProps['provider'];
                                    const newModel = provider === 'localWhisper' ? selectedWhisperModel : modelOptions[provider][0];
                                    setTranscriptModelConfig({ ...transcriptModelConfig, provider, model: newModel });
                                    if (provider !== 'localWhisper') {
                                        fetchApiKey(provider);
                                    }
                                }}
                            >
                                <SelectTrigger className='focus:ring-1 focus:ring-blue-500 focus:border-blue-500'>
                                    <SelectValue placeholder="Select provider" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="parakeet">⚡ Parakeet (Recommended - Real-time / Accurate)</SelectItem>
                                    <SelectItem value="localWhisper">🏠 Local Whisper (High Accuracy)</SelectItem>
                                    {/* <SelectItem value="deepgram">☁️ Deepgram (Backup)</SelectItem>
                                    <SelectItem value="elevenLabs">☁️ ElevenLabs</SelectItem>
                                    <SelectItem value="groq">☁️ Groq</SelectItem>
                                    <SelectItem value="openai">☁️ OpenAI</SelectItem> */}
                                </SelectContent>
                            </Select>

                            {transcriptModelConfig.provider !== 'localWhisper' && transcriptModelConfig.provider !== 'parakeet' && (
                                <Select
                                    value={transcriptModelConfig.model}
                                    onValueChange={(value) => {
                                        const model = value as TranscriptModelProps['model'];
                                        setTranscriptModelConfig({ ...transcriptModelConfig, model });
                                    }}
                                >
                                    <SelectTrigger className='focus:ring-1 focus:ring-blue-500 focus:border-blue-500'>
                                        <SelectValue placeholder="Select model" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {modelOptions[transcriptModelConfig.provider].map((model) => (
                                            <SelectItem key={model} value={model}>{model}</SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            )}

                        </div>
                    </div>

                    {transcriptModelConfig.provider === 'localWhisper' && (
                        <div className="mt-6">
                            {isTauri() ? (
                                <ModelManager
                                    selectedModel={selectedWhisperModel}
                                    onModelSelect={handleWhisperModelSelect}
                                    autoSave={true}
                                />
                            ) : (
                                <div className="space-y-3">
                                    <Label className="block text-sm font-medium text-gray-700">
                                        Backend Whisper Model
                                    </Label>
                                    <Select
                                        value={selectedWhisperModel}
                                        onValueChange={(value) => {
                                            handleWhisperModelSelect(value);
                                        }}
                                    >
                                        <SelectTrigger className='focus:ring-1 focus:ring-blue-500 focus:border-blue-500'>
                                            <SelectValue placeholder="Select Whisper model" />
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="tiny">Tiny (fastest, lowest accuracy)</SelectItem>
                                            <SelectItem value="tiny.en">Tiny English</SelectItem>
                                            <SelectItem value="base">Base (fast, good accuracy)</SelectItem>
                                            <SelectItem value="base.en">Base English</SelectItem>
                                            <SelectItem value="small">Small (balanced)</SelectItem>
                                            <SelectItem value="small.en">Small English</SelectItem>
                                            <SelectItem value="medium">Medium (slow, high accuracy)</SelectItem>
                                            <SelectItem value="medium.en">Medium English</SelectItem>
                                            <SelectItem value="large-v1">Large v1 (very slow, highest accuracy)</SelectItem>
                                            <SelectItem value="large-v2">Large v2</SelectItem>
                                            <SelectItem value="large-v3">Large v3 (recommended)</SelectItem>
                                            <SelectItem value="large-v3-turbo">Large v3 Turbo (fast + accurate)</SelectItem>
                                        </SelectContent>
                                    </Select>
                                    <p className="text-xs text-gray-600">
                                        Model runs on backend server. Make sure the selected model is available on your backend.
                                    </p>
                                </div>
                            )}
                        </div>
                    )}

                    {transcriptModelConfig.provider === 'parakeet' && (
                        <div className="mt-6">
                            {isTauri() ? (
                                <ParakeetModelManager
                                    selectedModel={selectedParakeetModel}
                                    onModelSelect={handleParakeetModelSelect}
                                    autoSave={true}
                                />
                            ) : (
                                <div className="space-y-3">
                                    <Label className="block text-sm font-medium text-gray-700">
                                        Backend Parakeet Model
                                    </Label>
                                    <Select
                                        value={selectedParakeetModel}
                                        onValueChange={(value) => {
                                            handleParakeetModelSelect(value);
                                        }}
                                    >
                                        <SelectTrigger className='focus:ring-1 focus:ring-blue-500 focus:border-blue-500'>
                                            <SelectValue placeholder="Select Parakeet model" />
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="parakeet-tdt-0.6b-v3-int8">Parakeet TDT 0.6B v3 INT8 (recommended)</SelectItem>
                                            <SelectItem value="parakeet-tdt-1.1b-v3-int8">Parakeet TDT 1.1B v3 INT8</SelectItem>
                                        </SelectContent>
                                    </Select>
                                    <p className="text-xs text-gray-600">
                                        Model runs on backend server. Make sure the selected model is available on your backend.
                                    </p>
                                </div>
                            )}
                        </div>
                    )}

                    {/* Diarization Toggle - Only for Whisper */}
                    {transcriptModelConfig.provider === 'localWhisper' && (
                        <div className="mt-6 p-4 border rounded-lg bg-gray-50">
                            <div className="flex items-center justify-between">
                                <div className="flex-1">
                                    <Label className="text-sm font-medium text-gray-900">
                                        Speaker Diarization
                                    </Label>
                                    <p className="text-xs text-gray-600 mt-1">
                                        Automatically identify and label different speakers in the transcription. Requires stereo audio input.
                                    </p>
                                </div>
                                <Switch
                                    checked={transcriptModelConfig.diarization === 1}
                                    onCheckedChange={(checked) => {
                                        setTranscriptModelConfig({
                                            ...transcriptModelConfig,
                                            diarization: checked ? 1 : 0
                                        });
                                    }}
                                />
                            </div>
                            {transcriptModelConfig.diarization === 1 && (
                                <div className="mt-3 p-2 bg-blue-50 border border-blue-200 rounded text-blue-800">
                                    <p className="text-xs">
                                        <strong>Note:</strong> Diarization works best with stereo audio where each speaker is on a separate channel. Mono audio will not produce accurate speaker separation.
                                    </p>
                                </div>
                            )}
                        </div>
                    )}

                    {requiresApiKey && (
                        <div>
                            <Label className="block text-sm font-medium text-gray-700 mb-1">
                                API Key
                            </Label>
                            <div className="relative mx-1">
                                <Input
                                    type={showApiKey ? "text" : "password"}
                                    className={`pr-24 focus:ring-1 focus:ring-blue-500 focus:border-blue-500 ${isApiKeyLocked ? 'bg-gray-100 cursor-not-allowed' : ''
                                        }`}
                                    value={apiKey || ''}
                                    onChange={(e) => setApiKey(e.target.value)}
                                    disabled={isApiKeyLocked}
                                    onClick={handleInputClick}
                                    placeholder="Enter your API key"
                                />
                                {isApiKeyLocked && (
                                    <div
                                        onClick={handleInputClick}
                                        className="absolute inset-0 flex items-center justify-center bg-gray-100 bg-opacity-50 rounded-md cursor-not-allowed"
                                    />
                                )}
                                <div className="absolute inset-y-0 right-0 pr-1 flex items-center">
                                    <Button
                                        type="button"
                                        variant="ghost"
                                        size="icon"
                                        onClick={() => setIsApiKeyLocked(!isApiKeyLocked)}
                                        className={`transition-colors duration-200 ${isLockButtonVibrating ? 'animate-vibrate text-red-500' : ''
                                            }`}
                                        title={isApiKeyLocked ? "Unlock to edit" : "Lock to prevent editing"}
                                    >
                                        {isApiKeyLocked ? <Lock className="h-4 w-4" /> : <Unlock className="h-4 w-4" />}
                                    </Button>
                                    <Button
                                        type="button"
                                        variant="ghost"
                                        size="icon"
                                        onClick={() => setShowApiKey(!showApiKey)}
                                    >
                                        {showApiKey ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                                    </Button>
                                </div>
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    )
}








