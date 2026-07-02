export function StepIndicator({
  steps,
  current,
}: {
  steps: string[];
  current: number;
}) {
  return (
    <div className="step-indicator">
      {steps.map((label, i) => (
        <div
          key={label}
          className={`step-dot ${i === current ? "active" : ""} ${i < current ? "done" : ""}`}
          title={label}
        />
      ))}
    </div>
  );
}
