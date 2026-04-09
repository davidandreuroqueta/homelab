import { Suspense } from 'react';
import { Skeleton } from '@/components/ui/skeleton';
import { DashboardContent } from '@/components/dashboard/dashboard-content';

export default function Home() {
  return (
    <div className="space-y-6">
      <Suspense
        fallback={
          <div className="space-y-6">
            <Skeleton className="h-24 w-full rounded-[16px]" />
            <div className="grid gap-4 grid-cols-2 md:grid-cols-4">
              {Array.from({ length: 6 }).map((_, i) => (
                <Skeleton
                  key={i}
                  className={`h-40 rounded-[10px] ${i < 2 ? 'md:col-span-2' : ''}`}
                />
              ))}
            </div>
            <div className="grid gap-4 md:grid-cols-2">
              <Skeleton className="h-48 rounded-[10px]" />
              <Skeleton className="h-48 rounded-[10px]" />
            </div>
          </div>
        }
      >
        <DashboardContent />
      </Suspense>
    </div>
  );
}
