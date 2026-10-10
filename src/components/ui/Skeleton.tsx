type Props = {
  className?: string;
};

export default function Skeleton({ className = "" }: Props) {
  return (
    <div
      aria-hidden="true"
      className={`animate-pulse rounded-lg bg-ink-border/70 ${className}`}
    />
  );
}
