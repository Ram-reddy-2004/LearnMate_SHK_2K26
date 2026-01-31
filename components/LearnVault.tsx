

import React, { useState, useCallback, useRef } from 'react';
import { processLearnVaultContent, generateKnowledgeBase } from '../services/geminiService';
import { UploadCloudIcon, FileIcon, ImageIcon, FileTextIcon, XIcon, BrainCircuitIcon, LinkIcon, PaperclipIcon, SparklesIcon } from './Icons';

const getFileIcon = (fileType: string) => {
    if (fileType.startsWith('image/')) return <ImageIcon className="h-6 w-6 text-purple-500" />;
    if (fileType === 'application/pdf' || fileType === 'text/plain') return <FileTextIcon className="h-6 w-6 text-blue-500" />;
    if (fileType.startsWith('audio/')) return <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-6 w-6 text-green-500"><path d="M9 18V5l12-2v13"/><circle cx="6" cy="18" r="3"/><circle cx="18" cy="16" r="3"/></svg>;
    return <FileIcon className="h-6 w-6 text-gray-500" />;
}

interface LearnVaultProps {
    onVaultCreated: (vaultData: { title: string; content: string; summary: string; }) => void;
}

type ActiveTab = 'files' | 'links' | 'generate';

const LearnVaultComponent: React.FC<LearnVaultProps> = ({ onVaultCreated }) => {
    const [activeTab, setActiveTab] = useState<ActiveTab>('files');
    const [files, setFiles] = useState<File[]>([]);
    const [links, setLinks] = useState<string[]>([]);
    const [topic, setTopic] = useState('');
    const [currentLink, setCurrentLink] = useState('');
    const [isLoading, setIsLoading] = useState<boolean>(false);
    const [isSuccess, setIsSuccess] = useState<boolean>(false);
    const [error, setError] = useState<string | null>(null);
    const [isDragging, setIsDragging] = useState<boolean>(false);
    const fileInputRef = useRef<HTMLInputElement>(null);

    const handleFileChange = (selectedFiles: FileList | null) => {
        if (selectedFiles) {
            setFiles(prev => [...prev, ...Array.from(selectedFiles)]);
            setIsSuccess(false);
            setError(null);
        }
    };
    
    const handleDragEnter = (e: React.DragEvent<HTMLDivElement>) => {
        e.preventDefault();
        e.stopPropagation();
        setIsDragging(true);
    };

    const handleDragLeave = (e: React.DragEvent<HTMLDivElement>) => {
        e.preventDefault();
        e.stopPropagation();
        setIsDragging(false);
    };

    const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
        e.preventDefault();
        e.stopPropagation();
    };

    const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
        e.preventDefault();
        e.stopPropagation();
        setIsDragging(false);
        if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
            handleFileChange(e.dataTransfer.files);
            e.dataTransfer.clearData();
        }
    };

    const removeFile = (fileToRemove: File) => {
        setFiles(prev => prev.filter(file => file !== fileToRemove));
    };

    const handleAddLink = (e: React.FormEvent) => {
        e.preventDefault();
        if (currentLink.trim()) {
            try {
                // Basic URL validation
                new URL(currentLink);
                setLinks(prev => [...prev, currentLink.trim()]);
                setCurrentLink('');
                 setIsSuccess(false);
                 setError(null);
            } catch (_) {
                setError("Please enter a valid URL.");
            }
        }
    };
    
    const removeLink = (linkToRemove: string) => {
        setLinks(prev => prev.filter(link => link !== linkToRemove));
    };


    const handleAddToVault = async () => {
        setIsLoading(true);
        setIsSuccess(false);
        setError(null);

        try {
            let vaultData;
            if (activeTab === 'generate') {
                if (!topic.trim()) {
                     setError("Please enter a topic to generate knowledge.");
                     setIsLoading(false);
                     return;
                };
                vaultData = await generateKnowledgeBase(topic);
                setTopic('');
            } else {
                 if (files.length === 0 && links.length === 0) {
                    setError("Please select files or add links to process.");
                    setIsLoading(false);
                    return;
                };
                vaultData = await processLearnVaultContent(files, links);
                setFiles([]);
                setLinks([]);
            }

            onVaultCreated(vaultData);
            setIsSuccess(true);
        } catch (err) {
            const errorMessage = err instanceof Error ? err.message : 'An unknown error occurred during processing.';
            setError(errorMessage);
        } finally {
            setIsLoading(false);
        }
    };

    const renderFileContent = () => (
        <>
            <div 
                onDragEnter={handleDragEnter}
                onDragLeave={handleDragLeave}
                onDragOver={handleDragOver}
                onDrop={handleDrop}
                onClick={() => fileInputRef.current?.click()}
                className={`relative flex flex-col items-center justify-center w-full h-56 border-2 border-dashed rounded-lg cursor-pointer transition-colors
                    ${isDragging ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/50' : 'border-gray-300 dark:border-gray-600 hover:border-gray-400 dark:hover:border-gray-500 bg-gray-50 dark:bg-gray-800'}`}>
                
                <UploadCloudIcon className="h-12 w-12 text-gray-400 dark:text-gray-500 mb-4" />
                <p className="mb-2 text-sm text-gray-500 dark:text-gray-400">
                    <span className="font-semibold">Click to upload</span> or drag and drop
                </p>
                <p className="text-xs text-gray-500 dark:text-gray-400">PDF, TXT, PNG, JPG, MP3, WAV</p>
                <input
                    type="file"
                    ref={fileInputRef}
                    onChange={(e) => handleFileChange(e.target.files)}
                    multiple
                    accept=".pdf,.txt,text/plain,image/*,audio/*"
                    className="hidden"
                />
            </div>
            {files.length > 0 && (
                <div className="mt-4 w-full text-left">
                    <h3 className="font-semibold text-gray-700 dark:text-gray-200 mb-2">Selected Files:</h3>
                    <div className="space-y-2 max-h-32 overflow-y-auto pr-2">
                        {files.map((file, index) => (
                            <div key={index} className="flex items-center justify-between bg-gray-100 dark:bg-gray-700 rounded-lg p-2 animate-fade-in">
                                <div className="flex items-center gap-3">
                                    {getFileIcon(file.type)}
                                    <span className="text-sm font-medium text-gray-800 dark:text-gray-200 truncate max-w-xs">{file.name}</span>
                                </div>
                                <button onClick={() => removeFile(file)} className="p-1 text-gray-500 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-600 rounded-full">
                                    <XIcon className="h-4 w-4" />
                                </button>
                            </div>
                        ))}
                    </div>
                </div>
            )}
        </>
    );

    const renderLinksContent = () => (
         <>
            <form onSubmit={handleAddLink} className="flex items-center gap-2">
                <div className="relative flex-grow">
                    <LinkIcon className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400"/>
                    <input 
                        type="url"
                        value={currentLink}
                        onChange={(e) => setCurrentLink(e.target.value)}
                        placeholder="https://youtube.com/watch?v=... or any article URL"
                        className="w-full pl-10 pr-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                </div>
                <button type="submit" className="px-4 py-3 bg-blue-500 text-white font-semibold rounded-lg hover:bg-blue-600 disabled:bg-blue-300 transition-colors">
                    Add
                </button>
            </form>
             {links.length > 0 && (
                <div className="mt-4 w-full text-left">
                    <h3 className="font-semibold text-gray-700 dark:text-gray-200 mb-2">Added Links:</h3>
                    <div className="space-y-2 max-h-32 overflow-y-auto pr-2">
                        {links.map((link, index) => (
                            <div key={index} className="flex items-center justify-between bg-gray-100 dark:bg-gray-700 rounded-lg p-2 animate-fade-in">
                                <div className="flex items-center gap-3">
                                    <LinkIcon className="h-5 w-5 text-gray-500"/>
                                    <span className="text-sm font-medium text-gray-800 dark:text-gray-200 truncate max-w-md">{link}</span>
                                </div>
                                <button onClick={() => removeLink(link)} className="p-1 text-gray-500 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-600 rounded-full">
                                    <XIcon className="h-4 w-4" />
                                </button>
                            </div>
                        ))}
                    </div>
                </div>
            )}
        </>
    );

    const renderGenerateContent = () => (
        <div className="w-full">
            <p className="text-gray-600 dark:text-gray-400 mb-4 text-left">
                No notes? No problem. Enter a topic, and I'll create a knowledge base for you.
            </p>
            <textarea
                value={topic}
                onChange={(e) => setTopic(e.target.value)}
                placeholder="Enter ur topic for learning...."
                rows={4}
                className="w-full p-3 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
        </div>
    );
    
    const isButtonDisabled = (isLoading || 
        (activeTab !== 'generate' && files.length === 0 && links.length === 0) || 
        (activeTab === 'generate' && !topic.trim()));

    return (
        <div className="w-full h-full flex flex-col items-center justify-center p-4">
             <div className="w-full max-w-2xl text-center">
                <div className="flex justify-center items-center gap-3 mb-4">
                    <BrainCircuitIcon className="h-10 w-10 text-blue-500"/>
                    <h1 className="text-3xl font-bold text-gray-800 dark:text-white">Create a Knowledge Vault</h1>
                </div>
                <p className="text-gray-600 dark:text-gray-400 mb-8 max-w-lg mx-auto">
                    Add your learning materials here to create a new, focused knowledge base for our chat.
                </p>

                <div className="w-full">
                    <div className="flex border-b border-gray-200 dark:border-gray-700 mb-6">
                        <button onClick={() => setActiveTab('files')} className={`flex items-center gap-2 px-4 py-3 font-semibold transition-colors ${activeTab === 'files' ? 'text-blue-500 border-b-2 border-blue-500' : 'text-gray-500 dark:text-gray-400 hover:text-blue-500'}`}>
                            <PaperclipIcon className="h-5 w-5" />
                            Upload Files
                        </button>
                        <button onClick={() => setActiveTab('links')} className={`flex items-center gap-2 px-4 py-3 font-semibold transition-colors ${activeTab === 'links' ? 'text-blue-500 border-b-2 border-blue-500' : 'text-gray-500 dark:text-gray-400 hover:text-blue-500'}`}>
                            <LinkIcon className="h-5 w-5" />
                            Add Links
                        </button>
                         <button onClick={() => setActiveTab('generate')} className={`flex items-center gap-2 px-4 py-3 font-semibold transition-colors ${activeTab === 'generate' ? 'text-blue-500 border-b-2 border-blue-500' : 'text-gray-500 dark:text-gray-400 hover:text-blue-500'}`}>
                            <SparklesIcon className="h-5 w-5" />
                            Generate Knowledge
                        </button>
                    </div>
                    
                    {activeTab === 'files' && renderFileContent()}
                    {activeTab === 'links' && renderLinksContent()}
                    {activeTab === 'generate' && renderGenerateContent()}
                </div>
                
                <div className="mt-8">
                    <button
                        onClick={handleAddToVault}
                        disabled={isButtonDisabled}
                        className="w-full max-w-xs px-6 py-3 bg-blue-500 text-white font-semibold rounded-lg shadow-md hover:bg-blue-600 disabled:bg-blue-300 dark:disabled:bg-blue-800 disabled:cursor-not-allowed transition-all flex items-center justify-center"
                    >
                        {isLoading ? (
                            <>
                                <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                                </svg>
                                Processing...
                            </>
                        ) : (
                            'Create & Add to Vault'
                        )}
                    </button>
                </div>
                
                {isSuccess && (
                     <p className="mt-4 text-green-600 dark:text-green-400 font-medium animate-fade-in">
                        ✅ Vault created! Redirecting to LearnGuide...
                    </p>
                )}
                {error && (
                    <p className="mt-4 text-red-500 dark:text-red-400 font-medium animate-fade-in">
                        Error: {error}
                    </p>
                )}

            </div>
        </div>
    );
};

export default LearnVaultComponent;