import React, { useState, useEffect, useRef } from 'react';
import { BookOpenIcon, MenuIcon, LogOutIcon, ChevronDownIcon, PlusCircleIcon, AssistantIcon } from './Icons';
import { UserData } from '../types';

interface HeaderProps {
  onMenuClick: () => void;
  userData: UserData | null;
  onSignOut: () => void;
  onNewChat: () => void;
  onAssistantClick: () => void; // New prop for the assistant
}

const getInitials = (name?: string) => {
    if (!name) return 'AI';
    const parts = name.split(' ');
    if (parts.length > 1) {
        return `${parts[0][0] || ''}${parts[parts.length - 1][0] || ''}`.toUpperCase();
    }
    return `${name[0] || ''}${name[1] || ''}`.toUpperCase();
}

const Header: React.FC<HeaderProps> = ({ 
    onMenuClick, 
    userData, 
    onSignOut,
    onNewChat,
    onAssistantClick
}) => {
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
        if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
            setIsDropdownOpen(false);
        }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleNewChat = () => {
      onNewChat();
      setIsDropdownOpen(false);
  }

  return (
    <header className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 sticky top-0 z-20">
      <div className="flex items-center space-x-3">
        <button onClick={onMenuClick} className="p-1 text-gray-700 dark:text-gray-300 md:hidden" aria-label="Open sidebar">
          <MenuIcon className="h-6 w-6" />
        </button>
        <div className="hidden sm:flex items-center space-x-3">
          <BookOpenIcon className="h-8 w-8 text-blue-500" />
          <h1 className="text-xl font-bold text-gray-800 dark:text-white">
            LearnMate AI
          </h1>
        </div>
      </div>
      <div className="flex items-center space-x-2">
        <button 
            onClick={onAssistantClick}
            className="p-2 text-gray-600 dark:text-gray-300 rounded-full hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
            aria-label="Open AI Assistant"
        >
            <AssistantIcon className="h-6 w-6" />
        </button>

        <div className="relative" ref={dropdownRef}>
            <button 
                onClick={() => setIsDropdownOpen(!isDropdownOpen)}
                className="flex items-center space-x-2 p-1 rounded-full hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
            >
                <div className="flex items-center justify-center h-10 w-10 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 text-white font-bold text-lg">
                    {getInitials(userData?.profile?.name)}
                </div>
                <ChevronDownIcon className={`h-5 w-5 text-gray-500 dark:text-gray-400 transition-transform ${isDropdownOpen ? 'rotate-180' : ''}`} />
            </button>
            
            {isDropdownOpen && (
                <div className="absolute right-0 mt-2 w-72 bg-white dark:bg-gray-800 rounded-lg shadow-xl border border-gray-200 dark:border-gray-700 overflow-hidden animate-fade-in-down z-30">
                    <div className="p-3 border-b border-gray-200 dark:border-gray-600">
                        <p className="font-semibold text-gray-800 dark:text-white truncate">{userData?.profile?.name}</p>
                        <p className="text-sm text-gray-500 dark:text-gray-400 truncate">{userData?.profile?.email}</p>
                    </div>
                    <div className="p-2 space-y-1">
                        <button onClick={handleNewChat} className="w-full flex items-center gap-3 px-3 py-2 text-sm text-left text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-md">
                            <PlusCircleIcon className="h-5 w-5"/> New Chat Session
                        </button>
                    </div>
                    <div className="border-t border-gray-200 dark:border-gray-600 p-2">
                        <button onClick={onSignOut} className="w-full flex items-center gap-3 px-3 py-2 text-sm text-left text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-md">
                           <LogOutIcon className="h-5 w-5" /> Sign Out
                        </button>
                    </div>
                </div>
            )}
        </div>
      </div>
    </header>
  );
};

export default Header;