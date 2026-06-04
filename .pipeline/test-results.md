# Test Results

## Summary
PASS

## Build
- Status: ✅ Build succeeded
- Errors: 0

## Tests
- Count: 29 tests
- Status: ✅ Pass
- Failures: None

## Timestamp
2026-06-04 05:24:28 UTC

## Details

### Test Files and Results

| Test File | Tests | Status |
|-----------|-------|--------|
| `backend.Tests.DiagnoseEndpointTests` | 8 | ✅ All passed |
| `backend.Tests.EndpointValidationTests` | 6 | ✅ All passed |
| `backend.Tests.ExtractStructuredJsonTests` | 7 | ✅ All passed |
| `backend.Tests.UserMessageBuilderTests` | 3 | ✅ All passed |
| `backend.Tests.AiOptionsValidationTests` | 3 | ✅ All passed |
| `backend.Tests.SentryStartupTests` | 2 | ✅ All passed |

### All 29 Tests Passed

**DiagnoseEndpointTests (8):**
1. ✅ `GetDiagnose_ReturnsJsonWithGroqStatusElapsedMsAndOk`
2. ✅ `GetDiagnose_UsesOptionsInjection`
3. ✅ `GetDiagnose_HandlesChatCompletionsFailureGracefully`
4. ✅ `GetDiagnose_RespondsWithinReasonableTime`
5. ✅ `GetDiagnoseDefault_IsRawMode`
6. ✅ `GetDiagnoseSdkMode_ReturnsExpectedContract`
7. ✅ `GetDiagnoseSdkMode_HandlesFailureGracefully`
8. ✅ `GetDiagnose_InvalidModeFallsBackToRaw`

**EndpointValidationTests (6):**
9. ✅ `PostAudit_EmptySpec_Returns400`
10. ✅ `PostAudit_WhitespaceOnlySpec_Returns400`
11. ✅ `PostAudit_SpecExceedsMaxLength_Returns413`
12. ✅ `PostAudit_TrimmedSpec_AcceptsSpec`
13. ✅ `GetConfig_ReturnsProviderName`
14. ✅ `GetConfig_DoesNotReturnApiKey`

**ExtractStructuredJsonTests (7):**
15. ✅ `ExtractStructuredJson_WithValidJsonBlock_ReturnsJsonString`
16. ✅ `ExtractStructuredJson_WithNoJsonBlock_ReturnsNull`
17. ✅ `ExtractStructuredJson_WithInvalidJson_ReturnsNull`
18. ✅ `ExtractStructuredJson_WithMultipleJsonBlocks_ExtractsOnlyLast`
19. ✅ `ExtractStructuredJson_WithEmptyCodeBlock_ReturnsNull`
20. ✅ `ExtractStructuredJson_WithWhitespaceOnlyBlock_ReturnsNull`
21. ✅ `ExtractStructuredJson_WithTextAfterJsonBlock_ReturnsJsonString`

**UserMessageBuilderTests (3):**
22. ✅ `BuildUserMessage_WithYamlHint_IncludesFormatInMessage`
23. ✅ `BuildUserMessage_WithNullFormat_FallsBackToAutoDetect`
24. ✅ `BuildUserMessage_SpecContentAppearsAfterFormatHint`

**AiOptionsValidationTests (3):**
25. ✅ `Startup_MissingApiKey_ThrowsInvalidOperationException`
26. ✅ `Startup_MissingBaseUrl_ThrowsInvalidOperationException`
27. ✅ `Startup_MissingModelId_ThrowsInvalidOperationException`

**SentryStartupTests (2):**
28. ✅ `HealthEndpoint_Works_WhenSentryDsnIsNotSet`
29. ✅ `HealthEndpoint_Works_WhenSentryDsnIsSet`

## Notes
- The change replaced OpenAI SDK streaming with raw `HttpClient` + SSE parsing in `SpecAuditService.AuditAsync`.
- No test changes were needed — all 29 existing tests pass unmodified.
- Build succeeded with 0 warnings, 0 errors.
- The stale `backend.exe` process was killed before building to avoid MSB3021/MSB3027 file-copy errors.
