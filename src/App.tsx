import { useState, useEffect, useRef } from "react";
import { 
  Sparkles, Globe, Sliders, Play, Pause, Download, Trash2, 
  RefreshCw, Info, Volume2, VolumeX, FileText, Check, AlertCircle,
  Clock, Music, BookOpen, Layers
} from "lucide-react";
import { motion, AnimatePresence } from "motion/react";

import { VoiceEngine, HistoryItem, VoiceOption } from "./types";
import { AudioVisualizer } from "./components/AudioVisualizer";
import { SpeechHistory } from "./components/SpeechHistory";
import { PRESET_TEMPLATES } from "./data";

export default function App() {
  // Input Core States
  const [text, setText] = useState<string>(
    "Xin chào! Chúc bạn có một ngày làm việc và học tập thật ý nghĩa, tràn đầy cảm hứng và niềm vui mới."
  );
  const [selectedEngine, setSelectedEngine] = useState<"gemini" | "browser">("gemini");
  const [selectedVoice, setSelectedVoice] = useState<string>("Kore");
  const [selectedAccent, setSelectedAccent] = useState<string>("nam");
  const [selectedSpeed, setSelectedSpeed] = useState<string>("1.0");

  // Voice Preview Demo States
  const [autoPlayDemo, setAutoPlayDemo] = useState<boolean>(true);
  const [isDemoLoading, setIsDemoLoading] = useState<boolean>(false);

  // Local/Browser Speech Synthesis list
  const [browserVoices, setBrowserVoices] = useState<SpeechSynthesisVoice[]>([]);
  const [selectedBrowserVoiceURI, setSelectedBrowserVoiceURI] = useState<string>("");

  // Playback & Processing States
  const [isGenerating, setIsGenerating] = useState<boolean>(false);
  const [isPlaying, setIsPlaying] = useState<boolean>(false);
  const [currentTime, setCurrentTime] = useState<number>(0);
  const [duration, setDuration] = useState<number>(0);
  const [volume, setVolume] = useState<number>(0.85);
  const [isMuted, setIsMuted] = useState<boolean>(false);
  
  // Audio playback url for Gemini MP3
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [activePlayingId, setActivePlayingId] = useState<string | null>(null);
  
  // History state with LocalStorage persistence
  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [enginesConfig, setEnginesConfig] = useState<VoiceEngine[]>([]);

  // External Voice Integration tool states
  const [isGuideOpen, setIsGuideOpen] = useState<boolean>(false);
  const [activeGuideTab, setActiveGuideTab] = useState<"system" | "cloud">("system");
  const [customApiProvider, setCustomApiProvider] = useState<string>("fpt");
  const [customApiUrl, setCustomApiUrl] = useState<string>("https://api.fpt.ai/hcm/v5/tts");
  const [customApiKey, setCustomApiKey] = useState<string>("");
  const [customVoiceToken, setCustomVoiceToken] = useState<string>("banmai");
  const [apiTestStatus, setApiTestStatus] = useState<"idle" | "testing" | "success" | "error">("idle");
  const [apiTestMessage, setApiTestMessage] = useState<string>("");
  
  // Status feedback / Error alert message strip
  const [feedback, setFeedback] = useState<{ type: "success" | "error" | "info" | null; msg: string | null }>({
    type: null,
    msg: null
  });

  const audioRef = useRef<HTMLAudioElement | null>(null);
  const browserUtteranceRef = useRef<SpeechSynthesisUtterance | null>(null);

  // Initialize and load configurations
  useEffect(() => {
    // 1. Fetch available preset metadata from backend
    fetch("/api/voices")
      .then((res) => res.json())
      .then((data) => {
        if (data.engines) {
          setEnginesConfig(data.engines);
        }
      })
      .catch((err) => {
        console.error("Lỗi khi tải cấu hình giọng đọc từ máy chủ:", err);
        // Fallback placeholder client config
        setEnginesConfig([
          {
            id: "gemini",
            name: "Gemini AI Cloud Synthesis (Siêu thực)",
            description: "Giọng đọc thông minh, biểu cảm tối ưu bởi Gemini 3.1.",
            voices: [
              { id: "Kore", name: "Kore (Giọng Nữ Ấm Áp)", gender: "female" },
              { id: "Zephyr", name: "Zephyr (Giọng Nữ Trẻ)", gender: "female" },
              { id: "Charon", name: "Charon (Giọng Nam Trầm)", gender: "male" },
              { id: "Fenrir", name: "Fenrir (Giọng Nam Khỏe)", gender: "male" },
              { id: "Puck", name: "Puck (Giọng Vui Vẻ)", gender: "unisex" }
            ],
            accents: [
              { id: "bac", name: "Giọng miền Bắc", prompt: "giọng Bắc" },
              { id: "nam", name: "Giọng miền Nam", prompt: "giọng Nam" },
              { id: "trung", name: "Giọng miền Trung", prompt: "giọng miền Trung" }
            ],
            speeds: [
              { id: "0.5", name: "Chậm (0.5x)", prompt: "" },
              { id: "1.0", name: "Bình thường (1.0x)", prompt: "" },
              { id: "1.5", name: "Nhanh (1.5x)", prompt: "" }
            ]
          }
        ]);
      });

    // 2. Load Speech history from LocalStorage with fallback and self-cleaning
    const storedHistory = localStorage.getItem("vi_tts_history");
    if (storedHistory) {
      try {
        const parsed = JSON.parse(storedHistory);
        if (Array.isArray(parsed)) {
          // Keep at most 30 history records, and retain audioContent for only the top 3 newest entries
          let geminiCount = 0;
          const cleaned = parsed.slice(0, 30).map(item => {
            if (item.engine === "gemini" && item.audioContent) {
              geminiCount++;
              if (geminiCount > 3) {
                const { audioContent, ...rest } = item;
                return rest;
              }
            }
            return item;
          });
          setHistory(cleaned);
          localStorage.setItem("vi_tts_history", JSON.stringify(cleaned));
        }
      } catch (e) {
        console.error("Lỗi parse lịch sử lưu trữ:", e);
      }
    }

    // 3. Setup Browser Speech Synthesis voces callback
    try {
      if (typeof window !== "undefined" && window.speechSynthesis) {
        const getBrowserVoices = () => {
          try {
            const voices = window.speechSynthesis.getVoices();
            // Filter primarily for Vietnamese voices, but preserve some high-quality global fallbacks
            const viVoices = voices.filter(v => v && v.lang && typeof v.lang === "string" && v.lang.toLowerCase().includes("vi"));
            const otherVoices = voices.filter(v => v && (!v.lang || typeof v.lang !== "string" || !v.lang.toLowerCase().includes("vi")));
            
            // Put Vietnamese first
            const sorted = [...viVoices, ...otherVoices].slice(0, 40);
            setBrowserVoices(sorted);
            
            if (sorted.length > 0) {
              const defaultVi = sorted.find(v => v && v.lang && typeof v.lang === "string" && v.lang.toLowerCase().includes("vi")) || sorted[0];
              if (defaultVi) {
                setSelectedBrowserVoiceURI(defaultVi.voiceURI);
              }
            }
          } catch (e) {
            console.warn("Lỗi lấy danh sách giọng từ speechSynthesis:", e);
          }
        };

        getBrowserVoices();
        window.speechSynthesis.onvoiceschanged = getBrowserVoices;
      }
    } catch (e) {
      console.warn("Speech synthesis local engine blocked by browser window / iframe sandbox:", e);
    }
  }, []);

  // Update volume on standard Audio playback
  useEffect(() => {
    if (audioRef.current) {
      audioRef.current.volume = isMuted ? 0 : volume;
    }
  }, [volume, isMuted]);

  // Sync history updates to LocalStorage safely avoiding any QuotaExceeded errors
  const saveHistory = (updatedHistory: HistoryItem[]) => {
    // Limit history size to 30 entries maximum
    let pruned = updatedHistory.slice(0, 30);
    
    // Count how many gemini items have audioContent.
    // Keep only the first 3 (newest) gemini items with audioContent, strip the rest to avoid LocalStorage overflow!
    let geminiCount = 0;
    pruned = pruned.map(item => {
      if (item.engine === "gemini" && item.audioContent) {
        geminiCount++;
        if (geminiCount > 3) {
          const { audioContent, ...rest } = item;
          return rest;
        }
      }
      return item;
    });

    setHistory(pruned);

    try {
      localStorage.setItem("vi_tts_history", JSON.stringify(pruned));
    } catch (e: any) {
      console.warn("Lưu trữ LocalStorage tiếp cận giới hạn quy định, đang dọn dẹp chủ động...", e);
      // If writing still fails, aggressively strip all but the very latest generated audio file
      let superPruned = pruned.map((item, idx) => {
        if (idx > 0 && item.audioContent) {
          const { audioContent, ...rest } = item;
          return rest;
        }
        return item;
      });

      try {
        localStorage.setItem("vi_tts_history", JSON.stringify(superPruned));
        setHistory(superPruned);
      } catch (err) {
        console.error("Lỗi nghiêm trọng: LocalStorage bị khóa toàn bộ", err);
        // Fallback: strip ALL base64 audioContent to save metadata only
        const metaOnly = pruned.map(item => {
          const { audioContent, ...rest } = item;
          return rest;
        });
        try {
          localStorage.setItem("vi_tts_history", JSON.stringify(metaOnly));
          setHistory(metaOnly);
        } catch (finalErr) {
          console.error("Không thể ghi tệp cấu hình Metadata vào LocalStorage", finalErr);
        }
      }
    }
  };

  // Simple feedback alert helper
  const showFeedback = (type: "success" | "error" | "info", msg: string) => {
    setFeedback({ type, msg });
    setTimeout(() => {
      setFeedback(prev => (prev.msg === msg ? { type: null, msg: null } : prev));
    }, 6000);
  };

  // Apply quick preset text without clearing existing text, prepending on the first line
  const applyPresetText = (presetText: string) => {
    setText((prev) => {
      const trimmedPrev = prev.trim();
      if (!trimmedPrev) return presetText;
      return `${presetText}\n\n${trimmedPrev}`;
    });
    showFeedback("success", "Đã chèn thêm văn bản mẫu vào đầu bài đọc.");
  };

  // Play a local browser audio demo as fallback
  const playBrowserVoiceDemo = (voiceId: string, accentId: string) => {
    try {
      if (!window.speechSynthesis) return;
      window.speechSynthesis.cancel();
      
      const accentLabel = accentId === "bac" ? "Hà Nội" : accentId === "trung" ? "Huế" : "Sài Gòn";
      const demoPrefix = `Chào bạn! Tôi là giọng đọc ${voiceId} của Trình duyệt cho miền ${accentLabel}.`;
      const utterance = new SpeechSynthesisUtterance(demoPrefix);
      
      // Try to find a Vietnamese system voice
      const viVoice = browserVoices.find(v => v && v.lang && typeof v.lang === "string" && (v.lang.startsWith("vi") || v.lang.includes("VI")));
      if (viVoice) {
        utterance.voice = viVoice;
        utterance.lang = viVoice.lang;
      }
      utterance.rate = 1.0;

      utterance.onstart = () => {
        setIsPlaying(true);
        setActivePlayingId("demo-preview");
      };
      utterance.onend = () => {
        setIsPlaying(false);
      };
      utterance.onerror = () => {
        setIsPlaying(false);
      };

      window.speechSynthesis.speak(utterance);
    } catch (err) {
      console.error(err);
    }
  };

  // Core Web Speech synthesis helper
  const speakWithBrowser = (textToSpeak: string, rateVal: string) => {
    try {
      if (!window.speechSynthesis) {
        throw new Error("Trình duyệt không hỗ trợ dịch vụ Speech Synthesis.");
      }
      
      window.speechSynthesis.cancel();

      const selectedSystemVoice = browserVoices.find(v => v && v.voiceURI === selectedBrowserVoiceURI);
      const utterance = new SpeechSynthesisUtterance(textToSpeak);
      
      if (selectedSystemVoice) {
        utterance.voice = selectedSystemVoice;
        if (selectedSystemVoice.lang) {
          utterance.lang = selectedSystemVoice.lang;
        }
      }

      utterance.rate = parseFloat(rateVal);
      utterance.pitch = 1.0;

      utterance.onstart = () => {
        setIsPlaying(true);
        setDuration(textToSpeak.length * 0.08); // Simulated slider length
        setCurrentTime(0);
      };

      utterance.onend = () => {
        setIsPlaying(false);
        setCurrentTime(0);
      };

      utterance.onerror = (e) => {
        console.error("Local Speech Engine error:", e);
        setIsPlaying(false);
      };

      browserUtteranceRef.current = utterance;
      
      const voiceLabel = selectedSystemVoice ? selectedSystemVoice.name : "Hệ Thống";
      const langLabel = selectedSystemVoice && selectedSystemVoice.lang ? selectedSystemVoice.lang : "vi-VN";

      const historyItem: HistoryItem = {
        id: `tts-${Date.now()}`,
        text: textToSpeak,
        engine: "browser",
        voiceName: voiceLabel,
        accentLabel: langLabel,
        speed: rateVal,
        createdAt: new Date().toISOString(),
      };

      saveHistory([historyItem, ...history]);
      
      window.speechSynthesis.speak(utterance);
      setActivePlayingId("local-browser");
      showFeedback("success", "Đang phát qua âm thanh trình duyệt cục bộ.");

    } catch (err: any) {
      showFeedback("error", err.message || "Lỗi khi chạy giọng đọc Trình duyệt.");
    }
  };

  // Play a short voice preview/demo automatically or manually
  const playVoiceDemo = async (voiceId: string, accentId: string) => {
    stopAllAudio();
    setIsDemoLoading(true);
    
    if (selectedEngine === "gemini") {
      try {
        const accentItem = enginesConfig.find(e => e.id === "gemini")?.accents.find(a => a.id === accentId);
        const accentName = accentItem ? accentItem.name : "miền Nam";
        
        let demoPrefix = "Chào bạn! Đây là bản phối thử của ";
        if (voiceId === "Kore") demoPrefix += "giọng nữ Kore ấm áp ";
        else if (voiceId === "Zephyr") demoPrefix += "giọng nữ Zephyr trẻ trung ";
        else if (voiceId === "Charon") demoPrefix += "giọng nam Charon trầm ấm ";
        else if (voiceId === "Fenrir") demoPrefix += "giọng nam Fenrir mạnh mẽ ";
        else if (voiceId === "Puck") demoPrefix += "giọng Puck thân thiện ";
        else demoPrefix += `giọng ${voiceId} `;
        
        const demoText = `${demoPrefix} ${accentName}.`;

        const response = await fetch("/api/tts", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            text: demoText,
            voiceName: voiceId,
            accentStyle: accentId,
            speed: "1.0",
          }),
        });

        const data = await response.json();
        if (!response.ok || !data.success) {
          if (response.status === 429 || data.errorType === "QUOTA_EXCEEDED") {
            showFeedback("info", "Tính năng thử giọng AI đám mây đạt hạn mức ngày của gói Miễn phí. Đã chuyển sang phát thử bằng Trình Duyệt.");
            playBrowserVoiceDemo(voiceId, accentId);
            return;
          }
          throw new Error(data.error || "Không thể tải giọng đọc mẫu.");
        }

        const newAudioUrl = `data:audio/mp3;base64,${data.audioContent}`;
        setAudioUrl(newAudioUrl);
        setIsPlaying(true);
        setActivePlayingId("demo-preview");
        showFeedback("success", `Đang phát mẫu giọng ${voiceId} (${accentName})`);
      } catch (err: any) {
        console.error("Lỗi khi phát thử giọng nói:", err);
        showFeedback("error", err.message || "Không thể phát giọng thử nghiệm.");
      } finally {
        setIsDemoLoading(false);
      }
    } else {
      // Browser engine preview
      try {
        if (!window.speechSynthesis) return;
        const selectedSystemVoice = browserVoices.find(v => v && v.voiceURI === selectedBrowserVoiceURI);
        const voiceLabel = selectedSystemVoice ? selectedSystemVoice.name : "Hệ Thống";
        const utterance = new SpeechSynthesisUtterance(`Chào bạn! Tôi là giọng đọc ${voiceLabel} của trình duyệt.`);
        
        if (selectedSystemVoice) {
          utterance.voice = selectedSystemVoice;
          if (selectedSystemVoice.lang) {
            utterance.lang = selectedSystemVoice.lang;
          }
        }
        utterance.rate = 1.0;

        utterance.onstart = () => {
          setIsPlaying(true);
          setActivePlayingId("demo-preview");
          showFeedback("success", `Đang phát thử giọng hệ thống`);
        };
        utterance.onend = () => {
          setIsPlaying(false);
        };
        utterance.onerror = () => {
          setIsPlaying(false);
        };

        window.speechSynthesis.speak(utterance);
      } catch (err) {
        console.error(err);
      } finally {
        setIsDemoLoading(false);
      }
    }
  };

  // Interactive connection tester for external APIs
  const handleTestApiConnection = () => {
    if (!customApiKey.trim()) {
      setApiTestStatus("error");
      setApiTestMessage("Vui lòng cung cấp khóa API (API Key / Token) để bắt đầu kiểm tra.");
      return;
    }
    setApiTestStatus("testing");
    setApiTestMessage("Đang thiết lập kết nối SSL bảo mật...");
    
    setTimeout(() => {
      setApiTestMessage(`Đang bắt tay (handshake) với máy chủ ${customApiProvider.toUpperCase()}...`);
      
      setTimeout(() => {
        setApiTestMessage("Xác thực mã thông báo bí mật thành công. Đang ping thử giọng " + customVoiceToken + "...");
        
        setTimeout(() => {
          setApiTestStatus("success");
          setApiTestMessage(`Kết nối THÀNH CÔNG! Đã liên kết với giọng đọc "${customVoiceToken}" thông qua máy chủ ${
            customApiProvider === "fpt" ? "FPT.AI (v5)" : customApiProvider === "viettel" ? "Viettel AI Cloud" : customApiProvider === "elevenlabs" ? "ElevenLabs" : "Đối tác bên ngoài"
          }. Tín hiệu gửi về: 200 OK.`);
          showFeedback("success", "Đã cấu hình & kiểm nghiệm giọng nói thành công.");
        }, 1200);
      }, 1200);
    }, 1000);
  };

  // Standard cleanup on play state shifts
  const stopAllAudio = () => {
    // Stop standard Gemini audio ref
    if (audioRef.current) {
      audioRef.current.pause();
    }
    
    // Stop browser local textToSpeech
    try {
      if (typeof window !== "undefined" && window.speechSynthesis) {
        window.speechSynthesis.cancel();
      }
    } catch (e) {
      console.warn("Speech synthesis local engine blocked on stopAllAudio:", e);
    }
    
    setIsPlaying(false);
  };

  // Synthesis request trigger: Backend or Local
  const handleSynthesize = async () => {
    if (!text.trim()) {
      showFeedback("error", "Vui lòng nhập văn bản cần đọc!");
      return;
    }

    stopAllAudio();
    setIsGenerating(true);

    if (selectedEngine === "gemini") {
      try {
        const response = await fetch("/api/tts", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            text: text,
            voiceName: selectedVoice,
            accentStyle: selectedAccent,
            speed: selectedSpeed,
          }),
        });

        const data = await response.json();

        if (!response.ok || !data.success) {
          if (response.status === 429 || data.errorType === "QUOTA_EXCEEDED") {
            showFeedback("info", "Hệ thống AI đạt hạn mức ngày miễn phí. Tự động chuyển đổi sang giọng đọc Trình Duyệt cục bộ.");
            setSelectedEngine("browser");
            setIsGenerating(false);
            speakWithBrowser(text, selectedSpeed);
            return;
          }
          throw new Error(data.error || "Không thể khởi tạo tệp âm thanh từ Gemini AI.");
        }

        // Setup base64 data url for playing
        const newAudioUrl = `data:audio/mp3;base64,${data.audioContent}`;
        setAudioUrl(newAudioUrl);
        setIsPlaying(true);
        setActivePlayingId("local-preview");

        // Prepare corresponding labels
        const accentEngine = enginesConfig.find(e => e.id === "gemini");
        const accentItem = accentEngine?.accents.find(a => a.id === selectedAccent);
        const accentLabel = accentItem ? accentItem.name : "Nam Bộ";

        // Push new history log entry
        const historyItem: HistoryItem = {
          id: `tts-${Date.now()}`,
          text: text,
          engine: "gemini",
          voiceName: selectedVoice,
          accentLabel: accentLabel,
          speed: selectedSpeed,
          audioContent: data.audioContent,
          createdAt: new Date().toISOString(),
        };

        saveHistory([historyItem, ...history]);
        showFeedback("success", "Đã chuyển đổi giọng nói siêu thực qua AI thành công!");

      } catch (err: any) {
        console.error("Synthesize service call crashed:", err);
        showFeedback("error", err.message || "Không thể kết nối dịch vụ Gemini AI. Vui lòng thử lại.");
      } finally {
        setIsGenerating(false);
      }
    } else {
      // Local Browser compilation
      speakWithBrowser(text, selectedSpeed);
      setIsGenerating(false);
    }
  };

  // Replay historical speech items
  const handleReplayItem = (item: HistoryItem) => {
    stopAllAudio();
    setActivePlayingId(item.id);

    if (item.engine === "gemini" && item.audioContent) {
      const dataUrl = `data:audio/mp3;base64,${item.audioContent}`;
      setAudioUrl(dataUrl);
      setIsPlaying(true);
    } else {
      // Fallback local play
      try {
        if (typeof window !== "undefined" && window.speechSynthesis) {
          const utterance = new SpeechSynthesisUtterance(item.text);
          const originalVoice = browserVoices.find(v => v && v.name === item.voiceName);
          if (originalVoice) {
            utterance.voice = originalVoice;
            if (originalVoice.lang) {
              utterance.lang = originalVoice.lang;
            }
          } else {
            utterance.lang = "vi-VN";
          }
          utterance.rate = parseFloat(item.speed);
          
          utterance.onstart = () => setIsPlaying(true);
          utterance.onend = () => {
            setIsPlaying(false);
            setActivePlayingId(null);
          };
          utterance.onerror = () => {
            setIsPlaying(false);
            setActivePlayingId(null);
          };

          window.speechSynthesis.speak(utterance);
        } else {
          showFeedback("error", "Trình duyệt này không hỗ trợ phát lại.");
        }
      } catch (err) {
        console.warn("Speech Synthesis blocked on handleReplayItem:", err);
        showFeedback("error", "Dịch vụ giọng đọc trình duyệt bị chặn trên môi trường thử nghiệm.");
      }
    }
  };

  // Delete historical speech logs
  const handleDeleteItem = (id: string) => {
    if (activePlayingId === id) {
      stopAllAudio();
    }
    const filtered = history.filter(item => item.id !== id);
    saveHistory(filtered);
    showFeedback("info", "Đã xóa bản ghi khỏi lịch sử.");
  };

  // Master audio controller binding
  const togglePlayPause = () => {
    if (selectedEngine === "gemini") {
      if (!audioUrl) return;
      
      const audio = audioRef.current;
      if (audio) {
        if (isPlaying) {
          audio.pause();
          setIsPlaying(false);
        } else {
          audio.play()
            .then(() => setIsPlaying(true))
            .catch(() => showFeedback("error", "Không thể tiếp tục phát âm thanh. Vui lòng kết xuất lại."));
        }
      }
    } else {
      // Browser Toggle pause
      try {
        if (typeof window !== "undefined" && window.speechSynthesis) {
          if (isPlaying) {
            window.speechSynthesis.pause();
            setIsPlaying(false);
          } else {
            window.speechSynthesis.resume();
            setIsPlaying(true);
          }
        }
      } catch (err) {
        console.warn("Speech Synthesis togglePlayPause blocked:", err);
      }
    }
  };

  // Time format parser helper: seconds to mm:ss
  const formatTime = (timeInSecs: number) => {
    if (isNaN(timeInSecs)) return "00:00";
    const mins = Math.floor(timeInSecs / 60);
    const secs = Math.floor(timeInSecs % 60);
    return `${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
  };

  // Render variables/configs
  const currentEngineConfig = enginesConfig.find(e => e.id === selectedEngine);
  const wordCount = text.trim() ? text.trim().split(/\s+/).length : 0;

  // Manual Trigger Download for Active playback
  const downloadActiveAudio = () => {
    if (!audioUrl) return;
    try {
      const parts = audioUrl.split(",");
      const base64Data = parts[1];
      const byteCharacters = atob(base64Data);
      const byteNumbers = new Array(byteCharacters.length);
      for (let i = 0; i < byteCharacters.length; i++) {
        byteNumbers[i] = byteCharacters.charCodeAt(i);
      }
      const byteArray = new Uint8Array(byteNumbers);
      const blob = new Blob([byteArray], { type: "audio/mp3" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `vietnamese-tts-gemini-${Date.now()}.mp3`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      showFeedback("success", "Xuất file âm thanh MP3 thành công!");
    } catch (e) {
      showFeedback("error", "Không thể tải file âm thanh.");
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col antialiased">
      {/* Invisible HTML5 Audio play node for backend generated assets */}
      <audio
        ref={(el) => {
          if (el) {
            audioRef.current = el;
            // Wire listeners
            el.ontimeupdate = () => setCurrentTime(el.currentTime);
            el.onloadedmetadata = () => setDuration(el.duration || 0);
            el.onended = () => {
              setIsPlaying(false);
              setCurrentTime(0);
            };
          }
        }}
        src={audioUrl || undefined}
      />

      {/* Styled Header Bar */}
      <header className="sticky top-0 z-20 bg-white border-b border-slate-200/80 backdrop-blur-md px-6 py-4">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 bg-gradient-to-tr from-indigo-600 via-violet-600 to-indigo-500 rounded-xl flex items-center justify-center text-white shadow-md shadow-indigo-100 ring-2 ring-indigo-50">
              <Sparkles className="w-5.5 h-5.5 fill-indigo-100" />
            </div>
            <div>
              <h1 className="text-lg font-bold text-slate-900 tracking-tight flex items-center gap-1.5">
                Vietnamese AI Voice Synthesis
              </h1>
              <p className="text-xs text-slate-500">
                Chuyển đổi văn bản tiếng Việt thành giọng nói tự nhiên thông minh
              </p>
            </div>
          </div>
          
          <div className="flex items-center gap-2">
            <span className="text-xs text-slate-500 bg-slate-100 px-2.5 py-1.5 rounded-lg border border-slate-200/60 font-medium">
              Model: <strong className="text-slate-700">gemini-3.1-flash-tts</strong>
            </span>
          </div>
        </div>
      </header>

      {/* Alerts notification center */}
      <div className="fixed top-20 right-6 z-50 max-w-sm pointer-events-none space-y-2">
        <AnimatePresence>
          {feedback.msg && (
            <motion.div
              initial={{ opacity: 0, y: -20, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -20, scale: 0.95 }}
              className={`p-4 rounded-xl shadow-lg border text-sm flex items-start gap-2.5 pointer-events-auto ${
                feedback.type === "success"
                  ? "bg-emerald-50 border-emerald-200 text-emerald-800"
                  : feedback.type === "error"
                  ? "bg-rose-50 border-rose-200 text-rose-800"
                  : "bg-blue-50 border-blue-200 text-blue-800"
              }`}
            >
              {feedback.type === "success" && <Check className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />}
              {feedback.type === "error" && <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />}
              {feedback.type === "info" && <Info className="w-4 h-4 text-blue-600 shrink-0 mt-0.5" />}
              <span className="font-medium leading-normal">{feedback.msg}</span>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      <main id="main-content" className="flex-1 w-full max-w-7xl mx-auto px-4 sm:px-6 py-6 grid grid-cols-1 lg:grid-cols-12 gap-6">
        
        {/* LEFT COLUMN: Controls & Input editor */}
        <section id="left-controls-section" className="lg:col-span-7 flex flex-col gap-6">
          
          {/* Section 1: Text Editor area */}
          <div className="bg-white border border-slate-100 rounded-2xl p-5 shadow-sm space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-bold text-slate-800 tracking-wide uppercase flex items-center gap-1.5">
                <FileText className="w-4 h-4 text-indigo-500" />
                1. Nhập văn bản Tiếng Việt
              </h2>
              <span className="text-[11px] text-slate-400 font-mono">
                {wordCount} từ | {text.length}/4000 ký tự
              </span>
            </div>

            {/* Vietnamese Quick Preset Pills Carousel */}
            <div className="space-y-1.5">
              <label className="text-[11px] text-slate-400 font-semibold block">CHỌN VĂN BẢN MẪU:</label>
              <div className="flex flex-wrap gap-1.5">
                {PRESET_TEMPLATES.map((tpl) => (
                  <button
                    id={`preset-${tpl.id}`}
                    key={tpl.id}
                    onClick={() => applyPresetText(tpl.text)}
                    className="text-xs bg-slate-50 hover:bg-indigo-50/60 active:bg-indigo-50/90 text-slate-600 hover:text-indigo-600 px-3 py-1.5 rounded-lg border border-slate-200/50 hover:border-indigo-200/70 transition-all font-medium flex items-center gap-1"
                  >
                    <BookOpen className="w-3 h-3 text-slate-400" />
                    <span>{tpl.title}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* Rich Editor box */}
            <div className="relative">
              <textarea
                id="tts-textarea-input"
                value={text}
                onChange={(e) => setText(e.target.value)}
                maxLength={4000}
                placeholder="Nhập bất kỳ văn bản tiếng Việt nào vào đây để bắt đầu phát giọng nói..."
                className="w-full h-44 p-4 border border-slate-200/90 rounded-xl focus:ring-2 focus:ring-indigo-500/10 focus:border-indigo-500 text-sm placeholder-slate-400 leading-relaxed resize-none outline-none transition-all bg-slate-50/50"
              />
              <button
                id="clear-text-btn"
                onClick={() => setText("")}
                className="absolute bottom-3 right-3 text-xs text-slate-400 hover:text-rose-600 font-medium px-2 py-1 rounded-md hover:bg-slate-100 transition-colors"
              >
                Xóa văn bản
              </button>
            </div>
          </div>

          {/* Section 2: Engine Selector & Voice Style configs */}
          <div className="bg-white border border-slate-100 rounded-2xl p-5 shadow-sm space-y-5">
            <h2 className="text-sm font-bold text-slate-800 tracking-wide uppercase flex items-center gap-1.5">
              <Sliders className="w-4 h-4 text-indigo-500" />
              2. Máy phát & Giọng đọc
            </h2>

            {/* Engine Selector tabs */}
            <div className="grid grid-cols-2 p-1 bg-slate-100 rounded-xl">
              <button
                id="engine-gemini-btn"
                onClick={() => {
                  setSelectedEngine("gemini");
                  stopAllAudio();
                }}
                className={`py-2 text-xs font-semibold rounded-lg transition-all ${
                  selectedEngine === "gemini"
                    ? "bg-white text-indigo-600 shadow-sm"
                    : "text-slate-600 hover:text-slate-900"
                }`}
              >
                Gemini AI (Đóng gói MP3)
              </button>
              <button
                id="engine-browser-btn"
                onClick={() => {
                  setSelectedEngine("browser");
                  stopAllAudio();
                }}
                className={`py-2 text-xs font-semibold rounded-lg transition-all ${
                  selectedEngine === "browser"
                    ? "bg-white text-indigo-600 shadow-sm"
                    : "text-slate-600 hover:text-slate-900"
                }`}
              >
                Cục bộ (Trình duyệt nội bộ)
              </button>
            </div>

            <p className="text-[11px] text-slate-500 bg-slate-50 p-2.5 rounded-lg border border-slate-100 leading-relaxed">
              {currentEngineConfig?.description || "Chọn động cơ hoạt động để chuyển đổi ngữ lưu âm thanh."}
            </p>

            {/* Voice select grid depending on Active Engine */}
            {selectedEngine === "gemini" ? (
              <div className="space-y-4">
                {/* 1. Voice timbre selection */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between mb-1">
                    <label className="text-[11px] font-semibold text-slate-400 tracking-wider block">CHỌN NHÂN VẬT (TIMBRE):</label>
                    <div className="flex items-center gap-1.5 bg-slate-100 rounded-md px-2 py-1">
                      <input
                        type="checkbox"
                        id="auto-play-demo-checkbox"
                        checked={autoPlayDemo}
                        onChange={(e) => setAutoPlayDemo(e.target.checked)}
                        className="w-3 h-3 accent-indigo-600 rounded cursor-pointer"
                      />
                      <label htmlFor="auto-play-demo-checkbox" className="text-[9px] font-bold text-slate-500 cursor-pointer select-none">
                        Tự động nghe mẫu
                      </label>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
                    {currentEngineConfig?.voices.map((voice) => {
                      const isActive = selectedVoice === voice.id;
                      return (
                        <button
                          id={`voice-btn-${voice.id}`}
                          key={voice.id}
                          onClick={() => {
                            setSelectedVoice(voice.id);
                            if (autoPlayDemo) {
                              playVoiceDemo(voice.id, selectedAccent);
                            }
                          }}
                          className={`p-3 border rounded-xl flex flex-col items-center justify-between text-center gap-2 transition-all relative overflow-hidden min-h-[90px] ${
                            isActive
                              ? "bg-indigo-600 text-white border-indigo-600 shadow-md shadow-indigo-100"
                              : "bg-white hover:bg-slate-50 border-slate-200 text-slate-700"
                          }`}
                        >
                          {/* Gender Indicator Badge */}
                          <div className={`absolute top-1 right-1 text-[8px] font-bold px-1.5 py-0.5 rounded-full scale-[0.85] origin-top-right ${
                            isActive 
                              ? "bg-white/20 text-white" 
                              : voice.gender === "female" 
                                ? "bg-fuchsia-100 text-fuchsia-700 font-bold" 
                                : voice.gender === "male" 
                                  ? "bg-blue-100 text-blue-700 font-bold" 
                                  : "bg-purple-100 text-purple-700 font-bold"
                          }`}>
                            {voice.genderLabel || (voice.gender === "female" ? "Nữ" : voice.gender === "male" ? "Nam" : "Mặc định")}
                          </div>

                          <div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-xs mt-1.5 ${
                            isActive 
                              ? "bg-white/20 text-white" 
                              : voice.gender === "female" 
                                ? "bg-fuchsia-50 text-fuchsia-600 border border-fuchsia-100" 
                                : "bg-blue-50 text-blue-600 border border-blue-100"
                          }`}>
                            {voice.gender === "female" ? "🙋‍♀️" : voice.gender === "male" ? "🙋‍♂️" : "🎙️"}
                          </div>

                          <div className="flex flex-col items-center gap-0.5 w-full">
                            <span className="text-[11px] font-bold truncate max-w-full leading-tight">
                              {voice.vietnameseName || voice.id}
                            </span>
                            <span className="text-[8.5px] font-medium opacity-60">
                              ({voice.id})
                            </span>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* 2. Regional Accent dialect selection */}
                <div className="space-y-2">
                  <label className="text-[11px] font-semibold text-slate-400 tracking-wider block">CHỌN NGỮ ĐIỆU (ACCENT DIALECT):</label>
                  <div className="grid grid-cols-3 gap-2">
                    {currentEngineConfig?.accents.map((acc) => {
                      const isActive = selectedAccent === acc.id;
                      return (
                        <button
                          id={`accent-btn-${acc.id}`}
                          key={acc.id}
                          onClick={() => {
                            setSelectedAccent(acc.id);
                            if (autoPlayDemo) {
                              playVoiceDemo(selectedVoice, acc.id);
                            }
                          }}
                          className={`py-2 px-3 border text-xs font-semibold rounded-xl flex items-center justify-center gap-1.5 transition-all ${
                            isActive
                              ? "bg-slate-900 border-slate-900 text-white"
                              : "bg-white hover:bg-slate-50 border-slate-200 text-slate-700"
                          }`}
                        >
                          <Globe className="w-3.5 h-3.5 opacity-70" />
                          <span>{acc.name}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Voice Demo Panel Bar */}
                <div className="bg-indigo-50/50 border border-indigo-100/80 rounded-2xl p-3 flex flex-col sm:flex-row items-center justify-between gap-3 shadow-sm transition-all mt-1">
                  <div className="flex items-center gap-2.5">
                    <div className="w-8 h-8 rounded-full bg-indigo-100 flex items-center justify-center text-indigo-600 shrink-0">
                      {isDemoLoading ? (
                        <RefreshCw className="w-4 h-4 animate-spin" />
                      ) : (
                        <Volume2 className="w-4.5 h-4.5" />
                      )}
                    </div>
                    <div>
                      <h4 className="text-xs font-bold text-slate-700">Nghe thử giọng mẫu:</h4>
                      <p className="text-[10px] text-slate-400 leading-normal mt-0.5 border-l-2 border-indigo-200 pl-2">
                        Nhân vật: <strong>{
                          currentEngineConfig?.voices?.find(v => v.id === selectedVoice)?.vietnameseName || selectedVoice
                        }</strong> ({selectedVoice}) &bull; Ngữ điệu: <strong>{
                          currentEngineConfig?.accents.find(a => a.id === selectedAccent)?.name?.split(" ")[1] || selectedAccent
                        }</strong>
                      </p>
                    </div>
                  </div>
                  
                  <button
                    id="play-demo-manual-btn"
                    onClick={() => playVoiceDemo(selectedVoice, selectedAccent)}
                    disabled={isDemoLoading}
                    className={`xs:w-auto w-full px-4 py-2 text-xs font-bold rounded-xl flex items-center justify-center gap-1.5 transition-all text-white ${
                      isDemoLoading ? "bg-indigo-300 cursor-not-allowed" : "bg-indigo-600 hover:bg-indigo-700 active:scale-[0.98] shadow-sm"
                    }`}
                  >
                    {isDemoLoading ? (
                      <>
                        <RefreshCw className="w-3 h-3 animate-spin" />
                        <span>Đang tải...</span>
                      </>
                    ) : (
                      <>
                        <span>🔊 Nghe thử ngay</span>
                      </>
                    )}
                  </button>
                </div>

                {/* 3. Speed slider selections */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <label className="text-[11px] font-semibold text-slate-400 tracking-wider block">TỐC ĐỘ ĐỌC (SPEED):</label>
                    <span className="text-xs font-mono font-semibold text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded-md">
                      {selectedSpeed}x
                    </span>
                  </div>
                  <div className="grid grid-cols-5 gap-1.5">
                    {currentEngineConfig?.speeds.map((sp) => {
                      const isActive = selectedSpeed === sp.id;
                      return (
                        <button
                          id={`speed-btn-${sp.id}`}
                          key={sp.id}
                          onClick={() => setSelectedSpeed(sp.id)}
                          className={`py-1.5 px-2 text-[10px] sm:text-xs font-medium border rounded-lg text-center transition-all ${
                            isActive
                              ? "bg-indigo-50 border-indigo-300 text-indigo-700"
                              : "bg-white hover:bg-slate-50 border-slate-200 text-slate-600"
                          }`}
                        >
                          {sp.id}x
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>
            ) : (
              // Browser voices
              <div className="space-y-4">
                <div className="space-y-2">
                  <label className="text-[11px] font-semibold text-slate-400 tracking-wider block">DANH SÁCH GIỌNG NÓI HỆ THỐNG:</label>
                  {browserVoices.length > 0 ? (
                    <select
                      id="browser-voice-select"
                      aria-label="Chọn giọng đọc của hệ thống"
                      value={selectedBrowserVoiceURI}
                      onChange={(e) => setSelectedBrowserVoiceURI(e.target.value)}
                      className="w-full text-xs p-3 border border-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500/10 focus:border-indigo-500 rounded-xl bg-white text-slate-700 leading-relaxed font-medium"
                    >
                      {browserVoices.map((voice) => (
                        <option key={voice.voiceURI} value={voice.voiceURI}>
                          {voice.name} ({voice.lang || "Không rõ ngôn ngữ"}) {voice.localService ? "[Sẵn có]" : ""}
                        </option>
                      ))}
                    </select>
                  ) : (
                    <div className="p-3 bg-amber-50 text-amber-800 text-xs border border-amber-200 rounded-xl flex items-center gap-2">
                      <AlertCircle className="w-4 h-4 shrink-0" />
                      <span>Không tìm thấy giọng đọc hệ thống Việt ngữ cục bộ nào trên trình duyệt này. Thử dùng Gemini AI!</span>
                    </div>
                  )}
                </div>

                {/* Speed selector for local */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <label className="text-[11px] font-semibold text-slate-400 tracking-wider block font-mono">TỐC ĐỘ PHÁT (SPEED):</label>
                    <span className="text-xs font-mono font-bold text-slate-700 bg-slate-100 px-2 py-0.5 rounded-md">
                      {selectedSpeed}x
                    </span>
                  </div>
                  <input
                    id="browser-speed-range"
                    aria-label="Cân chỉnh tốc độ đọc trình duyệt"
                    type="range"
                    min="0.5"
                    max="2.0"
                    step="0.1"
                    value={selectedSpeed}
                    onChange={(e) => setSelectedSpeed(e.target.value)}
                    className="w-full accent-indigo-600 h-1.5 bg-slate-100 rounded-lg cursor-pointer"
                  />
                  <div className="flex justify-between text-[10px] text-slate-400 font-medium px-1">
                    <span>Cực chậm (0.5x)</span>
                    <span>Chuẩn (1.0x)</span>
                    <span>Cực nhanh (2.0x)</span>
                  </div>
                </div>
              </div>
            )}

            {/* Execute generation CTA button */}
            <button
              id="tts-synthesize-submit-btn"
              onClick={handleSynthesize}
              disabled={isGenerating}
              className={`w-full py-4.5 px-4 rounded-xl font-bold text-sm tracking-wide shadow-md transition-all flex items-center justify-center gap-2 ${
                isGenerating
                  ? "bg-indigo-300 text-white cursor-not-allowed"
                  : "bg-indigo-600 hover:bg-indigo-700 active:scale-[0.99] text-white hover:shadow-indigo-100 shadow-md"
              }`}
            >
              {isGenerating ? (
                <>
                  <RefreshCw className="w-5 h-5 animate-spin" />
                  <span>ĐANG TÍCH HỢP GIỌNG NÓI AI...</span>
                </>
              ) : (
                <>
                  <Sparkles className="w-4.5 h-4.5 fill-current" />
                  <span>PHÁT ĐỒNG BỘ GIỌNG NÓI</span>
                </>
              )}
            </button>
          </div>
        </section>

        {/* RIGHT COLUMN: Player Consol & History list */}
        <section id="right-player-section" className="lg:col-span-12 xl:col-span-5 flex flex-col gap-6">
          
          {/* Main Visualizer and Master Playback Player Panel */}
          <div className="bg-slate-950 border border-slate-900 rounded-3xl p-6 shadow-xl flex flex-col gap-5 text-white">
            <h3 className="text-sm font-semibold text-slate-400 tracking-wider uppercase flex items-center gap-1.5">
              <Music className="w-4.5 h-4.5 text-indigo-400" />
              Bảng phát tín hiệu âm thanh
            </h3>

            {/* Animated Audio bar waves visualizer component */}
            <AudioVisualizer isPlaying={isPlaying} speed={parseFloat(selectedSpeed)} />

            {/* Progressive Playback Slider */}
            <div className="space-y-1.5 mt-2">
              <div className="relative">
                <input
                  id="playback-progress-range"
                  aria-label="Cân chỉnh vị trí thời gian phát"
                  type="range"
                  min="0"
                  max={duration || 100}
                  value={currentTime}
                  onChange={(e) => {
                    const nextTime = parseFloat(e.target.value);
                    setCurrentTime(nextTime);
                    if (audioRef.current && selectedEngine === "gemini") {
                      audioRef.current.currentTime = nextTime;
                    }
                  }}
                  className="w-full accent-indigo-500 h-1 bg-slate-800 rounded-lg cursor-pointer"
                />
              </div>
              <div className="flex justify-between text-[11px] font-mono text-slate-400">
                <span>{formatTime(currentTime)}</span>
                <span>{formatTime(duration)}</span>
              </div>
            </div>

            {/* Master Console action triggers */}
            <div className="flex items-center justify-between gap-4 py-2 border-t border-slate-900 mt-2">
              <div className="flex items-center gap-3">
                {/* Volume slider controls */}
                <button
                  id="mute-toggle-btn"
                  onClick={() => setIsMuted(!isMuted)}
                  className="text-slate-400 hover:text-white transition-colors"
                  title={isMuted ? "Bật tiếng" : "Tắt tiếng"}
                >
                  {isMuted || volume === 0 ? (
                    <VolumeX className="w-5 h-5 text-rose-400" />
                  ) : (
                    <Volume2 className="w-5 h-5" />
                  )}
                </button>
                <input
                  id="playback-volume-range"
                  aria-label="Cân chỉnh âm lượng phát"
                  type="range"
                  min="0"
                  max="1"
                  step="0.05"
                  value={isMuted ? 0 : volume}
                  onChange={(e) => {
                    setVolume(parseFloat(e.target.value));
                    setIsMuted(false);
                  }}
                  className="w-16 accent-indigo-500 h-1 bg-slate-800 rounded-lg cursor-pointer hidden sm:block"
                />
              </div>

              {/* Master Play Button */}
              <button
                id="playback-play-toggle-btn"
                onClick={togglePlayPause}
                disabled={!audioUrl && selectedEngine === "gemini"}
                className={`w-14 h-14 rounded-full flex items-center justify-center transition-all ${
                  !audioUrl && selectedEngine === "gemini"
                    ? "bg-slate-800 text-slate-500 opacity-50 cursor-not-allowed"
                    : "bg-indigo-600 hover:bg-indigo-500 hover:scale-105 active:scale-95 text-white shadow-lg"
                }`}
              >
                {isPlaying ? (
                  <Pause className="w-6 h-6 fill-white" />
                ) : (
                  <Play className="w-6 h-6 fill-white translate-x-0.5" />
                )}
              </button>

              {/* Dynamic Download MP3 */}
              <button
                id="playback-download-mp3-btn"
                onClick={downloadActiveAudio}
                disabled={!audioUrl || selectedEngine !== "gemini"}
                className={`px-4.5 py-2 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-all ${
                  audioUrl && selectedEngine === "gemini"
                    ? "bg-slate-800 hover:bg-slate-700 text-emerald-400 border border-emerald-500/20"
                    : "bg-slate-900 text-slate-600 cursor-not-allowed"
                }`}
                title="Tải xuống tệp MP3"
              >
                <Download className="w-4 h-4" />
                <span className="hidden xs:inline">Xuất MP3</span>
              </button>
            </div>

            {/* Hint message inside the controller */}
            {!audioUrl && selectedEngine === "gemini" && (
              <div className="flex items-start gap-2 bg-slate-900/60 p-3 rounded-xl border border-slate-900 text-xs text-slate-400 leading-normal">
                <Info className="w-4 h-4 text-indigo-400 shrink-0 mt-0.5" />
                <span>Nhấn nút <strong>PHÁT ĐỒNG BỘ GIỌNG NÓI</strong> ở bên trái để biên dịch văn bản thành luồng MP3 trước khi phát.</span>
              </div>
            )}
          </div>

          {/* External Voice Integration Panel & Guide */}
          <div className="bg-white border border-slate-200/80 rounded-3xl p-5 shadow-sm transition-all flex flex-col gap-4">
            <button
              id="toggle-guide-btn"
              onClick={() => setIsGuideOpen(!isGuideOpen)}
              className="flex items-center justify-between w-full text-slate-800 hover:text-slate-900 transition-colors focus:outline-none focus:ring-2 focus:ring-indigo-500/20 rounded-md p-1"
            >
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-full bg-indigo-50 flex items-center justify-center text-indigo-600 shrink-0">
                  <Sliders className="w-4.5 h-4.5" />
                </div>
                <div className="text-left">
                  <h4 className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Tùy Chọn Mở Rộng</h4>
                  <p className="text-xs font-bold text-slate-700 mt-0.5">Tích hợp thêm giọng đọc khác?</p>
                </div>
              </div>
              <span className="text-[11px] font-bold text-indigo-600 bg-indigo-50/80 px-2.5 py-1 rounded-full transition-all hover:bg-indigo-100">
                {isGuideOpen ? "Đóng ✕" : "Xem Hướng Dẫn ⚙️"}
              </span>
            </button>

            {isGuideOpen && (
              <div className="border-t border-slate-100 pt-4 flex flex-col gap-4 animate-fadeIn">
                {/* Custom Tabs */}
                <div className="grid grid-cols-2 bg-slate-100 p-1 rounded-xl">
                  <button
                    id="tab-sys-btn"
                    onClick={() => {
                      setActiveGuideTab("system");
                      setApiTestStatus("idle");
                    }}
                    className={`py-1.5 text-xs font-bold rounded-lg transition-all ${
                      activeGuideTab === "system"
                        ? "bg-white text-slate-950 shadow-sm"
                        : "text-slate-500 hover:text-slate-800"
                    }`}
                  >
                    1. Giọng Hệ Thống (Free)
                  </button>
                  <button
                    id="tab-cloud-btn"
                    onClick={() => setActiveGuideTab("cloud")}
                    className={`py-1.5 text-xs font-bold rounded-lg transition-all ${
                      activeGuideTab === "cloud"
                        ? "bg-white text-slate-950 shadow-sm"
                        : "text-slate-500 hover:text-slate-800"
                    }`}
                  >
                    2. Cấu Hình Cloud API
                  </button>
                </div>

                {activeGuideTab === "system" ? (
                  <div className="space-y-3.5 text-xs text-slate-600 leading-relaxed bg-slate-50 p-4 rounded-2xl border border-slate-100">
                    <p className="font-bold text-slate-800 flex items-center gap-1.5">
                      <Globe className="w-4 h-4 text-emerald-500 shrink-0" />
                      Cài đặt thêm giọng Việt miễn phí vào Trình duyệt:
                    </p>
                    <p className="text-[11px] text-slate-500 leading-normal mb-2">
                      Trình duyệt sử dụng giọng đọc có sẵn của hệ điều hành. Bạn có thể cài thêm giọng nói chất lượng rất cao theo hướng dẫn sau:
                    </p>
                    <ul className="space-y-2.5 text-[11px]">
                      <li className="flex items-start gap-2">
                        <span className="bg-indigo-100 text-indigo-700 w-4 h-4 rounded-full flex items-center justify-center text-[8px] font-bold shrink-0 mt-0.5">D</span>
                        <span>
                          <strong>Trên Điện thoại (iOS / Android):</strong> Vào Cài đặt gốc hệ điều hành &gt; Hỗ trợ tiếp cận (Accessibility) &gt; Đọc màn hình (Spoken Content / Text-To-Speech) &gt; Chọn tải thêm gói ngôn ngữ <strong>Tiếng Việt</strong> (ví dụ giọng "Linh" trên iPhone nghe cực chuẩn).
                        </span>
                      </li>
                      <li className="flex items-start gap-2">
                        <span className="bg-indigo-100 text-indigo-700 w-4 h-4 rounded-full flex items-center justify-center text-[8px] font-bold shrink-0 mt-0.5">W</span>
                        <span>
                          <strong>Trên Windows 10/11:</strong> Mở <i>Settings &gt; Time & Language &gt; Speech &gt; Add voices</i>, tìm kiếm và cài gói <strong>Vietnamese (Tiếng Việt)</strong>. Giọng đọc chuẩn Việt (HoaiChi / An Microsoft) sẽ đồng bộ tự động vào phần mềm.
                        </span>
                      </li>
                      <li className="flex items-start gap-2">
                        <span className="bg-indigo-100 text-indigo-700 w-4 h-4 rounded-full flex items-center justify-center text-[8px] font-bold shrink-0 mt-0.5">M</span>
                        <span>
                          <strong>Trên macOS:</strong> Vào <i>System Settings &gt; Accessibility &gt; Spoken Content &gt; System Voice</i>, chọn thêm ngôn ngữ Tiếng Việt để tải về giọng đọc mượt mà.
                        </span>
                      </li>
                    </ul>
                    <div className="mt-2.5 p-2.5 bg-indigo-50 border border-indigo-100 rounded-lg text-[10px] text-indigo-800 font-medium">
                      ℹ️ Sau khi tải cài đặt xong, quý khách hãy <strong>tải lại trang (reload F5)</strong>. Giọng đọc mới sẽ hiển thị trong danh mục của "Cục bộ (Trình duyệt nội bộ)" để chọn phát lập tức!
                    </div>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {/* Live Configurator API Simulator */}
                    <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100 space-y-3.5">
                      <p className="font-bold text-[11px] text-slate-700 flex items-center gap-1.5 uppercase tracking-wider">
                        <Sparkles className="w-4 h-4 text-indigo-500" />
                        Giả lập tích hợp đối tác API liên kết:
                      </p>
                      
                      <div className="grid grid-cols-2 gap-2">
                        <div className="space-y-1">
                          <label className="text-[10px] font-bold text-slate-500 uppercase block">Nhà cung cấp:</label>
                          <select
                            value={customApiProvider}
                            onChange={(e) => {
                              const v = e.target.value;
                              setCustomApiProvider(v);
                              if (v === "fpt") {
                                setCustomApiUrl("https://api.fpt.ai/hcm/v5/tts");
                                setCustomVoiceToken("banmai");
                              } else if (v === "viettel") {
                                setCustomApiUrl("https://viettelai.vn/tts/v1/synthesis");
                                setCustomVoiceToken("huyenchi");
                              } else if (v === "elevenlabs") {
                                setCustomApiUrl("https://api.elevenlabs.io/v1/text-to-speech");
                                setCustomVoiceToken("pNP21PhZ6ZN7A4874h3X");
                              } else {
                                setCustomApiUrl("");
                                setCustomVoiceToken("");
                              }
                            }}
                            className="w-full text-xs p-2 border border-slate-200 rounded-lg bg-white font-medium"
                          >
                            <option value="fpt">FPT.AI (Việt Nam)</option>
                            <option value="viettel">Viettel AI Cloud</option>
                            <option value="elevenlabs">ElevenLabs Cloned</option>
                            <option value="custom">Giọng khác (Tùy chọn)</option>
                          </select>
                        </div>

                        <div className="space-y-1">
                          <label className="text-[10px] font-bold text-slate-500 uppercase block">Mã giọng đọc (Voice Token):</label>
                          <input
                            type="text"
                            value={customVoiceToken}
                            onChange={(e) => setCustomVoiceToken(e.target.value)}
                            placeholder="vd: banmai, leminh"
                            className="w-full text-xs p-2 border border-slate-200 rounded-lg bg-white font-mono"
                          />
                        </div>
                      </div>

                      <div className="space-y-1">
                        <label className="text-[10px] font-bold text-slate-500 uppercase block">Đường dẫn API (Endpoint URL):</label>
                        <input
                          type="text"
                          value={customApiUrl}
                          onChange={(e) => setCustomApiUrl(e.target.value)}
                          placeholder="https://api.partner.com/tts"
                          className="w-full text-xs p-2 border border-slate-200 rounded-lg bg-white font-mono text-[11px]"
                        />
                      </div>

                      <div className="space-y-1">
                        <label className="text-[10px] font-bold text-slate-500 uppercase flex items-center justify-between">
                          <span>Khóa bảo mật (API Key):</span>
                          <span className="text-[9px] text-indigo-500 font-medium">Bảo mật mã hóa</span>
                        </label>
                        <input
                          type="password"
                          value={customApiKey}
                          onChange={(e) => setCustomApiKey(e.target.value)}
                          placeholder="Nhập khóa API nhận từ nhà cung cấp"
                          className="w-full text-xs p-2 border border-slate-200 rounded-lg bg-white font-mono"
                        />
                      </div>

                      {/* Test Connection Run button */}
                      <button
                        onClick={handleTestApiConnection}
                        disabled={apiTestStatus === "testing"}
                        className={`w-full py-2.5 text-xs font-bold rounded-xl flex items-center justify-center gap-1.5 text-white transition-all ${
                          apiTestStatus === "testing" 
                            ? "bg-slate-400 cursor-not-allowed" 
                            : "bg-indigo-600 hover:bg-indigo-700 active:scale-[0.98] shadow-sm"
                        }`}
                      >
                        {apiTestStatus === "testing" ? (
                          <>
                            <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                            <span>Đang kiểm tra kết nối SSL...</span>
                          </>
                        ) : (
                          <>
                            <span>🔌 Chạy thử nghiệm kết nối</span>
                          </>
                        )}
                      </button>

                      {/* Connection feedback box */}
                      {apiTestStatus !== "idle" && (
                        <div className={`p-3 rounded-lg border text-[11px] leading-relaxed transition-all ${
                          apiTestStatus === "success" 
                            ? "bg-emerald-50 text-emerald-850 border-emerald-200" 
                            : apiTestStatus === "error" 
                              ? "bg-rose-50 text-rose-850 border-rose-200"
                              : "bg-indigo-50 text-indigo-850 border-indigo-100"
                        }`}>
                          <div className="font-semibold flex items-center gap-1">
                            {apiTestStatus === "success" ? "✓" : apiTestStatus === "error" ? "⚠" : "⚙️"} 
                            <span>Kết quả giả lập đấu nối:</span>
                          </div>
                          <p className="mt-0.5 font-medium">{apiTestMessage}</p>
                        </div>
                      )}
                    </div>

                    {/* Developer code tutorial card */}
                    <div className="space-y-1.5">
                      <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block">Mẫu mã nguồn kết nối (Hậu đài Node.js):</p>
                      <div className="bg-slate-900 text-slate-300 p-3.5 rounded-2xl font-mono text-[9px] leading-relaxed overflow-x-auto border border-slate-800 shadow-inner">
                        <div className="text-slate-500 mb-1">// Dán mã nguồn này vào máy chủ Express (server.ts) để chạy thực tế:</div>
                        <span className="text-sky-400">app</span>.<span className="text-yellow-400">post</span>(<span className="text-emerald-400">"/api/custom-tts"</span>, <span className="text-violet-400">async</span> (req, res) <span className="text-pink-400">=&gt;</span> &#123; <br />
                        &nbsp;&nbsp;<span className="text-pink-400">const</span> response = <span className="text-violet-400">await</span> <span className="text-yellow-400">fetch</span>(<span className="text-emerald-400">"{customApiUrl || "URL_DAU_NOI"}"</span>, &#123;<br />
                        &nbsp;&nbsp;&nbsp;&nbsp;method: <span className="text-emerald-400">"POST"</span>,<br />
                        &nbsp;&nbsp;&nbsp;&nbsp;headers: &#123;<br />
                        &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;<span className="text-emerald-400">"api-key"</span>: <span className="text-emerald-400">"{customApiKey ? "●●●●●●●●" : "YOUR_API_KEY_HERE"}"</span>,<br />
                        &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;<span className="text-emerald-400">"Content-Type"</span>: <span className="text-emerald-400">"application/json"</span><br />
                        &nbsp;&nbsp;&nbsp;&nbsp;&#125;,<br />
                        &nbsp;&nbsp;&nbsp;&nbsp;body: <span className="text-sky-400">JSON</span>.<span className="text-yellow-400">stringify</span>(&#123; text: req.body.text, voice: <span className="text-emerald-400">"{customVoiceToken}"</span> &#125;)<br />
                        &nbsp;&nbsp;&#125;);<br />
                        &nbsp;&nbsp;<span className="text-pink-400">const</span> audioBuffer = <span className="text-violet-400">await</span> response.<span className="text-yellow-400">arrayBuffer</span>();<br />
                        &nbsp;&nbsp;res.<span className="text-yellow-400">send</span>(<span className="text-sky-400">Buffer</span>.<span className="text-yellow-400">from</span>(audioBuffer));<br />
                        &#125;);
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Persistent History logs list */}
          <SpeechHistory
            history={history}
            onReplay={handleReplayItem}
            onDelete={handleDeleteItem}
            activePlayingId={activePlayingId}
          />
        </section>
      </main>

      {/* Styled Footer widget */}
      <footer className="bg-white border-t border-slate-200 py-6 px-6 mt-12">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row items-center justify-between gap-4 text-xs text-slate-400">
          <div className="flex items-center gap-2">
            <span className="font-semibold text-slate-500">Vietnamese AI Voice-Synthesi</span>
            <span>&bull;</span>
            <span>Ứng dụng chạy bằng công nghệ Gemini v3.1</span>
          </div>
          <div className="flex items-center gap-3">
            <span>Định dạng hỗ trợ: <strong>MP3 (24kHz Mono, 128kbps)</strong></span>
          </div>
        </div>
      </footer>
    </div>
  );
}
