import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useAuth } from '../context/AuthContext';
import { isProgrammingTopic, generateQuiz, generateCodingProblem, generateCodeHint, generateFailureExplanation, evaluateCodeWithAI } from '../services/geminiService';
import { type CodingProblem, type CodingProblemDifficulty, type Language, type SubmissionResult, type QuizQuestion, type TestCaseResult, type SubmissionStatus, type TestResult, type QuizResult } from '../types';
import { BrainCircuitIcon, FlaskConicalIcon, CheckCircleIcon, XCircleIcon, ClockIcon, PlayIcon, SendHorizonalIcon, ArrowRightIcon, CodeIcon, PencilRulerIcon, LightbulbIcon, SparklesIcon, CheckIcon, ClipboardIcon } from './Icons';
import { ModuleLoadingIndicator, InlineLoadingIndicator } from './LoadingIndicators';
import CodeEditor from './CodeEditor';
import Timer from './Timer';

type TestBuddyView = 'initial' | 'mcq' | 'coding_difficulty' | 'coding_workspace' | 'mcq_results';
type ActiveResultTab = 'run' | 'submit';

// Helper to parse line numbers from common error formats
const parseError = (errorMessage: string): { lineNumber: number; message: string } | null => {
    if (!errorMessage) return null;
    
    // Regex to find line numbers in various compiler error formats.
    // Examples:
    // - ERROR: [Line 5]: ';' expected
    // - somefile.java:5: error: ';' expected
    // - File "script.py", line 5, in <module>
    // - /path/to/file.c:5:5: error: expected ';'
    // - SyntaxError: Unexpected identifier (at script.js:5:1)
    const match = errorMessage.match(/(?:[a-zA-Z0-9\/\._-]+):(\d+)|line (\d+)|\[Line (\d+)\]/i);

    
    if (match) {
        const lineNumber = parseInt(match[1] || match[2] || match[3], 10);
        return { lineNumber, message: errorMessage.trim() };
    }
    
    // Fallback if no line number is found
    return { lineNumber: 1, message: errorMessage.trim() };
};

// Helper to strip variable names from test case inputs like "nums = [1,2,3]"
const extractInputValue = (input: string): string => {
    // Split by newlines to handle multi-argument inputs
    return input.split('\n').map(line => {
        const eqIndex = line.indexOf('=');
        if (eqIndex > -1) {
            return line.substring(eqIndex + 1).trim();
        }
        return line.trim();
    }).join('\n');
};


const DifficultyButton: React.FC<{
    difficulty: CodingProblemDifficulty;
    onClick: () => void;
    isLoading: boolean;
}> = ({ difficulty, onClick, isLoading }) => {
    const colorClasses = {
        Easy: 'bg-green-100 dark:bg-green-900/50 text-green-700 dark:text-green-300 hover:bg-green-200 dark:hover:bg-green-800/50',
        Medium: 'bg-yellow-100 dark:bg-yellow-900/50 text-yellow-700 dark:text-yellow-300 hover:bg-yellow-200 dark:hover:bg-yellow-800/50',
        Hard: 'bg-red-100 dark:bg-red-900/50 text-red-700 dark:text-red-300 hover:bg-red-200 dark:hover:bg-red-800/50',
    };
    return (
        <button
            onClick={onClick}
            disabled={isLoading}
            className={`px-6 py-3 font-semibold rounded-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed ${colorClasses[difficulty]}`}
        >
            {isLoading ? <InlineLoadingIndicator /> : difficulty}
        </button>
    );
};

const ResultBadge: React.FC<{ status: SubmissionStatus }> = ({ status }) => {
    const baseClass = 'px-3 py-1 text-sm font-bold rounded-full flex items-center gap-1.5';
    switch (status) {
        case 'Accepted':
            return <span className={`${baseClass} bg-green-100 dark:bg-green-900 text-green-800 dark:text-green-200`}><CheckCircleIcon className="h-4 w-4"/> Accepted</span>;
        case 'Wrong Answer':
            return <span className={`${baseClass} bg-red-100 dark:bg-red-900 text-red-800 dark:text-red-200`}><XCircleIcon className="h-4 w-4"/> Wrong Answer</span>;
        case 'Runtime Error':
            return <span className={`${baseClass} bg-red-100 dark:bg-red-900 text-red-800 dark:text-red-200`}>⚡ Runtime Error</span>;
        case 'Time Limit Exceeded':
            return <span className={`${baseClass} bg-yellow-100 dark:bg-yellow-900 text-yellow-800 dark:text-yellow-200`}>⏳ Time Limit Exceeded</span>;
        case 'Compilation Error':
             return <span className={`${baseClass} bg-gray-100 dark:bg-gray-700 text-gray-800 dark:text-gray-200`}>⚠️ Compilation Error</span>;
        default:
            return <span className={`${baseClass} bg-blue-100 dark:bg-blue-900 text-blue-800 dark:text-blue-200`}>{status}...</span>;
    }
};

const SolutionViewer: React.FC<{ code: string; language: Language }> = ({ code, language }) => {
    const [copied, setCopied] = useState(false);

    const handleCopy = () => {
        navigator.clipboard.writeText(code).then(() => {
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
        });
    };

    // A robust syntax highlighter that tokenizes content first
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
        <div className="mt-4 bg-gray-900 rounded-lg overflow-hidden border border-gray-700">
            <div className="px-4 py-2 flex justify-between items-center bg-gray-800 border-b border-gray-700">
                <span className="text-xs font-sans text-gray-400 font-semibold uppercase">{language} - Solution</span>
                <button onClick={handleCopy} className="flex items-center gap-1.5 text-sm font-medium text-gray-300 hover:text-white transition-colors">
                    {copied ? <CheckIcon className="h-4 w-4 text-green-500" /> : <ClipboardIcon className="h-4 w-4" />}
                    {copied ? 'Copied' : 'Copy'}
                </button>
            </div>
            <div className="p-4 overflow-x-auto">
                <pre><code
                    className="font-mono text-sm text-gray-200"
                    dangerouslySetInnerHTML={{ __html: highlightSyntax(code) }}
                /></pre>
            </div>
        </div>
    );
};


const DraggableDivider: React.FC<{ onMouseDown: React.MouseEventHandler<HTMLDivElement>, direction: 'horizontal' | 'vertical' }> = ({ onMouseDown, direction }) => {
    const baseClasses = 'bg-gray-200 dark:bg-gray-700 hover:bg-blue-500 dark:hover:bg-blue-500 transition-colors z-10';
    const cursorClass = direction === 'horizontal' ? 'cursor-col-resize' : 'cursor-row-resize';
    const sizeClasses = direction === 'horizontal' ? 'w-2 h-full' : 'h-2 w-full';
    return <div onMouseDown={onMouseDown} className={`${baseClasses} ${cursorClass} ${sizeClasses} flex-shrink-0`}></div>;
};


interface TestBuddyProps {
    knowledgeBase: string;
    onNavigateToVault: () => void;
    onMcqComplete: (result: Omit<QuizResult, 'quizId' | 'attemptedAt'>) => void;
    onCodingAttempt: (result: Omit<TestResult, 'attemptedAt'>) => void;
}

const TestBuddy: React.FC<TestBuddyProps> = ({ knowledgeBase, onNavigateToVault, onMcqComplete, onCodingAttempt }) => {
    const { user } = useAuth();
    const [view, setView] = useState<TestBuddyView>('initial');
    const [isTopicProgramming, setIsTopicProgramming] = useState<boolean | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    
    // MCQ State
    const [mcqQuestions, setMcqQuestions] = useState<QuizQuestion[]>([]);
    const [mcqTopic, setMcqTopic] = useState('');
    const [mcqDifficulty, setMcqDifficulty] = useState<'Easy' | 'Medium' | 'Hard'>('Easy');
    const [currentMcqIndex, setCurrentMcqIndex] = useState(0);
    const [selectedAnswer, setSelectedAnswer] = useState<string | null>(null);
    const [userAnswers, setUserAnswers] = useState<Record<number, string>>({});
    const [isMcqTimerRunning, setIsMcqTimerRunning] = useState(false);
    const [mcqStartTime, setMcqStartTime] = useState<Date | null>(null);
    
    // Coding State
    const [activeCodingProblem, setActiveCodingProblem] = useState<CodingProblem | null>(null);
    const [language, setLanguage] = useState<Language>('javascript');
    const [code, setCode] = useState('');
    const [isExecuting, setIsExecuting] = useState(false);
    const [runResults, setRunResults] = useState<TestCaseResult[] | null>(null);
    const [submissionResults, setSubmissionResults] = useState<(SubmissionResult & { passed: boolean; input: string; expected: string; })[] | null>(null);
    const [overallSubmissionStatus, setOverallSubmissionStatus] = useState<SubmissionStatus | null>(null);
    const [hint, setHint] = useState<string | null>(null);
    const [isHintLoading, setIsHintLoading] = useState(false);
    const [failureExplanation, setFailureExplanation] = useState<string | null>(null);
    const [isExplanationLoading, setIsExplanationLoading] = useState(false);
    const [activeResultTab, setActiveResultTab] = useState<ActiveResultTab>('run');
    const [isCodingTimerRunning, setIsCodingTimerRunning] = useState(false);
    const [codingDifficulty, setCodingDifficulty] = useState<CodingProblemDifficulty | null>(null);
    const [codeError, setCodeError] = useState<{ lineNumber: number; message: string } | null>(null);
    const [showSolution, setShowSolution] = useState(false);
    
    // Resizable panels state
    const [horizontalSplit, setHorizontalSplit] = useState(50);
    const [verticalSplit, setVerticalSplit] = useState(70);
    const isDraggingHorizontal = useRef(false);
    const isDraggingVertical = useRef(false);
    const workspaceRef = useRef<HTMLDivElement>(null);
    const rightPanelRef = useRef<HTMLDivElement>(null);

    // Check if topic is programming-related on mount
    useEffect(() => {
        if (!knowledgeBase.trim()) {
            setIsLoading(false);
            return;
        }
        isProgrammingTopic(knowledgeBase).then(isProgramming => {
            setIsTopicProgramming(isProgramming);
            setIsLoading(false);
        });
    }, [knowledgeBase]);

    // Update code editor when active problem or language changes
    useEffect(() => {
        if (activeCodingProblem) {
            setCode(activeCodingProblem.starterCode[language]);
            // Reset results and errors for the new problem/language
            setRunResults(null);
            setSubmissionResults(null);
            setOverallSubmissionStatus(null);
            setHint(null);
            setFailureExplanation(null);
            setCodeError(null);
            setShowSolution(false);
        }
    }, [activeCodingProblem, language]);
    
    const handleStartMcq = useCallback(async () => {
        setIsLoading(true);
        setError(null);
        try {
            const { questions, topic, difficulty } = await generateQuiz(knowledgeBase, { numQuestions: 15 });
            setMcqQuestions(questions);
            setMcqTopic(topic);
            setMcqDifficulty(difficulty);
            setCurrentMcqIndex(0);
            setUserAnswers({});
            setSelectedAnswer(null);
            setView('mcq');
            setIsMcqTimerRunning(true);
            setMcqStartTime(new Date());
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Failed to generate MCQ test.');
        } finally {
            setIsLoading(false);
        }
    }, [knowledgeBase]);

    const handleNextQuestion = () => {
        const newAnswers = { ...userAnswers, [currentMcqIndex]: selectedAnswer! };
        setUserAnswers(newAnswers);
        setSelectedAnswer(null);

        if (currentMcqIndex < mcqQuestions.length - 1) {
            setCurrentMcqIndex(prev => prev + 1);
        } else {
            finishMcq(newAnswers);
        }
    };
    
    const finishMcq = useCallback((finalAnswers: Record<number, string>) => {
        setIsMcqTimerRunning(false);
        let score = 0;
        mcqQuestions.forEach((q, index) => {
            if (finalAnswers[index] === q.correctAnswer) {
                score++;
            }
        });
        if (user) {
            const endTime = new Date();
            const timeDiff = endTime.getTime() - (mcqStartTime?.getTime() || endTime.getTime());
            const minutes = Math.floor(timeDiff / 60000);
            const seconds = Math.floor((timeDiff % 60000) / 1000);

            const result: Omit<QuizResult, 'quizId' | 'attemptedAt'> = {
                title: mcqTopic,
                difficulty: mcqDifficulty,
                questions: mcqQuestions.length,
                correctAnswers: score,
                wrongAnswers: mcqQuestions.length - score,
                score: parseFloat(((score / mcqQuestions.length) * 100).toFixed(2)),
                timeTaken: `${minutes}m ${seconds}s`,
            };
            onMcqComplete(result);
        }
        setView('mcq_results');
    }, [mcqQuestions, mcqTopic, onMcqComplete, user, mcqStartTime, mcqDifficulty]);

    const handleFetchCodingProblem = useCallback(async (difficulty: CodingProblemDifficulty) => {
        setIsLoading(true);
        setCodingDifficulty(difficulty);
        setError(null);
        setIsExecuting(false);
        try {
            const fetchedProblem = await generateCodingProblem(knowledgeBase, difficulty);
            setActiveCodingProblem(fetchedProblem);
            setView('coding_workspace');
            setIsCodingTimerRunning(true);
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Failed to fetch problems.');
        } finally {
            setIsLoading(false);
        }
    }, [knowledgeBase]);

    const handleRunCode = async () => {
        if (!activeCodingProblem || isExecuting) return;
        setIsExecuting(true);
        setActiveResultTab('run');
        setSubmissionResults(null);
        setHint(null);
        setFailureExplanation(null);
        setCodeError(null);

        const testCasesToRun = activeCodingProblem.examples.map(example => ({
            stdin: extractInputValue(example.input),
            expectedOutput: example.output,
        }));

        const results = await evaluateCodeWithAI(language, code, testCasesToRun, activeCodingProblem);

        setRunResults(results.map((res, index) => ({
            input: activeCodingProblem.examples[index].input,
            expectedOutput: activeCodingProblem.examples[index].output,
            userOutput: res.compile_output || res.stderr || res.stdout || 'No output',
            status: res.status === 'Accepted' ? 'Passed' : 'Failed',
            error: res.stderr || res.compile_output
        })));
        
        // Check for compilation/runtime error in the first failed case to display in editor
        const firstError = results.find(res => res.status === 'Compilation Error' || res.status === 'Runtime Error');
        if (firstError) {
            const parsed = parseError(firstError.compile_output || firstError.stderr || '');
            setCodeError(parsed);
        }
        
        setIsExecuting(false);
    };

    const handleSubmitCode = async () => {
        if (!user || !activeCodingProblem || isExecuting) return;
        
        setIsExecuting(true);
        setActiveResultTab('submit');
        setRunResults(null);
        setHint(null);
        setFailureExplanation(null);
        setCodeError(null);
        setSubmissionResults(null);
        setOverallSubmissionStatus('Running');

        const testCasesToSubmit = activeCodingProblem.testCases.map(tc => ({
            stdin: extractInputValue(tc.input),
            expectedOutput: tc.output,
        }));

        const results = await evaluateCodeWithAI(language, code, testCasesToSubmit, activeCodingProblem);
        
        const submissionDisplayResults = results.map((result, index) => ({
            ...result,
            passed: result.status === 'Accepted',
            input: activeCodingProblem.testCases[index].input,
            expected: activeCodingProblem.testCases[index].output,
        }));
        setSubmissionResults(submissionDisplayResults);

        const firstFailureIndex = results.findIndex(r => r.status !== 'Accepted');
        const passedAll = firstFailureIndex === -1;

        const passedCount = submissionDisplayResults.filter(r => r.passed).length;
        const score = (passedCount / submissionDisplayResults.length) * 100;

        const resultData: Omit<TestResult, 'attemptedAt'> = {
            testId: activeCodingProblem.id,
            title: activeCodingProblem.title,
            difficulty: activeCodingProblem.difficulty,
            language: language,
            codeSubmitted: code,
            status: passedAll ? 'Passed' : 'Failed',
            score: parseFloat(score.toFixed(2)),
        };

        onCodingAttempt(resultData);
        

        if (passedAll) {
            setOverallSubmissionStatus('Accepted');
            setIsCodingTimerRunning(false);
        } else {
            const failedResult = results[firstFailureIndex];
            const failedTestCase = activeCodingProblem.testCases[firstFailureIndex];
            setOverallSubmissionStatus(failedResult.status);
            
            const parsed = parseError(failedResult.compile_output || failedResult.stderr || '');
            if (parsed) setCodeError(parsed);

            if (failedResult.status === 'Wrong Answer') {
                setIsExplanationLoading(true);
                generateFailureExplanation(activeCodingProblem, code, {
                    input: failedTestCase.input,
                    expected: failedTestCase.output,
                    actual: failedResult.stdout || ''
                }).then(explanation => {
                    setFailureExplanation(explanation);
                    setIsExplanationLoading(false);
                });
            }
        }
        
        setIsExecuting(false);
    };
    
    const handleGetHint = async () => {
        if (!activeCodingProblem || isHintLoading || !submissionResults || submissionResults.length === 0) return;
        
        const failedTest = submissionResults.find(r => !r.passed);
        if (!failedTest) return;

        setIsHintLoading(true);
        setHint('');
        try {
            const hintText = await generateCodeHint(activeCodingProblem, code, {
                input: failedTest.input,
                expected: failedTest.expected,
                actual: failedTest.stdout || ''
            });
            setHint(hintText);
        } catch (e) {
            console.error(e);
            setHint("Sorry, an error occurred while generating a hint.");
        } finally {
            setIsHintLoading(false);
        }
    };


    const resetState = () => {
        setView('initial');
        setError(null);
    };

    // --- Resizable Panel Logic ---
    const handleHorizontalDrag = useCallback((e: MouseEvent) => {
        if (!isDraggingHorizontal.current || !workspaceRef.current) return;
        const rect = workspaceRef.current.getBoundingClientRect();
        const percentage = ((e.clientX - rect.left) / rect.width) * 100;
        setHorizontalSplit(Math.max(20, Math.min(80, percentage)));
    }, []);

    const handleVerticalDrag = useCallback((e: MouseEvent) => {
        if (!isDraggingVertical.current || !rightPanelRef.current) return;
        const rect = rightPanelRef.current.getBoundingClientRect();
        const percentage = ((e.clientY - rect.top) / rect.height) * 100;
        setVerticalSplit(Math.max(20, Math.min(80, percentage)));
    }, []);

    const handleMouseUp = useCallback(() => {
        isDraggingHorizontal.current = false;
        isDraggingVertical.current = false;
        window.removeEventListener('mousemove', handleHorizontalDrag);
        window.removeEventListener('mousemove', handleVerticalDrag);
        window.removeEventListener('mouseup', handleMouseUp);
        document.body.style.userSelect = '';
    }, [handleHorizontalDrag, handleVerticalDrag]);

    const onHorizontalMouseDown = useCallback((e: React.MouseEvent) => {
        e.preventDefault();
        isDraggingHorizontal.current = true;
        document.body.style.userSelect = 'none';
        window.addEventListener('mousemove', handleHorizontalDrag);
        window.addEventListener('mouseup', handleMouseUp, { once: true });
    }, [handleHorizontalDrag, handleMouseUp]);

    const onVerticalMouseDown = useCallback((e: React.MouseEvent) => {
        e.preventDefault();
        isDraggingVertical.current = true;
        document.body.style.userSelect = 'none';
        window.addEventListener('mousemove', handleVerticalDrag);
        window.addEventListener('mouseup', handleMouseUp, { once: true });
    }, [handleVerticalDrag, handleMouseUp]);

    if (isLoading && view === 'initial') {
        return <ModuleLoadingIndicator text="Analyzing your LearnVault content..." />;
    }
    
    if (!knowledgeBase.trim()) {
        return (
            <div className="mt-8 p-8 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg text-center">
                <BrainCircuitIcon className="h-12 w-12 text-gray-400 dark:text-gray-500 mx-auto mb-4" />
                <h2 className="text-xl font-semibold text-gray-800 dark:text-white">No Knowledge Base Selected</h2>
                <p className="text-gray-600 dark:text-gray-400 mt-2 mb-6">TestBuddy uses your active vault's content to generate tests. Please create or select a vault first.</p>
                <button onClick={onNavigateToVault} className="px-6 py-3 bg-blue-500 text-white font-semibold rounded-lg shadow-md hover:bg-blue-600 transition-colors">Create New Vault</button>
            </div>
        );
    }
    
    const renderInitial = () => (
        <div className="w-full max-w-2xl mx-auto text-center p-4">
            {isLoading ? <ModuleLoadingIndicator text="Preparing your test..." /> : (
            <>
                <div className="flex justify-center items-center gap-3 mb-4">
                    <FlaskConicalIcon className="h-10 w-10 text-blue-500" />
                    <h1 className="text-3xl font-bold text-gray-800 dark:text-white">TestBuddy</h1>
                </div>
                <p className="text-gray-600 dark:text-gray-400 mb-8">Choose a test type to challenge your knowledge.</p>
                <div className="flex flex-col sm:flex-row justify-center gap-4">
                    <button onClick={handleStartMcq} disabled={isLoading} className="flex items-center justify-center gap-2 px-6 py-4 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg font-semibold hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors">
                        <PencilRulerIcon className="h-6 w-6 text-blue-500"/>
                        MCQ Test
                    </button>
                    {isTopicProgramming && (
                        <button onClick={() => setView('coding_difficulty')} className="flex items-center justify-center gap-2 px-6 py-4 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg font-semibold hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors">
                            <CodeIcon className="h-6 w-6 text-purple-500"/>
                            Coding Challenge
                        </button>
                    )}
                </div>
                {error && <p className="mt-4 text-red-500">{error}</p>}
            </>
            )}
        </div>
    );
    
    const renderMcq = () => {
        if (mcqQuestions.length === 0) return null;
        const question = mcqQuestions[currentMcqIndex];
        return (
            <div className="w-full max-w-2xl mx-auto">
                <div className="flex justify-between items-center mb-4">
                    <h2 className="text-xl font-bold">{mcqTopic}</h2>
                    <Timer initialMinutes={10} onTimeout={() => finishMcq(userAnswers)} isRunning={isMcqTimerRunning} />
                </div>
                <div className="bg-white dark:bg-gray-800 p-8 rounded-xl shadow-lg border border-gray-200 dark:border-gray-700">
                    <p className="text-sm font-semibold text-blue-500 mb-2">Question {currentMcqIndex + 1} of {mcqQuestions.length}</p>
                    <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-6">{question.questionText}</h3>
                    <div className="space-y-3">
                        {question.options.map((option, index) => (
                            <label key={index} className={`flex items-center p-4 border-2 rounded-lg cursor-pointer transition-all ${selectedAnswer === option ? 'border-blue-500 bg-blue-50 dark:bg-gray-700' : 'border-gray-300 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-700/50'}`}>
                                <input type="radio" name="option" value={option} checked={selectedAnswer === option} onChange={() => setSelectedAnswer(option)} className="h-5 w-5 text-blue-600 focus:ring-blue-500 border-gray-300"/>
                                <span className="ml-3 font-medium text-gray-800 dark:text-gray-200">{option}</span>
                            </label>
                        ))}
                    </div>
                    <div className="mt-8 text-right">
                        <button onClick={handleNextQuestion} disabled={!selectedAnswer} className="flex items-center gap-2 px-8 py-3 bg-blue-500 text-white font-semibold rounded-lg shadow-md hover:bg-blue-600 disabled:bg-gray-300 dark:disabled:bg-gray-600 transition-colors">
                            {currentMcqIndex < mcqQuestions.length - 1 ? 'Next' : 'Finish'} <ArrowRightIcon className="h-5 w-5"/>
                        </button>
                    </div>
                </div>
            </div>
        );
    };

    const renderMcqResults = () => {
        const score = Object.values(userAnswers).filter((answer, index) => answer === mcqQuestions[index].correctAnswer).length;
        return (
            <div className="w-full max-w-2xl mx-auto text-center bg-white dark:bg-gray-800 p-8 rounded-xl shadow-lg border border-gray-200 dark:border-gray-700">
                <h2 className="text-3xl font-bold text-gray-800 dark:text-white mb-2">Quiz Complete!</h2>
                <p className="text-gray-600 dark:text-gray-400 mb-6">Topic: <span className="font-semibold">{mcqTopic}</span></p>
                <div className="mb-8">
                    <p className="text-lg text-gray-700 dark:text-gray-200">Your Score:</p>
                    <p className="text-6xl font-bold text-blue-500 my-2">{score} <span className="text-4xl text-gray-500 dark:text-gray-400">/ {mcqQuestions.length}</span></p>
                </div>
                <button onClick={resetState} className="px-8 py-3 bg-blue-500 text-white font-semibold rounded-lg shadow-md hover:bg-blue-600 transition-colors">
                    Back to TestBuddy Home
                </button>
            </div>
        );
    };

    const renderCodingDifficulty = () => {
        if (isLoading) {
            return <ModuleLoadingIndicator text={`Generating ${codingDifficulty} problem...`} />;
        }
        return (
             <div className="w-full max-w-4xl mx-auto text-center p-4">
                 <button onClick={() => setView('initial')} className="text-sm text-blue-500 hover:underline mb-4">&larr; Back to Test Selection</button>
                <div className="flex justify-center items-center gap-3 mb-4">
                    <CodeIcon className="h-10 w-10 text-blue-500" />
                    <h1 className="text-3xl font-bold text-gray-800 dark:text-white">Coding Arena</h1>
                </div>
                 <p className="text-gray-600 dark:text-gray-400 mb-8">Select a difficulty to generate a coding problem.</p>
                <div className="flex justify-center gap-4 mb-8">
                    {(['Easy', 'Medium', 'Hard'] as CodingProblemDifficulty[]).map(d => 
                        <DifficultyButton key={d} difficulty={d} onClick={() => handleFetchCodingProblem(d)} isLoading={isLoading && codingDifficulty === d} />
                    )}
                </div>
                {error && <p className="mt-4 text-red-500">{error}</p>}
            </div>
        );
    };


    const renderCodingWorkspace = () => {
        if (!activeCodingProblem) return null;
        const problem = activeCodingProblem;
        const difficultyColors: Record<CodingProblemDifficulty, string> = {
            Easy: 'text-green-600 dark:text-green-400', Medium: 'text-yellow-600 dark:text-yellow-400', Hard: 'text-red-600 dark:text-red-400',
        };

        return (
            <div className="flex flex-col h-full w-full overflow-hidden">
                 {/* Header */}
                 <div className="flex-shrink-0 flex justify-between items-center p-2 border-b border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800">
                    <button onClick={() => setView('coding_difficulty')} className="text-sm text-blue-500 hover:underline">&larr; Back to Difficulty Selection</button>
                    <Timer initialMinutes={25} onTimeout={handleSubmitCode} isRunning={isCodingTimerRunning} />
                </div>

                <div ref={workspaceRef} className="flex-grow flex overflow-hidden p-4 gap-2">
                    {/* Left Panel */}
                    <div className="flex flex-col bg-white dark:bg-gray-800 rounded-lg shadow overflow-hidden" style={{ width: `calc(${horizontalSplit}% - 4px)`}}>
                        <div className="p-4 border-b border-gray-200 dark:border-gray-700 flex-shrink-0">
                            <h2 className="text-2xl font-bold">{problem.title}</h2>
                            <p className={`font-semibold ${difficultyColors[problem.difficulty]}`}>{problem.difficulty}</p>
                        </div>
                        <div className="p-4 space-y-4 overflow-y-auto">
                            <p className="whitespace-pre-wrap">{problem.description}</p>
                            {problem.examples.map((ex, i) => (
                                <div key={i} className="bg-gray-50 dark:bg-gray-900/50 p-3 rounded-lg"><p className="font-semibold">Example {i + 1}:</p><pre className="mt-1 p-2 bg-gray-200 dark:bg-gray-700 rounded text-sm"><code><span className="font-bold">Input:</span> {ex.input}<br/><span className="font-bold">Output:</span> {ex.output}</code></pre>{ex.explanation && <p className="text-sm mt-1"><strong>Explanation:</strong> {ex.explanation}</p>}</div>
                            ))}
                            <div><h4 className="font-bold">Constraints:</h4><ul className="list-disc list-inside text-sm">{problem.constraints.map((c, i) => <li key={i}>{c}</li>)}</ul></div>
                             <div className="mt-4 pt-4 border-t border-gray-200 dark:border-gray-700">
                                <button onClick={() => setShowSolution(!showSolution)} className="font-semibold text-blue-500 hover:text-blue-600 dark:hover:text-blue-400">
                                    {showSolution ? 'Hide Solution' : 'Show Solution'}
                                </button>
                                {showSolution && <SolutionViewer code={problem.solution[language]} language={language} />}
                            </div>
                        </div>
                    </div>

                    <DraggableDivider onMouseDown={onHorizontalMouseDown} direction="horizontal" />

                    {/* Right Panel */}
                    <div ref={rightPanelRef} className="flex flex-col" style={{ width: `calc(${100 - horizontalSplit}% - 4px)`}}>
                        <div className="flex-grow flex flex-col bg-gray-800 rounded-lg shadow overflow-hidden" style={{ height: `calc(${verticalSplit}% - 4px)`}}>
                            <div className="p-2 bg-gray-700 flex items-center"><select value={language} onChange={e => setLanguage(e.target.value as Language)} className="bg-gray-800 text-white rounded px-2 py-1 text-sm border-none focus:ring-2 focus:ring-blue-500"><option value="javascript">JavaScript</option><option value="python">Python</option><option value="java">Java</option><option value="c">C</option></select></div>
                            <div className="flex-grow relative"><CodeEditor language={language} value={code} onChange={setCode} error={codeError} /></div>
                        </div>
                        
                        <DraggableDivider onMouseDown={onVerticalMouseDown} direction="vertical" />

                        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-2 flex flex-col" style={{ height: `calc(${100 - verticalSplit}% - 4px)`}}>
                            {/* Result Tabs */}
                            <div className="flex border-b border-gray-200 dark:border-gray-700 flex-shrink-0">
                                <button onClick={() => setActiveResultTab('run')} className={`px-4 py-2 text-sm font-semibold ${activeResultTab === 'run' ? 'text-blue-500 border-b-2 border-blue-500' : 'text-gray-500'}`}>Run Results</button>
                                <button onClick={() => setActiveResultTab('submit')} className={`px-4 py-2 text-sm font-semibold ${activeResultTab === 'submit' ? 'text-blue-500 border-b-2 border-blue-500' : 'text-gray-500'}`}>Submission</button>
                            </div>
                            {/* Result Content */}
                            <div className="flex-grow p-2 overflow-y-auto">
                                {activeResultTab === 'run' && (
                                    runResults ? (
                                        <div className="space-y-2">
                                            {runResults.map((res, i) => (
                                                <div key={i} className={`p-2 rounded-md ${res.status === 'Passed' ? 'bg-green-50 dark:bg-green-900/40' : 'bg-red-50 dark:bg-red-900/40'}`}>
                                                    <p className="font-semibold text-sm flex items-center gap-2">{res.status === 'Passed' ? <CheckCircleIcon className="h-5 w-5 text-green-500"/> : <XCircleIcon className="h-5 w-5 text-red-500"/>} Example #{i + 1}</p>
                                                     {res.status === 'Failed' && (
                                                        <div className="text-xs font-mono mt-1 pl-7 whitespace-pre-wrap">
                                                            <p>Expected: <code className="bg-gray-200 dark:bg-gray-700 p-1 rounded">{res.expectedOutput}</code></p>
                                                            <p>Got: <code className="bg-gray-200 dark:bg-gray-700 p-1 rounded">{res.userOutput}</code></p>
                                                        </div>
                                                     )}
                                                </div>
                                            ))}
                                        </div>
                                    ) : <p className="text-sm text-gray-500">Run code to see results against examples.</p>
                                )}
                                {activeResultTab === 'submit' && (
                                    overallSubmissionStatus ? (
                                        <div>
                                            {overallSubmissionStatus === 'Running' ? (
                                                <div className="flex items-center gap-2 text-gray-500 dark:text-gray-400 p-2">
                                                    <InlineLoadingIndicator />
                                                    <span>Running submission...</span>
                                                </div>
                                            ) : (
                                                <>
                                                    <ResultBadge status={overallSubmissionStatus} />
                                                    {overallSubmissionStatus === 'Accepted' && (
                                                        <div className="mt-4 flex flex-col sm:flex-row gap-4 items-center">
                                                            <p className="font-semibold text-green-600 dark:text-green-400">Great job! All test cases passed. 🚀</p>
                                                            <button onClick={() => handleFetchCodingProblem(codingDifficulty!)} className="flex items-center gap-2 px-6 py-3 bg-blue-500 text-white font-semibold rounded-lg shadow-md hover:bg-blue-600 transition-colors text-base">
                                                                Next Problem <ArrowRightIcon className="h-5 w-5"/>
                                                            </button>
                                                        </div>
                                                    )}
                                                    <div className="mt-2 grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2">
                                                        {submissionResults?.map((res, i) => (
                                                            <div key={i} className={`flex items-center gap-2 p-2 rounded-md text-sm font-medium ${res.passed ? 'bg-green-100 dark:bg-green-900/50 text-green-800 dark:text-green-300' : 'bg-red-100 dark:bg-red-900/50 text-red-800 dark:text-red-300'}`}>
                                                                {res.passed ? <CheckIcon className="h-4 w-4"/> : <XCircleIcon className="h-4 w-4"/>}
                                                                Test #{i+1}
                                                            </div>
                                                        ))}
                                                    </div>
                                                </>
                                            )}
                                            {overallSubmissionStatus !== 'Accepted' && overallSubmissionStatus !== 'Running' && (
                                                <div className="mt-4">
                                                    {(() => {
                                                        const failedTest = submissionResults?.find(r => !r.passed);
                                                        const failedTestIndex = failedTest ? submissionResults!.indexOf(failedTest) + 1 : 0;
                                                        if (!failedTest) return null;

                                                        return (
                                                            <>
                                                                <div className="p-3 bg-gray-50 dark:bg-gray-900/50 rounded-lg text-sm">
                                                                    <h4 className="font-semibold text-gray-800 dark:text-white mb-2">Failed on Test Case #{failedTestIndex}</h4>
                                                                    <div className="space-y-2 font-mono">
                                                                        <div>
                                                                            <p className="font-sans font-semibold text-gray-500 dark:text-gray-400">Input:</p>
                                                                            <pre className="p-2 bg-gray-200 dark:bg-gray-700 rounded whitespace-pre-wrap"><code>{failedTest.input}</code></pre>
                                                                        </div>
                                                                        <div>
                                                                            <p className="font-sans font-semibold text-gray-500 dark:text-gray-400">Expected Output:</p>
                                                                            <pre className="p-2 bg-gray-200 dark:bg-gray-700 rounded whitespace-pre-wrap"><code>{failedTest.expected}</code></pre>
                                                                        </div>
                                                                        <div>
                                                                            <p className="font-sans font-semibold text-gray-500 dark:text-gray-400">Your Output:</p>
                                                                            <pre className={`p-2 rounded whitespace-pre-wrap ${failedTest.stderr || failedTest.compile_output ? 'bg-red-100 dark:bg-red-900/50 text-red-800 dark:text-red-200' : 'bg-gray-200 dark:bg-gray-700'}`}><code>{failedTest.compile_output || failedTest.stderr || failedTest.stdout || 'No output'}</code></pre>
                                                                        </div>
                                                                    </div>
                                                                     {isExplanationLoading ? (
                                                                        <div className="mt-2 flex items-center gap-2 text-gray-500 dark:text-gray-400"><InlineLoadingIndicator /> <span>Analyzing failure...</span></div>
                                                                    ) : failureExplanation && (
                                                                        <div className="mt-3 pt-3 border-t border-gray-200 dark:border-gray-700">
                                                                            <p className="font-sans font-semibold text-gray-800 dark:text-white">AI Debugger:</p>
                                                                            <p className="font-sans text-gray-600 dark:text-gray-300 italic">"{failureExplanation}"</p>
                                                                        </div>
                                                                    )}
                                                                </div>

                                                                <div className="mt-2 text-sm">
                                                                    <button onClick={handleGetHint} disabled={isHintLoading} className="mt-2 flex items-center gap-1.5 px-3 py-1.5 text-sm font-semibold text-white bg-blue-500 rounded-lg hover:bg-blue-600 disabled:opacity-50">
                                                                        <SparklesIcon className="h-4 w-4" />
                                                                        {isHintLoading ? <InlineLoadingIndicator /> : 'Get a Hint'}
                                                                    </button>
                                                                    {hint && (
                                                                        <div className="mt-2 p-2 bg-gray-100 dark:bg-gray-700/50 rounded-lg italic text-gray-700 dark:text-gray-300">
                                                                            <p className="flex items-start gap-2"><LightbulbIcon className="h-4 w-4 mt-0.5 text-yellow-500 flex-shrink-0" /> {hint}</p>
                                                                        </div>
                                                                    )}
                                                                </div>
                                                            </>
                                                        );
                                                    })()}
                                                </div>
                                            )}
                                        </div>
                                    ) : <p className="text-sm text-gray-500">Submit code to see the final result.</p>
                                )}
                            </div>
                        </div>
                    </div>
                </div>

                {/* Footer */}
                <div className="flex-shrink-0 flex justify-end gap-4 p-2 border-t border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800">
                    <button onClick={handleRunCode} disabled={isExecuting} className="flex items-center justify-center gap-2 px-4 py-2 w-32 bg-gray-200 dark:bg-gray-700 font-semibold rounded-lg hover:bg-gray-300 dark:hover:bg-gray-600 disabled:opacity-50"><PlayIcon className="h-5 w-5"/> {isExecuting ? <InlineLoadingIndicator /> : 'Run Code'}</button>
                    <button onClick={handleSubmitCode} disabled={isExecuting} className="flex items-center justify-center gap-2 px-4 py-2 w-36 bg-green-500 text-white font-semibold rounded-lg hover:bg-green-600 disabled:opacity-50"><SendHorizonalIcon className="h-5 w-5"/> {isExecuting ? <InlineLoadingIndicator /> : 'Submit Code'}</button>
                </div>
            </div>
        );
    };

    switch(view) {
        case 'initial': return renderInitial();
        case 'mcq': return renderMcq();
        case 'mcq_results': return renderMcqResults();
        case 'coding_difficulty': return renderCodingDifficulty();
        case 'coding_workspace': return renderCodingWorkspace();
        default: return renderInitial();
    }
};

export default TestBuddy;