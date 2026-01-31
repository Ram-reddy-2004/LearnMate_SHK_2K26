import React, { useState } from 'react';
import { generateSkillPath } from '../services/geminiService';
import { type SkillPathResponse, type LearningResource, ResourceType } from '../types';
import { BookOpenIcon, SparklesIcon, BookMarkedIcon, YoutubeIcon, HammerIcon } from './Icons';
import { ModuleLoadingIndicator } from './LoadingIndicators';

type SkillPathState = 'input' | 'loading' | 'results';

const ResourceCard: React.FC<{ resource: LearningResource }> = ({ resource }) => {
    const getIcon = () => {
        switch (resource.type) {
            case ResourceType.Course: return <BookMarkedIcon className="h-6 w-6 text-blue-500" />;
            case ResourceType.Video: return <YoutubeIcon className="h-6 w-6 text-red-500" />;
            case ResourceType.Project: return <HammerIcon className="h-6 w-6 text-yellow-500" />;
            default: return <BookOpenIcon className="h-6 w-6 text-gray-500" />;
        }
    };
    return (
        <a href={resource.url} target="_blank" rel="noopener noreferrer" className="block p-6 bg-white dark:bg-gray-800 rounded-xl shadow-md border border-gray-200 dark:border-gray-700 hover:shadow-lg hover:border-blue-500 dark:hover:border-blue-400 transition-all transform hover:-translate-y-1">
            <div className="flex items-start gap-4">
                <div className="flex-shrink-0 pt-1">{getIcon()}</div>
                <div>
                    <h4 className="font-bold text-lg text-gray-800 dark:text-white">{resource.title}</h4>
                    {resource.creator && (
                        <p className="text-sm font-medium text-gray-500 dark:text-gray-400">{resource.creator}</p>
                    )}
                    <p className="text-gray-600 dark:text-gray-400 mt-1">{resource.description}</p>
                </div>
            </div>
        </a>
    );
};


const SkillPath: React.FC = () => {
    const [state, setState] = useState<SkillPathState>('input');
    const [interests, setInterests] = useState('');
    const [skills, setSkills] = useState('');
    const [result, setResult] = useState<SkillPathResponse | null>(null);
    const [error, setError] = useState<string | null>(null);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!interests.trim() || !skills.trim()) {
            setError("Please fill out both your interests and current skills.");
            return;
        }
        setError(null);
        setState('loading');
        try {
            const skillPathResult = await generateSkillPath(interests, skills);
            setResult(skillPathResult);
            setState('results');
        } catch (err) {
            const errorMessage = err instanceof Error ? err.message : 'An unknown error occurred.';
            setError(errorMessage);
            setState('input');
        }
    };

    const handleReset = () => {
        setState('input');
        setInterests('');
        setSkills('');
        setResult(null);
        setError(null);
    };

    const renderInputScreen = () => (
        <div className="w-full max-w-4xl mx-auto text-center flex flex-col items-center justify-center h-full p-4">
            <div className="flex justify-center items-center gap-3 mb-4">
                <BookOpenIcon className="h-10 w-10 text-blue-500" />
                <h1 className="text-3xl font-bold text-gray-800 dark:text-white">Discover Your SkillPath</h1>
            </div>
            <p className="text-gray-600 dark:text-gray-400 mb-8 max-w-2xl">
                Tell me about your goals and what you already know, and I'll generate a personalized roadmap to help you succeed in your field.
            </p>
            
            {error && <p className="mb-4 text-red-500 dark:text-red-400 font-medium animate-fade-in">{error}</p>}

            <form onSubmit={handleSubmit} className="w-full space-y-6 bg-white dark:bg-gray-800 p-8 rounded-xl shadow-lg border border-gray-200 dark:border-gray-700">
                <div>
                    <label htmlFor="interests" className="block text-left text-lg font-semibold text-gray-700 dark:text-gray-200 mb-2">Your Interests & Career Goals</label>
                    <textarea 
                        id="interests"
                        value={interests}
                        onChange={(e) => setInterests(e.target.value)}
                        placeholder="e.g., 'Become a front-end web developer', 'Work with AI and data science', 'Create mobile apps'"
                        rows={3}
                        className="w-full p-3 border border-gray-300 dark:border-gray-600 rounded-lg bg-gray-50 dark:bg-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                </div>
                 <div>
                    <label htmlFor="skills" className="block text-left text-lg font-semibold text-gray-700 dark:text-gray-200 mb-2">Your Current Skills</label>
                    <textarea 
                        id="skills"
                        value={skills}
                        onChange={(e) => setSkills(e.target.value)}
                        placeholder="e.g., 'JavaScript, HTML, some Python', 'Basic understanding of machine learning', 'Familiar with Java'"
                        rows={3}
                        className="w-full p-3 border border-gray-300 dark:border-gray-600 rounded-lg bg-gray-50 dark:bg-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                </div>
                <button type="submit" className="w-full px-8 py-4 bg-blue-500 text-white text-lg font-semibold rounded-lg shadow-md hover:bg-blue-700 disabled:bg-blue-300 transition-colors flex items-center justify-center gap-2">
                    <SparklesIcon className="h-6 w-6" />
                    Generate SkillPath
                </button>
            </form>
        </div>
    );

    const renderLoadingScreen = () => (
         <ModuleLoadingIndicator text="Building your personalized roadmap..." />
    );

    const renderResultsScreen = () => (
        <div className="w-full max-w-4xl mx-auto p-4 space-y-8 animate-fade-in">
            <div>
                <button onClick={handleReset} className="text-blue-500 hover:underline mb-4">&larr; Generate a new path</button>
                <h1 className="text-4xl font-bold text-gray-800 dark:text-white">Your Personalized SkillPath</h1>
            </div>
            
            <div className="bg-white dark:bg-gray-800 p-8 rounded-xl shadow-lg border border-gray-200 dark:border-gray-700">
                <h2 className="text-2xl font-bold text-gray-800 dark:text-white mb-4">Career Snapshot</h2>
                <p className="text-lg text-gray-600 dark:text-gray-300 italic">"{result?.careerOverview}"</p>
            </div>
            
             <div className="space-y-4">
                <h2 className="text-2xl font-bold text-gray-800 dark:text-white">Trending Technologies</h2>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {result?.trendingTechnologies.map((tech, i) => (
                        <div key={i} className="p-4 bg-gray-50 dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700">
                           <h3 className="font-semibold text-blue-600 dark:text-blue-400">{tech.name}</h3>
                           <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">{tech.description}</p>
                        </div>
                    ))}
                </div>
            </div>

            <div className="space-y-4">
                <h2 className="text-2xl font-bold text-gray-800 dark:text-white">Your Next Steps (Skill Gaps)</h2>
                <ul className="list-disc list-inside space-y-2 text-gray-700 dark:text-gray-300 bg-yellow-50 dark:bg-yellow-900/40 p-6 rounded-lg border border-yellow-200 dark:border-yellow-800">
                    {result?.skillGaps.map((gap, i) => <li key={i} className="font-medium">{gap}</li>)}
                </ul>
            </div>

            <div className="space-y-4">
                 <h2 className="text-2xl font-bold text-gray-800 dark:text-white">Recommended Learning Resources</h2>
                 <div className="space-y-4">
                    {result?.learningResources.map((res, i) => <ResourceCard key={i} resource={res} />)}
                 </div>
            </div>

             <div className="text-center pt-8">
                <p className="text-2xl font-bold text-gray-800 dark:text-white">Start your SkillPath today 🚀</p>
             </div>
        </div>
    );
    
    switch (state) {
        case 'loading': return renderLoadingScreen();
        case 'results': return renderResultsScreen();
        case 'input':
        default:
            return renderInputScreen();
    }
};

export default SkillPath;