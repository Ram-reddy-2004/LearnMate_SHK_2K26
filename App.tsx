import React, { useState, useEffect, useCallback, useRef } from 'react';
import { auth, db } from './services/firebaseConfig';
import { useAuth } from './context/AuthContext';
import Header from './components/Header';
import ModuleSidebar from './components/ModuleSidebar';
import ChatWindow from './components/ChatWindow';
import PromptInput from './components/PromptInput';
import LearnVaultComponent from './components/LearnVault';
import SmartQuiz from './components/SmartQuiz';
import MyProgress from './components/MyProgress';
import TestBuddy from './components/TestBuddy';
import SkillPath from './components/SkillPath';
import LearnGuide from './components/LearnGuide';
import { AuthPage } from './components/AuthPage';
import { ModuleLoadingIndicator } from './components/LoadingIndicators';
import { type Message, Sender, UserData, QuizResult, TestResult, LearnVault } from './types';
import { generateContent, generatePersonalizedResponse } from './services/geminiService';
import { addLearnVault, getLearnVaults, getLearnVaultWithMessages, saveChatMessages, saveQuizResult, saveCodingResult, getUserPerformanceSummary } from './services/firebaseService';

const App: React.FC = () => {
  const { user, isLoading: isAuthLoading } = useAuth();
  const [userData, setUserData] = useState<UserData | null>(null);
  const [isUserDataLoading, setIsUserDataLoading] = useState(true);

  const [messages, setMessages] = useState<Message[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [activeModule, setActiveModule] = useState<string>('MyProgress');
  
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  
  // Vault and Chat History State
  const [vaults, setVaults] = useState<Omit<LearnVault, 'content' | 'messages'>[]>([]);
  const [activeVault, setActiveVault] = useState<LearnVault | null>(null);
  
  // AI Assistant State
  const [assistantMessages, setAssistantMessages] = useState<Message[]>([]);
  
  const saveTimeoutRef = useRef<number | null>(null);

  useEffect(() => {
    if (!user) {
        setUserData(null);
        setIsUserDataLoading(false);
        setVaults([]);
        setActiveVault(null);
        setAssistantMessages([]);
        return;
    }

    setIsUserDataLoading(true);
    const userDocRef = db.collection('users').doc(user.uid);
    
    const unsubscribeUser = userDocRef.onSnapshot(
      (doc) => {
        if (doc.exists) {
          const data = doc.data() as any;
          setUserData({
            uid: doc.id,
            profile: data.profile,
            createdAt: data.createdAt?.toDate().toISOString() || new Date().toISOString(),
          } as UserData);
        } else {
          setUserData(null);
        }
        setIsUserDataLoading(false);
      },
      (err) => {
        console.error("Error fetching user data:", err);
        setUserData(null);
        setIsUserDataLoading(false);
      }
    );

    // Set up listener for vaults
    const unsubscribeVaults = getLearnVaults(user.uid, (fetchedVaults) => {
        setVaults(fetchedVaults);
    });

    return () => {
        unsubscribeUser();
        unsubscribeVaults();
    };
  }, [user]);
  
  // Save chat messages to Firestore when they change for the active vault
  useEffect(() => {
    if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current);
    }
    if (activeVault && messages.length > 0) {
       // Debounce saving to prevent excessive writes
       saveTimeoutRef.current = window.setTimeout(() => {
            if (user && activeVault) {
                 // Only save if the messages have actually changed
                if (JSON.stringify(messages) !== JSON.stringify(activeVault.messages)) {
                    saveChatMessages(user.uid, activeVault.id, messages);
                }
            }
       }, 1500);
    }
    return () => {
        if (saveTimeoutRef.current) {
            clearTimeout(saveTimeoutRef.current);
        }
    }
  }, [messages, activeVault, user]);

  const handleSendAssistantMessage = useCallback(async (prompt: string, files: File[]) => {
    if (!prompt.trim()) return;
    if (!user) {
        setError("You must be logged in to use the assistant.");
        return;
    }
    
    setIsLoading(true);
    setError(null);

    const userMessage: Message = {
        id: `user-asst-${Date.now()}`,
        sender: Sender.User,
        text: prompt,
        timestamp: new Date().toISOString(),
    };
    
    const tempMessages = [...assistantMessages, userMessage];
    setAssistantMessages(tempMessages);

    try {
        // Gather context
        const performanceSummary = await getUserPerformanceSummary(user.uid);
        const vaultSummaries = vaults.map(v => v.summary);

        const aiResponseText = await generatePersonalizedResponse(prompt, vaultSummaries, performanceSummary);
        
        const aiMessage: Message = {
            id: `ai-asst-${Date.now()}`,
            sender: Sender.AI,
            text: aiResponseText,
            timestamp: new Date().toISOString(),
        };
        setAssistantMessages([...tempMessages, aiMessage]);

    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'An unknown error occurred.';
      setError(errorMessage);
      const aiErrorMessage: Message = {
        id: `ai-asst-error-${Date.now()}`,
        sender: Sender.AI,
        text: `Sorry, I encountered an error: ${errorMessage}`,
        isError: true,
        timestamp: new Date().toISOString(),
      };
      setAssistantMessages([...tempMessages, aiErrorMessage]);
    } finally {
        setIsLoading(false);
    }

  }, [user, vaults, assistantMessages]);


  const handleSendMessage = useCallback(async (prompt: string, files: File[]) => {
    if (!prompt.trim() && files.length === 0) return;
    if (activeModule === 'AI Assistant') {
        handleSendAssistantMessage(prompt, files);
        return;
    }
    if (!activeVault) {
        setError("Please select a knowledge vault from the sidebar to start chatting.");
        return;
    }

    setIsLoading(true);
    setError(null);

    const userMessage: Message = {
      id: `user-${Date.now()}`,
      sender: Sender.User,
      text: prompt,
      files: files.map(f => ({ name: f.name, type: f.type })),
      timestamp: new Date().toISOString(),
    };
    
    const tempMessages = [...messages, userMessage];
    setMessages(tempMessages);

    try {
      const aiResponseText = await generateContent(prompt, files, activeVault.content);
      const aiMessage: Message = {
        id: `ai-${Date.now()}`,
        sender: Sender.AI,
        text: aiResponseText,
        timestamp: new Date().toISOString(),
      };
      setMessages([...tempMessages, aiMessage]);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'An unknown error occurred.';
      setError(errorMessage);
      const aiErrorMessage: Message = {
        id: `ai-error-${Date.now()}`,
        sender: Sender.AI,
        text: `Sorry, I encountered an error: ${errorMessage}`,
        isError: true,
        timestamp: new Date().toISOString(),
      };
      setMessages([...tempMessages, aiErrorMessage]);
    } finally {
      setIsLoading(false);
    }
  }, [messages, activeVault, activeModule, handleSendAssistantMessage]);
  
  const handleModuleChange = (moduleName: string) => {
    setActiveModule(moduleName);
     if (moduleName === 'AI Assistant' && assistantMessages.length === 0) {
        // Add a welcome message if it's the first time
        setAssistantMessages([{
            id: `ai-asst-welcome-${Date.now()}`,
            sender: Sender.AI,
            text: "Hello! I'm your personalized AI Assistant. I have access to your vault history and progress. Ask me questions like 'What have I learned so far?' or 'How am I doing on my quizzes?'.",
            timestamp: new Date().toISOString()
        }]);
    }
  }

  const handleLoadVault = useCallback(async (vaultId: string, moduleToLoad: string = 'LearnGuide') => {
    if (!user) return;
    try {
        const fullVault = await getLearnVaultWithMessages(user.uid, vaultId);
        setActiveVault(fullVault);
        setMessages(fullVault.messages);
        setActiveModule(moduleToLoad);
    } catch (e) {
        console.error("Failed to load vault:", e);
        setError("Could not load the selected vault.");
    }
  }, [user]);
  
  const handleVaultCreated = useCallback(async (vaultData: { title: string; content: string; summary: string; }) => {
    if (!user) return;
    try {
        const newVaultId = await addLearnVault(user.uid, vaultData);
        // After creation, load this new vault to make it active and switch to LearnGuide
        await handleLoadVault(newVaultId, 'LearnGuide');
    } catch (e) {
        console.error("Failed to create vault:", e);
        setError(e instanceof Error ? e.message : 'Could not create the new vault.');
    }
  }, [user, handleLoadVault]);

  const handleMcqCompletion = useCallback(async (result: Omit<QuizResult, 'quizId' | 'attemptedAt'>) => {
    if (!user) return;
    try {
      await saveQuizResult(user.uid, result);
    } catch (e) {
      console.error("Failed to save quiz result:", e);
    }
  }, [user]);
  
  const handleCodingAttempt = useCallback(async (result: Omit<TestResult, 'attemptedAt'>) => {
    if (!user) return;
    try {
        await saveCodingResult(user.uid, result);
    } catch(e) {
        console.error("Failed to update user progress:", e);
    }
  }, [user]);
  
  const handleNewChat = () => {
    setActiveVault(null);
    setMessages([]);
    setError(null);
    setActiveModule('LearnVault');
  };
  
  const handleAssistantClick = () => {
    handleModuleChange('AI Assistant');
  };

  const handleSignOut = async () => {
    try {
      await auth.signOut();
    } catch (error) {
      console.error("Error signing out: ", error);
    }
  };

  if (isAuthLoading || isUserDataLoading) {
    return (
        <div className="flex items-center justify-center min-h-screen">
            <ModuleLoadingIndicator text="Loading LearnMate..." />
        </div>
    );
  }

  if (!user) {
    return <AuthPage />;
  }
  
  const knowledgeBase = activeVault?.content || '';
  
  const renderModuleContent = () => {
    switch (activeModule) {
      case 'LearnVault':
        return <LearnVaultComponent onVaultCreated={handleVaultCreated} />;
      case 'LearnGuide':
        return <LearnGuide 
                  knowledgeBase={knowledgeBase} 
                  onNavigateToVault={handleNewChat}
               />;
      case 'SmartQuiz':
        return <SmartQuiz 
                    knowledgeBase={knowledgeBase}
                    onNavigateToVault={handleNewChat}
                    onQuizComplete={handleMcqCompletion}
                />;
      case 'MyProgress':
      default:
        return <MyProgress 
                    userData={userData}
                    vaults={vaults}
                    onNavigateToQuiz={() => handleModuleChange('SmartQuiz')}
                    onNavigateToTestBuddy={() => handleModuleChange('TestBuddy')}
               />;
      case 'TestBuddy':
        return <TestBuddy
                    knowledgeBase={knowledgeBase}
                    onNavigateToVault={handleNewChat}
                    onMcqComplete={handleMcqCompletion}
                    onCodingAttempt={handleCodingAttempt}
                />;
      case 'SkillPath':
        return <SkillPath />;
      case 'AI Assistant':
        return <ChatWindow messages={assistantMessages} isLoading={isLoading} />;
    }
  };
  
  const showPromptInput = activeModule === 'AI Assistant';

  return (
    <div className="min-h-screen w-full font-sans bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 flex">
      <ModuleSidebar 
        isOpen={isSidebarOpen}
        setIsOpen={setIsSidebarOpen}
        activeModule={activeModule} 
        onModuleChange={handleModuleChange}
        vaults={vaults}
        activeVaultId={activeVault?.id || null}
        onLoadVault={handleLoadVault}
      />
      <div className="flex flex-col flex-1 md:ml-[250px]">
        <Header 
          onMenuClick={() => setIsSidebarOpen(true)}
          userData={userData}
          onSignOut={handleSignOut}
          onNewChat={handleNewChat}
          onAssistantClick={handleAssistantClick}
        />
        <main className="flex-1 overflow-y-auto p-4 md:p-6">
          {renderModuleContent()}
        </main>
        {showPromptInput && (
          <footer className="border-t border-gray-200 dark:border-gray-700 p-4 bg-white dark:bg-gray-800">
            {error && <p className="text-red-500 text-center text-sm mb-2">{error}</p>}
            <PromptInput onSubmit={handleSendMessage} isLoading={isLoading} />
          </footer>
        )}
      </div>
    </div>
  );
};

export default App;