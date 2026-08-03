import { Router, Request, Response } from 'express';
import { getAllExercises, getExerciseById, filterExercises, getAllEquipment } from '../services/exerciseService';
import { MuscleGroup, Equipment } from '../types';

const router = Router();

router.get('/', (req: Request, res: Response) => {
  const { muscle, equipment, search } = req.query;
  const exercises = filterExercises({
    muscle: muscle as MuscleGroup | undefined,
    equipment: equipment as Equipment | undefined,
    search: search as string | undefined,
  });
  res.json({ exercises, total: exercises.length });
});

router.get('/:id', (req: Request, res: Response) => {
  const exercise = getExerciseById(req.params.id);
  if (!exercise) {
    res.status(404).json({ error: 'Exercise not found' });
    return;
  }
  res.json({ exercise });
});

// GET /api/exercises/equipment - return full equipment inventory
router.get('/equipment', (_req: Request, res: Response) => {
  const equipment = getAllEquipment();
  res.json({ equipment, total: equipment.length });
});

export default router;
