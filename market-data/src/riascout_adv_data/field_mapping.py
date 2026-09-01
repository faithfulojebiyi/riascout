"""Strict source-column resolution for SEC data mappings."""

import re
from collections.abc import Iterable


class ColumnMappingError(ValueError):
    """Base class for source-column mapping failures."""


class MissingColumnError(ColumnMappingError):
    """Raised when a required canonical field has no source column."""


class AmbiguousColumnError(ColumnMappingError):
    """Raised when more than one source column matches a canonical field."""


class ColumnResolver:
    """Resolve explicit aliases after punctuation-only normalization."""

    def __init__(self, columns: Iterable[str]) -> None:
        """Index source columns without guessing near matches."""
        self._columns = tuple(columns)

    def require(self, field_name: str, aliases: tuple[str, ...]) -> str:
        """Return the unique matching column or raise a specific mapping error."""
        result = self.optional(field_name, aliases)
        if result is None:
            raise MissingColumnError(f"Required canonical field {field_name!r} has no source column")
        return result

    def optional(self, field_name: str, aliases: tuple[str, ...]) -> str | None:
        """Return the unique matching source column, if one exists."""
        normalized_aliases = {_normalize(alias) for alias in aliases}
        matches = [column for column in self._columns if _normalize(column) in normalized_aliases]
        if len(matches) > 1:
            raise AmbiguousColumnError(
                f"Canonical field {field_name!r} matches multiple source columns: {', '.join(matches)}"
            )
        return matches[0] if matches else None


def _normalize(value: str) -> str:
    return re.sub(r"[^a-z0-9]", "", value.lower())


__all__ = ["AmbiguousColumnError", "ColumnMappingError", "ColumnResolver", "MissingColumnError"]
