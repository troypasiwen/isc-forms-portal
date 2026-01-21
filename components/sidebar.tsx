'use client';

import { useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useAuth } from '@/lib/auth-context';
import { Button } from '@/components/ui/button';
import {
  BarChart3,
  FileText,
  CheckCircle,
  Settings,
  LogOut,
  Menu,
  X,
  Bell,
  User,
} from 'lucide-react';

export function Sidebar() {
  const [isOpen, setIsOpen] = useState(false);
  const pathname = usePathname();
  const { logout, userData } = useAuth();

  const isAdmin = userData?.role === 'Admin';
  const isApprover = userData?.isApprover;

  const navItems = [
    {
      label: 'Dashboard',
      href: '/dashboard',
      icon: BarChart3,
    },
    {
      label: 'Forms Portal',
      href: '/forms-portal',
      icon: FileText,
    },
    {
      label: 'My Submissions',
      href: '/submissions',
      icon: FileText,
    },
    ...(isApprover
      ? [
          {
            label: 'To Be Approved',
            href: '/approvals',
            icon: CheckCircle,
          },
        ]
      : []),
    {
      label: 'Approved Forms',
      href: '/approved-forms',
      icon: CheckCircle,
    },
    ...(isAdmin
      ? [
          {
            label: 'Admin Panel',
            href: '/admin',
            icon: Settings,
          },
        ]
      : []),
  ];

  const isActive = (href: string) => pathname === href;

  return (
    <>
      {/* Mobile Toggle */}
      <div className="fixed top-0 left-0 right-0 z-40 flex items-center justify-between bg-primary p-4 text-primary-foreground md:hidden">
        <h1 className="text-xl font-bold">ISC Portal</h1>
        <button
          onClick={() => setIsOpen(!isOpen)}
          className="p-2 hover:bg-primary/80 rounded-lg"
        >
          {isOpen ? <X size={24} /> : <Menu size={24} />}
        </button>
      </div>

      {/* Sidebar */}
      <aside
        className={`fixed top-0 left-0 h-screen w-64 bg-sidebar text-sidebar-foreground border-r border-sidebar-border transition-transform duration-300 z-30 md:translate-x-0 ${
          isOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        <div className="flex flex-col h-full">
          {/* Logo */}
          <div className="p-6 border-b border-sidebar-border hidden md:block">
            <h1 className="text-2xl font-bold text-sidebar-primary">
              Inter-World Shipping Corp.
            </h1>
            <p className="text-xs text-sidebar-foreground/70 mt-1">
              Forms Portal
            </p>
          </div>

          {/* Navigation */}
          <nav className="flex-1 overflow-y-auto p-4 space-y-2 mt-16 md:mt-0">
            {navItems.map((item) => {
              const Icon = item.icon;
              const active = isActive(item.href);

              return (
                <Link key={item.href} href={item.href}>
                  <button
                    onClick={() => setIsOpen(false)}
                    className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg transition-colors ${
                      active
                        ? 'bg-sidebar-primary text-sidebar-primary-foreground'
                        : 'text-sidebar-foreground hover:bg-sidebar-accent'
                    }`}
                  >
                    <Icon size={20} />
                    <span className="font-medium">{item.label}</span>
                  </button>
                </Link>
              );
            })}
          </nav>

          {/* User Section */}
          <div className="p-4 border-t border-sidebar-border space-y-3">
            <div className="p-3 bg-sidebar-accent rounded-lg">
              <p className="text-xs font-semibold text-sidebar-foreground/70">
                CURRENT USER
              </p>
              <p className="text-sm font-bold text-sidebar-primary mt-1 line-clamp-2">
                {userData?.fullName}
              </p>
              <p className="text-xs text-sidebar-foreground/60">
                {userData?.position}
              </p>
            </div>

            <Button
              variant="outline"
              className="w-full justify-center gap-2 bg-transparent"
              onClick={async () => {
                await logout();
                setIsOpen(false);
              }}
            >
              <LogOut size={18} />
              <span>Logout</span>
            </Button>
          </div>
        </div>
      </aside>

      {/* Mobile Overlay */}
      {isOpen && (
        <div
          className="fixed inset-0 bg-black/20 z-20 md:hidden"
          onClick={() => setIsOpen(false)}
        />
      )}
    </>
  );
}
