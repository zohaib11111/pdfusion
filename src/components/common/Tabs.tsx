
import React from 'react';

interface Tab {
  id: string;
  label: string;
  icon?: React.ElementType;
}

interface TabsProps {
  tabs: Tab[];
  activeTab: string;
  setActiveTab: (id: string) => void;
}

const Tabs: React.FC<TabsProps> = ({ tabs, activeTab, setActiveTab }) => {
  return (
    <div className="border-b border-slate-200/60 bg-white/50 backdrop-blur-sm rounded-t-2xl">
      <nav className="-mb-px flex space-x-2 sm:space-x-6 px-6" aria-label="Tabs">
        {tabs.map((tab) => {
          const Icon = tab.icon;
          const isActive = tab.id === activeTab;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`whitespace-nowrap flex items-center py-4 px-4 rounded-t-xl font-semibold text-sm transition-all duration-200 transform hover:scale-105
                ${
                  isActive
                    ? 'bg-white text-blue-600 border-b-2 border-blue-600 shadow-sm'
                    : 'text-slate-600 hover:text-slate-800 hover:bg-white/60'
                }
              `}
              aria-current={isActive ? 'page' : undefined}
            >
              {Icon && <Icon className={`mr-3 h-5 w-5 ${isActive ? 'text-blue-600' : 'text-slate-500'}`} />}
              {tab.label}
            </button>
          );
        })}
      </nav>
    </div>
  );
};

export default Tabs;
