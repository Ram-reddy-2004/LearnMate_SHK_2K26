// Fix: Import db and firebase instances from the v8-compatible config.
import { db, firebase } from './firebaseConfig';
import { QuizResult, TestResult, LearnVault, Message, PerformanceSummary } from '../types';

/**
 * DEPRECATED: Appends new content to the user's LearnVault in Firestore.
 * This is replaced by creating individual vaults.
 */
export const updateLearnVault = async (uid: string, newContent: string, existingContent: string): Promise<void> => {
    const userDocRef = db.collection('users').doc(uid);
    const updatedContent = `${existingContent}\n\n${newContent}`;
    await userDocRef.update({
        learnVaultContent: updatedContent
    });
};

/**
 * Adds a new LearnVault document to the user's 'vaults' sub-collection.
 * @param uid The user's ID.
 * @param vaultData The core data for the new vault (title, content, summary).
 * @returns The ID of the newly created vault.
 */
export const addLearnVault = async (uid: string, vaultData: { title: string; content: string; summary: string; }): Promise<string> => {
    const newVaultRef = db.collection('users').doc(uid).collection('vaults').doc();
    await newVaultRef.set({
        ...vaultData,
        messages: [], // Initialize with an empty chat history
        createdAt: firebase.firestore.FieldValue.serverTimestamp(),
    });
    return newVaultRef.id;
};


/**
 * Sets up a real-time listener for a user's LearnVaults.
 * Fetches only the metadata (id, title, summary, createdAt) for efficiency.
 * @param uid The user's ID.
 * @param callback The function to call with the updated list of vaults.
 * @returns An unsubscribe function to detach the listener.
 */
export const getLearnVaults = (uid: string, callback: (vaults: Omit<LearnVault, 'content' | 'messages'>[]) => void): (() => void) => {
    return db.collection('users').doc(uid).collection('vaults')
        .orderBy('createdAt', 'desc')
        .onSnapshot(snapshot => {
            const vaults = snapshot.docs.map(doc => {
                const data = doc.data();
                return {
                    id: doc.id,
                    title: data.title,
                    summary: data.summary,
                    createdAt: data.createdAt?.toDate().toISOString() || new Date().toISOString(),
                } as Omit<LearnVault, 'content' | 'messages'>;
            });
            callback(vaults);
        });
};

/**
 * Fetches a single, complete LearnVault document, including its content and messages.
 * @param uid The user's ID.
 * @param vaultId The ID of the vault to fetch.
 * @returns A promise that resolves to the full LearnVault object.
 */
export const getLearnVaultWithMessages = async (uid: string, vaultId: string): Promise<LearnVault> => {
    const docRef = db.collection('users').doc(uid).collection('vaults').doc(vaultId);
    const doc = await docRef.get();
    if (!doc.exists) {
        throw new Error("LearnVault not found.");
    }
    const data = doc.data() as any;
    return {
        id: doc.id,
        title: data.title,
        summary: data.summary,
        content: data.content,
        messages: data.messages || [],
        createdAt: data.createdAt?.toDate().toISOString() || new Date().toISOString(),
    };
};

/**
 * Saves or updates the chat messages for a specific LearnVault.
 * @param uid The user's ID.
 * @param vaultId The ID of the vault to update.
 * @param messages The complete array of messages to save.
 */
export const saveChatMessages = async (uid: string, vaultId: string, messages: Message[]): Promise<void> => {
    const vaultRef = db.collection('users').doc(uid).collection('vaults').doc(vaultId);
    await vaultRef.update({ messages });
};


/**
 * Saves a new quiz result to the `quizResults` sub-collection.
 */
export const saveQuizResult = async (uid: string, result: Omit<QuizResult, 'quizId' | 'attemptedAt'>): Promise<void> => {
    const newQuizResult = {
        ...result,
        attemptedAt: firebase.firestore.FieldValue.serverTimestamp(),
    };
    await db.collection('users').doc(uid).collection('quizResults').add(newQuizResult);
};

/**
 * Saves a new coding test result to the `codingResults` sub-collection.
 */
export const saveCodingResult = async (uid: string, result: Omit<TestResult, 'attemptedAt'>): Promise<void> => {
    const newCodingResult = {
        ...result,
        attemptedAt: firebase.firestore.FieldValue.serverTimestamp()
    };
    await db.collection('users').doc(uid).collection('codingResults').add(newCodingResult);
};

/**
 * Fetches and calculates a summary of the user's performance for the AI Assistant.
 */
export const getUserPerformanceSummary = async (uid: string): Promise<PerformanceSummary> => {
    const quizResultsRef = db.collection('users').doc(uid).collection('quizResults');
    const codingResultsRef = db.collection('users').doc(uid).collection('codingResults');

    const [quizSnapshot, codingSnapshot] = await Promise.all([
        quizResultsRef.get(),
        codingResultsRef.get()
    ]);

    const quizzes = quizSnapshot.docs.map(doc => doc.data() as QuizResult);
    const codingTests = codingSnapshot.docs.map(doc => doc.data() as TestResult);

    const quizzesTaken = quizzes.length;
    const totalQuizScore = quizzes.reduce((sum, quiz) => sum + quiz.score, 0);
    const quizAccuracy = quizzesTaken > 0 ? Math.round(totalQuizScore / quizzesTaken) : 0;
    
    const passedTests = codingTests.filter(test => test.status === 'Passed');
    const problemsSolved = new Set(passedTests.map(test => test.testId)).size;

    return { quizzesTaken, quizAccuracy, problemsSolved };
};