
import { GoogleGenAI, Type } from "@google/genai";
import { fileToBase64 } from "../utils/fileUtils";
import { getYouTubeTranscript } from './youtubeService';
import type { QuizQuestion, QuizConfig, SkillPathResponse, Concept, CodingProblem, CodingProblemDifficulty, Language, SubmissionResult, LearnGoal, InterviewQuestion, PerformanceSummary } from "../types";

if (!process.env.API_KEY) {
  throw new Error("API_KEY environment variable is not set.");
}

const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

/**
 * Truncates text to a maximum length, taking the end of the string.
 * This is useful for providing recent context to AI models without exceeding token limits.
 */
const truncateText = (text: string, maxLength: number = 15000): string => {
  if (text.length <= maxLength) {
    return text;
  }
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
        if (!file.type) {
            console.warn(`Skipping file with unknown MIME type: ${file.name}`);
            continue;
        }
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

/**
 * For chat-based interactions with files and a specific knowledge base.
 */
export const generateContent = async (prompt: string, files: File[], knowledgeBase?: string): Promise<string> => {
  try {
    const fileParts = await filesToParts(files);
    
    let fullPrompt = prompt;
    if (knowledgeBase) {
        fullPrompt = `You are a helpful learning assistant. Your knowledge is strictly limited to the provided 'Knowledge Base'. Do not use any external information to answer the user's question. If the answer is not in the knowledge base, say "I can't answer that based on the provided material."

Knowledge Base:
---
${truncateText(knowledgeBase, 12000)}
---

User's Question:
${prompt}
`;
    }

    const promptPart = { text: fullPrompt };
    const parts = [...fileParts, promptPart];

    const result = await ai.models.generateContent({
        model: 'gemini-3-flash-preview',
        contents: { parts },
        config: {
            thinkingConfig: { thinkingBudget: 0 }
        }
    });

    return result.text || "";
  } catch (error) {
    console.error("Error generating content:", error);
    throw new Error(`AI generation failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
};


const getYoutubeVideoId = (url: string): string | null => {
    try {
        const urlObj = new URL(url);
        if (urlObj.hostname === 'youtu.be') {
            return urlObj.pathname.substring(1).split('?')[0];
        }
        if (urlObj.hostname.includes('youtube.com')) {
            const videoId = urlObj.searchParams.get('v');
            if (videoId) return videoId;
        }
    } catch (e) {}
    return null;
};


const learnVaultSchema = {
    type: Type.OBJECT,
    properties: {
        title: {
            type: Type.STRING,
            description: "A short, descriptive, and engaging title for the synthesized content (5-10 words maximum)."
        },
        summary: {
            type: Type.STRING,
            description: "A concise, one-sentence summary of the main topic covered in the content."
        },
        content: {
            type: Type.STRING,
            description: "The full, synthesized, and well-structured knowledge base formatted in Markdown."
        }
    },
    required: ["title", "summary", "content"]
};

/**
 * For LearnVault: Processes files/links and returns a structured object with title, summary, and content.
 */
export const processLearnVaultContent = async (files: File[], links: string[]): Promise<{ title: string; summary: string; content: string; }> => {
    if (files.length === 0 && links.length === 0) {
        throw new Error("No content provided to process.");
    }

    try {
        const fileParts = await filesToParts(files);
        const youtubeLinks = links.filter(link => getYoutubeVideoId(link));
        const otherLinks = links.filter(link => !getYoutubeVideoId(link));

        let transcriptsText = '';
        if (youtubeLinks.length > 0) {
            const transcriptPromises = youtubeLinks.map(link => {
                const videoId = getYoutubeVideoId(link);
                return videoId ? getYouTubeTranscript(videoId).then(transcript => ({ link, transcript })) : Promise.resolve({ link, transcript: "[Invalid YouTube URL]" });
            });
            const settledTranscripts = await Promise.all(transcriptPromises);
            transcriptsText = settledTranscripts.map(({ link, transcript }) => `--- Transcript from ${link} ---\n${transcript}\n--- End Transcript ---`).join('\n\n');
        }

        let promptSegments: string[] = [
            `You are an expert learning assistant. Synthesize all sources into a single, cohesive knowledge base in Markdown. Finally, format your entire response as a single JSON object matching the required schema.`
        ];

        if (otherLinks.length > 0) promptSegments.push(`**Web Pages to Process:**\n${otherLinks.join('\n')}`);
        if (transcriptsText) promptSegments.push(`**Video Transcripts to Process:**\n${transcriptsText}`);
        
        const promptText = promptSegments.join('\n\n---\n\n');
        const parts = [{ text: promptText }, ...fileParts];

        const result = await ai.models.generateContent({
            model: 'gemini-3-flash-preview',
            contents: { parts },
            config: {
                responseMimeType: "application/json",
                responseSchema: learnVaultSchema,
                thinkingConfig: { thinkingBudget: 0 }
            }
        });

        return JSON.parse(result.text.trim());
    } catch (error) {
        console.error("Error processing LearnVault content:", error);
        throw new Error(`AI processing failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
};

/**
 * For LearnVault: Generates a knowledge base and returns a structured object.
 */
export const generateKnowledgeBase = async (topic: string): Promise<{ title: string; summary: string; content: string; }> => {
    const prompt = `You are an expert content creator. Generate a comprehensive knowledge base about the topic: "${topic}".
Include key concepts, definitions, and examples in Markdown.
Your response must be a single JSON object matching the required schema.`;

    try {
        const result = await ai.models.generateContent({
            model: 'gemini-3-flash-preview',
            contents: prompt,
            config: {
                responseMimeType: "application/json",
                responseSchema: learnVaultSchema,
                thinkingConfig: { thinkingBudget: 0 }
            }
        });
        return JSON.parse(result.text.trim());
    } catch (error) {
        console.error("Error generating knowledge base:", error);
        throw new Error(`AI knowledge base generation failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
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

/**
 * For SmartQuiz: Generates a quiz from source text using a JSON schema.
 */
export const generateQuiz = async (sourceText: string, config: QuizConfig): Promise<{ topic: string, difficulty: 'Easy' | 'Medium' | 'Hard', questions: QuizQuestion[] }> => {
    const truncatedText = truncateText(sourceText);
    const prompt = `Based on the following text, generate a multiple-choice quiz with ${config.numQuestions} questions. Output as JSON.

    Text:
    ---
    ${truncatedText}
    ---
    `;

    try {
        const result = await ai.models.generateContent({
            model: 'gemini-3-flash-preview',
            contents: prompt,
            config: {
                responseMimeType: "application/json",
                responseSchema: quizSchema,
                thinkingConfig: { thinkingBudget: 0 },
            },
        });

        return JSON.parse(result.text.trim());
    } catch (error) {
        console.error("Error generating quiz:", error);
        throw new Error(`AI quiz generation failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
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
                properties: {
                    input: { type: Type.STRING },
                    output: { type: Type.STRING },
                    explanation: { type: Type.STRING }
                },
                required: ["input", "output"]
            }
        },
        testCases: {
            type: Type.ARRAY,
            items: {
                type: Type.OBJECT,
                properties: {
                    input: { type: Type.STRING },
                    output: { type: Type.STRING }
                },
                required: ["input", "output"]
            }
        },
        starterCode: {
            type: Type.OBJECT,
            properties: {
                javascript: { type: Type.STRING },
                python: { type: Type.STRING },
                java: { type: Type.STRING },
                c: { type: Type.STRING },
            },
            required: ["javascript", "python", "java", "c"]
        },
        solution: {
            type: Type.OBJECT,
            properties: {
                javascript: { type: Type.STRING },
                python: { type: Type.STRING },
                java: { type: Type.STRING },
                c: { type: Type.STRING },
            },
            required: ["javascript", "python", "java", "c"]
        }
    },
    required: ["id", "title", "difficulty", "description", "constraints", "examples", "testCases", "starterCode", "solution"]
};

/**
 * For TestBuddy: Generates a single coding problem.
 */
export const generateCodingProblem = async (sourceText: string, difficulty: CodingProblemDifficulty): Promise<CodingProblem> => {
    const truncatedText = truncateText(sourceText);
    const prompt = `Based on the following knowledge base, generate ONE new coding problem of '${difficulty}' difficulty. Output as JSON.

    Knowledge Base:
    ---
    ${truncatedText}
    ---
    `;

    try {
        const result = await ai.models.generateContent({
            model: 'gemini-3-pro-preview',
            contents: prompt,
            config: {
                responseMimeType: "application/json",
                responseSchema: singleCodingProblemSchema,
                thinkingConfig: { thinkingBudget: 1024 },
            },
        });

        return JSON.parse(result.text.trim());
    } catch (error) {
        console.error("Error generating coding problem:", error);
        throw new Error(`AI problem generation failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
};

/**
 * For TestBuddy: Provides a hint for incorrect code.
 */
export const generateCodeHint = async (problem: CodingProblem, userCode: string, failedTest: { input: string, expected: string, actual: string }): Promise<string> => {
    const prompt = `Provide a short hint for this coding problem:
    
    Problem: ${problem.description}
    Code: ${userCode}
    Failed Test: Input ${failedTest.input}, Expected ${failedTest.expected}, Actual ${failedTest.actual}
    
    Hint (1-3 sentences):`;

    try {
        const result = await ai.models.generateContent({
            model: 'gemini-3-pro-preview',
            contents: prompt,
            config: { thinkingConfig: { thinkingBudget: 512 } }
        });
        return result.text || "";
    } catch (error) {
        console.error("Error generating code hint:", error);
        return "Focus on the logic near the failing test case input.";
    }
};

/**
 * For TestBuddy: Explains why code failed.
 */
export const generateFailureExplanation = async (problem: CodingProblem, userCode: string, failedTest: { input: string; expected: string; actual: string; }): Promise<string> => {
    const prompt = `Explain why this code failed:
    Problem: ${problem.title}
    Code: ${userCode}
    Failed Test: Input ${failedTest.input}, Expected ${failedTest.expected}, Actual ${failedTest.actual}`;

    try {
        const result = await ai.models.generateContent({
            model: 'gemini-3-pro-preview',
            contents: prompt,
            config: { thinkingConfig: { thinkingBudget: 1024 } }
        });
        return result.text || "";
    } catch (error) {
        console.error("Error generating failure explanation:", error);
        return "An error occurred during analysis.";
    }
};


/**
 * For TestBuddy: Determines if a knowledge base is programming-related.
 */
export const isProgrammingTopic = async (sourceText: string): Promise<boolean> => {
    const truncatedText = truncateText(sourceText, 8000);
    const prompt = `Is this text related to programming? Output JSON with "isProgrammingTopic" boolean key.
    Text: ${truncatedText}`;
    try {
        const result = await ai.models.generateContent({
            model: 'gemini-3-flash-preview',
            contents: prompt,
            config: {
                responseMimeType: "application/json",
                responseSchema: {
                    type: Type.OBJECT,
                    properties: { isProgrammingTopic: { type: Type.BOOLEAN } },
                    required: ["isProgrammingTopic"]
                },
                thinkingConfig: { thinkingBudget: 0 },
            },
        });
        const parsed = JSON.parse(result.text.trim());
        return parsed.isProgrammingTopic;
    } catch (error) {
        return false;
    }
};

/**
 * For MyProgress: Generates a high-level summary.
 */
export const generateOverallSummary = async (summaries: string[]): Promise<string> => {
    if (summaries.length === 0) return "Start creating vaults to track your progress!";
    const prompt = `Summarize these learning topics into a motivational 2-line focus statement:\n${summaries.join('\n')}`;
    try {
        const result = await ai.models.generateContent({ 
            model: 'gemini-3-flash-preview', 
            contents: prompt,
            config: { thinkingConfig: { thinkingBudget: 0 } }
        });
        return result.text || "";
    } catch (error) {
        return "Keep exploring new topics!";
    }
};


const skillPathSchema = {
    type: Type.OBJECT,
    properties: {
        careerOverview: { type: Type.STRING },
        trendingTechnologies: {
            type: Type.ARRAY,
            items: {
                type: Type.OBJECT,
                properties: {
                    name: { type: Type.STRING },
                    description: { type: Type.STRING }
                },
                required: ["name", "description"]
            }
        },
        skillGaps: { type: Type.ARRAY, items: { type: Type.STRING } },
        learningResources: {
            type: Type.ARRAY,
            items: {
                type: Type.OBJECT,
                properties: {
                    type: { type: Type.STRING, enum: ["Course", "Video", "Project"] },
                    title: { type: Type.STRING },
                    description: { type: Type.STRING },
                    url: { type: Type.STRING },
                    creator: { type: Type.STRING }
                },
                required: ["type", "title", "description", "url"]
            }
        }
    },
    required: ["careerOverview", "trendingTechnologies", "skillGaps", "learningResources"]
};


/**
 * For SkillPath: Generates a personalized career and skill roadmap.
 */
export const generateSkillPath = async (interests: string, skills: string): Promise<SkillPathResponse> => {
    const prompt = `Act as an expert advisor. Create a SkillPath for interests "${interests}" and skills "${skills}". Output JSON.`;

    try {
        const result = await ai.models.generateContent({
            model: 'gemini-3-flash-preview',
            contents: prompt,
            config: {
                responseMimeType: "application/json",
                responseSchema: skillPathSchema,
                thinkingConfig: { thinkingBudget: 0 },
            },
        });
        return JSON.parse(result.text.trim());
    } catch (error) {
        console.error("Error generating SkillPath:", error);
        throw new Error(`SkillPath generation failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
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

/**
 * For LearnGuide: Starts a session.
 */
export const startLearnGuideSession = async (knowledgeBase: string): Promise<{ concepts: string[], firstConcept: Concept }> => {
    const truncatedKb = truncateText(knowledgeBase);
    const prompt = `Break down this knowledge base into logical concepts. Provide an ordered list of titles and the full breakdown of the first concept. Output JSON.
    KB: ${truncatedKb}`;
    try {
        const result = await ai.models.generateContent({
            model: 'gemini-3-flash-preview',
            contents: prompt,
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
                thinkingConfig: { thinkingBudget: 0 },
            }
        });
        return JSON.parse(result.text.trim());
    } catch (error) {
        throw new Error("Failed to create learning plan.");
    }
};

/**
 * For LearnGuide: Gets the explanation for a specific concept.
 */
export const getConceptExplanation = async (knowledgeBase: string, conceptTitle: string, learnedConcepts: string[]): Promise<Concept> => {
    const truncatedKb = truncateText(knowledgeBase);
    const prompt = `Explain "${conceptTitle}". User has learned: [${learnedConcepts.join(', ')}]. Use content from KB: ${truncatedKb}. Output JSON.`;
    try {
        const result = await ai.models.generateContent({
            model: 'gemini-3-flash-preview',
            contents: prompt,
            config: { 
                responseMimeType: "application/json", 
                responseSchema: conceptSchema,
                thinkingConfig: { thinkingBudget: 0 },
            }
        });
        return JSON.parse(result.text.trim());
    } catch (error) {
        throw new Error("Failed to explain concept.");
    }
};

/**
 * For LearnGuide: Re-explains a concept.
 */
export const reexplainConcept = async (conceptTitle: string, originalExplanation: string[]): Promise<Concept> => {
    const prompt = `Re-explain "${conceptTitle}" more simply. Previous explanation was: "${originalExplanation.join('. ')}". Output JSON.`;
    try {
        const result = await ai.models.generateContent({
            model: 'gemini-3-flash-preview',
            contents: prompt,
            config: { 
                responseMimeType: "application/json", 
                responseSchema: conceptSchema,
                thinkingConfig: { thinkingBudget: 0 },
            }
        });
        return JSON.parse(result.text.trim());
    } catch (error) {
        throw new Error("Failed to provide simpler explanation.");
    }
};

/**
 * For LearnGuide: Explains code.
 */
export const explainCodeSnippet = async (codeSnippet: string): Promise<string> => {
    const prompt = `Explain this code: \n\`\`\`\n${codeSnippet}\n\`\`\``;
    try {
        const result = await ai.models.generateContent({
            model: 'gemini-3-flash-preview',
            contents: prompt,
            config: { thinkingConfig: { thinkingBudget: 0 } }
        });
        return result.text || "";
    } catch (error) {
        return "Could not explain this snippet.";
    }
};

/**
 * For TestBuddy: Evaluates code.
 */
export const evaluateCodeWithAI = async (
    language: Language,
    sourceCode: string,
    testCases: { stdin: string, expectedOutput?: string }[],
    problem: CodingProblem
): Promise<SubmissionResult[]> => {

    const prompt = `Evaluate this ${language} code for the problem "${problem.title}". Test cases: ${JSON.stringify(testCases)}. Output JSON result array.`;

    try {
        const result = await ai.models.generateContent({
            model: 'gemini-3-pro-preview',
            contents: prompt,
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

        const parsed = JSON.parse(result.text.trim());
        return parsed.results.map((res: SubmissionResult, index: number) => ({
            ...res,
            expectedOutput: testCases[index].expectedOutput
        }));
    } catch (error) {
        console.error("Error evaluating code:", error);
        return testCases.map(() => ({
            status: 'Compilation Error',
            stdout: '',
            stderr: '',
            compile_output: 'Evaluation failed due to AI error.',
            time: '0',
            memory: 0
        } as SubmissionResult));
    }
};

export type LearnGuideContent = 
    | { type: 'structured'; data: { concepts: string[], firstConcept: Concept }; title: string }
    | { type: 'markdown'; data: string; title: string }
    | { type: 'qa'; data: InterviewQuestion[]; title: string };

export const generateLearnGuideContent = async (knowledgeBase: string, goal: LearnGoal): Promise<LearnGuideContent> => {
    const truncatedKb = truncateText(knowledgeBase);

    try {
        switch (goal) {
            case 'Descriptive': {
                const prompt = `Create a descriptive study guide in Markdown for KB: ${truncatedKb}`;
                const result = await ai.models.generateContent({ 
                    model: 'gemini-3-flash-preview', 
                    contents: prompt,
                    config: { thinkingConfig: { thinkingBudget: 0 } }
                });
                return { type: 'markdown', data: result.text || "", title: 'Descriptive Exam Guide' };
            }
            case 'Revision': {
                const prompt = `Create short revision notes in Markdown for KB: ${truncatedKb}`;
                const result = await ai.models.generateContent({ 
                    model: 'gemini-3-flash-preview', 
                    contents: prompt,
                    config: { thinkingConfig: { thinkingBudget: 0 } }
                });
                return { type: 'markdown', data: result.text || "", title: 'Quick Revision Notes' };
            }
            case 'Interview': {
                const prompt = `Generate 10 interview Q&A pairs for KB: ${truncatedKb}. Output JSON.`;
                const result = await ai.models.generateContent({
                    model: 'gemini-3-flash-preview',
                    contents: prompt,
                    config: {
                        responseMimeType: "application/json",
                        responseSchema: {
                            type: Type.OBJECT,
                            properties: {
                                questions: {
                                    type: Type.ARRAY,
                                    items: {
                                        type: Type.OBJECT,
                                        properties: { question: { type: Type.STRING }, answer: { type: Type.STRING } },
                                        required: ['question', 'answer']
                                    }
                                }
                            },
                            required: ['questions']
                        },
                        thinkingConfig: { thinkingBudget: 0 }
                    },
                });
                const parsed = JSON.parse(result.text.trim());
                return { type: 'qa', data: parsed.questions, title: 'Interview Prep Q&A' };
            }
            case 'Learn':
            default: {
                const structuredData = await startLearnGuideSession(knowledgeBase);
                return { type: 'structured', data: structuredData, title: structuredData.firstConcept.title || 'Learning Path' };
            }
        }
    } catch (error) {
        throw new Error("AI content generation failed.");
    }
};

/**
 * For LearnGuide: Generates more interview questions.
 */
export const generateMoreInterviewQuestions = async (knowledgeBase: string, existingQuestions: InterviewQuestion[]): Promise<InterviewQuestion[]> => {
    const truncatedKb = truncateText(knowledgeBase);
    const existingQ = existingQuestions.map(q => q.question).join('\n');
    const prompt = `Generate 10 more unique interview Q&A pairs for KB: ${truncatedKb}. Do not repeat: ${existingQ}. Output JSON.`;

    try {
        const result = await ai.models.generateContent({
            model: 'gemini-3-flash-preview',
            contents: prompt,
            config: {
                responseMimeType: "application/json",
                responseSchema: {
                    type: Type.OBJECT,
                    properties: {
                        questions: {
                            type: Type.ARRAY,
                            items: {
                                type: Type.OBJECT,
                                properties: { question: { type: Type.STRING }, answer: { type: Type.STRING } },
                                required: ['question', 'answer']
                            }
                        }
                    },
                    required: ['questions']
                },
                thinkingConfig: { thinkingBudget: 0 }
            },
        });
        const parsed = JSON.parse(result.text.trim());
        return parsed.questions;
    } catch (error) {
        throw new Error("Failed to generate more questions.");
    }
};

/**
 * For AI Assistant: Generates a personalized response.
 */
export const generatePersonalizedResponse = async (
    prompt: string,
    vaultSummaries: string[],
    performance: PerformanceSummary
): Promise<string> => {
    const vaultContext = vaultSummaries.length > 0 ? vaultSummaries.join('\n') : "No topics yet.";
    const fullPrompt = `You are LearnMate AI. Answer "${prompt}" based on user info: \nTopics: ${vaultContext}\nStats: Quizzes: ${performance.quizzesTaken}, Accuracy: ${performance.quizAccuracy}%`;

    try {
        const result = await ai.models.generateContent({
            model: 'gemini-3-flash-preview',
            contents: fullPrompt,
            config: { thinkingConfig: { thinkingBudget: 0 } }
        });
        return result.text || "";
    } catch (error) {
        throw new Error("Assistant Error.");
    }
};
