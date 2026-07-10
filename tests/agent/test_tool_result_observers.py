"""Security boundaries for tool-result logs and observer callbacks."""

import json

import model_tools
from tools.budget_config import BudgetConfig


SECRET = "sk-proj-ABCD1234567890EFGH"


def test_observer_safe_result_redacts_and_bounds_string_without_mutating_source():
    from agent.tool_result_observers import observer_safe_tool_result

    raw = f'token={SECRET}\n' + ("x" * 200)
    config = BudgetConfig(default_result_size=80, preview_size=40)

    observed = observer_safe_tool_result(raw, "mcp_demo", config=config)

    assert SECRET in raw
    assert SECRET not in observed
    assert "Truncated" in observed
    assert len(observed) < len(raw)


def test_observer_safe_result_preserves_small_non_string_shape_and_redacts_nested_values():
    from agent.tool_result_observers import observer_safe_tool_result

    raw = {"content": [{"type": "text", "text": SECRET}], "count": 1}

    observed = observer_safe_tool_result(raw, "plugin_demo")

    assert isinstance(observed, dict)
    assert observed["count"] == 1
    assert SECRET not in json.dumps(observed)
    assert raw["content"][0]["text"] == SECRET


def test_post_and_transform_plugin_observers_receive_safe_result_but_dispatch_result_stays_full(monkeypatch):
    raw = {"payload": SECRET, "body": "y" * 110_000}
    observed = []

    monkeypatch.setattr(model_tools.registry, "dispatch", lambda *args, **kwargs: raw)
    monkeypatch.setattr(model_tools, "_READ_SEARCH_TOOLS", frozenset())
    monkeypatch.setattr("hermes_cli.plugins.has_hook", lambda name: True)

    def invoke_hook(name, **kwargs):
        if name in {"post_tool_call", "transform_tool_result"}:
            observed.append((name, kwargs["result"]))
        return []

    monkeypatch.setattr("hermes_cli.plugins.invoke_hook", invoke_hook)

    result = model_tools.handle_function_call(
        "mcp_demo",
        {},
        task_id="task",
        tool_call_id="call",
        skip_pre_tool_call_hook=True,
    )

    assert result is raw
    assert [name for name, _ in observed] == ["post_tool_call", "transform_tool_result"]
    for _, value in observed:
        serialized = json.dumps(value) if not isinstance(value, str) else value
        assert SECRET not in serialized
        assert len(serialized) < 10_000
