export function StepIndicator({
  steps,
  current,
  completed,
  onStepClick,
}: {
  steps: string[];
  current: number;
  completed?: boolean[];
  onStepClick?: (step: number) => void;
}) {
  return (
    <div className="step-indicator">
      {steps.map((label, i) => {
        const isDone = completed ? completed[i] : i < current;
        const isActive = i === current;
        return (
          <button
            key={label}
            onClick={() => onStepClick?.(i)}
            className={`step-dot ${isActive ? "active" : ""} ${isDone ? "done" : ""}`}
            title={label + (isDone ? " (vyplněno)" : "")}
            style={onStepClick ? { cursor: "pointer" } : undefined}
          />
        );
      })}
    </div>
  );
}
