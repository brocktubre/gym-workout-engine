import exercisesData from '../data/exercises.json';
import equipmentData from '../data/equipment.json';
import { Exercise, MuscleGroup, Equipment } from '../types';

const exercises: Exercise[] = exercisesData as Exercise[];

export function getAllExercises(): Exercise[] {
  return exercises;
}

export function getExerciseById(id: string): Exercise | undefined {
  return exercises.find(e => e.id === id);
}

export function filterExercises(params: {
  muscle?: MuscleGroup;
  equipment?: Equipment;
  search?: string;
}): Exercise[] {
  let filtered = [...exercises];
  if (params.muscle) {
    filtered = filtered.filter(e =>
      e.primaryMuscle === params.muscle || e.secondaryMuscles.includes(params.muscle!)
    );
  }
  if (params.equipment) {
    filtered = filtered.filter(e => e.equipment === params.equipment);
  }
  if (params.search) {
    const q = params.search.toLowerCase();
    filtered = filtered.filter(e => e.name.toLowerCase().includes(q));
  }
  return filtered;
}

export function getExercisesForEquipment(equipment: Equipment[]): Exercise[] {
  return exercises.filter(e => equipment.includes(e.equipment));
}

export interface EquipmentItem {
  id: string;
  name: string;
  category: string;
  enabled: boolean;
  tags: string[];
  exerciseTypes: string[];
  notes?: string;
}

const equipmentList: EquipmentItem[] = equipmentData as EquipmentItem[];

export function getAllEquipment(): EquipmentItem[] {
  return equipmentList;
}

export function getEnabledEquipment(): EquipmentItem[] {
  return equipmentList.filter(e => e.enabled);
}
