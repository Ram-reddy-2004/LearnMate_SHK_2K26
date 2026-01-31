
import React, { useState, useRef, useCallback } from 'react';
import { PaperclipIcon, SendHorizonalIcon, XIcon, FileTextIcon, ImageIcon, FileIcon } from './Icons';

interface PromptInputProps {
  onSubmit: (prompt: string, files: File[]) => void;
  isLoading: boolean;
}

const getFileIcon = (fileType: string) => {
    if (fileType.startsWith('image/')) return <ImageIcon className="h-5 w-5 text-purple-500" />;
    if (fileType === 'application/pdf' || fileType === 'text/plain') return <FileTextIcon className="h-5 w-5 text-blue-500" />;
    return <FileIcon className="h-5 w-5 text-gray-500" />;
}

const PromptInput: React.FC<PromptInputProps> = ({ onSubmit, isLoading }) => {
  const [prompt, setPrompt] = useState('');
  const [files, setFiles] = useState<File[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  
  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    if (event.target.files) {
      setFiles(prev => [...prev, ...Array.from(event.target.files!)]);
    }
  };

  const removeFile = (fileToRemove: File) => {
    setFiles(prev => prev.filter(file => file !== fileToRemove));
  };
  
  const handleTextChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setPrompt(e.target.value);
    const textarea = textareaRef.current;
    if (textarea) {
        textarea.style.height = 'auto';
        textarea.style.height = `${textarea.scrollHeight}px`;
    }
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (isLoading || (!prompt.trim() && files.length === 0)) return;
    onSubmit(prompt, files);
    setPrompt('');
    setFiles([]);
    if (textareaRef.current) {
        textareaRef.current.style.height = 'auto';
    }
  };
  
  return (
    <div className="w-full max-w-4xl mx-auto">
      {files.length > 0 && (
        <div className="mb-2 p-2 border border-gray-200 dark:border-gray-700 rounded-lg">
            <p className="text-sm font-medium mb-2 text-gray-600 dark:text-gray-300">Attachments:</p>
            <div className="flex flex-wrap gap-2">
                {files.map((file, index) => (
                    <div key={index} className="flex items-center bg-gray-100 dark:bg-gray-700 rounded-full pl-3 pr-1 py-1 text-sm">
                        {getFileIcon(file.type)}
                        <span className="ml-2 truncate max-w-xs">{file.name}</span>
                        <button onClick={() => removeFile(file)} className="ml-2 p-1 rounded-full hover:bg-gray-300 dark:hover:bg-gray-600">
                            <XIcon className="h-4 w-4" />
                        </button>
                    </div>
                ))}
            </div>
        </div>
      )}

      <form onSubmit={handleSubmit} className="flex items-end space-x-2 bg-gray-100 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-xl p-2">
        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          disabled={isLoading}
          className="p-2 text-gray-500 dark:text-gray-400 hover:text-blue-500 dark:hover:text-blue-400 rounded-full hover:bg-gray-200 dark:hover:bg-gray-600 disabled:opacity-50 transition-colors"
        >
          <PaperclipIcon className="h-6 w-6" />
        </button>
        <input
          type="file"
          ref={fileInputRef}
          onChange={handleFileChange}
          multiple
          accept=".pdf,.txt,text/plain,image/*"
          className="hidden"
        />
        <textarea
          ref={textareaRef}
          value={prompt}
          onChange={handleTextChange}
          placeholder="Ask a question or describe your task..."
          rows={1}
          disabled={isLoading}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
                handleSubmit(e);
            }
          }}
          className="flex-1 bg-transparent resize-none outline-none text-gray-900 dark:text-gray-100 placeholder-gray-500 dark:placeholder-gray-400 disabled:opacity-50 max-h-48"
        />
        <button
          type="submit"
          disabled={isLoading || (!prompt.trim() && files.length === 0)}
          className="p-3 bg-blue-500 text-white rounded-lg hover:bg-blue-600 disabled:bg-blue-300 dark:disabled:bg-blue-800 disabled:cursor-not-allowed transition-colors"
        >
          <SendHorizonalIcon className="h-6 w-6" />
        </button>
      </form>
    </div>
  );
};

export default PromptInput;
