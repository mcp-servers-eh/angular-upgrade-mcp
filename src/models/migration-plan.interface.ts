import { AnalysisResult } from './analysis-result.interface.js';

export interface MigrationPlan {
  sourceProject: {
    path: string;
    angularVersion: string;
    analysis: AnalysisResult;
  };
  targetProject: {
    suggestedVersion: string;
    newProjectPath: string;
  };
  migrationSteps: MigrationStep[];
  estimatedComplexity: 'Low' | 'Medium' | 'High';
  estimatedTime: string;
}

export interface MigrationStep {
  id: string;
  type: 'create' | 'copy' | 'transform' | 'update' | 'configure';
  description: string;
  sourcePath?: string;
  targetPath?: string;
  complexity: 'Low' | 'Medium' | 'High';
  dependencies: string[];
  breakingChanges?: string[];
  modernEquivalent?: string;
}
