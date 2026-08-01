// Registry of exercises the Workout page can offer. Only "pushup" has a
// real tracked experience today; the shape exists so adding another
// exercise later doesn't require touching the Workout page's layout.
export const EXERCISES = [
  {
    id: "pushup",
    name: "Push-ups",
    description: "Camera-tracked reps with an optional countdown challenge",
    route: "/workout/pushup",
    available: true,
  },
];

export function getExercise(id) {
  return EXERCISES.find((e) => e.id === id) ?? null;
}
