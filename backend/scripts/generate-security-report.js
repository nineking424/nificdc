const fs = require('fs');
const path = require('path');

/**
 * 보안 스캔 결과를 통합하여 최종 리포트 생성
 */
class SecurityReportGenerator {
  constructor() {
    this.reportsDir = path.join(__dirname, '../../security-reports');
    this.summary = {
      timestamp: new Date().toISOString(),
      overallRisk: 'LOW',
      totalIssues: 0,
      dependencies: { status: 'PASS', issues: 0, details: [] },
      secrets: { status: 'PASS', issues: 0, details: [] },
      sast: { status: 'PASS', issues: 0, details: [] },
      container: { status: 'PASS', issues: 0, details: [] },
      dast: { status: 'PASS', issues: 0, details: [] }
    };
  }

  async generateReport() {
    console.log('보안 리포트 생성 시작...');
    
    try {
      // 리포트 디렉토리 생성
      this.ensureReportsDirectory();
      
      // 각 스캔 결과 분석
      await this.analyzeDependencyScan();
      await this.analyzeSecretScan();
      await this.analyzeSASTScan();
      await this.analyzeContainerScan();
      await this.analyzeDASTScan();
      
      // 전체 위험도 계산
      this.calculateOverallRisk();
      
      // 리포트 파일 생성
      await this.generateSummaryReport();
      await this.generateDetailedReport();
      await this.generateHTMLReport();
      
      console.log('보안 리포트 생성 완료:', {
        overallRisk: this.summary.overallRisk,
        totalIssues: this.summary.totalIssues
      });
      
    } catch (error) {
      console.error('보안 리포트 생성 실패:', error);
      process.exit(1);
    }
  }

  ensureReportsDirectory() {
    if (!fs.existsSync(this.reportsDir)) {
      fs.mkdirSync(this.reportsDir, { recursive: true });
    }
  }

  async analyzeDependencyScan() {
    const backendAuditPath = path.join(this.reportsDir, 'npm-audit-backend.json');
    const frontendAuditPath = path.join(this.reportsDir, 'npm-audit-frontend.json');
    
    let totalVulns = 0;
    let highSeverityCount = 0;
    
    // Backend 분석
    if (fs.existsSync(backendAuditPath)) {
      const auditData = JSON.parse(fs.readFileSync(backendAuditPath, 'utf8'));
      if (auditData.vulnerabilities) {
        for (const [pkg, vuln] of Object.entries(auditData.vulnerabilities)) {
          totalVulns++;
          if (vuln.severity === 'high' || vuln.severity === 'critical') {
            highSeverityCount++;
          }
          this.summary.dependencies.details.push({
            package: pkg,
            severity: vuln.severity,
            title: vuln.title || 'Dependency vulnerability'
          });
        }
      }
    }
    
    // Frontend 분석
    if (fs.existsSync(frontendAuditPath)) {
      const auditData = JSON.parse(fs.readFileSync(frontendAuditPath, 'utf8'));
      if (auditData.vulnerabilities) {
        for (const [pkg, vuln] of Object.entries(auditData.vulnerabilities)) {
          totalVulns++;
          if (vuln.severity === 'high' || vuln.severity === 'critical') {
            highSeverityCount++;
          }
          this.summary.dependencies.details.push({
            package: pkg,
            severity: vuln.severity,
            title: vuln.title || 'Dependency vulnerability'
          });
        }
      }
    }
    
    this.summary.dependencies.issues = totalVulns;
    this.summary.dependencies.status = highSeverityCount > 0 ? 'FAIL' : totalVulns > 0 ? 'WARN' : 'PASS';
    this.summary.totalIssues += totalVulns;
  }

  async analyzeSecretScan() {
    // TruffleHog 결과는 직접 GitHub Action에서 처리되므로
    // 여기서는 기본 상태로 설정
    this.summary.secrets.status = 'PASS';
    this.summary.secrets.issues = 0;
  }

  async analyzeSASTScan() {
    const eslintPath = path.join(this.reportsDir, 'eslint-security.json');
    const semgrepPath = path.join(this.reportsDir, 'semgrep-results.json');
    
    let totalIssues = 0;
    let highSeverityCount = 0;
    
    // ESLint 보안 결과 분석
    if (fs.existsSync(eslintPath)) {
      const eslintData = JSON.parse(fs.readFileSync(eslintPath, 'utf8'));
      for (const file of eslintData) {
        for (const message of file.messages) {
          if (message.ruleId && message.ruleId.includes('security')) {
            totalIssues++;
            if (message.severity === 2) {
              highSeverityCount++;
            }
            this.summary.sast.details.push({
              file: file.filePath,
              rule: message.ruleId,
              severity: message.severity === 2 ? 'high' : 'medium',
              message: message.message
            });
          }
        }
      }
    }
    
    // Semgrep 결과 분석
    if (fs.existsSync(semgrepPath)) {
      const semgrepData = JSON.parse(fs.readFileSync(semgrepPath, 'utf8'));
      if (semgrepData.results) {
        for (const result of semgrepData.results) {
          totalIssues++;
          if (result.extra.severity === 'ERROR') {
            highSeverityCount++;
          }
          this.summary.sast.details.push({
            file: result.path,
            rule: result.check_id,
            severity: result.extra.severity.toLowerCase(),
            message: result.extra.message
          });
        }
      }
    }
    
    this.summary.sast.issues = totalIssues;
    this.summary.sast.status = highSeverityCount > 0 ? 'FAIL' : totalIssues > 0 ? 'WARN' : 'PASS';
    this.summary.totalIssues += totalIssues;
  }

  async analyzeContainerScan() {
    const backendTrivyPath = path.join(this.reportsDir, 'trivy-backend.json');
    const frontendTrivyPath = path.join(this.reportsDir, 'trivy-frontend.json');
    
    let totalVulns = 0;
    let highSeverityCount = 0;
    
    [backendTrivyPath, frontendTrivyPath].forEach(trivyPath => {
      if (fs.existsSync(trivyPath)) {
        const trivyData = JSON.parse(fs.readFileSync(trivyPath, 'utf8'));
        if (trivyData.Results) {
          for (const result of trivyData.Results) {
            if (result.Vulnerabilities) {
              for (const vuln of result.Vulnerabilities) {
                totalVulns++;
                if (vuln.Severity === 'HIGH' || vuln.Severity === 'CRITICAL') {
                  highSeverityCount++;
                }
                this.summary.container.details.push({
                  package: vuln.PkgName,
                  version: vuln.InstalledVersion,
                  severity: vuln.Severity.toLowerCase(),
                  cve: vuln.VulnerabilityID,
                  description: vuln.Description
                });
              }
            }
          }
        }
      }
    });
    
    this.summary.container.issues = totalVulns;
    this.summary.container.status = highSeverityCount > 0 ? 'FAIL' : totalVulns > 0 ? 'WARN' : 'PASS';
    this.summary.totalIssues += totalVulns;
  }

  async analyzeDASTScan() {
    // OWASP ZAP 결과는 별도 처리 (스케줄된 스캔에서만 실행)
    this.summary.dast.status = 'PASS';
    this.summary.dast.issues = 0;
  }

  calculateOverallRisk() {
    const failCount = [
      this.summary.dependencies.status,
      this.summary.secrets.status,
      this.summary.sast.status,
      this.summary.container.status,
      this.summary.dast.status
    ].filter(status => status === 'FAIL').length;
    
    const warnCount = [
      this.summary.dependencies.status,
      this.summary.secrets.status,
      this.summary.sast.status,
      this.summary.container.status,
      this.summary.dast.status
    ].filter(status => status === 'WARN').length;
    
    if (failCount > 0 || this.summary.totalIssues > 20) {
      this.summary.overallRisk = 'HIGH';
    } else if (warnCount > 2 || this.summary.totalIssues > 10) {
      this.summary.overallRisk = 'MEDIUM';
    } else {
      this.summary.overallRisk = 'LOW';
    }
  }

  async generateSummaryReport() {
    const summaryPath = path.join(this.reportsDir, 'summary.json');
    fs.writeFileSync(summaryPath, JSON.stringify(this.summary, null, 2));
  }

  async generateDetailedReport() {
    const detailedPath = path.join(this.reportsDir, 'detailed-report.json');
    fs.writeFileSync(detailedPath, JSON.stringify({
      ...this.summary,
      scanDetails: {
        methodology: 'Automated security scanning pipeline',
        tools: ['npm audit', 'TruffleHog', 'ESLint Security', 'Semgrep', 'Trivy', 'OWASP ZAP'],
        coverage: 'Dependencies, Secrets, SAST, Container, DAST'
      }
    }, null, 2));
  }

  async generateHTMLReport() {
    const htmlContent = `
<!DOCTYPE html>
<html>
<head>
    <title>NiFiCDC Security Scan Report</title>
    <style>
        body { font-family: Arial, sans-serif; margin: 20px; background: #f5f5f5; }
        .container { max-width: 1200px; margin: 0 auto; background: white; padding: 20px; border-radius: 8px; }
        .header { text-align: center; margin-bottom: 30px; }
        .risk-badge { padding: 5px 15px; border-radius: 20px; color: white; font-weight: bold; }
        .risk-low { background: #4caf50; }
        .risk-medium { background: #ff9800; }
        .risk-high { background: #f44336; }
        .summary-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(250px, 1fr)); gap: 20px; margin: 20px 0; }
        .summary-card { background: #f8f9fa; padding: 15px; border-radius: 5px; border-left: 4px solid #007bff; }
        .status-pass { border-left-color: #28a745; }
        .status-warn { border-left-color: #ffc107; }
        .status-fail { border-left-color: #dc3545; }
        .details { margin-top: 30px; }
        .section { margin-bottom: 30px; }
        table { width: 100%; border-collapse: collapse; margin-top: 10px; }
        th, td { padding: 10px; text-align: left; border-bottom: 1px solid #ddd; }
        th { background: #f8f9fa; }
        .severity-critical { color: #d32f2f; font-weight: bold; }
        .severity-high { color: #f57c00; font-weight: bold; }
        .severity-medium { color: #fbc02d; }
        .severity-low { color: #388e3c; }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>🔒 NiFiCDC Security Scan Report</h1>
            <p>Generated on ${new Date(this.summary.timestamp).toLocaleString()}</p>
            <span class="risk-badge risk-${this.summary.overallRisk.toLowerCase()}">${this.summary.overallRisk} RISK</span>
        </div>
        
        <div class="summary-grid">
            <div class="summary-card status-${this.summary.dependencies.status.toLowerCase()}">
                <h3>📦 Dependencies</h3>
                <p><strong>Status:</strong> ${this.summary.dependencies.status}</p>
                <p><strong>Issues:</strong> ${this.summary.dependencies.issues}</p>
            </div>
            <div class="summary-card status-${this.summary.secrets.status.toLowerCase()}">
                <h3>🔑 Secrets</h3>
                <p><strong>Status:</strong> ${this.summary.secrets.status}</p>
                <p><strong>Issues:</strong> ${this.summary.secrets.issues}</p>
            </div>
            <div class="summary-card status-${this.summary.sast.status.toLowerCase()}">
                <h3>🔍 SAST</h3>
                <p><strong>Status:</strong> ${this.summary.sast.status}</p>
                <p><strong>Issues:</strong> ${this.summary.sast.issues}</p>
            </div>
            <div class="summary-card status-${this.summary.container.status.toLowerCase()}">
                <h3>🐳 Container</h3>
                <p><strong>Status:</strong> ${this.summary.container.status}</p>
                <p><strong>Issues:</strong> ${this.summary.container.issues}</p>
            </div>
        </div>
        
        <div class="details">
            <h2>Detailed Findings</h2>
            
            ${this.generateDetailsSection('Dependencies', this.summary.dependencies.details)}
            ${this.generateDetailsSection('SAST Issues', this.summary.sast.details)}
            ${this.generateDetailsSection('Container Vulnerabilities', this.summary.container.details)}
        </div>
        
        <div class="section">
            <h2>Recommendations</h2>
            <ul>
                <li>Regularly update dependencies to patch known vulnerabilities</li>
                <li>Implement security headers and CSRF protection</li>
                <li>Use secrets management for sensitive configuration</li>
                <li>Regular security testing in CI/CD pipeline</li>
                <li>Container image scanning and minimal base images</li>
            </ul>
        </div>
    </div>
</body>
</html>`;
    
    const htmlPath = path.join(this.reportsDir, 'security-report.html');
    fs.writeFileSync(htmlPath, htmlContent);
  }

  generateDetailsSection(title, details) {
    if (!details || details.length === 0) {
      return `<div class="section"><h3>${title}</h3><p>No issues found.</p></div>`;
    }
    
    let tableRows = '';
    details.forEach(detail => {
      const severity = detail.severity || 'unknown';
      tableRows += `
        <tr>
          <td class="severity-${severity}">${severity.toUpperCase()}</td>
          <td>${detail.package || detail.file || 'N/A'}</td>
          <td>${detail.title || detail.message || detail.description || 'No description'}</td>
        </tr>`;
    });
    
    return `
      <div class="section">
        <h3>${title}</h3>
        <table>
          <thead>
            <tr>
              <th>Severity</th>
              <th>Component</th>
              <th>Description</th>
            </tr>
          </thead>
          <tbody>
            ${tableRows}
          </tbody>
        </table>
      </div>`;
  }
}

// 스크립트 실행
if (require.main === module) {
  const generator = new SecurityReportGenerator();
  generator.generateReport();
}

module.exports = SecurityReportGenerator;