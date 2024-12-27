# Step-by-Step AI Development Guide

## Quick Start

1. **Available Tools & Servers**

   A. Core AI Tools:
   - Install VSCode extensions:
     - Cody AI
     - Cascade Codium
   - Web interfaces:
     - GPT Engineer
     - Replit Ghost Writer
     - Claude (current)

   B. MCP Servers for Enhanced Capabilities:
   - **Performance & Analysis:**
     - solver: For complex physics calculations
     - sequential-thinking: For breaking down complex problems
     - codesavant: For code analysis and insights
   
   - **Development Support:**
     - filesystem: For file operations
     - memory: For data persistence
     - commands: For system operations
     - github: For repository management
   
   - **Testing & Validation:**
     - neon: For database operations
     - postman: For API testing
     - openrpc: For RPC testing
   
   - **Research & Documentation:**
     - llamacloud: For knowledge base queries
     - exa: For web research
     - reddit: For community insights
     - google-maps: For location data

2. **Setup Required Tools**
   - Install VSCode extensions:
     - Cody AI
     - Cascade Codium
   - Have access to:
     - GPT Engineer (web interface)
     - Replit Ghost Writer (web interface)
     - Claude (current interface)

2. **Begin First Task (GPU Optimization)**
   ```
   1. Open VSCode
   2. Enable Cody AI and Cascade Codium
   3. Navigate to src/core/gpu directory
   4. Follow GPU Optimization Steps below
   ```

3. **Track Progress**
   ```
   Create a new file: development_log.md
   Copy the Progress Tracking template
   Update after each step
   ```

4. **Get Help**
   ```
   At any point:
   Ask Claude: "I'm at [current step], and [describe issue].
   What should I do next?"
   ```

---

## Starting GPU Optimization

### Step 1: Initial Project Understanding
Use Cody AI first to understand the codebase:
```
Ask Cody AI:
"Show me all GPU-related files in the src/core/gpu directory and explain their relationships"
```

### Step 2: Deep Dive Analysis

A. Use sequential-thinking for problem breakdown:
```
Use MCP sequential-thinking tool:
"Break down the GPU optimization problem:
1. Memory transfer patterns
2. Kernel operations
3. Resource allocation
4. Performance bottlenecks"
```

B. Use solver for physics calculations:
```
Use MCP solver tool to:
1. Analyze computation patterns
2. Identify optimization opportunities
3. Validate mathematical operations
4. Suggest performance improvements
```

C. Use codesavant for code analysis:
```
Use MCP codesavant tool to:
1. Analyze src/core/gpu/gpu-compute.ts
2. Find performance-critical sections
3. Identify optimization patterns
4. Map dependency relationships
```

D. Use Claude for architecture synthesis:
```
Ask Claude:
"Based on the sequential-thinking breakdown, solver analysis, and codesavant insights, please:
1. Synthesize findings
2. Identify key bottlenecks
3. Suggest optimization strategies
4. Outline implementation approach"
```

### Step 3: Code Pattern Recognition
Use Cascade Codium to identify optimization opportunities:
```
1. Open src/core/gpu/gpu-compute.ts
2. Let Cascade Codium analyze the file
3. Look for inline suggestions about:
   - Memory patterns
   - Performance optimizations
   - Type improvements
```

### Step 4: Implementation Planning
Back to Claude for implementation strategy:
```
Ask Claude:
"Based on the analysis and Cascade Codium's suggestions, please provide:
1. Step-by-step implementation plan
2. Files that need to be modified
3. Specific optimizations to implement"
```

### Step 5: Implementation
Use GPT Engineer for base implementation:
```
Ask GPT Engineer:
"Using Claude's implementation plan, generate optimized code for:
1. Memory pooling system
2. Buffer management
3. Transfer optimizations
Include error handling and performance metrics."
```

### Step 6: Real-time Refinement
Use Cascade Codium during implementation:
```
1. Open the files GPT Engineer created
2. Apply Cascade Codium suggestions for:
   - Code optimization
   - Type safety
   - Error handling
```

### Step 7: Integration Verification
Use Cody AI to verify integration:
```
Ask Cody AI:
"Check the new implementation for:
1. Breaking changes in gpu-compute.ts
2. Dependency issues
3. Interface consistency"
```

### Step 8: Test Generation
Use Replit Ghost Writer for testing:
```
Ask Replit:
"Generate performance tests for the GPU optimization:
1. Memory transfer benchmarks
2. Resource utilization tests
3. Error condition tests"
```

### Step 9: Final Review
Back to Claude for review:
```
Ask Claude:
"Please review the complete implementation:
1. [Paste the code]
2. [Paste the tests]
3. Verify optimizations
4. Check for issues
5. Suggest any final improvements"
```

## Wind Effects Optimization Steps

### Step 1: Wind System Understanding
Use Cody AI to map the system:
```
Ask Cody AI:
"Show me all wind-related files and their dependencies, particularly:
1. wind-effects.ts
2. Any turbulence modeling files
3. Files handling environmental conditions"
```

### Step 2: Current Implementation Analysis

A. Use sequential-thinking for problem decomposition:
```
Use MCP sequential-thinking tool:
"Break down the wind effects system:
1. Turbulence modeling components
2. Environmental factors
3. Edge case scenarios
4. Performance considerations"
```

B. Use solver for physics validation:
```
Use MCP solver tool to:
1. Validate turbulence equations
2. Analyze wind gradient calculations
3. Verify environmental models
4. Test edge case scenarios"
```

C. Use codesavant for implementation analysis:
```
Use MCP codesavant tool to:
1. Analyze wind-effects.ts implementation
2. Review turbulence modeling code
3. Check environmental calculations
4. Identify optimization opportunities
```

D. Use exa for research validation:
```
Use MCP exa tool to:
"Research latest wind effect modeling techniques:
1. Modern turbulence models
2. Environmental factor handling
3. Performance optimization approaches
4. Industry best practices"
```

E. Use Claude for comprehensive analysis:
```
Ask Claude:
"Based on sequential-thinking breakdown, solver validation, codesavant analysis, and exa research, please:
1. Evaluate current implementation
2. Identify improvement areas
3. Suggest optimization approaches
4. Outline validation strategy"
```

### Step 3: Pattern Analysis
Use Cascade Codium for code patterns:
```
1. Open wind-effects.ts and related files
2. Look for Cascade Codium suggestions about:
   - Turbulence calculations
   - Wind gradient handling
   - Performance optimizations
```

### Step 4: Implementation Strategy
Back to Claude for planning:
```
Ask Claude:
"Based on the analysis and Cascade Codium's suggestions, please provide:
1. Implementation plan for improved wind effects
2. Specific files to modify
3. New algorithms to implement
4. Expected performance improvements"
```

### Step 5: Core Implementation
Use GPT Engineer for implementation:
```
Ask GPT Engineer:
"Using Claude's plan, generate optimized wind effects code with:
1. Advanced turbulence modeling
2. Improved gradient calculations
3. Better edge case handling
Include validation and error handling."
```

### Step 6: Real-time Optimization
Use Cascade Codium during coding:
```
1. Open the new wind effects files
2. Apply Cascade Codium suggestions for:
   - Algorithm optimization
   - Type safety
   - Error handling
   - Performance improvements
```

### Step 7: Integration Check
Use Cody AI for verification:
```
Ask Cody AI:
"Verify the new wind effects implementation:
1. Check all file dependencies
2. Verify interface consistency
3. Look for potential conflicts
4. Confirm all references are updated"
```

### Step 8: Test Suite Creation
Use Replit Ghost Writer for testing:
```
Ask Replit:
"Generate comprehensive wind effects tests:
1. Turbulence model validation
2. Edge case scenarios
3. Performance benchmarks
4. Environmental condition tests"
```

### Step 9: Final Review
Back to Claude for complete review:
```
Ask Claude:
"Please review the wind effects implementation:
1. [Paste the code]
2. [Paste the tests]
3. Verify accuracy improvements
4. Check performance gains
5. Suggest any final refinements"
```

## Cache Optimization Steps

### Step 1: Cache System Mapping
Use Cody AI to understand the cache system:
```
Ask Cody AI:
"Show me all cache-related files and their relationships, particularly:
1. cache-manager.ts
2. cache-analytics.ts
3. Files handling cache warming
4. Cache prediction systems"
```

### Step 2: Performance Analysis

A. Use sequential-thinking for system breakdown:
```
Use MCP sequential-thinking tool:
"Break down the cache system:
1. Cache storage patterns
2. Memory management
3. Prediction strategies
4. Performance metrics"
```

B. Use memory MCP server for analysis:
```
Use MCP memory tool to:
1. Analyze current memory usage
2. Track cache patterns
3. Monitor resource allocation
4. Identify memory leaks
```

C. Use filesystem MCP server for storage analysis:
```
Use MCP filesystem tool to:
1. Analyze cache file structure
2. Check disk usage patterns
3. Monitor I/O operations
4. Identify bottlenecks
```

D. Use codesavant for implementation analysis:
```
Use MCP codesavant tool to:
1. Analyze cache-manager.ts
2. Review prediction algorithms
3. Check warming strategies
4. Find optimization opportunities
```

E. Use neon for database optimization:
```
Use MCP neon tool to:
1. Analyze cache queries
2. Optimize data storage
3. Improve retrieval patterns
4. Enhance persistence layer
```

F. Use Claude for synthesis:
```
Ask Claude:
"Based on all analysis results, please:
1. Evaluate current cache system
2. Identify performance bottlenecks
3. Suggest optimization strategies
4. Outline implementation plan"
```

### Step 3: Optimization Patterns
Use Cascade Codium for code analysis:
```
1. Open cache-related files
2. Look for Cascade Codium suggestions about:
   - Cache key generation
   - Memory usage
   - Performance patterns
   - Type optimizations
```

### Step 4: Strategy Development
Back to Claude for planning:
```
Ask Claude:
"Based on the analysis and Cascade Codium's suggestions, please provide:
1. Cache optimization strategy
2. Files to modify
3. New caching algorithms
4. Expected performance gains"
```

### Step 5: Implementation
Use GPT Engineer for core implementation:
```
Ask GPT Engineer:
"Using Claude's strategy, generate optimized cache system with:
1. Smart prediction patterns
2. Efficient warming strategies
3. Memory optimization
4. Analytics improvements
Include performance metrics and monitoring."
```

### Step 6: Real-time Enhancement
Use Cascade Codium during implementation:
```
1. Open the new cache system files
2. Apply Cascade Codium suggestions for:
   - Cache efficiency
   - Memory management
   - Type safety
   - Error handling
```

### Step 7: System Verification
Use Cody AI to verify the system:
```
Ask Cody AI:
"Verify the new cache implementation:
1. Check cache consistency
2. Verify warming triggers
3. Validate prediction patterns
4. Confirm memory management"
```

### Step 8: Performance Testing
Use Replit Ghost Writer for test creation:
```
Ask Replit:
"Generate cache performance tests:
1. Hit rate benchmarks
2. Memory usage tests
3. Warming efficiency tests
4. Prediction accuracy tests"
```

### Step 9: Final Validation
Back to Claude for complete review:
```
Ask Claude:
"Please review the cache optimization:
1. [Paste the code]
2. [Paste the tests]
3. Verify performance improvements
4. Check memory efficiency
5. Suggest any final optimizations"
```

## Validation Suite Expansion Steps

### Step 1: Test Coverage Analysis
Use Cody AI to map current testing:
```
Ask Cody AI:
"Show me all test files and their coverage, particularly:
1. validation-suite.ts
2. Performance test files
3. Edge case tests
4. Integration tests"
```

### Step 2: Coverage Gap Analysis

A. Use sequential-thinking for test breakdown:
```
Use MCP sequential-thinking tool:
"Break down the validation requirements:
1. Unit test coverage
2. Integration points
3. Performance metrics
4. Edge cases"
```

B. Use postman for API testing analysis:
```
Use MCP postman tool to:
1. Analyze API endpoints
2. Check request/response patterns
3. Verify error handling
4. Identify coverage gaps
```

C. Use openrpc for RPC testing:
```
Use MCP openrpc tool to:
1. Analyze RPC methods
2. Check parameter handling
3. Verify response patterns
4. Identify missing tests
```

D. Use codesavant for test coverage:
```
Use MCP codesavant tool to:
1. Analyze current test files
2. Map test coverage
3. Find untested paths
4. Suggest test improvements
```

E. Use neon for database testing:
```
Use MCP neon tool to:
1. Analyze data operations
2. Check transaction coverage
3. Verify data integrity tests
4. Identify edge cases
```

F. Use Claude for strategy synthesis:
```
Ask Claude:
"Based on all analysis results, please:
1. Evaluate current test coverage
2. Identify critical gaps
3. Suggest test expansion strategy
4. Prioritize test development"
```

### Step 3: Test Pattern Review
Use Cascade Codium for test analysis:
```
1. Open validation-suite.ts and related test files
2. Look for Cascade Codium suggestions about:
   - Test structure
   - Assertion patterns
   - Edge case handling
   - Performance measurements
```

### Step 4: Test Strategy Planning
Back to Claude for planning:
```
Ask Claude:
"Based on the analysis and Cascade Codium's suggestions, please provide:
1. Test expansion strategy
2. New test scenarios needed
3. Performance test improvements
4. Integration test plan"
```

### Step 5: Test Implementation

A. Use postman for API test generation:
```
Use MCP postman tool to:
1. Generate API endpoint tests
2. Create request/response validations
3. Set up error scenario tests
4. Build integration test flows
```

B. Use openrpc for RPC test generation:
```
Use MCP openrpc tool to:
1. Generate RPC method tests
2. Create parameter validations
3. Set up error handling tests
4. Build service integration tests
```

C. Use neon for database test generation:
```
Use MCP neon tool to:
1. Create data operation tests
2. Generate transaction tests
3. Build integrity checks
4. Set up edge case scenarios
```

D. Use GPT Engineer for core test implementation:
```
Ask GPT Engineer:
"Using the test strategy and generated tests, create:
1. Comprehensive test suite
2. Performance benchmarks
3. Edge case validations
4. Integration scenarios
Include all test types from postman, openrpc, and neon."
```

E. Use github for test version control:
```
Use MCP github tool to:
1. Create test branch
2. Commit test files
3. Set up CI/CD for tests
4. Track test coverage
```

### Step 6: Test Enhancement

A. Use postman for API test enhancement:
```
Use MCP postman tool to:
1. Enhance API test coverage
2. Add advanced assertions
3. Improve error scenarios
4. Optimize test flows
```

B. Use openrpc for RPC test enhancement:
```
Use MCP openrpc tool to:
1. Enhance RPC test coverage
2. Improve parameter validation
3. Add edge case handling
4. Optimize service tests
```

C. Use neon for database test enhancement:
```
Use MCP neon tool to:
1. Enhance data operation tests
2. Improve transaction coverage
3. Add integrity validations
4. Optimize performance tests
```

D. Use Cascade Codium for test refinement:
```
1. Open the enhanced test files
2. Apply Cascade Codium suggestions for:
   - Test optimization
   - Assertion improvement
   - Error case coverage
   - Performance metrics
```

### Step 7: Test Integration

A. Use github for test integration:
```
Use MCP github tool to:
1. Create pull request
2. Run CI/CD pipeline
3. Review test results
4. Track coverage changes
```

B. Use Cody AI for verification:
```
Ask Cody AI:
"Verify the expanded test suite:
1. Check test independence
2. Verify coverage completeness
3. Validate test patterns
4. Confirm all scenarios covered"
```

### Step 8: Performance Validation

A. Use postman for API performance:
```
Use MCP postman tool to:
1. Run API performance tests
2. Measure response times
3. Check error rates
4. Validate throughput
```

B. Use openrpc for RPC performance:
```
Use MCP openrpc tool to:
1. Run RPC performance tests
2. Measure latency
3. Check error handling
4. Validate concurrency
```

C. Use neon for database performance:
```
Use MCP neon tool to:
1. Run database benchmarks
2. Measure query performance
3. Check transaction speed
4. Validate data integrity
```

D. Use Replit for meta-testing:
```
Ask Replit:
"Generate test suite validation:
1. Test performance metrics
2. Coverage analysis
3. Edge case verification
4. Integration completeness"
```

### Step 9: Final Test Review
Back to Claude for complete review:
```
Ask Claude:
"Please review the expanded validation suite:
1. [Paste the test code]
2. [Paste the coverage reports]
3. Verify comprehensive coverage
4. Check test quality
5. Suggest any final improvements"
```

## Project Completion

After completing all optimizations and validation:
```
Ask Claude:
"Please review the entire project implementation:
1. GPU optimization results
2. Wind effects improvements
3. Cache performance gains
4. Validation coverage
And suggest any final system-wide optimizations."
```

## Tips for Tool Usage

1. **Cody AI** - Best for:
   - Quick code navigation
   - Understanding existing code
   - Finding related files
   - Checking dependencies

2. **Claude** - Best for:
   - High-level analysis
   - Architecture decisions
   - Implementation planning
   - Code review

3. **Cascade Codium** - Best for:
   - Real-time suggestions
   - Code optimization
   - Type improvements
   - Error handling

4. **GPT Engineer** - Best for:
   - Initial implementation
   - Complex algorithms
   - System-level optimizations

5. **Replit Ghost Writer** - Best for:
   - Test generation
   - Performance tests
   - Edge case testing

## Common Workflows

### For Bug Fixes:
1. Cody AI: Find related code
2. Claude: Analyze issue
3. GPT Engineer: Generate fix
4. Cascade Codium: Refine fix
5. Replit: Generate tests

### For New Features:
1. Claude: Design architecture
2. Cody AI: Check existing patterns
3. GPT Engineer: Implement
4. Cascade Codium: Optimize
5. Replit: Create tests

### For Performance Optimization:
1. Cody AI: Find bottlenecks
2. Claude: Analyze performance
3. GPT Engineer: Implement optimizations
4. Cascade Codium: Refine
5. Replit: Performance tests

## Progress Tracking

After each step, record in your development log:
```markdown
# [Component] Development Log

## Step Completed: [Step Number]
- Tool Used: [AI Tool Name]
- Action Taken: [What was done]
- Result: [Outcome]
- Next Step: [What to do next]
```

This ensures you always know which tool to use next and what to ask them.
