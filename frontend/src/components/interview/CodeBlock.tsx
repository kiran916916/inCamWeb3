"use client";

import { useState } from "react";
import { Copy, Check } from "lucide-react";

interface CodeBlockProps {
  python?: string;
  csharp?: string;
  title?: string;
}

export function CodeBlock({ python, csharp, title }: CodeBlockProps) {
  const [lang, setLang] = useState<"python" | "csharp">(python ? "python" : "csharp");
  const [copied, setCopied] = useState(false);

  const code = lang === "python" ? python : csharp;

  const handleCopy = () => {
    if (code) {
      navigator.clipboard.writeText(code);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  return (
    <div className="rounded-xl overflow-hidden border border-white/10 bg-[#0D0D14] my-4">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-2 bg-bg-surface border-b border-white/10">
        <div className="flex items-center gap-3">
          {title && <span className="text-text-secondary text-xs font-mono">{title}</span>}
          <div className="flex gap-1">
            {python && (
              <button
                onClick={() => setLang("python")}
                className={`px-3 py-1 rounded text-xs font-mono font-semibold transition-all ${
                  lang === "python"
                    ? "bg-accent-primary text-white"
                    : "text-text-secondary hover:text-text-primary"
                }`}
              >
                Python
              </button>
            )}
            {csharp && (
              <button
                onClick={() => setLang("csharp")}
                className={`px-3 py-1 rounded text-xs font-mono font-semibold transition-all ${
                  lang === "csharp"
                    ? "bg-accent-secondary text-bg-primary"
                    : "text-text-secondary hover:text-text-primary"
                }`}
              >
                C#
              </button>
            )}
          </div>
        </div>
        <button
          onClick={handleCopy}
          className="flex items-center gap-1.5 text-text-secondary hover:text-text-primary transition-colors text-xs"
        >
          {copied ? <Check className="w-3.5 h-3.5 text-accent-secondary" /> : <Copy className="w-3.5 h-3.5" />}
          {copied ? "Copied!" : "Copy"}
        </button>
      </div>

      {/* Code */}
      <pre className="overflow-x-auto p-4 text-sm leading-relaxed">
        <code className="font-mono text-text-primary whitespace-pre">{code}</code>
      </pre>
    </div>
  );
}
