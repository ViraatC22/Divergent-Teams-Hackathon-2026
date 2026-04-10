import React from 'react';
import {
  LayoutDashboard, Activity, BrainCircuit,
  TriangleAlert, LineChart, ClipboardList,
} from 'lucide-react';
import { cn } from '../lib/utils';
import { Separator } from './ui/separator';

const TOP_ITEMS = [
  { icon: LayoutDashboard, label: 'Dashboard', key: 'dashboard' },
  { icon: Activity,        label: 'Sensors',   key: 'sensors'   },
  { icon: BrainCircuit,    label: 'Analysis',  key: 'analysis'  },
  { icon: TriangleAlert,   label: 'Alerts',    key: 'alerts'    },
  { icon: LineChart,       label: 'History',   key: 'history'   },
];

const BOTTOM_ITEMS = [
  { icon: ClipboardList, label: 'Session', key: 'session' },
];

interface Props { active?: string; }

export const Sidebar: React.FC<Props> = ({ active = 'dashboard' }) => (
  <aside className="flex w-14 flex-col items-center border-r border-border bg-card py-4 shrink-0">
    {/* Logo mark */}
    <div className="mb-5 flex h-8 w-8 items-center justify-center rounded-md bg-primary">
      <span className="text-sm font-bold text-primary-foreground">A</span>
    </div>

    <Separator className="mb-3" />

    <nav className="flex flex-1 flex-col items-center gap-1">
      {TOP_ITEMS.map(({ icon: Icon, label, key }) => (
        <button
          key={key}
          title={label}
          className={cn(
            'flex h-9 w-9 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-accent hover:text-foreground',
            active === key && 'bg-accent text-foreground',
          )}
        >
          <Icon size={18} strokeWidth={1.75} />
        </button>
      ))}
    </nav>

    <Separator className="my-3" />

    {BOTTOM_ITEMS.map(({ icon: Icon, label, key }) => (
      <button
        key={key}
        title={label}
        className={cn(
          'flex h-9 w-9 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-accent hover:text-foreground',
          active === key && 'bg-accent text-foreground',
        )}
      >
        <Icon size={18} strokeWidth={1.75} />
      </button>
    ))}
  </aside>
);
