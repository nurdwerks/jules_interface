# Agent Instructions

This document outlines the coding standards and architectural decisions for the backend of this project. Agents (and human developers) must follow these guidelines when making changes or adding new features.

## Backend Framework: Fastify
- Use **[Fastify](https://www.fastify.io/)** as the core web framework.
- Prioritize low overhead and high performance.
- Use built-in Fastify validation (JSON Schema) for all request inputs.

## Plugins Architecture
- All features should be implemented as **Plugins**.
- Use `fastify-plugin` to expose decorators, hooks, or shared utilities to the wider instance scope.
- Keep route-specific context encapsulated.
- Avoid global state; rely on Fastify's dependency injection via decorators.

## Autoloading
- Use **[fastify-autoload](https://github.com/fastify/fastify-autoload)** to organize and load the application structure.
- Structure the application as follows:
  - `plugins/`: Reusable shared plugins (database connections, authentication, etc.).
  - `routes/`: API route definitions. The folder structure should mirror the URL path.
- Do not manually register plugins in the main entry point if they can be autoloaded.

## Websockets
- Use **[@fastify/websocket](https://github.com/fastify/fastify-websocket)** for real-time capabilities.
- Websockets should be used for:
  - Pushing session updates to the client.
  - Streaming log output or activity feeds.
- Ensure connections are properly managed (handling disconnects, heartbeats).
- Websocket logic should also be modularized within plugins/routes.
- **Authentication**: Authentication over websockets requires a login prompt.

## Frontend Guidelines
- **User Interaction**: Do not use `alert()`, `confirm()`, or `prompt()` (or other native popups). Use custom Toasts and Modals instead for a consistent and non-blocking user experience.
