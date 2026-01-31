import React, { useState, useEffect, useMemo } from 'react';
import { generateQuiz } from '../services/geminiService';
import { type QuizQuestion, type QuizConfig, type QuizResult } from '../types';
import { PencilRulerIcon, Volume2Icon, CheckCircleIcon, XCircleIcon, BrainCircuitIcon } from './Icons';
import { ModuleLoadingIndicator } from './LoadingIndicators';

type QuizState = 'config' | 'loading' | 'active' | 'results';

interface SmartQuizProps {
    knowledgeBase: string;
    onNavigateToVault: () => void;
    onQuizComplete: (result: Omit<QuizResult, 'quizId' | 'attemptedAt'>) => void;
}

const ExplanationCard: React.FC<{ text: string }> = ({ text }) => {
    const [isSpeaking, setIsSpeaking] = useState(false);
    const [currentWordIndex, setCurrentWordIndex] = useState(-1);

    const words = useMemo(() => text.split(/\s+/).filter(Boolean), [text]);

    useEffect(() => {
        // Cleanup: stop speech when component unmounts or question changes
        return () => {
            if (speechSynthesis.speaking) {
                speechSynthesis.cancel();
            }
        };
    }, [text]);

    const handleSpeak = () => {
        if (!('speechSynthesis' in window)) {
            alert("Your browser does not support text-to-speech.");
            return;
        }

        const wasSpeaking = isSpeaking;

        // Always cancel to clear the queue and stop current speech.
        // This prevents the "interrupted" error.
        speechSynthesis.cancel();
        
        // Reset state immediately after cancelling.
        setIsSpeaking(false);
        setCurrentWordIndex(-1);

        // If the intention was to stop, we're done.
        if (wasSpeaking) {
            return;
        }

        // If the intention was to start, create and speak a new utterance.
        const utterance = new SpeechSynthesisUtterance(text);
        
        const voices = window.speechSynthesis.getVoices();
        const indianVoice = voices.find(v => v.lang === 'en-IN');
        utterance.voice = indianVoice || voices.find(v => v.lang.startsWith('en-')) || voices[0];
        utterance.rate = 1.0;

        utterance.onstart = () => {
            setIsSpeaking(true);
            setCurrentWordIndex(0);
        };
        
        utterance.onboundary = (event) => {
            if (event.name === 'word') {
                const textUpToBoundary = text.substring(0, event.charIndex);
                const wordCount = textUpToBoundary.split(/\s+/).filter(Boolean).length;
                setCurrentWordIndex(wordCount);
            }
        };
        
        utterance.onend = () => {
            setIsSpeaking(false);
            setCurrentWordIndex(-1);
        };
        
        utterance.onerror = (e) => {
             console.error("Speech synthesis error:", e);
             setIsSpeaking(false);
             setCurrentWordIndex(-1);
        };

        speechSynthesis.speak(utterance);
    };

    return (
        <div className="relative mt-4 p-4 bg-gray-50 dark:bg-gray-700/50 rounded-xl shadow-sm animate-fade-in">
            <button
                onClick={handleSpeak}
                className="absolute top-4 right-4 p-1 text-gray-500 hover:text-blue-500 dark:text-gray-400 dark:hover:text-blue-400 rounded-full"
                aria-label={isSpeaking ? 'Stop speech' : 'Read explanation aloud'}
            >
                <Volume2Icon className="h-5 w-5" />
            </button>
            <h4 className="font-bold text-gray-900 dark:text-white mb-2 text-lg">
                💡 Explanation
            </h4>
            <p className="text-gray-700 dark:text-gray-300 pr-8">
                {words.map((word, index) => (
                    <span
                        key={index}
                        className={`transition-colors duration-100 ${index === currentWordIndex ? 'bg-yellow-300 dark:bg-yellow-400 rounded' : 'bg-transparent'}`}
                    >
                        {word}{' '}
                    </span>
                ))}
            </p>
        </div>
    );
};

const SmartQuiz: React.FC<SmartQuizProps> = ({ knowledgeBase, onNavigateToVault, onQuizComplete }) => {
    const [quizState, setQuizState] = useState<QuizState>('config');
    const [config, setConfig] = useState<QuizConfig>({ numQuestions: 5 });
    const [questions, setQuestions] = useState<QuizQuestion[]>([]);
    const [quizTopic, setQuizTopic] = useState<string>('');
    const [quizDifficulty, setQuizDifficulty] = useState<'Easy' | 'Medium' | 'Hard'>('Easy');
    const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
    const [selectedAnswer, setSelectedAnswer] = useState<string | null>(null);
    const [isAnswerSubmitted, setIsAnswerSubmitted] = useState(false);
    const [score, setScore] = useState(0);
    const [error, setError] = useState<string | null>(null);
    const [startTime, setStartTime] = useState<Date | null>(null);

    const handleGenerateQuiz = async () => {
        if (!knowledgeBase.trim()) {
            setError('Your LearnVault is empty. Please add some notes first.');
            return;
        }
        setError(null);
        setQuizState('loading');
        try {
            const { questions: generatedQuestions, topic: generatedTopic, difficulty: generatedDifficulty } = await generateQuiz(knowledgeBase, config);
            if (generatedQuestions.length === 0) {
                 throw new Error("The AI could not generate a quiz from the provided text. Please try with different content.");
            }
            setQuestions(generatedQuestions);
            setQuizTopic(generatedTopic);
            setQuizDifficulty(generatedDifficulty);
            setQuizState('active');
            setStartTime(new Date());
        } catch (err) {
            const errorMessage = err instanceof Error ? err.message : 'An unknown error occurred.';
            setError(errorMessage);
            setQuizState('config');
        }
    };
    
    const handleAnswerSelect = (option: string) => {
        if (isAnswerSubmitted) return;
        setSelectedAnswer(option);
    };

    const handleSubmitAnswer = () => {
        if (selectedAnswer === null) return;
        
        const isCorrect = selectedAnswer === questions[currentQuestionIndex].correctAnswer;
        if (isCorrect) {
            setScore(prev => prev + 1);
        }
        setIsAnswerSubmitted(true);
    };

    const handleNextQuestion = () => {
        if (currentQuestionIndex < questions.length - 1) {
            setCurrentQuestionIndex(prev => prev + 1);
            setSelectedAnswer(null);
            setIsAnswerSubmitted(false);
        } else {
            const endTime = new Date();
            const timeDiff = endTime.getTime() - (startTime?.getTime() || endTime.getTime());
            const minutes = Math.floor(timeDiff / 60000);
            const seconds = Math.floor((timeDiff % 60000) / 1000);
            const timeTaken = `${minutes}m ${seconds}s`;

            // This logic is flawed. The score should be calculated at the end.
            // Let's recalculate based on submitted answer for the last question.
            let finalScore = score;
            if(isAnswerSubmitted && selectedAnswer === questions[currentQuestionIndex].correctAnswer){
                // if it's the last question and it was just submitted correctly, score has been updated
            } else if (isAnswerSubmitted && selectedAnswer !== questions[currentQuestionIndex].correctAnswer) {
                // if it's the last question and it was just submitted incorrectly, score is already correct
            } else {
                 // This case should not happen if button logic is correct.
            }

            const result = {
                title: quizTopic,
                difficulty: quizDifficulty,
                questions: questions.length,
                correctAnswers: finalScore,
                wrongAnswers: questions.length - finalScore,
                score: parseFloat(((finalScore / questions.length) * 100).toFixed(2)),
                timeTaken: timeTaken,
            };
            onQuizComplete(result);
            setQuizState('results');
        }
    };

    const handleReset = () => {
        setQuizState('config');
        setQuestions([]);
        setCurrentQuestionIndex(0);
        setSelectedAnswer(null);
        setIsAnswerSubmitted(false);
        setScore(0);
        setError(null);
        setQuizTopic('');
        setStartTime(null);
    };

    const renderConfigScreen = () => (
        <div className="w-full max-w-3xl mx-auto text-center">
             <div className="flex justify-center items-center gap-3 mb-4">
                <PencilRulerIcon className="h-10 w-10 text-blue-500"/>
                <h1 className="text-3xl font-bold text-gray-800 dark:text-white">SmartQuiz Generator</h1>
            </div>

            {error && <p className="mb-4 text-red-500 dark:text-red-400 font-medium animate-fade-in">{error}</p>}

            { !knowledgeBase.trim() ? (
                <div className="mt-8 p-8 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg">
                    <BrainCircuitIcon className="h-12 w-12 text-gray-400 dark:text-gray-500 mx-auto mb-4" />
                    <h2 className="text-xl font-semibold text-gray-800 dark:text-white">No Knowledge Base Selected</h2>
                    <p className="text-gray-600 dark:text-gray-400 mt-2 mb-6">
                        Please create a new vault or select one from your history. SmartQuiz uses the active vault's content to create quizzes.
                    </p>
                    <button onClick={onNavigateToVault} className="px-6 py-3 bg-blue-500 text-white font-semibold rounded-lg shadow-md hover:bg-blue-600 transition-colors">
                        Create New Vault
                    </button>
                </div>
            ) : (
                <>
                    <p className="text-gray-600 dark:text-gray-400 mb-8">
                        Ready to test your knowledge? I'll generate a quiz based on the content in your active LearnVault.
                    </p>
                    <div className="mt-6 flex justify-center items-center gap-4">
                        <label htmlFor="numQuestions" className="font-medium text-gray-700 dark:text-gray-200">Number of Questions:</label>
                        <select 
                            id="numQuestions"
                            value={config.numQuestions} 
                            onChange={(e) => setConfig({ ...config, numQuestions: parseInt(e.target.value, 10)})}
                            className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
                        >
                            <option value="5">5</option>
                            <option value="10">10</option>
                        </select>
                    </div>
                    <div className="mt-8">
                        <button onClick={handleGenerateQuiz} className="px-8 py-3 bg-blue-500 text-white font-semibold rounded-lg shadow-md hover:bg-blue-600 disabled:bg-blue-300 transition-colors">
                            Generate Quiz
                        </button>
                    </div>
                </>
            )}
        </div>
    );
    
    const renderLoadingScreen = () => (
        <ModuleLoadingIndicator text="Generating your quiz..." />
    );

    const renderQuizScreen = () => {
        const question = questions[currentQuestionIndex];
        return (
            <div className="w-full max-w-2xl mx-auto">
                 <div className="mb-6">
                    <div className="flex justify-between items-center mb-2">
                        <p className="text-sm font-semibold text-blue-500">Question {currentQuestionIndex + 1} of {questions.length}</p>
                        <p className="text-sm font-semibold text-gray-600 dark:text-gray-300">Score: {score}</p>
                    </div>
                    <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2.5">
                        <div className="bg-blue-500 h-2.5 rounded-full" style={{ width: `${((currentQuestionIndex + 1) / questions.length) * 100}%` }}></div>
                    </div>
                </div>

                <div className="bg-white dark:bg-gray-800 p-8 rounded-xl shadow-lg border border-gray-200 dark:border-gray-700">
                    <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-6">{question.questionText}</h2>
                    <div className="space-y-4">
                        {question.options.map((option, index) => {
                            const isCorrect = option === question.correctAnswer;
                            const isSelected = option === selectedAnswer;
                            let optionClass = "border-gray-300 dark:border-gray-600 hover:border-blue-500 dark:hover:border-blue-400 hover:bg-blue-50 dark:hover:bg-gray-700";
                             if (isAnswerSubmitted) {
                                if (isCorrect) {
                                    optionClass = "border-green-500 bg-green-50 dark:bg-green-900/50 text-green-800 dark:text-green-300";
                                } else if (isSelected && !isCorrect) {
                                    optionClass = "border-red-500 bg-red-50 dark:bg-red-900/50 text-red-800 dark:text-red-300";
                                }
                            } else if (isSelected) {
                                optionClass = "border-blue-500 bg-blue-50 dark:bg-gray-700 ring-2 ring-blue-500";
                            }

                            return (
                                <button
                                    key={index}
                                    onClick={() => handleAnswerSelect(option)}
                                    disabled={isAnswerSubmitted}
                                    className={`w-full text-left flex items-center p-4 border-2 rounded-lg transition-all ${optionClass} disabled:cursor-not-allowed`}
                                >
                                    <span className="flex-1 font-medium text-gray-800 dark:text-gray-200">{option}</span>
                                     {isAnswerSubmitted && isCorrect && <CheckCircleIcon className="h-6 w-6 text-green-500" />}
                                     {isAnswerSubmitted && isSelected && !isCorrect && <XCircleIcon className="h-6 w-6 text-red-500" />}
                                </button>
                            );
                        })}
                    </div>
                    
                    {isAnswerSubmitted && (
                        <ExplanationCard text={question.explanation} />
                    )}

                    <div className="mt-8 text-center">
                         {!isAnswerSubmitted ? (
                            <button onClick={handleSubmitAnswer} disabled={selectedAnswer === null} className="px-8 py-3 bg-blue-500 text-white font-semibold rounded-lg shadow-md hover:bg-blue-600 disabled:bg-gray-300 dark:disabled:bg-gray-600 disabled:cursor-not-allowed transition-colors">
                                Submit
                            </button>
                        ) : (
                            <button onClick={handleNextQuestion} className="px-8 py-3 bg-green-500 text-white font-semibold rounded-lg shadow-md hover:bg-green-600 transition-colors">
                                {currentQuestionIndex < questions.length - 1 ? 'Next Question' : 'Finish Quiz'}
                            </button>
                        )}
                    </div>
                </div>
            </div>
        );
    };

     const renderResultsScreen = () => (
        <div className="w-full max-w-2xl mx-auto text-center bg-white dark:bg-gray-800 p-8 rounded-xl shadow-lg border border-gray-200 dark:border-gray-700">
            <h2 className="text-3xl font-bold text-gray-800 dark:text-white mb-2">Quiz Complete!</h2>
            <p className="text-gray-600 dark:text-gray-400 mb-6">Well done on completing the quiz on <span className="font-semibold">{quizTopic}</span>.</p>
            <div className="mb-8">
                <p className="text-lg text-gray-700 dark:text-gray-200">Your Score:</p>
                <p className="text-6xl font-bold text-blue-500 my-2">{score} <span className="text-4xl text-gray-500 dark:text-gray-400">/ {questions.length}</span></p>
            </div>
            <button onClick={handleReset} className="px-8 py-3 bg-blue-500 text-white font-semibold rounded-lg shadow-md hover:bg-blue-600 transition-colors">
                Create Another Quiz
            </button>
        </div>
    );

    return (
        <div className="w-full h-full flex flex-col items-center justify-center p-4">
            {quizState === 'config' && renderConfigScreen()}
            {quizState === 'loading' && renderLoadingScreen()}
            {quizState === 'active' && renderQuizScreen()}
            {quizState === 'results' && renderResultsScreen()}
        </div>
    );
};

export default SmartQuiz;