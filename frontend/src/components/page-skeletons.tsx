"use client";

import { BackgroundShell } from "@/components/background-shell";
import { LoadingRegion, Skeleton } from "@/components/skeleton";

// These mirror the real pages' containers and grids, so content fills in
// where the shapes were instead of the layout jumping when data arrives.

const CARD = "rounded-card border border-line bg-surface p-5 shadow-lg shadow-tint backdrop-blur";

function TaskRowSkeleton({ titleWidth }: { titleWidth: string }) {
  return (
    <div className="flex flex-col gap-4 p-5 sm:flex-row sm:items-start sm:justify-between">
      <div className="min-w-0 flex-1 space-y-3">
        <div className="flex items-center gap-2">
          <Skeleton className={`h-5 ${titleWidth}`} />
          <Skeleton className="h-6 w-20 rounded-chip" />
        </div>
        <Skeleton className="h-3.5 w-40" />
      </div>
      <div className="flex gap-2">
        {[0, 1, 2, 3].map((i) => (
          <Skeleton key={i} className="h-11 w-11" />
        ))}
      </div>
    </div>
  );
}

export function DashboardSkeleton() {
  return (
    <BackgroundShell className="min-h-screen text-fg" showSwitcher>
      <LoadingRegion
        label="Loading your tasks"
        className="relative z-10 mx-auto flex w-full max-w-6xl flex-col gap-8 px-4 py-6 sm:px-8 sm:py-10"
      >
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-4">
            <Skeleton className="h-14 w-14" />
            <div className="space-y-2">
              <Skeleton className="h-4 w-16" />
              <Skeleton className="h-7 w-48" />
            </div>
          </div>
          <div className="flex gap-3">
            <Skeleton className="h-10 w-11" />
            <Skeleton className="h-10 w-28" />
            <Skeleton className="h-10 w-24" />
            <Skeleton className="h-10 w-24" />
          </div>
        </div>

        <Skeleton className="h-14 w-full rounded-card" />

        <div className="grid items-start gap-8 lg:grid-cols-[360px_minmax(0,1fr)]">
          <div className={CARD}>
            <Skeleton className="h-5 w-36" />
            <Skeleton className="mt-2 h-3.5 w-full" />
            <Skeleton className="mt-1.5 h-3.5 w-3/4" />
            <Skeleton className="mt-6 h-3.5 w-12" />
            <Skeleton className="mt-2 h-10 w-full" />
            <Skeleton className="mt-5 h-3.5 w-28" />
            <Skeleton className="mt-2 h-20 w-full" />
            <div className="mt-5 grid grid-cols-3 gap-2">
              <Skeleton className="h-10" />
              <Skeleton className="h-10" />
              <Skeleton className="h-10" />
            </div>
            <Skeleton className="mt-5 h-11 w-full" />
            <Skeleton className="mt-5 h-64 w-full rounded-card" />
          </div>

          <div className="overflow-hidden rounded-control border border-line bg-surface shadow-lg shadow-tint backdrop-blur">
            <div className="border-b border-line px-5 py-4">
              <div className="flex items-start justify-between gap-3">
                <div className="space-y-2">
                  <Skeleton className="h-5 w-44" />
                  <Skeleton className="h-3.5 w-64 max-w-full" />
                </div>
                <Skeleton className="h-9 w-28" />
              </div>
              <Skeleton className="mt-4 h-9 w-48" />
            </div>
            <div className="divide-y divide-line">
              <TaskRowSkeleton titleWidth="w-48" />
              <TaskRowSkeleton titleWidth="w-64" />
              <TaskRowSkeleton titleWidth="w-40" />
              <TaskRowSkeleton titleWidth="w-56" />
            </div>
          </div>
        </div>
      </LoadingRegion>
    </BackgroundShell>
  );
}

export function TimelineEntrySkeleton({ lines }: { lines: string[] }) {
  return (
    <div className="rounded-card border border-line bg-surface p-4">
      <div className="flex items-center justify-between gap-2">
        <div className="flex gap-2">
          <Skeleton className="h-5 w-20 rounded-chip" />
          <Skeleton className="h-5 w-24 rounded-chip" />
        </div>
        <Skeleton className="h-3.5 w-28" />
      </div>
      <div className="mt-4 space-y-2">
        {lines.map((width, i) => (
          <Skeleton key={i} className={`h-4 ${width}`} />
        ))}
      </div>
    </div>
  );
}

export function TaskJournalSkeleton() {
  return (
    <BackgroundShell className="min-h-screen text-fg" showSwitcher>
      <LoadingRegion
        label="Loading this task's journal"
        className="relative z-10 mx-auto flex w-full max-w-5xl flex-col gap-6 px-4 py-6 sm:px-8 sm:py-10"
      >
        <div>
          <Skeleton className="h-4 w-24" />
          <Skeleton className="mt-4 h-9 w-72 max-w-full" />
          <div className="mt-3 flex gap-2">
            <Skeleton className="h-7 w-20 rounded-chip" />
            <Skeleton className="h-7 w-36" />
            <Skeleton className="h-7 w-20" />
          </div>
        </div>

        <div className="grid gap-6 lg:grid-cols-[340px_minmax(0,1fr)]">
          <div className={CARD}>
            <Skeleton className="h-11 w-full" />
            <Skeleton className="mt-5 h-3.5 w-3/4" />
            <Skeleton className="mt-4 h-40 w-full" />
            <Skeleton className="mt-5 h-3.5 w-48" />
            <div className="mt-2 grid grid-cols-3 gap-2">
              <Skeleton className="h-10" />
              <Skeleton className="h-10" />
              <Skeleton className="h-10" />
            </div>
            <Skeleton className="mt-5 h-12 w-full" />
          </div>

          <div className={CARD}>
            <Skeleton className="h-5 w-40" />
            <Skeleton className="mt-2 h-3.5 w-72 max-w-full" />
            <div className="mt-6 space-y-5 border-l border-line-strong pl-6">
              <TimelineEntrySkeleton lines={["w-full", "w-11/12", "w-2/3"]} />
              <TimelineEntrySkeleton lines={["w-3/4", "w-1/2"]} />
            </div>
          </div>
        </div>
      </LoadingRegion>
    </BackgroundShell>
  );
}
