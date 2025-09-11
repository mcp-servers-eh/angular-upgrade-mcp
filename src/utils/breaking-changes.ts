export interface BreakingChange {
  version: number;
  changes: string[];
}

export const ANGULAR_BREAKING_CHANGES: BreakingChange[] = [
  {
    version: 12,
    changes: [
      'ViewEncapsulation changes',
      'Ivy renderer updates'
    ]
  },
  {
    version: 15,
    changes: [
      'Standalone components support',
      'New control flow syntax'
    ]
  },
  {
    version: 17,
    changes: [
      'New control flow (@if, @for, @switch)',
      'Signal-based reactivity'
    ]
  }
];

export const SERVICE_BREAKING_CHANGES: BreakingChange[] = [
  {
    version: 14,
    changes: [
      'Injectable decorator requirements'
    ]
  },
  {
    version: 16,
    changes: [
      'Standalone services support'
    ]
  }
];

export const ROUTING_BREAKING_CHANGES: BreakingChange[] = [
  {
    version: 15,
    changes: [
      'New router features and APIs'
    ]
  }
];

export function getBreakingChanges(
  currentVersion: number, 
  targetVersion: number, 
  breakingChangesList: BreakingChange[]
): string[] {
  const changes: string[] = [];
  
  for (const breakingChange of breakingChangesList) {
    if (currentVersion < breakingChange.version && targetVersion >= breakingChange.version) {
      changes.push(...breakingChange.changes);
    }
  }
  
  return changes;
}
