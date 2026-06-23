export interface VoiceOption {
  id: string;
  name: string;
  gender: "male" | "female" | "unisex";
  vietnameseName?: string;
  genderLabel?: string;
}

export interface AccentOption {
  id: string;
  name: string;
  prompt: string;
}

export interface SpeedOption {
  id: string;
  name: string;
  prompt: string;
}

export interface VoiceEngine {
  id: "gemini" | "browser";
  name: string;
  description: string;
  voices: VoiceOption[];
  accents: AccentOption[];
  speeds: SpeedOption[];
}

export interface HistoryItem {
  id: string;
  text: string;
  engine: "gemini" | "browser";
  voiceName: string;
  accentLabel: string;
  speed: string;
  audioContent?: string; // base64 MP3 for Gemini
  browserVoiceURI?: string; // voice URI for browser
  createdAt: string;
}
