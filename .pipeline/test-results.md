# Test Results

## Backend Tests

**Command:** `dotnet test SpecAudit.slnx --verbosity normal`

**Result:** PASS

**Summary:**
- Total: 21
- Passed: 21
- Failed: 0
- Skipped: 0

**Passed Tests:**
1. backend.Tests.ExtractStructuredJsonTests.ExtractStructuredJson_WithInvalidJson_ReturnsNull
2. backend.Tests.UserMessageBuilderTests.BuildUserMessage_SpecContentAppearsAfterFormatHint
3. backend.Tests.UserMessageBuilderTests.BuildUserMessage_WithYamlHint_IncludesFormatInMessage
4. backend.Tests.UserMessageBuilderTests.BuildUserMessage_WithNullFormat_FallsBackToAutoDetect
5. backend.Tests.ExtractStructuredJsonTests.ExtractStructuredJson_WithMultipleJsonBlocks_ExtractsOnlyLast
6. backend.Tests.ExtractStructuredJsonTests.ExtractStructuredJson_WithNoJsonBlock_ReturnsNull
7. backend.Tests.ExtractStructuredJsonTests.ExtractStructuredJson_WithWhitespaceOnlyBlock_ReturnsNull
8. backend.Tests.ExtractStructuredJsonTests.ExtractStructuredJson_WithEmptyCodeBlock_ReturnsNull
9. backend.Tests.ExtractStructuredJsonTests.ExtractStructuredJson_WithValidJsonBlock_ReturnsJsonString
10. backend.Tests.ExtractStructuredJsonTests.ExtractStructuredJson_WithTextAfterJsonBlock_ReturnsJsonString
11. backend.Tests.AiOptionsValidationTests.Startup_MissingBaseUrl_ThrowsInvalidOperationException
12. backend.Tests.AiOptionsValidationTests.Startup_MissingApiKey_ThrowsInvalidOperationException
13. backend.Tests.AiOptionsValidationTests.Startup_MissingModelId_ThrowsInvalidOperationException
14. backend.Tests.SentryStartupTests.HealthEndpoint_Works_WhenSentryDsnIsSet
15. backend.Tests.EndpointValidationTests.PostAudit_WhitespaceOnlySpec_Returns400
16. backend.Tests.SentryStartupTests.HealthEndpoint_Works_WhenSentryDsnIsNotSet
17. backend.Tests.EndpointValidationTests.PostAudit_SpecExceedsMaxLength_Returns413
18. backend.Tests.EndpointValidationTests.GetConfig_DoesNotReturnApiKey
19. backend.Tests.EndpointValidationTests.PostAudit_EmptySpec_Returns400
20. backend.Tests.EndpointValidationTests.GetConfig_ReturnsProviderName
21. backend.Tests.EndpointValidationTests.PostAudit_TrimmedSpec_AcceptsSpec

**Details:**
```
Test Run Successful.
Total tests: 21
     Passed: 21
 Total time: 0.8148 Seconds

Build succeeded.
    0 Warning(s)
    0 Error(s)
Time Elapsed 00:00:02.35
```

**Conclusion:** All tests pass. The change to `CancellationToken.None` on line 197 of `SpecAuditService.cs` does not break any existing tests.
