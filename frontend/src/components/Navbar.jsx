import React, { useState, useEffect } from 'react';
import { 
  ShieldAlert, 
  MapPin, 
  Hotel, 
  Compass, 
  Users, 
  AlertTriangle, 
  Sparkles, 
  ChevronDown, 
  UserCheck, 
  LogOut,
  Radio
} from 'lucide-react';
import { authAPI } from '../api';

export default function Navbar({ activeTab, setActiveTab, onTriggerSOS, currentUser, setCurrentUser }) {
  const [demoUsers, setDemoUsers] = useState([]);
  const [showUserDropdown, setShowUserDropdown] = useState(false);

  useEffect(() => {
    authAPI.getDemoUsers()
      .then(res => {
        setDemoUsers(res.data.demo_users || []);
      })
      .catch(err => console.error(err));
  }, []);

  const handleSelectDemoUser = (user) => {
    localStorage.setItem('securetour_token', user.demo_token);
    setCurrentUser(user);
    setShowUserDropdown(false);
  };

  const navItems = [
    { id: 'plan', label: '1. Plan & WOA Cost', icon: Sparkles },
    { id: 'stay', label: '2. Choose a Stay', icon: Hotel },
    { id: 'travel', label: '3. Travel & Route Risk', icon: Compass },
    { id: 'protected', label: '4. Stay Protected & Contract', icon: ShieldAlert },
    { id: 'settle', label: '5. Settle Up (Splitwise)', icon: Users },
  ];

  return (
    <header className="sticky top-0 z-50 bg-[#0F1420]/90 backdrop-blur-md border-b border-slate-800/80 px-4 lg:px-8 py-3.5">
      <div className="max-w-7xl mx-auto flex items-center justify-between gap-4">
        {/* Brand */}
        <div className="flex items-center gap-3">
          <div className="relative flex items-center justify-center w-10 h-10 rounded-xl bg-gradient-to-tr from-emerald-600 to-teal-400 text-white shadow-lg shadow-emerald-500/20">
            <ShieldAlert className="w-5 h-5" />
            <span className="absolute -top-1 -right-1 flex h-3 w-3">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-3 w-3 bg-emerald-500"></span>
            </span>
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-extrabold text-lg tracking-tight bg-gradient-to-r from-white via-slate-200 to-slate-400 bg-clip-text text-transparent">
                SecureTour <span className="text-emerald-400">AI</span>
              </span>
              <span className="text-[10px] font-semibold tracking-wider uppercase px-2 py-0.5 rounded-full bg-emerald-950/80 text-emerald-400 border border-emerald-800/60">
                Live Radar
              </span>
            </div>
            <p className="text-xs text-slate-400 hidden sm:block">
              Trip Safety & Cost Intelligence • Chennai to Ooty
            </p>
          </div>
        </div>

        {/* Navigation Tabs */}
        <nav className="hidden md:flex items-center gap-1 bg-[#131B2E] p-1 rounded-xl border border-slate-800">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = activeTab === item.id;
            return (
              <button
                key={item.id}
                onClick={() => setActiveTab(item.id)}
                className={`flex items-center gap-2 px-3.5 py-2 rounded-lg text-xs font-semibold transition-all ${
                  isActive
                    ? 'bg-emerald-600 text-white shadow-md shadow-emerald-900/40'
                    : 'text-slate-300 hover:text-white hover:bg-slate-800/60'
                }`}
              >
                <Icon className={`w-4 h-4 ${isActive ? 'text-white' : 'text-slate-400'}`} />
                <span>{item.label}</span>
              </button>
            );
          })}
        </nav>

        {/* Actions & Profile */}
        <div className="flex items-center gap-3">
          {/* SOS Button */}
          <button
            onClick={onTriggerSOS}
            className="group flex items-center gap-2 px-3.5 py-2 rounded-xl bg-gradient-to-r from-red-600 to-rose-600 hover:from-red-500 hover:to-rose-500 text-white font-bold text-xs shadow-lg shadow-red-900/40 border border-red-500/40 transition-all transform active:scale-95 animate-pulse"
            title="Dispatch immediate SOS Distress Beacon"
          >
            <AlertTriangle className="w-4 h-4 text-white group-hover:rotate-12 transition-transform" />
            <span className="tracking-wide">SOS BEACON</span>
          </button>

          {/* User selector dropdown */}
          <div className="relative">
            <button
              onClick={() => setShowUserDropdown(!showUserDropdown)}
              className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-slate-800/80 hover:bg-slate-700/80 border border-slate-700 text-xs font-medium text-slate-200 transition-colors"
            >
              <div className="w-6 h-6 rounded-full bg-emerald-500/20 text-emerald-400 flex items-center justify-center font-bold text-[10px]">
                {currentUser?.full_name ? currentUser.full_name.charAt(0) : 'U'}
              </div>
              <span className="hidden sm:inline max-w-[100px] truncate">{currentUser?.full_name || 'Select User'}</span>
              <ChevronDown className="w-3.5 h-3.5 text-slate-400" />
            </button>

            {showUserDropdown && (
              <div className="absolute right-0 mt-2 w-64 bg-[#111827] border border-slate-700 rounded-xl shadow-2xl p-2 z-50">
                <div className="px-3 py-2 border-b border-slate-800">
                  <p className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">Switch Group Member</p>
                  <p className="text-xs text-emerald-400 font-medium">Test collaborative view in real-time</p>
                </div>
                <div className="max-h-56 overflow-y-auto py-1">
                  {demoUsers.map(u => (
                    <button
                      key={u.id}
                      onClick={() => handleSelectDemoUser(u)}
                      className={`w-full flex items-center justify-between px-3 py-2 rounded-lg text-left text-xs transition-colors ${
                        currentUser?.id === u.id ? 'bg-emerald-950/60 text-emerald-300 font-bold' : 'text-slate-300 hover:bg-slate-800'
                      }`}
                    >
                      <div className="flex items-center gap-2">
                        <UserCheck className="w-3.5 h-3.5 text-slate-400" />
                        <div>
                          <p>{u.full_name}</p>
                          <p className="text-[10px] text-slate-400">{u.email}</p>
                        </div>
                      </div>
                      {currentUser?.id === u.id && (
                        <span className="w-2 h-2 rounded-full bg-emerald-400"></span>
                      )}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Mobile Nav Tabs */}
      <div className="flex md:hidden overflow-x-auto gap-1 mt-3 pt-2 border-t border-slate-800/60 pb-1">
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = activeTab === item.id;
          return (
            <button
              key={item.id}
              onClick={() => setActiveTab(item.id)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs whitespace-nowrap font-medium ${
                isActive ? 'bg-emerald-600 text-white' : 'text-slate-400 hover:bg-slate-800'
              }`}
            >
              <Icon className="w-3.5 h-3.5" />
              <span>{item.label}</span>
            </button>
          );
        })}
      </div>
    </header>
  );
}
