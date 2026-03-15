# Security Requirements

## Implementation
- **Environment Variables**: All API keys (Gemini, Firebase) are stored in environment variables.
- **Firebase Security Rules**: Strict rules to ensure users can only read/write their own data.
- **Input Validation**: Server-side sanitization of resume text before processing.
- **Rate Limiting**: Basic rate limiting on the `/api/analyze` endpoint.
- **Authentication**: All sensitive operations require a valid Firebase Auth token.
