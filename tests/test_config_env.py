"""Tests for Phase 6: environment variable configuration support."""

import os
from unittest.mock import patch


class TestEnvVarOverrides:
    """Verify config.py reads from IMMI_* environment variables."""

    def test_default_output_dir(self):
        from immi_case_downloader.config import OUTPUT_DIR
        # Default should be "downloaded_cases" when env var not set
        assert OUTPUT_DIR == os.environ.get("IMMI_OUTPUT_DIR", "downloaded_cases")

    def test_default_timeout(self):
        from immi_case_downloader.config import REQUEST_TIMEOUT
        assert isinstance(REQUEST_TIMEOUT, int)
        assert REQUEST_TIMEOUT > 0

    def test_default_delay(self):
        from immi_case_downloader.config import REQUEST_DELAY
        assert isinstance(REQUEST_DELAY, float)
        assert REQUEST_DELAY >= 0

    def test_default_max_retries(self):
        from immi_case_downloader.config import MAX_RETRIES
        assert isinstance(MAX_RETRIES, int)
        assert MAX_RETRIES >= 0

    def test_env_override_output_dir(self):
        with patch.dict(os.environ, {"IMMI_OUTPUT_DIR": "/tmp/test_cases"}):
            from importlib import reload
            import immi_case_downloader.config as cfg
            reload(cfg)
            assert cfg.OUTPUT_DIR == "/tmp/test_cases"
            # Restore
            reload(cfg)

    def test_env_override_timeout(self):
        with patch.dict(os.environ, {"IMMI_TIMEOUT": "60"}):
            from importlib import reload
            import immi_case_downloader.config as cfg
            reload(cfg)
            assert cfg.REQUEST_TIMEOUT == 60
            reload(cfg)

    def test_env_override_delay(self):
        with patch.dict(os.environ, {"IMMI_DELAY": "2.5"}):
            from importlib import reload
            import immi_case_downloader.config as cfg
            reload(cfg)
            assert cfg.REQUEST_DELAY == 2.5
            reload(cfg)

    def test_env_override_start_year(self):
        with patch.dict(os.environ, {"IMMI_START_YEAR": "2015"}):
            from importlib import reload
            import immi_case_downloader.config as cfg
            reload(cfg)
            assert cfg.START_YEAR == 2015
            reload(cfg)


class TestConfigConstants:
    """Verify config constants are present and correct types."""

    def test_austlii_base_is_https(self):
        from immi_case_downloader.config import AUSTLII_BASE
        assert AUSTLII_BASE.startswith("https://")

    def test_databases_have_required_fields(self):
        from immi_case_downloader.config import AUSTLII_DATABASES
        for code, info in AUSTLII_DATABASES.items():
            assert "name" in info, f"{code} missing 'name'"
            assert "path" in info, f"{code} missing 'path'"
            assert "description" in info, f"{code} missing 'description'"
            assert info["path"].startswith("/"), f"{code} path should start with /"

    def test_immigration_keywords_not_empty(self):
        from immi_case_downloader.config import IMMIGRATION_KEYWORDS
        assert len(IMMIGRATION_KEYWORDS) > 0
        assert all(isinstance(k, str) for k in IMMIGRATION_KEYWORDS)

    def test_user_agent_is_browser_like(self):
        from immi_case_downloader.config import USER_AGENT
        assert "Mozilla" in USER_AGENT
