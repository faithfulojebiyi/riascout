"""Local configuration and credential loading."""

import stat
from collections.abc import Mapping
from pathlib import Path


def load_api_key(*, environment: Mapping[str, str], env_file: Path) -> str:
    """Load SEC_API_KEY from the process or a permission-restricted local file."""
    value = _load_value("SEC_API_KEY", environment=environment, env_file=env_file)
    if value:
        return value
    raise RuntimeError("SEC_API_KEY is not configured in the environment or .env.local")


def load_sec_user_agent(*, environment: Mapping[str, str], env_file: Path) -> str:
    """Load and validate the identity required for automated SEC downloads."""
    value = _load_value("SEC_USER_AGENT", environment=environment, env_file=env_file)
    if not value:
        raise RuntimeError("SEC_USER_AGENT is not configured in the environment or .env.local")
    if len(value) < 10 or "@" not in value:
        raise RuntimeError("SEC_USER_AGENT must include an organization name and contact email")
    return value


def _load_value(name: str, *, environment: Mapping[str, str], env_file: Path) -> str | None:
    environment_value = environment.get(name, "").strip()
    if environment_value:
        return environment_value
    if not env_file.exists():
        return None
    mode = stat.S_IMODE(env_file.stat().st_mode)
    if mode & (stat.S_IRWXG | stat.S_IRWXO):
        raise PermissionError(f"{env_file} contains local configuration; run chmod 600 {env_file}")
    for raw_line in env_file.read_text().splitlines():
        line = raw_line.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        key, value = line.split("=", 1)
        if key.removeprefix("export ").strip() == name:
            parsed = value.strip().strip('"').strip("'")
            if parsed:
                return parsed
    return None


__all__ = ["load_api_key", "load_sec_user_agent"]
