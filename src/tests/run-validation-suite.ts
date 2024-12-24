import { ValidationSuite } from './validation-suite';

async function runTests() {
    console.log('Starting Validation Suite...\n');
    
    const suite = new ValidationSuite();
    const results = await suite.runAllTests();
    
    // Print summary
    console.log('\nValidation Suite Results:');
    console.log('------------------------');
    console.log(`Total Tests: ${results.totalTests}`);
    console.log(`Passed: ${results.passedTests}`);
    console.log(`Failed: ${results.failedTests}`);
    console.log(`Pass Rate: ${((results.passedTests / results.totalTests) * 100).toFixed(1)}%\n`);
    
    // Print detailed results
    console.log('Detailed Results:');
    console.log('----------------');
    results.results.forEach(result => {
        const status = result.passed ? '✅ PASS' : '❌ FAIL';
        console.log(`${status} | ${result.testName}`);
        
        if (!result.passed) {
            if (result.error) {
                console.log(`  Error: ${result.error}`);
            } else if (result.metrics) {
                console.log(`  Max Difference: ${(result.metrics.difference * 100).toFixed(1)}%`);
                console.log(`  Expected: ${JSON.stringify(result.metrics.expected)}`);
                console.log(`  Actual: ${JSON.stringify(result.metrics.actual)}`);
            }
        }
        console.log('');
    });
    
    // Exit with appropriate code
    process.exit(results.failedTests > 0 ? 1 : 0);
}

runTests().catch(error => {
    console.error('Test suite failed:', error);
    process.exit(1);
});
