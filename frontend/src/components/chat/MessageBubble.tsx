import { memo, useMemo } from 'react';
import ReactMarkdown from 'react-markdown';
import { Bot, Download, User } from 'lucide-react';
import type { Message } from '../../types';
import { useAuthStore } from '../../stores/authStore';
import { formatTime } from '../../utils/time';

interface MessageBubbleProps {
  message: Message;
}

function MessageBubbleInner({ message }: MessageBubbleProps) {
  const isInbound = message.direction === 'incoming' || message.direction === 'inbound';
  const isFaq = message.faq_matched || message.sender_type === 'faq';
  const isBot = message.sender_type === 'bot';
  const isAdmin = message.sender_type === 'admin';
  const token = useAuthStore((s) => s.token);

  const bubbleClasses = useMemo(() => {
    if (isInbound) {
      return 'bg-[#141414] border-[#2f2f2f] rounded-[12px_12px_12px_2px]';
    }
    if (isFaq) {
      return 'bg-[#05966910] border-[#05966930] rounded-[12px_12px_2px_12px]';
    }
    return 'bg-[#00D9FF15] border-[#00D9FF30] rounded-[12px_12px_2px_12px]';
  }, [isInbound, isFaq]);

  const senderLabel = useMemo(() => {
    if (isInbound) return null;
    if (isFaq) return 'FAQ Auto';
    if (isAdmin) return message.sender_admin_name || 'Admin';
    if (isBot) return 'Bot';
    return 'System';
  }, [isInbound, isFaq, isAdmin, isBot, message.sender_admin_name]);

  const botTag = message.sent_by_bot_name || message.via_bot_name;

  const contentType = message.message_type || message.content_type || 'text';
  const textContent = message.content || message.text_content || '';
  const rawMediaUrl = message.media_url;

  // Append auth token to media URL for img/video/a tags (they can't send Bearer headers)
  const mediaUrl = useMemo(() => {
    if (!rawMediaUrl) return undefined;
    const separator = rawMediaUrl.includes('?') ? '&' : '?';
    return token ? `${rawMediaUrl}${separator}token=${encodeURIComponent(token)}` : rawMediaUrl;
  }, [rawMediaUrl, token]);

  return (
    <div className={`flex ${isInbound ? 'justify-start' : 'justify-end'} mb-3`}>
      <div
        className={`max-w-[70%] border px-3.5 py-2.5 ${bubbleClasses}`}
      >
        {/* Sender label */}
        {senderLabel && (
          <div className="flex items-center gap-1.5 mb-1">
            {isFaq ? (
              <Bot size={12} className="text-[#059669]" />
            ) : isAdmin ? (
              <User size={12} className="text-[#00D9FF]" />
            ) : null}
            <span
              className={`text-[10px] font-semibold font-['JetBrains_Mono'] ${
                isFaq ? 'text-[#059669]' : 'text-[#00D9FF]'
              }`}
            >
              {senderLabel}
            </span>
            {botTag && (
              <span className="text-[10px] text-[#6a6a6a] font-['JetBrains_Mono']">
                via {botTag}
              </span>
            )}
          </div>
        )}

        {/* Media content - lazy loaded */}
        {contentType === 'photo' && mediaUrl && (
          <div className="mb-2">
            <img
              src={mediaUrl}
              alt="Photo"
              className="rounded max-w-full max-h-80 object-contain"
              loading="lazy"
            />
          </div>
        )}

        {contentType === 'video' && mediaUrl && (
          <div className="mb-2">
            <video
              src={mediaUrl}
              controls
              preload="none"
              className="rounded max-w-full max-h-80"
            />
          </div>
        )}

        {contentType === 'document' && mediaUrl && (
          <a
            href={mediaUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-2 mb-2 px-3 py-2 bg-[#141414] rounded border border-[#2f2f2f] text-sm text-[#00D9FF] hover:text-[#00D9FF]/80 transition-colors"
          >
            <Download size={14} />
            <span>Download file</span>
          </a>
        )}

        {/* Text content with Markdown */}
        {textContent && (
          <div className="text-[14px] text-white leading-relaxed prose prose-invert prose-sm max-w-none [&_p]:my-0.5 [&_code]:text-[#00D9FF] [&_code]:bg-[#141414] [&_code]:px-1 [&_code]:rounded [&_pre]:bg-[#141414] [&_pre]:rounded [&_pre]:p-2 [&_a]:text-[#00D9FF]">
            <ReactMarkdown>{textContent}</ReactMarkdown>
          </div>
        )}

        {/* Footer: timestamp + faq rule */}
        <div className="flex items-center gap-2 mt-1.5 justify-end">
          {message.faq_rule_name && (
            <span className="text-[10px] text-[#059669] font-['JetBrains_Mono'] bg-[#059669]/10 px-1.5 py-0.5 rounded">
              FAQ: {message.faq_rule_name}
            </span>
          )}
          <span className="text-[10px] text-[#6a6a6a] font-['JetBrains_Mono']">
            {formatTime(message.created_at)}
          </span>
        </div>
      </div>
    </div>
  );
}

// React.memo with custom comparison: only re-render when message id or content changes
const MessageBubble = memo(MessageBubbleInner, (prev, next) => {
  return prev.message.id === next.message.id
    && prev.message.content === next.message.content
    && prev.message.text_content === next.message.text_content
    && prev.message.media_url === next.message.media_url;
});

export default MessageBubble;
