
import React, { useRef, useEffect } from 'react';
import { type Message, Sender } from '../types';
import { BrainCircuitIcon, UserIcon, PaperclipIcon } from './Icons';

interface MessageProps {
    message: Message;
}

const ChatMessage: React.FC<MessageProps> = ({ message }) => {
    const isUser = message.sender === Sender.User;
    const isError = message.isError ?? false;

    const Avatar = isUser ? UserIcon : BrainCircuitIcon;
    const avatarBg = isUser ? 'bg-gray-300 dark:bg-gray-600' : 'bg-blue-500';
    const messageBg = isUser ? 'bg-gray-200 dark:bg-gray-700' : 'bg-blue-500 text-white';
    const alignment = isUser ? 'justify-end' : 'justify-start';
    const textColor = isError ? 'text-red-500' : '';

    return (
        <div className={`flex items-start gap-4 animate-fade-in ${alignment}`}>
            {!isUser && (
                 <div className={`flex-shrink-0 h-10 w-10 rounded-full flex items-center justify-center text-white ${avatarBg}`}>
                    <Avatar className="h-6 w-6" />
                </div>
            )}
            <div className={`max-w-xl w-full flex flex-col ${isUser ? 'items-end' : 'items-start'}`}>
                <div className={`rounded-xl px-4 py-3 ${messageBg} ${textColor}`}>
                    <p className="whitespace-pre-wrap">{message.text}</p>
                     {message.files && message.files.length > 0 && (
                        <div className="mt-2 pt-2 border-t border-gray-300 dark:border-gray-600">
                            {message.files.map((file, index) => (
                                <div key={index} className="flex items-center text-sm text-gray-600 dark:text-gray-300 bg-gray-100 dark:bg-gray-600 rounded-md p-1.5 mt-1">
                                    <PaperclipIcon className="h-4 w-4 mr-2 flex-shrink-0" />
                                    <span className="truncate">{file.name}</span>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                    {new Date(message.timestamp).toLocaleTimeString()}
                </p>
            </div>
             {isUser && (
                 <div className={`flex-shrink-0 h-10 w-10 rounded-full flex items-center justify-center text-gray-600 dark:text-gray-300 ${avatarBg}`}>
                    <Avatar className="h-6 w-6" />
                </div>
            )}
        </div>
    );
};


const LoadingIndicator: React.FC = () => (
  <div className="flex items-start gap-4 justify-start animate-fade-in">
    <div className="flex-shrink-0 h-10 w-10 rounded-full flex items-center justify-center bg-blue-500 text-white">
      <BrainCircuitIcon className="h-6 w-6" />
    </div>
    <div className="max-w-xl w-full flex flex-col items-start">
      <div className="rounded-xl px-4 py-3 bg-blue-500 text-white">
        <div className="flex items-center space-x-2">
          <span className="h-2 w-2 bg-white rounded-full animate-pulse [animation-delay:-0.3s]"></span>
          <span className="h-2 w-2 bg-white rounded-full animate-pulse [animation-delay:-0.15s]"></span>
          <span className="h-2 w-2 bg-white rounded-full animate-pulse"></span>
        </div>
      </div>
    </div>
  </div>
);


interface ChatWindowProps {
  messages: Message[];
  isLoading: boolean;
}

const ChatWindow: React.FC<ChatWindowProps> = ({ messages, isLoading }) => {
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, isLoading]);

  return (
    <div className="space-y-6">
      {messages.map((msg) => (
        <ChatMessage key={msg.id} message={msg} />
      ))}
      {isLoading && <LoadingIndicator />}
      <div ref={messagesEndRef} />
    </div>
  );
};

export default ChatWindow;
