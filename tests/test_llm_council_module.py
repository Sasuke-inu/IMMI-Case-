from __future__ import annotations

import json

import immi_case_downloader.llm_council as llm_council


def _dummy_cfg() -> llm_council.CouncilConfig:
    return llm_council.CouncilConfig(
        cf_aig_token="test-cf-aig-token",
        cf_gateway_url="https://gateway.ai.cloudflare.com/v1/test/immi-council/compat/chat/completions",
        openai_model="openai/test-openai",
        gemini_pro_model="google-ai-studio/test-gemini-pro",
        anthropic_model="anthropic/test-anthropic",
        gemini_flash_model="google-ai-studio/test-gemini-flash",
        max_output_tokens=512,
        moderator_max_output_tokens=1024,
        timeout_seconds=5,
        openai_system_prompt="",
        gemini_pro_system_prompt="",
        anthropic_system_prompt="",
        moderator_system_prompt="",
    )


def _successful_opinions() -> list[llm_council.CouncilOpinion]:
    return [
        llm_council.CouncilOpinion(
            provider_key="openai",
            provider_label="OpenAI",
            model="test-openai",
            success=True,
            answer="Migration Act 1958 (Cth) s 36 may be engaged.",
        ),
        llm_council.CouncilOpinion(
            provider_key="gemini_pro",
            provider_label="Google Gemini Pro",
            model="test-gemini-pro",
            success=True,
            answer="Procedural fairness issues also point to Migration Act 1958 (Cth) s 424A.",
        ),
    ]


def test_repair_truncated_json_recovers_lossy_payload():
    # String truncated mid-value
    truncated = '{"a":1,"b":"hello'
    repaired = llm_council._repair_truncated_json(truncated)
    # The incomplete field is dropped; outer object is closed
    import json as _json
    parsed = _json.loads(repaired)
    assert parsed == {"a": 1}

    # Array truncated mid-string item
    truncated = '{"items":["one","two","incompl'
    repaired = llm_council._repair_truncated_json(truncated)
    parsed = _json.loads(repaired)
    # 2 complete items recovered, 3rd dropped
    assert parsed["items"][:2] == ["one", "two"]

    # Nested objects truncated at deepest level
    truncated = '{"outer":{"inner":{"k":"v","x":'
    repaired = llm_council._repair_truncated_json(truncated)
    parsed = _json.loads(repaired)
    assert parsed["outer"]["inner"] == {"k": "v"}

    # Already complete JSON is unchanged in semantics
    complete = '{"a":1}'
    assert _json.loads(llm_council._repair_truncated_json(complete)) == {"a": 1}


def test_extract_first_json_object_recovers_truncated_moderator_output():
    # Realistic shape — Gemini Flash hits max_tokens mid follow_up_questions
    truncated = (
        '```json\n{\n'
        '  "ranking": [{"provider_key":"openai","score":90,"reason":"good"}],\n'
        '  "outcome_likelihood_percent": 65,\n'
        '  "outcome_likelihood_label": "medium",\n'
        '  "law_sections": ["Migration Act 1958 (Cth) s 36"],\n'
        '  "follow_up_questions": ["What was the precise content'
    )
    parsed = llm_council._extract_first_json_object(truncated)
    assert parsed is not None
    assert parsed["outcome_likelihood_percent"] == 65
    assert parsed["outcome_likelihood_label"] == "medium"
    assert parsed["law_sections"] == ["Migration Act 1958 (Cth) s 36"]
    assert parsed["ranking"][0]["provider_key"] == "openai"


def test_extract_first_json_object_handles_fenced_and_noisy_inputs():
    # Pure JSON
    p = llm_council._extract_first_json_object('{"a":1}')
    assert p == {"a": 1}

    # Markdown fence (Gemini Flash habit)
    p = llm_council._extract_first_json_object('```json\n{"a":1,"b":[2,3]}\n```')
    assert p == {"a": 1, "b": [2, 3]}

    # Lowercase fence
    p = llm_council._extract_first_json_object('```\n{"a":1}\n```')
    assert p == {"a": 1}

    # JSON followed by prose
    p = llm_council._extract_first_json_object('{"a":1}\n\nNote: my reasoning above.')
    assert p == {"a": 1}

    # JSON containing strings with braces and escaped quotes
    p = llm_council._extract_first_json_object(
        '{"a":"hello {world} \\"quoted\\""}'
    )
    assert p == {"a": 'hello {world} "quoted"'}

    # Empty / garbage
    assert llm_council._extract_first_json_object("") is None
    assert llm_council._extract_first_json_object("just prose") is None


def test_strip_reasoning_artifacts_handles_qwq_and_fenced_shapes():
    # Properly fenced — drop the inner think block, keep the answer
    fenced = "<think>internal chain of thought</think>The answer is 42."
    assert llm_council._strip_reasoning_artifacts(fenced) == "The answer is 42."

    # QwQ-style — no opening tag, just trailing close. Everything before the
    # last </think> is reasoning and must be discarded.
    qwq = "Okay, let me think about this... </think>\n\nFinal answer: 42."
    assert llm_council._strip_reasoning_artifacts(qwq) == "Final answer: 42."

    # No artifacts — pass-through (only stripped of whitespace).
    plain = "  Just a regular answer.  "
    assert llm_council._strip_reasoning_artifacts(plain) == "Just a regular answer."

    # Multiple fenced blocks — all stripped.
    multi = "<think>step1</think>Hello <think>step2</think>world."
    assert llm_council._strip_reasoning_artifacts(multi) == "Hello world."

    # Empty / None-safe
    assert llm_council._strip_reasoning_artifacts("") == ""


def test_fallback_moderator_builds_compact_synthesis_without_scope_errors():
    payload = llm_council._fallback_moderator(_successful_opinions())

    assert payload["success"] is True
    assert "[OpenAI]" in payload["composed_answer"]
    assert "[Google Gemini Pro]" in payload["composed_answer"]
    assert payload["mock_judgment"] == payload["composed_answer"]


def test_run_moderator_uses_parsed_mock_judgment_and_composed_answer(monkeypatch):
    moderator_payload = {
        "ranking": [
            {"provider_key": "openai", "score": 91, "reason": "Best structured answer."},
            {"provider_key": "gemini_pro", "score": 84, "reason": "Useful secondary analysis."},
        ],
        "model_critiques": [
            {
                "provider_key": "openai",
                "score": 91,
                "vote": "support",
                "strengths": "Strong statutory framing.",
                "weaknesses": "",
                "critique": "Most complete answer.",
            },
            {
                "provider_key": "gemini_pro",
                "score": 84,
                "vote": "neutral",
                "strengths": "Helpful procedural fairness angle.",
                "weaknesses": "",
                "critique": "Less complete than OpenAI.",
            },
        ],
        "vote_summary": {
            "winner_provider_key": "openai",
            "winner_reason": "Best structured answer.",
            "support_count": 1,
            "neutral_count": 1,
            "oppose_count": 0,
        },
        "agreement_points": ["Both answers identify review-ground risk."],
        "conflict_points": [],
        "provider_law_sections": {
            "openai": ["Migration Act 1958 (Cth) s 36"],
            "gemini_pro": ["Migration Act 1958 (Cth) s 424A"],
        },
        "shared_law_sections": [],
        "consensus": "Both answers identify review-ground risk.",
        "disagreements": "",
        "outcome_likelihood_percent": 62,
        "outcome_likelihood_label": "medium",
        "outcome_likelihood_reason": "Mixed but reviewable issues exist.",
        "law_sections": ["Migration Act 1958 (Cth) s 36"],
        "mock_judgment": "The Tribunal decision should be reconsidered.",
        "composed_answer": "The strongest issue is procedural fairness.",
        "follow_up_questions": ["What material was not put to the applicant?"],
    }

    def _fake_run_gateway_expert(**_kwargs):
        return llm_council.CouncilOpinion(
            provider_key="gemini_flash",
            provider_label="Google Gemini Flash (Moderator)",
            model="test-gemini-flash",
            success=True,
            answer=json.dumps(moderator_payload),
        )

    monkeypatch.setattr(llm_council, "_run_gateway_expert", _fake_run_gateway_expert)

    payload = llm_council._run_moderator(
        question="What are the strongest grounds for review?",
        case_context="Focus on procedural fairness.",
        opinions=_successful_opinions(),
        cfg=_dummy_cfg(),
    )

    assert payload["success"] is True
    assert payload["mock_judgment"] == "The Tribunal decision should be reconsidered."
    assert payload["composed_answer"] == "The strongest issue is procedural fairness."
