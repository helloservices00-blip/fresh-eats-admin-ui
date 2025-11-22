import React, { useState, useEffect } from 'react';
import { initializeApp } from 'firebase/app';
import { getAuth, signInAnonymously, signInWithCustomToken, onAuthStateChanged } from 'firebase/auth';
import { getFirestore, onSnapshot, collection, query, where, orderBy, setLogLevel } from 'firebase/firestore';
import { Utensils, Loader2, DollarSign, Package, AlertTriangle, ArrowRight } from 'lucide-react';

// ----------------------
// 1. FIREBASE SETUP (Identical to Admin UI for consistency)
// ----------------------

const FALLBACK_FIREBASE_CONFIG = {
    apiKey: "MOCK_API_KEY", 
    authDomain: "mock-auth-domain.firebaseapp.com",
    projectId: "mock-project-id",
    storageBucket: "mock-storage-bucket.appspot.com",
    messagingSenderId: "MOCK_SENDER_ID",
    appId: "MOCK_APP_ID"
};

const DEFAULT_APP_ID = 'fresh-eats-admin-dev'; 
const appId = typeof __app_id !== 'undefined' ? __app_id : DEFAULT_APP_ID;
const initialAuthToken = typeof __initial_auth_token !== 'undefined' ? __initial_auth_token : null;

let firebaseConfig;
let isFallback = true; 

try {
    if (typeof __firebase_config !== 'undefined' && __firebase_config) {
        if (typeof __firebase_config === 'string') {
            firebaseConfig = JSON.parse(__firebase_config);
        } else {
            firebaseConfig = __firebase_config;
        }
        if (firebaseConfig && firebaseConfig.projectId) {
            isFallback = false;
        } else {
            firebaseConfig = FALLBACK_FIREBASE_CONFIG;
        }
    } else {
        firebaseConfig = FALLBACK_FIREBASE_CONFIG;
    }
} catch (e) {
    console.error("Error parsing __firebase_config, falling back:", e);
    firebaseConfig = FALLBACK_FIREBASE_CONFIG;
}

const getProductCollectionPath = (appId) => `/artifacts/${appId}/public/data/products`;

setLogLevel('error'); 

let app;
let db;
let auth;

// ----------------------
// 2. MAIN APP COMPONENT
// ----------------------

const App = () => {
    const [products, setProducts] = useState([]);
    const [loading, setLoading] = useState(true);
    const [isAuthReady, setIsAuthReady] = useState(false);
    const [userId, setUserId] = useState(null);
    const [error, setError] = useState(null);

    // --- Firebase Initialization and Auth ---
    useEffect(() => {
        // If we are using the fallback config, simulate readiness
        if (!firebaseConfig || !firebaseConfig.projectId || isFallback) {
            console.warn("Using fallback configuration. Running in Read-Only Mode.");
            setIsAuthReady(true);
            setLoading(false);
            setUserId(`MOCK_USER_${crypto.randomUUID().substring(0, 8)}`); 
            return; 
        }
        
        // Real initialization
        try {
            app = initializeApp(firebaseConfig);
            db = getFirestore(app);
            auth = getAuth(app);

            const unsubscribeAuth = onAuthStateChanged(auth, async (user) => {
                if (user) {
                    setUserId(user.uid);
                } else {
                    try {
                        if (initialAuthToken) {
                            await signInWithCustomToken(auth, initialAuthToken);
                        } else {
                            await signInAnonymously(auth);
                        }
                    } catch (e) {
                        console.error("Firebase Auth Error:", e);
                        setError("Authentication failed.");
                    }
                }
                setIsAuthReady(true);
            });

            return () => unsubscribeAuth();
        } catch (e) {
            console.error("Firebase Init Error:", e);
            setError(`Initialization Error: ${e.message}. Check your configuration.`);
            setIsAuthReady(true); 
        }
    }, []);

    // --- Firestore Listener ---
    useEffect(() => {
        if (!isAuthReady || error) return; 

        // Skip fetching real data if in fallback mode
        if (isFallback) {
            setLoading(false);
            return; 
        }

        if (!db || !userId) return;

        const dataAppId = appId;
        const productsRef = collection(db, getProductCollectionPath(dataAppId));
        
        // Query: Only show products marked 'available: true'
        // Note: orderBy is commented out to avoid requiring an index, sorting will be done locally.
        const productsQuery = query(
            productsRef,
            where('available', '==', true),
            // orderBy('createdAt', 'desc') 
        );

        const unsubscribeSnapshot = onSnapshot(productsQuery, (snapshot) => {
            try {
                const productList = snapshot.docs.map(doc => ({
                    id: doc.id,
                    ...doc.data()
                }));
                // Sort by creation time locally (descending)
                setProducts(productList.sort((a, b) => (b.createdAt?.toMillis() || 0) - (a.createdAt?.toMillis() || 0)));
                setLoading(false);
            } catch (e) {
                console.error("Firestore Snapshot Error:", e);
                setError(`Data fetch failed: ${e.message}.`);
                setLoading(false);
            }
        }, (e) => {
            console.error("onSnapshot failed:", e);
            if (!isFallback) { 
                setError(`Real-time data error: ${e.message}.`);
            }
            setLoading(false);
        });

        return () => unsubscribeSnapshot();
    }, [isAuthReady, userId, error, isFallback]); 

    // --- Utility Functions ---
    const groupProductsByCategory = () => {
        return products.reduce((groups, product) => {
            const category = product.category || 'Uncategorized';
            if (!groups[category]) {
                groups[category] = [];
            }
            groups[category].push(product);
            return groups;
        }, {});
    };

    const groupedProducts = groupProductsByCategory();
    const categories = Object.keys(groupedProducts);

    // --- Render Functions ---

    const renderHeader = () => (
        <header className="bg-white shadow-lg sticky top-0 z-10">
            <div className="max-w-4xl mx-auto py-4 px-4 sm:px-6 lg:px-8 flex items-center justify-center">
                <Utensils className="w-8 h-8 text-red-600 mr-3" />
                <h1 className="text-3xl font-extrabold tracking-tight text-gray-900">
                    Fresh Eats Digital Menu
                </h1>
            </div>
        </header>
    );

    const renderMenu = () => (
        <div className="space-y-12">
            {categories.map(category => (
                <section key={category}>
                    <h2 className="text-3xl font-bold text-red-700 border-b-4 border-red-500 pb-2 mb-6 capitalize">
                        {category}
                    </h2>
                    <div className="space-y-6">
                        {groupedProducts[category].map(product => (
                            <div key={product.id} className="bg-white p-5 rounded-xl shadow-md hover:shadow-lg transition duration-300 transform hover:-translate-y-1">
                                <div className="flex justify-between items-start">
                                    <h3 className="text-xl font-semibold text-gray-800">{product.name}</h3>
                                    <span className="text-xl font-extrabold text-green-600 ml-4 flex-shrink-0">
                                        <DollarSign className="w-5 h-5 inline-block -mt-1" />
                                        {product.price ? product.price.toFixed(2) : '0.00'}
                                    </span>
                                </div>
                                <p className="text-gray-500 mt-2 text-sm italic">
                                    {product.description || 'A delicious item from our kitchen.'}
                                </p>
                            </div>
                        ))}
                    </div>
                </section>
            ))}
        </div>
    );

    // --- Main Render Logic ---

    if (error && !isFallback) {
        return (
            <div className="min-h-screen flex items-center justify-center p-4 bg-red-50">
                <div className="bg-white p-6 rounded-lg shadow-xl border-l-4 border-red-500">
                    <h2 className="flex items-center text-xl font-bold text-red-600 mb-2">
                        <AlertTriangle className="w-6 h-6 mr-2" />
                        Client Application Error
                    </h2>
                    <p className="text-gray-700">{error}</p>
                    <p className="text-sm mt-4 text-red-500">
                        Please ensure the Admin UI is running and Firestore rules allow read access.
                    </p>
                </div>
            </div>
        );
    }
    
    return (
        <div className="min-h-screen bg-gray-50 font-sans">
            {renderHeader()}
            <main className="max-w-4xl mx-auto px-4 py-8 sm:px-6 lg:px-8">
                {loading ? (
                    <div className="text-center py-20 text-gray-500">
                        <Loader2 className="w-8 h-8 mx-auto mb-4 animate-spin text-red-600" />
                        <p className="text-lg font-medium">Loading today's menu...</p>
                    </div>
                ) : products.length === 0 ? (
                    <div className="text-center py-20 text-gray-500 border-2 border-dashed border-gray-300 rounded-lg p-10 bg-white">
                        <Package className="w-10 h-10 mx-auto mb-4 text-red-400" />
                        <p className="text-lg font-semibold mb-2">Menu Not Available</p>
                        <p className="text-sm">
                            No active products found. Please add items using the Admin UI: 
                            <a 
                                href="https://fresh-eats-admin-ui.onrender.com/" 
                                target="_blank" 
                                rel="noopener noreferrer" 
                                className="text-indigo-600 hover:underline flex items-center justify-center mt-2"
                            >
                                Go to Admin UI <ArrowRight className="w-4 h-4 ml-1" />
                            </a>
                        </p>
                        {isFallback && (
                            <p className="text-xs text-red-500 mt-4 p-2 bg-red-100 border border-red-300 rounded-md flex items-center justify-center">
                                <AlertTriangle className="w-4 h-4 mr-1 flex-shrink-0" />
                                **Read-Only Mode:** Display is static outside Canvas.
                            </p>
                        )}
                    </div>
                ) : (
                    renderMenu()
                )}
            </main>
        </div>
    );
};

export default App;
