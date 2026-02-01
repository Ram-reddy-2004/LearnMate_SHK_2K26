
import { GoogleGenAI, Type } from "@google/genai";
import { fileToBase64 } from "../utils/fileUtils";
import { getYoutubeVideoId, getYoutubeMetadata } from './youtubeService';
import type { QuizQuestion, QuizConfig, SkillPathResponse, Concept, CodingProblem, CodingProblemDifficulty, Language, SubmissionResult, LearnGoal, InterviewQuestion, PerformanceSummary, LearnGuideContent } from "../types";

if (!process.env.API_KEY) {
  throw new Error("API_KEY environment variable is not set.");
}

const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

const truncateText = (text: string, maxLength: number = 15000): string => {
  if (!text) return "";
  if (text.length <= maxLength) return text;
  return text.slice(-maxLength);
};

interface Part {
  text?: string;
  inlineData?: {
    mimeType: string;
    data: string;
  };
}

const filesToParts = async (files: File[]): Promise<Part[]> => {
    const parts: Part[] = [];
    for (const file of files) {
        if (!file.type) continue;
        const base64Data = await fileToBase64(file);
        parts.push({
            inlineData: {
                mimeType: file.type,
                data: base64Data,
            },
        });
    }
    return parts;
}

export const generateContent = async (prompt: string, files: File[], knowledgeBase?: string): Promise<string> => {
  try {
    const fileParts = await filesToParts(files);
    let fullPrompt = prompt;
    if (knowledgeBase) {
        fullPrompt = `You are a helpful learning assistant. Context: ${truncateText(knowledgeBase, 12000)}\n\nQuestion: ${prompt}`;
    }
    const result = await ai.models.generateContent({
        model: 'gemini-3-flash-preview',
        contents: { parts: [...fileParts, { text: fullPrompt }] },
    });
    return result.text || "";
  } catch (error) {
    throw new Error(`AI failed: ${error instanceof Error ? error.message : 'Unknown'}`);
  }
};

const learnVaultSchema = {
    type: Type.OBJECT,
    properties: {
        title: { type: Type.STRING },
        summary: { type: Type.STRING },
        content: { type: Type.STRING }
    },
    required: ["title", "summary", "content"]
};

export const processLearnVaultContent = async (files: File[], links: string[]): Promise<{ title: string; summary: string; content: string; sources?: {title: string, uri: string}[] }> => {
    try {
        const fileParts = await filesToParts(files);
        const cleanedLinks = (links || []).map(l => l.trim()).filter(l => l.length > 0);
        
        const youtubeLinks = cleanedLinks.filter(link => getYoutubeVideoId(link));
        const otherLinks = cleanedLinks.filter(link => !getYoutubeVideoId(link));

        // Use Pro model if we have YouTube links to leverage Google Search for summarization
        const useProModel = youtubeLinks.length > 0;
        
        let linkContext = "";
        if (youtubeLinks.length > 0) {
            linkContext += "\nYouTube Videos to summarize using Google Search grounding:\n" + youtubeLinks.join("\n");
        }
        if (otherLinks.length > 0) {
            linkContext += "\nOther links to include:\n" + otherLinks.join("\n");
        }

        const promptText = `Generate a comprehensive Markdown-formatted knowledge base.
        ${useProModel ? "I have provided YouTube URLs. Use the Google Search tool to find detailed summaries, key concepts, and educational takeaways for these specific videos. Provide a deep synthesis of the video content." : ""}
        ${linkContext}
        
        Combine the information from these web sources with any attached files to create a unified study guide.`;

        const result = await ai.models.generateContent({
            model: useProModel ? 'gemini-3-pro-preview' : 'gemini-3-flash-preview',
            contents: { parts: [{ text: promptText }, ...fileParts] },
            config: {
                responseMimeType: "application/json",
                responseSchema: learnVaultSchema,
                tools: useProModel ? [{ googleSearch: {} }] : undefined,
            }
        });

        const rawText = result.text;
        if (!rawText) {
            throw new Error("The AI returned an empty response.");
        }

        const vaultData = JSON.parse(rawText.trim());
        
        // Extract URLs from grounding metadata to cite sources
        const groundingChunks = result.candidates?.[0]?.groundingMetadata?.groundingChunks;
        if (groundingChunks) {
            vaultData.sources = groundingChunks
                .filter(c => c.web)
                .map(c => ({ title: c.web.title, uri: c.web.uri }));
        }

        return vaultData;
    } catch (error) {
        throw new Error(`Processing failed: ${error instanceof Error ? error.message : 'Unknown'}`);
    }
};

export const generateKnowledgeBase = async (topic: string): Promise<{ title: string; summary: string; content: string; }> => {
    const prompt = `Generate a detailed Markdown knowledge base about: "${topic}".`;
    const result = await ai.models.generateContent({
        model: 'gemini-3-flash-preview',
        contents: prompt,
        config: {
            responseMimeType: "application/json",
            responseSchema: learnVaultSchema,
        }
    });
    return JSON.parse((result.text || "").trim());
};

const quizSchema = {
    type: Type.OBJECT,
    properties: {
      topic: { type: Type.STRING },
      difficulty: { type: Type.STRING, enum: ["Easy", "Medium", "Hard"] },
      questions: {
        type: Type.ARRAY,
        items: {
          type: Type.OBJECT,
          properties: {
            questionText: { type: Type.STRING },
            options: { type: Type.ARRAY, items: { type: Type.STRING } },
            correctAnswer: { type: Type.STRING },
            explanation: { type: Type.STRING }
          },
          required: ["questionText", "options", "correctAnswer", "explanation"]
        }
      }
    },
    required: ["topic", "difficulty", "questions"]
};

export const generateQuiz = async (sourceText: string, config: QuizConfig): Promise<{ topic: string, difficulty: 'Easy' | 'Medium' | 'Hard', questions: QuizQuestion[] }> => {
    const result = await ai.models.generateContent({
        model: 'gemini-3-flash-preview',
        contents: `Generate a ${config.numQuestions} question quiz based on: ${truncateText(sourceText)}`,
        config: {
            responseMimeType: "application/json",
            responseSchema: quizSchema,
        },
    });
    return JSON.parse((result.text || "").trim());
}

const singleCodingProblemSchema = {
    type: Type.OBJECT,
    properties: {
        id: { type: Type.STRING },
        title: { type: Type.STRING },
        difficulty: { type: Type.STRING, enum: ["Easy", "Medium", "Hard"] },
        description: { type: Type.STRING },
        constraints: { type: Type.ARRAY, items: { type: Type.STRING } },
        examples: {
            type: Type.ARRAY,
            items: {
                type: Type.OBJECT,
                properties: { input: { type: Type.STRING }, output: { type: Type.STRING }, explanation: { type: Type.STRING } },
                required: ["input", "output"]
            }
        },
        testCases: {
            type: Type.ARRAY,
            items: {
                type: Type.OBJECT,
                properties: { input: { type: Type.STRING }, output: { type: Type.STRING } },
                required: ["input", "output"]
            }
        },
        starterCode: {
            type: Type.OBJECT,
            properties: { javascript: { type: Type.STRING }, python: { type: Type.STRING }, java: { type: Type.STRING }, c: { type: Type.STRING } },
            required: ["javascript", "python", "java", "c"]
        },
        solution: {
            type: Type.OBJECT,
            properties: { javascript: { type: Type.STRING }, python: { type: Type.STRING }, java: { type: Type.STRING }, c: { type: Type.STRING } },
            required: ["javascript", "python", "java", "c"]
        }
    },
    required: ["id", "title", "difficulty", "description", "constraints", "examples", "testCases", "starterCode", "solution"]
};

export const generateCodingProblem = async (sourceText: string, difficulty: CodingProblemDifficulty): Promise<CodingProblem> => {
    const result = await ai.models.generateContent({
        model: 'gemini-3-pro-preview',
        contents: `Generate a ${difficulty} coding problem based on: ${truncateText(sourceText)}`,
        config: {
            responseMimeType: "application/json",
            responseSchema: singleCodingProblemSchema,
            thinkingConfig: { thinkingBudget: 1024 },
        },
    });
    return JSON.parse((result.text || "").trim());
};

export const generateCodeHint = async (problem: CodingProblem, userCode: string, failedTest: { input: string, expected: string, actual: string }): Promise<string> => {
    const result = await ai.models.generateContent({
        model: 'gemini-3-pro-preview',
        contents: `Hint for problem: ${problem.description}\nCode: ${userCode}\nFailed: ${failedTest.input}`,
        config: { thinkingConfig: { thinkingBudget: 512 } }
    });
    return result.text || "";
};

export const generateFailureExplanation = async (problem: CodingProblem, userCode: string, failedTest: { input: string; expected: string; actual: string; }): Promise<string> => {
    const result = await ai.models.generateContent({
        model: 'gemini-3-pro-preview',
        contents: `Explain failure: ${problem.title}\nCode: ${userCode}\nFailed: ${failedTest.input}`,
        config: { thinkingConfig: { thinkingBudget: 1024 } }
    });
    return result.text || "";
};

export const isProgrammingTopic = async (sourceText: string): Promise<boolean> => {
    try {
        const result = await ai.models.generateContent({
            model: 'gemini-3-flash-preview',
            contents: `Is this about programming? ${truncateText(sourceText, 5000)}`,
            config: {
                responseMimeType: "application/json",
                responseSchema: {
                    type: Type.OBJECT,
                    properties: { isProgrammingTopic: { type: Type.BOOLEAN } },
                    required: ["isProgrammingTopic"]
                },
            },
        });
        const text = (result.text || "").trim();
        return text ? JSON.parse(text).isProgrammingTopic : false;
    } catch { return false; }
};

export const generateOverallSummary = async (summaries: string[]): Promise<string> => {
    if (summaries.length === 0) return "Start creating vaults!";
    const result = await ai.models.generateContent({ 
        model: 'gemini-3-flash-preview', 
        contents: `Summarize progress: ${summaries.join('\n')}`,
    });
    return result.text || "";
};

const skillPathSchema = {
    type: Type.OBJECT,
    properties: {
        careerOverview: { type: Type.STRING },
        trendingTechnologies: { type: Type.ARRAY, items: { type: Type.OBJECT, properties: { name: { type: Type.STRING }, description: { type: Type.STRING } }, required: ["name", "description"] } },
        skillGaps: { type: Type.ARRAY, items: { type: Type.STRING } },
        learningResources: { type: Type.ARRAY, items: { type: Type.OBJECT, properties: { type: { type: Type.STRING }, title: { type: Type.STRING }, description: { type: Type.STRING }, url: { type: Type.STRING } }, required: ["type", "title", "description", "url"] } }
    },
    required: ["careerOverview", "trendingTechnologies", "skillGaps", "learningResources"]
};

export const generateSkillPath = async (interests: string, skills: string): Promise<SkillPathResponse> => {
    const result = await ai.models.generateContent({
        model: 'gemini-3-flash-preview',
        contents: `SkillPath for ${interests} with ${skills}`,
        config: {
            responseMimeType: "application/json",
            responseSchema: skillPathSchema,
        },
    });
    return JSON.parse((result.text || "").trim());
};

const conceptSchema = {
    type: Type.OBJECT,
    properties: {
        title: { type: Type.STRING },
        definition: { type: Type.STRING },
        explanation: { type: Type.ARRAY, items: { type: Type.STRING } },
        examples: { type: Type.ARRAY, items: { type: Type.STRING } }
    },
    required: ["title", "definition", "explanation", "examples"]
};

export const startLearnGuideSession = async (knowledgeBase: string): Promise<{ concepts: string[], firstConcept: Concept }> => {
    const result = await ai.models.generateContent({
        model: 'gemini-3-flash-preview',
        contents: `Concept breakdown for: ${truncateText(knowledgeBase)}`,
        config: {
            responseMimeType: "application/json",
            responseSchema: {
                type: Type.OBJECT,
                properties: {
                    concepts: { type: Type.ARRAY, items: { type: Type.STRING } },
                    firstConcept: conceptSchema
                },
                required: ["concepts", "firstConcept"]
            },
        }
    });
    return JSON.parse((result.text || "").trim());
};

export const getConceptExplanation = async (knowledgeBase: string, conceptTitle: string, learnedConcepts: string[]): Promise<Concept> => {
    const result = await ai.models.generateContent({
        model: 'gemini-3-flash-preview',
        contents: `Explain "${conceptTitle}" using: ${truncateText(knowledgeBase)}`,
        config: { 
            responseMimeType: "application/json", 
            responseSchema: conceptSchema,
        }
    });
    return JSON.parse((result.text || "").trim());
};

export const reexplainConcept = async (conceptTitle: string, originalExplanation: string[]): Promise<Concept> => {
    const result = await ai.models.generateContent({
        model: 'gemini-3-flash-preview',
        contents: `Explain "${conceptTitle}" simply. Context: ${originalExplanation.join('. ')}`,
        config: { 
            responseMimeType: "application/json", 
            responseSchema: conceptSchema,
        }
    });
    return JSON.parse((result.text || "").trim());
};

export const explainCodeSnippet = async (codeSnippet: string): Promise<string> => {
    const result = await ai.models.generateContent({
        model: 'gemini-3-flash-preview',
        contents: `Explain code: \n\`\`\`\n${codeSnippet}\n\`\`\``,
    });
    return result.text || "";
};

export const evaluateCodeWithAI = async (language: Language, sourceCode: string, testCases: { stdin: string, expectedOutput?: string }[], problem: CodingProblem): Promise<SubmissionResult[]> => {
    const result = await ai.models.generateContent({
        model: 'gemini-3-pro-preview',
        contents: `Evaluate ${language} code for ${problem.title}. Cases: ${JSON.stringify(testCases)}`,
        config: {
            responseMimeType: "application/json",
            responseSchema: {
                type: Type.OBJECT,
                properties: {
                    results: {
                        type: Type.ARRAY,
                        items: {
                            type: Type.OBJECT,
                            properties: {
                                status: { type: Type.STRING, enum: ['Accepted', 'Wrong Answer', 'Runtime Error', 'Time Limit Exceeded', 'Compilation Error'] },
                                stdout: { type: Type.STRING },
                                stderr: { type: Type.STRING },
                                compile_output: { type: Type.STRING },
                                time: { type: Type.STRING },
                                memory: { type: Type.NUMBER }
                            },
                            required: ["status", "stdout", "stderr", "compile_output", "time", "memory"]
                        }
                    }
                },
                required: ["results"]
            },
            thinkingConfig: { thinkingBudget: 1024 },
        },
    });
    return JSON.parse((result.text || "").trim()).results;
};

export const generateLearnGuideContent = async (knowledgeBase: string, goal: LearnGoal): Promise<LearnGuideContent> => {
    const truncatedKb = truncateText(knowledgeBase);
    try {
        switch (goal) {
            case 'Descriptive': {
                const result = await ai.models.generateContent({ 
                    model: 'gemini-3-flash-preview', 
                    contents: `Descriptive study guide for: ${truncatedKb}`,
                });
                return { type: 'markdown', data: result.text || "", title: 'Exam Guide' };
            }
            case 'Revision': {
                const result = await ai.models.generateContent({ 
                    model: 'gemini-3-flash-preview', 
                    contents: `Revision notes for: ${truncatedKb}`,
                });
                return { type: 'markdown', data: result.text || "", title: 'Revision Notes' };
            }
            case 'Interview': {
                const result = await ai.models.generateContent({
                    model: 'gemini-3-flash-preview',
                    contents: `10 interview questions for: ${truncatedKb}`,
                    config: {
                        responseMimeType: "application/json",
                        responseSchema: {
                            type: Type.OBJECT,
                            properties: {
                                questions: { type: Type.ARRAY, items: { type: Type.OBJECT, properties: { question: { type: Type.STRING }, answer: { type: Type.STRING } }, required: ['question', 'answer'] } }
                            },
                            required: ['questions']
                        },
                    },
                });
                return { type: 'qa', data: JSON.parse((result.text || "").trim()).questions, title: 'Interview Q&A' };
            }
            default: {
                const data = await startLearnGuideSession(knowledgeBase);
                return { type: 'structured', data, title: data.firstConcept.title };
            }
        }
    } catch { throw new Error("Generation failed."); }
};

export const generateMoreInterviewQuestions = async (knowledgeBase: string, existingQuestions: InterviewQuestion[]): Promise<InterviewQuestion[]> => {
    const result = await ai.models.generateContent({
        model: 'gemini-3-flash-preview',
        contents: `10 more interview questions. Avoid: ${existingQuestions.map(q => q.question).join('\n')}`,
        config: {
            responseMimeType: "application/json",
            responseSchema: {
                type: Type.OBJECT,
                properties: { questions: { type: Type.ARRAY, items: { type: Type.OBJECT, properties: { question: { type: Type.STRING }, answer: { type: Type.STRING } }, required: ['question', 'answer'] } } },
                required: ['questions']
            },
        },
    });
    return JSON.parse((result.text || "").trim()).questions;
};

export const generatePersonalizedResponse = async (prompt: string, vaultSummaries: string[], performance: PerformanceSummary): Promise<string> => {
    const result = await ai.models.generateContent({
        model: 'gemini-3-flash-preview',
        contents: `Assistant context: Vaults [${vaultSummaries.join(',')}], Accuracy [${performance.quizAccuracy}%]. User prompt: ${prompt}`,
    });
    return result.text || "";
};
