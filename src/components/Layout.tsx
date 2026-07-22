import { NavLink, useLocation } from 'react-router-dom';
import {
  LayoutDashboard,
  Upload,
  Sparkles,
  ClipboardList,
  ShoppingCart,
  Zap,
} from 'lucide-react';

interface NavItem {
  to: string;
  label: string;
  icon: React.ReactNode;
}

const navItems: NavItem[] = [
  { to: '/', label: 'Dashboard', icon: <LayoutDashboard size={18} /> },
  { to: '/upload', label: 'Upload Tender', icon: <Upload size={18} /> },
];

export default function Layout({ children }: { children: React.ReactNode }) {
  const location = useLocation();

  return (
    <div className="flex h-screen overflow-hidden bg-[#090909]">
      {/* Sidebar */}
      <aside className="w-60 flex-shrink-0 flex flex-col border-r border-[#1c1c1c] bg-[#0d0d0d]">
        {/* Logo */}
        <div className="flex items-center gap-2.5 px-5 py-5 border-b border-[#1c1c1c]">
          <div className="w-7 h-7 rounded-md bg-[#f97316] flex items-center justify-center">
            <Zap size={14} className="text-white" fill="white" />
          </div>
          <div>
            <p className="text-[11px] font-semibold tracking-[0.15em] uppercase text-[#f97316]">Smart</p>
            <p className="text-[11px] font-semibold tracking-[0.15em] uppercase text-[#a3a3a3]">Procurement</p>
          </div>
        </div>

        {/* Nav */}
        <nav className="flex-1 px-3 py-4 space-y-0.5 overflow-y-auto">
          <p className="px-2 py-1.5 text-[10px] font-semibold tracking-widest uppercase text-[#525252] mb-2">
            Navigation
          </p>
          {navItems.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.to === '/'}
              className={({ isActive }) =>
                `flex items-center gap-2.5 px-3 py-2 rounded-md text-sm transition-all duration-150 ${
                  isActive
                    ? 'bg-[#f97316]/10 text-[#f97316] font-medium border border-[#f97316]/20'
                    : 'text-[#a3a3a3] hover:text-[#f5f5f5] hover:bg-[#ffffff08]'
                }`
              }
            >
              {item.icon}
              {item.label}
            </NavLink>
          ))}

          <div className="pt-4">
            <p className="px-2 py-1.5 text-[10px] font-semibold tracking-widest uppercase text-[#525252] mb-2">
              Workflow
            </p>
            {[
              { label: 'AI Analysis', icon: <Sparkles size={18} />, path: '/analysis' },
              { label: 'BOQ Editor', icon: <ClipboardList size={18} />, path: '/boq' },
              { label: 'Purchase Order', icon: <ShoppingCart size={18} />, path: '/purchase-order' },
            ].map((item) => {
              const isActive =
                location.pathname.startsWith(item.path);
              return (
                <div
                  key={item.path}
                  className={`flex items-center gap-2.5 px-3 py-2 rounded-md text-sm ${
                    isActive
                      ? 'bg-[#f97316]/10 text-[#f97316] font-medium border border-[#f97316]/20'
                      : 'text-[#525252]'
                  }`}
                >
                  {item.icon}
                  {item.label}
                </div>
              );
            })}
          </div>
        </nav>

        {/* Footer */}
        <div className="px-5 py-4 border-t border-[#1c1c1c]">
          <p className="text-[10px] text-[#525252] leading-relaxed">
            Asthavinayak Technologies
            <br />
            <span className="text-[#3a3a3a]">8V Digital © 2025</span>
          </p>
        </div>
      </aside>

      {/* Main */}
      <main className="flex-1 overflow-y-auto">
        {children}
      </main>
    </div>
  );
}
