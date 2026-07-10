"""Safe projection of tool results for logs and observer callbacks.

Tool results may remain full-fidelity on the internal dispatch/context path, but
must cross this boundary before being exposed to logs, plugins, progress feeds,
or completion callbacks.
"""

from __future__ import annotations

import json
from typing import Any

from agent.redact import redact_sensitive_text
from tools.budget_config import BudgetConfig, DEFAULT_BUDGET
from tools.tool_result_storage import maybe_persist_tool_result


def observer_safe_tool_result(
    result: Any,
    tool_name: str,
    *,
    config: BudgetConfig = DEFAULT_BUDGET,
) -> Any:
    """Return a redacted, size-bounded copy suitable for external observers.

    Small structured plugin/MCP results retain their JSON shape. Oversized
    values become the same bounded inline preview used by tool-result context
    budgeting, without persisting a second (observer-only) copy to disk.
    Redaction is forced because observer boundaries must stay safe even when
    model-context redaction has been explicitly disabled.
    """
    was_string = isinstance(result, str)
    if was_string:
        serialized = result
    else:
        try:
            serialized = json.dumps(result, ensure_ascii=False, default=str)
        except Exception:
            serialized = str(result)

    redacted = redact_sensitive_text(serialized, force=True)
    bounded = maybe_persist_tool_result(
        content=redacted,
        tool_name=tool_name,
        tool_use_id="observer",
        env=None,
        config=config,
        # Observer surfaces are always bounded, including read_file whose
        # context threshold is intentionally infinite to avoid spill loops.
        threshold=config.default_result_size,
    )

    if was_string or bounded != redacted:
        return bounded
    try:
        return json.loads(bounded)
    except (TypeError, ValueError):
        return bounded
