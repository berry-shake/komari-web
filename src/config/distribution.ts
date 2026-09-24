// All executable downloads and update checks belong to this distribution.
export const SERVER_REPOSITORY = "berry-shake/komari";
export const AGENT_REPOSITORY = "berry-shake/komari-agent";
export const MAINTENANCE_BRANCH = "mod-single-db";
export const SERVER_RELEASES_URL = `https://api.github.com/repos/${SERVER_REPOSITORY}/releases?per_page=100`;
export const SERVER_URL = `https://github.com/${SERVER_REPOSITORY}`;
export const SERVER_README_URL = `https://raw.githubusercontent.com/${SERVER_REPOSITORY}/refs/heads/${MAINTENANCE_BRANCH}/README.md`;
export const SERVER_README_PAGE = `${SERVER_URL}/blob/${MAINTENANCE_BRANCH}/README.md`;
export const AGENT_IMAGE = `ghcr.io/${AGENT_REPOSITORY}:latest`;
export const agentInstallerUrl = (file: string) =>
  `https://raw.githubusercontent.com/${AGENT_REPOSITORY}/refs/heads/${MAINTENANCE_BRANCH}/${file}`;
