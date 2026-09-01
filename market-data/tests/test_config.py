import os
from pathlib import Path

import pytest

from riascout_adv_data.config import load_api_key, load_sec_user_agent


def test_load_api_key_prefers_process_environment(tmp_path: Path) -> None:
    environment = {"SEC_API_KEY": "from-environment"}
    (tmp_path / ".env.local").write_text("SEC_API_KEY=from-file\n")

    assert load_api_key(environment=environment, env_file=tmp_path / ".env.local") == "from-environment"


def test_load_api_key_reads_secure_local_file(tmp_path: Path) -> None:
    env_file = tmp_path / ".env.local"
    env_file.write_text('SEC_API_KEY="from-file"\n')
    env_file.chmod(0o600)

    assert load_api_key(environment={}, env_file=env_file) == "from-file"


def test_load_api_key_rejects_group_or_world_readable_file(tmp_path: Path) -> None:
    env_file = tmp_path / ".env.local"
    env_file.write_text("SEC_API_KEY=unsafe\n")
    env_file.chmod(0o644)

    with pytest.raises(PermissionError, match="chmod 600"):
        load_api_key(environment={}, env_file=env_file)


def test_load_api_key_errors_when_no_key_is_available(tmp_path: Path) -> None:
    with pytest.raises(RuntimeError, match="SEC_API_KEY"):
        load_api_key(environment=os.environ.copy() | {"SEC_API_KEY": ""}, env_file=tmp_path / "missing")


def test_load_sec_user_agent_requires_contact_identity(tmp_path: Path) -> None:
    with pytest.raises(RuntimeError, match="SEC_USER_AGENT"):
        load_sec_user_agent(environment={}, env_file=tmp_path / "missing")


def test_load_sec_user_agent_accepts_named_contact(tmp_path: Path) -> None:
    value = load_sec_user_agent(
        environment={"SEC_USER_AGENT": "Asset research contact@example.com"},
        env_file=tmp_path / "missing",
    )

    assert value == "Asset research contact@example.com"


def test_load_sec_user_agent_rejects_value_without_email(tmp_path: Path) -> None:
    with pytest.raises(RuntimeError, match="contact email"):
        load_sec_user_agent(environment={"SEC_USER_AGENT": "Asset research"}, env_file=tmp_path / "missing")


def test_load_sec_user_agent_reads_secure_local_file(tmp_path: Path) -> None:
    env_file = tmp_path / ".env.local"
    env_file.write_text("SEC_USER_AGENT=Asset research contact@example.com\n")
    env_file.chmod(0o600)

    assert load_sec_user_agent(environment={}, env_file=env_file) == "Asset research contact@example.com"
