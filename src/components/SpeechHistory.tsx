import React from "react";
import { HistoryItem } from "../types";
import { Play, Trash2, Download, Volume2, Calendar, FileAudio } from "lucide-react";
import { motion, AnimatePresence } from "motion/react";

interface SpeechHistoryProps {
  history: HistoryItem[];
  onReplay: (item: HistoryItem) => void;
  onDelete: (id: string) => void;
  activePlayingId: string | null;
}

export const SpeechHistory: React.FC<SpeechHistoryProps> = ({
  history,
  onReplay,
  onDelete,
  activePlayingId,
}) => {
  const downloadBase64AsMp3 = (base64Data: string, filename: string) => {
    try {
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
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (e) {
      console.error("Lỗi khi tải xuống tệp tin âm thanh:", e);
    }
  };

  const formatDate = (dateString: string) => {
    try {
      const d = new Date(dateString);
      return d.toLocaleTimeString("vi-VN", { hour: "2-digit", minute: "2-digit" }) + " - " + d.toLocaleDateString("vi-VN", { day: "2-digit", month: "2-digit", year: "numeric" });
    } catch {
      return dateString;
    }
  };

  if (history.length === 0) {
    return (
      <div className="bg-white border border-slate-100 rounded-2xl p-8 text-center flex flex-col items-center justify-center">
        <div className="w-12 h-12 bg-slate-50 rounded-full flex items-center justify-center text-slate-400 mb-3">
          <FileAudio className="w-6 h-6" />
        </div>
        <h3 className="text-sm font-medium text-slate-900">Lịch sử trống</h3>
        <p className="text-xs text-slate-500 mt-1 max-w-xs">
          Các bản dịch giọng nói của bạn sẽ xuất hiện ở đây để phát lại hoặc tải xuống bất cứ lúc nào.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-slate-800 flex items-center gap-1.5">
          <Volume2 className="w-4 h-4 text-indigo-500" />
          Lịch sử tạo ({history.length})
        </h3>
      </div>

      <div className="space-y-2.5 max-h-[420px] overflow-y-auto pr-1">
        <AnimatePresence initial={false}>
          {history.map((item) => {
            const isPlaying = activePlayingId === item.id;
            const croppedText = item.text.length > 80 ? `${item.text.slice(0, 80)}...` : item.text;
            const isGemini = item.engine === "gemini";

            return (
              <motion.div
                key={item.id}
                id={`history-${item.id}`}
                layout
                initial={{ opacity: 0, y: 15 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, x: -50 }}
                transition={{ duration: 0.2 }}
                className={`p-4 rounded-xl border transition-all ${
                  isPlaying
                    ? "bg-indigo-50/50 border-indigo-200 ring-1 ring-indigo-100"
                    : "bg-white hover:bg-slate-50/70 border-slate-100"
                }`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <p className="text-xs text-slate-700 font-medium leading-relaxed break-words">
                      {croppedText}
                    </p>
                    
                    {/* Metadata tags */}
                    <div className="flex flex-wrap gap-1.5 mt-2.5">
                      <span className={`text-[10px] px-1.5 py-0.5 rounded-md font-medium ${
                        isGemini 
                          ? "bg-blue-50 text-blue-600 border border-blue-100" 
                          : "bg-emerald-50 text-emerald-600 border border-emerald-100"
                      }`}>
                        {isGemini ? "Gemini AI" : "Browser"}
                      </span>
                      <span className="text-[10px] bg-slate-100 text-slate-600 px-1.5 py-0.5 rounded-md">
                        {item.voiceName}
                      </span>
                      <span className="text-[10px] bg-slate-100 text-slate-600 px-1.5 py-0.5 rounded-md">
                        {item.accentLabel}
                      </span>
                      <span className="text-[10px] bg-slate-100 text-slate-600 px-1.5 py-0.5 rounded-md">
                        {item.speed}x
                      </span>
                    </div>

                    <div className="flex items-center gap-1 text-[10px] text-slate-400 mt-2">
                      <Calendar className="w-3 h-3" />
                      <span>{formatDate(item.createdAt)}</span>
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-1.5 shrink-0 self-center">
                    <button
                      id={`replay-${item.id}`}
                      onClick={() => onReplay(item)}
                      title="Phát lại"
                      className={`w-8 h-8 rounded-full flex items-center justify-center transition-colors ${
                        isPlaying
                          ? "bg-indigo-500 text-white"
                          : "bg-slate-100 hover:bg-indigo-100 text-slate-700 hover:text-indigo-700"
                      }`}
                    >
                      <Play className={`w-3.5 h-3.5 ${isPlaying ? "fill-white animate-pulse" : ""}`} />
                    </button>

                    {isGemini && item.audioContent && (
                      <button
                        id={`download-hist-${item.id}`}
                        onClick={() => downloadBase64AsMp3(item.audioContent!, `vietnamese-speech-${item.id}.mp3`)}
                        title="Tải xuống MP3"
                        className="w-8 h-8 rounded-full bg-slate-100 hover:bg-emerald-100 text-slate-700 hover:text-emerald-700 flex items-center justify-center transition-colors"
                      >
                        <Download className="w-3.5 h-3.5" />
                      </button>
                    )}

                    <button
                      id={`delete-hist-${item.id}`}
                      onClick={() => onDelete(item.id)}
                      title="Xóa khỏi lịch sử"
                      className="w-8 h-8 rounded-full bg-slate-100 hover:bg-rose-100 text-slate-600 hover:text-rose-600 flex items-center justify-center transition-colors"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              </motion.div>
            );
          })}
        </AnimatePresence>
      </div>
    </div>
  );
};
