import { NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';
import {
  LayoutDashboard,
  FilePlus,
  Users,
  LogOut,
  Menu,
  X,
} from 'lucide-react';
import { useState } from 'react';

const adminLinks = [
  { to: '/admin', icon: LayoutDashboard, label: 'Dashboard' },
  { to: '/admin/opportunities/new', icon: FilePlus, label: 'New Opportunity' },
  { to: '/admin/vendors', icon: Users, label: 'User Management' },
];

const vendorLinks = [
  { to: '/vendor', icon: LayoutDashboard, label: 'Opportunities' },
];

export function Sidebar() {
  const { profile, signOut } = useAuth();
  const navigate = useNavigate();
  const [mobileOpen, setMobileOpen] = useState(false);

  const links = profile?.role === 'admin' ? adminLinks : vendorLinks;

  const handleSignOut = async () => {
    await signOut();
    navigate('/login');
  };

  return (
    <>
      {/* Mobile hamburger */}
      <button
        onClick={() => setMobileOpen(true)}
        className="lg:hidden fixed top-4 left-4 z-50 p-2 bg-navy-950 text-white rounded-md"
      >
        <Menu className="w-5 h-5" />
      </button>

      {/* Overlay */}
      {mobileOpen && (
        <div
          className="lg:hidden fixed inset-0 bg-black/50 z-40"
          onClick={() => setMobileOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside
        className={`
          fixed top-0 left-0 h-full w-64 bg-navy-950 text-white z-50
          flex flex-col transition-transform duration-200
          lg:translate-x-0
          ${mobileOpen ? 'translate-x-0' : '-translate-x-full'}
        `}
      >
        {/* Close button (mobile) */}
        <button
          onClick={() => setMobileOpen(false)}
          className="lg:hidden absolute top-4 right-4 text-gray-400 hover:text-white"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Logo */}
        <div className="px-6 py-5 border-b border-navy-700" data-tour="sidebar-logo">
          <img src="/SP_Logo.jpeg" alt="Ship Pros" className="h-8 object-contain object-left" />
          <p className="text-xs text-gray-400 mt-1.5 ml-0.5">Deal Room</p>
        </div>

        {/* Navigation */}
        <nav className="flex-1 px-3 py-4 space-y-1" data-tour="sidebar-nav">
          {links.map(link => (
            <NavLink
              key={link.to}
              to={link.to}
              end={link.to === '/admin' || link.to === '/vendor'}
              onClick={() => setMobileOpen(false)}
              className={({ isActive }) =>
                `flex items-center gap-3 px-3 py-2.5 rounded-md text-sm font-medium transition-colors duration-150 ${
                  isActive
                    ? 'bg-navy-800 text-teal-400'
                    : 'text-gray-300 hover:bg-navy-800 hover:text-white'
                }`
              }
              data-tour={`nav-${link.label.toLowerCase().replace(/\s+/g, '-')}`}
            >
              <link.icon className="w-5 h-5" />
              {link.label}
            </NavLink>
          ))}
        </nav>

        {/* User info + sign out */}
        <div className="px-3 py-4 border-t border-navy-700">
          <button 
            onClick={() => {
              if (profile?.role === 'admin') navigate('/admin/settings');
              setMobileOpen(false);
            }}
            className="w-full text-left px-3 py-2 mb-2 rounded-md hover:bg-navy-800 transition-colors cursor-pointer group"
          >
            <p className="text-sm font-medium text-white truncate group-hover:text-teal-400 transition-colors">{profile?.full_name || profile?.email}</p>
            <p className="text-xs text-gray-400 capitalize group-hover:text-gray-300 transition-colors">{profile?.role}</p>
          </button>
          <button
            onClick={handleSignOut}
            className="flex items-center gap-3 w-full px-3 py-2.5 rounded-md text-sm font-medium text-gray-300 hover:bg-navy-800 hover:text-white transition-colors duration-150"
          >
            <LogOut className="w-5 h-5" />
            Sign Out
          </button>
        </div>
      </aside>
    </>
  );
}
