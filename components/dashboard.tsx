'use client';

import React from 'react';
import { useWallet } from '@/lib/wallet-context';
import { DashboardCard } from './dashboard-card';
import { DashboardCardSkeleton } from './dashboard-card-skeleton';
import { DashboardSkeleton } from './dashboard/dashboard-skeleton';
import { UpcomingCycles } from './dashboard/upcoming-cycles';
import { UnauthenticatedDashboardEmpty, NoActiveGroupsEmpty } from '@/components/ui/empty-states';

interface AjoGroup {
  id: string;
  name: string;
  balance: string | number;
  nextCycle: string;
}

interface DashboardProps {
  activeGroups: AjoGroup[];
  loading?: boolean;
}

export const Dashboard: React.FC<DashboardProps> = ({ activeGroups, loading = false }) => {
  const { isConnected, connectWallet, isLoading } = useWallet();

  if (!isConnected) {
    return <UnauthenticatedDashboardEmpty onConnect={connectWallet} isConnecting={isLoading} />;
  }

  if (loading) {
    return <DashboardSkeleton />;
  }

  return (
    <div className="border-b border-border bg-card">
      <div className="container mx-auto px-4 py-8">
        <header className="mb-6">
          <h1 className="text-3xl font-bold text-foreground tracking-tight">My Ajo Overview</h1>
          <p className="text-muted-foreground mt-1">
            Track your active deposits and pooled savings in real-time.
          </p>
        </header>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Active group cards — takes 2/3 width on large screens */}
          <div className="lg:col-span-2">
            {activeGroups.length > 0 ? (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {activeGroups.map((group: AjoGroup) => (
                  <DashboardCard
                    key={group.id}
                    title={group.name}
                    pooledBalance={group.balance}
                    nextPayout={group.nextCycle}
                  />
                ))}
              </div>
            ) : (
              <NoActiveGroupsEmpty />
            )}
          </div>

          {/* Upcoming cycles sidebar */}
          <div className="lg:col-span-1">
            <UpcomingCycles />
          </div>
        </div>
      </div>
    </div>
  );
};
