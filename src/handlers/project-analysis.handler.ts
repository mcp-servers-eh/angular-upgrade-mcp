import { existsSync} from 'fs';
import { join } from 'path';
import { AnalysisResult } from '../models/analysis-result.interface.js';
import { PackageJson } from '../models/package-json.interface.js';
import { getLatestVersion } from '../utils/latest-version.js';
import { execSync } from "child_process";
import { parseVersion } from '../utils/parse-version.js';
import { readPackageJson } from '../utils/package-json.js';
import { extractAngularVersion } from '../utils/extract-angular-version.js';
import { extractAngularDependencies } from '../utils/extract-angular-dependancies.js';
import { readAngularJson } from '../utils/angular-json.js';
import { readTsConfig } from '../utils/ts-config.js';
import { isAngularProject } from '../utils/is-angular-project.js';
import { analyzeProjectStructure } from '../utils/analyze-project-structure.js';

export class ProjectAnalysisHandler {

  META_DATA = {
    name: "project_analyze",
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
    result.isAngularProject = isAngularProject(projectPath);
    
    // Analyze package.json
    const packageJson = readPackageJson(projectPath);
    if (packageJson) {
      result.projectStructure.hasPackageJson = true;
      result.configurationAnalysis.packageConfig = packageJson;
      
      // Find Angular version and dependencies
      result.angularVersion = extractAngularVersion(packageJson);
      result.angularDependencies = extractAngularDependencies(packageJson);
      
      // Check for outdated dependencies
      result.outdatedDependencies = await this.checkOutdatedDependencies(packageJson);
      
      // Check for security issues
      result.securityIssues = this.checkSecurityIssues(projectPath);
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
    result.projectStructure.architecturalIssues = await this.detectArchitecturalIssues(projectPath, result);

    // Generate recommendations
    result.recommendations = await this.generateRecommendations(result);

    return result;
  }

  private async checkOutdatedDependencies(packageJson: PackageJson): Promise<Array<{name: string, current: string, latest?: string}>> {
    const outdated: Array<{name: string, current: string, latest?: string}> = [];
    const allDeps = {
      ...packageJson.dependencies,
      ...packageJson.devDependencies
    };
  
    for (const [name, version] of Object.entries(allDeps)) {
      try {
        // Get latest version from npm registry using utility
        const latest = await getLatestVersion(name);
  
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

  private async detectArchitecturalIssues(projectPath: string, analysis: AnalysisResult): Promise<string[]> {
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
      const version = parseVersion(analysis.angularVersion);
      try {
        const latestAngularVersion = await getLatestVersion('@angular/core');
        const latestVersion = parseVersion(latestAngularVersion);
        if (version && latestVersion && version.major < latestVersion.major - 2) {
          issues.push(`Angular version is significantly outdated (consider upgrading to v${latestVersion.major}+)`);
        }
      } catch (error) {
        // Fallback: just note that version checking failed
        issues.push('Unable to check Angular version against latest - consider upgrading to latest version');
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

  private async generateRecommendations(analysis: AnalysisResult): Promise<string[]> {
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
      const version = parseVersion(analysis.angularVersion);
      try {
        const latestAngularVersion = await getLatestVersion('@angular/core');
        const latestVersion = parseVersion(latestAngularVersion);
        if (version && latestVersion && version.major < latestVersion.major) {
          recommendations.push(`Consider upgrading to Angular ${latestVersion.major} for latest features and performance improvements`);
        }
      } catch (error) {
        // Fallback recommendation if version fetch fails
        recommendations.push('Consider upgrading to the latest Angular version for latest features and performance improvements');
      }
    }

    if (!analysis.projectStructure.hasAngularJson && analysis.isAngularProject) {
      recommendations.push('Initialize Angular CLI configuration with ng new or ng init');
    }

    return recommendations;
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

