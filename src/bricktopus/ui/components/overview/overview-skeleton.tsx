import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

export function OverviewSkeleton() {
  return (
    <div className="flex flex-col gap-6">
      <div className="space-y-3">
        <Skeleton className="h-3 w-40" />
        <Skeleton className="h-12 w-72" />
        <Skeleton className="h-3 w-56" />
      </div>
      <div className="grid grid-cols-12 gap-4">
        <SkeletonCard className="col-span-12 lg:col-span-8" />
        <SkeletonCard className="col-span-12 lg:col-span-4" />
        <SkeletonCard className="col-span-12 lg:col-span-8" />
        <SkeletonCard className="col-span-12 lg:col-span-4" />
        <SkeletonCard className="col-span-12 md:col-span-6" />
        <SkeletonCard className="col-span-12 md:col-span-6" />
      </div>
    </div>
  );
}

function SkeletonCard({ className = "" }: { className?: string }) {
  return (
    <Card className={className}>
      <CardHeader>
        <Skeleton className="h-3 w-24" />
        <Skeleton className="h-7 w-48" />
      </CardHeader>
      <CardContent>
        <Skeleton className="h-32 w-full" />
      </CardContent>
    </Card>
  );
}
