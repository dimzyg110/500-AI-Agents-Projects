"""
Lesson 3: Advanced CrewAI Patterns with an MCP Server
=====================================================

Objective
---------
Scale from a single agent to a coordinated *team* that uses the FastMCP server
as shared memory, and add a quality-assurance feedback loop.

Workflow (mirrors the README diagram):

    Researcher  <-->  FastMCP Server      (read live data, store findings)
    Researcher  --->  Writer  --->  Reviewer  --->  Output
                         ^-------- feedback --------/

You will learn to:
    1. Build a multi-agent workflow (Researcher, Writer, Reviewer).
    2. Run it under a hierarchical process with a manager LLM.
    3. Share data between agents by storing/retrieving it on the MCP server.
    4. Implement a QA loop where the Reviewer's feedback refines the Writer's draft.

Prerequisites
-------------
    pip install -r requirements.txt

Environment variables:
    OPENAI_API_KEY   - LLM provider key (also used as the manager LLM)
    FASTMCP_URL      - base URL of your FastMCP server
    FASTMCP_API_KEY  - bearer token for the FastMCP server

This builds on the FastMCPQueryTool from Lesson 2 and adds a FastMCPStoreTool so
agents can persist findings for one another to read back.

Run
---
    python lesson3_advanced_patterns.py
"""

import os
import sys

from dotenv import load_dotenv

import fastmcp_client

load_dotenv()


def check_environment() -> None:
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


from crewai.tools import BaseTool  # noqa: E402


class FastMCPQueryTool(BaseTool):
    """Read live information from the FastMCP server (same as Lesson 2)."""

    name: str = "fastmcp_query"
    description: str = (
        "Query the FastMCP server for up-to-date external information. "
        "Input: a concise natural-language search string."
    )

    def _run(self, query: str) -> str:
        return fastmcp_client.query(query)


class FastMCPStoreTool(BaseTool):
    """Persist a finding on the FastMCP server under a key, so other agents can
    retrieve it later. This is how agents share state through the server rather
    than only passing context in-memory.
    """

    name: str = "fastmcp_store"
    description: str = (
        "Store a piece of text on the FastMCP server so other agents can read "
        "it later. Input format: 'key: value' — the part before the first "
        "colon is the storage key, the rest is the content to save."
    )

    def _run(self, payload: str) -> str:
        if ":" not in payload:
            return "[fastmcp_store error] Input must be in the form 'key: value'."
        key, _, value = payload.partition(":")
        return fastmcp_client.store(key.strip(), value.strip())


def build_crew():
    """Assemble a hierarchical research-write-review crew with a QA loop."""
    from crewai import Agent, Crew, Process, Task

    query_tool = FastMCPQueryTool()
    store_tool = FastMCPStoreTool()

    # --- Agents ------------------------------------------------------------
    researcher = Agent(
        role="Research Analyst",
        goal="Gather accurate facts about the topic from the MCP server.",
        backstory=(
            "You dig up reliable information using the fastmcp_query tool and "
            "save your key findings with fastmcp_store so teammates can use them."
        ),
        tools=[query_tool, store_tool],
        verbose=True,
        allow_delegation=False,
    )

    writer = Agent(
        role="Technical Writer",
        goal="Turn the researcher's findings into a clear, structured report.",
        backstory=(
            "You write concise, well-organised reports. You can read stored "
            "findings with fastmcp_query and you revise your drafts whenever the "
            "reviewer asks for changes."
        ),
        tools=[query_tool],
        verbose=True,
        allow_delegation=False,
    )

    reviewer = Agent(
        role="Quality Reviewer",
        goal="Ensure the report is accurate, clear, and complete.",
        backstory=(
            "You are a demanding editor. You check the draft against the facts "
            "and give specific, actionable feedback, approving only when the "
            "report meets a high standard."
        ),
        verbose=True,
        allow_delegation=False,
    )

    # --- Tasks -------------------------------------------------------------
    research_task = Task(
        description=(
            "Research the topic '{topic}'. Use fastmcp_query to gather facts, "
            "then store a bullet list of the most important findings using "
            "fastmcp_store under the key 'research:{topic}'."
        ),
        expected_output="A confirmation that key findings were stored, plus the bullet list.",
        agent=researcher,
    )

    write_task = Task(
        description=(
            "Write a clear report on '{topic}' based on the stored research "
            "findings. Retrieve them with fastmcp_query if needed. Aim for a "
            "title, a short intro, and 3-5 key points."
        ),
        expected_output="A structured draft report in Markdown.",
        agent=writer,
        context=[research_task],
    )

    review_task = Task(
        description=(
            "Review the draft report on '{topic}' for accuracy, clarity, and "
            "completeness. If it is not good enough, list specific changes for "
            "the writer. If it is, reply with the final approved report."
        ),
        expected_output="Either actionable feedback or the final approved report.",
        agent=reviewer,
        context=[write_task],
    )

    # --- Crew --------------------------------------------------------------
    # A hierarchical process puts a manager LLM in charge of delegating and
    # coordinating the specialists, including looping back to the writer when
    # the reviewer requests changes.
    return Crew(
        agents=[researcher, writer, reviewer],
        tasks=[research_task, write_task, review_task],
        process=Process.hierarchical,
        manager_llm="gpt-4o",
        verbose=True,
    )


def main() -> None:
    check_environment()
    crew = build_crew()

    print("\n=== Running Lesson 3 crew ===\n")
    result = crew.kickoff(inputs={"topic": "multi-agent systems with CrewAI"})

    print("\n=== Final approved report ===\n")
    print(result)


if __name__ == "__main__":
    main()
