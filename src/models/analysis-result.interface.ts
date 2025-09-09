export interface AnalysisResult {
  projectPath: string;
  isAngularProject: boolean;
  angularVersion?: string;
  angularDependencies: Record<string, string>;
  outdatedDependencies: Array<{name: string, current: string, latest?: string}>;
  securityIssues: Array<{name: string, issue: string}>;
  projectStructure: {
    hasAngularJson: boolean;
    hasTsConfig: boolean;
    hasPackageJson: boolean;
    srcStructure: string[];
    architecturalIssues: string[];
  };
  configurationAnalysis: {
    angularConfig?: any;
    tsConfig?: any;
    packageConfig?: any;
  };
  recommendations: string[];
}
