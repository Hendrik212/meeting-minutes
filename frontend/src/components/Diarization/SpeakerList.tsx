import { useState, useEffect } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Edit2, Check, X } from 'lucide-react';
import { toast } from 'sonner';

interface Speaker {
  id: string;
  speaker_label: string;
  custom_name?: string;
  created_at: string;
}

interface SpeakerListProps {
  meetingId: string;
  onSpeakerUpdate?: () => void;
}

const SPEAKER_COLORS = [
  { bg: 'bg-blue-100', text: 'text-blue-800', border: 'border-blue-300' },
  { bg: 'bg-green-100', text: 'text-green-800', border: 'border-green-300' },
  { bg: 'bg-purple-100', text: 'text-purple-800', border: 'border-purple-300' },
  { bg: 'bg-orange-100', text: 'text-orange-800', border: 'border-orange-300' },
  { bg: 'bg-pink-100', text: 'text-pink-800', border: 'border-pink-300' },
  { bg: 'bg-indigo-100', text: 'text-indigo-800', border: 'border-indigo-300' },
  { bg: 'bg-yellow-100', text: 'text-yellow-800', border: 'border-yellow-300' },
  { bg: 'bg-red-100', text: 'text-red-800', border: 'border-red-300' },
];

export function SpeakerList({ meetingId, onSpeakerUpdate }: SpeakerListProps) {
  const [speakers, setSpeakers] = useState<Speaker[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingSpeaker, setEditingSpeaker] = useState<string | null>(null);
  const [editName, setEditName] = useState('');

  useEffect(() => {
    loadSpeakers();
  }, [meetingId]);

  const loadSpeakers = async () => {
    try {
      setLoading(true);
      const data = await invoke<Speaker[]>('get_speakers', { meetingId });
      setSpeakers(data);
    } catch (error) {
      console.error('Failed to load speakers:', error);
      // Don't show error toast if no speakers found (meeting not diarized yet)
      if (error !== 'Failed to get speakers: 404') {
        toast.error('Failed to load speakers');
      }
    } finally {
      setLoading(false);
    }
  };

  const startEdit = (speaker: Speaker) => {
    setEditingSpeaker(speaker.id);
    setEditName(speaker.custom_name || '');
  };

  const cancelEdit = () => {
    setEditingSpeaker(null);
    setEditName('');
  };

  const saveSpeakerName = async (speakerId: string) => {
    if (!editName.trim()) {
      toast.error('Speaker name cannot be empty');
      return;
    }

    try {
      await invoke('update_speaker_name', {
        speakerId,
        customName: editName.trim()
      });

      toast.success('Speaker name updated');
      setEditingSpeaker(null);
      loadSpeakers();
      onSpeakerUpdate?.();
    } catch (error) {
      console.error('Failed to update speaker name:', error);
      toast.error('Failed to update speaker name');
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent, speakerId: string) => {
    if (e.key === 'Enter') {
      saveSpeakerName(speakerId);
    } else if (e.key === 'Escape') {
      cancelEdit();
    }
  };

  if (loading) {
    return (
      <div className="space-y-2">
        <h3 className="text-lg font-semibold">Speakers</h3>
        <div className="text-sm text-muted-foreground">Loading speakers...</div>
      </div>
    );
  }

  if (speakers.length === 0) {
    return (
      <div className="space-y-2">
        <h3 className="text-lg font-semibold">Speakers</h3>
        <div className="text-sm text-muted-foreground">
          No speakers identified yet. Run speaker identification to see who spoke in this meeting.
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <h3 className="text-lg font-semibold">
        Speakers ({speakers.length})
      </h3>

      <div className="space-y-2">
        {speakers.map((speaker, index) => {
          const colorScheme = SPEAKER_COLORS[index % SPEAKER_COLORS.length];
          const isEditing = editingSpeaker === speaker.id;

          return (
            <div
              key={speaker.id}
              className={`p-3 rounded-lg border ${colorScheme.bg} ${colorScheme.border} ${colorScheme.text}`}
            >
              {isEditing ? (
                <div className="flex items-center gap-2">
                  <Input
                    type="text"
                    value={editName}
                    onChange={(e) => setEditName(e.target.value)}
                    onKeyDown={(e) => handleKeyPress(e, speaker.id)}
                    placeholder={speaker.speaker_label}
                    className="flex-1 bg-white"
                    autoFocus
                  />
                  <Button
                    size="sm"
                    onClick={() => saveSpeakerName(speaker.id)}
                    className="bg-green-600 hover:bg-green-700 text-white"
                  >
                    <Check className="h-4 w-4" />
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={cancelEdit}
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              ) : (
                <div className="flex justify-between items-center">
                  <span className="font-medium">
                    {speaker.custom_name || speaker.speaker_label}
                  </span>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => startEdit(speaker)}
                    className="hover:bg-white/50"
                  >
                    <Edit2 className="h-3 w-3 mr-1" />
                    Rename
                  </Button>
                </div>
              )}
            </div>
          );
        })}
      </div>

      <p className="text-xs text-muted-foreground mt-2">
        Click "Rename" to give speakers meaningful names like "John" or "Sarah"
      </p>
    </div>
  );
}
