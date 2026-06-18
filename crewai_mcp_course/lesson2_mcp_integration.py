"""
Lesson 2: Integrating an MCP Server with CrewAI
===============================================

Objective
---------
Give a CrewAI agent "hands" so it can reach out to a FastMCP server and pull in
live data, instead of relying solely on the LLM's training knowledge.

You will learn to:
    1. Wrap a FastMCP HTTP call inside a CrewAI custom tool.
    2. Configure authentication and connection settings from the environment.
    3. Attach the tool to an agent and let it use MCP data in a task.
    4. Handle network/auth errors gracefully so one failure does not crash
       the whole crew.

Prerequisites
-------------
    pip install -r requirements.txt

Environment variables:
    OPENAI_API_KEY   - LLM provider key
    FASTMCP_URL      - base URL of your FastMCP server, e.g. http://localhost:8000
    FASTMCP_API_KEY  - bearer token for the FastMCP server

Run
---
    python lesson2_mcp_integration.py

NOTE: This assumes a FastMCP server exposing a POST /query endpoint that accepts
{"query": "..."} and returns {"result": "..."}. Adjust `_endpoint` / payload
parsing in FastMCPQueryTool to match your server's actual contract.
"""

import os
import sys

from dotenv import load_dotenv

import fastmcp_client

load_dotenv()


def check_environment() -> None:
    """Validate everything we need to contact the LLM and the MCP server."""
    missing = [
        name
        for name in ("OPENAI_API_KEY", "FASTMCP_URL", "FASTMCP_API_KEY")
        if not os.environ.get(name)
    ]
    if missing:
        sys.exit(
            "ERROR: missing required environment variables: "
            + ", ".join(missing)
            + "\nSee the course README for setup instructions."
        )


# Imported after dotenv so the module-level import order stays clean. CrewAI's
# BaseTool gives us schema validation and integration with the agent loop.
from crewai.tools import BaseTool  # noqa: E402


class FastMCPQueryTool(BaseTool):
    """A CrewAI tool that queries a FastMCP server for live information.

    The `name` and `description` are read by the LLM to decide *when* to call
    this tool, so keep the description specific and action-oriented.
    """

    name: str = "fastmcp_query"
    description: str = (
        "Query the FastMCP server for up-to-date, external information. "
        "Use this whenever you need facts you do not already know. "
        "Input should be a concise natural-language search string."
    )

    def _run(self, query: str) -> str:
        """Execute the MCP call via the shared client.

        All the HTTP, auth, and error handling lives in fastmcp_client so it can
        be tested offline without CrewAI or an LLM (see test_offline.py).
        """
        return fastmcp_client.query(query)


def build_crew():
    """Create an agent equipped with the MCP query tool and a task that uses it."""
    from crewai import Agent, Crew, Process, Task

    researcher = Agent(
        role="Research Analyst",
        goal="Answer questions accurately using live data from the MCP server.",
        backstory=(
            "You are a meticulous analyst. When you are unsure of a fact, you "
            "use the fastmcp_query tool to look it up rather than guessing."
        ),
        tools=[FastMCPQueryTool()],
        verbose=True,
        allow_delegation=False,
    )

    task = Task(
        description=(
            "Use the fastmcp_query tool to look up the latest information about "
            "'{topic}', then summarise the findings in 3-4 sentences."
        ),
        expected_output="A short, factual summary grounded in the MCP server's data.",
        agent=researcher,
    )

    return Crew(
        agents=[researcher],
        tasks=[task],
        process=Process.sequential,
        verbose=True,
    )


def main() -> None:
    check_environment()
    crew = build_crew()

    print("\n=== Running Lesson 2 crew ===\n")
    # `inputs` fills the {topic} placeholder in the task description.
    result = crew.kickoff(inputs={"topic": "the FastMCP project"})

    print("\n=== Final result ===\n")
    print(result)


if __name__ == "__main__":
    main()
