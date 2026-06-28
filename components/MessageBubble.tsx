import type { ChatMessage } from "@/types";

interface Props {
  message: ChatMessage;
}

export default function MessageBubble({ message }: Props) {
  const isUser = message.role === "user";

  return (
    <div className={`flex gap-3 ${isUser ? "flex-row-reverse" : "flex-row"}`}>
      {/* Avatar */}
      <div className={`
        w-8 h-8 rounded-full flex items-center justify-center shrink-0 text-sm
        ${isUser ? "bg-violet-600 text-white" : "bg-slate-700 text-slate-200"}
      `}>
        {isUser ? "U" : "AI"}
      </div>

      {/* Bubble */}
      <div className={`max-w-[80%] ${isUser ? "items-end" : "items-start"} flex flex-col gap-1`}>
        <div className={`
          rounded-2xl px-4 py-3 text-sm leading-relaxed
          ${isUser
            ? "bg-violet-600 text-white rounded-tr-sm"
            : "bg-slate-800 text-slate-100 rounded-tl-sm border border-slate-700/60"
          }
        `}>
          {/* Render newlines as line breaks */}
          {message.content.split("\n").map((line, i) => (
            <span key={i}>
              {line}
              {i < message.content.split("\n").length - 1 && <br />}
            </span>
          ))}
        </div>

        {/* Sources — shown only on assistant messages that used documents */}
        {!isUser && message.sources && message.sources.length > 0 && (
          <div className="flex flex-wrap gap-1.5 mt-1">
            {message.sources.map((src) => (
              <span
                key={src}
                className="text-xs bg-slate-900 text-violet-400 border border-violet-800/50 px-2 py-0.5 rounded-full"
              >
                📄 {src}
              </span>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
