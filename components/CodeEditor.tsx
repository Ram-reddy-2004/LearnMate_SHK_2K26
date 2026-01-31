import React, { useRef, useEffect } from 'react';
import { Language } from '../types';

// Make window.require available for Monaco's AMD loader
declare const window: any;

interface CodeEditorProps {
    language: Language;
    value: string;
    onChange: (value: string) => void;
    error?: { lineNumber: number; message: string; } | null;
}

// Debounce helper function to prevent rapid-fire resize calls
function debounce(func: (...args: any[]) => void, delay: number) {
    let timeoutId: ReturnType<typeof setTimeout>;
    return function(this: any, ...args: any[]) {
        clearTimeout(timeoutId);
        timeoutId = setTimeout(() => {
            func.apply(this, args);
        }, delay);
    };
}

const CodeEditor: React.FC<CodeEditorProps> = ({ language, value, onChange, error }) => {
    const editorRef = useRef<HTMLDivElement>(null);
    const monacoInstanceRef = useRef<any>(null);
    const onDidChangeContentRef = useRef<any>(null);

    useEffect(() => {
        let resizeObserver: ResizeObserver;
        if (editorRef.current) {
            window.require.config({ paths: { 'vs': 'https://cdn.jsdelivr.net/npm/monaco-editor@0.45.0/min/vs' }});
            window.require(['vs/editor/editor.main'], () => {
                if (!editorRef.current) return;
                
                const editor = window.monaco.editor.create(editorRef.current, {
                    value,
                    language,
                    theme: 'vs-dark',
                    automaticLayout: false, // Disable built-in layout to use our own
                    minimap: { enabled: false },
                    lineNumbers: 'on',
                    roundedSelection: false,
                    scrollBeyondLastLine: false,
                    readOnly: false,
                    fontSize: 14,
                    tabSize: 2,
                });

                onDidChangeContentRef.current = editor.onDidChangeModelContent(() => {
                    onChange(editor.getValue());
                });
                
                monacoInstanceRef.current = editor;

                // Implement a debounced ResizeObserver to manually handle layout changes
                const debouncedLayout = debounce(() => editor.layout(), 100);
                resizeObserver = new ResizeObserver(debouncedLayout);
                resizeObserver.observe(editorRef.current);
            });
        }

        return () => {
            if (monacoInstanceRef.current) {
                if (onDidChangeContentRef.current) {
                    onDidChangeContentRef.current.dispose();
                }
                monacoInstanceRef.current.dispose();
                monacoInstanceRef.current = null;
            }
            if (resizeObserver) {
                resizeObserver.disconnect();
            }
        };
    }, []); // Run only once on mount and unmount

    useEffect(() => {
        if (monacoInstanceRef.current && monacoInstanceRef.current.getModel()?.getLanguageId() !== language) {
             window.monaco.editor.setModelLanguage(monacoInstanceRef.current.getModel(), language);
        }
    }, [language]);
    
    useEffect(() => {
        // Set value only if it's different to avoid loops and cursor position loss
        if (monacoInstanceRef.current && monacoInstanceRef.current.getValue() !== value) {
            // Temporarily detach the listener to prevent onChange from firing
            if (onDidChangeContentRef.current) {
                onDidChangeContentRef.current.dispose();
            }
            
            monacoInstanceRef.current.setValue(value);
            
            // Re-attach the listener
            onDidChangeContentRef.current = monacoInstanceRef.current.onDidChangeModelContent(() => {
                onChange(monacoInstanceRef.current.getValue());
            });
        }
    }, [value, onChange]);

    // Effect to handle displaying errors in the editor
    useEffect(() => {
        if (monacoInstanceRef.current && window.monaco) {
            const model = monacoInstanceRef.current.getModel();
            if (model && error) {
                window.monaco.editor.setModelMarkers(model, 'owner', [{
                    startLineNumber: error.lineNumber,
                    startColumn: 1,
                    endLineNumber: error.lineNumber,
                    endColumn: model.getLineMaxColumn(error.lineNumber),
                    message: error.message,
                    severity: window.monaco.MarkerSeverity.Error
                }]);
            } else if (model) {
                // Clear errors if the error prop is null or undefined
                window.monaco.editor.setModelMarkers(model, 'owner', []);
            }
        }
    }, [error]);


    return <div ref={editorRef} className="absolute inset-0" />;
};

export default CodeEditor;