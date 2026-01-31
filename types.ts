// Fix: Import firebase v8 User type.
// Fix: Use firebase compat imports for v8 syntax. This provides the firebase.User type.
import firebase from 'firebase/compat/app';
import 'firebase/compat/auth';

export type FirebaseUser = firebase.User;

export enum Sender {
  User = 'user',
  AI = 'ai',
}

export interface UploadedFile {
    name: string;
    type: string;
}

export interface Message {
  id: string;
  sender: Sender;
  text: string;
  files?: UploadedFile[];
  isError?: boolean;
  timestamp: string;
}

// NEW: Represents a single, self-contained knowledge base with its own chat history.
export interface LearnVault {
  id: string;
  title: string;
  summary: string;
  content: string;
  createdAt: string; // ISO String
  messages: Message[];
}


// Type for Chat History (local, deprecated)
export interface ChatConversation {
  id: string;
  title: string;
  messages: Message[];
  timestamp: string;
}


// Types for SmartQuiz feature
export interface QuizQuestion {
  questionText: string;
  options: string[];
  correctAnswer: string;
  explanation: string;
}

export interface QuizConfig {
  numQuestions: number;
}

// NEW USER PROFILE & PROGRESS TYPES to align with new schema
export interface UserProfile {
  name: string;
  email: string;
  profilePic: string; // Initials
}

export interface UserData {
  uid: string;
  profile: UserProfile;
  // learnVaultContent is now deprecated and will be managed in a sub-collection.
  createdAt: string; // ISO String
}


// UPDATED RESULT TYPES FOR SUB-COLLECTIONS
export interface QuizResult {
  quizId: string;
  title: string;
  difficulty: 'Easy' | 'Medium' | 'Hard';
  questions: number; // Total questions
  correctAnswers: number;
  wrongAnswers: number;
  score: number; // Percentage
  attemptedAt: string; // ISO string
  timeTaken: string; // e.g., "8m 30s"
}

export interface TestResult {
  testId: string;
  title: string;
  difficulty: CodingProblemDifficulty;
  language: Language;
  codeSubmitted: string;
  status: 'Passed' | 'Failed';
  score: number; // Percentage
  attemptedAt: string; // ISO string
}

export type RecentActivityItem =
  | { type: 'quiz'; data: QuizResult & { id: string } }
  | { type: 'test'; data: TestResult & { id: string } };

// NEW: For AI Assistant context
export interface PerformanceSummary {
    quizzesTaken: number;
    quizAccuracy: number;
    problemsSolved: number;
}


// Types for TestBuddy feature
export type CodingProblemDifficulty = 'Easy' | 'Medium' | 'Hard';
export type Language = 'javascript' | 'python' | 'java' | 'c';

export interface Example {
    input: string;
    output: string;
    explanation?: string;
}

export interface TestCase {
    input: string;
    output: string;
}

export interface CodingProblem {
    id: string;
    title: string;
    difficulty: CodingProblemDifficulty;
    description: string;
    constraints: string[];
    examples: Example[];
    testCases: TestCase[]; // These are hidden from the user
    starterCode: Record<Language, string>;
    solution: Record<Language, string>;
}

export type SubmissionStatus = 'Accepted' | 'Wrong Answer' | 'Runtime Error' | 'Time Limit Exceeded' | 'Compilation Error' | 'Pending' | 'Running';

export interface SubmissionResult {
    status: SubmissionStatus;
    stdout?: string;
    expectedOutput?: string;
    stderr?: string;
    compile_output?: string;
    time?: string; // e.g., "0.05s"
    memory?: number; // in KB
}

export interface TestCaseResult {
    input: string;
    expectedOutput: string;
    userOutput: string;
    status: 'Passed' | 'Failed';
    error?: string;
}

// Types for SkillPath feature
export enum ResourceType {
  Course = 'Course',
  Video = 'Video',
  Project = 'Project',
}

export interface LearningResource {
  type: ResourceType;
  title: string;
  description: string;
  url: string;
  creator?: string; // e.g., "freeCodeCamp.org" or "Coursera"
}

export interface SkillPathResponse {
  careerOverview: string;
  trendingTechnologies: { name: string; description: string }[];
  skillGaps: string[];
  learningResources: LearningResource[];
}

// Types for LearnGuide feature
export type LearnGoal = 'Descriptive' | 'Revision' | 'Learn' | 'Interview';

export interface Concept {
    title: string;
    definition: string;
    explanation:string[];
    examples: string[];
}

export interface InterviewQuestion {
  question: string;
  answer: string;
}