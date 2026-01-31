import React from 'react';

// A large indicator for when a whole module is loading content from the AI
export const ModuleLoadingIndicator: React.FC<{ text: string }> = ({ text }) => (
    <div className="flex flex-col items-center justify-center text-center p-8" aria-live="polite" aria-busy="true">
        <div className="relative h-20 w-20 animate-spin">
            {/* Using divs as dots, positioned on the circle */}
            <div className="absolute top-0 left-1/2 -ml-2 h-4 w-4 bg-blue-500 rounded-full"></div>
            <div className="absolute top-1/2 -mt-2 right-0 h-4 w-4 bg-blue-500 rounded-full opacity-75"></div>
            <div className="absolute bottom-0 left-1/2 -ml-2 h-4 w-4 bg-blue-500 rounded-full opacity-50"></div>
            <div className="absolute top-1/2 -mt-2 left-0 h-4 w-4 bg-blue-500 rounded-full opacity-25"></div>
        </div>
        <p className="mt-8 text-lg font-medium text-gray-700 dark:text-gray-300 tracking-wide">{text}</p>
    </div>
);

// A smaller, inline indicator for buttons or small sections
export const InlineLoadingIndicator: React.FC = () => (
    <div className="flex items-center justify-center space-x-1">
        <div className="h-2 w-2 bg-current rounded-full animate-bounce" style={{ animationDelay: '-0.3s' }}></div>
        <div className="h-2 w-2 bg-current rounded-full animate-bounce" style={{ animationDelay: '-0.15s' }}></div>
        <div className="h-2 w-2 bg-current rounded-full animate-bounce"></div>
    </div>
);
