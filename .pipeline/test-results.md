# Test Results

## Backend Tests

**Command:** `dotnet test SpecAudit.slnx`

**Result:** PASS

**Summary:**
- Total: 21
- Passed: 21
- Failed: 0
- Skipped: 0

**Details:**

```
Test run for D:\Work\Personal\SpecAudit\backend.Tests\bin\Debug\net10.0\backend.Tests.dll (.NETCoreApp,Version=v10.0)
VSTest version 18.0.1 (x64)

Starting test execution, please wait...
A total of 1 test files matched the specified pattern.

  Passed backend.Tests.UserMessageBuilderTests.BuildUserMessage_SpecContentAppearsAfterFormatHint
  Passed backend.Tests.ExtractStructuredJsonTests.ExtractStructuredJson_WithInvalidJson_ReturnsNull
  Passed backend.Tests.UserMessageBuilderTests.BuildUserMessage_WithYamlHint_IncludesFormatInMessage
  Passed backend.Tests.UserMessageBuilderTests.BuildUserMessage_WithNullFormat_FallsBackToAutoDetect
  Passed backend.Tests.ExtractStructuredJsonTests.ExtractStructuredJson_WithMultipleJsonBlocks_ExtractsOnlyLast
  Passed backend.Tests.ExtractStructuredJsonTests.ExtractStructuredJson_WithNoJsonBlock_ReturnsNull
  Passed backend.Tests.ExtractStructuredJsonTests.ExtractStructuredJson_WithWhitespaceOnlyBlock_ReturnsNull
  Passed backend.Tests.ExtractStructuredJsonTests.ExtractStructuredJson_WithEmptyCodeBlock_ReturnsNull
  Passed backend.Tests.ExtractStructuredJsonTests.ExtractStructuredJson_WithValidJsonBlock_ReturnsJsonString
  Passed backend.Tests.ExtractStructuredJsonTests.ExtractStructuredJson_WithTextAfterJsonBlock_ReturnsJsonString
  Passed backend.Tests.AiOptionsValidationTests.Startup_MissingBaseUrl_ThrowsInvalidOperationException
  Passed backend.Tests.AiOptionsValidationTests.Startup_MissingApiKey_ThrowsInvalidOperationException
  Passed backend.Tests.AiOptionsValidationTests.Startup_MissingModelId_ThrowsInvalidOperationException
  Passed backend.Tests.SentryStartupTests.HealthEndpoint_Works_WhenSentryDsnIsSet
  Passed backend.Tests.EndpointValidationTests.PostAudit_WhitespaceOnlySpec_Returns400
  Passed backend.Tests.SentryStartupTests.HealthEndpoint_Works_WhenSentryDsnIsNotSet
  Passed backend.Tests.EndpointValidationTests.PostAudit_SpecExceedsMaxLength_Returns413
  Passed backend.Tests.EndpointValidationTests.GetConfig_DoesNotReturnApiKey
  Passed backend.Tests.EndpointValidationTests.PostAudit_EmptySpec_Returns400
  Passed backend.Tests.EndpointValidationTests.GetConfig_ReturnsProviderName
  Passed backend.Tests.EndpointValidationTests.PostAudit_TrimmedSpec_AcceptsSpec

Test Run Successful.
Total tests: 21
     Passed: 21
 Total time: 0.8215 Seconds

Build succeeded.
    0 Warning(s)
    0 Error(s)

Time Elapsed 00:00:02.69
```

**Conclusion:** All tests pass.

All backend tests pass.
