# System Architecture

## Overview
The application follows a modern full-stack architecture with a React frontend and an Express backend, leveraging Firebase for real-time data and authentication.

## Components
1. **Client (React)**: Handles UI, user interactions, and direct Firebase communication for data persistence.
2. **Server (Express)**: Acts as a secure proxy for the Gemini AI API to protect API keys and handle complex prompt engineering.
3. **Database (Firestore)**: Stores user profiles and analysis history.
4. **Auth (Firebase Auth)**: Manages user identity.
