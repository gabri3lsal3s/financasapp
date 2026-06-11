import React, { createContext, useContext, useEffect, useState } from 'react';
import { Session, User } from '@supabase/supabase-js';
import { supabase } from '@/lib/supabase';
import {
  isPrimaryAdminEmail,
  PRIMARY_ADMIN_PROFILE_PATCH,
} from '@/constants/adminProfile';
import { PROFILE_SELECT_COLUMNS } from '@/constants/profileSelect';
import { clearCacheByKeyPrefix } from '@/services/offlineCache';
import type { Profile } from '@/types';



interface AuthContextType {
  session: Session | null;
  user: User | null;
  profile: Profile | null;
  isLoading: boolean;
  signOut: () => Promise<void>;
  refreshProfile: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({
  session: null,
  user: null,
  profile: null,
  isLoading: true,
  signOut: async () => { },
  refreshProfile: async () => { },
});

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const fetchProfile = async (userId: string) => {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select(PROFILE_SELECT_COLUMNS)
        .eq('id', userId)
        .maybeSingle();

      if (error) throw error;

      if (data && isPrimaryAdminEmail(data.email)) {
        const needsSync =
          data.role !== PRIMARY_ADMIN_PROFILE_PATCH.role ||
          !data.is_admin ||
          !data.is_approved;

        if (needsSync) {
          const syncedProfile: Profile = {
            ...data,
            ...PRIMARY_ADMIN_PROFILE_PATCH,
          };
          setProfile(syncedProfile);
          supabase
            .from('profiles')
            .update(PRIMARY_ADMIN_PROFILE_PATCH)
            .eq('id', userId)
            .then(() => {});
          return syncedProfile;
        }
      }

      setProfile(data);
      return data;
    } catch (err) {
      console.error('Error fetching profile:', err);
      // Ensure we clear the profile on error to avoid stale state
      setProfile(null);
      return null;
    }
  };

  useEffect(() => {
    let mounted = true;

    async function initializeAuth() {
      try {
        // 1. Get initial session
        const { data: { session: initialSession } } = await supabase.auth.getSession();
        if (!mounted) return;

        setSession(initialSession);
        const currentUser = initialSession?.user ?? null;
        setUser(currentUser);

        // 2. If user exists, fetch profile BEFORE stopping loading
        if (currentUser) {
          await fetchProfile(currentUser.id);
        }
      } catch (err) {
        console.error('Error initializing auth:', err);
      } finally {
        if (mounted) setIsLoading(false);
      }
    }

    initializeAuth();

    // Listen for auth changes
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, session) => {
      if (!mounted) return;

      const handleAuthChange = async () => {
        if (event === 'SIGNED_OUT') {
          setSession(null);
          setUser(null);
          setProfile(null);
          setIsLoading(false);
          return;
        }

        setSession(session);
        const currentUser = session?.user ?? null;
        setUser(currentUser);

        if (currentUser) {
          await fetchProfile(currentUser.id);
        } else {
          setProfile(null);
        }

        if (mounted) setIsLoading(false);
      };

      handleAuthChange();
    });


    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, []);




  const signOut = async () => {
    await supabase.auth.signOut();
    localStorage.removeItem('offline-sync-queue');
    localStorage.removeItem('offline-conflict-queue');
    try {
      await clearCacheByKeyPrefix('');
    } catch (e) {
      console.error('Failed to clear offline cache:', e);
    }
  };

  const refreshProfile = async () => {
    if (user) {
      await fetchProfile(user.id);
    }
  };

  const value = {
    session,
    user,
    profile,
    isLoading,
    signOut,
    refreshProfile,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};


export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
