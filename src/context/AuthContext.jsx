import React, { createContext, useContext, useEffect, useState, useMemo } from 'react';
import { useUser, useAuth } from '@clerk/clerk-react';
import { createClerkSupabaseClient } from '../lib/supabaseClient';

const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
  const { user, isLoaded: isUserLoaded, isSignedIn } = useUser();
  const { getToken } = useAuth();
  const [profile, setProfile] = useState(null);
  const [realRole, setRealRole] = useState(null);
  const [impersonatedRole, setImpersonatedRole] = useState(null);
  const [loading, setLoading] = useState(true);

  const supabaseClient = useMemo(() => {
    return createClerkSupabaseClient(getToken);
  }, [getToken]);

  const syncOrCreateProfile = async () => {
    if (!isSignedIn || !user) {
      setProfile(null);
      setRealRole(null);
      setImpersonatedRole(null);
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      // 1. Check if profile exists
      const { data, error } = await supabaseClient
        .from('profiles')
        .select('*')
        .eq('id', user.id)
        .maybeSingle();

      if (data) {
        setProfile(data);
        setRealRole(data.role || 'student');
      } else {
        // 2. Fallback create initial profile for newly registered user
        const fullName = user.fullName || 
          user.username || 
          user.primaryEmailAddress?.emailAddress?.split('@')[0] || 
          'Người dùng mới';

        const newProfile = {
          id: user.id,
          full_name: fullName,
          role: 'student',
          avatar_url: user.imageUrl || null,
          phone: user.primaryPhoneNumber?.phoneNumber || null,
          is_active: true,
        };

        const { data: inserted } = await supabaseClient
          .from('profiles')
          .insert(newProfile)
          .select()
          .single();

        if (inserted) {
          setProfile(inserted);
          setRealRole(inserted.role || 'student');
        } else {
          setProfile(newProfile);
          setRealRole('student');
        }
      }
    } catch (err) {
      console.error('Failed to load/sync profile:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isUserLoaded) {
      syncOrCreateProfile();
    }
  }, [user?.id, isSignedIn, isUserLoaded, supabaseClient]);

  // Active role is either the impersonated role (if set by Admin) or real profile role
  const activeRole = impersonatedRole || realRole;

  const value = {
    user,
    isSignedIn,
    isLoaded: isUserLoaded,
    profile,
    role: activeRole,
    realRole,
    isImpersonating: !!impersonatedRole,
    setImpersonatedRole,
    loading,
    supabaseClient,
    refetchProfile: async () => {
      await syncOrCreateProfile();
    }
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAppAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAppAuth must be used within an AuthProvider');
  }
  return context;
};
