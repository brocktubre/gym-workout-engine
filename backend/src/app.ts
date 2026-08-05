import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import exercisesRouter from './routes/exercises';
import workoutsRouter from './routes/workouts';
import settingsRouter from './routes/settings';
import engineRouter from './routes/engine';
import coachingRouter from './routes/coaching';
import authRouter from './routes/auth';
import { errorHandler } from './middleware/errorHandler';
import { requireAuth, optionalAuth } from './middleware/auth';

const app = express();

app.use(helmet({ contentSecurityPolicy: false }));
app.use(cors({
  origin: [
    process.env.FRONTEND_URL || 'http://localhost:5173',
    'https://gym.oc.taglineconsultants.com',
  ],
  credentials: true,
}));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    stage: process.env.STAGE || 'dev',
  });
});

// Auth: backend-assisted Cognito signup/login (bypasses email verification)
app.use('/api/auth', authRouter);

// Public: exercises, workout generation, coaching notes
app.use('/api/exercises', exercisesRouter);
app.use('/api/engine', optionalAuth, engineRouter);
app.use('/api/coaching', coachingRouter);

// Settings: GET is public (returns defaults for anonymous), PUT requires auth.
// Attach optionalAuth so GET can personalize responses when a token is present.
app.use('/api/settings', optionalAuth, settingsRouter);

// Workouts: history/stats use optionalAuth (returns empty for anon users);
// write operations (PUT/POST/DELETE) enforce auth inside the route handlers.
app.use('/api/workouts', optionalAuth, workoutsRouter);

app.use(errorHandler as express.ErrorRequestHandler);

const PORT = parseInt(process.env.PORT || '3001');
if (require.main === module) {
  app.listen(PORT, () => {
    console.log(`🏋️  Gym Workout Engine API running on http://localhost:${PORT}`);
  });
}

export { app };
