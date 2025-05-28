"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { toast } from "sonner";
import { Search, Loader2, CalendarRange, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { TestDriveCard } from "@/components/testDriveCard";
import useFetch from "@/hooks/use-fetch";
import { getAdminTestDrives, updateTestDriveStatus } from "@/actions/admin";
import { cancelTestDrive } from "@/actions/testDrive";

export const TestDrivesList = () => {
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [debouncedSearch, setDebouncedSearch] = useState("");

  // Debounce search input
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(search);
    }, 300);

    return () => clearTimeout(timer);
  }, [search]);

  // Custom hooks for API calls
  const {
    loading: fetchingTestDrives,
    fn: fetchTestDrives,
    data: testDrivesData,
    error: testDrivesError,
  } = useFetch(getAdminTestDrives);

  const {
    loading: updatingStatus,
    fn: updateStatusFn,
    data: updateResult,
    error: updateError,
  } = useFetch(updateTestDriveStatus);

  const {
    loading: cancelling,
    fn: cancelTestDriveFn,
    data: cancelResult,
    error: cancelError,
  } = useFetch(cancelTestDrive);

  // Memoized fetch parameters
  const fetchParams = useMemo(() => ({
    search: debouncedSearch,
    status: statusFilter
  }), [debouncedSearch, statusFilter]);

  // Stable fetch function with useCallback
  const stableFetchTestDrives = useCallback(() => {
    fetchTestDrives(fetchParams);
  }, [fetchTestDrives, fetchParams]);

  // Initial fetch and refetch on parameter changes
  useEffect(() => {
    stableFetchTestDrives();
  }, [stableFetchTestDrives]);

  // Error handling with single effect
  useEffect(() => {
    if (testDrivesError) {
      toast.error("Failed to load test drives");
    }
    if (updateError) {
      toast.error("Failed to update test drive status");
    }
    if (cancelError) {
      toast.error("Failed to cancel test drive");
    }
  }, [testDrivesError, updateError, cancelError]);

  // Success handling with single effect
  useEffect(() => {
    if (updateResult?.success || cancelResult?.success) {
      const message = updateResult?.success 
        ? "Test drive status updated successfully"
        : "Test drive cancelled successfully";
      toast.success(message);
      stableFetchTestDrives();
    }
  }, [updateResult?.success, cancelResult?.success, stableFetchTestDrives]);

  // Handle search submit (force immediate search)
  const handleSearchSubmit = useCallback((e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    // Force immediate search by updating debounced search
    setDebouncedSearch(search);
  }, [search]);

  // Handle status update with useCallback
  const handleUpdateStatus = useCallback(async (bookingId: string, newStatus: string) => {
    if (newStatus && !updatingStatus) {
      await updateStatusFn(bookingId, newStatus);
    }
  }, [updateStatusFn, updatingStatus]);

  // Handle booking cancellation with useCallback
  const handleCancel = useCallback(async (bookingId: string) => {
    if (!cancelling) {
      await cancelTestDriveFn(bookingId);
    }
  }, [cancelTestDriveFn, cancelling]);

  // Memoized empty state message
  const emptyStateMessage = useMemo(() => {
    if (statusFilter !== "ALL" || debouncedSearch) {
      return "No test drives match your search criteria";
    }
    return "There are no test drive bookings yet.";
  }, [statusFilter, debouncedSearch]);

  // Memoized test drives list
  const testDrivesList = useMemo(() => {
    if (!testDrivesData?.data) return null;

    return testDrivesData.data.map((booking) => (
      <div key={booking.id} className="relative">
        <TestDriveCard
          booking={booking}
          onCancel={handleCancel}
          showActions={["PENDING", "CONFIRMED"].includes(booking.status)}
          isAdmin={true}
          isCancelling={!!cancelling}
          cancelError={!!cancelError}
          renderStatusSelector={() => (
            <Select
              value={booking.status}
              onValueChange={(value) => handleUpdateStatus(booking.id, value)}
              disabled={!!updatingStatus}
            >
              <SelectTrigger className="w-full h-8">
                <SelectValue placeholder="Update Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="PENDING">Pending</SelectItem>
                <SelectItem value="CONFIRMED">Confirmed</SelectItem>
                <SelectItem value="COMPLETED">Completed</SelectItem>
                <SelectItem value="CANCELLED">Cancelled</SelectItem>
                <SelectItem value="NO_SHOW">No Show</SelectItem>
              </SelectContent>
            </Select>
          )}
        />
      </div>
    ));
  }, [testDrivesData?.data, handleCancel, handleUpdateStatus, cancelling, cancelError, updatingStatus]);

  return (
    <div className="space-y-4">
      {/* Filters and Search */}
      <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
        <div className="flex flex-col sm:flex-row gap-4 w-full">
          {/* Status Filter */}
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger>
              <SelectValue placeholder="All Statuses" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="ALL">All</SelectItem>
              <SelectItem value="PENDING">Pending</SelectItem>
              <SelectItem value="CONFIRMED">Confirmed</SelectItem>
              <SelectItem value="COMPLETED">Completed</SelectItem>
              <SelectItem value="CANCELLED">Cancelled</SelectItem>
              <SelectItem value="NO_SHOW">No Show</SelectItem>
            </SelectContent>
          </Select>

          {/* Search Form */}
          <form onSubmit={handleSearchSubmit} className="flex w-full">
            <div className="relative flex-1">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-gray-500" />
              <Input
                type="search"
                placeholder="Search by car or customer..."
                className="pl-9 w-full"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
            <Button type="submit" className="ml-2">
              Search
            </Button>
          </form>
        </div>
      </div>

      {/* Test Drives List */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <CalendarRange className="h-5 w-5" />
            Test Drive Bookings
          </CardTitle>
          <CardDescription>
            Manage all test drive reservations and update their status
          </CardDescription>
        </CardHeader>

        <CardContent>
          {fetchingTestDrives && !testDrivesData ? (
            <div className="flex justify-center items-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
            </div>
          ) : testDrivesError ? (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertTitle>Error</AlertTitle>
              <AlertDescription>
                Failed to load test drives. Please try again.
              </AlertDescription>
            </Alert>
          ) : testDrivesData?.data?.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 px-4 text-center">
              <CalendarRange className="h-12 w-12 text-gray-300 mb-4" />
              <h3 className="text-lg font-medium text-gray-900 mb-1">
                No test drives found
              </h3>
              <p className="text-gray-500 mb-4">{emptyStateMessage}</p>
            </div>
          ) : (
            <div className="space-y-4">{testDrivesList}</div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};