import { PerformanceTestSuite } from '../test/performance/performance-test-suite';
import yargs from 'yargs';
import { hideBin } from 'yargs/helpers';

async function main() {
    const argv = await yargs(hideBin(process.argv))
        .option('report-dir', {
            alias: 'r',
            type: 'string',
            description: 'Directory to store test reports',
            default: './reports/performance-tests'
        })
        .option('continuous', {
            alias: 'c',
            type: 'boolean',
            description: 'Run tests continuously with specified interval',
            default: false
        })
        .option('interval', {
            alias: 'i',
            type: 'number',
            description: 'Interval between test runs in minutes (only with --continuous)',
            default: 60
        })
        .option('notify', {
            alias: 'n',
            type: 'boolean',
            description: 'Send notifications on test failures',
            default: false
        })
        .help()
        .argv;

    const testSuite = new PerformanceTestSuite();

    if (argv.continuous) {
        console.log(`Starting continuous performance testing (interval: ${argv.interval} minutes)`);
        
        const runTests = async () => {
            try {
                await testSuite.runTests();
                console.log(`\nNext test run in ${argv.interval} minutes...`);
            } catch (error) {
                console.error('Error running performance tests:', error);
                if (argv.notify) {
                    // Implement notification system here
                    console.log('Test failure notification sent');
                }
            }
        };

        // Run tests immediately
        await runTests();

        // Schedule subsequent runs
        setInterval(runTests, argv.interval * 60 * 1000);
    } else {
        try {
            await testSuite.runTests();
        } catch (error) {
            console.error('Error running performance tests:', error);
            process.exit(1);
        }
    }
}

main().catch(console.error);
