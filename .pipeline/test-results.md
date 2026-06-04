# Test Results

## Summary
PASS

## Build
- Project: `backend/backend.csproj`
- Status: ✅ Build succeeded
- Warnings: 0
- Errors: 0

## Backend Tests
- Count: 29 tests in 5 test files
- Status: ✅ Pass
- Failures: None

### Test Results Detail

| Test File | Tests | Status |
|-----------|-------|--------|
| `backend.Tests.DiagnoseEndpointTests` | 8 | ✅ All passed |
| `backend.Tests.EndpointValidationTests` | 6 | ✅ All passed |
| `backend.Tests.ExtractStructuredJsonTests` | 7 | ✅ All passed |
| `backend.Tests.UserMessageBuilderTests` | 3 | ✅ All passed |
| `backend.Tests.AiOptionsValidationTests` | 3 | ✅ All passed |
| `backend.Tests.SentryStartupTests` | 2 | ✅ All passed |

### Individual Test Results

All 29 tests passed:
1. ✅ `DiagnoseEndpointTests.GetDiagnose_ReturnsJsonWithGroqStatusElapsedMsAndOk`
2. ✅ `DiagnoseEndpointTests.GetDiagnose_UsesOptionsInjection`
3. ✅ `DiagnoseEndpointTests.GetDiagnose_HandlesChatCompletionsFailureGracefully`
4. ✅ `DiagnoseEndpointTests.GetDiagnose_RespondsWithinReasonableTime`
5. ✅ `DiagnoseEndpointTests.GetDiagnoseDefault_IsRawMode`
6. ✅ `DiagnoseEndpointTests.GetDiagnoseSdkMode_ReturnsExpectedContract`
7. ✅ `DiagnoseEndpointTests.GetDiagnoseSdkMode_HandlesFailureGracefully`
8. ✅ `DiagnoseEndpointTests.GetDiagnose_InvalidModeFallsBackToRaw`
9. ✅ `EndpointValidationTests.PostAudit_EmptySpec_Returns400`
10. ✅ `EndpointValidationTests.PostAudit_WhitespaceOnlySpec_Returns400`
11. ✅ `EndpointValidationTests.PostAudit_SpecExceedsMaxLength_Returns413`
12. ✅ `EndpointValidationTests.PostAudit_TrimmedSpec_AcceptsSpec`
13. ✅ `EndpointValidationTests.GetConfig_ReturnsProviderName`
14. ✅ `EndpointValidationTests.GetConfig_DoesNotReturnApiKey`
15. ✅ `ExtractStructuredJsonTests.ExtractStructuredJson_WithValidJsonBlock_ReturnsJsonString`
16. ✅ `ExtractStructuredJsonTests.ExtractStructuredJson_WithNoJsonBlock_ReturnsNull`
17. ✅ `ExtractStructuredJsonTests.ExtractStructuredJson_WithInvalidJson_ReturnsNull`
18. ✅ `ExtractStructuredJsonTests.ExtractStructuredJson_WithMultipleJsonBlocks_ExtractsOnlyLast`
19. ✅ `ExtractStructuredJsonTests.ExtractStructuredJson_WithEmptyCodeBlock_ReturnsNull`
20. ✅ `ExtractStructuredJsonTests.ExtractStructuredJson_WithWhitespaceOnlyBlock_ReturnsNull`
21. ✅ `ExtractStructuredJsonTests.ExtractStructuredJson_WithTextAfterJsonBlock_ReturnsJsonString`
22. ✅ `UserMessageBuilderTests.BuildUserMessage_WithYamlHint_IncludesFormatInMessage`
23. ✅ `UserMessageBuilderTests.BuildUserMessage_WithNullFormat_FallsBackToAutoDetect`
24. ✅ `UserMessageBuilderTests.BuildUserMessage_SpecContentAppearsAfterFormatHint`
25. ✅ `AiOptionsValidationTests.Startup_MissingApiKey_ThrowsInvalidOperationException`
26. ✅ `AiOptionsValidationTests.Startup_MissingBaseUrl_ThrowsInvalidOperationException`
27. ✅ `AiOptionsValidationTests.Startup_MissingModelId_ThrowsInvalidOperationException`
28. ✅ `SentryStartupTests.HealthEndpoint_Works_WhenSentryDsnIsNotSet`
29. ✅ `SentryStartupTests.HealthEndpoint_Works_WhenSentryDsnIsSet`

## Timestamp
2026-06-04 04:38:31 UTC

## Notes
- The change moves OpenAI client creation from constructor (singleton) to per-request inside `AuditAsync` in `SpecAuditService.cs`.
- No test changes were needed — all existing tests pass unmodified.
- All component tests (ExtractStructuredJson, UserMessageBuilder) remain unaffected since they test static methods.
- Integration tests (EndpointValidation, DiagnoseEndpoint, SentryStartup, AiOptionsValidation) all pass using `WebApplicationFactory<Program>`.
- The `OpenAIClient` is created without `using` (confirmed: the SDK version's `OpenAIClient` does not implement `IDisposable`), matching the existing pattern in `AuditEndpoints.cs::DiagnoseSdkMode`.
