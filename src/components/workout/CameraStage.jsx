import s from "./CameraStage.module.css";

export default function CameraStage({ videoRef, canvasRef }) {
  return (
    <div className={s.wrap}>
      <video ref={videoRef} className={s.video} playsInline muted />
      <canvas ref={canvasRef} className={s.canvas} />
    </div>
  );
}
