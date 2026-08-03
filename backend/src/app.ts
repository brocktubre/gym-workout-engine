import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import exercisesRouter from './routes/exercises';
import workoutsRouter from './routes/workouts';
import settingsRouter from './routes/settings';
import engineRouter from './routes/engine';
import coachingRouter from './routes/coaching';
import { errorHandler } from './middleware/errorHandler';

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

app.use('/api/exercises', exercisesRouter);
app.use('/api/workouts', workoutsRouter);
app.use('/api/settings', settingsRouter);
app.use('/api/engine', engineRouter);
app.use('/api/coaching', coachingRouter);

app.use(errorHandler as express.ErrorRequestHandler);

const PORT = parseInt(process.env.PORT || '3001');
if (require.main === module) {
  app.listen(PORT, () => {
    console.log(`🏋️  Gym Workout Engine API running on http://localhost:${PORT}`);
  });
}

export { app };
