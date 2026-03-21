import { memo, useMemo } from 'react';
import ReactMarkdown from 'react-markdown';
import { Bot, Download, User } from 'lucide-react';
import type { Message } from '../../types';

interface MessageBubbleProps {
  message: Message;
}

function formatTime(dateStr: string): string {
  const date = new Date(dateStr);
  return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

function MessageBubbleInner({ message }: MessageBubbleProps) {
  const isInbound = message.direction === 'incoming' || message.direction === 'inbound';
  const isFaq = message.faq_matched || message.sender_type === 'faq';
  const isBot = message.sender_type === 'bot';
  const isAdmin = message.sender_type === 'admin';

  const bubbleStyle = useMemo(() => {
    if (isInbound) {
      return 'bg-[#141414] border-[#2f2f2f]';
    }
    if (isFaq) {
      return 'bg-[#05966910] border-[#05966930]';
    }
    return 'bg-[#00D9FF15] border-[#00D9FF30]';
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
  const mediaUrl = message.media_url;

  return (
    <div className={`flex ${isInbound ? 'justify-start' : 'justify-end'} mb-3`}>
      <div
        className={`max-w-[70%] rounded-lg border px-4 py-2.5 ${bubbleStyle}`}
      >
        {/* Sender label */}
        {senderLabel && (
          <div className="flex items-center gap-1.5 mb-1">
            {isFaq ? (
              <Bot size={12} className="text-green" />
            ) : isAdmin ? (
              <User size={12} className="text-accent" />
            ) : null}
            <span
              className={`text-xs font-medium ${
                isFaq ? 'text-green' : 'text-accent'
              }`}
            >
              {senderLabel}
            </span>
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
            className="flex items-center gap-2 mb-2 px-3 py-2 bg-bg-elevated rounded border border-border-subtle text-sm text-accent hover:text-accent/80 transition-colors"
          >
            <Download size={14} />
            <span>Download file</span>
          </a>
        )}

        {/* Text content with Markdown */}
        {textContent && (
          <div className="text-sm text-text-primary leading-relaxed prose prose-invert prose-sm max-w-none [&_p]:my-0.5 [&_code]:text-accent [&_code]:bg-bg-elevated [&_code]:px-1 [&_code]:rounded [&_pre]:bg-bg-elevated [&_pre]:rounded [&_pre]:p-2 [&_a]:text-accent">
            <ReactMarkdown>{textContent}</ReactMarkdown>
          </div>
        )}

        {/* Footer: timestamp + bot tag */}
        <div className="flex items-center gap-2 mt-1.5 justify-end">
          {botTag && (
            <span className="text-[10px] text-text-muted bg-bg-elevated px-1.5 py-0.5 rounded">
              via {botTag}
            </span>
          )}
          {message.faq_rule_name && (
            <span className="text-[10px] text-green bg-green/10 px-1.5 py-0.5 rounded">
              FAQ: {message.faq_rule_name}
            </span>
          )}
          <span className="text-[10px] text-text-muted">
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
