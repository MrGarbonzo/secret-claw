interface Tab {
  id: string;
  label: string;
}

interface TabBarProps {
  tabs: Tab[];
  active: string;
  onChange: (id: string) => void;
  className?: string;
}

export function TabBar({ tabs, active, onChange, className }: TabBarProps) {
  return (
    <div className={`border-b border-portal-border ${className || ""}`}>
      <div className="-mb-px flex gap-6">
        {tabs.map((tab) => {
          const isActive = tab.id === active;
          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => onChange(tab.id)}
              className={`relative px-1 pb-3 text-sm font-medium transition-colors ${isActive ? "text-portal-text" : "text-portal-muted hover:text-portal-text"}`}
            >
              {tab.label}
              {isActive ? (
                <span className="absolute inset-x-0 bottom-0 h-0.5 bg-portal-accent" />
              ) : null}
            </button>
          );
        })}
      </div>
    </div>
  );
}
