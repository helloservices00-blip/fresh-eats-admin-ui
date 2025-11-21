import React, { useState, useEffect, useCallback } from 'react';
import { initializeApp } from 'firebase/app';
import { getAuth, signInAnonymously, signInWithCustomToken, onAuthStateChanged } from 'firebase/auth';
import { getFirestore, doc, addDoc, onSnapshot, collection, query, serverTimestamp, setLogLevel } from 'firebase/firestore';
import { Package, PlusCircle, Loader2, DollarSign, List, XCircle, Users } from 'lucide-react';

// ----------------------
// 1. FIREBASE SETUP
// ----------------------

// Ensure the global variables are defined or use placeholders for development
const appId = typeof __app_id !== 'undefined' ? __app_id : 'fresh-eats-admin-dev';
const firebaseConfig = typeof __firebase_config !== 'undefined' ? JSON.parse(__firebase_config) : {};
const initialAuthToken = typeof __initial_auth_token !== 'undefined' ? __initial_auth_token : null;

// The collection path for public data (products)
const getProductCollectionPath = (appId) => `/artifacts/${appId}/public/data/products`;

setLogLevel('error'); // Set log level to reduce console noise unless debugging

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
  
  // State for the new product form
  const [newProduct, setNewProduct] = useState({
    name: '',
    description: '',
    price: 0,
    category: 'Main Dish',
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const categories = ['Main Dish', 'Appetizer', 'Dessert', 'Drink'];


  // --- Firebase Initialization and Auth ---
  useEffect(() => {
    try {
      if (!Object.keys(firebaseConfig).length) {
        throw new Error("Firebase configuration is missing. Cannot initialize database.");
      }

      app = initializeApp(firebaseConfig);
      db = getFirestore(app);
      auth = getAuth(app);

      // Listen for auth state changes to set userId and mark ready
      const unsubscribeAuth = onAuthStateChanged(auth, async (user) => {
        if (user) {
          setUserId(user.uid);
        } else {
          // Attempt sign-in if not authenticated
          try {
            if (initialAuthToken) {
              await signInWithCustomToken(auth, initialAuthToken);
            } else {
              await signInAnonymously(auth);
            }
          } catch (e) {
            console.error("Firebase Auth Error:", e);
            setError(`Authentication failed: ${e.message}`);
          }
        }
        setIsAuthReady(true);
      });

      return () => unsubscribeAuth();
    } catch (e) {
      console.error("Firebase Init Error:", e);
      setError(`Initialization Error: ${e.message}`);
      setIsAuthReady(true); // Mark ready to show error message
    }
  }, []);

  // --- Firestore Listener ---
  useEffect(() => {
    // Only proceed if Firebase is initialized and Auth is ready
    if (!isAuthReady || !db || !userId) return;

    const productsRef = collection(db, getProductCollectionPath(appId));
    const productsQuery = query(productsRef);

    // Set up real-time listener for products
    const unsubscribeSnapshot = onSnapshot(productsQuery, (snapshot) => {
      try {
        const productList = snapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        }));
        setProducts(productList.sort((a, b) => (b.createdAt?.toMillis() || 0) - (a.createdAt?.toMillis() || 0)));
        setLoading(false);
      } catch (e) {
        console.error("Firestore Snapshot Error:", e);
        setError(`Data fetch failed: ${e.message}`);
        setLoading(false);
      }
    }, (e) => {
      console.error("onSnapshot failed:", e);
      setError(`Real-time data error: ${e.message}`);
      setLoading(false);
    });

    // Cleanup function
    return () => unsubscribeSnapshot();
  }, [isAuthReady, userId]); // Re-run when auth state changes

  // --- Data Handlers ---

  const handleInputChange = (e) => {
    const { name, value, type } = e.target;
    setNewProduct(prev => ({
      ...prev,
      [name]: type === 'number' ? parseFloat(value) || 0 : value
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (isSubmitting || !db || !userId) return;

    if (!newProduct.name || newProduct.price <= 0) {
      setError("Product name is required and price must be greater than 0.");
      return;
    }
    setError(null);
    setIsSubmitting(true);

    try {
      const collectionPath = getProductCollectionPath(appId);
      await addDoc(collection(db, collectionPath), {
        ...newProduct,
        price: parseFloat(newProduct.price.toFixed(2)), // Ensure price is a number with 2 decimal places
        available: true,
        createdAt: serverTimestamp(),
        createdBy: userId,
      });

      // Clear the form and reset state
      setNewProduct({ name: '', description: '', price: 0, category: 'Main Dish' });
    } catch (e) {
      console.error("Error adding document: ", e);
      setError(`Failed to add product: ${e.message}. Check your Firebase rules.`);
    } finally {
      setIsSubmitting(false);
    }
  };

  // --- Render Functions ---

  const renderProductForm = () => (
    <div className="bg-white p-6 rounded-lg shadow-xl border border-gray-100">
      <h2 className="flex items-center text-xl font-bold text-gray-700 mb-4 border-b pb-2">
        <PlusCircle className="w-5 h-5 mr-2 text-indigo-500" />
        Add New Menu Item
      </h2>
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label htmlFor="name" className="block text-sm font-medium text-gray-700">Name</label>
          <input
            type="text"
            id="name"
            name="name"
            value={newProduct.name}
            onChange={handleInputChange}
            placeholder="e.g., Spicy Tuna Roll"
            required
            className="mt-1 block w-full rounded-md border-gray-300 shadow-sm p-2 border focus:ring-indigo-500 focus:border-indigo-500"
          />
        </div>
        <div>
          <label htmlFor="description" className="block text-sm font-medium text-gray-700">Description</label>
          <textarea
            id="description"
            name="description"
            value={newProduct.description}
            onChange={handleInputChange}
            rows="3"
            placeholder="A brief description of the dish."
            className="mt-1 block w-full rounded-md border-gray-300 shadow-sm p-2 border focus:ring-indigo-500 focus:border-indigo-500"
          ></textarea>
        </div>
        <div className="flex space-x-4">
          <div className="flex-1">
            <label htmlFor="price" className="block text-sm font-medium text-gray-700">Price (USD)</label>
            <div className="relative mt-1 rounded-md shadow-sm">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <DollarSign className="h-5 w-5 text-gray-400" />
              </div>
              <input
                type="number"
                id="price"
                name="price"
                value={newProduct.price}
                onChange={handleInputChange}
                step="0.01"
                min="0.01"
                required
                className="block w-full rounded-md pl-10 pr-2 border border-gray-300 p-2 focus:ring-indigo-500 focus:border-indigo-500"
              />
            </div>
          </div>
          <div className="flex-1">
            <label htmlFor="category" className="block text-sm font-medium text-gray-700">Category</label>
            <select
              id="category"
              name="category"
              value={newProduct.category}
              onChange={handleInputChange}
              required
              className="mt-1 block w-full rounded-md border-gray-300 shadow-sm p-2 border focus:ring-indigo-500 focus:border-indigo-500"
            >
              {categories.map(cat => (
                <option key={cat} value={cat}>{cat}</option>
              ))}
            </select>
          </div>
        </div>
        <button
          type="submit"
          disabled={isSubmitting || !isAuthReady || !userId}
          className="w-full flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 transition duration-150 ease-in-out disabled:opacity-50"
        >
          {isSubmitting ? (
            <>
              <Loader2 className="w-5 h-5 mr-2 animate-spin" />
              Saving...
            </>
          ) : (
            <>
              <PlusCircle className="w-5 h-5 mr-2" />
              Add Product
            </>
          )}
        </button>
      </form>
    </div>
  );

  const renderProductList = () => (
    <div className="bg-white p-6 rounded-lg shadow-xl border border-gray-100">
      <h2 className="flex items-center text-xl font-bold text-gray-700 mb-4 border-b pb-2">
        <List className="w-5 h-5 mr-2 text-emerald-500" />
        Current Menu Items ({products.length})
      </h2>
      {loading ? (
        <div className="text-center py-8 text-gray-500">
          <Loader2 className="w-6 h-6 mx-auto mb-2 animate-spin" />
          Loading products...
        </div>
      ) : products.length === 0 ? (
        <div className="text-center py-8 text-gray-500 border-2 border-dashed border-gray-200 rounded-md">
          <Package className="w-8 h-8 mx-auto mb-2" />
          No products added yet. Use the form above to create one!
        </div>
      ) : (
        <ul className="space-y-3">
          {products.map((product) => (
            <li key={product.id} className="p-3 border rounded-md hover:bg-gray-50 transition duration-100 flex justify-between items-center">
              <div>
                <p className="font-semibold text-gray-800">{product.name}</p>
                <p className="text-sm text-gray-500 italic">{product.description || 'No description provided.'}</p>
              </div>
              <div className="text-right">
                <span className="font-bold text-lg text-indigo-600">${product.price.toFixed(2)}</span>
                <span className="block text-xs text-gray-500 bg-gray-200 px-2 py-0.5 rounded-full mt-1">
                  {product.category}
                </span>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );

  const renderHeader = () => (
    <header className="bg-white shadow-md p-4 mb-8 sticky top-0 z-10">
      <div className="max-w-7xl mx-auto flex justify-between items-center">
        <div className="flex items-center space-x-2">
          <Package className="w-8 h-8 text-indigo-600" />
          <h1 className="text-2xl font-extrabold text-gray-800">Fresh Eats Admin Panel</h1>
        </div>
        <div className="text-sm text-gray-600 flex items-center space-x-2">
          <Users className="w-4 h-4 text-gray-500" />
          <span>Admin User:</span>
          <span className="font-mono text-xs bg-gray-100 p-1 rounded">
            {userId || 'Authenticating...'}
          </span>
        </div>
      </div>
    </header>
  );

  // --- Main Render ---

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4 bg-red-50">
        <div className="bg-white p-6 rounded-lg shadow-xl border-l-4 border-red-500">
          <h2 className="flex items-center text-xl font-bold text-red-600 mb-2">
            <XCircle className="w-6 h-6 mr-2" />
            Application Error
          </h2>
          <p className="text-gray-700">{error}</p>
          <p className="text-sm mt-4 text-red-500">
            Please ensure the global variables (`__app_id`, `__firebase_config`, `__initial_auth_token`) are correctly provided.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {renderHeader()}
      <main className="max-w-7xl mx-auto px-4 pb-12">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          <div className="lg:col-span-1">
            {renderProductForm()}
          </div>
          <div className="lg:col-span-2">
            {renderProductList()}
          </div>
        </div>
      </main>
    </div>
  );
};

export default App;
