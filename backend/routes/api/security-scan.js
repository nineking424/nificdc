const express = require('express');
const router = express.Router();
const { authorize, requireAdmin } = require('../../middleware/rbac');
const vulnerabilityScanner = require('../../services/vulnerabilityScanner');
const auditLogger = require('../../services/auditLogger');
const logger = require('../../utils/logger');
const fs = require('fs');
const path = require('path');

/**
 * 보안 스캔 API 라우터
 * 취약점 스캔 실행, 결과 조회, 스캐너 관리
 */

// 전체 보안 스캔 실행 (관리자만)
router.post('/full-scan', requireAdmin(), async (req, res) => {
  try {
    const {
      scanTypes,
      directory,
      timeout,
      excludePatterns,
      includeTests = false
    } = req.body;

    const scanOptions = {
      scanTypes,
      directory: directory || process.cwd(),
      timeout: timeout || 300000,
      excludePatterns: excludePatterns || ['node_modules', '.git', 'dist', 'build'],
      includeTests,
      initiatedBy: req.user.id
    };

    logger.info('전체 보안 스캔 요청:', {
      userId: req.user.id,
      scanOptions
    });

    // 비동기 스캔 실행
    const scanPromise = vulnerabilityScanner.runFullScan(scanOptions);
    
    // 즉시 응답 (스캔은 백그라운드에서 실행)
    res.json({
      success: true,
      message: 'Security scan initiated',
      data: {
        status: 'RUNNING',
        startedAt: new Date(),
        estimatedDuration: '2-5 minutes',
        scanOptions: {
          ...scanOptions,
          directory: path.basename(scanOptions.directory) // 보안상 전체 경로 숨김
        }
      }
    });

    // 백그라운드에서 스캔 실행 및 결과 로깅
    scanPromise
      .then(async (result) => {
        await auditLogger.log({
          type: 'SECURITY_SCAN_COMPLETED',
          userId: req.user.id,
          userName: req.user.name,
          userRole: req.user.role,
          action: 'SCAN',
          resource: 'security',
          ip: req.ip,
          userAgent: req.get('User-Agent'),
          result: 'SUCCESS',
          severity: result.summary.riskLevel,
          metadata: {
            scanId: result.scanId,
            duration: result.duration,
            vulnerabilityCount: result.summary.totalVulnerabilities,
            riskScore: result.summary.overallRiskScore,
            scanTypes: result.summary.scanTypes
          }
        });

        logger.info('보안 스캔 완료:', {
          scanId: result.scanId,
          duration: result.duration,
          vulnerabilities: result.summary.totalVulnerabilities
        });
      })
      .catch(async (error) => {
        await auditLogger.log({
          type: 'SECURITY_SCAN_FAILED',
          userId: req.user.id,
          userName: req.user.name,
          userRole: req.user.role,
          action: 'SCAN',
          resource: 'security',
          ip: req.ip,
          userAgent: req.get('User-Agent'),
          result: 'ERROR',
          severity: 'HIGH',
          error: error.message
        });

        logger.error('보안 스캔 실패:', error);
      });

  } catch (error) {
    logger.error('보안 스캔 시작 실패:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to start security scan'
    });
  }
});

// 개별 스캔 실행
router.post('/scan/:scanType', authorize('security', 'scan'), async (req, res) => {
  try {
    const { scanType } = req.params;
    const scanOptions = {
      ...req.body,
      initiatedBy: req.user.id
    };

    const result = await vulnerabilityScanner.runScan(scanType, scanOptions);

    await auditLogger.log({
      type: 'SECURITY_SCAN_INDIVIDUAL',
      userId: req.user.id,
      userName: req.user.name,
      userRole: req.user.role,
      action: 'SCAN',
      resource: 'security',
      resourceId: scanType,
      ip: req.ip,
      userAgent: req.get('User-Agent'),
      result: 'SUCCESS',
      severity: result.riskScore > 70 ? 'HIGH' : 'MEDIUM',
      metadata: {
        scanType,
        duration: result.duration,
        vulnerabilityCount: result.vulnerabilities.length,
        riskScore: result.riskScore
      }
    });

    res.json({
      success: true,
      data: result
    });
  } catch (error) {
    logger.error(`${req.params.scanType} 스캔 실패:`, error);
    res.status(500).json({
      success: false,
      error: `Failed to run ${req.params.scanType} scan: ${error.message}`
    });
  }
});

// 스캔 히스토리 조회
router.get('/history', authorize('security', 'read'), async (req, res) => {
  try {
    const { limit = 10, scanType, riskLevel } = req.query;
    
    let history = vulnerabilityScanner.getScanHistory(parseInt(limit));
    
    // 필터링
    if (scanType) {
      history = history.filter(scan => 
        scan.summary.scanTypes.includes(scanType)
      );
    }
    
    if (riskLevel) {
      history = history.filter(scan => 
        scan.summary.riskLevel === riskLevel.toUpperCase()
      );
    }

    await auditLogger.log({
      type: 'SECURITY_SCAN_HISTORY_ACCESS',
      userId: req.user.id,
      userName: req.user.name,
      userRole: req.user.role,
      action: 'READ',
      resource: 'security',
      ip: req.ip,
      userAgent: req.get('User-Agent'),
      result: 'SUCCESS',
      metadata: {
        historyCount: history.length,
        filters: { scanType, riskLevel }
      }
    });

    res.json({
      success: true,
      data: {
        history,
        total: history.length,
        filters: { scanType, riskLevel }
      }
    });
  } catch (error) {
    logger.error('스캔 히스토리 조회 실패:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch scan history'
    });
  }
});

// 특정 스캔 결과 상세 조회
router.get('/results/:scanId', authorize('security', 'read'), async (req, res) => {
  try {
    const { scanId } = req.params;
    const { includeVulnerabilities = true } = req.query;
    
    const scanResult = vulnerabilityScanner.getScanResult(scanId);
    
    if (!scanResult) {
      return res.status(404).json({
        success: false,
        error: 'Scan result not found'
      });
    }

    // 취약점 상세 정보 제외 옵션
    let responseData = { ...scanResult };
    if (!includeVulnerabilities) {
      responseData = {
        ...scanResult,
        results: Object.fromEntries(
          Object.entries(scanResult.results).map(([key, value]) => [
            key,
            {
              ...value,
              vulnerabilities: `${value.vulnerabilities.length} vulnerabilities (use includeVulnerabilities=true to see details)`
            }
          ])
        )
      };
    }

    await auditLogger.log({
      type: 'SECURITY_SCAN_RESULT_ACCESS',
      userId: req.user.id,
      userName: req.user.name,
      userRole: req.user.role,
      action: 'READ',
      resource: 'security',
      resourceId: scanId,
      ip: req.ip,
      userAgent: req.get('User-Agent'),
      result: 'SUCCESS',
      metadata: {
        scanId,
        includeVulnerabilities
      }
    });

    res.json({
      success: true,
      data: responseData
    });
  } catch (error) {
    logger.error('스캔 결과 조회 실패:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch scan result'
    });
  }
});

// 스캔 리포트 다운로드
router.get('/reports/:scanId/download', authorize('security', 'export'), async (req, res) => {
  try {
    const { scanId } = req.params;
    const { format = 'json' } = req.query;
    
    const scanResult = vulnerabilityScanner.getScanResult(scanId);
    
    if (!scanResult) {
      return res.status(404).json({
        success: false,
        error: 'Scan result not found'
      });
    }

    let reportData;
    let contentType;
    let filename;

    if (format === 'json') {
      reportData = JSON.stringify(scanResult, null, 2);
      contentType = 'application/json';
      filename = `security-scan-${scanId}.json`;
    } else if (format === 'csv') {
      reportData = generateCSVReport(scanResult);
      contentType = 'text/csv';
      filename = `security-scan-${scanId}.csv`;
    } else if (format === 'html') {
      reportData = generateHTMLReport(scanResult);
      contentType = 'text/html';
      filename = `security-scan-${scanId}.html`;
    } else {
      return res.status(400).json({
        success: false,
        error: 'Unsupported format. Use json, csv, or html'
      });
    }

    await auditLogger.log({
      type: 'SECURITY_REPORT_DOWNLOAD',
      userId: req.user.id,
      userName: req.user.name,
      userRole: req.user.role,
      action: 'EXPORT',
      resource: 'security',
      resourceId: scanId,
      ip: req.ip,
      userAgent: req.get('User-Agent'),
      result: 'SUCCESS',
      metadata: {
        scanId,
        format,
        filename
      }
    });

    logger.info('보안 리포트 다운로드:', {
      scanId,
      format,
      userId: req.user.id
    });

    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.setHeader('Content-Type', contentType);
    res.send(reportData);
  } catch (error) {
    logger.error('리포트 다운로드 실패:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to download report'
    });
  }
});

// 스캐너 설정 조회
router.get('/scanners', authorize('security', 'read'), async (req, res) => {
  try {
    const config = vulnerabilityScanner.getScannerConfig();

    await auditLogger.log({
      type: 'SECURITY_SCANNER_CONFIG_ACCESS',
      userId: req.user.id,
      userName: req.user.name,
      userRole: req.user.role,
      action: 'READ',
      resource: 'security',
      ip: req.ip,
      userAgent: req.get('User-Agent'),
      result: 'SUCCESS'
    });

    res.json({
      success: true,
      data: config
    });
  } catch (error) {
    logger.error('스캐너 설정 조회 실패:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch scanner configuration'
    });
  }
});

// 스캐너 활성화/비활성화 (관리자만)
router.patch('/scanners/:scannerId/toggle', requireAdmin(), async (req, res) => {
  try {
    const { scannerId } = req.params;
    const { enabled } = req.body;

    if (typeof enabled !== 'boolean') {
      return res.status(400).json({
        success: false,
        error: 'enabled field must be boolean'
      });
    }

    const success = vulnerabilityScanner.toggleScanner(scannerId, enabled);

    if (!success) {
      return res.status(404).json({
        success: false,
        error: 'Scanner not found'
      });
    }

    await auditLogger.logConfigChange({
      userId: req.user.id,
      userName: req.user.name,
      userRole: req.user.role,
      configKey: `scanner_${scannerId}_enabled`,
      section: 'security',
      oldValues: { enabled: !enabled },
      newValues: { enabled },
      changes: { enabled },
      ip: req.ip,
      userAgent: req.get('User-Agent'),
      affectedServices: ['vulnerability_scanner']
    });

    logger.info('스캐너 토글:', {
      scannerId,
      enabled,
      userId: req.user.id
    });

    res.json({
      success: true,
      message: `Scanner ${enabled ? 'enabled' : 'disabled'}`,
      data: {
        scannerId,
        enabled,
        updatedBy: req.user.name,
        updatedAt: new Date()
      }
    });
  } catch (error) {
    logger.error('스캐너 토글 실패:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to toggle scanner'
    });
  }
});

// 취약점 통계 조회
router.get('/statistics', authorize('security', 'read'), async (req, res) => {
  try {
    const { timeWindow = '30d' } = req.query;
    
    const history = vulnerabilityScanner.getScanHistory(100);
    
    // 시간 윈도우 필터링
    const windowMs = parseTimeWindow(timeWindow);
    const since = new Date(Date.now() - windowMs);
    const filteredHistory = history.filter(scan => new Date(scan.startTime) > since);
    
    const statistics = {
      timeWindow,
      totalScans: filteredHistory.length,
      averageRiskScore: 0,
      totalVulnerabilities: 0,
      severityDistribution: {
        CRITICAL: 0,
        HIGH: 0,
        MEDIUM: 0,
        LOW: 0
      },
      scanTypeDistribution: {},
      riskTrend: []
    };

    if (filteredHistory.length > 0) {
      let totalRisk = 0;
      
      filteredHistory.forEach(scan => {
        totalRisk += scan.summary.overallRiskScore;
        statistics.totalVulnerabilities += scan.summary.totalVulnerabilities;
        
        // 심각도 분포
        Object.keys(statistics.severityDistribution).forEach(severity => {
          statistics.severityDistribution[severity] += scan.summary.severityCounts[severity] || 0;
        });
        
        // 스캔 타입 분포
        scan.summary.scanTypes.forEach(type => {
          statistics.scanTypeDistribution[type] = (statistics.scanTypeDistribution[type] || 0) + 1;
        });
        
        // 위험도 트렌드
        statistics.riskTrend.push({
          date: scan.startTime,
          riskScore: scan.summary.overallRiskScore,
          vulnerabilities: scan.summary.totalVulnerabilities
        });
      });
      
      statistics.averageRiskScore = Math.round(totalRisk / filteredHistory.length);
    }

    await auditLogger.log({
      type: 'SECURITY_STATISTICS_ACCESS',
      userId: req.user.id,
      userName: req.user.name,
      userRole: req.user.role,
      action: 'READ',
      resource: 'security',
      ip: req.ip,
      userAgent: req.get('User-Agent'),
      result: 'SUCCESS',
      metadata: { timeWindow }
    });

    res.json({
      success: true,
      data: statistics
    });
  } catch (error) {
    logger.error('취약점 통계 조회 실패:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch security statistics'
    });
  }
});

// 헬퍼 함수들
function parseTimeWindow(timeWindow) {
  const match = timeWindow.match(/^(\d+)([smhd])$/);
  if (!match) return 30 * 24 * 60 * 60 * 1000; // 기본 30일
  
  const [, amount, unit] = match;
  const multipliers = {
    s: 1000,
    m: 60 * 1000,
    h: 60 * 60 * 1000,
    d: 24 * 60 * 60 * 1000
  };
  
  return parseInt(amount) * multipliers[unit];
}

function generateCSVReport(scanResult) {
  const headers = [
    'Scan Type',
    'Vulnerability Type',
    'Severity',
    'File',
    'Line',
    'Description',
    'Package',
    'CVE'
  ];

  const rows = [headers.join(',')];
  
  Object.entries(scanResult.results).forEach(([scanType, result]) => {
    result.vulnerabilities.forEach(vuln => {
      const row = [
        scanType,
        vuln.type || '',
        vuln.severity || '',
        vuln.file || '',
        vuln.line || '',
        `"${(vuln.description || '').replace(/"/g, '""')}"`,
        vuln.package || '',
        vuln.cve || ''
      ];
      rows.push(row.join(','));
    });
  });

  return rows.join('\n');
}

function generateHTMLReport(scanResult) {
  const { summary } = scanResult;
  
  let html = `
<!DOCTYPE html>
<html>
<head>
  <title>Security Scan Report - ${scanResult.scanId}</title>
  <style>
    body { font-family: Arial, sans-serif; margin: 20px; }
    .header { background: #f5f5f5; padding: 20px; border-radius: 5px; }
    .summary { margin: 20px 0; }
    .vulnerability { margin: 10px 0; padding: 10px; border-left: 4px solid #ddd; }
    .critical { border-left-color: #d32f2f; }
    .high { border-left-color: #f57c00; }
    .medium { border-left-color: #fbc02d; }
    .low { border-left-color: #388e3c; }
    .risk-score { font-size: 24px; font-weight: bold; }
  </style>
</head>
<body>
  <div class="header">
    <h1>Security Scan Report</h1>
    <p><strong>Scan ID:</strong> ${scanResult.scanId}</p>
    <p><strong>Generated:</strong> ${new Date(scanResult.startTime).toLocaleString()}</p>
    <p><strong>Duration:</strong> ${Math.round(scanResult.duration / 1000)}s</p>
  </div>
  
  <div class="summary">
    <h2>Summary</h2>
    <p><strong>Risk Score:</strong> <span class="risk-score">${summary.overallRiskScore}/100</span></p>
    <p><strong>Total Vulnerabilities:</strong> ${summary.totalVulnerabilities}</p>
    <p><strong>Critical:</strong> ${summary.severityCounts.CRITICAL || 0}</p>
    <p><strong>High:</strong> ${summary.severityCounts.HIGH || 0}</p>
    <p><strong>Medium:</strong> ${summary.severityCounts.MEDIUM || 0}</p>
    <p><strong>Low:</strong> ${summary.severityCounts.LOW || 0}</p>
  </div>
`;

  Object.entries(scanResult.results).forEach(([scanType, result]) => {
    html += `<h2>${scanType} Scan Results</h2>`;
    
    result.vulnerabilities.forEach(vuln => {
      const severityClass = vuln.severity ? vuln.severity.toLowerCase() : 'low';
      html += `
      <div class="vulnerability ${severityClass}">
        <h4>${vuln.type} - ${vuln.severity}</h4>
        <p><strong>Description:</strong> ${vuln.description || 'No description'}</p>
        ${vuln.file ? `<p><strong>File:</strong> ${vuln.file}${vuln.line ? `:${vuln.line}` : ''}</p>` : ''}
        ${vuln.package ? `<p><strong>Package:</strong> ${vuln.package}</p>` : ''}
        ${vuln.cve ? `<p><strong>CVE:</strong> ${vuln.cve}</p>` : ''}
      </div>`;
    });
  });

  html += '</body></html>';
  return html;
}

module.exports = router;