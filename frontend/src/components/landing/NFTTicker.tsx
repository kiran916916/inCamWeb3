"use client";

import { useEffect, useState } from "react";
import { TrendingUp, TrendingDown } from "lucide-react";

interface TickerItem {
  name: string;
  price: string;
  change: number;
}

const MOCK_TICKERS: TickerItem[] = [
  { name: "Creator Pass #1042", price: "245 INCAM", change: 12.4 },
  { name: "Viral Drop #88", price: "1,200 INCAM", change: -3.1 },
  { name: "Studio Edition #7", price: "890 INCAM", change: 8.7 },
  { name: "Live Moment #334", price: "56 INCAM", change: 41.2 },
  { name: "Exclusive Clip #91", price: "3,400 INCAM", change: -1.8 },
  { name: "Creator Pass #773", price: "670 INCAM", change: 6.3 },
  { name: "Art Drop #22", price: "2,100 INCAM", change: 18.9 },
  { name: "Audio NFT #15", price: "340 INCAM", change: -5.5 },
];

export function NFTTicker() {
  const [items] = useState(MOCK_TICKERS);

  return (
    <div className="fixed top-16 left-0 right-0 z-40 bg-bg-secondary/80 backdrop-blur-sm border-b border-white/5 overflow-hidden">
      <div className="flex items-center h-8">
        <div className="flex-shrink-0 px-3 bg-accent-primary text-white text-xs font-bold h-full flex items-center">
          LIVE
        </div>
        <div className="overflow-hidden flex-1">
          <div
            className="flex gap-8 animate-[ticker_30s_linear_infinite] whitespace-nowrap"
            style={{ animation: "ticker 30s linear infinite" }}
          >
            {[...items, ...items].map((item, i) => (
              <div key={i} className="flex items-center gap-2 text-xs">
                <span className="text-text-secondary">{item.name}</span>
                <span className="font-mono font-medium text-text-primary">{item.price}</span>
                <span
                  className={`flex items-center gap-0.5 ${
                    item.change >= 0 ? "text-accent-secondary" : "text-brand-danger"
                  }`}
                >
                  {item.change >= 0 ? (
                    <TrendingUp className="w-3 h-3" />
                  ) : (
                    <TrendingDown className="w-3 h-3" />
                  )}
                  {Math.abs(item.change)}%
                </span>
                <span className="text-white/10">|</span>
              </div>
            ))}
          </div>
        </div>
      </div>
      <style jsx>{`
        @keyframes ticker {
          from { transform: translateX(0); }
          to { transform: translateX(-50%); }
        }
      `}</style>
    </div>
  );
}
