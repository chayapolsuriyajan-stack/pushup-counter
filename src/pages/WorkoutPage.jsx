import { useNavigate } from "react-router-dom";
import { EXERCISES } from "../lib/exercises.js";
import ListRow from "../components/ui/ListRow.jsx";
import s from "./WorkoutPage.module.css";

export default function WorkoutPage() {
  const navigate = useNavigate();
  return (
    <div>
      <h1>Workout</h1>
      <div className={s.list}>
        {EXERCISES.map((exercise) => (
          <button
            key={exercise.id}
            onClick={() => exercise.available && navigate(exercise.route)}
            disabled={!exercise.available}
            style={{ all: "unset", cursor: exercise.available ? "pointer" : "default" }}
          >
            <ListRow
              title={exercise.name}
              subtitle={exercise.description}
              trailing={exercise.available ? "→" : "Soon"}
            />
          </button>
        ))}
      </div>
    </div>
  );
}
