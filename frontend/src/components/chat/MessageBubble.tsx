import { memo, useMemo } from 'react';
import ReactMarkdown from 'react-markdown';
import { Download, User, Sparkles, BookOpen } from 'lucide-react';
import type { Message } from '../../types';
import { useAuthStore } from '../../stores/authStore';
import { formatDateTime } from '../../utils/time';

interface MessageBubbleProps {
  message: Message;
}

function MessageBubbleInner({ message }: MessageBubbleProps) {
  const isInbound = message.direction === 'incoming' || message.direction === 'inbound';
  const isFaq = message.faq_matched || message.sender_type === 'faq';
  const isAdmin = message.sender_type === 'admin';
  const token = useAuthStore((s) => s.token);

  const bubbleClasses = useMemo(() => {
    if (isInbound) {
      return 'bg-bg-elevated border-border rounded-[12px_12px_12px_2px]';
    }
    if (isFaq) {
      return 'bg-green/5 border-green/20 rounded-[12px_12px_2px_12px]';
    }
    return 'bg-accent/10 border-accent/20 rounded-[12px_12px_2px_12px]';
  }, [isInbound, isFaq]);

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
        {/* Source badge */}
        {!isInbound && (
          <div className="flex items-center gap-2 mb-2">
            {isFaq && message.sender_type !== 'ai' && (
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-md bg-green text-white text-[11px] font-bold font-['JetBrains_Mono'] tracking-wide">
                <BookOpen size={12} />
                FAQ
              </span>
            )}
            {message.sender_type === 'ai' && (
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-md bg-purple text-text-primary text-[11px] font-bold font-['JetBrains_Mono'] tracking-wide">
                <Sparkles size={12} />
                AI
              </span>
            )}
            {isAdmin && !isFaq && message.sender_type !== 'ai' && (
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-md bg-accent text-bg-page text-[11px] font-bold font-['JetBrains_Mono'] tracking-wide">
                <User size={12} />
                Human
              </span>
            )}
            {botTag && (
              <span className="text-[10px] text-text-muted font-['JetBrains_Mono']">
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
            className="flex items-center gap-2 mb-2 px-3 py-2 bg-bg-elevated rounded border border-border text-sm text-accent hover:text-accent/80 transition-colors"
          >
            <Download size={14} />
            <span>Download file</span>
          </a>
        )}

        {/* Text content with Markdown */}
        {textContent && (
          <div className="text-[14px] text-text-primary leading-relaxed prose prose-invert prose-sm max-w-none [&_p]:my-0.5 [&_code]:text-accent [&_code]:bg-bg-elevated [&_code]:px-1 [&_code]:rounded [&_pre]:bg-bg-elevated [&_pre]:rounded [&_pre]:p-2 [&_a]:text-accent">
            <ReactMarkdown>{textContent}</ReactMarkdown>
          </div>
        )}

        {/* Footer: timestamp + tags */}
        <div className="flex items-center gap-1.5 mt-1.5 justify-end flex-wrap">
          {isFaq && (
            <span className="text-[10px] text-green font-['JetBrains_Mono'] font-semibold bg-green/10 px-1.5 py-0.5 rounded">
              FAQ Auto-Reply
            </span>
          )}
          {message.sender_type === 'ai' && (
            <span className="text-[10px] text-purple font-['JetBrains_Mono'] font-semibold bg-purple/10 px-1.5 py-0.5 rounded">
              AI Reply
            </span>
          )}
          {message.faq_rule_name && (
            <span className="text-[10px] text-green/70 font-['JetBrains_Mono'] bg-green/5 px-1.5 py-0.5 rounded">
              {message.faq_rule_name}
            </span>
          )}
          <span className="text-[10px] text-text-muted font-['JetBrains_Mono']">
            {formatDateTime(message.created_at)}
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
