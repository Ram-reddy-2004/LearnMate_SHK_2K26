
import React, { useState } from 'react';
// Fix: Import v8-compatible instances and the firebase namespace.
import { auth, db, firebase } from '../services/firebaseConfig';
import { BookOpenIcon, EyeIcon, EyeOffIcon, GoogleIcon, SparklesIcon } from './Icons';

export const AuthPage: React.FC = () => {
    const [isSignUp, setIsSignUp] = useState(false);
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [firstName, setFirstName] = useState('');
    const [lastName, setLastName] = useState('');
    const [error, setError] = useState<string | null>(null);
    const [isLoading, setIsLoading] = useState(false);
    const [successMessage, setSuccessMessage] = useState<string | null>(null);
    const [isPasswordVisible, setIsPasswordVisible] = useState(false);

    const fillDemoCredentials = () => {
        setEmail('admin@gmail.com');
        setPassword('123456');
        setError(null);
    };

    const handleGoogleSignIn = async () => {
        setError(null);
        setSuccessMessage(null);
        setIsLoading(true);

        const provider = new firebase.auth.GoogleAuthProvider();
        try {
            const result = await auth.signInWithPopup(provider);
            const user = result.user;

            if (user) {
                const userDocRef = db.collection('users').doc(user.uid);
                const userDoc = await userDocRef.get();

                if (!userDoc.exists) {
                    const nameParts = user.displayName?.split(' ') || ['User', ''];
                    const newFirstName = nameParts[0];
                    const newLastName = nameParts.length > 1 ? nameParts[nameParts.length - 1] : '';

                    await userDocRef.set({
                        profile: {
                            name: user.displayName || 'New User',
                            email: user.email,
                            profilePic: `${newFirstName[0] || ''}${newLastName[0] || ''}`.toUpperCase(),
                        },
                        learnVaultContent: '',
                        createdAt: firebase.firestore.FieldValue.serverTimestamp(),
                    });
                    setSuccessMessage('✅ Account created with Google! You are now logged in.');
                }
                // Existing user is handled by onAuthStateChanged
            }
        } catch (err: any) {
            if (err.code !== 'auth/popup-closed-by-user') {
                setError(err.message.replace('Firebase: ', ''));
            }
        } finally {
            setIsLoading(false);
        }
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError(null);
        setSuccessMessage(null);
        setIsLoading(true);

        try {
            if (isSignUp) {
                if (!firstName || !lastName) {
                    throw new Error("First and last name are required.");
                }
                // Fix: Use v8 namespaced method for user creation.
                const userCredential = await auth.createUserWithEmailAndPassword(email, password);
                const user = userCredential.user;
                
                // Fix: Use v8 syntax for setting a document and server timestamp.
                await db.collection("users").doc(user!.uid).set({
                    profile: {
                        name: `${firstName} ${lastName}`,
                        email: email,
                        profilePic: `${firstName[0] || ''}${lastName[0] || ''}`.toUpperCase(),
                    },
                    learnVaultContent: '',
                    createdAt: firebase.firestore.FieldValue.serverTimestamp(),
                });

                setSuccessMessage('✅ Account created successfully! You are now logged in.');
                // The onAuthStateChanged listener in AuthContext will handle the redirect.
            } else {
                // Sign in with email and password
                const userCredential = await auth.signInWithEmailAndPassword(email, password);
                const user = userCredential.user;

                // After successful auth, immediately check if the user exists in Firestore
                if (user) {
                    const userDoc = await db.collection('users').doc(user.uid).get();
                    // Fix: Use the .exists property for v8 compat, not the .exists() method.
                    if (!userDoc.exists) {
                        // If user exists in Auth but not in Firestore, it's an invalid state.
                        // Sign them out immediately and show a clear error.
                        await auth.signOut();
                        throw new Error("Invalid credentials.");
                    }
                }
                // If the user document exists, the onAuthStateChanged listener in AuthContext will handle redirect.
            }
        } catch (err: any) {
            // Normalize common auth errors to a single, user-friendly message
            if (['auth/user-not-found', 'auth/wrong-password', 'auth/invalid-credential'].includes(err.code) || err.message === "Invalid credentials.") {
                setError("Invalid credentials.");
            } else {
                setError(err.message.replace('Firebase: ', ''));
            }
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="flex items-center justify-center min-h-screen bg-gray-100 dark:bg-gray-900">
            <div className="w-full max-w-md p-8 space-y-6 bg-white dark:bg-gray-800 rounded-2xl shadow-xl">
                <div className="flex flex-col items-center">
                    <BookOpenIcon className="h-12 w-12 text-blue-500" />
                    <h1 className="text-3xl font-bold text-center text-gray-800 dark:text-white mt-2">
                        Welcome to LearnMate AI
                    </h1>
                    <p className="text-gray-600 dark:text-gray-400 mt-1">{isSignUp ? 'Create an account to get started' : 'Sign in to continue'}</p>
                </div>

                {!isSignUp && (
                    <div className="bg-blue-50 dark:bg-blue-900/30 border border-blue-200 dark:border-blue-800 rounded-xl p-4 flex flex-col items-center text-center animate-fade-in">
                        <div className="flex items-center gap-2 mb-2 text-blue-700 dark:text-blue-300 font-bold">
                            <SparklesIcon className="h-5 w-5" />
                            <span>Demo Credentials</span>
                        </div>
                        <div className="text-sm text-gray-600 dark:text-gray-400 space-y-1">
                            <p>Email: <span className="font-mono font-bold text-blue-600 dark:text-blue-400">admin@gmail.com</span></p>
                            <p>Pass: <span className="font-mono font-bold text-blue-600 dark:text-blue-400">123456</span></p>
                        </div>
                        <button 
                            onClick={fillDemoCredentials}
                            className="mt-3 px-4 py-1.5 bg-blue-500 hover:bg-blue-600 text-white text-xs font-bold rounded-full transition-all shadow-sm flex items-center gap-1"
                        >
                            One-click Fill
                        </button>
                    </div>
                )}

                <div className="space-y-4">
                    <button
                        type="button"
                        onClick={handleGoogleSignIn}
                        disabled={isLoading}
                        className="w-full flex items-center justify-center gap-3 px-4 py-3 font-semibold text-gray-700 dark:text-gray-200 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg shadow-sm hover:bg-gray-50 dark:hover:bg-gray-600 disabled:opacity-50 transition-colors"
                    >
                        <GoogleIcon className="h-5 w-5" />
                        {isSignUp ? 'Sign up with Google' : 'Sign in with Google'}
                    </button>
                </div>

                <div className="flex items-center">
                    <hr className="flex-grow border-gray-300 dark:border-gray-600" />
                    <span className="mx-4 text-sm font-medium text-gray-500 dark:text-gray-400">OR</span>
                    <hr className="flex-grow border-gray-300 dark:border-gray-600" />
                </div>

                <form onSubmit={handleSubmit} className="space-y-4">
                    {isSignUp && (
                        <div className="flex gap-4">
                            <input
                                type="text"
                                placeholder="First Name"
                                value={firstName}
                                onChange={(e) => setFirstName(e.target.value)}
                                required
                                className="w-full px-4 py-2 text-gray-800 bg-gray-50 dark:bg-gray-700 dark:text-gray-200 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                            />
                            <input
                                type="text"
                                placeholder="Last Name"
                                value={lastName}
                                onChange={(e) => setLastName(e.target.value)}
                                required
                                className="w-full px-4 py-2 text-gray-800 bg-gray-50 dark:bg-gray-700 dark:text-gray-200 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                            />
                        </div>
                    )}
                    <input
                        type="email"
                        placeholder="Email"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        required
                        className="w-full px-4 py-2 text-gray-800 bg-gray-50 dark:bg-gray-700 dark:text-gray-200 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                    <div className="relative w-full">
                        <input
                            type={isPasswordVisible ? 'text' : 'password'}
                            placeholder="Password"
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            required
                            minLength={6}
                            className="w-full px-4 py-2 pr-10 text-gray-800 bg-gray-50 dark:bg-gray-700 dark:text-gray-200 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                        />
                        <button
                            type="button"
                            onClick={() => setIsPasswordVisible(!isPasswordVisible)}
                            className="absolute inset-y-0 right-0 flex items-center px-3 text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200"
                            aria-label={isPasswordVisible ? 'Hide password' : 'Show password'}
                        >
                            {isPasswordVisible ? <EyeOffIcon className="h-5 w-5" /> : <EyeIcon className="h-5 w-5" />}
                        </button>
                    </div>
                    
                    {error && <p className="text-red-500 text-sm text-center pt-2">❌ {error}</p>}
                    {successMessage && <p className="text-green-500 text-sm text-center pt-2">{successMessage}</p>}

                    <button type="submit" disabled={isLoading} className="w-full px-4 py-3 font-semibold text-white bg-blue-600 rounded-lg shadow-md hover:bg-blue-700 disabled:bg-blue-400 dark:disabled:bg-blue-800 transition-colors">
                        {isLoading ? 'Processing...' : (isSignUp ? 'Sign Up' : 'Sign In')}
                    </button>
                </form>

                <p className="text-sm text-center text-gray-600 dark:text-gray-400">
                    {isSignUp ? 'Already have an account?' : "Don't have an account?"}
                    <button onClick={() => { setIsSignUp(!isSignUp); setError(null); setSuccessMessage(null); }} className="ml-1 font-medium text-blue-600 hover:underline">
                        {isSignUp ? 'Sign In' : 'Sign Up'}
                    </button>
                </p>
            </div>
        </div>
    );
};
