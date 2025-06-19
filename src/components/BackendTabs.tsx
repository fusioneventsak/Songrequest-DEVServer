import React, { useState } from 'react';
import { LayoutDashboard, Users, Music as BookMusic, ListMusic, Cog, Settings } from 'lucide-react';

type TabId = 'requests' | 'setlists' | 'songs' | 'settings';

interface BackendTab {
  id: TabId;
  label: string;
  icon: React.ReactNode;
}

interface BackendTabsProps {
  activeTab: TabId;
  onTabChange: (tabId: TabId) => void;
}

export function BackendTabs({ activeTab, onTabChange }: BackendTabsProps) {
  const tabs: BackendTab[] = [
    {
      id: 'requests',
      label: 'Requests',
      icon: <Users className="w-4 h-4 mr-2" />
    },
    {
      id: 'setlists',
      label: 'Set Lists',
      icon: <ListMusic className="w-4 h-4 mr-2" />
    },
    {
      id: 'songs',
      label: 'Songs',
      icon: <BookMusic className="w-4 h-4 mr-2" />
    },
    {
      id: 'settings',
      label: 'Settings',
      icon: <Cog className="w-4 h-4 mr-2" />
    }
  ];

  return (
    <div className="mb-6">
      <div className="glass-effect rounded-lg overflow-hidden">
        {/* Desktop tabs */}
        <div className="hidden md:flex">
          {tabs.map(tab => (
            <button
              key={tab.id}
              onClick={() => onTabChange(tab.id)}
              className={`
                flex items-center px-6 py-3 text-sm font-medium transition-colors
                ${activeTab === tab.id 
                  ? 'bg-neon-purple/20 text-neon-pink'
                  : 'text-gray-300 hover:text-white hover:bg-neon-purple/10'}
                ${activeTab === tab.id ? 'relative' : ''}
              `}
            >
              {tab.icon}
              {tab.label}
              {activeTab === tab.id && (
                <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-neon-pink"></div>
              )}
            </button>
          ))}
        </div>
        
        {/* Mobile tabs */}
        <div className="flex md:hidden">
          {tabs.map(tab => (
            <button
              key={tab.id}
              onClick={() => onTabChange(tab.id)}
              className={`
                flex flex-1 flex-col items-center justify-center py-3 text-xs font-medium transition-colors
                ${activeTab === tab.id 
                  ? 'bg-neon-purple/20 text-neon-pink'
                  : 'text-gray-300 hover:text-white hover:bg-neon-purple/10'}
                ${activeTab === tab.id ? 'relative' : ''}
              `}
            >
              {React.cloneElement(tab.icon as React.ReactElement, { className: "w-4 h-4 mb-1" })}
              {tab.label}
              {activeTab === tab.id && (
                <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-neon-pink"></div>
              )}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}