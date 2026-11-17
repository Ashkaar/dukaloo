import { CircleAlertIcon } from "lucide-react";

export function FormError({ message }: { message: string | null }) {
  if (!message) return null;
  return (
    <p role="alert" className="flex items-start gap-2 rounded-lg bg-red-50 px-3 py-2.5 text-sm text-red-700 dark:bg-red-950/40 dark:text-red-300">
      <CircleAlertIcon className="mt-0.5 size-4 shrink-0" />
      {message}
    </p>
  );
}
