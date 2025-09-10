import React from 'react';

interface SectionHeaderProps {
  icon: React.ElementType;
  title: string;
  description: string;
  iconColor?: string;
}

const SectionHeader: React.FC<SectionHeaderProps> = ({
  icon: Icon,
  title,
  description,
  iconColor = 'from-blue-500 to-indigo-500'
}) => {
  return (
    <div className="flex items-center space-x-3 p-4 bg-gradient-to-r from-slate-50 to-blue-50 rounded-xl border border-slate-200">
      <div className={`w-10 h-10 bg-gradient-to-r ${iconColor} rounded-lg flex items-center justify-center`}>
        <Icon className="w-5 h-5 text-white" />
      </div>
      <div>
        <h3 className="font-semibold text-slate-900">{title}</h3>
        <p className="text-sm text-slate-600">{description}</p>
      </div>
    </div>
  );
};

export default SectionHeader;
