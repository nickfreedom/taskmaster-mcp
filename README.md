# Taskmaster MCP
## Summary
This is an experiement that helped me learn how to stand up a simple MCP server and get it to prompt an agent in Cursor. The primary goal is to get agents to work through a local task list. This is a really rough concept at the moment, and could definitely stand for improvement. Use with caution and I highly discourage using this for any production systems.

*NOTE: This code was adapted from [Figma Context MCP](https://github.com/GLips/Figma-Context-MCP), and may contain artifacts from that codebase. Please contact me if there are any remaining Figma artifacts that proprietary or closed source so they can be removed.*

## Setup
Clone or copy this repo into your local project, and run the install/build commands:

```
pnpm install
```
```
pnpm run build
```

Next, create a `tasks.md` file in your project's root directory

```
## [New][#1] My First Ticket

This will be the first thing my agents will work on.
---
## [New][#2] My Second Ticket

This will be the second task.
---
## [New][#3] The Third ticket.

And so on...
---
```

## Running and Configuring the Server
To start the MCP server, run this command from the install directory:
`npx taskmaster`

If you are using Cura, add this to your `mcp.json` file to see the available tools. Use this format when creating tasks:

```
"taskmaster-mcp": {
      "name": "Custom MCP Server",
      "version": "1.0.0",
      "description": "A custom MCP server",
      "url": "http://localhost:3333/sse",
      "type": "sse"
    }
```

## Using Taskmaster
In a chat prompt, enter `start new task` and the agent will locate the `tasks.md` file to begin working on the first available task. As it works through a task it will mark it as `In Progress` so other agents sharing the task list won't collide.

