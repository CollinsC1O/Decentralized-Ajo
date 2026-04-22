'use client';

import React, { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAccount } from 'wagmi';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { PlusCircle, Search } from 'lucide-react';
import { authenticatedFetch } from '@/lib/auth-client';
import { useWallet } from '@/lib/wallet-context';
import { Dashboard } from '@/components/dashboard';
import { DashboardStats } from '@/components/dashboard/dashboard-stats';
import { DashboardStatsSkeleton } from '@/components/dashboard/stats-skeleton';
import { CircleList } from '@/components/dashboard/circle-list';
import DashboardCard from '@/components/DashboardCard';
import DashboardSkeleton from '@/components/dashboard-skeleton';
import { NoUserAjosEmpty } from '@/components/ui/empty-states';
import {
  Pagination,
  PaginationContent,
  PaginationEllipsis,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from '@/components/ui/pagination';

const PAGE_SIZE = 9;

interface Circle {
  id: string;
  name: string;
  description?: string;
  contributionAmount: number;
  contributionFrequencyDays: number;
  status: string;
  members: { userId: string }[];
  contributions?: { amount: number }[];
}

interface AjoGroup {
  id: string;
  name: string;
  balance: string | number;
  nextCycle: string;
  maxRounds: number;
  currentRound: number;
  status: string;
  createdAt: string;
  members: { userId: string }[];
  contributions: { amount: number }[];
}

interface UserAjo {
  id: string;
  name: string;
  contractAddress: string;
  contributionAmt: string;
  cycleDuration: number;
  maxMembers: number;
  status: string;
  createdAt: Date;
}

export default function DashboardPage() {
  const router = useRouter();
  const { address, isConnected } = useAccount();
  useWallet(); // ensures wallet context is available for child components

  const [circles, setCircles] = useState<Circle[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeGroups, setActiveGroups] = useState<AjoGroup[]>([]);
  const [userAjos, setUserAjos] = useState<UserAjo[]>([]);
  const [ajosLoading, setAjosLoading] = useState(false);

  // Filter and Sort State
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [durationFilter, setDurationFilter] = useState('ALL');
  const [sortBy, setSortBy] = useState('newest');
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);

  const fetchCircles = useCallback(async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams({
        page: currentPage.toString(),
        limit: PAGE_SIZE.toString(),
        status: statusFilter,
        duration: durationFilter,
        sortBy,
        search: searchQuery,
      });

      const response = await authenticatedFetch(`/api/circles?${params.toString()}`);
      if (!response.ok) {
        throw new Error('Failed to fetch circles');
      }

      const data = await response.json();
      setCircles(data.data || []);
      setTotalPages(data.meta?.pages || 1);

      // Filter active circles for dashboard overview
      const activeCircles = data.data?.filter((circle: Circle) => circle.status === 'ACTIVE') || [];
      const activeGroupsData: AjoGroup[] = activeCircles.slice(0, 3).map((circle: Circle) => {
        const totalBalance = circle.contributions?.reduce((sum, contrib) => sum + contrib.amount, 0) || 0;
        const nextCycle = 'Next payout in 5 days';

        return {
          id: circle.id,
          name: circle.name,
          balance: `${totalBalance.toLocaleString()} XLM`,
          nextCycle,
        };
      });
      setActiveGroups(activeGroupsData);
    } catch (error) {
      console.error('Error fetching circles:', error);
    } finally {
      setLoading(false);
    }
  }, [currentPage, statusFilter, durationFilter, sortBy, searchQuery]);

  useEffect(() => {
    if (isConnected) {
      fetchCircles();
    } else {
      setLoading(false);
    }
  }, [fetchCircles, isConnected]);

  // Fetch user's Ajo groups when wallet is connected
  useEffect(() => {
    if (address && isConnected) {
      setAjosLoading(true);
      fetch(`/api/user-ajos?address=${address}`)
        .then(r => r.json())
        .then(data => {
          setUserAjos(data);
          setAjosLoading(false);
        })
        .catch(err => {
          console.error('Error fetching user ajos:', err);
          setAjosLoading(false);
        });
    }
  }, [address, isConnected]);

  // Reset to page 1 when filters change
  useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery, statusFilter]);

  const handleClearFilters = useCallback(() => {
    setSearchQuery('');
    setStatusFilter('ALL');
  }, []);

  return (
    <main className="min-h-screen bg-background">
      {/* Use your new Dashboard component to handle Header + Wallet Check + Overview Cards */}
      <Dashboard activeGroups={activeGroups} loading={loading} />

      {/* User's Ajo Groups Section */}
      {isConnected && (
        <div className="container mx-auto px-4 py-8">
          <div className="flex justify-between items-center mb-6">
            <h2 className="text-3xl font-bold">My Ajos</h2>
            <Button asChild>
              <Link href="/circles/create">
                <PlusCircle className="mr-2 h-4 w-4" />
                Create Ajo
              </Link>
            </Button>
          </div>

          {ajosLoading ? (
            <DashboardSkeleton />
          ) : userAjos.length === 0 ? (
            <NoUserAjosEmpty />
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {userAjos.map(ajo => (
                <DashboardCard key={ajo.id} ajo={ajo} />
              ))}
            </div>
          )}
        </div>
      )}



      <div className="container mx-auto px-4 py-12">
        <div className="space-y-6">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <h2 className="text-2xl font-bold">Explore More Circles</h2>

            <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4" />
                <Input
                  placeholder="Search circles..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10 w-full sm:w-64"
                />
              </div>

              <Tabs value={statusFilter} onValueChange={setStatusFilter}>
                <TabsList>
                  <TabsTrigger value="ALL">All</TabsTrigger>
                  <TabsTrigger value="ACTIVE">Active</TabsTrigger>
                  <TabsTrigger value="COMPLETED">Completed</TabsTrigger>
                </TabsList>
              </Tabs>

              <Button asChild>
                <Link href="/circles/create">
                  <PlusCircle className="mr-2 h-4 w-4" />
                  New Circle
                </Link>
              </Button>
            </div>
          </div>

          <CircleList
            circles={circles}
            loading={loading}
            searchQuery={searchQuery}
            statusFilter={statusFilter}
            onClearFilters={handleClearFilters}
          />

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex justify-center">
              <Pagination>
                <PaginationContent>
                  <PaginationItem>
                    <PaginationPrevious
                      onClick={() => setCurrentPage(Math.max(1, currentPage - 1))}
                      className={currentPage === 1 ? 'pointer-events-none opacity-50' : 'cursor-pointer'}
                    />
                  </PaginationItem>

                  {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                    const p = i + 1;
                    return (
                      <PaginationItem key={p}>
                        <PaginationLink
                          onClick={() => setCurrentPage(p)}
                          isActive={p === currentPage}
                          className="cursor-pointer"
                        >
                          {p}
                        </PaginationLink>
                      </PaginationItem>
                    );
                  })}

                  {totalPages > 5 && (
                    <PaginationItem>
                      <PaginationEllipsis />
                    </PaginationItem>
                  )}

                  <PaginationItem>
                    <PaginationNext
                      onClick={() => setCurrentPage(Math.min(totalPages, currentPage + 1))}
                      className={currentPage === totalPages ? 'pointer-events-none opacity-50' : 'cursor-pointer'}
                    />
                  </PaginationItem>
                </PaginationContent>
              </Pagination>
            </div>
          )}
        </div>
      </div>
    </main>
  );
}
