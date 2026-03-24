from __future__ import annotations

import json
import logging
import os
import zipfile
from pathlib import Path

from app.plugins.exceptions import PluginManifestError

logger = logging.getLogger("acp.plugins.utils")

_REQUIRED_MANIFEST_FIELDS = {"id", "name", "version", "entry_point"}
_PLUGIN_DATA_DIR_ENV = "ACP_PLUGIN_DATA_DIR"
_DEFAULT_PLUGIN_DATA_DIR = "/data/plugins"


def parse_manifest(plugin_path: Path) -> dict:
    """Read and validate manifest.json from a plugin directory.

    Raises PluginManifestError if the manifest is missing or invalid.
    """
    manifest_file = plugin_path / "manifest.json"
    if not manifest_file.exists():
        raise PluginManifestError(
            f"No manifest.json found in {plugin_path}",
            plugin_id=plugin_path.name,
        )

    try:
        manifest = json.loads(manifest_file.read_text(encoding="utf-8"))
    except json.JSONDecodeError as exc:
        raise PluginManifestError(
            f"Invalid JSON in manifest.json: {exc}",
            plugin_id=plugin_path.name,
        ) from exc

    errors = validate_manifest(manifest)
    if errors:
        raise PluginManifestError(
            f"Manifest validation failed: {'; '.join(errors)}",
            plugin_id=manifest.get("id", plugin_path.name),
        )

    return manifest


def validate_manifest(manifest: dict) -> list[str]:
    """Validate a manifest dict and return a list of error messages.

    Returns an empty list if the manifest is valid.
    """
    errors: list[str] = []

    if not isinstance(manifest, dict):
        return ["Manifest must be a JSON object"]

    missing = _REQUIRED_MANIFEST_FIELDS - set(manifest.keys())
    if missing:
        errors.append(f"Missing required fields: {', '.join(sorted(missing))}")

    plugin_id = manifest.get("id")
    if plugin_id is not None:
        if not isinstance(plugin_id, str):
            errors.append("'id' must be a string")
        elif len(plugin_id) > 50:
            errors.append("'id' must be 50 characters or less")
        elif not plugin_id.replace("-", "").replace("_", "").isalnum():
            errors.append("'id' must contain only alphanumeric, hyphens, or underscores")

    name = manifest.get("name")
    if name is not None and not isinstance(name, str):
        errors.append("'name' must be a string")

    version = manifest.get("version")
    if version is not None and not isinstance(version, str):
        errors.append("'version' must be a string")

    if "permissions" in manifest and not isinstance(manifest["permissions"], list):
        errors.append("'permissions' must be a list")

    if "dependencies" in manifest and not isinstance(manifest["dependencies"], dict):
        errors.append("'dependencies' must be a dict")

    return errors


def extract_plugin_zip(zip_path: Path, dest_dir: Path) -> Path:
    """Safely extract a plugin zip archive to dest_dir.

    Returns the path to the extracted plugin directory.
    Raises PluginManifestError if the zip is invalid.
    """
    if not zipfile.is_zipfile(zip_path):
        raise PluginManifestError(
            f"Not a valid zip file: {zip_path}",
        )

    dest_dir.mkdir(parents=True, exist_ok=True)

    with zipfile.ZipFile(zip_path, "r") as zf:
        # Security: check for path traversal
        for member in zf.namelist():
            member_path = (dest_dir / member).resolve()
            if not str(member_path).startswith(str(dest_dir.resolve())):
                raise PluginManifestError(
                    f"Zip contains path traversal entry: {member}",
                )
        zf.extractall(dest_dir)

    # Determine plugin root — could be a single subdirectory or dest_dir itself
    subdirs = [d for d in dest_dir.iterdir() if d.is_dir()]
    if len(subdirs) == 1 and (subdirs[0] / "manifest.json").exists():
        return subdirs[0]

    if (dest_dir / "manifest.json").exists():
        return dest_dir

    raise PluginManifestError(
        f"Extracted zip does not contain a manifest.json in {dest_dir}",
    )


def get_plugin_data_dir() -> Path:
    """Return the base directory for plugin data storage.

    Configurable via ACP_PLUGIN_DATA_DIR env var, defaults to /data/plugins/.
    """
    data_dir = Path(os.environ.get(_PLUGIN_DATA_DIR_ENV, _DEFAULT_PLUGIN_DATA_DIR))
    data_dir.mkdir(parents=True, exist_ok=True)
    return data_dir


def resolve_dependencies(
    installed: list[dict], manifest: dict
) -> list[str]:
    """Check if required plugin dependencies are installed.

    Returns a list of missing dependency plugin IDs.
    """
    dependencies = manifest.get("dependencies", {})
    if not dependencies:
        return []

    installed_ids = {p["plugin_id"] for p in installed}
    missing = [
        dep_id
        for dep_id in dependencies
        if dep_id not in installed_ids
    ]
    return missing
