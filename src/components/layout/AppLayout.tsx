import { Outlet } from 'react-router-dom';
import { Sidebar } from './Sidebar';

export function AppLayout() {
  return (
    <div className="min-h-screen bg-gray-50">
      <Sidebar />
      <main className="lg:ml-64 min-h-screen">
        <div className="max-w-7xl mx-auto px-4 py-6 lg:px-6 lg:py-8">
          <Outlet />
        </div>
      </main>
    </div>
  );
}
