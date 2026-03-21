import { useCallback, useEffect, useRef, useState } from 'react';
import { ChevronDown, Image, Paperclip, Send, Type } from 'lucide-react';
import { useChatStore } from '../../stores/chatStore';
import type { AvailableBot } from '../../services/chatApi';
import { getAvailableBots } from '../../services/chatApi';

interface MessageInputProps {
  botName?: string;
  conversationId?: number | null;
  sourceType?: string;
}

export default function MessageInput({ botName, conversationId, sourceType }: MessageInputProps) {
  const [text, setText] = useState('');
  const [useMarkdown, setUseMarkdown] = useState(true);
  const [availableBots, setAvailableBots] = useState<AvailableBot[]>([]);
  const [selectedBot, setSelectedBot] = useState<AvailableBot | null>(null);
  const [showBotPicker, setShowBotPicker] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const imageInputRef = useRef<HTMLInputElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const botPickerRef = useRef<HTMLDivElement>(null);
  const sendMessage = useChatStore((s) => s.sendMessage);
  const sending = useChatStore((s) => s.sending);

  const isGroup = sourceType === 'group';

  // Fetch available bots when conversation changes (for group convos)
  useEffect(() => {
    if (!conversationId) {
      setAvailableBots([]);
      setSelectedBot(null);
      return;
    }

    if (isGroup) {
      getAvailableBots(conversationId)
        .then((bots) => {
          setAvailableBots(bots);
          // Default to primary bot
          const primary = bots.find((b) => b.is_primary) || bots[0] || null;
          setSelectedBot(primary);
        })
        .catch(() => {
          setAvailableBots([]);
          setSelectedBot(null);
        });
    } else {
      setAvailableBots([]);
      setSelectedBot(null);
    }
  }, [conversationId, isGroup]);

  // Close bot picker on outside click
  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (botPickerRef.current && !botPickerRef.current.contains(e.target as Node)) {
        setShowBotPicker(false);
      }
    };
    if (showBotPicker) {
      document.addEventListener('mousedown', handleClick);
      return () => document.removeEventListener('mousedown', handleClick);
    }
  }, [showBotPicker]);

  const handleSend = useCallback(async () => {
    const trimmed = text.trim();
    if (!trimmed || sending) return;

    try {
      await sendMessage({
        content_type: 'text',
        text_content: trimmed,
        parse_mode: useMarkdown ? 'MarkdownV2' : undefined,
        via_bot_id: isGroup && selectedBot ? selectedBot.id : undefined,
      });
      setText('');
      textareaRef.current?.focus();
    } catch {
      // Error handled in store
    }
  }, [text, sending, sendMessage, useMarkdown, isGroup, selectedBot]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && e.ctrlKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleFileUpload = useCallback(
    async (file: File) => {
      if (sending) return;
      const isImage = file.type.startsWith('image/');
      try {
        await sendMessage({
          content_type: isImage ? 'photo' : 'document',
          text_content: text.trim() || undefined,
          file,
          via_bot_id: isGroup && selectedBot ? selectedBot.id : undefined,
        });
        setText('');
      } catch {
        // Error handled in store
      }
    },
    [sending, sendMessage, text, isGroup, selectedBot]
  );

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) handleFileUpload(file);
    e.target.value = '';
  };

  const handlePaste = (e: React.ClipboardEvent) => {
    const items = e.clipboardData?.items;
    if (!items) return;
    for (const item of items) {
      if (item.type.startsWith('image/')) {
        e.preventDefault();
        const file = item.getAsFile();
        if (file) handleFileUpload(file);
        break;
      }
    }
  };

  // Auto-resize textarea
  const handleInput = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setText(e.target.value);
    const el = e.target;
    el.style.height = 'auto';
    el.style.height = Math.min(el.scrollHeight, 160) + 'px';
  };

  const displayBotName = isGroup && selectedBot
    ? (selectedBot.bot_username || selectedBot.display_name || botName)
    : botName;

  return (
    <div className="border-t border-[#1A1A1A] bg-[#0A0A0A]">
      {/* Input area */}
      <div className="px-6 py-4">
        <div className="flex items-end gap-2 bg-[#141414] border border-[#2f2f2f] rounded-[10px] px-3 py-2">
          <textarea
            ref={textareaRef}
            value={text}
            onChange={handleInput}
            onKeyDown={handleKeyDown}
            onPaste={handlePaste}
            placeholder="Type a message... (Markdown supported)"
            rows={1}
            className="flex-1 bg-transparent text-sm text-white placeholder:text-[#4a4a4a] focus:outline-none resize-none leading-relaxed py-1"
            style={{ minHeight: '28px', maxHeight: '160px' }}
          />

          {/* Toolbar */}
          <div className="flex items-center gap-0.5 shrink-0">
            {/* Markdown toggle */}
            <button
              onClick={() => setUseMarkdown(!useMarkdown)}
              className={`flex items-center justify-center w-8 h-8 rounded-md transition-colors ${
                useMarkdown
                  ? 'text-accent bg-accent/10'
                  : 'text-[#6a6a6a] hover:text-[#8a8a8a] hover:bg-[#1A1A1A]'
              }`}
              title={useMarkdown ? 'Markdown enabled' : 'Markdown disabled'}
            >
              <Type size={16} />
            </button>

            {/* Attach file */}
            <button
              onClick={() => fileInputRef.current?.click()}
              className="flex items-center justify-center w-8 h-8 rounded-md text-[#6a6a6a] hover:text-[#8a8a8a] hover:bg-[#1A1A1A] transition-colors"
              title="Attach file"
            >
              <Paperclip size={16} />
            </button>
            <input
              ref={fileInputRef}
              type="file"
              className="hidden"
              onChange={handleFileChange}
            />

            {/* Image upload */}
            <button
              onClick={() => imageInputRef.current?.click()}
              className="flex items-center justify-center w-8 h-8 rounded-md text-[#6a6a6a] hover:text-[#8a8a8a] hover:bg-[#1A1A1A] transition-colors"
              title="Upload image"
            >
              <Image size={16} />
            </button>
            <input
              ref={imageInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={handleFileChange}
            />

            {/* Send button */}
            <button
              onClick={handleSend}
              disabled={!text.trim() || sending}
              className="flex items-center justify-center w-8 h-8 rounded-md bg-accent text-black hover:bg-accent/90 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
              title="Send (Ctrl+Enter)"
            >
              <Send size={16} />
            </button>
          </div>
        </div>
      </div>

      {/* Bottom hint */}
      <div className="flex items-center justify-between px-6 pb-3 text-[11px] text-[#4a4a4a]">
        <span>Ctrl+Enter to send | Markdown & media supported</span>
        {displayBotName && (
          <div className="relative" ref={botPickerRef}>
            {isGroup && availableBots.length > 1 ? (
              <button
                onClick={() => setShowBotPicker(!showBotPicker)}
                className="flex items-center gap-1 hover:text-accent transition-colors cursor-pointer"
              >
                <span className="font-['JetBrains_Mono'] text-[11px]">
                  Replying via <span className="text-accent">{displayBotName}</span>
                </span>
                <ChevronDown size={10} />
              </button>
            ) : (
              <span className="font-['JetBrains_Mono'] text-[11px]">
                Replying via <span className="text-accent">{displayBotName}</span>
              </span>
            )}

            {/* Bot picker dropdown */}
            {showBotPicker && availableBots.length > 1 && (
              <div className="absolute bottom-full right-0 mb-1 w-52 bg-[#141414] border border-[#2f2f2f] rounded-lg shadow-lg py-1 z-50">
                {availableBots.map((bot) => (
                  <button
                    key={bot.id}
                    onClick={() => {
                      setSelectedBot(bot);
                      setShowBotPicker(false);
                    }}
                    className={`w-full text-left px-3 py-1.5 text-xs hover:bg-[#1A1A1A] transition-colors flex items-center justify-between ${
                      selectedBot?.id === bot.id ? 'text-accent' : 'text-[#8a8a8a]'
                    }`}
                  >
                    <span>@{bot.bot_username || bot.display_name || `Bot#${bot.id}`}</span>
                    {bot.is_primary && (
                      <span className="text-[9px] px-1 py-0.5 rounded bg-accent/10 text-accent">
                        primary
                      </span>
                    )}
                  </button>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
