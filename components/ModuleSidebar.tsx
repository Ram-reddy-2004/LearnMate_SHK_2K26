import React from 'react';
import { BookOpenIcon, BrainCircuitIcon, FlaskConicalIcon, LightbulbIcon, PencilRulerIcon, CompassIcon, PlusCircleIcon, AssistantIcon, MessageSquareIcon } from './Icons';
import { LearnVault } from '../types';

const modules = [
  { name: 'MyProgress', icon: <LightbulbIcon className="h-6 w-6" /> },
  { name: 'AI Assistant', icon: <AssistantIcon className="h-6 w-6" /> },
  { name: 'LearnGuide', icon: <CompassIcon className="h-6 w-6" /> },
  { name: 'SmartQuiz', icon: <PencilRulerIcon className="h-6 w-6" /> },
  { name: 'TestBuddy', icon: <FlaskConicalIcon className="h-6 w-6" /> },
  { name: 'SkillPath', icon: <BookOpenIcon className="h-6 w-6" /> },
];

interface ModuleSidebarProps {
    isOpen: boolean;
    setIsOpen: (isOpen: boolean) => void;
    activeModule: string;
    onModuleChange: (moduleName: string) => void;
    vaults: Omit<LearnVault, 'content' | 'messages'>[];
    activeVaultId: string | null;
    onLoadVault: (vaultId: string, module?: string) => void;
}

const ModuleSidebar: React.FC<ModuleSidebarProps> = ({ isOpen, setIsOpen, activeModule, onModuleChange, vaults, activeVaultId, onLoadVault }) => {
  const handleItemClick = (moduleName: string) => {
    onModuleChange(moduleName);
    if (window.innerWidth < 768) {
        setIsOpen(false);
    }
  };

  const handleVaultClick = (vaultId: string) => {
      // Defaults to 'LearnGuide' because of the change in App.tsx
      onLoadVault(vaultId);
      if (window.innerWidth < 768) {
          setIsOpen(false);
      }
  }
  
  const vaultConsumingModules = ['LearnGuide', 'SmartQuiz', 'TestBuddy'];
    
  return (
    <>
        {/* Overlay for mobile */}
        <div 
            className={`fixed inset-0 bg-black bg-opacity-50 z-30 md:hidden transition-opacity ${isOpen ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}
            onClick={() => setIsOpen(false)}
            aria-hidden="true"
        ></div>

        <aside className={`fixed top-0 left-0 z-40 h-screen w-[250px] bg-gray-50 dark:bg-gray-900 border-r border-gray-200 dark:border-gray-700 p-4 flex flex-col transition-transform duration-300 ease-in-out
            ${isOpen ? 'translate-x-0' : '-translate-x-full'} md:translate-x-0`}
        >
            <div className="flex items-center space-x-2 mb-4 flex-shrink-0">
                <h2 className="text-lg font-semibold text-gray-700 dark:text-gray-200">Modules</h2>
            </div>
            <nav className="flex-1 overflow-y-auto">
                <ul className="space-y-2">
                {modules.map((mod) => {
                    return (
                        <li key={mod.name}>
                            <button
                                onClick={() => handleItemClick(mod.name)}
                                className={`w-full flex items-center space-x-3 p-3 rounded-lg transition-colors ${
                                mod.name === activeModule
                                    ? 'bg-blue-500 text-white shadow-md'
                                    : 'text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700'
                                }`}
                            >
                                {mod.icon}
                                <span className="font-medium">{mod.name}</span>
                            </button>
                        </li>
                    );
                })}
                </ul>
                
                <div className="mt-6 pt-4 border-t border-gray-200 dark:border-gray-700">
                     <h3 className="px-3 text-sm font-semibold text-gray-500 dark:text-gray-400 mb-2">Vault History</h3>
                     <ul className="space-y-1">
                        <li>
                             <button
                                onClick={() => handleItemClick('LearnVault')}
                                className={`w-full flex items-center space-x-3 p-3 rounded-lg transition-colors ${
                                'LearnVault' === activeModule
                                    ? 'bg-blue-500 text-white shadow-md'
                                    : 'text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700'
                                }`}
                            >
                               <PlusCircleIcon className="h-6 w-6" />
                                <span className="font-medium">New Vault</span>
                            </button>
                        </li>
                        {vaults.map(vault => (
                             <li key={vault.id}>
                                <button
                                    onClick={() => handleVaultClick(vault.id)}
                                    className={`w-full flex items-center space-x-3 p-3 rounded-lg transition-colors ${
                                    vault.id === activeVaultId && vaultConsumingModules.includes(activeModule)
                                        ? 'bg-gray-200 dark:bg-gray-700 font-semibold text-gray-800 dark:text-white'
                                        : 'text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-700'
                                    }`}
                                >
                                   <BrainCircuitIcon className="h-5 w-5 flex-shrink-0" />
                                   <span className="font-medium truncate text-left flex-1">{vault.title}</span>
                                </button>
                            </li>
                        ))}
                     </ul>
                </div>
            </nav>
        </aside>
    </>
  );
};

export default ModuleSidebar;