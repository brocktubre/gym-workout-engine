import { HashRouter, Routes, Route, Navigate } from 'react-router-dom';
import { useEffect } from 'react';
import { WORKOUT_EXPIRE_MS } from '@/hooks/useWorkoutEngine';
import { api } from '@/lib/api';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Toaster } from '@/components/ui/toaster';
import { AppLayout } from '@/components/layout/AppLayout';
import { AuthProvider } from '@/contexts/AuthContext';
import { ProtectedRoute } from '@/components/auth/ProtectedRoute';
import Dashboard from '@/pages/Dashboard';
import Generate from '@/pages/Generate';
import ActiveWorkout from '@/pages/ActiveWorkout';
import History from '@/pages/History';
import Settings from '@/pages/Settings';
import Login from '@/pages/auth/Login';
import Register from '@/pages/auth/Register';
import ForgotPassword from '@/pages/auth/ForgotPassword';
import PrivacyPolicy from '@/pages/auth/PrivacyPolicy';
import TermsOfService from '@/pages/auth/TermsOfService';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      refetchOnWindowFocus: false,
      staleTime: 1000 * 60 * 2,
    },
  },
});

function WorkoutExpiryCheck() {
  useEffect(() => {
    const pausedAt = localStorage.getItem('gym_paused_at');
    const workoutRaw = localStorage.getItem('gym_active_workout');
    if (!pausedAt || !workoutRaw) return;

    const age = Date.now() - parseInt(pausedAt, 10);
    if (age > WORKOUT_EXPIRE_MS) {
      try {
        const workout = JSON.parse(workoutRaw);
        if (workout?.id && workout?.date) {
          // Auto-complete the expired workout
          api.completeWorkout(workout.date, workout.id).catch(() => {});
        }
      } catch { /* ignore */ }
      // Clear local state regardless
      localStorage.removeItem('gym_active_workout');
      localStorage.removeItem('gym_timer_start');   // legacy
      localStorage.removeItem('gym_elapsed_offset'); // legacy
      localStorage.removeItem('gym_paused_at');
      localStorage.removeItem('gym_turn_index');
    }
  }, []);
  return null;
}

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <HashRouter>
        <AuthProvider>
          <WorkoutExpiryCheck />
          <Routes>
            {/* Standalone auth routes (no bottom nav) */}
            <Route path="/login" element={<Login />} />
            <Route path="/register" element={<Register />} />
            <Route path="/forgot-password" element={<ForgotPassword />} />

            {/* App shell routes */}
            <Route element={<AppLayout />}>
              <Route index element={<Dashboard />} />
              <Route path="/generate" element={<Generate />} />
              <Route
                path="/active"
                element={
                  <ProtectedRoute>
                    <ActiveWorkout />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/history"
                element={
                  <ProtectedRoute>
                    <History />
                  </ProtectedRoute>
                }
              />
              <Route path="/settings" element={<Settings />} />
              <Route path="/privacy" element={<PrivacyPolicy />} />
              <Route path="/terms" element={<TermsOfService />} />
              {/* Catch-all: redirect to home */}
              <Route path="*" element={<Navigate to="/" replace />} />
            </Route>
          </Routes>
        </AuthProvider>
      </HashRouter>
      <Toaster />
    </QueryClientProvider>
  );
}
