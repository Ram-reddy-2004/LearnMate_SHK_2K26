
import React, { useState, useEffect, useMemo, useRef } from 'react';
import { generateLearnGuideContent, explainCodeSnippet, getConceptExplanation, reexplainConcept, generateMoreInterviewQuestions } from '../services/geminiService';
// Fix: Import LearnGuideContent from types instead of geminiService
import { type Concept, type LearnGoal, type LearnGuideContent as GuideContentData } from '../types';
import { BrainCircuitIcon, CheckIcon, HelpCircleIcon, ArrowRightIcon, Volume2Icon, PauseIcon, SparklesIcon, ClipboardIcon, BookOpenIcon, PencilLineIcon, CodeIcon, PulseIcon, LinkIcon } from './Icons';
import { ModuleLoadingIndicator } from './LoadingIndicators';

interface LearnGuideProps {
    knowledgeBase: string;
    onNavigateToVault: () => void;
    sources?: { title: string; uri: string }[];
}

type LearnGuideView = 'goal_selection' | 'generating' | 'active' | 'error';
type UserUnderstanding = 'unknown' | 'understood' | 'needs_help';

// --- RENDERER & HELPER COMPONENTS ---

const CodeCard: React.FC<{ language: string, code: string }> = ({ language, code }) => {
    const [copied, setCopied] = useState(false);
    const [showExplanation, setShowExplanation] = useState(false);
    const [explanation, setExplanation] = useState<string>('');
    const [isExplaining, setIsExplaining] = useState(false);

    const handleCopy = () => {
        navigator.clipboard.writeText(code).then(() => {
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
        });
    };

    const handleExplain = async () => {
        if (showExplanation) {
            setShowExplanation(false);
            return;
        }
        
        if (explanation) {
            setShowExplanation(true);
            return;
        }

        setIsExplaining(true);
        try {
            const explanationText = await explainCodeSnippet(code);
            setExplanation(explanationText);
            setShowExplanation(true);
        } catch (error) {
            console.error(error);
            setExplanation("Sorry, I couldn't generate an explanation for this code.");
            setShowExplanation(true);
        } finally {
            setIsExplaining(false);
        }
    };
    
    const highlightSyntax = (codeStr: string) => {
        const parts: (string | { type: 'string' | 'comment', content: string })[] = [];
        let lastIndex = 0;
        const tokenizerRegex = /(\/\*[\s\S]*?\*\/|\/\/.*)|("(?:\\.|[^"])*"|'(?:\\.|[^'])*'|`(?:\\.|[^`])*`)/g;

        let match;
        while ((match = tokenizerRegex.exec(codeStr)) !== null) {
            if (match.index > lastIndex) {
                parts.push(codeStr.substring(lastIndex, match.index));
            }
            if (match[1]) {
                parts.push({ type: 'comment', content: match[1] });
            } else if (match[2]) {
                parts.push({ type: 'string', content: match[2] });
            }
            lastIndex = tokenizerRegex.lastIndex;
        }

        if (lastIndex < codeStr.length) {
            parts.push(codeStr.substring(lastIndex));
        }

        const highlightCodeSegment = (segment: string) => {
            const keywords = ['let', 'const', 'var', 'function', 'return', 'if', 'else', 'for', 'while', 'import', 'export', 'from', 'async', 'await', 'class', 'extends', 'super', 'new', 'try', 'catch', 'finally', 'throw', 'public', 'private', 'protected', 'static', 'void', 'int', 'string', 'boolean', 'true', 'false', 'null'];
            const keywordRegex = new RegExp(`\\b(${keywords.join('|')})\\b`, 'g');
            
            let tempHighlighted = segment
                .replace(keywordRegex, '[[KEYWORD]]$1[[/KEYWORD]]')
                .replace(/\b(\d+)\b/g, '[[NUMBER]]$1[[/NUMBER]]')
                .replace(/(\w+)(?=\()/g, '[[FUNCTION_CALL]]$1[[/FUNCTION_CALL]]');

            const escaped = tempHighlighted.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

            return escaped
                .replace(/\[\[KEYWORD\]\]/g, '<span class="text-blue-600 dark:text-blue-400 font-semibold">')
                .replace(/\[\[\/KEYWORD\]\]/g, '</span>')
                .replace(/\[\[NUMBER\]\]/g, '<span class="text-purple-600 dark:text-purple-400">')
                .replace(/\[\[\/NUMBER\]\]/g, '</span>')
                .replace(/\[\[FUNCTION_CALL\]\]/g, '<span class="text-yellow-700 dark:text-yellow-400">')
                .replace(/\[\[\/FUNCTION_CALL\]\]/g, '</span>');
        };

        return parts.map(part => {
            if (typeof part === 'string') {
                return highlightCodeSegment(part);
            }
            const escapedContent = part.content.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
            if (part.type === 'comment') {
                return `<span class="text-gray-500 italic">${escapedContent}</span>`;
            }
            if (part.type === 'string') {
                return `<span class="text-green-600 dark:text-green-400">${escapedContent}</span>`;
            }
            return '';
        }).join('');
    };

    return (
        <div className="bg-white dark:bg-gray-900/70 my-4 rounded-xl shadow-md border border-gray-200 dark:border-gray-700 overflow-hidden">
            <div className="px-4 py-2 flex justify-between items-center bg-gray-50 dark:bg-gray-800/50 border-b border-gray-200 dark:border-gray-700">
                <span className="text-xs font-sans text-gray-500 dark:text-gray-400 font-semibold uppercase">{language || 'code'}</span>
                <div className="flex items-center gap-3">
                    <button onClick={handleExplain} disabled={isExplaining} className="flex items-center gap-1.5 text-sm font-medium text-gray-600 dark:text-gray-300 hover:text-blue-500 dark:hover:text-blue-400 transition-colors disabled:opacity-50">
                        <SparklesIcon className="h-4 w-4 text-purple-500" />
                        {isExplaining ? 'Thinking...' : (showExplanation ? 'Hide' : 'Explain')}
                    </button>
                    <button onClick={handleCopy} className="flex items-center gap-1.5 text-sm font-medium text-gray-600 dark:text-gray-300 hover:text-blue-500 dark:hover:text-blue-400 transition-colors">
                        {copied ? <CheckIcon className="h-4 w-4 text-green-500" /> : <ClipboardIcon className="h-4 w-4" />}
                        {copied ? 'Copied' : 'Copy code'}
                    </button>
                </div>
            </div>
            <div className="p-4 overflow-x-auto">
                <pre><code 
                    className="font-mono text-sm text-gray-800 dark:text-gray-200"
                    dangerouslySetInnerHTML={{ __html: highlightSyntax(code) }} 
                /></pre>
            </div>
            {showExplanation && (
                <div className="border-t border-gray-200 dark:border-gray-700 p-4 text-sm bg-gray-50 dark:bg-gray-800/50"
                     dangerouslySetInnerHTML={{ __html: explanation.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>').replace(/`([^`]+)`/g, '<code class="bg-gray-200 dark:bg-gray-700 rounded px-1.5 py-1 font-mono text-sm">$1</code>') }}
                />
            )}
        </div>
    );
};

const HighlightableText: React.FC<{
    text: string;
    currentWordIndex: number;
    wordOffset: number;
}> = ({ text = '', currentWordIndex, wordOffset }) => {
    const parts = useMemo(() => text.split(/(\*\*.*?\*\*)/g).filter(Boolean), [text]);
    let cumulativeWordCount = wordOffset;

    return (
        <>
            {parts.map((part, i) => {
                const isBold = part.startsWith('**') && part.endsWith('**');
                const content = isBold ? part.substring(2, part.length - 2) : part;
                const words = content.split(/\s+/).filter(Boolean);

                const renderedWords = words.map((word, j) => {
                    const wordGlobalIndex = cumulativeWordCount + j;
                    const isHighlighted = wordGlobalIndex === currentWordIndex;
                    return (
                        <span key={j} className={`transition-colors duration-150 ${isHighlighted ? 'bg-yellow-300 dark:bg-yellow-400 rounded' : 'bg-transparent'}`}>
                            {word}{' '}
                        </span>
                    );
                });
                
                cumulativeWordCount += words.length;

                if (isBold) {
                    return <strong key={i}>{renderedWords}</strong>;
                }
                return <React.Fragment key={i}>{renderedWords}</React.Fragment>;
            })}
        </>
    );
};

const TTSControls: React.FC<{
    isSpeaking: boolean;
    isPaused: boolean;
    voices: SpeechSynthesisVoice[];
    selectedVoiceURI: string | null;
    onSpeak: () => void;
    onSelectVoice: (uri: string) => void;
}> = ({ isSpeaking, isPaused, voices, selectedVoiceURI, onSpeak, onSelectVoice }) => {
    return (
        <div className="pb-4 mb-4 flex justify-end items-center gap-2 border-b border-gray-200 dark:border-gray-700">
            {voices.length > 0 && (
                <select value={selectedVoiceURI || ''} onChange={(e) => onSelectVoice(e.target.value)} disabled={isSpeaking} className="bg-gray-100 dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-md text-sm px-2 py-1 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50" aria-label="Select voice">
                    {voices.map(voice => <option key={voice.voiceURI} value={voice.voiceURI}>{voice.name} ({voice.lang})</option>)}
                </select>
            )}
            <button onClick={onSpeak} className="p-2 text-gray-500 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-700 rounded-full transition-colors" aria-label={isSpeaking && !isPaused ? 'Pause speech' : 'Read text aloud'}>
                {isSpeaking && !isPaused ? <PauseIcon className="h-6 w-6" /> : <Volume2Icon className="h-6 w-6" />}
            </button>
        </div>
    );
};


type RenderableBlock = 
    | { type: 'h1' | 'h2' | 'h3' | 'h4' | 'li' | 'p'; text: string; id: string }
    | { type: 'code'; text: string; lang?: string; id: string };

const parseTextToBlocks = (text: string, baseId: string): RenderableBlock[] => {
    const blocks: RenderableBlock[] = [];
    const codeBlockRegex = /```(\w*)\n([\s\S]*?)```/g;
    let lastIndex = 0;
    let match;
    let partCounter = 0;

    while ((match = codeBlockRegex.exec(text)) !== null) {
        if (match.index > lastIndex) {
            const textPart = text.substring(lastIndex, match.index);
            blocks.push({ type: 'p', text: textPart, id: `${baseId}_part_${partCounter++}` });
        }
        const [, lang, code] = match;
        blocks.push({ type: 'code', text: code, lang, id: `${baseId}_part_${partCounter++}`});
        lastIndex = codeBlockRegex.lastIndex;
    }

    if (lastIndex < text.length) {
        blocks.push({ type: 'p', text: text.substring(lastIndex), id: `${baseId}_part_${partCounter++}` });
    }
    
    return blocks;
};

// --- MAIN COMPONENT ---

const LearnGuide: React.FC<LearnGuideProps> = ({ knowledgeBase, onNavigateToVault, sources }) => {
    const [view, setView] = useState<LearnGuideView>('goal_selection');
    const [guideContent, setGuideContent] = useState<GuideContentData | null>(null);
    const [errorMessage, setErrorMessage] = useState<string>('');

    // State for structured learning path
    const [conceptTitles, setConceptTitles] = useState<string[]>([]);
    const [currentConcept, setCurrentConcept] = useState<Concept | null>(null);
    const [currentIndex, setCurrentIndex] = useState(0);
    const [understoodIndices, setUnderstoodIndices] = useState<Set<number>>(new Set());
    const [understanding, setUnderstanding] = useState<UserUnderstanding>('unknown');

    // State for Interview Prep
    const [isGeneratingMore, setIsGeneratingMore] = useState(false);

    // State for Text-to-Speech
    const [isSpeaking, setIsSpeaking] = useState(false);
    const [isPaused, setIsPaused] = useState(false);
    const [currentWordIndex, setCurrentWordIndex] = useState(-1);
    const [voices, setVoices] = useState<SpeechSynthesisVoice[]>([]);
    const [selectedVoiceURI, setSelectedVoiceURI] = useState<string | null>(null);
    const voicesLoaded = useRef(false);

    const { contentToSpeak, wordOffsets, renderableContent } = useMemo(() => {
        let contentToSpeak = '';
        const wordOffsets: Record<string, number> = {};
        let cumulativeWords = 0;
        let renderableContent: { markdownBlocks?: RenderableBlock[], qaBlocks?: Record<number, RenderableBlock[]> } = {};

        const countWords = (s: string) => s.replace(/\*\*(.*?)\*\*/g, '$1').split(/\s+/).filter(Boolean).length;
        const processAndAdd = (text: string, id: string) => {
            wordOffsets[id] = cumulativeWords;
            const cleanText = text.replace(/\*\*(.*?)\*\*/g, '$1');
            contentToSpeak += cleanText + '. ';
            cumulativeWords += countWords(cleanText);
        };

        if (!guideContent) return { contentToSpeak, wordOffsets, renderableContent };

        switch (guideContent.type) {
            case 'structured': {
                if (!currentConcept) break;
                const sections = [
                    { id: 'title', text: currentConcept.title },
                    { id: 'def_head', text: "Definition" },
                    { id: 'def_body', text: currentConcept.definition },
                    { id: 'exp_head', text: "Explanation" },
                    ...currentConcept.explanation.map((p, i) => ({ id: `exp_bullet_${i}`, text: p })),
                    { id: 'ex_head', text: "Examples" },
                    ...currentConcept.examples.map((e, i) => ({ id: `ex_bullet_${i}`, text: e }))
                ];
                sections.forEach(section => {
                    const isCodeBlock = section.text.trim().startsWith('```');
                    processAndAdd(isCodeBlock ? "Here’s a code example." : section.text, section.id);
                });
                break;
            }
            case 'markdown': {
                const blocks: RenderableBlock[] = [];
                const counters = { h1: 0, h2: 0, h3: 0, h4: 0, li: 0, p: 0, code: 0 };
                
                const parts = guideContent.data.split(/(```\w*\n[\s\S]*?```)/g).filter(Boolean);
            
                parts.forEach(part => {
                    if (part.startsWith('```')) {
                        const codeMatch = part.match(/```(\w*)\n?([\s\S]*?)```/);
                        if (codeMatch) {
                            const [, lang, code] = codeMatch;
                            const id = `code_${counters.code++}`;
                            blocks.push({ type: 'code', text: code.trim(), lang, id });
                            processAndAdd("Here is a code example.", id);
                        }
                    } else {
                        const lines = part.split('\n').filter(line => line.trim() !== '');
                        lines.forEach(line => {
                            let match;
                            if ((match = line.match(/^# (.*)/))) { const id = `h1_${counters.h1++}`; blocks.push({ type: 'h1', text: match[1].trim(), id }); processAndAdd(match[1].trim(), id); }
                            else if ((match = line.match(/^## (.*)/))) { const id = `h2_${counters.h2++}`; blocks.push({ type: 'h2', text: match[1].trim(), id }); processAndAdd(match[1].trim(), id); }
                            else if ((match = line.match(/^### (.*)/))) { const id = `h3_${counters.h3++}`; blocks.push({ type: 'h3', text: match[1].trim(), id }); processAndAdd(match[1].trim(), id); }
                            else if ((match = line.match(/^#### (.*)/))) { const id = `h4_${counters.h4++}`; blocks.push({ type: 'h4', text: match[1].trim(), id }); processAndAdd(match[1].trim(), id); }
                            else if ((match = line.match(/^\* (.*)/))) { const id = `li_${counters.li++}`; blocks.push({ type: 'li', text: match[1].trim(), id }); processAndAdd(match[1].trim(), id); }
                            else { const id = `p_${counters.p++}`; blocks.push({ type: 'p', text: line.trim(), id }); processAndAdd(line.trim(), id); }
                        });
                    }
                });
                renderableContent.markdownBlocks = blocks;
                break;
            }
            case 'qa': {
                const qaBlocks: Record<number, RenderableBlock[]> = {};
                guideContent.data.forEach((item, index) => {
                    const questionId = `question_${index}`;
                    processAndAdd(item.question, questionId);

                    const answerBlocks = parseTextToBlocks(item.answer, `answer_${index}`);
                    qaBlocks[index] = answerBlocks;
                    
                    answerBlocks.forEach(block => {
                        processAndAdd(block.type === 'code' ? 'Here is a code example' : block.text, block.id);
                    });
                });
                renderableContent.qaBlocks = qaBlocks;
                break;
            }
        }
        return { contentToSpeak, wordOffsets, renderableContent };
    }, [guideContent, currentConcept]);
    
    useEffect(() => {
        if (!('speechSynthesis' in window)) return;
        const loadVoices = () => {
            const availableVoices = speechSynthesis.getVoices().filter(v => v.lang.startsWith('en-'));
            setVoices(availableVoices);
            if (!voicesLoaded.current && availableVoices.length > 0) {
                const defaultVoice = availableVoices.find(v => v.lang === 'en-IN') || availableVoices.find(v => v.name === 'Google US English') || availableVoices.find(v => v.lang === 'en-US') || availableVoices[0];
                if (defaultVoice) setSelectedVoiceURI(defaultVoice.voiceURI);
                voicesLoaded.current = true;
            }
        };
        speechSynthesis.addEventListener('voiceschanged', loadVoices);
        loadVoices();
        return () => {
            speechSynthesis.removeEventListener('voiceschanged', loadVoices);
            if (speechSynthesis.speaking) speechSynthesis.cancel();
        };
    }, []);

    useEffect(() => {
        if ('speechSynthesis' in window && speechSynthesis.speaking) speechSynthesis.cancel();
        setIsSpeaking(false);
        setIsPaused(false);
        setCurrentWordIndex(-1);
    }, [currentConcept, guideContent]);

    const handleGoalSelect = async (goal: LearnGoal) => {
        setView('generating');
        setGuideContent(null);
        setErrorMessage('');
        try {
            const content = await generateLearnGuideContent(knowledgeBase, goal);
            setGuideContent(content);
            if (content.type === 'structured') {
                setConceptTitles(content.data.concepts);
                setCurrentConcept(content.data.firstConcept);
                setCurrentIndex(0);
                setUnderstoodIndices(new Set());
            }
            setView('active');
        } catch (err) {
            setErrorMessage(err instanceof Error ? err.message : 'An unknown error occurred.');
            setView('error');
        }
    };

    const handleSpeak = () => {
        if (!('speechSynthesis' in window)) return;
        if (isSpeaking && !isPaused) {
            speechSynthesis.pause();
            setIsPaused(true);
        } else if (isSpeaking && isPaused) {
            speechSynthesis.resume();
            setIsPaused(false);
        } else {
            speechSynthesis.cancel();
            const utterance = new SpeechSynthesisUtterance(contentToSpeak);
            const selectedVoice = voices.find(v => v.voiceURI === selectedVoiceURI);
            if (selectedVoice) utterance.voice = selectedVoice;
            utterance.onstart = () => { setIsSpeaking(true); setIsPaused(false); setCurrentWordIndex(0); };
            utterance.onboundary = (event) => {
                if (event.name === 'word') {
                    const textUpToBoundary = contentToSpeak.substring(0, event.charIndex);
                    const wordCount = textUpToBoundary.split(/\s+/).filter(Boolean).length;
                    setCurrentWordIndex(wordCount);
                }
            };
            utterance.onend = () => { setIsSpeaking(false); setIsPaused(false); setCurrentWordIndex(-1); };
            utterance.onerror = (e) => { console.error('TTS error:', e); setIsSpeaking(false); setIsPaused(false); setCurrentWordIndex(-1); };
            speechSynthesis.speak(utterance);
        }
    };

    const fetchConcept = async (index: number) => {
        setView('generating');
        setUnderstanding('unknown');
        try {
            const learnedConcepts = conceptTitles.slice(0, index);
            const nextConcept = await getConceptExplanation(knowledgeBase, conceptTitles[index], learnedConcepts);
            setCurrentConcept(nextConcept);
            setCurrentIndex(index);
            setView('active');
        } catch (err) {
            setErrorMessage(err instanceof Error ? err.message : 'An unknown error occurred.');
            setView('error');
        }
    };

    const handleSetUnderstanding = async (status: UserUnderstanding) => {
        setUnderstanding(status);
        if (status === 'understood') {
            setUnderstoodIndices(prev => new Set(prev).add(currentIndex));
        } else if (status === 'needs_help') {
            setView('generating');
            try {
                if (!currentConcept) throw new Error("No concept to re-explain.");
                const simplerConcept = await reexplainConcept(currentConcept.title, currentConcept.explanation);
                setCurrentConcept(simplerConcept);
            } catch (err) {
                 setErrorMessage(err instanceof Error ? err.message : 'An unknown error occurred.');
                 setView('error');
            } finally {
                setView('active');
                setUnderstanding('unknown');
            }
        }
    };
    
    const handleNextConcept = () => {
        const nextIndex = currentIndex + 1;
        if (nextIndex < conceptTitles.length) {
            fetchConcept(nextIndex);
        }
    };
    
    const handleConceptSelect = (index: number) => {
        if (index !== currentIndex) {
            fetchConcept(index);
        }
    };

    const handleGenerateMoreQuestions = async () => {
        if (!guideContent || guideContent.type !== 'qa') return;
        
        setIsGeneratingMore(true);
        try {
            const newQuestions = await generateMoreInterviewQuestions(knowledgeBase, guideContent.data);
            setGuideContent(prev => {
                if (prev && prev.type === 'qa') {
                    return { ...prev, data: [...prev.data, ...newQuestions] };
                }
                return prev;
            });
        } catch (error) {
            console.error("Failed to generate more questions:", error);
            // Optionally set an error message to display to the user
        } finally {
            setIsGeneratingMore(false);
        }
    };

    // --- RENDER FUNCTIONS ---

    const renderEmptyState = () => (
        <div className="w-full h-full flex flex-col items-center justify-center text-center p-4">
            <div className="p-8 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg">
                <BrainCircuitIcon className="h-12 w-12 text-gray-400 dark:text-gray-500 mx-auto mb-4" />
                <h2 className="text-xl font-semibold text-gray-800 dark:text-white">Your LearnVault is Empty</h2>
                <p className="text-gray-600 dark:text-gray-400 mt-2 mb-6">Please add materials to your LearnVault first. The LearnGuide uses that content to create your lesson.</p>
                <button onClick={onNavigateToVault} className="px-6 py-3 bg-blue-500 text-white font-semibold rounded-lg shadow-md hover:bg-blue-600 transition-colors">Go to LearnVault</button>
            </div>
        </div>
    );

    const GoalCard: React.FC<{ icon: React.ReactNode; title: string; description: string; onClick: () => void; }> = ({ icon, title, description, onClick }) => (
        <button onClick={onClick} className="w-full text-left p-6 bg-white dark:bg-gray-800 rounded-xl shadow border border-gray-200 dark:border-gray-700 hover:shadow-lg hover:border-blue-500 dark:hover:border-blue-400 transition-all transform hover:-translate-y-1 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 dark:focus:ring-offset-gray-900">
            <div className="flex items-start gap-4">
                <div className="flex-shrink-0">{icon}</div>
                <div>
                    <h3 className="font-bold text-lg text-gray-800 dark:text-white">{title}</h3>
                    <p className="text-gray-600 dark:text-gray-400 mt-1 text-sm">{description}</p>
                </div>
            </div>
        </button>
    );

    const renderGoalSelection = () => {
        const goals = [
            { id: 'Descriptive', title: 'Descriptive Exam Preparation', description: 'Get long, essay-style answers with full theory and examples.', icon: <BookOpenIcon className="h-8 w-8 text-blue-500" /> },
            { id: 'Revision', title: 'Quick Revision', description: 'Receive short, crisp notes with key definitions and formulas.', icon: <PencilLineIcon className="h-8 w-8 text-yellow-500" /> },
            { id: 'Learn', title: 'Learn topic wisely', description: 'Learn concepts with code examples and practice questions.', icon: <CodeIcon className="h-8 w-8 text-green-500" /> },
            { id: 'Interview', title: 'Interview Prep', description: 'Access concepts, FAQs, and short answers to prepare for interviews.', icon: <PulseIcon className="h-8 w-8 text-purple-500" /> }
        ];

        return (
            <div className="w-full max-w-4xl mx-auto p-4 animate-fade-in">
                <h2 className="text-2xl font-bold text-gray-800 dark:text-white mb-6">Select Your Goal</h2>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {goals.map(goal => (
                        <GoalCard key={goal.id} {...goal} onClick={() => handleGoalSelect(goal.id as LearnGoal)} />
                    ))}
                </div>
            </div>
        );
    };

    const renderSources = () => {
        if (!sources || sources.length === 0) return null;
        return (
            <div className="mt-8 pt-8 border-t border-gray-200 dark:border-gray-700">
                <h3 className="text-lg font-bold text-gray-800 dark:text-white mb-4 flex items-center gap-2">
                    <LinkIcon className="h-5 w-5 text-blue-500" /> Grounding Sources
                </h3>
                <div className="flex flex-wrap gap-3">
                    {sources.map((source, i) => (
                        <a key={i} href={source.uri} target="_blank" rel="noopener noreferrer" className="px-3 py-1.5 bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 rounded-full text-sm font-medium hover:underline flex items-center gap-2">
                             {source.title}
                        </a>
                    ))}
                </div>
            </div>
        );
    }

    const renderStructuredContent = () => {
        const progress = conceptTitles.length > 0 ? (understoodIndices.size / conceptTitles.length) * 100 : 0;
        return (
            <div className="w-full h-full flex flex-col p-4 max-w-7xl mx-auto">
                <div className="flex justify-between items-center mb-4 flex-shrink-0">
                    <h1 className="text-2xl font-bold text-gray-800 dark:text-white">{currentConcept?.title || guideContent?.title}</h1>
                    <button onClick={() => setView('goal_selection')} className="text-sm font-medium text-blue-500 hover:underline">← Change Goal</button>
                </div>
    
                <div className="flex gap-6 flex-grow min-h-0">
                    <aside className="w-1/3 h-full flex flex-col bg-gray-50 dark:bg-gray-800/50 p-4 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700">
                        <h2 className="text-xl font-bold text-gray-800 dark:text-white mb-2">Learning Path</h2>
                        <div className="mb-4">
                            <div className="flex justify-between items-center text-sm font-medium text-gray-600 dark:text-gray-400 mb-1">
                                <span>Progress</span>
                                <span>{understoodIndices.size} / {conceptTitles.length}</span>
                            </div>
                            <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2.5">
                                <div className="bg-green-500 h-2.5 rounded-full transition-all duration-500" style={{ width: `${progress}%` }}></div>
                            </div>
                        </div>
                        <nav className="space-y-2 overflow-y-auto flex-grow">
                            {conceptTitles.map((title, index) => {
                                 const isCompleted = understoodIndices.has(index);
                                 const isActive = index === currentIndex;
                                 let itemClass = 'text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700';
                                 if (isActive) itemClass = 'bg-blue-500 text-white font-semibold shadow-md';
                                 else if (isCompleted) itemClass = 'text-gray-500 dark:text-gray-400';
                                return (
                                    <button key={index} onClick={() => handleConceptSelect(index)} disabled={isActive} className={`w-full text-left flex items-center gap-3 p-3 rounded-lg transition-all duration-200 ${itemClass} disabled:cursor-default`}>
                                        {isCompleted ? <CheckIcon className="h-5 w-5 text-green-500 flex-shrink-0" /> : <span className={`flex-shrink-0 h-5 w-5 flex items-center justify-center text-xs font-bold rounded-full ${isActive ? 'text-blue-500 bg-white' : 'bg-gray-200 dark:bg-gray-600'}`}>{index + 1}</span>}
                                        <span className="flex-grow">{title}</span>
                                    </button>
                                );
                            })}
                        </nav>
                    </aside>
                    <main className="w-2/3 h-full overflow-y-auto pr-2">
                        {renderActiveContent()}
                        {renderSources()}
                    </main>
                </div>
            </div>
        );
    };
    
    const renderActiveContent = () => {
        if (!guideContent) return null;

        const ttsControls = <TTSControls isSpeaking={isSpeaking} isPaused={isPaused} voices={voices} selectedVoiceURI={selectedVoiceURI} onSpeak={handleSpeak} onSelectVoice={setSelectedVoiceURI} />;

        switch (guideContent.type) {
            case 'structured':
                if (!currentConcept) return null;
                return (
                    <>
                        <div className="bg-white dark:bg-gray-800 p-4 md:p-6 rounded-2xl shadow-md border border-gray-200 dark:border-gray-700">
                           {ttsControls}
                           <div className="text-lg leading-relaxed">
                                <h2 className="text-3xl font-bold text-gray-800 dark:text-white mb-6"><HighlightableText text={currentConcept.title} currentWordIndex={currentWordIndex} wordOffset={wordOffsets.title || 0} /></h2>
                                <div className="space-y-8 text-left">
                                    <div><h3 className="text-xl font-semibold text-gray-800 dark:text-gray-200 mb-2"><HighlightableText text="Definition" currentWordIndex={currentWordIndex} wordOffset={wordOffsets.def_head || 0} /></h3><p className="text-gray-600 dark:text-gray-400"><HighlightableText text={currentConcept.definition} currentWordIndex={currentWordIndex} wordOffset={wordOffsets.def_body || 0} /></p></div>
                                    <div><h3 className="text-xl font-semibold text-gray-800 dark:text-gray-200 mb-2"><HighlightableText text="Explanation" currentWordIndex={currentWordIndex} wordOffset={wordOffsets.exp_head || 0} /></h3><div className="space-y-3 pl-5">{currentConcept.explanation.map((point, index) => { const codeMatch = point.match(/^```(\w*)\n?([\s\S]*?)```$/); if (codeMatch) { const [, language, code] = codeMatch; return <div key={index} className="-ml-5"><CodeCard language={language} code={code.trim()} /></div>; } return <div key={index} className="text-gray-600 dark:text-gray-400 list-item list-disc"><HighlightableText text={point} currentWordIndex={currentWordIndex} wordOffset={wordOffsets[`exp_bullet_${index}`] || 0} /></div>;})}</div></div>
                                    {currentConcept.examples?.length > 0 && <div><h3 className="text-xl font-semibold text-gray-800 dark:text-gray-200 mb-2"><HighlightableText text="Examples" currentWordIndex={currentWordIndex} wordOffset={wordOffsets.ex_head || 0} /></h3><div className="space-y-3">{currentConcept.examples.map((example, index) => { const codeMatch = example.match(/^```(\w*)\n?([\s\S]*?)```$/); if (codeMatch) { const [, language, code] = codeMatch; return <CodeCard key={index} language={language} code={code.trim()} />; } return <p key={index} className="text-gray-600 dark:text-gray-400 pl-5 list-disc"><HighlightableText text={example} currentWordIndex={currentWordIndex} wordOffset={wordOffsets[`ex_bullet_${index}`] || 0} /></p>;})}</div></div>}
                                </div>
                            </div>
                        </div>
                        <div className="mt-8">
                            {understanding === 'understood' ? <div className="text-center animate-fade-in"><p className="text-green-600 dark:text-green-400 font-semibold mb-4">🚀 Great! You've grasped <span className="font-bold">{currentConcept.title}</span></p><button onClick={handleNextConcept} className="w-full sm:w-auto inline-flex items-center justify-center px-8 py-3 bg-blue-500 text-white font-semibold rounded-lg shadow-md hover:bg-blue-600 transition-colors">Next Concept <ArrowRightIcon className="h-5 w-5 ml-2" /></button></div> : <div className="flex flex-col sm:flex-row items-center justify-center gap-4 animate-fade-in"><button onClick={() => handleSetUnderstanding('understood')} className="w-full sm:w-auto flex items-center justify-center gap-2 px-6 py-3 bg-green-500 text-white font-semibold rounded-lg shadow-md hover:bg-green-600 transition-colors"><CheckIcon className="h-5 w-5" /> Got it!</button><button onClick={() => handleSetUnderstanding('needs_help')} className="w-full sm:w-auto flex items-center justify-center gap-2 px-6 py-3 bg-yellow-500 text-white font-semibold rounded-lg shadow-md hover:bg-yellow-600 transition-colors"><HelpCircleIcon className="h-5 w-5" /> Explain Again</button></div>}
                        </div>
                    </>
                );
            case 'markdown': {
                const blocks = renderableContent.markdownBlocks || [];
                return (
                    <div className="bg-white dark:bg-gray-800 p-6 md:p-8 rounded-2xl shadow-md border border-gray-200 dark:border-gray-700">
                        {ttsControls}
                        <div className="space-y-4 text-gray-700 dark:text-gray-300 prose prose-lg dark:prose-invert max-w-none">
                            {blocks.map(block => {
                                const textProps = { text: block.text, wordOffset: wordOffsets[block.id] || 0, currentWordIndex };
                                switch (block.type) {
                                    case 'h1': return <h1 key={block.id} className="text-3xl text-blue-600 dark:text-blue-400 font-bold mt-8 mb-4 border-b-2 border-gray-300 dark:border-gray-600 pb-3"><HighlightableText {...textProps} /></h1>;
                                    case 'h2': return <h2 key={block.id} className="text-2xl font-bold mt-6 mb-3 text-purple-600 dark:text-purple-400"><HighlightableText {...textProps} /></h2>;
                                    case 'h3': return <h3 key={block.id} className="text-xl font-bold mt-4 mb-2 text-teal-600 dark:text-teal-400"><HighlightableText {...textProps} /></h3>;
                                    case 'h4': return <h4 key={block.id} className="text-lg font-semibold mt-4 mb-2 text-indigo-600 dark:text-indigo-400"><HighlightableText {...textProps} /></h4>;
                                    case 'li': return <li key={block.id} className="ml-6 list-disc"><HighlightableText {...textProps} /></li>;
                                    case 'code': return <CodeCard key={block.id} language={block.lang || ''} code={block.text} />;
                                    case 'p': default: return <p key={block.id}><HighlightableText {...textProps} /></p>;
                                }
                            })}
                        </div>
                    </div>
                );
            }
            case 'qa': {
                 const qaBlocks = renderableContent.qaBlocks || {};
                 return (
                    <>
                        <div className="bg-white dark:bg-gray-800 p-4 rounded-xl shadow-sm mb-4">
                           {ttsControls}
                        </div>
                        <div className="space-y-4">
                            {guideContent.data.map((item, index) => (
                                <details key={index} className="bg-white dark:bg-gray-800 rounded-xl shadow-md border border-gray-200 dark:border-gray-700 overflow-hidden group">
                                    <summary className="p-4 flex justify-between items-center cursor-pointer bg-blue-50 dark:bg-blue-900/30 list-none">
                                        <div className="flex items-center gap-3 w-full pr-4">
                                            <span className="flex-shrink-0 h-8 w-8 rounded-full bg-blue-100 dark:bg-blue-900 text-blue-600 dark:text-blue-300 flex items-center justify-center font-bold">Q</span>
                                            <div className="font-semibold text-blue-800 dark:text-blue-200 flex-grow">
                                                <HighlightableText text={item.question} wordOffset={wordOffsets[`question_${index}`] || 0} currentWordIndex={currentWordIndex} />
                                            </div>
                                        </div>
                                        <ArrowRightIcon className="h-5 w-5 text-blue-500 transform transition-transform group-open:rotate-90 flex-shrink-0" />
                                    </summary>
                                    <div className="p-4 bg-gray-50 dark:bg-gray-800/50 border-t border-gray-200 dark:border-gray-700">
                                         <div className="flex items-start gap-3">
                                            <span className="flex-shrink-0 h-8 w-8 rounded-full bg-gray-200 dark:bg-gray-700 text-gray-600 dark:text-gray-300 flex items-center justify-center font-bold">A</span>
                                            <div className="text-gray-700 dark:text-gray-300 space-y-2 mt-1 w-full">
                                                {(qaBlocks[index] || []).map(block => {
                                                    if (block.type === 'code') return <CodeCard key={block.id} language={block.lang || ''} code={block.text} />;
                                                    return <p key={block.id}><HighlightableText text={block.text} wordOffset={wordOffsets[block.id] || 0} currentWordIndex={currentWordIndex} /></p>;
                                                })}
                                            </div>
                                         </div>
                                    </div>
                                </details>
                            ))}
                        </div>
                        <div className="mt-6 text-center">
                            <button 
                                onClick={handleGenerateMoreQuestions} 
                                disabled={isGeneratingMore}
                                className="inline-flex items-center justify-center gap-2 px-6 py-3 bg-blue-500 text-white font-semibold rounded-lg shadow-md hover:bg-blue-600 disabled:bg-gray-400 dark:disabled:bg-gray-600 transition-colors"
                            >
                                {isGeneratingMore ? (
                                    <>
                                        <svg className="animate-spin -ml-1 mr-2 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>
                                        Generating...
                                    </>
                                ) : (
                                    <>
                                        <SparklesIcon className="h-5 w-5"/>
                                        Next Questions
                                    </>
                                )}
                            </button>
                        </div>
                    </>
                );
            }
            default: return null;
        }
    };
    
    if (!knowledgeBase.trim() && view !== 'generating') return renderEmptyState();

    if (view === 'generating') return <ModuleLoadingIndicator text="Generating your learning guide..." />;
    
    if (view === 'error') return (
        <div className="text-center">
            <h2 className="text-2xl font-bold text-red-500 mb-4">An Error Occurred</h2>
            <p className="text-gray-600 dark:text-gray-400 mb-6">{errorMessage}</p>
            <button onClick={() => setView('goal_selection')} className="px-6 py-3 bg-blue-500 text-white font-semibold rounded-lg shadow-md hover:bg-blue-600 transition-colors">Try Again</button>
        </div>
    );
    
    return (
        <div className="w-full h-full animate-fade-in">
            {view === 'goal_selection' ? renderGoalSelection() : (
                guideContent?.type === 'structured' ? renderStructuredContent() : (
                    <div className="max-w-4xl mx-auto p-4">
                        <div className="flex justify-between items-center mb-4">
                            <h1 className="text-2xl font-bold text-gray-800 dark:text-white">{guideContent?.title}</h1>
                            <button onClick={() => setView('goal_selection')} className="text-sm font-medium text-blue-500 hover:underline">← Change Goal</button>
                        </div>
                        {renderActiveContent()}
                        {renderSources()}
                    </div>
                )
            )}
        </div>
    );
};

export default LearnGuide;
