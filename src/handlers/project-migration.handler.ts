import { existsSync, statSync, readdirSync } from 'fs';
import { join } from 'path';
import { AnalysisResult } from '../models/analysis-result.interface.js';
import { MigrationPlan, MigrationStep } from '../models/migration-plan.interface.js';
import { readPackageJson } from '../utils/package-json.js';
import { readAngularJson } from '../utils/angular-json.js';
import { readTsConfig } from '../utils/ts-config.js';
import { isAngularProject } from '../utils/is-angular-project.js';
import { extractAngularVersion } from '../utils/extract-angular-version.js';
import { extractAngularDependencies } from '../utils/extract-angular-dependancies.js';
import { parseVersion } from '../utils/parse-version.js';
import { getLatestVersion } from '../utils/latest-version.js';
import { identifyAssets, identifyComponents, identifyRoutingFiles, identifyServices } from '../utils/identify-helpers.js';
import { getBreakingChanges, ANGULAR_BREAKING_CHANGES, SERVICE_BREAKING_CHANGES, ROUTING_BREAKING_CHANGES } from '../utils/breaking-changes.js';
import { analyzeProjectStructure } from '../utils/analyze-project-structure.js';

export class ProjectMigrationHandler {

  META_DATA = {
    name: "project_migrate",
    description: "Analyze old Angular project and create comprehensive migration plan to move to new Angular project with latest version. Identifies components, services, assets, configurations, and dependencies that need to be migrated.",
    inputSchema: {
      type: "object",
      properties: {
        targetPath: {
          type: "string",
          description: "Target path where new Angular project should be created"
        },
        targetVersion: {
          type: "string", 
          description: "Target Angular version (optional, defaults to latest)"
        }
      },
      required: []
    }
  };

  async handle(request: any): Promise<{content: Array<{type: string, text: string}>}> {
    const SOURCE_PATH = process.env.PROJECT_PATH || process.cwd();
    const TARGET_PATH = request.targetPath || join(process.cwd(), '..', 'migrated-project');
    const TARGET_VERSION = request.targetVersion || await getLatestVersion('@angular/core');
    
    try {
      const migrationPlan = await this.createMigrationPlan(SOURCE_PATH, TARGET_PATH, TARGET_VERSION);
      return {
        content: [
            // { type: "json", data: migrationPlan },
          {
            type: "text",
            text: this.formatMigrationPlan(migrationPlan),
          },
        ],
      };
    } catch (error) {
      return {
        content: [
          {
            type: "text",
            text: `Error creating migration plan: ${error instanceof Error ? error.message : String(error)}`,
          },
        ],
      };
    }
  }

  private async createMigrationPlan(sourcePath: string, targetPath: string, targetVersion: string): Promise<MigrationPlan> {
    // First analyze the source project
    const sourceAnalysis = await this.analyzeSourceProject(sourcePath);
    
    // Create migration steps
    const migrationSteps = await this.generateMigrationSteps(sourceAnalysis, targetPath, targetVersion);
    
    // Calculate complexity and time estimates
    const complexity = this.calculateComplexity(migrationSteps);
    const estimatedTime = this.estimateTime(migrationSteps);

    return {
      sourceProject: {
        path: sourcePath,
        angularVersion: sourceAnalysis.angularVersion || 'Unknown',
        analysis: sourceAnalysis
      },
      targetProject: {
        suggestedVersion: targetVersion,
        newProjectPath: targetPath
      },
      migrationSteps,
      estimatedComplexity: complexity,
      estimatedTime
    };
  }

  private async analyzeSourceProject(projectPath: string): Promise<AnalysisResult> {
    const result: AnalysisResult = {
      projectPath,
      isAngularProject: false,
      angularDependencies: {},
      outdatedDependencies: [],
      securityIssues: [],
      projectStructure: {
        hasAngularJson: false,
        hasTsConfig: false,
        hasPackageJson: false,
        srcStructure: [],
        architecturalIssues: []
      },
      configurationAnalysis: {},
      recommendations: []
    };

    // Check if it's an Angular project
    result.isAngularProject = isAngularProject(projectPath);
    
    // Analyze package.json
    const packageJson = readPackageJson(projectPath);
    if (packageJson) {
      result.projectStructure.hasPackageJson = true;
      result.configurationAnalysis.packageConfig = packageJson;
      result.angularVersion = extractAngularVersion(packageJson);
      result.angularDependencies = extractAngularDependencies(packageJson);
    }

    // Analyze angular.json
    const angularJson = readAngularJson(projectPath);
    if (angularJson) {
      result.projectStructure.hasAngularJson = true;
      result.configurationAnalysis.angularConfig = angularJson;
    }

    // Analyze tsconfig.json
    const tsConfig = readTsConfig(projectPath);
    if (tsConfig) {
      result.projectStructure.hasTsConfig = true;
      result.configurationAnalysis.tsConfig = tsConfig;
    }

    // Analyze project structure
    result.projectStructure.srcStructure = analyzeProjectStructure(projectPath);
    result.projectStructure.architecturalIssues = this.detectArchitecturalIssues(projectPath, result);

    return result;
  }


  private async generateMigrationSteps(analysis: AnalysisResult, targetPath: string, targetVersion: string): Promise<MigrationStep[]> {
    const steps: MigrationStep[] = [];

    // Step 1: Create new Angular project
    steps.push({
      id: 'create-new-project',
      type: 'create',
      description: `Create new Angular ${targetVersion} project at ${targetPath}`,
      targetPath,
      complexity: 'Low',
      dependencies: []
    });

    // Step 2: Analyze and migrate components
    const components = identifyComponents(analysis.projectStructure.srcStructure);
    if (components.length > 0) {
      steps.push({
        id: 'migrate-components',
        type: 'transform',
        description: `Migrate ${components.length} components to new Angular structure`,
        complexity: await this.calculateComponentComplexity(components, analysis.angularVersion),
        dependencies: ['create-new-project'],
        breakingChanges: this.identifyComponentBreakingChanges(analysis.angularVersion, targetVersion)
      });
    }

    // Step 3: Analyze and migrate services
    const services = identifyServices(analysis.projectStructure.srcStructure);
    if (services.length > 0) {
      steps.push({
        id: 'migrate-services',
        type: 'transform',
        description: `Migrate ${services.length} services to new Angular structure`,
        complexity: await this.calculateServiceComplexity(services, analysis.angularVersion),
        dependencies: ['create-new-project'],
        breakingChanges: this.identifyServiceBreakingChanges(analysis.angularVersion, targetVersion)
      });
    }

    // Step 4: Migrate assets
    const assets = identifyAssets(analysis.projectStructure.srcStructure);
    if (assets.length > 0) {
      steps.push({
        id: 'migrate-assets',
        type: 'copy',
        description: `Migrate ${assets.length} asset files (styles, images, fonts)`,
        complexity: 'Low',
        dependencies: ['create-new-project']
      });
    }

    // Step 5: Migrate routing configuration
    const routingFiles = identifyRoutingFiles(analysis.projectStructure.srcStructure);
    if (routingFiles.length > 0) {
      steps.push({
        id: 'migrate-routing',
        type: 'transform',
        description: `Migrate routing configuration (${routingFiles.length} files)`,
        complexity: 'Medium',
        dependencies: ['migrate-components'],
        breakingChanges: this.identifyRoutingBreakingChanges(analysis.angularVersion, targetVersion)
      });
    }

    // Step 6: Update dependencies
    if (Object.keys(analysis.angularDependencies).length > 0) {
      steps.push({
        id: 'update-dependencies',
        type: 'update',
        description: 'Update Angular dependencies and find modern equivalents for third-party packages',
        complexity: 'Medium',
        dependencies: ['create-new-project'],
        modernEquivalent: 'Angular CDK, Angular Material, or modern alternatives'
      });
    }

    // Step 7: Migrate configuration files
    if (analysis.projectStructure.hasAngularJson || analysis.projectStructure.hasTsConfig) {
      steps.push({
        id: 'migrate-config',
        type: 'configure',
        description: 'Migrate and update configuration files (angular.json, tsconfig.json)',
        complexity: 'Medium',
        dependencies: ['create-new-project']
      });
    }

    // Step 8: Update build and deployment configuration
    steps.push({
      id: 'update-build-config',
      type: 'configure',
      description: 'Update build configuration for modern Angular CLI',
      complexity: 'Low',
      dependencies: ['migrate-config']
    });

    return steps;
  }

  private async calculateComponentComplexity(components: string[], currentVersion?: string): Promise<'Low' | 'Medium' | 'High'> {
    if (!currentVersion) return 'Medium';
    
    const version = parseVersion(currentVersion);
    if (!version) return 'Medium';
    
    try {
      const latestAngularVersion = await getLatestVersion('@angular/core');
      const latestVersion = parseVersion(latestAngularVersion);
      
      if (latestVersion) {
        const versionDiff = latestVersion.major - version.major;
        
        // Higher complexity for older versions relative to latest
        if (versionDiff >= 5) return 'High';
        if (versionDiff >= 3) return 'Medium';
        return 'Low';
      }
    } catch (error) {
      // Fallback: return medium complexity if version fetch fails
      return 'Medium';
    }
    
    return 'Low';
  }

  private async calculateServiceComplexity(services: string[], currentVersion?: string): Promise<'Low' | 'Medium' | 'High'> {
    if (!currentVersion) return 'Medium';
    
    const version = parseVersion(currentVersion);
    if (!version) return 'Medium';
    
    try {
      const latestAngularVersion = await getLatestVersion('@angular/core');
      const latestVersion = parseVersion(latestAngularVersion);
      
      if (latestVersion) {
        const versionDiff = latestVersion.major - version.major;
        
        // Services are generally more stable across versions
        if (versionDiff >= 6) return 'High';
        if (versionDiff >= 4) return 'Medium';
        return 'Low';
      }
    } catch (error) {
      // Fallback: return medium complexity if version fetch fails
      return 'Medium';
    }
    
    return 'Low';
  }

  private identifyComponentBreakingChanges(currentVersion?: string, targetVersion?: string): string[] {
    if (!currentVersion || !targetVersion) return [];
    
    const current = parseVersion(currentVersion);
    const target = parseVersion(targetVersion);
    
    if (!current || !target) return [];
    
    return getBreakingChanges(current.major, target.major, ANGULAR_BREAKING_CHANGES);
  }

  private identifyServiceBreakingChanges(currentVersion?: string, targetVersion?: string): string[] {
    if (!currentVersion || !targetVersion) return [];
    
    const current = parseVersion(currentVersion);
    const target = parseVersion(targetVersion);
    
    if (!current || !target) return [];
    
    return getBreakingChanges(current.major, target.major, SERVICE_BREAKING_CHANGES);
  }

  private identifyRoutingBreakingChanges(currentVersion?: string, targetVersion?: string): string[] {
    if (!currentVersion || !targetVersion) return [];
    
    const current = parseVersion(currentVersion);
    const target = parseVersion(targetVersion);
    
    if (!current || !target) return [];
    
    return getBreakingChanges(current.major, target.major, ROUTING_BREAKING_CHANGES);
  }

  private calculateComplexity(steps: MigrationStep[]): 'Low' | 'Medium' | 'High' {
    const highComplexitySteps = steps.filter(step => step.complexity === 'High').length;
    const mediumComplexitySteps = steps.filter(step => step.complexity === 'Medium').length;
    
    if (highComplexitySteps > 2) return 'High';
    if (highComplexitySteps > 0 || mediumComplexitySteps > 3) return 'Medium';
    return 'Low';
  }

  private estimateTime(steps: MigrationStep[]): string {
    let totalHours = 0;
    
    for (const step of steps) {
      switch (step.complexity) {
        case 'Low':
          totalHours += 0.5;
          break;
        case 'Medium':
          totalHours += 2;
          break;
        case 'High':
          totalHours += 4;
          break;
      }
    }
    
    if (totalHours < 4) return `${totalHours} hours`;
    if (totalHours < 24) return `${Math.ceil(totalHours / 8)} days`;
    return `${Math.ceil(totalHours / 40)} weeks`;
  }

  private detectArchitecturalIssues(projectPath: string, analysis: AnalysisResult): string[] {
    const issues: string[] = [];

    if (analysis.isAngularProject && !analysis.projectStructure.hasAngularJson) {
      issues.push('Missing angular.json configuration file');
    }

    if (analysis.isAngularProject && !analysis.projectStructure.hasTsConfig) {
      issues.push('Missing tsconfig.json configuration file');
    }

    const srcPath = join(projectPath, 'src');
    if (existsSync(srcPath)) {
      const hasAppDir = existsSync(join(srcPath, 'app'));
      const hasAssetsDir = existsSync(join(srcPath, 'assets'));
      const hasEnvironmentsDir = existsSync(join(srcPath, 'environments'));
      
      if (!hasAppDir) issues.push('Missing src/app directory');
      if (!hasAssetsDir) issues.push('Missing src/assets directory');
      if (!hasEnvironmentsDir) issues.push('Missing src/environments directory');
    }

    return issues;
  }

  private formatMigrationPlan(plan: MigrationPlan): string {
    let report = `# Angular Project Migration Plan\n\n`;
    
    report += `## Source Project Analysis\n`;
    report += `**Path:** ${plan.sourceProject.path}\n`;
    report += `**Current Angular Version:** ${plan.sourceProject.angularVersion}\n`;
    report += `**Is Angular Project:** ${plan.sourceProject.analysis.isAngularProject ? 'Yes' : 'No'}\n\n`;
    
    if (plan.sourceProject.analysis.isAngularProject) {
      report += `**Angular Dependencies Found:** ${Object.keys(plan.sourceProject.analysis.angularDependencies).length}\n`;
      report += `**Project Structure Items:** ${plan.sourceProject.analysis.projectStructure.srcStructure.length}\n`;
      report += `**Architectural Issues:** ${plan.sourceProject.analysis.projectStructure.architecturalIssues.length}\n\n`;
    }
    
    report += `## Target Project\n`;
    report += `**Target Path:** ${plan.targetProject.newProjectPath}\n`;
    report += `**Target Angular Version:** ${plan.targetProject.suggestedVersion}\n\n`;
    
    report += `## Migration Overview\n`;
    report += `**Estimated Complexity:** ${plan.estimatedComplexity}\n`;
    report += `**Estimated Time:** ${plan.estimatedTime}\n`;
    report += `**Total Steps:** ${plan.migrationSteps.length}\n\n`;
    
    report += `## Migration Steps\n\n`;
    
    for (let i = 0; i < plan.migrationSteps.length; i++) {
      const step = plan.migrationSteps[i];
      report += `### Step ${i + 1}: ${step.description}\n`;
      report += `**Type:** ${step.type}\n`;
      report += `**Complexity:** ${step.complexity}\n`;
      
      if (step.dependencies.length > 0) {
        report += `**Depends on:** ${step.dependencies.join(', ')}\n`;
      }
      
      if (step.breakingChanges && step.breakingChanges.length > 0) {
        report += `**Breaking Changes to Address:**\n`;
        for (const change of step.breakingChanges) {
          report += `- ${change}\n`;
        }
      }
      
      if (step.modernEquivalent) {
        report += `**Modern Equivalent:** ${step.modernEquivalent}\n`;
      }
      
      report += `\n`;
    }
    
    report += `## Next Steps\n`;
    report += `1. Review this migration plan\n`;
    report += `2. Create the new Angular project\n`;
    report += `3. Execute migration steps in order\n`;
    report += `4. Test the migrated application\n`;
    report += `5. Update documentation and deployment scripts\n\n`;
    
    report += `## Recommendations\n`;
    report += `- Start with a fresh Angular ${plan.targetProject.suggestedVersion} project\n`;
    report += `- Migrate components and services incrementally\n`;
    report += `- Test each migration step thoroughly\n`;
    report += `- Consider using Angular's migration tools where available\n`;
    report += `- Update to modern Angular patterns (standalone components, signals, etc.)\n`;
    
    return report;
  }
}
