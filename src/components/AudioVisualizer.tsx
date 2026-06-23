import React from "react";
import { motion } from "motion/react";

interface AudioVisualizerProps {
  isPlaying: boolean;
  speed: number; // to alter animation speed
}

export const AudioVisualizer: React.FC<AudioVisualizerProps> = ({ isPlaying, speed }) => {
  const barsCount = 28;
  const barHeights = Array.from({ length: barsCount }, () => Math.random());

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 flex flex-col items-center justify-center relative overflow-hidden h-40">
      {/* Background ambient glow */}
      <div className={`absolute inset-0 bg-blue-500/5 transition-opacity duration-500 ${isPlaying ? "opacity-100" : "opacity-0"}`} />
      
      {/* Wave container */}
      <div className="flex items-end justify-center gap-[3px] h-16 w-full max-w-md px-4">
        {barHeights.map((originalHeight, idx) => {
          // Duration varies per bar for a natural wave effect
          const duration = 0.8 + (idx % 4) * 0.25;
          const scale = isPlaying ? 1 : 0.08;

          return (
            <motion.div
              key={idx}
              id={`visualizer-bar-${idx}`}
              className={`w-1 rounded-full ${
                idx % 3 === 0 
                  ? "bg-gradient-to-t from-blue-600 to-indigo-400" 
                  : idx % 3 === 1 
                  ? "bg-gradient-to-t from-violet-600 to-fuchsia-400"
                  : "bg-gradient-to-t from-cyan-500 to-teal-400"
              }`}
              style={{
                height: `${Math.max(4, originalHeight * 100)}%`,
                transformOrigin: "bottom",
              }}
              animate={
                isPlaying
                  ? {
                      scaleY: [1, 0.3, 1.4, 0.6, 1.2, 0.4, 1],
                    }
                  : {
                      scaleY: 1,
                    }
              }
              transition={{
                duration: duration / (speed || 1),
                repeat: Infinity,
                ease: "easeInOut",
              }}
            />
          );
        })}
      </div>

      <div className="mt-4 flex items-center gap-2 text-xs font-mono text-slate-400">
        <span className="relative flex h-2 w-2">
          <span className={`animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75 ${isPlaying ? "block" : "hidden"}`}></span>
          <span className={`relative inline-flex rounded-full h-2 w-2 ${isPlaying ? "bg-emerald-500" : "bg-slate-600"}`}></span>
        </span>
        <span>
          {isPlaying ? "DANG PHÁT ÂM THANH..." : "HỆ THỐNG ĐÃ SẴN SÀNG"}
        </span>
      </div>
    </div>
  );
};
