import React from 'react';
import { ClerkProvider } from '@clerk/clerk-react';
import { BrowserRouter } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import { AppRouter } from './routes/AppRouter';
import { ErrorBoundary } from './components/common';

const clerkPublishableKey = import.meta.env.VITE_CLERK_PUBLISHABLE_KEY || 'pk_test_placeholder';

function App() {
  return (
    <ClerkProvider publishableKey={clerkPublishableKey}>
      <BrowserRouter>
        <ErrorBoundary>
          <AuthProvider>
            <AppRouter />
          </AuthProvider>
        </ErrorBoundary>
      </BrowserRouter>
    </ClerkProvider>
  );
}

export default App;
