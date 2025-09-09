import { readFileSync, existsSync, statSync, readdirSync } from 'fs';
import { join } from 'path';
import { AnalysisResult } from '../models/analysis-result.interface.js';
import { PackageJson } from '../models/package-json.interface.js';
import { AngularJson } from '../models/angular-json.interface.js';
import { TsConfig } from '../models/ts-config.interface.js';
import { execSync } from "child_process";

export class ProjectAnalysisHandler {

  META_DATA = {
    name: "project_analysis",
    description: "Comprehensive Angular project analysis - complete project scanning (package.json, angular.json, tsconfig.json, etc.), current Angular version and all related libraries identification, detection of old or insecure dependencies, and project structure evaluation with common architectural issues assessment",
    inputSchema: {
      type: "object",
      properties: {},
      required: []
    }
  };

  async handle(request: any): Promise<{content: Array<{type: string, text: string}>}> {
    const PROJECT_PATH = process.env.PROJECT_PATH || process.cwd();
    
    try {
      const analysis = await this.analyzeProject(PROJECT_PATH);
      return {
        content: [
          {
            type: "text",
            text: this.formatAnalysisReport(analysis),
          },
        ],
      };
    } catch (error) {
    return {
      content: [
        {
          type: "text",
            text: `Error analyzing project: ${error instanceof Error ? error.message : String(error)}`,
          },
        ],
      };
    }
  }

  private async analyzeProject(projectPath: string): Promise<AnalysisResult> {
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
    result.isAngularProject = this.isAngularProject(projectPath);
    
    // Analyze package.json
    const packageJson = this.readPackageJson(projectPath);
    if (packageJson) {
      result.projectStructure.hasPackageJson = true;
      result.configurationAnalysis.packageConfig = packageJson;
      
      // Find Angular version and dependencies
      result.angularVersion = this.extractAngularVersion(packageJson);
      result.angularDependencies = this.extractAngularDependencies(packageJson);
      
      // Check for outdated dependencies
      result.outdatedDependencies = this.checkOutdatedDependencies(packageJson);
      
      // Check for security issues
      result.securityIssues = this.checkSecurityIssues(projectPath);
    }

    // Analyze angular.json
    const angularJson = this.readAngularJson(projectPath);
    if (angularJson) {
      result.projectStructure.hasAngularJson = true;
      result.configurationAnalysis.angularConfig = angularJson;
    }

    // Analyze tsconfig.json
    const tsConfig = this.readTsConfig(projectPath);
    if (tsConfig) {
      result.projectStructure.hasTsConfig = true;
      result.configurationAnalysis.tsConfig = tsConfig;
    }

    // Analyze project structure
    result.projectStructure.srcStructure = this.analyzeProjectStructure(projectPath);
    result.projectStructure.architecturalIssues = this.detectArchitecturalIssues(projectPath, result);

    // Generate recommendations
    result.recommendations = this.generateRecommendations(result);

    return result;
  }

  private isAngularProject(projectPath: string): boolean {
    const packageJsonPath = join(projectPath, 'package.json');
    if (!existsSync(packageJsonPath)) return false;
    
    try {
      const packageJson = JSON.parse(readFileSync(packageJsonPath, 'utf8')) as PackageJson;
      return !!(packageJson.dependencies?.['@angular/core'] || packageJson.devDependencies?.['@angular/core']);
    } catch {
      return false;
    }
  }

  private readPackageJson(projectPath: string): PackageJson | null {
    const packageJsonPath = join(projectPath, 'package.json');
    if (!existsSync(packageJsonPath)) return null;
    
    try {
      return JSON.parse(readFileSync(packageJsonPath, 'utf8')) as PackageJson;
    } catch {
      return null;
    }
  }

  private readAngularJson(projectPath: string): AngularJson | null {
    const angularJsonPath = join(projectPath, 'angular.json');
    if (!existsSync(angularJsonPath)) return null;
    
    try {
      return JSON.parse(readFileSync(angularJsonPath, 'utf8')) as AngularJson;
    } catch {
      return null;
    }
  }

  private readTsConfig(projectPath: string): TsConfig | null {
    const tsConfigPath = join(projectPath, 'tsconfig.json');
    if (!existsSync(tsConfigPath)) return null;
    
    try {
      return JSON.parse(readFileSync(tsConfigPath, 'utf8')) as TsConfig;
    } catch {
      return null;
    }
  }

  private extractAngularVersion(packageJson: PackageJson): string | undefined {
    const allDeps = {
      ...packageJson.dependencies,
      ...packageJson.devDependencies,
      ...packageJson.peerDependencies
    };
    
    return allDeps['@angular/core'] || allDeps['@angular/cli'];
  }

  private extractAngularDependencies(packageJson: PackageJson): Record<string, string> {
    const allDeps = {
      ...packageJson.dependencies,
      ...packageJson.devDependencies,
      ...packageJson.peerDependencies
    };
    
    const angularDeps: Record<string, string> = {};
    for (const [name, version] of Object.entries(allDeps)) {
      if (name.startsWith('@angular/')) {
        angularDeps[name] = version;
      }
    }
    
    return angularDeps;
  }

  private checkOutdatedDependencies(packageJson: PackageJson): Array<{name: string, current: string, latest?: string}> {
    const outdated: Array<{name: string, current: string, latest?: string}> = [];
    const allDeps = {
      ...packageJson.dependencies,
      ...packageJson.devDependencies
    };
  
    for (const [name, version] of Object.entries(allDeps)) {
      try {
        // Get latest version from npm registry
        const latest = execSync(`npm view ${name} version`, { stdio: ["pipe", "pipe", "ignore"] })
          .toString()
          .trim();
  
        if (latest && latest !== version.replace(/^[^\d]*/, "")) {
          outdated.push({ name, current: version, latest });
        }
      } catch (error) {
        outdated.push({ name, current: version, latest: "⚠️ failed to fetch" });
      }
    }
  
    return outdated;
  }

  private checkSecurityIssues(projectPath: string): Array<{name: string, issue: string}> {
    const issues: Array<{name: string, issue: string}> = [];
    try {
      const auditRaw = execSync("npm audit --json", { cwd: projectPath, stdio: ["pipe", "pipe", "ignore"] }).toString();
      const audit = JSON.parse(auditRaw);
  
      if (audit.vulnerabilities) {
        for (const [pkg, vuln] of Object.entries<any>(audit.vulnerabilities)) {
          issues.push({
            name: pkg,
            issue: `Severity: ${vuln.severity}, via: ${vuln.via.map((v: any) => v.source || v.name).join(", ")}`
          });
        }
      }
    } catch (err) {
      issues.push({ name: "audit", issue: "Failed to run npm audit" });
    }
    return issues;
  }

  private analyzeProjectStructure(projectPath: string): string[] {
    const structure: string[] = [];
    
    try {
      const srcPath = join(projectPath, 'src');
      if (existsSync(srcPath) && statSync(srcPath).isDirectory()) {
        const scanDirectory = (dir: string, prefix: string = '') => {
          const items = readdirSync(dir);
          for (const item of items) {
            const itemPath = join(dir, item);
            const stat = statSync(itemPath);
            if (stat.isDirectory()) {
              structure.push(`${prefix}${item}/`);
              scanDirectory(itemPath, `${prefix}${item}/`);
            } else {
              structure.push(`${prefix}${item}`);
            }
          }
        };
        scanDirectory(srcPath);
      }
    } catch (error) {
      structure.push('Error reading project structure');
    }

    return structure;
  }

  private detectArchitecturalIssues(projectPath: string, analysis: AnalysisResult): string[] {
    const issues: string[] = [];

    // Check for missing angular.json
    if (analysis.isAngularProject && !analysis.projectStructure.hasAngularJson) {
      issues.push('Missing angular.json configuration file');
    }

    // Check for missing tsconfig.json
    if (analysis.isAngularProject && !analysis.projectStructure.hasTsConfig) {
      issues.push('Missing tsconfig.json configuration file');
    }

    // Check for outdated Angular version
    if (analysis.angularVersion) {
      const version = this.parseVersion(analysis.angularVersion);
      if (version && version.major < 15) {
        issues.push('Angular version is significantly outdated (consider upgrading to v15+)');
      }
    }

    // Check for missing common Angular directories
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

  private generateRecommendations(analysis: AnalysisResult): string[] {
    const recommendations: string[] = [];

    if (analysis.outdatedDependencies.length > 0) {
      recommendations.push('Update outdated dependencies to latest versions');
    }

    if (analysis.securityIssues.length > 0) {
      recommendations.push('Address security vulnerabilities in dependencies');
    }

    if (analysis.projectStructure.architecturalIssues.length > 0) {
      recommendations.push('Fix architectural issues identified in project structure');
    }

    if (analysis.angularVersion) {
      const version = this.parseVersion(analysis.angularVersion);
      const latestVersion = this.parseVersion(execSync(`npm view @angular/core version`, { stdio: ["pipe", "pipe", "ignore"] }).toString().trim());
      if (version && latestVersion && version.major < latestVersion.major) {
        recommendations.push(`Consider upgrading to Angular ${latestVersion.major} for latest features and performance improvements`);
      }
    }

    if (!analysis.projectStructure.hasAngularJson && analysis.isAngularProject) {
      recommendations.push('Initialize Angular CLI configuration with ng new or ng init');
    }

    return recommendations;
  }

  private parseVersion(version: string): {major: number, minor: number, patch: number} | null {
    const match = version.replace(/[^0-9.]/g, '').match(/^(\d+)\.(\d+)\.(\d+)/);
    if (match) {
      return {
        major: parseInt(match[1]),
        minor: parseInt(match[2]),
        patch: parseInt(match[3])
      };
    }
    return null;
  }

  private formatAnalysisReport(analysis: AnalysisResult): string {
    let report = `# Angular Project Analysis Report\n\n`;
    report += `**Project Path:** ${analysis.projectPath}\n`;
    report += `**Is Angular Project:** ${analysis.isAngularProject ? 'Yes' : 'No'}\n\n`;

    if (analysis.isAngularProject) {
      report += `## Angular Version & Dependencies\n`;
      report += `**Angular Version:** ${analysis.angularVersion || 'Not detected'}\n\n`;
      
      if (Object.keys(analysis.angularDependencies).length > 0) {
        report += `**Angular Dependencies:**\n`;
        for (const [name, version] of Object.entries(analysis.angularDependencies)) {
          report += `- ${name}: ${version}\n`;
        }
        report += `\n`;
      }

      if (analysis.outdatedDependencies.length > 0) {
        report += `## Outdated Dependencies\n`;
        for (const dep of analysis.outdatedDependencies) {
          report += `- ${dep.name}: ${dep.current} ${dep.latest ? `(latest: ${dep.latest})` : ''}\n`;
        }
        report += `\n`;
      }

      if (analysis.securityIssues.length > 0) {
        report += `## Security Issues\n`;
        for (const issue of analysis.securityIssues) {
          report += `- ${issue.name}: ${issue.issue}\n`;
        }
        report += `\n`;
      }

      report += `## Project Structure\n`;
      report += `**Configuration Files:**\n`;
      report += `- angular.json: ${analysis.projectStructure.hasAngularJson ? '✅' : '❌'}\n`;
      report += `- tsconfig.json: ${analysis.projectStructure.hasTsConfig ? '✅' : '❌'}\n`;
      report += `- package.json: ${analysis.projectStructure.hasPackageJson ? '✅' : '❌'}\n\n`;

      if (analysis.projectStructure.srcStructure.length > 0) {
        report += `**Source Structure:**\n`;
        
        // Extract and display modules first - only get top-level module directories
        const modules = analysis.projectStructure.srcStructure
          .filter(item => {
            // Match pattern: app/modules/[module-name]/
            const modulePattern = /^app\/modules\/([^\/]+)\/$/;
            return modulePattern.test(item);
          })
          .map(item => {
            const match = item.match(/^app\/modules\/([^\/]+)\/$/);
            return match ? match[1] : '';
          })
          .filter(module => module !== ''); // Remove empty strings
        
        if (modules.length > 0) {
          report += `**Angular Modules Found (${modules.length}):**\n`;
          for (const module of modules) {
            report += `- ${module}\n`;
          }
          report += `\n`;
        }
        
        // Show first 30 items of full structure
        report += `**Full Structure (first 30 items):**\n`;
        for (const item of analysis.projectStructure.srcStructure.slice(0, 30)) {
          report += `- ${item}\n`;
        }
        if (analysis.projectStructure.srcStructure.length > 30) {
          report += `... and ${analysis.projectStructure.srcStructure.length - 30} more items\n`;
        }
        report += `\n`;
      }

      if (analysis.projectStructure.architecturalIssues.length > 0) {
        report += `## Architectural Issues\n`;
        for (const issue of analysis.projectStructure.architecturalIssues) {
          report += `- ⚠️ ${issue}\n`;
        }
        report += `\n`;
      }

      if (analysis.recommendations.length > 0) {
        report += `## Recommendations\n`;
        for (const rec of analysis.recommendations) {
          report += `- 💡 ${rec}\n`;
        }
        report += `\n`;
      }
    } else {
      report += `This does not appear to be an Angular project. No Angular dependencies found in package.json.\n`;
    }

    return report;
  }

}

