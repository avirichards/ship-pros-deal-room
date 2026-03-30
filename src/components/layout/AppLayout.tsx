import { Outlet } from 'react-router-dom';
import { Sidebar } from './Sidebar';
import { ProductTour, TourStep } from '../ui/ProductTour';
import { useAuth } from '../../hooks/useAuth';

const adminTourSteps: TourStep[] = [
  {
    target: '[data-tour="sidebar-logo"]',
    title: 'Welcome to Ship Pros Deal Room! 🚀',
    content: 'This is your shipping deal management platform. Let us show you around so you can get started quickly.',
    placement: 'right',
  },
  {
    target: '[data-tour="nav-dashboard"]',
    title: 'Your Dashboard',
    content: 'This is your home base. View all opportunities, track vendor interest, and monitor submissions at a glance.',
    placement: 'right',
  },
  {
    target: '[data-tour="nav-new-opportunity"]',
    title: 'Create Opportunities',
    content: 'Click here to create a new shipping opportunity. Add details like carriers, volume, deadlines, and attach files for vendors.',
    placement: 'right',
  },
  {
    target: '[data-tour="nav-user-management"]',
    title: 'Manage Users',
    content: 'Invite vendors, manage admins, and organize users by company. You can also resend invites and manage roles.',
    placement: 'right',
  },
  {
    target: '[data-tour="new-opportunity-btn"]',
    title: 'Ready to Create?',
    content: 'Start by creating your first opportunity. Vendors will be notified via email and can submit their proposals right here.',
    placement: 'bottom',
  },
  {
    target: '[data-tour="filter-tabs"]',
    title: 'Filter & Organize',
    content: 'Use these tabs to filter opportunities by status — Open, Quoted, Closed/Won, or Closed/Lost. You can also bulk-select to update or delete multiple at once.',
    placement: 'bottom',
  },
];

const vendorTourSteps: TourStep[] = [
  {
    target: '[data-tour="sidebar-logo"]',
    title: 'Welcome to Ship Pros Deal Room! 🚀',
    content: 'You\'ve been invited to view and respond to shipping opportunities. Let us show you how it works.',
    placement: 'right',
  },
  {
    target: '[data-tour="nav-opportunities"]',
    title: 'Browse Opportunities',
    content: 'All available shipping opportunities are listed here. Browse them to find the ones that match your services.',
    placement: 'right',
  },
];

export function AppLayout() {
  const { profile, user } = useAuth();
  const isAdmin = profile?.role === 'admin';

  const tourSteps = isAdmin ? adminTourSteps : vendorTourSteps;
  const tourKey = `ship-pros-tour-completed-${user?.id || 'guest'}`;

  // If the user has completed the tour on any device permanently, skip rendering it
  const hasCompletedInDatabase = user?.user_metadata?.tour_completed === true;

  return (
    <div className="min-h-screen bg-gray-50">
      <Sidebar />
      <main className="lg:ml-64 min-h-screen">
        <div className="max-w-7xl mx-auto px-4 py-6 lg:px-6 lg:py-8">
          <Outlet />
        </div>
      </main>
      {!hasCompletedInDatabase && (
        <ProductTour
          steps={tourSteps}
          tourKey={tourKey}
        />
      )}
    </div>
  );
}
