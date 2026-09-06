import React from 'react';
import { LogIn, LogOut, ShieldCheck, User as UserIcon } from 'lucide-react';
import { UserProfileData } from '../services/firebaseService';

interface AuthStatusHeaderProps {
  user: UserProfileData | null;
  isAuthenticated: boolean;
  isLoggingIn: boolean;
  onLogin: () => void;
  onLogout: () => void;
}

export const AuthStatusHeader: React.FC<AuthStatusHeaderProps> = () => {
  // Box is invisible; login and account management are handled via speech and text
  return null;
};


