import { Suspense } from 'react';
import { Skeleton } from '@/components/ui/skeleton';
import { DockerContent } from '@/components/dashboard/docker-content';

export default function DockerPage() {
  return (
    <Suspense
      fallback={
        <div className="space-y-6">
          <div>
            <div className="h-8 w-32 rounded bg-muted" />
            <div className="mt-2 h-4 w-64 rounded bg-muted" />
          </div>
          <div className="grid grid-cols-3 gap-4">
            {Array.from({ length: 3 }).map((_, i) => (
              <Skeleton key={i} className="h-20 rounded-[10px]" />
            ))}
          </div>
          <div className="space-y-3">
            {Array.from({ length: 4 }).map((_, i) => (
              <Skeleton key={i} className="h-16 w-full rounded-[10px]" />
            ))}
          </div>
        </div>
      }
    >
      <DockerContent />
    </Suspense>
  );
}
