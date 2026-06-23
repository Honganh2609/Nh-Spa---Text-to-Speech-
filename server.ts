import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import { GoogleGenAI, Modality } from "@google/genai";
import dotenv from "dotenv";
import fs from "fs";
import vm from "vm";
import { createRequire } from "module";

dotenv.config();

const require = createRequire(import.meta.url);

// Safely bundle and load lamejs using standard Node VM environment to avoid scoping/ReferenceError issues with individual module requiring.
function getLame() {
  const code = fs.readFileSync(require.resolve("lamejs/lame.all.js"), "utf-8");
  const sandbox: any = {
    Int8Array,
    Int16Array,
    Int32Array,
    Float32Array,
    Float64Array,
    console,
    Math,
    Error,
    Buffer
  };
  vm.createContext(sandbox);
  // Execute closure inside clean environment
  vm.runInContext(code, sandbox);
  return sandbox.lamejs;
}

const lamejs = getLame();


// Initialize Gemini SDK with telemetry header per guidelines
const initGemini = () => {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    console.warn("WARNING: GEMINI_API_KEY is not defined. AI Speech features will be disabled.");
  }
  return new GoogleGenAI({
    apiKey: apiKey || "MOCK_KEY",
    httpOptions: {
      headers: {
        "User-Agent": "aistudio-build",
      },
    },
  });
};

const ai = initGemini();

// helper to convert little-endian 16-bit PCM Buffer to MP3 Buffer
function convertPcmToMp3(pcmBuffer: Buffer, sampleRate: number = 24000): Buffer {
  const numSamples = Math.floor(pcmBuffer.length / 2);
  const int16Samples = new Int16Array(numSamples);
  
  // Safe extraction of signed 16-bit integers
  for (let i = 0; i < numSamples; i++) {
    int16Samples[i] = pcmBuffer.readInt16LE(i * 2);
  }

  const encoder = new lamejs.Mp3Encoder(1, sampleRate, 128); // 1 channel (mono), sample rate, 128kbps
  const mp3Chunks: Buffer[] = [];
  const chunkSize = 1152; // LAME standard chunk size

  for (let i = 0; i < int16Samples.length; i += chunkSize) {
    const chunk = int16Samples.subarray(i, i + chunkSize);
    const mp3buf = encoder.encodeBuffer(chunk);
    if (mp3buf && mp3buf.length > 0) {
      mp3Chunks.push(Buffer.from(mp3buf));
    }
  }

  const flushBuf = encoder.flush();
  if (flushBuf && flushBuf.length > 0) {
    mp3Chunks.push(Buffer.from(flushBuf));
  }

  return Buffer.concat(mp3Chunks);
}

interface CachedSpeech {
  audioContent: string;
  format: string;
  sampleRate: number;
  metadata: {
    originalLength: number;
    pcmBytes: number;
    mp3Bytes: number;
    voiceName: string;
    accentStyle: string;
    speed: string;
    cached: boolean;
  };
}

const ttsCache = new Map<string, CachedSpeech>();
const MAX_CACHE_ENTRIES = 200;

function getCacheKey(text: string, voiceName: string, accentStyle: string, speed: string): string {
  const normalizedText = (text || "").trim().replace(/\s+/g, " ").toLowerCase();
  return `${voiceName}_${accentStyle}_${speed}_${normalizedText}`;
}

function addTtsToCache(key: string, data: CachedSpeech) {
  if (ttsCache.size >= MAX_CACHE_ENTRIES) {
    const oldestKey = ttsCache.keys().next().value;
    if (oldestKey !== undefined) {
      ttsCache.delete(oldestKey);
    }
  }
  ttsCache.set(key, data);
}

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json({ limit: "5mb" }));

  // API Route: Healthcheck
  app.get("/api/health", (req, res) => {
    res.json({ status: "ok", geminiConfigured: !!process.env.GEMINI_API_KEY });
  });

  // API Route: Voice list metadata for custom options
  app.get("/api/voices", (req, res) => {
    // We offer prebuilt Gemini voices mapped to human-friendly descriptions and regional styling instructions
    res.json({
      engines: [
        {
          id: "gemini",
          name: "Gemini AI Cloud Synthesis (Siêu thực)",
          description: "Giọng đọc truyền cảm, chất lượng phòng thu, tối ưu bởi mô hình trí tuệ nhân tạo Gemini 3.1.",
          voices: [
            { id: "Kore", name: "Kore (Giọng Nữ Ấm Áp)", vietnameseName: "Minh Thư", gender: "female", genderLabel: "Nữ" },
            { id: "Zephyr", name: "Zephyr (Giọng Nữ Trẻ Trung)", vietnameseName: "Phương Vy", gender: "female", genderLabel: "Nữ" },
            { id: "Charon", name: "Charon (Giọng Nam Trầm Ấm)", vietnameseName: "Gia Bách", gender: "male", genderLabel: "Nam" },
            { id: "Fenrir", name: "Fenrir (Giọng Nam Quyền Lực)", vietnameseName: "Hùng Sơn", gender: "male", genderLabel: "Nam" },
            { id: "Puck", name: "Puck (Giọng Vui Vẻ/Năng Động)", vietnameseName: "Thanh Bảo", gender: "unisex", genderLabel: "Đa Năng" }
          ],
          accents: [
            { id: "bac", name: "Giọng miền Bắc (Hà Nội)", prompt: "với giọng Bắc bộ rõ ràng, chuẩn xác, phát âm chuẩn tự nhiên" },
            { id: "nam", name: "Giọng miền Nam (Sài Gòn)", prompt: "với giọng Nam bộ ngọt ngào, ấm áp, truyền cảm và tự nhiên" },
            { id: "trung", name: "Giọng miền Trung (Huế)", prompt: "với giọng Trung bộ nhẹ nhàng, thanh lịch, thân thương" }
          ],
          speeds: [
            { id: "0.5", name: "Rất chậm (0.5x)", prompt: "bằng tốc độ cực kỳ chậm rãi, từng chữ rõ ràng" },
            { id: "0.8", name: "Chậm (0.8x)", prompt: "bằng tốc độ hơi chậm, thong thả" },
            { id: "1.0", name: "Bình thường (1.0x)", prompt: "bằng tốc độ đàm thoại vừa phải, tự nhiên" },
            { id: "1.2", name: "Hơi nhanh (1.2x)", prompt: "bằng tốc độ nhanh gọn, mạch lạc" },
            { id: "1.5", name: "Nhanh (1.5x)", prompt: "bằng tốc độ khẩn trương, truyền tin nhanh" }
          ]
        },
        {
          id: "browser",
          name: "Trình duyệt Speech API (Instant Playback)",
          description: "Giọng đọc mặc định tích hợp sẵn của hệ điều hành/trình duyệt của bạn. Tải tức thì.",
          voices: [] // Populated client-side dynamically
        }
      ]
    });
  });

  // API Route: Text-To-Speech API endpoint
  app.post("/api/tts", async (req, res) => {
    try {
      const { text, voiceName = "Kore", accentStyle = "nam", speed = "1.0" } = req.body;

      if (!text || typeof text !== "string" || text.trim().length === 0) {
        return res.status(400).json({ error: "Văn bản không hợp lệ hoặc rỗng." });
      }

      if (!process.env.GEMINI_API_KEY) {
        return res.status(500).json({ 
          error: "Gemini API Key chưa được thiết lập. Vui lòng cài đặt GEMINI_API_KEY trong Settings > Secrets." 
        });
      }

      // 1. Memory Cache Lookup to avoid exhausting the 10 requests / day Gemini limit!
      const cacheKey = getCacheKey(text, voiceName, accentStyle, speed);
      if (ttsCache.has(cacheKey)) {
        console.log(`[CACHE HIT] Delivering cached speech for voice: ${voiceName}, accent: ${accentStyle}`);
        const cached = ttsCache.get(cacheKey)!;
        return res.json({
          success: true,
          audioContent: cached.audioContent,
          format: cached.format,
          sampleRate: cached.sampleRate,
          metadata: {
            ...cached.metadata,
            cached: true
          }
        });
      }

      // Map parameters to specialized prompt directives
      const accentPrompt = 
        accentStyle === "bac" ? "với giọng Bắc bộ rõ ràng, chuẩn xác, phát âm tự nhiên" :
        accentStyle === "trung" ? "với giọng miền Trung thân thương, mộc mạc và truyền cảm" :
        "với giọng Nam bộ ngọt ngào, ấm áp, truyền cảm và trôi chảy";

      const speedPrompt =
        speed === "0.5" ? "bằng tốc độ cực kỳ chậm rãi, đọc từng chữ rõ nét nhất" :
        speed === "0.8" ? "bằng tốc độ hơi chậm, túc tắc, từ tốn" :
        speed === "1.2" ? "bằng tốc độ hơi nhanh, mạch lạc và súc tích" :
        speed === "1.5" ? "bằng tốc độ rất nhanh, cấp bách nhưng vẫn giữ độ rõ từ" :
        "bằng tốc độ đàm thoại bình thường, tự nhiên, ngắt nghỉ từng nhịp hợp lý";

      // Craft the perfect tts instruction prompting Gemini to read precisely.
      const promptText = `Hãy phát âm và thu âm rõ ràng đoạn văn bản tiếng Việt sau đây.
Yêu cầu phong cách:
- Hãy sử dụng giọng đọc tiếng Việt chuẩn xác, mang âm hưởng vùng miền: ${accentPrompt}.
- Tốc độ nói: ${speedPrompt}.
- Chỉ đọc duy nhất nội dung văn bản dưới đây, không thêm lời chào, không bình luận, không lặp lại yêu cầu, không đọc các dấu phân tách hay ký hiệu dư thừa.

Nội dung văn bản:
"${text.slice(0, 4000)}"`;

      console.log(`Generating TTS with Voice: ${voiceName}, AccentStyle: ${accentStyle}, Speed: ${speed}`);

      // Call the Gemini TTS API model: gemini-3.1-flash-tts-preview
      const response = await ai.models.generateContent({
        model: "gemini-3.1-flash-tts-preview",
        contents: [{ parts: [{ text: promptText }] }],
        config: {
          responseModalities: [Modality.AUDIO],
          speechConfig: {
            voiceConfig: {
              prebuiltVoiceConfig: { voiceName: voiceName },
            },
          },
        },
      });

      const base64Audio = response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
      if (!base64Audio) {
        throw new Error("Không thể trích xuất luồng âm thanh PCM từ dịch vụ Gemini AI.");
      }

      // Convert Gemini raw PCM (little-endian, 16-bit, 24kHz) to MP3
      const pcmBuffer = Buffer.from(base64Audio, "base64");
      const mp3Buffer = convertPcmToMp3(pcmBuffer, 24000);
      const audioContentStr = mp3Buffer.toString("base64");

      const responsePayload = {
        audioContent: audioContentStr,
        format: "mp3",
        sampleRate: 24000,
        metadata: {
          originalLength: text.length,
          pcmBytes: pcmBuffer.length,
          mp3Bytes: mp3Buffer.length,
          voiceName,
          accentStyle,
          speed,
          cached: false
        }
      };

      // Store in memory cache
      addTtsToCache(cacheKey, responsePayload);

      // Return standard base64 formats
      res.json({
        success: true,
        ...responsePayload
      });

    } catch (error: any) {
      console.error("Gemini TTS Service Error:", error);
      
      const errMsg = error.message || (typeof error === "string" ? error : "");
      const isQuotaExceeded = errMsg.includes("429") || 
                              errMsg.includes("quota") || 
                              errMsg.includes("RESOURCE_EXHAUSTED") || 
                              error.status === "RESOURCE_EXHAUSTED";

      if (isQuotaExceeded) {
        return res.status(429).json({
          success: false,
          errorType: "QUOTA_EXCEEDED",
          error: "Khóa API đã hết hạn mức cuộc gọi miễn phí hôm nay (10 yêu cầu/ngày). Bộ gõ đám mây tạm ngắt.",
          message: "Bộ sưu tập giọng nói Cloud đạt giới hạn. Đang kích hoạt trợ lý Trình Duyệt để hỗ trợ miễn phí."
        });
      }

      res.status(500).json({ 
        error: errMsg || "Xảy ra sự cố bất ngờ trong quá trình tổng hợp giọng nói." 
      });
    }
  });

  // Serve static UI assets and handle dev/prod mode properly
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`TTS Server is running on port ${PORT}`);
  });
}

startServer();
