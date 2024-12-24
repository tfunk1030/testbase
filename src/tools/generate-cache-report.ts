import { CacheReportGenerator } from '../core/cache-report-generator';
import * as fs from 'fs';
import * as path from 'path';

async function generateReport(): Promise<void> {
    const generator = CacheReportGenerator.getInstance();
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const reportsDir = path.join(__dirname, '../../reports/cache');

    // Create reports directory if it doesn't exist
    if (!fs.existsSync(reportsDir)) {
        fs.mkdirSync(reportsDir, { recursive: true });
    }

    // Generate markdown report
    const markdownReport = generator.generateMarkdownReport();
    const markdownPath = path.join(reportsDir, `cache-report-${timestamp}.md`);
    fs.writeFileSync(markdownPath, markdownReport);

    // Generate JSON report
    const jsonReport = generator.generateJsonReport();
    const jsonPath = path.join(reportsDir, `cache-report-${timestamp}.json`);
    fs.writeFileSync(jsonPath, jsonReport);

    console.log(`
Cache Performance Reports Generated:
- Markdown Report: ${markdownPath}
- JSON Report: ${jsonPath}
    `);
}

// Run the report generator
generateReport().catch(console.error);
