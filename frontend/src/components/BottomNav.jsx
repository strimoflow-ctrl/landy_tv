import React from 'react';
import { Home, Clock, Bookmark, User } from 'lucide-react';

export default function BottomNav({ activeNav, onSelectNav }) {
  const items = [
    { id: 'home', label: 'Home', icon: Home },
    { id: 'recent', label: 'Recent', icon: Clock },
    { id: 'saved', label: 'Saved', icon: Bookmark },
    { id: 'profile', label: 'Profile', icon: User },
  ];

  return (
    <nav className="bottom-nav">
      {items.map((item) => {
        const Icon = item.icon;
        const isActive = activeNav === item.id;
        return (
          <div
            key={item.id}
            className={`nav-item ${isActive ? 'active' : ''}`}
            onClick={() => onSelectNav(item.id)}
          >
            <Icon size={20} />
            <span>{item.label}</span>
          </div>
        );
      })}
    </nav>
  );
}
