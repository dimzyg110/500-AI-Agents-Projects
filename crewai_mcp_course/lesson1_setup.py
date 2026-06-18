"""
Lesson 1: Setting up CrewAI with MCP Server Access
===================================================

Objective
---------
Stand up the smallest possible CrewAI program: install the packages, read
configuration from the environment, create a single agent, give it one task,
and run it.

This lesson intentionally does NOT talk to the MCP server yet. The goal is to
confirm your environment works and that you understand the four core CrewAI
building blocks before adding external tools in Lesson 2:

    Agent  -> a role-playing worker backed by an LLM
    Task   -> a unit of work assigned to an agent
    Crew   -> the container that runs agents through their tasks
    Process-> how the crew executes tasks (sequential / hierarchical)

Prerequisites
-------------
    pip install -r requirements.txt

Environment variables (see README for the full list):
    OPENAI_API_KEY   - the LLM provider key CrewAI uses by default
    FASTMCP_URL      - base URL of your FastMCP server   (used from Lesson 2)
    FASTMCP_API_KEY  - bearer token for the FastMCP server (used from Lesson 2)

Run
---
    python lesson1_setup.py
"""

import os
import sys

from dotenv import load_dotenv

# Load variables from a local .env file if one exists. This is optional; real
# environment variables always take precedence.
load_dotenv()


def check_environment() -> None:
    """Fail fast with a clear message if required configuration is missing.

    For Lesson 1 we only need an LLM key. The FastMCP variables are validated
    later, in Lesson 2, when we actually contact the server.
    """
    if not os.environ.get("OPENAI_API_KEY"):
        sys.exit(
            "ERROR: OPENAI_API_KEY is not set.\n"
            "CrewAI needs an LLM provider key to drive its agents.\n"
            "Set it with:  export OPENAI_API_KEY=sk-...\n"
            "(Or configure a different provider supported by CrewAI/LiteLLM.)"
        )


def build_crew():
    """Create a one-agent, one-task crew and return it ready to run."""
    # Imported here so that `check_environment` can give a friendly error
    # before CrewAI tries to initialise its LLM client.
    from crewai import Agent, Crew, Process, Task

    # 1. Create a CrewAI agent. The role/goal/backstory shape how the
    #    underlying LLM behaves. `verbose=True` prints the agent's reasoning.
    assistant = Agent(
        role="Helpful Assistant",
        goal="Answer the user's question clearly and concisely.",
        backstory=(
            "You are a friendly assistant who explains technical topics in "
            "plain language and never invents facts."
        ),
        verbose=True,
        allow_delegation=False,
    )

    # 2. Define a task for the agent. `expected_output` tells the agent what a
    #    good answer looks like and improves result quality.
    task = Task(
        description=(
            "Explain, in two short sentences, what CrewAI is and why an agent "
            "might need access to an external MCP server."
        ),
        expected_output="A two-sentence, beginner-friendly explanation.",
        agent=assistant,
    )

    # 3. Assemble the crew. With a single agent we use a sequential process.
    return Crew(
        agents=[assistant],
        tasks=[task],
        process=Process.sequential,
        verbose=True,
    )


def main() -> None:
    check_environment()
    crew = build_crew()

    print("\n=== Running Lesson 1 crew ===\n")
    result = crew.kickoff()

    print("\n=== Final result ===\n")
    print(result)


if __name__ == "__main__":
    main()
