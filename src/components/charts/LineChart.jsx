import s from "./LineChart.module.css";

const WIDTH = 300;
const HEIGHT = 80;
const PAD = 4;

export default function LineChart({ series }) {
  const max = Math.max(1, ...series.map((d) => d.reps));
  const stepX = series.length > 1 ? (WIDTH - PAD * 2) / (series.length - 1) : 0;

  const points = series.map((d, i) => {
    const x = PAD + i * stepX;
    const y = HEIGHT - PAD - (d.reps / max) * (HEIGHT - PAD * 2);
    return { x, y };
  });

  const linePath = points.map((p, i) => `${i === 0 ? "M" : "L"}${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(" ");
  const areaPath = `${linePath} L${points[points.length - 1]?.x ?? PAD},${HEIGHT - PAD} L${points[0]?.x ?? PAD},${HEIGHT - PAD} Z`;

  return (
    <div className={s.wrap}>
      <svg className={s.svg} viewBox={`0 0 ${WIDTH} ${HEIGHT}`} role="img" aria-label="Daily reps, last 30 days">
        <line className={s.baseline} x1={PAD} y1={HEIGHT - PAD} x2={WIDTH - PAD} y2={HEIGHT - PAD} />
        {points.length > 1 && <path className={s.area} d={areaPath} />}
        {points.length > 1 && <path className={s.line} d={linePath} />}
      </svg>
      <div className={s.labels}>
        <span>{series[0]?.date}</span>
        <span>{series[series.length - 1]?.date}</span>
      </div>
    </div>
  );
}
